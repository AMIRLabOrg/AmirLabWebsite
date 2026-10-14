import { OpenAlexProfile, Prisma } from '../../generated/prisma/client';
import type { OpenAlexAuthorSnapshot, OpenAlexWork } from './openalex-client';
import { publicationCategory } from './publication-category';
import {
  lockResearchIdentities,
  researchIdentityWhere,
} from './research-identity';

function orcid(value: string | null) {
  return (
    value
      ?.replace(/^https?:\/\/orcid.org\//i, '')
      .trim()
      .toUpperCase() ?? null
  );
}

export function importIssue(
  work: OpenAlexWork,
  authorId: string,
  knownOrcid: string | null,
): string | null {
  if (
    ![
      'article',
      'review',
      'conference-paper',
      'book-chapter',
      'dataset',
    ].includes(work.type)
  )
    return 'Unsupported OpenAlex output type.';
  if (
    !work.title ||
    (work.type !== 'dataset' && !work.year) ||
    !work.authors.length
  )
    return 'Incomplete OpenAlex publication metadata.';
  if (work.isRetracted) return 'Retracted output reported by OpenAlex.';
  const author = work.authors.find((candidate) => candidate.id === authorId);
  if (!author) return 'Author ID is missing from the OpenAlex work.';
  if (knownOrcid && author.orcid && orcid(knownOrcid) !== orcid(author.orcid))
    return 'ORCID conflicts with the bound OpenAlex profile.';
  return null;
}

function object(value: Prisma.JsonValue | undefined): Prisma.JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

function equalJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export class OpenAlexImporter {
  constructor(private readonly db: Prisma.TransactionClient) {}

  private async lockIdentities(works: readonly OpenAlexWork[]) {
    await lockResearchIdentities(
      this.db,
      works.map(({ doi, id }) => ({ doi, openAlexWorkId: id })),
    );
  }

  private async refreshAuthors(
    researchItemId: string,
    work: OpenAlexWork,
  ): Promise<void> {
    if (
      work.authors.some((author) => !author.id) ||
      new Set(work.authors.map(({ id }) => id)).size !== work.authors.length
    )
      return;
    const existing = await this.db.researchContributor.findMany({
      where: { researchItemId },
      orderBy: { sortOrder: 'asc' },
    });
    if (existing.some((author) => !author.openAlexAuthorId)) return;
    const offset = existing.length + work.authors.length + 1;
    for (const author of existing)
      await this.db.researchContributor.update({
        where: {
          researchItemId_sortOrder: {
            researchItemId,
            sortOrder: author.sortOrder,
          },
        },
        data: { sortOrder: author.sortOrder + offset },
      });
    for (const [sortOrder, author] of work.authors.entries()) {
      const row = existing.find(
        ({ openAlexAuthorId }) => openAlexAuthorId === author.id,
      );
      if (row)
        await this.db.researchContributor.update({
          where: {
            researchItemId_sortOrder: {
              researchItemId,
              sortOrder: row.sortOrder + offset,
            },
          },
          data: { displayName: author.name, sortOrder },
        });
      else
        await this.db.researchContributor.create({
          data: {
            displayName: author.name,
            openAlexAuthorId: author.id,
            researchItemId,
            sortOrder,
          },
        });
    }
    await this.db.researchContributor.deleteMany({
      where: { researchItemId, sortOrder: { gte: offset } },
    });
  }

  async apply(
    profile: OpenAlexProfile,
    snapshot: OpenAlexAuthorSnapshot,
    observationVersion: bigint,
  ) {
    const { personId, authorId } = profile;
    if (!authorId) throw new Error('No OpenAlex author binding');
    await this.lockIdentities(snapshot.works);
    const knownOrcid = await this.db.personLink.findFirst({
      where: { personId, type: 'ORCID' },
      select: { url: true },
    });
    const outputIds: string[] = [];
    const changedOutputIds = new Set<string>();
    const affected = new Set<string>([personId]);
    const skipped = [...snapshot.warnings];
    let imported = 0;

    for (const work of snapshot.works) {
      const issue = importIssue(work, authorId, knownOrcid?.url ?? null);
      if (issue && !work.isRetracted) {
        skipped.push({ workId: work.id, reason: issue });
        continue;
      }
      const type =
        work.type === 'dataset' ? ('DATASET' as const) : ('PAPER' as const);
      const sourceUrl = work.doi
        ? `https://doi.org/${work.doi}`
        : `https://openalex.org/${work.id}`;
      const matches = await this.db.researchItem.findMany({
        where: researchIdentityWhere(sourceUrl, work.doi, work.id),
        include: { paper: true, sourceSnapshot: true },
      });
      if (
        matches.length > 1 ||
        matches.some(
          (item) =>
            item.type !== type ||
            (item.openAlexWorkId && item.openAlexWorkId !== work.id),
        )
      ) {
        skipped.push({
          workId: work.id,
          reason: 'Conflicting DOI, OpenAlex work ID, or output type.',
        });
        continue;
      }
      const category = publicationCategory(
        work.type === 'review' ? 'article' : work.type.replaceAll('-', ' '),
      );
      const metadata = {
        authors: work.authors,
        baseline: {
          canonicalUrl: sourceUrl,
          doi: work.doi,
          publicationType: category,
          title: work.title,
          venue: work.venue,
          year: work.year,
        },
        openAlexRetracted: work.isRetracted,
        provider: 'openalex',
        workId: work.id,
      };
      let item = matches[0];
      let effectiveRetracted = work.isRetracted;
      if (!item) {
        item = await this.db.researchItem.create({
          data: {
            automationState: 'SUCCEEDED',
            canonicalUrl: sourceUrl,
            openAlexWorkId: work.id,
            publishedAt: work.isRetracted ? null : new Date(),
            reviewNote: issue,
            reviewStatus: work.isRetracted ? 'ARCHIVED' : 'PUBLISHED',
            slug: `openalex-${work.id.toLowerCase()}`,
            title: work.title,
            type,
            ...(type === 'PAPER'
              ? {
                  paper: {
                    create: {
                      doi: work.doi,
                      publicationType: category,
                      venue: work.venue,
                      year: work.year,
                    },
                  },
                }
              : { dataset: { create: {} } }),
            contributors: {
              create: work.authors.map((author, sortOrder) => ({
                displayName: author.name,
                openAlexAuthorId: author.id,
                sortOrder,
              })),
            },
            sourceSnapshot: {
              create: {
                fetchedAt: new Date(),
                metadata,
                observationVersion,
                status: 'FETCHED',
                url: `https://openalex.org/${work.id}`,
              },
            },
          },
          include: { paper: true, sourceSnapshot: true },
        });
        changedOutputIds.add(item.id);
      } else if (
        !item.sourceSnapshot ||
        observationVersion > item.sourceSnapshot.observationVersion
      ) {
        const previous = object(item.sourceSnapshot?.metadata);
        const visibleChanged =
          !equalJson(previous.baseline, metadata.baseline) ||
          previous.openAlexRetracted !== work.isRetracted;
        await this.refreshAuthors(item.id, work);
        await this.db.researchItem.update({
          where: { id: item.id },
          data: {
            canonicalUrl: sourceUrl,
            openAlexWorkId: work.id,
            publishedAt: work.isRetracted
              ? null
              : (item.publishedAt ?? new Date()),
            reviewNote: issue,
            reviewStatus: work.isRetracted ? 'ARCHIVED' : 'PUBLISHED',
            title: work.title,
          },
        });
        if (item.paper)
          await this.db.paper.update({
            where: { researchItemId: item.id },
            data: {
              doi: work.doi,
              publicationType: category,
              venue: work.venue,
              year: work.year,
            },
          });
        await this.db.researchSourceSnapshot.upsert({
          where: { researchItemId: item.id },
          create: {
            fetchedAt: new Date(),
            metadata,
            observationVersion,
            researchItemId: item.id,
            status: 'FETCHED',
            url: `https://openalex.org/${work.id}`,
          },
          update: {
            fetchedAt: new Date(),
            metadata,
            observationVersion,
            status: 'FETCHED',
            url: `https://openalex.org/${work.id}`,
          },
        });
        if (visibleChanged) changedOutputIds.add(item.id);
      } else {
        effectiveRetracted =
          object(item.sourceSnapshot.metadata).openAlexRetracted === true;
      }

      const existingAssociation = await this.db.personResearchItem.findUnique({
        where: {
          personId_researchItemId: { personId, researchItemId: item.id },
        },
      });
      await this.db.personResearchItem.upsert({
        where: {
          personId_researchItemId: { personId, researchItemId: item.id },
        },
        create: {
          authorId,
          isCurrent: !effectiveRetracted,
          missingSince: null,
          personId,
          researchItemId: item.id,
        },
        update: {
          authorId,
          confirmedAt: new Date(),
          isCurrent: !effectiveRetracted,
          missingSince: null,
        },
      });
      if (
        !existingAssociation ||
        existingAssociation.isCurrent === effectiveRetracted
      )
        changedOutputIds.add(item.id);
      const otherPeople = await this.db.personResearchItem.findMany({
        where: { researchItemId: item.id },
        select: { personId: true },
      });
      for (const association of otherPeople) affected.add(association.personId);
      outputIds.push(item.id);
      if (!effectiveRetracted) imported += 1;
    }

    const presentItems = await this.db.researchItem.findMany({
      where: { openAlexWorkId: { in: snapshot.presentWorkIds } },
      select: { id: true },
    });
    await this.db.personResearchItem.updateMany({
      where: {
        personId,
        researchItemId: { in: presentItems.map(({ id }) => id) },
      },
      data: { missingSince: null },
    });
    const absent = await this.db.personResearchItem.findMany({
      where: {
        authorId,
        isCurrent: true,
        personId,
        researchItem: {
          openAlexWorkId: { not: null, notIn: snapshot.presentWorkIds },
        },
      },
      select: { missingSince: true, researchItemId: true },
    });
    const suspected = absent.filter(({ missingSince }) => !missingSince);
    const confirmed = absent.filter(({ missingSince }) => missingSince);
    if (suspected.length)
      await this.db.personResearchItem.updateMany({
        where: {
          personId,
          researchItemId: {
            in: suspected.map(({ researchItemId }) => researchItemId),
          },
        },
        data: { missingSince: new Date() },
      });
    if (confirmed.length) {
      await this.db.personResearchItem.updateMany({
        where: {
          personId,
          researchItemId: {
            in: confirmed.map(({ researchItemId }) => researchItemId),
          },
        },
        data: { isCurrent: false },
      });
      for (const association of confirmed)
        changedOutputIds.add(association.researchItemId);
    }

    return {
      changedOutputIds: [...changedOutputIds],
      outputIds,
      personIds: [...affected],
      summary: {
        fetched: snapshot.declaredCount,
        imported,
        missing: absent.map(({ researchItemId }) => researchItemId),
        skipped,
        warnings: snapshot.warnings.length,
      },
    };
  }
}
