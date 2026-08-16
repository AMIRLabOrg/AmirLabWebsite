import { Injectable, OnModuleInit } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';
import {
  ContributorMatchSource,
  ContributorMatchStatus,
  NotificationType,
  PersonLinkType,
  Prisma,
  SourceFetchStatus,
} from '../../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { JobsService } from '../jobs/jobs.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  normalizeOrcid,
  parseHtmlMetadata,
  parseJsonMetadata,
  parsePdfMetadata,
  personNameMatchEvidence,
  personNameTokenKey,
  type SourceAuthor,
  type SourceMetadata,
} from './source-metadata';
import { publicationCategory } from './publication-category';
import {
  SafeSourceFetcher,
  SourceUnavailableError,
  type SourceResponse,
} from './safe-source-fetcher';

export const DISCOVERY_JOB = 'DISCOVER_RESEARCH_SOURCE';

@Injectable()
export class ResearchDiscoveryService implements OnModuleInit {
  constructor(
    private readonly fetcher: SafeSourceFetcher,
    private readonly jobs: JobsService,
    private readonly notifications: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    this.jobs.register(DISCOVERY_JOB, async (payload) => {
      if (!payload || Array.isArray(payload) || typeof payload !== 'object') {
        throw new Error('Research discovery payload must be an object');
      }
      const researchItemId = payload.researchItemId;
      if (typeof researchItemId !== 'string') {
        throw new Error('Research discovery payload needs researchItemId');
      }
      await this.discover(researchItemId);
    });
  }

  async enqueue(
    researchItemId: string,
    canonicalUrl: string,
    uniqueKey?: string,
  ): Promise<string> {
    const jobId = await this.jobs.enqueueWhileActive(
      DISCOVERY_JOB,
      { researchItemId },
      uniqueKey ?? `research-source:${researchItemId}`,
    );
    await this.prisma.researchSourceSnapshot.upsert({
      where: { researchItemId },
      create: {
        researchItemId,
        status: SourceFetchStatus.PENDING,
        url: canonicalUrl,
      },
      update: {
        failureReason: null,
        status: SourceFetchStatus.PENDING,
        url: canonicalUrl,
      },
    });
    return jobId;
  }

  activeJobId(researchItemId: string): Promise<string | null> {
    return this.jobs.activeJobId(`research-source:${researchItemId}`);
  }

