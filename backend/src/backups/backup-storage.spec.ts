import { validateSnapshot, validateSettings } from './backup-storage';
const id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const snapshot = {
  version: 1,
  id,
  createdAt: '2026-10-12T00:00:00Z',
  database: 'test',
  files: { 'database.dump': 'a'.repeat(64) },
};
describe('Backup trust boundaries', () => {
  it('accepts legacy local settings', () => {
    expect(
      validateSettings({
        directory: '/tmp/backups',
        enabled: false,
        intervalMinutes: 60,
      }).provider,
    ).toBe('local');
  });
  it.each([
    '../escape',
    '/absolute',
    'uploads/../../escape',
    'uploads/evil\nname',
    'uploads\\evil',
    'manifest.json',
  ])('rejects unsafe manifest path %s before transfer', (path) => {
    expect(() =>
      validateSnapshot(
        { ...snapshot, files: { ...snapshot.files, [path]: 'a'.repeat(64) } },
        id,
      ),
    ).toThrow('verification');
  });
  it('rejects bad hashes and unknown providers', () => {
    expect(() =>
      validateSnapshot(
        { ...snapshot, files: { 'database.dump': 'wrong' } },
        id,
      ),
    ).toThrow('verification');
    expect(() =>
      validateSettings({
        provider: 'ftp' as never,
        enabled: false,
        intervalMinutes: 60,
      }),
    ).toThrow();
  });
  it('requires pinned SFTP host keys and a secure S3 endpoint', () => {
    expect(() =>
      validateSettings({
        provider: 'sftp',
        host: 'example.com',
        username: 'backup',
        remoteDirectory: '/backups',
        port: 22,
        authentication: 'password',
        enabled: false,
        intervalMinutes: 60,
      }),
    ).toThrow();
    expect(() =>
      validateSettings({
        provider: 's3',
        bucket: 'bucket',
        region: 'us-east-1',
        endpoint: 'http://example.com',
        prefix: '',
        forcePathStyle: false,
        enabled: false,
        intervalMinutes: 60,
      }),
    ).toThrow();
  });
});
it('rejects non-string manifest dates before status sorting', () => {
  expect(() => validateSnapshot({ ...snapshot, createdAt: 0 }, id)).toThrow(
    'verification',
  );
});
