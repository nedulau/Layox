import type { Page } from '../types';
import type { PageRenderer, PageRenderOptions } from '../ports/pageRenderer';
import { CANVAS_H, CANVAS_W } from '../constants/canvas';
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
  defaultLayoutPadding: number;
  defaultLayoutGap: number;
}

export interface ExportJobOptions {
  signal?: AbortSignal;
  onProgress?: (completed: number, total: number) => void;
}

export interface ExportPreflight {
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
): PageRenderOptions {
  return {
    ...format,
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
    blobs.push(await context.renderer.renderPage(page, context.assets, renderOptions(context, format, job.signal)));
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

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const scale = Math.min(pageWidth / CANVAS_W, pageHeight / CANVAS_H);
  const imageWidth = CANVAS_W * scale;
  const imageHeight = CANVAS_H * scale;
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
  const blob = await context.renderer.renderPage(page, context.assets, renderOptions(context, format, job.signal));
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
): Promise<ExportPreflight> {
  let emptySlotCount = 0;
  let missingAssetCount = 0;
  let lowResolutionCount = 0;
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

  for (const pageIndex of pageIndices) {
    const page = context.pages[pageIndex];
    if (!page) continue;
    if (page.layoutId) {
      const slots = computeLayoutSlots(
        page.layoutId,
        page.layoutPadding ?? context.defaultLayoutPadding,
        page.layoutGap ?? context.defaultLayoutGap,
      );
      for (const [slotIndex, slot] of slots.entries()) {
        const assignment = page.slotAssignments?.[slotIndex];
        if (!assignment) {
          emptySlotCount += 1;
          continue;
        }
        const pendingDimensions = dimensionFor(assignment.assetPath);
        if (!pendingDimensions) {
          missingAssetCount += 1;
          continue;
        }
        try {
          const natural = await pendingDimensions;
          const sourceWidth = assignment.cropW ?? natural.width;
          const sourceHeight = assignment.cropH ?? natural.height;
          if (sourceWidth < slot.width * 2 || sourceHeight < slot.height * 2) lowResolutionCount += 1;
        } catch {
          missingAssetCount += 1;
        }
      }
    }
    for (const element of page.elements) {
      if (element.type !== 'image') continue;
      const pendingDimensions = dimensionFor(element.src);
      if (!pendingDimensions) {
        missingAssetCount += 1;
        continue;
      }
      try {
        const natural = await pendingDimensions;
        if (natural.width < element.width * 2 || natural.height < element.height * 2) {
          lowResolutionCount += 1;
        }
      } catch {
        missingAssetCount += 1;
      }
    }
  }

  return {
    pageCount: pageIndices.filter((index) => context.pages[index] !== undefined).length,
    emptySlotCount,
    missingAssetCount,
    lowResolutionCount,
  };
}
