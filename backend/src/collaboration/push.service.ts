import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import webPush, { type PushSubscription } from 'web-push';
import type { Environment } from '../config/environment';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class PushService {
  private readonly enabled: boolean;

  constructor(
    private readonly config: ConfigService<Environment, true>,
    private readonly prisma: PrismaService,
  ) {
    const subject = config.get('vapidSubject', { infer: true });
    const publicKey = config.get('vapidPublicKey', { infer: true });
    const privateKey = config.get('vapidPrivateKey', { infer: true });
    if (subject && publicKey && privateKey) {
      this.enabled = true;
      webPush.setVapidDetails(subject, publicKey, privateKey);
    } else {
      this.enabled = false;
    }
  }

  publicKey(): string | null {
    return this.config.get('vapidPublicKey', { infer: true }) ?? null;
  }

  async subscribe(userId: string, subscription: PushSubscription, userAgent?: string) {
    return this.prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      create: { userId, endpoint: subscription.endpoint, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth, userAgent },
      update: { userId, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth, userAgent },
      select: { id: true },
    });
  }

  async unsubscribe(userId: string, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
  }

  async notifyUsers(userIds: string[], payload: { title: string; body: string; url: string }) {
    if (!this.enabled || !userIds.length) return;
    const subscriptions = await this.prisma.pushSubscription.findMany({ where: { userId: { in: userIds } } });
    await Promise.all(subscriptions.map(async (subscription) => {
      try {
        await webPush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify(payload));
      } catch (error: unknown) {
        const statusCode = typeof error === 'object' && error && 'statusCode' in error ? error.statusCode : undefined;
        if (statusCode === 404 || statusCode === 410) await this.prisma.pushSubscription.delete({ where: { id: subscription.id } });
      }
    }));
  }
}
