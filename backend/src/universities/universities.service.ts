import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AssetsService } from '../assets/assets.service';
import { PrismaService } from '../database/prisma.service';
import type { UniversityDto, UpdateUniversityDto } from './dto/university.dto';

@Injectable()
export class UniversitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: AssetsService,
  ) {}

  publicList() {
    return this.prisma.university.findMany({
      where: { isPublished: true },
      orderBy: { name: 'asc' },
      include: { logoAsset: true },
    });
  }

  list() {
    return this.prisma.university.findMany({
      include: { logoAsset: true },
      orderBy: { name: 'asc' },
    });
  }

  async get(id: string) {
    const university = await this.prisma.university.findUnique({
      where: { id },
      include: { logoAsset: true },
    });
    if (!university) throw new NotFoundException('University not found');
    return university;
  }

  async create(dto: UniversityDto, logoFile?: Express.Multer.File) {
    this.requireNameOrLogo(dto.name.trim() || null, logoFile);
    const slug = await this.availableSlug(dto.name.trim() || 'university');
    const university = await this.prisma.university.create({
      data: {
        ...this.normalizedDto(dto),
        name: dto.name.trim(),
        slug,
      },
    });

    if (logoFile) {
      const logoAsset = await this.assets.storeUniversityLogo(logoFile);
      return this.prisma.university.update({
        where: { id: university.id },
        data: { logoAssetId: logoAsset.id },
        include: { logoAsset: true },
      });
    }

    return university;
  }

  async update(
    id: string,
    dto: UpdateUniversityDto,
    logoFile?: Express.Multer.File,
    removeLogo?: boolean,
  ) {
    const existing = await this.get(id);
    const name = dto.name?.trim() || existing.name;

    const slug =
      dto.name && dto.name.trim() !== existing.name
        ? await this.availableSlug(name, id)
        : existing.slug;

    let logoAssetId = existing.logoAssetId;
    if (removeLogo) {
      if (existing.logoAssetId) {
        await this.assets.remove(existing.logoAssetId);
      }
      logoAssetId = null;
    }
    if (logoFile) {
      if (existing.logoAssetId) {
        await this.assets.remove(existing.logoAssetId);
      }
      const logoAsset = await this.assets.storeUniversityLogo(logoFile);
      logoAssetId = logoAsset.id;
    }

    return this.prisma.university.update({
      where: { id },
      data: { ...this.normalizedDto(dto), name, slug, logoAssetId },
      include: { logoAsset: true },
    });
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    const existing = await this.prisma.university.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('University not found');
    if (existing.logoAssetId) {
      await this.assets.remove(existing.logoAssetId);
    }
    await this.prisma.university.delete({ where: { id } });
    return { deleted: true };
  }

  private async availableSlug(
    name: string,
    universityId?: string,
  ): Promise<string> {
    const base = slug(name);
    let candidate = base;
    let suffix = 2;
    let existing = await this.prisma.university.findUnique({
      where: { slug: candidate },
    });
    while (existing && existing.id !== universityId) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
      existing = await this.prisma.university.findUnique({
        where: { slug: candidate },
      });
    }
    return candidate;
  }

  private requireNameOrLogo(
    name: string | null,
    logoFile?: Express.Multer.File,
  ) {
    if (!name && !logoFile) {
      throw new BadRequestException(
        'At least a name or a logo must be provided',
      );
    }
  }

  private normalizedDto(
    dto: UniversityDto | UpdateUniversityDto,
  ): Partial<UniversityDto> {
    const normalized: Record<string, unknown> = {
      ...dto,
      ...('websiteUrl' in dto && dto.websiteUrl !== undefined
        ? { websiteUrl: dto.websiteUrl?.trim() || null }
        : {}),
      ...('isPublished' in dto ? { isPublished: dto.isPublished } : {}),
    };
    delete normalized.removeLogo;
    return normalized;
  }
}

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'university'
  );
}
