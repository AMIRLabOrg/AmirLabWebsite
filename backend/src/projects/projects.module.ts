import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { CollaborationModule } from '../collaboration/collaboration.module';
import { SettingsModule } from '../settings/settings.module';
import {
  ProjectChangeReviewsController,
  ProjectsController,
} from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [CollaborationModule, MailModule, SettingsModule],
  controllers: [ProjectsController, ProjectChangeReviewsController],
  providers: [ProjectsService],
})
export class ProjectsModule {}
