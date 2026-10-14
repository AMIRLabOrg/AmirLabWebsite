import { normalizeAuthorId } from '../research/openalex-client';
import { BadRequestException } from '@nestjs/common';
import {
  PersonLinkType,
  PersonSectionType,
} from '../../generated/prisma/enums';
import type { Prisma } from '../../generated/prisma/client';
import type { ProfileEditPayload } from './dto/profile.dto';

const PROFILE_FIELDS = new Set([
  'fullName',
  'headline',
  'biography',
  'phone',
  'contactAddress',
  'expertise',
  'links',
  'sections',
  'removeAvatar',
  'openAlexAuthorId',
]);
const ADMIN_PROFILE_FIELDS = new Set([...PROFILE_FIELDS, 'roleTitle']);
const STAFF_PROFILE_FIELDS = new Set([
  'fullName',
  'roleTitle',
  'phone',
  'contactAddress',
  'removeAvatar',
]);
export type ProfileEditScope = 'ADMIN' | 'RESEARCH' | 'MODERATOR';

export function parseProfilePayload(
  raw: unknown,
  removeAvatar = false,
  opts?: { adminFields?: boolean; scope?: ProfileEditScope },
): ProfileEditPayload {
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      throw new BadRequestException('profile must be valid JSON');
    }
  }
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    throw new BadRequestException('profile must be a JSON object');
  }

  const source = value as Record<string, unknown>;
  if (typeof raw === 'string' && 'removeAvatar' in source) {
    throw new BadRequestException(
      'Profile image removal must use the removeAvatar form field',
    );
  }
  const scope = opts?.scope ?? 'RESEARCH';
  const editableFields =
    scope === 'MODERATOR' || scope === 'ADMIN'
      ? STAFF_PROFILE_FIELDS
      : opts?.adminFields
        ? ADMIN_PROFILE_FIELDS
        : PROFILE_FIELDS;
  const unsupported = Object.keys(source).find((key) => {
    if (editableFields.has(key)) return false;
    // Stored drafts include empty research fields from profilePayloadToJson.
    // Accept only that normalized shape, never research fields in submissions.
    if (
      typeof raw !== 'string' &&
      (scope === 'MODERATOR' || scope === 'ADMIN')
    ) {
      if (key === 'biography' || key === 'headline')
        return source[key] !== null;
      if (key === 'expertise' || key === 'links' || key === 'sections') {
        const value = source[key];
        return !Array.isArray(value) || value.length !== 0;
      }
    }
    return true;
  });
  if (unsupported) {
    throw new BadRequestException(`profile.${unsupported} cannot be edited`);
  }

  if (scope === 'MODERATOR' || scope === 'ADMIN') {
    return {
      fullName: requiredText(source.fullName, 'fullName', 2, 120),
      headline: null,
      biography: null,
      roleTitle: optionalText(source.roleTitle, 'roleTitle', 200),
      phone: optionalText(source.phone, 'phone', 80),
      contactAddress: optionalText(
        source.contactAddress,
        'contactAddress',
        2_000,
      ),
      expertise: [],
      links: [],
      sections: [],
      removeAvatar:
        typeof raw === 'string' ? removeAvatar : source.removeAvatar === true,
    };
  }

  const parsedLinks = links(source.links);
  const legacyOpenAlex = parsedLinks.find(
    ({ type }) => type === PersonLinkType.OPENALEX,
  );
  const hasOpenAlexField = Object.prototype.hasOwnProperty.call(
    source,
    'openAlexAuthorId',
  );
  const openAlexAuthorId = hasOpenAlexField
    ? openAlexId(source.openAlexAuthorId)
    : legacyOpenAlex
      ? normalizeAuthorId(legacyOpenAlex.url)
      : undefined;
  return {
    ...(openAlexAuthorId !== undefined ? { openAlexAuthorId } : {}),
    fullName: requiredText(source.fullName, 'fullName', 2, 120),
    headline: optionalText(source.headline, 'headline', 300),
    biography: optionalText(source.biography, 'biography', 8_000),
    phone: optionalText(source.phone, 'phone', 80),
    contactAddress: optionalText(
      source.contactAddress,
      'contactAddress',
      2_000,
    ),
    ...(opts?.adminFields
      ? { roleTitle: optionalText(source.roleTitle, 'roleTitle', 200) }
      : {}),
    expertise: stringArray(source.expertise, 'expertise', 20, 120),
    links: parsedLinks.filter(({ type }) => type !== PersonLinkType.OPENALEX),
    sections: sections(source.sections),
    removeAvatar:
      typeof raw === 'string' ? removeAvatar : source.removeAvatar === true,
  };
}

