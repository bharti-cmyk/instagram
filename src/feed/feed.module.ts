import { Module } from '@nestjs/common';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';
import { Post } from '../posts/post.model';
import { User } from '../users/user.model';
import { SequelizeModule } from '@nestjs/sequelize';
import { Follow } from '../follows/follow.model';

@Module({
  imports: [SequelizeModule.forFeature([Post, User, Follow])],
  controllers: [FeedController],
  providers: [FeedService],
  exports: [],
})
export class FeedModule {}
