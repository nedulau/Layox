import type { Page } from '../types';
import type { PageRenderer, PageRenderOptions } from '../ports/pageRenderer';
import { CANVAS_H, CANVAS_W } from '../constants/canvas';

export type PdfCompressionLevel = 'none' | 'low' | 'medium' | 'high';

export const PDF_COMPRESSION_PRESETS: {
  id: PdfCompressionLevel;
  label: string;
  description: string;
}[] = [
  { id: 'none', label: 'No compression', description: 'Maximum quality (PNG, large file)' },
  { id: 'low', label: 'Low', description: 'Very high quality (JPEG 95%)' },
  { id: 'medium', label: 'Medium', description: 'Good quality (JPEG 80%)' },
  { id: 'high', label: 'High', description: 'Small file (JPEG 55%)' },
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
): Promise<Blob[]> {
  const blobs: Blob[] = [];
  job.onProgress?.(0, context.pages.length);
  for (const [index, page] of context.pages.entries()) {
    throwIfAborted(job.signal);
    blobs.push(await context.renderer.renderPage(page, context.assets, renderOptions(context, format, job.signal)));
    job.onProgress?.(index + 1, context.pages.length);
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
): Promise<void> {
  const config = compressionConfig(compression);
  const [{ jsPDF }, pageBlobs] = await Promise.all([
    import('jspdf'),
    renderProjectPages(context, config, job),
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
  await saveBlob(pdf.output('blob'), `${safeProjectName(context.projectName)}.pdf`);
}

async function exportCurrentPage(
  context: ProjectExportContext,
  pageIndex: number,
  format: RenderFormat,
  extension: 'png' | 'jpg',
  job: ExportJobOptions = {},
): Promise<void> {
  const page = context.pages[pageIndex];
  if (!page) throw new Error('The selected page no longer exists.');
  job.onProgress?.(0, 1);
  const blob = await context.renderer.renderPage(page, context.assets, renderOptions(context, format, job.signal));
  throwIfAborted(job.signal);
  job.onProgress?.(1, 1);
  await saveBlob(blob, `${safeProjectName(context.projectName)}_Page${pageIndex + 1}.${extension}`);
}

export function exportCurrentPageAsPng(
  context: ProjectExportContext,
  pageIndex: number,
  job?: ExportJobOptions,
): Promise<void> {
  return exportCurrentPage(
    context,
    pageIndex,
    { mimeType: 'image/png', quality: 1, pixelRatio: 2 },
    'png',
    job,
  );
}

export function exportCurrentPageAsJpeg(
  context: ProjectExportContext,
  pageIndex: number,
  job?: ExportJobOptions,
): Promise<void> {
  return exportCurrentPage(
    context,
    pageIndex,
    { mimeType: 'image/jpeg', quality: 0.92, pixelRatio: 2 },
    'jpg',
    job,
  );
}

export async function exportAllPagesAsZip(
  context: ProjectExportContext,
  format: 'png' | 'jpeg' = 'png',
  job: ExportJobOptions = {},
): Promise<void> {
  const renderFormat: RenderFormat = format === 'jpeg'
    ? { mimeType: 'image/jpeg', quality: 0.92, pixelRatio: 2 }
    : { mimeType: 'image/png', quality: 1, pixelRatio: 2 };
  const [{ default: JSZip }, blobs] = await Promise.all([
    import('jszip'),
    renderProjectPages(context, renderFormat, job),
  ]);
  throwIfAborted(job.signal);

  const zip = new JSZip();
  const extension = format === 'jpeg' ? 'jpg' : 'png';
  blobs.forEach((blob, index) => {
    zip.file(`Page_${String(index + 1).padStart(3, '0')}.${extension}`, blob);
  });
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  throwIfAborted(job.signal);
  await saveBlob(zipBlob, `${safeProjectName(context.projectName)}_Images.zip`);
}
