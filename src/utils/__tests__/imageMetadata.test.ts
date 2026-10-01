import { Blob as NodeBlob } from 'node:buffer';
import { describe, expect, it, vi } from 'vitest';
import { parseImageMetadata, readImageMetadata } from '../imageMetadata';

function jpeg(little: boolean, date = '2024:07:19 15:24:30', orientation = 6) {
  const tiff = new Uint8Array(90);
  const view = new DataView(tiff.buffer);
  tiff[0] = tiff[1] = little ? 0x49 : 0x4d;
  view.setUint16(2, 42, little); view.setUint32(4, 8, little);
  view.setUint16(8, 2, little);
  view.setUint16(10, 0x112, little); view.setUint16(12, 3, little); view.setUint32(14, 1, little); view.setUint16(18, orientation, little);
  view.setUint16(22, 0x8769, little); view.setUint16(24, 4, little); view.setUint32(26, 1, little); view.setUint32(30, 38, little);
  view.setUint16(38, 1, little);
  view.setUint16(40, 0x9003, little); view.setUint16(42, 2, little); view.setUint32(44, 20, little); view.setUint32(48, 58, little);
  tiff.set(new TextEncoder().encode(date), 58);
  const bytes = new Uint8Array(2 + 4 + 6 + tiff.length + 13);
  bytes.set([0xff, 0xd8, 0xff, 0xe1, 0, tiff.length + 8, 69, 120, 105, 102, 0, 0]);
  bytes.set(tiff, 12);
  bytes.set([0xff, 0xc0, 0, 9, 8, 0, 100, 0, 200, 0, 0, 0xff, 0xd9], 12 + tiff.length);
  return bytes;
}

describe('image header metadata', () => {
  it.each([true, false])('reads EXIF capture time and rotation with little endian = %s', (little) => {
    expect(parseImageMetadata(jpeg(little))).toEqual({ width: 100, height: 200, orientation: 'portrait', capturedAt: '2024-07-19T15:24:30' });
    expect(parseImageMetadata(jpeg(little, '2024:07:19 15:24:30', 1)).orientation).toBe('landscape');
  });
  it('does not invent capture times from malformed dates', () => {
    expect(parseImageMetadata(jpeg(true, '2024:02:31 15:24:30')).capturedAt).toBeUndefined();
    expect(parseImageMetadata(jpeg(true, 'invalid')).capturedAt).toBeUndefined();
    expect(parseImageMetadata(jpeg(true, '0999:01:01 00:00:00')).capturedAt).toBeUndefined();
  });
  it('handles truncated and invalid headers without reading beyond their bounds', () => {
    for (let size = 0; size < 110; size += 1) expect(() => parseImageMetadata(jpeg(true).slice(0, size))).not.toThrow();
    const malformed = jpeg(true); malformed[30] = 255; malformed[31] = 255;
    expect(() => parseImageMetadata(malformed)).not.toThrow();
    expect(parseImageMetadata(new Uint8Array([0, 1, 2])).orientation).toBe('unknown');
  });
  it('reads PNG dimensions without decoding a bitmap', async () => {
    const bytes = new Uint8Array(24); bytes.set([137, 80, 78, 71]);
    const view = new DataView(bytes.buffer); view.setUint32(16, 200); view.setUint32(20, 200);
    const bitmap = vi.fn(); vi.stubGlobal('createImageBitmap', bitmap);
    const blob = new NodeBlob([bytes]) as unknown as Blob;
    expect(readImageMetadata(blob)).toBe(readImageMetadata(blob));
    await expect(readImageMetadata(blob)).resolves.toMatchObject({ width: 200, height: 200, orientation: 'square' });
    expect(bitmap).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
  it('falls back to bitmap dimensions for other formats and closes the bitmap', async () => {
    const close = vi.fn();
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 640, height: 480, close })));
    await expect(readImageMetadata(new NodeBlob(['other']) as unknown as Blob)).resolves.toMatchObject({ orientation: 'landscape' });
    expect(close).toHaveBeenCalled();
    vi.stubGlobal('createImageBitmap', vi.fn(async () => { throw new Error('bad image'); }));
    await expect(readImageMetadata(new NodeBlob(['bad']) as unknown as Blob)).resolves.toMatchObject({ orientation: 'unknown' });
    vi.unstubAllGlobals();
  });
});
