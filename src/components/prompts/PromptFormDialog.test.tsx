import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import 'fake-indexeddb/auto';
import { PromptFormDialog } from './PromptFormDialog';
import { LibraryDataProvider } from '../../hooks/LibraryDataProvider';
import { resetDbCache, getDb, ensureSeeded } from '../../data/db';
import * as folderRepo from '../../data/folderRepository';
import * as tagRepo from '../../data/tagRepository';
import * as promptRepo from '../../data/promptRepository';

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

  it('searches folders and tags, selects multiple existing tags, and stages new names for save', async () => {
    const researchFolder = await folderRepo.createFolder({ name: 'Research' });
    const writingFolder = await folderRepo.createFolder({ name: 'Writing' });
    const researchTag = await tagRepo.createTag({ name: 'Research' });
    const writingTag = await tagRepo.createTag({ name: 'Writing' });
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <LibraryDataProvider>
        <PromptFormDialog open onOpenChange={vi.fn()} onSubmit={onSubmit} />
      </LibraryDataProvider>,
    );

    const folder = await screen.findByRole('combobox', { name: 'Folder' });
    await user.click(folder);
    expect(await screen.findByRole('option', { name: 'Unfiled' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Research' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Writing' })).toBeInTheDocument();
    await user.clear(folder);
    await user.type(folder, 'Res');
    expect(screen.getByRole('option', { name: 'Research' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Create "Res"' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Writing' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: 'Research' }));
    expect(folder).toHaveValue('Research');

    const tags = screen.getByRole('combobox', { name: 'Tags' });
    await user.click(tags);
    expect(await screen.findByRole('option', { name: 'Research' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Writing' })).toBeInTheDocument();
    await user.type(tags, 'wri');
    expect(screen.getByRole('option', { name: 'Writing' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Create "wri"' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Research' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: 'Writing' }));
    await user.type(tags, 'Research');
    await user.click(screen.getByRole('option', { name: 'Research' }));
    await user.type(tags, 'Personal');
    await user.click(screen.getByRole('option', { name: 'Create "Personal"' }));

    await user.type(screen.getByLabelText('Title'), 'Organized prompt');
    await user.type(screen.getByLabelText('Content'), 'Prompt content');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      folderId: researchFolder.id,
      tagIds: [writingTag.id, researchTag.id],
      newTagNames: ['Personal'],
    })));
    expect(writingFolder.id).not.toBe(researchFolder.id);
    expect(await folderRepo.listFolders()).toHaveLength(3);
    expect(await tagRepo.listTags()).toHaveLength(2);
  });

  it('reuses normalized folder and tag matches instead of offering duplicate creation', async () => {
    const folderRecord = await folderRepo.createFolder({ name: 'Research' });
    const tagRecord = await tagRepo.createTag({ name: 'Research' });
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <LibraryDataProvider>
        <PromptFormDialog open onOpenChange={vi.fn()} onSubmit={onSubmit} />
      </LibraryDataProvider>,
    );

    const folder = await screen.findByRole('combobox', { name: 'Folder' });
    await user.click(folder);
    await user.clear(folder);
    await user.type(folder, ' research ');
    expect(await screen.findByRole('option', { name: 'Research' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Create "research"' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: 'Research' }));

    const tags = screen.getByRole('combobox', { name: 'Tags' });
    await user.click(tags);
    await user.type(tags, ' research ');
    expect(await screen.findByRole('option', { name: 'Research' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Create "research"' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: 'Research' }));
    await user.type(screen.getByLabelText('Title'), 'Normalized prompt');
    await user.type(screen.getByLabelText('Content'), 'Prompt content');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      folderId: folderRecord.id,
      tagIds: [tagRecord.id],
    })));
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('newFolderName');
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('newTagNames');
  });

  it('removes a selected tag before saving', async () => {
    const tag = await tagRepo.createTag({ name: 'Research' });
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <LibraryDataProvider>
        <PromptFormDialog open onOpenChange={vi.fn()} onSubmit={onSubmit} />
      </LibraryDataProvider>,
    );

    const tags = await screen.findByRole('combobox', { name: 'Tags' });
    await user.click(tags);
    await user.click(await screen.findByRole('option', { name: 'Research' }));
    expect(screen.getByRole('button', { name: 'Remove tag Research' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove tag Research' }));
    await user.type(screen.getByLabelText('Title'), 'No tags');
    await user.type(screen.getByLabelText('Content'), 'Prompt content');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ tagIds: [] })));
    expect(tag.id).toBeDefined();
  });

  it('does not create staged folders or tags when the form is cancelled', async () => {
    const onOpenChange = vi.fn();
    const onSubmit = vi.fn();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();

    render(
      <LibraryDataProvider>
        <PromptFormDialog open onOpenChange={onOpenChange} onSubmit={onSubmit} />
      </LibraryDataProvider>,
    );

    const folder = await screen.findByRole('combobox', { name: 'Folder' });
    await user.click(folder);
    await user.type(folder, 'Temporary');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('option', { name: 'Create "Temporary"' })).not.toBeInTheDocument();
    expect(folder).toHaveValue('Unfiled');
    await user.click(screen.getByLabelText('Title'));
    await user.click(folder);
    await user.type(folder, 'Temporary');
    await user.keyboard('{Enter}');
    expect(folder).toHaveValue('Temporary');

    const tags = screen.getByRole('combobox', { name: 'Tags' });
    await user.click(tags);
    await user.type(tags, 'Discarded');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('option', { name: 'Create "Discarded"' })).not.toBeInTheDocument();
    await user.click(screen.getByLabelText('Title'));
    await user.click(tags);
    await user.type(tags, 'Temporary');
    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'Remove tag Temporary' })).toBeInTheDocument();
    await user.type(tags, 'Temporary');
    expect(screen.queryByRole('option', { name: 'Create "Temporary"' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Remove tag Temporary' })).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(confirm).toHaveBeenCalledWith('Discard unsaved changes?');
    expect(onSubmit).not.toHaveBeenCalled();
    expect((await folderRepo.listFolders()).map((item) => item.name)).toEqual(['Unfiled']);
    expect(await tagRepo.listTags()).toEqual([]);
  });

  it('supports arrow-key selection and Escape without creating records', async () => {
    const writing = await folderRepo.createFolder({ name: 'Writing' });
    const researchTag = await tagRepo.createTag({ name: 'Research' });
    const confirm = vi.spyOn(window, 'confirm');
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <LibraryDataProvider>
        <PromptFormDialog open onOpenChange={vi.fn()} onSubmit={onSubmit} />
      </LibraryDataProvider>,
    );

    const folder = await screen.findByRole('combobox', { name: 'Folder' });
    await user.click(folder);
    await user.type(folder, 'Writing');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(folder).toHaveValue('Writing');

    const tags = screen.getByRole('combobox', { name: 'Tags' });
    await user.click(tags);
    await user.type(tags, 'Research');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(screen.getByRole('button', { name: 'Remove tag Research' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox', { name: 'Tags' })).not.toBeInTheDocument();
    expect(confirm).not.toHaveBeenCalled();
    expect(await folderRepo.listFolders()).toHaveLength(2);
    expect(await tagRepo.listTags()).toEqual([researchTag]);

    await user.type(screen.getByLabelText('Title'), 'Keyboard selection');
    await user.type(screen.getByLabelText('Content'), 'Prompt content');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      folderId: writing.id,
      tagIds: [researchTag.id],
    })));
  });

  it('displays and updates existing folder and tags while editing', async () => {
    const research = await folderRepo.createFolder({ name: 'Research' });
    const writing = await folderRepo.createFolder({ name: 'Writing' });
    const oldTag = await tagRepo.createTag({ name: 'Old' });
    const nextTag = await tagRepo.createTag({ name: 'Next' });
    const initial = await promptRepo.createPrompt({
      title: 'Existing prompt',
      content: 'Existing content',
      folderId: research.id,
      tagIds: [oldTag.id],
    });
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <LibraryDataProvider>
        <PromptFormDialog open initial={initial} onOpenChange={vi.fn()} onSubmit={onSubmit} />
      </LibraryDataProvider>,
    );

    const folder = await screen.findByRole('combobox', { name: 'Folder' });
    await waitFor(() => expect(folder).toHaveValue('Research'));
    const tags = screen.getByRole('combobox', { name: 'Tags' });
    expect(screen.getByRole('button', { name: 'Remove tag Old' })).toBeInTheDocument();
    await user.click(folder);
    await user.clear(folder);
    await user.type(folder, 'Writing');
    await user.click(await screen.findByRole('option', { name: 'Writing' }));
    await user.click(screen.getByRole('button', { name: 'Remove tag Old' }));
    await user.click(tags);
    await user.click(await screen.findByRole('option', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      folderId: writing.id,
      tagIds: [nextTag.id],
    })));
  });
});

