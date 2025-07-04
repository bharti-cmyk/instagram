import { Module } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { Like } from "./like.model";
import { LikeService } from "./likes.service";
import { LikeController } from "./likes.controller";
import { Post } from "../posts/post.model";
import { User } from "../users/user.model";
import { JwtService } from "@nestjs/jwt";

@Module({
    imports: [SequelizeModule.forFeature([Like, Post, User])],
    controllers: [LikeController],
    providers: [LikeService, JwtService],
    exports: []
})
export class LikesModule {}
