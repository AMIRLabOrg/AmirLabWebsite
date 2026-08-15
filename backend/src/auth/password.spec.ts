import { hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  it('verifies the original password without storing it', async () => {
    const hash = await hashPassword('correct horse battery staple');

    expect(hash).not.toContain('correct horse battery staple');
    await expect(
      verifyPassword('correct horse battery staple', hash),
    ).resolves.toBe(true);
    await expect(verifyPassword('wrong password value', hash)).resolves.toBe(
      false,
    );
  });

  it('rejects unsupported or malformed hashes', async () => {
    await expect(verifyPassword('any password value', 'invalid')).resolves.toBe(
      false,
    );
  });
});
