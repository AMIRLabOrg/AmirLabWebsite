import {
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { PlatformRole } from '../../generated/prisma/client';
import { RequireRole } from '../auth/auth.decorators';
import { JobQueryDto } from './dto/job-query.dto';
import { JobsService } from './jobs.service';

@Controller('admin/jobs')
@RequireRole(PlatformRole.ADMIN)
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get()
  list(@Query() query: JobQueryDto) {
    return this.jobs.list({
      status: query.status,
      type: query.type,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  @Get('summary')
  summary() {
    return this.jobs.summary();
  }

  @Post('retry-failed')
  async retryFailed() {
    const count = await this.jobs.retryAllFailed();
    return { count };
  }

  @Post(':id/cancel')
  async cancel(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    const outcome = await this.jobs.cancel(id);
    if (outcome === 'not_found') {
      throw new NotFoundException('Job not found');
    }
    if (outcome === 'not_cancellable') {
      throw new ConflictException('Job can no longer be cancelled');
    }
    return { outcome };
  }

  @Post(':id/retry')
  async retry(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    const outcome = await this.jobs.retry(id);
    if (outcome === 'not_found') {
      throw new NotFoundException('Job not found');
    }
    if (outcome === 'not_retryable') {
      throw new ConflictException('Job is not in a retryable state');
    }
    return { outcome };
  }
}
