import { BadRequestException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { readFile, lstat } from 'node:fs/promises';
export interface EncryptedSecrets {
  iv: string;
  tag: string;
  ciphertext: string;
}
export class EncryptedCredentials<T extends object> {
  constructor(
    private readonly secret: string,
    private readonly legacyPath?: string,
  ) {}
  private key() {
    const key = Buffer.from(this.secret, 'base64');
    if (key.length !== 32 || key.toString('base64') !== this.secret)
      throw new Error('ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
    return key;
  }
  private async legacyKey() {
    if (!this.legacyPath) throw new Error('No legacy encryption key is set.');
    const metadata = await lstat(this.legacyPath);
    const key = await readFile(this.legacyPath);
    if (
      !metadata.isFile() ||
      metadata.isSymbolicLink() ||
      (metadata.mode & 0o077) !== 0 ||
      key.length !== 32
    )
      throw new Error('Invalid legacy credentials encryption key.');
    return key;
  }
  private decryptWithKey(encrypted: EncryptedSecrets, key: Buffer): T {
    const cipher = createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(encrypted.iv, 'base64'),
    );
    cipher.setAuthTag(Buffer.from(encrypted.tag, 'base64'));
    return JSON.parse(
      Buffer.concat([
        cipher.update(Buffer.from(encrypted.ciphertext, 'base64')),
        cipher.final(),
      ]).toString(),
    ) as T;
  }
  encrypt(secrets: T): EncryptedSecrets {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
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
      try {
        return this.decryptWithKey(encrypted, this.key());
      } catch {
        if (!this.legacyPath)
          throw new Error('Credentials could not be decrypted.');
      }
      return this.decryptWithKey(encrypted, await this.legacyKey());
    } catch {
      throw new BadRequestException(
        'Saved credentials cannot be read. Re-enter them and save settings.',
      );
    }
  }
}
