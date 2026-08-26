import { Global, Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { DeadlineNotificationsService } from './deadline-notifications.service';
import { SettingsModule } from '../settings/settings.module';

@Global()
@Module({
  imports: [SettingsModule],
  controllers: [NotificationsController],
  providers: [DeadlineNotificationsService, NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
