import { Body, Controller, Get, Put } from '@nestjs/common';
import { PlatformRole } from '../../generated/prisma/client';
import { CurrentUser, RequireRole } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  AppointmentLetterTemplateDto,
  NotificationPolicyDto,
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
