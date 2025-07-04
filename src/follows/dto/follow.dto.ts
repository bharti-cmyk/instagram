import { IsNumber } from 'class-validator';

export class CreateFollowDto {
  @IsNumber()
  followerId: number;

  @IsNumber()
  followedId: number;
}
