import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import nodemailer from 'nodemailer';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { JobsService } from '../jobs/jobs.service';
import { MailSettingsService } from './mail-settings.service';

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

  constructor(
    private readonly jobs: JobsService,
    private readonly settings: MailSettingsService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    this.jobs.register('SEND_EMAIL', (payload) => this.deliver(payload));
  }

  async queue(message: MailMessage, uniqueKey?: string): Promise<void> {
    await this.jobs.enqueue(
      'SEND_EMAIL',
      mailMessageToJson(message),
      uniqueKey,
    );
  }

  async sendNow(message: MailMessage): Promise<void> {
    await this.send(message);
  }

  async sendTest(to: string): Promise<void> {
    await this.send({
      to,
      subject: 'AMIR Lab email configuration test',
      text: 'This message confirms that the AMIR Lab email provider is configured.',
    });
  }

  private async deliver(payload: unknown): Promise<void> {
    if (!isRecord(payload))
      throw new Error('Email job payload must be an object');
    const { to, subject, text, html } = payload;
    if (
      typeof to !== 'string' ||
      typeof subject !== 'string' ||
      typeof text !== 'string' ||
      (html !== undefined && html !== null && typeof html !== 'string')
    ) {
      throw new Error('Email job payload is invalid');
    }
    await this.send({
      to,
      subject,
      text,
      html: typeof html === 'string' ? html : undefined,
    });
  }

  private async send(message: MailMessage): Promise<void> {
    const config = await this.settings.getConfig();
    if (!config) throw new Error('Email provider is not configured');
    try {
      if (config.settings.provider === 'RESEND') {
        if (!config.secret) throw new Error('Resend API key is not configured');
        const attachments = message.attachments?.map(
          ({ filename, content, contentType }) => ({
            filename,
            content: content.toString('base64'),
            content_type: contentType,
          }),
        );
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.secret}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            from: config.settings.from,
            to: [message.to],
            subject: message.subject,
            text: message.text,
            html: message.html,
            attachments,
          }),
          signal: AbortSignal.timeout(20_000),
          redirect: 'error',
        });
        if (!response.ok) {
          await response.body?.cancel();
          throw new Error(
            `Resend rejected email delivery (${response.status})`,
          );
        }
        await response.body?.cancel();
      } else {
        const transport = nodemailer.createTransport({
          host: config.settings.host,
          port: config.settings.port,
          secure: config.settings.secure,
          requireTLS: config.settings.requireTls,
          ...(config.settings.user && config.secret
            ? { auth: { user: config.settings.user, pass: config.secret } }
            : {}),
        });
        try {
          await transport.sendMail({ from: config.settings.from, ...message });
        } finally {
          transport.close();
        }
      }
    } catch (error) {
      await this.recordMailUsage('mail.failed', config.settings.provider);
      throw error;
    }
    await this.recordMailUsage('mail.delivered', config.settings.provider);
  }

  private async recordMailUsage(
    action: 'mail.delivered' | 'mail.failed',
    provider: string,
  ) {
    try {
      await this.prisma.auditRecord.create({
        data: {
          action,
          entityType: 'Mail',
          entityId:
            action === 'mail.delivered' ? 'delivery' : 'failed-delivery',
          details: { provider },
        },
      });
    } catch (error) {
      this.logger.warn(
        `Email usage could not be recorded: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
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
  return Boolean(value) && !Array.isArray(value) && typeof value === 'object';
}
