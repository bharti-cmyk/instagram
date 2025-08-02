import { Controller, Delete, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { Like } from "./like.model";
import { LikeService } from "./likes.service";
import { AuthGuard } from "../auth/auth.guard";
import { RequestWithUser } from '../types/requestWithUser';

@Controller('post/:postId/likes')
export class LikeController{

    constructor(
       private readonly likeService:  LikeService
    ){}

    @UseGuards(AuthGuard)
    @Post()
    async likePost(@Param('postId') postId: string, @Req() req: RequestWithUser){
        return await this.likeService.likePost(postId, Number(req.user.id));
    }

    @UseGuards(AuthGuard)
    @Delete()
    async unlikePost(@Param('postId') postId: number, @Req() req: RequestWithUser){
        return await this.likeService.unlikePost(postId, Number(req.user.id));
    }

    @UseGuards(AuthGuard)
    @Get()
    async getLikes(@Param('postId') postId: string): Promise<Like[]> {
        return await this.likeService.getLikesByPostId(postId);
    }
    
}