import { BadRequestException, Injectable } from '@nestjs/common';
import { AcademicRank, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { RECALCULATE_ALL_RANKS_JOB } from '../jobs/job-types';
import { JobsService } from '../jobs/jobs.service';

export type VerificationMode = 'AUTOMATIC' | 'MANUAL';

export interface VerificationPolicy {
  profileEdit: VerificationMode;
  newPaper: VerificationMode;
  newDataset: VerificationMode;
  newProject: VerificationMode;
  updateProject: VerificationMode;
}

export interface RankPolicy {
  seniorPaperMinimum: number;
  seniorCitationMinimum: number;
  leadPaperMinimum: number;
  leadCitationMinimum: number;
}

export interface AppointmentLetterTemplate {
  version: number;
  markdown: string;
  signerName: string;
  signerTitle: string;
  signerEmail: string;
  signerPhone: string;
  siteUrl: string;
  siteEmail: string;
  siteLocation: string;
}

export interface NotificationPolicy {
  applicationAccepted: boolean;
  applicationRejected: boolean;
  taskAssigned: boolean;
  taskChanged: boolean;
  milestoneProgress: boolean;
  deadlineReminder: boolean;
  deadlineDue: boolean;
  deadlineOverdue: boolean;
  reminderDays: number;
}

export const APPOINTMENT_TEMPLATE_VARIABLES = [
  { label: 'Applicant name', token: '{{applicant.name}}', required: true },
  { label: 'Applicant email', token: '{{applicant.email}}', required: false },
  { label: 'Position title', token: '{{position.title}}', required: true },
  { label: 'Position URL', token: '{{position.url}}', required: false },
  { label: 'Start date', token: '{{position.startDate}}', required: false },
  { label: 'End date', token: '{{position.endDate}}', required: false },
  { label: 'Duration', token: '{{position.duration}}', required: false },
  {
    label: 'Weekly commitment',
    token: '{{position.weeklyCommitment}}',
    required: false,
  },
  {
    label: 'Responsibilities',
    token: '{{position.responsibilities}}',
    required: true,
  },
  { label: 'Issue date', token: '{{letter.issueDate}}', required: false },
  { label: 'Reference', token: '{{letter.reference}}', required: false },
  { label: 'Website', token: '{{site.url}}', required: false },
  { label: 'Lab email', token: '{{site.email}}', required: false },
  { label: 'Signer name', token: '{{signer.name}}', required: false },
  { label: 'Signer title', token: '{{signer.title}}', required: false },
  { label: 'Signer email', token: '{{signer.email}}', required: false },
] as const;

export const DEFAULT_VERIFICATION_POLICY: VerificationPolicy = {
  profileEdit: 'MANUAL',
  newPaper: 'MANUAL',
  newDataset: 'MANUAL',
  newProject: 'MANUAL',
  updateProject: 'AUTOMATIC',
};

export const DEFAULT_RANK_POLICY: RankPolicy = {
  seniorPaperMinimum: 3,
  seniorCitationMinimum: 50,
  leadPaperMinimum: 20,
  leadCitationMinimum: 500,
};

export const DEFAULT_APPOINTMENT_LETTER_TEMPLATE: AppointmentLetterTemplate = {
  version: 1,
  markdown: `Dear {{applicant.name}},

We are pleased to appoint you as **{{position.title}}** at the Advanced Machine Intelligence Research Lab. This appointment begins on {{position.startDate}} and continues until {{position.endDate}}.

## Responsibilities

{{position.responsibilities}}

We look forward to your contribution to AmirLab's research activities and to the perspective you will bring to our team.`,
  signerName: 'Prof. Dr. Mohammad Firoz Mridha',
  signerTitle: 'Founder & Research Director',
  signerEmail: 'firoz.mridha@aiub.edu',
  signerPhone: '+8801674791594',
  siteUrl: 'https://amirl.org',
  siteEmail: 'amirlab.org@gmail.com',
  siteLocation: 'Dhaka, Bangladesh',
};

export const DEFAULT_NOTIFICATION_POLICY: NotificationPolicy = {
  applicationAccepted: true,
  applicationRejected: true,
  taskAssigned: true,
  taskChanged: true,
  milestoneProgress: true,
  deadlineReminder: true,
  deadlineDue: true,
  deadlineOverdue: true,
  reminderDays: 3,
};

const VERIFICATION_KEY = 'verification-policy';
const RANK_KEY = 'rank-policy';
const REDIRECT_URL_KEY = 'redirect-url';
const APPOINTMENT_LETTER_KEY = 'appointment-letter-template';
const NOTIFICATION_POLICY_KEY = 'notification-policy';
const DEFAULT_REDIRECT_URL = 'https://amirlab.org';

@Injectable()
export class SettingsService {
  constructor(
    private readonly jobs: JobsService,
    private readonly prisma: PrismaService,
  ) {}

  async verification(): Promise<VerificationPolicy> {
    const setting = await this.prisma.siteSetting.findUnique({
      where: { key: VERIFICATION_KEY },
    });
    return parseVerificationPolicy(setting?.value);
  }

  async ranking(): Promise<RankPolicy> {
    const setting = await this.prisma.siteSetting.findUnique({
      where: { key: RANK_KEY },
    });
    return parseRankPolicy(setting?.value);
  }

  async appointmentLetter(): Promise<AppointmentLetterTemplate> {
    const setting = await this.prisma.siteSetting.findUnique({
      where: { key: APPOINTMENT_LETTER_KEY },
    });
    return validateAppointmentLetterTemplate(setting?.value);
  }

  async notificationPolicy(): Promise<NotificationPolicy> {
    const setting = await this.prisma.siteSetting.findUnique({
      where: { key: NOTIFICATION_POLICY_KEY },
    });
    return parseNotificationPolicy(setting?.value);
  }

  async updateVerification(
    value: VerificationPolicy,
    actorId: string,
  ): Promise<VerificationPolicy> {
    const parsed = parseVerificationPolicy(value);
    const json = verificationPolicyToJson(parsed);
    await this.prisma.$transaction(async (transaction) => {
      await transaction.siteSetting.upsert({
        where: { key: VERIFICATION_KEY },
        create: {
          key: VERIFICATION_KEY,
          value: json,
        },
        update: { value: json },
      });
      await transaction.auditRecord.create({
        data: {
          action: 'settings.verification-updated',
          actorId,
          entityId: VERIFICATION_KEY,
          entityType: 'SiteSetting',
          details: json,
        },
      });
    });
    return parsed;
  }

  async updateRanking(value: RankPolicy, actorId: string): Promise<RankPolicy> {
    const parsed = parseRankPolicy(value);
    const json = rankPolicyToJson(parsed);
    await this.prisma.$transaction(async (transaction) => {
      await transaction.siteSetting.upsert({
        where: { key: RANK_KEY },
        create: {
          key: RANK_KEY,
          value: json,
        },
        update: { value: json },
      });
      await transaction.auditRecord.create({
        data: {
          action: 'settings.rank-policy-updated',
          actorId,
          entityId: RANK_KEY,
          entityType: 'SiteSetting',
          details: json,
        },
      });
    });
    await this.jobs.enqueueWhileActive(
      RECALCULATE_ALL_RANKS_JOB,
      {},
      'rank-policy:recalculate-all',
    );
    return parsed;
  }

  async updateAppointmentLetter(
    value: Omit<AppointmentLetterTemplate, 'version'>,
    actorId: string,
  ): Promise<AppointmentLetterTemplate> {
    const current = await this.appointmentLetter();
    const parsed = validateAppointmentLetterTemplate({
      ...value,
      version: current.version + 1,
    });
    const json = objectToJson(parsed);
    await this.saveSetting(
      APPOINTMENT_LETTER_KEY,
      json,
      'settings.appointment-letter-updated',
      actorId,
    );
    return parsed;
  }

  async updateNotificationPolicy(
    value: NotificationPolicy,
    actorId: string,
  ): Promise<NotificationPolicy> {
    const parsed = parseNotificationPolicy(value);
    await this.saveSetting(
      NOTIFICATION_POLICY_KEY,
      objectToJson(parsed),
      'settings.notification-policy-updated',
      actorId,
    );
    return parsed;
  }

  async redirectUrl(): Promise<{ url: string }> {
    const setting = await this.prisma.siteSetting.findUnique({
      where: { key: REDIRECT_URL_KEY },
    });
    const url =
      typeof setting?.value === 'string' && setting.value
        ? setting.value
        : DEFAULT_REDIRECT_URL;
    return { url };
  }

  async updateRedirectUrl(
    value: string,
    actorId: string,
  ): Promise<{ url: string }> {
    const url = value.trim() || DEFAULT_REDIRECT_URL;
    await this.prisma.$transaction(async (transaction) => {
      await transaction.siteSetting.upsert({
        where: { key: REDIRECT_URL_KEY },
        create: {
          key: REDIRECT_URL_KEY,
          value: url,
        },
        update: { value: url },
      });
      await transaction.auditRecord.create({
        data: {
          action: 'settings.redirect-url-updated',
          actorId,
          entityId: REDIRECT_URL_KEY,
          entityType: 'SiteSetting',
          details: { url },
        },
      });
    });
    return { url };
  }

  private async saveSetting(
    key: string,
    value: Prisma.InputJsonObject,
    action: string,
    actorId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      await transaction.siteSetting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });
      await transaction.auditRecord.create({
        data: {
          action,
          actorId,
          entityId: key,
          entityType: 'SiteSetting',
          details: value,
        },
      });
    });
  }
}

