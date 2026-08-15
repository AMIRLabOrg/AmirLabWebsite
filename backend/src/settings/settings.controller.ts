import { Body, Controller, Get, Put } from '@nestjs/common';
import { PlatformRole } from '../../generated/prisma/client';
import { CurrentUser, RequireRole } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RankPolicyDto, VerificationPolicyDto } from './dto/settings.dto';
import { SettingsService } from './settings.service';

@Controller('settings')
@RequireRole(PlatformRole.ADMIN)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get('verification')
  verification() {
    return this.settings.verification();
  }

  @Put('verification')
  updateVerification(
    @Body() body: VerificationPolicyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settings.updateVerification(body, user.id);
  }

  @Get('ranking')
  ranking() {
    return this.settings.ranking();
  }

  @Put('ranking')
  updateRanking(
    @Body() body: RankPolicyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settings.updateRanking(body, user.id);
  }

  @Get('redirect-url')
  redirectUrl() {
    return this.settings.redirectUrl();
  }

  @Put('redirect-url')
  updateRedirectUrl(
    @Body() body: { url: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settings.updateRedirectUrl(body.url, user.id);
  }
}
