import { BadRequestException } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';
import { ApplicationStatus, AssetAccess } from '../../generated/prisma/client';
import { ApplicationsService } from './applications.service';

const cv = {
  buffer: Buffer.from('%PDF-test'),
  fieldname: 'cv',
  mimetype: 'application/pdf',
  originalname: 'resume.pdf',
  size: 9,
} as Express.Multer.File;

function serviceWith(assets: object, prisma: object) {
  return new ApplicationsService(
    assets as never,
    { enqueue: jest.fn() } as never,
    {} as never,
    { notifyReviewers: jest.fn() } as never,
    prisma as never,
  );
}

describe('ApplicationsService submission parsing', () => {
  afterEach(() => jest.restoreAllMocks());

  it('rejects an image-only PDF before creating an application', async () => {
    jest.spyOn(PDFParse.prototype, 'getText').mockResolvedValue({
      text: '',
      total: 1,
    } as never);
    jest.spyOn(PDFParse.prototype, 'destroy').mockResolvedValue(undefined);
    const assets = {
      remove: jest.fn().mockResolvedValue(undefined),
      storeCv: jest.fn().mockResolvedValue({ id: 'cv-asset' }),
    };
    const application = { create: jest.fn() };
    const service = serviceWith(assets, {
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
    jest.spyOn(PDFParse.prototype, 'getText').mockResolvedValue({
      text: `Jane Researcher jane@example.org
        Education PhD in Computer Science. Experience in research.
        Skills Python and statistics. Projects include clinical NLP.
        ${'Published reproducible research and collaborated across teams. '.repeat(8)}`,
      total: 1,
    } as never);
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
    const service = serviceWith(assets, {
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
