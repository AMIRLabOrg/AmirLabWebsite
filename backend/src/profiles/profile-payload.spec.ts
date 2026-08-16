import { BadRequestException } from '@nestjs/common';
import {
  PersonLinkType,
  PersonSectionType,
} from '../../generated/prisma/enums';
import { parseProfilePayload } from './profile-payload';

const profile = {
  fullName: 'Jane Researcher',
  headline: 'Research Assistant',
  biography: 'Works on machine learning systems.',
  publicEmail: 'Jane@Example.org',
  phone: null,
  contactAddress: null,
  expertise: ['Machine learning'],
  links: [
    {
      type: PersonLinkType.WEBSITE,
      label: 'Website',
      url: 'https://example.org/profile',
    },
  ],
  sections: [
    {
      type: PersonSectionType.ACADEMIC_BACKGROUND,
      title: 'Education',
      subsections: [
        {
          heading: 'Degrees',
          entries: [{ label: 'Degree', content: 'B.Sc. in Computer Science' }],
        },
      ],
    },
  ],
};

describe('parseProfilePayload', () => {
  it('normalizes editable profile fields and keeps image intent separate', () => {
    expect(parseProfilePayload(JSON.stringify(profile), true)).toEqual({
      ...profile,
      publicEmail: 'jane@example.org',
      links: [{ ...profile.links[0], url: 'https://example.org/profile' }],
      removeAvatar: true,
    });
  });

  it('normalizes legacy string profile entries to labeled entry records', () => {
    const legacy = {
      ...profile,
      sections: [
        {
          ...profile.sections[0],
          subsections: [{ heading: null, entries: ['Legacy profile detail'] }],
        },
      ],
    };
    expect(
      parseProfilePayload(legacy).sections[0].subsections[0].entries,
    ).toEqual([{ label: null, content: 'Legacy profile detail' }]);
  });

  it('round-trips the internal removal flag for reviewer approval', () => {
    expect(parseProfilePayload({ ...profile, removeAvatar: true })).toEqual({
      ...profile,
      publicEmail: 'jane@example.org',
      links: [{ ...profile.links[0], url: 'https://example.org/profile' }],
      removeAvatar: true,
    });
  });

  it('rejects rank and role overposting', () => {
    expect(() =>
      parseProfilePayload(JSON.stringify({ ...profile, rank: 'ADVISOR' })),
    ).toThrow(BadRequestException);
    expect(() =>
      parseProfilePayload(
        JSON.stringify({ ...profile, roleTitle: 'Principal Investigator' }),
      ),
    ).toThrow(BadRequestException);
  });

  it('accepts public role titles only for admin profile updates', () => {
    expect(
      parseProfilePayload(
        JSON.stringify({ ...profile, roleTitle: 'Principal Investigator' }),
        false,
        { adminFields: true },
      ).roleTitle,
    ).toBe('Principal Investigator');
  });

  it('accepts only contact identity fields for moderator profiles', () => {
    expect(
      parseProfilePayload(
        JSON.stringify({
          contactAddress: 'Lab office',
          fullName: 'Lab Moderator',
          phone: '+880 1000 000000',
        }),
        false,
        { scope: 'MODERATOR' },
      ),
    ).toEqual({
      biography: null,
      contactAddress: 'Lab office',
      expertise: [],
      fullName: 'Lab Moderator',
      headline: null,
      links: [],
      phone: '+880 1000 000000',
      publicEmail: null,
      removeAvatar: false,
      sections: [],
    });
  });

  it('rejects researcher-only fields for moderator profiles', () => {
    expect(() =>
      parseProfilePayload(
        JSON.stringify({
          fullName: 'Lab Moderator',
          expertise: ['Machine learning'],
        }),
        false,
        { scope: 'MODERATOR' },
      ),
    ).toThrow('profile.expertise cannot be edited');
  });

  it('accepts only identity fields for administrator profiles', () => {
    expect(
      parseProfilePayload(
        JSON.stringify({
          fullName: 'Administrator',
          publicEmail: 'Admin@Example.org',
        }),
        true,
        { scope: 'ADMIN' },
      ),
    ).toEqual(
      expect.objectContaining({
        fullName: 'Administrator',
        publicEmail: 'admin@example.org',
        removeAvatar: true,
      }),
    );
    expect(() =>
      parseProfilePayload(
        JSON.stringify({
          fullName: 'Administrator',
          expertise: ['Operations'],
        }),
        false,
        { scope: 'ADMIN' },
      ),
    ).toThrow('profile.expertise cannot be edited');
  });

  it('rejects executable or non-web profile links', () => {
    expect(() =>
      parseProfilePayload(
        JSON.stringify({
          ...profile,
          links: [
            {
              type: PersonLinkType.WEBSITE,
              label: 'Unsafe',
              url: 'javascript:alert(1)',
            },
          ],
        }),
      ),
    ).toThrow('must use HTTP or HTTPS');
  });
});
