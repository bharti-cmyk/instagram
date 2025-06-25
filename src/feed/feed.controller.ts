import { Controller, Get, Query, Req } from '@nestjs/common';
import { FeedService } from './feed.service';
import { Throttle } from '@nestjs/throttler';

@Controller('feed')
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Get()
  async getFeed(
    @Req() req,
    @Query('cursor') cursor?: string,
    @Query('limit') limit: number = 10,
    @Query('after') after?: string,
  ) {
    const userId = 3; // Assuming user ID is stored in the request object
    const { posts, nextCursor } = await this.feedService.getUserFeed(
      userId,
      cursor,
      +limit,
      after,
    );
    return { data: posts, nextCursor };
  }
}
