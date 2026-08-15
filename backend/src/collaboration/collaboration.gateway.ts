import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { createHash } from 'node:crypto';
import type { Server, Socket } from 'socket.io';
import { AccountStatus } from '../../generated/prisma/client';
import type { Environment } from '../config/environment';
import { PrismaService } from '../database/prisma.service';
import { CollaborationService } from './collaboration.service';
import { RedisService } from './redis.service';
import { PushService } from './push.service';

@Injectable()
@WebSocketGateway({ namespace: '/realtime', transports: ['websocket'] })
export class CollaborationGateway {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(CollaborationGateway.name);
  private readonly connections = new Map<string, number>();

  constructor(
    private readonly config: ConfigService<Environment, true>,
    private readonly prisma: PrismaService,
    private readonly collaboration: CollaborationService,
    private readonly redis: RedisService,
    private readonly push: PushService,
  ) {}

  async handleConnection(socket: Socket) {
    const user = await this.userForCookie(socket.handshake.headers.cookie);
    if (!user) return socket.disconnect(true);
    socket.data.userId = user.id;
    socket.join(`user:${user.id}`);
    this.connections.set(user.id, (this.connections.get(user.id) ?? 0) + 1);
    await this.redis.setPresence(user.id);
    this.server.emit('presence.updated', { userId: user.id, status: 'ONLINE' });
  }

  async handleDisconnect(socket: Socket) {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const count = Math.max(0, (this.connections.get(userId) ?? 1) - 1);
    if (count) this.connections.set(userId, count);
    else {
      this.connections.delete(userId);
      await this.redis.clearPresence(userId);
      this.server.emit('presence.updated', { userId, status: 'OFFLINE' });
    }
  }

  async broadcastMessage(message: { conversationId: string }) {
    const members = await this.prisma.conversationMember.findMany({
      where: { conversationId: message.conversationId },
      select: { userId: true },
    });
    for (const { userId } of members) {
      this.server.to(`user:${userId}`).emit('message.created', message);
    }
  }

  @SubscribeMessage('presence.heartbeat')
  async heartbeat(@ConnectedSocket() socket: Socket) {
    if (socket.data.userId) await this.redis.setPresence(socket.data.userId);
  }

  @SubscribeMessage('message.send')
  async message(
    @ConnectedSocket() socket: Socket,
    @MessageBody()
    body: { conversationId?: string; body?: string; replyToId?: string },
  ) {
    if (!socket.data.userId || !body?.conversationId) return;
    const message = await this.collaboration.sendMessage(
      socket.data.userId,
      body.conversationId,
      body.body ?? '',
      body.replyToId,
    );
    const members = await this.prisma.conversationMember.findMany({
      where: { conversationId: body.conversationId },
      select: { userId: true },
    });
    await this.broadcastMessage(message);
    void this.push.notifyUsers(
      members.map(({ userId }) => userId),
      {
        title: message.sender.person?.fullName ?? 'AMIR Lab member',
        body: message.body,
        url: '/workspace/chat',
      },
    );
    return message;
  }

  @SubscribeMessage('typing')
  async typing(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { conversationId?: string; active?: boolean },
  ) {
    if (!socket.data.userId || !body?.conversationId) return;
    await this.collaboration.assertMember(
      socket.data.userId,
      body.conversationId,
    );
    const members = await this.prisma.conversationMember.findMany({
      where: {
        conversationId: body.conversationId,
        userId: { not: socket.data.userId },
      },
      select: { userId: true },
    });
    for (const { userId } of members)
      this.server
        .to(`user:${userId}`)
        .emit('typing', {
          userId: socket.data.userId,
          active: Boolean(body.active),
        });
  }

  @SubscribeMessage('message.react')
  async reaction(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { messageId?: string; emoji?: string },
  ) {
    if (!socket.data.userId || !body?.messageId || !body.emoji) return;
    const result = await this.collaboration.toggleReaction(
      socket.data.userId,
      body.messageId,
      body.emoji,
    );
    const members = await this.prisma.conversationMember.findMany({
      where: { conversationId: result.conversationId },
      select: { userId: true },
    });
    for (const { userId } of members)
      this.server.to(`user:${userId}`).emit('message.reaction.changed', result);
    return result;
  }

  private async userForCookie(cookieHeader?: string) {
    const cookieName = this.config.get('sessionCookieName', { infer: true });
    const rawToken = cookieHeader
      ?.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${cookieName}=`))
      ?.slice(cookieName.length + 1);
    if (!rawToken) return null;
    const session = await this.prisma.session.findUnique({
      where: {
        tokenHash: createHash('sha256')
          .update(decodeURIComponent(rawToken))
          .digest('hex'),
      },
      select: {
        user: { select: { id: true, status: true } },
        expiresAt: true,
        revokedAt: true,
      },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.user.status !== AccountStatus.ACTIVE
    )
      return null;
    return session.user;
  }
}
