export type ResearchProgramStatus =
  | "ACTIVE"
  | "ARCHIVED"
  | "COMPLETED"
  | "PAUSED"
  | "PLANNED";

export interface ResearchProgramItem {
  researchItemId: string;
  researchItem: {
    id: string;
    type: "DATASET" | "PAPER" | "PROJECT";
    title: string | null;
    summary: string | null;
    reviewStatus: string;
    project: { status: string | null } | null;
    paper: { year: number | null; venue: string | null } | null;
    dataset: { version: string | null } | null;
  };
}

export interface ResearchProgram {
  id: string;
  slug: string;
  name: string;
  summary: string | null;
  objective: string;
  status: ResearchProgramStatus;
  startsAt: string | null;
  endsAt: string | null;
  publicPageEnabled: boolean;
  leadId: string | null;
  lead: {
    id: string;
    fullName: string;
    headline: string | null;
    roleTitle: string | null;
    avatar: { id: string } | null;
  } | null;
  departments: Array<{
    departmentId: string;
    department: { id: string; name: string; abbreviation: string | null };
  }>;
  items: ResearchProgramItem[];
}

export interface ResearchProgramOption {
  id: string;
  title: string | null;
  type: "DATASET" | "PAPER" | "PROJECT";
  reviewStatus: string;
}

export interface ResearchProgramOptions {
  departments: Array<{ id: string; name: string; abbreviation: string | null }>;
  people: Array<{
    id: string;
    fullName: string;
    headline: string | null;
    roleTitle: string | null;
  }>;
  projects: ResearchProgramOption[];
  outputs: ResearchProgramOption[];
}

export function researchProgramStatusLabel(status: ResearchProgramStatus) {
  return status.toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}
