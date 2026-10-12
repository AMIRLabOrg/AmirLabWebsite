import { ConfigService } from '@nestjs/config';
import { readFile, stat } from 'node:fs/promises';
import type { BackupSettingsDto } from '../src/backups/backups.dto';
import { resolve } from 'node:path';
import { BackupsService } from '../src/backups/backups.service';
import {
  type Environment,
  validateEnvironment,
} from '../src/config/environment';
import { PrismaService } from '../src/database/prisma.service';

async function main() {
  const args = process.argv.slice(2);
  const remoteMode = args[0] === '--storage-config';
  const [directory, id, uploads, confirmation] = remoteMode
    ? args.slice(1)
    : args;
  let remote: BackupSettingsDto | undefined;
  if (remoteMode && directory) {
    const metadata = await stat(directory);
    if (!metadata.isFile() || (metadata.mode & 0o077) !== 0)
      throw new Error(
        'Storage configuration must be a private mode-0600 file.',
      );
    remote = JSON.parse(await readFile(directory, 'utf8')) as BackupSettingsDto;
  }
  if (!directory || !id || !uploads || confirmation !== '--replace-local-data')
    throw new Error(
      'Usage: DATABASE_URL=<local-url> pnpm backup:restore:local <backup-directory> <backup-id> <upload-directory> --replace-local-data',
    );
  if (process.env.NODE_ENV === 'production')
    throw new Error('Local recovery is unavailable in production.');
  if (!process.env.DATABASE_URL)
    throw new Error(
      'Set DATABASE_URL explicitly; this command never loads .env.',
    );
  const config = new ConfigService<Environment, true>(
    validateEnvironment({
      ...process.env,
      NODE_ENV: 'test',
      STORAGE_PROVIDER: 'local',
      UPLOAD_ROOT: resolve(uploads),
      FRONTEND_ORIGINS: 'http://localhost:3000',
    }),
  );
  const prisma = new PrismaService(config);
  try {
    const result = await new BackupsService(config, prisma).restore(
      id,
      remoteMode ? undefined : resolve(directory),
      remote,
    );
    console.log(JSON.stringify(result));
  } finally {
    await prisma.$disconnect();
  }
}
void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : 'Local restore failed.',
  );
  process.exitCode = 1;
});
