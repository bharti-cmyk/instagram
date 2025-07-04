import { Injectable } from "@nestjs/common";
import { Notification } from "./notification.model";
import { InjectModel } from "@nestjs/sequelize";

@Injectable()
export class NotificationService {

    constructor(

        @InjectModel(Notification)
        private readonly notificationModel: typeof Notification
    ) { }

    async getNotifications(userId: number) {
        const notifications = await this.notificationModel.findAll({
            where: { toUserId: userId },
            order: [['createdAt', 'DESC']],
            limit: 50,
        });

        const unreadCount = await this.notificationModel.count({
            where: { toUserId: userId, isRead: false },
        });

        return { notifications, unreadCount };
    }

}