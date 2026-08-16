import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

interface PublicIssue {
  itemId?: string;
  code?: string;
  field?: string;
  message: string;
  tone?: 'error' | 'warning' | 'pending' | 'success' | 'info' | 'neutral';
}

interface PublicExceptionResponse {
  code?: string;
  issues?: PublicIssue[];
  publicMessage?: string;
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const raw =
      exception instanceof HttpException ? exception.getResponse() : exception;
    const safe = publicExceptionResponse(raw);

    if (status >= 500) {
      this.logger.error(
        'Unhandled API error',
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(
        `API request rejected (${status}): ${describeForLog(raw)}`,
      );
    }

    response.status(status).json({
      statusCode: status,
      code: safe.code ?? statusCode(status),
      message: safe.publicMessage ?? defaultPublicMessage(status),
      ...(safe.issues?.length ? { issues: safe.issues } : {}),
    });
  }
}

function publicExceptionResponse(value: unknown): PublicExceptionResponse {
  if (!value || Array.isArray(value) || typeof value !== 'object') return {};
  const record = value as Record<string, unknown>;
  const publicMessage =
    typeof record.publicMessage === 'string' ? record.publicMessage : undefined;
  const code = typeof record.code === 'string' ? record.code : undefined;
  const issues = Array.isArray(record.issues)
    ? record.issues.flatMap((issue) => normalizeIssue(issue))
    : undefined;
  return { code, issues, publicMessage };
}

function normalizeIssue(value: unknown): PublicIssue[] {
  if (!value || Array.isArray(value) || typeof value !== 'object') return [];
  const record = value as Record<string, unknown>;
  if (typeof record.message !== 'string') return [];
  const allowedTones = new Set([
    'error',
    'warning',
    'pending',
    'success',
    'info',
    'neutral',
  ]);
  return [
    {
      message: record.message,
      ...(typeof record.itemId === 'string' ? { itemId: record.itemId } : {}),
      ...(typeof record.code === 'string' ? { code: record.code } : {}),
      ...(typeof record.field === 'string' ? { field: record.field } : {}),
      ...(typeof record.tone === 'string' && allowedTones.has(record.tone)
        ? { tone: record.tone as PublicIssue['tone'] }
        : {}),
    },
  ];
}

function defaultPublicMessage(status: number): string {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return 'The submitted data could not be accepted. Check the form and try again.';
    case HttpStatus.UNAUTHORIZED:
      return 'Authentication is required to continue.';
    case HttpStatus.FORBIDDEN:
      return 'You do not have permission to perform this action.';
    case HttpStatus.NOT_FOUND:
      return 'The requested record could not be found.';
    case HttpStatus.CONFLICT:
      return 'This record changed while you were working. Reload and try again.';
    case HttpStatus.PAYLOAD_TOO_LARGE:
      return 'The uploaded file is too large.';
    case HttpStatus.TOO_MANY_REQUESTS:
      return 'Too many requests. Wait a moment and try again.';
    default:
      return status >= 500
        ? 'The server could not complete the request. Try again.'
        : 'The request could not be completed.';
  }
}

function statusCode(status: number): string {
  return status >= 500 ? 'SERVER_ERROR' : `HTTP_${status}`;
}

function describeForLog(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
