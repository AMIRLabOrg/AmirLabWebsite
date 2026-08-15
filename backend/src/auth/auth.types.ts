import type {
  AccountStatus,
  PlatformRole,
} from '../../generated/prisma/client';

export interface AuthenticatedUser {
  id: string;
  email: string | null;
  role: PlatformRole;
  status: AccountStatus;
  person: {
    id: string;
    fullName: string;
    isPublished: boolean;
    rank: string | null;
    slug: string;
    avatar: { id: string } | null;
  } | null;
}
