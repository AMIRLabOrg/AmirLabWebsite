import { BadRequestException, ConflictException } from '@nestjs/common';

export type ReviewIssueTone =
  'error' | 'warning' | 'pending' | 'success' | 'info' | 'neutral';

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
  const error = new BadRequestException({
    code: 'REVIEW_ITEMS_NEED_ATTENTION',
    issues,
    publicMessage,
  });
  error.message = publicMessage;
  return error;
}

export function reviewConflict(
  publicMessage: string,
  issues: ReviewIssue[],
): ConflictException {
  const error = new ConflictException({
    code: 'REVIEW_ITEMS_CHANGED',
    issues,
    publicMessage,
  });
  error.message = publicMessage;
  return error;
}
