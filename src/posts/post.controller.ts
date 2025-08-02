import { Controller, Post, Body, Req, UseGuards, Param, Put, UseInterceptors, UploadedFile, Get, Delete } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { PostService } from './post.service';
import { User } from '../users/user.model';
import { AuthGuard } from '../auth/auth.guard';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CreatePostDto } from './dto/createPost.dto';
import { RequestWithUser } from '../types/requestWithUser';

@Controller('posts')
export class PostController {
  constructor(private readonly postService: PostService) { }
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Post()
  @UseInterceptors(FileInterceptor('imageUrl', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + '-' + uniqueSuffix + extname(file.originalname));
      },
    }),
  }))
  @ApiOperation({ summary: 'Create Post' })
  @ApiResponse({ status: 201, description: 'Post created successfully' })
  @ApiBody({
    type: CreatePostDto,
  })
  @ApiConsumes('multipart/form-data')
  async createPost(@Body() postData: CreatePostDto, @Req() req: RequestWithUser, @UploadedFile() imageUrl: Express.Multer.File) {
    const { caption } = postData;
    const userId = req.user.id;

    const post = await this.postService.createPost(userId, caption, imageUrl);

    return post;
  }

  @UseGuards(AuthGuard)
  @Put(':postId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update Post' })
  @ApiResponse({ status: 200, description: 'Post updated successfully' })
  @ApiBody({
    type: CreatePostDto,
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('imageUrl', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + '-' + uniqueSuffix + extname(file.originalname));
      },
    }),
  }))
  async updatePost(@Param('postId') postId: string, @Body() data: { caption: string; imageUrl: string }, @Req() req: RequestWithUser) {
    const userId = req.user.id;
    const post = await this.postService.updatePost(userId, postId, data.caption, data.imageUrl);
    return post;
  }

  @UseGuards(AuthGuard)
  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get post by ID or all posts of the user' })
  @ApiResponse({ status: 200, description: 'Post(s) retrieved successfully' })
  async getPost(
    @Req() req: RequestWithUser,
  ) {
    const userId = req.user.id;

    return this.postService.getAllPostsByUser(userId);
  }

  @UseGuards(AuthGuard)
  @Delete(':postId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete Post' })
  @ApiResponse({ status: 200, description: 'Post deleted successfully' })
  async deletePost(@Param('postId') postId: string, @Req() req: RequestWithUser): Promise<{ message: string }> {
    const userId = req.user.id;
    await this.postService.deletePost(userId, postId);
    return { message: 'Post deleted successfully' };
  }


}