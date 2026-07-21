import type KonvaType from 'konva';
import type { Page, PageElement, SlotAssignment } from '../types';
import type { PageRenderer, PageRenderOptions } from '../ports/pageRenderer';
import { CANVAS_H, CANVAS_W } from '../constants/canvas';
import { computeLayoutSlots } from './layouts';
import {
  DEFAULT_COVER_SUBTITLE_COLOR,
  DEFAULT_COVER_SUBTITLE_FONT_FAMILY,
  DEFAULT_COVER_SUBTITLE_FONT_SIZE,
  DEFAULT_COVER_TITLE_COLOR,
  DEFAULT_COVER_TITLE_FONT_FAMILY,
  DEFAULT_COVER_TITLE_FONT_SIZE,
  DEFAULT_PAGE_BACKGROUND,
} from '../domain/projectDefaults';

function abortError(): DOMException {
  return new DOMException('Export cancelled.', 'AbortError');
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

function collectImagePaths(page: Page): string[] {
  const paths = new Set<string>();
  Object.values(page.slotAssignments ?? {}).forEach((assignment) => {
    if (assignment?.assetPath) paths.add(assignment.assetPath);
  });
  page.elements.forEach((element) => {
    if (element.type === 'image') paths.add(element.src);
  });
  return [...paths];
}

async function loadImage(path: string, blob: Blob, signal?: AbortSignal): Promise<HTMLImageElement> {
  throwIfAborted(signal);
  const image = new Image();
  const objectUrl = URL.createObjectURL(blob);
  try {
    await new Promise<void>((resolve, reject) => {
      const onAbort = () => reject(abortError());
      signal?.addEventListener('abort', onAbort, { once: true });
      image.onload = () => {
        signal?.removeEventListener('abort', onAbort);
        resolve();
      };
      image.onerror = () => {
        signal?.removeEventListener('abort', onAbort);
        reject(new Error(`Image could not be loaded: ${path}`));
      };
      image.src = objectUrl;
    });
    if (typeof image.decode === 'function') await image.decode();
    throwIfAborted(signal);
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function loadPageImages(
  page: Page,
  assets: Record<string, Blob>,
  signal?: AbortSignal,
): Promise<Map<string, HTMLImageElement>> {
  const entries = await Promise.all(collectImagePaths(page).map(async (path) => {
    const blob = assets[path];
    if (!blob) throw new Error(`Export is missing the referenced image: ${path}`);
    return [path, await loadImage(path, blob, signal)] as const;
  }));
  return new Map(entries);
}

function addSlotImage(
  Konva: typeof KonvaType,
  layer: KonvaType.Layer,
  slot: { x: number; y: number; width: number; height: number },
  assignment: SlotAssignment,
  image: HTMLImageElement,
): void {
  const group = new Konva.Group({
    clipX: slot.x,
    clipY: slot.y,
    clipWidth: slot.width,
    clipHeight: slot.height,
    listening: false,
  });
  const hasCrop = assignment.cropX !== undefined
    && assignment.cropY !== undefined
    && assignment.cropW !== undefined
    && assignment.cropH !== undefined;

  if (hasCrop) {
    group.add(new Konva.Image({
      image,
      x: slot.x,
      y: slot.y,
      width: slot.width,
      height: slot.height,
      crop: {
        x: assignment.cropX!,
        y: assignment.cropY!,
        width: assignment.cropW!,
        height: assignment.cropH!,
      },
      listening: false,
    }));
  } else {
    const baseScale = Math.max(slot.width / image.naturalWidth, slot.height / image.naturalHeight);
    const finalScale = baseScale * Math.max(1, assignment.scale || 1);
    const renderedWidth = image.naturalWidth * finalScale;
    const renderedHeight = image.naturalHeight * finalScale;
    const excessWidth = renderedWidth - slot.width;
    const excessHeight = renderedHeight - slot.height;
    const offsetX = Math.max(-excessWidth / 2, Math.min(excessWidth / 2, assignment.offsetX || 0));
    const offsetY = Math.max(-excessHeight / 2, Math.min(excessHeight / 2, assignment.offsetY || 0));
    group.add(new Konva.Image({
      image,
      x: slot.x - excessWidth / 2 + offsetX,
      y: slot.y - excessHeight / 2 + offsetY,
      width: renderedWidth,
      height: renderedHeight,
      listening: false,
    }));
  }
  layer.add(group);
}

function addPageElement(
  Konva: typeof KonvaType,
  layer: KonvaType.Layer,
  element: PageElement,
  images: Map<string, HTMLImageElement>,
): void {
  if (element.type === 'image') {
    const image = images.get(element.src);
    if (!image) throw new Error(`Export is missing the decoded image: ${element.src}`);
    layer.add(new Konva.Image({
      image,
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
      rotation: element.rotation,
      listening: false,
    }));
    return;
  }

  layer.add(new Konva.Text({
    x: element.x,
    y: element.y,
    text: element.content,
    fontSize: element.fontSize,
    fontFamily: element.fontFamily,
    fill: element.color,
    width: element.width,
    rotation: element.rotation,
    listening: false,
  }));
}

function addCoverText(Konva: typeof KonvaType, layer: KonvaType.Layer, page: Page): void {
  if (!page.isCover) return;
  if (page.coverTitle) {
    layer.add(new Konva.Text({
      x: page.coverTitleX ?? 0,
      y: page.coverTitleY ?? CANVAS_H * 0.35,
      width: CANVAS_W,
      text: page.coverTitle,
      fontSize: page.coverTitleFontSize ?? DEFAULT_COVER_TITLE_FONT_SIZE,
      fontFamily: page.coverTitleFontFamily ?? DEFAULT_COVER_TITLE_FONT_FAMILY,
      fontStyle: 'bold',
      fill: page.coverTitleColor ?? DEFAULT_COVER_TITLE_COLOR,
      shadowColor: '#000000',
      shadowBlur: 8,
      shadowOpacity: 0.7,
      align: 'center',
      listening: false,
    }));
  }
  if (page.showCoverSubtitle && page.coverSubtitle) {
    layer.add(new Konva.Text({
      x: page.coverSubtitleX ?? 0,
      y: page.coverSubtitleY ?? CANVAS_H * 0.35 + 60,
      width: CANVAS_W,
      text: page.coverSubtitle,
      fontSize: page.coverSubtitleFontSize ?? DEFAULT_COVER_SUBTITLE_FONT_SIZE,
      fontFamily: page.coverSubtitleFontFamily ?? DEFAULT_COVER_SUBTITLE_FONT_FAMILY,
      fill: page.coverSubtitleColor ?? DEFAULT_COVER_SUBTITLE_COLOR,
      shadowColor: '#000000',
      shadowBlur: 6,
      shadowOpacity: 0.5,
      align: 'center',
      listening: false,
    }));
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('The browser could not encode the rendered page.'));
    }, mimeType, quality);
  });
}

