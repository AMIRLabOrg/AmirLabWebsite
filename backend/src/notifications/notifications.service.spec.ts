jest.mock('../../generated/prisma/client', () => ({
  ApplicationStatus: { NEEDS_REVIEW: 'NEEDS_REVIEW' },
  NotificationType: {},
  PlatformRole: { ADMIN: 'ADMIN', MEMBER: 'MEMBER', MODERATOR: 'MODERATOR' },
  PrismaClient: class PrismaClient {},
  ProfileReviewStatus: { NEEDS_REVIEW: 'NEEDS_REVIEW' },
  ReviewStatus: {
    CHANGES_REQUESTED: 'CHANGES_REQUESTED',
    NEEDS_REVIEW: 'NEEDS_REVIEW',
  },
}));

import { NotificationsService } from './notifications.service';

describe('NotificationsService read state', () => {
  const prisma = {
    notification: {
      updateMany: jest.fn(),
    },
  };

  beforeEach(() => {
    prisma.notification.updateMany.mockReset();
  });

  it('marks only recipient-owned notifications unread', async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 1 });
    const service = new NotificationsService(prisma as never);

    await expect(service.markUnread('recipient-id', 'notification-id')).resolves.toEqual({
      updated: true,
    });
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      data: { readAt: null },
      where: { id: 'notification-id', recipientId: 'recipient-id' },
    });
  });

  it('reports no update when the notification does not belong to the recipient', async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 0 });
    const service = new NotificationsService(prisma as never);

    await expect(service.markUnread('recipient-id', 'other-id')).resolves.toEqual({
      updated: false,
    });
  });
});
