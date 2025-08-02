import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { FeedService } from './feed.service';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '../auth/auth.guard';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { User } from '../users/user.model';
import { RequestWithUser } from '../types/requestWithUser';

@Controller('feed')
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get User Feed' })
  @ApiResponse({ status: 200, description: 'User feed retrieved successfully' })
  @ApiParam({ name: 'cursor', required: false, description: 'Cursor for pagination' })
  @ApiParam({ name: 'limit', required: false, description: 'Number of posts to retrieve', type: Number })
  @ApiParam({ name: 'after', required: false, description: 'Post ID to fetch after' })
  @Get()
  async getFeed(
    @Req() req: RequestWithUser,
    @Query('cursor') cursor?: string,
    @Query('limit') limit: number = 10,
    @Query('after') after?: string,
  ) {
    const userId = req.user.id; 
    const { posts, nextCursor } = await this.feedService.getUserFeed(
      userId,
      cursor,
      +limit,
      after,
    );
    return { data: posts, nextCursor };
  }
}
