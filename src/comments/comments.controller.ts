import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { CommentsService } from "./comments.service";
import { AuthGuard } from "../auth/auth.guard";
import { CommentRequestDto, CommentResponseDto, DeleteCommentResponseDto } from "./dto/comment.dto";
import { RequestWithUser } from '../types/requestWithUser';

@Controller('posts/:postId/comments')
export class CommentsController {

    constructor(
        private readonly commentsService: CommentsService
    ){}
	
    @UseGuards(AuthGuard) 
    @Post()
    async createComment(@Param('postId') postId: string, @Body() body: CommentRequestDto, @Req() req: RequestWithUser ): Promise<CommentResponseDto> {
        return this.commentsService.addComment(postId, Number(req.user.id), body.content)
    }

    @UseGuards(AuthGuard)
    @Get()
    async getComments(@Param('postId') postId: string): Promise<CommentResponseDto[]> {
        return this.commentsService.getComments(parseInt(postId));
    }

    @UseGuards(AuthGuard)
    @Delete(':commentId')
    async deleteComment(@Param('commentId') commentId: string, @Req() req: RequestWithUser): Promise<DeleteCommentResponseDto> {
        return this.commentsService.deleteComment(parseInt(commentId), Number(req.user.id));
    }
}

