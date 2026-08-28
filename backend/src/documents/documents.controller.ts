import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { DocumentKind, PlatformRole } from '../../generated/prisma/client';
import { CurrentUser, RequireRole } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  DocumentApprovalDto,
  DocumentTemplateDto,
  IssueDocumentDto,
} from './dto/documents.dto';
import { DocumentsService } from './documents.service';

@Controller('admin/documents/approval')
@RequireRole(PlatformRole.ADMIN)
export class DocumentApprovalController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  get() {
    return this.documents.approval();
  }

  @Get('signature')
  async signature(@Res() response: Response): Promise<void> {
    const buffer = await this.documents.approvalSignature();
    response.set({
      'Cache-Control': 'private, no-store',
      'Content-Type': 'image/png',
    });
    response.send(buffer);
  }

  @Get('watermark')
  async watermark(@Res() response: Response): Promise<void> {
    const buffer = await this.documents.approvalWatermark();
    response.set({
      'Cache-Control': 'private, no-store',
      'Content-Type': 'image/png',
    });
    response.send(buffer);
  }

  @Put()
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'signature', maxCount: 1 },
        { name: 'watermark', maxCount: 1 },
      ],
      { limits: { fileSize: 8 * 1024 * 1024 } },
    ),
  )
  update(
    @Body() body: DocumentApprovalDto,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFiles()
    files?: {
      signature?: Express.Multer.File[];
      watermark?: Express.Multer.File[];
    },
  ) {
    return this.documents.updateApproval(
      body,
      user.id,
      files?.signature?.[0],
      files?.watermark?.[0],
    );
  }
}

@Controller('admin/document-templates')
@RequireRole(PlatformRole.ADMIN)
export class DocumentTemplatesController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  list(
    @Query('kind', new ParseEnumPipe(DocumentKind, { optional: true }))
    kind?: DocumentKind,
  ) {
    return this.documents.listTemplates(kind);
  }

  @Post()
  create(
    @Body() body: DocumentTemplateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documents.createTemplate(body, user.id);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.documents.getTemplate(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: DocumentTemplateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documents.updateTemplate(id, body, user.id);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.documents.removeTemplate(id);
  }

  @Post(':id/default-offer')
  setDefault(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documents.setDefaultOffer(id, user.id);
  }

  @Post(':id/preview')
  async preview(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() response: Response,
  ): Promise<void> {
    const pdf = await this.documents.previewTemplate(id);
    response
      .type('application/pdf')
      .attachment('document-preview.pdf')
      .send(pdf);
  }
}

@Controller('admin/documents')
@RequireRole(PlatformRole.ADMIN)
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  list(
    @Query('kind', new ParseEnumPipe(DocumentKind, { optional: true }))
    kind?: DocumentKind,
  ) {
    return this.documents.listIssued(kind);
  }

  @Get('recipients')
  recipients() {
    return this.documents.listRecipients();
  }

  @Post()
  issue(
    @Body() body: IssueDocumentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documents.issue(body, user.id);
  }

  @Get(':id/pdf')
  async pdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() response: Response,
  ): Promise<void> {
    const document = await this.documents.read(id);
    response
      .type('application/pdf')
      .attachment(document.filename)
      .send(document.buffer);
  }

  @Post(':id/email')
  email(@Param('id', ParseUUIDPipe) id: string) {
    return this.documents.queueEmail(id);
  }
}
