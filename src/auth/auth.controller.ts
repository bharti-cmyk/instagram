import {
    Body,
    Controller,
    Get,
    Post,
    Req,
    Res,
    UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginRequestDto, LoginResponseDto } from './dto/login.dto';
import { AuthGuard } from './auth.guard';
import { RegisterReqDto, RegisterResDto } from './dto/registerUser.dto';
import { LogoutDto } from './dto/logout.dto';
import { User } from '../users/user.model';
import { ChangePasswordDto } from './dto/changePassword.dto';
import { RefreshTokenDto } from './dto/refreshTokenDto';

interface RequestWithUser extends Request {
    user: User & { id: number };
}

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('login')
    async login(
        @Body() loginDto: LoginRequestDto,
        @Res({ passthrough: true }) res: Response
    ): Promise<LoginResponseDto> {
        const { username, password } = loginDto;
        const user = await this.authService.login(username, password);
        res.cookie('refreshToken', user.refreshToken, {
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        return user;
    }


    @UseGuards(AuthGuard)
    @Get('me')
    async getMe(@Req() req: RequestWithUser): Promise<RegisterResDto> {
        const user = await this.authService.getUserById(req.user.id);
        return user;
    }

    @Post('register')
    async register(@Body() body: RegisterReqDto): Promise<RegisterResDto> {
        const user = await this.authService.register(body);
        return user;
    }

    @Post('logout')
    async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<LogoutDto> {
        const refreshTokens = req.cookies["refreshToken"];
        await this.authService.logout(refreshTokens);
        res.clearCookie('refreshToken');
        return { message: "Logged Out Successfully" };
    }

    @UseGuards(AuthGuard)
    @Post('change-password')
    async changePassword(@Req() req: RequestWithUser, @Body() dto: ChangePasswordDto): Promise<{ message: string }> {
        const updatedPassword = await this.authService.changePassword(req.user.id, dto.oldPassword, dto.newPassword);

        return { message: updatedPassword };
    }

    @Post('refresh-token')
    async refreshToken(@Req() req: Request,
        @Res({ passthrough: true }) res: Response
    ): Promise<RefreshTokenDto> {
        const refreshTokens = req.cookies["refreshToken"];
        const tokens = await this.authService.refreshToken(refreshTokens);
        res.cookie('refreshToken', tokens.newRefreshToken, {
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        return { accessToken: tokens.accessToken, newRefreshToken: tokens.newRefreshToken };
    }
}
