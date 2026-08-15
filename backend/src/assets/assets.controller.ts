import { Controller, Get, Param, ParseUUIDPipe, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../auth/auth.decorators';
import { AssetsService } from './assets.service';

@Controller('assets')
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Public()
  @Get(':id')
  async publicAsset(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() response: Response,
  ): Promise<void> {
    const asset = await this.assets.readPublic(id);
    response.set({
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Type': asset.mimeType,
      'Cross-Origin-Resource-Policy': 'cross-origin',
    });
    response.send(asset.buffer);
  }
}
