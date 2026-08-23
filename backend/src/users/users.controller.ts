import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PlatformRole } from '../../generated/prisma/client';
import { CurrentUser, RequireRole } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  AdminRequestEmailChangeDto,
  AdminVerifyEmailChangeDto,
  CreateUserDto,
  UpdateUserDto,
} from './dto/create-user.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { UsersService } from './users.service';

@Controller('users')
@RequireRole(PlatformRole.ADMIN)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post()
  create(@Body() body: CreateUserDto) {
    return this.users.create(body);
  }

  @Get()
  list(@Query() query: UserQueryDto) {
    return this.users.list(query);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.get(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.update(id, body, actor.id);
  }

  @Get(':id/email-change')
  emailChangeStatus(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.emailChangeStatus(id);
  }

  @Post(':id/email-change/request')
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  requestEmailChange(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AdminRequestEmailChangeDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.requestEmailChange(id, body.newEmail, actor.id);
  }

  @Post(':id/email-change/verify')
  @Throttle({ default: { limit: 10, ttl: 600_000 } })
  verifyEmailChange(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AdminVerifyEmailChangeDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.verifyEmailChange(id, body.otp, actor.id);
  }

  @Post(':id/send-access-email')
  sendAccessEmail(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.sendAccessEmail(id, actor.id);
  }
}
