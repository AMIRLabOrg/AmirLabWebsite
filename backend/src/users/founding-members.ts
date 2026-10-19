import type { PrismaService } from '../database/prisma.service';

export interface FoundingMembers {
  founderId: string | null;
  cofounderIds: string[];
}

export async function readFoundingMembers(
  prisma: PrismaService,
): Promise<FoundingMembers> {
  const members = await prisma.foundingMember.findMany({
    select: { personId: true, role: true },
  });
  return {
    founderId: members.find(({ role }) => role === 'FOUNDER')?.personId ?? null,
    cofounderIds: members
      .filter(({ role }) => role === 'CO_FOUNDER')
      .map(({ personId }) => personId),
  };
}
