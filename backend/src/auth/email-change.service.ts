import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../../generated/prisma/client';
import { randomBytes, randomInt, createHash } from 'node:crypto';
import type { Environment } from '../config/environment';
import { PrismaService } from '../database/prisma.service';
import { MailService } from '../mail/mail.service';
import { hashPassword, verifyPassword } from './password';

const OTP_MINUTES = 10;
const REVERT_DAYS = 7;
const MAX_OTP_ATTEMPTS = 5;

@Injectable()
export class EmailChangeService {
  private readonly logger = new Logger(EmailChangeService.name);

  constructor(
    private readonly config: ConfigService<Environment, true>,
    private readonly mail: MailService,
    private readonly prisma: PrismaService,
  ) {}

  async status(userId: string) {
    const [user, pending] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      }),
      this.prisma.emailChangeRequest.findUnique({
        where: { userId },
        select: { newEmail: true, otpExpiresAt: true },
      }),
    ]);
    if (!user) throw new NotFoundException('Account not found');

    if (pending && pending.otpExpiresAt <= new Date()) {
      await this.prisma.emailChangeRequest.deleteMany({
        where: { userId, otpExpiresAt: { lte: new Date() } },
      });
      return { currentEmail: user.email, pending: null };
    }
    return { currentEmail: user.email, pending };
  }

  async requestForUser(
    userId: string,
    newEmail: string,
    currentPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, passwordHash: true },
    });
    if (
      !user?.passwordHash ||
      !(await verifyPassword(currentPassword, user.passwordHash))
    ) {
      throw new UnauthorizedException('Incorrect current password');
    }
    return this.request(userId, newEmail, userId);
  }

  requestForAdmin(userId: string, newEmail: string, actorId: string) {
    return this.request(userId, newEmail, actorId);
  }

  async verify(userId: string, otp: string, actorId: string) {
    const pending = await this.prisma.emailChangeRequest.findUnique({
      where: { userId },
    });
    const now = new Date();
    if (!pending || pending.otpExpiresAt <= now) {
      if (pending) {
        await this.prisma.emailChangeRequest.deleteMany({
          where: { id: pending.id, otpExpiresAt: { lte: now } },
        });
      }
      throw invalidOtp();
    }
    if (
      pending.failedAttempts >= MAX_OTP_ATTEMPTS ||
      !(await verifyPassword(otp, pending.otpHash))
    ) {
      const failedAttempts = pending.failedAttempts + 1;
      if (failedAttempts >= MAX_OTP_ATTEMPTS) {
        await this.prisma.emailChangeRequest.deleteMany({
          where: { id: pending.id, otpHash: pending.otpHash },
        });
      } else {
        await this.prisma.emailChangeRequest.updateMany({
          where: { id: pending.id, otpHash: pending.otpHash },
          data: { failedAttempts: { increment: 1 } },
        });
      }
      throw invalidOtp();
    }

    try {
      await this.prisma.$transaction(async (transaction) => {
        const claimed = await transaction.emailChangeRequest.deleteMany({
          where: {
            id: pending.id,
            otpHash: pending.otpHash,
            otpExpiresAt: { gt: now },
            failedAttempts: { lt: MAX_OTP_ATTEMPTS },
          },
        });
        if (claimed.count !== 1) throw invalidOtp();

        const user = await transaction.user.findUnique({
          where: { id: userId },
          select: { email: true },
        });
        if (!user || user.email !== pending.oldEmail) {
          throw new ConflictException('The account email has already changed');
        }
        await transaction.user.update({
          where: { id: userId },
          data: { email: pending.newEmail },
        });
        await transaction.emailChangeRevert.upsert({
          where: { userId },
          create: {
            oldEmail: pending.oldEmail,
            newEmail: pending.newEmail,
            tokenHash: pending.revertTokenHash,
            expiresAt: pending.revertExpiresAt,
            userId,
          },
          update: {
            oldEmail: pending.oldEmail,
            newEmail: pending.newEmail,
            tokenHash: pending.revertTokenHash,
            expiresAt: pending.revertExpiresAt,
            createdAt: now,
          },
        });
        await transaction.session.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: now },
        });
        await transaction.auditRecord.create({
          data: {
            action: 'auth.email-change',
            actorId,
            entityId: userId,
            entityType: 'User',
            details: {
              email: { from: pending.oldEmail, to: pending.newEmail },
              sessionsRevoked: true,
            },
          },
        });
      });
    } catch (error) {
      if (isUniqueConflict(error)) {
        throw new ConflictException('An account already exists for this email');
      }
      throw error;
    }
    return { changed: true, currentEmail: pending.newEmail };
  }

  async revert(rawToken: string) {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const pending = await this.prisma.emailChangeRequest.findUnique({
      where: { revertTokenHash: tokenHash },
    });
    const now = new Date();
    if (pending) {
      if (pending.revertExpiresAt <= now) {
        await this.prisma.emailChangeRequest.deleteMany({
          where: { id: pending.id, revertExpiresAt: { lte: now } },
        });
        throw invalidRevert();
      }
      const cancelled = await this.prisma.emailChangeRequest.deleteMany({
        where: {
          id: pending.id,
          revertTokenHash: tokenHash,
          revertExpiresAt: { gt: now },
        },
      });
      if (cancelled.count !== 1) throw invalidRevert();
      await this.prisma.auditRecord.create({
        data: {
          action: 'auth.email-change-cancelled',
          actorId: pending.userId,
          entityId: pending.userId,
          entityType: 'User',
          details: {
            email: { from: pending.oldEmail, to: pending.newEmail },
          },
        },
      });
      return { reverted: true };
    }

    const record = await this.prisma.emailChangeRevert.findUnique({
      where: { tokenHash },
    });
    if (!record || record.expiresAt <= now) {
      if (record) {
        await this.prisma.emailChangeRevert.deleteMany({
          where: { id: record.id, expiresAt: { lte: now } },
        });
      }
      throw invalidRevert();
    }

    try {
      await this.prisma.$transaction(async (transaction) => {
        const claimed = await transaction.emailChangeRevert.deleteMany({
          where: { id: record.id, tokenHash, expiresAt: { gt: now } },
        });
        if (claimed.count !== 1) throw invalidRevert();
        const user = await transaction.user.findUnique({
          where: { id: record.userId },
          select: { email: true },
        });
        if (!user || user.email !== record.newEmail) throw invalidRevert();
        await transaction.user.update({
          where: { id: record.userId },
          data: { email: record.oldEmail },
        });
        await transaction.session.updateMany({
          where: { userId: record.userId, revokedAt: null },
          data: { revokedAt: now },
        });
        await transaction.auditRecord.create({
          data: {
            action: 'auth.email-change-reverted',
            actorId: record.userId,
            entityId: record.userId,
            entityType: 'User',
            details: {
              email: { from: record.newEmail, to: record.oldEmail },
              sessionsRevoked: true,
            },
          },
        });
      });
    } catch (error) {
      if (isUniqueConflict(error)) {
        throw new ConflictException(
          'The previous email now belongs to another account',
        );
      }
      throw error;
    }

    await this.mail.queue({
      to: record.newEmail,
      subject: 'Your AMIR Lab email change was reverted',
      text: `The login email for your AMIR Lab account was restored to ${record.oldEmail}. All sessions were signed out. Contact an administrator if you did not perform this action.`,
    });
    return { reverted: true };
  }

  private async request(userId: string, rawNewEmail: string, actorId: string) {
    const newEmail = rawNewEmail.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user) throw new NotFoundException('Account not found');
    if (!user.email) {
      throw new ConflictException('The account does not have a current email');
    }
    if (user.email === newEmail) {
      throw new ConflictException('Enter a different email address');
    }
    const owner = await this.prisma.user.findUnique({
      where: { email: newEmail },
      select: { id: true },
    });
    if (owner) {
      throw new ConflictException('An account already exists for this email');
    }

    const otp = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const otpHash = await hashPassword(otp);
    const revertToken = randomBytes(32).toString('base64url');
    const revertTokenHash = createHash('sha256')
      .update(revertToken)
      .digest('hex');
    const now = new Date();
    const otpExpiresAt = new Date(now.getTime() + OTP_MINUTES * 60_000);
    const revertExpiresAt = new Date(now.getTime() + REVERT_DAYS * 86_400_000);
    try {
      await this.prisma.emailChangeRequest.upsert({
        where: { userId },
        create: {
          oldEmail: user.email,
          newEmail,
          otpHash,
          otpExpiresAt,
          revertTokenHash,
          revertExpiresAt,
          userId,
        },
        update: {
          oldEmail: user.email,
          newEmail,
          otpHash,
          otpExpiresAt,
          failedAttempts: 0,
          revertTokenHash,
          revertExpiresAt,
          createdAt: now,
        },
      });
    } catch (error) {
      if (isUniqueConflict(error)) {
        throw new ConflictException(
          'This email already has a pending account change',
        );
      }
      throw error;
    }

    const frontendUrl = this.config.get('frontendOrigins', { infer: true })[0];
    const revertUrl = `${frontendUrl}/revert-email#token=${encodeURIComponent(revertToken)}`;
    try {
      await this.mail.sendNow({
        to: newEmail,
        subject: 'Verify your new AMIR Lab email',
        text: `Use this one-time code to verify your new AMIR Lab login email: ${otp}\n\nThe code expires in ${OTP_MINUTES} minutes. If you did not expect this message, do not share the code.`,
      });
      await this.mail.sendNow({
        to: user.email,
        subject: 'AMIR Lab email change requested',
        text: `A change of your AMIR Lab login email from ${user.email} to ${newEmail} was requested. If this was not expected, cancel or revert it within ${REVERT_DAYS} days:\n\n${revertUrl}\n\nThe link opens a confirmation page and does not change the account merely by being visited.`,
      });
    } catch (error) {
      await this.prisma.emailChangeRequest.deleteMany({
        where: { userId, otpHash },
      });
      this.logger.error(
        `Email change delivery failed for user ${userId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new ConflictException(
        'Verification email could not be delivered. Try again later.',
      );
    }

    await this.prisma.auditRecord.create({
      data: {
        action: 'auth.email-change-requested',
        actorId,
        entityId: userId,
        entityType: 'User',
        details: { email: { from: user.email, to: newEmail } },
      },
    });
    return { newEmail, expiresAt: otpExpiresAt };
  }
}

function invalidOtp(): UnauthorizedException {
  return new UnauthorizedException(
    'The verification code is invalid or has expired',
  );
}

function invalidRevert(): UnauthorizedException {
  return new UnauthorizedException({
    code: 'EMAIL_REVERT_INVALID',
    publicMessage: 'This revert link is invalid or has expired.',
  });
}

function isUniqueConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}
