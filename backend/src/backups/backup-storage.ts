/* eslint-disable no-control-regex -- Reject control characters at backup trust boundaries. */
import { BadRequestException } from '@nestjs/common';
export type BackupProvider = 'local' | 's3' | 'sftp';
export interface BackupSettings {
  provider?: BackupProvider;
  enabled: boolean;
  intervalMinutes: number;
  directory?: string;
  bucket?: string;
  region?: string;
  endpoint?: string;
  prefix?: string;
  forcePathStyle?: boolean;
  host?: string;
  port?: number;
  username?: string;
  remoteDirectory?: string;
  hostKey?: string;
  authentication?: 'privateKey' | 'password';
}
export type LocalBackupSettings = BackupSettings & {
  provider: 'local';
  directory: string;
};
export type S3BackupSettings = BackupSettings & {
  provider: 's3';
  bucket: string;
  region: string;
  endpoint: string;
  prefix: string;
  forcePathStyle: boolean;
};
export type SftpBackupSettings = BackupSettings & {
  provider: 'sftp';
  host: string;
  port: number;
  username: string;
  remoteDirectory: string;
  hostKey: string;
  authentication: 'privateKey' | 'password';
};
export type ValidatedBackupSettings =
  LocalBackupSettings | S3BackupSettings | SftpBackupSettings;
export interface BackupSecrets {
  accessKeyId?: string;
  secretAccessKey?: string;
  privateKey?: string;
  password?: string;
}
export interface Snapshot {
  version: 1;
  purpose?: 'manual' | 'scheduled' | 'safety';
  id: string;
  createdAt: string;
  database: string;
  files: Record<string, string>;
}
export interface BackupStorage {
  list(): Promise<Snapshot[]>;
  save(snapshot: Snapshot, directory: string): Promise<void>;
  load(id: string, directory: string): Promise<Snapshot>;
  close?(): void;
}
export const BACKUP_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export function safePath(path: string) {
  return (
    !!path &&
    !/[\\\x00-\x1f\x7f]/.test(path) &&
    path.split('/').every((part) => part && part !== '.' && part !== '..')
  );
}
export function validateSnapshot(value: unknown, id: string): Snapshot {
  const s = value as Snapshot;
  if (
    !s ||
    !BACKUP_UUID.test(id) ||
    s.id !== id ||
    s.version !== 1 ||
    typeof s.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(s.createdAt)) ||
    typeof s.database !== 'string' ||
    !s.database ||
    !s.files ||
    Array.isArray(s.files) ||
    typeof s.files !== 'object' ||
    !Object.hasOwn(s.files, 'database.dump') ||
    (s.purpose !== undefined &&
      !['manual', 'scheduled', 'safety'].includes(s.purpose)) ||
    Object.entries(s.files).some(
      ([path, hash]) =>
        !safePath(path) ||
        (path !== 'database.dump' && !path.startsWith('uploads/')) ||
        typeof hash !== 'string' ||
        !/^[a-f0-9]{64}$/.test(hash),
    )
  )
    throw new BadRequestException(
      'Backup verification failed: invalid manifest or file path.',
    );
  return s;
}
export function validateSettings(value: unknown): ValidatedBackupSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new BadRequestException('Invalid backup settings.');
  const input = value as BackupSettings;
  const provider = input.provider ?? 'local';
  if (
    !['local', 's3', 'sftp'].includes(provider) ||
    typeof input.enabled !== 'boolean' ||
    !Number.isInteger(input.intervalMinutes) ||
    input.intervalMinutes < 1 ||
    input.intervalMinutes > 10080
  )
    throw new BadRequestException('Invalid backup provider or schedule.');
  const shared = {
    provider,
    enabled: input.enabled,
    intervalMinutes: input.intervalMinutes,
  };
  const text = (value: unknown, name: string, allowEmpty = false) => {
    if (
      typeof value !== 'string' ||
      (!allowEmpty && !value.trim()) ||
      value.length > 2000 ||
      /[\x00-\x1f\x7f]/.test(value)
    )
      throw new BadRequestException(`Invalid backup ${name}.`);
    return value;
  };
  if (provider === 'local')
    return {
      ...shared,
      provider: 'local',
      directory: text(input.directory, 'directory'),
    };
  if (provider === 's3') {
    const endpoint = input.endpoint || '';
    if (endpoint) {
      let url: URL;
      try {
        url = new URL(endpoint);
      } catch {
        throw new BadRequestException('Invalid S3 endpoint.');
      }
      if (
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        (url.protocol !== 'https:' &&
          !(
            url.protocol === 'http:' &&
            ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
          ))
      )
        throw new BadRequestException(
          'S3 endpoint must use HTTPS (HTTP loopback is allowed for testing).',
        );
    }
    const prefix = text(input.prefix ?? '', 'prefix', true).replace(
      /^\/+|\/+$/g,
      '',
    );
    if (prefix && !safePath(prefix))
      throw new BadRequestException('Invalid S3 prefix.');
    if (
      input.forcePathStyle !== undefined &&
      typeof input.forcePathStyle !== 'boolean'
    )
      throw new BadRequestException('Invalid S3 path-style setting.');
    const bucket = text(input.bucket, 'bucket');
    if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket))
      throw new BadRequestException('Invalid S3 bucket.');
    return {
      ...shared,
      provider: 's3',
      bucket,
      region: text(input.region || 'us-east-1', 'region'),
      endpoint,
      prefix,
      forcePathStyle: input.forcePathStyle ?? false,
    };
  }
  const authentication = input.authentication;
  if (authentication !== 'password' && authentication !== 'privateKey')
    throw new BadRequestException('Invalid SFTP authentication.');
  const host = text(input.host, 'host');
  const username = text(input.username, 'username');
  const remoteDirectory = text(input.remoteDirectory, 'remote directory');
  const hostKey = text(input.hostKey, 'host key');
  if (
    !/^[a-zA-Z0-9._:-]+$/.test(host) ||
    host.startsWith('-') ||
    !/^[a-zA-Z0-9._-]+$/.test(username) ||
    username.startsWith('-') ||
    !remoteDirectory.startsWith('/') ||
    !safePath(remoteDirectory.slice(1)) ||
    !/^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp(?:256|384|521)) [A-Za-z0-9+/]+={0,2}(?: [^\r\n]+)?$/.test(
      hostKey,
    ) ||
    !['password', 'privateKey'].includes(input.authentication ?? '') ||
    !Number.isInteger(input.port ?? 22) ||
    (input.port ?? 22) < 1 ||
    (input.port ?? 22) > 65535
  )
    throw new BadRequestException(
      'Invalid SFTP connection, authentication or trusted host key.',
    );
  return {
    ...shared,
    provider: 'sftp',
    host,
    username,
    remoteDirectory: remoteDirectory.replace(/\/+$/, ''),
    hostKey,
    port: input.port ?? 22,
    authentication,
  };
}
