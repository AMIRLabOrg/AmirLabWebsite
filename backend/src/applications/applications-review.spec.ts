import {
  AccountStatus,
  ApplicationStatus,
  AssetAccess,
  PlatformRole,
} from '../../generated/prisma/client';
import { ApplicationsService } from './applications.service';

describe('ApplicationsService review notes', () => {
  it('does not store a reason when accepting an application', async () => {
    let applicationUpdateInput:
      | {
          data: {
            decisionReason?: string | null;
            events: { create: { note?: string | null } };
          };
        }
      | undefined;
    let personCreateInput: { data: { avatarId?: string | null } } | undefined;
    const transaction = {
      application: {
        update: jest.fn((input: NonNullable<typeof applicationUpdateInput>) => {
          applicationUpdateInput = input;
          return Promise.resolve({});
        }),
      },
      asset: { update: jest.fn().mockResolvedValue({}) },
      auditRecord: { create: jest.fn().mockResolvedValue({}) },
      person: {
        create: jest.fn((input: NonNullable<typeof personCreateInput>) => {
          personCreateInput = input;
          return Promise.resolve({});
        }),
      },
      user: {
        upsert: jest.fn().mockResolvedValue({
          id: 'user-id',
          person: null,
          status: AccountStatus.PENDING_SETUP,
        }),
      },
    };
    const service = new ApplicationsService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {
        $transaction: jest.fn(
          (callback: (client: typeof transaction) => Promise<void>) =>
            callback(transaction),
        ),
        application: {
          findUnique: jest.fn().mockResolvedValue({
            email: 'jane@example.org',
            fullName: 'Jane Researcher',
            id: 'application-id',
            position: { targetRank: null, title: 'Research Intern' },
            profileImageAssetId: 'profile-image-id',
            status: ApplicationStatus.NEEDS_REVIEW,
          }),
        },
      } as never,
    );

    await service.review(
      'application-id',
      { reason: 'do not store this', status: ApplicationStatus.ACCEPTED },
      {
        email: 'admin@example.org',
        id: 'admin-id',
        person: null,
        role: PlatformRole.ADMIN,
        status: 'ACTIVE',
      },
    );

    expect(applicationUpdateInput?.data.decisionReason).toBeNull();
    expect(applicationUpdateInput?.data.events.create.note).toBeNull();
    expect(personCreateInput?.data.avatarId).toBe('profile-image-id');
    expect(transaction.asset.update).toHaveBeenCalledWith({
      where: { id: 'profile-image-id' },
      data: { access: AssetAccess.PUBLIC, createdById: 'user-id' },
    });
  });
});
