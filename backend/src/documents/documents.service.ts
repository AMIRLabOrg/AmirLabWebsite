import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import {
  DocumentKind,
  type DocumentTemplate,
  type Prisma,
} from '../../generated/prisma/client';
import { AssetsService } from '../assets/assets.service';
import { PrismaService } from '../database/prisma.service';
import { JobsService } from '../jobs/jobs.service';
import { MailService } from '../mail/mail.service';
import type {
  DocumentApprovalDto,
  DocumentTemplateDto,
  IssueDocumentDto,
} from './dto/documents.dto';
import {
  type ApproverSnapshot,
  type DocumentSiteSnapshot,
  renderDocument,
} from './document-renderer';

export const SEND_ISSUED_DOCUMENT_JOB = 'SEND_ISSUED_DOCUMENT';

const SETTINGS_ID = 'documents';
const LEGACY_TEMPLATE_KEY = 'appointment-letter-template';

export const DEFAULT_APPROVER: Omit<ApproverSnapshot, 'signatureAssetId'> = {
  name: 'Prof. Dr. Mohammad Firoz Mridha',
  title: 'Founder & Research Director',
  email: 'firoz.mridha@aiub.edu',
  phone: '+8801674791594',
};

export const DEFAULT_DOCUMENT_SITE: DocumentSiteSnapshot = {
  url: 'https://amirl.org',
  email: 'amirlab.org@gmail.com',
  location: 'Dhaka, Bangladesh',
};

export const DEFAULT_DOCUMENT_TEMPLATES: ReadonlyArray<
  Pick<
    DocumentTemplate,
    'kind' | 'name' | 'titleTemplate' | 'bodyMarkdown' | 'emailSubjectTemplate'
  >
> = [
  {
    kind: DocumentKind.OFFER,
    name: 'Standard research offer',
    titleTemplate: 'Offer letter',
    bodyMarkdown: `Dear {{recipient.name}},

We are pleased to offer you the position of **{{position.title}}** at the Advanced Machine Intelligence Research Lab. This appointment begins on {{position.startDate}} and continues until {{position.endDate}}.

## Responsibilities

{{position.responsibilities}}

We look forward to your contribution to AmirLab's research activities and to the perspective you will bring to our team.`,
    emailSubjectTemplate: 'Offer as {{position.title}} at AmirLab',
  },
  {
    kind: DocumentKind.LETTER,
    name: 'General letter',
    titleTemplate: '{{letter.subject}}',
    bodyMarkdown: `Dear {{recipient.name}},

{{letter.details}}`,
    emailSubjectTemplate: '{{letter.subject}} - AmirLab',
  },
  {
    kind: DocumentKind.CERTIFICATE,
    name: 'Standard certificate',
    titleTemplate: 'Certificate of achievement',
    bodyMarkdown: `This certificate recognizes **{{recipient.name}}** for {{certificate.achievement}}.`,
    emailSubjectTemplate: 'Your certificate from AmirLab',
  },
];

export const DOCUMENT_VARIABLES: Record<
  DocumentKind,
  Array<{ label: string; token: string }>
> = {
  OFFER: [
    ['Recipient name', '{{recipient.name}}'],
    ['Recipient email', '{{recipient.email}}'],
    ['Position title', '{{position.title}}'],
    ['Start date', '{{position.startDate}}'],
    ['End date', '{{position.endDate}}'],
    ['Duration', '{{position.duration}}'],
    ['Weekly commitment', '{{position.weeklyCommitment}}'],
    ['Responsibilities', '{{position.responsibilities}}'],
  ].map(([label, token]) => ({ label, token })),
  LETTER: [
    ['Recipient name', '{{recipient.name}}'],
    ['Recipient email', '{{recipient.email}}'],
    ['Letter subject', '{{letter.subject}}'],
    ['Letter details', '{{letter.details}}'],
  ].map(([label, token]) => ({ label, token })),
  CERTIFICATE: [
    ['Recipient name', '{{recipient.name}}'],
    ['Recipient email', '{{recipient.email}}'],
    ['Program', '{{certificate.program}}'],
    ['Achievement', '{{certificate.achievement}}'],
    ['Completion date', '{{certificate.completionDate}}'],
  ].map(([label, token]) => ({ label, token })),
};

const COMMON_VARIABLES = [
  { label: 'Issue date', token: '{{document.issueDate}}' },
  { label: 'Reference', token: '{{document.reference}}' },
  { label: 'Approver name', token: '{{approver.name}}' },
  { label: 'Approver title', token: '{{approver.title}}' },
  { label: 'Approver email', token: '{{approver.email}}' },
  { label: 'Approver phone', token: '{{approver.phone}}' },
  { label: 'Website', token: '{{site.url}}' },
  { label: 'Lab email', token: '{{site.email}}' },
];

