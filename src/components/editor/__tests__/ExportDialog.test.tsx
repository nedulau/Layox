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
  it('provides the exact target for a clickable empty-slot issue', async () => {
    const user = userEvent.setup();
    const source = context();
    source.pages[1].layoutId = 'single';
    const onNavigateToIssue = vi.fn();
    render(<ExportDialog t={t} context={source} currentPageIndex={0} defaultCompression="medium" onClose={vi.fn()} onExport={vi.fn()} onNavigateToIssue={onNavigateToIssue} />);
    await user.click(await screen.findByRole('button', { name: /pageLabel 2 · imageSlotLabel 1: preflightIssueEmpty/ }));
    expect(onNavigateToIssue).toHaveBeenCalledWith({ kind: 'empty-slot', pageIndex: 1, pageId: 'page-1', imageNumber: 1, slotIndex: 0 });
  });

  it('blocks export when a selected page contains a missing asset', async () => {
    const source = context();
    source.pages[1].layoutId = 'single';
    source.pages[1].slotAssignments = { 0: { assetPath: 'assets/missing.jpg', scale: 1, offsetX: 0, offsetY: 0 } };
    render(<ExportDialog t={t} context={source} currentPageIndex={0} defaultCompression="medium" onClose={vi.fn()} onExport={vi.fn()} onNavigateToIssue={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'startExport' })).toBeDisabled();
    await screen.findByText('preflightMissingAssets');
    expect(screen.getByRole('button', { name: 'startExport' })).toBeDisabled();
  });

  it('shows whole-pixel output dimensions and updates size estimates for the selected DPI', async () => {
    const user = userEvent.setup();
    const source = { ...context(), pageFormat: 'square' as const };
    render(<ExportDialog t={t} context={source} currentPageIndex={0} defaultCompression="medium" onClose={vi.fn()} onExport={vi.fn()} />);
    expect(screen.getByText('2480 × 2480 px')).toBeVisible();
    const previous = screen.getByText(/~.*MB/).textContent;
    await user.selectOptions(screen.getByRole('combobox', { name: /exportResolution/ }), '600');
    expect(screen.getByText('4960 × 4960 px')).toBeVisible();
    expect(screen.getByText(/~.*MB/).textContent).not.toBe(previous);
  });

});
