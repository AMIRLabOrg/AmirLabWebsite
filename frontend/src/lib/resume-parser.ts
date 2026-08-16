export interface ParsedResume {
  parser: "pdfjs-layout-v2";
  profile: {
    fullName: string | null;
    email: string | null;
    phone: string | null;
  };
  sections: Record<string, string[]>;
  textLength: number;
  pageCount: number;
}

export interface ResumeParseResult {
  resume: ParsedResume;
  likelyAtsFriendly: boolean;
  feedback: string;
  profileImage: Blob | null;
}

type ResumeTextParseResult = Omit<ResumeParseResult, "profileImage">;

interface PositionedText {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ResumeLine {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  page: number;
}

interface PdfImage {
  bitmap?: CanvasImageSource;
  data?: Uint8Array | Uint8ClampedArray;
  height: number;
  kind?: number;
  width: number;
}

interface PdfImageCandidate extends PdfImage {
  score: number;
}

const MIN_SELECTABLE_TEXT_LENGTH = 300;

const SECTION_ALIASES: Record<string, string> = {
  "about me": "summary",
  "academic background": "education",
  "academic projects": "projects",
  "academic qualifications": "education",
  achievements: "achievements",
  awards: "awards",
  "awards and honors": "awards",
  certifications: "certifications",
  "career objective": "summary",
  competencies: "skills",
  education: "education",
  "educational background": "education",
  employment: "experience",
  "employment history": "experience",
  experience: "experience",
  internships: "experience",
  languages: "languages",
  objective: "summary",
  "open source contribution": "open-source",
  "open source contributions": "open-source",
  "personal projects": "projects",
  profile: "summary",
  projects: "projects",
  "professional experience": "experience",
  "professional summary": "summary",
  publications: "publications",
  "research experience": "research",
  research: "research",
  references: "references",
  skills: "skills",
  "selected publications": "publications",
  summary: "summary",
  "technical skills": "skills",
  technologies: "skills",
  "volunteer experience": "volunteering",
  volunteering: "volunteering",
  "work experience": "experience",
  "work history": "experience",
};

const ATS_SECTIONS = new Set([
  "education",
  "experience",
  "skills",
  "projects",
  "publications",
  "research",
]);

export async function parseResumeFile(file: File): Promise<ResumeParseResult> {
  if (
    file.type !== "application/pdf" ||
    !file.name.toLowerCase().endsWith(".pdf")
  ) {
    throw new Error("Choose a PDF file.");
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("PDF must be 8 MB or smaller.");
  }

  const pdfjs =
    typeof window === "undefined"
      ? await import("pdfjs-dist/legacy/build/pdf.mjs")
      : await import("pdfjs-dist");
  if (typeof window !== "undefined") {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
  }
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
  });
  const document = await loadingTask.promise;
  const pageCount = document.numPages;
  const lines: ResumeLine[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const viewport = page.getViewport({ scale: 1 });
      lines.push(
        ...reconstructPageLines(
          content.items as unknown[],
          pageNumber,
          viewport.width,
        ),
      );
    }

    const result = parseResumeLines(lines, pageCount);
    if (result.resume.textLength < MIN_SELECTABLE_TEXT_LENGTH) {
      throw new Error(
        "Scanned or image-only PDFs are not accepted. Export a digital PDF with selectable text.",
      );
    }
    let profileImage: Blob | null = null;
    try {
      profileImage = await extractProfileImage(
        await document.getPage(1),
        pdfjs.OPS,
        pdfjs.ImageKind,
      );
    } catch {
      // A valid text PDF remains acceptable when an embedded image uses an unsupported encoding.
    }
    return { ...result, profileImage };
  } finally {
    await loadingTask.destroy();
  }
}

async function extractProfileImage(
  page: {
    commonObjs: { get(id: string, callback: (value: unknown) => void): void };
    getOperatorList(): Promise<{ argsArray: unknown[][]; fnArray: number[] }>;
    objs: { get(id: string, callback: (value: unknown) => void): void };
  },
  operations: {
    paintImageXObject: number;
    paintInlineImageXObject: number;
  },
  imageKinds: {
    RGB_24BPP: number;
    RGBA_32BPP: number;
  },
): Promise<Blob | null> {
  const operatorList = await page.getOperatorList();
  const images: PdfImageCandidate[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < operatorList.fnArray.length; index += 1) {
    const operation = operatorList.fnArray[index];
    const args = operatorList.argsArray[index];
    let value: unknown;
    if (operation === operations.paintInlineImageXObject) {
      value = args[0];
    } else if (operation === operations.paintImageXObject) {
      const id = args[0];
      if (typeof id !== "string" || seen.has(id)) continue;
      seen.add(id);
      value = await new Promise((resolve) =>
        (id.startsWith("g_") ? page.commonObjs : page.objs).get(id, resolve),
      );
    } else {
      continue;
    }

    const image = asProfileImageCandidate(value);
    if (image) images.push(image);
  }

  images.sort((left, right) => right.score - left.score);
  return images[0] ? imageToJpeg(images[0], imageKinds) : null;
}

