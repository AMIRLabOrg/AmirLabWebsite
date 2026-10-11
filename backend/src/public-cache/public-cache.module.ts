import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { JobsModule } from '../jobs/jobs.module';
import { PublicCacheService } from './public-cache.service';
import { PublicCacheController } from './public-cache.controller';
import { PublicCacheInterceptor } from './public-cache.interceptor';

@Module({
  imports: [JobsModule],
  controllers: [PublicCacheController],
  providers: [
    PublicCacheService,
    { provide: APP_INTERCEPTOR, useClass: PublicCacheInterceptor },
  ],
})
export class PublicCacheModule {}
