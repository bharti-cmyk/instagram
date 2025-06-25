import { Injectable } from '@nestjs/common';
import { User } from 'src/users/user.model';
import { InjectModel } from '@nestjs/sequelize';
import { LoginResponseDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, NotFoundException } from '@nestjs/common';
import { RegisterReqDto, RegisterResDto } from './dto/registerUser.dto';

@Injectable()
export class AuthService {
    constructor(
        @InjectModel(User)
        private readonly userModel: typeof User,

        private readonly jwtService: JwtService,
    ) { }
    async validateUser(username: string, password: string): Promise<User> {
        const user = await this.userModel.findOne({
            where: {
                username: username,
            },
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
        const token = this.jwtService.sign(payload);
        return new LoginResponseDto(token, user);
    }

    async getUserById(id: number): Promise<User> {
        const user = await this.userModel.findByPk(id);
        if (!user) {
            throw new NotFoundException('User not found');
        }
        return user;
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

        return new RegisterResDto(newUser);
    }
}