interface StoredSnapshot {
  title: string;
  bodyMarkdown: string;
  emailSubject: string;
  issueDate: string;
  reference: string;
  recipientName: string;
  site: DocumentSiteSnapshot;
  values: Record<string, string>;
  offerFacts?: Array<[string, string]>;
  certificateProgram?: string;
}

interface AutomatedOfferInput {
  applicationId: string;
  applicantName: string;
  applicantEmail: string;
  positionTitle: string;
  startsAt: Date | null;
  endsAt: Date | null;
  duration: string | null;
  weeklyCommitmentHours: number | null;
  responsibilities: string[];
  issueDate: Date;
  createdById: string;
}

@Injectable()
export class DocumentsService implements OnModuleInit {
  constructor(
    private readonly assets: AssetsService,
    private readonly jobs: JobsService,
    private readonly mail: MailService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureDefaults();
    this.jobs.register(SEND_ISSUED_DOCUMENT_JOB, async (payload) => {
      const id = recordString(payload, 'documentId');
      await this.send(id);
    });
  }

  async approval() {
    const settings = await this.prisma.documentSettings.findUnique({
      where: { id: SETTINGS_ID },
      include: {
        approverPerson: { include: { user: { select: { email: true } } } },
      },
    });
    if (!settings)
      throw new NotFoundException('Document approval settings not found');
    return {
      approver: settings.approverPerson
        ? approverFromPerson(settings.approverPerson, settings.signatureAssetId)
        : null,
      approverPersonId: settings.approverPersonId,
      signatureAssetId: settings.signatureAssetId,
      signatureAvailable: settings.signatureAssetId
        ? Boolean(
            await this.assets.readDocumentSignature(settings.signatureAssetId),
          )
        : false,
      watermarkAssetId: settings.watermarkAssetId,
      watermarkAvailable: settings.watermarkAssetId
        ? Boolean(
            await this.assets.readDocumentWatermark(settings.watermarkAssetId),
          )
        : false,
      updatedAt: settings.updatedAt,
    };
  }

  async approvalSignature(): Promise<Buffer> {
    const settings = await this.prisma.documentSettings.findUnique({
      where: { id: SETTINGS_ID },
      select: { signatureAssetId: true },
    });
    const buffer = settings?.signatureAssetId
      ? await this.assets.readDocumentSignature(settings.signatureAssetId)
      : null;
    if (!buffer)
      throw new NotFoundException('Document approval signature not found');
    return buffer;
  }

  async approvalWatermark(): Promise<Buffer> {
    const settings = await this.prisma.documentSettings.findUnique({
      where: { id: SETTINGS_ID },
      select: { watermarkAssetId: true },
    });
    const buffer = settings?.watermarkAssetId
      ? await this.assets.readDocumentWatermark(settings.watermarkAssetId)
      : null;
    if (!buffer)
      throw new NotFoundException('Document watermark image not found');
    return buffer;
  }

  async updateApproval(
    dto: DocumentApprovalDto,
    actorId: string,
    signature?: Express.Multer.File,
    watermark?: Express.Multer.File,
  ) {
    const [existing, person] = await Promise.all([
      this.prisma.documentSettings.findUnique({ where: { id: SETTINGS_ID } }),
      this.prisma.person.findUnique({
        where: { id: dto.approverPersonId },
        select: { id: true },
      }),
    ]);
    if (!existing)
      throw new NotFoundException('Document approval settings not found');
    if (!person) throw new NotFoundException('Approver person not found');
    let uploaded: Awaited<
      ReturnType<AssetsService['storeDocumentSignature']>
    > | null = null;
    let uploadedWatermark: Awaited<
      ReturnType<AssetsService['storeDocumentWatermark']>
    > | null = null;
    try {
      uploaded = signature
        ? await this.assets.storeDocumentSignature(signature, actorId)
        : null;
      uploadedWatermark = watermark
        ? await this.assets.storeDocumentWatermark(watermark, actorId)
        : null;
      const signatureAssetId = uploaded
        ? uploaded.id
        : dto.removeSignature
          ? null
          : existing.signatureAssetId;
      const watermarkAssetId = uploadedWatermark
        ? uploadedWatermark.id
        : dto.removeWatermark
          ? null
          : existing.watermarkAssetId;
      await this.prisma.$transaction(async (transaction) => {
        await transaction.documentSettings.update({
          where: { id: SETTINGS_ID },
          data: {
            approverPersonId: dto.approverPersonId,
            signatureAssetId,
            watermarkAssetId,
          },
        });
        await transaction.auditRecord.create({
          data: {
            action: 'document-approval.updated',
            actorId,
            entityId: SETTINGS_ID,
            entityType: 'DocumentSettings',
            details: {
              approverPersonId: dto.approverPersonId,
              signatureChanged: Boolean(signature || dto.removeSignature),
              watermarkChanged: Boolean(watermark || dto.removeWatermark),
            },
          },
        });
      });
    } catch (error) {
      if (uploaded) await this.assets.remove(uploaded.id);
      if (uploadedWatermark) await this.assets.remove(uploadedWatermark.id);
      throw error;
    }
    return this.approval();
  }

