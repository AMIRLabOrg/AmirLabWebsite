import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../config/environment';
import { AssetsController } from './assets.controller';
import {
  ASSET_STORAGE,
  LocalAssetStorage,
  S3AssetStorage,
} from './asset-storage';
import { AssetsService } from './assets.service';

@Module({
  controllers: [AssetsController],
  providers: [
    {
      provide: ASSET_STORAGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Environment, true>) =>
        config.get('storageProvider', { infer: true }) === 's3'
          ? new S3AssetStorage(config)
          : new LocalAssetStorage(config),
    },
    AssetsService,
  ],
  exports: [AssetsService],
})
export class AssetsModule {}
