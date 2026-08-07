import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ConfirmDialog from '../ConfirmDialog';

describe('ConfirmDialog', () => {
  it('supports cancel, confirm and Escape interactions', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(<ConfirmDialog open title="Delete page" message="This cannot be undone" cancelLabel="Cancel" confirmLabel="Delete" onCancel={onCancel} onConfirm={onConfirm} />);

    expect(screen.getByRole('alertdialog', { name: 'Delete page' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.keyboard('{Escape}');

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});
