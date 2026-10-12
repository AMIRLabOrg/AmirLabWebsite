import { cp, mkdir, readFile, readdir, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import {
  BACKUP_UUID,
  validateSnapshot,
  type BackupStorage,
  type Snapshot,
} from './backup-storage';
export class LocalBackupStorage implements BackupStorage {
  constructor(private readonly directory: string) {}
  async list() {
    const snapshots: Snapshot[] = [];
    for (const entry of await readdir(this.directory, {
      withFileTypes: true,
    })) {
      if (!entry.isDirectory() || !BACKUP_UUID.test(entry.name)) continue;
      try {
        snapshots.push(
          validateSnapshot(
            JSON.parse(
              await readFile(
                join(this.directory, entry.name, 'manifest.json'),
                'utf8',
              ),
            ),
            entry.name,
          ),
        );
      } catch {
        /* Incomplete manifests are not recovery points. */
      }
    }
    return snapshots;
  }
  async save(snapshot: Snapshot, directory: string) {
    validateSnapshot(snapshot, snapshot.id);
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const pending = join(this.directory, `.${snapshot.id}.pending`);
    try {
      await cp(directory, pending, {
        recursive: true,
        errorOnExist: true,
        force: false,
      });
      await rename(pending, join(this.directory, snapshot.id));
    } finally {
      await rm(pending, { recursive: true, force: true });
    }
  }
  async load(id: string, directory: string) {
    if (!BACKUP_UUID.test(id)) throw new Error('Invalid backup ID.');
    const source = join(this.directory, id);
    const snapshot = validateSnapshot(
      JSON.parse(await readFile(join(source, 'manifest.json'), 'utf8')),
      id,
    );
    await cp(source, directory, { recursive: true });
    return snapshot;
  }
}
