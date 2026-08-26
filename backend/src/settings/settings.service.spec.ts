import { AcademicRank } from '../../generated/prisma/client';
import {
  DEFAULT_APPOINTMENT_LETTER_TEMPLATE,
  DEFAULT_RANK_POLICY,
  earnedRank,
  effectiveRank,
  validateAppointmentLetterTemplate,
} from './settings.service';
import { BadRequestException } from '@nestjs/common';
import { safePlaceholderValue } from '../applications/appointment-letters.service';

describe('research ranking policy', () => {
  it('requires papers and citations when Scholar data exists', () => {
    expect(earnedRank(20, 499, DEFAULT_RANK_POLICY)).toBe(
      AcademicRank.SENIOR_RESEARCHER,
    );
    expect(earnedRank(20, 500, DEFAULT_RANK_POLICY)).toBe(
      AcademicRank.LEAD_RESEARCHER,
    );
  });

  it('uses the paper threshold when no Scholar profile is available', () => {
    expect(earnedRank(3, null, DEFAULT_RANK_POLICY)).toBe(
      AcademicRank.SENIOR_RESEARCHER,
    );
  });

  it('keeps appointed and earned ranks separate and exposes the higher rank', () => {
    expect(
      effectiveRank(AcademicRank.ADVISOR, AcademicRank.LEAD_RESEARCHER),
    ).toBe(AcademicRank.ADVISOR);
    expect(
      effectiveRank(AcademicRank.RESEARCHER, AcademicRank.SENIOR_RESEARCHER),
    ).toBe(AcademicRank.SENIOR_RESEARCHER);
  });
});

describe('appointment letter template safety', () => {
  it('accepts the default allowlisted template', () => {
    expect(
      validateAppointmentLetterTemplate(DEFAULT_APPOINTMENT_LETTER_TEMPLATE),
    ).toMatchObject(DEFAULT_APPOINTMENT_LETTER_TEMPLATE);
  });

  it.each([
    ['<script>alert(1)</script>'],
    ['[Open this](https://example.org)'],
    ['{{unknown.value}}'],
    ['{{applicant.name'],
  ])('rejects unsupported template content: %s', (content) => {
    expect(() =>
      validateAppointmentLetterTemplate({
        ...DEFAULT_APPOINTMENT_LETTER_TEMPLATE,
        markdown: `${DEFAULT_APPOINTMENT_LETTER_TEMPLATE.markdown}\n${content}`,
      }),
    ).toThrow(BadRequestException);
  });

  it('requires responsibilities to be a standalone block', () => {
    expect(() =>
      validateAppointmentLetterTemplate({
        ...DEFAULT_APPOINTMENT_LETTER_TEMPLATE,
        markdown: DEFAULT_APPOINTMENT_LETTER_TEMPLATE.markdown.replace(
          '{{position.responsibilities}}',
          'Responsibilities: {{position.responsibilities}}',
        ),
      }),
    ).toThrow('responsibilities variable must be on its own line');
  });

  it('requires HTTPS and safe document metadata', () => {
    expect(() =>
      validateAppointmentLetterTemplate({
        ...DEFAULT_APPOINTMENT_LETTER_TEMPLATE,
        siteUrl: 'http://amirl.org',
      }),
    ).toThrow('must use HTTPS');
    expect(() =>
      validateAppointmentLetterTemplate({
        ...DEFAULT_APPOINTMENT_LETTER_TEMPLATE,
        siteUrl: 'https://user:password@amirl.org?redirect=example.org',
      }),
    ).toThrow('cannot contain credentials');
    expect(() =>
      validateAppointmentLetterTemplate({
        ...DEFAULT_APPOINTMENT_LETTER_TEMPLATE,
        signerName: 'Signer\nInjected footer',
      }),
    ).toThrow('Invalid appointment signerName');
  });

  it('flattens substituted records to safe plain text', () => {
    expect(safePlaceholderValue('Jane **Researcher**\n<script>')).toBe(
      'Jane Researcher script',
    );
  });
});
