import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import sharp from 'sharp';
import { AssetAccess, AssetKind } from '../../generated/prisma/client';
import type { Environment } from '../config/environment';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class AssetsService {
  private readonly uploadRoot: string;

  constructor(
    config: ConfigService<Environment, true>,
    private readonly prisma: PrismaService,
  ) {
    this.uploadRoot = resolve(config.get('uploadRoot', { infer: true }));
  }

  async storeCv(file: Express.Multer.File) {
    if (
      file.mimetype !== 'application/pdf' ||
      extname(file.originalname).toLowerCase() !== '.pdf' ||
      file.buffer.subarray(0, 5).toString() !== '%PDF-'
    ) {
      throw new BadRequestException('CV must be a valid PDF file');
    }

    const now = new Date();
    const storageKey = `cv/${now.getUTCFullYear()}/${String(
      now.getUTCMonth() + 1,
    ).padStart(2, '0')}/${randomUUID()}.pdf`;
    const filePath = resolve(this.uploadRoot, storageKey);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, file.buffer, { flag: 'wx' });

    try {
      return await this.prisma.asset.create({
        data: {
          access: AssetAccess.PRIVATE,
          byteSize: file.size,
          checksum: createHash('sha256').update(file.buffer).digest('hex'),
          kind: AssetKind.CV,
          mimeType: file.mimetype,
          originalName: file.originalname,
          storageKey,
        },
      });
    } catch (error) {
      await rm(filePath, { force: true });
      throw error;
    }
  }

  async storeAvatar(
    file: Express.Multer.File,
    createdById: string | undefined,
    access: AssetAccess = AssetAccess.PUBLIC,
  ) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      throw new BadRequestException('Profile image must be JPEG, PNG, or WebP');
    }

    let image: { data: Buffer; info: sharp.OutputInfo };
    try {
      image = await sharp(file.buffer)
        .rotate()
        .resize(1_200, 1_200, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 86 })
        .toBuffer({ resolveWithObject: true });
    } catch {
      throw new BadRequestException('Profile image could not be processed');
    }

    const now = new Date();
    const storageKey = `peoples/${now.getUTCFullYear()}/${String(
      now.getUTCMonth() + 1,
    ).padStart(2, '0')}/${randomUUID()}.webp`;
    const filePath = resolve(this.uploadRoot, storageKey);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, image.data, { flag: 'wx' });

    try {
      return await this.prisma.asset.create({
        data: {
          access,
          byteSize: image.data.length,
          checksum: createHash('sha256').update(image.data).digest('hex'),
          createdById,
          height: image.info.height,
          kind: AssetKind.AVATAR,
          mimeType: 'image/webp',
          originalName: file.originalname,
          storageKey,
          width: image.info.width,
        },
      });
    } catch (error) {
      await rm(filePath, { force: true });
      throw error;
    }
  }

  async storeUniversityLogo(file: Express.Multer.File) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      throw new BadRequestException('University logo must be JPEG, PNG, or WebP');
    }

    let image: { data: Buffer; info: sharp.OutputInfo };
    try {
      image = await sharp(file.buffer)
        .rotate()
        .resize({ height: 80, withoutEnlargement: true })
        .png({ quality: 90 })
        .toBuffer({ resolveWithObject: true });
    } catch {
      throw new BadRequestException('University logo could not be processed');
    }

    const now = new Date();
    const storageKey = `university-logos/${now.getUTCFullYear()}/${String(
      now.getUTCMonth() + 1,
    ).padStart(2, '0')}/${randomUUID()}.png`;
    const filePath = resolve(this.uploadRoot, storageKey);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, image.data, { flag: 'wx' });

    try {
      return await this.prisma.asset.create({
        data: {
          access: AssetAccess.PUBLIC,
          byteSize: image.data.length,
          checksum: createHash('sha256').update(image.data).digest('hex'),
          height: image.info.height,
          kind: AssetKind.UNIVERSITY_LOGO,
          mimeType: 'image/png',
          originalName: file.originalname,
          storageKey,
          width: image.info.width,
        },
      });
    } catch (error) {
      await rm(filePath, { force: true });
      throw error;
    }
  }

  async readCv(
    assetId: string,
  ): Promise<{ buffer: Buffer; originalName: string }> {
    const asset = await this.readAsset(assetId);
    if (!asset || asset.kind !== AssetKind.CV) {
      throw new NotFoundException('CV not found');
    }
    return {
      buffer: asset.buffer,
      originalName: asset.originalName,
    };
  }

  async readPublic(assetId: string) {
    const asset = await this.readAsset(assetId);
    if (!asset || asset.access !== AssetAccess.PUBLIC) {
      throw new NotFoundException('Public asset not found');
    }
    return asset;
  }

  async remove(assetId: string): Promise<void> {
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
    });
    if (!asset) {
      return;
    }
    await this.prisma.asset.delete({ where: { id: assetId } });
    await rm(resolve(this.uploadRoot, asset.storageKey), { force: true });
  }

  private async readAsset(assetId: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
    });
    if (!asset) return null;
    return {
      ...asset,
      buffer: await readFile(resolve(this.uploadRoot, asset.storageKey)),
    };
  }
}
