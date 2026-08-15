import { Module } from '@nestjs/common';
import { WeeklyReportsController } from './weekly-reports.controller';
import { WeeklyReportsService } from './weekly-reports.service';

@Module({
  controllers: [WeeklyReportsController],
  providers: [WeeklyReportsService],
})
export class WeeklyReportsModule {}
