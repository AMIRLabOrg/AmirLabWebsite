import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { PlatformRole } from '../../generated/prisma/client';
import { CurrentUser, RequireRole } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  ReviewWeeklyReportDto,
  SaveWeeklyReportDto,
} from './dto/weekly-report.dto';
import { WeeklyReportsService } from './weekly-reports.service';

@Controller('weekly-reports')
export class WeeklyReportsController {
  constructor(private readonly weeklyReports: WeeklyReportsService) {}

  @Get('current')
  current(@CurrentUser() user: AuthenticatedUser) {
    return this.weeklyReports.current(user);
  }

  @Get('mine')
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.weeklyReports.mine(user);
  }

  @Put('current')
  save(
    @Body() body: SaveWeeklyReportDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.weeklyReports.save(body, user);
  }

  @Post('current/submit')
  submit(@CurrentUser() user: AuthenticatedUser) {
    return this.weeklyReports.submit(user);
  }

  @Get('review-queue')
  @RequireRole(PlatformRole.MODERATOR)
  reviewQueue() {
    return this.weeklyReports.reviewQueue();
  }

  @Post(':id/review')
  @RequireRole(PlatformRole.MODERATOR)
  review(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReviewWeeklyReportDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.weeklyReports.review(id, body, user);
  }
}
