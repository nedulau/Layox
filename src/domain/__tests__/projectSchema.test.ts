import { describe, expect, it } from 'vitest';
import { collectReferencedAssetPaths, migrateAndValidateProject } from '../projectSchema';

function richProject(): Record<string, unknown> {
  return {
    meta: {
      id: 'project',
      name: 'Rich project',
      version: '1.1',
      defaultLayoutPadding: 20,
      defaultLayoutGap: 10,
    },
    pages: [{
      id: 'page',
      background: '#fff',
      layoutId: 'single',
      layoutPadding: 12,
      layoutGap: 8,
      isCover: true,
      coverTitle: 'Title',
      coverSubtitle: 'Subtitle',
      showCoverSubtitle: true,
      coverTitleFontSize: 48,
      coverTitleFontFamily: 'Arial',
      coverTitleColor: '#fff',
      coverTitleX: 10,
      coverTitleY: 20,
      coverSubtitleFontSize: 24,
      coverSubtitleFontFamily: 'Arial',
      coverSubtitleColor: '#eee',
      coverSubtitleX: 10,
      coverSubtitleY: 80,
      chapterTitle: 'Chapter',
      subchapterTitle: 'Subchapter',
      slotAssignments: {
        0: {
          assetPath: 'assets/slot.jpg',
          offsetX: 0,
          offsetY: 0,
          scale: 1,
          cropX: 0,
          cropY: 0,
          cropW: 100,
          cropH: 80,
        },
      },
      elements: [
        {
          id: 'image', type: 'image', x: 0, y: 0, width: 100, height: 80,
          rotation: 0, zIndex: 0, src: 'assets/image.jpg', originalSrc: '/photo.jpg',
        },
        {
          id: 'text', type: 'text', x: 10, y: 10, rotation: 0, zIndex: 1,
          content: 'Text', fontSize: 24, fontFamily: 'Arial', color: '#000', width: 200,
        },
      ],
    }],
  };
}

function page(project: Record<string, unknown>): Record<string, unknown> {
  return (project.pages as Array<Record<string, unknown>>)[0];
}

describe('project schema validation', () => {
  it('accepts every supported optional project field', () => {
    const project = migrateAndValidateProject(richProject());
    expect(project.pages[0].slotAssignments?.[0].cropW).toBe(100);
    expect(collectReferencedAssetPaths(project)).toEqual(new Set([
      'assets/image.jpg',
      'assets/slot.jpg',
    ]));
  });

  it.each([
    ['project object', (value: Record<string, unknown>) => value, null],
    ['meta object', (value: Record<string, unknown>) => value, { ...richProject(), meta: null }],
    ['current id', (value: Record<string, unknown>) => { delete (value.meta as Record<string, unknown>).id; }, undefined],
    ['project name', (value: Record<string, unknown>) => { (value.meta as Record<string, unknown>).name = 'x'.repeat(501); }, undefined],
    ['pages array', (value: Record<string, unknown>) => { value.pages = []; }, undefined],
    ['elements array', (value: Record<string, unknown>) => { page(value).elements = null; }, undefined],
    ['element type', (value: Record<string, unknown>) => { (page(value).elements as Array<Record<string, unknown>>)[0].type = 'video'; }, undefined],
    ['image width', (value: Record<string, unknown>) => { (page(value).elements as Array<Record<string, unknown>>)[0].width = 0; }, undefined],
    ['image height', (value: Record<string, unknown>) => { (page(value).elements as Array<Record<string, unknown>>)[0].height = -1; }, undefined],
    ['image path root', (value: Record<string, unknown>) => { (page(value).elements as Array<Record<string, unknown>>)[0].src = 'photo.jpg'; }, undefined],
    ['image path traversal', (value: Record<string, unknown>) => { (page(value).elements as Array<Record<string, unknown>>)[0].src = 'assets/../photo.jpg'; }, undefined],
    ['image path directory', (value: Record<string, unknown>) => { (page(value).elements as Array<Record<string, unknown>>)[0].src = 'assets/'; }, undefined],
    ['text font size', (value: Record<string, unknown>) => { (page(value).elements as Array<Record<string, unknown>>)[1].fontSize = 0; }, undefined],
    ['text width', (value: Record<string, unknown>) => { (page(value).elements as Array<Record<string, unknown>>)[1].width = -1; }, undefined],
    ['finite coordinate', (value: Record<string, unknown>) => { (page(value).elements as Array<Record<string, unknown>>)[1].x = Number.NaN; }, undefined],
    ['slot index', (value: Record<string, unknown>) => { page(value).slotAssignments = { '-1': (page(value).slotAssignments as Record<string, unknown>)['0'] }; }, undefined],
    ['slot index outside layout', (value: Record<string, unknown>) => { page(value).slotAssignments = { '1': (page(value).slotAssignments as Record<string, unknown>)['0'] }; }, undefined],
    ['unknown layout', (value: Record<string, unknown>) => { page(value).layoutId = 'future-layout'; }, undefined],
    ['slot scale', (value: Record<string, unknown>) => { ((page(value).slotAssignments as Record<string, Record<string, unknown>>)['0']).scale = 0; }, undefined],
    ['partial crop', (value: Record<string, unknown>) => { delete ((page(value).slotAssignments as Record<string, Record<string, unknown>>)['0']).cropH; }, undefined],
    ['crop width', (value: Record<string, unknown>) => { ((page(value).slotAssignments as Record<string, Record<string, unknown>>)['0']).cropW = 0; }, undefined],
    ['layout padding', (value: Record<string, unknown>) => { page(value).layoutPadding = -1; }, undefined],
    ['excessive layout padding', (value: Record<string, unknown>) => { page(value).layoutPadding = 101; }, undefined],
    ['layout gap', (value: Record<string, unknown>) => { page(value).layoutGap = -1; }, undefined],
    ['cover boolean', (value: Record<string, unknown>) => { page(value).isCover = 'yes'; }, undefined],
    ['default padding', (value: Record<string, unknown>) => { (value.meta as Record<string, unknown>).defaultLayoutPadding = -1; }, undefined],
    ['default gap', (value: Record<string, unknown>) => { (value.meta as Record<string, unknown>).defaultLayoutGap = -1; }, undefined],
  ])('rejects invalid %s', (_name, mutate, replacement) => {
    if (replacement !== undefined || _name === 'project object') {
      expect(() => migrateAndValidateProject(replacement)).toThrow();
      return;
    }
    const value = richProject();
    mutate(value);
    expect(() => migrateAndValidateProject(value)).toThrow();
  });
});
