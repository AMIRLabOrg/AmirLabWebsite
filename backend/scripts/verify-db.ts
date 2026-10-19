import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  AccountStatus,
  AssetKind,
  ContributorMatchStatus,
  PositionStatus,
  ProfileReviewStatus,
  ProjectChangeStatus,
  ResearchItemType,
  ReviewStatus,
} from '../generated/prisma/client';
import { createCliPrisma } from './prisma';
import { readSeedData } from './seed-data';

const uploadRoot = resolve(process.env.UPLOAD_ROOT ?? './storage');

async function main() {
  const seed = await readSeedData();
  const prisma = createCliPrisma();
  try {
    const foundingMembers = await prisma.foundingMember.findMany({
      include: { person: { select: { legacySourceId: true } } },
    });
    if (
      foundingMembers.length !== seed.foundingMembers.length ||
      seed.foundingMembers.some(
        (expected) =>
          !foundingMembers.some(
            (actual) =>
              actual.person.legacySourceId === expected.personSourceId &&
              actual.role === expected.role,
          ),
      )
    ) {
      throw new Error('Founding members do not match the canonical seed');
    }
    const expectedProjects = seed.projects.filter((item) => item.title).length;
    const expectedMemberships = seed.departments.reduce(
      (sum, item) => sum + item.memberships.length,
      0,
    );
    const expectedAvatars = seed.people.filter(
      (person) => person.avatarSourceFile,
    ).length;

    const [
      importedPeople,
      importedAccounts,
      pendingProfiles,
      publishedImportedPeople,
      departments,
      papers,
      pendingPapers,
      publishedPapers,
      directContributorLinks,
      proposedMatches,
      projects,
      pendingProjectChanges,
      positions,
      nonDraftPositions,
      avatars,
      siteSettings,
      departmentMemberships,
      seededSourceSnapshots,
      seededPaperProvenance,
    ] = await Promise.all([
      prisma.person.count({ where: { legacySourceId: { not: null } } }),
      prisma.user.count({
        where: {
          person: { is: { legacySourceId: { not: null } } },
          status: AccountStatus.PENDING_SETUP,
        },
      }),
      prisma.profileEditRequest.count({
        where: {
          person: { legacySourceId: { not: null } },
          status: ProfileReviewStatus.NEEDS_REVIEW,
        },
      }),
      prisma.person.count({
        where: { isPublished: true, legacySourceId: { not: null } },
      }),
      prisma.department.count({ where: { isPublished: true } }),
      prisma.researchItem.count({ where: { type: ResearchItemType.PAPER } }),
      prisma.researchItem.count({
        where: {
          type: ResearchItemType.PAPER,
          reviewStatus: ReviewStatus.NEEDS_REVIEW,
        },
      }),
      prisma.researchItem.count({
        where: {
          type: ResearchItemType.PAPER,
          reviewStatus: ReviewStatus.PUBLISHED,
        },
      }),
      prisma.researchContributor.count({ where: { personId: { not: null } } }),
      prisma.contributorMatch.count({
        where: { status: ContributorMatchStatus.PROPOSED },
      }),
      prisma.researchItem.count({ where: { type: ResearchItemType.PROJECT } }),
      prisma.projectChangeRequest.count({
        where: { status: ProjectChangeStatus.NEEDS_REVIEW },
      }),
      prisma.position.count(),
      prisma.position.count({
        where: { status: { not: PositionStatus.DRAFT } },
      }),
      prisma.asset.findMany({ where: { kind: AssetKind.AVATAR } }),
      prisma.siteSetting.findMany({ select: { key: true } }),
      prisma.personDepartment.count(),
      prisma.researchSourceSnapshot.count(),
      prisma.researchItem.findMany({
        where: {
          legacySourceId: { not: null },
          type: ResearchItemType.PAPER,
        },
        select: {
          legacySourceId: true,
          submittedById: true,
          submittedBy: {
            select: { person: { select: { legacySourceId: true } } },
          },
        },
      }),
    ]);

    expect(
      'imported people identity records',
      importedPeople,
      seed.people.length,
    );
    expect(
      'registered imported accounts',
      importedAccounts,
      seed.people.length,
    );
    expect('initial profile requests awaiting review', pendingProfiles, 0);
    expect(
      'published imported people',
      publishedImportedPeople,
      seed.people.length,
    );
    expect(
      'published departments',
      departments,
      seed.departments.filter((department) => department.isPublished).length,
    );
    expect('papers before author sync', papers, 0);
    expect('manual paper review entries', pendingPapers, 0);
    expect('papers published before review', publishedPapers, 0);
    expect(
      'contributors directly linked before verification',
      directContributorLinks,
      0,
    );
    expect('proposed contributor identity matches', proposedMatches, 0);
    expect('projects', projects, expectedProjects);
    expect(
      'project imports awaiting review',
      pendingProjectChanges,
      expectedProjects,
    );
    expect('positions', positions, seed.positions.length);
    expect(
      'imported positions opened without manual decision',
      nonDraftPositions,
      0,
    );
    expect(
      'department memberships',
      departmentMemberships,
      expectedMemberships,
    );
    expect('imported avatar assets', avatars.length, expectedAvatars);
    expect(
      'source checks staged without a discovery job',
      seededSourceSnapshots,
      0,
    );

    expect('legacy manual paper provenance', seededPaperProvenance.length, 0);
    expect(
      'known OpenAlex bindings',
      await prisma.openAlexProfile.count(),
      seed.people.filter((person) => person.openAlexAuthorId).length,
    );
    expect(
      'OpenAlex duplicated as profile links',
      await prisma.personLink.count({ where: { type: 'OPENALEX' } }),
      0,
    );

    const badAvatarKeys = avatars.filter(
      (asset) =>
        !asset.storageKey.startsWith('peoples/') ||
        !asset.storageKey.endsWith('.webp'),
    );
    if (badAvatarKeys.length) {
      throw new Error(
        `Found ${badAvatarKeys.length} avatar assets outside storage/peoples`,
      );
    }
    for (const asset of avatars) {
      const info = await stat(resolve(uploadRoot, asset.storageKey));
      if (!info.isFile() || info.size !== asset.byteSize) {
        throw new Error(`Avatar storage mismatch: ${asset.storageKey}`);
      }
    }

    const liveAvatarLinks = await prisma.person.count({
      where: { legacySourceId: { not: null }, avatarId: { not: null } },
    });
    expect('published imported avatars', liveAvatarLinks, expectedAvatars);

    const stagedAvatarLinks = await prisma.profileEditRequest.count({
      where: {
        person: { legacySourceId: { not: null } },
        avatarAssetId: { not: null },
      },
    });
    expect('initial profile requests with staged avatar', stagedAvatarLinks, 0);

    const requiredSettings = [
      'page.home',
      'page.about',
      'site.vision',
      'site.mission',
      'site.contact',
      'site.ethics-committee',
      'site.administrative-units',
      'site.training-programs',
      'site.achievement',
      'seed.provenance',
    ];
    const keys = new Set(siteSettings.map((setting) => setting.key));
    const missingSettings = requiredSettings.filter((key) => !keys.has(key));
    if (missingSettings.length) {
      throw new Error(`Missing site settings: ${missingSettings.join(', ')}`);
    }

    console.log(
      '[verify] Initial member profiles are published automatically; later edits use profile review.',
    );
    console.log(
      '[verify] Registered people are available to internal workflows.',
    );
    console.log(
      '[verify] Papers and datasets enter only through OpenAlex author sync.',
    );
    console.log(
      '[verify] All imported avatar files exist under storage/peoples.',
    );
  } finally {
    await prisma.$disconnect();
  }
}

function expect(label: string, actual: number, expected: number) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, found ${actual}`);
  }
  console.log(`[verify] ${label}: ${actual}`);
}

void main().catch((error) => {
  console.error(
    error instanceof Error ? (error.stack ?? error.message) : String(error),
  );
  process.exitCode = 1;
});
