import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { PrismaService } from '../src/database/prisma.service';
import { validateEnvironment } from '../src/config/environment';
import { ResearchProfileSyncService } from '../src/research/research-profile-sync.service';

export function assertLocalTarget(
  value: string | undefined,
  confirmation: string | undefined,
) {
  if (
    !value ||
    confirmation !== '--replace-local-papers' ||
    process.env.NODE_ENV === 'production'
  )
    throw new Error(
      'Set DATABASE_URL explicitly and pass --replace-local-papers. This command never loads .env.',
    );
  const url = new URL(value);
  if (
    !['postgresql:', 'postgres:'].includes(url.protocol) ||
    url.hostname !== '127.0.0.1' ||
    url.port !== '5433' ||
    url.pathname !== '/amirl' ||
    url.search ||
    url.hash
  )
    throw new Error(
      'Reset requires exactly local amirl at 127.0.0.1:5433 without URL options.',
    );
  return value;
}
export async function verifyLegacyBackup(directory: string) {
  const root = resolve(directory);
  const value: unknown = JSON.parse(
    await readFile(resolve(root, 'manifest.json'), 'utf8'),
  );
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    !('purpose' in value) ||
    value.purpose !== 'legacy-before-openalex' ||
    !('target' in value) ||
    !('files' in value)
  )
    throw new Error('Invalid legacy backup manifest.');
  const target = value.target;
  if (
    !target ||
    typeof target !== 'object' ||
    !('host' in target) ||
    target.host !== '127.0.0.1' ||
    !('port' in target) ||
    target.port !== 5433 ||
    !('database' in target) ||
    target.database !== 'amirl'
  )
    throw new Error('Backup target mismatch.');
  const files = value.files;
  if (
    !files ||
    typeof files !== 'object' ||
    Array.isArray(files) ||
    !('database.dump' in files) ||
    !('archive-list.txt' in files)
  )
    throw new Error('Incomplete legacy backup.');
  for (const [name, digest] of Object.entries(files)) {
    const path = resolve(root, name);
    const rel = relative(root, path);
    if (
      isAbsolute(rel) ||
      rel.startsWith('..') ||
      typeof digest !== 'string' ||
      !/^[a-f0-9]{64}$/.test(digest)
    )
      throw new Error('Invalid backup file entry.');
    if (
      createHash('sha256')
        .update(await readFile(path))
        .digest('hex') !== digest
    )
      throw new Error(`Backup checksum mismatch: ${name}`);
  }
}
async function main() {
  const [backup, confirmation] = process.argv.slice(2);
  const url = assertLocalTarget(process.env.DATABASE_URL, confirmation);
  if (!backup) throw new Error('Provide the legacy backup directory.');
  await verifyLegacyBackup(backup);
  const prisma = new PrismaService(
    new ConfigService(
      validateEnvironment({
        DATABASE_URL: url,
        NODE_ENV: 'test',
        FRONTEND_ORIGINS: 'http://localhost:3000',
        STORAGE_PROVIDER: 'local',
      }),
    ),
  );
  try {
    const identity = await prisma.$queryRaw<
      Array<{ database: string; host: string; port: number }>
    >`SELECT current_database() AS database, host(inet_server_addr()) AS host, inet_server_port() AS port`;
    if (
      identity[0]?.database !== 'amirl' ||
      identity[0]?.host !== '127.0.0.1' ||
      identity[0]?.port !== 5433
    )
      throw new Error('Connected database identity mismatch.');
    const result = await prisma.$transaction(
      async (db) => {
        await db.$executeRaw`LOCK TABLE "ResearchItem" IN ACCESS EXCLUSIVE MODE`;
        const before = {
          users: await db.user.count(),
          people: await db.person.count(),
          papers: await db.paper.count(),
          projects: await db.project.count(),
          datasets: await db.dataset.count(),
          profileEntries: await db.personProfileEntry.count(),
        };
        const papers = await db.researchItem.findMany({
          where: { type: 'PAPER' },
          select: { id: true },
        });
        const ids = papers.map(({ id }) => id);
        await new ResearchProfileSyncService(prisma).normalizePublishedOutputs(
          ids,
          null,
          db,
        );
        await db.weeklyReportOutput.deleteMany({
          where: { outputId: { in: ids } },
        });
        await db.researchProgramItem.deleteMany({
          where: { researchItemId: { in: ids } },
        });
        await db.researchItem.deleteMany({ where: { type: 'PAPER' } });
        await db.personMetric.updateMany({ data: { publishedPaperCount: 0 } });
        await db.person.updateMany({ data: { earnedRank: null } });
        const after = {
          users: await db.user.count(),
          people: await db.person.count(),
          papers: await db.paper.count(),
          projects: await db.project.count(),
          datasets: await db.dataset.count(),
          profileEntries: await db.personProfileEntry.count(),
        };
        if (
          after.users !== before.users ||
          after.people !== before.people ||
          after.projects !== before.projects ||
          after.datasets !== before.datasets ||
          after.papers !== 0
        )
          throw new Error('Reset preservation invariant failed.');
        await db.auditRecord.create({
          data: {
            action: 'research.local-legacy-papers-cleared',
            entityId: 'local-amirl',
            entityType: 'ResearchItem',
            details: { before, after, backup: resolve(backup) },
          },
        });
        return { before, after };
      },
      { timeout: 60_000 },
    );
    console.log(JSON.stringify(result));
  } finally {
    await prisma.$disconnect();
  }
}
if (process.argv[1]?.endsWith('reset-local-papers.ts'))
  void main().catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : 'Local paper reset failed.',
    );
    process.exitCode = 1;
  });
