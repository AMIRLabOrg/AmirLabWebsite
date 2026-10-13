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
    let row: { value: unknown } | null = null;
    const audit = jest.fn().mockResolvedValue({});
    const db = {
      siteSetting: {
        findUnique: jest.fn(() => Promise.resolve(row)),
        upsert: jest.fn((input: { create: { value: unknown } }) => {
          row = { value: input.create.value };
          return Promise.resolve(row);
        }),
      },
      auditRecord: { create: audit },
    };
    const service = Object.assign(Object.create(SettingsService.prototype), {
      config: {
        get: (name: string) =>
          name === 'uploadRoot' ? join(root, 'storage') : 'environment-token',
      },
      prisma: {
        ...db,
        $transaction: (run: (transaction: typeof db) => Promise<unknown>) =>
          run(db),
      },
    }) as SettingsService;
    return { service, audit, row: () => row };
  }
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
});
