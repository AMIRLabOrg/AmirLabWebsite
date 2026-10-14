import {
  parseProfilePayload,
  profileUpdateData,
} from '../src/profiles/profile-payload';
import {
  AcademicRank,
  AccountStatus,
  DepartmentRole,
  EngagementType,
  PlatformRole,
  ProjectChangeKind,
  PositionStatus,
  PositionType,
  ProjectStatus,
  ResearchItemType,
  ReviewStatus,
} from '../generated/prisma/client';
import { hashPassword } from '../src/auth/password';
import { createCliPrisma } from './prisma';
import {
  createAvatarAsset,
  createUniversityLogoAsset,
  ensureOpenAlexArtifacts,
  enumValue,
  getAdminCredentials,
  required,
  seedDocuments,
  seedSiteSettings,
  stableSlug,
} from './seed-writers';
import {
  missingSeedAvatarFiles,
  missingSeedUniversityLogoFiles,
  readSeedData,
} from './seed-data';

type PrismaClient = ReturnType<typeof createCliPrisma>;

const counters = {
  created: [] as string[],
  skipped: [] as string[],
};

function created(label: string) {
  counters.created.push(label);
}

function skipped(label: string) {
  counters.skipped.push(label);
}

async function ensureAdmin(prisma: PrismaClient) {
  const existing = await prisma.person.findUnique({
    where: { slug: 'amirlab-administrator' },
  });
  if (existing) {
    const ownerUserId =
      existing.userId ??
      (
        await prisma.user.findFirst({
          where: { role: PlatformRole.ADMIN, isSystemAccount: true },
          select: { id: true },
        })
      )?.id ??
      null;
    if (!ownerUserId) {
      throw new Error(
        'Administrator account is missing; cannot attribute seeded records.',
      );
    }
    skipped('administrator (already present)');
    return { userId: ownerUserId, personId: existing.id };
  }

  const { email, fullName, password } = getAdminCredentials();
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      activatedAt: new Date(),
      email,
      passwordHash,
      passwordSetAt: new Date(),
      role: PlatformRole.ADMIN,
      isSystemAccount: true,
      status: AccountStatus.ACTIVE,
    },
  });
  const person = await prisma.person.create({
    data: {
      fullName,
      headline: 'Research operations administrator',
      isPublished: false,
      roleTitle: 'Lab Administrator',
      slug: 'amirlab-administrator',
      userId: user.id,
    },
  });
  created('administrator');
  return { userId: user.id, personId: person.id };
}

async function ensurePersonMetric(prisma: PrismaClient, personId: string) {
  const existing = await prisma.personMetric.findUnique({
    where: { personId },
  });
  if (existing) return;
  await prisma.personMetric.create({
    data: { personId, publishedPaperCount: 0 },
  });
}

