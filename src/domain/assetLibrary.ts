import type { Page } from '../types';
import type { ImageMetadata, ImageOrientation } from '../utils/imageMetadata';

export interface AssetUsageLocation {
  pageIndex: number;
  slotIndex?: number;
  elementId?: string;
}

export function getAssetFileName(path: string): string {
  return (path.split('/').pop() ?? path).replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_/i, '');
}

export function indexAssetUsage(pages: Page[]): Record<string, AssetUsageLocation[]> {
  const result: Record<string, AssetUsageLocation[]> = {};
  const add = (path: string, location: AssetUsageLocation) => { (result[path] ??= []).push(location); };
  pages.forEach((page, pageIndex) => {
    if (page.layoutId) {
      for (const [slotIndex, assignment] of Object.entries(page.slotAssignments ?? {})) add(assignment.assetPath, { pageIndex, slotIndex: Number(slotIndex) });
    } else {
      for (const element of page.elements) {
        if (element.type === 'image' && !element.isPlaceholder) add(element.src, { pageIndex, elementId: element.id });
      }
    }
  });
  return result;
}

export function findAssetUsage(pages: Page[], path: string): AssetUsageLocation[] {
  return indexAssetUsage(pages)[path] ?? [];
}

export function filterAndSortAssets(paths: string[], details: Record<string, ImageMetadata>, options: {
  search: string; orientation: 'all' | ImageOrientation; sort: 'name' | 'capture-newest' | 'capture-oldest'; onlyUnused: boolean; usageCounts: Record<string, number>;
}): string[] {
  const needle = options.search.trim().toLocaleLowerCase();
  return paths.filter((path) => (!options.onlyUnused || !options.usageCounts[path])
    && (!needle || getAssetFileName(path).toLocaleLowerCase().includes(needle))
    && (options.orientation === 'all' || details[path]?.orientation === options.orientation))
    .sort((a, b) => {
      if (options.sort !== 'name') {
        const first = details[a]?.capturedAt;
        const second = details[b]?.capturedAt;
        if (first && !second) return -1;
        if (!first && second) return 1;
        if (first && second && first !== second) return options.sort === 'capture-newest' ? second.localeCompare(first) : first.localeCompare(second);
      }
      return getAssetFileName(a).localeCompare(getAssetFileName(b), undefined, { numeric: true }) || a.localeCompare(b);
    });
}
