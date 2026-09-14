import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import 'fake-indexeddb/auto';
import { PromptFormDialog } from './PromptFormDialog';
import { LibraryDataProvider } from '../../hooks/LibraryDataProvider';
import { resetDbCache, getDb, ensureSeeded } from '../../data/db';

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

describe('PromptFormDialog metadata', () => {
  it('edits type, target tools, and notes through keyboard-accessible controls', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <LibraryDataProvider>
        <PromptFormDialog open onOpenChange={vi.fn()} onSubmit={onSubmit} />
      </LibraryDataProvider>,
    );

    await screen.findByLabelText('Type');
    await user.selectOptions(screen.getByLabelText('Type'), 'template');
    await user.click(screen.getByLabelText('ChatGPT'));
    await user.click(screen.getByLabelText('Codex'));
    await user.type(screen.getByLabelText(/^Notes/), 'Use this for a first pass.');
    await user.type(screen.getByLabelText('Title'), 'Metadata prompt');
    await user.type(screen.getByLabelText('Content'), 'Write a concise answer.');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        title: 'Metadata prompt',
        content: 'Write a concise answer.',
        description: undefined,
        folderId: 'unfiled',
        tagIds: [],
        type: 'template',
        targetTools: ['chatgpt', 'codex'],
        notes: 'Use this for a first pass.',
        variableDefaults: {},
      });
    });
  });

  it('edits defaults for the variables found in prompt content', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    const initial = {
      id: 'prompt-variables',
      title: 'Variable prompt',
      content: 'Hello {{NAME}}\nRole: {{ROLE}}',
      folderId: 'unfiled',
      tagIds: [],
      isFavorite: false,
      copyCount: 0,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      lastCopiedAt: null,
      type: 'template' as const,
      targetTools: [],
      variableDefaults: { NAME: 'Ada', ROLE: 'writer' },
    };

    render(
      <LibraryDataProvider>
        <PromptFormDialog open initial={initial} onOpenChange={vi.fn()} onSubmit={onSubmit} />
      </LibraryDataProvider>,
    );

    expect(await screen.findByLabelText('Default for NAME')).toHaveValue('Ada');
    expect(screen.getByLabelText('Default for ROLE')).toHaveValue('writer');
    await user.clear(screen.getByLabelText('Default for NAME'));
    await user.type(screen.getByLabelText('Default for NAME'), 'Grace');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ variableDefaults: { NAME: 'Grace', ROLE: 'writer' } }),
      );
    });
  });

  it('loads deterministic defaults for a new prompt', async () => {
    render(
      <LibraryDataProvider>
        <PromptFormDialog open onOpenChange={vi.fn()} onSubmit={vi.fn()} />
      </LibraryDataProvider>,
    );

    expect(await screen.findByLabelText('Type')).toHaveValue('prompt');
    expect(screen.getByLabelText('ChatGPT')).not.toBeChecked();
    expect(screen.getByLabelText(/^Notes/)).toHaveValue('');
  });

  it('saves from the form with Ctrl/Cmd+Enter', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <LibraryDataProvider>
        <PromptFormDialog open onOpenChange={vi.fn()} onSubmit={onSubmit} />
      </LibraryDataProvider>,
    );

    await user.type(await screen.findByLabelText('Title'), 'Keyboard prompt');
    const content = screen.getByLabelText('Content');
    await user.type(content, 'Keyboard content');
    await user.keyboard('{Control>}{Enter}{/Control}');

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Keyboard prompt',
      content: 'Keyboard content',
    })));
  });
});
