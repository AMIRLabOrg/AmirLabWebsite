import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DepartmentRole,
  PositionStatus,
  ReviewStatus,
} from '../../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import type {
  DepartmentDto,
  DepartmentMembershipDto,
  UpdateDepartmentDto,
} from './dto/department.dto';

const PEOPLE_INCLUDE = {
  orderBy: [{ role: 'asc' as const }, { sortOrder: 'asc' as const }],
  include: {
    person: {
      include: { avatar: true, metrics: true },
    },
  },
};

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  publicList() {
    return this.prisma.department.findMany({
      where: { isPublished: true },
      include: {
        people: {
          ...PEOPLE_INCLUDE,
          where: { person: { isPublished: true } },
        },
        _count: {
          select: {
            people: { where: { person: { isPublished: true } } },
            researchItems: {
              where: { researchItem: { reviewStatus: ReviewStatus.PUBLISHED } },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async publicBySlug(slug: string) {
    const department = await this.prisma.department.findFirst({
      where: { isPublished: true, slug },
      include: {
        people: {
          ...PEOPLE_INCLUDE,
          where: { person: { isPublished: true } },
        },
        researchItems: {
          where: { researchItem: { reviewStatus: ReviewStatus.PUBLISHED } },
          include: {
            researchItem: {
              include: {
                paper: true,
                dataset: true,
                project: true,
                contributors: { orderBy: { sortOrder: 'asc' } },
              },
            },
          },
        },
        positions: {
          where: { status: PositionStatus.OPEN },
          orderBy: { deadline: 'asc' },
        },
      },
    });
    if (!department) throw new NotFoundException('Department not found');
    return department;
  }

  list() {
    return this.prisma.department.findMany({
      include: {
        people: PEOPLE_INCLUDE,
        _count: { select: { researchItems: true, positions: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async get(id: string) {
    const department = await this.prisma.department.findUnique({
      where: { id },
      include: {
        people: PEOPLE_INCLUDE,
        researchItems: {
          include: { researchItem: true },
          orderBy: { researchItem: { title: 'asc' } },
        },
        positions: { orderBy: { title: 'asc' } },
      },
    });
    if (!department) throw new NotFoundException('Department not found');
    return department;
  }

  async create(dto: DepartmentDto) {
    const slug = await this.availableSlug(dto.name);
    return this.prisma.department.create({
      data: {
        ...normalizedDepartment(dto),
        abbreviation: abbreviation(dto.name),
        name: dto.name.trim(),
        slug,
      },
    });
  }

  async update(id: string, dto: UpdateDepartmentDto) {
    const identity = dto.name
      ? {
          abbreviation: abbreviation(dto.name),
          slug: await this.availableSlug(dto.name, id),
        }
      : {};
    return this.prisma.department.update({
      where: { id },
      data: { ...normalizedDepartment(dto), ...identity },
    });
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    await this.prisma.department.delete({ where: { id } });
    return { deleted: true };
  }

  async upsertMembership(departmentId: string, dto: DepartmentMembershipDto) {
    await this.get(departmentId);
    if (dto.role === DepartmentRole.HEAD) {
      const head = await this.prisma.personDepartment.findFirst({
        where: {
          departmentId,
          role: DepartmentRole.HEAD,
          personId: { not: dto.personId },
        },
      });
      if (head) throw new ConflictException('Department already has a head');
    }
    return this.prisma.$transaction(async (transaction) => {
      if (dto.isPrimary) {
        await transaction.personDepartment.updateMany({
          where: { personId: dto.personId },
          data: { isPrimary: false },
        });
      }
      return transaction.personDepartment.upsert({
        where: {
          personId_departmentId: { departmentId, personId: dto.personId },
        },
        create: { departmentId, ...dto },
        update: {
          isPrimary: dto.isPrimary,
          role: dto.role,
          sortOrder: dto.sortOrder,
        },
        include: { person: true },
      });
    });
  }

  async removeMembership(
    departmentId: string,
    personId: string,
  ): Promise<{ deleted: boolean }> {
    await this.prisma.personDepartment.delete({
      where: { personId_departmentId: { departmentId, personId } },
    });
    return { deleted: true };
  }

  private async availableSlug(
    name: string,
    departmentId?: string,
  ): Promise<string> {
    const base = slug(name.replace(/^Department of\s+/i, ''));
    let candidate = base;
    let suffix = 2;
    let existing = await this.prisma.department.findUnique({
      where: { slug: candidate },
    });
    while (existing && existing.id !== departmentId) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
      existing = await this.prisma.department.findUnique({
        where: { slug: candidate },
      });
    }
    return candidate;
  }
}

function normalizedDepartment(dto: UpdateDepartmentDto): UpdateDepartmentDto {
  return {
    ...dto,
    ...(dto.name ? { name: dto.name.trim() } : {}),
    ...(dto.description !== undefined
      ? { description: dto.description?.trim() || null }
      : {}),
  };
}

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'department'
  );
}

function abbreviation(value: string): string {
  const initials = value
    .trim()
    .split(/\s+/)
    .filter((word) => !['and', 'of', 'the'].includes(word.toLowerCase()))
    .map((word) => word[0])
    .join('')
    .toUpperCase();
  return initials.slice(0, 24) || 'DEPT';
}
