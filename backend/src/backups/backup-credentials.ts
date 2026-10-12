import { BadRequestException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { readFile, writeFile, lstat } from 'node:fs/promises';
import type { BackupSecrets, BackupSettings } from './backup-storage';
export interface EncryptedSecrets {
  iv: string;
  tag: string;
  ciphertext: string;
}
export class BackupCredentials {
  constructor(private readonly path: string) {}
  private async key(create: boolean) {
    if (create)
      await writeFile(this.path, randomBytes(32), {
        flag: 'wx',
        mode: 0o600,
      }).catch((error: unknown) => {
        if (
          !error ||
          typeof error !== 'object' ||
          !('code' in error) ||
          error.code !== 'EEXIST'
        )
          throw error;
      });
    const metadata = await lstat(this.path);
    const key = await readFile(this.path);
    if (
      !metadata.isFile() ||
      metadata.isSymbolicLink() ||
      (metadata.mode & 0o077) !== 0 ||
      key.length !== 32
    )
      throw new Error('Invalid backup encryption key.');
    return key;
  }
  async encrypt(secrets: BackupSecrets): Promise<EncryptedSecrets> {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', await this.key(true), iv);
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(secrets)),
      cipher.final(),
    ]);
    return {
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      ciphertext: encrypted.toString('base64'),
    };
  }
  async decrypt(encrypted: EncryptedSecrets): Promise<BackupSecrets> {
    try {
      const cipher = createDecipheriv(
        'aes-256-gcm',
        await this.key(false),
        Buffer.from(encrypted.iv, 'base64'),
      );
      cipher.setAuthTag(Buffer.from(encrypted.tag, 'base64'));
      return JSON.parse(
        Buffer.concat([
          cipher.update(Buffer.from(encrypted.ciphertext, 'base64')),
          cipher.final(),
        ]).toString(),
      ) as BackupSecrets;
    } catch {
      throw new BadRequestException(
        'Backup credentials cannot be read. Re-enter credentials and save settings.',
      );
    }
  }
}
export function mergeSecrets(
  previous: Pick<BackupSettings, 'provider' | 'authentication'> | null,
  next: Pick<BackupSettings, 'provider' | 'authentication'>,
  saved: BackupSecrets,
  input: BackupSecrets,
): BackupSecrets {
  const result: BackupSecrets =
    previous?.provider === next.provider &&
    previous?.authentication === next.authentication
      ? { ...saved }
      : {};
  const keys: (keyof BackupSecrets)[] =
    next.provider === 's3'
      ? ['accessKeyId', 'secretAccessKey']
      : next.provider === 'sftp'
        ? [next.authentication === 'password' ? 'password' : 'privateKey']
        : [];
  for (const key of keys) if (input[key]) result[key] = input[key];
  return Object.fromEntries(
    keys.filter((key) => result[key]).map((key) => [key, result[key]]),
  );
}
