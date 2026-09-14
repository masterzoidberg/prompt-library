import type { AssetType, TargetTool } from './prompt';

export interface PromptVersionSnapshot {
  title: string;
  content: string;
  description?: string;
  type: AssetType;
  targetTools: TargetTool[];
  notes?: string;
  variableDefaults: Record<string, string>;
}

export interface PromptVersion {
  id: string;
  promptId: string;
  sequence: number;
  createdAt: string;
  reason: 'edit' | 'restore';
  snapshot: PromptVersionSnapshot;
}
