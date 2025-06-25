import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class BaseUserDto {
  @IsString()
  @IsNotEmpty({ message: 'Username is required' })
  username: string;

  @IsEmail()
  @IsNotEmpty({ message: 'Email is required' })
  email: string;
}
