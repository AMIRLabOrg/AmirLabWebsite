import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser, RequireRole } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PlatformRole } from '../../generated/prisma/client';
import { BulkReviewProfileEditsDto, ReviewProfileEditDto, SubmitProfileEditDto } from './dto/profile.dto';
import { ProfileReviewQueryDto } from './dto/profile-review-query.dto';
import { ProfilesService } from './profiles.service';

@Controller()
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Get('profile/me')
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.profiles.mine(user);
  }

  @Post('profile/me')
  @UseInterceptors(
    FileInterceptor('avatar', { limits: { fileSize: 8 * 1024 * 1024 } }),
  )
  submit(
    @Body() body: SubmitProfileEditDto,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() avatar?: Express.Multer.File,
  ) {
    if (body.removeAvatar === 'true' && avatar) {
      throw new BadRequestException(
        'Choose either a new profile image or remove the current image',
      );
    }
    return this.profiles.submit(body, user, avatar);
  }

  @Get('users/:id/profile')
  @RequireRole(PlatformRole.ADMIN)
  getUserProfile(@Param('id', ParseUUIDPipe) id: string) {
    return this.profiles.getUserProfile(id);
  }

  @Post('users/:id/profile')
  @RequireRole(PlatformRole.ADMIN)
  @UseInterceptors(
    FileInterceptor('avatar', { limits: { fileSize: 8 * 1024 * 1024 } }),
  )
  adminSubmit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SubmitProfileEditDto,
    @CurrentUser() actor: AuthenticatedUser,
    @UploadedFile() avatar?: Express.Multer.File,
  ) {
    if (body.removeAvatar === 'true' && avatar) {
      throw new BadRequestException(
        'Choose either a new profile image or remove the current image',
      );
    }
    return this.profiles.adminSubmit(id, body, actor, avatar);
  }

  @Get('profile-reviews')
  @RequireRole(PlatformRole.MODERATOR)
  reviewQueue(@Query() query: ProfileReviewQueryDto) {
    return this.profiles.reviewQueue(query);
  }

  @Post('profile-reviews/bulk-review')
  @RequireRole(PlatformRole.MODERATOR)
  bulkReview(
    @Body() body: BulkReviewProfileEditsDto,
    @CurrentUser() reviewer: AuthenticatedUser,
  ) {
    return this.profiles.bulkReview(body, reviewer);
  }

  @Get('profile-reviews/:id')
  @RequireRole(PlatformRole.MODERATOR)
  reviewRequest(@Param('id', ParseUUIDPipe) id: string) {
    return this.profiles.reviewRequest(id);
  }

  @Post('profile-reviews/:id/review')
  @RequireRole(PlatformRole.MODERATOR)
  review(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReviewProfileEditDto,
    @CurrentUser() reviewer: AuthenticatedUser,
  ) {
    return this.profiles.review(id, body, reviewer);
  }
}
