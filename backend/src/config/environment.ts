export interface Environment {
  databaseUrl: string;
  frontendOrigins: string[];
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  sessionCookieName: string;
  sessionDays: number;
  smtpFrom: string;
  smtpHost?: string;
  smtpPort: number;
  smtpUser?: string;
  smtpPassword?: string;
  smtpSecure: boolean;
  smtpRequireTls: boolean;
  uploadRoot: string;
  redisUrl?: string;
  vapidPublicKey?: string;
  vapidPrivateKey?: string;
  vapidSubject?: string;
}

export function validateEnvironment(
  source: Record<string, unknown>,
): Environment {
  const databaseUrl = requiredString(source, 'DATABASE_URL');
  const frontendOrigins = requiredString(source, 'FRONTEND_ORIGINS')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const nodeEnv = optionalString(source.NODE_ENV, 'development');
  const smtpHost = optionalValue(source.SMTP_HOST);
  const smtpUser = optionalValue(source.SMTP_USER);
  const smtpPassword = optionalValue(source.SMTP_PASSWORD);
  const smtpConfigured = Boolean(smtpHost || smtpUser || smtpPassword);

  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new Error('NODE_ENV must be development, test, or production');
  }

  if (frontendOrigins.length === 0) {
    throw new Error('FRONTEND_ORIGINS must include at least one origin');
  }
  if (smtpConfigured && (!smtpHost || !smtpUser || !smtpPassword)) {
    throw new Error(
      'SMTP_HOST, SMTP_USER, and SMTP_PASSWORD must be configured together',
    );
  }
  if (nodeEnv === 'production' && !smtpConfigured) {
    throw new Error('SMTP configuration is required in production');
  }

  return {
    databaseUrl,
    frontendOrigins,
    nodeEnv: nodeEnv as Environment['nodeEnv'],
    port: positiveInteger(source.PORT, 3001, 'PORT'),
    sessionCookieName: optionalString(
      source.SESSION_COOKIE_NAME,
      'amirl_session',
    ),
    sessionDays: positiveInteger(source.SESSION_DAYS, 30, 'SESSION_DAYS'),
    smtpFrom: optionalString(
      source.SMTP_FROM,
      'AMIR Lab <noreply@itsfuad.com>',
    ),
    smtpHost,
    smtpPort: positiveInteger(source.SMTP_PORT, 2525, 'SMTP_PORT'),
    smtpUser,
    smtpPassword,
    smtpSecure: booleanValue(source.SMTP_SECURE, false, 'SMTP_SECURE'),
    smtpRequireTls: booleanValue(
      source.SMTP_REQUIRE_TLS,
      true,
      'SMTP_REQUIRE_TLS',
    ),
    uploadRoot: optionalString(source.UPLOAD_ROOT, './storage'),
    redisUrl: optionalValue(source.REDIS_URL),
    vapidPublicKey: optionalValue(source.VAPID_PUBLIC_KEY),
    vapidPrivateKey: optionalValue(source.VAPID_PRIVATE_KEY),
    vapidSubject: optionalValue(source.VAPID_SUBJECT),
  };
}

function requiredString(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${key} is required`);
  }
  return value;
}

function optionalString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() !== '' ? value : fallback;
}

function optionalValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function booleanValue(value: unknown, fallback: boolean, key: string): boolean {
  if (value === undefined || value === '') return fallback;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  throw new Error(`${key} must be true or false`);
}

function positiveInteger(
  value: unknown,
  fallback: number,
  key: string,
): number {
  if (value === undefined || value === '') {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${key} must be a positive integer`);
  }
  return parsed;
}
