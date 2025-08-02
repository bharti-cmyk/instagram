import { Expose } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BaseUserDto {
  @ApiProperty({example: 'john_doe', description: 'The username of the user'})
  @Expose()
  @IsString()
  @IsNotEmpty({ message: 'Username is required' })
  username: string;

  @ApiProperty({example: 'johndoe@example.com', description: 'The email of the user'})
  @Expose()
  @IsEmail()
  @IsNotEmpty({ message: 'Email is required' })
  email: string;
}
