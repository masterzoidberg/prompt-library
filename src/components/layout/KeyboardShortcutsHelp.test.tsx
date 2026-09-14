import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { KeyboardShortcutsHelp } from './KeyboardShortcutsHelp';

describe('KeyboardShortcutsHelp', () => {
  it('shows the complete keyboard reference from a visible button', async () => {
    const user = userEvent.setup();
    render(<KeyboardShortcutsHelp />);

    await user.click(screen.getByRole('button', { name: 'Keyboard shortcuts' }));
    const dialog = screen.getByRole('dialog', { name: 'Keyboard shortcuts' });
    expect(dialog).toHaveTextContent('Ctrl/⌘ + N');
    expect(dialog).toHaveTextContent('Ctrl/⌘ + Shift + P');
    expect(dialog).toHaveTextContent('Ctrl/⌘ + Enter');
    expect(dialog).toHaveTextContent('C');
    expect(dialog).toHaveTextContent('F');
    expect(dialog).toHaveTextContent('E');
    expect(dialog).toHaveTextContent('D');
    expect(dialog).toHaveTextContent('Escape');
    expect(dialog).toHaveTextContent('Arrow Up / Arrow Down');
    expect(dialog).toHaveTextContent('Actions also remain available through buttons and menus.');
  });
});
