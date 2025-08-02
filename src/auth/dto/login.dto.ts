import { IsNotEmpty, IsString } from 'class-validator';
import { RegisterResDto } from './registerUser.dto';
import { Expose, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class LoginRequestDto {
  @ApiProperty({ example: 'john_doe', description: 'The username of the user' })
  @IsString()
  @IsNotEmpty({ message: 'Username is required' })
  username: string;

  @ApiProperty({ example: 'Password123', description: 'The password of the user' })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  password: string;
}

export class LoginResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', description: 'JWT access token' })
  @Expose()
  accessToken: string;

  @ApiProperty({ type: () => RegisterResDto, description: 'User details' })
  @Expose()
  @Type(() => RegisterResDto)
  user: RegisterResDto;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', description: 'JWT refresh token' })
  @Expose()
  refreshToken: string;

  constructor(accessToken: string, user: RegisterResDto, refreshToken: string) {
    this.accessToken = accessToken;
    this.user = new RegisterResDto(user);
    this.refreshToken = refreshToken
  }
}
