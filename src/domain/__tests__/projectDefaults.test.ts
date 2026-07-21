import { describe, expect, it } from 'vitest';
import type { Project } from '../../types';
import {
  createDefaultProject,
  DEFAULT_COVER_TITLE_FONT_SIZE,
  DEFAULT_LAYOUT_GAP,
  DEFAULT_LAYOUT_PADDING,
  normalizeProject,
} from '../projectDefaults';

describe('project defaults', () => {
  it('creates projects with shared layout and cover defaults', () => {
    const project = createDefaultProject('Album');

    expect(project.meta.defaultLayoutPadding).toBe(DEFAULT_LAYOUT_PADDING);
    expect(project.meta.defaultLayoutGap).toBe(DEFAULT_LAYOUT_GAP);
    expect(project.pages[0].coverTitleFontSize).toBe(DEFAULT_COVER_TITLE_FONT_SIZE);
  });

  it('normalizes missing optional defaults without changing the source', () => {
    const source: Project = {
      meta: { id: 'legacy', name: 'Legacy', version: '1.1' },
      pages: [{ id: 'cover', elements: [], background: '#fff', isCover: true }],
    };
    const normalized = normalizeProject(source);

    expect(normalized.meta.defaultLayoutPadding).toBe(DEFAULT_LAYOUT_PADDING);
    expect(normalized.pages[0].coverTitleFontSize).toBe(DEFAULT_COVER_TITLE_FONT_SIZE);
    expect(source.meta.defaultLayoutPadding).toBeUndefined();
  });
});
