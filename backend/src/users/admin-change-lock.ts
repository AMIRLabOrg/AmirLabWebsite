import { ConflictException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';

export async function lockAdministratorChange(
  transaction: Prisma.TransactionClient,
  userId: string | null,
  removesAdministrator = true,
) {
  // All account demotions and removals share this lock before locking people.
  await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended('administrator-change', 0))::text`;
  if (!userId || !removesAdministrator) return;
  const user = await transaction.user.findUnique({
    where: { id: userId },
    select: { role: true, isDeleted: true, status: true },
  });
  if (
    !user ||
    user.role !== 'ADMIN' ||
    user.isDeleted ||
    user.status === 'ARCHIVED'
  )
    return;
  const remaining = await transaction.user.count({
    where: {
      id: { not: userId },
      isDeleted: false,
      role: 'ADMIN',
      status: { not: 'ARCHIVED' },
    },
  });
  if (!remaining)
    throw new ConflictException(
      'The last administrator cannot be removed or demoted',
    );
}
