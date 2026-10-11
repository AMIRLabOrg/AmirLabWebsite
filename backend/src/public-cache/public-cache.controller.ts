import { Controller, Get, Header } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../auth/auth.decorators';
import { PublicCacheService } from './public-cache.service';

@Controller('public-cache')
export class PublicCacheController {
  constructor(private readonly cache: PublicCacheService) {}

  @Public()
  @SkipThrottle()
  @Get('revision')
  @Header('Cache-Control', 'no-store')
  revision() {
    return this.cache.revision();
  }
}
