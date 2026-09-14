const VALID_TOKEN_PATTERN = /\{\{([A-Z][A-Z0-9_]*)\}\}/g;

export interface TemplateAnalysis {
  variables: string[];
  malformedTokens: string[];
}

export interface TemplateRenderResult {
  rendered: string;
  missingVariables: string[];
  malformedTokens: string[];
}

function addUnique(values: string[], seen: Set<string>, value: string): void {
  if (seen.has(value)) return;
  seen.add(value);
  values.push(value);
}

/**
 * Finds valid tokens and reports token-shaped input that does not match the
 * supported grammar. The source is never changed.
 */
export function analyzeTemplate(source: string): TemplateAnalysis {
  const variables: string[] = [];
  const malformedTokens: string[] = [];
  const seenVariables = new Set<string>();
  let cursor = 0;

  while (cursor < source.length) {
    const start = source.indexOf('{{', cursor);
    if (start === -1) break;

    const end = source.indexOf('}}', start + 2);
    if (end === -1) {
      malformedTokens.push(source.slice(start));
      break;
    }

    const token = source.slice(start, end + 2);
    const name = source.slice(start + 2, end);
    if (/^[A-Z][A-Z0-9_]*$/.test(name)) {
      addUnique(variables, seenVariables, name);
    } else {
      malformedTokens.push(token);
    }

    cursor = end + 2;
  }

  return { variables, malformedTokens };
}

export function detectVariables(source: string): string[] {
  return analyzeTemplate(source).variables;
}

export function renderTemplate(
  source: string,
  values: Readonly<Record<string, string>>,
): TemplateRenderResult {
  const analysis = analyzeTemplate(source);
  const missingVariables: string[] = [];
  const seenMissingVariables = new Set<string>();

  const rendered = source.replace(VALID_TOKEN_PATTERN, (token, name: string) => {
    if (
      !Object.prototype.hasOwnProperty.call(values, name) ||
      typeof values[name] !== 'string' ||
      values[name].length === 0
    ) {
      addUnique(missingVariables, seenMissingVariables, name);
      return token;
    }
    return values[name];
  });

  return {
    rendered,
    missingVariables,
    malformedTokens: analysis.malformedTokens,
  };
}
