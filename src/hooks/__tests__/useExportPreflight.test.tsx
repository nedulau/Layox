import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExportPreflight, ProjectExportContext } from '../../utils/exportProject';
const mocks = vi.hoisted(() => ({ analyze: vi.fn() }));
vi.mock('../../utils/exportProject', () => ({ analyzeExportPreflight: mocks.analyze }));
import { useExportPreflight } from '../useExportPreflight';
const context: ProjectExportContext = { pages: [], assets: {}, projectName: 'Test', renderer: { renderPage: vi.fn() }, defaultLayoutPadding: 20, defaultLayoutGap: 20 };
const indices = [0];
const ready: ExportPreflight = { issues: [], pageCount: 1, emptySlotCount: 0, missingAssetCount: 0, lowResolutionCount: 0 };

describe('export preflight lifecycle', () => {
  beforeEach(() => { mocks.analyze.mockReset(); });
  it('hides outdated results and aborts the earlier resolution check', async () => {
    let resolveFirst!: (result: ExportPreflight) => void;
    let resolveNext!: (result: ExportPreflight) => void;
    mocks.analyze.mockImplementationOnce(() => new Promise<ExportPreflight>((resolve) => { resolveFirst = resolve; }));
    mocks.analyze.mockImplementationOnce(() => new Promise<ExportPreflight>((resolve) => { resolveNext = resolve; }));
    const { result, rerender } = renderHook(({ dpi }) => useExportPreflight(context, indices, dpi), { initialProps: { dpi: 150 } });
    expect(result.current.preflight).toBeNull();
    await act(async () => { resolveFirst(ready); });
    expect(result.current.preflight).toBe(ready);
    rerender({ dpi: 600 });
    expect(result.current.preflight).toBeNull();
    expect(mocks.analyze.mock.calls[0][3].aborted).toBe(true);
    await act(async () => { resolveNext({ ...ready, lowResolutionCount: 2 }); });
    expect(result.current.preflight?.lowResolutionCount).toBe(2);
  });
  it('discards a late result after changing the selected page range', async () => {
    let resolveOld!: (result: ExportPreflight) => void;
    mocks.analyze.mockImplementationOnce(() => new Promise<ExportPreflight>((resolve) => { resolveOld = resolve; })).mockResolvedValueOnce({ ...ready, pageCount: 2 });
    const newIndices = [0, 1];
    const { result, rerender } = renderHook(({ selected }) => useExportPreflight(context, selected, 300), { initialProps: { selected: indices } });
    rerender({ selected: newIndices });
    await waitFor(() => expect(result.current.preflight?.pageCount).toBe(2));
    await act(async () => { resolveOld(ready); });
    expect(result.current.preflight?.pageCount).toBe(2);
    rerender({ selected: [] });
    expect(result.current.preflight).toBeNull();
    expect(mocks.analyze).toHaveBeenCalledTimes(2);
  });
  it('reports analysis failures and cancels work on unmount', async () => {
    mocks.analyze.mockRejectedValue(new Error('Cannot inspect project'));
    const { result, unmount } = renderHook(() => useExportPreflight(context, indices, 300));
    await waitFor(() => expect(result.current.error).toBe('Cannot inspect project'));
    expect(result.current.preflight).toBeNull();
    unmount();
    expect(mocks.analyze.mock.calls[0][3].aborted).toBe(true);
  });
});
