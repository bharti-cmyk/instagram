import { AuthService } from "../auth.service";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import * as bcrypt from "bcrypt";
import { User } from "../../users/user.model";
import { BadRequestException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { withRedisLock } from "../../utils/withRedisLock";

// Mock the notification worker module
jest.mock('../../notification/notification.worker', () => ({
    transporter: {
        sendMail: jest.fn().mockResolvedValue(true),
    }
}));

describe('AuthService', () => {
    // Service instance to be tested
    let authService: AuthService;
    
    // Mocked dependencies
    let mockJwtService: jest.Mocked<JwtService>;
    let mockRedis: jest.Mocked<Redis>;
    let mockConfigService: jest.Mocked<ConfigService>;
    let mockUserModel: jest.Mocked<typeof User>;
    let mockWithRedisLock: jest.MockedFunction<typeof withRedisLock>;

    // Mock user data that will be used across multiple tests
    const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'testuser@example.com',
        password: bcrypt.hashSync('password', 10), // Pre-hashed password for testing
        bio: 'Test bio',
        avatarUrl: '/uploads/avatar.jpg',
        isCelebrity: false,
        lastSeenPostId: null,
        // Mock Sequelize model methods
        getDataValue: jest.fn().mockReturnValue(bcrypt.hashSync('password', 10)),
        save: jest.fn().mockResolvedValue(true),
        toJSON: jest.fn().mockReturnValue({
            id: 1,
            username: 'testuser',
            email: 'testuser@example.com',
            bio: 'Test bio',
            avatarUrl: '/uploads/avatar.jpg',
            isCelebrity: false,
            lastSeenPostId: null
        }),
        get: jest.fn().mockReturnValue({
            id: 1,
            username: 'testuser',
            email: 'testuser@example.com',
            bio: 'Test bio',
            avatarUrl: '/uploads/avatar.jpg',
            isCelebrity: false,
            lastSeenPostId: null
        })
    };

    // Setup mocks before each test
    beforeEach(() => {
        // Reset all mocks before each test
        jest.clearAllMocks();
        // Setup fresh mocks

        // Mock JWT service with predefined responses
        mockJwtService = {
            sign: jest.fn().mockReturnValue('mockToken'),
            verify: jest.fn().mockReturnValue({ id: 1, email: 'testuser@example.com' }),
        } as any;

        // Mock Redis client with empty implementations
        mockRedis = {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
        } as any;

        // Mock Config service with environment-specific values
        mockConfigService = {
            get: jest.fn((key: string) => {
                switch (key) {
                    case 'JWT_SECRET': return 'mockJwtSecret';
                    case 'JWT_REFRESH_SECRET': return 'mockRefreshSecret';
                    case 'BASE_URL': return 'http://localhost:3000';
                    default: return null;
                }
            }),
        } as any;

        // Mock User model with empty implementations
        mockUserModel = {
            findOne: jest.fn(),
            create: jest.fn(),
            findByPk: jest.fn(),
        } as any;

        // Mock withRedisLock utility function
        mockWithRedisLock = jest.fn().mockImplementation(async (redis, key, callback) => {
            return await callback();
        });

        // Create AuthService instance with mocked dependencies
        authService = new AuthService(
            mockConfigService,
            mockRedis,
            mockUserModel,
            mockJwtService
        );

        // Replace the imported functions with our mocks
        jest.spyOn(require('../../utils/withRedisLock'), 'withRedisLock').mockImplementation(mockWithRedisLock);
    });

    // Clean up mocks after each test
    afterEach(() => {
        // Clean up after each test
        jest.restoreAllMocks();
    });

    // Test suite for user validation functionality
    describe('validateUser', () => {
        it('should validate user successfully with correct credentials', async () => {
            // Arrange: Setup mocks to return valid user and correct password
            mockUserModel.findOne.mockResolvedValue(mockUser as any);
            jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

            // Act: Call the method under test
            const result = await authService.validateUser('testuser', 'password');

            // Assert: Verify the result and that correct methods were called
            expect(result).toEqual(mockUser);
            expect(mockUserModel.findOne).toHaveBeenCalledWith({
                where: { username: 'testuser' },
                raw: true,
            });
            expect(bcrypt.compare).toHaveBeenCalledWith('password', mockUser.password);
        });

        it('should throw NotFoundException when user not found', async () => {
            // Arrange: Setup mock to return null (user not found)
            mockUserModel.findOne.mockResolvedValue(null);

            // Act & Assert: Verify that the correct exception is thrown
            await expect(authService.validateUser('nonexistent', 'password'))
                .rejects.toThrow(NotFoundException);
            await expect(authService.validateUser('nonexistent', 'password'))
                .rejects.toThrow('User not found');
        });

        it('should throw UnauthorizedException when password is incorrect', async () => {
            // Arrange: Setup mocks to return valid user but wrong password
            mockUserModel.findOne.mockResolvedValue(mockUser as any);
            jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

            // Act & Assert: Verify that the correct exception is thrown
            await expect(authService.validateUser('testuser', 'wrongpassword'))
                .rejects.toThrow(UnauthorizedException);
            await expect(authService.validateUser('testuser', 'wrongpassword'))
                .rejects.toThrow('Invalid credentials');
        });

        it('should handle database errors gracefully', async () => {
            // Arrange: Setup mock to throw database error
            mockUserModel.findOne.mockRejectedValue(new Error('Database connection failed'));

            // Act & Assert: Verify that the error is propagated
            await expect(authService.validateUser('testuser', 'password'))
                .rejects.toThrow('Database connection failed');
        });
    });

    // Test suite for login functionality
    describe('login', () => {
        beforeEach(() => {
            // Common setup for ALL login tests
            mockUserModel.findOne.mockResolvedValue(mockUser as any);
            jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
            // Reset Redis mock to default behavior for most tests
            mockRedis.set.mockResolvedValue('OK');
        });

        it('should login successfully and return tokens', async () => {
            // Act: Call the login method
            const result = await authService.login('testuser', 'password');

            // Assert: Verify all expected properties and method calls
            expect(result).toHaveProperty('accessToken', 'mockToken');
            expect(result).toHaveProperty('refreshToken', 'mockToken');
            expect(result).toHaveProperty('user');
            expect(mockJwtService.sign).toHaveBeenCalledTimes(2); // Called for both access and refresh tokens
            expect(mockRedis.set).toHaveBeenCalledWith(
                'refresh:1',
                'mockToken',
                'EX',
                7 * 24 * 60 * 60 // 7 days in seconds
            );
        });

        it('should throw UnauthorizedException when credentials are invalid', async () => {
            // Arrange: Setup mock to simulate incorrect password
            jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

            // Act & Assert: Verify that the correct exception is thrown
            await expect(authService.login('testuser', 'wrongpassword'))
                .rejects.toThrow(UnauthorizedException);
        });

        it('should handle Redis errors during login', async () => {
            // Specific error test case
            mockRedis.set.mockRejectedValue(new Error('Redis connection failed'));

            // Act & Assert: Verify that the error is propagated
            await expect(authService.login('testuser', 'password'))
                .rejects.toThrow('Redis connection failed');
        });

        it('should handle JWT signing errors', async () => {
            // Arrange: Setup mock to simulate JWT signing error
            mockJwtService.sign.mockImplementation(() => {
                throw new Error('JWT signing failed');
            });

            // Act & Assert: Verify that the error is propagated
            await expect(authService.login('testuser', 'password'))
                .rejects.toThrow('JWT signing failed');
        });
    });

    // Test suite for getting user by ID
    describe('getUserById', () => {
        it('should return user by id successfully', async () => {
            // Arrange: Setup mock to return valid user
            mockUserModel.findByPk.mockResolvedValue(mockUser as any);

            // Act: Call the method under test
            const result = await authService.getUserById(1);

            // Assert: Verify the result and method call
            expect(result).toBeDefined();
            expect(mockUserModel.findByPk).toHaveBeenCalledWith(1);
        });

        it('should throw NotFoundException when user not found', async () => {
            // Arrange: Setup mock to return null (user not found)
            mockUserModel.findByPk.mockResolvedValue(null);

            // Act & Assert: Verify that the correct exception is thrown
            await expect(authService.getUserById(999))
                .rejects.toThrow(NotFoundException);
        });

        it('should handle database errors gracefully', async () => {
            // Arrange: Setup mock to throw database error
            mockUserModel.findByPk.mockRejectedValue(new Error('Database error'));

            // Act & Assert: Verify that the error is propagated
            await expect(authService.getUserById(1))
                .rejects.toThrow('Database error');
        });
    });

    // Test suite for user registration
    describe('register', () => {
        // Test data for registration
        const registerData = {
            username: 'newuser',
            email: 'newuser@example.com',
            password: 'password123',
            bio: 'New user bio',
            avatarUrl: '/uploads/avatar.jpg',
            isCelebrity: false,
            lastSeenPostId: null
        };

        it('should register user successfully', async () => {
            // Arrange: Setup mocks for successful registration
            mockUserModel.findOne.mockResolvedValue(null); // No existing user
            mockUserModel.create.mockResolvedValue(mockUser as any);
            jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashedPassword' as never);

            // Act: Call the registration method
            const result = await authService.register(registerData);

            // Assert: Verify the result and method calls
            expect(result).toBeDefined();
            expect(mockUserModel.findOne).toHaveBeenCalledWith({
                where: {
                    [require('sequelize').Op.or]: [
                        { username: 'newuser' },
                        { email: 'newuser@example.com' }
                    ]
                }
            });
            expect(mockUserModel.create).toHaveBeenCalled();
            expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
        });

        it('should throw UnauthorizedException when username already exists', async () => {
            // Arrange: Setup mock to simulate existing user with same username
            const existingUser = { ...mockUser, username: 'newuser', email: 'different@email.com' };
            mockUserModel.findOne.mockResolvedValue(existingUser as any);

            // Act & Assert: Verify that the correct exception is thrown
            await expect(authService.register(registerData))
                .rejects.toThrow(UnauthorizedException);
            await expect(authService.register(registerData))
                .rejects.toThrow('Username already exists');
        });

        it('should throw UnauthorizedException when email already exists', async () => {
            // Arrange: Setup mock to simulate existing user with same email
            const existingUser = { ...mockUser, username: 'differentuser', email: 'newuser@example.com' };
            mockUserModel.findOne.mockResolvedValue(existingUser as any);

            // Act & Assert: Verify that the correct exception is thrown
            await expect(authService.register(registerData))
                .rejects.toThrow(UnauthorizedException);
            await expect(authService.register(registerData))
                .rejects.toThrow('Email already exists');
        });

        it('should handle password hashing errors', async () => {
            // Arrange: Setup mock to simulate bcrypt error
            mockUserModel.findOne.mockResolvedValue(null);
            jest.spyOn(bcrypt, 'hash').mockImplementation(() => {
                throw new Error('Hashing failed');
            });

            // Act & Assert: Verify that the error is propagated
            await expect(authService.register(registerData))
                .rejects.toThrow('Hashing failed');
        });

        it('should handle database creation errors', async () => {
            // Arrange: Setup mocks for database error
            mockUserModel.findOne.mockResolvedValue(null);
            jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashedPassword' as never);
            mockUserModel.create.mockRejectedValue(new Error('Database creation failed') as never);

            // Act & Assert: Verify that the error is propagated
            await expect(authService.register(registerData))
                .rejects.toThrow('Database creation failed');
        });
    });

    // Test suite for logout functionality
    describe('logout', () => {
        it('should logout successfully with valid refresh token', async () => {
            // Arrange: Setup mocks for successful logout
            const refreshToken = 'validRefreshToken';
            mockRedis.get.mockResolvedValue(refreshToken);
            mockRedis.del.mockResolvedValue(1);

            // Act: Call the logout method
            const result = await authService.logout(refreshToken);

            // Assert: Verify the result and method calls
            expect(result).toBe(1);
            expect(mockJwtService.verify).toHaveBeenCalledWith(refreshToken, {
                secret: 'mockRefreshSecret'
            });
            expect(mockRedis.get).toHaveBeenCalledWith('refresh:1');
            expect(mockRedis.del).toHaveBeenCalledWith('refresh:1');
        });

        it('should logout successfully even with empty refresh token', async () => {
            // Act: Call the logout method with empty token
            const result = await authService.logout('');

            // Assert: Should return 0 and not throw any error
            expect(result).toBe(0);
        });

        it('should logout successfully when refresh token does not match stored token', async () => {
            // Arrange: Setup mock to simulate token mismatch
            const refreshToken = 'validRefreshToken';
            mockRedis.get.mockResolvedValue('differentToken');

            // Act: Call the logout method
            const result = await authService.logout(refreshToken);

            // Assert: Should return 0 and not throw any error
            expect(result).toBe(0);
            expect(mockJwtService.verify).toHaveBeenCalledWith(refreshToken, {
                secret: 'mockRefreshSecret'
            });
            expect(mockRedis.get).toHaveBeenCalledWith('refresh:1');
        });

        it('should handle JWT verification errors', async () => {
            // Arrange: Setup mock to simulate JWT verification error
            mockJwtService.verify.mockImplementation(() => {
                throw new Error('Invalid token');
            });

            // Act & Assert: Verify that the error is propagated
            await expect(authService.logout('invalidToken'))
                .rejects.toThrow('Invalid token');
        });

        it('should handle Redis errors during logout', async () => {
            // Arrange: Setup mock to simulate Redis error
            mockRedis.get.mockRejectedValue(new Error('Redis error'));

            // Act & Assert: Verify that the error is propagated
            await expect(authService.logout('validToken'))
                .rejects.toThrow('Redis error');
        });
    });

    // Test suite for password change functionality
    describe('changePassword', () => {
        it('should change password successfully', async () => {
            // Arrange: Setup mocks for successful password change
            mockUserModel.findByPk.mockResolvedValue(mockUser as any);
            jest.spyOn(bcrypt, 'compare')
                .mockResolvedValueOnce(true as never) // old password check
                .mockResolvedValueOnce(false as never); // new password check
            jest.spyOn(bcrypt, 'hash').mockResolvedValue('newHashedPassword' as never);

            // Act: Call the password change method
            const result = await authService.changePassword(1, 'oldpassword', 'newpassword');

            // Assert: Verify the result and method calls
            expect(result).toBe('Password Changed Successfully');
            expect(mockWithRedisLock).toHaveBeenCalled();
            expect(mockUser.save).toHaveBeenCalled();
        });

        it('should throw NotFoundException when user not found', async () => {
            // Arrange: Setup mock to simulate user not found
            mockUserModel.findByPk.mockResolvedValue(null);

            // Act & Assert: Verify that the correct exception is thrown
            await expect(authService.changePassword(999, 'oldpassword', 'newpassword'))
                .rejects.toThrow(NotFoundException);
        });

        it('should throw BadRequestException when old password is incorrect', async () => {
            // Arrange: Setup mock to simulate incorrect old password
            mockUserModel.findByPk.mockResolvedValue(mockUser as any);
            jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

            // Act & Assert: Verify that the correct exception is thrown
            await expect(authService.changePassword(1, 'wrongpassword', 'newpassword'))
                .rejects.toThrow(BadRequestException);
            await expect(authService.changePassword(1, 'wrongpassword', 'newpassword'))
                .rejects.toThrow('Old password is incorrect');
        });

        it('should throw BadRequestException when new password is same as old', async () => {
            // Arrange: Setup mocks to simulate same password
            mockUserModel.findByPk.mockResolvedValue(mockUser as any);
            jest.spyOn(bcrypt, 'compare')
                .mockResolvedValueOnce(true as never) // old password check
                .mockResolvedValueOnce(true as never); // new password check (same as old)

            // Act & Assert: Verify that the correct exception is thrown
            await expect(authService.changePassword(1, 'password', 'password'))
                .rejects.toThrow(BadRequestException);
            await expect(authService.changePassword(1, 'password', 'password'))
                .rejects.toThrow('New password must be different from old');
        });

        it('should throw BadRequestException when password is missing', async () => {
            // Arrange: Setup mock to simulate missing password
            const userWithoutPassword = { ...mockUser, getDataValue: jest.fn().mockReturnValue(null) };
            mockUserModel.findByPk.mockResolvedValue(userWithoutPassword as any);

            // Act & Assert: Verify that the correct exception is thrown
            await expect(authService.changePassword(1, '', 'newpassword'))
                .rejects.toThrow(BadRequestException);
            await expect(authService.changePassword(1, '', 'newpassword'))
                .rejects.toThrow('Password is missing');
        });

        it('should handle Redis lock errors', async () => {
            // Arrange: Setup mock to simulate Redis lock error
            mockWithRedisLock.mockRejectedValue(new Error('Lock acquisition failed'));

            // Act & Assert: Verify that the error is propagated
            await expect(authService.changePassword(1, 'oldpassword', 'newpassword'))
                .rejects.toThrow('Lock acquisition failed');
        });
    });

    // Test suite for token refresh functionality
    describe('refreshToken', () => {
        it('should refresh token successfully', async () => {
            // Arrange: Setup mocks for successful token refresh
            const refreshToken = 'validRefreshToken';
            mockRedis.get.mockResolvedValue(refreshToken);

            // Act: Call the token refresh method
            const result = await authService.refreshToken(refreshToken);

            // Assert: Verify the result and method calls
            expect(result).toHaveProperty('accessToken', 'mockToken');
            expect(result).toHaveProperty('newRefreshToken', 'mockToken');
            expect(mockJwtService.verify).toHaveBeenCalledWith(refreshToken, {
                secret: 'mockRefreshSecret'
            });
            expect(mockRedis.set).toHaveBeenCalled();
        });

        it('should throw NotFoundException when refresh token is not provided', async () => {
            // Act & Assert: Verify that the correct exception is thrown for empty token
            await expect(authService.refreshToken(''))
                .rejects.toThrow(NotFoundException);
            await expect(authService.refreshToken(''))
                .rejects.toThrow('RefreshToken Not Found');
        });

        it('should throw BadRequestException when refresh token does not match stored token', async () => {
            // Arrange: Setup mock to simulate token mismatch
            const refreshToken = 'validRefreshToken';
            mockRedis.get.mockResolvedValue('differentToken');

            // Act & Assert: Verify that the correct exception is thrown
            await expect(authService.refreshToken(refreshToken))
                .rejects.toThrow(BadRequestException);
            await expect(authService.refreshToken(refreshToken))
                .rejects.toThrow('Invalid refresh token');
        });

        it('should handle JWT verification errors', async () => {
            // Arrange: Setup mock to simulate JWT verification error
            mockJwtService.verify.mockImplementation(() => {
                throw new Error('Invalid token');
            });

            // Act & Assert: Verify that the error is propagated
            await expect(authService.refreshToken('invalidToken'))
                .rejects.toThrow('Invalid token');
        });

        it('should handle Redis errors during token refresh', async () => {
            // Arrange: Setup mock to simulate Redis error
            mockRedis.get.mockRejectedValue(new Error('Redis error'));

            // Act & Assert: Verify that the error is propagated
            await expect(authService.refreshToken('validToken'))
                .rejects.toThrow('Redis error');
        });
    });

    // Test suite for password reset token sending
    describe('sendResetToken', () => {
        it('should send reset token successfully', async () => {
            // Arrange: Setup mock to return valid user
            mockUserModel.findOne.mockResolvedValue(mockUser as any);

            // Act: Call the send reset token method
            const result = await authService.sendResetToken('testuser@example.com');

            // Assert: Verify the result and method calls
            expect(result).toEqual({ message: 'Reset token sent to your email' });
            expect(mockUserModel.findOne).toHaveBeenCalledWith({
                where: { email: 'testuser@example.com' }
            });
            expect(require('../../notification/notification.worker').transporter.sendMail).toHaveBeenCalled();
        });

        it('should throw NotFoundException when user not found', async () => {
            // Arrange: Setup mock to simulate user not found
            mockUserModel.findOne.mockResolvedValue(null);

            // Act & Assert: Verify that the correct exception is thrown
            await expect(authService.sendResetToken('nonexistent@example.com'))
                .rejects.toThrow(NotFoundException);
        });

        it('should handle email sending errors', async () => {
            // Arrange: Setup mocks for email error
            mockUserModel.findOne.mockResolvedValue(mockUser as any);
            require('../../notification/notification.worker').transporter.sendMail.mockRejectedValue(new Error('Email sending failed'));

            // Act & Assert: Verify that the error is propagated
            await expect(authService.sendResetToken('testuser@example.com'))
                .rejects.toThrow('Email sending failed');
        });
    });

    // Test suite for password reset functionality
    describe('resetPassword', () => {
        it('should reset password successfully', async () => {
            // Arrange: Setup mocks for successful password reset
            mockUserModel.findByPk.mockResolvedValue(mockUser as any);
            jest.spyOn(bcrypt, 'hash').mockResolvedValue('newHashedPassword' as never);

            // Act: Call the password reset method
            const result = await authService.resetPassword('validToken', 'newpassword');

            // Assert: Verify the result and method calls
            expect(result).toEqual({ message: 'Password reset successfully' });
            expect(mockJwtService.verify).toHaveBeenCalledWith('validToken', {
                secret: 'mockJwtSecret'
            });
            expect(mockUser.save).toHaveBeenCalled();
        });

        it('should throw NotFoundException when user not found', async () => {
            // Arrange: Setup mock to simulate user not found
            mockUserModel.findByPk.mockResolvedValue(null);

            // Act & Assert: Verify that the correct exception is thrown
            await expect(authService.resetPassword('validToken', 'newpassword'))
                .rejects.toThrow(NotFoundException);
        });

        it('should handle JWT verification errors', async () => {
            // Arrange: Setup mock to simulate JWT verification error
            mockJwtService.verify.mockImplementation(() => {
                throw new Error('Invalid reset token');
            });

            // Act & Assert: Verify that the error is propagated
            await expect(authService.resetPassword('invalidToken', 'newpassword'))
                .rejects.toThrow('Invalid reset token');
        });

        it('should handle password hashing errors', async () => {
            // Arrange: Setup mocks for hashing error
            mockUserModel.findByPk.mockResolvedValue(mockUser as any);
            jest.spyOn(bcrypt, 'hash').mockRejectedValue(new Error('Hashing failed') as never);

            // Act & Assert: Verify that the error is propagated
            await expect(authService.resetPassword('validToken', 'newpassword'))
                .rejects.toThrow('Hashing failed');
        });

        it('should throw BadRequestException when new password is same as current password', async () => {
            // Arrange: Setup mocks for same password scenario
            mockUserModel.findByPk.mockResolvedValue(mockUser as any);
            jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never); // Same password

            // Act & Assert: Verify that the correct exception is thrown
            await expect(authService.resetPassword('validToken', 'password'))
                .rejects.toThrow(BadRequestException);
            await expect(authService.resetPassword('validToken', 'password'))
                .rejects.toThrow('New password must be different from current password');
        });
    });

    // Test suite for profile update functionality
    describe('updateProfile', () => {
        // Test data for profile updates
        const updateData = {
            bio: 'Updated bio'
        };

        // Mock file upload data
        const mockFile = {
            filename: 'new-avatar.jpg'
        } as Express.Multer.File;

        it('should update profile successfully with bio only', async () => {
            // Arrange: Setup mock to return valid user
            mockUserModel.findByPk.mockResolvedValue(mockUser as any);

            // Act: Call the profile update method
            const result = await authService.updateProfile(1, updateData);

            // Assert: Verify the result and method calls
            expect(result).toBeDefined();
            expect(mockUser.save).toHaveBeenCalled();
        });

        it('should update profile successfully with avatar', async () => {
            // Arrange: Setup mock to return valid user
            mockUserModel.findByPk.mockResolvedValue(mockUser as any);

            // Act: Call the profile update method with file
            const result = await authService.updateProfile(1, updateData, mockFile);

            // Assert: Verify the result and method calls
            expect(result).toBeDefined();
            expect(mockUser.save).toHaveBeenCalled();
        });

        it('should throw NotFoundException when user not found', async () => {
            // Arrange: Setup mock to simulate user not found
            mockUserModel.findByPk.mockResolvedValue(null);

            // Act & Assert: Verify that the correct exception is thrown
            await expect(authService.updateProfile(999, updateData))
                .rejects.toThrow(NotFoundException);
        });

        it('should handle database save errors', async () => {
            // Arrange: Setup mocks for save error
            mockUserModel.findByPk.mockResolvedValue(mockUser as any);
            mockUser.save.mockRejectedValue(new Error('Database save failed'));

            // Act & Assert: Verify that the error is propagated
            await expect(authService.updateProfile(1, updateData))
                .rejects.toThrow('Database save failed');
        });

        it('should update bio with trimmed value', async () => {
            // Arrange: Setup mock to return valid user with mutable bio
            const mutableUser = {
                ...mockUser,
                bio: 'Original bio',
                save: jest.fn().mockResolvedValue(true)
            };
            mockUserModel.findByPk.mockResolvedValue(mutableUser as any);

            // Act: Call the profile update method with whitespace in bio
            const result = await authService.updateProfile(1, { bio: '  Updated bio  ' });

            // Assert: Verify that bio is trimmed and save was called
            expect(mutableUser.bio).toBe('Updated bio');
            expect(mutableUser.save).toHaveBeenCalled();
        });

        it('should update avatar URL when file is provided', async () => {
            // Arrange: Setup mock to return valid user with mutable avatarUrl
            const mutableUser = {
                ...mockUser,
                avatarUrl: '/uploads/old-avatar.jpg',
                save: jest.fn().mockResolvedValue(true)
            };
            mockUserModel.findByPk.mockResolvedValue(mutableUser as any);

            // Mock file upload
            const mockFile = {
                filename: 'new-avatar.jpg'
            } as Express.Multer.File;

            // Act: Call the profile update method with file
            const result = await authService.updateProfile(1, { bio: 'Updated bio' }, mockFile);

            // Assert: Verify that avatarUrl was updated and save was called
            expect(mutableUser.avatarUrl).toBe('/uploads/new-avatar.jpg');
            expect(mutableUser.save).toHaveBeenCalled();
        });

        it('should update both bio and avatar when both are provided', async () => {
            // Arrange: Setup mock to return valid user with mutable properties
            const mutableUser = {
                ...mockUser,
                bio: 'Original bio',
                avatarUrl: '/uploads/old-avatar.jpg',
                save: jest.fn().mockResolvedValue(true)
            };
            mockUserModel.findByPk.mockResolvedValue(mutableUser as any);

            // Mock file upload
            const mockFile = {
                filename: 'new-avatar.jpg'
            } as Express.Multer.File;

            // Act: Call the profile update method with both bio and file
            const result = await authService.updateProfile(1, { bio: '  New bio  ' }, mockFile);

            // Assert: Verify that both bio and avatarUrl were updated
            expect(mutableUser.bio).toBe('New bio');
            expect(mutableUser.avatarUrl).toBe('/uploads/new-avatar.jpg');
            expect(mutableUser.save).toHaveBeenCalled();
        });
    });
});