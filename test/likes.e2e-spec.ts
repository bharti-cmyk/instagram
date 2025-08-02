import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { Sequelize } from 'sequelize';
import Redis from 'ioredis';
import * as jwt from 'jsonwebtoken';

describe('LikeController (e2e)', () => {
  let app: INestApplication;
  let sequelize: Sequelize;
  let redis: Redis;

  // Test users
  const testUser = {
    username: 'testuser_likes',
    email: 'testuser_likes@example.com',
    password: 'password123',
    bio: 'Test bio for likes',
    isCelebrity: false,
  };

  const testUser2 = {
    username: 'testuser_likes2',
    email: 'testuser_likes2@example.com',
    password: 'password123',
    bio: 'Test bio for likes 2',
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
      // Clean up likes created during tests
      await sequelize.query(`
        DELETE FROM Likes 
        WHERE userId IN (SELECT id FROM Users WHERE username LIKE '%likes%')
      `);
      
      // Clean up posts created during tests
      await sequelize.query(`
        DELETE FROM Posts 
        WHERE caption LIKE '%likes test post%'
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

  describe('/post/:postId/likes (POST)', () => {
    let accessToken: string;
    let testUserForLikes: any;
    let testUserForLikes2: any;
    let postId: string;

    beforeEach(async () => {
      // Create unique users for this test
      testUserForLikes = {
        username: `testuser_likes_${Date.now()}`,
        email: `testuser_likes_${Date.now()}@example.com`,
        password: 'password123',
        bio: 'Test bio for likes',
        isCelebrity: false,
      };

      testUserForLikes2 = {
        username: `testuser_likes2_${Date.now()}`,
        email: `testuser_likes2_${Date.now()}@example.com`,
        password: 'password123',
        bio: 'Test bio for likes 2',
        isCelebrity: false,
      };

      // Register the first user
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUserForLikes);

      // Register the second user
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUserForLikes2);

      // Login to get access token for first user
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: testUserForLikes.username,
          password: testUserForLikes.password,
        });

      accessToken = loginResponse.body.accessToken;

      // Login to get access token for second user
      const loginResponse2 = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: testUserForLikes2.username,
          password: testUserForLikes2.password,
        });

      const accessToken2 = loginResponse2.body.accessToken;

      // Create a test post
      const createPostResponse = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${accessToken2}`)
        .field('caption', 'Likes test post');

      postId = createPostResponse.body.id;
    });

    it('should like a post successfully', () => {
      return request(app.getHttpServer())
        .post(`/post/${postId}/likes`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body).toHaveProperty('userId');
          expect(res.body).toHaveProperty('postId');
          expect(res.body).toHaveProperty('createdAt');
          expect(res.body.postId).toBe(parseInt(postId));
        });
    });

    it('should fail to like a post without authentication', () => {
      return request(app.getHttpServer())
        .post(`/post/${postId}/likes`)
        .expect(401); // Unauthorized
    });

    it('should fail to like a non-existent post', () => {
      return request(app.getHttpServer())
        .post('/post/999999/likes')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404); // Not Found
    });

    it('should not allow liking the same post twice', async () => {
      // Like the post first time
      await request(app.getHttpServer())
        .post(`/post/${postId}/likes`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      // Try to like the same post again
      return request(app.getHttpServer())
        .post(`/post/${postId}/likes`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400); // Bad Request - already liked
    });
  });

  describe('/post/:postId/likes (DELETE)', () => {
    let accessToken: string;
    let testUserForUnlike: any;
    let testUserForUnlike2: any;
    let postId: string;

    beforeEach(async () => {
      // Create unique users for this test
      testUserForUnlike = {
        username: `testuser_unlike_${Date.now()}`,
        email: `testuser_unlike_${Date.now()}@example.com`,
        password: 'password123',
        bio: 'Test bio for unlike',
        isCelebrity: false,
      };

      testUserForUnlike2 = {
        username: `testuser_unlike2_${Date.now()}`,
        email: `testuser_unlike2_${Date.now()}@example.com`,
        password: 'password123',
        bio: 'Test bio for unlike 2',
        isCelebrity: false,
      };

      // Register the first user
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUserForUnlike);

      // Register the second user
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUserForUnlike2);

      // Login to get access token for first user
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: testUserForUnlike.username,
          password: testUserForUnlike.password,
        });

      accessToken = loginResponse.body.accessToken;

      // Login to get access token for second user
      const loginResponse2 = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: testUserForUnlike2.username,
          password: testUserForUnlike2.password,
        });

      const accessToken2 = loginResponse2.body.accessToken;

      // Create a test post
      const createPostResponse = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${accessToken2}`)
        .field('caption', 'Unlike test post');

      postId = createPostResponse.body.id;

      // Like the post first
      await request(app.getHttpServer())
        .post(`/post/${postId}/likes`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);
    });

    it('should unlike a post successfully', () => {
      return request(app.getHttpServer())
        .delete(`/post/${postId}/likes`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('message');
          expect(res.body.message).toContain('unliked');
        });
    });

    it('should fail to unlike a post without authentication', () => {
      return request(app.getHttpServer())
        .delete(`/post/${postId}/likes`)
        .expect(401); // Unauthorized
    });

    it('should fail to unlike a post that was not liked', () => {
      return request(app.getHttpServer())
        .delete(`/post/${postId}/likes`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404); // Not Found - like doesn't exist
    });

    it('should fail to unlike a non-existent post', () => {
      return request(app.getHttpServer())
        .delete('/post/999999/likes')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404); // Not Found
    });
  });

  describe('/post/:postId/likes (GET)', () => {
    let accessToken: string;
    let testUserForGetLikes: any;
    let testUserForGetLikes2: any;
    let postId: string;

    beforeEach(async () => {
      // Create unique users for this test
      testUserForGetLikes = {
        username: `testuser_getlikes_${Date.now()}`,
        email: `testuser_getlikes_${Date.now()}@example.com`,
        password: 'password123',
        bio: 'Test bio for get likes',
        isCelebrity: false,
      };

      testUserForGetLikes2 = {
        username: `testuser_getlikes2_${Date.now()}`,
        email: `testuser_getlikes2_${Date.now()}@example.com`,
        password: 'password123',
        bio: 'Test bio for get likes 2',
        isCelebrity: false,
      };

      // Register the first user
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUserForGetLikes);

      // Register the second user
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUserForGetLikes2);

      // Login to get access token for first user
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: testUserForGetLikes.username,
          password: testUserForGetLikes.password,
        });

      accessToken = loginResponse.body.accessToken;

      // Login to get access token for second user
      const loginResponse2 = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: testUserForGetLikes2.username,
          password: testUserForGetLikes2.password,
        });

      const accessToken2 = loginResponse2.body.accessToken;

      // Create a test post
      const createPostResponse = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${accessToken2}`)
        .field('caption', 'Get likes test post');

      postId = createPostResponse.body.id;

      // Like the post
      await request(app.getHttpServer())
        .post(`/post/${postId}/likes`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);
    });

    it('should get likes for a post successfully', () => {
      return request(app.getHttpServer())
        .get(`/post/${postId}/likes`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBe(1);
          expect(res.body[0]).toHaveProperty('id');
          expect(res.body[0]).toHaveProperty('userId');
          expect(res.body[0]).toHaveProperty('postId');
          expect(res.body[0]).toHaveProperty('createdAt');
          expect(res.body[0].postId).toBe(parseInt(postId));
        });
    });

    it('should fail to get likes without authentication', () => {
      return request(app.getHttpServer())
        .get(`/post/${postId}/likes`)
        .expect(401); // Unauthorized
    });

    it('should return empty array for post with no likes', () => {
      // Create another post without likes
      const createPostResponse = request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${accessToken}`)
        .field('caption', 'Post with no likes');

      return createPostResponse
        .then((res) => {
          const newPostId = res.body.id;
          return request(app.getHttpServer())
            .get(`/post/${newPostId}/likes`)
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(200)
            .expect((res2) => {
              expect(Array.isArray(res2.body)).toBe(true);
              expect(res2.body.length).toBe(0);
            });
        });
    });

    it('should fail to get likes for non-existent post', () => {
      return request(app.getHttpServer())
        .get('/post/999999/likes')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404); // Not Found
    });
  });
}); 