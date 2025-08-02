import { IsString, MinLength } from "class-validator";
import { Expose } from 'class-transformer';

export class CommentRequestDto {
    @IsString()
    @MinLength(1)
    content: string;
}

export class CommentResponseDto {
  @Expose()
  id: number;

  @Expose()
  content: string;

  @Expose()
  createdAt: Date;

  @Expose()
  userId: number;

  @Expose()
  postId: number;

  constructor(partial: Partial<CommentResponseDto>) {
    Object.assign(this, partial);
  }
}

export class DeleteCommentResponseDto {
  @Expose()
  message: string;

  constructor(message: string) {
    this.message = message;
  }
}