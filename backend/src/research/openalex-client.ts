/* eslint-disable no-control-regex -- Reject control characters in external DOI identifiers. */
import { BadRequestException, Injectable } from '@nestjs/common';
import { withJobSignal } from '../jobs/job-context';
import { SettingsService } from '../settings/settings.service';

const API = 'https://api.openalex.org';
const MAX_BYTES = 10 * 1024 * 1024;
const WORK_FIELDS =
  'id,doi,title,type,publication_year,publication_date,authorships,primary_location,is_retracted';
export interface OpenAlexWork {
  id: string;
  doi: string | null;
  title: string | null;
  type: string;
  year: number | null;
  publicationDate: string | null;
  venue: string | null;
  isRetracted: boolean;
  authors: { id: string | null; name: string; orcid: string | null }[];
}
export interface OpenAlexAuthorSnapshot {
  works: OpenAlexWork[];
  presentWorkIds: string[];
  declaredCount: number;
  warnings: { workId: string; reason: string }[];
}
export class OpenAlexRequestError extends Error {
  constructor(
    message: string,
    readonly retryAfterMs = 60_000,
  ) {
    super(message);
  }
}
export function normalizeAuthorId(value: string): string {
  let id = value.trim();
  if (id.startsWith('http')) {
    try {
      const url = new URL(id);
      if (
        url.protocol !== 'https:' ||
        !['openalex.org', 'www.openalex.org'].includes(url.hostname) ||
        url.search ||
        url.hash ||
        url.username ||
        url.password
      )
        throw new Error();
      id = url.pathname.replace(/^\/(?:authors\/)?/i, '').replace(/\/$/, '');
    } catch {
      throw new BadRequestException(
        'Use an OpenAlex author ID or profile URL.',
      );
    }
  }
  id = id.toUpperCase();
  if (
    !/^A[1-9]\d{0,19}$/.test(id) ||
    ['A9999999999', 'A5317838346'].includes(id)
  )
    throw new BadRequestException('Use a valid OpenAlex author ID.');
  return id;
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new OpenAlexRequestError('OpenAlex returned invalid metadata.');
  return value as Record<string, unknown>;
}
function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
function identifier(value: unknown, prefix: 'A' | 'W'): string | null {
  if (typeof value !== 'string') return null;
  const id = value.replace(/^https:\/\/openalex\.org\//i, '').toUpperCase();
  return new RegExp(`^${prefix}[1-9]\\d{0,19}$`).test(id) ? id : null;
}
export function normalizeDoi(value: string | null): string | null {
  let doi = value
    ?.trim()
    .replace(/^doi:\s*/i, '')
    .toLowerCase();
  if (doi && /^https?:\/\/(?:dx\.)?doi\.org\//i.test(doi)) {
    try {
      doi = decodeURIComponent(new URL(doi).pathname.slice(1));
    } catch {
      return null;
    }
  }
  return doi && /^10\.\d{4,9}\/[^\s\x00-\x1f]+$/.test(doi) && doi.length <= 500
    ? doi
    : null;
}
function work(value: unknown): OpenAlexWork {
  const row = record(value);
  const id = identifier(row.id, 'W');
  if (!id || !Array.isArray(row.authorships))
    throw new OpenAlexRequestError('OpenAlex returned invalid work metadata.');
  const location =
    row.primary_location && typeof row.primary_location === 'object'
      ? record(row.primary_location)
      : null;
  const source =
    location?.source && typeof location.source === 'object'
      ? record(location.source)
      : null;
  return {
    id,
    doi: normalizeDoi(stringOrNull(row.doi)),
    title: stringOrNull(row.title),
    type: stringOrNull(row.type) ?? 'unknown',
    year: Number.isInteger(row.publication_year)
      ? Number(row.publication_year)
      : null,
    publicationDate: stringOrNull(row.publication_date),
    venue: stringOrNull(source?.display_name),
    isRetracted: row.is_retracted === true,
    authors: row.authorships.map((value) => {
      const authorship = record(value);
      const author = record(authorship.author);
      return {
        id: identifier(author.id, 'A'),
        name: stringOrNull(author.display_name) ?? 'Unknown author',
        orcid: stringOrNull(authorship.raw_orcid),
      };
    }),
  };
}

@Injectable()
export class OpenAlexClient {
  constructor(private readonly settings: SettingsService) {}
  private async read(
    path: string,
    params: Record<string, string> = {},
  ): Promise<Record<string, unknown>> {
    const key = await this.settings.openAlexApiKey();
    const pause = await this.settings.openAlexPause(key);
    if (pause) {
      throw new OpenAlexRequestError(
        pause.reason,
        Math.max(60_000, pause.resumeAt.getTime() - Date.now()),
      );
    }
    const url = new URL(path, API);
    for (const [key, value] of Object.entries(params))
      url.searchParams.set(key, value);
    let response: Response;
    try {
      response = await fetch(url, {
        headers: key ? { Authorization: `Bearer ${key}` } : {},
        signal: withJobSignal(AbortSignal.timeout(20_000)),
        redirect: 'error',
      });
    } catch {
      throw new OpenAlexRequestError(
        'OpenAlex is unavailable. Existing publications were kept.',
      );
    }
    try {
      await this.settings.recordOpenAlexUsage(
        response.headers,
        Boolean(key),
        key,
      );
    } catch {
      // Usage telemetry must not interrupt an otherwise valid author sync.
    }
    if (response.status === 404)
      throw new OpenAlexRequestError(
        'OpenAlex profile or work not found.',
        86_400_000,
      );
    if (response.status === 429) {
      const retry = response.headers.get('Retry-After');
      const seconds = Number(retry);
      const wait =
        retry && Number.isFinite(seconds)
          ? seconds * 1000
          : retry
            ? Date.parse(retry) - Date.now()
            : 3_600_000;
      const retryAfterMs = Math.min(
        86_400_000,
        Math.max(60_000, Number.isFinite(wait) ? wait : 3_600_000),
      );
      const reason = 'OpenAlex usage limit reached. Sync will retry later.';
      try {
        await this.settings.pauseOpenAlex(key, retryAfterMs, reason);
      } catch {
        // A telemetry write must not hide the provider's rate-limit response.
      }
      throw new OpenAlexRequestError(reason, retryAfterMs);
    }
    if (!response.ok)
      throw new OpenAlexRequestError(
        'OpenAlex request failed. Existing publications were kept.',
      );
    if (Number(response.headers.get('Content-Length')) > MAX_BYTES) {
      await response.body?.cancel();
      throw new OpenAlexRequestError('OpenAlex response is too large.');
    }
    const reader = response.body?.getReader();
    if (!reader)
      throw new OpenAlexRequestError('OpenAlex returned empty metadata.');
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BYTES) {
          await reader.cancel();
          throw new OpenAlexRequestError('OpenAlex response is too large.');
        }
        chunks.push(value);
      }
      return record(JSON.parse(Buffer.concat(chunks).toString()));
    } catch (error) {
      if (error instanceof OpenAlexRequestError) throw error;
      throw new OpenAlexRequestError('OpenAlex returned invalid metadata.');
    }
  }
  async fetchAuthorWorks(value: string): Promise<OpenAlexAuthorSnapshot> {
    const id = normalizeAuthorId(value);
    const works = new Map<string, OpenAlexWork>();
    const presentWorkIds: string[] = [];
    const presentWorkIdSet = new Set<string>();
    const warnings: { workId: string; reason: string }[] = [];
    const seen = new Set<string>();
    let declaredCount: number | null = null;
    let cursor: string | null = '*';
    while (cursor !== null) {
      if (seen.has(cursor) || seen.size >= 50)
        throw new OpenAlexRequestError(
          'OpenAlex cursor loop or sync limit reached.',
        );
      seen.add(cursor);
      const page = await this.read('/works', {
        filter: `author.id:${id}`,
        per_page: '100',
        cursor,
        select: WORK_FIELDS,
      });
      if (!Array.isArray(page.results))
        throw new OpenAlexRequestError('OpenAlex returned invalid metadata.');
      const meta = record(page.meta);
      if (
        !Number.isSafeInteger(meta.count) ||
        Number(meta.count) < 0 ||
        Number(meta.count) > 5000 ||
        (declaredCount !== null && declaredCount !== Number(meta.count))
      )
        throw new OpenAlexRequestError(
          'OpenAlex returned an inconsistent or excessive work count.',
        );
      declaredCount = Number(meta.count);
      if (meta.next_cursor !== null && typeof meta.next_cursor !== 'string')
        throw new OpenAlexRequestError(
          'OpenAlex returned invalid cursor metadata.',
        );
      for (const value of page.results) {
        const row = record(value);
        const workId = identifier(row.id, 'W');
        if (!workId)
          throw new OpenAlexRequestError(
            'OpenAlex returned an unidentifiable work.',
          );
        if (presentWorkIdSet.has(workId))
          throw new OpenAlexRequestError(
            'OpenAlex returned duplicate work identifiers.',
          );
        presentWorkIds.push(workId);
        presentWorkIdSet.add(workId);
        try {
          works.set(workId, work(row));
        } catch (error) {
          warnings.push({
            workId,
            reason:
              error instanceof Error
                ? error.message
                : 'OpenAlex returned invalid work metadata.',
          });
        }
      }
      cursor = meta.next_cursor;
    }
    if (declaredCount === null || presentWorkIds.length !== declaredCount)
      throw new OpenAlexRequestError(
        'OpenAlex returned an incomplete work listing.',
      );
    if (!presentWorkIds.length) {
      const author = await this.read(`/authors/${id}`, {
        select: 'id,works_count',
      });
      if (identifier(author.id, 'A') !== id || author.works_count !== 0)
        throw new OpenAlexRequestError(
          'OpenAlex returned an inconsistent empty author listing.',
          86_400_000,
        );
    }
    return {
      works: [...works.values()],
      presentWorkIds,
      declaredCount,
      warnings,
    };
  }

  async fetchAuthorCitationCount(value: string): Promise<number> {
    const id = normalizeAuthorId(value);
    const author = await this.read(`/authors/${id}`, {
      select: 'id,cited_by_count',
    });
    const count = author.cited_by_count;
    if (
      identifier(author.id, 'A') !== id ||
      typeof count !== 'number' ||
      !Number.isSafeInteger(count) ||
      count < 0 ||
      count > 2147483647
    )
      throw new OpenAlexRequestError(
        'OpenAlex returned invalid author citation metadata.',
      );
    return count;
  }
}
