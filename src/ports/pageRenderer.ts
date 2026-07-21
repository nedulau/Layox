import type { Page } from '../types';

export interface PageRenderOptions {
  mimeType: 'image/png' | 'image/jpeg';
  quality: number;
  pixelRatio: number;
  defaultLayoutPadding: number;
  defaultLayoutGap: number;
  signal?: AbortSignal;
}

export interface PageRenderer {
  renderPage(
    page: Page,
    assets: Record<string, Blob>,
    options: PageRenderOptions,
  ): Promise<Blob>;
}
