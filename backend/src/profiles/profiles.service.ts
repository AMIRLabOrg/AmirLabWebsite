import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  NotificationType,
  PlatformRole,
  Prisma,
  ProfileReviewStatus,
} from '../../generated/prisma/client';
import { AssetsService } from '../assets/assets.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SettingsService } from '../settings/settings.service';
import type {
  ReviewProfileEditDto,
  SubmitProfileEditDto,
} from './dto/profile.dto';
import {
  type ProfileReviewQueryDto,
  ProfileReviewSort,
} from './dto/profile-review-query.dto';
import { parseProfilePayload, type ProfileEditScope } from './profile-payload';

const PROFILE_INCLUDE = {
  avatar: true,
  links: { orderBy: { sortOrder: 'asc' as const } },
  profileSections: {
    orderBy: { sortOrder: 'asc' as const },
    include: { subsections: { orderBy: { sortOrder: 'asc' as const } } },
  },
} as const;

@Injectable()
export class ProfilesService {
  constructor(
    private readonly assets: AssetsService,
    private readonly notifications: NotificationsService,
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async mine(user: AuthenticatedUser) {
    if (!user.person) throw new NotFoundException('Profile not found');
    return this.fetchProfileByPersonId(user.person.id);
  }

  async submit(
    dto: SubmitProfileEditDto,
    user: AuthenticatedUser,
    avatar?: Express.Multer.File,
  ) {
    if (!user.person) throw new NotFoundException('Profile not found');
    return this.submitProfile(user.person.id, dto, user, avatar);
  }

  async getUserProfile(userId: string) {
    const person = await this.prisma.person.findFirst({ where: { userId } });
    if (!person) throw new NotFoundException('Profile not found');
    return this.fetchProfileByPersonId(person.id);
  }

  async adminSubmit(
    userId: string,
    dto: SubmitProfileEditDto,
    actor: AuthenticatedUser,
    avatar?: Express.Multer.File,
  ) {
    const person = await this.prisma.person.findFirst({
      where: { userId },
      include: { user: { select: { role: true } } },
    });
    if (!person) throw new NotFoundException('Profile not found');
    const scope = profileEditScope(person.user?.role);
    validateProfileMedia(scope, dto, avatar);
    return this.publishProfile(person.id, dto, actor, avatar, {
      scope,
    });
  }

  private async fetchProfileByPersonId(personId: string) {
    const person = await this.prisma.person.findUnique({
      where: { id: personId },
      include: {
        ...PROFILE_INCLUDE,
        profileEditRequest: { include: { avatarAsset: true } },
        user: { select: { role: true } },
      },
    });
    if (!person) throw new NotFoundException('Profile not found');
    const { profileEditRequest, user, ...profile } = person;
    return {
      accountRole: user?.role ?? PlatformRole.MEMBER,
      profile,
      draft: profileEditRequest,
    };
  }

  private async submitProfile(
    personId: string,
    dto: SubmitProfileEditDto,
    user: AuthenticatedUser,
    avatar?: Express.Multer.File,
  ) {
    const person = await this.prisma.person.findUnique({
      where: { id: personId },
      include: { profileEditRequest: true },
    });
    if (!person) throw new NotFoundException('Profile not found');

    const scope = profileEditScope(user.role);
    validateProfileMedia(scope, dto, avatar);
    const removeAvatar = dto.removeAvatar === 'true';
    const payload = parseProfilePayload(dto.profile, removeAvatar, { scope });

    const uploaded = avatar
      ? await this.assets.storeAvatar(avatar, user.id)
      : null;
    const oldDraftAvatarId = person.profileEditRequest?.avatarAssetId ?? null;
    const avatarAssetId = uploaded
      ? uploaded.id
      : removeAvatar
        ? null
        : oldDraftAvatarId;

    const verification = await this.settings.verification();
    const publishNow = dto.publishNow === 'true';
    if (publishNow && user.role !== PlatformRole.ADMIN) {
      throw new BadRequestException('Only administrators can override review');
    }
    if (publishNow && !dto.overrideReason?.trim()) {
      throw new BadRequestException('A publish-now override requires a reason');
    }

    if (verification.profileEdit === 'AUTOMATIC' || publishNow) {
      return this.publishProfile(personId, dto, user, avatar, {
        scope,
        skipAuth: true,
      });
    }

    let request;
    try {
      request = await this.prisma.profileEditRequest.upsert({
        where: { personId: person.id },
        create: {
          avatarAssetId,
          payload: payload as unknown as Prisma.InputJsonValue,
          personId: person.id,
        },
        update: {
          avatarAssetId,
          note: null,
          payload: payload as unknown as Prisma.InputJsonValue,
          revision: { increment: 1 },
          reviewedAt: null,
          reviewedById: null,
          status: ProfileReviewStatus.NEEDS_REVIEW,
          submittedAt: new Date(),
        },
        include: { avatarAsset: true },
      });
    } catch (error) {
      if (uploaded) await this.assets.remove(uploaded.id);
      throw error;
    }

    if (
      oldDraftAvatarId &&
      oldDraftAvatarId !== avatarAssetId &&
      oldDraftAvatarId !== person.avatarId
    ) {
      await this.assets.remove(oldDraftAvatarId);
    }
    await this.notifications.notifyReviewers({
      type: NotificationType.PROFILE_SUBMITTED,
      title: person.profileEditRequest
        ? 'Profile edit updated'
        : 'Profile edit needs review',
      body: `${person.fullName} submitted updated profile information.`,
      actionUrl: `/workspace/profile-reviews/${request.id}`,
      payload: { profileEditRequestId: request.id },
    });
    return request;
  }

  private async publishProfile(
    personId: string,
    dto: SubmitProfileEditDto,
    actor: AuthenticatedUser,
    avatar?: Express.Multer.File,
    opts?: { scope?: ProfileEditScope; skipAuth?: boolean },
  ) {
    const isAdminOverride = !opts?.skipAuth;

    const person = await this.prisma.person.findUnique({
      where: { id: personId },
      include: { profileEditRequest: true },
    });
    if (!person) throw new NotFoundException('Profile not found');

    const scope = opts?.scope ?? profileEditScope(actor.role);
    validateProfileMedia(scope, dto, avatar);
    const removeAvatar = dto.removeAvatar === 'true';
    const payload = parseProfilePayload(dto.profile, removeAvatar, {
      adminFields: isAdminOverride && scope === 'RESEARCH',
      scope,
    });

    const uploaded = avatar
      ? await this.assets.storeAvatar(avatar, actor.id)
      : null;
    const oldDraftAvatarId = person.profileEditRequest?.avatarAssetId ?? null;
    const avatarAssetId = uploaded
      ? uploaded.id
      : removeAvatar
        ? null
        : oldDraftAvatarId;

    const publishedAvatarId = avatarAssetId
      ? avatarAssetId
      : removeAvatar
        ? null
        : person.avatarId;

    try {
      await this.prisma.$transaction(async (transaction) => {
        await transaction.person.update({
          where: { id: person.id },
          data: profileUpdateData(payload, publishedAvatarId, scope),
        });
        if (scope === 'ADMIN' && person.userId) {
          await transaction.user.update({
            where: { id: person.userId },
            data: { email: payload.publicEmail },
          });
        }
        await transaction.profileEditRequest.deleteMany({
          where: { personId: person.id },
        });
        await transaction.auditRecord.create({
          data: {
            action: isAdminOverride
              ? 'profile.edit-published-admin-override'
              : 'profile.edit-published-directly',
            actorId: actor.id,
            entityId: person.id,
            entityType: 'Person',
          },
        });
      });
    } catch (error) {
      if (uploaded) await this.assets.remove(uploaded.id);
      throw error;
    }

    for (const assetId of new Set([person.avatarId, oldDraftAvatarId])) {
      if (assetId && assetId !== publishedAvatarId) {
        await this.assets.remove(assetId);
      }
    }
    return { direct: true };
  }

  async reviewQueue(query: ProfileReviewQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.ProfileEditRequestWhereInput = {
      status: ProfileReviewStatus.NEEDS_REVIEW,
      ...(search
        ? {
            person: {
              OR: [
                { fullName: { contains: search, mode: 'insensitive' } },
                { publicEmail: { contains: search, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };
    const orderBy: Prisma.ProfileEditRequestOrderByWithRelationInput =
      query.sort === ProfileReviewSort.NAME
        ? { person: { fullName: 'asc' } }
        : {
            submittedAt:
              query.sort === ProfileReviewSort.NEWEST ? 'desc' : 'asc',
          };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.profileEditRequest.findMany({
        where,
        include: {
          avatarAsset: true,
          person: { include: PROFILE_INCLUDE },
        },
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.profileEditRequest.count({ where }),
    ]);
    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async reviewRequest(id: string) {
    const request = await this.prisma.profileEditRequest.findUnique({
      where: { id },
      include: {
        avatarAsset: true,
        person: { include: PROFILE_INCLUDE },
      },
    });
    if (!request) throw new NotFoundException('Profile edit not found');
    return request;
  }

  async review(
    id: string,
    dto: ReviewProfileEditDto,
    reviewer: AuthenticatedUser,
  ) {
    if (
      dto.status !== ProfileReviewStatus.APPROVED &&
      dto.status !== ProfileReviewStatus.REJECTED
    ) {
      throw new BadRequestException('Decision must be APPROVED or REJECTED');
    }
    const request = await this.prisma.profileEditRequest.findUnique({
      where: { id },
      include: { person: { include: { user: { select: { role: true } } } } },
    });
    if (!request) throw new NotFoundException('Profile edit not found');
    if (
      request.status !== ProfileReviewStatus.NEEDS_REVIEW ||
      request.revision !== dto.revision
    ) {
      throw new ConflictException(
        'This profile request changed after it was opened; reload the latest revision',
      );
    }

    const scope = profileEditScope(
      request.person.user?.role ?? PlatformRole.MEMBER,
    );
    const payload = parseProfilePayload(request.payload, false, { scope });
    const oldAvatarId = request.person.avatarId;
    const approvedAvatarId = request.avatarAssetId
      ? request.avatarAssetId
      : payload.removeAvatar
        ? null
        : oldAvatarId;
    const reviewNote =
      dto.status === ProfileReviewStatus.REJECTED
        ? dto.note?.trim()
        : undefined;
    if (dto.status === ProfileReviewStatus.REJECTED && !reviewNote) {
      throw new BadRequestException('A reviewer note is required');
    }
    await this.prisma.$transaction(async (transaction) => {
      const claimed = await transaction.profileEditRequest.updateMany({
        where: {
          id,
          revision: dto.revision,
          status: ProfileReviewStatus.NEEDS_REVIEW,
        },
        data: {
          note: reviewNote ?? null,
          reviewedAt: new Date(),
          reviewedById: reviewer.id,
          status: dto.status,
        },
      });
      if (claimed.count !== 1) {
        throw new ConflictException(
          'This profile request changed after it was opened; reload the latest revision',
        );
      }

      if (dto.status === ProfileReviewStatus.APPROVED) {
        await transaction.person.update({
          where: { id: request.personId },
          data: {
            ...profileUpdateData(payload, approvedAvatarId, scope),
            isPublished: true,
          },
        });
      }
      await transaction.auditRecord.create({
        data: {
          action:
            dto.status === ProfileReviewStatus.APPROVED
              ? 'profile.edit-approved'
              : 'profile.edit-rejected',
          actorId: reviewer.id,
          entityId: request.personId,
          entityType: 'Person',
          details: { requestId: request.id, revision: request.revision },
        },
      });
    });

    if (
      dto.status === ProfileReviewStatus.APPROVED &&
      oldAvatarId &&
      oldAvatarId !== approvedAvatarId
    ) {
      await this.assets.remove(oldAvatarId);
    }
    if (request.person.userId) {
      await this.notifications.create(request.person.userId, {
        type: NotificationType.PROFILE_REVIEWED,
        title: `Profile edit ${dto.status.toLowerCase()}`,
        body: reviewNote ?? 'Your latest profile changes were reviewed.',
        actionUrl: '/workspace/profile',
      });
    }
    return { status: dto.status };
  }
}

function profileUpdateData(
  payload: ReturnType<typeof parseProfilePayload>,
  avatarId: string | null | undefined,
  scope: ProfileEditScope,
): Prisma.PersonUncheckedUpdateInput {
  if (scope === 'MODERATOR') {
    return {
      contactAddress: payload.contactAddress,
      fullName: payload.fullName,
      phone: payload.phone,
    };
  }
  if (scope === 'ADMIN') {
    return {
      avatarId,
      fullName: payload.fullName,
      publicEmail: payload.publicEmail,
    };
  }
  return {
    avatarId,
    biography: payload.biography,
    contactAddress: payload.contactAddress,
    expertise: payload.expertise,
    fullName: payload.fullName,
    headline: payload.headline,
    links: {
      deleteMany: {},
      create: payload.links.map((link, sortOrder) => ({ ...link, sortOrder })),
    },
    phone: payload.phone,
    profileSections: {
      deleteMany: {},
      create: payload.sections.map((section, sortOrder) => ({
        type: section.type,
        title: section.title,
        sortOrder,
        subsections: {
          create: section.subsections.map(
            (subsection, subsectionSortOrder) => ({
              ...subsection,
              sortOrder: subsectionSortOrder,
            }),
          ),
        },
      })),
    },
    publicEmail: payload.publicEmail,
    ...(payload.roleTitle !== undefined
      ? { roleTitle: payload.roleTitle }
      : {}),
  };
}

function profileEditScope(role: PlatformRole | undefined): ProfileEditScope {
  if (role === PlatformRole.ADMIN) return 'ADMIN';
  return role === PlatformRole.MODERATOR ? 'MODERATOR' : 'RESEARCH';
}

function validateProfileMedia(
  scope: ProfileEditScope,
  dto: SubmitProfileEditDto,
  avatar?: Express.Multer.File,
) {
  if (scope === 'MODERATOR' && (avatar || dto.removeAvatar === 'true')) {
    throw new BadRequestException(
      'Moderator profiles do not support public portraits',
    );
  }
}
