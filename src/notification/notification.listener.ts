import { Injectable, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class NotificationListener implements OnModuleInit {
  private redisSub = new Redis();

  async onModuleInit() {
    await this.redisSub.subscribe('notification:follow'); // ✅ Ensure subscription completes
    console.log('🔔 Subscribed to notification:follow channel');

    this.redisSub.on('message', (channel, message) => {
      try {
        const payload = JSON.parse(message);
        console.log(`[Redis PubSub] 🔔 New follow event:`, payload);
      } catch (err) {
        console.error('❌ Failed to parse message:', message);
      }
    });
  }
}
