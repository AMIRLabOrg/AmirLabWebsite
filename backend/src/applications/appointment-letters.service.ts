import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import PDFDocument from 'pdfkit';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { JobsService } from '../jobs/jobs.service';
import { MailService } from '../mail/mail.service';
import {
  DEFAULT_APPOINTMENT_LETTER_TEMPLATE,
  type AppointmentLetterTemplate,
  SettingsService,
} from '../settings/settings.service';

export const SEND_APPOINTMENT_LETTER_JOB = 'SEND_APPOINTMENT_LETTER';

interface LetterSnapshot {
  applicantName: string;
  applicantEmail: string;
  positionTitle: string;
  positionUrl: string;
  startDate: string;
  endDate: string;
  duration: string;
  weeklyCommitment: string;
  responsibilities: string[];
  issueDate: string;
  reference: string;
  siteUrl: string;
  siteEmail: string;
  siteLocation: string;
  signerName: string;
  signerTitle: string;
  signerEmail: string;
  signerPhone: string;
}

type MarkdownBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] };

@Injectable()
export class AppointmentLettersService implements OnModuleInit {
  constructor(
    private readonly jobs: JobsService,
    private readonly mail: MailService,
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  onModuleInit(): void {
    this.jobs.register(SEND_APPOINTMENT_LETTER_JOB, async (payload) => {
      const id = recordString(payload, 'appointmentLetterId');
      await this.send(id);
    });
  }

  async preview(): Promise<Buffer> {
    const template = await this.settings.appointmentLetter();
    return renderAppointmentLetter(template, sampleSnapshot(template));
  }

  async read(
    applicationId: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const letter = await this.prisma.appointmentLetter.findUnique({
      where: { applicationId },
      select: { pdfData: true, application: { select: { fullName: true } } },
    });
    if (!letter?.pdfData)
      throw new NotFoundException('Appointment letter is not ready');
    return {
      buffer: Buffer.from(letter.pdfData),
      filename: `${filenamePart(letter.application.fullName)}-appointment-letter.pdf`,
    };
  }

  private async send(id: string): Promise<void> {
    const letter = await this.prisma.appointmentLetter.findUnique({
      where: { id },
      include: { application: true },
    });
    if (!letter || letter.emailSentAt) return;
    const template = templateFromSnapshot(
      letter.templateVersion,
      letter.templateMarkdown,
      letter.snapshot,
    );
    const snapshot = letterSnapshot(letter.snapshot);
    const pdf = letter.pdfData
      ? Buffer.from(letter.pdfData)
      : await renderAppointmentLetter(template, snapshot);
    const checksum = createHash('sha256').update(pdf).digest('hex');
    if (!letter.pdfData) {
      await this.prisma.appointmentLetter.update({
        where: { id },
        data: {
          pdfChecksum: checksum,
          pdfData: Uint8Array.from(pdf),
        },
      });
    }
    try {
      await this.mail.sendNow({
        to: snapshot.applicantEmail,
        subject: `Appointment as ${snapshot.positionTitle} at AmirLab`,
        text: `Dear ${snapshot.applicantName},\n\nYour appointment letter for ${snapshot.positionTitle} is attached.\n\nRegards,\n${snapshot.signerName}\n${snapshot.signerTitle}`,
        attachments: [
          {
            filename: `${filenamePart(snapshot.applicantName)}-appointment-letter.pdf`,
            content: pdf,
            contentType: 'application/pdf',
          },
        ],
      });
      await this.prisma.appointmentLetter.update({
        where: { id },
        data: { emailSentAt: new Date(), lastEmailError: null },
      });
    } catch (error) {
      await this.prisma.appointmentLetter.update({
        where: { id },
        data: {
          lastEmailError:
            error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  }
}

export function appointmentSnapshot(
  template: AppointmentLetterTemplate,
  input: {
    applicationId: string;
    applicantName: string;
    applicantEmail: string;
    positionTitle: string;
    positionSlug: string;
    startsAt: Date | null;
    endsAt: Date | null;
    duration: string | null;
    weeklyCommitmentHours: number | null;
    responsibilities: string[];
    issueDate: Date;
  },
): Prisma.InputJsonObject {
  return snapshotToJson({
    applicantName: input.applicantName,
    applicantEmail: input.applicantEmail,
    positionTitle: input.positionTitle,
    positionUrl: `${template.siteUrl.replace(/\/$/, '')}/open-positions`,
    startDate: formatDate(input.startsAt),
    endDate: formatDate(input.endsAt),
    duration: input.duration ?? 'As agreed with the lab',
    weeklyCommitment: input.weeklyCommitmentHours
      ? `${input.weeklyCommitmentHours} hours/week`
      : 'As agreed with the lab',
    responsibilities: input.responsibilities,
    issueDate: formatDate(input.issueDate),
    reference: `AMIRL-APT-${input.issueDate.getUTCFullYear()}-${input.applicationId.slice(0, 8).toUpperCase()}`,
    siteUrl: template.siteUrl,
    siteEmail: template.siteEmail,
    siteLocation: template.siteLocation,
    signerName: template.signerName,
    signerTitle: template.signerTitle,
    signerEmail: template.signerEmail,
    signerPhone: template.signerPhone,
  });
}

async function renderAppointmentLetter(
  template: AppointmentLetterTemplate,
  snapshot: LetterSnapshot,
): Promise<Buffer> {
  const markdown = substitute(template.markdown, snapshot);
  const tokens = parseMarkdown(markdown);
  const chunks: Buffer[] = [];
  const document = new PDFDocument({
    autoFirstPage: true,
    bufferPages: true,
    margins: { bottom: 20, left: 54, right: 54, top: 54 },
    size: 'A4',
    info: {
      Title: `Appointment Letter - ${snapshot.applicantName}`,
      Author: 'AmirLab',
    },
  });
  document.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolveBuffer, reject) => {
    document.on('end', () => resolveBuffer(Buffer.concat(chunks)));
    document.on('error', reject);
  });

  const fonts = fontPaths();
  document.registerFont('Display', fonts.display);
  document.registerFont('Body', fonts.body);
  document.registerFont('BodyBold', fonts.bodyBold);
  document.registerFont('Meta', fonts.meta);
  drawHeader(document, snapshot);
  drawRegister(document, snapshot);
  renderTokens(document, tokens);
  drawSignature(document, snapshot);
  drawFooters(document, snapshot);
  document.end();
  return done;
}

function drawHeader(
  document: PDFKit.PDFDocument,
  snapshot: LetterSnapshot,
): void {
  const brand = brandPaths();
  document.rect(0, 0, document.page.width, 7).fill('#315bd6');
  document.image(brand.logo, 54, 34, { width: 34, height: 34 });
  document.image(brand.wordmark, 98, 36, { width: 108 });
  document
    .font('Meta')
    .fontSize(7)
    .fillColor('#646a76')
    .text('ADVANCED MACHINE INTELLIGENCE RESEARCH LAB', 98, 57, {
      characterSpacing: 0.45,
    });
  document
    .font('Meta')
    .fontSize(7)
    .fillColor('#646a76')
    .text(
      `${snapshot.reference}\n${snapshot.issueDate.toUpperCase()}`,
      370,
      38,
      { align: 'right', lineGap: 3, width: 171 },
    );
  document
    .moveTo(54, 83)
    .lineTo(541, 83)
    .lineWidth(0.8)
    .strokeColor('#aaa397')
    .stroke();
  document
    .font('Meta')
    .fontSize(8)
    .fillColor('#315bd6')
    .text('APPOINTMENT', 54, 106, {
      characterSpacing: 1.1,
    });
  document
    .font('Display')
    .fontSize(28)
    .fillColor('#151a26')
    .text('Appointment letter', 54, 124);
  document
    .font('Body')
    .fontSize(10)
    .fillColor('#646a76')
    .text(`${snapshot.applicantName}  ·  ${snapshot.positionTitle}`, 54, 160);
  document.y = 195;
}

function drawRegister(
  document: PDFKit.PDFDocument,
  snapshot: LetterSnapshot,
): void {
  const top = document.y;
  const items = [
    ['START', snapshot.startDate],
    ['END', snapshot.endDate],
    ['COMMITMENT', snapshot.weeklyCommitment],
  ];
  const width = 487 / items.length;
  document
    .moveTo(54, top)
    .lineTo(541, top)
    .lineWidth(0.7)
    .strokeColor('#d8d3c8')
    .stroke();
  items.forEach(([label, value], index) => {
    const x = 54 + index * width;
    if (index)
      document
        .moveTo(x, top)
        .lineTo(x, top + 50)
        .stroke();
    document
      .font('Meta')
      .fontSize(7)
      .fillColor('#8b8f98')
      .text(label, x + 10, top + 10, {
        characterSpacing: 0.7,
        width: width - 20,
      });
    document
      .font('BodyBold')
      .fontSize(9.5)
      .fillColor('#151a26')
      .text(value, x + 10, top + 27, {
        width: width - 20,
      });
  });
  document
    .moveTo(54, top + 50)
    .lineTo(541, top + 50)
    .stroke();
  document.x = 54;
  document.y = top + 74;
}

function renderTokens(
  document: PDFKit.PDFDocument,
  tokens: MarkdownBlock[],
): void {
  for (const token of tokens) {
    document.x = 54;
    ensureSpace(document, token.type === 'list' ? 55 : 35);
    if (token.type === 'heading') {
      document.moveDown(0.5);
      document
        .font('Meta')
        .fontSize(8)
        .fillColor('#315bd6')
        .text(plainInline(token.text).toUpperCase(), {
          characterSpacing: 0.9,
        });
      document.moveDown(0.5);
    } else if (token.type === 'paragraph') {
      drawInline(document, token.text);
      document.moveDown(0.8);
    } else if (token.type === 'list') {
      token.items.forEach((item, index) => {
        const number = token.ordered ? `${index + 1}.` : '•';
        document
          .font('Meta')
          .fontSize(8)
          .fillColor('#315bd6')
          .text(number, 58, document.y + 1, {
            width: 22,
          });
        document
          .font('Body')
          .fontSize(9.5)
          .fillColor('#151a26')
          .text(plainInline(item), 82, document.y, {
            lineGap: 2.5,
            width: 455,
          });
        document.moveDown(0.35);
      });
      document.moveDown(0.45);
    }
  }
}

function drawInline(document: PDFKit.PDFDocument, value: string): void {
  const parts = value.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  parts.forEach((part, index) => {
    const bold = part.startsWith('**') && part.endsWith('**');
    document
      .font(bold ? 'BodyBold' : 'Body')
      .fontSize(10)
      .fillColor('#151a26')
      .text(inlineText(bold ? part.slice(2, -2) : part), {
        continued: index < parts.length - 1,
        lineGap: 3.2,
      });
  });
}

function drawSignature(
  document: PDFKit.PDFDocument,
  snapshot: LetterSnapshot,
): void {
  ensureSpace(document, 115);
  document.moveDown(0.6);
  document.x = 54;
  document
    .moveTo(54, document.y)
    .lineTo(205, document.y)
    .lineWidth(1)
    .strokeColor('#315bd6')
    .stroke();
  document.moveDown(1.1);
  document
    .font('Display')
    .fontSize(14)
    .fillColor('#151a26')
    .text(snapshot.signerName);
  document
    .font('BodyBold')
    .fontSize(8.5)
    .fillColor('#646a76')
    .text(snapshot.signerTitle);
  document
    .font('Meta')
    .fontSize(7.5)
    .fillColor('#646a76')
    .text(`${snapshot.signerEmail}  ·  ${snapshot.signerPhone}`, {
      lineGap: 2,
    });
}

function drawFooters(
  document: PDFKit.PDFDocument,
  snapshot: LetterSnapshot,
): void {
  const range = document.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    document.switchToPage(index);
    document
      .moveTo(54, 790)
      .lineTo(541, 790)
      .lineWidth(0.6)
      .strokeColor('#d8d3c8')
      .stroke();
    document
      .font('Meta')
      .fontSize(7)
      .fillColor('#646a76')
      .text(
        `${snapshot.siteUrl.replace(/^https?:\/\//, '')}  ·  ${snapshot.siteEmail}  ·  ${snapshot.siteLocation}`,
        54,
        802,
        { width: 400 },
      );
    document.text(`${index + 1} / ${range.count}`, 470, 802, {
      align: 'right',
      width: 71,
    });
  }
}

function substitute(markdown: string, snapshot: LetterSnapshot): string {
  const values: Record<string, string> = {
    'applicant.name': safePlaceholderValue(snapshot.applicantName),
    'applicant.email': safePlaceholderValue(snapshot.applicantEmail),
    'position.title': safePlaceholderValue(snapshot.positionTitle),
    'position.url': safePlaceholderValue(snapshot.positionUrl),
    'position.startDate': safePlaceholderValue(snapshot.startDate),
    'position.endDate': safePlaceholderValue(snapshot.endDate),
    'position.duration': safePlaceholderValue(snapshot.duration),
    'position.weeklyCommitment': safePlaceholderValue(
      snapshot.weeklyCommitment,
    ),
    'position.responsibilities': snapshot.responsibilities
      .map((item, index) => `${index + 1}. ${safePlaceholderValue(item)}`)
      .join('\n'),
    'letter.issueDate': safePlaceholderValue(snapshot.issueDate),
    'letter.reference': safePlaceholderValue(snapshot.reference),
    'site.url': safePlaceholderValue(snapshot.siteUrl),
    'site.email': safePlaceholderValue(snapshot.siteEmail),
    'signer.name': safePlaceholderValue(snapshot.signerName),
    'signer.title': safePlaceholderValue(snapshot.signerTitle),
    'signer.email': safePlaceholderValue(snapshot.signerEmail),
  };
  return markdown.replace(
    /\{\{\s*([^{}]+?)\s*\}\}/g,
    (_, key: string) => values[key] ?? '',
  );
}

export function safePlaceholderValue(value: string): string {
  return value
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[*_`~[\]{}<>]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function parseMarkdown(value: string): MarkdownBlock[] {
  if (/<\/?[a-z][^>]*>/i.test(value) || /!\[[^\]]*\]\([^)]*\)/.test(value)) {
    throw new Error('Appointment templates do not allow HTML or images');
  }
  for (const match of value.matchAll(/\[[^\]]+]\(([^)]+)\)/g)) {
    if (!/^(https?:|mailto:)/i.test(match[1])) {
      throw new Error('Appointment template links must use HTTPS or email');
    }
  }
  const blocks: MarkdownBlock[] = [];
  const lines = value.replace(/\r\n/g, '\n').split('\n');
  let index = 0;
  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }
    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      blocks.push({ type: 'heading', text: heading[1] });
      index += 1;
      continue;
    }
    const list = line.match(/^(?:(\d+)\.|[-+*])\s+(.+)$/);
    if (list) {
      const ordered = Boolean(list[1]);
      const items: string[] = [];
      while (index < lines.length) {
        const item = lines[index].trim().match(/^(?:(\d+)\.|[-+*])\s+(.+)$/);
        if (!item || Boolean(item[1]) !== ordered) break;
        items.push(item[2]);
        index += 1;
      }
      blocks.push({ items, ordered, type: 'list' });
      continue;
    }
    const paragraph = [line];
    index += 1;
    while (index < lines.length && lines[index].trim()) {
      const next = lines[index].trim();
      if (/^#{1,6}\s+/.test(next) || /^(?:(\d+)\.|[-+*])\s+/.test(next)) {
        break;
      }
      paragraph.push(next);
      index += 1;
    }
    blocks.push({ text: paragraph.join(' '), type: 'paragraph' });
  }
  return blocks;
}

function ensureSpace(document: PDFKit.PDFDocument, height: number): void {
  if (document.y + height <= 770) return;
  document.addPage();
  document.y = 62;
}

function plainInline(value: string): string {
  return inlineText(value).trim();
}

function inlineText(value: string): string {
  return value
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/[*_`~]/g, '')
    .replace(/<[^>]+>/g, '');
}

function formatDate(value: Date | null): string {
  if (!value) return 'As agreed with the lab';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(value);
}

function filenamePart(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'applicant'
  );
}

