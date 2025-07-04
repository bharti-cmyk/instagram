import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { Request } from 'express';
import { NotificationService } from "./notification.service";
import { AuthGuard } from "src/auth/auth.guard";

// Define RequestWithUser interface if not already defined elsewhere
interface RequestWithUser extends Request {
    user: { id: string };
}

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
