import { createHash } from 'node:crypto';

export function csrfTokenForSession(sessionToken: string): string {
  return createHash('sha256')
    .update('amirl-csrf:')
    .update(sessionToken)
    .digest('base64url');
}
