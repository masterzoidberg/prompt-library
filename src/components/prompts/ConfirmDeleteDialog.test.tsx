import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';

function renderDialog(onConfirm: () => void | Promise<void>) {
  const onOpenChange = vi.fn();
  render(
    <ConfirmDeleteDialog
      open
      onOpenChange={onOpenChange}
      title="Delete item?"
      description="This cannot be undone."
      onConfirm={onConfirm}
    />,
  );
  return onOpenChange;
}

describe('ConfirmDeleteDialog', () => {
  it('shows a rejection error and leaves the dialog open', async () => {
    const onOpenChange = renderDialog(() => Promise.reject(new Error('delete failed')));

    await userEvent.setup().click(screen.getByRole('button', { name: 'Delete', exact: true }));

    expect(await screen.findByRole('alert')).toHaveTextContent('delete failed');
    expect(screen.getByRole('dialog', { name: 'Delete item?' })).toBeVisible();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('disables repeat confirmation while deletion is pending', async () => {
    let resolveDelete: (() => void) | undefined;
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveDelete = resolve;
        }),
    );
    const onOpenChange = renderDialog(onConfirm);
    const user = userEvent.setup();
    const deleteButton = screen.getByRole('button', { name: 'Delete', exact: true });

    await user.click(deleteButton);
    expect(deleteButton).toBeDisabled();
    await user.click(deleteButton);
    expect(onConfirm).toHaveBeenCalledOnce();

    resolveDelete?.();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
