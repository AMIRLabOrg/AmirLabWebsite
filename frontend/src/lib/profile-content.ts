export interface ProfileContentEntry {
  label: string | null;
  content: string;
}

export interface ProfileContentBlock {
  heading: string | null;
  entries: ProfileContentEntry[];
}

export interface ProfileRecordView {
  id: string;
  title: string;
  type: string;
  blocks: ProfileContentBlock[];
  entryCount: number;
}

type ProfileEntryInput = string | { label?: string | null; content: string };

function normalizeProfileEntry(entry: ProfileEntryInput): ProfileContentEntry {
  if (typeof entry === "string") return { label: null, content: entry };
  return { label: entry.label ?? null, content: entry.content };
}

export function normalizeProfileSection(section: {
  id: string;
  title: string;
  type: string;
  content?: string;
  subsections?: Array<{
    heading: string | null;
    entries: ProfileEntryInput[];
  }>;
}): ProfileRecordView {
  const blocks: ProfileContentBlock[] = section.subsections?.length
    ? section.subsections.map((subsection) => ({
        heading: subsection.heading,
        entries: subsection.entries.map(normalizeProfileEntry),
      }))
    : section.content
      ? [
          {
            heading: null,
            entries: [{ label: null, content: section.content }],
          },
        ]
      : [];
  return {
    id: section.id,
    title: section.title,
    type: profileSectionLabel(section.type, section.title),
    blocks,
    entryCount: blocks.reduce((total, item) => total + item.entries.length, 0),
  };
}

function profileSectionLabel(type: string, title: string): string {
  if (type === "PROFESSIONAL_COLLABORATION") return "COLLABORATION & SERVICE";
  if (type === "OTHER") {
    const normalizedTitle = title.toLowerCase();
    if (normalizedTitle.includes("project")) return "PROJECTS";
    if (
      normalizedTitle.includes("training") ||
      normalizedTitle.includes("course") ||
      normalizedTitle.includes("certification")
    )
      return "TRAINING & CERTIFICATIONS";
    if (
      normalizedTitle.includes("interest") ||
      normalizedTitle.includes("skill")
    )
      return "INTERESTS & SKILLS";
    if (normalizedTitle.includes("research")) return "RESEARCH";
    return "ADDITIONAL PROFILE";
  }
  return type.replaceAll("_", " ");
}
