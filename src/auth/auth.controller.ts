import {
    Body,
    Controller,
    Get,
    Post,
    Request,
    UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginRequestDto, LoginResponseDto } from './dto/login.dto';
import { User } from 'src/users/user.model';
import { AuthGuard } from './auth.guard';
import { plainToInstance } from 'class-transformer';
import { RegisterReqDto, RegisterResDto } from './dto/registerUser.dto';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('login')
    async login(@Body() loginDto: LoginRequestDto): Promise<LoginResponseDto> {
        const { username, password } = loginDto;

        return this.authService.login(username, password);
    }

    @UseGuards(AuthGuard)
    @Get('me')
    async getMe(@Request() req): Promise<Omit<LoginResponseDto, 'accessToken'>> {
        const user = await this.authService.getUserById(req.user.id);
        const res = new LoginResponseDto('', user);
        const {accessToken, ...userWithoutToken} = plainToInstance(LoginResponseDto, res);
        return userWithoutToken;
    }

    @Post('register')
    async register(
        @Body() body: RegisterReqDto): Promise<RegisterResDto> {
        return this.authService.register(body);
    }

}