  async listTemplates(kind?: DocumentKind) {
    const [settings, templates] = await Promise.all([
      this.prisma.documentSettings.findUnique({ where: { id: SETTINGS_ID } }),
      this.prisma.documentTemplate.findMany({
        where: kind ? { kind } : undefined,
        orderBy: [{ kind: 'asc' }, { name: 'asc' }],
      }),
    ]);
    return templates.map((template) => ({
      ...template,
      isDefaultOffer: settings?.defaultOfferTemplateId === template.id,
      variables: [...COMMON_VARIABLES, ...DOCUMENT_VARIABLES[template.kind]],
    }));
  }

  async getTemplate(id: string) {
    const template = await this.prisma.documentTemplate.findUnique({
      where: { id },
    });
    if (!template) throw new NotFoundException('Document template not found');
    const settings = await this.prisma.documentSettings.findUnique({
      where: { id: SETTINGS_ID },
    });
    return {
      ...template,
      isDefaultOffer: settings?.defaultOfferTemplateId === template.id,
      variables: [...COMMON_VARIABLES, ...DOCUMENT_VARIABLES[template.kind]],
    };
  }

  async createTemplate(dto: DocumentTemplateDto, actorId: string) {
    const value = validateTemplate(dto);
    return this.prisma.documentTemplate.create({
      data: { ...value, createdById: actorId, updatedById: actorId },
    });
  }

  async updateTemplate(id: string, dto: DocumentTemplateDto, actorId: string) {
    const existing = await this.prisma.documentTemplate.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Document template not found');
    if (existing.kind !== dto.kind) {
      throw new BadRequestException('Document template kind cannot be changed');
    }
    const value = validateTemplate(dto);
    return this.prisma.documentTemplate.update({
      where: { id },
      data: { ...value, updatedById: actorId, version: { increment: 1 } },
    });
  }

  async setDefaultOffer(id: string, actorId: string) {
    const template = await this.prisma.documentTemplate.findUnique({
      where: { id },
    });
    if (
      !template ||
      template.kind !== DocumentKind.OFFER ||
      !template.isActive
    ) {
      throw new BadRequestException(
        'Default offer template must be an active offer',
      );
    }
    await this.prisma.$transaction(async (transaction) => {
      await transaction.documentSettings.update({
        where: { id: SETTINGS_ID },
        data: { defaultOfferTemplateId: id },
      });
      await transaction.auditRecord.create({
        data: {
          action: 'documents.default-offer-updated',
          actorId,
          entityId: id,
          entityType: 'DocumentTemplate',
          details: {},
        },
      });
    });
    return this.getTemplate(id);
  }

  async removeTemplate(id: string) {
    const settings = await this.prisma.documentSettings.findUnique({
      where: { id: SETTINGS_ID },
    });
    if (settings?.defaultOfferTemplateId === id) {
      throw new ConflictException(
        'Choose another default offer template first',
      );
    }
    const template = await this.prisma.documentTemplate.findUnique({
      where: { id },
    });
    if (!template) throw new NotFoundException('Document template not found');
    await this.prisma.documentTemplate.delete({ where: { id } });
    return { deleted: true };
  }

  async previewTemplate(id: string): Promise<Buffer> {
    const template = await this.requireTemplate(id);
    const context = await this.documentContext();
    const input = sampleInput(template.kind, template.id);
    const prepared = this.prepare(
      template,
      input,
      context.approver,
      context.site,
    );
    return this.renderPrepared(
      template.kind,
      prepared,
      context.signature,
      context.watermark,
    );
  }

  async previewDefaultOffer(): Promise<Buffer> {
    const template = await this.defaultOfferTemplate();
    return this.previewTemplate(template.id);
  }

  async issue(dto: IssueDocumentDto, actorId: string) {
    const template = await this.requireTemplate(dto.templateId);
    if (template.kind !== dto.kind || !template.isActive) {
      throw new BadRequestException(
        'Choose an active template of the selected kind',
      );
    }
    const recipient = await this.resolveRecipient(dto);
    const normalized = { ...dto, ...recipient };
    validateIssueFields(normalized);
    const context = await this.documentContext();
    const prepared = this.prepare(
      template,
      normalized,
      context.approver,
      context.site,
    );
    const pdf = await this.renderPrepared(
      template.kind,
      prepared,
      context.signature,
      context.watermark,
    );
    return this.prisma.issuedDocument.create({
      data: {
        createdById: actorId,
        approverSnapshot: approverToJson(context.approver),
        kind: template.kind,
        pdfChecksum: checksum(pdf),
        pdfData: Uint8Array.from(pdf),
        recipientEmail: recipient.recipientEmail || null,
        recipientName: recipient.recipientName,
        recipientPersonId: dto.recipientPersonId,
        reference: prepared.reference,
        signatureAssetId: context.approver.signatureAssetId,
        watermarkAssetId: context.watermarkAssetId,
        snapshot: snapshotToJson(prepared),
        templateId: template.id,
        templateMarkdown: template.bodyMarkdown,
        templateVersion: template.version,
      },
      select: issuedDocumentSummary,
    });
  }

