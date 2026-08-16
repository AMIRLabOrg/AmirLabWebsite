import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const failures = [];
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const expect = (condition, message) => { if (!condition) failures.push(message); };

const schema = read('prisma/schema.prisma');
const auth = read('src/auth/auth.service.ts');
const controller = read('src/auth/auth.controller.ts');
const research = read('src/research/research.service.ts');
const relationships = read('src/research/research-relationships.service.ts');
const sync = read('src/research/research-profile-sync.service.ts');
const profiles = read('src/profiles/profiles.service.ts');
const sourceMetadata = read('src/research/source-metadata.ts');
const discovery = read('src/research/research-discovery.service.ts');
const rebuild = read('scripts/rebuild-db.ts');
const envExample = read('.env.example');

expect(schema.includes('model PasswordResetToken'), 'PasswordResetToken model is missing.');
expect(schema.includes('userId    String   @unique'), 'Password reset must keep one active row per user.');
expect(auth.includes("randomBytes(32).toString('base64url')"), 'Password reset token must be cryptographically random.');
expect(auth.includes("createHash('sha256')"), 'Only a hash of the reset token should be persisted.');
expect(auth.includes('passwordResetToken.upsert'), 'A new reset request must replace the prior active reset.');
expect(auth.includes('expiresAt <= now'), 'Expired reset links must be rejected.');
expect(auth.includes('passwordResetToken.deleteMany'), 'Expired/used reset rows must be removed opportunistically.');
expect(auth.includes('session.updateMany'), 'A successful password reset must revoke active sessions.');
expect(auth.includes('mail.sendNow'), 'Reset secrets must be sent without entering the persisted mail queue.');
expect(auth.includes('/reset-password#token='), 'Password-reset tokens must stay in the URL fragment instead of server-visible query parameters.');
expect(auth.includes('where: { userId: user.id, tokenHash }'), 'Undelivered reset tokens must be removed without deleting a newer concurrent request.');
expect(controller.includes("@Post('password-reset/request')"), 'Password reset request endpoint is missing.');
expect(controller.includes("@Post('password-reset/complete')"), 'Password reset completion endpoint is missing.');
expect(controller.includes('@Throttle'), 'Password reset endpoints must have explicit throttling.');
expect(envExample.includes('PASSWORD_RESET_MINUTES=10'), 'Reset expiry configuration is missing from .env.example.');
expect(envExample.includes('SMTP_HOST=mail.smtp2go.com'), 'SMTP2GO example configuration is missing.');

for (const base of ['src', 'scripts']) {
  for (const file of walk(path.join(root, base))) {
    if (!file.endsWith('.ts')) continue;
    expect(!fs.readFileSync(file, 'utf8').includes('$transaction(['), `${path.relative(root, file)} still uses concurrent array transactions.`);
  }
}

expect(research.includes('CANONICAL_SOURCE_MISSING'), 'Missing canonical source must be a structured review state.');
expect(research.includes('!item.canonicalUrl'), 'Research review must guard source discovery without a canonical URL.');
expect(!sourceMetadata.includes('personNameOverlapHint'), 'Weak one-token contributor overlap logic must remain removed.');
expect(discovery.includes('id: match.id'), 'Canonical contributor refresh must preserve existing match identities and review decisions.');
expect(discovery.includes('createdAt: match.createdAt'), 'Canonical contributor refresh must preserve match chronology.');
expect(sync.includes('normalizePublishedOutputs'), 'Canonical research/profile normalization service is missing.');
expect(sync.includes('normalizePublishedOutputsForPeople'), 'Profile approval must be able to normalize against existing canonical outputs.');
expect(research.includes('profileSync.normalizePublishedOutputs'), 'Publishing research must normalize duplicate manual profile outputs.');
expect(relationships.includes('profileSync.normalizePublishedOutputs'), 'Contributor linking must normalize duplicate manual profile outputs.');
expect(profiles.includes('profileSync.normalizePublishedOutputsForPeople'), 'Profile approval must not reintroduce canonical-output duplicates.');
expect(rebuild.includes('publicEmail: adminEmail'), 'Seeded admin profile email must use the login email.');
expect(!rebuild.includes('sourceSnapshot: {\n                  create:'), 'Seed rebuild must not create false PENDING source checks without jobs.');
expect(rebuild.includes("matchReason: 'Imported identity'"), 'Seeded contributor matches should use concise identity metadata.');

if (failures.length) {
  console.error('Recovery/research-sync verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Password recovery, source-review, transaction, and profile-sync contracts verified.');

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}
