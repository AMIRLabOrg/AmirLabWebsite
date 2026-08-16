import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
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
  private readonly logger = new Logger(AuthService.name);

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
    await this.prisma.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
      await transaction.session.create({ data: session.data });
    });
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

  async requestPasswordReset(email: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, status: true },
    });

    // Deliberately return the same public result for unknown/inactive accounts.
    if (!user?.email || user.status !== AccountStatus.ACTIVE) return;

    const requestedAt = new Date();
    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(
      requestedAt.getTime() +
        this.config.get('passwordResetMinutes', { infer: true }) * 60_000,
    );
    await this.prisma.passwordResetToken.upsert({
      where: { userId: user.id },
      create: { createdAt: requestedAt, expiresAt, tokenHash, userId: user.id },
      update: { createdAt: requestedAt, expiresAt, tokenHash },
    });

    const frontendUrl = this.config.get('frontendOrigins', { infer: true })[0];
    const link = `${frontendUrl}/reset-password#token=${encodeURIComponent(token)}`;
    const minutes = this.config.get('passwordResetMinutes', { infer: true });
    try {
      // Do not queue this message: the queue persists message payloads, while a
      // password-reset secret should exist only in memory and the outgoing email.
      await this.mail.sendNow({
        to: user.email,
        subject: 'Reset your AMIR Lab password',
        text: `A password reset was requested for your AMIR Lab account. Use this one-time link within ${minutes} minutes:\n\n${link}\n\nIf you did not request this change, you can ignore this email.`,
      });
    } catch (error) {
      // Preserve the anti-enumeration response even when SMTP is temporarily down,
      // but do not leave an undelivered reset credential active. A concurrent newer
      // request is preserved because the token hash must still match this request.
      try {
        await this.prisma.passwordResetToken.deleteMany({
          where: { userId: user.id, tokenHash },
        });
      } catch (cleanupError) {
        this.logger.error(
          `Password reset token cleanup failed for user ${user.id}`,
          cleanupError instanceof Error
            ? cleanupError.stack
            : String(cleanupError),
        );
      }
      this.logger.error(
        `Password reset email delivery failed for user ${user.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async resetPassword(rawToken: string, password: string): Promise<void> {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, expiresAt: true, userId: true },
    });
    if (!resetToken) {
      throw invalidPasswordResetLink();
    }

    const now = new Date();
    if (resetToken.expiresAt <= now) {
      await this.prisma.passwordResetToken.deleteMany({
        where: { id: resetToken.id, tokenHash },
      });
      throw invalidPasswordResetLink();
    }

    const passwordHash = await hashPassword(password);
    await this.prisma.$transaction(async (transaction) => {
      const claimed = await transaction.passwordResetToken.deleteMany({
        where: {
          id: resetToken.id,
          tokenHash,
          expiresAt: { gt: now },
        },
      });
      if (claimed.count !== 1) {
        throw invalidPasswordResetLink();
      }
      await transaction.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash, passwordSetAt: now },
      });
      await transaction.session.updateMany({
        where: { userId: resetToken.userId, revokedAt: null },
        data: { revokedAt: now },
      });
      await transaction.auditRecord.create({
        data: {
          action: 'auth.password-reset',
          actorId: resetToken.userId,
          entityId: resetToken.userId,
          entityType: 'User',
          details: { sessionsRevoked: true },
        },
      });
    });
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

function invalidPasswordResetLink(): UnauthorizedException {
  return new UnauthorizedException({
    code: 'PASSWORD_RESET_INVALID',
    publicMessage: 'This reset link is invalid or has expired. Request a new one.',
  });
}
