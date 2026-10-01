export type ImageOrientation = 'landscape' | 'portrait' | 'square' | 'unknown';
export interface ImageMetadata {
  width: number;
  height: number;
  orientation: ImageOrientation;
  capturedAt?: string;
}

const cache = new WeakMap<Blob, Promise<ImageMetadata>>();

function normalizeCaptureDate(value: string): string | undefined {
  const match = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(value);
  if (!match) return;
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (year < 1000 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day
    || date.getUTCHours() !== hour || date.getUTCMinutes() !== minute || date.getUTCSeconds() !== second) return;
  // EXIF without a timezone is a wall-clock value, not an inferred UTC timestamp.
  return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}`;
}

function readExif(bytes: Uint8Array): { capturedAt?: string; rotated: boolean } {
  let capturedAt: string | undefined;
  let rotated = false;
  if (bytes.length < 8) return { rotated };
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const little = bytes[0] === 0x49 && bytes[1] === 0x49;
  if (!little && !(bytes[0] === 0x4d && bytes[1] === 0x4d)) return { rotated };
  if (view.getUint16(2, little) !== 42) return { rotated };
  const readDirectory = (offset: number, nested: boolean) => {
    if (offset < 8 || offset + 2 > bytes.length) return;
    const count = Math.min(view.getUint16(offset, little), 256);
    for (let i = 0; i < count; i += 1) {
      const entry = offset + 2 + i * 12;
      if (entry + 12 > bytes.length) return;
      const tag = view.getUint16(entry, little);
      const type = view.getUint16(entry + 2, little);
      const length = view.getUint32(entry + 4, little);
      if (tag === 0x0112 && type === 3 && length === 1) rotated = view.getUint16(entry + 8, little) >= 5 && view.getUint16(entry + 8, little) <= 8;
      if (tag === 0x8769 && type === 4 && length === 1 && !nested) readDirectory(view.getUint32(entry + 8, little), true);
      if (tag === 0x9003 && type === 2 && length >= 19 && length <= 64) {
        const start = view.getUint32(entry + 8, little);
        if (start + length <= bytes.length) capturedAt = normalizeCaptureDate(String.fromCharCode(...bytes.subarray(start, start + 19)));
      }
    }
  };
  readDirectory(view.getUint32(4, little), false);
  return { capturedAt, rotated };
}

function metadata(width: number, height: number, capturedAt?: string): ImageMetadata {
  return { width, height, capturedAt, orientation: width <= 0 || height <= 0 ? 'unknown' : width === height ? 'square' : width > height ? 'landscape' : 'portrait' };
}

/** Read common image headers without decoding full-size photographs. */
export function parseImageMetadata(bytes: Uint8Array): ImageMetadata {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length >= 24 && bytes[0] === 137 && String.fromCharCode(...bytes.subarray(1, 4)) === 'PNG') {
    return metadata(view.getUint32(16), view.getUint32(20));
  }
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return metadata(0, 0);
  let width = 0;
  let height = 0;
  let capturedAt: string | undefined;
  let rotated = false;
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) break;
    const marker = bytes[offset + 1];
    if (marker === 0xda || marker === 0xd9) break;
    const length = view.getUint16(offset + 2);
    if (length < 2 || offset + 2 + length > bytes.length) break;
    const start = offset + 4;
    const end = offset + 2 + length;
    if (marker === 0xe1 && length >= 8 && String.fromCharCode(...bytes.subarray(start, start + 6)) === 'Exif\0\0') {
      const exif = readExif(bytes.subarray(start + 6, end));
      capturedAt = exif.capturedAt ?? capturedAt;
      rotated = exif.rotated;
    }
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker) && length >= 7) {
      height = view.getUint16(start + 1);
      width = view.getUint16(start + 3);
    }
    offset = end;
  }
  return rotated ? metadata(height, width, capturedAt) : metadata(width, height, capturedAt);
}

async function decodeDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap === 'function') {
    const image = await createImageBitmap(blob);
    try { return { width: image.width, height: image.height }; }
    finally { image.close(); }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve({ width: image.naturalWidth, height: image.naturalHeight }); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image metadata unavailable.')); };
    image.src = url;
  });
}

export function readImageMetadata(blob: Blob): Promise<ImageMetadata> {
  const existing = cache.get(blob);
  if (existing) return existing;
  const pending = (async () => {
    try {
      const header = parseImageMetadata(new Uint8Array(await blob.slice(0, 512 * 1024).arrayBuffer()));
      if (header.width > 0 && header.height > 0) return header;
      const size = await decodeDimensions(blob);
      return metadata(size.width, size.height, header.capturedAt);
    } catch { return metadata(0, 0); }
  })();
  cache.set(blob, pending);
  return pending;
}
