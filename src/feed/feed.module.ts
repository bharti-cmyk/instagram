import { Module } from '@nestjs/common';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';
import { Post } from '../posts/post.model';
import { User } from '../users/user.model';
import { SequelizeModule } from '@nestjs/sequelize';
import { Follow } from '../follows/follow.model';
import { RedisProvider } from '../database/redis.provider';
import { JwtService } from '@nestjs/jwt';
import { Like } from '../likes/like.model';
import { Comment } from '../comments/comment.model';

@Module({
  imports: [SequelizeModule.forFeature([Post, User, Follow, Like, Comment])],
  controllers: [FeedController],
  providers: [FeedService, RedisProvider, JwtService],
  exports: [],
})
export class FeedModule {}
