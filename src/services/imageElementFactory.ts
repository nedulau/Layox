import { getPageSize, type PageSize } from '../domain/pageFormat';
import type { ImageElement } from '../types';

interface ImageElementFactoryOptions {
  id: string;
  assetPath: string;
  blob: Blob;
  zIndex: number;
  size?: PageSize;
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

function fitWithinCanvas(width: number, height: number, size: PageSize): { width: number; height: number } {
  if (width <= size.width * 0.75 && height <= size.height * 0.75) {
    return { width, height };
  }
  const scale = Math.min(size.width * 0.75 / width, size.height * 0.75 / height);
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
  size: pageSize = getPageSize(),
}: ImageElementFactoryOptions): Promise<ImageElement> {
  const naturalSize = await readImageDimensions(blob);
  const size = fitWithinCanvas(naturalSize.width, naturalSize.height, pageSize);
  return {
    id,
    type: 'image',
    x: Math.round((pageSize.width - size.width) / 2),
    y: Math.round((pageSize.height - size.height) / 2),
    width: size.width,
    height: size.height,
    rotation: 0,
    zIndex,
    src: assetPath,
  };
}
