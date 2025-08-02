import { Module, OnModuleDestroy } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-ioredis';
import { RedisProvider } from './database/redis.provider';
import { ConfigModule } from '@nestjs/config';
import { RedisService } from './database/redis.service';

@Module({
  imports: [
    ConfigModule,
    CacheModule.register({
      isGlobal: true,
      store: redisStore,
      host: 'localhost',
      port: 6379,
      ttl: 60, // seconds
    }),
  ],
  providers: [RedisProvider, RedisService],
  exports: [RedisProvider, RedisService],
})
export class RedisModule implements OnModuleDestroy {
  constructor(private readonly redisService: RedisService) {}

  async onModuleDestroy() {
    await this.redisService.onModuleDestroy();
  }
}
