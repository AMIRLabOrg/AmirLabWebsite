import { assertLocalTarget } from '../../scripts/reset-local-papers';
it('refuses reset without explicit local identity and destructive flag', () => {
  const local = 'postgresql://amirl:local@127.0.0.1:5433/amirl';
  expect(assertLocalTarget(local, '--replace-local-papers')).toBe(local);
  for (const url of [
    undefined,
    local.replace('127.0.0.1', 'vps.example'),
    local.replace(':5433/amirl', ':5433/other'),
    local + '?host=vps.example',
    local.replace('5433', '5432'),
  ])
    expect(() => assertLocalTarget(url, '--replace-local-papers')).toThrow();
  expect(() => assertLocalTarget(local, undefined)).toThrow();
});
