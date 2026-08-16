import { Test } from '@nestjs/testing';
import {
  AccountStatus,
  PlatformRole,
  ProfileReviewStatus,
} from '../../generated/prisma/client';
import { AssetsService } from '../assets/assets.service';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ResearchProfileSyncService } from '../research/research-profile-sync.service';
import { SettingsService } from '../settings/settings.service';
import { ProfilesService } from './profiles.service';

async function createProfilesService({
  assets = {},
  notifications = {},
  prisma = {},
  profileSync = {},
  settings = {},
}: {
  assets?: object;
  notifications?: object;
  prisma?: object;
  profileSync?: object;
  settings?: object;
} = {}) {
  const module = await Test.createTestingModule({
    providers: [
      ProfilesService,
      { provide: AssetsService, useValue: assets },
      { provide: NotificationsService, useValue: notifications },
      { provide: PrismaService, useValue: prisma },
      { provide: ResearchProfileSyncService, useValue: profileSync },
      { provide: SettingsService, useValue: settings },
    ],
  }).compile();
  return module.get(ProfilesService);
}

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
    const service = await createProfilesService({
      assets,
      notifications,
      prisma,
      profileSync: {
        normalizePublishedOutputsForPeople: jest
          .fn()
          .mockResolvedValue(undefined),
      },
      settings,
    });

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
        status: AccountStatus.ACTIVE,
      },
    );

    expect(personUpdateInput?.data.avatarId).toBe('existing-avatar');
    expect(transaction.profileEditRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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
    const service = await createProfilesService({
      assets: { remove: jest.fn() },
      notifications: { create: jest.fn() },
      prisma: {
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
      },
      profileSync: { normalizePublishedOutputsForPeople: jest.fn() },
      settings: { verification: jest.fn() },
    });

    await expect(
      service.review(
        'request-id',
        { revision: 2, status: ProfileReviewStatus.REJECTED },
        {
          email: 'admin@example.org',
          id: 'admin-id',
          person: null,
          role: PlatformRole.ADMIN,
          status: AccountStatus.ACTIVE,
        },
      ),
    ).rejects.toThrow('A reviewer note is required');
  });
});
