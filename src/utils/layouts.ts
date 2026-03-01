import type { LayoutTemplate } from '../types';

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
