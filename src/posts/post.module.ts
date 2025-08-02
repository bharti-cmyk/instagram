import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Post } from './post.model';
import { PostController } from './post.controller';
import { PostService } from './post.service';
import { JwtService } from '@nestjs/jwt';

@Module({
  imports: [SequelizeModule.forFeature([Post])], // Add your Post model here if you have one
  controllers: [PostController],
  providers: [PostService, JwtService],
  exports: [],
})
export class PostModule {}
