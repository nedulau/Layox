import { CANVAS_H, CANVAS_W } from '../constants/canvas';
import type { Project } from '../types';

export const PAGE_FORMATS = ['classic', 'a4-landscape', 'a4-portrait', 'square'] as const;
export type PageFormat = typeof PAGE_FORMATS[number];
export interface PageSize { width: number; height: number }

export function getPageSize(format: PageFormat = 'classic'): PageSize {
  switch (format) {
    case 'a4-landscape': return { width: CANVAS_W, height: CANVAS_W * 210 / 297 };
    case 'a4-portrait': return { width: CANVAS_W * 210 / 297, height: CANVAS_W };
    case 'square': return { width: CANVAS_W, height: CANVAS_W };
    default: return { width: CANVAS_W, height: CANVAS_H };
  }
}

export function getPrintSize(format: PageFormat = 'classic'): PageSize {
  switch (format) {
    case 'a4-portrait': return { width: 210, height: 297 };
    case 'square': return { width: 210, height: 210 };
    default: return { width: 297, height: 210 };
  }
}

export function getExportPixelRatio(format: PageFormat = 'classic', dpi = 150): number {
  if (![150, 300, 600].includes(dpi)) throw new Error('Unsupported export resolution.');
  const canvas = getPageSize(format);
  const print = getPrintSize(format);
  return Math.min(print.width / canvas.width, print.height / canvas.height) * dpi / 25.4;
}

/** Reflow slots and move free content proportionally without stretching photos. */
export function changePageFormat(project: Project, format: PageFormat): Project {
  if ((project.meta.pageFormat ?? 'classic') === format) return project;
  const previous = getPageSize(project.meta.pageFormat);
  const next = getPageSize(format);
  const sx = next.width / previous.width;
  const sy = next.height / previous.height;
  const scale = Math.min(sx, sy);
  return {
    ...project,
    meta: { ...project.meta, version: '1.2', pageFormat: format },
    pages: project.pages.map((page) => ({
      ...page,
      elements: page.elements.map((element) => ({
        ...element, x: element.x * sx, y: element.y * sy,
        ...(element.type === 'image'
          ? { width: element.width * scale, height: element.height * scale }
          : { fontSize: element.fontSize * scale, ...(element.width === undefined ? {} : { width: element.width * scale }) }),
      })),
      ...(page.coverTitleX === undefined ? {} : { coverTitleX: page.coverTitleX * sx }),
      ...(page.coverTitleY === undefined ? {} : { coverTitleY: page.coverTitleY * sy }),
      ...(page.coverSubtitleX === undefined ? {} : { coverSubtitleX: page.coverSubtitleX * sx }),
      ...(page.coverSubtitleY === undefined ? {} : { coverSubtitleY: page.coverSubtitleY * sy }),
      slotAssignments: page.slotAssignments && Object.fromEntries(Object.entries(page.slotAssignments).map(([key, assignment]) => [key, {
        ...assignment, offsetX: assignment.offsetX * sx, offsetY: assignment.offsetY * sy,
      }])),
    })),
  };
}
