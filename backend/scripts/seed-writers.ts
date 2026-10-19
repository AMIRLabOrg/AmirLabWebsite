import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import sharp from 'sharp';
import {
  AssetAccess,
  AssetKind,
  DocumentKind,
  Prisma,
} from '../generated/prisma/client';
import {
  DEFAULT_DOCUMENT_SITE,
  DEFAULT_DOCUMENT_TEMPLATES,
} from '../src/documents/documents.service';
import { createCliPrisma } from './prisma';
import { seedAdminCredentials } from './seed-credentials';
import {
  type AmirSeedData,
  type SeedPaper,
  type SeedPerson,
  type SeedUniversity,
  seedAssetRoot,
  universitySeedAssetRoot,
} from './seed-data';

export const uploadRoot = resolve(process.env.UPLOAD_ROOT ?? './storage');
export const peopleStorageRoot = resolve(uploadRoot, 'peoples');
export const signatureStorageRoot = resolve(uploadRoot, 'document-signatures');
export const watermarkStorageRoot = resolve(uploadRoot, 'document-watermarks');
export const signatureSeedPath = resolve(
  process.cwd(),
  'src/applications/brand/signature.svg',
);
export const watermarkSeedPath = resolve(
  process.cwd(),
  'src/applications/brand/Logo-high-res.png',
);

type PrismaClient = ReturnType<typeof createCliPrisma>;

let cachedAdminCredentials: ReturnType<typeof seedAdminCredentials> | null =
  null;

export function getAdminCredentials() {
  cachedAdminCredentials ??= seedAdminCredentials();
  return cachedAdminCredentials;
}

export async function ensureOpenAlexArtifacts(
  prisma: PrismaClient,
  personId: string,
  person: SeedPerson,
): Promise<boolean> {
  if (!person.openAlexAuthorId) return false;
  await prisma.$executeRawUnsafe(
    'CREATE SEQUENCE IF NOT EXISTS "OpenAlexObservationSequence"',
  );
  const existingProfile = await prisma.openAlexProfile.findUnique({
    where: { personId },
  });
  if (!existingProfile) {
    await prisma.openAlexProfile.create({
      data: {
        authorId: person.openAlexAuthorId,
        bindingVersion: 1,
        boundAt: new Date(),
        nextAttemptAt: new Date(),
        personId,
        status: 'QUEUED',
      },
    });
  }
  return true;
}

export async function createAvatarAsset(
  prisma: PrismaClient,
  slug: string,
  sourceFile: string,
  createdById?: string,
): Promise<string> {
  const source = await readFile(resolve(seedAssetRoot, sourceFile));
  const image = await sharp(source)
    .rotate()
    .resize(1_200, 1_200, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 86 })
    .toBuffer({ resolveWithObject: true });
  const checksum = createHash('sha256').update(image.data).digest('hex');
  return upsertAsset(prisma, {
    access: AssetAccess.PUBLIC,
    byteSize: image.data.length,
    checksum,
    createdById,
    data: image.data,
    height: image.info.height,
    kind: AssetKind.AVATAR,
    mimeType: 'image/webp',
    originalName: basename(sourceFile),
    storageKey: `peoples/${slug}-${checksum.slice(0, 12)}.webp`,
    width: image.info.width,
  });
}

export async function createUniversityLogoAsset(
  prisma: PrismaClient,
  university: SeedUniversity,
  createdById: string,
): Promise<string> {
  const source = await readFile(
    resolve(universitySeedAssetRoot, university.logoSourceFile),
  );
  const image = await sharp(source)
    .rotate()
    .resize({ height: 80, withoutEnlargement: true })
    .png({ quality: 90 })
    .toBuffer({ resolveWithObject: true });
  const checksum = createHash('sha256').update(image.data).digest('hex');
  return upsertAsset(prisma, {
    access: AssetAccess.PUBLIC,
    byteSize: image.data.length,
    checksum,
    createdById,
    data: image.data,
    height: image.info.height,
    kind: AssetKind.UNIVERSITY_LOGO,
    mimeType: 'image/png',
    originalName: basename(university.logoSourceFile),
    storageKey: `university-logos/${university.slug}-${checksum.slice(0, 12)}.png`,
    width: image.info.width,
  });
}

