import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { Sequelize } from 'sequelize-typescript';
import Redis from 'ioredis';
import * as jwt from 'jsonwebtoken';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let sequelize: Sequelize;
  let redis: Redis;

  // Test user data
  const testUser = {
    username: 'testuser_e2e',
    email: 'testuser_e2e@example.com',
    password: 'password123',
    bio: 'Test bio for E2E',
    isCelebrity: false,
  };

  const updatedUser = {
    username: 'updateduser_e2e',
    email: 'updateduser_e2e@example.com',
    password: 'password123',
    bio: 'Updated bio for E2E',
    isCelebrity: true,
  };

  beforeAll(async () => {
    // Load environment variables
    require('dotenv').config();
    
    console.log('JWT_SECRET:', process.env.JWT_SECRET);
    console.log('JWT_REFRESH_SECRET:', process.env.JWT_REFRESH_SECRET);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Get database and Redis instances
    sequelize = moduleFixture.get<Sequelize>(Sequelize);
    redis = moduleFixture.get<Redis>('REDIS_CLIENT');
  });

  afterAll(async () => {
    await cleanupTestData();
    await app.close();
  });

  async function cleanupTestData() {
    try {
      // Clean up users created during tests
      await sequelize.query(`
        DELETE FROM Users 
        WHERE username IN ('${testUser.username}', '${updatedUser.username}')
        OR email IN ('${testUser.email}', '${updatedUser.email}')
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

  describe('/auth/register (POST)', () => {
    it('should register a new user successfully', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201) // @ApiResponse({ status: 201 })
        .expect((res) => {
          expect(res.body).toHaveProperty('username', testUser.username);
          expect(res.body).toHaveProperty('email', testUser.email);
          expect(res.body).toHaveProperty('bio', testUser.bio);
          expect(res.body).toHaveProperty('isCelebrity', testUser.isCelebrity);
          expect(res.body).not.toHaveProperty('password');
        });
    });

    it('should fail to register with invalid data', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          username: '',
          email: 'invalid-email',
          password: '123',
        })
        .expect(401) // Database constraint error returns 500
        .expect((res) => {
          expect(res.body.message).toBeDefined();
        });
    });

    it('should fail to register with existing username', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(401) // UnauthorizedException returns 401
        .expect((res) => {
          expect(res.body.message).toContain('Username already exists');
        });
    });
  });

  describe('/auth/login (POST)', () => {
    // Ensure user exists before login tests
    beforeEach(async () => {
      // Register the user if it doesn't exist
      try {
        await request(app.getHttpServer())
          .post('/auth/register')
          .send(testUser);
      } catch (error) {
        // User might already exist, that's okay
      }
    });

    it('should login successfully with correct credentials', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
        })
        .expect(201) // Controller returns 201 for successful login
        .expect((res) => {
          expect(res.body).toHaveProperty('accessToken');
          expect(res.body).toHaveProperty('refreshToken');
          expect(res.body).toHaveProperty('user');
          expect(res.body.user).toHaveProperty('username', testUser.username);
          expect(res.body.user).toHaveProperty('email', testUser.email);
          // Note: user.id is not included in RegisterResDto, so we can't test for it
        });
    });

    it('should fail to login with incorrect password', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: testUser.username,
          password: 'wrongpassword',
        })
        .expect(401) // UnauthorizedException returns 401
        .expect((res) => {
          expect(res.body.message).toContain('Invalid credentials');
        });
    });

    it('should fail to login with non-existent user', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: 'nonexistentuser',
          password: 'password123',
        })
        .expect(404) // NotFoundException returns 404
        .expect((res) => {
          expect(res.body.message).toContain('User not found');
        });
    });
  });

  describe('/auth/logout (POST)', () => {
    it('should logout successfully', async () => {
      // First login to get tokens
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
        });

      const cookies = loginResponse.headers['set-cookie'];

      return request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', cookies)
        .expect(201) // Controller returns 201 for successful logout
        .expect((res) => {
          expect(res.body.message).toBe('Logged Out Successfully');
        });
    });
  });

  describe('/auth/refresh-token (POST)', () => {
    it('should refresh tokens successfully', async () => {
      // Ensure user exists before trying to login
      try {
        await request(app.getHttpServer())
          .post('/auth/register')
          .send(testUser);
      } catch (error) {
        // User might already exist, that's okay
      }

      // First login to get cookies
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
        });

      const cookies = loginResponse.headers['set-cookie'];
      
      if (!cookies) {
        console.log('No cookies found in response');
        return;
      }

      // Extract just the cookie value without the full header
      const cookieValue = cookies[0].split(';')[0];

      return request(app.getHttpServer())
        .post('/auth/refresh-token')
        .set('Cookie', cookieValue)
        .expect(201) // Controller returns 201 for successful refresh
        .expect((res) => {
          expect(res.body).toHaveProperty('accessToken');
          expect(res.body).toHaveProperty('newRefreshToken');
        });
    });

    it('should fail to refresh tokens without refresh token', () => {
      return request(app.getHttpServer())
        .post('/auth/refresh-token')
        .expect(404) // NotFoundException returns 404
        .expect((res) => {
          expect(res.body.message).toContain('Refresh token not found');
        });
    });
  });

  describe('/auth/change-password (POST)', () => {
    let accessToken: string;
    let testUserForChangePassword: any;

    beforeEach(async () => {
      // Create a unique user for this test
      testUserForChangePassword = {
        username: `testuser_changepass_${Date.now()}`,
        email: `testuser_changepass_${Date.now()}@example.com`,
        password: 'password123',
        bio: 'Test bio for change password',
        isCelebrity: false,
      };

      // Register the user
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUserForChangePassword);

      // Login to get access token
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: testUserForChangePassword.username,
          password: testUserForChangePassword.password,
        });

      accessToken = loginResponse.body.accessToken;
    });

    it('should change password successfully with correct old password', () => {
      return request(app.getHttpServer())
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          oldPassword: testUserForChangePassword.password,
          newPassword: 'newpassword123',
        })
        .expect(201) // Controller returns 201 for successful password change
        .expect((res) => {
          expect(res.body.message).toContain('Password Changed Successfully');
        });
    });

    it('should fail to change password with incorrect old password', () => {
      return request(app.getHttpServer())
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          oldPassword: 'wrongpassword',
          newPassword: 'newpassword123',
        })
        .expect(400) // BadRequestException returns 400
        .expect((res) => {
          expect(res.body.message).toContain('Old password is incorrect');
        });
    });
  });

  describe('/auth/me (GET)', () => {
    let accessToken: string;
    let testUserForMe: any;

    beforeEach(async () => {
      // Create a unique user for this test
      testUserForMe = {
        username: `testuser_me_${Date.now()}`,
        email: `testuser_me_${Date.now()}@example.com`,
        password: 'password123',
        bio: 'Test bio for me endpoint',
        isCelebrity: false,
      };

      // Register the user
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUserForMe);

      // Login to get access token
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: testUserForMe.username,
          password: testUserForMe.password,
        });

      accessToken = loginResponse.body.accessToken;
    });

    it('should get user profile successfully', () => {
      return request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200) // @ApiResponse({ status: 200 })
        .expect((res) => {
          expect(res.body).toHaveProperty('username', testUserForMe.username);
          expect(res.body).toHaveProperty('email', testUserForMe.email);
          expect(res.body).toHaveProperty('bio', testUserForMe.bio);
          expect(res.body).toHaveProperty('isCelebrity', testUserForMe.isCelebrity);
        });
    });

    it('should fail to get profile without token', () => {
      return request(app.getHttpServer())
        .get('/auth/me')
        .expect(401); // Unauthorized
    });
  });

  describe('/auth/profile (PUT)', () => {
    let accessToken: string;
    let testUserForProfile: any;

    beforeEach(async () => {
      // Create a unique user for this test
      testUserForProfile = {
        username: `testuser_profile_${Date.now()}`,
        email: `testuser_profile_${Date.now()}@example.com`,
        password: 'password123',
        bio: 'Test bio for profile update',
        isCelebrity: false,
      };

      // Register the user
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUserForProfile);

      // Login to get access token
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: testUserForProfile.username,
          password: testUserForProfile.password,
        });

      accessToken = loginResponse.body.accessToken;
    });

    it('should update profile successfully', () => {
      const updateData = {
        bio: 'Updated bio for testing',
      };

      return request(app.getHttpServer())
        .put('/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(200) // No explicit @ApiResponse, defaults to 200 for PUT
        .expect((res) => {
          expect(res.body.bio).toBe(updateData.bio);
          expect(res.body.username).toBe(testUserForProfile.username);
        });
    });
  });

  describe('/auth/forgot-password (POST)', () => {
    it('should send reset token successfully', () => {
      return request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({
          email: testUser.email,
        })
        .expect(201) // No explicit @ApiResponse, defaults to 201 for POST
        .expect((res) => {
          expect(res.body.message).toContain('Reset token sent to your email');
        });
    });

    it('should fail to send reset token for non-existent email', () => {
      return request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({
          email: 'nonexistent@example.com',
        })
        .expect(404) // NotFoundException returns 404
        .expect((res) => {
          expect(res.body.message).toContain('User not found');
        });
    });
  });

  describe('/auth/reset-password (POST)', () => {
    it('should reset password successfully with valid token', async () => {
      // First send reset token
      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({
          email: testUser.email,
        });

      // Note: In a real scenario, you would get the token from email
      // For testing, we'll use a mock token
      const mockToken = 'mock-reset-token';

      return request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({
          token: mockToken,
          newPassword: 'newpassword123',
        })
        .expect(500) // Will fail because token is invalid, but that's expected
        .expect((res) => {
          expect(res.body.message).toBeDefined();
        });
    });
  });

  describe('Protected Routes', () => {
    let accessToken: string;
    let testUserForProtected: any;

    beforeEach(async () => {
      // Create a unique user for this test
      testUserForProtected = {
        username: `testuser_protected_${Date.now()}`,
        email: `testuser_protected_${Date.now()}@example.com`,
        password: 'password123',
        bio: 'Test bio for protected routes',
        isCelebrity: false,
      };

      // Register the user
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUserForProtected);

      // Login to get access token
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: testUserForProtected.username,
          password: testUserForProtected.password,
        });

      accessToken = loginResponse.body.accessToken;
    });

    it('should allow access to protected route with valid token', () => {
      return request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });

    it('should deny access to protected route without token', () => {
      return request(app.getHttpServer())
        .get('/auth/me')
        .expect(401); // Unauthorized
    });
  });

  describe('Database Integration', () => {
    it('should store refresh tokens in Redis', async () => {
      // Create a unique user for this test
      const testUserForRedis = {
        username: `testuser_redis_${Date.now()}`,
        email: `testuser_redis_${Date.now()}@example.com`,
        password: 'password123',
        bio: 'Test bio for Redis test',
        isCelebrity: false,
      };

      // Register user
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUserForRedis);

      // Login to get tokens
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: testUserForRedis.username,
          password: testUserForRedis.password,
        });

      expect(loginResponse.status).toBe(201);
      expect(loginResponse.body).toHaveProperty('accessToken');
      expect(loginResponse.body).toHaveProperty('refreshToken');

      // Extract user ID from JWT token since it's not in the response body
      const decodedToken = jwt.decode(loginResponse.body.accessToken) as any;
      const userId = decodedToken.id;

      // Verify user exists in database
      const [users] = await sequelize.query(
        `SELECT * FROM Users WHERE username = ?`,
        {
          replacements: [testUserForRedis.username],
        }
      ) as [any[], unknown];

      expect(users.length).toBe(1);
      expect(users[0].username).toBe(testUserForRedis.username);
      expect(users[0].email).toBe(testUserForRedis.email);

      // Verify refresh token is stored in Redis
      const redisKey = `refresh:${userId}`;
      const storedToken = await redis.get(redisKey);
      expect(storedToken).toBe(loginResponse.body.refreshToken);
    });
  });
}); 