import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { PlatformRole } from '../../generated/prisma/client';
import { CurrentUser, Public, RequireRole } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  ReviewApplicationDto,
  SubmitApplicationDto,
} from './dto/application.dto';
import { ApplicationQueryDto } from './dto/application-query.dto';
import { ApplicationsService } from './applications.service';

@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  @Public()
  @Post()
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'cv', maxCount: 1 },
        { name: 'profileImage', maxCount: 1 },
      ],
      { limits: { fileSize: 8 * 1024 * 1024, files: 2 } },
    ),
  )
  submit(
    @Body() body: SubmitApplicationDto,
    @UploadedFiles()
    files?: {
      cv?: Express.Multer.File[];
      profileImage?: Express.Multer.File[];
    },
  ) {
    const file = files?.cv?.[0];
    if (!file) {
      throw new BadRequestException('CV PDF is required');
    }
    return this.applications.submit(body, file, files?.profileImage?.[0]);
  }

  @Get()
  @RequireRole(PlatformRole.MODERATOR)
  list(@Query() query: ApplicationQueryDto) {
    return this.applications.list(query);
  }

  @Get('appointment-letter/preview')
  @RequireRole(PlatformRole.ADMIN)
  async appointmentLetterPreview(@Res() response: Response): Promise<void> {
    const pdf = await this.applications.previewAppointmentLetter();
    response
      .type('application/pdf')
      .attachment('appointment-letter-preview.pdf')
      .send(pdf);
  }

  @Get(':id')
  @RequireRole(PlatformRole.MODERATOR)
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.applications.get(id);
  }

  @Get(':id/cv')
  @RequireRole(PlatformRole.MODERATOR)
  async cv(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() response: Response,
  ): Promise<void> {
    const cv = await this.applications.readCv(id);
    response
      .type('application/pdf')
      .attachment(cv.originalName)
      .send(cv.buffer);
  }

  @Get(':id/appointment-letter')
  @RequireRole(PlatformRole.ADMIN)
  async appointmentLetter(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() response: Response,
  ): Promise<void> {
    const letter = await this.applications.readAppointmentLetter(id);
    response
      .type('application/pdf')
      .attachment(letter.filename)
      .send(letter.buffer);
  }

  @Post(':id/review')
  @RequireRole(PlatformRole.ADMIN)
  review(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReviewApplicationDto,
    @CurrentUser() reviewer: AuthenticatedUser,
  ) {
    return this.applications.review(id, body, reviewer);
  }
}
