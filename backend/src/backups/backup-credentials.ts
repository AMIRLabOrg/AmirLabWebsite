import type { BackupSecrets, BackupSettings } from './backup-storage';
export function mergeSecrets(
  previous: Pick<BackupSettings, 'provider' | 'authentication'> | null,
  next: Pick<BackupSettings, 'provider' | 'authentication'>,
  saved: BackupSecrets,
  input: BackupSecrets,
): BackupSecrets {
  const result: BackupSecrets =
    previous?.provider === next.provider &&
    previous?.authentication === next.authentication
      ? { ...saved }
      : {};
  const keys: (keyof BackupSecrets)[] =
    next.provider === 's3'
      ? ['accessKeyId', 'secretAccessKey']
      : next.provider === 'sftp'
        ? [next.authentication === 'password' ? 'password' : 'privateKey']
        : [];
  for (const key of keys) if (input[key]) result[key] = input[key];
  return Object.fromEntries(
    keys.filter((key) => result[key]).map((key) => [key, result[key]]),
  );
}
