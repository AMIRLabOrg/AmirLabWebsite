import { BadRequestException } from '@nestjs/common';
import {
  AccountStatus,
  PlatformRole,
  ResearchProgramStatus,
} from '../../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { resolveService } from '../../test/resolve-service';
import { ResearchProgramsService } from './research-programs.service';

describe('ResearchProgramsService', () => {
  const prisma = {
    $transaction: jest.fn(),
    auditRecord: { create: jest.fn() },
    department: { count: jest.fn(), findMany: jest.fn() },
    person: { findFirst: jest.fn(), findMany: jest.fn() },
    researchItem: { count: jest.fn(), findMany: jest.fn() },
    researchProgram: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
  const user = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'admin@amirl.local',
    role: PlatformRole.ADMIN,
    status: AccountStatus.ACTIVE,
    person: null,
  };
  const dto = {
    departmentIds: ['22222222-2222-4222-8222-222222222222'],
    endsAt: null,
    leadPersonId: '33333333-3333-4333-8333-333333333333',
    name: 'Trustworthy Medical AI',
    objective: 'Build and validate reliable clinical decision support.',
    outputReferences: [
      {
        doi: 'https://doi.org/10.1000/Example',
        label: 'Published result',
        url: '',
      },
    ],
    projectIds: ['55555555-5555-4555-8555-555555555555'],
    publicPageEnabled: false,
    startsAt: null,
    status: ResearchProgramStatus.ACTIVE,
    summary: 'A long-running research direction.',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
    prisma.$transaction.mockImplementation((work: any) => work(prisma));
  });

  it('keeps archived programs out of the active registry', async () => {
    prisma.researchProgram.findMany.mockResolvedValue([]);
    const service = await resolveService(ResearchProgramsService, [
      { provide: PrismaService, useValue: prisma },
    ]);

    await service.list();

    expect(prisma.researchProgram.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: { not: ResearchProgramStatus.ARCHIVED } },
      }),
    );
  });

  it('creates projects and independent normalized output references', async () => {
    prisma.department.count.mockResolvedValue(1);
    prisma.researchItem.count.mockResolvedValueOnce(1);
    prisma.person.findFirst.mockResolvedValue({ id: dto.leadPersonId });
    prisma.researchProgram.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'program', items: [], departments: [] });
    prisma.researchProgram.create.mockResolvedValue({ id: 'program' });
    const service = await resolveService(ResearchProgramsService, [
      { provide: PrismaService, useValue: prisma },
    ]);

    await service.create(dto, user);

    expect(prisma.researchProgram.create).toHaveBeenCalledWith({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: expect.objectContaining({
        items: {
          create: [{ researchItemId: dto.projectIds[0] }],
        },
        outputReferences: {
          create: [
            {
              doi: '10.1000/example',
              identityKey: 'doi:10.1000/example',
              label: 'Published result',
              url: null,
            },
          ],
        },
      }),
    });
    expect(prisma.auditRecord.create).toHaveBeenCalledWith({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: expect.objectContaining({ action: 'research-program.created' }),
    });
  });

  it('rejects a paper or dataset id supplied as a project', async () => {
    prisma.department.count.mockResolvedValue(1);
    prisma.researchItem.count.mockResolvedValueOnce(0);
    prisma.person.findFirst.mockResolvedValue({ id: dto.leadPersonId });
    const service = await resolveService(ResearchProgramsService, [
      { provide: PrismaService, useValue: prisma },
    ]);

    await expect(service.create(dto, user)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects duplicate DOI aliases', async () => {
    const service = await resolveService(ResearchProgramsService, [
      { provide: PrismaService, useValue: prisma },
    ]);

    await expect(
      service.create(
        {
          ...dto,
          outputReferences: [
            ...dto.outputReferences,
            { doi: 'doi:10.1000/example', label: 'Duplicate', url: '' },
          ],
        },
        user,
      ),
    ).rejects.toThrow('Program relationships cannot repeat');
  });
});
