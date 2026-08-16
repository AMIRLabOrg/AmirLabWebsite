import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  AccountStatus,
  AssetKind,
  ContributorMatchStatus,
  PositionStatus,
  PlatformRole,
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
    const expectedProjects = seed.projects.filter((item) => item.title).length;
    const expectedMemberships = seed.departments.reduce(
      (sum, item) => sum + item.memberships.length,
      0,
    );
    const expectedProposedMatches = seed.papers.reduce(
      (sum, paper) => sum + paper.contributorSourceIds.length,
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
      adminProfile,
      seededSourceSnapshots,
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
      prisma.position.count({ where: { status: { not: PositionStatus.DRAFT } } }),
      prisma.asset.findMany({ where: { kind: AssetKind.AVATAR } }),
      prisma.siteSetting.findMany({ select: { key: true } }),
      prisma.personDepartment.count(),
      prisma.person.findFirst({
        where: { user: { is: { role: PlatformRole.ADMIN } } },
        select: { publicEmail: true, user: { select: { email: true } } },
      }),
      prisma.researchSourceSnapshot.count(),
    ]);

    expect('imported people identity records', importedPeople, seed.people.length);
    expect('registered imported accounts', importedAccounts, seed.people.length);
    expect('profile requests awaiting manual review', pendingProfiles, seed.people.length);
    expect('imported people published before review', publishedImportedPeople, 0);
    expect(
      'published departments',
      departments,
      seed.departments.filter((department) => department.isPublished).length,
    );
    expect('papers', papers, seed.papers.length);
    expect('papers awaiting manual review', pendingPapers, seed.papers.length);
    expect('papers published before review', publishedPapers, 0);
    expect('contributors directly linked before verification', directContributorLinks, 0);
    expect('proposed contributor identity matches', proposedMatches, expectedProposedMatches);
    expect('projects', projects, expectedProjects);
    expect('project imports awaiting review', pendingProjectChanges, expectedProjects);
    expect('positions', positions, seed.positions.length);
    expect('imported positions opened without manual decision', nonDraftPositions, 0);
    expect('department memberships', departmentMemberships, expectedMemberships);
    expect('avatar assets staged for profile review', avatars.length, expectedAvatars);
    if (!adminProfile?.user?.email || adminProfile.publicEmail !== adminProfile.user.email) {
      throw new Error('Admin public profile email must match the administrator login email');
    }
    console.log(`[verify] admin profile email: ${adminProfile.publicEmail}`);
    expect('source checks staged without a discovery job', seededSourceSnapshots, 0);

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
    expect('imported avatars published before profile approval', liveAvatarLinks, 0);

    const stagedAvatarLinks = await prisma.profileEditRequest.count({
      where: {
        person: { legacySourceId: { not: null } },
        avatarAssetId: { not: null },
      },
    });
    expect('profile requests with staged avatar', stagedAvatarLinks, expectedAvatars);

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

    console.log('[verify] Canonical import is staged for manual review.');
    console.log('[verify] Registered people are available to internal workflows.');
    console.log('[verify] Paper contributor relationships remain proposed until reviewed.');
    console.log('[verify] All imported avatar files exist under storage/peoples.');
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
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
