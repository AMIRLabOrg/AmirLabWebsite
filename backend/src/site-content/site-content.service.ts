import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { AboutContentDto, HomeContentDto } from './dto/site-content.dto';
import {
  DEFAULT_ABOUT_CONTENT,
  DEFAULT_HOME_CONTENT,
} from './site-content.defaults';

const HOME_KEY = 'page.home';
const ABOUT_KEY = 'page.about';

@Injectable()
export class SiteContentService {
  constructor(private readonly prisma: PrismaService) {}

  home() {
    return this.read(HOME_KEY, DEFAULT_HOME_CONTENT);
  }

  about() {
    return this.read(ABOUT_KEY, DEFAULT_ABOUT_CONTENT);
  }

  updateHome(content: HomeContentDto, actorId: string) {
    return this.update(HOME_KEY, content, actorId);
  }

  updateAbout(content: AboutContentDto, actorId: string) {
    return this.update(ABOUT_KEY, content, actorId);
  }

  private async read<T extends object>(key: string, fallback: T) {
    const record = await this.prisma.siteSetting.findUnique({ where: { key } });
    return {
      content: record ? (record.value as T) : fallback,
      updatedAt: record?.updatedAt ?? null,
    };
  }

  private async update<T extends object>(
    key: string,
    content: T,
    actorId: string,
  ) {
    const record = await this.prisma.$transaction(async (transaction) => {
      const setting = await transaction.siteSetting.upsert({
        where: { key },
        create: {
          key,
          value: content,
        },
        update: { value: content },
      });
      await transaction.auditRecord.create({
        data: {
          action: 'site-content.updated',
          actorId,
          entityId: key,
          entityType: 'SiteSetting',
          details: { fields: Object.keys(content) },
        },
      });
      return setting;
    });
    return { content: record.value as T, updatedAt: record.updatedAt };
  }
}
