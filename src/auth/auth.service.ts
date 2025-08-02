import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { User } from '../users/user.model';
import { InjectModel } from '@nestjs/sequelize';
import { LoginResponseDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, NotFoundException } from '@nestjs/common';
import { RegisterReqDto, RegisterResDto } from './dto/registerUser.dto';
import { ConfigService } from '@nestjs/config';
import { instanceToPlain, plainToInstance } from 'class-transformer';
import Redis from 'ioredis';
import { withRedisLock } from '../utils/withRedisLock';
import { RefreshTokenDto } from './dto/refreshTokenDto';
import { transporter } from '../notification/notification.worker';
import { UpdateProfileDto } from './dto/updateProfile.dto';
import { Op } from 'sequelize';

/**
 * Authentication Service
 * 
 * Handles all authentication-related operations including:
 * - User registration and validation
 * - Login and JWT token generation
 * - Password management (change, reset)
 * - Profile updates
 * - Refresh token management
 * - Logout functionality
 */
@Injectable()
export class AuthService {
    constructor(
        private readonly configService: ConfigService,
        @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
        @InjectModel(User)
        private readonly userModel: typeof User,
        private readonly jwtService: JwtService,
    ) { }

    /**
     * Validates user credentials by checking username and password
     * 
     * @param username - The username to validate
     * @param password - The plain text password to validate
     * @returns Promise<User> - The validated user object (without password)
     * @throws NotFoundException - If user with given username doesn't exist
     * @throws UnauthorizedException - If password doesn't match
     */
    async validateUser(username: string, password: string): Promise<User> {
        // Find user by username in database
        const user = await this.userModel.findOne({
            where: {
                username: username,
            },
            raw: true, // Returns plain object instead of Sequelize instance
        });

        // Check if user exists
        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Compare provided password with hashed password in database
        const isPasswordMatch = await bcrypt.compare(password, user.password);

        if (!isPasswordMatch) {
            throw new UnauthorizedException('Invalid credentials');
        }

        return user;
    }

    /**
     * Authenticates user and generates JWT tokens
     * 
     * @param username - User's username
     * @param password - User's password
     * @returns Promise<LoginResponseDto> - Contains access token, refresh token, and user info
     * @throws UnauthorizedException - If credentials are invalid
     */
    async login(username: string, password: string): Promise<LoginResponseDto> {
        // Validate user credentials first
        const user = await this.validateUser(username, password);
        
        // Create JWT payload with user ID and email
        const payload = { id: user.id, email: user.email };
        
        // Generate access token (uses default JWT configuration from module)
        const token = this.jwtService.sign(payload);

        // Generate refresh token with different secret and longer expiration
        const refreshToken = this.jwtService.sign(payload, {
            secret: this.configService.get('JWT_REFRESH_SECRET'),
            expiresIn: '7d', // 7 days
        });

        // Store refresh token in Redis with 7-day expiration
        await this.redisClient.set(`refresh:${user.id}`, refreshToken, 'EX', 7 * 24 * 60 * 60);

        // Create and return login response DTO
        const loginResponse = new LoginResponseDto(token, user, refreshToken);
        return instanceToPlain(loginResponse) as LoginResponseDto;
    }

    /**
     * Retrieves user information by ID
     * 
     * @param id - User's unique identifier
     * @returns Promise<RegisterResDto> - User information (excluding sensitive data)
     * @throws NotFoundException - If user doesn't exist
     */
    async getUserById(id: number): Promise<RegisterResDto> {
        const user = await this.userModel.findByPk(id);

        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Transform user data to response DTO, excluding sensitive fields
        return plainToInstance(RegisterResDto, user.toJSON(), {
            excludeExtraneousValues: true,
        });
    }

