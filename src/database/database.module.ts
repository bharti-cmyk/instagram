import { Module, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Sequelize } from 'sequelize-typescript';
import { User } from '../users/user.model';
import { Post } from '../posts/post.model';
import { Follow } from '../follows/follow.model';
import { Like } from '../likes/like.model';
import { Comment } from '../comments/comment.model';
import { Notification } from '../notification/notification.model';

@Module({
  imports: [
    ConfigModule,
    SequelizeModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        dialect: 'mysql',
        host: configService.get('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get('DB_USER'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_NAME'),
        models: [User, Post, Follow, Like, Comment, Notification],
        autoLoadModels: true,
        synchronize: true,
        logging: false,
      }),
    }),
  ],
})
export class DatabaseModule implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly sequelize: Sequelize) {}

  async onModuleInit() {
    try {
      await this.sequelize.authenticate();
      console.log('Database connection has been established successfully.');
    } catch (error) {
      console.error('Unable to connect to the database:', error.message);
      throw error; // Re-throw to prevent app from starting with DB issues
    }
  }

  async onModuleDestroy() {
    try {
      console.log('Closing database connections...');
      await this.sequelize.close();
      console.log('Database connections closed successfully.');
    } catch (error) {
      console.error('Error closing database connections:', error.message);
    }
  }
}
