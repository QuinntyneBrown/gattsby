const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

export function formatStorage(bytes: number): string {
  const level = Math.min(UNITS.length - 1, Math.floor(Math.log10(Math.max(bytes, 1)) / 3));
  const value = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(
    bytes / 1000 ** level,
  );
  return `${value} ${UNITS[level]}`;
}
