import { Module } from '@nestjs/common';
import { BackupsService } from './backups.service';
import { BackupsController } from './backups.controller';

@Module({ controllers: [BackupsController], providers: [BackupsService] })
export class BackupsModule {}
