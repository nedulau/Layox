import type { Page } from '../types';
import type { PageRenderer, PageRenderOptions } from '../ports/pageRenderer';
import { getExportPixelRatio, getPageSize, getPrintSize, type PageFormat } from '../domain/pageFormat';
import type { TranslationKey } from '../i18n';
import { computeLayoutSlots } from './layouts';

export type PdfCompressionLevel = 'none' | 'low' | 'medium' | 'high';

export const PDF_COMPRESSION_PRESETS: {
  id: PdfCompressionLevel;
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
}[] = [
  { id: 'none', labelKey: 'pdfNoneLabel', descriptionKey: 'pdfNoneDescription' },
  { id: 'low', labelKey: 'pdfLowLabel', descriptionKey: 'pdfLowDescription' },
  { id: 'medium', labelKey: 'pdfMediumLabel', descriptionKey: 'pdfMediumDescription' },
  { id: 'high', labelKey: 'pdfHighLabel', descriptionKey: 'pdfHighDescription' },
];

export interface ProjectExportContext {
  pages: Page[];
  assets: Record<string, Blob>;
  projectName: string;
  renderer: PageRenderer;
  pageFormat?: PageFormat;
  defaultLayoutPadding: number;
  defaultLayoutGap: number;
}

export interface ExportJobOptions {
  signal?: AbortSignal;
  dpi?: number;
  onProgress?: (completed: number, total: number) => void;
}

export type ExportIssueKind = 'empty-slot' | 'missing-asset' | 'low-resolution';
export interface ExportIssue {
  kind: ExportIssueKind;
  pageIndex: number;
  pageId: string;
  imageNumber: number;
  slotIndex?: number;
  elementId?: string;
  assetPath?: string;
}

export interface ExportPreflight {
  issues: ExportIssue[];
  pageCount: number;
  emptySlotCount: number;
  missingAssetCount: number;
  lowResolutionCount: number;
}

interface RenderFormat {
  mimeType: 'image/png' | 'image/jpeg';
  quality: number;
  pixelRatio: number;
}

function compressionConfig(level: PdfCompressionLevel): RenderFormat & { pdfFormat: 'PNG' | 'JPEG' } {
  switch (level) {
    case 'none':
      return { mimeType: 'image/png', quality: 1, pdfFormat: 'PNG', pixelRatio: 2 };
    case 'low':
      return { mimeType: 'image/jpeg', quality: 0.95, pdfFormat: 'JPEG', pixelRatio: 2 };
    case 'medium':
      return { mimeType: 'image/jpeg', quality: 0.8, pdfFormat: 'JPEG', pixelRatio: 2 };
    case 'high':
      return { mimeType: 'image/jpeg', quality: 0.55, pdfFormat: 'JPEG', pixelRatio: 1.5 };
  }
}

function jpegCompressionConfig(level: PdfCompressionLevel): RenderFormat {
  switch (level) {
    case 'none':
      return { mimeType: 'image/jpeg', quality: 1, pixelRatio: 2 };
    case 'low':
      return { mimeType: 'image/jpeg', quality: 0.95, pixelRatio: 2 };
    case 'medium':
      return { mimeType: 'image/jpeg', quality: 0.8, pixelRatio: 2 };
    case 'high':
      return { mimeType: 'image/jpeg', quality: 0.55, pixelRatio: 1.5 };
  }
}

function safeProjectName(projectName: string): string {
  return projectName.replace(/[^\p{L}\p{N}_\- ]/gu, '_') || 'Layox';
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Export cancelled.', 'AbortError');
}

function renderOptions(
  context: ProjectExportContext,
  format: RenderFormat,
  signal?: AbortSignal,
  dpi?: number,
): PageRenderOptions {
  return {
    ...format,
    pageFormat: context.pageFormat,
    pixelRatio: dpi === undefined ? format.pixelRatio : getExportPixelRatio(context.pageFormat, dpi),
    defaultLayoutPadding: context.defaultLayoutPadding,
    defaultLayoutGap: context.defaultLayoutGap,
    signal,
  };
}

