import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './users/user.module';
import { FollowModule } from './follows/follow.module';
import { PostModule } from './posts/post.module';
import { FeedModule } from './feed/feed.module';
import { DatabaseModule } from './database/database.module';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { RedisModule } from './redis.module';
import { NotificationModule } from './notification/notification.module';
import { CommentsModule } from './comments/comments.module';
import { LikesModule } from './likes/likes.module';
import { LifecycleModule } from './utils/lifecycle.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60000,
          limit: 10,
        },
      ],
    }),
    DatabaseModule,
    UserModule,
    FollowModule,
    PostModule,
    FeedModule,
    AuthModule,
    RedisModule,
    NotificationModule,
    CommentsModule,
    LikesModule,
    LifecycleModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
