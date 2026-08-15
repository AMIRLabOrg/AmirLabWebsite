import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccountStatus, Prisma } from '../../generated/prisma/client';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../database/prisma.service';
import type { CreateUserDto } from './dto/create-user.dto';
import { UserQueryDto, UserSort } from './dto/user-query.dto';
import { buildPersonSlug } from './person-slug';
import { effectiveRank } from '../settings/settings.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  async create(dto: CreateUserDto) {
    const email = dto.email.trim().toLowerCase();
    const fullName = dto.fullName.trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('An account already exists for this email');
    }

    const user = await this.prisma.$transaction(async (transaction) => {
      const account = await transaction.user.create({
        data: {
          email,
          role: dto.role,
          status: AccountStatus.PENDING_SETUP,
        },
      });
      await transaction.person.create({
        data: {
          fullName,
          isPublished: false,
          appointedRank: dto.rank ?? null,
          slug: buildPersonSlug(fullName, account.id),
          userId: account.id,
        },
      });
      return account;
    });
    return { id: user.id, email: user.email, status: user.status };
  }

  async list(query: UserQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.UserWhereInput = {
      role: query.role,
      status: query.status,
      person: query.rank
        ? {
            is: {
              OR: [{ appointedRank: query.rank }, { earnedRank: query.rank }],
            },
          }
        : undefined,
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' } },
              {
                person: {
                  is: {
                    fullName: { contains: search, mode: 'insensitive' },
                  },
                },
              },
            ],
          }
        : {}),
    };
    const orderBy: Prisma.UserOrderByWithRelationInput =
      query.sort === UserSort.NAME
        ? { person: { fullName: 'asc' } }
        : {
            createdAt: query.sort === UserSort.OLDEST ? 'asc' : 'desc',
          };
    const select = {
      id: true,
      email: true,
      role: true,
      setupEmailQueuedAt: true,
      status: true,
      person: {
        select: {
          fullName: true,
          appointedRank: true,
          earnedRank: true,
          slug: true,
        },
      },
    } satisfies Prisma.UserSelect;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      items: items.map(withEffectivePersonRank),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async get(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        setupEmailQueuedAt: true,
        person: {
          select: {
            fullName: true,
            appointedRank: true,
            earnedRank: true,
            slug: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException('Account not found');
    return withEffectivePersonRank(user);
  }

  async update(id: string, dto: CreateUserDto, actorId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { person: true },
    });
    if (!user) throw new NotFoundException('Account not found');
    const email = dto.email.trim().toLowerCase();
    const owner = await this.prisma.user.findUnique({ where: { email } });
    if (owner && owner.id !== id) {
      throw new ConflictException('An account already exists for this email');
    }

    const fullName = dto.fullName.trim();
    const updated = await this.prisma.$transaction(async (transaction) => {
      const account = await transaction.user.update({
        where: { id },
        data: { email, role: dto.role },
        select: { email: true, id: true, role: true, status: true },
      });
      if (user.person) {
        await transaction.person.update({
          where: { id: user.person.id },
          data: { appointedRank: dto.rank, fullName },
        });
      } else {
        await transaction.person.create({
          data: {
            fullName,
            isPublished: false,
            appointedRank: dto.rank,
            slug: buildPersonSlug(fullName, id),
            userId: id,
          },
        });
      }
      await transaction.auditRecord.create({
        data: {
          action: 'account.updated',
          actorId,
          entityId: id,
          entityType: 'User',
          details: {
            email: { from: user.email, to: email },
            fullName: { from: user.person?.fullName, to: fullName },
            rank: { from: user.person?.appointedRank, to: dto.rank },
            role: { from: user.role, to: dto.role },
          },
        },
      });
      return account;
    });
    return updated;
  }

  async sendAccessEmail(id: string, actorId: string) {
    const queuedAt = await this.auth.issueAccountSetup(id);
    await this.prisma.auditRecord.create({
      data: {
        action: 'account.access-email-queued',
        actorId,
        entityId: id,
        entityType: 'User',
      },
    });
    return { queuedAt };
  }
}

function withEffectivePersonRank<
  T extends {
    person: {
      appointedRank: Parameters<typeof effectiveRank>[0];
      earnedRank: Parameters<typeof effectiveRank>[1];
    } | null;
  },
>(value: T) {
  if (!value.person) return value;
  const { appointedRank, earnedRank, ...person } = value.person;
  return {
    ...value,
    person: {
      ...person,
      appointedRank,
      earnedRank,
      rank: effectiveRank(appointedRank, earnedRank),
    },
  };
}
