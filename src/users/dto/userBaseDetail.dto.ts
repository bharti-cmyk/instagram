import { IsNumber, IsOptional, IsString } from 'class-validator';

export class UserBaseDetail {
  @IsNumber()
  id: number;

  @IsString()
  username: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  profilePicture?: string;
}
