import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

export const RedisProvider = {
  provide: 'REDIS_CLIENT',
  useFactory: (configService: ConfigService) => {
    return new Redis({
      host: configService.get('REDIS_HOST') || 'localhost',
      port: configService.get<number>('REDIS_PORT') || 6379,
    });
  },
  inject: [ConfigService],
};
