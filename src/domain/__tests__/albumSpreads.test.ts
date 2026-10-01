import { describe, expect, it } from 'vitest';
import { buildAlbumSpreads, spreadForPage } from '../albumSpreads';
const pages = (count: number, cover = false) => Array.from({ length: count }, (_, i) => ({ id: `p-${i}`, elements: [], background: '#fff', isCover: cover && i === 0 }));
describe('album spreads', () => {
  it('places a leading cover on the right and retains the final unpaired page', () => {
    expect(buildAlbumSpreads(pages(4, true))).toEqual([[null, 0], [1, 2], [3, null]]);
    expect(buildAlbumSpreads(pages(3, true))).toEqual([[null, 0], [1, 2]]);
    expect(buildAlbumSpreads(pages(1, true))).toEqual([[null, 0]]);
  });
  it('pairs uncovered albums from the first page and handles empty albums', () => {
    expect(buildAlbumSpreads(pages(3))).toEqual([[0, 1], [2, null]]);
    expect(buildAlbumSpreads([])).toEqual([]);
    expect(spreadForPage(buildAlbumSpreads(pages(4, true)), 2)).toBe(1);
    expect(spreadForPage(buildAlbumSpreads(pages(4, true)), 3)).toBe(2);
    expect(spreadForPage([], 9)).toBe(0);
  });
});
