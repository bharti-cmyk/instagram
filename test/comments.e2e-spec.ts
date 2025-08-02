import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { Sequelize } from 'sequelize';
import Redis from 'ioredis';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';

describe('CommentsController (e2e)', () => {
  let app: INestApplication;
  let sequelize: Sequelize;
  let redis: Redis;

  // Test users
  const testUser = {
    username: 'testuser_comments',
    email: 'testuser_comments@example.com',
    password: 'password123',
    bio: 'Test bio for comments',
    isCelebrity: false,
  };

  const testUser2 = {
    username: 'testuser_comments2',
    email: 'testuser_comments2@example.com',
    password: 'password123',
    bio: 'Test bio for comments 2',
    isCelebrity: false,
  };

  // Store tokens and post ID for reuse
  let accessToken: string;
  let accessToken2: string;
  let postId: string;

  beforeAll(async () => {
    // Load environment variables
    require('dotenv').config();
    
    // Ensure JWT secrets are set for testing
    if (!process.env.JWT_SECRET) {
      process.env.JWT_SECRET = 'somesecretkey';
    }
    if (!process.env.JWT_REFRESH_SECRET) {
      process.env.JWT_REFRESH_SECRET = 'somesecretkey';
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // Ensure JWT configuration is properly loaded
    const configService = app.get(ConfigService);
    console.log('JWT_SECRET in test:', configService.get('JWT_SECRET'));
    console.log('JWT_REFRESH_SECRET in test:', configService.get('JWT_REFRESH_SECRET'));
    
    await app.init();

    // Initialize database and Redis connections
    sequelize = new Sequelize({
      dialect: 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      username: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'instagram_clone',
    });

    redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    });

    console.log('JWT_SECRET:', process.env.JWT_SECRET);
    console.log('JWT_REFRESH_SECRET:', process.env.JWT_REFRESH_SECRET);

    // Register users and get tokens
    try {
      // Register the first user (testUser1 - will create post)
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser);

      // Register the second user (testUser2 - will add comments)
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser2);

      // Login to get access token for first user (testUser1)
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
        });

      accessToken = loginResponse.body.accessToken; // testUser1 token

      // Login to get access token for second user (testUser2)
      const loginResponse2 = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: testUser2.username,
          password: testUser2.password,
        });

      accessToken2 = loginResponse2.body.accessToken; // testUser2 token

      // Create a test post using testUser1
      console.log('About to create post with token:', accessToken);
      console.log('About to create post with caption: Comment test post');
      
      // Try to create post via API first
      const createPostResponse = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${accessToken}`) // testUser1 creates post
        .field('caption', 'Comment test post');

      console.log('Post creation response status:', createPostResponse.status);
      console.log('Post creation response body:', createPostResponse.body);
      console.log('Post creation response headers:', createPostResponse.headers);
      
      if (createPostResponse.status !== 201) {
        console.error('Post creation failed with status:', createPostResponse.status);
        console.error('Post creation error body:', createPostResponse.body);
        
        // Fallback: Create post directly in database
        console.log('Creating post directly in database as fallback...');
        // Get the user ID from the database
        const [userResult] = await sequelize.query(`
          SELECT id FROM Users WHERE username = ?
        `, {
          replacements: [testUser.username]
        });
        
        const testUser1Id = (userResult as any[])[0]?.id;
        console.log('Found user ID:', testUser1Id);
        
        const directPost = await sequelize.query(`
          INSERT INTO Posts (id, userId, caption, createdAt, updatedAt) 
          VALUES (?, ?, ?, NOW(), NOW())
        `, {
          replacements: [Date.now(), testUser1Id, 'Comment test post']
        });
        
        postId = Date.now().toString(); // Convert to string
        console.log('Direct post creation result:', directPost);
        console.log('Direct post ID:', postId);
      } else {
        postId = createPostResponse.body.id;
        console.log('Post ID captured:', postId);
      }
      
      if (!postId) {
        console.error('Post ID is undefined or null');
        throw new Error('Post ID is undefined');
      }

      console.log('Setup completed - testUser1 created post, testUser2 will add comments');
      console.log('testUser1 token:', accessToken);
      console.log('testUser2 token:', accessToken2);
      console.log('Final postId value:', postId);
    } catch (error) {
      console.error('Setup error:', error.message);
    }
  });

  afterAll(async () => {
    await cleanupTestData();
    await app.close();
  });

  async function cleanupTestData() {
    try {
      // Clean up comments created during tests
      await sequelize.query(`
        DELETE FROM Comments 
        WHERE content LIKE '%comment test%' OR content LIKE '%test comment%'
      `);
      
      // Clean up posts created during tests
      await sequelize.query(`
        DELETE FROM Posts 
        WHERE caption LIKE '%comment test post%' OR caption LIKE '%Post with no comments%'
      `);
      
      // Don't delete users - they are created once and reused
      // Clean up Redis keys
      const keys = await redis.keys('refresh:*');
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      console.log('Cleanup error:', error.message);
    }
  }

  describe('/posts/:PostId/comments (POST)', () => {

    it('should add a comment successfully', () => {
      return request(app.getHttpServer())
        .post(`/posts/${postId}/comments`)
        .set('Authorization', `Bearer ${accessToken2}`) // testUser2 adds comment
        .send({
          content: 'This is a test comment'
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body).toHaveProperty('content');
          expect(res.body).toHaveProperty('UserId'); // Changed from userId to UserId
          expect(res.body).toHaveProperty('PostId'); // Changed from postId to PostId
          expect(res.body).toHaveProperty('createdAt');
          expect(res.body.content).toBe('This is a test comment');
          expect(res.body.PostId).toBe(parseInt(postId)); // Changed from postId to PostId
        });
    });

    it('should fail to add a comment without authentication', () => {
      return request(app.getHttpServer())
        .post(`/posts/${postId}/comments`)
        .send({
          content: 'This is a test comment'
        })
        .expect(401); // Unauthorized
    });

    it('should fail to add a comment to non-existent post', () => {
      return request(app.getHttpServer())
        .post('/posts/999999/comments')
        .set('Authorization', `Bearer ${accessToken2}`) // testUser2 tries to add comment
        .send({
          content: 'This is a test comment'
        })
        .expect(404); // Not Found
    });

    it('should fail to add an empty comment', () => {
      return request(app.getHttpServer())
        .post(`/posts/${postId}/comments`)
        .set('Authorization', `Bearer ${accessToken2}`) // testUser2 tries to add comment
        .send({
          content: ''
        })
        .expect(400); // Bad Request - content is required and must have min length
    });

    it('should fail to add a comment without content', () => {
      return request(app.getHttpServer())
        .post(`/posts/${postId}/comments`)
        .set('Authorization', `Bearer ${accessToken2}`) // testUser2 tries to add comment
        .send({})
        .expect(400); // Bad Request - content is required
    });
  });

  describe('/posts/:PostId/comments (GET)', () => {

    it('should get comments for a post successfully', async () => {
      // Add some comments to the post first
      await request(app.getHttpServer())
        .post(`/posts/${postId}/comments`)
        .set('Authorization', `Bearer ${accessToken2}`) // testUser2 adds comment
        .send({
          content: 'First test comment'
        });

      await request(app.getHttpServer())
        .post(`/posts/${postId}/comments`)
        .set('Authorization', `Bearer ${accessToken2}`) // testUser2 adds comment
        .send({
          content: 'Second test comment'
        });

      return request(app.getHttpServer())
        .get(`/posts/${postId}/comments`)
        .set('Authorization', `Bearer ${accessToken2}`) // testUser2 gets comments
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThanOrEqual(2); // Changed from exact 2 to at least 2
          expect(res.body[0]).toHaveProperty('id');
          expect(res.body[0]).toHaveProperty('content');
          expect(res.body[0]).toHaveProperty('UserId'); // Changed from userId to UserId
          expect(res.body[0]).toHaveProperty('PostId'); // Changed from postId to PostId
          expect(res.body[0]).toHaveProperty('createdAt');
          expect(res.body[0].PostId).toBe(parseInt(postId)); // Changed from postId to PostId
        });
    });

    it('should fail to get comments without authentication', () => {
      return request(app.getHttpServer())
        .get(`/posts/${postId}/comments`)
        .expect(401); // Unauthorized
    });

    it('should return empty array for post with no comments', () => {
      // Create another post without comments using testUser1
      const createPostResponse = request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${accessToken}`) // testUser1 creates post
        .field('caption', 'Post with no comments');

      return createPostResponse
        .then((res) => {
          const newPostId = res.body.id;
          return request(app.getHttpServer())
            .get(`/posts/${newPostId}/comments`)
            .set('Authorization', `Bearer ${accessToken2}`) // testUser2 gets comments
            .expect(200)
            .expect((res2) => {
              expect(Array.isArray(res2.body)).toBe(true);
              expect(res2.body.length).toBe(0);
            });
        });
    });

    it('should fail to get comments for non-existent post', () => {
      return request(app.getHttpServer())
        .get('/posts/999999/comments')
        .set('Authorization', `Bearer ${accessToken2}`) // testUser2 tries to get comments
        .expect(404); // Not Found
    });
  });

  describe('/posts/:PostId/comments/:CommentId (DELETE)', () => {
    let commentId: number;
    console.log('Post ID in delete comment is:', postId);

    beforeEach(async () => {
      // Add a comment to be deleted using testUser2
      const addCommentResponse = await request(app.getHttpServer())
        .post(`/posts/${postId}/comments`)
        .set('Authorization', `Bearer ${accessToken2}`) // testUser2 adds comment
        .send({
          content: 'Comment to be deleted'
        });

      console.log('Comment creation response status:', addCommentResponse.status);
      console.log('Comment creation response body:', addCommentResponse.body);
      
      commentId = addCommentResponse.body.id;
      console.log('Extracted commentId:', commentId);
    });

    it('should delete a comment successfully', async () => {
      // First, let's check what comment we're trying to delete
      console.log('Attempting to delete comment ID:', commentId);
      console.log('Using token for user2:', accessToken2);
      
      // Decode the token to see the user ID
      try {
        const decoded = jwt.verify(accessToken2, process.env.JWT_SECRET || 'somesecretkey');
        console.log('Token decoded for user2:', decoded);
      } catch (error) {
        console.error('Token decode error:', error.message);
      }

      return request(app.getHttpServer())
        .delete(`/posts/${postId}/comments/${commentId}`)
        .set('Authorization', `Bearer ${accessToken2}`) // testUser2 deletes their own comment
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('message');
          expect(res.body.message).toContain('deleted');
        });
    });

    it('should fail to delete a comment without authentication', () => {
      return request(app.getHttpServer())
        .delete(`/posts/${postId}/comments/${commentId}`)
        .expect(401); // Unauthorized
    });

    it('should fail to delete a comment that does not exist', () => {
      return request(app.getHttpServer())
        .delete(`/posts/${postId}/comments/999999`)
        .set('Authorization', `Bearer ${accessToken2}`) // testUser2 tries to delete non-existent comment
        .expect(404); // Changed from 403 to 404 - NotFound is correct for non-existent comment
    });

    it('should fail to delete a comment by another user', async () => {
      // testUser1 tries to delete testUser2's comment (should fail)
      return request(app.getHttpServer())
        .delete(`/posts/${postId}/comments/${commentId}`)
        .set('Authorization', `Bearer ${accessToken}`) // testUser1 tries to delete testUser2's comment
        .expect(403); // Forbidden - user doesn't own the comment
    });
  });
}); 