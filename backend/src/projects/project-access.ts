import {
  PlatformRole,
  Prisma,
  ProjectMembershipStatus,
  ReviewStatus,
} from '../../generated/prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';

export function accessibleProjectWhere(
  user: AuthenticatedUser,
): Prisma.ProjectWhereInput {
  const activeProject: Prisma.ProjectWhereInput = {
    researchItem: { is: { reviewStatus: { not: ReviewStatus.ARCHIVED } } },
  };
  if (user.role !== PlatformRole.MEMBER) return activeProject;
  return {
    ...activeProject,
    memberships: {
      some: {
        personId: user.person?.id ?? '',
        status: ProjectMembershipStatus.ACTIVE,
      },
    },
  };
}
