export const ASSET_TYPES = [
  'prompt',
  'instruction',
  'coding-task',
  'rubric',
  'research-procedure',
  'output-schema',
  'checklist',
  'template',
] as const;

export type AssetType = (typeof ASSET_TYPES)[number];

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  prompt: 'Prompt',
  instruction: 'Instruction',
  'coding-task': 'Coding task',
  rubric: 'Rubric',
  'research-procedure': 'Research procedure',
  'output-schema': 'Output schema',
  checklist: 'Checklist',
  template: 'Template',
};

export const TARGET_TOOLS = [
  'generic',
  'chatgpt',
  'codex',
  'claude',
  'claude-code',
  'gemini',
  'kilo',
  'api',
] as const;

export type TargetTool = (typeof TARGET_TOOLS)[number];

export const TARGET_TOOL_LABELS: Record<TargetTool, string> = {
  generic: 'Generic',
  chatgpt: 'ChatGPT',
  codex: 'Codex',
  claude: 'Claude',
  'claude-code': 'Claude Code',
  gemini: 'Gemini',
  kilo: 'Kilo',
  api: 'API',
};

export const DEFAULT_ASSET_TYPE: AssetType = 'prompt';
export const DEFAULT_TARGET_TOOLS: TargetTool[] = [];
export const DEFAULT_VARIABLE_DEFAULTS: Record<string, string> = {};

export interface PromptV1 {
  id: string;
  title: string;
  content: string;
  description?: string;
  folderId: string;
  tagIds: string[];
  isFavorite: boolean;
  copyCount: number;
  createdAt: string;
  updatedAt: string;
  lastCopiedAt: string | null;
}

export interface Prompt extends PromptV1 {
  type: AssetType;
  targetTools: TargetTool[];
  notes?: string;
  variableDefaults: Record<string, string>;
}

export type PromptCreate = Omit<
  PromptV1,
  | 'id'
  | 'createdAt'
  | 'updatedAt'
  | 'lastCopiedAt'
  | 'copyCount'
  | 'isFavorite'
  | 'tagIds'
  | 'folderId'
> & {
  folderId?: string;
  isFavorite?: boolean;
  tagIds?: string[];
  type?: AssetType;
  targetTools?: TargetTool[];
  notes?: string;
  variableDefaults?: Record<string, string>;
};

export type PromptUpdate = Partial<
  Omit<PromptV1, 'id' | 'createdAt' | 'updatedAt'>
> &
  Partial<Pick<Prompt, 'type' | 'targetTools' | 'notes' | 'variableDefaults'>>;

export function isAssetType(value: unknown): value is AssetType {
  return typeof value === 'string' && ASSET_TYPES.includes(value as AssetType);
}

export function isTargetTool(value: unknown): value is TargetTool {
  return typeof value === 'string' && TARGET_TOOLS.includes(value as TargetTool);
}

export function withPromptDefaults(prompt: PromptV1 | Prompt): Prompt {
  const candidate = prompt as Partial<Prompt>;
  return {
    ...prompt,
    type: candidate.type ?? DEFAULT_ASSET_TYPE,
    targetTools: candidate.targetTools ? [...candidate.targetTools] : [...DEFAULT_TARGET_TOOLS],
    variableDefaults: candidate.variableDefaults ? { ...candidate.variableDefaults } : { ...DEFAULT_VARIABLE_DEFAULTS },
  };
}

export function toPromptV1(prompt: PromptV1 | Prompt): PromptV1 {
  const { type: _type, targetTools: _targetTools, notes: _notes, variableDefaults: _variableDefaults, ...v1 } = prompt as Prompt;
  return v1;
}
