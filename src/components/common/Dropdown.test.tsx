import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Dropdown, DropdownItem } from './Dropdown';

describe('Dropdown', () => {
  it('closes and restores focus after a synchronous selection', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <Dropdown trigger={<button type="button">Open menu</button>}>
        <DropdownItem onSelect={onSelect}>Choose</DropdownItem>
      </Dropdown>,
    );

    const trigger = screen.getByRole('button', { name: 'Open menu' });
    await user.click(trigger);
    await user.click(await screen.findByRole('menuitem', { name: 'Choose' }));

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledOnce();
      expect(screen.queryByRole('menuitem', { name: 'Choose' })).not.toBeInTheDocument();
    });
    expect(trigger).toHaveFocus();
  });

  it('closes while preserving an asynchronous selection callback', async () => {
    const user = userEvent.setup();
    let resolveSelection: (() => void) | undefined;
    const onSelect = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSelection = resolve;
        }),
    );
    render(
      <Dropdown trigger={<button type="button">Open menu</button>}>
        <DropdownItem onSelect={onSelect}>Choose</DropdownItem>
      </Dropdown>,
    );

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Choose' }));

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledOnce();
      expect(screen.queryByRole('menuitem', { name: 'Choose' })).not.toBeInTheDocument();
    });
    resolveSelection?.();
  });

  it('preserves destructive and disabled item states', async () => {
    const user = userEvent.setup();
    render(
      <Dropdown trigger={<button type="button">Open menu</button>}>
        <DropdownItem destructive>Delete</DropdownItem>
        <DropdownItem disabled>Unavailable</DropdownItem>
      </Dropdown>,
    );

    await user.click(screen.getByRole('button', { name: 'Open menu' }));

    expect(await screen.findByRole('menuitem', { name: 'Delete' })).toHaveClass('text-red-600');
    expect(await screen.findByRole('menuitem', { name: 'Unavailable' })).toHaveAttribute(
      'data-disabled',
      '',
    );
  });
});
