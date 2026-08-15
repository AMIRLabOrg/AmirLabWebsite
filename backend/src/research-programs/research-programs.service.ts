import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountStatus,
  ResearchItemType,
  ResearchProgramStatus,
} from '../../generated/prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import type { SaveResearchProgramDto } from './dto/research-program.dto';

const PROGRAM_INCLUDE = {
  lead: {
    select: {
      id: true,
      fullName: true,
      headline: true,
      roleTitle: true,
      avatar: { select: { id: true } },
    },
  },
  departments: {
    include: {
      department: {
        select: { id: true, name: true, abbreviation: true },
      },
    },
    orderBy: { department: { name: 'asc' as const } },
  },
  items: {
    include: {
      researchItem: {
        select: {
          id: true,
          type: true,
          title: true,
          summary: true,
          reviewStatus: true,
          project: { select: { status: true } },
          paper: { select: { year: true, venue: true } },
          dataset: { select: { version: true } },
        },
      },
    },
    orderBy: { researchItem: { title: 'asc' as const } },
  },
} as const;

const AVAILABLE_ACCOUNT_STATUSES: AccountStatus[] = [
  AccountStatus.ACTIVE,
  AccountStatus.PENDING_SETUP,
];

@Injectable()
export class ResearchProgramsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.researchProgram.findMany({
      where: { status: { not: ResearchProgramStatus.ARCHIVED } },
      include: PROGRAM_INCLUDE,
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
    });
  }

  async get(id: string) {
    const program = await this.prisma.researchProgram.findUnique({
      where: { id },
      include: PROGRAM_INCLUDE,
    });
    if (!program) throw new NotFoundException('Research program not found');
    return program;
  }

  async options() {
    const [departments, people, items] = await Promise.all([
      this.prisma.department.findMany({
        select: { id: true, name: true, abbreviation: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.person.findMany({
        where: {
          user: { is: { status: { in: AVAILABLE_ACCOUNT_STATUSES } } },
        },
        select: { id: true, fullName: true, headline: true, roleTitle: true },
        orderBy: { fullName: 'asc' },
      }),
      this.prisma.researchItem.findMany({
        where: { type: { in: Object.values(ResearchItemType) } },
        select: { id: true, title: true, type: true, reviewStatus: true },
        orderBy: { title: 'asc' },
      }),
    ]);
    return {
      departments,
      people,
      projects: items.filter(({ type }) => type === ResearchItemType.PROJECT),
      outputs: items.filter(({ type }) => type !== ResearchItemType.PROJECT),
    };
  }

  async create(dto: SaveResearchProgramDto, user: AuthenticatedUser) {
    await this.validate(dto);
    const program = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.researchProgram.create({
        data: {
          ...programData(dto),
          createdById: user.id,
          slug: await this.availableSlug(dto.name),
          departments: {
            create: unique(dto.departmentIds).map((departmentId) => ({
              departmentId,
            })),
          },
          items: {
            create: unique([...dto.projectIds, ...dto.outputIds]).map(
              (researchItemId) => ({ researchItemId }),
            ),
          },
        },
      });
      await transaction.auditRecord.create({
        data: {
          action: 'research-program.created',
          actorId: user.id,
          entityId: created.id,
          entityType: 'ResearchProgram',
          details: relationships(dto),
        },
      });
      return created;
    });
    return this.get(program.id);
  }

  async update(
    id: string,
    dto: SaveResearchProgramDto,
    user: AuthenticatedUser,
  ) {
    await this.get(id);
    await this.validate(dto);
    await this.prisma.$transaction(async (transaction) => {
      await transaction.researchProgram.update({
        where: { id },
        data: {
          ...programData(dto),
          slug: await this.availableSlug(dto.name, id),
          departments: {
            deleteMany: {},
            create: unique(dto.departmentIds).map((departmentId) => ({
              departmentId,
            })),
          },
          items: {
            deleteMany: {},
            create: unique([...dto.projectIds, ...dto.outputIds]).map(
              (researchItemId) => ({ researchItemId }),
            ),
          },
        },
      });
      await transaction.auditRecord.create({
        data: {
          action: 'research-program.updated',
          actorId: user.id,
          entityId: id,
          entityType: 'ResearchProgram',
          details: relationships(dto),
        },
      });
    });
    return this.get(id);
  }

  private async validate(dto: SaveResearchProgramDto) {
    if (dto.startsAt && dto.endsAt && dto.endsAt < dto.startsAt) {
      throw new BadRequestException(
        'Program end date must follow its start date',
      );
    }
    const departmentIds = unique(dto.departmentIds);
    const projectIds = unique(dto.projectIds);
    const outputIds = unique(dto.outputIds);
    if (
      departmentIds.length !== dto.departmentIds.length ||
      projectIds.length !== dto.projectIds.length ||
      outputIds.length !== dto.outputIds.length
    ) {
      throw new BadRequestException('Program relationships cannot repeat');
    }
    const [departments, projects, outputs, lead] = await Promise.all([
      this.prisma.department.count({ where: { id: { in: departmentIds } } }),
      this.prisma.researchItem.count({
        where: { id: { in: projectIds }, type: ResearchItemType.PROJECT },
      }),
      this.prisma.researchItem.count({
        where: {
          id: { in: outputIds },
          type: { in: [ResearchItemType.PAPER, ResearchItemType.DATASET] },
        },
      }),
      dto.leadPersonId
        ? this.prisma.person.findFirst({
            where: {
              id: dto.leadPersonId,
              user: { is: { status: { in: AVAILABLE_ACCOUNT_STATUSES } } },
            },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);
    if (departments !== departmentIds.length) {
      throw new BadRequestException('Every department must be registered');
    }
    if (projects !== projectIds.length) {
      throw new BadRequestException('Every linked project must be a project');
    }
    if (outputs !== outputIds.length) {
      throw new BadRequestException(
        'Every linked output must be a paper or dataset',
      );
    }
    if (dto.leadPersonId && !lead) {
      throw new BadRequestException(
        'Program lead must have an available registered account',
      );
    }
  }

  private async availableSlug(name: string, programId?: string) {
    const base = slug(name);
    let candidate = base;
    let suffix = 2;
    let existing = await this.prisma.researchProgram.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    while (existing && existing.id !== programId) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
      existing = await this.prisma.researchProgram.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
    }
    return candidate;
  }
}

function programData(dto: SaveResearchProgramDto) {
  return {
    endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
    leadId: dto.leadPersonId || null,
    name: dto.name.trim(),
    objective: dto.objective.trim(),
    publicPageEnabled: dto.publicPageEnabled,
    startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
    status: dto.status,
    summary: dto.summary?.trim() || null,
  };
}

function relationships(dto: SaveResearchProgramDto) {
  return {
    departmentIds: dto.departmentIds,
    leadPersonId: dto.leadPersonId ?? null,
    outputIds: dto.outputIds,
    projectIds: dto.projectIds,
  };
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function slug(value: string) {
  return (
    value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'research-program'
  );
}