export function earnedRank(
  paperCount: number,
  citationCount: number | null,
  policy: RankPolicy,
): AcademicRank | null {
  const qualifies = (paperMinimum: number, citationMinimum: number) =>
    paperCount >= paperMinimum &&
    (citationCount === null || citationCount >= citationMinimum);
  if (qualifies(policy.leadPaperMinimum, policy.leadCitationMinimum)) {
    return AcademicRank.LEAD_RESEARCHER;
  }
  if (qualifies(policy.seniorPaperMinimum, policy.seniorCitationMinimum)) {
    return AcademicRank.SENIOR_RESEARCHER;
  }
  return null;
}

const RANK_LEVEL: Record<AcademicRank, number> = {
  RESEARCH_INTERN: 0,
  RESEARCH_ASSISTANT: 1,
  RESEARCHER: 2,
  SENIOR_RESEARCHER: 3,
  LEAD_RESEARCHER: 4,
  DEPARTMENT_HEAD: 5,
  ADVISOR: 6,
};

export function effectiveRank(
  appointed: AcademicRank | null,
  earned: AcademicRank | null,
): AcademicRank | null {
  if (!appointed) return earned;
  if (!earned) return appointed;
  return RANK_LEVEL[appointed] >= RANK_LEVEL[earned] ? appointed : earned;
}

