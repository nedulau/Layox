import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectExportContext } from '../../../utils/exportProject';
import { tr } from '../../../i18n';
vi.mock('../../common/BlobImage', () => ({ default: ({ alt }: { alt: string }) => <img alt={alt} data-testid="printed-page" /> }));
import AlbumPreviewDialog from '../AlbumPreviewDialog';
const t = (key: Parameters<typeof tr>[1]) => tr('en', key);
function context(): ProjectExportContext {
  return { projectName: 'Preview album', pages: Array.from({ length: 4 }, (_, i) => ({ id: `p-${i}`, elements: [], background: '#fff', isCover: i === 0 })), assets: {}, renderer: { renderPage: vi.fn(async () => new Blob(['printed'])) }, defaultLayoutPadding: 20, defaultLayoutGap: 20, pageFormat: 'square' };
}
describe('album preview', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 1200, height: 800, x: 0, y: 0, left: 0, top: 0, right: 1200, bottom: 800, toJSON() {} });
  });
  it('renders only the visible spread and navigates without touching the editor', async () => {
    const user = userEvent.setup(); const source = context(); const onEditPage = vi.fn(); const onClose = vi.fn();
    render(<AlbumPreviewDialog context={source} currentPageIndex={0} t={t} onClose={onClose} onEditPage={onEditPage} />);
    await screen.findByTestId('printed-page');
    expect(source.renderer.renderPage).toHaveBeenCalledTimes(1);
    expect(source.renderer.renderPage).toHaveBeenLastCalledWith(source.pages[0], {}, expect.objectContaining({ pageFormat: 'square', pixelRatio: 1, signal: expect.any(AbortSignal) }));
    expect(screen.getByRole('button', { name: 'Previous spread' })).toBeDisabled();
    await user.keyboard('{ArrowRight}');
    await waitFor(() => expect(screen.getAllByTestId('printed-page')).toHaveLength(2));
    expect(screen.getByText('2 / 3')).toBeVisible();
    expect(onEditPage).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Open in editor: page 3' }));
    expect(onEditPage).toHaveBeenCalledWith(2);
    await user.keyboard('{End}');
    expect(screen.getByRole('button', { name: 'Next spread' })).toBeDisabled();
    await user.keyboard('{Home}');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Spread' }), screen.getByRole('option', { name: '2–3' }));
    expect(screen.getByText('2 / 3')).toBeVisible();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
  it('aborts abandoned renders and reports a page render failure', async () => {
    const source = context(); const signals: AbortSignal[] = [];
    source.renderer.renderPage = vi.fn((_page, _assets, options) => { signals.push(options.signal!); return Promise.reject(new Error('missing image')); });
    const { unmount } = render(<AlbumPreviewDialog context={source} currentPageIndex={0} t={t} onClose={vi.fn()} onEditPage={vi.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('missing image');
    fireEvent.click(screen.getByRole('button', { name: 'Next spread' }));
    await waitFor(() => expect(signals[0].aborted).toBe(true));
    unmount(); expect(signals.every((signal) => signal.aborted)).toBe(true);
  });
});
