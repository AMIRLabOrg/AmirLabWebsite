import { PrismaService } from '../database/prisma.service';
import { resolveService } from '../../test/resolve-service';
import { DepartmentsService } from './departments.service';

describe('DepartmentsService', () => {
  it('calculates department identity fields from the name', async () => {
    const prisma = {
      department: {
        create: jest.fn().mockResolvedValue({ id: 'department-1' }),
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    const service = await resolveService(DepartmentsService, [
      { provide: PrismaService, useValue: prisma },
    ]);

    await service.create({
      description: null,
      isPublished: false,
      name: 'Department of Artificial Intelligence and Biomedical Imaging',
    });

    expect(prisma.department.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        abbreviation: 'DAIBI',
        slug: 'artificial-intelligence-and-biomedical-imaging',
      }),
    });
  });

  it('adds a suffix when a generated slug already exists', async () => {
    const prisma = {
      department: {
        create: jest.fn().mockResolvedValue({ id: 'department-2' }),
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ id: 'department-1' })
          .mockResolvedValueOnce(null),
      },
    };
    const service = await resolveService(DepartmentsService, [
      { provide: PrismaService, useValue: prisma },
    ]);

    await service.create({
      description: null,
      isPublished: false,
      name: 'Department of Computer Vision',
    });

    expect(prisma.department.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ slug: 'computer-vision-2' }),
    });
  });

  it('recalculates identity fields when the department name changes', async () => {
    const prisma = {
      department: {
        findUnique: jest.fn().mockResolvedValue({ id: 'department-1' }),
        update: jest.fn().mockResolvedValue({ id: 'department-1' }),
      },
    };
    const service = await resolveService(DepartmentsService, [
      { provide: PrismaService, useValue: prisma },
    ]);

    await service.update('department-1', {
      name: 'Department of Natural Language Processing',
    });

    expect(prisma.department.update).toHaveBeenCalledWith({
      data: expect.objectContaining({
        abbreviation: 'DNLP',
        slug: 'natural-language-processing',
      }),
      where: { id: 'department-1' },
    });
  });
});
