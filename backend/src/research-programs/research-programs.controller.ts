import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { PlatformRole } from '../../generated/prisma/client';
import { CurrentUser, RequireRole } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { SaveResearchProgramDto } from './dto/research-program.dto';
import { ResearchProgramsService } from './research-programs.service';

@Controller('research-programs')
export class ResearchProgramsController {
  constructor(private readonly programs: ResearchProgramsService) {}

  @Get()
  list() {
    return this.programs.list();
  }

  @Get('options')
  @RequireRole(PlatformRole.ADMIN)
  options() {
    return this.programs.options();
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.programs.get(id);
  }

  @Post()
  @RequireRole(PlatformRole.ADMIN)
  create(
    @Body() body: SaveResearchProgramDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.programs.create(body, user);
  }

  @Put(':id')
  @RequireRole(PlatformRole.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SaveResearchProgramDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.programs.update(id, body, user);
  }
}
