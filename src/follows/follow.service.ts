import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { Follow } from "./follow.model";
import { User } from "../users/user.model";
import { InjectModel } from "@nestjs/sequelize";
import { FollowerList } from "./dto/followersList.dto";
import { FollowedList } from "./dto/followedList.dto";
import { CreateFollowDto } from "./dto/follow.dto";
import { CACHE_MANAGER, Cache } from "@nestjs/cache-manager";
import { Post } from "../posts/post.model";
import Redis from "ioredis";
import { Queue } from 'bullmq'
import { NotificationPayload } from "../notification/notification.interface";

@Injectable()
export class FollowService {
    private redis = new Redis();
    private pubsub = new Redis();
    private notifQueue = new Queue('notifications', {
        connection: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
        },
    });
    constructor(
        @InjectModel(User)
        private readonly userModel: typeof User,

        @InjectModel(Follow)
        private readonly followModel: typeof Follow,

        @InjectModel(Post)
        private readonly postModel: typeof Post,
        @Inject(CACHE_MANAGER)
        private readonly cacheManager: Cache,

    ) { }


    private validateSelfFollow(followerId: number, followedId: number) {
        if (followerId === followedId) {
            throw new BadRequestException('You cannot follow/unfollow yourself');
        }
    }

    async follow(followerId: number, followedId: number): Promise<CreateFollowDto> {
        this.validateSelfFollow(followerId, followedId);

        const existingUser = await this.followModel.findOne({
            where: { followerId, followedId }
        });

        if (existingUser) {
            throw new BadRequestException('You are already following');
        }

        const latestPosts = await this.postModel.findAll({
            where: { userId: followedId },
            order: [['createdAt', 'DESC']],
            limit: 10,
        });

        await this.addPostsToFeed(
            followerId,
            latestPosts
                .map(post => ({ id: post.id, createdAt: post.createdAt! }))
        );

        await this.cacheManager.del(`followers:${followedId}`);
        await this.cacheManager.del(`following:${followerId}`);

        const toUser = await this.userModel.findByPk(followerId);

        if (!toUser) {
            throw new BadRequestException('User not found');
        }

        const payload: NotificationPayload = {
            fromUserId: followerId,
            toUserId: followedId,
            fcmToken: toUser.fcmToken,
            type: 'follow',
            timestamp: new Date().toISOString()
        }

        await this.pubsub.publish('notification-follow', JSON.stringify(payload));

        await this.notifQueue.add('follow-event', payload);

        return this.followModel.create({ followerId, followedId } as Follow);
    }

    async unFollow(followerId: number, followedId: number): Promise<string> {
        this.validateSelfFollow(followerId, followedId);

        const existingUser = await this.followModel.findOne({
            where: { followerId, followedId }
        });

        if (!existingUser) {
            throw new BadRequestException('You are not following');
        }

        await existingUser.destroy();

        await this.cacheManager.del(`followers:${followedId}`);
        await this.cacheManager.del(`following:${followerId}`);

        return "Unfollowed Successfully";
    }

    async getFollowers(followedId: number, page = 1, limit = 10): Promise<FollowerList> {
        const offset = (page - 1) * limit;
        const followers = await this.followModel.findAndCountAll({
            where:
            {
                followedId: followedId
            },
            include: [{ model: this.userModel, as: 'follower' }],
            limit: limit,
            offset: offset
        })

        const result = {
            count: followers.count,
            totalPages: Math.ceil(followers.count / limit),
            page,
            followers: followers.rows.map(f => {
                const user = f.getDataValue('follower') as User;
                return {
                    id: user.id,
                    username: user.username,
                    profilePicture: user.avatarUrl,
                    bio: user.bio,
                    isCelebrity: user.isCelebrity,
                };
            })
        }

        await this.cacheManager.set(`followers:${followedId}`, result, 60)

        return result;
    }

    async getFollowed(followerId: number, page = 1, limit = 10): Promise<FollowedList> {
        const offset = (page - 1) * limit;
        const followed = await this.followModel.findAndCountAll({
            where:
            {
                followerId: followerId
            },
            include: [{ model: this.userModel, as: 'followed' }],
            limit: limit,
            offset: offset
        })

        const result = {
            count: followed.count,
            totalPages: Math.ceil(followed.count / limit),
            page,
            following: followed.rows.map(f => {
                const user = f.getDataValue('followed') as User;
                return {
                    id: user.id,
                    username: user.username,
                    profilePicture: user.avatarUrl,
                    bio: user.bio,
                    isCelebrity: user.isCelebrity,
                };
            })
        }

        await this.cacheManager.set(`followed:${followerId}`, result, 60)

        return result;
    }

    async addPostsToFeed(userId: number, posts: { id: number; createdAt: Date }[]) {
        const zaddArgs = posts.flatMap(post => [
            post.createdAt.getTime(), // score
            post.id.toString(), // member
        ]);

        if (zaddArgs.length) {
            await this.redis.zadd(`feed:${userId}`, ...zaddArgs);
            // Trim feed to 1000 most recent posts (ZREMRANGEBYRANK is 0-based)
            await this.redis.zremrangebyrank(`feed:${userId}`, 0, -1001);
            await this.redis.expire(`feed:${userId}`, 60 * 60 * 24); // 24 hours if we want old posts to expire in 24 hours
        }
    }

}