import { IsString, MinLength } from 'class-validator';
import { BaseUserDto } from './baseUser.dto';

export class RegisterReqDto extends BaseUserDto {
  @IsString()
  @MinLength(8)
  password: string;
}

export class RegisterResDto extends BaseUserDto {
  bio?: string;
  avatarUrl?: string;
  isCelebrity: boolean;
  lastSeenPostId?: string | null;

  constructor(partial: Partial<RegisterResDto>) {
    super();
    this.username = partial.username!;
    this.email = partial.email!;
    this.bio = partial.bio;
    this.avatarUrl = partial.avatarUrl;
    this.isCelebrity = partial.isCelebrity ?? false;
    this.lastSeenPostId = partial.lastSeenPostId ?? null;
  }
}
