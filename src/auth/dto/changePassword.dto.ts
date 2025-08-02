import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ example: 'Password123', description: 'The current password of the user' })
  @IsString()
  oldPassword: string;

  @ApiProperty({ example: 'Password123', description: 'The new password of the user' })
  @IsString()
  @MinLength(6)
  newPassword: string;
}