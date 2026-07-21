import { describe, expect, it, vi } from 'vitest';
import { Blob as NodeBlob } from 'node:buffer';
import type { Page } from '../../types';
import type { PageRenderer } from '../../ports/pageRenderer';
import {
  exportAllPagesAsZip,
  exportAsPdf,
  exportCurrentPageAsJpeg,
  exportCurrentPageAsPng,
  renderProjectPages,
  type ProjectExportContext,
} from '../exportProject';

const exportMocks = vi.hoisted(() => ({
  saveAs: vi.fn(),
  addPage: vi.fn(),
  addImage: vi.fn(),
  zipFile: vi.fn(),
  generateAsync: vi.fn(async () => new Blob(['zip'])),
}));

vi.mock('file-saver', () => ({ saveAs: exportMocks.saveAs }));
vi.mock('jspdf', () => ({
  jsPDF: class {
    internal = { pageSize: { getWidth: () => 297, getHeight: () => 210 } };
    addPage = exportMocks.addPage;
    addImage = exportMocks.addImage;
    setFillColor = vi.fn();
    rect = vi.fn();
    output = () => new Blob(['pdf']);
  },
}));
vi.mock('jszip', () => ({
  default: class {
    file = exportMocks.zipFile;
    generateAsync = exportMocks.generateAsync;
  },
}));

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

  it.each(['none', 'low', 'medium', 'high'] as const)('exports PDF using the %s preset', async (level) => {
    exportMocks.saveAs.mockClear();
    exportMocks.addImage.mockClear();
    const renderer: PageRenderer = {
      renderPage: vi.fn().mockResolvedValue(new NodeBlob(['page']) as unknown as Blob),
    };

    await exportAsPdf(createContext(renderer), level);

    expect(exportMocks.addImage).toHaveBeenCalledTimes(2);
    expect(exportMocks.addPage).toHaveBeenCalled();
    expect(exportMocks.saveAs).toHaveBeenCalledWith(expect.any(Blob), 'Export Test.pdf');
  });

  it('exports the current page as PNG and JPEG with safe names', async () => {
    exportMocks.saveAs.mockClear();
    const renderer: PageRenderer = {
      renderPage: vi.fn().mockResolvedValue(new Blob(['page'])),
    };
    const context = { ...createContext(renderer), projectName: 'Album: 2026' };

    await exportCurrentPageAsPng(context, 0);
    await exportCurrentPageAsJpeg(context, 1);

    expect(exportMocks.saveAs).toHaveBeenNthCalledWith(1, expect.any(Blob), 'Album_ 2026_Page1.png');
    expect(exportMocks.saveAs).toHaveBeenNthCalledWith(2, expect.any(Blob), 'Album_ 2026_Page2.jpg');
    await expect(exportCurrentPageAsPng(context, 10)).rejects.toThrow('no longer exists');
  });

  it.each(['png', 'jpeg'] as const)('packages all pages into a %s ZIP', async (format) => {
    exportMocks.saveAs.mockClear();
    exportMocks.zipFile.mockClear();
    const renderer: PageRenderer = {
      renderPage: vi.fn().mockResolvedValue(new Blob(['page'])),
    };

    await exportAllPagesAsZip(createContext(renderer), format);

    expect(exportMocks.zipFile).toHaveBeenCalledTimes(2);
    expect(exportMocks.saveAs).toHaveBeenCalledWith(expect.any(Blob), 'Export Test_Images.zip');
  });

  it('uses a fallback filename and does not save after cancellation', async () => {
    exportMocks.saveAs.mockClear();
    const controller = new AbortController();
    const renderer: PageRenderer = {
      renderPage: vi.fn(async () => {
        controller.abort();
        return new Blob(['page']);
      }),
    };
    const context = { ...createContext(renderer), pages: [pages[0]], projectName: '???' };

    await expect(exportCurrentPageAsPng(context, 0, { signal: controller.signal }))
      .rejects.toMatchObject({ name: 'AbortError' });
    expect(exportMocks.saveAs).not.toHaveBeenCalled();
  });
});
