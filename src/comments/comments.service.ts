import { ForbiddenException, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { Comment } from "./comment.model";
import { Post } from "../posts/post.model";
import { User } from "../users/user.model";
import Redis from "ioredis";
import { NotificationPayload } from "../notification/notification.interface";

@Injectable()
export class CommentsService {
    private readonly pubsub: Redis;

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

    async addComment(PostId: number, UserId: number, content: string) {
        const comment = this.commentsModel.create({ UserId, PostId, content } as Comment)

        const post = await this.postModel.findOne({ where: { id: PostId } });

        if (!post || post.userId === undefined) {
            throw new Error('Post not found or userId is undefined');
        }

        const user = await this.userModel.findByPk(post.userId);

        if (!user) {
            throw new Error('User not found');
        }

        const payload: NotificationPayload = {
            fromUserId: UserId,
            toUserId: post.userId,
            fcmToken: user.fcmToken,
            type: 'comment',
            timestamp: new Date().toISOString()
        }

        await this.pubsub.publish('notification-comment', JSON.stringify(payload));

        //await this.notifQueue.add('follow-event', payload);

        return comment;
    }

    async getComments(PostId: number) {
        return this.commentsModel.findAll({
            where:
            {
                PostId
            },
            order: [['createdAt', 'DESC']]
        })
    }

    async delete(commentId: number, UserId: number) {
        const comment = await this.commentsModel.findByPk(commentId);
        if (comment?.UserId !== UserId) throw new ForbiddenException();
        await comment.destroy();
        return { message: 'Deleted successfully' };
    }
}
