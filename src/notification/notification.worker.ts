import { Worker } from 'bullmq';
import Redis from 'ioredis';
import * as nodemailer from 'nodemailer';
import * as dotenv from 'dotenv';
import { PushService } from '../push/push.service';
import { Notification } from './notification.model';
import { User } from '../users/user.model';
import { Sequelize } from 'sequelize-typescript';
import { Post } from '../posts/post.model';
import { Follow } from '../follows/follow.model';

dotenv.config();

const pushService = new PushService()

// Configure nodemailer transporter

export const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});


const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
});

const sequelize = new Sequelize({
    dialect: "mysql",
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306"),
    username: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "instagram",
    models: [User, Notification, Post, Follow],
    logging: false,
});


// 💼 Define worker
const worker = new Worker(
    'notifications',
    async (job) => {
        const { fromUserId, toUserId, fcmToken, type, timestamp, postId, text } = job.data;

        console.log(`🔔 [Worker] Handling notification for type [${type}]:`, job.data);

        // Send Email
        const subjectMap = {
            follow: 'You have a new follower!',
            like: 'Someone liked your post!',
            comment: 'New comment on your post!',
        };

        const htmlMap = {
            follow: `<p>User <strong>${fromUserId}</strong> followed you at ${timestamp}</p>`,
            like: `<p>User <strong>${fromUserId}</strong> liked your post at ${timestamp}</p>`,
            comment: `<p>User <strong>${fromUserId}</strong> commented: "${text}" at ${timestamp}</p>`,
        };

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: process.env.TEST_RECEIVER,
            subject: subjectMap[type],
            html: htmlMap[type],
        });

        console.log("📧 Email sent");

        // Push Notification
        if (fcmToken) {
            const titleMap = {
                follow: 'New Follower!',
                like: 'Post Liked!',
                comment: 'New Comment!',
            };

            const bodyMap = {
                follow: `User ${fromUserId} followed you`,
                like: `User ${fromUserId} liked your post`,
                comment: `User ${fromUserId} commented: "${text}"`,
            };

            const result = await pushService.sendGenericPush(fcmToken, {
                title: titleMap[type],
                body: bodyMap[type],
            });

            console.log('📲 Push sent:', result);
        } else {
            console.warn('⚠️ No fcmToken found. Skipping push');
        }

        // Save Notification to DB
        await Notification.create({
            toUserId,
            fromUserId,
            type,
            postId: postId || null,
            isRead: false,
        } as Notification);
    },
    {
        connection: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
        },
    }
);

