import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountStatus,
  ContributorMatchStatus,
  NotificationType,
  PlatformRole,
  PositionStatus,
  EngagementType,
  ResearchItemType,
  ReviewStatus,
  SourceFetchStatus,
  Prisma,
} from '../../generated/prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { reviewConflict } from '../common/review-problem';
import type { CreatePositionDto, UpdatePositionDto } from './dto/position.dto';
import {
  PublicationQueryDto,
  PublicationSort,
} from './dto/publication-query.dto';
import type { BulkReviewResearchDto, ReviewResearchDto, SubmitResearchDto } from './dto/research.dto';
import {
  ResearchReviewQueryDto,
  ResearchReviewSort,
} from './dto/research-review-query.dto';
import {
  PUBLICATION_CATEGORY_LABELS,
  PublicationCategory,
  publicationCategory,
} from './publication-category';
import { ResearchDiscoveryService } from './research-discovery.service';
import { ResearchProfileSyncService } from './research-profile-sync.service';
import { RankingsService } from './rankings.service';
import { SettingsService, effectiveRank } from '../settings/settings.service';

const RESEARCH_INCLUDE = {
  contributors: {
    orderBy: { sortOrder: 'asc' as const },
    include: { person: { select: { fullName: true, slug: true } } },
  },
  dataset: true,
  paper: true,
  project: {
    include: {
      objectives: { orderBy: { sortOrder: 'asc' as const } },
      milestones: { orderBy: { sortOrder: 'asc' as const } },
      updates: {
        where: { status: 'PUBLISHED' as const },
        orderBy: { publishedAt: 'desc' as const },
      },
      memberships: {
        where: { status: 'ACTIVE' as const },
        include: { person: { include: { avatar: true } } },
      },
      resources: { orderBy: { sortOrder: 'asc' as const } },
    },
  },
} as const;

@Injectable()
export class ResearchService {
  constructor(
    private readonly discovery: ResearchDiscoveryService,
    private readonly notifications: NotificationsService,
    private readonly prisma: PrismaService,
    private readonly profileSync: ResearchProfileSyncService,
    private readonly rankings: RankingsService,
    private readonly settings: SettingsService,
  ) {}

  async people() {
    const people = await this.prisma.person.findMany({
      where: { isPublished: true },
      include: {
        avatar: true,
        departments: { include: { department: true } },
        metrics: true,
      },
      orderBy: { fullName: 'asc' },
    });
    return people.map(publicPerson).sort(comparePeople);
  }

  async personBySlug(slug: string) {
    const person = await this.prisma.person.findFirst({
      where: { isPublished: true, slug },
      include: {
        avatar: true,
        departments: { include: { department: true } },
        links: { orderBy: { sortOrder: 'asc' } },
        profileSections: {
          orderBy: { sortOrder: 'asc' },
          include: {
            subsections: {
              orderBy: { sortOrder: 'asc' },
              include: { entries: { orderBy: { sortOrder: 'asc' } } },
            },
          },
        },
        metrics: true,
        contributions: {
          where: { researchItem: publicResearchWhere() },
          orderBy: { researchItem: { publishedAt: 'desc' } },
          include: { researchItem: { include: RESEARCH_INCLUDE } },
        },
      },
    });
    if (!person) throw new NotFoundException('Person not found');
    return publicPerson(person);
  }

  research(type?: ResearchItemType) {
    return this.prisma.researchItem.findMany({
      where: publicResearchWhere(type),
      include: RESEARCH_INCLUDE,
      orderBy: [{ publishedAt: 'desc' }, { title: 'asc' }],
    });
  }

