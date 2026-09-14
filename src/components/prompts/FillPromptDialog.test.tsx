import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import 'fake-indexeddb/auto';
import { FillPromptDialog } from './FillPromptDialog';
import { SettingsDialog } from '../settings/SettingsDialog';
import { LibraryDataProvider } from '../../hooks/LibraryDataProvider';
import { SettingsProvider } from '../../hooks/SettingsProvider';
import { resetDbCache, getDb, ensureSeeded } from '../../data/db';
import { DEFAULT_SETTINGS } from '../../types/settings';
import * as settingsRepository from '../../data/settingsRepository';
import type { Prompt } from '../../types';

const prompt: Prompt = {
  id: 'prompt-fill',
  title: 'Fill this prompt',
  content: 'Hello {{NAME}}\nRole: {{ROLE}}',
  folderId: 'unfiled',
  tagIds: [],
  isFavorite: false,
  copyCount: 0,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  lastCopiedAt: null,
  type: 'template',
  targetTools: [],
  variableDefaults: { NAME: 'Ada', ROLE: 'writer' },
};

beforeEach(async () => {
  await resetDbCache();
  const db = await getDb();
  await db.clear('prompts');
  await db.clear('folders');
  await db.clear('tags');
  await db.clear('settings');
  await ensureSeeded();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('FillPromptDialog', () => {
  it('previews defaults, supports multiline overrides, and copies rendered content', async () => {
    const onCopy = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <SettingsProvider>
        <FillPromptDialog open prompt={prompt} onOpenChange={vi.fn()} onCopy={onCopy} />
      </SettingsProvider>,
    );

    expect(await screen.findByLabelText('Value for NAME')).toHaveValue('Ada');
    expect(screen.getByLabelText('Value for ROLE')).toHaveValue('writer');
    expect(screen.getByRole('heading', { name: 'Preview' }).nextElementSibling?.textContent).toBe(
      'Hello Ada\nRole: writer',
    );

    await user.clear(screen.getByLabelText('Value for NAME'));
    await user.type(screen.getByLabelText('Value for NAME'), 'Grace');
    await user.clear(screen.getByLabelText('Value for ROLE'));
    await user.type(screen.getByLabelText('Value for ROLE'), 'line one\nline two');
    expect(screen.getByRole('heading', { name: 'Preview' }).nextElementSibling?.textContent).toBe(
      'Hello Grace\nRole: line one\nline two',
    );

    await user.click(screen.getByRole('button', { name: 'Copy rendered' }));
    await waitFor(() =>
      expect(onCopy).toHaveBeenCalledWith('prompt-fill', 'Hello Grace\nRole: line one\nline two'),
    );
    expect(prompt.content).toBe('Hello {{NAME}}\nRole: {{ROLE}}');
  });

  it('lets prompt defaults take precedence over remembered values and saves opt-in values', async () => {
    await settingsRepository.saveSettings({
      ...DEFAULT_SETTINGS,
      rememberedVariableValues: { NAME: 'Remembered', ROLE: 'remembered role' },
    });
    const onCopy = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <SettingsProvider>
        <FillPromptDialog open prompt={prompt} onOpenChange={vi.fn()} onCopy={onCopy} />
      </SettingsProvider>,
    );

    expect(await screen.findByLabelText('Value for NAME')).toHaveValue('Ada');
    await user.click(screen.getByLabelText(/Remember these values/));
    await user.click(screen.getByRole('button', { name: 'Copy rendered' }));

    await waitFor(async () => {
      expect((await settingsRepository.getSettings()).rememberedVariableValues).toEqual({
        NAME: 'Ada',
        ROLE: 'writer',
      });
    });
  });

  it('blocks normal rendered copy when values are missing but allows explicit placeholder copy', async () => {
    const onCopy = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    const incomplete = { ...prompt, variableDefaults: {} };

    render(
      <SettingsProvider>
        <FillPromptDialog open prompt={incomplete} onOpenChange={vi.fn()} onCopy={onCopy} />
      </SettingsProvider>,
    );

    const copyButton = await screen.findByRole('button', { name: 'Copy rendered' });
    expect(screen.getByLabelText('Value for NAME')).toHaveValue('');
    expect(screen.getByLabelText('Value for ROLE')).toHaveValue('');
    expect(copyButton).toBeDisabled();
    expect(screen.getByText(/Missing values: NAME, ROLE/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Copy with placeholders' }));

    await waitFor(() => expect(onCopy).toHaveBeenCalledWith('prompt-fill', prompt.content));
  });

  it('clears remembered values from Settings', async () => {
    await settingsRepository.saveSettings({
      ...DEFAULT_SETTINGS,
      rememberedVariableValues: { NAME: 'Ada' },
    });
    const user = userEvent.setup();

    render(
      <SettingsProvider>
        <LibraryDataProvider>
          <SettingsDialog open onOpenChange={vi.fn()} />
        </LibraryDataProvider>
      </SettingsProvider>,
    );

    await user.click(await screen.findByRole('button', { name: 'Clear' }));
    await waitFor(async () => {
      expect((await settingsRepository.getSettings()).rememberedVariableValues).toEqual({});
    });
  });
});