export function profilePayloadToJson(
  payload: ProfileEditPayload,
): Prisma.InputJsonObject {
  return {
    ...(payload.openAlexAuthorId !== undefined
      ? { openAlexAuthorId: payload.openAlexAuthorId }
      : {}),
    fullName: payload.fullName,
    headline: payload.headline,
    biography: payload.biography,
    phone: payload.phone,
    contactAddress: payload.contactAddress,
    ...(payload.roleTitle !== undefined
      ? { roleTitle: payload.roleTitle }
      : {}),
    expertise: payload.expertise,
    links: payload.links.map(({ label, type, url }) => ({ label, type, url })),
    sections: payload.sections.map(({ subsections, title, type }) => ({
      title,
      type,
      subsections: subsections.map(({ entries, heading }) => ({
        heading,
        entries: entries.map(({ content, label }) => ({ content, label })),
      })),
    })),
    removeAvatar: payload.removeAvatar,
  };
}

function requiredText(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
): string {
  if (typeof value !== 'string') {
    throw new BadRequestException(`profile.${field} must be text`);
  }
  const result = value.trim();
  if (result.length < minimum || result.length > maximum) {
    throw new BadRequestException(
      `profile.${field} must be ${minimum}-${maximum} characters`,
    );
  }
  return result;
}

function optionalText(
  value: unknown,
  field: string,
  maximum: number,
): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw new BadRequestException(`profile.${field} must be text or null`);
  }
  const result = value.trim();
  if (result.length > maximum) {
    throw new BadRequestException(
      `profile.${field} must not exceed ${maximum} characters`,
    );
  }
  return result || null;
}

function stringArray(
  value: unknown,
  field: string,
  maximumItems: number,
  maximumLength: number,
): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > maximumItems) {
    throw new BadRequestException(
      `profile.${field} must contain at most ${maximumItems} items`,
    );
  }
  return value.map((item, index) =>
    requiredText(item, `${field}[${index}]`, 1, maximumLength),
  );
}

function links(value: unknown): ProfileEditPayload['links'] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 20) {
    throw new BadRequestException(
      'profile.links must contain at most 20 items',
    );
  }
  let hasOpenAlex = false;
  return value.map((item, index) => {
    if (!item || Array.isArray(item) || typeof item !== 'object') {
      throw new BadRequestException(`profile.links[${index}] is invalid`);
    }
    const source = item as Record<string, unknown>;
    if (
      !Object.values(PersonLinkType).includes(source.type as PersonLinkType)
    ) {
      throw new BadRequestException(`profile.links[${index}].type is invalid`);
    }
    let url = requiredText(source.url, `links[${index}].url`, 1, 2_000);
    if (source.type === PersonLinkType.OPENALEX) {
      if (hasOpenAlex)
        throw new BadRequestException(
          'Use one OpenAlex author link per profile.',
        );
      hasOpenAlex = true;
      url = `https://openalex.org/authors/${normalizeAuthorId(url)}`;
    }
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestException(`profile.links[${index}].url is invalid`);
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new BadRequestException(
        `profile.links[${index}].url must use HTTP or HTTPS`,
      );
    }
    return {
      type: source.type as PersonLinkType,
      label: requiredText(source.label, `links[${index}].label`, 1, 120),
      url: parsed.toString(),
    };
  });
}

function openAlexId(value: unknown): string | null {
  if (value === null || value === '') return null;
  if (typeof value !== 'string')
    throw new BadRequestException(
      'profile.openAlexAuthorId must be an OpenAlex author ID or null',
    );
  return normalizeAuthorId(value);
}