export async function renderProjectPages(
  context: ProjectExportContext,
  format: RenderFormat,
  job: ExportJobOptions = {},
  pageIndices: number[] = context.pages.map((_, index) => index),
): Promise<Blob[]> {
  const blobs: Blob[] = [];
  job.onProgress?.(0, pageIndices.length);
  for (const [progressIndex, pageIndex] of pageIndices.entries()) {
    throwIfAborted(job.signal);
    const page = context.pages[pageIndex];
    if (!page) throw new Error(`Page ${pageIndex + 1} no longer exists.`);
    blobs.push(await context.renderer.renderPage(page, context.assets, renderOptions(context, format, job.signal, job.dpi)));
    job.onProgress?.(progressIndex + 1, pageIndices.length);
  }
  return blobs;
}

async function saveBlob(blob: Blob, fileName: string): Promise<void> {
  const { saveAs } = await import('file-saver');
  saveAs(blob, fileName);
}

export async function exportAsPdf(
  context: ProjectExportContext,
  compression: PdfCompressionLevel = 'none',
  job: ExportJobOptions = {},
  pageIndices: number[] = context.pages.map((_, index) => index),
  fileName = context.projectName,
): Promise<void> {
  const config = compressionConfig(compression);
  const [{ jsPDF }, pageBlobs] = await Promise.all([
    import('jspdf'),
    renderProjectPages(context, config, job, pageIndices),
  ]);
  throwIfAborted(job.signal);

  const size = getPageSize(context.pageFormat);
  const print = getPrintSize(context.pageFormat);
  const pdf = new jsPDF({ orientation: print.width >= print.height ? 'landscape' : 'portrait', unit: 'mm', format: [print.width, print.height] });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const scale = Math.min(pageWidth / size.width, pageHeight / size.height);
  const imageWidth = size.width * scale;
  const imageHeight = size.height * scale;
  const offsetX = (pageWidth - imageWidth) / 2;
  const offsetY = (pageHeight - imageHeight) / 2;

  for (const [index, blob] of pageBlobs.entries()) {
    throwIfAborted(job.signal);
    if (index > 0) pdf.addPage();
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');
    pdf.addImage(
      new Uint8Array(await blob.arrayBuffer()),
      config.pdfFormat,
      offsetX,
      offsetY,
      imageWidth,
      imageHeight,
    );
  }
  throwIfAborted(job.signal);
  await saveBlob(pdf.output('blob'), `${safeProjectName(fileName)}.pdf`);
}

async function exportCurrentPage(
  context: ProjectExportContext,
  pageIndex: number,
  format: RenderFormat,
  extension: 'png' | 'jpg',
  job: ExportJobOptions = {},
  fileName = context.projectName,
): Promise<void> {
  const page = context.pages[pageIndex];
  if (!page) throw new Error('The selected page no longer exists.');
  job.onProgress?.(0, 1);
  const blob = await context.renderer.renderPage(page, context.assets, renderOptions(context, format, job.signal, job.dpi));
  throwIfAborted(job.signal);
  job.onProgress?.(1, 1);
  await saveBlob(blob, `${safeProjectName(fileName)}_Page${pageIndex + 1}.${extension}`);
}

export function exportCurrentPageAsPng(
  context: ProjectExportContext,
  pageIndex: number,
  job?: ExportJobOptions,
  fileName?: string,
): Promise<void> {
  return exportCurrentPage(
    context,
    pageIndex,
    { mimeType: 'image/png', quality: 1, pixelRatio: 2 },
    'png',
    job,
    fileName,
  );
}

export function exportCurrentPageAsJpeg(
  context: ProjectExportContext,
  pageIndex: number,
  job?: ExportJobOptions,
  fileName?: string,
  compression: PdfCompressionLevel = 'low',
): Promise<void> {
  return exportCurrentPage(
    context,
    pageIndex,
    jpegCompressionConfig(compression),
    'jpg',
    job,
    fileName,
  );
}

