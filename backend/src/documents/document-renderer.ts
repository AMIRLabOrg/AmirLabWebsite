import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import PDFDocument from 'pdfkit';
import { DocumentKind } from '../../generated/prisma/client';

export interface ApproverSnapshot {
  name: string;
  title: string;
  email: string;
  phone: string;
  signatureAssetId: string | null;
}

export interface DocumentSiteSnapshot {
  url: string;
  email: string;
  location: string;
}

export interface RenderDocumentInput {
  kind: DocumentKind;
  title: string;
  bodyMarkdown: string;
  reference: string;
  issueDate: string;
  recipientName: string;
  approver: ApproverSnapshot;
  site: DocumentSiteSnapshot;
  signature?: Buffer;
  watermark?: Buffer;
  offerFacts?: Array<[label: string, value: string]>;
  certificateProgram?: string;
}

type MarkdownBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] };

export async function renderDocument(
  input: RenderDocumentInput,
): Promise<Buffer> {
  const landscape = input.kind === DocumentKind.CERTIFICATE;
  const chunks: Buffer[] = [];
  const document = new PDFDocument({
    autoFirstPage: true,
    bufferPages: true,
    layout: landscape ? 'landscape' : 'portrait',
    margins: { bottom: 42, left: 54, right: 54, top: 54 },
    size: 'A4',
    info: {
      Author: 'AmirLab',
      Title: input.title,
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

  const watermark = input.watermark;
  const drawPageDecoration = () => {
    if (landscape) drawCertificatePaper(document);
    if (watermark) drawWatermark(document, watermark);
  };
  document.on('pageAdded', drawPageDecoration);
  drawPageDecoration();

  if (landscape) drawCertificate(document, input);
  else drawLetter(document, input);
  drawFooters(document, input.site);
  document.end();
  return done;
}

function drawCertificatePaper(document: PDFKit.PDFDocument): void {
  document
    .save()
    .rect(0, 0, document.page.width, document.page.height)
    .fill('#fffdf8')
    .restore();
}

function drawWatermark(document: PDFKit.PDFDocument, logo: Buffer): void {
  const size = Math.min(document.page.width, document.page.height) * 0.78;
  const x = (document.page.width - size) / 2;
  const y = (document.page.height - size) / 2;
  document.save().opacity(0.09).image(logo, x, y, {
    height: size,
    width: size,
  });
  document.restore();
}

function drawLetter(
  document: PDFKit.PDFDocument,
  input: RenderDocumentInput,
): void {
  drawHeader(document, input);
  if (input.offerFacts?.length) drawFacts(document, input.offerFacts);
  renderMarkdown(document, input.bodyMarkdown);
  drawApprover(document, input.approver, input.signature);
}

function drawCertificate(
  document: PDFKit.PDFDocument,
  input: RenderDocumentInput,
): void {
  const { width, height } = document.page;
  document
    .rect(18, 18, width - 36, height - 36)
    .lineWidth(2)
    .stroke('#315bd6');
  document
    .rect(27, 27, width - 54, height - 54)
    .lineWidth(0.7)
    .stroke('#aaa397');
  const brand = brandPaths();
  document.image(brand.logo, 58, 52, { height: 42, width: 42 });
  document.image(brand.wordmark, 110, 57, { width: 135 });
  document
    .font('Meta')
    .fontSize(5.5)
    .fillColor('#646a76')
    .text('Advanced Machine Intelligence Research Lab', 110, 79, {
      characterSpacing: 0.25,
      width: 260,
    });
  document
    .font('Meta')
    .fontSize(8)
    .fillColor('#646a76')
    .text(
      `${input.reference}\n${input.issueDate.toUpperCase()}`,
      width - 260,
      58,
      {
        align: 'right',
        lineGap: 3,
        width: 200,
      },
    );
  document
    .font('Meta')
    .fontSize(9)
    .fillColor('#315bd6')
    .text('CERTIFICATE', 90, 132, {
      align: 'center',
      characterSpacing: 1.7,
      width: width - 180,
    });
  document
    .font('Display')
    .fontSize(34)
    .fillColor('#151a26')
    .text(input.title, 90, 158, { align: 'center', width: width - 180 });
  document
    .font('Meta')
    .fontSize(8)
    .fillColor('#8b8f98')
    .text('PRESENTED TO', 90, 225, {
      align: 'center',
      characterSpacing: 1.2,
      width: width - 180,
    });
  document
    .font('Display')
    .fontSize(29)
    .fillColor('#315bd6')
    .text(input.recipientName, 90, 250, {
      align: 'center',
      width: width - 180,
    });
  if (input.certificateProgram) {
    document
      .font('BodyBold')
      .fontSize(11)
      .fillColor('#646a76')
      .text(input.certificateProgram, 130, 300, {
        align: 'center',
        width: width - 260,
      });
  }
  document.y = input.certificateProgram ? 336 : 310;
  document.x = 145;
  renderMarkdown(document, input.bodyMarkdown, {
    align: 'center',
    bottom: 380,
    width: width - 290,
  });
  document.y = Math.max(document.y + 16, input.signature ? 375 : 405);
  drawApprover(document, input.approver, input.signature, {
    allowPageBreak: false,
    centered: true,
    width: 220,
    x: (width - 220) / 2,
  });
}

function drawHeader(
  document: PDFKit.PDFDocument,
  input: RenderDocumentInput,
): void {
  const brand = brandPaths();
  document.rect(0, 0, document.page.width, 7).fill('#315bd6');
  document.image(brand.logo, 54, 34, { height: 34, width: 34 });
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
    .text(`${input.reference}\n${input.issueDate.toUpperCase()}`, 370, 38, {
      align: 'right',
      lineGap: 3,
      width: 171,
    });
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
    .text(input.kind, 54, 106, { characterSpacing: 1.1 });
  document
    .font('Display')
    .fontSize(28)
    .fillColor('#151a26')
    .text(input.title, 54, 124, {
      width: 487,
    });
  document.moveDown(0.2);
  document
    .font('Body')
    .fontSize(10)
    .fillColor('#646a76')
    .text(input.recipientName, 54, document.y, { width: 487 });
  document.y += 30;
}

function drawFacts(
  document: PDFKit.PDFDocument,
  facts: Array<[label: string, value: string]>,
): void {
  const top = document.y;
  const items = facts.slice(0, 3);
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
      .text(label.toUpperCase(), x + 10, top + 10, { width: width - 20 });
    document
      .font('BodyBold')
      .fontSize(9.5)
      .fillColor('#151a26')
      .text(value, x + 10, top + 27, { width: width - 20 });
  });
  document
    .moveTo(54, top + 50)
    .lineTo(541, top + 50)
    .stroke();
  document.x = 54;
  document.y = top + 74;
}

function renderMarkdown(
  document: PDFKit.PDFDocument,
  markdown: string,
  options: { align?: 'center'; bottom?: number; width?: number } = {},
): void {
  const left = document.x || 54;
  const width = options.width ?? document.page.width - left - 54;
  for (const block of parseMarkdown(markdown)) {
    if (options.bottom && document.y > options.bottom) break;
    if (!options.bottom) ensureSpace(document, block.type === 'list' ? 55 : 35);
    document.x = left;
    if (block.type === 'heading') {
      document.moveDown(0.5);
      document
        .font('Meta')
        .fontSize(8)
        .fillColor('#315bd6')
        .text(plainInline(block.text).toUpperCase(), {
          align: options.align,
          width,
        });
      document.moveDown(0.5);
    } else if (block.type === 'paragraph') {
      drawInline(document, block.text, options.align, width);
      document.moveDown(0.8);
    } else {
      block.items.forEach((item, index) => {
        const prefix = block.ordered ? `${index + 1}.` : '•';
        const itemY = document.y;
        document
          .font('Meta')
          .fontSize(8)
          .fillColor('#315bd6')
          .text(prefix, left + 4, itemY + 1, {
            lineBreak: false,
            width: 16,
          });
        document
          .font('Body')
          .fontSize(9.5)
          .fillColor('#151a26')
          .text(plainInline(item), left + 22, itemY, {
            lineGap: 2.5,
            width: width - 22,
          });
        document.moveDown(0.35);
      });
      document.moveDown(0.45);
    }
  }
}

function drawInline(
  document: PDFKit.PDFDocument,
  value: string,
  align: 'center' | undefined,
  width: number,
): void {
  if (align === 'center') {
    document
      .font('Body')
      .fontSize(10)
      .fillColor('#151a26')
      .text(plainInline(value), { align, lineGap: 3.2, width });
    return;
  }
  const parts = value.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  parts.forEach((part, index) => {
    const bold = part.startsWith('**') && part.endsWith('**');
    document
      .font(bold ? 'BodyBold' : 'Body')
      .fontSize(10)
      .fillColor('#151a26')
      .text(inlineText(bold ? part.slice(2, -2) : part), {
        align,
        continued: index < parts.length - 1,
        lineGap: 3.2,
        width,
      });
  });
}

function drawApprover(
  document: PDFKit.PDFDocument,
  approver: ApproverSnapshot,
  signature?: Buffer,
  options: {
    allowPageBreak?: boolean;
    centered?: boolean;
    width?: number;
    x?: number;
  } = {},
): void {
  const x = options.x ?? 54;
  const width = options.width ?? 220;
  if (options.allowPageBreak !== false)
    ensureSpace(document, signature ? 136 : 112);
  document.moveDown(0.6);
  let ruleWidth = width;
  let ruleX = x;
  if (signature) {
    const dimensions = pngDimensions(signature);
    const scale = Math.min(74 / dimensions.width, 34 / dimensions.height);
    const signatureWidth = dimensions.width * scale;
    const signatureHeight = dimensions.height * scale;
    const signatureX = options.centered ? x + (width - signatureWidth) / 2 : x;
    document.image(signature, signatureX, document.y, {
      height: signatureHeight,
      width: signatureWidth,
    });
    document.y += signatureHeight + 4;
    ruleWidth = signatureWidth;
    ruleX = signatureX;
  }
  document
    .moveTo(ruleX, document.y)
    .lineTo(ruleX + ruleWidth, document.y)
    .lineWidth(1)
    .strokeColor('#315bd6')
    .stroke();
  document.moveDown(1.1);
  const text = {
    align: options.centered ? ('center' as const) : ('left' as const),
    width,
  };
  document
    .font('Display')
    .fontSize(14)
    .fillColor('#151a26')
    .text(approver.name, x, document.y, text);
  document
    .font('BodyBold')
    .fontSize(8.5)
    .fillColor('#646a76')
    .text(approver.title, x, document.y, text);
  document
    .font('Meta')
    .fontSize(7.5)
    .fillColor('#646a76')
    .text(`${approver.email}  ·  ${approver.phone}`, x, document.y, {
      ...text,
      lineGap: 2,
    });
}

function pngDimensions(image: Buffer): { height: number; width: number } {
  const isPng =
    image.length >= 24 &&
    image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (!isPng) throw new Error('Document signature must be a normalized PNG');
  return {
    height: image.readUInt32BE(20),
    width: image.readUInt32BE(16),
  };
}

function drawFooters(
  document: PDFKit.PDFDocument,
  site: DocumentSiteSnapshot,
): void {
  const range = document.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    document.switchToPage(index);
    const y = document.page.height - 66;
    document
      .moveTo(54, y)
      .lineTo(document.page.width - 54, y)
      .lineWidth(0.6)
      .strokeColor('#d8d3c8')
      .stroke();
    document
      .font('Meta')
      .fontSize(7)
      .fillColor('#646a76')
      .text(
        `${site.url.replace(/^https?:\/\//, '')}  ·  ${site.email}  ·  ${site.location}`,
        54,
        y + 12,
        {
          width: document.page.width - 108,
        },
      );
  }
}

