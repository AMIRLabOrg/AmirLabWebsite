import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import type { Environment } from '../config/environment';
import { PrismaService } from '../database/prisma.service';
import type { BackupSettingsDto } from './backups.dto';
import {
  BACKUP_UUID as UUID,
  validateSettings,
  type BackupSettings,
  type ValidatedBackupSettings,
  type BackupStorage,
  type BackupSecrets,
  type Snapshot,
} from './backup-storage';
import { mergeSecrets } from './backup-credentials';
import {
  EncryptedCredentials,
  type EncryptedSecrets,
} from '../common/encrypted-credentials';
import { LocalBackupStorage } from './local-backup-storage';
import { S3BackupStorage } from './s3-backup-storage';
import { SftpBackupStorage } from './sftp-backup-storage';
type StoredSettings = ValidatedBackupSettings & {
  credentials?: EncryptedSecrets;
};

const execute = promisify(execFile);
const KEY = 'backups.local';
@Injectable()
export class BackupsService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private busy = false;
  private readonly logger = new Logger(BackupsService.name);

  constructor(
    private readonly config: ConfigService<Environment, true>,
    private readonly prisma: PrismaService,
  ) {}

  private async assertNoInterruptedRestore() {
    const pending = `${resolve(this.config.get('uploadRoot', { infer: true }))}.restore-pending.json`;
    try {
      await readFile(pending);
      throw new Error(
        `Interrupted local restore detected. Stop the API and recover using backup:restore:local; recovery details are in ${pending}.`,
      );
    } catch (error) {
      if (
        !error ||
        typeof error !== 'object' ||
        !('code' in error) ||
        error.code !== 'ENOENT'
      )
        throw error;
    }
  }

  async onModuleInit() {
    await this.assertNoInterruptedRestore();
    this.timer = setInterval(() => {
      void this.runScheduled().catch(() =>
        this.logger.warn(
          'Scheduled local backup failed; check PostgreSQL tools and storage permissions.',
        ),
      );
    }, 60_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private localTarget() {
    const url = new URL(this.config.get('databaseUrl', { infer: true }));
    if (
      this.config.get('nodeEnv', { infer: true }) === 'production' ||
      !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      this.config.get('storageProvider', { infer: true }) !== 'local'
    )
      throw new BadRequestException(
        'Backup and restore currently support local PostgreSQL and local uploads in development or test only.',
      );
    return url;
  }

  private async settings(): Promise<StoredSettings | null> {
    const row = await this.prisma.siteSetting.findUnique({
      where: { key: KEY },
    });
    if (!row) return null;
    const settings = validateSettings(row.value);
    if (
      row.value &&
      typeof row.value === 'object' &&
      !Array.isArray(row.value) &&
      'credentials' in row.value &&
      row.value.credentials !== undefined
    ) {
      const encrypted = row.value.credentials;
      if (
        !encrypted ||
        typeof encrypted !== 'object' ||
        Array.isArray(encrypted) ||
        typeof encrypted.iv !== 'string' ||
        typeof encrypted.tag !== 'string' ||
        typeof encrypted.ciphertext !== 'string'
      )
        return settings; // Missing credentials can be repaired by re-entering them.
      return {
        ...settings,
        credentials: {
          iv: encrypted.iv,
          tag: encrypted.tag,
          ciphertext: encrypted.ciphertext,
        },
      };
    }
    return settings;
  }

  private credentials() {
    return new EncryptedCredentials<BackupSecrets>(
      this.config.get('encryptionKey', { infer: true }) ?? '',
      `${resolve(this.config.get('uploadRoot', { infer: true }))}.backup-key`,
    );
  }

  private async storage(
    settings: StoredSettings,
    explicitSecrets?: BackupSecrets,
  ): Promise<BackupStorage> {
    if (settings.provider === 'local')
      return new LocalBackupStorage(settings.directory);
    const secrets =
      explicitSecrets ??
      (settings.credentials
        ? await this.credentials().decrypt(settings.credentials)
        : {});
    this.requireSecrets(settings, secrets);
    return settings.provider === 's3'
      ? new S3BackupStorage(settings, secrets)
      : new SftpBackupStorage(settings, secrets);
  }

  private requireSecrets(settings: BackupSettings, secrets: BackupSecrets) {
    const keys: (keyof BackupSecrets)[] =
      settings.provider === 's3'
        ? ['accessKeyId', 'secretAccessKey']
        : settings.provider === 'sftp'
          ? [settings.authentication === 'password' ? 'password' : 'privateKey']
          : [];
    if (keys.some((key) => typeof secrets[key] !== 'string' || !secrets[key]))
      throw new BadRequestException(
        'Enter credentials for the selected backup provider.',
      );
  }

  async configure(input: BackupSettingsDto) {
    this.localTarget();
    if (this.busy)
      throw new ConflictException('A backup or restore is running.');
    this.busy = true;
    try {
      const value: StoredSettings = validateSettings(input);
      if (value.provider === 'local')
        value.directory = await this.storageDirectory(value.directory);
      else {
        await mkdir(resolve(this.config.get('uploadRoot', { infer: true })), {
          recursive: true,
          mode: 0o700,
        });
        const previous = await this.settings();
        let saved: BackupSecrets = {};
        if (
          previous?.credentials &&
          previous.provider === value.provider &&
          previous.authentication === value.authentication
        ) {
          try {
            saved = await this.credentials().decrypt(previous.credentials);
          } catch {
            /* Re-entering all credentials repairs a lost encryption key. */
          }
        }
        const secrets = mergeSecrets(previous, value, saved, input);
        this.requireSecrets(value, secrets);
        value.credentials = this.credentials().encrypt(secrets);
      }
      const json = JSON.parse(
        JSON.stringify(value),
      ) as import('../../generated/prisma/client').Prisma.InputJsonValue;
      await this.prisma.siteSetting.upsert({
        where: { key: KEY },
        create: { key: KEY, value: json },
        update: { value: json },
      });
    } finally {
      this.busy = false;
    }
    return this.status();
  }

  private async storageDirectory(path: string) {
    if (!isAbsolute(path))
      throw new BadRequestException('Use an absolute backup directory.');
    await mkdir(path, { recursive: true, mode: 0o700 });
    const directory = await realpath(path);
    const uploadRoot = this.config.get('uploadRoot', { infer: true });
    await mkdir(uploadRoot, { recursive: true });
    const uploads = await realpath(uploadRoot);
    if (this.within(directory, uploads) || this.within(uploads, directory))
      throw new BadRequestException(
        'Backup directory and uploads must not overlap.',
      );
    return directory;
  }

  private within(path: string, root: string) {
    const child = relative(root, path);
    return child === '' || (!child.startsWith('..') && !isAbsolute(child));
  }

  async status() {
    const settings = await this.settings();
    let supported = true;
    try {
      this.localTarget();
    } catch {
      supported = false;
    }
    const backups: Array<{
      id: string;
      createdAt: string;
      verified: boolean | null;
      purpose: 'manual' | 'scheduled' | 'safety';
    }> = [];
    let unavailable = false;
    if (settings && supported) {
      let storage: Awaited<ReturnType<BackupsService['storage']>> | undefined;
      try {
        storage = await this.storage(settings);
        for (const snapshot of await storage.list()) {
          let verified: boolean | null = null;
          if (settings.provider === 'local') {
            verified = false;
            try {
              await this.verifySnapshot(
                join(settings.directory, snapshot.id),
                snapshot,
              );
              verified = true;
            } catch {
              /* Corrupt local archives remain visible but cannot be restored. */
            }
          }
          backups.push({
            id: snapshot.id,
            createdAt: snapshot.createdAt,
            verified,
            purpose: snapshot.purpose ?? 'manual',
          });
        }
      } catch {
        unavailable = true;
      } finally {
        storage?.close?.();
      }
    }
    const publicSettings = settings ? validateSettings(settings) : null;
    backups.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    return {
      configured: !!settings,
      provider: settings ? (settings.provider ?? 'local') : null,
      settings: publicSettings,
      canBackup: supported && !!settings && !unavailable && !this.busy,
      canRestore:
        supported &&
        !!settings &&
        backups.some((backup) => backup.verified !== false) &&
        !this.busy,
      busy: this.busy,
      backups,
      lastBackup:
        backups.find(
          (backup) => backup.verified !== false && backup.purpose !== 'safety',
        ) ?? null,
      reason: !supported
        ? 'LOCAL_TEST_ONLY'
        : unavailable
          ? 'STORAGE_UNAVAILABLE'
          : !settings
            ? 'STORAGE_NOT_CONFIGURED'
            : null,
    };
  }

  async runScheduled(now = new Date()) {
    if (this.busy) return;
    const status = await this.status();
    if (!status.canBackup || !status.settings?.enabled) return;
    const last = status.lastBackup
      ? Date.parse(status.lastBackup.createdAt)
      : 0;
    if (now.getTime() - last >= status.settings.intervalMinutes * 60_000)
      await this.capture('scheduled');
  }

  private async configured() {
    this.localTarget();
    const settings = await this.settings();
    if (!settings)
      throw new BadRequestException('Configure backup storage first.');
    return settings;
  }

  private async pg(command: 'pg_dump' | 'pg_restore', args: string[]) {
    const url = this.localTarget();
    await execute(command, args, {
      timeout: 300_000,
      env: {
        ...process.env,
        PGHOST: url.hostname.replace(/^\[|\]$/g, ''),
        PGPORT: url.port || '5432',
        PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
        PGUSER: decodeURIComponent(url.username),
        PGPASSWORD: decodeURIComponent(url.password),
      },
    }).catch(() => {
      throw new BadRequestException(
        'PostgreSQL backup operation failed. Check local database access, client tools, and server logs.',
      );
    });
  }

  private async hashes(folder: string): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    const visit = async (directory: string) => {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) await visit(path);
        else if (entry.isFile()) {
          const hash = createHash('sha256');
          for await (const chunk of createReadStream(path))
            hash.update(chunk as Buffer);
          result[relative(folder, path)] = hash.digest('hex');
        } else
          throw new BadRequestException(
            'Backup verification does not allow symbolic links or special files.',
          );
      }
    };
    await visit(folder);
    delete result['manifest.json'];
    return result;
  }

  private async verifySnapshot(folder: string, snapshot: Snapshot) {
    const files = await this.hashes(folder);
    if (
      snapshot.database !==
        decodeURIComponent(this.localTarget().pathname.slice(1)) ||
      Object.keys(files).length !== Object.keys(snapshot.files).length ||
      Object.entries(files).some(
        ([file, hash]) => snapshot.files[file] !== hash,
      )
    )
      throw new BadRequestException(
        'Backup verification failed: database or file checksum mismatch.',
      );
    await this.pg('pg_restore', ['--list', join(folder, 'database.dump')]);
  }

  private async snapshot(
    settings: StoredSettings,
    purpose: 'manual' | 'scheduled' | 'safety',
  ) {
    const id = randomUUID();
    const storage = await this.storage(settings);
    let folder: string | undefined;
    try {
      folder = await mkdtemp(join(tmpdir(), `amirlab-backup-${id}-`));
      await this.pg('pg_dump', [
        '--format=custom',
        '--no-owner',
        '--no-acl',
        '--file',
        join(folder, 'database.dump'),
      ]);
      await this.pg('pg_restore', ['--list', join(folder, 'database.dump')]);
      const uploads = resolve(this.config.get('uploadRoot', { infer: true }));
      await cp(uploads, join(folder, 'uploads'), { recursive: true });
      const files = await this.hashes(folder);
      const snapshot: Snapshot = {
        version: 1,
        purpose,
        id,
        createdAt: new Date().toISOString(),
        database: decodeURIComponent(this.localTarget().pathname.slice(1)),
        files,
      };
      await writeFile(join(folder, 'manifest.json'), JSON.stringify(snapshot), {
        mode: 0o600,
      });
      await storage.save(snapshot, folder);
      return { id, createdAt: snapshot.createdAt, verified: true };
    } finally {
      storage.close?.();
      if (folder) await rm(folder, { recursive: true, force: true });
    }
  }

  async capture(purpose: 'manual' | 'scheduled' = 'manual') {
    await this.assertNoInterruptedRestore();
    const settings = await this.configured();
    if (this.busy)
      throw new ConflictException('A backup or restore is running.');
    this.busy = true;
    try {
      return await this.snapshot(settings, purpose);
    } finally {
      this.busy = false;
    }
  }

  async restore(id: string, directory?: string, remote?: BackupSettingsDto) {
    this.localTarget();
    // An explicit directory lets the recovery CLI work when the settings table is gone.
    const settings: StoredSettings = remote
      ? validateSettings(remote)
      : directory
        ? {
            provider: 'local',
            directory: await this.storageDirectory(directory),
            enabled: false,
            intervalMinutes: 60,
          }
        : await this.configured();
    if (!UUID.test(id)) throw new BadRequestException('Invalid backup ID.');
    const uploads = resolve(this.config.get('uploadRoot', { infer: true }));
    const staging = `${uploads}.restore-${randomUUID()}`;
    const previous = `${uploads}.previous-${randomUUID()}`;
    const pending = `${uploads}.restore-pending.json`;
    let swapped = false;
    const previousPending = await readFile(pending, 'utf8').catch(
      (error: unknown) => {
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 'ENOENT'
        )
          return undefined;
        throw error;
      },
    );
    const resetPending = async () => {
      if (previousPending !== undefined)
        await writeFile(pending, previousPending, { mode: 0o600 });
      else await rm(pending, { force: true });
    };
    if (this.busy)
      throw new ConflictException('A backup or restore is running.');
    this.busy = true;
    let folder: string | undefined;
    let storage: Awaited<ReturnType<BackupsService['storage']>> | undefined;
    try {
      folder = await mkdtemp(join(tmpdir(), 'amirlab-restore-'));
      storage = await this.storage(settings, remote);
      const snapshot = await storage.load(id, folder);
      await this.verifySnapshot(folder, snapshot);
      // Keep a complete recovery point before touching either local resource.
      if (remote && settings.provider !== 'local')
        settings.credentials = this.credentials().encrypt(
          mergeSecrets(null, settings, {}, remote),
        );
      const safety = await this.snapshot(settings, 'safety');
      await cp(join(folder, 'uploads'), staging, { recursive: true });
      await writeFile(
        pending,
        JSON.stringify({
          directory: settings.directory,
          safetyBackupId: safety.id,
          selectedBackupId: id,
          previousUploads: previous,
          previousRecovery: previousPending,
        }),
        { mode: 0o600 },
      );
      try {
        await rename(uploads, previous);
      } catch (error) {
        await resetPending();
        throw error;
      }
      try {
        await rename(staging, uploads);
      } catch (error) {
        await rename(previous, uploads);
        await resetPending();
        throw error;
      }
      swapped = true;
      try {
        await this.pg('pg_restore', [
          '--clean',
          '--if-exists',
          '--no-owner',
          '--no-acl',
          '--exit-on-error',
          '--single-transaction',
          '--dbname',
          snapshot.database,
          join(folder, 'database.dump'),
        ]);
      } catch (error) {
        await rm(uploads, { recursive: true, force: true });
        await rename(previous, uploads);
        swapped = false;
        await resetPending();
        throw error;
      }
      await rm(previous, { recursive: true, force: true });
      swapped = false;
      await rm(pending, { force: true });
      return { restored: true, id, safetyBackupId: safety.id };
    } finally {
      this.busy = false;
      storage?.close?.();
      if (folder) await rm(folder, { recursive: true, force: true });
      await rm(staging, { recursive: true, force: true });
      if (swapped)
        this.logger.warn(
          'Restore completed but previous uploads were retained for recovery.',
        );
    }
  }
}
