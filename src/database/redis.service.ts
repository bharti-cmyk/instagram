import { Injectable, OnModuleDestroy, Inject } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  constructor(@Inject('REDIS_CLIENT') private readonly redisClient: Redis) {}

  async onModuleDestroy() {
    try {
      console.log('🔄 Closing Redis connections...');
      if (this.redisClient && typeof this.redisClient.quit === 'function') {
        await this.redisClient.quit();
        console.log('✅ Redis connections closed successfully.');
      }
    } catch (error) {
      console.error('❌ Error closing Redis connections:', error.message);
    }
  }
} 