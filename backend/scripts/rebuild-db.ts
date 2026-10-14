import {
  parseProfilePayload,
  profileUpdateData,
} from '../src/profiles/profile-payload';
import { mkdir, rm } from 'node:fs/promises';
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
  peopleStorageRoot,
  required,
  seedDocuments,
  seedSiteSettings,
  signatureStorageRoot,
  stableSlug,
  watermarkStorageRoot,
} from './seed-writers';
import {
  missingSeedAvatarFiles,
  missingSeedUniversityLogoFiles,
  readSeedData,
} from './seed-data';

export async function rebuildDatabase() {
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
    const nonEmpty = await Promise.all([
      prisma.user.count(),
      prisma.person.count(),
      prisma.department.count(),
      prisma.researchItem.count(),
      prisma.position.count(),
      prisma.asset.count(),
      prisma.siteSetting.count(),
      prisma.university.count(),
    ]);
    if (nonEmpty.some((count) => count > 0)) {
      throw new Error(
        'Database is not empty. Use `pnpm run db:rebuild` for a destructive rebuild, or reset the schema before running `pnpm run db:seed`.',
      );
    }

    const {
      email: adminEmail,
      fullName: adminName,
      password: adminPassword,
    } = getAdminCredentials();

    await rm(peopleStorageRoot, { recursive: true, force: true });
    await rm(signatureStorageRoot, { recursive: true, force: true });
    await rm(watermarkStorageRoot, { recursive: true, force: true });
    await mkdir(peopleStorageRoot, { recursive: true });

    const passwordHash = await hashPassword(adminPassword);
    const admin = await prisma.user.create({
      data: {
        activatedAt: new Date(),
        email: adminEmail,
        passwordHash,
        passwordSetAt: new Date(),
        role: PlatformRole.ADMIN,
        isSystemAccount: true,
        status: AccountStatus.ACTIVE,
      },
    });
    await prisma.person.create({
      data: {
        fullName: adminName,
        headline: 'Research operations administrator',
        isPublished: false,
        roleTitle: 'Lab Administrator',
        slug: 'amirlab-administrator',
        userId: admin.id,
      },
    });

    await seedSiteSettings(prisma, data);

    const departmentIdBySource = new Map<string, string>();
    for (const department of data.departments) {
      const created = await prisma.department.create({
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
      departmentIdBySource.set(department.sourceId, created.id);
    }

    const personIdBySource = new Map<string, string>();
    const usedAccountEmails = new Set<string>([adminEmail]);
    let importedAvatars = 0;

    for (const person of data.people) {
      const candidateEmail = person.email?.trim().toLowerCase() || null;
      const accountEmail =
        candidateEmail && !usedAccountEmails.has(candidateEmail)
          ? candidateEmail
          : null;
      if (accountEmail) usedAccountEmails.add(accountEmail);

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
            admin.id,
          )
        : null;
      if (avatarAssetId) importedAvatars += 1;

      const created = await prisma.person.create({
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
        await ensureOpenAlexArtifacts(prisma, created.id, person);
      }

      await prisma.person.update({
        where: { id: created.id },
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

      personIdBySource.set(person.sourceId, created.id);
    }

    const defaultApprover = data.people.find((person) =>
      person.roleTitle?.toLowerCase().includes('director'),
    );
    await seedDocuments(
      prisma,
      admin.id,
      defaultApprover
        ? (personIdBySource.get(defaultApprover.sourceId) ?? null)
        : null,
    );

    for (const university of data.universities) {
      const logoAssetId = await createUniversityLogoAsset(
        prisma,
        university,
        admin.id,
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
          submittedById: admin.id,
        },
      });
    }

    for (const position of data.positions) {
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
    }

    for (const person of data.people) {
      const personId = required(
        personIdBySource.get(person.sourceId),
        `Missing person ${person.sourceId}`,
      );
      await prisma.personMetric.create({
        data: {
          personId,
          publishedPaperCount: 0,
        },
      });
    }

    console.log('[db] Canonical AMIR Lab dataset imported.');
    console.log(`[db] People: ${data.people.length}`);
    console.log(`[db] People images imported: ${importedAvatars}`);
    console.log(`[db] Departments: ${data.departments.length}`);
    console.log(`[db] Academic partners: ${data.universities.length}`);
    console.log('[db] Papers and datasets: imported by OpenAlex author sync.');
    console.log(`[db] Projects: ${data.projects.length}`);
    console.log(`[db] Positions: ${data.positions.length}`);
    console.log(`[db] Admin login: ${adminEmail}`);
    console.log(
      '[db] Run `pnpm run db:verify` to verify database and storage integrity.',
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (
  process.argv[1] &&
  ['rebuild-db.ts', 'rebuild-db.js'].includes(
    process.argv[1].split('/').pop() ?? '',
  )
) {
  void rebuildDatabase().catch((error) => {
    console.error(
      error instanceof Error ? (error.stack ?? error.message) : String(error),
    );
    process.exitCode = 1;
  });
}
