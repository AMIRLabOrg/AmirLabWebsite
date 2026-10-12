import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { BackupCredentials, mergeSecrets } from './backup-credentials';
describe('Encrypted backup credentials', () => {
  it('round trips without plaintext and protects the key file', async () => {
    const root = await mkdtemp(join(tmpdir(), 'backup-key-'));
    try {
      const store = new BackupCredentials(join(root, 'key'));
      const encrypted = await store.encrypt({
        secretAccessKey: 'sample-secret',
        accessKeyId: 'sample-id',
      });
      expect(JSON.stringify(encrypted)).not.toContain('sample-secret');
      expect(await store.decrypt(encrypted)).toEqual({
        secretAccessKey: 'sample-secret',
        accessKeyId: 'sample-id',
      });
      expect((await readFile(join(root, 'key'))).length).toBe(32);
      expect((await stat(join(root, 'key'))).mode & 0o777).toBe(0o600);
      await expect(
        store.decrypt({ ...encrypted, ciphertext: 'bad' }),
      ).rejects.toThrow('credentials');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it('preserves blank credentials only for matching provider/authentication', () => {
    const old = {
      provider: 'sftp' as const,
      authentication: 'password' as const,
    };
    expect(
      mergeSecrets(old, old, { password: 'saved' }, { password: '' }),
    ).toEqual({ password: 'saved' });
    expect(
      mergeSecrets(old, { provider: 's3' }, { password: 'saved' }, {}),
    ).toEqual({});
    expect(
      mergeSecrets(
        old,
        { ...old, authentication: 'privateKey' },
        { password: 'saved' },
        {},
      ),
    ).toEqual({});
  });
});
