import { IsString, MinLength } from 'class-validator';
import { BaseUserDto } from './baseUser.dto';
import { Expose } from 'class-transformer'

export class RegisterReqDto extends BaseUserDto {
  @IsString()
  @MinLength(8)
  password: string;
  
}

export class RegisterResDto extends BaseUserDto {
  @Expose()
  bio?: string;

  @Expose()
  avatarUrl?: string;

  @Expose()
  isCelebrity: boolean;

  @Expose()
  lastSeenPostId?: string | null;

  constructor(partial: Partial<RegisterResDto>) {
    super();

    if (!partial) return;

    Object.assign(this, {
      ...partial,
      isCelebrity: partial.isCelebrity ?? false,
      lastSeenPostId: partial.lastSeenPostId ?? null
    })
  }
}
