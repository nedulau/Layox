import { jsPDF } from 'jspdf';
import { saveAs } from 'file-saver';

const CANVAS_W = 800;
const CANVAS_H = 600;

/**
 * Captures the current Konva stage as a data URL (PNG).
 * Works by finding the Konva stage DOM node and calling .toDataURL().
 */
function getStageDataUrl(mimeType: string = 'image/png', quality: number = 1): string | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const konvaStages = (window as any).Konva?.stages;
  if (!konvaStages || konvaStages.length === 0) return null;
  const stage = konvaStages[konvaStages.length - 1];
  return stage.toDataURL({ mimeType, quality, pixelRatio: 2 });
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
 * Export ALL pages of a project as a multi-page PDF.
 * Navigates through pages, captures each, then restores position.
 */
export async function exportAsPdf(
  pageCount: number,
  setPageIndex: (i: number) => void,
  projectName: string,
): Promise<void> {
  // A4 landscape-ish proportions matching 800x600 (4:3)
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

    const dataUrl = getStageDataUrl('image/png', 1);
    if (!dataUrl) continue;

    if (i > 0) pdf.addPage();
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pageW, pageH, 'F');
    pdf.addImage(dataUrl, 'PNG', offsetX, offsetY, imgW, imgH);
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
