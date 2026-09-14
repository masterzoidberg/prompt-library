export function normalizeName(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, ' ');
}