function sections(value: unknown): ProfileEditPayload['sections'] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 30) {
    throw new BadRequestException(
      'profile.sections must contain at most 30 items',
    );
  }
  return value.map((item, index) => {
    if (!item || Array.isArray(item) || typeof item !== 'object') {
      throw new BadRequestException(`profile.sections[${index}] is invalid`);
    }
    const source = item as Record<string, unknown>;
    if (
      !Object.values(PersonSectionType).includes(
        source.type as PersonSectionType,
      )
    ) {
      throw new BadRequestException(
        `profile.sections[${index}].type is invalid`,
      );
    }
    const type = source.type as PersonSectionType;
    const title = requiredText(
      source.title,
      `sections[${index}].title`,
      1,
      160,
    );
    if (
      type === PersonSectionType.PUBLICATIONS ||
      /\b(publications?|papers?|datasets?|research outputs?)\b/i.test(title)
    )
      throw new BadRequestException(
        'Published papers and datasets come from OpenAlex and cannot be entered manually.',
      );
    return {
      type,
      title,
      subsections: subsections(
        source.subsections,
        `sections[${index}].subsections`,
      ),
    };
  });
}

function profileEntries(
  value: unknown,
  field: string,
): ProfileEditPayload['sections'][number]['subsections'][number]['entries'] {
  if (!Array.isArray(value) || value.length > 200) {
    throw new BadRequestException(`${field} must contain at most 200 items`);
  }
  return value.map((item, index) => {
    // Legacy profile payloads and seed records used plain strings. Accept them
    // at the boundary and normalize them into the entry object shape.
    if (typeof item === 'string') {
      return {
        label: null,
        content: requiredText(item, `${field}[${index}].content`, 1, 20_000),
      };
    }
    if (!item || Array.isArray(item) || typeof item !== 'object') {
      throw new BadRequestException(`${field}[${index}] is invalid`);
    }
    const source = item as Record<string, unknown>;
    return {
      label: optionalText(source.label, `${field}[${index}].label`, 160),
      content: requiredText(
        source.content,
        `${field}[${index}].content`,
        1,
        20_000,
      ),
    };
  });
}

function subsections(
  value: unknown,
  field: string,
): ProfileEditPayload['sections'][number]['subsections'] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 30) {
    throw new BadRequestException(`${field} must contain 1-30 items`);
  }
  return value.map((item, index) => {
    if (!item || Array.isArray(item) || typeof item !== 'object') {
      throw new BadRequestException(`${field}[${index}] is invalid`);
    }
    const source = item as Record<string, unknown>;
    const entries = profileEntries(
      source.entries,
      `${field}[${index}].entries`,
    );
    if (!entries.length) {
      throw new BadRequestException(`${field}[${index}].entries is required`);
    }
    return {
      heading: optionalText(source.heading, `${field}[${index}].heading`, 160),
      entries,
    };
  });
}

export function profileUpdateData(
  payload: ReturnType<typeof parseProfilePayload>,
  avatarId: string | null | undefined,
  scope: ProfileEditScope,
): Prisma.PersonUncheckedUpdateInput {
  if (scope === 'MODERATOR' || scope === 'ADMIN') {
    return {
      avatarId,
      contactAddress: payload.contactAddress,
      fullName: payload.fullName,
      phone: payload.phone,
      roleTitle: payload.roleTitle,
    };
  }
  return {
    avatarId,
    biography: payload.biography,
    contactAddress: payload.contactAddress,
    expertise: payload.expertise,
    fullName: payload.fullName,
    headline: payload.headline,
    links: {
      deleteMany: {},
      create: payload.links.map((link, sortOrder) => ({ ...link, sortOrder })),
    },
    phone: payload.phone,
    profileSections: {
      deleteMany: {},
      create: payload.sections.map((section, sortOrder) => ({
        type: section.type,
        title: section.title,
        sortOrder,
        subsections: {
          create: section.subsections.map(
            (subsection, subsectionSortOrder) => ({
              heading: subsection.heading,
              sortOrder: subsectionSortOrder,
              entries: {
                create: subsection.entries.map((entry, entrySortOrder) => ({
                  ...entry,
                  sortOrder: entrySortOrder,
                })),
              },
            }),
          ),
        },
      })),
    },
    ...(payload.roleTitle !== undefined
      ? { roleTitle: payload.roleTitle }
      : {}),
  };
}
