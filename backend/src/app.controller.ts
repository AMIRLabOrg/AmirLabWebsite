import { Controller, Get, HttpCode, HttpStatus, NotFoundException } from '@nestjs/common';
import { Public } from './auth/auth.decorators';
import { PrismaService } from './database/prisma.service';

@Controller()
@Public()
export class AppController {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  @Get('health')
  async health(): Promise<{ status: 'ok'; timestamp: string }> {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get()
  @HttpCode(HttpStatus.NOT_FOUND)
  root(): never {
    throw new NotFoundException();
  }
}