function parseVerificationPolicy(value: unknown): VerificationPolicy {
  const candidate = isRecord(value) ? value : {};
  return {
    profileEdit: verificationMode(
      candidate.profileEdit,
      DEFAULT_VERIFICATION_POLICY.profileEdit,
    ),
    newPaper: verificationMode(
      candidate.newPaper,
      DEFAULT_VERIFICATION_POLICY.newPaper,
    ),
    newDataset: verificationMode(
      candidate.newDataset,
      DEFAULT_VERIFICATION_POLICY.newDataset,
    ),
    newProject: verificationMode(
      candidate.newProject,
      DEFAULT_VERIFICATION_POLICY.newProject,
    ),
    updateProject: verificationMode(
      candidate.updateProject,
      DEFAULT_VERIFICATION_POLICY.updateProject,
    ),
  };
}

function verificationMode(
  value: unknown,
  fallback: VerificationMode,
): VerificationMode {
  return value === 'AUTOMATIC' || value === 'MANUAL' ? value : fallback;
}

function verificationPolicyToJson(
  policy: VerificationPolicy,
): Prisma.InputJsonObject {
  return {
    profileEdit: policy.profileEdit,
    newPaper: policy.newPaper,
    newDataset: policy.newDataset,
    newProject: policy.newProject,
    updateProject: policy.updateProject,
  };
}

function rankPolicyToJson(policy: RankPolicy): Prisma.InputJsonObject {
  return {
    seniorPaperMinimum: policy.seniorPaperMinimum,
    seniorCitationMinimum: policy.seniorCitationMinimum,
    leadPaperMinimum: policy.leadPaperMinimum,
    leadCitationMinimum: policy.leadCitationMinimum,
  };
}

function parseRankPolicy(value: unknown): RankPolicy {
  const candidate = isRecord(value) ? value : {};
  const parsed: RankPolicy = {
    seniorPaperMinimum: integer(
      candidate.seniorPaperMinimum,
      DEFAULT_RANK_POLICY.seniorPaperMinimum,
    ),
    seniorCitationMinimum: integer(
      candidate.seniorCitationMinimum,
      DEFAULT_RANK_POLICY.seniorCitationMinimum,
    ),
    leadPaperMinimum: integer(
      candidate.leadPaperMinimum,
      DEFAULT_RANK_POLICY.leadPaperMinimum,
    ),
    leadCitationMinimum: integer(
      candidate.leadCitationMinimum,
      DEFAULT_RANK_POLICY.leadCitationMinimum,
    ),
  };
  if (
    parsed.leadPaperMinimum < parsed.seniorPaperMinimum ||
    parsed.leadCitationMinimum < parsed.seniorCitationMinimum
  ) {
    throw new BadRequestException(
      'Lead rank thresholds cannot be lower than senior rank thresholds',
    );
  }
  return parsed;
}

