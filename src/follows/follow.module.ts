import { Module } from '@nestjs/common';
import { FollowController } from './follow.controller';
import { FollowService } from './follow.service';
import { SequelizeModule } from '@nestjs/sequelize';
import { Follow } from './follow.model';
import { User } from '../users/user.model';
import { JwtService } from '@nestjs/jwt';
import { Post } from '../posts/post.model';
import { Notification } from '../notification/notification.model';

@Module({
imports: [
  SequelizeModule.forFeature([Follow, User, Post, Notification]),
],
  controllers: [FollowController],
  providers: [FollowService, JwtService],
  exports: [],
})
export class FollowModule {}
