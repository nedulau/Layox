import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PageFormat } from '../domain/pageFormat';
import type { Page } from '../types';
import type { ExportRequest } from '../components/editor/ExportDialog';
import {
  exportAllPagesAsZip,
  exportAsPdf,
  exportCurrentPageAsJpeg,
  exportCurrentPageAsPng,
  type ExportJobOptions,
  type PdfCompressionLevel,
  type ProjectExportContext,
} from '../utils/exportProject';
import { konvaPageRenderer } from '../utils/konvaPageRenderer';
import { readStoredString, writeStoredString } from '../infra/storage';

const PDF_LEVELS: PdfCompressionLevel[] = ['none', 'low', 'medium', 'high'];

interface EditorExportOptions {
  pages: Page[];
  assets: Record<string, Blob>;
  projectName: string;
  pageFormat?: PageFormat;
  defaultLayoutPadding: number;
  defaultLayoutGap: number;
}

export interface ExportProgress {
  label: string;
  completed: number;
  total: number;
}

export function useEditorExport({
  pages,
  assets,
  projectName,
  pageFormat,
  defaultLayoutPadding,
  defaultLayoutGap,
}: EditorExportOptions) {
  const abortRef = useRef<AbortController | null>(null);
  const [job, setJob] = useState<ExportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [defaultCompression, setDefaultCompression] = useState<PdfCompressionLevel>(() => {
    const saved = readStoredString('layox_pdfDefaultLevel', 'medium');
    return saved && PDF_LEVELS.includes(saved as PdfCompressionLevel)
      ? saved as PdfCompressionLevel
      : 'medium';
  });

  useEffect(() => {
    writeStoredString('layox_pdfDefaultLevel', defaultCompression);
  }, [defaultCompression]);

  const context = useMemo<ProjectExportContext>(() => ({
    pages,
    assets,
    projectName,
    pageFormat,
    renderer: konvaPageRenderer,
    defaultLayoutPadding,
    defaultLayoutGap,
  }), [assets, defaultLayoutGap, defaultLayoutPadding, pages, projectName, pageFormat]);

  const run = useCallback(async (
    label: string,
    total: number,
    operation: (options: ExportJobOptions) => Promise<void>,
  ) => {
    if (abortRef.current) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setError(null);
    setJob({ label, completed: 0, total });
    try {
      await operation({
        signal: controller.signal,
        onProgress: (completed, progressTotal) => setJob({ label, completed, total: progressTotal }),
      });
    } catch (exportError) {
      if (!(exportError instanceof DOMException && exportError.name === 'AbortError')) {
        setError(exportError instanceof Error ? exportError.message : String(exportError));
      }
    } finally {
      abortRef.current = null;
      setJob(null);
    }
  }, []);

  const requestExport = useCallback(async (request: ExportRequest) => {
    setDialogOpen(false);
    setDefaultCompression(request.compression);
    const total = request.pageIndices.length;
    if (request.format === 'pdf') {
      await run('PDF', total, (options) => exportAsPdf(
        context,
        request.compression,
        { ...options, dpi: request.dpi },
        request.pageIndices,
        request.fileName,
      ));
      return;
    }
    if (request.scope === 'current') {
      const pageIndex = request.pageIndices[0];
      await run(request.format.toUpperCase(), 1, (options) => (
        request.format === 'png'
          ? exportCurrentPageAsPng(context, pageIndex, { ...options, dpi: request.dpi }, request.fileName)
          : exportCurrentPageAsJpeg(context, pageIndex, { ...options, dpi: request.dpi }, request.fileName, request.compression)
      ));
      return;
    }
    await run(`${request.format.toUpperCase()} ZIP`, total, (options) => exportAllPagesAsZip(
      context,
      request.format === 'png' ? 'png' : 'jpeg',
      { ...options, dpi: request.dpi },
      request.pageIndices,
      request.fileName,
      request.compression,
    ));
  }, [context, run]);

  const openDialog = useCallback(() => setDialogOpen(true), []);
  const closeDialog = useCallback(() => setDialogOpen(false), []);
  const cancel = useCallback(() => abortRef.current?.abort(), []);
  const clearError = useCallback(() => setError(null), []);

  return {
    context,
    job,
    error,
    dialogOpen,
    defaultCompression,
    openDialog,
    closeDialog,
    cancel,
    clearError,
    requestExport,
  };
}
