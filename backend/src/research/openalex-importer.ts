import { publicationCategory } from './publication-category';
import { OpenAlexProfile, Prisma } from '../../generated/prisma/client';
import type { OpenAlexWork } from './openalex-client';

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
    return 'Unsupported output type; use manual submission.';
  if (
    !work.title ||
    (work.type !== 'dataset' && !work.year) ||
    !work.authors.length
  )
    return 'Incomplete publication metadata.';
  if (work.isRetracted) return 'Retracted publication requires review.';
  const author = work.authors.find((author) => author.id === authorId);
  if (!author) return 'Author identity missing from the work.';
  if (knownOrcid && author.orcid && orcid(knownOrcid) !== orcid(author.orcid))
    return 'ORCID conflicts with the confirmed profile.';
  return null;
}
export function sourceUpdate<T>(current: T, baseline: unknown, incoming: T): T {
  return current === baseline ? incoming : current;
}
function object(value: Prisma.JsonValue | undefined): Prisma.JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

export class OpenAlexImporter {
  constructor(private readonly db: Prisma.TransactionClient) {}
  private async refreshAuthors(
    paperId: string,
    work: OpenAlexWork,
    previousAuthors: Prisma.JsonValue | undefined,
  ) {
    const rows = await this.db.researchContributor.findMany({
      where: { researchItemId: paperId },
      orderBy: { sortOrder: 'asc' },
    });
    // Unknown/duplicate upstream IDs cannot be reconciled safely by name.
    if (
      rows.some((row) => !row.openAlexAuthorId) ||
      work.authors.some((row) => !row.id) ||
      new Set(work.authors.map((row) => row.id)).size !== work.authors.length
    )
      return;
    const previous = Array.isArray(previousAuthors)
      ? previousAuthors.map((author) => object(author))
      : [];
    const oldById = new Map(previous.map((author) => [author.id, author.name]));
    const order = [
      ...work.authors.map((author) => author.id),
      ...rows
        .filter(
          (row) =>
            !work.authors.some((author) => author.id === row.openAlexAuthorId),
        )
        .map((row) => row.openAlexAuthorId),
    ];
    const offset =
      Math.max(0, ...rows.map((row) => row.sortOrder)) + order.length + 1;
    for (const row of rows)
      await this.db.researchContributor.update({
        where: {
          researchItemId_sortOrder: {
            researchItemId: paperId,
            sortOrder: row.sortOrder,
          },
        },
        data: { sortOrder: row.sortOrder + offset },
      });
    for (const [sortOrder, id] of order.entries()) {
      const row = rows.find((row) => row.openAlexAuthorId === id);
      const incoming = work.authors.find((author) => author.id === id);
      if (row)
        await this.db.researchContributor.update({
          where: {
            researchItemId_sortOrder: {
              researchItemId: paperId,
              sortOrder: row.sortOrder + offset,
            },
          },
          data: {
            sortOrder,
            displayName: incoming
              ? sourceUpdate(row.displayName, oldById.get(id), incoming.name)
              : row.displayName,
          },
        });
      else if (incoming)
        await this.db.researchContributor.create({
          data: {
            researchItemId: paperId,
            sortOrder,
            displayName: incoming.name,
            openAlexAuthorId: id,
          },
        });
    }
  }
  async apply(profile: OpenAlexProfile, works: OpenAlexWork[]) {
    const { personId, authorId } = profile;
    if (!authorId) throw new Error('No OpenAlex author binding');
    const links = await this.db.personLink.findMany({
      where: { personId, type: 'ORCID' },
      select: { url: true },
    });
    const outputIds: string[] = [];
    const affected = new Set<string>([personId]);
    const skipped: { workId: string; reason: string }[] = [];
    let imported = 0;
    let review = 0;
    // Serialize shared DOI/work upserts across authors and server instances.
    await this.db
      .$queryRaw`SELECT pg_advisory_xact_lock(5106152722::bigint)::text`;
    for (const work of works) {
      const issue = importIssue(work, authorId, links[0]?.url ?? null);
      if (issue && !work.isRetracted) {
        skipped.push({ workId: work.id, reason: issue });
        continue;
      }
      const type =
        work.type === 'dataset' ? ('DATASET' as const) : ('PAPER' as const);
      const doiValues = work.doi
        ? [
            work.doi,
            `doi:${work.doi}`,
            `doi: ${work.doi}`,
            ...[
              'https://doi.org/',
              'http://doi.org/',
              'https://dx.doi.org/',
              'http://dx.doi.org/',
            ].map((prefix) => prefix + work.doi),
          ]
        : [];
      const sourceUrl = work.doi
        ? `https://doi.org/${work.doi}`
        : `https://openalex.org/${work.id}`;
      const existing = await this.db.researchItem.findMany({
        where: {
          OR: [
            { openAlexWorkId: work.id },
            {
              canonicalUrl: {
                in: [
                  sourceUrl,
                  `https://openalex.org/${work.id}`,
                  ...doiValues.filter((value) => value.startsWith('http')),
                ],
                mode: 'insensitive',
              },
            },
            ...(doiValues.length
              ? [
                  {
                    paper: {
                      doi: { in: doiValues, mode: 'insensitive' as const },
                    },
                  },
                ]
              : []),
          ],
        },
        include: { paper: true, sourceSnapshot: true },
      });
      if (
        existing.length > 1 ||
        existing.some(
          (item) =>
            item.type !== type ||
            (item.openAlexWorkId && item.openAlexWorkId !== work.id),
        )
      ) {
        skipped.push({
          workId: work.id,
          reason:
            'Conflicting DOI/work ID or output type; manual review required.',
        });
        continue;
      }
      let item = existing[0];
      if (
        !item &&
        !work.doi &&
        (await this.db.researchItem.findFirst({
          where: { type, title: { equals: work.title, mode: 'insensitive' } },
          select: { id: true },
        }))
      ) {
        skipped.push({
          workId: work.id,
          reason:
            'Possible title duplicate without DOI; manual review required.',
        });
        continue;
      }
      if (item) {
        // Lock and revise the parent before changing author slots; active discovery keeps its lease.
        const claim = await this.db.researchItem.updateMany({
          where: {
            id: item.id,
            automationState: { notIn: ['QUEUED', 'RUNNING'] },
          },
          data: {
            automationVersion: { increment: 1 },
            automationState: 'SUCCEEDED',
            automationOwner: null,
            automationClaimedAt: null,
          },
        });
        if (!claim.count) {
          skipped.push({
            workId: work.id,
            reason:
              'Source verification is in progress; retry after it finishes.',
          });
          continue;
        }
        item = await this.db.researchItem.findUniqueOrThrow({
          where: { id: item.id },
          include: { paper: true, sourceSnapshot: true },
        });
      }
      const wasRetracted =
        object(item?.sourceSnapshot?.metadata).openAlexRetracted === true;
      const category = publicationCategory(
        work.type === 'review' ? 'article' : work.type.replaceAll('-', ' '),
      );
      const baseline = {
        title: work.title,
        canonicalUrl: sourceUrl,
        doi: work.doi,
        year: work.year,
        venue: work.venue,
        publicationType: category,
      };
      const metadata = {
        openAlexRetracted: work.isRetracted,
        provider: 'openalex',
        workId: work.id,
        baseline,
        authors: work.authors,
      };
      if (!item) {
        item = await this.db.researchItem.create({
          data: {
            type,
            automationState: 'SUCCEEDED',
            openAlexWorkId: work.id,
            slug: `openalex-${work.id.toLowerCase()}`,
            title: work.title,
            canonicalUrl: sourceUrl,
            reviewStatus: issue ? 'NEEDS_REVIEW' : 'PUBLISHED',
            reviewNote: issue,
            publishedAt: issue ? null : new Date(),
            ...(type === 'PAPER'
              ? {
                  paper: {
                    create: {
                      doi: work.doi,
                      year: work.year,
                      venue: work.venue,
                      publicationType: category,
                    },
                  },
                }
              : { dataset: { create: {} } }),
            contributors: {
              create: work.authors.map((author, sortOrder) => ({
                sortOrder,
                displayName: author.name,
                openAlexAuthorId: author.id,
              })),
            },
            sourceSnapshot: {
              create: {
                url: `https://openalex.org/${work.id}`,
                status: 'FETCHED',
                fetchedAt: new Date(),
                metadata,
              },
            },
          },
          include: { paper: true, sourceSnapshot: true },
        });
      } else {
        const previousMetadata = object(item.sourceSnapshot?.metadata);
        if (previousMetadata.provider === 'openalex' && !item.submittedById) {
          const previous = object(previousMetadata.baseline);
          await this.refreshAuthors(item.id, work, previousMetadata.authors);
          await this.db.researchItem.update({
            where: { id: item.id },
            data: {
              title: sourceUpdate(item.title, previous.title, work.title),
              canonicalUrl: sourceUpdate(
                item.canonicalUrl,
                previous.canonicalUrl,
                sourceUrl,
              ),
            },
          });
          if (item.paper)
            await this.db.paper.update({
              where: { researchItemId: item.id },
              data: {
                doi: sourceUpdate(item.paper.doi, previous.doi, work.doi),
                year: sourceUpdate(item.paper.year, previous.year, work.year),
                venue: sourceUpdate(
                  item.paper.venue,
                  previous.venue,
                  work.venue,
                ),
                publicationType: sourceUpdate(
                  item.paper.publicationType,
                  previous.publicationType,
                  category,
                ),
              },
            });
          await this.db.researchSourceSnapshot.update({
            where: { researchItemId: item.id },
            data: { fetchedAt: new Date(), metadata },
          });
        }
        if (previousMetadata.provider !== 'openalex')
          await this.db.researchSourceSnapshot.upsert({
            where: { researchItemId: item.id },
            create: {
              researchItemId: item.id,
              url: `https://openalex.org/${work.id}`,
              status: 'FETCHED',
              metadata: { openAlexRetracted: work.isRetracted },
            },
            update: {
              metadata: {
                ...previousMetadata,
                openAlexRetracted: work.isRetracted,
              },
            },
          });
        await this.db.researchItem.update({
          where: { id: item.id },
          data: { openAlexWorkId: work.id },
        });
      }
      if (work.isRetracted && !wasRetracted && item.reviewStatus !== 'REJECTED')
        await this.db.researchItem.update({
          where: { id: item.id },
          data: { reviewStatus: 'NEEDS_REVIEW', reviewNote: issue },
        });
      const contributors = await this.db.researchContributor.findMany({
        where: { researchItemId: item.id },
        include: { matches: true },
      });
      for (const contributor of contributors)
        if (contributor.personId) affected.add(contributor.personId);
      const contributor = contributors.find(
        (row) => row.openAlexAuthorId === authorId,
      );
      const decision = contributor?.matches.find(
        (match) => match.personId === personId,
      );
      if (
        contributor &&
        !issue &&
        (!decision || decision.status === 'VERIFIED') &&
        (!contributor.personId || contributor.personId === personId)
      ) {
        await this.db.researchContributor.update({
          where: {
            researchItemId_sortOrder: {
              researchItemId: item.id,
              sortOrder: contributor.sortOrder,
            },
          },
          data: { personId },
        });
        if (!decision)
          await this.db.contributorMatch.create({
            data: {
              researchItemId: item.id,
              contributorSortOrder: contributor.sortOrder,
              personId,
              source: 'SOURCE_METADATA',
              status: 'VERIFIED',
              confidence: 1,
              evidence: {
                matchReason: 'OPENALEX_AUTHOR_ID',
                authorId,
                workId: work.id,
              },
            },
          });
      } else if (
        !issue &&
        !contributors.some((row) => row.personId === personId)
      )
        skipped.push({
          workId: work.id,
          reason: 'Contributor list or review decision requires manual review.',
        });
      outputIds.push(item.id);
      if (issue || item.reviewStatus !== 'PUBLISHED') review++;
      else imported++;
    }
    const missing = await this.db.researchItem.findMany({
      where: {
        openAlexWorkId: { not: null, notIn: works.map((work) => work.id) },
        contributors: { some: { personId } },
      },
      select: { openAlexWorkId: true },
    });
    return {
      outputIds,
      personIds: [...affected],
      summary: {
        fetched: works.length,
        imported,
        review,
        skipped,
        missing: missing.map((item) => item.openAlexWorkId),
      },
    };
  }
}
