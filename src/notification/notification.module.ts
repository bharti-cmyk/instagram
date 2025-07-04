import { Module } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { Notification } from "./notification.model";
import { NotificationController } from "./notification.controller";
import { NotificationService } from "./notification.service";
import { JwtService } from "@nestjs/jwt";
import { NotificationListener } from "./notification.listener";

@Module({
    imports: [SequelizeModule.forFeature([Notification])],
    controllers: [NotificationController],
    providers: [NotificationService, JwtService, NotificationListener]
})

export class NotificationModule {}