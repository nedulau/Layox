import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Page } from '../../types';

const konvaState = vi.hoisted(() => ({
  created: [] as Array<{ kind: string; config: Record<string, unknown> }>,
  order: [] as string[],
}));

vi.mock('konva', () => {
  class MockNode {
    children: MockNode[] = [];
    constructor(kind: string, config: Record<string, unknown> = {}) {
      konvaState.created.push({ kind, config });
    }
    add(child: MockNode) { this.children.push(child); }
    draw() { konvaState.order.push('draw'); }
    destroy() { konvaState.order.push('destroy'); }
    toCanvas() {
      konvaState.order.push('canvas');
      return {
        toBlob(callback: (blob: Blob | null) => void) {
          callback(new Blob(['rendered'], { type: 'image/png' }));
        },
      };
    }
  }

  return {
    default: {
      Stage: class extends MockNode {
        constructor(config: Record<string, unknown>) { super('Stage', config); }
      },
      Layer: class extends MockNode {
        constructor(config: Record<string, unknown>) { super('Layer', config); }
      },
      Group: class extends MockNode {
        constructor(config: Record<string, unknown>) { super('Group', config); }
      },
      Rect: class extends MockNode {
        constructor(config: Record<string, unknown>) { super('Rect', config); }
      },
      Image: class extends MockNode {
        constructor(config: Record<string, unknown>) { super('Image', config); }
      },
      Text: class extends MockNode {
        constructor(config: Record<string, unknown>) { super('Text', config); }
      },
    },
  };
});

class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 1600;
  naturalHeight = 1200;

  set src(_value: string) {
    queueMicrotask(() => this.onload?.());
  }

  async decode(): Promise<void> {
    konvaState.order.push('decode');
  }
}

const { konvaPageRenderer } = await import('../konvaPageRenderer');

describe('konvaPageRenderer', () => {
  beforeEach(() => {
    konvaState.created.length = 0;
    konvaState.order.length = 0;
    vi.stubGlobal('Image', MockImage);
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:asset'),
      revokeObjectURL: vi.fn(),
    });
  });

  it('decodes all images before capture and builds only printable scene nodes', async () => {
    const page: Page = {
      id: 'page-1',
      background: '#fefefe',
      layoutId: 'single',
      slotAssignments: {
        0: { assetPath: 'assets/photo.jpg', offsetX: 0, offsetY: 0, scale: 1 },
      },
      elements: [
        {
          id: 'text-1',
          type: 'text',
          x: 10,
          y: 20,
          rotation: 0,
          zIndex: 1,
          content: 'Printed text',
          fontSize: 32,
          fontFamily: 'Arial',
          color: '#111111',
        },
      ],
    };

    const blob = await konvaPageRenderer.renderPage(
      page,
      { 'assets/photo.jpg': new Blob(['photo']) },
      {
        mimeType: 'image/png',
        quality: 1,
        pixelRatio: 2,
        defaultLayoutPadding: 20,
        defaultLayoutGap: 20,
      },
    );

    expect(blob).toBeInstanceOf(Blob);
    expect(konvaState.order.indexOf('decode')).toBeLessThan(konvaState.order.indexOf('canvas'));
    expect(konvaState.created.map((node) => node.kind)).toEqual([
      'Stage', 'Layer', 'Rect', 'Group', 'Image', 'Text',
    ]);
    expect(konvaState.created.some((node) => ['Transformer', 'Line'].includes(node.kind))).toBe(false);
    expect(konvaState.created.find((node) => node.kind === 'Text')?.config.text).toBe('Printed text');
  });

  it('rejects a page when a referenced image is unavailable', async () => {
    const page: Page = {
      id: 'page-1',
      background: '#fff',
      elements: [
        {
          id: 'image-1',
          type: 'image',
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          rotation: 0,
          zIndex: 0,
          src: 'assets/missing.jpg',
        },
      ],
    };

    await expect(konvaPageRenderer.renderPage(page, {}, {
      mimeType: 'image/png',
      quality: 1,
      pixelRatio: 2,
      defaultLayoutPadding: 20,
      defaultLayoutGap: 20,
    })).rejects.toThrow('missing the referenced image');
  });
});
