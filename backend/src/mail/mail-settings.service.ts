import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../../generated/prisma/client';
import type { Environment } from '../config/environment';
import { PrismaService } from '../database/prisma.service';
import { EncryptedCredentials } from '../common/encrypted-credentials';

const KEY = 'mail.provider';
type Provider = 'SMTP' | 'RESEND';
type MailSettings = {
  provider: Provider;
  from: string;
  host?: string;
  port?: number;
  secure?: boolean;
  requireTls?: boolean;
  user?: string;
  credentials?: { iv: string; tag: string; ciphertext: string } | null;
};

@Injectable()
export class MailSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  private encryption() {
    return new EncryptedCredentials<{ secret: string }>(
      this.config.get('encryptionKey', { infer: true }) ?? '',
    );
  }

  private async stored(): Promise<MailSettings | null> {
    const row = await this.prisma.siteSetting.findUnique({
      where: { key: KEY },
    });
    if (!row) return null;
    if (!row.value || typeof row.value !== 'object' || Array.isArray(row.value))
      throw new BadRequestException(
        'Saved email settings are invalid. Re-enter them.',
      );
    const value = row.value as Record<string, unknown>;
    if (
      !['SMTP', 'RESEND'].includes(String(value.provider)) ||
      typeof value.from !== 'string'
    )
      throw new BadRequestException(
        'Saved email settings are invalid. Re-enter them.',
      );
    return value as MailSettings;
  }

  async getSecret(settings: MailSettings): Promise<string | undefined> {
    if (settings.credentials === null) return undefined;
    if (settings.credentials) {
      const result = await this.encryption().decrypt(settings.credentials);
      if (typeof result.secret !== 'string' || !result.secret)
        throw new BadRequestException(
          'Saved email credentials cannot be read. Re-enter them.',
        );
      return result.secret;
    }
    return settings.provider === 'SMTP'
      ? this.config.get('smtpPassword', { infer: true })
      : undefined;
  }

  async getConfig(): Promise<{
    settings: MailSettings;
    secret?: string;
  } | null> {
    const saved = await this.stored();
    if (saved) return { settings: saved, secret: await this.getSecret(saved) };
    const host = this.config.get('smtpHost', { infer: true });
    if (!host) return null;
    const settings: MailSettings = {
      provider: 'SMTP',
      from: this.config.get('smtpFrom', { infer: true }),
      host,
      port: this.config.get('smtpPort', { infer: true }),
      secure: this.config.get('smtpSecure', { infer: true }),
      requireTls: this.config.get('smtpRequireTls', { infer: true }),
      user: this.config.get('smtpUser', { infer: true }),
    };
    return {
      settings,
      secret: this.config.get('smtpPassword', { infer: true }),
    };
  }

  async status() {
    const saved = await this.stored();
    const config = saved
      ? { settings: saved, secret: await this.getSecret(saved) }
      : await this.getConfig();
    const settings = config?.settings;
    return {
      configured: Boolean(
        settings && (settings.provider === 'SMTP' || config?.secret),
      ),
      source: saved ? 'admin' : settings ? 'environment' : 'none',
      provider: settings?.provider ?? null,
      from: settings?.from ?? null,
      host: settings?.host ?? null,
      port: settings?.port ?? null,
      secure: settings?.secure ?? false,
      requireTls: settings?.requireTls ?? false,
      user: settings?.user ?? null,
      hasSecret: Boolean(config?.secret),
    };
  }

  async save(
    input: {
      provider: Provider;
      from: string;
      host?: string;
      port?: number;
      secure?: boolean;
      requireTls?: boolean;
      user?: string;
      secret?: string;
      clearSecret?: boolean;
    },
    actorId: string,
  ) {
    const old = await this.stored();
    const previousSecret =
      old?.provider === input.provider
        ? await this.getSecret(old)
        : !old && input.provider === 'SMTP'
          ? this.config.get('smtpPassword', { infer: true })
          : undefined;
    const secret = input.clearSecret
      ? undefined
      : input.secret?.trim() || previousSecret;
    let settings: MailSettings;
    if (input.provider === 'SMTP') {
      const host = input.host?.trim();
      const user = input.user?.trim() ?? '';
      if (!host || !input.port || !input.from.trim())
        throw new BadRequestException(
          'Host, port, and sender are required for SMTP.',
        );
      if (Boolean(user) !== Boolean(secret))
        throw new BadRequestException(
          'SMTP username and password must be provided together.',
        );
      settings = {
        provider: 'SMTP',
        from: input.from.trim(),
        host,
        port: input.port,
        user: user || undefined,
        secure: input.secure ?? false,
        requireTls: input.requireTls ?? false,
      };
      try {
        const nodemailer = await import('nodemailer');
        const transport = nodemailer.default.createTransport({
          host,
          port: input.port,
          secure: settings.secure,
          requireTLS: settings.requireTls,
          ...(user && secret ? { auth: { user, pass: secret } } : {}),
        });
        try {
          await transport.verify();
        } finally {
          transport.close();
        }
      } catch {
        throw new ServiceUnavailableException(
          'SMTP verification failed. Saved settings were not changed.',
        );
      }
    } else {
      if (
        !input.from.trim() ||
        (!secret && (!input.clearSecret || old?.provider !== 'RESEND'))
      )
        throw new BadRequestException(
          'Resend API key and sender are required.',
        );
      if (secret) await this.verifyResend(secret);
      settings = { provider: 'RESEND', from: input.from.trim() };
    }
    const credentials = secret ? this.encryption().encrypt({ secret }) : null;
    const value: Prisma.InputJsonObject = {
      ...settings,
      credentials: credentials ? { ...credentials } : null,
    };
    await this.prisma.$transaction(async (transaction) => {
      await transaction.siteSetting.upsert({
        where: { key: KEY },
        create: { key: KEY, value },
        update: { value },
      });
      await transaction.auditRecord.create({
        data: {
          action: 'settings.mail-updated',
          actorId,
          entityId: KEY,
          entityType: 'SiteSetting',
          details: { provider: settings.provider, configured: true },
        },
      });
    });
    return this.status();
  }

  async usage() {
    const configured = await this.getConfig();
    if (
      !configured ||
      (configured.settings.provider === 'RESEND' && !configured.secret)
    )
      return {
        configured: false,
        provider: configured?.settings.provider ?? null,
      };
    if (configured.settings.provider === 'RESEND') {
      try {
        const response = await fetch('https://api.resend.com/usage', {
          headers: { Authorization: `Bearer ${configured.secret}` },
          signal: AbortSignal.timeout(10_000),
          redirect: 'error',
        });
        if (!response.ok)
          return { configured: true, provider: 'RESEND', unavailable: true };
        const data: unknown = await response.json();
        if (
          !isRecord(data) ||
          !isRecord(data.emails) ||
          !isRecord(data.emails.daily)
        )
          throw new Error('Invalid Resend usage response');
        const emails = data.emails.daily;
        return {
          configured: true,
          provider: 'RESEND',
          unavailable: false,
          used: numberOrNull(emails.used),
          limit: numberOrNull(emails.limit),
          resetAt:
            typeof emails.resets_at === 'string' ? emails.resets_at : null,
        };
      } catch {
        return { configured: true, provider: 'RESEND', unavailable: true };
      }
    }
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const [sent, failed] = await Promise.all([
      this.prisma.auditRecord.count({
        where: {
          action: 'mail.delivered',
          createdAt: { gte: start },
          details: { path: ['provider'], equals: 'SMTP' },
        },
      }),
      this.prisma.auditRecord.count({
        where: {
          action: 'mail.failed',
          createdAt: { gte: start },
          details: { path: ['provider'], equals: 'SMTP' },
        },
      }),
    ]);
    return {
      configured: true,
      provider: 'SMTP',
      unavailable: false,
      sent,
      failed,
      source: 'application',
    };
  }

  private async verifyResend(secret: string) {
    let response: Response;
    try {
      response = await fetch('https://api.resend.com/usage', {
        headers: { Authorization: `Bearer ${secret}` },
        signal: AbortSignal.timeout(10_000),
        redirect: 'error',
      });
    } catch {
      throw new ServiceUnavailableException(
        'Could not verify Resend API key. Saved settings were not changed.',
      );
    }
    await response.body?.cancel();
    if (response.status === 401 || response.status === 403)
      throw new BadRequestException(
        'Resend rejected this API key. Saved settings were not changed.',
      );
    if (!response.ok)
      throw new ServiceUnavailableException(
        'Could not verify Resend API key. Saved settings were not changed.',
      );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
