export interface ProfileContentBlock {
  heading: string | null;
  entries: string[];
}

export interface ProfileRecordView {
  id: string;
  title: string;
  type: string;
  blocks: ProfileContentBlock[];
  entryCount: number;
}

export function normalizeProfileSection(section: {
  id: string;
  title: string;
  type: string;
  content?: string;
  subsections?: Array<{
    heading: string | null;
    entries: string[];
  }>;
}): ProfileRecordView {
  const blocks = section.subsections?.length
    ? section.subsections
    : section.content
      ? [{ heading: null, entries: [section.content] }]
      : [];
  return {
    id: section.id,
    title: section.title,
    type: section.type.replaceAll("_", " "),
    blocks,
    entryCount: blocks.reduce(
      (total, item) => total + item.entries.length,
      0,
    ),
  };
}
