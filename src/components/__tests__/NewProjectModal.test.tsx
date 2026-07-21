import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import NewProjectModal from '../NewProjectModal';

describe('NewProjectModal accessibility', () => {
  it('labels the dialog, traps focus and closes with Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const launcher = document.createElement('button');
    document.body.appendChild(launcher);
    launcher.focus();

    const view = render(
      <NewProjectModal
        open
        title="New album"
        description="Choose a name"
        cancelLabel="Cancel"
        confirmLabel="Create"
        placeholder="Project name"
        onClose={onClose}
        onConfirm={vi.fn()}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: 'New album' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const input = screen.getByPlaceholderText('Project name');
    const createButton = screen.getByRole('button', { name: 'Create' });
    expect(input).toHaveFocus();

    createButton.focus();
    await user.tab();
    expect(input).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
    view.rerender(
      <NewProjectModal
        open={false}
        onClose={onClose}
        onConfirm={vi.fn()}
      />,
    );
    expect(launcher).toHaveFocus();
    launcher.remove();
  });
});
