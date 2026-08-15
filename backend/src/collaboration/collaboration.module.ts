import { Module } from '@nestjs/common';
import { CollaborationController } from './collaboration.controller';
import { CollaborationGateway } from './collaboration.gateway';
import { CollaborationService } from './collaboration.service';
import { RedisService } from './redis.service';
import { PushService } from './push.service';

@Module({
  controllers: [CollaborationController],
  providers: [
    CollaborationGateway,
    CollaborationService,
    PushService,
    RedisService,
  ],
  exports: [CollaborationGateway],
})
export class CollaborationModule {}
