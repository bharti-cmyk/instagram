import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class CreatePostDto {
  @IsString()
  @ApiProperty({
    type: String,
    description: 'Caption for the post',
    example: 'Hello from the beach!',
  })
  caption: string;

  @IsOptional()
  @ApiProperty({
    type: 'string',
    format: 'binary', // 👈 this is important for file uploads
    description: 'Image file for the post',
  })
  imageUrl?: any; // 👈 Use `any` for Swagger to show it as a file
}