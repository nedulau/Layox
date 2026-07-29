import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCenteredImageElement } from '../imageElementFactory';

const originalImage = window.Image;

function installImageStub({
  width,
  height,
  fails = false,
}: {
  width: number;
  height: number;
  fails?: boolean;
}) {
  class ImageStub {
    naturalWidth = width;
    naturalHeight = height;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;

    set src(_value: string) {
      queueMicrotask(() => {
        if (fails) this.onerror?.();
        else this.onload?.();
      });
    }
  }
  Object.defineProperty(window, 'Image', {
    configurable: true,
    writable: true,
    value: ImageStub,
  });
}

describe('createCenteredImageElement', () => {
  beforeEach(() => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:image');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, 'Image', {
      configurable: true,
      writable: true,
      value: originalImage,
    });
  });

  it('keeps small images at their natural size and centers them', async () => {
    installImageStub({ width: 400, height: 200 });

    await expect(createCenteredImageElement({
      id: 'image-1',
      assetPath: 'assets/photo.jpg',
      blob: new Blob(['photo']),
      zIndex: 3,
    })).resolves.toEqual({
      id: 'image-1',
      type: 'image',
      x: 400,
      y: 350,
      width: 400,
      height: 200,
      rotation: 0,
      zIndex: 3,
      src: 'assets/photo.jpg',
    });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:image');
  });

  it('scales large images proportionally into the canvas bounds', async () => {
    installImageStub({ width: 1600, height: 1200 });

    const element = await createCenteredImageElement({
      id: 'image-2',
      assetPath: 'assets/large.jpg',
      blob: new Blob(['photo']),
      zIndex: 0,
    });

    expect(element).toMatchObject({
      x: 150,
      y: 113,
      width: 900,
      height: 675,
    });
  });

  it('uses the existing fallback dimensions when decoding fails', async () => {
    installImageStub({ width: 0, height: 0, fails: true });

    const element = await createCenteredImageElement({
      id: 'image-3',
      assetPath: 'assets/broken.jpg',
      blob: new Blob(['broken']),
      zIndex: 0,
    });

    expect(element).toMatchObject({
      x: 450,
      y: 350,
      width: 300,
      height: 200,
    });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:image');
  });
});
