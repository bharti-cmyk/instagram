import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { Sequelize } from 'sequelize';
import Redis from 'ioredis';
import * as jwt from 'jsonwebtoken';
import * as path from 'path';
import * as fs from 'fs';

describe('PostController (e2e)', () => {
  let app: INestApplication;
  let sequelize: Sequelize;
  let redis: Redis;

  // Test users
  const testUser = {
    username: 'testuser_posts',
    email: 'testuser_posts@example.com',
    password: 'password123',
    bio: 'Test bio for posts',
    isCelebrity: false,
  };

  const testUser2 = {
    username: 'testuser_posts2',
    email: 'testuser_posts2@example.com',
    password: 'password123',
    bio: 'Test bio for posts 2',
    isCelebrity: false,
  };

  beforeAll(async () => {
    // Load environment variables
    require('dotenv').config();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
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
  });

  afterAll(async () => {
    await cleanupTestData();
    await app.close();
  });

  async function cleanupTestData() {
    try {
      // Clean up posts created during tests
      await sequelize.query(`
        DELETE FROM Posts 
        WHERE caption LIKE '%test post%' OR caption LIKE '%updated post%'
      `);
      
      // Clean up users created during tests
      await sequelize.query(`
        DELETE FROM Users 
        WHERE username IN ('${testUser.username}', '${testUser2.username}')
        OR email IN ('${testUser.email}', '${testUser2.email}')
      `);
      
      // Clean up Redis keys
      const keys = await redis.keys('refresh:*');
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      console.log('Cleanup error:', error.message);
    }
  }

  describe('/posts (POST)', () => {
    let accessToken: string;
    let testUserForPosts: any;

    beforeEach(async () => {
      // Create a unique user for this test
      testUserForPosts = {
        username: `testuser_posts_${Date.now()}`,
        email: `testuser_posts_${Date.now()}@example.com`,
        password: 'password123',
        bio: 'Test bio for posts',
        isCelebrity: false,
      };

      // Register the user
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUserForPosts);

      // Login to get access token
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: testUserForPosts.username,
          password: testUserForPosts.password,
        });

      accessToken = loginResponse.body.accessToken;
    });

    it('should create a post successfully with caption only', () => {
      return request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${accessToken}`)
        .field('caption', 'This is a test post')
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.caption).toBe('This is a test post');
          expect(res.body.userId).toBeDefined();
          expect(res.body.createdAt).toBeDefined();
        });
    });

    it('should create a post successfully with caption and image', () => {
      const imagePath = path.join(__dirname, 'test-image.jpg');
      
      // Create a dummy image file for testing
      const dummyImageBuffer = Buffer.from('fake image data');
      fs.writeFileSync(imagePath, dummyImageBuffer);

      return request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${accessToken}`)
        .field('caption', 'This is a test post with image')
        .attach('imageUrl', imagePath)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.caption).toBe('This is a test post with image');
          expect(res.body.imageUrl).toBeDefined();
          expect(res.body.userId).toBeDefined();
          expect(res.body.createdAt).toBeDefined();
        })
        .finally(() => {
          // Clean up test image file
          if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
          }
        });
    });

    it('should fail to create a post without authentication', () => {
      return request(app.getHttpServer())
        .post('/posts')
        .field('caption', 'This is a test post')
        .expect(401); // Unauthorized
    });

    it('should fail to create a post without caption', () => {
      return request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400); // Bad Request - caption is required
    });
  });

  describe('/posts (GET)', () => {
    let accessToken: string;
    let testUserForGetPosts: any;

    beforeEach(async () => {
      // Create a unique user for this test
      testUserForGetPosts = {
        username: `testuser_getposts_${Date.now()}`,
        email: `testuser_getposts_${Date.now()}@example.com`,
        password: 'password123',
        bio: 'Test bio for get posts',
        isCelebrity: false,
      };

      // Register the user
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUserForGetPosts);

      // Login to get access token
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: testUserForGetPosts.username,
          password: testUserForGetPosts.password,
        });

      accessToken = loginResponse.body.accessToken;

      // Create some test posts
      await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${accessToken}`)
        .field('caption', 'First test post');

      await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${accessToken}`)
        .field('caption', 'Second test post');
    });

    it('should get all posts for the authenticated user', () => {
      return request(app.getHttpServer())
        .get('/posts')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThanOrEqual(2);
          expect(res.body[0]).toHaveProperty('id');
          expect(res.body[0]).toHaveProperty('caption');
          expect(res.body[0]).toHaveProperty('userId');
          expect(res.body[0]).toHaveProperty('createdAt');
        });
    });

    it('should fail to get posts without authentication', () => {
      return request(app.getHttpServer())
        .get('/posts')
        .expect(401); // Unauthorized
    });
  });

  describe('/posts/:postId (PUT)', () => {
    let accessToken: string;
    let testUserForUpdatePosts: any;
    let postId: string;

    beforeEach(async () => {
      // Create a unique user for this test
      testUserForUpdatePosts = {
        username: `testuser_updateposts_${Date.now()}`,
        email: `testuser_updateposts_${Date.now()}@example.com`,
        password: 'password123',
        bio: 'Test bio for update posts',
        isCelebrity: false,
      };

      // Register the user
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUserForUpdatePosts);

      // Login to get access token
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: testUserForUpdatePosts.username,
          password: testUserForUpdatePosts.password,
        });

      accessToken = loginResponse.body.accessToken;

      // Create a test post
      const createPostResponse = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${accessToken}`)
        .field('caption', 'Original test post');

      postId = createPostResponse.body.id;
    });

    it('should update a post successfully', () => {
      return request(app.getHttpServer())
        .put(`/posts/${postId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          caption: 'Updated test post',
          imageUrl: 'updated-image.jpg'
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(postId);
          expect(res.body.caption).toBe('Updated test post');
          expect(res.body.imageUrl).toBe('updated-image.jpg');
        });
    });

    it('should fail to update a post without authentication', () => {
      return request(app.getHttpServer())
        .put(`/posts/${postId}`)
        .send({
          caption: 'Updated test post',
          imageUrl: 'updated-image.jpg'
        })
        .expect(401); // Unauthorized
    });

    it('should fail to update a non-existent post', () => {
      return request(app.getHttpServer())
        .put('/posts/999999')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          caption: 'Updated test post',
          imageUrl: 'updated-image.jpg'
        })
        .expect(404); // Not Found
    });
  });

  describe('/posts/:postId (DELETE)', () => {
    let accessToken: string;
    let testUserForDeletePosts: any;
    let postId: string;

    beforeEach(async () => {
      // Create a unique user for this test
      testUserForDeletePosts = {
        username: `testuser_deleteposts_${Date.now()}`,
        email: `testuser_deleteposts_${Date.now()}@example.com`,
        password: 'password123',
        bio: 'Test bio for delete posts',
        isCelebrity: false,
      };

      // Register the user
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUserForDeletePosts);

      // Login to get access token
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: testUserForDeletePosts.username,
          password: testUserForDeletePosts.password,
        });

      accessToken = loginResponse.body.accessToken;

      // Create a test post
      const createPostResponse = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${accessToken}`)
        .field('caption', 'Post to be deleted');

      postId = createPostResponse.body.id;
    });

    it('should delete a post successfully', () => {
      return request(app.getHttpServer())
        .delete(`/posts/${postId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.message).toBe('Post deleted successfully');
        });
    });

    it('should fail to delete a post without authentication', () => {
      return request(app.getHttpServer())
        .delete(`/posts/${postId}`)
        .expect(401); // Unauthorized
    });

    it('should fail to delete a non-existent post', () => {
      return request(app.getHttpServer())
        .delete('/posts/999999')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404); // Not Found
    });
  });
}); 