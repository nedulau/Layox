import type { Page } from '../types';
export type AlbumSpread = [number | null, number | null];

export function buildAlbumSpreads(pages: Page[]): AlbumSpread[] {
  const spreads: AlbumSpread[] = [];
  let index = 0;
  if (pages[0]?.isCover) { spreads.push([null, 0]); index = 1; }
  for (; index < pages.length; index += 2) spreads.push([index, index + 1 < pages.length ? index + 1 : null]);
  return spreads;
}

export function spreadForPage(spreads: AlbumSpread[], pageIndex: number): number {
  return Math.max(0, spreads.findIndex((spread) => spread.includes(pageIndex)));
}
