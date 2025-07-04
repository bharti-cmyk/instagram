import { IsNotEmpty, IsString } from 'class-validator';
import { RegisterResDto } from './registerUser.dto';

export class LoginRequestDto {
  @IsString()
  @IsNotEmpty({ message: 'Username is required' })
  username: string;

  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  password: string;
}

export class LoginResponseDto {
  accessToken: string;
  user: RegisterResDto;
  refreshToken: string;

  constructor(accessToken: string, user: RegisterResDto, refreshToken: string) {
    this.accessToken = accessToken;
    this.user = new RegisterResDto(user);
    this.refreshToken = refreshToken
  }
}
