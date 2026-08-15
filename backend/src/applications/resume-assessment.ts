export interface ParsedResumeText {
  parser: 'backend-text-v2';
  profile: {
    fullName: string | null;
    email: string | null;
    phone: string | null;
  };
  sections: Record<string, string[]>;
  textLength: number;
  pageCount: number;
}

export interface ResumeAssessment {
  accepted: boolean;
  feedback: string;
  resume: ParsedResumeText;
}

const SECTION_ALIASES: Record<string, string> = {
  'about me': 'summary',
  'academic background': 'education',
  'academic projects': 'projects',
  'academic qualifications': 'education',
  achievements: 'achievements',
  awards: 'awards',
  'awards and honors': 'awards',
  certifications: 'certifications',
  'career objective': 'summary',
  competencies: 'skills',
  education: 'education',
  'educational background': 'education',
  employment: 'experience',
  'employment history': 'experience',
  experience: 'experience',
  internships: 'experience',
  languages: 'languages',
  objective: 'summary',
  'open source contribution': 'open-source',
  'open source contributions': 'open-source',
  'personal projects': 'projects',
  profile: 'summary',
  projects: 'projects',
  'professional experience': 'experience',
  'professional summary': 'summary',
  publications: 'publications',
  'research experience': 'research',
  research: 'research',
  references: 'references',
  skills: 'skills',
  'selected publications': 'publications',
  summary: 'summary',
  'technical skills': 'skills',
  technologies: 'skills',
  'volunteer experience': 'volunteering',
  volunteering: 'volunteering',
  'work experience': 'experience',
  'work history': 'experience',
};

const ATS_SECTIONS = new Set([
  'education',
  'experience',
  'skills',
  'projects',
  'publications',
  'research',
]);

export function assessResumeText(
  text: string,
  pageCount = 0,
): ResumeAssessment {
  const resume = parseResumeText(text, pageCount);
  const normalized = text.replace(/\s+/g, ' ').trim();
  const failures: string[] = [];
  if (normalized.length < 300) {
    failures.push(
      'The PDF contains too little selectable text. Avoid scanned images.',
    );
  }
  if (!resume.profile.email) {
    failures.push('No readable email address was found in the PDF.');
  }
  if (!resume.profile.fullName) {
    failures.push('No readable applicant name was found near the top.');
  }

  const structuredSectionCount = Object.keys(resume.sections).filter(
    (name) => ATS_SECTIONS.has(name) && resume.sections[name].length > 0,
  ).length;
  const inlineSectionCount = [
    /\beducation\b/i,
    /\b(experience|employment)\b/i,
    /\bskills?\b/i,
    /\bprojects?\b/i,
    /\b(publications?|research)\b/i,
  ].filter((pattern) => pattern.test(normalized)).length;
  const sectionCount = Math.max(structuredSectionCount, inlineSectionCount);
  if (sectionCount < 2) {
    failures.push(
      'Use clear section headings such as Education, Experience, Skills, Projects, or Publications.',
    );
  }

  return {
    accepted: failures.length === 0,
    feedback:
      failures.length === 0
        ? 'Readable contact information and standard resume sections detected.'
        : failures.join(' '),
    resume,
  };
}

export function parseResumeText(text: string, pageCount = 0): ParsedResumeText {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const sections: Record<string, string[]> = { profile: [] };
  let currentSection = 'profile';
  for (const line of lines) {
    const heading = SECTION_ALIASES[normalizeHeading(line)];
    if (heading) {
      currentSection = heading;
      sections[currentSection] ??= [];
    } else {
      sections[currentSection].push(line);
    }
  }

  return {
    parser: 'backend-text-v2',
    profile: {
      fullName: findCandidateName(lines),
      email: findEmail(text),
      phone: findPhone(lines),
    },
    sections,
    textLength: text.length,
    pageCount,
  };
}

function normalizeHeading(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}& ]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function findEmail(text: string): string | null {
  const normalized = text
    .replace(/\s*@\s*/g, '@')
    .replace(/\s+\.\s+(?=[A-Za-z]{2,}\b)/g, '.');
  return (
    normalized.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null
  );
}

function findPhone(lines: string[]): string | null {
  const candidates = lines.slice(0, 40).flatMap((line, index) =>
    [
      ...line.matchAll(/(?:(?:\+?\d)|(?:\(\d{2,4}\)))[\d .()/-]{6,}\d/g),
    ].flatMap((match) => {
      const value = match[0].trim();
      const digits = value.replace(/\D/g, '');
      if (digits.length < 8 || digits.length > 15) return [];
      const score =
        (value.startsWith('+') ? 5 : 0) +
        (/\b(?:mobile|phone|tel|cell)\b/i.test(line) ? 4 : 0) -
        index * 0.1;
      return [{ value, score }];
    }),
  );
  candidates.sort((left, right) => right.score - left.score);
  return candidates[0]?.value ?? null;
}

function findCandidateName(lines: string[]): string | null {
  const firstHeading = lines.findIndex(
    (line) => SECTION_ALIASES[normalizeHeading(line)],
  );
  const candidates = lines.slice(
    0,
    firstHeading > 0 ? Math.min(firstHeading, 30) : 30,
  );
  const scored = candidates.flatMap((source, index) => {
    const firstDigit = source.search(/\d/);
    const identityText = firstDigit > 2 ? source.slice(0, firstDigit) : source;
    const line = stripContactDetails(identityText).replace(/\s+/g, ' ').trim();
    const words = line.split(' ');
    const normalized = normalizeHeading(line);
    const letterCount = [...line].filter((character) =>
      /\p{L}/u.test(character),
    ).length;
    if (
      line.length < 3 ||
      line.length > 80 ||
      words.length > 7 ||
      SECTION_ALIASES[normalized] ||
      ['cv', 'curriculum vitae', 'resume'].includes(normalized) ||
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
    .replace(/[A-Z0-9._%+-]+\s*@\s*[A-Z0-9.-]+\s*\.\s*[A-Z]{2,}/gi, ' ')
    .replace(/(?:(?:\+?\d)|(?:\(\d{2,4}\)))[\d .()/-]{6,}\d/g, ' ')
    .replace(/\b(?:linkedin|github|portfolio|website)\b/gi, ' ')
    .replace(/[|•·#§]/g, ' ');
}
