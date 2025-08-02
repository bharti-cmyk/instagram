import {
    Body,
    Controller,
    Get,
    NotFoundException,
    Post,
    Put,
    Req,
    Res,
    UploadedFile,
    UseGuards,
    UseInterceptors,
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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiConsumes } from '@nestjs/swagger';
import { ForgotPasswordDto } from './dto/forgotPassword.do';
import { ResetPasswordDto } from './dto/resetPassword.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { UpdateProfileDto } from './dto/updateProfile.dto';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { RequestWithUser } from '../types/requestWithUser';


@ApiTags('Auth')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }


    @Post('login')
    @ApiOperation({ summary: 'User Login' })
    @ApiResponse({ status: 200, description: 'User logged in successfully', type: LoginResponseDto })
    @ApiBody({ type: LoginRequestDto })
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
    @ApiBearerAuth()
    @Get('me')
    @ApiOperation({ summary: 'Get Current User' })
    @ApiResponse({ status: 200, description: 'Current user details', type: RegisterResDto })
    async getMe(@Req() req: RequestWithUser): Promise<RegisterResDto> {
        const user = await this.authService.getUserById(req.user.id);
        return user;
    }

    @Post('register')
    @ApiOperation({ summary: 'User Registration' })
    @ApiResponse({ status: 201, description: 'User registered successfully' })
    @ApiBody({ type: RegisterReqDto })
    async register(@Body() body: RegisterReqDto): Promise<RegisterResDto> {
        const user = await this.authService.register(body);
        return user;
    }

    @Post('logout')
    @ApiOperation({ summary: 'User Logout' })
    @ApiResponse({ status: 200, description: 'User logged out successfully' })
    async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<LogoutDto> {
        const refreshTokens = req.cookies?.["refreshToken"];
        if (refreshTokens) {
            await this.authService.logout(refreshTokens);
        }
        res.clearCookie('refreshToken');
        return { message: "Logged Out Successfully" };
    }

    @UseGuards(AuthGuard)
    @ApiBearerAuth()
    @Post('change-password')
    @ApiOperation({ summary: 'Change User Password' })
    @ApiResponse({ status: 200, description: 'Password changed successfully' })
    @ApiBody({ type: ChangePasswordDto })
    async changePassword(@Req() req: RequestWithUser, @Body() dto: ChangePasswordDto): Promise<{ message: string }> {
        const updatedPassword = await this.authService.changePassword(req.user.id, dto.oldPassword, dto.newPassword);

        return { message: updatedPassword };
    }

    @Post('refresh-token')
    @ApiOperation({ summary: 'Refresh Access Token' })
    @ApiResponse({ status: 200, description: 'New access token and refresh token generated' })
    async refreshToken(@Req() req: Request,
        @Res({ passthrough: true }) res: Response
    ): Promise<RefreshTokenDto> {
        let refreshTokens = req.cookies?.["refreshToken"];
        
        // If cookies are not parsed, try to extract from headers manually
        if (!refreshTokens && req.headers.cookie) {
            const cookieHeader = req.headers.cookie as string;
            const refreshTokenMatch = cookieHeader.match(/refreshToken=([^;]+)/);
            if (refreshTokenMatch) {
                refreshTokens = refreshTokenMatch[1];
            }
        }
        
        if (!refreshTokens) {
            throw new NotFoundException('Refresh token not found');
        }
        const tokens = await this.authService.refreshToken(refreshTokens);
        res.cookie('refreshToken', tokens.newRefreshToken, {
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        return { accessToken: tokens.accessToken, newRefreshToken: tokens.newRefreshToken };
    }

    @Post('forgot-password')
    async forgotPassword(@Body() dto: ForgotPasswordDto) {
        return this.authService.sendResetToken(dto.email);
    }

    @Post('reset-password')
    async resetPassword(@Body() dto: ResetPasswordDto) {
        return this.authService.resetPassword(dto.token, dto.newPassword);
    }

    @UseGuards(AuthGuard)
    @Put('profile')
    @UseInterceptors(FileInterceptor('avatar', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, callback) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          callback(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
        },
      }),
    })) // if using file upload
    @ApiConsumes('multipart/form-data')
    @ApiBody({ type: UpdateProfileDto }) // optional Swagger doc
    async updateProfile(
        @Req() req: RequestWithUser,
        @Body() body: UpdateProfileDto,
        @UploadedFile() avatar: Express.Multer.File
    ) {
        return this.authService.updateProfile(req.user.id, body, avatar);
    }

}
