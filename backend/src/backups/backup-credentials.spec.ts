import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createCipheriv, randomBytes } from 'node:crypto';
import { mergeSecrets } from './backup-credentials';
import { EncryptedCredentials } from '../common/encrypted-credentials';
describe('Encrypted backup credentials', () => {
  it('encrypts with the environment key and reads credentials from the legacy key file', async () => {
    const root = await mkdtemp(join(tmpdir(), 'backup-key-'));
    try {
      const legacyKey = randomBytes(32);
      const legacyPath = join(root, 'legacy-key');
      await writeFile(legacyPath, legacyKey, { mode: 0o600 });
      const store = new EncryptedCredentials<{
        secretAccessKey: string;
        accessKeyId: string;
      }>('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=', legacyPath);
      const encrypted = store.encrypt({
        secretAccessKey: 'sample-secret',
        accessKeyId: 'sample-id',
      });
      expect(JSON.stringify(encrypted)).not.toContain('sample-secret');
      expect(await store.decrypt(encrypted)).toEqual({
        secretAccessKey: 'sample-secret',
        accessKeyId: 'sample-id',
      });
      const envOnlyStore = new EncryptedCredentials<{
        secretAccessKey: string;
        accessKeyId: string;
      }>('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=');
      expect(await envOnlyStore.decrypt(encrypted)).toEqual({
        secretAccessKey: 'sample-secret',
        accessKeyId: 'sample-id',
      });
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', legacyKey, iv);
      const ciphertext = Buffer.concat([
        cipher.update(JSON.stringify({ password: 'legacy-secret' })),
        cipher.final(),
      ]);
      const oldEncrypted = {
        iv: iv.toString('base64'),
        tag: cipher.getAuthTag().toString('base64'),
        ciphertext: ciphertext.toString('base64'),
      };
      expect(await store.decrypt(oldEncrypted)).toEqual({
        password: 'legacy-secret',
      });
      expect((await readFile(legacyPath)).length).toBe(32);
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
