import { SettingsService } from '../settings/settings.service';
import { resolveService } from '../../test/resolve-service';
import { OpenAlexClient, normalizeAuthorId } from './openalex-client';
const author = 'A5106152722';
const work = {
  id: 'https://openalex.org/W4401050363',
  doi: 'https://doi.org/10.1000/test',
  title: 'A paper',
  type: 'article',
  publication_year: 2024,
  is_retracted: false,
  authorships: [
    {
      author: {
        id: `https://openalex.org/${author}`,
        display_name: 'Sultanul Arifeen Hamim',
      },
      raw_orcid: null,
    },
  ],
  primary_location: { source: { display_name: 'Journal' } },
};
const page = (
  results: unknown[],
  cursor: string | null,
  count = results.length,
) => Response.json({ meta: { count, next_cursor: cursor }, results });
describe('OpenAlex fixed-host client', () => {
  const request = jest.spyOn(globalThis, 'fetch');
  beforeEach(() => request.mockReset());
  afterAll(() => request.mockRestore());
  const client = () =>
    resolveService(OpenAlexClient, [
      {
        provide: SettingsService,
        useValue: {
          openAlexApiKey: () => Promise.resolve('test-api-key'),
          openAlexPause: () => Promise.resolve(null),
          pauseOpenAlex: jest.fn(),
          recordOpenAlexUsage: jest.fn(),
        },
      },
    ]);
  it('uses the current admin key on each request without adding it to the URL', async () => {
    const settings = {
      openAlexApiKey: jest
        .fn()
        .mockResolvedValueOnce('first-token')
        .mockResolvedValueOnce('rotated-token'),
      openAlexPause: jest.fn().mockResolvedValue(null),
      pauseOpenAlex: jest.fn(),
      recordOpenAlexUsage: jest.fn(),
    };
    const service = await resolveService(OpenAlexClient, [
      { provide: SettingsService, useValue: settings },
    ]);
    request.mockImplementation(() => Promise.resolve(page([work], null)));
    await service.fetchAuthorWorks(author);
    await service.fetchAuthorWorks(author);
    expect(request.mock.calls[0][1]?.headers).toEqual({
      Authorization: 'Bearer first-token',
    });
    expect(request.mock.calls[1][1]?.headers).toEqual({
      Authorization: 'Bearer rotated-token',
    });
    expect((request.mock.calls[1][0] as URL).href).not.toContain(
      'rotated-token',
    );
  });
  it('normalizes profile IDs and URLs without accepting arbitrary hosts or reserved IDs', () => {
    expect(normalizeAuthorId('a5106152722')).toBe(author);
    expect(
      normalizeAuthorId(`https://openalex.org/authors/${author.toLowerCase()}`),
    ).toBe(author);
    for (const value of [
      'https://evil.test/A5106152722',
      'A9999999999',
      'A5317838346',
      'A0',
      'W123',
      'A123\n/../',
    ])
      expect(() => normalizeAuthorId(value)).toThrow();
  });
  it('reads every cursor page and sends the key only in an authorization header', async () => {
    request
      .mockResolvedValueOnce(page([work], 'next', 1))
      .mockResolvedValueOnce(page([], null, 1));
    const result = await (await client()).fetchAuthorWorks(author);
    expect(result.works[0]).toMatchObject({
      id: 'W4401050363',
      doi: '10.1000/test',
      title: 'A paper',
      authors: [{ id: author, name: 'Sultanul Arifeen Hamim', orcid: null }],
    });
    expect(request).toHaveBeenCalledTimes(2);
    const [url, options] = request.mock.calls[0];
    expect(url instanceof URL ? url.toString() : '').toContain(
      'https://api.openalex.org/works?',
    );
    expect(url instanceof URL ? url.toString() : '').not.toContain(
      'test-api-key',
    );
    expect(options?.headers).toEqual({ Authorization: 'Bearer test-api-key' });
    expect(
      request.mock.calls[1][0] instanceof URL
        ? request.mock.calls[1][0].toString()
        : '',
    ).toContain('cursor=next');
  });
  it('rejects repeated cursors and malformed records rather than returning partial success', async () => {
    request
      .mockResolvedValueOnce(page([work], 'repeat', 1))
      .mockResolvedValueOnce(page([], 'repeat', 1));
    await expect((await client()).fetchAuthorWorks(author)).rejects.toThrow(
      'cursor',
    );
    request.mockReset().mockResolvedValue(page([{ id: 'bad' }], null));
    await expect((await client()).fetchAuthorWorks(author)).rejects.toThrow(
      'unidentifiable',
    );
  });
  it('reports quota backoff and aborts partial-page fetches', async () => {
    request
      .mockResolvedValueOnce(page([work], 'next', 1))
      .mockResolvedValueOnce(
        new Response('', { status: 429, headers: { 'Retry-After': '120' } }),
      );
    await expect(
      (await client()).fetchAuthorWorks(author),
    ).rejects.toMatchObject({ retryAfterMs: 120000 });
  });
  it('bounds payload size and reports missing profiles', async () => {
    request.mockResolvedValueOnce(
      new Response('', { headers: { 'Content-Length': '20000000' } }),
    );
    await expect((await client()).fetchAuthorWorks(author)).rejects.toThrow(
      'large',
    );
    request
      .mockResolvedValueOnce(page([], null, 0))
      .mockResolvedValueOnce(new Response('', { status: 404 }));
    await expect((await client()).fetchAuthorWorks(author)).rejects.toThrow(
      'not found',
    );
  });
  it('keeps valid IDs with unusable rows present but rejects incomplete envelopes', async () => {
    request.mockResolvedValueOnce(
      page([{ id: 'https://openalex.org/W123' }], null, 1),
    );
    await expect((await client()).fetchAuthorWorks(author)).resolves.toEqual({
      declaredCount: 1,
      presentWorkIds: ['W123'],
      warnings: [expect.objectContaining({ workId: 'W123' })],
      works: [],
    });
    request.mockResolvedValueOnce(page([work], null, 2));
    await expect((await client()).fetchAuthorWorks(author)).rejects.toThrow(
      'incomplete',
    );
  });
  it('reads author citation totals including zero and rejects malformed counts', async () => {
    const service = await client();
    request.mockResolvedValueOnce(
      Response.json({
        id: `https://openalex.org/${author}`,
        cited_by_count: 120,
      }),
    );
    await expect(service.fetchAuthorCitationCount(author)).resolves.toBe(120);
    request.mockResolvedValueOnce(
      Response.json({
        id: `https://openalex.org/${author}`,
        cited_by_count: 0,
      }),
    );
    await expect(service.fetchAuthorCitationCount(author)).resolves.toBe(0);
    for (const count of [-1, 1.5, '120', null, 2147483648]) {
      request.mockResolvedValueOnce(
        Response.json({
          id: `https://openalex.org/${author}`,
          cited_by_count: count,
        }),
      );
      await expect(service.fetchAuthorCitationCount(author)).rejects.toThrow(
        'citation metadata',
      );
    }
    request.mockResolvedValueOnce(
      Response.json({ id: 'https://openalex.org/A123', cited_by_count: 120 }),
    );
    await expect(service.fetchAuthorCitationCount(author)).rejects.toThrow(
      'citation metadata',
    );
  });
});
