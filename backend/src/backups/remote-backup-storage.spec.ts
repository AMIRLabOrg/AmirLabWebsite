import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Readable } from 'node:stream';
import { S3BackupStorage } from './s3-backup-storage';
import { SftpBackupStorage, quoteSftp } from './sftp-backup-storage';
import { LocalBackupStorage } from './local-backup-storage';
const id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const snapshot = {
  version: 1 as const,
  id,
  createdAt: '2026-10-12T00:00:00Z',
  database: 'test',
  files: {
    'database.dump': 'a'.repeat(64),
    'uploads/test.txt': 'b'.repeat(64),
  },
};
describe('Backup storage publication and downloads', () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'backup-adapter-'));
    await mkdir(join(root, 'source', 'uploads'), { recursive: true });
    await writeFile(join(root, 'source', 'database.dump'), 'dump');
    await writeFile(join(root, 'source', 'uploads', 'test.txt'), 'upload');
    await writeFile(
      join(root, 'source', 'manifest.json'),
      JSON.stringify(snapshot),
    );
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });
  it('publishes and loads the existing local folder format', async () => {
    const storage = new LocalBackupStorage(join(root, 'backups'));
    await storage.save(snapshot, join(root, 'source'));
    expect(await storage.list()).toEqual([snapshot]);
    await storage.load(id, join(root, 'loaded'));
    expect(
      await readFile(join(root, 'loaded', 'uploads', 'test.txt'), 'utf8'),
    ).toBe('upload');
  });
  it('paginates S3 listing and ignores incomplete folders', async () => {
    const send = jest
      .fn()
      .mockResolvedValueOnce({
        Contents: [{ Key: `prefix/${id}/manifest.json` }],
        IsTruncated: true,
        NextContinuationToken: 'page2',
      })
      .mockResolvedValueOnce({
        Body: Readable.from([JSON.stringify(snapshot)]),
      })
      .mockResolvedValueOnce({
        Contents: [{ Key: 'prefix/incomplete/database.dump' }],
      });
    const storage = new S3BackupStorage(
      {
        enabled: false,
        intervalMinutes: 60,
        bucket: 'bucket',
        prefix: 'prefix',
      },
      { send } as never,
    );
    expect(await storage.list()).toEqual([snapshot]);
    const calls = send.mock.calls as unknown as [
      { input: { ContinuationToken: string } },
    ][];
    expect(calls[2][0].input.ContinuationToken).toBe('page2');
  });
  it('streams files and writes the manifest last', async () => {
    const keys: string[] = [];
    const send = jest.fn(
      async (command: {
        input: { Key: string; Body: AsyncIterable<Buffer> };
      }) => {
        keys.push(command.input.Key);
        for await (const chunk of command.input.Body)
          expect(chunk.length).toBeGreaterThan(0);
        return {};
      },
    );
    const storage = new S3BackupStorage(
      { enabled: false, intervalMinutes: 60, bucket: 'bucket' },
      {
        send,
      } as never,
    );
    await storage.save(snapshot, join(root, 'source'));
    expect(keys).toEqual([
      `${id}/database.dump`,
      `${id}/uploads/test.txt`,
      `${id}/manifest.json`,
    ]);
  });
  it('never publishes a manifest after a failed S3 file upload', async () => {
    const send = jest
      .fn()
      .mockRejectedValue(new Error('secret-provider-error'));
    await expect(
      new S3BackupStorage(
        { enabled: false, intervalMinutes: 60, bucket: 'bucket' },
        { send } as never,
      ).save(snapshot, join(root, 'source')),
    ).rejects.toThrow('S3');
    expect(send).toHaveBeenCalledTimes(1);
  });
  it('rejects traversal before S3 download writes', async () => {
    const send = jest.fn().mockResolvedValue({
      Body: Readable.from([
        JSON.stringify({
          ...snapshot,
          files: { ...snapshot.files, '../escape': 'a'.repeat(64) },
        }),
      ]),
    });
    await expect(
      new S3BackupStorage(
        { enabled: false, intervalMinutes: 60, bucket: 'bucket' },
        { send } as never,
      ).load(id, join(root, 'loaded')),
    ).rejects.toThrow('verification');
    expect(send).toHaveBeenCalledTimes(1);
  });
  it('quotes SFTP commands without control characters or glob expansion', () => {
    expect(quoteSftp('/dir with "quote"/[glob]')).toBe(
      '"/dir with \\"quote\\"/\\[glob\\]"',
    );
    expect(() => quoteSftp('/evil\nput')).toThrow();
  });
  it('pins the SFTP host and uploads the commit manifest last', async () => {
    const calls: { args: string[]; script: string; env: NodeJS.ProcessEnv }[] =
      [];
    const run = jest.fn(
      async (args: string[], script: string, env: NodeJS.ProcessEnv) => {
        calls.push({ args, script, env });
        return await Promise.resolve('');
      },
    );
    const storage = new SftpBackupStorage(
      {
        enabled: false,
        intervalMinutes: 60,
        host: 'example.com',
        port: 22,
        username: 'backup',
        remoteDirectory: '/backups',
        hostKey: 'ssh-ed25519 AAAA',
        authentication: 'password',
      },
      { password: 'test-only-password' },
      run,
    );
    await storage.save(snapshot, join(root, 'source'));
    expect(calls[0].args).toContain('StrictHostKeyChecking=yes');
    expect(calls[0].args).toContain('BatchMode=no');
    expect(calls[0].script.trim().split('\n').at(-1)).toContain('rename');
    expect(calls[0].script).not.toContain('test-only-password');
    expect(calls[0].env.SSH_ASKPASS_REQUIRE).toBe('force');
    const known = calls[0].args.find((arg) =>
      arg.startsWith('UserKnownHostsFile='),
    );
    expect(known).toBeDefined();
  });
});
it('uses only the dedicated private key and removes temporary SFTP credentials on failure', async () => {
  let folder = '';
  const run = async (args: string[]) => {
    const key = args[args.indexOf('-i') + 1];
    folder = key.slice(0, key.lastIndexOf('/'));
    expect(await readFile(key, 'utf8')).toBe('test-private-key');
    expect(args).toContain('BatchMode=yes');
    expect(args).toContain('IdentityAgent=none');
    throw new Error('private transport details');
  };
  const storage = new SftpBackupStorage(
    {
      enabled: false,
      intervalMinutes: 60,
      host: 'example.com',
      port: 22,
      username: 'backup',
      remoteDirectory: '/backups',
      hostKey: 'ssh-ed25519 AAAA',
      authentication: 'privateKey',
    },
    { privateKey: 'test-private-key' },
    run,
  );
  await expect(storage.list()).rejects.toThrow('SFTP backup operation failed');
  await expect(readFile(join(folder, 'identity'))).rejects.toMatchObject({
    code: 'ENOENT',
  });
});
it('reports read-denied published SFTP manifests instead of an empty listing', async () => {
  const run = async (_args: string[], script: string) => {
    if (script.includes('@-get')) return await Promise.resolve(''); // OpenSSH suppresses the denied read.
    if (script.includes('get ')) throw new Error('Permission denied');
    if (script.includes(`/backups/${id}`))
      return await Promise.resolve('manifest.json\ndatabase.dump\n');
    return await Promise.resolve(`${id}\n`);
  };
  const storage = new SftpBackupStorage(
    {
      enabled: true,
      intervalMinutes: 1,
      host: 'example.com',
      port: 22,
      username: 'backup',
      remoteDirectory: '/backups',
      hostKey: 'ssh-ed25519 AAAA',
      authentication: 'privateKey',
    },
    { privateKey: 'test-key' },
    run,
  );
  await expect(storage.list()).rejects.toThrow('SFTP');
});