export function validateAppointmentLetterTemplate(
  value: unknown,
): AppointmentLetterTemplate {
  const candidate = isRecord(value) ? value : {};
  const text = (key: keyof AppointmentLetterTemplate, maxLength: number) => {
    const fallback = String(DEFAULT_APPOINTMENT_LETTER_TEMPLATE[key]);
    const result =
      typeof candidate[key] === 'string' && candidate[key].trim()
        ? candidate[key].trim()
        : fallback;
    if (
      result.length > maxLength ||
      hasControlCharacter(result) ||
      /[<>{}]/.test(result)
    ) {
      throw new BadRequestException(`Invalid appointment ${key}`);
    }
    return result;
  };
  const markdown =
    typeof candidate.markdown === 'string' && candidate.markdown.trim()
      ? candidate.markdown.trim()
      : DEFAULT_APPOINTMENT_LETTER_TEMPLATE.markdown;
  if (markdown.length > 20_000 || hasControlCharacter(markdown, true)) {
    throw new BadRequestException(
      'Appointment template contains invalid characters',
    );
  }
  if (/[<>]/.test(markdown) || /!?\[[^\]]*\]\([^)]*\)/.test(markdown)) {
    throw new BadRequestException(
      'Appointment templates cannot contain HTML, images, or links',
    );
  }
  const placeholders = [...markdown.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)];
  const allowed = new Set(
    APPOINTMENT_TEMPLATE_VARIABLES.map(({ token }) => token.slice(2, -2)),
  );
  for (const { token, required } of APPOINTMENT_TEMPLATE_VARIABLES) {
    if (
      required &&
      !placeholders.some((match) => match[1] === token.slice(2, -2))
    ) {
      throw new BadRequestException(
        `Appointment template must include ${token}`,
      );
    }
  }
  for (const match of placeholders) {
    if (!allowed.has(match[1])) {
      throw new BadRequestException(
        `Unknown appointment placeholder: {{${match[1]}}}`,
      );
    }
  }
  if (
    markdown.replace(/\{\{\s*[^{}]+?\s*\}\}/g, '').includes('{{') ||
    markdown.replace(/\{\{\s*[^{}]+?\s*\}\}/g, '').includes('}}')
  ) {
    throw new BadRequestException(
      'Appointment template has an unclosed placeholder',
    );
  }
  if (!/^\s*\{\{\s*position\.responsibilities\s*\}\}\s*$/m.test(markdown)) {
    throw new BadRequestException(
      'The responsibilities variable must be on its own line',
    );
  }
  const signerEmail = text('signerEmail', 254);
  const siteEmail = text('siteEmail', 254);
  const siteUrl = text('siteUrl', 2048);
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signerEmail) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(siteEmail)
  ) {
    throw new BadRequestException('Appointment email addresses are invalid');
  }
  let parsedSiteUrl: URL;
  try {
    parsedSiteUrl = new URL(siteUrl);
  } catch {
    throw new BadRequestException('Appointment website URL is invalid');
  }
  if (parsedSiteUrl.protocol !== 'https:') {
    throw new BadRequestException('Appointment website URL must use HTTPS');
  }
  if (
    parsedSiteUrl.username ||
    parsedSiteUrl.password ||
    parsedSiteUrl.search ||
    parsedSiteUrl.hash
  ) {
    throw new BadRequestException(
      'Appointment website URL cannot contain credentials, a query, or a fragment',
    );
  }
  return {
    version: integer(
      candidate.version,
      DEFAULT_APPOINTMENT_LETTER_TEMPLATE.version,
    ),
    markdown,
    signerName: text('signerName', 160),
    signerTitle: text('signerTitle', 160),
    signerEmail,
    signerPhone: text('signerPhone', 40),
    siteUrl: parsedSiteUrl.toString().replace(/\/$/, ''),
    siteEmail,
    siteLocation: text('siteLocation', 240),
  };
}

function parseNotificationPolicy(value: unknown): NotificationPolicy {
  const candidate = isRecord(value) ? value : {};
  const enabled = (key: keyof NotificationPolicy) =>
    typeof candidate[key] === 'boolean'
      ? candidate[key]
      : DEFAULT_NOTIFICATION_POLICY[key] === true;
  return {
    applicationAccepted: enabled('applicationAccepted'),
    applicationRejected: enabled('applicationRejected'),
    taskAssigned: enabled('taskAssigned'),
    taskChanged: enabled('taskChanged'),
    milestoneProgress: enabled('milestoneProgress'),
    deadlineReminder: enabled('deadlineReminder'),
    deadlineDue: enabled('deadlineDue'),
    deadlineOverdue: enabled('deadlineOverdue'),
    reminderDays: Math.min(
      30,
      integer(candidate.reminderDays, DEFAULT_NOTIFICATION_POLICY.reminderDays),
    ),
  };
}

function objectToJson<T extends object>(value: T): Prisma.InputJsonObject {
  return { ...value };
}

function integer(value: unknown, fallback: number): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new BadRequestException(
      'Rank thresholds must be non-negative integers',
    );
  }
  return Number(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && !Array.isArray(value) && typeof value === 'object';
}

function hasControlCharacter(value: string, allowLayout = false): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (allowLayout && (code === 9 || code === 10 || code === 13)) continue;
    if (code < 32 || code === 127) return true;
  }
  return false;
}
