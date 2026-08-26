import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';
import type { Prisma } from '../../generated/prisma/client';
import type { Environment } from '../config/environment';
import { JobsService } from '../jobs/jobs.service';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
  }>;
}

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter?: Transporter;

  constructor(
    private readonly config: ConfigService<Environment, true>,
    private readonly jobs: JobsService,
  ) {
    const host = config.get('smtpHost', { infer: true });
    this.transporter = host
      ? nodemailer.createTransport({
          host,
          port: config.get('smtpPort', { infer: true }),
          secure: config.get('smtpSecure', { infer: true }),
          requireTLS: config.get('smtpRequireTls', { infer: true }),
          auth: {
            user: config.get('smtpUser', { infer: true }),
            pass: config.get('smtpPassword', { infer: true }),
          },
        })
      : undefined;
  }

  onModuleInit(): void {
    this.jobs.register('SEND_EMAIL', async (payload) =>
      this.deliver(payload, false),
    );
  }

  async queue(message: MailMessage, uniqueKey?: string): Promise<void> {
    await this.jobs.enqueue(
      'SEND_EMAIL',
      mailMessageToJson(message),
      uniqueKey,
    );
  }

  /** Send immediately when a one-time secret must never be persisted in the job payload. */
  async sendNow(message: MailMessage): Promise<void> {
    if (!this.transporter) throw new Error('SMTP is not configured');
    await this.transporter.sendMail({
      from: this.config.get('smtpFrom', { infer: true }),
      ...message,
    });
  }

  private async deliver(
    payload: unknown,
    requireTransport: boolean,
  ): Promise<void> {
    if (!isRecord(payload)) {
      throw new Error('Email job payload must be an object');
    }
    const { to, subject, text, html } = payload;
    if (
      typeof to !== 'string' ||
      typeof subject !== 'string' ||
      typeof text !== 'string' ||
      (html !== undefined && html !== null && typeof html !== 'string')
    ) {
      throw new Error('Email job payload is invalid');
    }

    if (!this.transporter) {
      if (requireTransport) {
        throw new Error('SMTP is not configured');
      }
      this.logger.warn(
        `SMTP is not configured; skipped email to ${to}: ${subject}`,
      );
      return;
    }

    await this.transporter.sendMail({
      from: this.config.get('smtpFrom', { infer: true }),
      to,
      subject,
      text,
      html: html ?? undefined,
    });
  }
}

function mailMessageToJson(message: MailMessage): Prisma.InputJsonObject {
  return {
    to: message.to,
    subject: message.subject,
    text: message.text,
    ...(message.html ? { html: message.html } : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && !Array.isArray(value) && typeof value === 'object';
}
