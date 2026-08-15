import { Module } from '@nestjs/common';
import { AssetsModule } from '../assets/assets.module';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [AssetsModule, SettingsModule],
  controllers: [ProfilesController],
  providers: [ProfilesService],
})
export class ProfilesModule {}
