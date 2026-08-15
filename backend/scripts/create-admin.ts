import { AccountStatus, PlatformRole } from '../generated/prisma/client';
import { hashPassword, PASSWORD_MIN_LENGTH } from '../src/auth/password';
import { buildPersonSlug } from '../src/users/person-slug';
import { createCliPrisma } from './prisma';

async function main(): Promise<void> {
  const email = (process.argv[2] ?? process.env.ADMIN_EMAIL)
    ?.trim()
    .toLowerCase();
  const fullName = (process.argv[3] ?? process.env.ADMIN_NAME)?.trim();
  const password = process.argv[4] ?? process.env.ADMIN_PASSWORD;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(
      'Provide a valid email: pnpm admin:create admin@example.org "Admin Name" "A long password"',
    );
  }
  if (!password || password.length < PASSWORD_MIN_LENGTH) {
    throw new Error(
      `Provide a password with at least ${PASSWORD_MIN_LENGTH} characters as the third argument or ADMIN_PASSWORD`,
    );
  }

  const passwordHash = await hashPassword(password);

  const prisma = createCliPrisma();
  try {
    const user = await prisma.user.upsert({
      where: { email },
      create: {
        activatedAt: new Date(),
        email,
        passwordHash,
        passwordSetAt: new Date(),
        role: PlatformRole.ADMIN,
        status: AccountStatus.ACTIVE,
      },
      update: {
        activatedAt: new Date(),
        passwordHash,
        passwordSetAt: new Date(),
        role: PlatformRole.ADMIN,
        status: AccountStatus.ACTIVE,
      },
      include: { person: true },
    });

    if (fullName && !user.person) {
      await prisma.person.create({
        data: {
          fullName,
          isPublished: false,
          slug: buildPersonSlug(fullName, user.id),
          userId: user.id,
        },
      });
    }

    console.log(`Admin ready: ${email}`);
    console.log('Log in with the password supplied to this command.');
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
