import { Module } from '@nestjs/common';
import { AssetsModule } from '../assets/assets.module';
import {
  DocumentApprovalController,
  DocumentsController,
  DocumentTemplatesController,
} from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  imports: [AssetsModule],
  controllers: [
    DocumentApprovalController,
    DocumentTemplatesController,
    DocumentsController,
  ],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
