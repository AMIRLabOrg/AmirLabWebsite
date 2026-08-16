import { Module } from '@nestjs/common';
import { ResearchController } from './research.controller';
import { ResearchDiscoveryService } from './research-discovery.service';
import { ResearchRelationshipsService } from './research-relationships.service';
import { ResearchProfileSyncService } from './research-profile-sync.service';
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
    ResearchProfileSyncService,
    SafeSourceFetcher,
    RankingsService,
  ],
  exports: [RankingsService, ResearchProfileSyncService],
})
export class ResearchModule {}
