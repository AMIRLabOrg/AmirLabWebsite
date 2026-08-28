import { Controller, Get, Redirect } from '@nestjs/common';
import { Public } from './auth/auth.decorators';
import { PrismaService } from './database/prisma.service';

@Controller()
@Public()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  async health(): Promise<{ status: 'ok'; timestamp: string }> {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get()
  @Redirect('', 302)
  async root() {
    const setting = await this.prisma.siteSetting.findUnique({
      where: { key: 'redirect-url' },
    });
    const url =
      typeof setting?.value === 'string' && setting.value
        ? setting.value
        : 'https://amirlab.org';
    return { url };
  }
}