  private async discover(researchItemId: string): Promise<void> {
    const item = await this.prisma.researchItem.findUnique({
      where: { id: researchItemId },
      include: {
        contributors: {
          include: { matches: true },
          orderBy: { sortOrder: 'asc' },
        },
        paper: true,
      },
    });
    if (!item?.canonicalUrl) return;

    await this.prisma.researchSourceSnapshot.upsert({
      where: { researchItemId },
      create: {
        researchItemId,
        status: SourceFetchStatus.PENDING,
        url: item.canonicalUrl,
      },
      update: {
        failureReason: null,
        status: SourceFetchStatus.PENDING,
        url: item.canonicalUrl,
      },
    });

    let response: SourceResponse;
    let metadata: SourceMetadata | undefined;
    let provider = 'SOURCE_PAGE';
    try {
      const doi = item.paper?.doi ?? doiFromUrl(item.canonicalUrl);
      if (doi) {
        try {
          const doiResponse = await this.fetcher.fetch(
            `https://doi.org/${doi}`,
            'application/vnd.citationstyles.csl+json',
          );
          const parsed = await this.parse(doiResponse);
          if (parsed.authors.length) {
            response = doiResponse;
            metadata = parsed;
            provider = 'DOI_CSL';
          }
        } catch {
          // Publisher metadata remains a useful fallback for incomplete DOI records.
        }
      }
      response ??= await this.fetcher.fetch(item.canonicalUrl);
    } catch (error) {
      const unavailable = error instanceof SourceUnavailableError;
      await this.prisma.researchSourceSnapshot.update({
        where: { researchItemId },
        data: {
          failureReason: error instanceof Error ? error.message : String(error),
          fetchedAt: new Date(),
          status: unavailable
            ? SourceFetchStatus.UNAVAILABLE
            : SourceFetchStatus.FAILED,
        },
      });
      if (!unavailable) throw error;
      return;
    }

    metadata ??= await this.parse(response);
    if (item.paper) {
      await this.prisma.paper.update({
        where: { researchItemId },
        data: {
          publicationType: publicationCategory(
            item.paper.publicationType,
            item.paper.citation,
            item.paper.venue,
          ),
        },
      });
    }
    const evidence = {
      ...serializableMetadata(metadata, response.finalUrl),
      provider,
    };
    await this.prisma.researchSourceSnapshot.update({
      where: { researchItemId },
      data: {
        contentType: response.contentType,
        failureReason: null,
        fetchedAt: new Date(),
        metadata: evidence,
        status: SourceFetchStatus.FETCHED,
        url: response.finalUrl,
      },
    });
    if (!metadata.authors.length) return;

    await this.syncContributorsFromMetadata(
      researchItemId,
      item.contributors,
      metadata.authors,
    );

    const contributors = await this.prisma.researchContributor.findMany({
      where: { researchItemId },
      include: { matches: true },
      orderBy: { sortOrder: 'asc' },
    });
    const people = await this.prisma.person.findMany({
      where: { userId: { not: null } },
      select: {
        id: true,
        fullName: true,
        links: {
          where: { type: PersonLinkType.ORCID },
          select: { url: true },
        },
      },
    });
    const names = new Map<string, typeof people>();
    const orcids = new Map<string, (typeof people)[number]>();
    for (const person of people) {
      const key = personNameTokenKey(person.fullName);
      names.set(key, [...(names.get(key) ?? []), person]);
      for (const link of person.links) {
        const orcid = normalizeOrcid(link.url);
        if (orcid) orcids.set(orcid, person);
      }
    }

    let proposed = 0;
    for (const contributor of contributors) {
      const author = findAuthor(metadata.authors, contributor.displayName);
      if (!author) continue;
      const identifierMatch = author.orcid
        ? orcids.get(author.orcid)
        : undefined;
      const nameMatches = names.get(personNameTokenKey(author.name)) ?? [];
      const fuzzyMatch = identifierMatch
        ? undefined
        : bestPersonNameMatch(author.name, people);
      const person =
        identifierMatch ??
        (nameMatches.length === 1 &&
        personNameTokenKey(author.name).split(' ').length >= 2
          ? nameMatches[0]
          : undefined) ??
        fuzzyMatch?.person;
      if (!person) continue;
      // Discovery can establish strong evidence, but it never makes the identity decision.
      // Every registered-person match must be reviewed by a moderator.
      const existingDecision = contributor.matches.find(
        (match) => match.personId === person.id,
      );
      if (
        existingDecision?.status === ContributorMatchStatus.VERIFIED ||
        existingDecision?.status === ContributorMatchStatus.REJECTED
      ) {
        continue;
      }

      const confidence = identifierMatch ? 1 : (fuzzyMatch?.confidence ?? 1);
      const reason = identifierMatch
        ? 'ORCID'
        : (fuzzyMatch?.reason ?? 'Exact normalized name');
      const status = ContributorMatchStatus.PROPOSED;
      await this.prisma.$transaction(async (transaction) => {
        await transaction.contributorMatch.upsert({
          where: {
            researchItemId_contributorSortOrder_personId: {
              contributorSortOrder: contributor.sortOrder,
              personId: person.id,
              researchItemId,
            },
          },
          create: {
            confidence,
            contributorSortOrder: contributor.sortOrder,
            evidence: {
              authorName: author.name,
              canonicalUrl: response.finalUrl,
              matchReason: reason,
              orcid: author.orcid,
            },
            personId: person.id,
            researchItemId,
            source: ContributorMatchSource.SOURCE_METADATA,
            status,
          },
          update: {
            confidence,
            evidence: {
              authorName: author.name,
              canonicalUrl: response.finalUrl,
              matchReason: reason,
              orcid: author.orcid,
            },
            source: ContributorMatchSource.SOURCE_METADATA,
            status,
          },
        });
      });
      proposed += 1;
    }

    if (proposed) {
      await this.notifications.notifyReviewers({
        type: NotificationType.RELATION_REVIEW_NEEDED,
        title: 'Contributor matches need verification',
        body: `${proposed} possible account connection${proposed === 1 ? '' : 's'} found for ${item.title ?? 'a research output'}.`,
        actionUrl: `/workspace/research/${item.id}`,
        payload: { researchItemId: item.id },
      });
    }
  }

  private async parse(response: SourceResponse): Promise<SourceMetadata> {
    if (response.contentType.includes('pdf')) {
      const parser = new PDFParse({ data: response.body });
      try {
        return parsePdfMetadata((await parser.getInfo()).info);
      } finally {
        await parser.destroy();
      }
    }
    const text = response.body.toString('utf8');
    if (response.contentType.includes('json')) {
      try {
        return parseJsonMetadata(JSON.parse(text));
      } catch {
        return { authors: [] };
      }
    }
    return parseHtmlMetadata(text);
  }

