import { Module } from '@nestjs/common';
import { ResearchProgramsController } from './research-programs.controller';
import { ResearchProgramsService } from './research-programs.service';

@Module({
  controllers: [ResearchProgramsController],
  providers: [ResearchProgramsService],
})
export class ResearchProgramsModule {}
