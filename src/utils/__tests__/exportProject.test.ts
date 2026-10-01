import { afterEach, describe, expect, it, vi } from 'vitest';
import { Blob as NodeBlob } from 'node:buffer';
import type { Page } from '../../types';
import type { PageRenderer } from '../../ports/pageRenderer';
import {
  analyzeExportPreflight,
  exportAllPagesAsZip,
  exportAsPdf,
  exportCurrentPageAsJpeg,
  exportCurrentPageAsPng,
  renderProjectPages,
  type ProjectExportContext,
} from '../exportProject';

const exportMocks = vi.hoisted(() => ({
  saveAs: vi.fn(),
  pdfOptions: vi.fn(),
  addPage: vi.fn(),
  addImage: vi.fn(),
  zipFile: vi.fn(),
  generateAsync: vi.fn(async () => new Blob(['zip'])),
}));

vi.mock('file-saver', () => ({ saveAs: exportMocks.saveAs }));
vi.mock('jspdf', () => ({
  jsPDF: class {
    constructor(options: unknown) { exportMocks.pdfOptions(options); }
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

  it('uses portrait PDF dimensions and the selected DPI independently of compression', async () => {
    const renderer: PageRenderer = { renderPage: vi.fn().mockResolvedValue(new NodeBlob(['page']) as unknown as Blob) };
    await exportAsPdf({ ...createContext(renderer), pageFormat: 'a4-portrait' }, 'high', { dpi: 300 }, [0]);
    expect(exportMocks.pdfOptions).toHaveBeenLastCalledWith({ orientation: 'portrait', unit: 'mm', format: [210, 297] });
    expect(renderer.renderPage).toHaveBeenLastCalledWith(pages[0], {}, expect.objectContaining({ pageFormat: 'a4-portrait', pixelRatio: expect.closeTo(297 / 1200 * 300 / 25.4), quality: 0.55 }));
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

  it('exports selected pages with a custom filename', async () => {
    exportMocks.saveAs.mockClear();
    exportMocks.addImage.mockClear();
    exportMocks.zipFile.mockClear();
    const renderer: PageRenderer = {
      renderPage: vi.fn().mockResolvedValue(new NodeBlob(['page']) as unknown as Blob),
    };

    await exportAsPdf(createContext(renderer), 'medium', {}, [1], 'Selected pages');
    await exportAllPagesAsZip(createContext(renderer), 'png', {}, [1], 'Selected pages');

    expect(renderer.renderPage).toHaveBeenCalledWith(
      pages[1],
      {},
      expect.any(Object),
    );
    expect(exportMocks.addImage).toHaveBeenCalledTimes(1);
    expect(exportMocks.zipFile).toHaveBeenCalledWith('Page_002.png', expect.anything());
    expect(exportMocks.saveAs).toHaveBeenNthCalledWith(1, expect.any(Blob), 'Selected pages.pdf');
    expect(exportMocks.saveAs).toHaveBeenNthCalledWith(2, expect.any(Blob), 'Selected pages_Images.zip');
  });

  it('reports empty slots and missing assets before export', async () => {
    const renderer: PageRenderer = { renderPage: vi.fn() };
    const context: ProjectExportContext = {
      ...createContext(renderer),
      pages: [{
        id: 'layout',
        background: '#fff',
        elements: [],
        layoutId: 'two-side',
        slotAssignments: {
          0: { assetPath: 'assets/missing.jpg', offsetX: 0, offsetY: 0, scale: 1 },
        },
      }],
    };

    await expect(analyzeExportPreflight(context, [0])).resolves.toEqual({
      issues: [
        { kind: 'missing-asset', pageIndex: 0, pageId: 'layout', imageNumber: 1, slotIndex: 0, assetPath: 'assets/missing.jpg' },
        { kind: 'empty-slot', pageIndex: 0, pageId: 'layout', imageNumber: 2, slotIndex: 1 },
      ],
      pageCount: 1,
      emptySlotCount: 1,
      missingAssetCount: 1,
      lowResolutionCount: 0,
    });
  });
});

describe('actionable export preflight', () => {
  afterEach(() => vi.unstubAllGlobals());
  const image = { id: 'photo', type: 'image' as const, x: 0, y: 0, width: 1200, height: 1200, src: 'assets/photo.jpg', rotation: 0, zIndex: 0 };
  const source = (): ProjectExportContext => ({ ...createContext({ renderPage: vi.fn() }), pageFormat: 'square', pages: [{ id: 'cover', elements: [], background: '#fff' }, { id: 'photos', elements: [image, { ...image, id: 'placeholder', isPlaceholder: true }], background: '#fff' }], assets: { 'assets/photo.jpg': new Blob(['photo']) } });

  it('records exact free element targets and changes resolution warnings with DPI', async () => {
    const close = vi.fn(); vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 2000, height: 2000, close })));
    const low = await analyzeExportPreflight(source(), [1], 150);
    expect(low.lowResolutionCount).toBe(0);
    expect(low.issues).toEqual([{ kind: 'empty-slot', pageIndex: 1, pageId: 'photos', imageNumber: 2, elementId: 'placeholder' }]);
    const high = await analyzeExportPreflight(source(), [1], 300);
    expect(high.issues[0]).toEqual({ kind: 'low-resolution', pageIndex: 1, pageId: 'photos', imageNumber: 1, elementId: 'photo', assetPath: image.src });
    expect(high.emptySlotCount).toBe(1); expect(high.pageCount).toBe(1); expect(close).toHaveBeenCalledTimes(2);
  });

  it('uses the visible slot zoom and crop and decodes a repeated asset only once', async () => {
    const decode = vi.fn(async () => ({ width: 2000, height: 2000, close: vi.fn() })); vi.stubGlobal('createImageBitmap', decode);
    const context = source();
    context.pages = [{ id: 'slots', elements: [{ ...image, src: 'assets/hidden.jpg' }], background: '#fff', layoutId: 'two-side', slotAssignments: {
      0: { assetPath: image.src, offsetX: 0, offsetY: 0, scale: 4 },
      1: { assetPath: image.src, offsetX: 0, offsetY: 0, scale: 1, cropX: 0, cropY: 0, cropW: 200, cropH: 200 },
    } }];
    const result = await analyzeExportPreflight(context, [0], 150);
    expect(result.lowResolutionCount).toBe(2);
    expect(result.missingAssetCount).toBe(0);
    expect(result.issues.map((issue) => issue.slotIndex)).toEqual([0, 1]);
    expect(decode).toHaveBeenCalledTimes(1);
  });

  it('distinguishes missing and undecodable assets and handles invalid page indices', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => { throw new Error('corrupt image'); }));
    const context = source(); context.pages[1].elements = [image, { ...image, id: 'missing', src: 'assets/missing.jpg' }];
    const result = await analyzeExportPreflight(context, [1, 99]);
    expect(result.missingAssetCount).toBe(2); expect(result.pageCount).toBe(1);
    expect(result.issues.map((issue) => issue.elementId)).toEqual(['photo', 'missing']);
  });

  it('does not misreport cancellation as a damaged image', async () => {
    const controller = new AbortController(); controller.abort();
    await expect(analyzeExportPreflight(source(), [1], 300, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    const running = new AbortController();
    vi.stubGlobal('createImageBitmap', vi.fn(async () => { running.abort(); return { width: 2000, height: 2000, close: vi.fn() }; }));
    await expect(analyzeExportPreflight(source(), [1], 300, running.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });
});
