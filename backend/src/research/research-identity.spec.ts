import { BadRequestException } from '@nestjs/common';
import { normalizeOutputReference } from './research-identity';

describe('normalizeOutputReference', () => {
  it('gives DOI aliases one stable identity', () => {
    const direct = normalizeOutputReference({
      doi: '10.1000/Example',
      label: 'Result',
    });
    const linked = normalizeOutputReference({
      label: 'Result',
      url: 'https://doi.org/10.1000/example',
    });

    expect(direct.identityKey).toBe('doi:10.1000/example');
    expect(linked.identityKey).toBe(direct.identityKey);
  });

  it.each([
    'http://example.org/paper',
    'https://user:secret@example.org/paper',
    'https://example.org/paper#private',
  ])('rejects unsafe source URL %s', (url) => {
    expect(() => normalizeOutputReference({ label: 'Result', url })).toThrow(
      BadRequestException,
    );
  });
});
