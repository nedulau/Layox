import type { LayoutTemplate, LayoutSlot } from '../types';
import { CANVAS_H as H, CANVAS_W as W } from '../constants/canvas';

const P = 20;  // padding from page edge
const G = 10;  // gap between slots
const IW = W - 2 * P; // inner width
const IH = H - 2 * P; // inner height

export const LAYOUT_TEMPLATES: LayoutTemplate[] = [
  {
    id: 'cover-full',
    name: 'Cover (Full)',
    slots: [{ x: 0, y: 0, width: W, height: H }],
  },
  {
    id: 'cover-center',
    name: 'Cover (Centered)',
    slots: [{ x: P + 80, y: P + 80, width: IW - 160, height: IH - 160 }],
  },
  {
    id: 'single',
    name: 'Single',
    slots: [{ x: P, y: P, width: IW, height: IH }],
  },
  {
    id: 'two-side',
    name: 'Two side by side',
    slots: [
      { x: P, y: P, width: (IW - G) / 2, height: IH },
      { x: P + (IW - G) / 2 + G, y: P, width: (IW - G) / 2, height: IH },
    ],
  },
  {
    id: 'two-stack',
    name: 'Two stacked',
    slots: [
      { x: P, y: P, width: IW, height: (IH - G) / 2 },
      { x: P, y: P + (IH - G) / 2 + G, width: IW, height: (IH - G) / 2 },
    ],
  },
  {
    id: 'three-cols',
    name: 'Three columns',
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
    name: 'Grid (4)',
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
    name: '1 large + 2 small',
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
  // ─── Additional layouts ────────────────────────────────────────────────
  {
    id: 'three-rows',
    name: 'Three rows',
    slots: (() => {
      const sh = (IH - 2 * G) / 3;
      return [
        { x: P, y: P, width: IW, height: sh },
        { x: P, y: P + sh + G, width: IW, height: sh },
        { x: P, y: P + 2 * (sh + G), width: IW, height: sh },
      ];
    })(),
  },
  {
    id: 'grid-6',
    name: 'Grid (6)',
    slots: (() => {
      const sw = (IW - 2 * G) / 3;
      const sh = (IH - G) / 2;
      return [
        { x: P, y: P, width: sw, height: sh },
        { x: P + sw + G, y: P, width: sw, height: sh },
        { x: P + 2 * (sw + G), y: P, width: sw, height: sh },
        { x: P, y: P + sh + G, width: sw, height: sh },
        { x: P + sw + G, y: P + sh + G, width: sw, height: sh },
        { x: P + 2 * (sw + G), y: P + sh + G, width: sw, height: sh },
      ];
    })(),
  },
  {
    id: 'one-top-two-bottom',
    name: '1 top + 2 bottom',
    slots: (() => {
      const topH = Math.round(IH * 0.6);
      const botH = IH - topH - G;
      const sw = (IW - G) / 2;
      return [
        { x: P, y: P, width: IW, height: topH },
        { x: P, y: P + topH + G, width: sw, height: botH },
        { x: P + sw + G, y: P + topH + G, width: sw, height: botH },
      ];
    })(),
  },
  {
    id: 'two-top-one-bottom',
    name: '2 top + 1 bottom',
    slots: (() => {
      const topH = Math.round(IH * 0.4);
      const botH = IH - topH - G;
      const sw = (IW - G) / 2;
      return [
        { x: P, y: P, width: sw, height: topH },
        { x: P + sw + G, y: P, width: sw, height: topH },
        { x: P, y: P + topH + G, width: IW, height: botH },
      ];
    })(),
  },
  {
    id: 'sidebar-left',
    name: 'Left sidebar',
    slots: (() => {
      const leftW = Math.round(IW * 0.35);
      const rightW = IW - leftW - G;
      const sh = (IH - G) / 2;
      return [
        { x: P, y: P, width: leftW, height: IH },
        { x: P + leftW + G, y: P, width: rightW, height: sh },
        { x: P + leftW + G, y: P + sh + G, width: rightW, height: sh },
      ];
    })(),
  },
  {
    id: 'mosaic-5',
    name: 'Mosaic (5)',
    slots: (() => {
      const bigW = Math.round(IW * 0.5);
      const smallW = IW - bigW - G;
      const topH = Math.round(IH * 0.6);
      const botH = IH - topH - G;
      const botSw = (IW - 2 * G) / 3;
      return [
        { x: P, y: P, width: bigW, height: topH },
        { x: P + bigW + G, y: P, width: smallW, height: topH },
        { x: P, y: P + topH + G, width: botSw, height: botH },
        { x: P + botSw + G, y: P + topH + G, width: botSw, height: botH },
        { x: P + 2 * (botSw + G), y: P + topH + G, width: botSw, height: botH },
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
    case 'cover-full':
      return [{ x: 0, y: 0, width: W, height: H }];
    case 'cover-center': {
      const inset = Math.min(80, IW / 4, IH / 4);
      return [{ x: padding + inset, y: padding + inset, width: IW - 2 * inset, height: IH - 2 * inset }];
    }
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
    case 'three-rows': {
      const sh = (IH - 2 * gap) / 3;
      return [
        { x: padding, y: padding, width: IW, height: sh },
        { x: padding, y: padding + sh + gap, width: IW, height: sh },
        { x: padding, y: padding + 2 * (sh + gap), width: IW, height: sh },
      ];
    }
    case 'grid-6': {
      const sw = (IW - 2 * gap) / 3;
      const sh = (IH - gap) / 2;
      return [
        { x: padding, y: padding, width: sw, height: sh },
        { x: padding + sw + gap, y: padding, width: sw, height: sh },
        { x: padding + 2 * (sw + gap), y: padding, width: sw, height: sh },
        { x: padding, y: padding + sh + gap, width: sw, height: sh },
        { x: padding + sw + gap, y: padding + sh + gap, width: sw, height: sh },
        { x: padding + 2 * (sw + gap), y: padding + sh + gap, width: sw, height: sh },
      ];
    }
    case 'one-top-two-bottom': {
      const topH = Math.round(IH * 0.6);
      const botH = IH - topH - gap;
      const sw = (IW - gap) / 2;
      return [
        { x: padding, y: padding, width: IW, height: topH },
        { x: padding, y: padding + topH + gap, width: sw, height: botH },
        { x: padding + sw + gap, y: padding + topH + gap, width: sw, height: botH },
      ];
    }
    case 'two-top-one-bottom': {
      const topH = Math.round(IH * 0.4);
      const botH = IH - topH - gap;
      const sw = (IW - gap) / 2;
      return [
        { x: padding, y: padding, width: sw, height: topH },
        { x: padding + sw + gap, y: padding, width: sw, height: topH },
        { x: padding, y: padding + topH + gap, width: IW, height: botH },
      ];
    }
    case 'sidebar-left': {
      const leftW = Math.round(IW * 0.35);
      const rightW = IW - leftW - gap;
      const sh = (IH - gap) / 2;
      return [
        { x: padding, y: padding, width: leftW, height: IH },
        { x: padding + leftW + gap, y: padding, width: rightW, height: sh },
        { x: padding + leftW + gap, y: padding + sh + gap, width: rightW, height: sh },
      ];
    }
    case 'mosaic-5': {
      const bigW = Math.round(IW * 0.5);
      const smallW = IW - bigW - gap;
      const topH = Math.round(IH * 0.6);
      const botH = IH - topH - gap;
      const botSw = (IW - 2 * gap) / 3;
      return [
        { x: padding, y: padding, width: bigW, height: topH },
        { x: padding + bigW + gap, y: padding, width: smallW, height: topH },
        { x: padding, y: padding + topH + gap, width: botSw, height: botH },
        { x: padding + botSw + gap, y: padding + topH + gap, width: botSw, height: botH },
        { x: padding + 2 * (botSw + gap), y: padding + topH + gap, width: botSw, height: botH },
      ];
    }
    default:
      return [];
  }
}
