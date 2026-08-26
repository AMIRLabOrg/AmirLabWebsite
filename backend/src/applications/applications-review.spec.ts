import {
  AccountStatus,
  ApplicationStatus,
  AssetAccess,
  PlatformRole,
} from '../../generated/prisma/client';
import { AssetsService } from '../assets/assets.service';
import { PrismaService } from '../database/prisma.service';
import { JobsService } from '../jobs/jobs.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { resolveService } from '../../test/resolve-service';
import { ApplicationsService } from './applications.service';
import { AppointmentLettersService } from './appointment-letters.service';
import {
  DEFAULT_APPOINTMENT_LETTER_TEMPLATE,
  SettingsService,
} from '../settings/settings.service';

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
    const service = await resolveService(ApplicationsService, [
      { provide: AssetsService, useValue: {} },
      { provide: AppointmentLettersService, useValue: {} },
      { provide: JobsService, useValue: { register: jest.fn() } },
      { provide: MailService, useValue: { queue: jest.fn() } },
      { provide: NotificationsService, useValue: {} },
      {
        provide: SettingsService,
        useValue: {
          appointmentLetter: jest
            .fn()
            .mockResolvedValue(DEFAULT_APPOINTMENT_LETTER_TEMPLATE),
          notificationPolicy: jest
            .fn()
            .mockResolvedValue({ applicationAccepted: false }),
        },
      },
      {
        provide: PrismaService,
        useValue: {
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
        },
      },
    ]);

    await service.review(
      'application-id',
      { reason: 'do not store this', status: ApplicationStatus.ACCEPTED },
      {
        email: 'admin@example.org',
        id: 'admin-id',
        person: null,
        role: PlatformRole.ADMIN,
        status: AccountStatus.ACTIVE,
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