async function seedDatabase() {
  const data = await readSeedData();
  const missingFiles = await missingSeedAvatarFiles(data);
  const missingUniversityLogos = await missingSeedUniversityLogoFiles(data);
  if (missingFiles.length || missingUniversityLogos.length) {
    throw new Error(
      `Seed references ${missingFiles.length} missing avatar file(s) and ${missingUniversityLogos.length} missing university logo file(s)`,
    );
  }

  const prisma = createCliPrisma();
  try {
    const admin = await ensureAdmin(prisma);

    const existingSettingKeys = new Set(
      (await prisma.siteSetting.findMany({ select: { key: true } })).map(
        (setting) => setting.key,
      ),
    );
    const createdSettings = await seedSiteSettings(
      prisma,
      data,
      existingSettingKeys,
    );
    if (createdSettings > 0) {
      created(`site settings (${createdSettings} missing key(s))`);
    } else {
      skipped('site settings');
    }

    const departmentIdBySource = new Map<string, string>();
    for (const department of data.departments) {
      const existing = await prisma.department.findUnique({
        where: { legacySourceId: department.sourceId },
      });
      if (existing) {
        departmentIdBySource.set(department.sourceId, existing.id);
        skipped(`department ${department.slug}`);
        continue;
      }
      const createdDepartment = await prisma.department.create({
        data: {
          abbreviation: department.abbreviation,
          description: department.description,
          isPublished: department.isPublished,
          legacySourceId: department.sourceId,
          legacyUrl: department.sourceUrl,
          name: department.name,
          slug: department.slug,
        },
      });
      departmentIdBySource.set(department.sourceId, createdDepartment.id);
      created(`department ${department.slug}`);
    }

    const existingAccountEmails = new Set(
      (await prisma.user.findMany({ select: { email: true } }))
        .map((account) => account.email)
        .filter((email): email is string => Boolean(email)),
    );

    const personIdBySource = new Map<string, string>();

    for (const person of data.people) {
      const existing = await prisma.person.findUnique({
        where: { legacySourceId: person.sourceId },
      });
      if (existing) {
        if (person.openAlexAuthorId) {
          await ensureOpenAlexArtifacts(prisma, existing.id, person);
        }
        await ensurePersonMetric(prisma, existing.id);
        personIdBySource.set(person.sourceId, existing.id);
        skipped(`person ${person.slug}`);
        continue;
      }

      const candidateEmail = person.email?.trim().toLowerCase() || null;
      const accountEmail =
        candidateEmail && !existingAccountEmails.has(candidateEmail)
          ? candidateEmail
          : null;
      if (accountEmail) existingAccountEmails.add(accountEmail);

      const account = await prisma.user.create({
        data: {
          email: accountEmail,
          role: PlatformRole.MEMBER,
          status: AccountStatus.PENDING_SETUP,
        },
      });

      const avatarAssetId = person.avatarSourceFile
        ? await createAvatarAsset(
            prisma,
            person.slug,
            person.avatarSourceFile,
            admin.userId,
          )
        : null;

      const createdPerson = await prisma.person.create({
        data: {
          appointedRank: enumValue(AcademicRank, person.appointedRank),
          fullName: person.fullName,
          isAlumni: person.isAlumni,
          isPublished: false,
          legacySourceId: person.sourceId,
          legacyUrl: person.sourceUrl,
          roleTitle: person.roleTitle,
          slug: person.slug,
          userId: account.id,
        },
      });

      if (person.openAlexAuthorId) {
        await ensureOpenAlexArtifacts(prisma, createdPerson.id, person);
      }

      await prisma.person.update({
        where: { id: createdPerson.id },
        data: {
          ...profileUpdateData(
            parseProfilePayload({
              fullName: person.fullName,
              headline: person.headline,
              biography: person.biography,
              phone: person.phone,
              contactAddress: person.contactAddress,
              expertise: person.expertise,
              openAlexAuthorId: person.openAlexAuthorId ?? null,
              links: person.links
                .filter(({ type }) => type !== 'OPENALEX')
                .map(({ label, type, url }) => ({ label, type, url })),
              sections: person.profileSections
                .filter((section) => section.type !== 'PUBLICATIONS')
                .map((section) => ({
                  type: section.type,
                  title: section.title,
                  subsections: section.subsections.map((subsection) => ({
                    heading: subsection.heading,
                    entries: subsection.entries.map((entry) => ({
                      label: entry.label,
                      content: entry.content,
                    })),
                  })),
                })),
              removeAvatar: false,
            }),
            avatarAssetId,
            'RESEARCH',
          ),
          isPublished: true,
        },
      });

      await ensurePersonMetric(prisma, createdPerson.id);
      personIdBySource.set(person.sourceId, createdPerson.id);
      created(`person ${person.slug}`);
    }

    const documentSettings = await prisma.documentSettings.findUnique({
      where: { id: 'documents' },
    });
    if (documentSettings) {
      skipped('document settings (already present)');
    } else {
      const defaultApprover = data.people.find((person) =>
        person.roleTitle?.toLowerCase().includes('director'),
      );
      await seedDocuments(
        prisma,
        admin.userId,
        defaultApprover
          ? (personIdBySource.get(defaultApprover.sourceId) ?? null)
          : null,
      );
      created('document settings');
    }

    for (const university of data.universities) {
      const existing = await prisma.university.findUnique({
        where: { slug: university.slug },
      });
      if (existing) {
        skipped(`university ${university.slug}`);
        continue;
      }
      const logoAssetId = await createUniversityLogoAsset(
        prisma,
        university,
        admin.userId,
      );
      await prisma.university.create({
        data: {
          isPublished: university.isPublished,
          logoAssetId,
          name: university.name,
          slug: university.slug,
          websiteUrl: university.websiteUrl,
        },
      });
      created(`university ${university.slug}`);
    }

    for (const department of data.departments) {
      const departmentId = required(
        departmentIdBySource.get(department.sourceId),
        `Missing department ${department.sourceId}`,
      );
      for (const [index, membership] of department.memberships.entries()) {
        const personId = required(
          personIdBySource.get(membership.personSourceId),
          `Missing person ${membership.personSourceId}`,
        );
        const existing = await prisma.personDepartment.findUnique({
          where: { personId_departmentId: { personId, departmentId } },
        });
        if (existing) continue;
        await prisma.personDepartment.create({
          data: {
            departmentId,
            isPrimary: index === 0 && membership.role === 'HEAD',
            personId,
            role:
              enumValue(DepartmentRole, membership.role) ??
              DepartmentRole.MEMBER,
            sortOrder: membership.sortOrder,
          },
        });
      }
    }

    for (const project of data.projects) {
      if (!project.title) continue;
      const existing = await prisma.researchItem.findUnique({
        where: { legacySourceId: project.sourceId },
      });
      if (existing) {
        skipped(`project ${project.sourceId}`);
        continue;
      }
      const item = await prisma.researchItem.create({
        data: {
          canonicalUrl: project.canonicalUrl,
          legacySourceId: project.sourceId,
          legacyUrl: project.sourceUrl,
          reviewStatus: ReviewStatus.DRAFT,
          slug: stableSlug(project.title, project.sourceId),
          title: project.title,
          type: ResearchItemType.PROJECT,
          project: {
            create: {
              objective: null,
              publicPageEnabled: false,
              status: enumValue(ProjectStatus, project.status),
            },
          },
        },
      });
      await prisma.projectChangeRequest.create({
        data: {
          baseVersion: 1,
          kind: ProjectChangeKind.DETAILS,
          payload: {
            endsAt: null,
            objective: project.objective,
            objectives: [],
            publicPageEnabled: project.publicPageEnabled,
            startsAt: null,
            status: enumValue(ProjectStatus, project.status),
            summary: project.summary,
            title: project.title,
          },
          projectId: item.id,
          submittedById: admin.userId,
        },
      });
      created(`project ${project.sourceId}`);
    }

    for (const position of data.positions) {
      const existing = await prisma.position.findUnique({
        where: { slug: position.slug },
      });
      if (existing) {
        skipped(`position ${position.slug}`);
        continue;
      }
      await prisma.position.create({
        data: {
          description: position.description,
          engagementType:
            enumValue(EngagementType, position.engagementType) ??
            EngagementType.FLEXIBLE,
          positionType:
            enumValue(PositionType, position.positionType) ??
            PositionType.OTHER,
          requirements: position.requirements,
          responsibilities: [],
          slug: position.slug,
          status: PositionStatus.DRAFT,
          summary: position.summary,
          targetRank: enumValue(AcademicRank, position.targetRank),
          title: position.title,
        },
      });
      created(`position ${position.slug}`);
    }

    console.log('[db] Canonical AMIR Lab dataset synced (additive).');
    console.log(`[db] Created: ${counters.created.length} record group(s)`);
    for (const label of counters.created) console.log(`[db]   + ${label}`);
    console.log(
      `[db] Already present: ${counters.skipped.length} record group(s)`,
    );
    console.log(
      '[db] Run `pnpm run db:verify` to verify the fresh seed state.',
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (
  process.argv[1] &&
  ['seed-db.ts', 'seed-db.js'].includes(process.argv[1].split('/').pop() ?? '')
) {
  void seedDatabase().catch((error) => {
    console.error(
      error instanceof Error ? (error.stack ?? error.message) : String(error),
    );
    process.exitCode = 1;
  });
}
