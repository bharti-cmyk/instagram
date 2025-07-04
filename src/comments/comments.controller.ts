import { Body, Controller, Param, Post, Req, UseGuards } from "@nestjs/common";
import { CommentsService } from "./comments.service";
import { AuthGuard } from "src/auth/auth.guard";

interface RequestWithUser extends Request {
    user: { id: string };
}

@Controller('comments')
export class CommentsController {

    constructor(
        private readonly commentsService: CommentsService
    ){}
	
    @UseGuards(AuthGuard)
    @Post(':PostId')
    async comments(@Param('PostId') PostId: number, @Body('content') content: string, @Req() req: RequestWithUser ){
        return this.commentsService.addComment(PostId, Number(req.user.id), content)
    }

    @UseGuards(AuthGuard)
    @Post(':PostId')
    async getComments(@Param('PostId') PostId: number){
        return this.commentsService.getComments(PostId);
    }
}

