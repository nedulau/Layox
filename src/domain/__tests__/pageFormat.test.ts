import { describe, expect, it } from 'vitest';
import { changePageFormat, getExportPixelRatio, getPageSize, getPrintSize, PAGE_FORMATS } from '../pageFormat';
import { createDefaultProject } from '../projectDefaults';
import { migrateAndValidateProject } from '../projectSchema';
import { computeLayoutSlots } from '../../utils/layouts';
import useProjectStore from '../../store/useProjectStore';

describe('page formats', () => {
  it.each(PAGE_FORMATS)('keeps %s layouts within the page and preserves the physical aspect ratio', (format) => {
    const size = getPageSize(format);
    const print = getPrintSize(format);
    const slots = computeLayoutSlots('grid-6', 20, 10, size);
    expect(slots).toHaveLength(6);
    for (const slot of slots) {
      expect(slot.x + slot.width).toBeLessThanOrEqual(size.width);
      expect(slot.y + slot.height).toBeLessThanOrEqual(size.height);
    }
    if (format !== 'classic') expect(size.width / size.height).toBeCloseTo(print.width / print.height);
    expect(getExportPixelRatio(format, 600)).toBeCloseTo(getExportPixelRatio(format, 300) * 2);
  });

  it('rejects unsupported export resolutions', () => {
    expect(() => getExportPixelRatio('square', 0)).toThrow();
  });

  it('migrates old projects without changing their classic canvas', () => {
    const original = createDefaultProject();
    for (const version of [undefined, '1.0', '1.1', '1.2']) {
      const migrated = migrateAndValidateProject({ ...original, meta: { ...original.meta, version } });
      expect(migrated.meta.version).toBe('1.2');
      expect(getPageSize(migrated.meta.pageFormat)).toEqual({ width: 1200, height: 900 });
    }
    expect(() => migrateAndValidateProject({ ...original, meta: { ...original.meta, pageFormat: 'invalid' } })).toThrow();
    expect(migrateAndValidateProject({ ...original, meta: { ...original.meta, pageFormat: 'square' } }).meta.pageFormat).toBe('square');
  });

  it('preserves free photo aspect ratios and supports undo for a format change', () => {
    const project = createDefaultProject();
    project.pages[1].elements = [{ id: 'photo', type: 'image', x: 600, y: 450, width: 300, height: 200, src: 'assets/photo.jpg', rotation: 15, zIndex: 0 }];
    project.pages[0].coverTitleX = 50;
    project.pages[0].coverTitleY = 300;
    project.pages[0].coverSubtitleX = 30;
    project.pages[0].coverSubtitleY = 360;
    project.pages[0].slotAssignments = { 0: { assetPath: 'assets/photo.jpg', scale: 2, offsetX: 10, offsetY: 20 } };
    expect(changePageFormat(project, 'classic')).toBe(project);
    const resized = changePageFormat(project, 'a4-portrait');
    const image = resized.pages[1].elements[0];
    expect(image.type === 'image' && image.width / image.height).toBeCloseTo(1.5);
    expect(project.pages[1].elements[0].x).toBe(600);
    useProjectStore.getState().setProject(project);
    useProjectStore.getState().snapshot();
    useProjectStore.getState().setPageFormat('square');
    expect(useProjectStore.getState().project.meta.pageFormat).toBe('square');
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().project.meta.pageFormat).toBeUndefined();
  });
});