  async listIssued(kind?: DocumentKind) {
    return this.prisma.issuedDocument.findMany({
      where: kind ? { kind } : undefined,
      orderBy: { createdAt: 'desc' },
      select: issuedDocumentSummary,
      take: 200,
    });
  }

  listRecipients() {
    return this.prisma.person.findMany({
      orderBy: { fullName: 'asc' },
      select: {
        fullName: true,
        id: true,
        phone: true,
        publicEmail: true,
        roleTitle: true,
        user: { select: { email: true } },
      },
    });
  }

  async read(id: string) {
    const document = await this.prisma.issuedDocument.findUnique({
      where: { id },
    });
    if (!document) throw new NotFoundException('Issued document not found');
    const pdf = document.pdfData
      ? Buffer.from(document.pdfData)
      : await this.renderStored(document);
    return {
      buffer: pdf,
      filename: documentFilename(document.kind, document.recipientName),
    };
  }

  async readOffer(applicationId: string) {
    const document = await this.prisma.issuedDocument.findUnique({
      where: { applicationId },
    });
    if (!document) throw new NotFoundException('Offer letter is not ready');
    const result = await this.read(document.id);
    return {
      ...result,
      filename: `${filenamePart(document.recipientName ?? 'applicant')}-offer-letter.pdf`,
    };
  }

  async queueEmail(id: string) {
    const document = await this.prisma.issuedDocument.findUnique({
      where: { id },
    });
    if (!document) throw new NotFoundException('Issued document not found');
    if (!document.recipientEmail) {
      throw new BadRequestException(
        'Recipient email is required before emailing',
      );
    }
    if (document.emailSentAt) return { queued: false, sent: true };
    await this.jobs.enqueueWhileActive(
      SEND_ISSUED_DOCUMENT_JOB,
      { documentId: id },
      `issued-document:${id}`,
    );
    return { queued: true, sent: false };
  }

  async prepareAutomatedOffer(input: AutomatedOfferInput) {
    const template = await this.defaultOfferTemplate();
    const context = await this.documentContext();
    const dto: IssueDocumentDto & {
      recipientName: string;
      recipientEmail: string;
    } = {
      kind: DocumentKind.OFFER,
      templateId: template.id,
      recipientName: input.applicantName,
      recipientEmail: input.applicantEmail,
      issueDate: input.issueDate.toISOString(),
      positionTitle: input.positionTitle,
      startDate: formatDate(input.startsAt),
      endDate: formatDate(input.endsAt),
      duration: input.duration ?? 'As agreed with the lab',
      weeklyCommitment: input.weeklyCommitmentHours
        ? `${input.weeklyCommitmentHours} hours/week`
        : 'As agreed with the lab',
      responsibilities: input.responsibilities,
    };
    const prepared = this.prepare(
      template,
      dto,
      context.approver,
      context.site,
      input.applicationId,
    );
    return {
      data: {
        applicationId: input.applicationId,
        createdById: input.createdById,
        approverSnapshot: approverToJson(context.approver),
        kind: DocumentKind.OFFER,
        recipientEmail: input.applicantEmail,
        recipientName: input.applicantName,
        reference: prepared.reference,
        signatureAssetId: context.approver.signatureAssetId,
        watermarkAssetId: context.watermarkAssetId,
        snapshot: snapshotToJson(prepared),
        templateId: template.id,
        templateMarkdown: template.bodyMarkdown,
        templateVersion: template.version,
      } satisfies Prisma.IssuedDocumentUncheckedCreateInput,
      jobType: SEND_ISSUED_DOCUMENT_JOB,
    };
  }

