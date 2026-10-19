import {
  missingSeedAvatarFiles,
  missingSeedUniversityLogoFiles,
  readSeedData,
} from './seed-data';

async function main() {
  const data = await readSeedData();
  const missingFiles = await missingSeedAvatarFiles(data);
  const missingUniversityLogos = await missingSeedUniversityLogoFiles(data);
  const peopleWithoutSourceImage = data.people.filter(
    (person) => !person.avatarSourceFile,
  );

  if (missingFiles.length || missingUniversityLogos.length) {
    throw new Error(
      [
        ...missingFiles.map(
          (item) => `Missing avatar ${item.slug}: ${item.file}`,
        ),
        ...missingUniversityLogos.map(
          (item) => `Missing university logo ${item.slug}: ${item.file}`,
        ),
      ].join('\n'),
    );
  }

  console.log('[seed] Valid canonical AMIR Lab dataset.');
  console.log(`[seed] Source captured: ${data.source.capturedAt}`);
  console.log(`[seed] Founding members: ${data.foundingMembers.length}`);
  console.log(`[seed] People: ${data.people.length}`);
  console.log(`[seed] Departments: ${data.departments.length}`);
  console.log(`[seed] Academic partners: ${data.universities.length}`);
  console.log(`[seed] Papers: ${data.papers.length}`);
  console.log(`[seed] Projects: ${data.projects.length}`);
  console.log(`[seed] Positions: ${data.positions.length}`);
  console.log(
    `[seed] People without an archived source image: ${peopleWithoutSourceImage.length}`,
  );
  if (peopleWithoutSourceImage.length) {
    console.log(
      peopleWithoutSourceImage
        .map((person) => `  - ${person.fullName}`)
        .join('\n'),
    );
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
