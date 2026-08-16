import { readFile } from 'node:fs/promises';

const [schema, payload, editor, records, types, seedText] = await Promise.all([
  readFile('backend/prisma/schema.prisma', 'utf8'),
  readFile('backend/src/profiles/profile-payload.ts', 'utf8'),
  readFile('frontend/src/components/profile-editor.tsx', 'utf8'),
  readFile('frontend/src/components/profile-records.tsx', 'utf8'),
  readFile('frontend/src/lib/types.ts', 'utf8'),
  readFile('backend/seed/amirl-site.json', 'utf8'),
]);

const checks = [
  ['Prisma entry model exists', /model PersonProfileEntry\s*\{/.test(schema)],
  ['entry label is optional', /label\s+String\?/.test(schema)],
  ['entry content is required', /content\s+String\b/.test(schema)],
  ['subsection owns entry records', /entries\s+PersonProfileEntry\[\]/.test(schema)],
  ['payload validates labeled entries', /function profileEntries\(/.test(payload)],
  ['editor exposes optional entry label', /placeholder="Optional label"/.test(editor)],
  ['public renderer displays entry labels', /entry\.label/.test(records)],
  ['frontend type exposes label and content', /interface ProfileSectionEntry[\s\S]*label: string \| null;[\s\S]*content: string;/.test(types)],
];

const seed = JSON.parse(seedText);
checks.push(['canonical seed uses schema version 4', seed.schemaVersion === 4]);
let allEntriesAreObjects = true;
for (const person of seed.people ?? []) {
  for (const section of person.profileSections ?? []) {
    for (const subsection of section.subsections ?? []) {
      for (const entry of subsection.entries ?? []) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry) || typeof entry.content !== 'string' || !('label' in entry)) {
          allEntriesAreObjects = false;
        }
      }
    }
  }
}
checks.push(['canonical seed entries use object shape', allEntriesAreObjects]);

let profileSeedUsesArrayOrder = true;
for (const person of seed.people ?? []) {
  for (const section of person.profileSections ?? []) {
    if ('sortOrder' in section) profileSeedUsesArrayOrder = false;
    for (const subsection of section.subsections ?? []) {
      if ('sortOrder' in subsection) profileSeedUsesArrayOrder = false;
    }
  }
}
checks.push(['profile seed derives section/subsection order from arrays', profileSeedUsesArrayOrder]);

for (const [name, passed] of checks) {
  if (!passed) throw new Error(`Profile entry label verification failed: ${name}`);
  console.log(`- ${name}`);
}
console.log(`Profile entry label architecture verified (${checks.length}/${checks.length}).`);
