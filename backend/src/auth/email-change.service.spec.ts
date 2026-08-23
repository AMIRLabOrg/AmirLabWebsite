/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import type { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import type { Environment } from '../config/environment';
import type { PrismaService } from '../database/prisma.service';
import type { MailService } from '../mail/mail.service';
import { EmailChangeService } from './email-change.service';
import { hashPassword } from './password';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const ACTOR_ID = '22222222-2222-4222-8222-222222222222';

function setup() {
  const prisma = {
    $transaction: jest.fn(),
    auditRecord: { create: jest.fn() },
    emailChangeRequest: {
      deleteMany: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      upsert: jest.fn(),
    },
    emailChangeRevert: {
      deleteMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    session: { updateMany: jest.fn() },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
  prisma.$transaction.mockImplementation(
    async (run: (transaction: typeof prisma) => Promise<unknown>) =>
      run(prisma),
  );
  const config = {
    get: jest.fn().mockReturnValue(['https://amirl.example']),
  };
  const mail = { queue: jest.fn(), sendNow: jest.fn() };
  const service = new EmailChangeService(
    config as unknown as ConfigService<Environment, true>,
    mail as unknown as MailService,
    prisma as unknown as PrismaService,
  );
  return { mail, prisma, service };
}

describe('EmailChangeService', () => {
  it('replaces the pending request and sends the OTP only by email', async () => {
    const { mail, prisma, service } = setup();
    prisma.user.findUnique
      .mockResolvedValueOnce({ email: 'old@example.com' })
      .mockResolvedValueOnce(null);

    const result = await service.requestForAdmin(
      USER_ID,
      ' NEW@Example.com ',
      ACTOR_ID,
    );

    expect(result.newEmail).toBe('new@example.com');
    expect(prisma.emailChangeRequest.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER_ID },
        update: expect.objectContaining({
          failedAttempts: 0,
          newEmail: 'new@example.com',
        }),
      }),
    );
    expect(mail.sendNow).toHaveBeenCalledTimes(2);
    expect(mail.sendNow.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ to: 'new@example.com' }),
    );
    expect(mail.sendNow.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({ to: 'old@example.com' }),
    );
  });

  it('rejects and removes an expired OTP on demand', async () => {
    const { prisma, service } = setup();
    prisma.emailChangeRequest.findUnique.mockResolvedValue({
      id: 'request-id',
      otpExpiresAt: new Date(Date.now() - 1),
    });

    await expect(service.verify(USER_ID, '123456', USER_ID)).rejects.toThrow(
      'invalid or has expired',
    );
    expect(prisma.emailChangeRequest.deleteMany).toHaveBeenCalledWith({
      where: {
        id: 'request-id',
        otpExpiresAt: { lte: expect.any(Date) },
      },
    });
  });

  it('changes the email atomically and revokes active sessions', async () => {
    const { prisma, service } = setup();
    const otpHash = await hashPassword('123456');
    prisma.emailChangeRequest.findUnique.mockResolvedValue({
      id: 'request-id',
      userId: USER_ID,
      oldEmail: 'old@example.com',
      newEmail: 'new@example.com',
      otpHash,
      otpExpiresAt: new Date(Date.now() + 60_000),
      failedAttempts: 0,
      revertTokenHash: 'revert-hash',
      revertExpiresAt: new Date(Date.now() + 86_400_000),
    });
    prisma.emailChangeRequest.deleteMany.mockResolvedValue({ count: 1 });
    prisma.user.findUnique.mockResolvedValue({ email: 'old@example.com' });

    await expect(service.verify(USER_ID, '123456', ACTOR_ID)).resolves.toEqual({
      changed: true,
      currentEmail: 'new@example.com',
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { email: 'new@example.com' },
    });
    expect(prisma.session.updateMany).toHaveBeenCalledWith({
      where: { userId: USER_ID, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(prisma.emailChangeRevert.upsert).toHaveBeenCalled();
  });

  it('uses the old-email link to cancel a pending request', async () => {
    const { prisma, service } = setup();
    const token = 'a'.repeat(43);
    prisma.emailChangeRequest.findUnique.mockResolvedValue({
      id: 'request-id',
      userId: USER_ID,
      oldEmail: 'old@example.com',
      newEmail: 'new@example.com',
      revertExpiresAt: new Date(Date.now() + 60_000),
    });
    prisma.emailChangeRequest.deleteMany.mockResolvedValue({ count: 1 });

    await expect(service.revert(token)).resolves.toEqual({ reverted: true });
    expect(prisma.emailChangeRequest.findUnique).toHaveBeenCalledWith({
      where: {
        revertTokenHash: createHash('sha256').update(token).digest('hex'),
      },
    });
    expect(prisma.emailChangeRevert.findUnique).not.toHaveBeenCalled();
  });
});
