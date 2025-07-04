import { Module } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { Post } from "../posts/post.model";
import { User } from "../users/user.model";
import { CommentsController } from "./comments.controller";
import { CommentsService } from "./comments.service";
import { JwtService } from "@nestjs/jwt";
import { Comment } from "./comment.model";

@Module({
    imports: [SequelizeModule.forFeature([Comment, Post, User])],
    controllers: [CommentsController],
    providers: [CommentsService, JwtService],
    exports: []
})
export class CommentsModule {}

