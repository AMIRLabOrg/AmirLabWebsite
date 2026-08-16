import { BadRequestException, ConflictException } from '@nestjs/common';

export type ReviewIssueTone =
  | 'error'
  | 'warning'
  | 'pending'
  | 'success'
  | 'info'
  | 'neutral';

export interface ReviewIssue {
  itemId: string;
  code: string;
  message: string;
  tone: ReviewIssueTone;
  field?: string;
}

export function reviewBadRequest(
  publicMessage: string,
  issues: ReviewIssue[],
): BadRequestException {
  return new BadRequestException({
    code: 'REVIEW_ITEMS_NEED_ATTENTION',
    issues,
    publicMessage,
  });
}

export function reviewConflict(
  publicMessage: string,
  issues: ReviewIssue[],
): ConflictException {
  return new ConflictException({
    code: 'REVIEW_ITEMS_CHANGED',
    issues,
    publicMessage,
  });
}
