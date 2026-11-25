export function exportFileName(
  displayName: string,
  startedAt: number,
  kind: 'profile' | 'record',
): string {
  const slug = displayName
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
    .replace(/-$/, '');
  const date = new Date(startedAt);
  const day = [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part) => String(part).padStart(2, '0'))
    .join('-');
  return `${slug || 'device'}-${day}-${kind}.gattsby.json`;
}
