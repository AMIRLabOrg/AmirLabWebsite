export function buildPersonSlug(fullName: string, uniqueId: string): string {
  const name = fullName
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `${name || 'member'}-${uniqueId.slice(0, 8)}`;
}
