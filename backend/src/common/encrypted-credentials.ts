import { BadRequestException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { readFile, writeFile, lstat, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
export interface EncryptedSecrets {
  iv: string;
  tag: string;
  ciphertext: string;
}
export class EncryptedCredentials<T extends object> {
  constructor(private readonly path: string) {}
  private async key(create: boolean) {
    if (create) {
      await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
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
    }
    const metadata = await lstat(this.path);
    const key = await readFile(this.path);
    if (
      !metadata.isFile() ||
      metadata.isSymbolicLink() ||
      (metadata.mode & 0o077) !== 0 ||
      key.length !== 32
    )
      throw new Error('Invalid credentials encryption key.');
    return key;
  }
  async encrypt(secrets: T): Promise<EncryptedSecrets> {
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
  async decrypt(encrypted: EncryptedSecrets): Promise<T> {
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
      ) as T;
    } catch {
      throw new BadRequestException(
        'Saved credentials cannot be read. Re-enter them and save settings.',
      );
    }
  }
}
