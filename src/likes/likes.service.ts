import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { Like } from "./like.model";
import { Post } from "../posts/post.model";
import { NotificationPayload } from "../notification/notification.interface";
import { User } from "../users/user.model";
import Redis from "ioredis";

@Injectable()
export class LikeService{
    private pubsub = new Redis();
    constructor(

         @InjectModel(Like)
        private readonly likeModel: typeof Like,

        @InjectModel(Post)
        private readonly postModel: typeof Post,

        @InjectModel(User)
        private readonly userModel: typeof User,
    ){
    }

    async likePost(PostId: number, UserId: number){
        const like = this.likeModel.findOrCreate({
            where: { UserId, PostId }
        })
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
                    type: 'like', 
                    timestamp: new Date().toISOString()
                }
        
        await this.pubsub.publish('notification-like', JSON.stringify(payload));

        return like;
        
                //await this.notifQueue.add('like-event', payload);

    }

    async unlikePost(PostId: number, UserId: number){
        return this.likeModel.destroy({
            where: { UserId, PostId }
        })
    }
}