export async function exportAllPagesAsZip(
  context: ProjectExportContext,
  format: 'png' | 'jpeg' = 'png',
  job: ExportJobOptions = {},
  pageIndices: number[] = context.pages.map((_, index) => index),
  fileName = context.projectName,
  compression: PdfCompressionLevel = 'low',
): Promise<void> {
  const renderFormat: RenderFormat = format === 'jpeg'
    ? jpegCompressionConfig(compression)
    : { mimeType: 'image/png', quality: 1, pixelRatio: 2 };
  const [{ default: JSZip }, blobs] = await Promise.all([
    import('jszip'),
    renderProjectPages(context, renderFormat, job, pageIndices),
  ]);
  throwIfAborted(job.signal);

  const zip = new JSZip();
  const extension = format === 'jpeg' ? 'jpg' : 'png';
  blobs.forEach((blob, index) => {
    const pageNumber = pageIndices[index] + 1;
    zip.file(`Page_${String(pageNumber).padStart(3, '0')}.${extension}`, blob);
  });
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  throwIfAborted(job.signal);
  await saveBlob(zipBlob, `${safeProjectName(fileName)}_Images.zip`);
}

async function decodeBlobDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(blob);
    const dimensions = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dimensions;
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      reject(new Error('Image metadata could not be decoded.'));
      URL.revokeObjectURL(url);
    };
    image.src = url;
  });
}

export async function analyzeExportPreflight(
  context: ProjectExportContext,
  pageIndices: number[],
  dpi?: number,
  signal?: AbortSignal,
): Promise<ExportPreflight> {
  throwIfAborted(signal);
  const pixelRatio = dpi === undefined ? 2 : getExportPixelRatio(context.pageFormat, dpi);
  const issues: ExportIssue[] = [];
  const dimensions = new Map<string, Promise<{ width: number; height: number }>>();
  const dimensionFor = (assetPath: string) => {
    const existing = dimensions.get(assetPath);
    if (existing) return existing;
    const blob = context.assets[assetPath];
    if (!blob) return null;
    const pending = decodeBlobDimensions(blob);
    dimensions.set(assetPath, pending);
    return pending;
  };

  const inspect = async (target: Omit<ExportIssue, 'kind'>, width: number, height: number, cropWidth?: number, cropHeight?: number, scale = 1) => {
    throwIfAborted(signal);
    const pending = target.assetPath ? dimensionFor(target.assetPath) : null;
    if (!pending) { issues.push({ ...target, kind: 'missing-asset' }); return; }
    try {
      const natural = await pending;
      throwIfAborted(signal);
      const sourceWidth = cropWidth ?? natural.width;
      const sourceHeight = cropHeight ?? natural.height;
      const zoom = cropWidth === undefined ? Math.max(1, scale) : 1;
      if (sourceWidth < width * pixelRatio * zoom || sourceHeight < height * pixelRatio * zoom) {
        issues.push({ ...target, kind: 'low-resolution' });
      }
    } catch {
      throwIfAborted(signal);
      issues.push({ ...target, kind: 'missing-asset' });
    }
  };

  for (const pageIndex of pageIndices) {
    throwIfAborted(signal);
    const page = context.pages[pageIndex];
    if (!page) continue;
    if (page.layoutId) {
      const slots = computeLayoutSlots(page.layoutId, page.layoutPadding ?? context.defaultLayoutPadding, page.layoutGap ?? context.defaultLayoutGap, getPageSize(context.pageFormat));
      for (const [slotIndex, slot] of slots.entries()) {
        const target = { pageIndex, pageId: page.id, slotIndex, imageNumber: slotIndex + 1 };
        const assignment = page.slotAssignments?.[slotIndex];
        if (!assignment) { issues.push({ ...target, kind: 'empty-slot' }); continue; }
        await inspect({ ...target, assetPath: assignment.assetPath }, slot.width, slot.height, assignment.cropW, assignment.cropH, assignment.scale);
      }
    } else {
      let imageNumber = 0;
      for (const element of page.elements) {
        if (element.type !== 'image') continue;
        imageNumber += 1;
        const target = { pageIndex, pageId: page.id, elementId: element.id, imageNumber };
        if (element.isPlaceholder) { issues.push({ ...target, kind: 'empty-slot' }); continue; }
        await inspect({ ...target, assetPath: element.src }, element.width, element.height);
      }
    }
  }
  throwIfAborted(signal);
  return {
    issues,
    pageCount: pageIndices.filter((index) => context.pages[index] !== undefined).length,
    emptySlotCount: issues.filter((issue) => issue.kind === 'empty-slot').length,
    missingAssetCount: issues.filter((issue) => issue.kind === 'missing-asset').length,
    lowResolutionCount: issues.filter((issue) => issue.kind === 'low-resolution').length,
  };
}
