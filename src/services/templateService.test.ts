import { describe, expect, it } from 'vitest';
import { analyzeTemplate, detectVariables, renderTemplate } from './templateService';

describe('templateService', () => {
  it.each([
    {
      name: 'finds one variable',
      source: 'Hello, {{NAME}}.',
      variables: ['NAME'],
      malformedTokens: [],
    },
    {
      name: 'deduplicates variables in first-occurrence order',
      source: '{{FIRST}} then {{SECOND_2}} then {{FIRST}}.',
      variables: ['FIRST', 'SECOND_2'],
      malformedTokens: [],
    },
    {
      name: 'allows Unicode surrounding text',
      source: '東京 🚀 — {{CITY}}',
      variables: ['CITY'],
      malformedTokens: [],
    },
    {
      name: 'reports malformed token candidates',
      source: '{{lower}} {{2FAST}} {{WITH-DASH}} {{UNCLOSED',
      variables: [],
      malformedTokens: ['{{lower}}', '{{2FAST}}', '{{WITH-DASH}}', '{{UNCLOSED'],
    },
  ])('$name', ({ source, variables, malformedTokens }) => {
    expect(detectVariables(source)).toEqual(variables);
    expect(analyzeTemplate(source)).toEqual({ variables, malformedTokens });
  });

  it.each([
    {
      name: 'replaces every occurrence literally',
      source: 'Hello {{NAME}} — {{NAME}}.',
      values: { NAME: 'Ada' },
      rendered: 'Hello Ada — Ada.',
      missingVariables: [],
      malformedTokens: [],
    },
    {
      name: 'does not recursively evaluate replacement values',
      source: 'Value: {{NAME}}',
      values: { NAME: '{{OTHER}}', OTHER: 'ignored' },
      rendered: 'Value: {{OTHER}}',
      missingVariables: [],
      malformedTokens: [],
    },
    {
      name: 'preserves multiline and Unicode replacement values',
      source: '{{GREETING}}\n{{PLACE}}',
      values: { GREETING: 'こんにちは', PLACE: 'New\nYork 🚀' },
      rendered: 'こんにちは\nNew\nYork 🚀',
      missingVariables: [],
      malformedTokens: [],
    },
    {
      name: 'leaves missing tokens visible and reports them once',
      source: '{{KNOWN}} / {{MISSING}} / {{MISSING}}',
      values: { KNOWN: 'value' },
      rendered: 'value / {{MISSING}} / {{MISSING}}',
      missingVariables: ['MISSING'],
      malformedTokens: [],
    },
    {
      name: 'leaves malformed tokens unchanged while rendering valid tokens',
      source: '{{VALID}} {{bad}} {{UNCLOSED',
      values: { VALID: 'ok' },
      rendered: 'ok {{bad}} {{UNCLOSED',
      missingVariables: [],
      malformedTokens: ['{{bad}}', '{{UNCLOSED'],
    },
    {
      name: 'reports an empty value as missing',
      source: 'Before{{EMPTY}}After',
      values: { EMPTY: '' },
      rendered: 'Before{{EMPTY}}After',
      missingVariables: ['EMPTY'],
      malformedTokens: [],
    },
  ])('$name', ({ source, values, rendered, missingVariables, malformedTokens }) => {
    const original = source;
    const result = renderTemplate(source, values);

    expect(result).toEqual({ rendered, missingVariables, malformedTokens });
    expect(source).toBe(original);
  });
});
