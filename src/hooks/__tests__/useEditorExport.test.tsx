import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExportJobOptions } from '../../utils/exportProject';

const mocks = vi.hoisted(() => ({ exportAsPdf: vi.fn(), readStoredString: vi.fn(), writeStoredString: vi.fn() }));

vi.mock('../../utils/exportProject', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../utils/exportProject')>(),
  exportAsPdf: mocks.exportAsPdf,
  exportCurrentPageAsPng: vi.fn(),
  exportCurrentPageAsJpeg: vi.fn(),
  exportAllPagesAsZip: vi.fn(),
}));
vi.mock('../../infra/storage', () => ({ readStoredString: mocks.readStoredString, writeStoredString: mocks.writeStoredString }));

const { useEditorExport } = await import('../useEditorExport');

describe('useEditorExport', () => {
  beforeEach(() => {
    mocks.exportAsPdf.mockReset();
    mocks.readStoredString.mockReset().mockReturnValue('high');
    mocks.writeStoredString.mockReset();
    mocks.exportAsPdf.mockImplementation(async (_context, _compression, options: ExportJobOptions) => options.onProgress?.(2, 2));
  });

  it('owns dialog state and routes PDF requests through the export service', async () => {
    const { result } = renderHook(() => useEditorExport({
      projectName: 'Album',
      pages: [{ id: 'one', elements: [], background: '#fff' }, { id: 'two', elements: [], background: '#fff' }],
      assets: {},
      defaultLayoutPadding: 20,
      defaultLayoutGap: 20,
    }));

    expect(result.current.defaultCompression).toBe('high');
    act(() => result.current.openDialog());
    expect(result.current.dialogOpen).toBe(true);
    await act(() => result.current.requestExport({ format: 'pdf', scope: 'all', pageIndices: [0, 1], compression: 'low', fileName: 'Export' }));

    expect(result.current.dialogOpen).toBe(false);
    expect(result.current.job).toBeNull();
    expect(mocks.exportAsPdf).toHaveBeenCalledWith(
      expect.objectContaining({ projectName: 'Album' }), 'low',
      expect.objectContaining({ signal: expect.any(AbortSignal) }), [0, 1], 'Export',
    );
    expect(mocks.writeStoredString).toHaveBeenLastCalledWith('layox_pdfDefaultLevel', 'low');
  });
});
