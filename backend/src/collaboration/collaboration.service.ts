import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConversationKind } from '../../generated/prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from './redis.service';

@Injectable()
export class CollaborationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async presence(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: { members: { some: { userId } } },
      select: { members: { select: { userId: true } } },
    });
    const visibleUserIds = [
      ...new Set(
        conversations.flatMap((conversation) =>
          conversation.members.map((member) => member.userId),
        ),
      ),
    ];
    return this.redis.onlineUsers(visibleUserIds);
  }

  async conversations(userId: string) {
    return this.prisma.conversation.findMany({
      where: { members: { some: { userId } } },
      orderBy: { updatedAt: 'desc' },
      include: {
        project: { select: { researchItem: { select: { title: true } } } },
        members: {
          select: {
            userId: true,
            user: {
              select: {
                id: true,
                person: {
                  select: { fullName: true, avatar: { select: { id: true } } },
                },
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: {
              select: {
                id: true,
                person: {
                  select: { fullName: true, avatar: { select: { id: true } } },
                },
              },
            },
          },
        },
      },
    });
  }

  async ensureLabConversation(user: AuthenticatedUser) {
    const existing = await this.prisma.conversation.findFirst({
      where: { kind: ConversationKind.LAB },
    });
    if (existing) {
      await this.prisma.conversationMember.upsert({
        where: {
          conversationId_userId: {
            conversationId: existing.id,
            userId: user.id,
          },
        },
        create: { conversationId: existing.id, userId: user.id },
        update: {},
      });
      return existing;
    }
    return this.prisma.conversation.create({
      data: {
        kind: ConversationKind.LAB,
        title: 'AMIR Lab',
        members: { create: { userId: user.id } },
      },
    });
  }

  async messages(userId: string, conversationId: string) {
    await this.assertMember(userId, conversationId);
    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: 100,
      include: {
        sender: {
          select: {
            id: true,
            person: {
              select: { fullName: true, avatar: { select: { id: true } } },
            },
          },
        },
      },
    });
  }

  async sendMessage(
    userId: string,
    conversationId: string,
    body: string,
    replyToId?: string,
  ) {
    const text = body.trim();
    if (!text || text.length > 4000)
      throw new BadRequestException('Message must be 1-4000 characters');
    await this.assertMember(userId, conversationId);
    if (replyToId) {
      const reply = await this.prisma.message.findFirst({
        where: { id: replyToId, conversationId },
        select: { id: true },
      });
      if (!reply)
        throw new BadRequestException(
          'Reply target is not in this conversation',
        );
    }
    return this.prisma.$transaction(async (transaction) => {
      const message = await transaction.message.create({
        data: { body: text, conversationId, senderId: userId, replyToId },
        include: {
          sender: {
            select: {
              id: true,
              person: {
                select: { fullName: true, avatar: { select: { id: true } } },
              },
            },
          },
          replyTo: {
            select: {
              id: true,
              body: true,
              sender: {
                select: { id: true, person: { select: { fullName: true } } },
              },
            },
          },
        },
      });
      await transaction.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });
      return message;
    });
  }

  async toggleReaction(userId: string, messageId: string, emoji: string) {
    if (!/^.{1,8}$/u.test(emoji))
      throw new BadRequestException('Reaction is invalid');
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { conversationId: true },
    });
    if (!message) throw new NotFoundException('Message not found');
    await this.assertMember(userId, message.conversationId);
    const key = { messageId_userId_emoji: { messageId, userId, emoji } };
    const existing = await this.prisma.messageReaction.findUnique({
      where: key,
    });
    if (existing) await this.prisma.messageReaction.delete({ where: key });
    else
      await this.prisma.messageReaction.create({
        data: { messageId, userId, emoji },
      });
    return {
      messageId,
      emoji,
      active: !existing,
      conversationId: message.conversationId,
    };
  }

  async markRead(userId: string, conversationId: string) {
    await this.assertMember(userId, conversationId);
    return this.prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: new Date() },
    });
  }

  async assertMember(userId: string, conversationId: string) {
    const member = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!member)
      throw new ForbiddenException('You are not a member of this conversation');
    return member;
  }
}
