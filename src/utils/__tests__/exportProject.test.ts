import { describe, expect, it, vi } from 'vitest';
import type { Page } from '../../types';
import type { PageRenderer } from '../../ports/pageRenderer';
import { renderProjectPages, type ProjectExportContext } from '../exportProject';

const pages: Page[] = [
  { id: 'page-1', elements: [], background: '#fff' },
  { id: 'page-2', elements: [], background: '#000' },
];

function createContext(renderer: PageRenderer): ProjectExportContext {
  return {
    pages,
    assets: {},
    projectName: 'Export Test',
    renderer,
    defaultLayoutPadding: 20,
    defaultLayoutGap: 12,
  };
}

describe('project export rendering', () => {
  it('waits for every page renderer and reports deterministic progress', async () => {
    let finishFirst: ((blob: Blob) => void) | undefined;
    const firstPage = new Promise<Blob>((resolve) => { finishFirst = resolve; });
    const renderer: PageRenderer = {
      renderPage: vi.fn()
        .mockReturnValueOnce(firstPage)
        .mockResolvedValueOnce(new Blob(['second'])),
    };
    const progress: Array<[number, number]> = [];

    const rendering = renderProjectPages(
      createContext(renderer),
      { mimeType: 'image/png', quality: 1, pixelRatio: 2 },
      { onProgress: (completed, total) => progress.push([completed, total]) },
    );
    await Promise.resolve();
    expect(renderer.renderPage).toHaveBeenCalledTimes(1);

    finishFirst?.(new Blob(['first']));
    const blobs = await rendering;

    expect(blobs).toHaveLength(2);
    expect(renderer.renderPage).toHaveBeenCalledTimes(2);
    expect(progress).toEqual([[0, 2], [1, 2], [2, 2]]);
    expect(pages.map((page) => page.id)).toEqual(['page-1', 'page-2']);
  });

  it('stops before the next page when cancellation is requested', async () => {
    const controller = new AbortController();
    const renderer: PageRenderer = {
      renderPage: vi.fn().mockResolvedValue(new Blob(['page'])),
    };

    await expect(renderProjectPages(
      createContext(renderer),
      { mimeType: 'image/jpeg', quality: 0.8, pixelRatio: 2 },
      {
        signal: controller.signal,
        onProgress: (completed) => {
          if (completed === 1) controller.abort();
        },
      },
    )).rejects.toMatchObject({ name: 'AbortError' });

    expect(renderer.renderPage).toHaveBeenCalledTimes(1);
  });

  it('passes project layout defaults to the page renderer', async () => {
    const renderer: PageRenderer = {
      renderPage: vi.fn().mockResolvedValue(new Blob(['page'])),
    };

    await renderProjectPages(
      createContext(renderer),
      { mimeType: 'image/png', quality: 1, pixelRatio: 1.5 },
    );

    expect(renderer.renderPage).toHaveBeenCalledWith(
      pages[0],
      {},
      expect.objectContaining({
        defaultLayoutPadding: 20,
        defaultLayoutGap: 12,
        mimeType: 'image/png',
        pixelRatio: 1.5,
      }),
    );
  });
});
