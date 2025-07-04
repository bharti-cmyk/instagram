import { Controller, Delete, Param, Post, Req, UseGuards } from "@nestjs/common";
import { Like } from "./like.model";
import { LikeService } from "./likes.service";
import { AuthGuard } from "../auth/auth.guard";

interface RequestWithUser extends Request {
    user: { id: string };
}

@Controller('likes')
export class LikeController{

    constructor(
       private readonly likeService:  LikeService
    ){}

    @UseGuards(AuthGuard)
    @Post(':postId')
    async likePost(@Param('postId') postId: number, @Req() req: RequestWithUser){
        return await this.likeService.likePost(postId, Number(req.user.id));
    }

    @UseGuards(AuthGuard)
    @Delete(':postId')
    async unlikePost(@Param('postId') postId: number, @Req() req: RequestWithUser){
        return await this.likeService.unlikePost(postId, Number(req.user.id));
    }
    
}