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
const page = (results: unknown[], cursor: string | null) =>
  Response.json({ meta: { next_cursor: cursor }, results });
describe('OpenAlex fixed-host client', () => {
  const request = jest.spyOn(globalThis, 'fetch');
  beforeEach(() => request.mockReset());
  afterAll(() => request.mockRestore());
  const client = () =>
    resolveService(OpenAlexClient, [
      {
        provide: SettingsService,
        useValue: { openAlexApiKey: () => Promise.resolve('test-api-key') },
      },
    ]);
  it('uses the current admin key on each request without adding it to the URL', async () => {
    const settings = {
      openAlexApiKey: jest
        .fn()
        .mockResolvedValueOnce('first-token')
        .mockResolvedValueOnce('rotated-token'),
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
      .mockResolvedValueOnce(page([work], 'next'))
      .mockResolvedValueOnce(page([], null));
    const result = await (await client()).fetchAuthorWorks(author);
    expect(result[0]).toMatchObject({
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
    request.mockImplementation(() => Promise.resolve(page([work], 'repeat')));
    await expect((await client()).fetchAuthorWorks(author)).rejects.toThrow(
      'cursor',
    );
    request.mockReset().mockResolvedValue(page([{ id: 'bad' }], null));
    await expect((await client()).fetchAuthorWorks(author)).rejects.toThrow(
      'metadata',
    );
  });
  it('reports quota backoff and aborts partial-page fetches', async () => {
    request
      .mockResolvedValueOnce(page([work], 'next'))
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
      .mockResolvedValueOnce(page([], null))
      .mockResolvedValueOnce(new Response('', { status: 404 }));
    await expect((await client()).fetchAuthorWorks(author)).rejects.toThrow(
      'not found',
    );
  });
});
