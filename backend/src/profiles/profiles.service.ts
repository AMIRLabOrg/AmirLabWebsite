import { randomUUID } from 'node:crypto';
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
  BulkReviewProfileEditsDto,
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

  async bulkReview(
    dto: BulkReviewProfileEditsDto,
    reviewer: AuthenticatedUser,
  ) {
    if (
      dto.status !== ProfileReviewStatus.APPROVED &&
      dto.status !== ProfileReviewStatus.REJECTED
    ) {
      throw new BadRequestException('Decision must be APPROVED or REJECTED');
    }
    const ids = dto.items.map(({ id }) => id);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Duplicate profile review IDs are not allowed');
    }
    const reviewNote =
      dto.status === ProfileReviewStatus.REJECTED ? dto.note?.trim() : undefined;
    if (dto.status === ProfileReviewStatus.REJECTED && !reviewNote) {
      throw new BadRequestException('A reviewer note is required');
    }

    const requests = await this.prisma.profileEditRequest.findMany({
      where: { id: { in: ids } },
      include: {
        person: {
          select: {
            avatarId: true,
            biography: true,
            contactAddress: true,
            expertise: true,
            fullName: true,
            headline: true,
            id: true,
            phone: true,
            publicEmail: true,
            roleTitle: true,
            user: { select: { id: true, role: true } },
            userId: true,
          },
        },
      },
    });
    if (requests.length !== ids.length) {
      throw new NotFoundException('One or more profile edits were not found');
    }
    const expectedRevision = new Map(
      dto.items.map(({ id, revision }) => [id, revision]),
    );
    if (
      requests.some(
        (request) =>
          request.status !== ProfileReviewStatus.NEEDS_REVIEW ||
          request.revision !== expectedRevision.get(request.id),
      )
    ) {
      throw new ConflictException(
        'One or more profile requests changed after selection; reload the queue',
      );
    }

    const approved = requests.map((request) => {
      const scope = profileEditScope(
        request.person.user?.role ?? PlatformRole.MEMBER,
      );
      const payload = parseProfilePayload(request.payload, false, { scope });
      const approvedAvatarId = request.avatarAssetId
        ? request.avatarAssetId
        : payload.removeAvatar
          ? null
          : request.person.avatarId;
      const current = request.person;
      return {
        approvedAvatarId,
        oldAvatarId: current.avatarId,
        payload,
        request,
        scope,
        target: {
          avatarId:
            scope === 'ADMIN' || scope === 'RESEARCH'
              ? approvedAvatarId
              : current.avatarId,
          biography:
            scope === 'RESEARCH' ? payload.biography : current.biography,
          contactAddress:
            scope === 'MODERATOR' || scope === 'RESEARCH'
              ? payload.contactAddress
              : current.contactAddress,
          expertise:
            scope === 'RESEARCH' ? payload.expertise : current.expertise,
          fullName: payload.fullName,
          headline: scope === 'RESEARCH' ? payload.headline : current.headline,
          phone:
            scope === 'MODERATOR' || scope === 'RESEARCH'
              ? payload.phone
              : current.phone,
          publicEmail:
            scope === 'ADMIN' || scope === 'RESEARCH'
              ? payload.publicEmail
              : current.publicEmail,
          roleTitle:
            scope === 'RESEARCH' && payload.roleTitle !== undefined
              ? payload.roleTitle
              : current.roleTitle,
        },
      };
    });

    const reviewedAt = new Date();
    await this.prisma.$transaction(async (transaction) => {
      const claimRows = dto.items.map(({ id, revision }) =>
        Prisma.sql`(${id}::uuid, ${revision}::integer)`,
      );
      const claimed = await transaction.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`
          UPDATE "ProfileEditRequest" AS request
          SET
            "note" = ${reviewNote ?? null},
            "reviewedAt" = ${reviewedAt},
            "reviewedById" = ${reviewer.id}::uuid,
            "status" = ${dto.status}::"ProfileReviewStatus"
          FROM (VALUES ${Prisma.join(claimRows)}) AS selected(id, revision)
          WHERE request."id" = selected.id
            AND request."revision" = selected.revision
            AND request."status" = 'NEEDS_REVIEW'::"ProfileReviewStatus"
          RETURNING request."id"
        `,
      );
      if (claimed.length !== requests.length) {
        throw new ConflictException(
          'One or more profile requests changed while the bulk review was being saved',
        );
      }

      if (dto.status === ProfileReviewStatus.APPROVED) {
        const personRows = approved.map(({ request, target }) =>
          Prisma.sql`(
            ${request.personId}::uuid,
            ${target.avatarId}::uuid,
            ${target.biography},
            ${target.contactAddress},
            ${sqlTextArray(target.expertise)},
            ${target.fullName},
            ${target.headline},
            ${target.phone},
            ${target.publicEmail},
            ${target.roleTitle}
          )`,
        );
        await transaction.$executeRaw(
          Prisma.sql`
            UPDATE "Person" AS person
            SET
              "avatarId" = selected.avatar_id,
              "biography" = selected.biography,
              "contactAddress" = selected.contact_address,
              "expertise" = selected.expertise,
              "fullName" = selected.full_name,
              "headline" = selected.headline,
              "isPublished" = true,
              "phone" = selected.phone,
              "publicEmail" = selected.public_email,
              "roleTitle" = selected.role_title,
              "updatedAt" = NOW()
            FROM (VALUES ${Prisma.join(personRows)}) AS selected(
              person_id,
              avatar_id,
              biography,
              contact_address,
              expertise,
              full_name,
              headline,
              phone,
              public_email,
              role_title
            )
            WHERE person."id" = selected.person_id
          `,
        );

        const researchProfiles = approved.filter(
          ({ scope }) => scope === 'RESEARCH',
        );
        const researchPersonIds = researchProfiles.map(
          ({ request }) => request.personId,
        );
        if (researchPersonIds.length) {
          await transaction.personLink.deleteMany({
            where: { personId: { in: researchPersonIds } },
          });
          await transaction.personProfileSection.deleteMany({
            where: { personId: { in: researchPersonIds } },
          });

          const links = researchProfiles.flatMap(({ payload, request }) =>
            payload.links.map((link, sortOrder) => ({
              ...link,
              personId: request.personId,
              sortOrder,
            })),
          );
          if (links.length) {
            await transaction.personLink.createMany({ data: links });
          }

          const sections = researchProfiles.flatMap(({ payload, request }) =>
            payload.sections.map((section, sortOrder) => ({
              id: randomUUID(),
              personId: request.personId,
              sortOrder,
              title: section.title,
              type: section.type,
              subsections: section.subsections,
            })),
          );
          if (sections.length) {
            await transaction.personProfileSection.createMany({
              data: sections.map(({ subsections: _subsections, ...section }) =>
                section,
              ),
            });
            const subsections = sections.flatMap((section) =>
              section.subsections.map((subsection, sortOrder) => ({
                ...subsection,
                sectionId: section.id,
                sortOrder,
              })),
            );
            if (subsections.length) {
              await transaction.personProfileSubsection.createMany({
                data: subsections,
              });
            }
          }
        }
      }

      await transaction.auditRecord.createMany({
        data: requests.map((request) => ({
          action:
            dto.status === ProfileReviewStatus.APPROVED
              ? 'profile.edit-approved'
              : 'profile.edit-rejected',
          actorId: reviewer.id,
          entityId: request.personId,
          entityType: 'Person',
          details: {
            bulk: true,
            requestId: request.id,
            revision: request.revision,
          },
        })),
      });
    });

    if (dto.status === ProfileReviewStatus.APPROVED) {
      const obsoleteAvatarIds = approved.flatMap(
        ({ approvedAvatarId, oldAvatarId }) =>
          oldAvatarId && oldAvatarId !== approvedAvatarId ? [oldAvatarId] : [],
      );
      await this.assets.removeMany(obsoleteAvatarIds);
    }
    await this.notifications.createMany(
      requests.flatMap((request) =>
        request.person.userId
          ? [
              {
                actionUrl: '/workspace/profile',
                body:
                  reviewNote ?? 'Your latest profile changes were reviewed.',
                payload: { profileEditRequestId: request.id },
                recipientId: request.person.userId,
                title: `Profile edit ${dto.status.toLowerCase()}`,
                type: NotificationType.PROFILE_REVIEWED,
              },
            ]
          : [],
      ),
    );
    return { count: requests.length, ids, status: dto.status };
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

function sqlTextArray(values: readonly string[]): Prisma.Sql {
  return values.length
    ? Prisma.sql`ARRAY[${Prisma.join(values)}]::text[]`
    : Prisma.sql`ARRAY[]::text[]`;
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
