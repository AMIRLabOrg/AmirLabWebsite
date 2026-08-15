import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import type { Request } from 'express';
import { AccountStatus } from '../../generated/prisma/client';
import type { Environment } from '../config/environment';
import { PrismaService } from '../database/prisma.service';
import { MailService } from '../mail/mail.service';
import { csrfTokenForSession } from './csrf';
import { hashPassword, verifyPassword } from './password';

interface SessionResult {
  csrfToken: string;
  sessionToken: string;
  userId: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly config: ConfigService<Environment, true>,
    private readonly mail: MailService,
    private readonly prisma: PrismaService,
  ) {}

  async login(
    email: string,
    password: string,
    request: Pick<Request, 'ip' | 'headers'>,
  ): Promise<SessionResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true, passwordHash: true, status: true },
    });
    if (
      !user?.passwordHash ||
      user.status !== AccountStatus.ACTIVE ||
      !(await verifyPassword(password, user.passwordHash))
    ) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const session = this.prepareSession(user.id, request);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      }),
      this.prisma.session.create({ data: session.data }),
    ]);
    return {
      csrfToken: session.csrfToken,
      sessionToken: session.sessionToken,
      userId: user.id,
    };
  }

  async issueAccountSetup(userId: string): Promise<Date> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, status: true },
    });
    if (!user) throw new NotFoundException('Account not found');
    if (!user.email) {
      throw new BadRequestException(
        'Add an account email before sending access',
      );
    }
    if (user.status !== AccountStatus.PENDING_SETUP) {
      throw new ConflictException(
        'Only accounts pending setup need setup access',
      );
    }

    const token = randomBytes(32).toString('base64url');
    const now = new Date();
    const setupToken = await this.prisma.$transaction(async (transaction) => {
      await transaction.accountSetupToken.updateMany({
        where: { userId, usedAt: null },
        data: { usedAt: now },
      });
      return transaction.accountSetupToken.create({
        data: {
          expiresAt: new Date(now.getTime() + 24 * 60 * 60_000),
          tokenHash: createHash('sha256').update(token).digest('hex'),
          userId,
        },
      });
    });
    const frontendUrl = this.config.get('frontendOrigins', { infer: true })[0];
    const link = `${frontendUrl}/auth/setup?token=${encodeURIComponent(token)}`;
    await this.mail.queue(
      {
        to: user.email,
        subject: 'Welcome to AMIR Lab',
        text: `Your AMIR Lab account is ready. Create your password using this one-time link within 24 hours:\n\n${link}\n\nAfter setup, log in with your email and password.`,
      },
      `account-setup:${setupToken.id}`,
    );
    const queuedAt = new Date();
    await this.prisma.user.update({
      where: { id: userId },
      data: { setupEmailQueuedAt: queuedAt },
    });
    return queuedAt;
  }

  async setupAccount(
    rawToken: string,
    password: string,
    request: Pick<Request, 'ip' | 'headers'>,
  ): Promise<SessionResult> {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const setupToken = await this.prisma.accountSetupToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (
      !setupToken ||
      setupToken.usedAt ||
      setupToken.expiresAt <= new Date() ||
      setupToken.user.status !== AccountStatus.PENDING_SETUP
    ) {
      throw new UnauthorizedException(
        'Account setup link is invalid or expired',
      );
    }

    const passwordHash = await hashPassword(password);
    const session = this.prepareSession(setupToken.userId, request);
    await this.prisma.$transaction(async (transaction) => {
      const claimed = await transaction.accountSetupToken.updateMany({
        where: {
          id: setupToken.id,
          expiresAt: { gt: new Date() },
          usedAt: null,
        },
        data: { usedAt: new Date() },
      });
      if (claimed.count !== 1) {
        throw new UnauthorizedException(
          'Account setup link is invalid or expired',
        );
      }
      const now = new Date();
      await transaction.user.update({
        where: { id: setupToken.userId },
        data: {
          activatedAt: now,
          lastLoginAt: now,
          passwordHash,
          passwordSetAt: now,
          status: AccountStatus.ACTIVE,
        },
      });
      await transaction.session.create({ data: session.data });
    });

    return {
      csrfToken: session.csrfToken,
      sessionToken: session.sessionToken,
      userId: setupToken.userId,
    };
  }

  async revoke(rawToken: string | undefined): Promise<void> {
    if (!rawToken) {
      return;
    }
    await this.prisma.session.updateMany({
      where: {
        revokedAt: null,
        tokenHash: createHash('sha256').update(rawToken).digest('hex'),
      },
      data: { revokedAt: new Date() },
    });
  }

  csrfToken(rawSessionToken: string | undefined): string {
    if (!rawSessionToken) {
      throw new UnauthorizedException('Authentication required');
    }
    return csrfTokenForSession(rawSessionToken);
  }

  private prepareSession(
    userId: string,
    request: Pick<Request, 'ip' | 'headers'>,
  ) {
    const sessionToken = randomBytes(32).toString('base64url');
    const csrfToken = csrfTokenForSession(sessionToken);
    return {
      csrfToken,
      sessionToken,
      data: {
        csrfTokenHash: createHash('sha256').update(csrfToken).digest('hex'),
        expiresAt: new Date(
          Date.now() +
            this.config.get('sessionDays', { infer: true }) * 86_400_000,
        ),
        ipAddress: request.ip,
        tokenHash: createHash('sha256').update(sessionToken).digest('hex'),
        userAgent: request.headers['user-agent'],
        userId,
      },
    };
  }
}
