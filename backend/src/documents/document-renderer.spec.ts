import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { DocumentKind } from '../../generated/prisma/client';
import { type ApproverSnapshot, renderDocument } from './document-renderer';

const approver: ApproverSnapshot = {
  email: 'approver@example.org',
  name: 'Example Approver',
  phone: '+8801700000000',
  signatureAssetId: null,
  title: 'Research Director',
};

const site = {
  email: 'hello@example.org',
  location: 'Dhaka, Bangladesh',
  url: 'https://example.org',
};

describe('document PDF rendering', () => {
  it.each([DocumentKind.OFFER, DocumentKind.LETTER, DocumentKind.CERTIFICATE])(
    'renders a valid %s PDF without a signature image',
    async (kind) => {
      const pdf = await renderDocument({
        approver,
        bodyMarkdown: 'This document confirms **a verified contribution**.',
        certificateProgram:
          kind === DocumentKind.CERTIFICATE ? 'Research Program' : undefined,
        issueDate: '28 August 2026',
        kind,
        recipientName: 'Samira Rahman',
        reference: `AMIRL-${kind}-TEST`,
        site,
        title:
          kind === DocumentKind.CERTIFICATE
            ? 'Certificate of achievement'
            : 'Official letter',
      });

      expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
      expect(pdf.length).toBeGreaterThan(10_000);
      expect(pdf.toString('latin1').match(/\/Type \/Page\b/g)).toHaveLength(1);
    },
  );

  it.each([DocumentKind.OFFER, DocumentKind.CERTIFICATE])(
    'renders a signed %s PDF',
    async (kind) => {
      const signature = await readFile(
        resolve(process.cwd(), 'src/applications/brand/amirlab-logo.png'),
      );
      const pdf = await renderDocument({
        approver,
        bodyMarkdown: 'This document is approved for **Research Intern**.',
        certificateProgram:
          kind === DocumentKind.CERTIFICATE ? 'Research Program' : undefined,
        issueDate: '28 August 2026',
        kind,
        recipientName: 'Samira Rahman',
        reference: `AMIRL-${kind}-SIGNED-TEST`,
        signature,
        site,
        title:
          kind === DocumentKind.CERTIFICATE
            ? 'Certificate of achievement'
            : 'Offer letter',
        watermark: signature,
      });

      expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
      expect(pdf.length).toBeGreaterThan(10_000);
      expect(pdf.toString('latin1').match(/\/Type \/Page\b/g)).toHaveLength(1);
    },
  );
});
