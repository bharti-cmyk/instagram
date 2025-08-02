import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { Request } from 'express';
import { NotificationService } from "./notification.service";
import { AuthGuard } from "../auth/auth.guard";
import { RequestWithUser } from '../types/requestWithUser';

@Controller('notification')
export class NotificationController {
    constructor(
        private readonly notificationService: NotificationService
    ) { }

    @UseGuards(AuthGuard)
    @Get()
    async getUserNotifications(@Req() req: RequestWithUser) {
        return this.notificationService.getNotifications(Number(req.user.id));
    }

}
