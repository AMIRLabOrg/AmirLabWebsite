import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { MailSettingsController } from './mail-settings.controller';
import { MailSettingsService } from './mail-settings.service';

@Global()
@Module({
  controllers: [MailSettingsController],
  providers: [MailService, MailSettingsService],
  exports: [MailService, MailSettingsService],
})
export class MailModule {}
