import {
  normalizeOrcid,
  normalizePersonName,
  parseHtmlMetadata,
  parseJsonMetadata,
  personNameMatchConfidence,
  personNameTokenKey,
} from './source-metadata';

describe('source metadata', () => {
  it('extracts repeated citation authors and aligned ORCIDs', () => {
    const metadata = parseHtmlMetadata(`
      <meta name="citation_title" content="A useful paper">
      <meta content="Dr. Jane Doe" name="citation_author">
      <meta name="citation_author_orcid" content="https://orcid.org/0000-0002-1825-0097">
      <meta name="citation_author" content="John Smith">
      <meta name="citation_doi" content="https://doi.org/10.1000/example.1">
    `);

    expect(metadata).toEqual({
      authors: [
        { name: 'Dr. Jane Doe', orcid: '0000-0002-1825-0097' },
        { name: 'John Smith', orcid: undefined },
      ],
      doi: '10.1000/example.1',
      title: 'A useful paper',
    });
  });

  it('falls back to schema.org JSON-LD creators', () => {
    const metadata = parseHtmlMetadata(`
      <script type="application/ld+json">
        {"@type":"Dataset","name":"Corpus","creator":[
          {"@type":"Person","givenName":"Asha","familyName":"Rahman","sameAs":"https://orcid.org/0000-0001-5109-3700"}
        ]}
      </script>
    `);

    expect(metadata.authors).toEqual([
      { name: 'Asha Rahman', orcid: '0000-0001-5109-3700' },
    ]);
    expect(metadata.title).toBe('Corpus');
  });

  it('reads DOI CSL and Crossref message author records', () => {
    expect(
      parseJsonMetadata({
        DOI: '10.1000/example',
        author: [
          { given: 'Asha', family: 'Rahman' },
          { literal: 'AMIR Lab Consortium' },
        ],
        title: 'Structured DOI metadata',
      }),
    ).toMatchObject({
      authors: [{ name: 'Asha Rahman' }, { name: 'AMIR Lab Consortium' }],
      doi: '10.1000/example',
      title: 'Structured DOI metadata',
    });
  });

  it('normalizes titles, accents, order, and ORCIDs for matching', () => {
    expect(normalizePersonName('Prof. Dr. Ásha  Rahman')).toBe('asha rahman');
    expect(personNameTokenKey('Rahman, Asha')).toBe('asha rahman');
    expect(normalizeOrcid('https://orcid.org/0000-0002-1825-0097')).toBe(
      '0000-0002-1825-0097',
    );
  });

  it('scores exact and publisher-initial author names conservatively', () => {
    expect(
      personNameMatchConfidence(
        'M. F. Mridha',
        'Prof. Dr. Mohammad Firoz Mridha',
      ),
    ).toBe(0.82);
    expect(
      personNameMatchConfidence('Firoz Mridha', 'Mohammad Firoz Mridha'),
    ).toBe(0.86);
    expect(personNameMatchConfidence('Rahman, Asha', 'Dr. Asha Rahman')).toBe(
      0.92,
    );
  });

  it('rejects weak single-initial and family-name-only matches', () => {
    expect(
      personNameMatchConfidence('M. Mridha', 'Mohammad Firoz Mridha'),
    ).toBeUndefined();
    expect(
      personNameMatchConfidence('Mridha', 'Mohammad Firoz Mridha'),
    ).toBeUndefined();
    expect(
      personNameMatchConfidence('M. F. Rahman', 'Mohammad Firoz Mridha'),
    ).toBeUndefined();
  });
});
