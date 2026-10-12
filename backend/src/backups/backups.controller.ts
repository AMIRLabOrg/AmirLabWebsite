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
import { RequireRole } from '../auth/auth.decorators';
import { BackupSettingsDto } from './backups.dto';
import { BackupsService } from './backups.service';

@Controller('backups')
@RequireRole(PlatformRole.ADMIN)
export class BackupsController {
  constructor(private readonly backups: BackupsService) {}

  @Get('status')
  status() {
    return this.backups.status();
  }

  @Put('settings')
  configure(@Body() body: BackupSettingsDto) {
    return this.backups.configure(body);
  }

  @Post()
  capture() {
    return this.backups.capture();
  }

  @Post(':id/restore')
  restore(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.backups.restore(id);
  }
}
