import { Injectable } from '@nestjs/common';
import { DocumentsService } from '../documents/documents.service';

/** Compatibility boundary for existing application routes and tests. */
@Injectable()
export class AppointmentLettersService {
  constructor(private readonly documents: DocumentsService) {}

  preview() {
    return this.documents.previewDefaultOffer();
  }

  read(applicationId: string) {
    return this.documents.readOffer(applicationId);
  }
}

export function safePlaceholderValue(value: string): string {
  return value
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[*_`~[\]{}<>]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
