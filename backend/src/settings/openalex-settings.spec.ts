import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SettingsService } from './settings.service';

describe('admin OpenAlex credentials', () => {
  let root: string;
  const request = jest.spyOn(globalThis, 'fetch');
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'openalex-settings-'));
    request.mockReset().mockResolvedValue(Response.json({ rate_limit: {} }));
  });
  afterAll(() => request.mockRestore());
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });
  function setup() {
    const rows = new Map<string, { value: unknown }>();
    let row: { value: unknown } | null = null;
    const audit = jest.fn().mockResolvedValue({});
    const db = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      siteSetting: {
        findUnique: jest.fn((input: { where: { key: string } }) =>
          Promise.resolve(rows.get(input.where.key) ?? null),
        ),
        upsert: jest.fn(
          (input: { where: { key: string }; create: { value: unknown } }) => {
            row = { value: input.create.value };
            rows.set(input.where.key, row);
            return Promise.resolve(row);
          },
        ),
      },
      auditRecord: { create: audit },
    };
    const service = Object.assign(Object.create(SettingsService.prototype), {
      config: {
        get: (name: string) =>
          name === 'uploadRoot'
            ? join(root, 'storage')
            : name === 'encryptionKey'
              ? 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
              : 'environment-token',
      },
      prisma: {
        ...db,
        $transaction: (run: (transaction: typeof db) => Promise<unknown>) =>
          run(db),
      },
    }) as SettingsService;
    return { service, audit, row: () => row };
  }
  it('keeps the longest pause for the same credential and isolates rotated keys', async () => {
    const { service } = setup();
    await service.pauseOpenAlex('key-one', 86_400_000, 'quota');
    const first = await service.openAlexPause('key-one');
    await service.pauseOpenAlex('key-one', 60_000, 'short retry');
    expect(await service.openAlexPause('key-one')).toEqual(first);
    expect(await service.openAlexPause('key-two')).toBeNull();
    await service.pauseOpenAlex('key-two', 3_600_000, 'new key quota');
    const second = await service.openAlexPause('key-two');
    await service.pauseOpenAlex('key-one', 172_800_000, 'late old key quota');
    expect(await service.openAlexPause('key-two')).toEqual(second);
  });
  it('encrypts stored keys and returns only status, including audit details', async () => {
    const { service, audit, row } = setup();
    expect(await service.openAlexStatus()).toEqual({
      configured: true,
      source: 'environment',
    });
    expect(await service.updateOpenAlexApiKey('saved-token', 'admin')).toEqual({
      configured: true,
      source: 'admin',
    });
    expect(JSON.stringify(row())).not.toContain('saved-token');
    expect(JSON.stringify(audit.mock.calls)).not.toContain('saved-token');
    expect(await service.openAlexApiKey()).toBe('saved-token');
    expect(JSON.stringify(await service.openAlexStatus())).not.toContain(
      'saved-token',
    );
  });
  it('uses rotated settings immediately and allows admin removal to override the environment', async () => {
    const { service } = setup();
    await service.updateOpenAlexApiKey('first-token', 'admin');
    await service.updateOpenAlexApiKey('rotated-token', 'admin');
    expect(await service.openAlexApiKey()).toBe('rotated-token');
    await service.updateOpenAlexApiKey('', 'admin');
    expect(await service.openAlexApiKey()).toBeNull();
    expect(await service.openAlexStatus()).toEqual({
      configured: false,
      source: 'none',
    });
  });
  it('rejects an invalid replacement before storage or audit changes', async () => {
    const { service, audit, row } = setup();
    await service.updateOpenAlexApiKey('valid-token', 'admin');
    const previous = row();
    request.mockResolvedValueOnce(new Response('', { status: 401 }));
    await expect(
      service.updateOpenAlexApiKey('invalid-token', 'admin'),
    ).rejects.toMatchObject({ response: { code: 'OPENALEX_KEY_INVALID' } });
    expect(row()).toBe(previous);
    expect(audit).toHaveBeenCalledTimes(1);
    expect(await service.openAlexApiKey()).toBe('valid-token');
  });
  it('keeps the saved key if OpenAlex validation is unavailable', async () => {
    const { service, row } = setup();
    await service.updateOpenAlexApiKey('valid-token', 'admin');
    const previous = row();
    request.mockRejectedValueOnce(new Error('network failure'));
    await expect(
      service.updateOpenAlexApiKey('replacement-token', 'admin'),
    ).rejects.toMatchObject({
      response: { code: 'OPENALEX_KEY_CHECK_UNAVAILABLE' },
    });
    expect(row()).toBe(previous);
  });

  it('does not display an old credential budget after rotation or late responses', async () => {
    const { service } = setup();
    await service.updateOpenAlexApiKey('first-token', 'admin');
    const headers = new Headers({
      'X-RateLimit-Limit': '100',
      'X-RateLimit-Remaining': '90',
      'X-RateLimit-Reset': '3600',
    });
    await service.recordOpenAlexUsage(headers, true, 'first-token');
    await service.updateOpenAlexApiKey('rotated-token', 'admin');
    request.mockRejectedValue(new Error('network failure'));
    expect(await service.openAlexUsage()).toMatchObject({
      limit: null,
      remaining: null,
    });
    await service.recordOpenAlexUsage(headers, true, 'first-token');
    expect(await service.openAlexUsage()).toMatchObject({
      limit: null,
      remaining: null,
    });
    await service.recordOpenAlexUsage(headers, true, 'rotated-token');
    expect(await service.openAlexUsage()).toMatchObject({
      limit: 100,
      remaining: 90,
    });
  });

  it('ignores missing rate-limit headers instead of recording zero credits', async () => {
    const { service, row } = setup();
    await service.recordOpenAlexUsage(new Headers(), false);
    expect(row()).toBeNull();
  });
});
