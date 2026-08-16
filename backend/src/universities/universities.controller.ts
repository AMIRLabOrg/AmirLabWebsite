import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PlatformRole } from '../../generated/prisma/client';
import { Public, RequireRole } from '../auth/auth.decorators';
import { UniversityDto, UpdateUniversityDto } from './dto/university.dto';
import { UniversitiesService } from './universities.service';

@Controller('universities')
export class UniversitiesController {
  constructor(private readonly universities: UniversitiesService) {}

  @Public()
  @Get()
  list() {
    return this.universities.publicList();
  }
}

@Controller('admin/universities')
@RequireRole(PlatformRole.ADMIN)
export class AdminUniversitiesController {
  constructor(private readonly universities: UniversitiesService) {}

  @Get()
  list() {
    return this.universities.list();
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('logo', { limits: { fileSize: 4 * 1024 * 1024 } }),
  )
  create(
    @Body() body: UniversityDto,
    @UploadedFile() logo?: Express.Multer.File,
  ) {
    return this.universities.create(body, logo);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.universities.get(id);
  }

  @Patch(':id')
  @UseInterceptors(
    FileInterceptor('logo', { limits: { fileSize: 4 * 1024 * 1024 } }),
  )
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateUniversityDto,
    @UploadedFile() logo?: Express.Multer.File,
  ) {
    const removeLogo = body.removeLogo === true;
    return this.universities.update(id, body, logo, removeLogo);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.universities.remove(id);
  }
}
