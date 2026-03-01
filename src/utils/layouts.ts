import type { LayoutTemplate, LayoutSlot } from '../types';

const P = 20;  // padding from page edge
const G = 10;  // gap between slots
const W = 800; // canvas width
const H = 600; // canvas height
const IW = W - 2 * P; // inner width
const IH = H - 2 * P; // inner height

export const LAYOUT_TEMPLATES: LayoutTemplate[] = [
  {
    id: 'single',
    name: 'Einzelbild',
    slots: [{ x: P, y: P, width: IW, height: IH }],
  },
  {
    id: 'two-side',
    name: 'Zwei nebeneinander',
    slots: [
      { x: P, y: P, width: (IW - G) / 2, height: IH },
      { x: P + (IW - G) / 2 + G, y: P, width: (IW - G) / 2, height: IH },
    ],
  },
  {
    id: 'two-stack',
    name: 'Zwei übereinander',
    slots: [
      { x: P, y: P, width: IW, height: (IH - G) / 2 },
      { x: P, y: P + (IH - G) / 2 + G, width: IW, height: (IH - G) / 2 },
    ],
  },
  {
    id: 'three-cols',
    name: 'Drei Spalten',
    slots: (() => {
      const sw = (IW - 2 * G) / 3;
      return [
        { x: P, y: P, width: sw, height: IH },
        { x: P + sw + G, y: P, width: sw, height: IH },
        { x: P + 2 * (sw + G), y: P, width: sw, height: IH },
      ];
    })(),
  },
  {
    id: 'grid-4',
    name: 'Vierer-Raster',
    slots: (() => {
      const sw = (IW - G) / 2;
      const sh = (IH - G) / 2;
      return [
        { x: P, y: P, width: sw, height: sh },
        { x: P + sw + G, y: P, width: sw, height: sh },
        { x: P, y: P + sh + G, width: sw, height: sh },
        { x: P + sw + G, y: P + sh + G, width: sw, height: sh },
      ];
    })(),
  },
  {
    id: 'one-big-two-small',
    name: '1 groß + 2 klein',
    slots: (() => {
      const bigW = Math.round(IW * 0.6);
      const smallW = IW - bigW - G;
      const sh = (IH - G) / 2;
      return [
        { x: P, y: P, width: bigW, height: IH },
        { x: P + bigW + G, y: P, width: smallW, height: sh },
        { x: P + bigW + G, y: P + sh + G, width: smallW, height: sh },
      ];
    })(),
  },
];

export function getLayoutById(id: string): LayoutTemplate | undefined {
  return LAYOUT_TEMPLATES.find((l) => l.id === id);
}

export function computeLayoutSlots(layoutId: string, padding: number, gap: number): LayoutSlot[] {
  const IW = W - 2 * padding;
  const IH = H - 2 * padding;

  switch (layoutId) {
    case 'single':
      return [{ x: padding, y: padding, width: IW, height: IH }];
    case 'two-side': {
      const sw = (IW - gap) / 2;
      return [
        { x: padding, y: padding, width: sw, height: IH },
        { x: padding + sw + gap, y: padding, width: sw, height: IH },
      ];
    }
    case 'two-stack': {
      const sh = (IH - gap) / 2;
      return [
        { x: padding, y: padding, width: IW, height: sh },
        { x: padding, y: padding + sh + gap, width: IW, height: sh },
      ];
    }
    case 'three-cols': {
      const sw = (IW - 2 * gap) / 3;
      return [
        { x: padding, y: padding, width: sw, height: IH },
        { x: padding + sw + gap, y: padding, width: sw, height: IH },
        { x: padding + 2 * (sw + gap), y: padding, width: sw, height: IH },
      ];
    }
    case 'grid-4': {
      const sw = (IW - gap) / 2;
      const sh = (IH - gap) / 2;
      return [
        { x: padding, y: padding, width: sw, height: sh },
        { x: padding + sw + gap, y: padding, width: sw, height: sh },
        { x: padding, y: padding + sh + gap, width: sw, height: sh },
        { x: padding + sw + gap, y: padding + sh + gap, width: sw, height: sh },
      ];
    }
    case 'one-big-two-small': {
      const bigW = Math.round(IW * 0.6);
      const smallW = IW - bigW - gap;
      const sh = (IH - gap) / 2;
      return [
        { x: padding, y: padding, width: bigW, height: IH },
        { x: padding + bigW + gap, y: padding, width: smallW, height: sh },
        { x: padding + bigW + gap, y: padding + sh + gap, width: smallW, height: sh },
      ];
    }
    default:
      return [];
  }
}
