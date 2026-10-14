import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { PlatformRole } from '../../generated/prisma/client';
import { CurrentUser, RequireRole } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { MailService } from './mail.service';
import { MailSettingsService } from './mail-settings.service';
import { MailSettingsDto, MailTestDto } from './mail-settings.dto';

@Controller('settings/mail')
@RequireRole(PlatformRole.ADMIN)
export class MailSettingsController {
  constructor(
    private readonly settings: MailSettingsService,
    private readonly mail: MailService,
  ) {}

  @Get()
  status() {
    return this.settings.status();
  }

  @Put()
  update(
    @Body() body: MailSettingsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settings.save(body, user.id);
  }

  @Get('usage')
  usage() {
    return this.settings.usage();
  }

  @Post('test')
  async sendTest(@Body() body: MailTestDto) {
    await this.mail.sendTest(body.to);
    return { sent: true };
  }
}
