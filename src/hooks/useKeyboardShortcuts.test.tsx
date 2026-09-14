import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';

function ShortcutHarness({
  handlers,
}: {
  handlers: {
    focusSearch: () => void;
    openPalette: () => void;
    openNewPrompt: () => void;
    closeOverlays: () => void;
  };
}) {
  useKeyboardShortcuts(handlers);
  return <input aria-label="Editor" />;
}

describe('useKeyboardShortcuts', () => {
  it('opens a new prompt with Ctrl/Cmd+N outside editable controls', () => {
    const handlers = {
      focusSearch: vi.fn(),
      openPalette: vi.fn(),
      openNewPrompt: vi.fn(),
      closeOverlays: vi.fn(),
    };
    render(<ShortcutHarness handlers={handlers} />);

    fireEvent.keyDown(window, { key: 'n', ctrlKey: true });
    expect(handlers.openNewPrompt).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Editor' }), { key: 'n', ctrlKey: true });
    expect(handlers.openNewPrompt).toHaveBeenCalledTimes(1);
  });

  it('does not steal slash from editable controls and closes only an available overlay', () => {
    const handlers = {
      focusSearch: vi.fn(),
      openPalette: vi.fn(),
      openNewPrompt: vi.fn(),
      closeOverlays: vi.fn(),
    };
    render(<ShortcutHarness handlers={handlers} />);
    const editor = screen.getByRole('textbox', { name: 'Editor' });

    fireEvent.keyDown(window, { key: '/' });
    expect(handlers.focusSearch).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(editor, { key: '/' });
    expect(handlers.focusSearch).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handlers.closeOverlays).toHaveBeenCalledTimes(1);
  });
});
