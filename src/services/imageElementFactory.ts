import {
  CANVAS_H,
  CANVAS_IMAGE_MAX_H,
  CANVAS_IMAGE_MAX_W,
  CANVAS_W,
} from '../constants/canvas';
import type { ImageElement } from '../types';

interface ImageElementFactoryOptions {
  id: string;
  assetPath: string;
  blob: Blob;
  zIndex: number;
}

function readImageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const image = new window.Image();
    const finish = (width: number, height: number) => {
      URL.revokeObjectURL(url);
      resolve({ width, height });
    };
    image.onload = () => finish(image.naturalWidth, image.naturalHeight);
    image.onerror = () => finish(300, 200);
    image.src = url;
  });
}

function fitWithinCanvas(width: number, height: number): { width: number; height: number } {
  if (width <= CANVAS_IMAGE_MAX_W && height <= CANVAS_IMAGE_MAX_H) {
    return { width, height };
  }
  const scale = Math.min(CANVAS_IMAGE_MAX_W / width, CANVAS_IMAGE_MAX_H / height);
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

/** Creates a free-positioned image element using the shared import placement rules. */
export async function createCenteredImageElement({
  id,
  assetPath,
  blob,
  zIndex,
}: ImageElementFactoryOptions): Promise<ImageElement> {
  const naturalSize = await readImageDimensions(blob);
  const size = fitWithinCanvas(naturalSize.width, naturalSize.height);
  return {
    id,
    type: 'image',
    x: Math.round((CANVAS_W - size.width) / 2),
    y: Math.round((CANVAS_H - size.height) / 2),
    width: size.width,
    height: size.height,
    rotation: 0,
    zIndex,
    src: assetPath,
  };
}
