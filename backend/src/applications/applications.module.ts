import { Module } from '@nestjs/common';
import { AssetsModule } from '../assets/assets.module';
import { SettingsModule } from '../settings/settings.module';
import { AppointmentLettersService } from './appointment-letters.service';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';

@Module({
  imports: [AssetsModule, SettingsModule],
  controllers: [ApplicationsController],
  providers: [ApplicationsService, AppointmentLettersService],
})
export class ApplicationsModule {}
