import { IsString, MinLength } from 'class-validator';
import { BaseUserDto } from './baseUser.dto';
import { Expose, Exclude } from 'class-transformer'
import { ApiProperty } from '@nestjs/swagger';

export class RegisterReqDto extends BaseUserDto {
  @ApiProperty({ example: 'john_doe', description: 'The username of the user' })
  @IsString()
  @MinLength(8)
  password: string;

}

export class RegisterResDto extends BaseUserDto {
  @Expose() bio?: string;
  @Expose() avatarUrl?: string;
  @Expose() isCelebrity: boolean;
  @Expose() lastSeenPostId?: string | null;

  @Exclude() password?: string;
  @Exclude() createdAt?: Date;
  @Exclude() updatedAt?: Date;
  @Exclude() fcmToken?: string | null;

  constructor(partial: Partial<RegisterResDto>) {
    super();
    if (partial) Object.assign(this, partial);
  }
}
