import {
  PublicationCategory,
  publicationCategory,
} from './publication-category';

describe('publication category', () => {
  it.each([
    ['Journal article', '', PublicationCategory.JOURNAL],
    ['', 'Published in IEEE Access, vol. 12', PublicationCategory.JOURNAL],
    ['Conference paper', '', PublicationCategory.CONFERENCE],
    [
      '',
      'Proceedings of the International Conference on AI',
      PublicationCategory.CONFERENCE,
    ],
    ['Book chapter', '', PublicationCategory.BOOK_CHAPTER],
    [
      '',
      'In: Rahman, A. (eds) Machine Intelligence. Springer, Cham',
      PublicationCategory.BOOK_CHAPTER,
    ],
    ['Preprint', '', PublicationCategory.PREPRINT],
    ['', 'arXiv:2401.01234', PublicationCategory.PREPRINT],
    [
      '',
      'Scientific Reports, 13, 18246 (2023). https://doi.org/10.1038/example',
      PublicationCategory.JOURNAL,
    ],
    ['', 'Unclassified research output', PublicationCategory.OTHER],
  ])('normalizes %s %s', (type, citation, expected) => {
    expect(publicationCategory(type, citation)).toBe(expected);
  });
});
