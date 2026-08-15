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
import { PlatformRole } from '../../generated/prisma/client';
import { CurrentUser, RequireRole } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreateUserDto } from './dto/create-user.dto';
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
    @Body() body: CreateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.update(id, body, actor.id);
  }

  @Post(':id/send-access-email')
  sendAccessEmail(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.sendAccessEmail(id, actor.id);
  }
}
