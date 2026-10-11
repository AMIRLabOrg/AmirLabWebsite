import { validateEnvironment } from './environment';

const baseEnvironment = {
  DATABASE_URL: 'postgresql://localhost/amirl',
  FRONTEND_ORIGINS: 'http://localhost:3000',
};

describe('validateEnvironment', () => {
  it('accepts production configuration without a separate public site URL', () => {
    const config = validateEnvironment({
      ...baseEnvironment,
      FRONTEND_ORIGINS: 'https://amirlab.org,https://amirlab.vercel.app',
      NODE_ENV: 'production',
      UPLOAD_ROOT: '/var/lib/amirlab/uploads',
      PUBLIC_SITE_EMAIL: 'info@amirlab.org',
      SMTP_FROM: 'AMIR Lab <info@amirlab.org>',
      SMTP_HOST: 'mail.smtp2go.com',
      SMTP_PASSWORD: 'real-password',
      SMTP_USER: 'real-user',
    });
    expect(config.frontendOrigins).toEqual([
      'https://amirlab.org',
      'https://amirlab.vercel.app',
    ]);
    expect(config).not.toHaveProperty('publicSiteUrl');
  });

  it('keeps SMTP credentials as separate typed settings', () => {
    expect(
      validateEnvironment({
        ...baseEnvironment,
        SMTP_HOST: 'mail.smtp2go.com',
        SMTP_PASSWORD: 'secret',
        SMTP_PORT: '2525',
        SMTP_REQUIRE_TLS: 'true',
        SMTP_SECURE: 'false',
        SMTP_USER: 'account',
      }),
    ).toMatchObject({
      smtpHost: 'mail.smtp2go.com',
      smtpPassword: 'secret',
      smtpPort: 2525,
      smtpRequireTls: true,
      smtpSecure: false,
      smtpUser: 'account',
    });
  });

  it('rejects partial SMTP credentials', () => {
    expect(() =>
      validateEnvironment({
        ...baseEnvironment,
        SMTP_HOST: 'mail.smtp2go.com',
      }),
    ).toThrow(
      'SMTP_HOST, SMTP_USER, and SMTP_PASSWORD must be configured together',
    );
  });

  it('requires an explicit persistent upload directory in production', () => {
    expect(() =>
      validateEnvironment({
        ...baseEnvironment,
        NODE_ENV: 'production',
        PUBLIC_SITE_EMAIL: 'admin@example.org',
        SMTP_FROM: 'AMIR Lab <noreply@example.org>',
        SMTP_HOST: 'mail.smtp2go.com',
        SMTP_PASSWORD: 'secret',
        SMTP_USER: 'account',
      }),
    ).toThrow('UPLOAD_ROOT is required for local storage in production');
  });

  it('rejects production placeholders even when they are non-empty', () => {
    expect(() =>
      validateEnvironment({
        ...baseEnvironment,
        NODE_ENV: 'production',
        UPLOAD_ROOT: '/var/lib/amirlab/uploads',
        PUBLIC_SITE_EMAIL: 'admin@example.org',
        SMTP_FROM: 'AMIR Lab <noreply@example.org>',
        SMTP_HOST: 'mail.smtp2go.com',
        SMTP_PASSWORD: 'UPDATE_ON_PROD',
        SMTP_USER: 'real-user',
      }),
    ).toThrow('SMTP_PASSWORD contains a production placeholder');
  });

  it('requires the production SMTP sender to come from the environment', () => {
    expect(() =>
      validateEnvironment({
        ...baseEnvironment,
        NODE_ENV: 'production',
        UPLOAD_ROOT: '/var/lib/amirlab/uploads',
        PUBLIC_SITE_EMAIL: 'admin@example.org',
        SMTP_HOST: 'smtp.example.net',
        SMTP_PASSWORD: 'real-password',
        SMTP_USER: 'real-user',
      }),
    ).toThrow('SMTP_FROM is required in production');
  });
});
