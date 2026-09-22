import { createCliPrisma } from './prisma';
import { rebuildDatabase } from './rebuild-db';

async function main(): Promise<void> {
  const prisma = createCliPrisma();
  try {
    const userCount = await prisma.user.count();
    if (userCount > 0) {
      console.log('Database already contains users; skipping seed.');
      return;
    }
  } finally {
    await prisma.$disconnect();
  }

  await rebuildDatabase();
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