function brandPaths(): { logo: string; wordmark: string } {
  return {
    logo: assetPath('amirlab-logo.png'),
    wordmark: assetPath('amirlab-wordmark.png'),
  };
}

function assetPath(name: string): string {
  const paths = [
    resolve(__dirname, 'brand', name),
    resolve(process.cwd(), 'dist', 'applications', 'brand', name),
    resolve(process.cwd(), 'src', 'applications', 'brand', name),
  ];
  const path = paths.find(existsSync);
  if (!path) throw new Error(`Appointment letter asset is missing: ${name}`);
  return path;
}

function fontPaths() {
  return {
    display: assetPath('Fraunces.ttf'),
    body: assetPath('IBMPlexSans.ttf'),
    bodyBold: assetPath('IBMPlexSans.ttf'),
    meta: assetPath('IBMPlexMono.ttf'),
  };
}

function recordString(value: unknown, key: string): string {
  if (!value || Array.isArray(value) || typeof value !== 'object')
    throw new Error('Job payload must be an object');
  const result = key in value ? value[key as keyof typeof value] : undefined;
  if (typeof result !== 'string') throw new Error(`Job payload needs ${key}`);
  return result;
}

function letterSnapshot(value: Prisma.JsonValue): LetterSnapshot {
  if (!value || Array.isArray(value) || typeof value !== 'object')
    throw new Error('Appointment snapshot is invalid');
  const string = (key: keyof LetterSnapshot) => {
    const item = value[key];
    if (typeof item !== 'string')
      throw new Error(`Appointment snapshot needs ${key}`);
    return item;
  };
  const responsibilities = value.responsibilities;
  if (
    !Array.isArray(responsibilities) ||
    responsibilities.some((item) => typeof item !== 'string')
  ) {
    throw new Error('Appointment snapshot responsibilities are invalid');
  }
  return {
    applicantName: string('applicantName'),
    applicantEmail: string('applicantEmail'),
    positionTitle: string('positionTitle'),
    positionUrl: string('positionUrl'),
    startDate: string('startDate'),
    endDate: string('endDate'),
    duration: string('duration'),
    weeklyCommitment: string('weeklyCommitment'),
    responsibilities: responsibilities as string[],
    issueDate: string('issueDate'),
    reference: string('reference'),
    siteUrl: string('siteUrl'),
    siteEmail: string('siteEmail'),
    siteLocation: string('siteLocation'),
    signerName: string('signerName'),
    signerTitle: string('signerTitle'),
    signerEmail: string('signerEmail'),
    signerPhone: string('signerPhone'),
  };
}

