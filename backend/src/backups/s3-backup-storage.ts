import { BadRequestException } from '@nestjs/common';
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';
import {
  BACKUP_UUID,
  validateSnapshot,
  type BackupStorage,
  type BackupSettings,
  type BackupSecrets,
  type Snapshot,
} from './backup-storage';
export class S3BackupStorage implements BackupStorage {
  private readonly client: S3Client;
  constructor(
    private readonly settings: BackupSettings,
    clientOrSecrets: S3Client | BackupSecrets,
  ) {
    this.client =
      'send' in clientOrSecrets
        ? clientOrSecrets
        : new S3Client({
            region: settings.region,
            endpoint: settings.endpoint || undefined,
            forcePathStyle: settings.forcePathStyle,
            credentials: {
              accessKeyId: clientOrSecrets.accessKeyId!,
              secretAccessKey: clientOrSecrets.secretAccessKey!,
            },
            requestHandler: {
              requestTimeout: 300_000,
              connectionTimeout: 15_000,
            },
          });
  }
  close() {
    this.client.destroy?.();
  }
  private key(id: string, file: string) {
    return [this.settings.prefix, id, file].filter(Boolean).join('/');
  }
  private async manifest(id: string) {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.settings.bucket,
        Key: this.key(id, 'manifest.json'),
      }),
    );
    if (!response.Body) throw new Error('Missing manifest.');
    const parts: Buffer[] = [];
    let length = 0;
    for await (const part of response.Body as Readable) {
      const chunk = Buffer.from(part as Uint8Array);
      length += chunk.length;
      if (length > 4 * 1024 * 1024) throw new Error('Manifest too large.');
      parts.push(chunk);
    }
    return validateSnapshot(JSON.parse(Buffer.concat(parts).toString()), id);
  }
  async list() {
    const snapshots: Snapshot[] = [];
    const prefix = this.settings.prefix ? `${this.settings.prefix}/` : '';
    let token: string | undefined;
    try {
      do {
        const result = await this.client.send(
          new ListObjectsV2Command({
            Bucket: this.settings.bucket,
            Prefix: prefix,
            ContinuationToken: token,
          }),
        );
        for (const item of result.Contents ?? []) {
          const parts = item.Key?.slice(prefix.length).split('/');
          if (
            parts?.length !== 2 ||
            !BACKUP_UUID.test(parts[0]) ||
            parts[1] !== 'manifest.json'
          )
            continue;
          try {
            snapshots.push(await this.manifest(parts[0]));
          } catch (error) {
            if (
              error instanceof BadRequestException ||
              error instanceof SyntaxError
            )
              continue;
            throw error;
          }
        }
        if (
          result.IsTruncated &&
          (!result.NextContinuationToken ||
            result.NextContinuationToken === token)
        )
          throw new Error('Invalid S3 pagination.');
        token = result.IsTruncated ? result.NextContinuationToken : undefined;
      } while (token);
      return snapshots;
    } catch {
      throw new BadRequestException(
        'S3 backup listing failed. Check endpoint, credentials and bucket permissions.',
      );
    }
  }
  async save(snapshot: Snapshot, directory: string) {
    validateSnapshot(snapshot, snapshot.id);
    try {
      for (const file of [...Object.keys(snapshot.files), 'manifest.json']) {
        const path = join(directory, file);
        await this.client.send(
          new PutObjectCommand({
            Bucket: this.settings.bucket,
            Key: this.key(snapshot.id, file),
            Body: createReadStream(path),
            ContentLength: (await stat(path)).size,
            ContentType:
              file === 'manifest.json'
                ? 'application/json'
                : 'application/octet-stream',
          }),
        );
      }
    } catch {
      throw new BadRequestException(
        'S3 backup upload failed. Partial files have no completed manifest.',
      );
    }
  }
  async load(id: string, directory: string) {
    if (!BACKUP_UUID.test(id))
      throw new BadRequestException('Invalid backup ID.');
    const snapshot = await this.manifest(id).catch((error: unknown) => {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('S3 backup manifest download failed.');
    });
    try {
      await mkdir(join(directory, 'uploads'), { recursive: true, mode: 0o700 });
      for (const file of Object.keys(snapshot.files)) {
        const path = join(directory, file);
        await mkdir(dirname(path), { recursive: true, mode: 0o700 });
        const response = await this.client.send(
          new GetObjectCommand({
            Bucket: this.settings.bucket,
            Key: this.key(id, file),
          }),
        );
        if (!response.Body) throw new Error('Missing file.');
        await pipeline(
          response.Body as Readable,
          createWriteStream(path, { mode: 0o600 }),
        );
      }
      await writeFile(
        join(directory, 'manifest.json'),
        JSON.stringify(snapshot),
        { mode: 0o600 },
      );
      return snapshot;
    } catch {
      throw new BadRequestException(
        'S3 backup download failed. Local data has not been changed.',
      );
    }
  }
}
