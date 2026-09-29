import { describe, expect, it } from 'vitest';
import { filterAndSortAssets, findAssetUsage, getAssetFileName } from '../assetLibrary';
import type { Page } from '../../types';
const details = {
  'assets/2.jpg': { width: 200, height: 100, orientation: 'landscape' as const, capturedAt: '2024-01-01T12:00:00' },
  'assets/10.jpg': { width: 100, height: 200, orientation: 'portrait' as const, capturedAt: '2025-01-01T12:00:00' },
  'assets/1.jpg': { width: 100, height: 100, orientation: 'square' as const },
};
const paths = Object.keys(details);
const options = { search: '', orientation: 'all' as const, sort: 'name' as const, onlyUnused: false, usageCounts: { 'assets/2.jpg': 1 } };

describe('asset library', () => {
  it('sorts numeric filenames and puts undated images last in both capture sort directions', () => {
    expect(filterAndSortAssets(paths, details, options)).toEqual(['assets/1.jpg', 'assets/2.jpg', 'assets/10.jpg']);
    expect(filterAndSortAssets(paths, details, { ...options, sort: 'capture-newest' })).toEqual(['assets/10.jpg', 'assets/2.jpg', 'assets/1.jpg']);
    expect(filterAndSortAssets(paths, details, { ...options, sort: 'capture-oldest' })).toEqual(['assets/2.jpg', 'assets/10.jpg', 'assets/1.jpg']);
  });
  it('combines filename search, usage and orientation filters', () => {
    expect(filterAndSortAssets(paths, details, { ...options, orientation: 'landscape' })).toEqual(['assets/2.jpg']);
    expect(filterAndSortAssets(paths, details, { ...options, search: '10', onlyUnused: true, orientation: 'portrait' })).toEqual(['assets/10.jpg']);
    expect(filterAndSortAssets(paths, details, { ...options, onlyUnused: true, orientation: 'landscape' })).toEqual([]);
    expect(getAssetFileName('assets/11111111-1111-4111-8111-111111111111_Travel.jpg')).toBe('Travel.jpg');
  });
  it('finds every visible usage with its exact page, slot or element', () => {
    const image = { id: 'photo', type: 'image' as const, src: 'assets/photo.jpg', x: 0, y: 0, width: 100, height: 100, rotation: 0, zIndex: 0 };
    const pages: Page[] = [
      { id: 'free', background: '#fff', elements: [image, { ...image, id: 'blank', isPlaceholder: true }] },
      { id: 'layout', background: '#fff', elements: [image], layoutId: 'two-side', slotAssignments: { 0: { assetPath: image.src, scale: 1, offsetX: 0, offsetY: 0 }, 1: { assetPath: image.src, scale: 1, offsetX: 0, offsetY: 0 } } },
    ];
    expect(findAssetUsage(pages, image.src)).toEqual([{ pageIndex: 0, elementId: 'photo' }, { pageIndex: 1, slotIndex: 0 }, { pageIndex: 1, slotIndex: 1 }]);
    expect(findAssetUsage(pages, 'assets/missing.jpg')).toEqual([]);
  });
});