interface AssetInput {
  access: AssetAccess;
  byteSize: number;
  checksum: string;
  createdById?: string;
  data: Buffer;
  height: number;
  kind: AssetKind;
  mimeType: string;
  originalName: string;
  storageKey: string;
  width: number;
}

async function upsertAsset(
  prisma: PrismaClient,
  input: AssetInput,
): Promise<string> {
  const existing = await prisma.asset.findUnique({
    where: { storageKey: input.storageKey },
  });
  if (existing) return existing.id;
  const target = resolve(uploadRoot, input.storageKey);
  await mkdir(dirname(target), { recursive: true });
  try {
    await writeFile(target, input.data, { flag: 'wx' });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  }
  const asset = await prisma.asset.create({
    data: {
      access: input.access,
      byteSize: input.byteSize,
      checksum: input.checksum,
      createdById: input.createdById,
      height: input.height,
      kind: input.kind,
      mimeType: input.mimeType,
      originalName: input.originalName,
      storageKey: input.storageKey,
      width: input.width,
    },
  });
  return asset.id;
}

export async function seedFoundingMembers(
  prisma: PrismaClient,
  data: AmirSeedData,
  personIdBySource: Map<string, string>,
) {
  return prisma.foundingMember.createMany({
    data: data.foundingMembers.map((member) => ({
      personId: required(
        personIdBySource.get(member.personSourceId),
        `Missing founding member ${member.personSourceId}`,
      ),
      role: member.role,
    })),
    // Preserve existing designations, including a different selected founder.
    skipDuplicates: true,
  });
}

export async function seedSiteSettings(
  prisma: PrismaClient,
  data: AmirSeedData,
  existingKeys?: ReadonlySet<string>,
): Promise<number> {
  const values: Record<string, unknown> = {
    'page.home': data.site.home,
    'page.about': data.site.about,
    'site.vision': data.site.vision,
    'site.mission': data.site.mission,
    'site.why-amirlab': data.site.whyAmirLab,
    'site.contact': data.site.contact,
    'site.ethics-committee': data.site.ethicsCommittee,
    'site.administrative-units': data.site.administrativeUnits,
    'site.application-policy': data.site.applicationPolicy,
    'site.training-programs': data.site.trainingPrograms,
    'site.achievement': data.site.achievement,
    'seed.provenance': data.source,
  };
  let createdCount = 0;
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) continue;
    if (existingKeys?.has(key)) continue;
    await prisma.siteSetting.create({
      data: { key, value: toInputJsonValue(value) },
    });
    createdCount += 1;
  }
  return createdCount;
}

export async function seedDocuments(
  prisma: PrismaClient,
  createdById: string,
  approverPersonId: string | null,
): Promise<void> {
  const signatureAssetId = await createApprovalSignatureAsset(
    prisma,
    createdById,
  );
  const watermarkAssetId = await createDocumentWatermarkAsset(
    prisma,
    createdById,
  );
  const templates = [];
  for (const template of DEFAULT_DOCUMENT_TEMPLATES) {
    templates.push(
      await prisma.documentTemplate.create({
        data: {
          ...template,
          createdById,
          updatedById: createdById,
        },
      }),
    );
  }
  await prisma.documentSettings.create({
    data: {
      id: 'documents',
      approverPersonId,
      defaultOfferTemplateId:
        templates.find((template) => template.kind === DocumentKind.OFFER)
          ?.id ?? null,
      siteEmail: DEFAULT_DOCUMENT_SITE.email,
      siteLocation: DEFAULT_DOCUMENT_SITE.location,
      siteUrl: DEFAULT_DOCUMENT_SITE.url,
      signatureAssetId,
      watermarkAssetId,
    },
  });
}

