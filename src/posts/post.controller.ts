import { Controller, Post, Body, Req } from '@nestjs/common';
import { PostService } from './post.service';

@Controller('posts')
export class PostController {
  constructor(private readonly postService: PostService) {}
  @Post()
  async createPost(@Body() postData: any, @Req() req: any) {
    const { caption, imageUrl } = postData;
    const userId = 2;

    const post = await this.postService.createPost(userId, caption, imageUrl);
    return post;
  }
}
