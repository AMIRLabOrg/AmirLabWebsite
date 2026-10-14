import { importIssue } from './openalex-importer';
import type { OpenAlexWork } from './openalex-client';
const work: OpenAlexWork = {
  id: 'W123',
  doi: '10.1000/test',
  title: 'Paper',
  type: 'article',
  year: 2025,
  publicationDate: null,
  venue: 'Journal',
  isRetracted: false,
  authors: [{ id: 'A123', name: 'Author', orcid: null }],
};
describe('OpenAlex publication policy', () => {
  it('publishes only complete supported works with matching author identity', () => {
    expect(importIssue(work, 'A123', null)).toBeNull();
    expect(importIssue({ ...work, type: 'software' }, 'A123', null)).toContain(
      'Unsupported',
    );
    expect(importIssue({ ...work, title: null }, 'A123', null)).toContain(
      'Incomplete',
    );
    expect(importIssue({ ...work, isRetracted: true }, 'A123', null)).toContain(
      'Retracted',
    );
    expect(importIssue(work, 'A456', null)).toContain('Author');
    expect(
      importIssue(
        {
          ...work,
          authors: [
            { id: 'A123', name: 'Author', orcid: '0000-0000-0000-1111' },
          ],
        },
        'A123',
        '0000-0000-0000-2222',
      ),
    ).toContain('ORCID');
  });
});
