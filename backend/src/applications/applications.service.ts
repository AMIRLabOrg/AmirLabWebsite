import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { PDFParse } from 'pdf-parse';
import {
  AcademicRank,
  AccountStatus,
  type Application,
  ApplicationStatus,
  AssetAccess,
  NotificationType,
  PlatformRole,
  Prisma,
} from '../../generated/prisma/client';
import { AssetsService } from '../assets/assets.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { JobsService } from '../jobs/jobs.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SettingsService } from '../settings/settings.service';
import { reviewConflict } from '../common/review-problem';
import { publicPositionWhere } from '../research/research.service';
import { buildPersonSlug } from '../users/person-slug';
import type {
  ReviewApplicationDto,
  SubmitApplicationDto,
} from './dto/application.dto';
import {
  ApplicationQueryDto,
  ApplicationSort,
} from './dto/application-query.dto';
import {
  assessResumeText,
  type ParsedResumeText,
  type ResumeAssessment,
} from './resume-assessment';
import {
  appointmentSnapshot,
  AppointmentLettersService,
  SEND_APPOINTMENT_LETTER_JOB,
} from './appointment-letters.service';

const SEND_APPLICATION_REJECTION_JOB = 'SEND_APPLICATION_REJECTION';

@Injectable()
export class ApplicationsService implements OnModuleInit {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(
    private readonly assets: AssetsService,
    private readonly appointmentLetters: AppointmentLettersService,
    private readonly jobs: JobsService,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  onModuleInit(): void {
    this.jobs.register('PARSE_APPLICATION', async (payload) => {
      if (!payload || Array.isArray(payload) || typeof payload !== 'object') {
        throw new Error('Application parsing payload must be an object');
      }
      const applicationId = payload.applicationId;
      if (typeof applicationId !== 'string') {
        throw new Error('Application parsing payload needs applicationId');
      }
      await this.parse(applicationId);
    });
    this.jobs.register(SEND_APPLICATION_REJECTION_JOB, async (payload) => {
      if (!payload || Array.isArray(payload) || typeof payload !== 'object') {
        throw new Error('Application rejection payload must be an object');
      }
      const applicationId = payload.applicationId;
      if (typeof applicationId !== 'string') {
        throw new Error('Application rejection payload needs applicationId');
      }
      const application = await this.prisma.application.findUnique({
        where: { id: applicationId },
        include: { position: true },
      });
      if (!application || application.status !== ApplicationStatus.REJECTED)
        return;
      await this.mail.sendNow({
        to: application.email,
        subject: 'Update on your AmirLab application',
        text: `Thank you for applying for ${application.position.title}. We are unable to move forward with your application.\n\nFeedback: ${application.decisionReason ?? 'The application was not selected.'}`,
      });
    });
  }

  async submit(
    dto: SubmitApplicationDto,
    file: Express.Multer.File,
    profileImage?: Express.Multer.File,
  ) {
    if (!dto.consent) {
      throw new BadRequestException('Consent is required');
    }
    const position = await this.prisma.position.findFirst({
      where: {
        id: dto.positionId,
        ...publicPositionWhere(new Date()),
      },
    });
    if (!position) {
      throw new NotFoundException('Open position not found');
    }

    const asset = await this.assets.storeCv(file);
    let profileImageAsset: { id: string } | undefined;

    let application: Application;
    try {
      let assessment: ResumeAssessment;
      try {
        ({ assessment } = await this.assessPdf(file.buffer));
      } catch {
        throw new BadRequestException(
          'CV PDF could not be read. Upload a digital PDF with selectable text.',
        );
      }
      if (!assessment.accepted) {
        throw new BadRequestException(assessment.feedback);
      }
      if (profileImage) {
        profileImageAsset = await this.assets.storeAvatar(
          profileImage,
          undefined,
          AssetAccess.PRIVATE,
        );
      }
      application = await this.prisma.application.create({
        data: {
          consentedAt: new Date(),
          cvAssetId: asset.id,
          departmentId: position.departmentId,
          email: dto.email.trim().toLowerCase(),
          events: { create: { toStatus: ApplicationStatus.PARSING } },
          fullName: dto.fullName.trim(),
          phone: dto.phone,
          positionId: position.id,
          profileImageAssetId: profileImageAsset?.id,
          relevantLinks: [],
        },
      });
    } catch (error) {
      await this.assets.remove(asset.id);
      if (profileImageAsset) await this.assets.remove(profileImageAsset.id);
      throw error;
    }
    await this.jobs.enqueue(
      'PARSE_APPLICATION',
      { applicationId: application.id },
      `parse-application:${application.id}`,
    );
    await this.notifications.notifyReviewers({
      type: NotificationType.APPLICATION_RECEIVED,
      title: 'New application received',
      body: `A CV was submitted for ${position.title} and is being parsed.`,
      actionUrl: `/workspace/applications/${application.id}`,
      payload: { applicationId: application.id },
    });
    return { id: application.id, status: application.status };
  }

  async list(query: ApplicationQueryDto) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (query.from) createdAt.gte = new Date(query.from);
    if (query.to) {
      const end = new Date(query.to);
      end.setUTCHours(23, 59, 59, 999);
      createdAt.lte = end;
    }
    const search = query.search?.trim();
    const where: Prisma.ApplicationWhereInput = {
      status: query.status ?? {
        in: [
          ApplicationStatus.NEEDS_REVIEW,
          ApplicationStatus.ACCEPTED,
          ApplicationStatus.REJECTED,
        ],
      },
      ...(query.from || query.to ? { createdAt } : {}),
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              {
                position: {
                  title: { contains: search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };
    const orderBy: Prisma.ApplicationOrderByWithRelationInput =
      query.sort === ApplicationSort.NAME
        ? { fullName: 'asc' }
        : { createdAt: query.sort === ApplicationSort.OLDEST ? 'asc' : 'desc' };
    const [items, total] = await Promise.all([
      this.prisma.application.findMany({
        where,
        select: {
          id: true,
          fullName: true,
          email: true,
          status: true,
          createdAt: true,
          position: { select: { title: true } },
        },
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.application.count({ where }),
    ]);
    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async get(id: string) {
    const application = await this.prisma.application.findUnique({
      where: { id },
      include: {
        appointmentLetter: {
          select: {
            emailSentAt: true,
            lastEmailError: true,
            pdfChecksum: true,
            pdfData: true,
          },
        },
        events: { orderBy: { createdAt: 'asc' } },
        position: true,
      },
    });
    if (!application) {
      throw new NotFoundException('Application not found');
    }
    return {
      ...application,
      appointmentLetter: application.appointmentLetter
        ? {
            emailSentAt: application.appointmentLetter.emailSentAt,
            lastEmailError: application.appointmentLetter.lastEmailError,
            pdfChecksum: application.appointmentLetter.pdfChecksum,
            ready: Boolean(application.appointmentLetter.pdfData),
          }
        : null,
      parseFeedback:
        application.status === ApplicationStatus.PARSE_FAILED
          ? 'The uploaded PDF could not be processed automatically.'
          : application.parseFeedback,
      events: application.events.map((event) => ({
        ...event,
        note:
          event.toStatus === ApplicationStatus.PARSE_FAILED
            ? 'Automatic CV processing could not read this file.'
            : event.note,
      })),
    };
  }

  async readCv(id: string) {
    const application = await this.prisma.application.findUnique({
      where: { id },
      select: { cvAssetId: true },
    });
    if (!application) {
      throw new NotFoundException('Application not found');
    }
    return this.assets.readCv(application.cvAssetId);
  }

  previewAppointmentLetter() {
    return this.appointmentLetters.preview();
  }

  readAppointmentLetter(id: string) {
    return this.appointmentLetters.read(id);
  }

  async review(
    id: string,
    dto: ReviewApplicationDto,
    reviewer: AuthenticatedUser,
  ): Promise<{ status: ApplicationStatus }> {
    if (
      dto.status !== ApplicationStatus.ACCEPTED &&
      dto.status !== ApplicationStatus.REJECTED
    ) {
      throw new BadRequestException('Decision must be ACCEPTED or REJECTED');
    }
    const application = await this.prisma.application.findUnique({
      where: { id },
      include: { position: true },
    });
    if (!application) {
      throw new NotFoundException('Application not found');
    }
    if (application.status !== ApplicationStatus.NEEDS_REVIEW) {
      throw reviewConflict(
        'This application is no longer awaiting a decision.',
        [
          {
            code: 'APPLICATION_REVIEW_CHANGED',
            itemId: application.id,
            message: 'This application is no longer awaiting a decision.',
            tone: 'warning',
          },
        ],
      );
    }

    if (dto.status === ApplicationStatus.REJECTED) {
      const reason = dto.reason?.trim();
      if (!reason) {
        throw new BadRequestException('A rejection reason is required');
      }
      const policy = await this.settings.notificationPolicy();
      await this.prisma.$transaction(async (transaction) => {
        await transaction.application.update({
          where: { id },
          data: {
            decisionReason: reason,
            events: {
              create: {
                actorId: reviewer.id,
                fromStatus: application.status,
                note: reason,
                toStatus: ApplicationStatus.REJECTED,
              },
            },
            reviewedAt: new Date(),
            reviewedById: reviewer.id,
            status: ApplicationStatus.REJECTED,
          },
        });
        if (policy.applicationRejected) {
          await transaction.job.create({
            data: {
              type: SEND_APPLICATION_REJECTION_JOB,
              payload: { applicationId: application.id },
              uniqueKey: `application-rejected:${application.id}`,
            },
          });
        }
      });
      return { status: ApplicationStatus.REJECTED };
    }

    const [template, policy] = await Promise.all([
      this.settings.appointmentLetter(),
      this.settings.notificationPolicy(),
    ]);
    const reviewedAt = new Date();
    await this.prisma.$transaction(async (transaction) => {
      const account = await transaction.user.upsert({
        where: { email: application.email },
        create: {
          email: application.email,
          role: PlatformRole.MEMBER,
          status: AccountStatus.PENDING_SETUP,
        },
        update: {},
        include: { person: true },
      });
      const profileImageAssetId = account.person?.avatarId
        ? null
        : application.profileImageAssetId;
      if (!account.person) {
        await transaction.person.create({
          data: {
            avatarId: profileImageAssetId ?? undefined,
            fullName: application.fullName,
            isPublished: false,
            appointedRank:
              application.position.targetRank ?? AcademicRank.RESEARCH_INTERN,
            slug: buildPersonSlug(application.fullName, application.id),
            userId: account.id,
          },
        });
      } else if (profileImageAssetId) {
        await transaction.person.update({
          where: { id: account.person.id },
          data: { avatarId: profileImageAssetId },
        });
      }
      if (profileImageAssetId) {
        await transaction.asset.update({
          where: { id: profileImageAssetId },
          data: { access: AssetAccess.PUBLIC, createdById: account.id },
        });
      }
      await transaction.application.update({
        where: { id },
        data: {
          decisionReason: null,
          events: {
            create: {
              actorId: reviewer.id,
              fromStatus: application.status,
              note: null,
              toStatus: ApplicationStatus.ACCEPTED,
            },
          },
          reviewedAt,
          reviewedById: reviewer.id,
          status: ApplicationStatus.ACCEPTED,
        },
      });
      await transaction.auditRecord.create({
        data: {
          action: 'application.accepted',
          actorId: reviewer.id,
          entityId: application.id,
          entityType: 'Application',
          details: { userId: account.id },
        },
      });
      if (policy.applicationAccepted) {
        const letter = await transaction.appointmentLetter.create({
          data: {
            applicationId: application.id,
            templateMarkdown: template.markdown,
            templateVersion: template.version,
            snapshot: appointmentSnapshot(template, {
              applicationId: application.id,
              applicantEmail: application.email,
              applicantName: application.fullName,
              duration: application.position.engagementDurationLabel,
              endsAt: application.position.engagementEndsAt,
              issueDate: reviewedAt,
              positionSlug: application.position.slug,
              positionTitle: application.position.title,
              responsibilities: application.position.responsibilities,
              startsAt: application.position.engagementStartsAt,
              weeklyCommitmentHours: application.position.weeklyCommitmentHours,
            }),
          },
        });
        await transaction.job.create({
          data: {
            type: SEND_APPOINTMENT_LETTER_JOB,
            payload: { appointmentLetterId: letter.id },
            uniqueKey: `appointment-letter:${letter.id}`,
          },
        });
      }
    });
    return { status: ApplicationStatus.ACCEPTED };
  }

  private async parse(applicationId: string): Promise<void> {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: { position: true },
    });
    if (!application || application.status !== ApplicationStatus.PARSING) {
      return;
    }

    let extractedText = '';
    let feedback: string;
    let accepted = false;
    let fullName = application.fullName;
    let email = application.email;
    let phone = application.phone;
    let parsedResume: Prisma.InputJsonValue | undefined;
    try {
      const cv = await this.assets.readCv(application.cvAssetId);
      const result = await this.assessPdf(cv.buffer);
      extractedText = result.text;
      accepted = result.assessment.accepted;
      feedback = result.assessment.feedback;
      fullName = result.assessment.resume.profile.fullName ?? fullName;
      email = result.assessment.resume.profile.email?.toLowerCase() ?? email;
      phone = result.assessment.resume.profile.phone ?? phone;
      parsedResume = parsedResumeToJson(result.assessment.resume);
    } catch (error) {
      this.logger.warn(
        `Application ${application.id} PDF parsing failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      feedback =
        'The uploaded PDF could not be processed automatically. Please use a text-based PDF with clear section headings.';
    }

    const status = accepted
      ? ApplicationStatus.NEEDS_REVIEW
      : ApplicationStatus.PARSE_FAILED;
    await this.prisma.application.update({
      where: { id: application.id },
      data: {
        email,
        events: {
          create: {
            fromStatus: ApplicationStatus.PARSING,
            note: feedback,
            toStatus: status,
          },
        },
        extractedText,
        fullName,
        parseFeedback: feedback,
        parsedResume,
        phone,
        status,
      },
    });

    if (!accepted) {
      await this.mail.queue(
        {
          to: email,
          subject: 'Your CV needs an ATS-friendly update',
          text: `We could not process your CV for ${application.position.title}. ${feedback}\n\nPlease export a text-based PDF with clear section headings and apply again.`,
        },
        `application-parse-failed:${application.id}`,
      );
      return;
    }

    await this.notifications.notifyReviewers({
      type: NotificationType.APPLICATION_PARSED,
      title: 'Application ready for review',
      body: `${fullName}'s CV passed the ATS check.`,
      actionUrl: `/workspace/applications/${application.id}`,
      payload: { applicationId: application.id },
    });
    const reviewers = await this.prisma.user.findMany({
      where: {
        role: { in: [PlatformRole.MODERATOR, PlatformRole.ADMIN] },
        status: AccountStatus.ACTIVE,
      },
      select: { email: true },
    });
    await Promise.all(
      reviewers.flatMap(({ email }) =>
        email
          ? [
              this.mail.queue(
                {
                  to: email,
                  subject: 'AMIR Lab application ready for review',
                  text: `${fullName} applied for ${application.position.title}. Review it in the admin workspace.`,
                },
                `application-ready:${application.id}:${email}`,
              ),
            ]
          : [],
      ),
    );
  }

  private async assessPdf(buffer: Buffer) {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return {
        assessment: assessResumeText(result.text, result.total),
        text: result.text,
      };
    } finally {
      await parser.destroy();
    }
  }
}

function parsedResumeToJson(resume: ParsedResumeText): Prisma.InputJsonObject {
  const sections = Object.fromEntries(
    Object.entries(resume.sections).map(([name, entries]) => [
      name,
      [...entries],
    ]),
  );
  return {
    parser: resume.parser,
    profile: {
      fullName: resume.profile.fullName,
      email: resume.profile.email,
      phone: resume.profile.phone,
    },
    sections,
    textLength: resume.textLength,
    pageCount: resume.pageCount,
  };
}
