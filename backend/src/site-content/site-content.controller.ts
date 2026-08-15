import { Body, Controller, Get, Put } from '@nestjs/common';
import { PlatformRole } from '../../generated/prisma/client';
import { CurrentUser, Public, RequireRole } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AboutContentDto, HomeContentDto } from './dto/site-content.dto';
import { SiteContentService } from './site-content.service';

@Controller('site-content')
export class SiteContentController {
  constructor(private readonly content: SiteContentService) {}

  @Public()
  @Get('home')
  home() {
    return this.content.home();
  }

  @Put('home')
  @RequireRole(PlatformRole.ADMIN)
  updateHome(
    @Body() body: HomeContentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.content.updateHome(body, actor.id);
  }

  @Public()
  @Get('about')
  about() {
    return this.content.about();
  }

  @Put('about')
  @RequireRole(PlatformRole.ADMIN)
  updateAbout(
    @Body() body: AboutContentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.content.updateAbout(body, actor.id);
  }
}
