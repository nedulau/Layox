import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Translator } from '../../../i18n';
import type { ProjectExportContext } from '../../../utils/exportProject';
import ExportDialog from '../ExportDialog';

const t = ((key: string) => key) as Translator;

function context(): ProjectExportContext {
  return {
    projectName: 'Test Album',
    pages: [0, 1, 2].map((index) => ({ id: `page-${index}`, elements: [], background: '#fff' })),
    assets: {},
    renderer: { renderPage: vi.fn(async () => new Blob()) },
    defaultLayoutPadding: 20,
    defaultLayoutGap: 20,
  };
}

describe('ExportDialog', () => {
  it('validates a page range and emits a normalized export request', async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();
    render(<ExportDialog t={t} context={context()} currentPageIndex={0} defaultCompression="medium" onClose={vi.fn()} onExport={onExport} />);

    await user.click(screen.getByRole('button', { name: 'exportPageRange' }));
    await user.type(screen.getByPlaceholderText('pageRangePlaceholder'), '2-3');
    await user.selectOptions(screen.getByLabelText('exportFormat'), 'png');
    await user.clear(screen.getByLabelText('outputFilename'));
    await user.type(screen.getByLabelText('outputFilename'), '  Selected pages  ');
    await waitFor(() => expect(screen.getByText('preflightReady')).toBeVisible());
    await user.click(screen.getByRole('button', { name: 'startExport' }));

    expect(onExport).toHaveBeenCalledWith({
      format: 'png', dpi: 300, scope: 'range', pageIndices: [1, 2], compression: 'medium', fileName: 'Selected pages',
    });
  });

  it('disables export for an invalid range', async () => {
    const user = userEvent.setup();
    render(<ExportDialog t={t} context={context()} currentPageIndex={0} defaultCompression="medium" onClose={vi.fn()} onExport={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'exportPageRange' }));
    await user.type(screen.getByPlaceholderText('pageRangePlaceholder'), '99');

    expect(screen.getByText('invalidPageRange')).toBeVisible();
    expect(screen.getByRole('button', { name: 'startExport' })).toBeDisabled();
  });
});