  private async send(id: string): Promise<void> {
    const document = await this.prisma.issuedDocument.findUnique({
      where: { id },
    });
    if (!document || document.emailSentAt) return;
    if (!document.recipientEmail)
      throw new Error('Issued document has no recipient email');
    const prepared = storedSnapshot(document.snapshot);
    const pdf = document.pdfData
      ? Buffer.from(document.pdfData)
      : await this.renderStored(document);
    if (!document.pdfData) {
      await this.prisma.issuedDocument.update({
        where: { id },
        data: { pdfChecksum: checksum(pdf), pdfData: Uint8Array.from(pdf) },
      });
    }
    try {
      await this.mail.sendNow({
        to: document.recipientEmail,
        subject: prepared.emailSubject,
        text: `Dear ${prepared.recipientName},\n\nYour ${documentLabel(document.kind)} is attached.\n\nRegards,\n${approverSnapshot(document.approverSnapshot).name}`,
        attachments: [
          {
            content: pdf,
            contentType: 'application/pdf',
            filename: documentFilename(document.kind, document.recipientName),
          },
        ],
      });
      await this.prisma.issuedDocument.update({
        where: { id },
        data: { emailSentAt: new Date(), lastEmailError: null },
      });
    } catch (error) {
      await this.prisma.issuedDocument.update({
        where: { id },
        data: {
          lastEmailError:
            error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  }

  private async renderStored(document: {
    kind: DocumentKind;
    snapshot: Prisma.JsonValue;
    approverSnapshot: Prisma.JsonValue | null;
    signatureAssetId: string | null;
    watermarkAssetId: string | null;
  }): Promise<Buffer> {
    const prepared = storedSnapshot(document.snapshot);
    const approver = approverSnapshot(document.approverSnapshot);
    const signature = document.signatureAssetId
      ? await this.assets.readDocumentSignature(document.signatureAssetId)
      : null;
    const watermark = document.watermarkAssetId
      ? await this.assets.readDocumentWatermark(document.watermarkAssetId)
      : null;
    return this.renderPrepared(
      document.kind,
      prepared,
      signature ?? undefined,
      watermark ?? undefined,
      approver,
    );
  }

  private renderPrepared(
    kind: DocumentKind,
    prepared: StoredSnapshot,
    signature?: Buffer,
    watermark?: Buffer,
    approver?: ApproverSnapshot,
  ) {
    const resolvedApprover = approver ?? approverFromValues(prepared.values);
    return renderDocument({
      bodyMarkdown: prepared.bodyMarkdown,
      certificateProgram: prepared.certificateProgram,
      approver: resolvedApprover,
      issueDate: prepared.issueDate,
      kind,
      offerFacts: prepared.offerFacts,
      recipientName: prepared.recipientName,
      reference: prepared.reference,
      signature,
      site: prepared.site,
      title: prepared.title,
      watermark,
    });
  }

  private prepare(
    template: DocumentTemplate,
    dto: IssueDocumentDto & { recipientName: string; recipientEmail?: string },
    approver: ApproverSnapshot,
    site: DocumentSiteSnapshot,
    stableKey?: string,
  ): StoredSnapshot {
    const issueDate = dto.issueDate ? new Date(dto.issueDate) : new Date();
    const reference = referenceFor(template.kind, issueDate, stableKey);
    const values = valuesFor(
      template.kind,
      dto,
      approver,
      site,
      issueDate,
      reference,
    );
    return {
      bodyMarkdown: substitute(template.bodyMarkdown, values),
      certificateProgram: dto.certificateProgram,
      emailSubject: substitute(template.emailSubjectTemplate, values),
      issueDate: formatDate(issueDate),
      offerFacts:
        template.kind === DocumentKind.OFFER
          ? [
              ['Start', dto.startDate ?? 'As agreed with the lab'],
              ['End', dto.endDate ?? 'As agreed with the lab'],
              ['Commitment', dto.weeklyCommitment ?? 'As agreed with the lab'],
            ]
          : undefined,
      recipientName: dto.recipientName,
      reference,
      site,
      title: substitute(template.titleTemplate, values),
      values,
    };
  }

  private async resolveRecipient(dto: IssueDocumentDto) {
    if (dto.recipientPersonId) {
      const person = await this.prisma.person.findUnique({
        where: { id: dto.recipientPersonId },
        select: {
          fullName: true,
          publicEmail: true,
          user: { select: { email: true } },
        },
      });
      if (!person) throw new NotFoundException('Recipient person not found');
      return {
        recipientEmail:
          dto.recipientEmail?.trim() ||
          person.publicEmail ||
          person.user?.email ||
          '',
        recipientName: person.fullName,
      };
    }
    const recipientName = dto.recipientName?.trim();
    if (!recipientName)
      throw new BadRequestException('Recipient name is required');
    return { recipientEmail: dto.recipientEmail?.trim() || '', recipientName };
  }

  private async documentContext() {
    const settings = await this.prisma.documentSettings.findUnique({
      where: { id: SETTINGS_ID },
      include: {
        approverPerson: { include: { user: { select: { email: true } } } },
      },
    });
    if (!settings) throw new Error('Document defaults are missing');
    if (!settings.approverPerson) {
      throw new ConflictException(
        'Choose a document approver before generating documents',
      );
    }
    const snapshot = approverFromPerson(
      settings.approverPerson,
      settings.signatureAssetId,
    );
    const signature = settings.signatureAssetId
      ? await this.assets.readDocumentSignature(settings.signatureAssetId)
      : null;
    const watermark = settings.watermarkAssetId
      ? await this.assets.readDocumentWatermark(settings.watermarkAssetId)
      : null;
    return {
      approver: snapshot,
      signature: signature ?? undefined,
      site: {
        email: settings.siteEmail,
        location: settings.siteLocation,
        url: settings.siteUrl,
      },
      watermark: watermark ?? undefined,
      watermarkAssetId: settings.watermarkAssetId,
    };
  }

  private async defaultOfferTemplate() {
    const settings = await this.prisma.documentSettings.findUnique({
      where: { id: SETTINGS_ID },
      include: { defaultOfferTemplate: true },
    });
    const template = settings?.defaultOfferTemplate;
    if (
      !template ||
      !template.isActive ||
      template.kind !== DocumentKind.OFFER
    ) {
      throw new ConflictException(
        'An active default offer template is required',
      );
    }
    return template;
  }

  private async requireTemplate(id: string) {
    const template = await this.prisma.documentTemplate.findUnique({
      where: { id },
    });
    if (!template) throw new NotFoundException('Document template not found');
    return template;
  }

  private async ensureDefaults(): Promise<void> {
    const legacy = await this.prisma.siteSetting.findUnique({
      where: { key: LEGACY_TEMPLATE_KEY },
      select: { value: true },
    });
    const value = isRecord(legacy?.value) ? legacy.value : {};
    const defaultApprover = await this.prisma.person.findFirst({
      where: {
        OR: [
          { roleTitle: { contains: 'Director', mode: 'insensitive' } },
          { fullName: DEFAULT_APPROVER.name },
        ],
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    const settings = await this.prisma.documentSettings.upsert({
      where: { id: SETTINGS_ID },
      create: {
        id: SETTINGS_ID,
        approverPersonId: defaultApprover?.id,
        siteEmail: stringValue(value.siteEmail, DEFAULT_DOCUMENT_SITE.email),
        siteLocation: stringValue(
          value.siteLocation,
          DEFAULT_DOCUMENT_SITE.location,
        ),
        siteUrl: stringValue(value.siteUrl, DEFAULT_DOCUMENT_SITE.url),
      },
      update: {},
    });
    if (!settings.approverPersonId && defaultApprover) {
      await this.prisma.documentSettings.update({
        where: { id: SETTINGS_ID },
        data: { approverPersonId: defaultApprover.id },
      });
    }
    let defaultOfferId = settings.defaultOfferTemplateId;
    for (const defaults of DEFAULT_DOCUMENT_TEMPLATES) {
      const existing = await this.prisma.documentTemplate.findFirst({
        where: { kind: defaults.kind, name: defaults.name },
      });
      const template =
        existing ??
        (await this.prisma.documentTemplate.create({
          data: {
            ...defaults,
            ...(defaults.kind === DocumentKind.OFFER &&
            typeof value.markdown === 'string'
              ? { bodyMarkdown: value.markdown }
              : {}),
          },
        }));
      if (template.kind === DocumentKind.OFFER && !defaultOfferId) {
        defaultOfferId = template.id;
      }
    }
    if (defaultOfferId !== settings.defaultOfferTemplateId) {
      await this.prisma.documentSettings.update({
        where: { id: SETTINGS_ID },
        data: { defaultOfferTemplateId: defaultOfferId },
      });
    }
  }
}

const issuedDocumentSummary = {
  createdAt: true,
  emailSentAt: true,
  id: true,
  kind: true,
  lastEmailError: true,
  pdfChecksum: true,
  recipientEmail: true,
  recipientName: true,
  reference: true,
  template: { select: { id: true, name: true } },
} satisfies Prisma.IssuedDocumentSelect;

function validateTemplate(dto: DocumentTemplateDto) {
  const fields = [
    dto.name,
    dto.titleTemplate,
    dto.bodyMarkdown,
    dto.emailSubjectTemplate,
  ];
  if (
    fields.some((value) =>
      hasControlCharacter(value, value === dto.bodyMarkdown),
    )
  ) {
    throw new BadRequestException(
      'Document template contains invalid characters',
    );
  }
  if (
    /[<>]/.test(dto.bodyMarkdown) ||
    /!?\[[^\]]*\]\([^)]*\)/.test(dto.bodyMarkdown)
  ) {
    throw new BadRequestException(
      'Document templates cannot contain HTML, images, or links',
    );
  }
  const allowed = new Set(
    [...COMMON_VARIABLES, ...DOCUMENT_VARIABLES[dto.kind]].map(({ token }) =>
      token.slice(2, -2),
    ),
  );
  for (const text of [
    dto.titleTemplate,
    dto.bodyMarkdown,
    dto.emailSubjectTemplate,
  ]) {
    for (const match of text.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)) {
      if (!allowed.has(match[1])) {
        throw new BadRequestException(
          `Unknown document placeholder: {{${match[1]}}}`,
        );
      }
    }
    if (text.replace(/\{\{\s*[^{}]+?\s*\}\}/g, '').includes('{{')) {
      throw new BadRequestException(
        'Document template has an unclosed placeholder',
      );
    }
  }
  return {
    bodyMarkdown: dto.bodyMarkdown.trim(),
    emailSubjectTemplate: dto.emailSubjectTemplate.trim(),
    isActive: dto.isActive,
    kind: dto.kind,
    name: dto.name.trim(),
    titleTemplate: dto.titleTemplate.trim(),
  };
}

function validateIssueFields(
  dto: IssueDocumentDto & { recipientName: string },
) {
  if (
    dto.kind === DocumentKind.OFFER &&
    (!dto.positionTitle?.trim() || !dto.responsibilities?.length)
  ) {
    throw new BadRequestException(
      'Offer position and responsibilities are required',
    );
  }
  if (
    dto.kind === DocumentKind.LETTER &&
    (!dto.letterSubject?.trim() || !dto.letterDetails?.trim())
  ) {
    throw new BadRequestException('Letter subject and details are required');
  }
  if (
    dto.kind === DocumentKind.CERTIFICATE &&
    (!dto.certificateProgram?.trim() ||
      !dto.certificateAchievement?.trim() ||
      !dto.completionDate?.trim())
  ) {
    throw new BadRequestException(
      'Certificate program, achievement, and completion date are required',
    );
  }
}

function valuesFor(
  kind: DocumentKind,
  dto: IssueDocumentDto & { recipientName: string; recipientEmail?: string },
  approver: ApproverSnapshot,
  site: DocumentSiteSnapshot,
  issueDate: Date,
  reference: string,
) {
  const values: Record<string, string> = {
    'approver.email': approver.email,
    'approver.name': approver.name,
    'approver.phone': approver.phone,
    'approver.title': approver.title,
    'document.issueDate': formatDate(issueDate),
    'document.reference': reference,
    'recipient.email': dto.recipientEmail ?? '',
    'recipient.name': dto.recipientName,
    'site.email': site.email,
    'site.url': site.url,
  };
  if (kind === DocumentKind.OFFER) {
    Object.assign(values, {
      'position.duration': dto.duration ?? 'As agreed with the lab',
      'position.endDate': dto.endDate ?? 'As agreed with the lab',
      'position.responsibilities': (dto.responsibilities ?? [])
        .map((item, index) => `${index + 1}. ${safeValue(item)}`)
        .join('\n'),
      'position.startDate': dto.startDate ?? 'As agreed with the lab',
      'position.title': dto.positionTitle ?? '',
      'position.weeklyCommitment':
        dto.weeklyCommitment ?? 'As agreed with the lab',
    });
  } else if (kind === DocumentKind.LETTER) {
    Object.assign(values, {
      'letter.details': dto.letterDetails ?? '',
      'letter.subject': dto.letterSubject ?? '',
    });
  } else {
    Object.assign(values, {
      'certificate.achievement': dto.certificateAchievement ?? '',
      'certificate.completionDate': dto.completionDate ?? '',
      'certificate.program': dto.certificateProgram ?? '',
    });
  }
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, safeValue(value)]),
  );
}

function substitute(template: string, values: Record<string, string>): string {
  return template.replace(
    /\{\{\s*([^{}]+?)\s*\}\}/g,
    (_, key: string) => values[key] ?? '',
  );
}

function sampleInput(
  kind: DocumentKind,
  templateId: string,
): IssueDocumentDto & { recipientName: string; recipientEmail: string } {
  const common = {
    issueDate: '2026-08-28T00:00:00.000Z',
    kind,
    recipientEmail: 'samira@example.org',
    recipientName: 'Samira Rahman',
    templateId,
  };
  if (kind === DocumentKind.OFFER) {
    return {
      ...common,
      duration: 'Six months',
      endDate: '28 February 2027',
      positionTitle: 'Research Intern',
      responsibilities: [
        'Contribute to machine intelligence research and documented experiments.',
        'Collaborate with researchers on models, reports, and presentations.',
      ],
      startDate: '1 September 2026',
      weeklyCommitment: '20 hours/week',
    };
  }
  if (kind === DocumentKind.LETTER) {
    return {
      ...common,
      letterDetails:
        'This letter confirms your active research contribution and good standing with AmirLab.',
      letterSubject: 'Research affiliation confirmation',
    };
  }
  return {
    ...common,
    certificateAchievement:
      'outstanding contribution to documented machine intelligence research',
    certificateProgram: 'AmirLab Research Program',
    completionDate: '28 August 2026',
  };
}

function referenceFor(
  kind: DocumentKind,
  date: Date,
  stableKey?: string,
): string {
  const prefix =
    kind === DocumentKind.OFFER
      ? 'OFR'
      : kind === DocumentKind.LETTER
        ? 'LTR'
        : 'CER';
  const suffix = (stableKey ?? randomUUID())
    .replace(/-/g, '')
    .slice(0, 8)
    .toUpperCase();
  return `AMIRL-${prefix}-${date.getUTCFullYear()}-${suffix}`;
}

function formatDate(value: Date | null): string {
  if (!value) return 'As agreed with the lab';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(value);
}

function safeValue(value: string): string {
  return value
    .replace(/[\r\t]+/g, ' ')
    .replace(/[*_`~[\]{}<>]/g, '')
    .replace(/ {2,}/g, ' ')
    .trim();
}

function snapshotToJson(snapshot: StoredSnapshot): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(snapshot)) as Prisma.InputJsonObject;
}

function storedSnapshot(value: Prisma.JsonValue): StoredSnapshot {
  if (!isRecord(value)) throw new Error('Issued document snapshot is invalid');
  const site = isRecord(value.site) ? value.site : {};
  const values = isRecord(value.values) ? value.values : {};
  const offerFacts = Array.isArray(value.offerFacts)
    ? value.offerFacts.flatMap((item) =>
        Array.isArray(item) &&
        typeof item[0] === 'string' &&
        typeof item[1] === 'string'
          ? [[item[0], item[1]] as [string, string]]
          : [],
      )
    : undefined;
  return {
    bodyMarkdown: requiredString(value.bodyMarkdown, 'bodyMarkdown'),
    certificateProgram: optionalString(value.certificateProgram),
    emailSubject: requiredString(value.emailSubject, 'emailSubject'),
    issueDate: requiredString(value.issueDate, 'issueDate'),
    offerFacts,
    recipientName: requiredString(value.recipientName, 'recipientName'),
    reference: requiredString(value.reference, 'reference'),
    site: {
      email: requiredString(site.email, 'site.email'),
      location: requiredString(site.location, 'site.location'),
      url: requiredString(site.url, 'site.url'),
    },
    title: requiredString(value.title, 'title'),
    values: Object.fromEntries(
      Object.entries(values).flatMap(([key, item]) =>
        typeof item === 'string' ? [[key, item]] : [],
      ),
    ),
  };
}

function approverToJson(approver: ApproverSnapshot): Prisma.InputJsonObject {
  return {
    email: approver.email,
    name: approver.name,
    phone: approver.phone,
    signatureAssetId: approver.signatureAssetId,
    title: approver.title,
  };
}

function approverSnapshot(value: Prisma.JsonValue | null): ApproverSnapshot {
  if (!isRecord(value)) return { ...DEFAULT_APPROVER, signatureAssetId: null };
  return {
    email: requiredString(value.email, 'approver.email'),
    name: requiredString(value.name, 'approver.name'),
    phone: requiredString(value.phone, 'approver.phone'),
    signatureAssetId: optionalString(value.signatureAssetId) ?? null,
    title: requiredString(value.title, 'approver.title'),
  };
}

function approverFromValues(values: Record<string, string>): ApproverSnapshot {
  return {
    email: values['approver.email'] || DEFAULT_APPROVER.email,
    name: values['approver.name'] || DEFAULT_APPROVER.name,
    phone: values['approver.phone'] || DEFAULT_APPROVER.phone,
    signatureAssetId: null,
    title: values['approver.title'] || DEFAULT_APPROVER.title,
  };
}

function approverFromPerson(
  person: {
    fullName: string;
    phone: string | null;
    publicEmail: string | null;
    roleTitle: string | null;
    user: { email: string | null } | null;
  },
  signatureAssetId: string | null,
): ApproverSnapshot {
  return {
    email: person.publicEmail || person.user?.email || DEFAULT_APPROVER.email,
    name: person.fullName,
    phone: person.phone || DEFAULT_APPROVER.phone,
    signatureAssetId,
    title: person.roleTitle || DEFAULT_APPROVER.title,
  };
}

function checksum(value: Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function documentFilename(
  kind: DocumentKind,
  recipientName: string | null,
): string {
  return `${filenamePart(recipientName ?? 'recipient')}-${documentLabel(kind).replace(' ', '-')}.pdf`;
}

function documentLabel(kind: DocumentKind): string {
  if (kind === DocumentKind.OFFER) return 'offer letter';
  if (kind === DocumentKind.CERTIFICATE) return 'certificate';
  return 'letter';
}

function filenamePart(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'recipient'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && !Array.isArray(value) && typeof value === 'object';
}

function requiredString(value: unknown, key: string): string {
  if (typeof value !== 'string')
    throw new Error(`Issued document snapshot needs ${key}`);
  return value;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function hasControlCharacter(value: string, allowNewlines = false): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    if (code === 127) return true;
    if (code > 31) return false;
    return !allowNewlines || ![9, 10, 13].includes(code);
  });
}

function recordString(value: unknown, key: string): string {
  if (!isRecord(value) || typeof value[key] !== 'string') {
    throw new Error(`Job payload needs ${key}`);
  }
  return value[key];
}
