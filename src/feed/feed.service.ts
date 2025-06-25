import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { InjectModel } from '@nestjs/sequelize';
import { Post } from '../posts/post.model';
import { User } from '../users/user.model';
import { Follow } from '../follows/follow.model';
import { Op } from 'sequelize';

const redis = new Redis();

@Injectable()
export class FeedService {
  constructor(
    @InjectModel(Post)
    private readonly postModel: typeof Post,

    @InjectModel(User)
    private readonly userModel: typeof User,

    @InjectModel(Follow)
    private readonly followModel: typeof Follow,
  ) {}

  async getUserFeed(
    userId: number,
    cursor?: string,
    limit = 10,
    after?: string,
  ) {
    const { celebIds, normalIds } = await this.getFolloweeIds(userId);

    const fanoutPostIds = after
      ? await this.fetchZSetAfter(userId, after)
      : await this.fetchZSetCursor(userId, cursor, limit);

    const fanoutPosts = await this.fetchPostsByIds(fanoutPostIds);
    const celebPosts = await this.getCelebPosts(
      celebIds,
      cursor || after,
      !!after,
      limit,
    );

    const combined = this.combineAndSort(
      [...fanoutPosts, ...celebPosts],
      limit,
    );

    const nextCursor =
      !after && combined.length ? combined[combined.length - 1].id : null;

    await this.updateLastSeen(userId, combined[0]?.id);

    return { posts: combined, nextCursor };
  }

  private async getFolloweeIds(userId: number) {
    const followees = await this.followModel.findAll({
      where: { followerId: userId },
      include: [{ model: User, as: 'followed', required: false }],
    });

    const celebIds: number[] = [];
    const normalIds: number[] = [];

    for (const followee of followees) {
      if (followee.get('followed')?.get('isCelebrity')) {
        celebIds.push(followee.followedId);
      } else {
        normalIds.push(followee.followedId);
      }
    }

    return { celebIds, normalIds };
  }

  private async fetchZSetCursor(
    userId: number,
    cursor?: string,
    limit = 10,
  ): Promise<string[]> {
    return await redis.zrevrangebyscore(
      `feed:${userId}`,
      cursor ? `(${cursor}` : '+inf',
      '-inf',
      'LIMIT',
      0,
      limit,
    );
  }

  private async fetchZSetAfter(
    userId: number,
    after: string,
  ): Promise<string[]> {
    return await redis.zrangebyscore(`feed:${userId}`, `(${after}`, '+inf');
  }

  private async fetchPostsByIds(postIds: string[]): Promise<Post[]> {
    if (!postIds.length) return [];

    return await this.postModel.findAll({
      where: { id: postIds.map(Number) },
      include: [{ model: User, attributes: ['id', 'username', 'avatarUrl'] }],
    });
  }

  private async getCelebPosts(
    celebIds: number[],
    idRef?: string,
    isAfter = false,
    limit = 10,
  ): Promise<Post[]> {
    if (!celebIds.length) return [];

    const condition = isAfter ? { [Op.gt]: idRef } : { [Op.lt]: idRef };

    return await this.postModel.findAll({
      where: {
        userId: celebIds,
        ...(idRef && { id: condition }),
      },
      order: [['id', 'DESC']],
      limit,
      include: [{ model: User, attributes: ['id', 'username', 'avatarUrl'] }],
    });
  }

  private combineAndSort(posts: Post[], limit: number): Post[] {
    return posts.sort((a, b) => Number(b.id) - Number(a.id)).slice(0, limit);
  }

  private async updateLastSeen(userId: number, topPostId?: number) {
    await this.userModel.update(
      { lastSeenPostId: topPostId?.toString() || null },
      { where: { id: userId } },
    );
  }
}