export const konvaPageRenderer: PageRenderer = {
  async renderPage(page, assets, options: PageRenderOptions) {
    throwIfAborted(options.signal);
    const [{ default: Konva }, images] = await Promise.all([
      import('konva'),
      loadPageImages(page, assets, options.signal),
      document.fonts?.ready,
    ]);
    throwIfAborted(options.signal);

    const container = document.createElement('div');
    container.setAttribute('aria-hidden', 'true');
    container.style.cssText = `position:fixed;left:-100000px;top:0;width:${CANVAS_W}px;height:${CANVAS_H}px;`;
    document.body.appendChild(container);
    const stage = new Konva.Stage({ container, width: CANVAS_W, height: CANVAS_H });
    const layer = new Konva.Layer({ listening: false });
    stage.add(layer);

    try {
      layer.add(new Konva.Rect({
        x: 0,
        y: 0,
        width: CANVAS_W,
        height: CANVAS_H,
        fill: page.background || DEFAULT_PAGE_BACKGROUND,
        listening: false,
      }));

      if (page.layoutId) {
        const slots = computeLayoutSlots(
          page.layoutId,
          page.layoutPadding ?? options.defaultLayoutPadding,
          page.layoutGap ?? options.defaultLayoutGap,
        );
        slots.forEach((slot, index) => {
          const assignment = page.slotAssignments?.[index];
          if (!assignment) return;
          const image = images.get(assignment.assetPath);
          if (!image) throw new Error(`Export is missing the decoded image: ${assignment.assetPath}`);
          addSlotImage(Konva, layer, slot, assignment, image);
        });
      }

      addCoverText(Konva, layer, page);
      page.elements
        .filter((element) => !page.layoutId || element.type === 'text')
        .sort((first, second) => first.zIndex - second.zIndex)
        .forEach((element) => addPageElement(Konva, layer, element, images));

      layer.draw();
      throwIfAborted(options.signal);
      const canvas = stage.toCanvas({ pixelRatio: options.pixelRatio });
      const blob = await canvasToBlob(canvas, options.mimeType, options.quality);
      throwIfAborted(options.signal);
      return blob;
    } finally {
      stage.destroy();
      container.remove();
    }
  },
};
