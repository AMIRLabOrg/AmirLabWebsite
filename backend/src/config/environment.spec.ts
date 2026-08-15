import { validateEnvironment } from './environment';

const baseEnvironment = {
  DATABASE_URL: 'postgresql://localhost/amirl',
  FRONTEND_ORIGINS: 'http://localhost:3000',
};

describe('validateEnvironment', () => {
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
});
