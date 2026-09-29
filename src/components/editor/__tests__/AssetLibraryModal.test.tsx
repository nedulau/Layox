import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { tr } from '../../../i18n';
import type { Page } from '../../../types';
vi.mock('../../../utils/imageMetadata', () => ({ readImageMetadata: async (blob: Blob) => blob.type === 'image/jpeg'
  ? { width: 200, height: 100, orientation: 'landscape', capturedAt: '2024-07-19T15:24:30' }
  : { width: 100, height: 200, orientation: 'portrait' } }));
vi.mock('../../common/BlobImage', () => ({ default: () => <span data-testid="thumbnail" /> }));
import AssetLibraryModal from '../AssetLibraryModal';

function props() {
  const pages: Page[] = [{ id: 'one', background: '#fff', elements: [], layoutId: 'single', slotAssignments: { 0: { assetPath: 'assets/trip.jpg', scale: 1, offsetX: 0, offsetY: 0 } } }];
  return {
    open: true, pages, assetBlobs: { 'assets/trip.jpg': new Blob(['jpg'], { type: 'image/jpeg' }), 'assets/portrait.png': new Blob(['png'], { type: 'image/png' }) },
    t: (key: Parameters<typeof tr>[1]) => tr('en', key), title: 'Library', closeLabel: 'Close', emptyLabel: 'No matches', searchPlaceholder: 'Search images', usageLabel: (count: number) => `Used ${count}`, removeLabel: 'Remove image', unusedLabel: 'Unused', usageCounts: { 'assets/trip.jpg': 1 }, onInsert: vi.fn(), onRemove: vi.fn(), onClose: vi.fn(), onNavigate: vi.fn(),
  };
}

describe('image library controls', () => {
  it('combines orientation and filename filters without treating undated photos as dated', async () => {
    const user = userEvent.setup();
    render(<AssetLibraryModal {...props()} />);
    await screen.findByText('2024-07-19 15:24:30');
    expect(screen.getByText('No capture date')).toBeVisible();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Image orientation' }), 'portrait');
    expect(screen.queryByText('trip.jpg')).not.toBeInTheDocument();
    expect(screen.getByText('portrait.png')).toBeVisible();
    await user.type(screen.getByRole('searchbox', { name: 'Search images' }), 'absent');
    expect(screen.getByText('No matches')).toBeVisible();
    await user.clear(screen.getByRole('searchbox'));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort order' }), 'capture-newest');
    await user.click(screen.getByRole('checkbox', { name: 'Unused' }));
    expect(screen.getByText('portrait.png')).toBeVisible();
  });

  it('navigates to exact usage locations and keeps image insertion separate', async () => {
    const user = userEvent.setup();
    const actions = props(); render(<AssetLibraryModal {...actions} />);
    await user.click(screen.getByRole('button', { name: 'Go to image usage: Page 1, Image 1' }));
    expect(actions.onNavigate).toHaveBeenCalledWith({ pageIndex: 0, slotIndex: 0 });
    expect(actions.onInsert).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /trip\.jpg/ }));
    expect(actions.onInsert).toHaveBeenCalledWith('assets/trip.jpg');
    await user.click(screen.getByRole('button', { name: 'Remove image' }));
    expect(actions.onRemove).toHaveBeenCalledWith('assets/portrait.png');
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(actions.onClose).toHaveBeenCalled();
    await waitFor(() => expect(screen.getAllByTestId('thumbnail')).toHaveLength(2));
  });
});
