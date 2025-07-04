import { Redis } from 'ioredis';

export async function withRedisLock(
  redis: Redis,
  key: string,
  action: () => Promise<void>,
  ttl = 30 // seconds
): Promise<void> {
  const lockValue = Date.now().toString();

  // Correct way to acquire lock with NX and EX
  const acquired = await redis.set(key, lockValue, 'EX', ttl, 'NX');

  if (!acquired) {
    throw new Error('Resource is locked, try again later');
  }

  try {
    await action();
  } finally {
    const currentValue = await redis.get(key);
    if (currentValue === lockValue) {
      await redis.del(key);
    }
  }
}