    /**
     * Registers a new user in the system
     * 
     * @param userData - User registration data (username, email, password, etc.)
     * @returns Promise<RegisterResDto> - Created user information (excluding password)
     * @throws UnauthorizedException - If username or email already exists
     */
    async register(userData: RegisterReqDto): Promise<RegisterResDto> {
        // Check if user with same username or email already exists
        const existingUser = await this.userModel.findOne({
            where: {
                [Op.or]: [
                    { username: userData.username },
                    { email: userData.email }
                ]
            },
        });

        // If user exists, throw specific error based on what's duplicated
        if (existingUser) {
            if (existingUser.username === userData.username) {
                throw new UnauthorizedException('Username already exists');
            } else {
                throw new UnauthorizedException('Email already exists');
            }
        }

        // Hash password with bcrypt (salt rounds = 10)
        const hashedPassword = await bcrypt.hash(userData.password, 10);
        
        // Create new user in database
        const newUser = await this.userModel.create({
            ...userData,
            password: hashedPassword,
        } as User);

        // Transform and return user data (excluding password)
        return plainToInstance(RegisterResDto, newUser.get({ plain: true }), {
            excludeExtraneousValues: true,
        });
    }

    /**
     * Logs out user by invalidating refresh token
     * 
     * @param refreshToken - The refresh token to invalidate
     * @returns Promise<number> - Number of tokens deleted (0 or 1)
     * @throws NotFoundException - If refresh token not found or doesn't match
     */
    async logout(refreshToken: string) {
        if (!refreshToken) {
            return 0;
        }

        // Verify refresh token and extract user ID
        const payload = this.jwtService.verify(refreshToken, {
            secret: this.configService.get('JWT_REFRESH_SECRET'),
        });

        // Redis key for storing refresh token
        const key = `refresh:${payload.id}`;

        // Get stored refresh token from Redis
        const storedToken = await this.redisClient.get(key);

        // Check if provided token matches stored token
        if (refreshToken === storedToken) {
            // Delete refresh token from Redis
            return await this.redisClient.del(key);
        }

        return 0;
    }

    /**
     * Changes user's password with security validation
     * Uses Redis lock to prevent concurrent password changes
     * 
     * @param userId - User's unique identifier
     * @param oldPassword - Current password for verification
     * @param newPassword - New password to set
     * @returns Promise<string> - Success message
     * @throws NotFoundException - If user doesn't exist
     * @throws BadRequestException - If old password is incorrect or new password is same as old
     */
    async changePassword(userId: number, oldPassword: string, newPassword: string): Promise<string> {
        // Redis lock key to prevent concurrent password changes
        const lockKey = `lock:change-password:${userId}`;

        // Execute password change within Redis lock
        await withRedisLock(this.redisClient, lockKey, async () => {
            // Find user by ID
            const user = await this.userModel.findByPk(userId);

            if (!user) throw new NotFoundException('User not found');

            // Get current hashed password
            const password = user.getDataValue('password');

            // Validate that passwords are provided
            if (!oldPassword || !password) {
                throw new BadRequestException('Password is missing');
            }

            // Verify old password matches
            const isMatch = await bcrypt.compare(oldPassword, password);
            if (!isMatch) throw new BadRequestException('Old password is incorrect');

            // Ensure new password is different from old password
            const isSame = await bcrypt.compare(newPassword, password);
            if (isSame) throw new BadRequestException('New password must be different from old');

            // Hash new password and update user
            const hashedNewPassword = await bcrypt.hash(newPassword, 10);
            user.password = hashedNewPassword;
            await user.save();
        }, 30); // Lock timeout: 30 seconds

        return "Password Changed Successfully";
    }

