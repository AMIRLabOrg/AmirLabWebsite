import {
  PlatformRole,
  Prisma,
  ProjectMembershipStatus,
} from '../../generated/prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';

export function accessibleProjectWhere(
  user: AuthenticatedUser,
): Prisma.ProjectWhereInput {
  if (user.role !== PlatformRole.MEMBER) return {};
  return {
    memberships: {
      some: {
        personId: user.person?.id ?? '',
        status: ProjectMembershipStatus.ACTIVE,
      },
    },
  };
}
