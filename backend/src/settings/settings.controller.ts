import { Body, Controller, Get, Put } from '@nestjs/common';
import { PlatformRole } from '../../generated/prisma/client';
import { CurrentUser, RequireRole } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  AppointmentLetterTemplateDto,
  NotificationPolicyDto,
  OpenAlexApiKeyDto,
  RankPolicyDto,
  VerificationPolicyDto,
} from './dto/settings.dto';
import {
  APPOINTMENT_TEMPLATE_VARIABLES,
  SettingsService,
} from './settings.service';

@Controller('settings')
@RequireRole(PlatformRole.ADMIN)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get('openalex')
  openAlex() {
    return this.settings.openAlexStatus();
  }

  @Get('openalex/usage')
  openAlexUsage() {
    return this.settings.openAlexUsage();
  }

  @Put('openalex')
  updateOpenAlex(
    @Body() body: OpenAlexApiKeyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settings.updateOpenAlexApiKey(body.apiKey, user.id);
  }

  @Get('appointment-letter')
  async appointmentLetter() {
    return {
      ...(await this.settings.appointmentLetter()),
      variables: APPOINTMENT_TEMPLATE_VARIABLES,
    };
  }

  @Put('appointment-letter')
  updateAppointmentLetter(
    @Body() body: AppointmentLetterTemplateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settings.updateAppointmentLetter(body, user.id);
  }

  @Get('notifications')
  notifications() {
    return this.settings.notificationPolicy();
  }

  @Put('notifications')
  updateNotifications(
    @Body() body: NotificationPolicyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settings.updateNotificationPolicy(body, user.id);
  }

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
}