function asProfileImageCandidate(value: unknown): PdfImageCandidate | null {
  if (!value || typeof value !== "object") return null;
  const image = value as Partial<PdfImage>;
  const width = Number(image.width);
  const height = Number(image.height);
  const ratio = width / height;
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width < 100 ||
    height < 100 ||
    width * height < 20_000 ||
    width * height > 16_000_000 ||
    ratio < 0.55 ||
    ratio > 1.2 ||
    (!image.bitmap && !image.data)
  ) {
    return null;
  }
  return {
    ...image,
    height,
    score:
      Math.min(width * height, 1_000_000) * (1 - Math.abs(ratio - 0.82) * 0.35),
    width,
  };
}

async function imageToJpeg(
  image: PdfImage,
  imageKinds: { RGB_24BPP: number; RGBA_32BPP: number },
): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d");
  if (!context) return null;

  if (image.bitmap) {
    context.drawImage(image.bitmap, 0, 0, image.width, image.height);
  } else if (image.data && image.kind === imageKinds.RGBA_32BPP) {
    context.putImageData(
      new ImageData(
        new Uint8ClampedArray(image.data),
        image.width,
        image.height,
      ),
      0,
      0,
    );
  } else if (image.data && image.kind === imageKinds.RGB_24BPP) {
    const rgba = new Uint8ClampedArray(image.width * image.height * 4);
    for (let source = 0, target = 0; source < image.data.length; source += 3) {
      rgba[target++] = image.data[source];
      rgba[target++] = image.data[source + 1];
      rgba[target++] = image.data[source + 2];
      rgba[target++] = 255;
    }
    context.putImageData(new ImageData(rgba, image.width, image.height), 0, 0);
  } else {
    return null;
  }

  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
}

function reconstructPageLines(
  items: unknown[],
  page: number,
  pageWidth: number,
): ResumeLine[] {
  const positioned = items.flatMap((value): PositionedText[] => {
    if (!value || typeof value !== "object" || !("str" in value)) return [];
    const item = value as {
      str: unknown;
      width?: unknown;
      height?: unknown;
      transform?: unknown;
    };
    if (typeof item.str !== "string" || !item.str.trim()) return [];
    if (!Array.isArray(item.transform) || item.transform.length < 6) return [];
    const [scaleX, , , scaleY, x, y] = item.transform.map(Number);
    if (![x, y].every(Number.isFinite)) return [];
    return [
      {
        text: item.str.replace(/[\u0000-\u001f]/g, " "),
        x,
        y,
        width: Number(item.width) || 0,
        height:
          Number(item.height) || Math.abs(scaleY) || Math.abs(scaleX) || 10,
      },
    ];
  });
  positioned.sort((left, right) => right.y - left.y || left.x - right.x);

  const rows: PositionedText[][] = [];
  for (const item of positioned) {
    const row = rows.at(-1);
    const baseline = row?.[0];
    const tolerance = baseline
      ? Math.max(2, Math.min(baseline.height, item.height) * 0.3)
      : 0;
    if (row && baseline && Math.abs(baseline.y - item.y) <= tolerance) {
      row.push(item);
    } else {
      rows.push([item]);
    }
  }

  return rows.flatMap((row) => {
    row.sort((left, right) => left.x - right.x);
    const segments: PositionedText[][] = [];
    for (const item of row) {
      const segment = segments.at(-1);
      const previous = segment?.at(-1);
      const gap = previous ? item.x - (previous.x + previous.width) : 0;
      if (segment && previous && gap <= Math.max(32, pageWidth * 0.07)) {
        segment.push(item);
      } else {
        segments.push([item]);
      }
    }

    return segments.flatMap((segment): ResumeLine[] => {
      const text = joinTextItems(segment);
      if (!text) return [];
      return [
        {
          text,
          x: segment[0].x,
          y: Math.max(...segment.map((item) => item.y)),
          fontSize: Math.max(...segment.map((item) => item.height)),
          page,
        },
      ];
    });
  });
}

function joinTextItems(items: PositionedText[]): string {
  let text = "";
  let right = 0;
  for (const item of items) {
    const value = item.text.replace(/\s+/g, " ");
    if (!value.trim()) continue;
    const averageCharacterWidth = item.width / Math.max(item.text.length, 1);
    if (
      text &&
      !text.endsWith(" ") &&
      !value.startsWith(" ") &&
      item.x - right > Math.max(1.5, averageCharacterWidth * 0.3)
    ) {
      text += " ";
    }
    text += value;
    right = item.x + item.width;
  }
  return text.replace(/\s+/g, " ").trim();
}

