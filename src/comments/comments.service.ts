import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { Comment } from "./comment.model";
import { Post } from "../posts/post.model";
import { User } from "../users/user.model";
import Redis from "ioredis";
import { NotificationPayload } from "../notification/notification.interface";
import { Queue } from "bullmq";
import { CommentResponseDto, DeleteCommentResponseDto } from "./dto/comment.dto";
import { plainToInstance } from "class-transformer";

@Injectable()
export class CommentsService {
    private readonly pubsub: Redis;
    private notifQueue = new Queue('notifications', {
        connection: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
        },
    });

    constructor(
        @InjectModel(Comment)
        private readonly commentsModel: typeof Comment,

        @InjectModel(Post)
        private readonly postModel: typeof Post,

        @InjectModel(User)
        private readonly userModel: typeof User,
    ) {
        this.pubsub = new Redis();
    }

    async addComment(postId: string, userId: number, content: string): Promise<CommentResponseDto> {
        if(!postId || !userId || !content) throw new BadRequestException('Invalid request');

        const comment = await this.commentsModel.create({
            UserId: userId,
            PostId: parseInt(postId),
            content,
        } as any);
        

        const post = await this.postModel.findOne({ where: { id: parseInt(postId) } });

        if (!post || post.userId === undefined) {
            throw new NotFoundException('Post not found or userId is undefined');
        }

        const user = await this.userModel.findByPk(post.userId);

        if (!user) {
            throw new Error('User not found');
        }

        const payload: NotificationPayload = {
            fromUserId: userId,
            toUserId: post.userId,
            fcmToken: user.fcmToken,
            type: 'comment',
            timestamp: new Date().toISOString(),
            postId: postId,
            text: content,
        }

        await this.pubsub.publish('notification-comment', JSON.stringify(payload));

        await this.notifQueue.add('comment-event', payload);

        return plainToInstance(CommentResponseDto, comment.get({ plain: true }));

    }

    async getComments(postId: number): Promise<CommentResponseDto[]> {
        const post = await this.postModel.findByPk(postId);
        if (!post) throw new NotFoundException('Post not found');

        const comments = await this.commentsModel.findAll({
            where: {
                PostId: postId
            },
            order: [['createdAt', 'DESC']]
        });

        const safeComments = comments ?? [];

        return plainToInstance(
            CommentResponseDto,
            safeComments.map(comment => comment.get({ plain: true }))
        );
    }

    async deleteComment(commentId: number, userId: number): Promise<DeleteCommentResponseDto> {
        const comment = await this.commentsModel.findByPk(commentId);
        if (!comment) throw new NotFoundException('Comment not found');
        if (!comment.UserId || comment.UserId !== userId) throw new ForbiddenException();
        await comment.destroy();
        return new DeleteCommentResponseDto(`Comment deleted successfully`);
    }
}
