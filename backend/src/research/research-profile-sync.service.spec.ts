import {
  PersonSectionType,
  ResearchItemType,
} from '../../generated/prisma/client';
import {
  matchesProfileOutput,
  prunePendingProfile,
  type OutputIdentity,
} from './research-profile-sync.service';

const paper: OutputIdentity = {
  type: ResearchItemType.PAPER,
  title: 'Content-Based Image Retrieval Using AutoEmbedder',
  canonicalUrl: 'https://doi.org/10.1234/example',
  doi: '10.1234/example',
};

describe('research profile output normalization', () => {
  it('recognizes a canonical paper inside a full citation', () => {
    expect(
      matchesProfileOutput(
        'Kabir, M. et al. “Content-Based Image Retrieval Using AutoEmbedder.” Journal of Example, 2024.',
        paper,
      ),
    ).toBe(true);
  });

  it('does not match unrelated profile text', () => {
    expect(
      matchesProfileOutput('Machine learning and computer vision', paper),
    ).toBe(false);
  });

  it('removes only the duplicate publication entry from a pending profile payload', () => {
    const payload = {
      fullName: 'Researcher',
      sections: [
        {
          type: PersonSectionType.PUBLICATIONS,
          title: 'Publications',
          subsections: [
            {
              heading: null,
              entries: [
                {
                  label: null,
                  content:
                    'Kabir, M. et al. “Content-Based Image Retrieval Using AutoEmbedder.” Journal of Example.',
                },
                { label: null, content: 'A Different Research Paper' },
              ],
            },
          ],
        },
      ],
    };

    const result = prunePendingProfile(payload, paper);
    expect(result.removed).toBe(1);
    expect(result.payload).toMatchObject({
      sections: [
        {
          subsections: [
            { entries: [{ content: 'A Different Research Paper' }] },
          ],
        },
      ],
    });
  });
});
