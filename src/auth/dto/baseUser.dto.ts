import { Expose } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class BaseUserDto {
  @Expose()
  @IsString()
  @IsNotEmpty({ message: 'Username is required' })
  username: string;

  @Expose()
  @IsEmail()
  @IsNotEmpty({ message: 'Email is required' })
  email: string;
}