function snapshotToJson(snapshot: LetterSnapshot): Prisma.InputJsonObject {
  return { ...snapshot, responsibilities: [...snapshot.responsibilities] };
}

function templateFromSnapshot(
  version: number,
  markdown: string,
  value: Prisma.JsonValue,
): AppointmentLetterTemplate {
  const snapshot = letterSnapshot(value);
  return {
    ...DEFAULT_APPOINTMENT_LETTER_TEMPLATE,
    version,
    markdown,
    signerName: snapshot.signerName,
    signerTitle: snapshot.signerTitle,
    signerEmail: snapshot.signerEmail,
    signerPhone: snapshot.signerPhone,
    siteUrl: snapshot.siteUrl,
    siteEmail: snapshot.siteEmail,
    siteLocation: snapshot.siteLocation,
  };
}

function sampleSnapshot(template: AppointmentLetterTemplate): LetterSnapshot {
  return {
    applicantName: 'Samira Rahman',
    applicantEmail: 'samira@example.org',
    positionTitle: 'Research Intern',
    positionUrl: `${template.siteUrl}/open-positions`,
    startDate: '1 September 2026',
    endDate: '28 February 2027',
    duration: 'Six months',
    weeklyCommitment: '20 hours/week',
    responsibilities: [
      'Contribute to machine intelligence research and documented experiments.',
      'Collaborate with researchers on models, reports, and presentations.',
      'Maintain clear weekly progress and evidence for assigned work.',
    ],
    issueDate: '26 August 2026',
    reference: 'AMIRL-APT-2026-PREVIEW',
    siteUrl: template.siteUrl,
    siteEmail: template.siteEmail,
    siteLocation: template.siteLocation,
    signerName: template.signerName,
    signerTitle: template.signerTitle,
    signerEmail: template.signerEmail,
    signerPhone: template.signerPhone,
  };
}
