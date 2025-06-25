import { Queue } from 'bullmq';
import { config } from 'dotenv';

config(); // Load environment variables from .env file

export const feedQueue = new Queue('feed-fanout', {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
});
