import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

export const PASSWORD_MIN_LENGTH = 15;
export const PASSWORD_MAX_LENGTH = 128;

const KEY_LENGTH = 64;
const SCRYPT_N = 2 ** 15;
const SCRYPT_R = 8;
const SCRYPT_P = 3;
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024;
const HASH_PREFIX = `scrypt:v1:${SCRYPT_N}:${SCRYPT_R}:${SCRYPT_P}`;

function derivePassword(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      KEY_LENGTH,
      {
        N: SCRYPT_N,
        r: SCRYPT_R,
        p: SCRYPT_P,
        maxmem: SCRYPT_MAX_MEMORY,
      },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derivePassword(password, salt);
  return `${HASH_PREFIX}:${salt.toString('base64url')}:${key.toString('base64url')}`;
}

export async function verifyPassword(
  password: string,
  encodedHash: string,
): Promise<boolean> {
  const [algorithm, version, n, r, p, salt, expectedKey] =
    encodedHash.split(':');
  if (`${algorithm}:${version}:${n}:${r}:${p}` !== HASH_PREFIX) {
    return false;
  }

  const expected = Buffer.from(expectedKey ?? '', 'base64url');
  if (!salt || expected.length !== KEY_LENGTH) {
    return false;
  }
  const actual = await derivePassword(password, Buffer.from(salt, 'base64url'));
  return timingSafeEqual(actual, expected);
}
