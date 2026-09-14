const RTF = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 24 * 60 * 60 * 1000],
  ['month', 30 * 24 * 60 * 60 * 1000],
  ['week', 7 * 24 * 60 * 60 * 1000],
  ['day', 24 * 60 * 60 * 1000],
  ['hour', 60 * 60 * 1000],
  ['minute', 60 * 1000],
  ['second', 1000],
];

export function formatRelative(iso: string): string {
  const date = new Date(iso);
  const diff = date.getTime() - Date.now();
  for (const [unit, ms] of UNITS) {
    if (Math.abs(diff) >= ms || unit === 'second') {
      return RTF.format(Math.round(diff / ms), unit);
    }
  }
  return RTF.format(0, 'second');
}

export function formatAbsolute(iso: string): string {
  return new Date(iso).toLocaleString();
}