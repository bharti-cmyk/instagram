import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { User } from '../users/user.model';
import { InjectModel } from '@nestjs/sequelize';
import { LoginResponseDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, NotFoundException } from '@nestjs/common';
import { RegisterReqDto, RegisterResDto } from './dto/registerUser.dto';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import Redis from 'ioredis';
import { withRedisLock } from '../utils/withRedisLock';
import { RefreshTokenDto } from './dto/refreshTokenDto';


@Injectable()
export class AuthService {
    constructor(
        private readonly configService: ConfigService,
        @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
        @InjectModel(User)
        private readonly userModel: typeof User,

        private readonly jwtService: JwtService,
    ) { }
    async validateUser(username: string, password: string): Promise<User> {
        const user = await this.userModel.findOne({
            where: {
                username: username,
            },
            raw: true,
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        //compare password using bcrypt
        const isPasswordMatch = await bcrypt.compare(password, user.password);

        if (!isPasswordMatch) {
            throw new UnauthorizedException('Invalid credentials');
        }

        return user;
    }

    async login(username: string, password: string): Promise<LoginResponseDto> {
        const user = await this.validateUser(username, password);
        const payload = { id: user.id, email: user.email };
        const token = this.jwtService.sign(payload, {
            secret: this.configService.get('JWT_SECRET'),
            expiresIn: '1h',
        });

        const refreshToken = this.jwtService.sign(payload, {
            secret: this.configService.get('JWT_REFRESH_SECRET'),
            expiresIn: '7d',
        })

        await this.redisClient.set(`refresh:${user.id}`, refreshToken, 'EX', 7 * 24 * 60 * 60);


        return new LoginResponseDto(token, user, refreshToken);
    }

    async getUserById(id: number): Promise<RegisterResDto> {
        const user = await this.userModel.findByPk(id);

        if (!user) {
            throw new NotFoundException('User not found');
        }

        return plainToInstance(RegisterResDto, user.toJSON(), {
            excludeExtraneousValues: true,
        });
    }

    async register(userData: RegisterReqDto): Promise<RegisterResDto> {
        const existingUser = await this.userModel.findOne({
            where: { username: userData.username },
        });

        if (existingUser) {
            throw new UnauthorizedException('Username already exists');
        }

        const hashedPassword = await bcrypt.hash(userData.password, 10);
        const newUser = await this.userModel.create({
            ...userData,
            password: hashedPassword,
        } as User);

        return plainToInstance(RegisterResDto, newUser.get({ plain: true }), {
            excludeExtraneousValues: true,
        });
    }

    async logout(refreshToken: string) {
        if (!refreshToken) {
            throw new NotFoundException("RefreshToken Not Found");
        }

        const payload = this.jwtService.verify(refreshToken, {
            secret: this.configService.get('JWT_REFRESH_SECRET'),
        });

        const key = `refresh:${payload.id}`;

        const storedToken = await this.redisClient.get(key);

        if (refreshToken == storedToken) {
            return await this.redisClient.del(key);
        }

        throw new NotFoundException("RefreshToken deosn't match");
    }

    async changePassword(userId: number, oldPassword: string, newPassword: string): Promise<string> {
        const lockKey = `lock:change-password:${userId}`;

        await withRedisLock(this.redisClient, lockKey, async () => {
            const user = await this.userModel.findByPk(userId);

            if (!user) throw new NotFoundException('User not found');

            const password = user.getDataValue('password');

            if (!oldPassword || !password) {
                throw new BadRequestException('Password is missing');
            }

            const isMatch = await bcrypt.compare(oldPassword, password);
            if (!isMatch) throw new BadRequestException('Old password is incorrect');

            const isSame = await bcrypt.compare(newPassword, password);
            if (isSame) throw new BadRequestException('New password must be different from old');

            const hashedNewPassword = await bcrypt.hash(newPassword, 10);
            user.password = hashedNewPassword;
            await user.save();
        }, 30);

        return "Password Changed Successfully";
    }

    async refreshToken(refreshToken: string): Promise<RefreshTokenDto> {
        if (!refreshToken) {
            throw new NotFoundException("RefreshToken Not Found");
        }

        const payload = this.jwtService.verify(refreshToken, {
            secret: this.configService.get('JWT_REFRESH_SECRET'),
        });

        const key = `refresh:${payload.id}`;

        const storedToken = await this.redisClient.get(key);

        if (refreshToken !== storedToken) {
            throw new BadRequestException("Invalid refresh token")
        }

        const { exp, iat, ...restPayload } = payload;

        const newRefreshToken = this.jwtService.sign(restPayload, {
            secret: this.configService.get('JWT_REFRESH_SECRET'),
            expiresIn: '7d',
        });

        await this.redisClient.set(key, newRefreshToken, 'EX', 7 * 24 * 60 * 60);

        const accessToken = this.jwtService.sign(restPayload, {
            secret: this.configService.get('JWT_SECRET'),
            expiresIn: '12h'
        })

        return { accessToken, newRefreshToken };
    }
}
