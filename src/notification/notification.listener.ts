import { Injectable, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class NotificationListener implements OnModuleInit {
  private redisSub = new Redis();

  async onModuleInit() {
    await this.redisSub.subscribe('notification:follow', 'notification:like',
      'notification:comment'); // Ensure subscription completes
    console.log('Subscribed to follow, like, and comment notification channels');

    this.redisSub.on('message', (channel, message) => {
      try {
        const payload = JSON.parse(message);

        switch (channel) {
          case 'notification:follow':
            console.log(`[Redis PubSub] Follow event:`, payload);
            break;
          case 'notification:like':
            console.log(`[Redis PubSub] Like event:`, payload);
            break;
          case 'notification:comment':
            console.log(`[Redis PubSub] Comment event:`, payload);
            break;
          default:
            console.warn(`Unknown channel received: ${channel}`);
        }

        // Later: You can broadcast to WebSocket clients here

      } catch (err) {
        console.error('Failed to parse message:', message);
      }
    });
  }
}
