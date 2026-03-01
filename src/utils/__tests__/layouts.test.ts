import { describe, it, expect } from 'vitest';
import { computeLayoutSlots, getLayoutById, LAYOUT_TEMPLATES } from '../../utils/layouts';
import { CANVAS_H, CANVAS_W } from '../../constants/canvas';

describe('layouts', () => {
  describe('LAYOUT_TEMPLATES', () => {
    it('should have 14 layout templates', () => {
      expect(LAYOUT_TEMPLATES).toHaveLength(14);
    });

    it('each template has a unique id', () => {
      const ids = LAYOUT_TEMPLATES.map((t) => t.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('each template has at least one slot', () => {
      for (const t of LAYOUT_TEMPLATES) {
        expect(t.slots.length).toBeGreaterThan(0);
      }
    });

    it('all slots have positive dimensions', () => {
      for (const t of LAYOUT_TEMPLATES) {
        for (const s of t.slots) {
          expect(s.width).toBeGreaterThan(0);
          expect(s.height).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('getLayoutById', () => {
    it('returns the correct template for a known id', () => {
      const single = getLayoutById('single');
      expect(single).toBeDefined();
      expect(single!.name).toBe('Einzelbild');
      expect(single!.slots).toHaveLength(1);
    });

    it('returns undefined for an unknown id', () => {
      expect(getLayoutById('nonexistent')).toBeUndefined();
    });

    it('returns cover-full with a full-page slot', () => {
      const coverFull = getLayoutById('cover-full');
      expect(coverFull).toBeDefined();
      expect(coverFull!.slots[0]).toEqual({ x: 0, y: 0, width: CANVAS_W, height: CANVAS_H });
    });
  });

  describe('computeLayoutSlots', () => {
    it('returns empty array for unknown layout', () => {
      expect(computeLayoutSlots('unknown', 20, 10)).toEqual([]);
    });

    it('cover-full ignores padding', () => {
      const slots = computeLayoutSlots('cover-full', 50, 20);
      expect(slots).toHaveLength(1);
      expect(slots[0]).toEqual({ x: 0, y: 0, width: CANVAS_W, height: CANVAS_H });
    });

    it('single layout uses full inner area', () => {
      const padding = 20;
      const slots = computeLayoutSlots('single', padding, 10);
      expect(slots).toHaveLength(1);
      expect(slots[0].x).toBe(padding);
      expect(slots[0].y).toBe(padding);
      expect(slots[0].width).toBe(CANVAS_W - 2 * padding);
      expect(slots[0].height).toBe(CANVAS_H - 2 * padding);
    });

    it('two-side creates 2 equal slots with gap', () => {
      const padding = 20;
      const gap = 10;
      const slots = computeLayoutSlots('two-side', padding, gap);
      expect(slots).toHaveLength(2);

      const iw = CANVAS_W - 2 * padding;
      const expectedSlotWidth = (iw - gap) / 2;

      expect(slots[0].width).toBeCloseTo(expectedSlotWidth);
      expect(slots[1].width).toBeCloseTo(expectedSlotWidth);
      expect(slots[0].x).toBe(padding);
      expect(slots[1].x).toBeCloseTo(padding + expectedSlotWidth + gap);
    });

    it('two-stack creates 2 equal slots vertically', () => {
      const padding = 20;
      const gap = 10;
      const slots = computeLayoutSlots('two-stack', padding, gap);
      expect(slots).toHaveLength(2);

      const ih = CANVAS_H - 2 * padding;
      const expectedSlotHeight = (ih - gap) / 2;

      expect(slots[0].height).toBeCloseTo(expectedSlotHeight);
      expect(slots[1].height).toBeCloseTo(expectedSlotHeight);
      expect(slots[0].y).toBe(padding);
      expect(slots[1].y).toBeCloseTo(padding + expectedSlotHeight + gap);
    });

    it('three-cols creates 3 equal columns', () => {
      const padding = 20;
      const gap = 10;
      const slots = computeLayoutSlots('three-cols', padding, gap);
      expect(slots).toHaveLength(3);

      const iw = CANVAS_W - 2 * padding;
      const expectedSlotWidth = (iw - 2 * gap) / 3;

      for (const slot of slots) {
        expect(slot.width).toBeCloseTo(expectedSlotWidth);
        expect(slot.height).toBe(CANVAS_H - 2 * padding);
      }
    });

    it('grid-4 creates 4 equal quadrants', () => {
      const padding = 20;
      const gap = 10;
      const slots = computeLayoutSlots('grid-4', padding, gap);
      expect(slots).toHaveLength(4);

      const iw = CANVAS_W - 2 * padding;
      const ih = CANVAS_H - 2 * padding;
      const sw = (iw - gap) / 2;
      const sh = (ih - gap) / 2;

      for (const slot of slots) {
        expect(slot.width).toBeCloseTo(sw);
        expect(slot.height).toBeCloseTo(sh);
      }
    });

    it('one-big-two-small creates 3 slots (1 big + 2 small)', () => {
      const padding = 20;
      const gap = 10;
      const slots = computeLayoutSlots('one-big-two-small', padding, gap);
      expect(slots).toHaveLength(3);

      const iw = CANVAS_W - 2 * padding;
      const ih = CANVAS_H - 2 * padding;

      // Big slot is 60% of inner width
      expect(slots[0].width).toBe(Math.round(iw * 0.6));
      expect(slots[0].height).toBe(ih);

      // Small slots are stacked vertically
      const expectedSmallH = (ih - gap) / 2;
      expect(slots[1].height).toBeCloseTo(expectedSmallH);
      expect(slots[2].height).toBeCloseTo(expectedSmallH);
    });

    it('respects custom padding and gap', () => {
      const padding = 40;
      const gap = 20;
      const slots = computeLayoutSlots('single', padding, gap);

      expect(slots[0].x).toBe(40);
      expect(slots[0].y).toBe(40);
      expect(slots[0].width).toBe(CANVAS_W - 80);
      expect(slots[0].height).toBe(CANVAS_H - 80);
    });

    it('cover-center uses inset from padding', () => {
      const slots = computeLayoutSlots('cover-center', 20, 10);
      expect(slots).toHaveLength(1);
      // An inset is applied inside the padding area
      expect(slots[0].x).toBeGreaterThan(20);
      expect(slots[0].y).toBeGreaterThan(20);
      expect(slots[0].width).toBeLessThan(CANVAS_W - 40);
      expect(slots[0].height).toBeLessThan(CANVAS_H - 40);
    });

    it('three-rows creates 3 equal rows', () => {
      const slots = computeLayoutSlots('three-rows', 20, 10);
      expect(slots).toHaveLength(3);
      for (const slot of slots) {
        expect(slot.width).toBe(CANVAS_W - 40);
      }
      expect(slots[0].height).toBeCloseTo(slots[1].height);
      expect(slots[1].height).toBeCloseTo(slots[2].height);
    });

    it('grid-6 creates 6 equal cells (3x2)', () => {
      const slots = computeLayoutSlots('grid-6', 20, 10);
      expect(slots).toHaveLength(6);
      const widths = new Set(slots.map((s) => Math.round(s.width)));
      expect(widths.size).toBe(1);
    });

    it('one-top-two-bottom has 3 slots', () => {
      const slots = computeLayoutSlots('one-top-two-bottom', 20, 10);
      expect(slots).toHaveLength(3);
      expect(slots[0].width).toBe(CANVAS_W - 40);
    });

    it('two-top-one-bottom has 3 slots', () => {
      const slots = computeLayoutSlots('two-top-one-bottom', 20, 10);
      expect(slots).toHaveLength(3);
      expect(slots[2].width).toBe(CANVAS_W - 40);
    });

    it('sidebar-left has 3 slots with left being narrower', () => {
      const slots = computeLayoutSlots('sidebar-left', 20, 10);
      expect(slots).toHaveLength(3);
      expect(slots[0].width).toBeLessThan(slots[1].width);
    });

    it('mosaic-5 creates 5 slots', () => {
      const slots = computeLayoutSlots('mosaic-5', 20, 10);
      expect(slots).toHaveLength(5);
    });
  });
});