  private async syncContributorsFromMetadata(
    researchItemId: string,
    contributors: ExistingContributor[],
    authors: SourceAuthor[],
  ): Promise<void> {
    const currentKeys = contributors.map((contributor) =>
      personNameTokenKey(contributor.displayName),
    );
    const authorKeys = authors.map((author) => personNameTokenKey(author.name));
    if (
      currentKeys.length === authorKeys.length &&
      currentKeys.every((key, index) => key === authorKeys[index])
    ) {
      return;
    }

    const used = new Set<ExistingContributor>();
    const nextContributors = authors.map((author, sortOrder) => {
      const existing = bestExistingContributorMatch(
        author.name,
        contributors,
        used,
      );
      if (existing) used.add(existing);
      return {
        displayName: author.name,
        existing,
        personId: existing?.personId ?? null,
        researchItemId,
        sortOrder,
      };
    });
    for (const contributor of contributors) {
      if (used.has(contributor)) continue;
      nextContributors.push({
        displayName: contributor.displayName,
        existing: contributor,
        personId: contributor.personId,
        researchItemId,
        sortOrder: nextContributors.length,
      });
    }

    const preservedMatches = nextContributors.flatMap(
      ({ existing, sortOrder }) =>
        (existing?.matches ?? []).map((match) => ({
          id: match.id,
          confidence: match.confidence,
          createdAt: match.createdAt,
          contributorSortOrder: sortOrder,
          evidence: requiredEvidenceObject(match.evidence),
          personId: match.personId,
          researchItemId,
          requestedById: match.requestedById,
          reviewedAt: match.reviewedAt,
          reviewedById: match.reviewedById,
          source: match.source,
          status: match.status,
        })),
    );

    await this.prisma.$transaction(async (transaction) => {
      await transaction.contributorMatch.deleteMany({
        where: { researchItemId },
      });
      await transaction.researchContributor.deleteMany({
        where: { researchItemId },
      });
      await transaction.researchContributor.createMany({
        data: nextContributors.map((contributor) => ({
          displayName: contributor.displayName,
          personId: contributor.personId,
          researchItemId: contributor.researchItemId,
          sortOrder: contributor.sortOrder,
        })),
      });
      if (preservedMatches.length) {
        await transaction.contributorMatch.createMany({
          data: preservedMatches,
          skipDuplicates: true,
        });
      }
    });
  }
}

interface ExistingContributor {
  displayName: string;
  matches: Array<{
    id: string;
    confidence: number | null;
    createdAt: Date;
    evidence: Prisma.JsonValue;
    personId: string;
    requestedById: string | null;
    reviewedAt: Date | null;
    reviewedById: string | null;
    source: ContributorMatchSource;
    status: ContributorMatchStatus;
  }>;
  personId: string | null;
}

function bestExistingContributorMatch(
  authorName: string,
  contributors: ExistingContributor[],
  used: Set<ExistingContributor>,
): ExistingContributor | undefined {
  const authorKey = personNameTokenKey(authorName);
  const exact = contributors.find(
    (contributor) =>
      !used.has(contributor) &&
      personNameTokenKey(contributor.displayName) === authorKey,
  );
  if (exact) return exact;

  const matches = contributors
    .filter((contributor) => !used.has(contributor))
    .flatMap((contributor) => {
      const evidence = personNameMatchEvidence(
        authorName,
        contributor.displayName,
      );
      return evidence ? [{ confidence: evidence.confidence, contributor }] : [];
    })
    .sort((left, right) => right.confidence - left.confidence);
  const best = matches[0];
  if (!best || matches[1]?.confidence === best.confidence) return undefined;
  return best.contributor;
}

function bestPersonNameMatch<T extends { fullName: string }>(
  authorName: string,
  people: T[],
): { confidence: number; person: T; reason: string } | undefined {
  const matches = people
    .flatMap((person) => {
      const evidence = personNameMatchEvidence(authorName, person.fullName);
      return evidence ? [{ evidence, person }] : [];
    })
    .sort(
      (left, right) => right.evidence.confidence - left.evidence.confidence,
    );
  const best = matches[0];
  if (!best) return undefined;
  if (matches[1]?.evidence.confidence === best.evidence.confidence) {
    return undefined;
  }
  return {
    confidence: best.evidence.confidence,
    person: best.person,
    reason: best.evidence.reason,
  };
}

function doiFromUrl(value: string): string | undefined {
  return value.match(/(?:doi\.org\/)?(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)/i)?.[1];
}

function findAuthor(
  authors: SourceAuthor[],
  displayName: string,
): SourceAuthor | undefined {
  const key = personNameTokenKey(displayName);
  return authors.find((author) => personNameTokenKey(author.name) === key);
}

function serializableMetadata(
  metadata: SourceMetadata,
  canonicalUrl: string,
): Record<string, Prisma.InputJsonValue> {
  return {
    authors: metadata.authors.map((author) => ({
      name: author.name,
      ...(author.orcid ? { orcid: author.orcid } : {}),
    })),
    canonicalUrl,
    ...(metadata.doi ? { doi: metadata.doi } : {}),
    ...(metadata.title ? { title: metadata.title } : {}),
  };
}

function requiredEvidenceObject(
  value: Prisma.JsonValue,
): Prisma.InputJsonObject {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    throw new Error('Contributor match evidence must be a JSON object');
  }
  return value;
}
