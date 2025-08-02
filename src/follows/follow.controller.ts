import { Controller, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from "@nestjs/common";
import { FollowService } from "./follow.service";
import { User } from "../users/user.model";
import { AuthGuard } from "../auth/auth.guard";
import { CreateFollowDto } from "./dto/follow.dto";
import { FollowedList } from "./dto/followedList.dto";
import { FollowerList } from "./dto/followersList.dto";
import { RequestWithUser } from '../types/requestWithUser';

@Controller('follows')
export class FollowController {
    constructor(
        private readonly followService: FollowService
    ) { }

    @UseGuards(AuthGuard)
    @Post('follow/:userId')
    async follow(@Req() req: RequestWithUser, @Param('userId', ParseIntPipe) userId: number): Promise<CreateFollowDto> {
        return await this.followService.follow(req.user.id, userId);
    }

    @UseGuards(AuthGuard)
    @Post('unfollow/:userId')
    async unfollow(@Req() req: RequestWithUser, @Param('userId', ParseIntPipe) userId: number): Promise<{ message: string }> {
        const unfollowed = await this.followService.unFollow(req.user.id, userId);
        return { message: unfollowed }
    }

    @UseGuards(AuthGuard)
    @Get('followers')
    async getFollowers(@Req() req: RequestWithUser,
        @Query('page') page = 1,
        @Query('limit') limit = 10): Promise<FollowerList> {
        return await this.followService.getFollowers(req.user.id, +page, +limit);
    }

    @UseGuards(AuthGuard)
    @Get('following')
    async getFollowing(@Req() req: RequestWithUser,
        @Query('page') page = 1,
        @Query('limit') limit = 10
    ): Promise<FollowedList> {
        return await this.followService.getFollowed(req.user.id, +page, +limit);
    }

}