    /**
     * Refreshes access token using valid refresh token
     * 
     * @param refreshToken - Current refresh token
     * @returns Promise<RefreshTokenDto> - New access token and refresh token
     * @throws NotFoundException - If refresh token not found
     * @throws BadRequestException - If refresh token is invalid
     */
    async refreshToken(refreshToken: string): Promise<RefreshTokenDto> {
        if (!refreshToken) {
            throw new NotFoundException("RefreshToken Not Found");
        }

        // Verify refresh token and extract payload
        const payload = this.jwtService.verify(refreshToken, {
            secret: this.configService.get('JWT_REFRESH_SECRET'),
        });

        // Redis key for storing refresh token
        const key = `refresh:${payload.id}`;

        // Get stored refresh token from Redis
        const storedToken = await this.redisClient.get(key);

        // Verify that provided token matches stored token
        if (refreshToken !== storedToken) {
            throw new BadRequestException("Invalid refresh token")
        }

        // Remove JWT metadata (exp, iat) from payload
        const { exp, iat, ...restPayload } = payload;

        // Generate new refresh token
        const newRefreshToken = this.jwtService.sign(restPayload, {
            secret: this.configService.get('JWT_REFRESH_SECRET'),
            expiresIn: '7d',
        });

        // Store new refresh token in Redis
        await this.redisClient.set(key, newRefreshToken, 'EX', 7 * 24 * 60 * 60);

        // Generate new access token
        const accessToken = this.jwtService.sign(restPayload);

        return { accessToken, newRefreshToken };
    }

    /**
     * Sends password reset token via email
     * 
     * @param email - User's email address
     * @returns Promise<{ message: string }> - Success message
     * @throws NotFoundException - If user with email doesn't exist
     */
    async sendResetToken(email: string): Promise<{ message: string }> {
        // Find user by email
        const user = await this.userModel.findOne({ where: { email } });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Generate reset token with user ID and 10-minute expiration
        const token = this.jwtService.sign(
            { id: user.id },
            {
                secret: this.configService.get('JWT_SECRET'),
                expiresIn: '10m'
            }
        );

        // Create reset URL with token
        const resetUrl = `${this.configService.get('BASE_URL')}/reset-password?token=${token}`;

        // Send email with reset link
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: process.env.TEST_RECEIVER,
            subject: 'Password Reset Request',
            html: `<p>You requested a password reset. Use the following token: <strong>${resetUrl}</strong></p>`,
        });

        return { message: 'Reset token sent to your email' };
    }

    /**
     * Resets user password using valid reset token
     * 
     * @param token - Password reset token
     * @param newPassword - New password to set
     * @returns Promise<{ message: string }> - Success message
     * @throws NotFoundException - If user doesn't exist
     * @throws BadRequestException - If new password is same as current password
     */
    async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
        let payload;

        // Verify reset token
        payload = this.jwtService.verify(token, {
            secret: this.configService.get('JWT_SECRET'),
        });

        // Find user by ID from token
        const user = await this.userModel.findByPk(payload.id);
        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Get current hashed password
        const currentPassword = user.getDataValue('password');

        // Check if new password is same as current password
        const isSamePassword = await bcrypt.compare(newPassword, currentPassword);
        if (isSamePassword) {
            throw new BadRequestException('New password must be different from current password');
        }

        // Hash new password and update user
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedNewPassword;
        await user.save();

        return { message: 'Password reset successfully' };
    }

    /**
     * Updates user profile information
     * 
     * @param userId - User's unique identifier
     * @param updateData - Profile data to update (bio, etc.)
     * @param avatarUrl - Optional avatar file
     * @returns Promise<RegisterResDto> - Updated user information
     * @throws NotFoundException - If user doesn't exist
     */
    async updateProfile(userId: number, updateData: UpdateProfileDto, avatarUrl?: Express.Multer.File) {
        // Find user by ID
        const user = await this.userModel.findByPk(userId);

        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Update bio if provided
        if (updateData.bio) {
            user.bio = updateData.bio.trim();
        }

        // Update avatar URL if file was uploaded
        if (avatarUrl) {
            user.avatarUrl = `/uploads/${avatarUrl.filename}`;
        }

        // Save updated user
        await user.save();

        // Transform and return updated user data
        return plainToInstance(RegisterResDto, user.get({ plain: true }), {
            excludeExtraneousValues: true,
        });
    }
}
