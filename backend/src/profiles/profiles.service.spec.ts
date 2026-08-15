import {
  PlatformRole,
  ProfileReviewStatus,
} from '../../generated/prisma/client';
import { ProfilesService } from './profiles.service';

describe('ProfilesService review', () => {
  it('preserves the published avatar when a text-only edit is approved', async () => {
    const assets = { remove: jest.fn() };
    const notifications = { create: jest.fn().mockResolvedValue(undefined) };
    let personUpdateInput: { data: { avatarId?: string | null } } | undefined;
    const transaction = {
      auditRecord: { create: jest.fn().mockResolvedValue({}) },
      person: {
        update: jest.fn(
          (input: NonNullable<typeof personUpdateInput>): Promise<object> => {
            personUpdateInput = input;
            return Promise.resolve({});
          },
        ),
      },
      profileEditRequest: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      $transaction: jest.fn(
        (callback: (client: typeof transaction) => Promise<void>) =>
          callback(transaction),
      ),
      profileEditRequest: {
        findUnique: jest.fn().mockResolvedValue({
          avatarAssetId: null,
          id: 'request-id',
          payload: {
            biography: 'Updated biography',
            contactAddress: null,
            expertise: [],
            fullName: 'Jane Researcher',
            headline: null,
            links: [],
            phone: null,
            publicEmail: null,
            removeAvatar: false,
            sections: [],
          },
          person: {
            avatarId: 'existing-avatar',
            userId: 'member-id',
          },
          personId: 'person-id',
          revision: 2,
          status: ProfileReviewStatus.NEEDS_REVIEW,
        }),
      },
    };
    const settings = {
      verification: jest.fn().mockResolvedValue({ profileEdit: 'MANUAL' }),
    };
    const service = new ProfilesService(
      assets as never,
      notifications as never,
      prisma as never,
      settings as never,
    );

    await service.review(
      'request-id',
      {
        note: 'do not store this',
        revision: 2,
        status: ProfileReviewStatus.APPROVED,
      },
      {
        email: 'admin@example.org',
        id: 'admin-id',
        person: null,
        role: PlatformRole.ADMIN,
        status: 'ACTIVE',
      },
    );

    expect(personUpdateInput?.data.avatarId).toBe('existing-avatar');
    expect(transaction.profileEditRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ note: null }),
      }),
    );
    expect(notifications.create).toHaveBeenCalledWith(
      'member-id',
      expect.objectContaining({
        body: 'Your latest profile changes were reviewed.',
      }),
    );
    expect(assets.remove).not.toHaveBeenCalled();
  });

  it('requires a reviewer note when rejecting profile changes', async () => {
    const service = new ProfilesService(
      { remove: jest.fn() } as never,
      { create: jest.fn() } as never,
      {
        profileEditRequest: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'request-id',
            payload: {
              biography: null,
              contactAddress: null,
              expertise: [],
              fullName: 'Jane Researcher',
              headline: null,
              links: [],
              phone: null,
              publicEmail: null,
              removeAvatar: false,
              sections: [],
            },
            person: { avatarId: null, userId: 'member-id' },
            revision: 2,
            status: ProfileReviewStatus.NEEDS_REVIEW,
          }),
        },
      } as never,
      { verification: jest.fn() } as never,
    );

    await expect(
      service.review(
        'request-id',
        { revision: 2, status: ProfileReviewStatus.REJECTED },
        {
          email: 'admin@example.org',
          id: 'admin-id',
          person: null,
          role: PlatformRole.ADMIN,
          status: 'ACTIVE',
        },
      ),
    ).rejects.toThrow('A reviewer note is required');
  });
});
