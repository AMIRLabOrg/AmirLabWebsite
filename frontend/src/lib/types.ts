import type { ReviewIssue } from "./review-issues";
export type ResearchItemType = "PAPER" | "DATASET" | "PROJECT";

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface NotificationRecord {
  id: string;
  type?: string;
  title: string;
  body: string;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface ResearchItem {
  id: string;
  slug: string;
  title: string | null;
  summary: string | null;
  canonicalUrl: string | null;
  legacyUrl: string | null;
  type: ResearchItemType;
  paper: {
    citation: string | null;
    venue: string | null;
    year: number | null;
    doi: string | null;
    publicationType: string | null;
  } | null;
  dataset: { license: string | null; version: string | null } | null;
  project: Project | null;
  contributors: Array<{
    displayName: string;
    sortOrder: number;
    person?: { fullName: string; slug: string } | null;
  }>;
}

export interface Project {
  status: string | null;
  objective: string | null;
  publicPageEnabled?: boolean;
  version?: number;
  objectives?: Array<{
    id: string;
    title: string;
    description: string | null;
    sortOrder: number;
  }>;
  milestones?: Array<{
    id: string;
    title: string;
    description: string | null;
    weight: number;
    progress: number;
    status: string;
    dueAt: string | null;
    completedAt: string | null;
    sortOrder: number;
    owner?: Pick<Person, "id" | "slug" | "fullName"> | null;
  }>;
  updates?: Array<{
    id: string;
    title: string;
    body: string;
    status: string;
    publishedAt: string | null;
    createdAt: string;
  }>;
  memberships?: Array<{
    id: string;
    role: string;
    access: string;
    status: string;
    person: Pick<Person, "id" | "slug" | "fullName" | "avatar">;
  }>;
  resources?: Array<{
    id: string;
    label: string;
    kind: string;
    url: string;
    sortOrder: number;
  }>;
}

export interface Department {
  id: string;
  slug: string;
  name: string;
  abbreviation: string | null;
  description: string | null;
  isPublished: boolean;
  people: Array<{
    role: "HEAD" | "LEAD" | "MEMBER";
    sortOrder: number;
    isPrimary: boolean;
    person: Person;
  }>;
  researchItems?: Array<{ researchItem: ResearchItem }>;
  positions?: Position[];
  _count?: { people: number; researchItems: number; positions?: number };
}

export interface ProfileSectionEntry {
  label: string | null;
  content: string;
}

export interface Person {
  id: string;
  slug: string;
  fullName: string;
  headline: string | null;
  biography: string | null;
  contactAddress: string | null;
  publicEmail: string | null;
  phone: string | null;
  rank: string | null;
  appointedRank?: string | null;
  earnedRank?: string | null;
  metrics?: {
    publishedPaperCount: number;
    scholarCitationCount: number | null;
    scholarSyncedAt: string | null;
  } | null;
  roleTitle: string | null;
  expertise: string[];
  isAlumni: boolean;
  avatar: { id: string; width: number | null; height: number | null } | null;
  links?: Array<{
    id: string;
    label: string;
    type: string;
    url: string;
  }>;
  profileSections?: Array<{
    id: string;
    title: string;
    type: string;
    content?: string;
    subsections?: Array<{
      heading: string | null;
      entries: ProfileSectionEntry[];
    }>;
  }>;
  contributions?: Array<{
    displayName: string;
    sortOrder: number;
    researchItem: ResearchItem;
  }>;
}

export interface AuthenticatedUser {
  id: string;
  email: string | null;
  role: "MEMBER" | "MODERATOR" | "ADMIN";
  status: string;
  person: {
    id: string;
    fullName: string;
    isPublished: boolean;
    rank: string | null;
    slug: string;
    avatar: { id: string } | null;
  } | null;
}

export interface CollaborationConversation {
  id: string;
  kind: "DIRECT" | "PROJECT" | "LAB";
  title: string | null;
  updatedAt: string;
  project?: { researchItem: { title: string | null } } | null;
  members: Array<{
    userId: string;
    user: {
      id: string;
      person: { fullName: string; avatar: { id: string } | null } | null;
    };
  }>;
  messages: CollaborationMessage[];
}

export interface CollaborationMessage {
  id: string;
  body: string;
  kind: "USER" | "SYSTEM";
  createdAt: string;
  senderId: string;
  sender: {
    id: string;
    person: { fullName: string; avatar: { id: string } | null } | null;
  };
  conversationId: string;
  replyTo?: {
    id: string;
    body: string;
    sender: { fullName: string } | null;
  } | null;
}

export interface ProfileEditPayload {
  fullName: string;
  headline: string | null;
  biography: string | null;
  publicEmail: string | null;
  phone: string | null;
  contactAddress: string | null;
  roleTitle?: string | null;
  expertise: string[];
  links: Array<{ type: string; label: string; url: string }>;
  sections: Array<{
    type: string;
    title: string;
    subsections: Array<{
      heading: string | null;
      entries: ProfileSectionEntry[];
    }>;
  }>;
  removeAvatar: boolean;
}

export interface ProfileEditRequest {
  id: string;
  status: "NEEDS_REVIEW" | "APPROVED" | "REJECTED";
  revision: number;
  note: string | null;
  submittedAt: string;
  payload: ProfileEditPayload;
  avatarAsset: { id: string } | null;
  person: Person;
  reviewIssues?: ReviewIssue[];
}

export interface MyProfile {
  accountRole: AuthenticatedUser["role"];
  profile: Person;
  draft: Omit<ProfileEditRequest, "person"> | null;
}

export interface Position {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string | null;
  responsibilities: string[];
  requirements: string[];
  positionType:
    | "INTERNSHIP"
    | "RESEARCH_ASSISTANT"
    | "PROJECT_ASSISTANT"
    | "FELLOW"
    | "STAFF"
    | "VOLUNTEER"
    | "OTHER";
  status: "DRAFT" | "OPEN" | "CLOSED" | "ARCHIVED";
  deadline: string | null;
  opensAt: string | null;
  closesAt: string | null;
  engagementType: "FIXED_TERM" | "OPEN_ENDED" | "FLEXIBLE";
  engagementStartsAt: string | null;
  engagementEndsAt: string | null;
  engagementDurationLabel: string | null;
  weeklyCommitmentHours: number | null;
  targetRank: string | null;
  departmentId?: string | null;
  department: { id?: string; name: string } | null;
  _count?: { applications: number };
  createdAt?: string;
  updatedAt?: string;
}

export interface PublicStats {
  papers: number;
  people: number;
  datasets: number;
  projects: number;
  openPositions: number;
}

export interface HomeContent {
  establishment: string;
  heroTitle: string;
  heroIntroduction: string;
  primaryCtaLabel: string;
  secondaryCtaLabel: string;
  latestEyebrow: string;
  latestTitle: string;
  recruitmentEyebrow: string;
  recruitmentTitle: string;
  recruitmentBody: string;
}

export interface AboutContent {
  eyebrow: string;
  title: string;
  introduction: string;
  missionTitle: string;
  missionBody: string;
  focusTitle: string;
  focusAreas: string[];
  organizationTitle: string;
  organizationBody: string;
  facts: Array<{ label: string; value: string }>;
  closingTitle: string;
  closingBody: string;
}

export interface SiteContentResponse<T> {
  content: T;
  updatedAt: string | null;
}

export interface University {
  id: string;
  slug: string;
  name: string;
  websiteUrl: string | null;
  logoAssetId: string | null;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}
