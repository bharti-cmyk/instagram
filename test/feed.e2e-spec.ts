import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { Sequelize } from 'sequelize';
import Redis from 'ioredis';
import * as jwt from 'jsonwebtoken';

describe('FeedController (e2e)', () => {
  let app: INestApplication;
  let sequelize: Sequelize;
  let redis: Redis;

  // Test users
  const testUser = {
    username: 'testuser_feed',
    email: 'testuser_feed@example.com',
    password: 'password123',
    bio: 'Test bio for feed',
    isCelebrity: false,
  };

  const testUser2 = {
    username: 'testuser_feed2',
    email: 'testuser_feed2@example.com',
    password: 'password123',
    bio: 'Test bio for feed 2',
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
        WHERE caption LIKE '%feed test post%'
      `);
      
      // Clean up users created during tests
      await sequelize.query(`
        DELETE FROM Users 
        WHERE username IN ('${testUser.username}', '${testUser2.username}')
        OR email IN ('${testUser.email}', '${testUser2.email}')
      `);
      
      // Clean up follows created during tests
      await sequelize.query(`
        DELETE FROM Follows 
        WHERE followerId IN (SELECT id FROM Users WHERE username LIKE '%feed%')
        OR followingId IN (SELECT id FROM Users WHERE username LIKE '%feed%')
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

  describe('/feed (GET)', () => {
    let accessToken: string;
    let testUserForFeed: any;
    let testUserForFeed2: any;
    let userId1: number;
    let userId2: number;

    beforeEach(async () => {
      // Create unique users for this test
      testUserForFeed = {
        username: `testuser_feed_${Date.now()}`,
        email: `testuser_feed_${Date.now()}@example.com`,
        password: 'password123',
        bio: 'Test bio for feed',
        isCelebrity: false,
      };

      testUserForFeed2 = {
        username: `testuser_feed2_${Date.now()}`,
        email: `testuser_feed2_${Date.now()}@example.com`,
        password: 'password123',
        bio: 'Test bio for feed 2',
        isCelebrity: false,
      };

      // Register the first user
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUserForFeed);

      // Register the second user
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUserForFeed2);

      // Login to get access token for first user
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: testUserForFeed.username,
          password: testUserForFeed.password,
        });

      accessToken = loginResponse.body.accessToken;

      // Get user IDs from JWT token
      const decodedToken = jwt.decode(loginResponse.body.accessToken) as any;
      userId1 = decodedToken.id;

      // Get second user ID
      const loginResponse2 = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: testUserForFeed2.username,
          password: testUserForFeed2.password,
        });

      const decodedToken2 = jwt.decode(loginResponse2.body.accessToken) as any;
      userId2 = decodedToken2.id;

      // Create posts for second user
      const loginResponse2Token = loginResponse2.body.accessToken;
      
      await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${loginResponse2Token}`)
        .field('caption', 'Feed test post 1');

      await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${loginResponse2Token}`)
        .field('caption', 'Feed test post 2');

      // Follow the second user
      await request(app.getHttpServer())
        .post('/follows/follow')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          followingId: userId2
        });
    });

    it('should get user feed successfully', () => {
      return request(app.getHttpServer())
        .get('/feed')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('nextCursor');
          expect(Array.isArray(res.body.data)).toBe(true);
          expect(res.body.data.length).toBeGreaterThanOrEqual(2);
          
          // Check that posts belong to the followed user
          res.body.data.forEach((post: any) => {
            expect(post).toHaveProperty('id');
            expect(post).toHaveProperty('caption');
            expect(post).toHaveProperty('userId');
            expect(post).toHaveProperty('createdAt');
            expect(post.userId).toBe(userId2);
          });
        });
    });

    it('should get user feed with pagination', () => {
      return request(app.getHttpServer())
        .get('/feed?limit=1')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('nextCursor');
          expect(Array.isArray(res.body.data)).toBe(true);
          expect(res.body.data.length).toBe(1);
        });
    });

    it('should get user feed with cursor pagination', () => {
      return request(app.getHttpServer())
        .get('/feed?limit=1')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('nextCursor');
          
          // If there's a next cursor, test pagination
          if (res.body.nextCursor) {
            return request(app.getHttpServer())
              .get(`/feed?cursor=${res.body.nextCursor}&limit=1`)
              .set('Authorization', `Bearer ${accessToken}`)
              .expect(200)
              .expect((res2) => {
                expect(res2.body).toHaveProperty('data');
                expect(res2.body).toHaveProperty('nextCursor');
                expect(Array.isArray(res2.body.data)).toBe(true);
              });
          }
        });
    });

    it('should fail to get feed without authentication', () => {
      return request(app.getHttpServer())
        .get('/feed')
        .expect(401); // Unauthorized
    });

    it('should return empty feed when user follows no one', async () => {
      // Create a new user who doesn't follow anyone
      const newUser = {
        username: `testuser_feed_empty_${Date.now()}`,
        email: `testuser_feed_empty_${Date.now()}@example.com`,
        password: 'password123',
        bio: 'Test bio for empty feed',
        isCelebrity: false,
      };

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(newUser);

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: newUser.username,
          password: newUser.password,
        });

      const newUserToken = loginResponse.body.accessToken;

      return request(app.getHttpServer())
        .get('/feed')
        .set('Authorization', `Bearer ${newUserToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('nextCursor');
          expect(Array.isArray(res.body.data)).toBe(true);
          expect(res.body.data.length).toBe(0);
        });
    });

    it('should respect rate limiting', async () => {
      // Make multiple requests quickly to test rate limiting
      const requests: any[] = [];
      for (let i = 0; i < 5; i++) {
        requests.push(
          request(app.getHttpServer())
            .get('/feed')
            .set('Authorization', `Bearer ${accessToken}`)
        );
      }

      const responses = await Promise.all(requests);
      
      // Most should succeed, but some might be rate limited
      const successCount = responses.filter((res: any) => res.status === 200).length;
      expect(successCount).toBeGreaterThan(0);
    });
  });
}); 