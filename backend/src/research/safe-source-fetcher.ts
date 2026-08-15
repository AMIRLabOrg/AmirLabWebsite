import { Injectable } from '@nestjs/common';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const MAX_SOURCE_BYTES = 2_500_000;
const MAX_REDIRECTS = 3;

export interface SourceResponse {
  body: Buffer;
  contentType: string;
  finalUrl: string;
}

export class SourceUnavailableError extends Error {}

@Injectable()
export class SafeSourceFetcher {
  async fetch(
    sourceUrl: string,
    accept = 'text/html, application/ld+json, application/json, application/pdf;q=0.8',
  ): Promise<SourceResponse> {
    let url = new URL(sourceUrl);
    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
      await assertPublicUrl(url);
      const response = await fetch(url, {
        headers: {
          accept,
          'user-agent': 'AmirLab-Research-Linker/1.0 (+https://amirl.org)',
        },
        redirect: 'manual',
        signal: AbortSignal.timeout(12_000),
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location || redirect === MAX_REDIRECTS) {
          throw new SourceUnavailableError('Source redirected too many times');
        }
        url = new URL(location, url);
        continue;
      }
      if ([401, 403, 404, 410].includes(response.status)) {
        throw new SourceUnavailableError(
          `Source returned HTTP ${response.status}`,
        );
      }
      if (!response.ok)
        throw new Error(`Source returned HTTP ${response.status}`);

      const declaredLength = Number(
        response.headers.get('content-length') ?? 0,
      );
      if (declaredLength > MAX_SOURCE_BYTES) {
        throw new SourceUnavailableError(
          'Source exceeds the metadata size limit',
        );
      }
      const body = await readLimitedBody(response, MAX_SOURCE_BYTES);
      return {
        body,
        contentType: response.headers.get('content-type')?.toLowerCase() ?? '',
        finalUrl: url.toString(),
      };
    }
    throw new SourceUnavailableError('Source could not be reached');
  }
}

async function assertPublicUrl(url: URL): Promise<void> {
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new SourceUnavailableError(
      'Only HTTP and HTTPS sources are supported',
    );
  }
  if (url.username || url.password) {
    throw new SourceUnavailableError('Source URLs cannot contain credentials');
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new SourceUnavailableError('Private network sources are not allowed');
  }
  const addresses = isIP(hostname)
    ? [{ address: hostname }]
    : await lookup(hostname, { all: true, verbatim: true });
  if (
    !addresses.length ||
    addresses.some(({ address }) => isPrivateAddress(address))
  ) {
    throw new SourceUnavailableError('Private network sources are not allowed');
  }
}

export function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized.includes(':')) {
    if (
      normalized === '::' ||
      normalized === '::1' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe8') ||
      normalized.startsWith('fe9') ||
      normalized.startsWith('fea') ||
      normalized.startsWith('feb')
    ) {
      return true;
    }
    const mapped = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
    return mapped ? isPrivateAddress(mapped) : false;
  }
  const parts = normalized.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part)))
    return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19))
  );
}

async function readLimitedBody(
  response: Response,
  limit: number,
): Promise<Buffer> {
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        throw new SourceUnavailableError(
          'Source exceeds the metadata size limit',
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, size);
}
