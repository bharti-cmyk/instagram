import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Post } from './post.model'; // Assuming you have a Post model defined
import { feedQueue } from '../feed/feed.queue';
import { generateId } from '../utils/generate-id';
import { NotFoundError } from 'rxjs';

// feedQueue.add will be called after userId and postId are available in createPost

@Injectable()
export class PostService {
  constructor(
    @InjectModel(Post)
    private readonly postModel: typeof Post,
  ) { }

  async createPost(
    userId: number,
    content: string,
    imageUrl: Express.Multer.File,
  ): Promise<Post> {
    const postId = generateId();
    await feedQueue.add('fanout', {
      userId,
      postId,
    });

    const post = await this.postModel.create({
      id: +postId,
      userId,
      caption: content,
      ...(imageUrl && { imageUrl: `/uploads/${imageUrl.filename}` }),
    } as Post);
    return post;
  }

  async updatePost(
    userId: number,
    postId: string,
    content: string,
    imageUrl: string | null,
  ): Promise<Post | null> {
    const post = await this.postModel.findOne({
      where: { id: +postId, userId },
    });

    if (!post) {
      throw new NotFoundException('Post not found or does not belongs to the user'); // Post not found or does not belong to the user
    }

    post.caption = content;

    if (imageUrl) {
      post.imageUrl = imageUrl; // Update the image URL if provided
    }
    const updatedPost = await post.save();
    return updatedPost;
  }

  async getPostById(userId: number, postId: string): Promise<Post> {
    const post = await this.postModel.findOne({
      where: { id: +postId, userId },
    });

    if (!post) {
      throw new NotFoundException('Post not found or does not belong to the user');
    }

    return post;
  }

  async getAllPostsByUser(userId: number): Promise<Post[]> {
    return this.postModel.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
    });
  }

  async deletePost(userId: number, postId: string): Promise<void> {
    const post = await this.postModel.findOne({
      where: { id: +postId, userId },
    });

    if (!post) {
      throw new NotFoundException('Post not found or does not belong to the user');
    }

    await post.destroy();
  }
}
