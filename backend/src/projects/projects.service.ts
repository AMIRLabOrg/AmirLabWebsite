import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import {
  AccountStatus,
  ConversationKind,
  MessageKind,
  NotificationType,
  PlatformRole,
  ProjectAccess,
  ProjectChangeKind,
  ProjectChangeStatus,
  ProjectInvitationStatus,
  ProjectMemberRole,
  ProjectMembershipStatus,
  ProjectMilestoneStatus,
  ProjectUpdateStatus,
  ResearchItemType,
  ReviewStatus,
  ProjectStatus,
} from '../../generated/prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CollaborationGateway } from '../collaboration/collaboration.gateway';
import type { Environment } from '../config/environment';
import { PrismaService } from '../database/prisma.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SettingsService } from '../settings/settings.service';
import type {
  CreateProjectDto,
  CreateProjectTaskDto,
  ProjectInvitationDto,
  ProjectOutputDto,
  ProjectResourceDto,
  ProjectUpdateDto,
  ReplaceMilestonesDto,
  ReviewProjectChangeDto,
  UpdateProjectDto,
  UpdateProjectTaskDto,
} from './dto/project.dto';
import { accessibleProjectWhere } from './project-access';

const PROJECT_INCLUDE = {
  researchItem: {
    include: {
      departments: { include: { department: true } },
      contributors: {
        orderBy: { sortOrder: 'asc' as const },
        include: { person: true },
      },
      projectOutputs: {
        include: {
          output: { include: { paper: true, dataset: true, project: true } },
        },
      },
    },
  },
  objectives: { orderBy: { sortOrder: 'asc' as const } },
  milestones: {
    orderBy: { sortOrder: 'asc' as const },
    include: { owner: true },
  },
  tasks: {
    orderBy: { sortOrder: 'asc' as const },
    include: { owner: true },
  },
  updates: {
    orderBy: { createdAt: 'desc' as const },
    include: { author: { include: { person: true } } },
  },
  memberships: {
    orderBy: { createdAt: 'asc' as const },
    include: { person: { include: { avatar: true, user: true } } },
  },
  invitations: { orderBy: { createdAt: 'desc' as const } },
  resources: { orderBy: { sortOrder: 'asc' as const } },
  changeRequests: {
    where: { status: ProjectChangeStatus.NEEDS_REVIEW },
    orderBy: { submittedAt: 'desc' as const },
  },
} as const;

const PROJECT_ACCOUNT_STATUSES: AccountStatus[] = [
  AccountStatus.ACTIVE,
  AccountStatus.PENDING_SETUP,
];

