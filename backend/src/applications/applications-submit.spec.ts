import { BadRequestException } from '@nestjs/common';
import { PDFParse, TextResult } from 'pdf-parse';
import { ApplicationStatus, AssetAccess } from '../../generated/prisma/client';
import { AssetsService } from '../assets/assets.service';
import { PrismaService } from '../database/prisma.service';
import { DocumentsService } from '../documents/documents.service';
import { JobsService } from '../jobs/jobs.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { resolveService } from '../../test/resolve-service';
import { ApplicationsService } from './applications.service';
import { AppointmentLettersService } from './appointment-letters.service';
import { SettingsService } from '../settings/settings.service';

const cv = {
  buffer: Buffer.from('%PDF-test'),
  fieldname: 'cv',
  mimetype: 'application/pdf',
  originalname: 'resume.pdf',
  size: 9,
} as Express.Multer.File;

async function serviceWith(assets: object, prisma: object) {
  return resolveService(ApplicationsService, [
    { provide: AssetsService, useValue: assets },
    { provide: AppointmentLettersService, useValue: {} },
    { provide: DocumentsService, useValue: {} },
    {
      provide: JobsService,
      useValue: { enqueue: jest.fn(), register: jest.fn() },
    },
    { provide: MailService, useValue: { queue: jest.fn() } },
    { provide: NotificationsService, useValue: { notifyReviewers: jest.fn() } },
    { provide: PrismaService, useValue: prisma },
    { provide: SettingsService, useValue: {} },
  ]);
}

function pdfTextResult(text: string): TextResult {
  return {
    numpages: 1,
    numrender: 1,
    info: {},
    metadata: null,
    version: '1.10.100',
    text,
    pages: [{ num: 1, text }],
  } as unknown as TextResult;
}

describe('ApplicationsService submission parsing', () => {
  afterEach(() => jest.restoreAllMocks());

  it('rejects an image-only PDF before creating an application', async () => {
    jest
      .spyOn(PDFParse.prototype, 'getText')
      .mockResolvedValue(pdfTextResult(''));
    jest.spyOn(PDFParse.prototype, 'destroy').mockResolvedValue(undefined);
    const assets = {
      remove: jest.fn().mockResolvedValue(undefined),
      storeCv: jest.fn().mockResolvedValue({ id: 'cv-asset' }),
    };
    const application = { create: jest.fn() };
    const service = await serviceWith(assets, {
      application,
      position: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ departmentId: null, id: 'position-id' }),
      },
    });

    await expect(
      service.submit(
        {
          consent: true,
          email: 'jane@example.org',
          fullName: 'Jane Researcher',
          positionId: 'position-id',
        },
        cv,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(application.create).not.toHaveBeenCalled();
    expect(assets.remove).toHaveBeenCalledWith('cv-asset');
  });

  it('stores an extracted image privately with a digital PDF', async () => {
    jest.spyOn(PDFParse.prototype, 'getText').mockResolvedValue(
      pdfTextResult(`Jane Researcher jane@example.org
        Education PhD in Computer Science. Experience in research.
        Skills Python and statistics. Projects include clinical NLP.
        ${'Published reproducible research and collaborated across teams. '.repeat(8)}`),
    );
    jest.spyOn(PDFParse.prototype, 'destroy').mockResolvedValue(undefined);
    const assets = {
      remove: jest.fn(),
      storeAvatar: jest.fn().mockResolvedValue({ id: 'profile-image' }),
      storeCv: jest.fn().mockResolvedValue({ id: 'cv-asset' }),
    };
    let applicationCreateInput:
      { data: { profileImageAssetId?: string } } | undefined;
    const application = {
      create: jest.fn((input: NonNullable<typeof applicationCreateInput>) => {
        applicationCreateInput = input;
        return Promise.resolve({
          id: 'application-id',
          status: ApplicationStatus.PARSING,
        });
      }),
    };
    const service = await serviceWith(assets, {
      application,
      position: {
        findFirst: jest.fn().mockResolvedValue({
          departmentId: null,
          id: 'position-id',
          title: 'Research Intern',
        }),
      },
    });
    const profileImage = {
      buffer: Buffer.from('jpeg'),
      mimetype: 'image/jpeg',
      originalname: 'cv-profile.jpg',
    } as Express.Multer.File;

    await service.submit(
      {
        consent: true,
        email: 'jane@example.org',
        fullName: 'Jane Researcher',
        positionId: 'position-id',
      },
      cv,
      profileImage,
    );

    expect(assets.storeAvatar).toHaveBeenCalledWith(
      profileImage,
      undefined,
      AssetAccess.PRIVATE,
    );
    expect(applicationCreateInput?.data.profileImageAssetId).toBe(
      'profile-image',
    );
  });
});
