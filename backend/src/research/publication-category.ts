export enum PublicationCategory {
  JOURNAL = 'JOURNAL',
  CONFERENCE = 'CONFERENCE',
  BOOK_CHAPTER = 'BOOK_CHAPTER',
  PREPRINT = 'PREPRINT',
  OTHER = 'OTHER',
}

export const PUBLICATION_CATEGORY_LABELS: Record<PublicationCategory, string> =
  {
    [PublicationCategory.JOURNAL]: 'Journal',
    [PublicationCategory.CONFERENCE]: 'Conference',
    [PublicationCategory.BOOK_CHAPTER]: 'Book chapter',
    [PublicationCategory.PREPRINT]: 'Preprint',
    [PublicationCategory.OTHER]: 'Other',
  };

export function publicationCategory(
  publicationType?: string | null,
  citation?: string | null,
  venue?: string | null,
): PublicationCategory {
  const declared = `${publicationType ?? ''} ${venue ?? ''}`.toLowerCase();
  const source = `${declared} ${citation ?? ''}`.toLowerCase();
  if (/arxiv|pre[ -]?print/.test(source)) return PublicationCategory.PREPRINT;
  if (/book chapter|chapter in|edited volume/.test(source)) {
    return PublicationCategory.BOOK_CHAPTER;
  }
  if (/conference|proceedings|symposium|workshop|congress/.test(source)) {
    return PublicationCategory.CONFERENCE;
  }
  if (
    /journal|transactions|letters|magazine|ieee access|article/.test(source)
  ) {
    return PublicationCategory.JOURNAL;
  }
  if (/\bbook\b|\(eds?\)|springer, (singapore|cham)/.test(source)) {
    return PublicationCategory.BOOK_CHAPTER;
  }
  // After excluding proceedings, books, and preprints, a canonical DOI is
  // the strongest signal available in older AMIR Lab citation records.
  if (/doi\.org\/|\bdoi\s*:/.test(source)) return PublicationCategory.JOURNAL;
  return PublicationCategory.OTHER;
}