@Injectable()
export class ProjectsService {
  constructor(
    private readonly collaboration: CollaborationGateway,
    private readonly config: ConfigService<Environment, true>,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async options() {
    const [people, departments] = await this.prisma.$transaction([
      this.prisma.person.findMany({
        where: {
          user: { is: { status: { in: PROJECT_ACCOUNT_STATUSES } } },
        },
        select: {
          id: true,
          fullName: true,
          headline: true,
          roleTitle: true,
          departments: {
            select: { departmentId: true, isPrimary: true },
          },
        },
        orderBy: { fullName: 'asc' },
      }),
      this.prisma.department.findMany({
        select: { id: true, name: true, abbreviation: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    return { departments, people };
  }

  async create(dto: CreateProjectDto, user: AuthenticatedUser) {
    const staff = user.role !== PlatformRole.MEMBER;
    if (!staff && !user.person) {
      throw new ForbiddenException('A registered person account is required');
    }
    if (staff && !dto.ownerPersonId) {
      throw new BadRequestException(
        'Staff must select the registered person this project is being created for',
      );
    }
    if (!staff && dto.ownerPersonId && dto.ownerPersonId !== user.person?.id) {
      throw new ForbiddenException('Members can only create projects for themselves');
    }
    if (dto.startsAt && dto.endsAt && dto.endsAt < dto.startsAt) {
      throw new BadRequestException(
        'Project end date must follow its start date',
      );
    }

    const ownerPersonId = staff ? dto.ownerPersonId! : user.person!.id;
    const contributorPersonIds = [
      ownerPersonId,
      ...dto.contributorPersonIds.filter((id) => id !== ownerPersonId),
    ];
    if (new Set(contributorPersonIds).size !== contributorPersonIds.length) {
      throw new BadRequestException('A contributor can only be selected once');
    }
    const [department, people] = await this.prisma.$transaction([
      this.prisma.department.findUnique({
        where: { id: dto.departmentId },
        select: { id: true },
      }),
      this.prisma.person.findMany({
        where: {
          id: { in: contributorPersonIds },
          user: { is: { status: { in: PROJECT_ACCOUNT_STATUSES } } },
        },
        select: { id: true, fullName: true, userId: true },
      }),
    ]);
    if (!department) throw new BadRequestException('Department not found');
    if (people.length !== contributorPersonIds.length) {
      throw new BadRequestException(
        'Every project contributor must have an available registered account',
      );
    }
    const peopleById = new Map(people.map((person) => [person.id, person]));
    const orderedPeople = contributorPersonIds.map((id) => peopleById.get(id)!);
    const ownerPerson = peopleById.get(ownerPersonId)!;
    const created = await this.prisma.$transaction(async (transaction) => {
      const item = await transaction.researchItem.create({
        data: {
          contributors: {
            create: orderedPeople.map((person, sortOrder) => ({
              displayName: person.fullName,
              personId: person.id,
              sortOrder,
            })),
          },
          departments: { create: { departmentId: dto.departmentId } },
          reviewStatus: ReviewStatus.DRAFT,
          slug: projectSlug(dto.title),
          submittedById: ownerPerson.userId!,
          summary: dto.summary?.trim() || null,
          title: dto.title.trim(),
          type: ResearchItemType.PROJECT,
        },
      });
      await transaction.project.create({
        data: {
          conversations: {
            create: {
              kind: ConversationKind.PROJECT,
              title: dto.title.trim(),
              members: {
                create: orderedPeople.map((person) => ({
                  userId: person.userId!,
                })),
              },
              messages: {
                create: {
                  body: staff
                    ? `${user.email ?? 'Staff'} created the project on behalf of ${ownerPerson.fullName}.`
                    : `${ownerPerson.fullName} created the project.`,
                  kind: MessageKind.SYSTEM,
                  senderId: user.id,
                },
              },
            },
          },
          endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
          memberships: {
            create: orderedPeople.map((person) => {
              const owner = person.id === ownerPersonId;
              return {
                access: owner
                  ? ProjectAccess.MANAGE
                  : ProjectAccess.POST_UPDATES,
                personId: person.id,
                role: owner
                  ? ProjectMemberRole.OWNER
                  : ProjectMemberRole.CONTRIBUTOR,
                status: ProjectMembershipStatus.ACTIVE,
              };
            }),
          },
          objective: dto.objective.trim(),
          publicPageEnabled: false,
          researchItemId: item.id,
          startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
          status: dto.status ?? ProjectStatus.PLANNED,
        },
      });
      await transaction.auditRecord.create({
        data: {
          action: staff ? 'project.created-on-behalf' : 'project.created',
          actorId: user.id,
          entityId: item.id,
          entityType: 'Project',
          details: {
            contributorPersonIds,
            departmentId: dto.departmentId,
            ownerPersonId,
          },
        },
      });
      return item.id;
    });
    await Promise.all(
      orderedPeople
        .filter((person) => person.userId !== user.id)
        .map((person) =>
          this.notifications.create(person.userId!, {
            type: NotificationType.PROJECT_CHANGED,
            title: 'Added to a project',
            body: dto.title.trim(),
            actionUrl: `/workspace/projects/${created}`,
          }),
        ),
    );
    await this.broadcastLatestActivity(created);
    return withProgress(await this.project(created));
  }

  async mine(user: AuthenticatedUser) {
    const projects = await this.prisma.project.findMany({
      where: accessibleProjectWhere(user),
      include: PROJECT_INCLUDE,
      orderBy: { researchItem: { updatedAt: 'desc' } },
    });
    return projects.map(withProgress);
  }

  async workspace(id: string, user: AuthenticatedUser) {
    await this.authorize(id, user, ProjectAccess.VIEW, true);
    return withProgress(await this.project(id));
  }

  async update(id: string, dto: UpdateProjectDto, user: AuthenticatedUser) {
    await this.authorize(id, user, ProjectAccess.MANAGE);
    return this.applyOrQueue(id, ProjectChangeKind.DETAILS, dto, user);
  }

  async replaceMilestones(
    id: string,
    dto: ReplaceMilestonesDto,
    user: AuthenticatedUser,
  ) {
    await this.authorize(id, user, ProjectAccess.MANAGE);
    const total = dto.milestones.reduce(
      (sum, milestone) => sum + milestone.weight,
      0,
    );
    const project = await this.project(id);
    if (project.publicPageEnabled && total !== 100) {
      throw new BadRequestException(
        'Public projects must allocate exactly 100% milestone weight',
      );
    }
    return this.applyOrQueue(id, ProjectChangeKind.MILESTONES, dto, user);
  }

  async createTask(
    id: string,
    dto: CreateProjectTaskDto,
    user: AuthenticatedUser,
  ) {
    await this.authorize(id, user, ProjectAccess.POST_UPDATES);
    await this.assertTaskOwner(id, dto.ownerId);
    const sortOrder = await this.prisma.projectTask.count({
      where: { projectId: id },
    });
    const task = await this.prisma.projectTask.create({
      data: {
        createdById: user.id,
        description: dto.description?.trim() || null,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
        ownerId: dto.ownerId || null,
        priority: dto.priority,
        projectId: id,
        sortOrder,
        status: dto.status ?? 'TODO',
        title: dto.title.trim(),
      },
      include: { owner: true },
    });
    await this.recordActivityText(id, user.id, `created task “${task.title}”`);
    return task;
  }

  async updateTask(
    id: string,
    taskId: string,
    dto: UpdateProjectTaskDto,
    user: AuthenticatedUser,
  ) {
    await this.authorize(id, user, ProjectAccess.POST_UPDATES);
    await this.assertTask(id, taskId);
    await this.assertTaskOwner(id, dto.ownerId);
    const task = await this.prisma.projectTask.update({
      where: { id: taskId },
      data: {
        completedAt: dto.status === 'DONE' ? new Date() : null,
        description: dto.description?.trim() || null,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
        ownerId: dto.ownerId || null,
        priority: dto.priority,
        status: dto.status,
        title: dto.title.trim(),
      },
      include: { owner: true },
    });
    await this.recordActivityText(id, user.id, `updated task “${task.title}”`);
    return task;
  }

  async deleteTask(id: string, taskId: string, user: AuthenticatedUser) {
    await this.authorize(id, user, ProjectAccess.POST_UPDATES);
    const task = await this.assertTask(id, taskId);
    await this.prisma.projectTask.delete({ where: { id: taskId } });
    await this.recordActivityText(id, user.id, `removed task “${task.title}”`);
    return { deleted: true };
  }

  async updatePost(id: string, dto: ProjectUpdateDto, user: AuthenticatedUser) {
    await this.authorize(id, user, ProjectAccess.POST_UPDATES);
    if (dto.status === ProjectUpdateStatus.DRAFT) {
      return this.applyChange(id, ProjectChangeKind.UPDATE, dto, user.id);
    }
    return this.applyOrQueue(id, ProjectChangeKind.UPDATE, dto, user);
  }

  async invite(id: string, dto: ProjectInvitationDto, user: AuthenticatedUser) {
    await this.authorize(id, user, ProjectAccess.MANAGE);
    if (
      (dto.role === ProjectMemberRole.OWNER ||
        dto.role === ProjectMemberRole.MANAGER) &&
      dto.access !== ProjectAccess.MANAGE
    ) {
      throw new BadRequestException(
        'Project owners and managers must have manage access',
      );
    }
    return this.applyOrQueue(id, ProjectChangeKind.TEAM, dto, user);
  }

  async acceptInvitation(token: string, user: AuthenticatedUser) {
    if (!user.email || !user.person) {
      throw new ForbiddenException('A verified person account is required');
    }
    const invitation = await this.prisma.projectInvitation.findUnique({
      where: { tokenHash: createHash('sha256').update(token).digest('hex') },
    });
    if (
      !invitation ||
      invitation.status !== ProjectInvitationStatus.PENDING ||
      invitation.expiresAt <= new Date() ||
      invitation.email !== user.email.toLowerCase()
    ) {
      throw new ForbiddenException('Project invitation is invalid or expired');
    }
    await this.prisma.$transaction([
      this.prisma.projectMembership.upsert({
        where: {
          projectId_personId: {
            projectId: invitation.projectId,
            personId: user.person.id,
          },
        },
        create: {
          access: invitation.access,
          personId: user.person.id,
          projectId: invitation.projectId,
          role: invitation.role,
          status: ProjectMembershipStatus.ACTIVE,
        },
        update: {
          access: invitation.access,
          role: invitation.role,
          status: ProjectMembershipStatus.ACTIVE,
        },
      }),
      this.prisma.projectInvitation.update({
        where: { id: invitation.id },
        data: {
          acceptedAt: new Date(),
          status: ProjectInvitationStatus.ACCEPTED,
        },
      }),
    ]);
    return { accepted: true, projectId: invitation.projectId };
  }

  async linkOutput(id: string, dto: ProjectOutputDto, user: AuthenticatedUser) {
    await this.authorize(id, user, ProjectAccess.MANAGE);
    const output = await this.prisma.researchItem.findFirst({
      where: {
        id: dto.outputId,
        reviewStatus: ReviewStatus.PUBLISHED,
        type: { not: ResearchItemType.PROJECT },
      },
    });
    if (!output)
      throw new BadRequestException(
        'Only published papers or datasets can be linked',
      );
    return this.applyOrQueue(id, ProjectChangeKind.OUTPUT, dto, user);
  }

  async addResource(
    id: string,
    dto: ProjectResourceDto,
    user: AuthenticatedUser,
  ) {
    await this.authorize(id, user, ProjectAccess.MANAGE);
    return this.applyOrQueue(id, ProjectChangeKind.RESOURCE, dto, user);
  }

  async archive(
    id: string,
    input: { publishNow?: boolean; overrideReason?: string },
    user: AuthenticatedUser,
  ) {
    await this.authorize(id, user, ProjectAccess.MANAGE);
    return this.applyOrQueue(id, ProjectChangeKind.ARCHIVE, input, user);
  }

  reviewQueue() {
    return this.prisma.projectChangeRequest.findMany({
      where: { status: ProjectChangeStatus.NEEDS_REVIEW },
      include: {
        project: { include: { researchItem: true } },
        submittedBy: { include: { person: true } },
      },
      orderBy: { submittedAt: 'asc' },
    });
  }

  async review(
    id: string,
    dto: ReviewProjectChangeDto,
    reviewer: AuthenticatedUser,
  ) {
    if (
      dto.status !== ProjectChangeStatus.APPROVED &&
      dto.status !== ProjectChangeStatus.REJECTED
    ) {
      throw new BadRequestException('Decision must be approved or rejected');
    }
    const request = await this.prisma.projectChangeRequest.findUnique({
      where: { id },
      include: { project: true },
    });
    if (!request || request.status !== ProjectChangeStatus.NEEDS_REVIEW) {
      throw new NotFoundException('Pending project change not found');
    }
    const reviewNote =
      dto.status === ProjectChangeStatus.REJECTED
        ? dto.note?.trim()
        : undefined;
    if (dto.status === ProjectChangeStatus.REJECTED && !reviewNote) {
      throw new BadRequestException('A reviewer note is required');
    }
    if (dto.status === ProjectChangeStatus.APPROVED) {
      if (request.project.version !== request.baseVersion) {
        await this.prisma.projectChangeRequest.update({
          where: { id },
          data: {
            note: 'Project changed after this request was submitted',
            reviewedAt: new Date(),
            reviewedById: reviewer.id,
            status: ProjectChangeStatus.STALE,
          },
        });
        throw new ConflictException('Project change is stale');
      }
      await this.applyChange(
        request.projectId,
        request.kind,
        request.payload,
        request.submittedById,
      );
    }
    await this.prisma.projectChangeRequest.update({
      where: { id },
      data: {
        note: reviewNote ?? null,
        reviewedAt: new Date(),
        reviewedById: reviewer.id,
        status: dto.status,
      },
    });
    await this.notifications.create(request.submittedById, {
      type: NotificationType.PROJECT_CHANGED,
      title: `Project change ${dto.status.toLowerCase()}`,
      body:
        reviewNote ?? `Your ${request.kind.toLowerCase()} change was reviewed.`,
      actionUrl: `/workspace/projects/${request.projectId}`,
    });
    return { status: dto.status };
  }

  private async applyOrQueue(
    projectId: string,
    kind: ProjectChangeKind,
    input: { publishNow?: boolean; overrideReason?: string },
    user: AuthenticatedUser,
  ) {
    const policy = await this.settings.verification();
    if (input.publishNow && user.role !== PlatformRole.ADMIN) {
      throw new ForbiddenException('Only administrators can override review');
    }
    if (input.publishNow && !input.overrideReason?.trim()) {
      throw new BadRequestException('A publish-now override requires a reason');
    }
    const payload = stripOverride(input);
    if (policy.updateProject === 'AUTOMATIC' || input.publishNow) {
      const result = await this.applyChange(projectId, kind, payload, user.id);
      if (input.publishNow) {
        await this.prisma.auditRecord.create({
          data: {
            action: 'project.change-admin-override',
            actorId: user.id,
            entityId: projectId,
            entityType: 'Project',
            details: { kind, reason: input.overrideReason?.trim() },
          },
        });
      }
      return { direct: true, result };
    }
    const project = await this.project(projectId);
    const request = await this.prisma.projectChangeRequest.create({
      data: {
        baseVersion: project.version,
        kind,
        payload,
        projectId,
        submittedById: user.id,
      },
    });
    await this.notifications.notifyReviewers({
      type: NotificationType.PROJECT_REVIEW_NEEDED,
      title: 'Project change needs review',
      body: `${project.researchItem.title ?? 'Project'}: ${kind.toLowerCase()}`,
      actionUrl: '/workspace/project-reviews',
      payload: { projectChangeRequestId: request.id },
    });
    return { direct: false, request };
  }

  private async applyChange(
    projectId: string,
    kind: ProjectChangeKind,
    raw: unknown,
    actorId: string,
  ): Promise<unknown> {
    const payload = asRecord(raw);
    let result: unknown;
    let shouldIncrementVersion = false;
    if (kind === ProjectChangeKind.DETAILS) {
      const objectives = Array.isArray(payload.objectives)
        ? payload.objectives.map(asRecord)
        : [];
      const publicPageEnabled = Boolean(payload.publicPageEnabled);
      result = await this.prisma.$transaction(async (transaction) => {
        await transaction.researchItem.update({
          where: { id: projectId },
          data: {
            publishedAt: publicPageEnabled ? new Date() : undefined,
            reviewStatus: publicPageEnabled
              ? ReviewStatus.PUBLISHED
              : undefined,
            summary: optionalString(payload.summary),
            title: requiredString(payload.title),
          },
        });
        const project = await transaction.project.update({
          where: { researchItemId: projectId },
          data: {
            endsAt: optionalDate(payload.endsAt),
            objective: optionalString(payload.objective),
            publicPageEnabled,
            startsAt: optionalDate(payload.startsAt),
            status: payload.status as never,
            version: { increment: 1 },
            objectives: {
              deleteMany: {},
              create: objectives.map((objective, sortOrder) => ({
                description: optionalString(objective.description),
                sortOrder,
                title: requiredString(objective.title),
              })),
            },
          },
        });
        await transaction.conversation.updateMany({
          where: { kind: ConversationKind.PROJECT, projectId },
          data: { title: requiredString(payload.title) },
        });
        return project;
      });
    } else if (kind === ProjectChangeKind.MILESTONES) {
      const milestones = Array.isArray(payload.milestones)
        ? payload.milestones.map(asRecord)
        : [];
      result = await this.prisma.project.update({
        where: { researchItemId: projectId },
        data: {
          version: { increment: 1 },
          milestones: {
            deleteMany: {},
            create: milestones.map((milestone, sortOrder) => ({
              completedAt:
                milestone.status === ProjectMilestoneStatus.COMPLETE
                  ? new Date()
                  : null,
              description: optionalString(milestone.description),
              dueAt: optionalDate(milestone.dueAt),
              ownerId: optionalString(milestone.ownerId),
              progress:
                milestone.status === ProjectMilestoneStatus.COMPLETE
                  ? 100
                  : milestone.status === ProjectMilestoneStatus.PLANNED ||
                      milestone.status === ProjectMilestoneStatus.BLOCKED
                    ? 0
                    : Number(milestone.progress),
              sortOrder,
              status: milestone.status as never,
              title: requiredString(milestone.title),
              weight: Number(milestone.weight),
            })),
          },
        },
      });
    } else if (kind === ProjectChangeKind.UPDATE) {
      const status = payload.status as ProjectUpdateStatus;
      result = await this.prisma.projectUpdate.create({
        data: {
          authorId: actorId,
          body: requiredString(payload.body),
          linkedOutputId: optionalString(payload.linkedOutputId),
          milestoneId: optionalString(payload.milestoneId),
          projectId,
          publishedAt:
            status === ProjectUpdateStatus.PUBLISHED ? new Date() : null,
          status,
          title: requiredString(payload.title),
        },
      });
      shouldIncrementVersion = status === ProjectUpdateStatus.PUBLISHED;
    } else if (kind === ProjectChangeKind.TEAM) {
      result = await this.createInvitation(projectId, payload, actorId);
      shouldIncrementVersion = true;
    } else if (kind === ProjectChangeKind.OUTPUT) {
      result = await this.prisma.projectOutput.upsert({
        where: {
          projectId_outputId: {
            projectId,
            outputId: requiredString(payload.outputId),
          },
        },
        create: { projectId, outputId: requiredString(payload.outputId) },
        update: {},
      });
      shouldIncrementVersion = true;
    } else if (kind === ProjectChangeKind.RESOURCE) {
      const sortOrder = await this.prisma.projectResource.count({
        where: { projectId },
      });
      result = await this.prisma.projectResource.create({
        data: {
          kind: requiredString(payload.kind),
          label: requiredString(payload.label),
          projectId,
          sortOrder,
          url: requiredString(payload.url),
        },
      });
      shouldIncrementVersion = true;
    } else if (kind === ProjectChangeKind.ARCHIVE) {
      result = await this.prisma.$transaction([
        this.prisma.researchItem.update({
          where: { id: projectId },
          data: { reviewStatus: ReviewStatus.ARCHIVED },
        }),
        this.prisma.project.update({
          where: { researchItemId: projectId },
          data: { publicPageEnabled: false, version: { increment: 1 } },
        }),
      ]);
    } else {
      throw new BadRequestException(`Unsupported project change: ${kind}`);
    }
    if (shouldIncrementVersion) {
      await this.prisma.project.update({
        where: { researchItemId: projectId },
        data: { version: { increment: 1 } },
      });
    }
    await this.prisma.auditRecord.create({
      data: {
        action: 'project.change-applied',
        actorId,
        entityId: projectId,
        entityType: 'Project',
        details: { kind },
      },
    });
    await this.recordActivity(projectId, actorId, kind);
    return result;
  }

  private async recordActivity(
    projectId: string,
    actorId: string,
    kind: ProjectChangeKind,
  ) {
    return this.recordActivityText(projectId, actorId, activityLabel(kind));
  }

  private async recordActivityText(
    projectId: string,
    actorId: string,
    activity: string,
  ) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { kind: ConversationKind.PROJECT, projectId },
      select: { id: true },
    });
    if (!conversation) return;
    const actor = await this.prisma.user.findUnique({
      where: { id: actorId },
      select: { person: { select: { fullName: true } } },
    });
    const message = await this.prisma.message.create({
      data: {
        body: `${actor?.person?.fullName ?? 'A project member'} ${activity}.`,
        conversationId: conversation.id,
        kind: MessageKind.SYSTEM,
        senderId: actorId,
      },
      include: {
        sender: {
          select: {
            id: true,
            person: {
              select: { fullName: true, avatar: { select: { id: true } } },
            },
          },
        },
      },
    });
    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });
    await this.collaboration.broadcastMessage(message);
  }

  private async assertTask(projectId: string, taskId: string) {
    const task = await this.prisma.projectTask.findFirst({
      where: { id: taskId, projectId },
    });
    if (!task) throw new NotFoundException('Project task not found');
    return task;
  }

  private async assertTaskOwner(projectId: string, ownerId?: string | null) {
    if (!ownerId) return;
    const membership = await this.prisma.projectMembership.findUnique({
      where: { projectId_personId: { projectId, personId: ownerId } },
    });
    if (membership?.status !== ProjectMembershipStatus.ACTIVE) {
      throw new BadRequestException(
        'Task owner must be an active project member',
      );
    }
  }

  private async broadcastLatestActivity(projectId: string) {
    const message = await this.prisma.message.findFirst({
      where: {
        kind: MessageKind.SYSTEM,
        conversation: { projectId },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        sender: {
          select: {
            id: true,
            person: {
              select: { fullName: true, avatar: { select: { id: true } } },
            },
          },
        },
      },
    });
    if (message) await this.collaboration.broadcastMessage(message);
  }

  private async createInvitation(
    projectId: string,
    payload: Record<string, unknown>,
    actorId: string,
  ) {
    const personId =
      typeof payload.personId === 'string' ? payload.personId.trim() : '';
    const invitedPerson = personId
      ? await this.prisma.person.findUnique({
          where: { id: personId },
          include: { user: true },
        })
      : null;
    if (personId) {
      if (
        !invitedPerson?.user ||
        !PROJECT_ACCOUNT_STATUSES.includes(invitedPerson.user.status)
      ) {
        throw new BadRequestException(
          'Project members must have available registered accounts',
        );
      }
      const conversation = await this.prisma.conversation.findFirst({
        where: { kind: ConversationKind.PROJECT, projectId },
        select: { id: true },
      });
      const membership = await this.prisma.$transaction(async (transaction) => {
        const saved = await transaction.projectMembership.upsert({
          where: { projectId_personId: { projectId, personId } },
          create: {
            access: payload.access as never,
            personId,
            projectId,
            role: payload.role as never,
            status: ProjectMembershipStatus.ACTIVE,
          },
          update: {
            access: payload.access as never,
            role: payload.role as never,
            status: ProjectMembershipStatus.ACTIVE,
          },
        });
        if (conversation) {
          await transaction.conversationMember.upsert({
            where: {
              conversationId_userId: {
                conversationId: conversation.id,
                userId: invitedPerson.user!.id,
              },
            },
            create: {
              conversationId: conversation.id,
              userId: invitedPerson.user!.id,
            },
            update: {},
          });
        }
        return saved;
      });
      await this.notifications.create(invitedPerson.user.id, {
        type: NotificationType.PROJECT_CHANGED,
        title: 'Added to a project',
        body: 'You now have access to an AMIR Lab project workspace.',
        actionUrl: `/workspace/projects/${projectId}`,
      });
      return membership;
    }
    const email = (invitedPerson?.user?.email ?? requiredString(payload.email))
      .trim()
      .toLowerCase();
    const token = randomBytes(32).toString('base64url');
    const invitation = await this.prisma.projectInvitation.create({
      data: {
        access: payload.access as never,
        email,
        expiresAt: new Date(Date.now() + 14 * DAY),
        invitedById: actorId,
        projectId,
        role: payload.role as never,
        tokenHash: createHash('sha256').update(token).digest('hex'),
      },
      include: { project: { include: { researchItem: true } } },
    });
    const account = await this.prisma.user.findUnique({ where: { email } });
    const frontend = this.config.get('frontendOrigins', { infer: true })[0];
    const link = `${frontend}/workspace/project-invitations?token=${encodeURIComponent(token)}`;
    await this.mail.queue(
      {
        to: email,
        subject: `Invitation to ${invitation.project.researchItem.title ?? 'an AMIR Lab project'}`,
        text: `You were invited to an AMIR Lab project. Sign in with this email and accept within 14 days:\n\n${link}\n\nExternal invitees receive no project access until their AMIR Lab account and identity are verified.`,
      },
      `project-invitation:${invitation.id}`,
    );
    if (account) {
      await this.notifications.create(account.id, {
        type: NotificationType.PROJECT_INVITED,
        title: 'Project invitation',
        body: invitation.project.researchItem.title ?? 'AMIR Lab project',
        actionUrl: `/workspace/project-invitations?token=${encodeURIComponent(token)}`,
      });
    }
    return { id: invitation.id, expiresAt: invitation.expiresAt };
  }

  private async authorize(
    projectId: string,
    user: AuthenticatedUser,
    required: ProjectAccess,
    reviewersMayView = false,
  ): Promise<void> {
    if (user.role === PlatformRole.ADMIN) return;
    if (reviewersMayView && user.role === PlatformRole.MODERATOR) return;
    if (!user.person) throw new ForbiddenException('Project access required');
    const membership = await this.prisma.projectMembership.findUnique({
      where: { projectId_personId: { projectId, personId: user.person.id } },
    });
    if (!membership || membership.status !== ProjectMembershipStatus.ACTIVE) {
      throw new ForbiddenException('Project access required');
    }
    const level = { VIEW: 0, POST_UPDATES: 1, MANAGE: 2 };
    if (level[membership.access] < level[required]) {
      throw new ForbiddenException('Project access is insufficient');
    }
  }

  private async project(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { researchItemId: id },
      include: PROJECT_INCLUDE,
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }
}

const DAY = 86_400_000;

function withProgress<
  T extends { milestones: Array<{ progress: number; weight: number }> },
>(project: T) {
  const progress = Math.round(
    project.milestones.reduce(
      (total, milestone) =>
        total + (milestone.weight * milestone.progress) / 100,
      0,
    ),
  );
  return { ...project, progress };
}

function stripOverride<
  T extends { publishNow?: boolean; overrideReason?: string },
>(value: T) {
  const payload = { ...value };
  delete payload.publishNow;
  delete payload.overrideReason;
  return payload;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    throw new BadRequestException('Project change payload must be an object');
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException('Project change is missing a required value');
  }
  return value.trim();
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function optionalDate(value: unknown): Date | null {
  return typeof value === 'string' && value ? new Date(value) : null;
}

function projectSlug(title: string): string {
  const base = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `${base || 'project'}-${randomBytes(4).toString('hex')}`;
}

function activityLabel(kind: ProjectChangeKind): string {
  const labels: Record<ProjectChangeKind, string> = {
    ARCHIVE: 'archived the project',
    DETAILS: 'updated the project details',
    MILESTONES: 'updated the project milestones',
    OUTPUT: 'linked a research output',
    RESOURCE: 'added a project resource',
    SETTINGS: 'updated the project settings',
    TEAM: 'updated the project team',
    UPDATE: 'posted a project update',
  };
  return labels[kind];
}