function parseResumeLines(
  lines: ResumeLine[],
  pageCount: number,
): ResumeTextParseResult {
  const text = lines.map((line) => line.text).join("\n");
  const sections: Record<string, string[]> = { profile: [] };
  let currentSection = "profile";
  for (const line of lines) {
    const heading = sectionName(line.text);
    if (heading) {
      currentSection = heading;
      sections[currentSection] ??= [];
    } else {
      sections[currentSection].push(line.text);
    }
  }

  const email = findEmail(text);
  const phone = findPhone(lines);
  const fullName = findCandidateName(lines);
  const recognizedSections = Object.keys(sections).filter(
    (name) => ATS_SECTIONS.has(name) && sections[name].length > 0,
  ).length;
  const failures = [
    text.replace(/\s+/g, " ").trim().length < MIN_SELECTABLE_TEXT_LENGTH
      ? "Too little selectable text was found."
      : null,
    !email ? "No readable email address was found." : null,
    !fullName
      ? "No readable name was found near the top of the document."
      : null,
    recognizedSections < 2
      ? "Use clear headings such as Education, Experience, Skills, Projects, or Publications."
      : null,
  ].filter((message): message is string => message !== null);

  return {
    resume: {
      parser: "pdfjs-layout-v2",
      profile: { email, fullName, phone },
      sections,
      textLength: text.length,
      pageCount,
    },
    likelyAtsFriendly: failures.length === 0,
    feedback:
      failures.length === 0
        ? "Readable contact information and standard sections detected."
        : failures.join(" "),
  };
}

function sectionName(value: string): string | undefined {
  return SECTION_ALIASES[normalizeHeading(value)];
}

function normalizeHeading(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}& ]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function findEmail(text: string): string | null {
  const normalized = text
    .replace(/\s*@\s*/g, "@")
    .replace(/\s+\.\s+(?=[A-Za-z]{2,}\b)/g, ".");
  return (
    normalized.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null
  );
}

function findPhone(lines: ResumeLine[]): string | null {
  const candidates = lines.slice(0, 40).flatMap((line, index) =>
    [
      ...line.text.matchAll(/(?:(?:\+?\d)|(?:\(\d{2,4}\)))[\d .()/-]{6,}\d/g),
    ].flatMap((match) => {
      const value = match[0].trim();
      const digits = value.replace(/\D/g, "");
      if (digits.length < 8 || digits.length > 15) return [];
      const score =
        (value.startsWith("+") ? 5 : 0) +
        (/\b(?:mobile|phone|tel|cell)\b/i.test(line.text) ? 4 : 0) -
        index * 0.1;
      return [{ value, score }];
    }),
  );
  candidates.sort((left, right) => right.score - left.score);
  return candidates[0]?.value ?? null;
}

function findCandidateName(lines: ResumeLine[]): string | null {
  const firstPage = lines.filter((line) => line.page === 1);
  const firstHeading = firstPage.findIndex((line) => sectionName(line.text));
  const candidates = firstPage.slice(
    0,
    firstHeading > 0 ? Math.min(firstHeading, 30) : 30,
  );
  const medianFontSize = median(candidates.map((line) => line.fontSize)) || 10;

  const scored = candidates.flatMap((source, index) => {
    const line = stripContactDetails(source.text).replace(/\s+/g, " ").trim();
    const words = line.split(" ");
    const normalized = normalizeHeading(line);
    const letterCount = [...line].filter((character) =>
      /\p{L}/u.test(character),
    ).length;
    if (
      line.length < 3 ||
      line.length > 80 ||
      words.length > 7 ||
      SECTION_ALIASES[normalized] ||
      ["cv", "curriculum vitae", "resume"].includes(normalized) ||
      /[@\d]|https?:|www\.|linkedin|github|portfolio/i.test(line) ||
      letterCount < Math.max(3, line.length * 0.55) ||
      !/^[\p{L}][\p{L}.'’ -]+$/u.test(line)
    ) {
      return [];
    }

    const titleCaseWords = words.filter((word) =>
      /^[\p{Lu}][\p{L}.'’_-]*$/u.test(word),
    ).length;
    const rolePenalty =
      /\b(?:engineer|developer|researcher|scientist|student|manager|analyst|architect|professor|consultant)\b/i.test(
        line,
      )
        ? 8
        : 0;
    const score =
      (source.fontSize / medianFontSize) * 8 +
      (titleCaseWords / words.length) * 3 +
      (words.length >= 2 && words.length <= 5 ? 2 : 0) -
      index * 0.35 -
      rolePenalty;
    return [{ line, score }];
  });
  scored.sort((left, right) => right.score - left.score);
  return scored[0]?.line ?? null;
}

function stripContactDetails(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+\s*@\s*[A-Z0-9.-]+\s*\.\s*[A-Z]{2,}/gi, " ")
    .replace(/(?:(?:\+?\d)|(?:\(\d{2,4}\)))[\d .()/-]{6,}\d/g, " ")
    .replace(/\b(?:linkedin|github|portfolio|website)\b/gi, " ")
    .replace(/[|•·#§]/g, " ");
}

function median(values: number[]): number {
  const sorted = values
    .filter(Number.isFinite)
    .sort((left, right) => left - right);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}
