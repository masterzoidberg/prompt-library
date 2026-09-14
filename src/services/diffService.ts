export type DiffLineKind = 'same' | 'added' | 'removed';

export interface DiffLine {
  kind: DiffLineKind;
  text: string;
  oldLine?: number;
  newLine?: number;
}

function splitLines(value: string): string[] {
  return value ? value.split('\n') : [];
}

export function diffLines(before: string, after: string): DiffLine[] {
  const oldLines = splitLines(before);
  const newLines = splitLines(after);
  const common = Array.from({ length: oldLines.length + 1 }, () =>
    new Uint32Array(newLines.length + 1),
  );

  for (let oldIndex = oldLines.length - 1; oldIndex >= 0; oldIndex -= 1) {
    for (let newIndex = newLines.length - 1; newIndex >= 0; newIndex -= 1) {
      common[oldIndex][newIndex] =
        oldLines[oldIndex] === newLines[newIndex]
          ? common[oldIndex + 1][newIndex + 1] + 1
          : Math.max(common[oldIndex + 1][newIndex], common[oldIndex][newIndex + 1]);
    }
  }

  const result: DiffLine[] = [];
  let oldIndex = 0;
  let newIndex = 0;
  while (oldIndex < oldLines.length || newIndex < newLines.length) {
    if (oldIndex < oldLines.length && newIndex < newLines.length && oldLines[oldIndex] === newLines[newIndex]) {
      result.push({
        kind: 'same',
        text: oldLines[oldIndex],
        oldLine: oldIndex + 1,
        newLine: newIndex + 1,
      });
      oldIndex += 1;
      newIndex += 1;
    } else if (
      oldIndex < oldLines.length &&
      (newIndex >= newLines.length || common[oldIndex + 1][newIndex] >= common[oldIndex][newIndex + 1])
    ) {
      result.push({ kind: 'removed', text: oldLines[oldIndex], oldLine: oldIndex + 1 });
      oldIndex += 1;
    } else {
      result.push({ kind: 'added', text: newLines[newIndex], newLine: newIndex + 1 });
      newIndex += 1;
    }
  }

  return result;
}
