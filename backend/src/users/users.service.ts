import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountStatus,
  PlatformRole,
  Prisma,
} from '../../generated/prisma/client';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../database/prisma.service';
import type { CreateUserDto, UpdateUserDto } from './dto/create-user.dto';
import {
  UserDeletedFilter,
  UserQueryDto,
  UserSort,
} from './dto/user-query.dto';
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
      isDeleted: query.deleted === UserDeletedFilter.TRASH,
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
      isDeleted: true,
      deletedAt: true,
      person: {
        select: {
          fullName: true,
          appointedRank: true,
          earnedRank: true,
          slug: true,
        },
      },
    } satisfies Prisma.UserSelect;
    const [items, total] = await Promise.all([
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

  async update(id: string, dto: UpdateUserDto, actorId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { person: true },
    });
    if (!user) throw new NotFoundException('Account not found');
    if (user.isDeleted) {
      throw new ConflictException('Restore the account before editing it');
    }
    const fullName = dto.fullName.trim();
    const email = dto.email.trim().toLowerCase();
    if (email !== user.email) {
      const existing = await this.prisma.user.findUnique({ where: { email } });
      if (existing && existing.id !== id) {
        throw new ConflictException('An account already exists for this email');
      }
    }
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
      if (email !== user.email) {
        await transaction.session.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      await transaction.auditRecord.create({
        data: {
          action: 'account.updated',
          actorId,
          entityId: id,
          entityType: 'User',
          details: {
            fullName: { from: user.person?.fullName, to: fullName },
            rank: { from: user.person?.appointedRank, to: dto.rank },
            role: { from: user.role, to: dto.role },
            email: { from: user.email, to: email },
          },
        },
      });
      return account;
    });
    return updated;
  }

  async remove(id: string, actorId: string) {
    if (id === actorId) {
      throw new ConflictException('You cannot delete your own account');
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { email: true, role: true, isDeleted: true },
    });
    if (!user) throw new NotFoundException('Account not found');
    if (user.isDeleted)
      throw new ConflictException('Account is already in trash');

    if (user.role === PlatformRole.ADMIN) {
      const adminCount = await this.prisma.user.count({
        where: {
          isDeleted: false,
          role: PlatformRole.ADMIN,
          status: { not: AccountStatus.ARCHIVED },
        },
      });
      if (adminCount <= 1) {
        throw new ConflictException('The last administrator cannot be deleted');
      }
    }

    try {
      await this.prisma.$transaction(async (transaction) => {
        await transaction.auditRecord.create({
          data: {
            action: 'account.deleted',
            actorId,
            entityId: id,
            entityType: 'User',
            details: { email: user.email },
          },
        });
        await transaction.session.deleteMany({ where: { userId: id } });
        await transaction.user.update({
          where: { id },
          data: { deletedAt: new Date(), isDeleted: true },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(
          'This account owns records that must be reassigned or removed before deletion',
        );
      }
      throw error;
    }

    return { deleted: true };
  }

  async restore(id: string, actorId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { email: true, isDeleted: true },
    });
    if (!user) throw new NotFoundException('Account not found');
    if (!user.isDeleted) throw new ConflictException('Account is not in trash');

    await this.prisma.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id },
        data: { deletedAt: null, isDeleted: false },
      });
      await transaction.auditRecord.create({
        data: {
          action: 'account.restored',
          actorId,
          entityId: id,
          entityType: 'User',
          details: { email: user.email },
        },
      });
    });

    return { restored: true };
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
