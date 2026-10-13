/* eslint-disable no-control-regex -- Reject control characters in external DOI identifiers. */
import { BadRequestException, Injectable } from '@nestjs/common';
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
  const doi = value
    ?.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
    .trim()
    .toLowerCase();
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
    const url = new URL(path, API);
    for (const [key, value] of Object.entries(params))
      url.searchParams.set(key, value);
    const key = await this.settings.openAlexApiKey();
    let response: Response;
    try {
      response = await fetch(url, {
        headers: key ? { Authorization: `Bearer ${key}` } : {},
        signal: AbortSignal.timeout(20_000),
        redirect: 'error',
      });
    } catch {
      throw new OpenAlexRequestError(
        'OpenAlex is unavailable. Existing publications were kept.',
      );
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
            : 60_000;
      throw new OpenAlexRequestError(
        'OpenAlex usage limit reached. Sync will retry later.',
        Math.min(
          86_400_000,
          Math.max(60_000, Number.isFinite(wait) ? wait : 60_000),
        ),
      );
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
  async fetchAuthorWorks(value: string): Promise<OpenAlexWork[]> {
    const id = normalizeAuthorId(value);
    const works = new Map<string, OpenAlexWork>();
    const seen = new Set<string>();
    let cursor: string | null = '*';
    while (cursor !== null) {
      if (seen.has(cursor) || seen.size >= 1000)
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
      if (meta.next_cursor !== null && typeof meta.next_cursor !== 'string')
        throw new OpenAlexRequestError(
          'OpenAlex returned invalid cursor metadata.',
        );
      for (const value of page.results) {
        const item = work(value);
        works.set(item.id, item);
      }
      cursor = meta.next_cursor;
    }
    if (!works.size) {
      const author = await this.read(`/authors/${id}`, { select: 'id' });
      if (identifier(author.id, 'A') !== id)
        throw new OpenAlexRequestError(
          'OpenAlex author disappeared. Existing publications were kept.',
          86_400_000,
        );
    }
    return [...works.values()];
  }
}
