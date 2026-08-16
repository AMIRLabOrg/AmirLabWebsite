import { Test } from '@nestjs/testing';
import { PositionStatus } from '../../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RankingsService } from '../rankings/rankings.service';
import { SettingsService } from '../settings/settings.service';
import { ResearchDiscoveryService } from './research-discovery.service';
import { ResearchProfileSyncService } from './research-profile-sync.service';
import { ResearchService } from './research.service';

describe('job post lifecycle', () => {
  async function service(prisma: object) {
    const module = await Test.createTestingModule({
      providers: [
        ResearchService,
        { provide: ResearchDiscoveryService, useValue: {} },
        { provide: NotificationsService, useValue: {} },
        { provide: PrismaService, useValue: prisma },
        { provide: ResearchProfileSyncService, useValue: {} },
        { provide: RankingsService, useValue: {} },
        { provide: SettingsService, useValue: {} },
      ],
    }).compile();
    return module.get(ResearchService);
  }

  it('creates every job post disabled', async () => {
    let createInput: { data: { status: PositionStatus } } | undefined;
    const prisma = {
      position: {
        create: jest.fn((input: { data: { status: PositionStatus } }) => {
          createInput = input;
          return Promise.resolve({});
        }),
      },
    };

    await (await service(prisma)).createPosition({
      engagementDurationLabel: 'Six months',
      requirements: ['Strong research skills'],
      summary: 'Support the lab with reproducible research and documentation.',
      title: 'Research intern',
    });

    expect(createInput?.data.status).toBe(PositionStatus.DRAFT);
  });

  it('enables and disables a job post through explicit lifecycle actions', async () => {
    const update = jest.fn().mockResolvedValue({});
    const prisma = {
      position: {
        findUnique: jest.fn().mockResolvedValue({ id: 'position-id' }),
        update,
      },
    };
    const positions = await service(prisma);

    await positions.enablePosition('position-id');
    await positions.disablePosition('position-id');

    expect(update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ data: { status: PositionStatus.OPEN } }),
    );
    expect(update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ data: { status: PositionStatus.DRAFT } }),
    );
  });

  it('does not delete a job post that has applications', async () => {
    const remove = jest.fn();
    const prisma = {
      position: {
        delete: remove,
        findUnique: jest.fn().mockResolvedValue({
          _count: { applications: 1 },
        }),
      },
    };

    await expect(
      (await service(prisma)).deletePosition('position-id'),
    ).rejects.toThrow('Job posts with applications cannot be deleted');
    expect(remove).not.toHaveBeenCalled();
  });

  it('deletes a job post that has no applications', async () => {
    const remove = jest.fn().mockResolvedValue({});
    const prisma = {
      position: {
        delete: remove,
        findUnique: jest.fn().mockResolvedValue({
          _count: { applications: 0 },
        }),
      },
    };

    await expect(
      (await service(prisma)).deletePosition('position-id'),
    ).resolves.toEqual({ deleted: true });
    expect(remove).toHaveBeenCalledWith({ where: { id: 'position-id' } });
  });
});
