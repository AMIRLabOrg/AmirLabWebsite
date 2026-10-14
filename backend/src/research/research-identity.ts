import { BadRequestException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { normalizeDoi } from './openalex-client';

export async function lockResearchIdentities(
  db: Prisma.TransactionClient,
  identities: ReadonlyArray<{
    canonicalUrl?: string | null;
    doi?: string | null;
    openAlexWorkId?: string | null;
  }>,
) {
  const keys = identities
    .flatMap(({ canonicalUrl, doi, openAlexWorkId }) => {
      const url = canonicalUrl ? new URL(canonicalUrl) : null;
      const normalizedDoi =
        normalizeDoi(doi ?? null) ??
        (url && /^(?:dx\.)?doi\.org$/i.test(url.hostname)
          ? normalizeDoi(url.toString())
          : null);
      const workId =
        openAlexWorkId ??
        (url && /^(?:www\.)?openalex\.org$/i.test(url.hostname)
          ? url.pathname.match(/^\/(?:works\/)?(W[1-9]\d*)\/?$/i)?.[1]
          : null);
      return [
        ...(normalizedDoi ? [`doi:${normalizedDoi}`] : []),
        ...(workId ? [`openalex:${workId.toUpperCase()}`] : []),
        ...(canonicalUrl ? [`url:${canonicalUrl.toLowerCase()}`] : []),
      ];
    })
    .sort();
  for (const key of new Set(keys))
    await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`;
}

export function researchIdentityWhere(
  canonicalUrl: string,
  doi?: string | null,
  workId?: string | null,
): Prisma.ResearchItemWhereInput {
  const url = new URL(canonicalUrl);
  const normalizedDoi =
    normalizeDoi(doi ?? null) ??
    (/^(?:dx\.)?doi\.org$/i.test(url.hostname)
      ? normalizeDoi(url.toString())
      : null);
  const openAlexId =
    workId ??
    (/^(?:www\.)?openalex\.org$/i.test(url.hostname)
      ? url.pathname
          .match(/^\/(?:works\/)?(W[1-9]\d*)\/?$/i)?.[1]
          ?.toUpperCase()
      : undefined);
  const doiValues = normalizedDoi
    ? [
        normalizedDoi,
        `doi:${normalizedDoi}`,
        `doi: ${normalizedDoi}`,
        ...[
          'https://doi.org/',
          'http://doi.org/',
          'https://dx.doi.org/',
          'http://dx.doi.org/',
        ].map((prefix) => prefix + normalizedDoi),
      ]
    : [];
  return {
    OR: [
      {
        canonicalUrl: {
          in: [
            canonicalUrl,
            ...doiValues.filter((value) => value.startsWith('http')),
            ...(openAlexId
              ? [
                  `https://openalex.org/${openAlexId}`,
                  `https://openalex.org/works/${openAlexId}`,
                ]
              : []),
          ],
          mode: 'insensitive',
        },
      },
      ...(openAlexId ? [{ openAlexWorkId: openAlexId }] : []),
      ...(doiValues.length
        ? [{ paper: { doi: { in: doiValues, mode: 'insensitive' as const } } }]
        : []),
    ],
  };
}

export function normalizeOutputReference(input: {
  label: string;
  doi?: string;
  url?: string;
}) {
  const label = input.label.trim();
  if (!label) throw new BadRequestException('Output label is required');
  if (
    [input.doi ?? '', input.url ?? ''].some((value) =>
      [...value].some((character) => {
        const code = character.charCodeAt(0);
        return code < 32 || code === 127;
      }),
    )
  ) {
    throw new BadRequestException(
      'Output references cannot contain control characters',
    );
  }

  let doi = normalizeDoi(input.doi?.trim() || null);
  let url: string | null = null;
  if (input.url?.trim()) {
    let parsed: URL;
    try {
      parsed = new URL(input.url.trim());
    } catch {
      throw new BadRequestException('Output URL is invalid');
    }
    if (
      parsed.protocol !== 'https:' ||
      parsed.username ||
      parsed.password ||
      parsed.hash
    ) {
      throw new BadRequestException(
        'Output URL must use HTTPS without credentials or a fragment',
      );
    }
    url = parsed.toString();
    if (!doi && /^(?:dx\.)?doi\.org$/i.test(parsed.hostname)) {
      doi = normalizeDoi(url);
    }
  }
  if (input.doi && !doi) throw new BadRequestException('Output DOI is invalid');
  if (!doi && !url) {
    throw new BadRequestException('Add a DOI or an HTTPS source URL');
  }
  return {
    doi,
    identityKey: doi ? `doi:${doi}` : `url:${url}`,
    label,
    url,
  };
}
