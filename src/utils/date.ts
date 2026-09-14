let lastMs = 0;

export function nowIso(): string {
  let ms = Date.now();
  if (ms <= lastMs) ms = lastMs + 1;
  lastMs = ms;
  return new Date(ms).toISOString();
}