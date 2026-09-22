export interface SeedAdminCredentials {
  email: string;
  fullName: string;
  password: string;
}

export function seedAdminCredentials(
  source: Record<string, string | undefined> = process.env,
): SeedAdminCredentials {
  const email = (source.ADMIN_EMAIL ?? '').trim().toLowerCase();
  const fullName = (source.ADMIN_NAME ?? '').trim();
  const password = source.ADMIN_PASSWORD ?? '';

  if (!email || !fullName || !password) {
    throw new Error(
      'Seed requires ADMIN_EMAIL, ADMIN_NAME, and ADMIN_PASSWORD',
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('ADMIN_EMAIL must be a valid email address');
  }
  if (password.length < 12) {
    throw new Error('ADMIN_PASSWORD must be at least 12 characters');
  }
  if (
    /update[_-]?on[_-]?prod|replace[_-]?with|change[_-]?me|dummy|example/i.test(
      password,
    )
  ) {
    throw new Error('ADMIN_PASSWORD contains a placeholder');
  }

  return { email, fullName, password };
}
