import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { Environment } from '../config/environment';

export const ASSET_STORAGE = 'ASSET_STORAGE';

export interface AssetStorage {
  put(key: string, data: Buffer): Promise<void>;
  read(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}

/** Local storage is appropriate for VPS disks and Fly volumes. */
@Injectable()
export class LocalAssetStorage implements AssetStorage {
  private readonly root: string;

  constructor(config: ConfigService<Environment, true>) {
    this.root = resolve(config.get('uploadRoot', { infer: true }));
  }

  async put(key: string, data: Buffer): Promise<void> {
    const path = resolve(this.root, key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data, { flag: 'wx' });
  }

  read(key: string): Promise<Buffer> {
    return readFile(resolve(this.root, key));
  }

  remove(key: string): Promise<void> {
    return rm(resolve(this.root, key), { force: true });
  }
}

@Injectable()
export class S3AssetStorage implements AssetStorage {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: ConfigService<Environment, true>) {
    const bucket = config.get('storageBucket', { infer: true });
    const accessKeyId = config.get('storageAccessKeyId', { infer: true });
    const secretAccessKey = config.get('storageSecretAccessKey', {
      infer: true,
    });
    if (!bucket || !accessKeyId || !secretAccessKey) {
      throw new Error('S3 storage credentials are not configured');
    }
    this.bucket = bucket;
    this.client = new S3Client({
      endpoint: config.get('storageEndpoint', { infer: true }),
      forcePathStyle: config.get('storageForcePathStyle', { infer: true }),
      region: config.get('storageRegion', { infer: true }),
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  async put(key: string, data: Buffer): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: data }),
    );
  }

  async read(key: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!response.Body) throw new Error(`Asset ${key} has no body`);
    return Buffer.from(await response.Body.transformToByteArray());
  }

  async remove(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
