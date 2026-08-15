import { csrfTokenForSession } from './csrf';

describe('csrfTokenForSession', () => {
  it('is stable for the same authenticated session', () => {
    expect(csrfTokenForSession('session-token')).toBe(
      csrfTokenForSession('session-token'),
    );
  });

  it('does not reuse a token across sessions', () => {
    expect(csrfTokenForSession('first-session')).not.toBe(
      csrfTokenForSession('second-session'),
    );
  });
});
