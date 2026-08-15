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

const VERIFICATION_KEY = 'verification-policy';
const RANK_KEY = 'rank-policy';
const REDIRECT_URL_KEY = 'redirect-url';
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

  async updateVerification(
    value: VerificationPolicy,
    actorId: string,
  ): Promise<VerificationPolicy> {
    const parsed = parseVerificationPolicy(value);
    await this.prisma.$transaction([
      this.prisma.siteSetting.upsert({
        where: { key: VERIFICATION_KEY },
        create: {
          key: VERIFICATION_KEY,
          value: parsed as unknown as Prisma.InputJsonValue,
        },
        update: { value: parsed as unknown as Prisma.InputJsonValue },
      }),
      this.prisma.auditRecord.create({
        data: {
          action: 'settings.verification-updated',
          actorId,
          entityId: VERIFICATION_KEY,
          entityType: 'SiteSetting',
          details: parsed as unknown as Prisma.InputJsonValue,
        },
      }),
    ]);
    return parsed;
  }

  async updateRanking(value: RankPolicy, actorId: string): Promise<RankPolicy> {
    const parsed = parseRankPolicy(value);
    await this.prisma.$transaction([
      this.prisma.siteSetting.upsert({
        where: { key: RANK_KEY },
        create: {
          key: RANK_KEY,
          value: parsed as unknown as Prisma.InputJsonValue,
        },
        update: { value: parsed as unknown as Prisma.InputJsonValue },
      }),
      this.prisma.auditRecord.create({
        data: {
          action: 'settings.rank-policy-updated',
          actorId,
          entityId: RANK_KEY,
          entityType: 'SiteSetting',
          details: parsed as unknown as Prisma.InputJsonValue,
        },
      }),
    ]);
    await this.jobs.enqueueWhileActive(
      RECALCULATE_ALL_RANKS_JOB,
      {},
      'rank-policy:recalculate-all',
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
    await this.prisma.$transaction([
      this.prisma.siteSetting.upsert({
        where: { key: REDIRECT_URL_KEY },
        create: {
          key: REDIRECT_URL_KEY,
          value: url,
        },
        update: { value: url },
      }),
      this.prisma.auditRecord.create({
        data: {
          action: 'settings.redirect-url-updated',
          actorId,
          entityId: REDIRECT_URL_KEY,
          entityType: 'SiteSetting',
          details: { url },
        },
      }),
    ]);
    return { url };
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
  if (!isRecord(value)) return DEFAULT_VERIFICATION_POLICY;
  return Object.fromEntries(
    Object.entries(DEFAULT_VERIFICATION_POLICY).map(([key, fallback]) => {
      const candidate = value[key];
      return [
        key,
        candidate === 'AUTOMATIC' || candidate === 'MANUAL'
          ? candidate
          : fallback,
      ];
    }),
  ) as unknown as VerificationPolicy;
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
