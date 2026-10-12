/* eslint-disable no-control-regex -- Reject control characters at backup trust boundaries. */
import { BadRequestException } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, posix } from 'node:path';
import {
  BACKUP_UUID,
  validateSnapshot,
  type BackupStorage,
  type BackupSettings,
  type BackupSecrets,
  type Snapshot,
} from './backup-storage';
export function quoteSftp(value: string) {
  if (/[\x00-\x1f\x7f]/.test(value))
    throw new BadRequestException('Invalid SFTP path.');
  return `"${value.replace(/[\\"*?[\]]/g, (char) => `\\${char}`)}"`;
}
async function executeSftp(
  args: string[],
  input: string,
  env: NodeJS.ProcessEnv,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('sftp', args, { env, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('SFTP timeout.'));
    }, 300_000);
    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString();
      if (output.length > 8 * 1024 * 1024) {
        child.kill('SIGKILL');
        reject(new Error('SFTP listing too large.'));
      }
    });
    child.stderr.resume();
    child.stdin.on('error', () => {
      /* Exit/error handler reports a failed command. */
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(output);
      else reject(new Error('SFTP operation failed.'));
    });
    child.stdin.end(input);
  });
}
export class SftpBackupStorage implements BackupStorage {
  constructor(
    private readonly settings: BackupSettings,
    private readonly secrets: BackupSecrets,
    private readonly execute = executeSftp,
  ) {}
  private path(id: string, file = '') {
    return posix.join(this.settings.remoteDirectory!, id, file);
  }
  private async run(script: string) {
    const folder = await mkdtemp(join(tmpdir(), 'amirlab-sftp-'));
    try {
      const host = this.settings.host!;
      const port = this.settings.port ?? 22;
      const pin = port === 22 ? host : `[${host}]:${port}`;
      const known = join(folder, 'known_hosts');
      await writeFile(known, `${pin} ${this.settings.hostKey}\n`, {
        mode: 0o600,
      });
      const options = [
        'StrictHostKeyChecking=yes',
        `UserKnownHostsFile=${known}`,
        'GlobalKnownHostsFile=/dev/null',
        'UpdateHostKeys=no',
        'ConnectTimeout=15',
        'ConnectionAttempts=1',
        'ServerAliveInterval=15',
        'ServerAliveCountMax=3',
        'IdentitiesOnly=yes',
        'IdentityAgent=none',
        'NumberOfPasswordPrompts=1',
      ];
      const env = { ...process.env };
      const args = ['-F', '/dev/null', '-b', '-', '-P', String(port)];
      if (this.settings.authentication === 'password') {
        const askpass = join(folder, 'askpass');
        await writeFile(
          askpass,
          '#!/bin/sh\nprintf "%s\\n" "$AMIRLAB_SFTP_PASSWORD"\n',
          { mode: 0o700 },
        );
        Object.assign(env, {
          SSH_ASKPASS: askpass,
          SSH_ASKPASS_REQUIRE: 'force',
          DISPLAY: 'amirlab:0',
          AMIRLAB_SFTP_PASSWORD: this.secrets.password,
        });
        options.push(
          'BatchMode=no',
          'PreferredAuthentications=password',
          'PubkeyAuthentication=no',
        );
      } else {
        const key = join(folder, 'identity');
        await writeFile(key, this.secrets.privateKey!, { mode: 0o600 });
        args.push('-i', key);
        options.push(
          'BatchMode=yes',
          'PreferredAuthentications=publickey',
          'PasswordAuthentication=no',
        );
      }
      for (const option of options) args.push('-o', option);
      args.push(
        `${this.settings.username}@${host.includes(':') ? `[${host}]` : host}`,
      );
      return await this.execute(args, script, env);
    } catch {
      throw new BadRequestException(
        'SFTP backup operation failed. Check the trusted host key, credentials, permissions and OpenSSH tools.',
      );
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  }
  async list() {
    const parents: string[] = [];
    let current = '';
    for (const part of this.settings
      .remoteDirectory!.split('/')
      .filter(Boolean)) {
      current += `/${part}`;
      parents.push(`@-mkdir ${quoteSftp(current)}`);
    }
    const output = await this.run(
      [...parents, `@ls -1 ${quoteSftp(this.settings.remoteDirectory!)}`].join(
        '\n',
      ) + '\n',
    );
    const ids = [
      ...new Set(
        output
          .split('\n')
          .map((line) => posix.basename(line.trim()))
          .filter((id) => BACKUP_UUID.test(id)),
      ),
    ];
    const snapshots: Snapshot[] = [];
    for (const id of ids) {
      const folder = await mkdtemp(join(tmpdir(), 'amirlab-manifest-'));
      try {
        const contents = await this.run(`@ls -1 ${quoteSftp(this.path(id))}\n`);
        if (
          !contents
            .split('\n')
            .some((line) => posix.basename(line.trim()) === 'manifest.json')
        )
          continue;
        await this.run(
          `@get ${quoteSftp(this.path(id, 'manifest.json'))} ${quoteSftp(join(folder, 'manifest.json'))}\n`,
        );
        try {
          snapshots.push(
            validateSnapshot(
              JSON.parse(await readFile(join(folder, 'manifest.json'), 'utf8')),
              id,
            ),
          );
        } catch (error) {
          if (
            error instanceof BadRequestException ||
            error instanceof SyntaxError ||
            (error &&
              typeof error === 'object' &&
              'code' in error &&
              error.code === 'ENOENT')
          )
            continue;
          throw error;
        }
      } finally {
        await rm(folder, { recursive: true, force: true });
      }
    }
    return snapshots;
  }
  async save(snapshot: Snapshot, directory: string) {
    validateSnapshot(snapshot, snapshot.id);
    const folders = new Set<string>();
    const addParents = (path: string) => {
      if (path === '/' || folders.has(path)) return;
      addParents(posix.dirname(path));
      folders.add(path);
    };
    addParents(this.path(snapshot.id));
    for (const file of Object.keys(snapshot.files))
      addParents(posix.dirname(this.path(snapshot.id, file)));
    const commands = [...folders].map((path) => `-mkdir ${quoteSftp(path)}`);
    for (const file of Object.keys(snapshot.files))
      commands.push(
        `put ${quoteSftp(join(directory, file))} ${quoteSftp(this.path(snapshot.id, file))}`,
      );
    const manifest = this.path(snapshot.id, 'manifest.json');
    commands.push(
      `put ${quoteSftp(join(directory, 'manifest.json'))} ${quoteSftp(`${manifest}.pending`)}`,
      `rename ${quoteSftp(`${manifest}.pending`)} ${quoteSftp(manifest)}`,
    );
    await this.run(commands.join('\n') + '\n');
  }
  async load(id: string, directory: string) {
    if (!BACKUP_UUID.test(id))
      throw new BadRequestException('Invalid backup ID.');
    await mkdir(join(directory, 'uploads'), { recursive: true, mode: 0o700 });
    await this.run(
      `get ${quoteSftp(this.path(id, 'manifest.json'))} ${quoteSftp(join(directory, 'manifest.json'))}\n`,
    );
    const snapshot = validateSnapshot(
      JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8')),
      id,
    );
    const commands: string[] = [];
    for (const file of Object.keys(snapshot.files)) {
      const local = join(directory, file);
      await mkdir(dirname(local), { recursive: true, mode: 0o700 });
      commands.push(
        `get ${quoteSftp(this.path(id, file))} ${quoteSftp(local)}`,
      );
    }
    await this.run(commands.join('\n') + '\n');
    return snapshot;
  }
}
