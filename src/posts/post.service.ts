import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Post } from './post.model'; // Assuming you have a Post model defined
import { feedQueue } from '../feed/feed.queue';
import { generateId } from '../utils/generate-id';

// feedQueue.add will be called after userId and postId are available in createPost

@Injectable()
export class PostService {
  constructor(
    @InjectModel(Post)
    private readonly postModel: typeof Post,
  ) {}

  async createPost(
    userId: number,
    content: string,
    imageUrl: string,
  ): Promise<Post | null> {
    const postId = generateId();
    await feedQueue.add('fanout', {
      userId,
      postId,
    });

    const post = await this.postModel.create({
      id: +postId,
      userId,
      caption: content,
      imageUrl: imageUrl, // Assuming you don't have an image URL for now
    } as any);
    return post;
  }
}