  async publications(query: PublicationQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.ResearchItemWhereInput = {
      reviewStatus: ReviewStatus.PUBLISHED,
      type: ResearchItemType.PAPER,
      AND: [
        ...(query.category
          ? [{ paper: { is: { publicationType: query.category } } }]
          : []),
        ...(query.year ? [{ paper: { is: { year: query.year } } }] : []),
        ...(search
          ? [
              {
                OR: [
                  { title: { contains: search, mode: 'insensitive' as const } },
                  {
                    summary: { contains: search, mode: 'insensitive' as const },
                  },
                  {
                    canonicalUrl: {
                      contains: search,
                      mode: 'insensitive' as const,
                    },
                  },
                  {
                    contributors: {
                      some: {
                        displayName: {
                          contains: search,
                          mode: 'insensitive' as const,
                        },
                      },
                    },
                  },
                  {
                    paper: {
                      is: {
                        OR: [
                          {
                            venue: {
                              contains: search,
                              mode: 'insensitive' as const,
                            },
                          },
                          {
                            doi: {
                              contains: search,
                              mode: 'insensitive' as const,
                            },
                          },
                          {
                            citation: {
                              contains: search,
                              mode: 'insensitive' as const,
                            },
                          },
                        ],
                      },
                    },
                  },
                ],
              },
            ]
          : []),
      ],
    };
    const descending = query.sort !== PublicationSort.OLDEST;
    const orderBy: Prisma.ResearchItemOrderByWithRelationInput[] =
      query.sort === PublicationSort.TITLE
        ? [{ title: 'asc' }]
        : [
            { paper: { year: descending ? 'desc' : 'asc' } },
            { publishedAt: descending ? 'desc' : 'asc' },
            { title: 'asc' },
          ];
    const facetWhere: Prisma.PaperWhereInput = {
      researchItem: { reviewStatus: ReviewStatus.PUBLISHED },
    };
    const [items, total, facetPapers] = await Promise.all([
      this.prisma.researchItem.findMany({
        where,
        include: RESEARCH_INCLUDE,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.researchItem.count({ where }),
      this.prisma.paper.findMany({
        where: facetWhere,
        select: { publicationType: true, year: true },
      }),
    ]);
    const categoryCounts = new Map<PublicationCategory, number>();
    const yearCounts = new Map<number, number>();
    for (const paper of facetPapers) {
      if (paper.publicationType) {
        const category = paper.publicationType as PublicationCategory;
        categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
      }
      if (paper.year)
        yearCounts.set(paper.year, (yearCounts.get(paper.year) ?? 0) + 1);
    }
    const categories = Object.values(PublicationCategory).flatMap((value) => {
      const count = categoryCounts.get(value) ?? 0;
      return count
        ? [{ count, label: PUBLICATION_CATEGORY_LABELS[value], value }]
        : [];
    });
    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
      facets: {
        categories,
        years: [...yearCounts.entries()]
          .sort(([left], [right]) => right - left)
          .map(([value, count]) => ({ count, value })),
      },
    };
  }

  async publicStats() {
    const [papers, people, datasets, projects, openPositions] =
      await Promise.all([
        this.prisma.researchItem.count({
          where: {
            reviewStatus: ReviewStatus.PUBLISHED,
            type: ResearchItemType.PAPER,
          },
        }),
        this.prisma.person.count({ where: { isPublished: true } }),
        this.prisma.researchItem.count({
          where: {
            reviewStatus: ReviewStatus.PUBLISHED,
            type: ResearchItemType.DATASET,
          },
        }),
        this.prisma.researchItem.count({
          where: {
            reviewStatus: ReviewStatus.PUBLISHED,
            type: ResearchItemType.PROJECT,
            project: { is: { publicPageEnabled: true } },
          },
        }),
        this.prisma.position.count({
          where: publicPositionWhere(new Date()),
        }),
      ]);
    return { papers, people, datasets, projects, openPositions };
  }

  async researchBySlug(slug: string) {
    const item = await this.prisma.researchItem.findFirst({
      where: { ...publicResearchWhere(), slug },
      include: RESEARCH_INCLUDE,
    });
    if (!item) {
      throw new NotFoundException('Research item not found');
    }
    return item;
  }

  positions() {
    const now = new Date();
    return this.prisma.position.findMany({
      where: publicPositionWhere(now),
      include: { department: true },
      orderBy: [{ closesAt: 'asc' }, { createdAt: 'desc' }],
    });
  }

  adminPositions() {
    return this.prisma.position.findMany({
      include: { department: true, _count: { select: { applications: true } } },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async adminPosition(id: string) {
    const position = await this.prisma.position.findUnique({
      where: { id },
      include: { department: true, _count: { select: { applications: true } } },
    });
    if (!position) throw new NotFoundException('Position not found');
    return position;
  }

  async createPosition(dto: CreatePositionDto) {
    validatePositionTiming(dto);
    const slugBase = dto.title
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    return this.prisma.position.create({
      data: {
        closesAt: dto.closesAt
          ? new Date(dto.closesAt)
          : dto.deadline
            ? new Date(dto.deadline)
            : undefined,
        description: emptyToNull(dto.description),
        engagementDurationLabel: emptyToNull(dto.engagementDurationLabel),
        engagementEndsAt: dto.engagementEndsAt
          ? new Date(dto.engagementEndsAt)
          : undefined,
        engagementStartsAt: dto.engagementStartsAt
          ? new Date(dto.engagementStartsAt)
          : undefined,
        engagementType: dto.engagementType,
        opensAt: dto.opensAt ? new Date(dto.opensAt) : undefined,
        positionType: dto.positionType,
        requirements: cleanList(dto.requirements),
        responsibilities: cleanList(dto.responsibilities ?? []),
        summary: dto.summary.trim(),
        targetRank: dto.targetRank,
        title: dto.title.trim(),
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
        departmentId: dto.departmentId,
        slug: `${slugBase}-${Date.now().toString(36)}`,
        // Publishing is a separate action: newly created posts always stay disabled.
        status: PositionStatus.DRAFT,
      },
      include: { department: true },
    });
  }

  async updatePosition(id: string, dto: UpdatePositionDto) {
    const position = await this.prisma.position.findUnique({ where: { id } });
    if (!position) throw new NotFoundException('Position not found');
    validatePositionTiming({
      closesAt: valueOrIso(dto.closesAt, position.closesAt),
      engagementDurationLabel:
        dto.engagementDurationLabel ??
        position.engagementDurationLabel ??
        undefined,
      engagementEndsAt: valueOrIso(
        dto.engagementEndsAt,
        position.engagementEndsAt,
      ),
      engagementStartsAt: valueOrIso(
        dto.engagementStartsAt,
        position.engagementStartsAt,
      ),
      engagementType: dto.engagementType ?? position.engagementType,
      opensAt: valueOrIso(dto.opensAt, position.opensAt),
    });
    return this.prisma.position.update({
      where: { id },
      data: {
        ...positionData(dto),
        ...(dto.deadline !== undefined
          ? { deadline: dto.deadline ? new Date(dto.deadline) : null }
          : {}),
      },
      include: { department: true, _count: { select: { applications: true } } },
    });
  }

  async enablePosition(id: string) {
    await this.adminPosition(id);
    return this.prisma.position.update({
      where: { id },
      data: { status: PositionStatus.OPEN },
      include: { department: true, _count: { select: { applications: true } } },
    });
  }

  async disablePosition(id: string) {
    await this.adminPosition(id);
    return this.prisma.position.update({
      where: { id },
      data: { status: PositionStatus.DRAFT },
      include: { department: true, _count: { select: { applications: true } } },
    });
  }

  async deletePosition(id: string): Promise<{ deleted: true }> {
    const position = await this.prisma.position.findUnique({
      where: { id },
      select: { _count: { select: { applications: true } } },
    });
    if (!position) throw new NotFoundException('Position not found');
    if (position._count.applications) {
      throw new ConflictException(
        'Job posts with applications cannot be deleted. Disable the post instead.',
      );
    }
    await this.prisma.position.delete({ where: { id } });
    return { deleted: true };
  }

  async reviewQueue(query: ResearchReviewQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.ResearchItemWhereInput = {
      reviewStatus: query.status ?? {
        in: [ReviewStatus.NEEDS_REVIEW, ReviewStatus.CHANGES_REQUESTED],
      },
      type: query.type ?? { in: [ResearchItemType.PAPER, ResearchItemType.DATASET] },
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { summary: { contains: search, mode: 'insensitive' } },
              { canonicalUrl: { contains: search, mode: 'insensitive' } },
              {
                paper: {
                  is: { citation: { contains: search, mode: 'insensitive' } },
                },
              },
              {
                contributors: {
                  some: {
                    displayName: { contains: search, mode: 'insensitive' },
                  },
                },
              },
            ],
          }
        : {}),
    };
    const orderBy: Prisma.ResearchItemOrderByWithRelationInput =
      query.sort === ResearchReviewSort.TITLE
        ? { title: 'asc' }
        : {
            createdAt:
              query.sort === ResearchReviewSort.NEWEST ? 'desc' : 'asc',
          };
    const [items, total] = await Promise.all([
      this.prisma.researchItem.findMany({
        where,
        include: {
          ...RESEARCH_INCLUDE,
          contributors: {
            orderBy: { sortOrder: 'asc' },
            include: {
              person: { select: { id: true, fullName: true, slug: true } },
              matches: {
                include: {
                  person: { select: { id: true, fullName: true, slug: true } },
                  requestedBy: { select: { email: true } },
                },
                orderBy: { createdAt: 'asc' },
              },
            },
          },
          sourceSnapshot: true,
          submittedBy: { include: { person: true } },
        },
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.researchItem.count({ where }),
    ]);
    return {
      items: items.map((item) => ({
        ...item,
        sourceSnapshot: item.sourceSnapshot
          ? { ...item.sourceSnapshot, failureReason: null }
          : null,
        reviewIssues: researchReviewIssues(item),
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async reviewItem(id: string) {
    const item = await this.prisma.researchItem.findFirst({
      where: {
        id,
        type: { in: [ResearchItemType.PAPER, ResearchItemType.DATASET] },
      },
      include: {
        ...RESEARCH_INCLUDE,
        contributors: {
          orderBy: { sortOrder: 'asc' },
          include: {
            person: { select: { id: true, fullName: true, slug: true } },
            matches: {
              include: {
                person: { select: { id: true, fullName: true, slug: true } },
                requestedBy: { select: { email: true } },
              },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
        sourceSnapshot: true,
        submittedBy: { include: { person: true } },
      },
    });
    if (!item) throw new NotFoundException('Review item not found');
    return {
      ...item,
      sourceSnapshot: item.sourceSnapshot
        ? { ...item.sourceSnapshot, failureReason: null }
        : null,
      reviewIssues: researchReviewIssues(item),
    };
  }

  async submit(dto: SubmitResearchDto, user: AuthenticatedUser) {
    const canonicalUrl = new URL(dto.canonicalUrl).toString();
    const existing = await this.prisma.researchItem.findUnique({
      where: { canonicalUrl },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('This URL is already registered');
    }

    const staff = user.role !== PlatformRole.MEMBER;
    let submittedById = user.id;
    let submittedForPersonId: string | undefined;
    if (staff) {
      if (!dto.submitterPersonId) {
        throw new BadRequestException(
          'Staff must select the registered person this record is being submitted for',
        );
      }
      const submitter = await this.prisma.person.findFirst({
        where: {
          id: dto.submitterPersonId,
          user: {
            is: { status: { in: [AccountStatus.ACTIVE, AccountStatus.PENDING_SETUP] } },
          },
        },
        select: { id: true, userId: true },
      });
      if (!submitter?.userId) {
        throw new BadRequestException(
          'The selected submitter does not have an available registered account',
        );
      }
      submittedById = submitter.userId;
      submittedForPersonId = submitter.id;
    } else if (dto.submitterPersonId && dto.submitterPersonId !== user.person?.id) {
      throw new BadRequestException('Members can only submit research for themselves');
    }

    const slugBase = dto.title
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const verification = await this.settings.verification();
    const mode =
      dto.type === ResearchItemType.PAPER
        ? verification.newPaper
        : verification.newDataset;
    if (dto.publishNow && user.role !== PlatformRole.ADMIN) {
      throw new BadRequestException('Only administrators can override review');
    }
    if (dto.publishNow && !dto.overrideReason?.trim()) {
      throw new BadRequestException('A publish-now override requires a reason');
    }
    const publishesDirectly = dto.publishNow === true || (!staff && mode === 'AUTOMATIC');
    const item = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.researchItem.create({
        data: {
          canonicalUrl,
          contributors: {
            create: dto.contributors.map((displayName, sortOrder) => ({
              displayName,
              sortOrder,
            })),
          },
          publishedAt: publishesDirectly ? new Date() : undefined,
          reviewedById: publishesDirectly ? user.id : undefined,
          reviewStatus: publishesDirectly
            ? ReviewStatus.PUBLISHED
            : ReviewStatus.NEEDS_REVIEW,
          slug: `${slugBase || 'research'}-${Date.now().toString(36)}`,
          submittedById,
          summary: dto.summary,
          title: dto.title,
          type: dto.type,
        },
      });
      if (dto.type === ResearchItemType.PAPER) {
        await transaction.paper.create({
          data: {
            citation: dto.citation,
            doi: dto.doi,
            publicationType: publicationCategory(
              dto.publicationType,
              dto.citation,
              dto.venue,
            ),
            researchItemId: created.id,
            venue: dto.venue,
            year: dto.year,
          },
        });
      } else {
        await transaction.dataset.create({
          data: {
            accessNotes: dto.accessNotes,
            license: dto.license,
            modality: dto.modality,
            researchItemId: created.id,
            version: dto.version,
          },
        });
      }
      if (publishesDirectly) {
        await transaction.auditRecord.create({
          data: {
            action: dto.publishNow
              ? 'research.published-admin-override'
              : 'research.published-directly',
            actorId: user.id,
            entityId: created.id,
            entityType: 'ResearchItem',
            details: dto.publishNow
              ? { reason: dto.overrideReason?.trim() }
              : undefined,
          },
        });
      }
      return created;
    });

    if (staff && submittedForPersonId) {
      await this.prisma.auditRecord.create({
        data: {
          action: 'research.submitted-on-behalf',
          actorId: user.id,
          entityId: item.id,
          entityType: 'ResearchItem',
          details: { submittedForPersonId },
        },
      });
    }

    if (!publishesDirectly) {
      await this.notifications.notifyReviewers({
        type: NotificationType.RESEARCH_SUBMITTED,
        title: 'Research submission needs review',
        body: item.title ?? 'Untitled research item',
        actionUrl: `/workspace/research/${item.id}`,
        payload: { researchItemId: item.id },
      });
    }
    await this.discovery.enqueue(item.id, canonicalUrl);
    return item;
  }

  async rediscover(id: string) {
    const item = await this.prisma.researchItem.findUnique({
      where: { id },
      select: { id: true, canonicalUrl: true, sourceSnapshot: true },
    });
    if (!item) throw new NotFoundException('Research item not found');
    if (!item.canonicalUrl) {
      throw new BadRequestException({
        code: 'CANONICAL_SOURCE_MISSING',
        publicMessage: 'This research record does not have a canonical source URL to check.',
        issues: [{
          code: 'CANONICAL_SOURCE_MISSING',
          itemId: item.id,
          message: 'No canonical source URL was provided for this record.',
          tone: 'warning',
        }],
      });
    }
    if (item.sourceSnapshot?.status === SourceFetchStatus.PENDING) {
      const activeJobId = await this.discovery.activeJobId(item.id);
      if (activeJobId) {
        return {
          deduplicated: true,
          jobId: activeJobId,
          status: SourceFetchStatus.PENDING,
        };
      }
    }
    const jobId = await this.discovery.enqueue(
      item.id,
      item.canonicalUrl,
      `research-source:${item.id}`,
    );
    return {
      deduplicated: false,
      jobId,
      status: SourceFetchStatus.PENDING,
    };
  }

  async bulkReview(
    dto: BulkReviewResearchDto,
    reviewer: AuthenticatedUser,
  ) {
    const ids = [...new Set(dto.ids)];
    if (ids.length !== dto.ids.length) {
      throw new BadRequestException('Duplicate research review IDs are not allowed');
    }
    const items = await this.prisma.researchItem.findMany({
      where: { id: { in: ids } },
      include: {
        contributors: {
          select: {
            personId: true,
            matches: { select: { status: true } },
          },
        },
        sourceSnapshot: { select: { status: true } },
      },
    });
    if (items.length !== ids.length) {
      throw new NotFoundException('One or more research items were not found');
    }
    if (
      items.some(
        ({ type }) =>
          type !== ResearchItemType.PAPER && type !== ResearchItemType.DATASET,
      )
    ) {
      throw new BadRequestException(
        'Paper and dataset review cannot manage project records',
      );
    }

    const reopening = dto.status === ReviewStatus.NEEDS_REVIEW;
    const validFromStatuses: ReviewStatus[] = reopening
      ? [ReviewStatus.PUBLISHED, ReviewStatus.REJECTED]
      : [ReviewStatus.NEEDS_REVIEW, ReviewStatus.CHANGES_REQUESTED];
    const invalidStatusItems = items.filter(
      ({ reviewStatus }) => !validFromStatuses.includes(reviewStatus),
    );
    if (invalidStatusItems.length) {
      throw reviewConflict(
        reopening
          ? 'Some selected research records cannot be reopened from their current state.'
          : 'Some selected research records are no longer awaiting this review decision.',
        invalidStatusItems.map(({ id }) => ({
          code: 'RESEARCH_REVIEW_CHANGED',
          itemId: id,
          message: reopening
            ? 'This research record cannot be reopened from its current state.'
            : 'This research record is no longer awaiting this review decision.',
          tone: 'warning',
        })),
      );
    }
    if (dto.status === ReviewStatus.PUBLISHED) {
      const pendingSourceItems = items.filter(
        ({ sourceSnapshot }) => sourceSnapshot?.status === SourceFetchStatus.PENDING,
      );
      if (pendingSourceItems.length) {
        throw reviewConflict(
          'Canonical source discovery is still in progress for some selected records.',
          pendingSourceItems.map(({ id }) => ({
            code: 'SOURCE_DISCOVERY_PENDING',
            itemId: id,
            message: 'Canonical source discovery is still in progress.',
            tone: 'pending',
          })),
        );
      }
    }
    if (dto.status === ReviewStatus.PUBLISHED) {
      const unresolvedContributorItems = items.filter(({ contributors }) =>
        contributors.some(({ matches }) =>
          matches.some(({ status }) => status === ContributorMatchStatus.PROPOSED),
        ),
      );
      if (unresolvedContributorItems.length) {
        throw reviewConflict(
          'Resolve proposed registered-person contributor matches before publishing.',
          unresolvedContributorItems.map(({ id }) => ({
            code: 'CONTRIBUTOR_MATCH_PENDING',
            itemId: id,
            message: 'A proposed registered-person contributor match still needs review.',
            tone: 'pending',
          })),
        );
      }
    }

    const reviewNote =
      dto.status === ReviewStatus.PUBLISHED ? undefined : dto.note?.trim();
    if (dto.status !== ReviewStatus.PUBLISHED && !reviewNote) {
      throw new BadRequestException('A reviewer note is required');
    }

    const reviewedAt = new Date();
    await this.prisma.$transaction(async (transaction) => {
      const rows = items.map(({ id, reviewStatus }) =>
        Prisma.sql`(${id}::uuid, ${reviewStatus}::"ReviewStatus")`,
      );
      const publishGuards =
        dto.status === ReviewStatus.PUBLISHED
          ? Prisma.sql`
              AND NOT EXISTS (
                SELECT 1
                FROM "ResearchSourceSnapshot" AS source
                WHERE source."researchItemId" = item."id"
                  AND source."status" = 'PENDING'::"SourceFetchStatus"
              )
              AND NOT EXISTS (
                SELECT 1
                FROM "ContributorMatch" AS match
                WHERE match."researchItemId" = item."id"
                  AND match."status" = 'PROPOSED'::"ContributorMatchStatus"
              )
            `
          : Prisma.empty;
      const updated = await transaction.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`
          UPDATE "ResearchItem" AS item
          SET
            "publishedAt" = ${
              dto.status === ReviewStatus.PUBLISHED ? reviewedAt : null
            },
            "reviewNote" = ${reviewNote ?? null},
            "reviewedById" = ${reviewer.id}::uuid,
            "reviewStatus" = ${dto.status}::"ReviewStatus",
            "updatedAt" = NOW()
          FROM (VALUES ${Prisma.join(rows)}) AS selected(id, from_status)
          WHERE item."id" = selected.id
            AND item."reviewStatus" = selected.from_status
            ${publishGuards}
          RETURNING item."id"
        `,
      );
      if (updated.length !== items.length) {
        const updatedIds = new Set(updated.map(({ id }) => id));
        throw reviewConflict(
          'Some research records changed or no longer pass review checks. Reload the queue and retry.',
          items
            .filter(({ id }) => !updatedIds.has(id))
            .map(({ id }) => ({
              code: 'RESEARCH_REVIEW_CHANGED',
              itemId: id,
              message: 'This research record changed or no longer passes the review checks.',
              tone: 'warning',
            })),
        );
      }

      await transaction.reviewRecord.createMany({
        data: items.map((item) => ({
          fromStatus: item.reviewStatus,
          note: reviewNote ?? null,
          researchItemId: item.id,
          reviewerId: reviewer.id,
          toStatus: dto.status,
        })),
      });
      if (dto.status === ReviewStatus.PUBLISHED) {
        await this.profileSync.normalizePublishedOutputs(
          ids,
          reviewer.id,
          transaction,
        );
      }
    });

    await this.notifications.createMany(
      items.flatMap((item) =>
        item.submittedById
          ? [
              {
                actionUrl: `/workspace/research/${item.id}`,
                body: `${item.title ?? 'Untitled research item'}: ${dto.status}`,
                payload: { researchItemId: item.id },
                recipientId: item.submittedById,
                title: reopening
                  ? 'Research record reopened'
                  : 'Research submission reviewed',
                type: NotificationType.RESEARCH_REVIEWED,
              },
            ]
          : [],
      ),
    );

    if (dto.status === ReviewStatus.PUBLISHED) {
      const contributorPersonIds = [
        ...new Set(
          items
            .filter(({ type }) => type === ResearchItemType.PAPER)
            .flatMap(({ contributors }) =>
              contributors.flatMap(({ personId }) => (personId ? [personId] : [])),
            ),
        ),
      ];
      await this.rankings.recalculateMany(contributorPersonIds, reviewer.id);
    }
    return { count: items.length, ids, status: dto.status };
  }

  async review(
    id: string,
    dto: ReviewResearchDto,
    reviewer: AuthenticatedUser,
  ) {
    const item = await this.prisma.researchItem.findUnique({
      where: { id },
      include: {
        contributors: { include: { matches: true } },
        sourceSnapshot: true,
        submittedBy: { include: { person: true } },
      },
    });
    if (!item) throw new NotFoundException('Research item not found');
    if (
      item.type !== ResearchItemType.PAPER &&
      item.type !== ResearchItemType.DATASET
    ) {
      throw new BadRequestException(
        'Paper and dataset review cannot manage project records',
      );
    }

    const reopening = dto.status === ReviewStatus.NEEDS_REVIEW;
    if (reopening) {
      if (
        item.reviewStatus !== ReviewStatus.PUBLISHED &&
        item.reviewStatus !== ReviewStatus.REJECTED
      ) {
        throw reviewConflict(
          'This research record cannot be reopened from its current state.',
          [{
            code: 'RESEARCH_REVIEW_CHANGED',
            itemId: item.id,
            message: 'This research record cannot be reopened from its current state.',
            tone: 'warning',
          }],
        );
      }
    } else if (
      item.reviewStatus !== ReviewStatus.NEEDS_REVIEW &&
      item.reviewStatus !== ReviewStatus.CHANGES_REQUESTED
    ) {
      throw reviewConflict(
        'This research record is no longer awaiting this review decision.',
        [{
          code: 'RESEARCH_REVIEW_CHANGED',
          itemId: item.id,
          message: 'This research record is no longer awaiting this review decision.',
          tone: 'warning',
        }],
      );
    }

    if (
      dto.status === ReviewStatus.PUBLISHED &&
      item.sourceSnapshot?.status === SourceFetchStatus.PENDING
    ) {
      throw reviewConflict(
        'Canonical source discovery is still in progress.',
        [{
          code: 'SOURCE_DISCOVERY_PENDING',
          itemId: item.id,
          message: 'Canonical source discovery is still in progress.',
          tone: 'pending',
        }],
      );
    }
    if (
      dto.status === ReviewStatus.PUBLISHED &&
      item.contributors.some((contributor) =>
        contributor.matches.some(
          (match) => match.status === ContributorMatchStatus.PROPOSED,
        ),
      )
    ) {
      throw reviewConflict(
        'Resolve proposed registered-person contributor matches before publishing.',
        [{
          code: 'CONTRIBUTOR_MATCH_PENDING',
          itemId: item.id,
          message: 'A proposed registered-person contributor match still needs review.',
          tone: 'pending',
        }],
      );
    }

    const reviewNote =
      dto.status === ReviewStatus.PUBLISHED ? undefined : dto.note?.trim();
    if (dto.status !== ReviewStatus.PUBLISHED && !reviewNote) {
      throw new BadRequestException('A reviewer note is required');
    }

    const updated = await this.prisma.$transaction(async (transaction) => {
      const result = await transaction.researchItem.update({
        where: { id },
        data: {
          publishedAt: dto.status === ReviewStatus.PUBLISHED ? new Date() : null,
          reviewNote: reviewNote ?? null,
          reviewedById: reviewer.id,
          reviewStatus: dto.status,
          reviews: {
            create: {
              fromStatus: item.reviewStatus,
              note: reviewNote ?? null,
              reviewerId: reviewer.id,
              toStatus: dto.status,
            },
          },
        },
      });
      if (dto.status === ReviewStatus.PUBLISHED) {
        await this.profileSync.normalizePublishedOutputs(
          [item.id],
          reviewer.id,
          transaction,
        );
      }
      return result;
    });

    if (item.submittedById) {
      await this.notifications.create(item.submittedById, {
        type: NotificationType.RESEARCH_REVIEWED,
        title: reopening ? 'Research record reopened' : 'Research submission reviewed',
        body: `${item.title ?? 'Untitled research item'}: ${dto.status}`,
        actionUrl: `/workspace/research/${item.id}`,
      });
    }
    if (
      item.type === ResearchItemType.PAPER &&
      dto.status === ReviewStatus.PUBLISHED
    ) {
      await Promise.all(
        item.contributors
          .filter(
            (
              contributor,
            ): contributor is typeof contributor & { personId: string } =>
              contributor.personId !== null,
          )
          .map((contributor) =>
            this.recalculateRank(contributor.personId, reviewer.id),
          ),
      );
    }
    return updated;
  }

  async updateReviewRecord(
    id: string,
    dto: SubmitResearchDto,
    reviewer: AuthenticatedUser,
  ) {
    const item = await this.prisma.researchItem.findUnique({
      where: { id },
      include: { contributors: true, dataset: true, paper: true },
    });
    if (!item) throw new NotFoundException('Research item not found');
    if (
      item.type !== ResearchItemType.PAPER &&
      item.type !== ResearchItemType.DATASET
    ) {
      throw new BadRequestException('Only papers and datasets can be edited here');
    }
    if (dto.type !== item.type) {
      throw new BadRequestException('Research record type cannot be changed');
    }
    const canonicalUrl = new URL(dto.canonicalUrl).toString();
    const duplicate = await this.prisma.researchItem.findFirst({
      where: { canonicalUrl, id: { not: id } },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException('This URL is already registered');

    await this.prisma.$transaction(async (transaction) => {
      await transaction.researchItem.update({
        where: { id },
        data: {
          canonicalUrl,
          contributors: {
            deleteMany: {},
            create: dto.contributors.map((displayName, sortOrder) => ({
              displayName,
              sortOrder,
            })),
          },
          publishedAt: null,
          reviewNote: 'Record edited by moderator; verification must be repeated.',
          reviewedById: reviewer.id,
          reviewStatus: ReviewStatus.NEEDS_REVIEW,
          reviews: {
            create: {
              fromStatus: item.reviewStatus,
              note: 'Record edited by moderator; verification must be repeated.',
              reviewerId: reviewer.id,
              toStatus: ReviewStatus.NEEDS_REVIEW,
            },
          },
          summary: dto.summary?.trim() || null,
          title: dto.title.trim(),
        },
      });
      if (item.type === ResearchItemType.PAPER) {
        await transaction.paper.update({
          where: { researchItemId: id },
          data: {
            citation: dto.citation ?? null,
            doi: dto.doi ?? null,
            publicationType: publicationCategory(
              dto.publicationType,
              dto.citation,
              dto.venue,
            ),
            venue: dto.venue ?? null,
            year: dto.year ?? null,
          },
        });
      } else {
        await transaction.dataset.update({
          where: { researchItemId: id },
          data: {
            accessNotes: dto.accessNotes ?? null,
            license: dto.license ?? null,
            modality: dto.modality ?? null,
            version: dto.version ?? null,
          },
        });
      }
      await transaction.auditRecord.create({
        data: {
          action: 'research.review-record-edited',
          actorId: reviewer.id,
          entityId: id,
          entityType: 'ResearchItem',
        },
      });
    });

    await this.discovery.enqueue(id, canonicalUrl, `research-source:${id}`);
    return this.reviewItem(id);
  }

  async recalculateRank(personId: string, actorId: string): Promise<void> {
    await this.rankings.recalculate(personId, actorId);
  }

}

function researchReviewIssues(item: {
  id: string;
  canonicalUrl?: string | null;
  sourceSnapshot?: { status: SourceFetchStatus } | null;
  contributors: Array<{
    matches?: Array<{ status: ContributorMatchStatus }>;
  }>;
}) {
  const issues: Array<{
    code: string;
    itemId: string;
    message: string;
    tone: 'error' | 'pending' | 'warning';
  }> = [];
  if (!item.canonicalUrl) {
    issues.push({
      code: 'CANONICAL_SOURCE_MISSING',
      itemId: item.id,
      message: 'No canonical source URL was provided. Manual source review is required.',
      tone: 'warning',
    });
  } else if (item.sourceSnapshot?.status === SourceFetchStatus.PENDING) {
    issues.push({
      code: 'SOURCE_DISCOVERY_PENDING',
      itemId: item.id,
      message: 'Canonical source discovery is still in progress.',
      tone: 'pending',
    });
  } else if (item.sourceSnapshot?.status === SourceFetchStatus.FAILED) {
    issues.push({
      code: 'SOURCE_DISCOVERY_FAILED',
      itemId: item.id,
      message: 'Canonical source discovery failed. Verify the source manually or retry.',
      tone: 'error',
    });
  } else if (item.sourceSnapshot?.status === SourceFetchStatus.UNAVAILABLE) {
    issues.push({
      code: 'SOURCE_METADATA_UNAVAILABLE',
      itemId: item.id,
      message: 'No machine-readable source metadata was found. Manual verification is available.',
      tone: 'warning',
    });
  }
  if (
    item.contributors.some(({ matches = [] }) =>
      matches.some(({ status }) => status === ContributorMatchStatus.PROPOSED),
    )
  ) {
    issues.push({
      code: 'CONTRIBUTOR_MATCH_PENDING',
      itemId: item.id,
      message: 'A proposed registered-person contributor match still needs review.',
      tone: 'pending',
    });
  }
  return issues;
}

function publicResearchWhere(
  type?: ResearchItemType,
): Prisma.ResearchItemWhereInput {
  return {
    reviewStatus: ReviewStatus.PUBLISHED,
    ...(type ? { type } : {}),
    ...(type === ResearchItemType.PROJECT
      ? { project: { is: { publicPageEnabled: true } } }
      : type
        ? {}
        : {
            OR: [
              { type: { not: ResearchItemType.PROJECT } },
              { project: { is: { publicPageEnabled: true } } },
            ],
          }),
  };
}

export function publicPositionWhere(now: Date): Prisma.PositionWhereInput {
  return {
    status: PositionStatus.OPEN,
    AND: [
      { OR: [{ opensAt: null }, { opensAt: { lte: now } }] },
      { OR: [{ closesAt: null }, { closesAt: { gte: now } }] },
    ],
  };
}

function positionData(
  dto: CreatePositionDto | UpdatePositionDto,
): Prisma.PositionUncheckedUpdateInput {
  return {
    ...(dto.closesAt !== undefined
      ? { closesAt: dto.closesAt ? new Date(dto.closesAt) : null }
      : {}),
    ...(dto.departmentId !== undefined
      ? { departmentId: dto.departmentId }
      : {}),
    ...(dto.description !== undefined
      ? { description: emptyToNull(dto.description) }
      : {}),
    ...(dto.engagementDurationLabel !== undefined
      ? { engagementDurationLabel: emptyToNull(dto.engagementDurationLabel) }
      : {}),
    ...(dto.engagementEndsAt !== undefined
      ? {
          engagementEndsAt: dto.engagementEndsAt
            ? new Date(dto.engagementEndsAt)
            : null,
        }
      : {}),
    ...(dto.engagementStartsAt !== undefined
      ? {
          engagementStartsAt: dto.engagementStartsAt
            ? new Date(dto.engagementStartsAt)
            : null,
        }
      : {}),
    ...(dto.engagementType !== undefined
      ? { engagementType: dto.engagementType }
      : {}),
    ...(dto.opensAt !== undefined
      ? { opensAt: dto.opensAt ? new Date(dto.opensAt) : null }
      : {}),
    ...(dto.positionType !== undefined
      ? { positionType: dto.positionType }
      : {}),
    ...(dto.requirements !== undefined
      ? { requirements: cleanList(dto.requirements) }
      : {}),
    ...(dto.responsibilities !== undefined
      ? { responsibilities: cleanList(dto.responsibilities) }
      : {}),
    ...(dto.summary !== undefined ? { summary: dto.summary.trim() } : {}),
    ...(dto.targetRank !== undefined ? { targetRank: dto.targetRank } : {}),
    ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
  };
}

function validatePositionTiming(dto: Partial<CreatePositionDto>): void {
  const opensAt = dto.opensAt ? new Date(dto.opensAt) : null;
  const closesAt = dto.closesAt
    ? new Date(dto.closesAt)
    : dto.deadline
      ? new Date(dto.deadline)
      : null;
  if (opensAt && closesAt && closesAt <= opensAt) {
    throw new BadRequestException(
      'Position close date must be after open date',
    );
  }

  const startsAt = dto.engagementStartsAt
    ? new Date(dto.engagementStartsAt)
    : null;
  const endsAt = dto.engagementEndsAt ? new Date(dto.engagementEndsAt) : null;
  if (startsAt && endsAt && endsAt <= startsAt) {
    throw new BadRequestException(
      'Engagement end date must be after start date',
    );
  }

  const engagementType = dto.engagementType ?? EngagementType.FIXED_TERM;
  const duration = dto.engagementDurationLabel?.trim();
  if (engagementType === EngagementType.FIXED_TERM && !endsAt && !duration) {
    throw new BadRequestException(
      'Fixed-term positions need an end date or duration',
    );
  }
  if (engagementType === EngagementType.OPEN_ENDED && endsAt) {
    throw new BadRequestException(
      'Open-ended positions cannot have an engagement end date',
    );
  }
  if (engagementType === EngagementType.FLEXIBLE && !duration) {
    throw new BadRequestException('Flexible positions need a duration label');
  }
}

function valueOrIso(
  next: string | undefined,
  current: Date | null,
): string | undefined {
  if (next !== undefined) return next;
  return current?.toISOString();
}

function cleanList(values: string[]): string[] {
  return values.map((value) => value.trim()).filter(Boolean);
}

function emptyToNull(value?: string): string | null {
  return value?.trim() || null;
}

function publicPerson<
  T extends {
    appointedRank: Parameters<typeof effectiveRank>[0];
    earnedRank: Parameters<typeof effectiveRank>[1];
  },
>(person: T) {
  return {
    ...person,
    rank: effectiveRank(person.appointedRank, person.earnedRank),
  };
}

function comparePeople(
  left: ReturnType<typeof publicPerson> & {
    fullName: string;
    isAlumni: boolean;
    metrics?: {
      publishedPaperCount: number;
      scholarCitationCount: number | null;
    } | null;
  },
  right: ReturnType<typeof publicPerson> & {
    fullName: string;
    isAlumni: boolean;
    metrics?: {
      publishedPaperCount: number;
      scholarCitationCount: number | null;
    } | null;
  },
): number {
  if (left.isAlumni !== right.isAlumni) return left.isAlumni ? 1 : -1;
  const rankOrder = [
    'RESEARCH_INTERN',
    'RESEARCH_ASSISTANT',
    'RESEARCHER',
    'SENIOR_RESEARCHER',
    'LEAD_RESEARCHER',
    'DEPARTMENT_HEAD',
    'ADVISOR',
  ];
  const rankDifference =
    rankOrder.indexOf(right.rank ?? '') - rankOrder.indexOf(left.rank ?? '');
  if (rankDifference) return rankDifference;
  const citationDifference =
    (right.metrics?.scholarCitationCount ?? -1) -
    (left.metrics?.scholarCitationCount ?? -1);
  if (citationDifference) return citationDifference;
  const paperDifference =
    (right.metrics?.publishedPaperCount ?? 0) -
    (left.metrics?.publishedPaperCount ?? 0);
  return paperDifference || left.fullName.localeCompare(right.fullName);
}
