import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { CANVAS_H, CANVAS_W } from '../constants/canvas';

/**
 * Captures the current Konva stage as a data URL (PNG).
 * Works by finding the Konva stage DOM node and calling .toDataURL().
 */
function getStageDataUrl(mimeType: string = 'image/png', quality: number = 1, pixelRatio: number = 2): string | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const konvaStages = (window as any).Konva?.stages;
  if (!konvaStages || konvaStages.length === 0) return null;
  const stage = konvaStages[konvaStages.length - 1];
  return stage.toDataURL({ mimeType, quality, pixelRatio });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/png';
  const binary = atob(base64);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
  return new Blob([array], { type: mime });
}

/**
 * Compression presets for PDF export.
 * Each has a label, an image format (JPEG for compressed, PNG for lossless),
 * a quality value (0–1 for JPEG), and a pixelRatio for capture resolution.
 */
export type PdfCompressionLevel = 'none' | 'low' | 'medium' | 'high';

export const PDF_COMPRESSION_PRESETS: {
  id: PdfCompressionLevel;
  label: string;
  description: string;
}[] = [
  { id: 'none', label: 'Keine Kompression', description: 'Maximale Qualität (PNG, große Datei)' },
  { id: 'low', label: 'Gering', description: 'Sehr hohe Qualität (JPEG 95 %)' },
  { id: 'medium', label: 'Mittel', description: 'Gute Qualität (JPEG 80 %)' },
  { id: 'high', label: 'Stark', description: 'Kleine Datei (JPEG 55 %)' },
];

function compressionConfig(level: PdfCompressionLevel): {
  mime: string;
  quality: number;
  format: 'PNG' | 'JPEG';
  pixelRatio: number;
} {
  switch (level) {
    case 'none':
      return { mime: 'image/png', quality: 1, format: 'PNG', pixelRatio: 2 };
    case 'low':
      return { mime: 'image/jpeg', quality: 0.95, format: 'JPEG', pixelRatio: 2 };
    case 'medium':
      return { mime: 'image/jpeg', quality: 0.80, format: 'JPEG', pixelRatio: 2 };
    case 'high':
      return { mime: 'image/jpeg', quality: 0.55, format: 'JPEG', pixelRatio: 1.5 };
  }
}

/**
 * Export ALL pages of a project as a multi-page PDF.
 * Navigates through pages, captures each, then restores position.
 */
export async function exportAsPdf(
  pageCount: number,
  setPageIndex: (i: number) => void,
  projectName: string,
  compression: PdfCompressionLevel = 'none',
): Promise<void> {
  const cfg = compressionConfig(compression);

  // A4 landscape proportions with scale-to-fit for current canvas size
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  // Scale canvas into page maintaining aspect ratio
  const scale = Math.min(pageW / CANVAS_W, pageH / CANVAS_H);
  const imgW = CANVAS_W * scale;
  const imgH = CANVAS_H * scale;
  const offsetX = (pageW - imgW) / 2;
  const offsetY = (pageH - imgH) / 2;

  const originalIndex = getCurrentPageIndex();

  for (let i = 0; i < pageCount; i++) {
    setPageIndex(i);
    // Give Konva a frame to render the new page
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const dataUrl = getStageDataUrl(cfg.mime, cfg.quality, cfg.pixelRatio);
    if (!dataUrl) continue;

    if (i > 0) pdf.addPage();
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pageW, pageH, 'F');
    pdf.addImage(dataUrl, cfg.format, offsetX, offsetY, imgW, imgH);
  }

  // Restore original page
  setPageIndex(originalIndex);
  await new Promise((r) => requestAnimationFrame(r));

  const safeName = projectName.replace(/[^a-zA-Z0-9_\-äöüÄÖÜß ]/g, '_');
  pdf.save(`${safeName}.pdf`);
}

/**
 * Export current page as PNG.
 */
export function exportCurrentPageAsPng(projectName: string, pageIndex: number): void {
  const dataUrl = getStageDataUrl('image/png', 1);
  if (!dataUrl) return;
  const blob = dataUrlToBlob(dataUrl);
  const safeName = projectName.replace(/[^a-zA-Z0-9_\-äöüÄÖÜß ]/g, '_');
  saveAs(blob, `${safeName}_Seite${pageIndex + 1}.png`);
}

/**
 * Export current page as JPEG.
 */
export function exportCurrentPageAsJpeg(projectName: string, pageIndex: number): void {
  const dataUrl = getStageDataUrl('image/jpeg', 0.92);
  if (!dataUrl) return;
  const blob = dataUrlToBlob(dataUrl);
  const safeName = projectName.replace(/[^a-zA-Z0-9_\-äöüÄÖÜß ]/g, '_');
  saveAs(blob, `${safeName}_Seite${pageIndex + 1}.jpg`);
}

function getCurrentPageIndex(): number {
  // Access the Zustand store directly for the current page index
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
    const store = (globalThis as any).__layoxStore;
    return store?.getState?.()?.currentPageIndex ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Export ALL pages as individual images packed into a ZIP file.
 * Each page becomes "Seite_001.png" (or .jpg) inside the ZIP.
 */
export async function exportAllPagesAsZip(
  pageCount: number,
  setPageIndex: (i: number) => void,
  projectName: string,
  format: 'png' | 'jpeg' = 'png',
): Promise<void> {
  const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
  const quality = format === 'jpeg' ? 0.92 : 1;
  const ext = format === 'jpeg' ? 'jpg' : 'png';

  const zip = new JSZip();
  const originalIndex = getCurrentPageIndex();

  for (let i = 0; i < pageCount; i++) {
    setPageIndex(i);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const dataUrl = getStageDataUrl(mime, quality, 2);
    if (!dataUrl) continue;

    const blob = dataUrlToBlob(dataUrl);
    const padded = String(i + 1).padStart(3, '0');
    zip.file(`Seite_${padded}.${ext}`, blob);
  }

  // Restore original page
  setPageIndex(originalIndex);
  await new Promise((r) => requestAnimationFrame(r));

  const safeName = projectName.replace(/[^a-zA-Z0-9_\-äöüÄÖÜß ]/g, '_');
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  saveAs(zipBlob, `${safeName}_Bilder.zip`);
}