function parseMarkdown(value: string): MarkdownBlock[] {
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
      blocks.push({ text: heading[1], type: 'heading' });
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
      if (/^#{1,6}\s+/.test(next) || /^(?:(\d+)\.|[-+*])\s+/.test(next)) break;
      paragraph.push(next);
      index += 1;
    }
    blocks.push({ text: paragraph.join(' '), type: 'paragraph' });
  }
  return blocks;
}

function ensureSpace(document: PDFKit.PDFDocument, height: number): void {
  if (document.y + height <= document.page.height - 72) return;
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

function brandPaths(): { logo: string; wordmark: string } {
  return {
    logo: assetPath('amirlab-logo.png'),
    wordmark: assetPath('amirlab-wordmark.png'),
  };
}

function fontPaths() {
  return {
    display: assetPath('Fraunces.ttf'),
    body: assetPath('IBMPlexSans.ttf'),
    bodyBold: assetPath('IBMPlexSans.ttf'),
    meta: assetPath('IBMPlexMono.ttf'),
  };
}

function assetPath(name: string): string {
  const paths = [
    resolve(__dirname, '..', 'applications', 'brand', name),
    resolve(process.cwd(), 'dist', 'applications', 'brand', name),
    resolve(process.cwd(), 'src', 'applications', 'brand', name),
  ];
  const path = paths.find(existsSync);
  if (!path) throw new Error(`Document asset is missing: ${name}`);
  return path;
}
