export const LAYOUT_SLOT_COUNTS = {
  'cover-full': 1,
  'cover-center': 1,
  single: 1,
  'two-side': 2,
  'two-stack': 2,
  'three-cols': 3,
  'grid-4': 4,
  'one-big-two-small': 3,
  'three-rows': 3,
  'grid-6': 6,
  'one-top-two-bottom': 3,
  'two-top-one-bottom': 3,
  'sidebar-left': 3,
  'mosaic-5': 5,
} as const;

export type LayoutId = keyof typeof LAYOUT_SLOT_COUNTS;

export const LAYOUT_IDS = Object.keys(LAYOUT_SLOT_COUNTS) as LayoutId[];
export const MAX_LAYOUT_SPACING = 100;
