import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { Environment } from '../config/environment';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client?: Redis;

  constructor(config: ConfigService<Environment, true>) {
    const url = config.get('redisUrl', { infer: true });
    if (url) this.client = new Redis(url, { maxRetriesPerRequest: 1 });
  }

  async setPresence(userId: string): Promise<void> {
    if (!this.client) return;
    await this.client.set(`presence:user:${userId}`, 'online', 'EX', 75);
  }

  async clearPresence(userId: string): Promise<void> {
    if (!this.client) return;
    await this.client.del(`presence:user:${userId}`);
  }

  async onlineUsers(userIds: string[]): Promise<string[]> {
    if (!this.client || !userIds.length) return [];
    const values = await this.client.mget(
      userIds.map((userId) => `presence:user:${userId}`),
    );
    return userIds.filter((_userId, index) => values[index] === 'online');
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.quit();
  }
}
