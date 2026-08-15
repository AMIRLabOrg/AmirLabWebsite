jest.mock('../../generated/prisma/client', () => ({
  AccountStatus: { ACTIVE: 'ACTIVE' },
  PrismaClient: class PrismaClient {},
}));

import { csrfTokenForSession } from './csrf';
import { SessionAuthGuard } from './session-auth.guard';

const sessionToken = 'persistent-session-token';
const user = {
  email: 'admin@amirl.local',
  id: 'user-id',
  person: null,
  role: 'ADMIN',
  status: 'ACTIVE',
};

function context(method: string, csrfToken?: string) {
  const request = {
    cookies: { amirl_session: sessionToken },
    header: (name: string) => (name === 'x-csrf-token' ? csrfToken : undefined),
    method,
  };
  return {
    executionContext: {
      getClass: () => class TestController {},
      getHandler: () => function handler() {},
      switchToHttp: () => ({ getRequest: () => request }),
    },
    request,
  };
}

function guard() {
  return new SessionAuthGuard(
    { getAllAndOverride: () => false } as never,
    { get: () => 'amirl_session' } as never,
    {
      session: {
        findUnique: jest.fn().mockResolvedValue({
          csrfTokenHash: 'token-created-before-recovery-was-supported',
          expiresAt: new Date(Date.now() + 60_000),
          revokedAt: null,
          user,
        }),
      },
    } as never,
  );
}

describe('SessionAuthGuard CSRF recovery', () => {
  it('accepts the recoverable token for an existing session', async () => {
    const { executionContext, request } = context(
      'POST',
      csrfTokenForSession(sessionToken),
    );

    await expect(guard().canActivate(executionContext as never)).resolves.toBe(
      true,
    );
    expect(request).toHaveProperty('user', user);
  });

  it('still rejects a mutation without a CSRF token', async () => {
    const { executionContext } = context('PATCH');

    await expect(
      guard().canActivate(executionContext as never),
    ).rejects.toThrow('CSRF token required');
  });

  it('still rejects a mutation with the wrong token', async () => {
    const { executionContext } = context('POST', 'wrong-token');

    await expect(
      guard().canActivate(executionContext as never),
    ).rejects.toThrow('CSRF token is invalid');
  });
});
