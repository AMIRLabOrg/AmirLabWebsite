import { Module } from '@nestjs/common';
import { ResearchController } from './research.controller';
import { ResearchDiscoveryService } from './research-discovery.service';
import { ResearchRelationshipsService } from './research-relationships.service';
import { ResearchService } from './research.service';
import { SafeSourceFetcher } from './safe-source-fetcher';
import { RankingsService } from './rankings.service';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [SettingsModule],
  controllers: [ResearchController],
  providers: [
    ResearchService,
    ResearchDiscoveryService,
    ResearchRelationshipsService,
    SafeSourceFetcher,
    RankingsService,
  ],
  exports: [RankingsService],
})
export class ResearchModule {}
