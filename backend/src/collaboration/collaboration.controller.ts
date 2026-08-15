import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import type { PushSubscription } from 'web-push';
import { CurrentUser } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CollaborationService } from './collaboration.service';
import { PushService } from './push.service';

@Controller('collaboration')
export class CollaborationController {
  constructor(
    private readonly collaboration: CollaborationService,
    private readonly push: PushService,
  ) {}

  @Get('push/public-key')
  pushPublicKey() {
    return { publicKey: this.push.publicKey() };
  }

  @Post('push/subscription')
  subscribe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() subscription: PushSubscription,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.push.subscribe(user.id, subscription, userAgent);
  }

  @Delete('push/subscription')
  unsubscribe(
    @CurrentUser() user: AuthenticatedUser,
    @Body('endpoint') endpoint: string,
  ) {
    return this.push.unsubscribe(user.id, endpoint);
  }

  @Get('conversations')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.collaboration.conversations(user.id);
  }

  @Get('presence')
  presence(@CurrentUser() user: AuthenticatedUser) {
    return this.collaboration.presence(user.id);
  }

  @Post('conversations/lab')
  lab(@CurrentUser() user: AuthenticatedUser) {
    return this.collaboration.ensureLabConversation(user);
  }

  @Get('conversations/:id/messages')
  messages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.collaboration.messages(user.id, id);
  }

  @Patch('conversations/:id/read')
  read(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.collaboration.markRead(user.id, id);
  }
}