async function createDocumentWatermarkAsset(
  prisma: PrismaClient,
  createdById: string,
): Promise<string | null> {
  const image = await renderBestEffort(
    watermarkSeedPath,
    () =>
      sharp(watermarkSeedPath, {
        animated: false,
        limitInputPixels: 40_000_000,
      })
        .resize(2_000, 2_000, { fit: 'inside', withoutEnlargement: true })
        .png({ compressionLevel: 9 })
        .toBuffer({ resolveWithObject: true }),
    '[db] Document watermark',
  );
  if (!image) return null;
  const checksum = createHash('sha256').update(image.data).digest('hex');
  return upsertAsset(prisma, {
    access: AssetAccess.PRIVATE,
    byteSize: image.data.length,
    checksum,
    createdById,
    data: image.data,
    height: image.info.height,
    kind: AssetKind.DOCUMENT_WATERMARK,
    mimeType: 'image/png',
    originalName: basename(watermarkSeedPath),
    storageKey: `document-watermarks/head-${checksum.slice(0, 12)}.png`,
    width: image.info.width,
  });
}

async function createApprovalSignatureAsset(
  prisma: PrismaClient,
  createdById: string,
): Promise<string | null> {
  const image = await renderBestEffort(
    signatureSeedPath,
    () =>
      sharp(signatureSeedPath, {
        animated: false,
        limitInputPixels: 40_000_000,
      })
        .resize(1_600, 800, { fit: 'inside', withoutEnlargement: true })
        .png({ compressionLevel: 9 })
        .toBuffer({ resolveWithObject: true }),
    '[db] Approval signature',
  );
  if (!image) return null;
  const checksum = createHash('sha256').update(image.data).digest('hex');
  return upsertAsset(prisma, {
    access: AssetAccess.PRIVATE,
    byteSize: image.data.length,
    checksum,
    createdById,
    data: image.data,
    height: image.info.height,
    kind: AssetKind.DOCUMENT_SIGNATURE,
    mimeType: 'image/png',
    originalName: basename(signatureSeedPath),
    storageKey: `document-signatures/approval-${checksum.slice(0, 12)}.png`,
    width: image.info.width,
  });
}

async function renderBestEffort(
  sourcePath: string,
  render: () => Promise<{ data: Buffer; info: sharp.OutputInfo }>,
  label: string,
): Promise<{ data: Buffer; info: sharp.OutputInfo } | null> {
  try {
    await readFile(sourcePath);
  } catch {
    console.warn(`${label} source is unavailable; continuing without it.`);
    return null;
  }
  try {
    return await render();
  } catch {
    console.warn(`${label} source is invalid; continuing without it.`);
    return null;
  }
}

export function paperSlug(paper: SeedPaper): string {
  return stableSlug(
    paper.title ?? paper.doi ?? `publication-${paper.year ?? 'undated'}`,
    paper.sourceId,
  );
}

export function stableSlug(label: string, stableKey: string): string {
  const readable = label
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 72);
  const suffix = createHash('sha1')
    .update(stableKey)
    .digest('hex')
    .slice(0, 10);
  return `${readable || 'research-record'}-${suffix}`;
}

export function enumValue<T extends Record<string, string>>(
  values: T,
  candidate: string | null | undefined,
): T[keyof T] | null {
  if (!candidate) return null;
  return Object.prototype.hasOwnProperty.call(values, candidate)
    ? (values[candidate] as T[keyof T])
    : null;
}

export function required<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new Error(message);
  return value;
}

export function toInputJsonValue(value: unknown): Prisma.InputJsonValue {
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('Seed JSON cannot contain non-finite numbers');
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) =>
      entry === null ? null : toInputJsonValue(entry),
    );
  }
  if (isJsonRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).flatMap(([key, entry]) =>
        entry === undefined
          ? []
          : [[key, entry === null ? null : toInputJsonValue(entry)]],
      ),
    );
  }
  throw new Error('Seed setting is not valid JSON');
}

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return !!value && !Array.isArray(value) && typeof value === 'object';
}
