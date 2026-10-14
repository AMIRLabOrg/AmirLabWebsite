import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { PlatformRole, ResearchItemType } from '../../generated/prisma/client';
import { CurrentUser, Public, RequireRole } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreatePositionDto, UpdatePositionDto } from './dto/position.dto';
import { ResearchLibraryQueryDto } from './dto/research-library-query.dto';
import { PublicationQueryDto } from './dto/publication-query.dto';
import { ResearchRetentionService } from './research-retention.service';
import { ResearchService } from './research.service';

@Controller()
export class ResearchController {
  constructor(
    private readonly retention: ResearchRetentionService,
    private readonly researchService: ResearchService,
  ) {}

  @Public()
  @Get('people')
  people() {
    return this.researchService.people();
  }

  @Public()
  @Get('people/:slug')
  personBySlug(@Param('slug') slug: string) {
    return this.researchService.personBySlug(slug);
  }

  @Delete('people/:id')
  @RequireRole(PlatformRole.ADMIN)
  removePerson(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.retention.removePerson(id, actor.id);
  }

  @Public()
  @Get('research')
  research(@Query('type') type?: ResearchItemType) {
    return this.researchService.research(type);
  }

  @Public()
  @Get('publications')
  publications(@Query() query: PublicationQueryDto) {
    return this.researchService.publications(query);
  }

  @Get('research-library')
  researchLibrary(
    @Query() query: ResearchLibraryQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.researchService.library(query, user);
  }

  @Get('research-library/:id')
  researchLibraryItem(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.researchService.libraryItem(id, user);
  }

  @Public()
  @Get('stats')
  stats() {
    return this.researchService.publicStats();
  }

  @Public()
  @Get('research/:slug')
  researchBySlug(@Param('slug') slug: string) {
    return this.researchService.researchBySlug(slug);
  }

  @Public()
  @Get('positions')
  positions() {
    return this.researchService.positions();
  }

  @Get('positions/admin')
  @RequireRole(PlatformRole.MODERATOR)
  adminPositions() {
    return this.researchService.adminPositions();
  }

  @Get('positions/admin/:id')
  @RequireRole(PlatformRole.MODERATOR)
  adminPosition(@Param('id', ParseUUIDPipe) id: string) {
    return this.researchService.adminPosition(id);
  }

  @Post('positions')
  @RequireRole(PlatformRole.MODERATOR)
  createPosition(@Body() body: CreatePositionDto) {
    return this.researchService.createPosition(body);
  }

  @Patch('positions/:id')
  @RequireRole(PlatformRole.MODERATOR)
  updatePosition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdatePositionDto,
  ) {
    return this.researchService.updatePosition(id, body);
  }

  @Post('positions/:id/enable')
  @RequireRole(PlatformRole.MODERATOR)
  enablePosition(@Param('id', ParseUUIDPipe) id: string) {
    return this.researchService.enablePosition(id);
  }

  @Post('positions/:id/disable')
  @RequireRole(PlatformRole.MODERATOR)
  disablePosition(@Param('id', ParseUUIDPipe) id: string) {
    return this.researchService.disablePosition(id);
  }

  @Delete('positions/:id')
  @RequireRole(PlatformRole.MODERATOR)
  deletePosition(@Param('id', ParseUUIDPipe) id: string) {
    return this.researchService.deletePosition(id);
  }
}
