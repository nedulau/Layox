import { describe, expect, it } from 'vitest';
import type { Project, TextElement } from '../../types';
import {
  addElementAt,
  applyLayoutDefaults,
  clearSlotCropAt,
  duplicatePageAt,
  movePageAt,
  patchPageAt,
  pruneUnusedAssetBlobs,
  removeElementAt,
  removePageAt,
  removeSlotAssignmentAt,
  renameProject,
  setCoverStyleAt,
  setCoverTitleAt,
  setProjectLayoutDefault,
  setTrimmedPageLabelAt,
  toggleCoverAt,
  updateElementAt,
  updateSlotAssignmentAt,
} from '../projectOperations';

const project: Project = {
  meta: { id: 'project', name: 'Original', version: '1.1' },
  pages: [
    { id: 'first', background: '#fff', elements: [] },
    { id: 'second', background: '#fff', elements: [] },
    { id: 'third', background: '#fff', elements: [] },
  ],
};

const textElement: TextElement = {
  id: 'text',
  type: 'text',
  x: 0,
  y: 0,
  rotation: 0,
  zIndex: 0,
  content: 'Text',
  fontSize: 24,
  fontFamily: 'Arial',
  color: '#000',
};

describe('project operations', () => {
  it('returns immutable project updates', () => {
    const renamed = renameProject(project, 'Changed');
    const withElement = addElementAt(renamed, 0, textElement);
    const updated = updateElementAt(withElement, 0, textElement.id, { content: 'Updated' });
    const removed = removeElementAt(updated, 0, textElement.id);

    expect(project.meta.name).toBe('Original');
    expect(project.pages[0].elements).toEqual([]);
    expect(renamed.meta.name).toBe('Changed');
    expect((updated.pages[0].elements[0] as TextElement).content).toBe('Updated');
    expect(removed.pages[0].elements).toEqual([]);
  });

  it('moves pages while preserving the active page identity', () => {
    const moved = movePageAt(project, 0, 2, 1);

    expect(moved.project.pages.map((page) => page.id)).toEqual(['second', 'third', 'first']);
    expect(moved.currentPageIndex).toBe(0);
  });

  it('duplicates pages with fresh page and element ids', () => {
    const withElement = addElementAt(project, 1, textElement);
    const ids = ['new-page', 'new-text'];
    const duplicated = duplicatePageAt(withElement, 1, () => ids.shift() ?? 'fallback');

    expect(duplicated.pageIndex).toBe(2);
    expect(duplicated.project.pages[2]).toMatchObject({
      id: 'new-page',
      background: '#fff',
    });
    expect(duplicated.project.pages[2].elements[0]).toMatchObject({
      id: 'new-text',
      content: 'Text',
    });
    expect(duplicated.project.pages[1].id).toBe('second');
  });

  it('keeps at least one page', () => {
    const onePage = { ...project, pages: [project.pages[0]] };
    expect(removePageAt(onePage, 0)).toBe(onePage);
  });

  it('removes blobs that are not referenced by pages or slots', () => {
    const projectWithAssets: Project = {
      ...project,
      pages: [{
        ...project.pages[0],
        elements: [{
          id: 'image',
          type: 'image',
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          rotation: 0,
          zIndex: 0,
          src: 'assets/used.jpg',
        }],
      }],
    };
    const used = new Blob(['used']);

    expect(pruneUnusedAssetBlobs(projectWithAssets, {
      'assets/used.jpg': used,
      'assets/orphan.jpg': new Blob(['orphan']),
    })).toEqual({ 'assets/used.jpg': used });
  });

  it('patches existing pages and ignores missing page indices', () => {
    const updated = patchPageAt(project, 1, { background: '#123456', layoutGap: 12 });

    expect(updated.pages[1]).toMatchObject({ background: '#123456', layoutGap: 12 });
    expect(patchPageAt(project, 99, { background: '#000' })).toBe(project);
  });

  it('updates, clears and removes slot assignments immutably', () => {
    const withSlot: Project = {
      ...project,
      pages: [{
        ...project.pages[0],
        slotAssignments: {
          0: {
            assetPath: 'assets/photo.jpg',
            offsetX: 2,
            offsetY: 3,
            scale: 1,
            cropX: 10,
            cropY: 20,
            cropW: 30,
            cropH: 40,
          },
        },
      }],
    };

    const moved = updateSlotAssignmentAt(withSlot, 0, 0, {
      offsetX: 12,
      scale: 1.5,
    });
    expect(moved.pages[0].slotAssignments?.[0]).toMatchObject({
      offsetX: 12,
      offsetY: 3,
      scale: 1.5,
    });

    const cleared = clearSlotCropAt(moved, 0, 0);
    expect(cleared.pages[0].slotAssignments?.[0]).not.toHaveProperty('cropX');
    expect(cleared.pages[0].slotAssignments?.[0]).not.toHaveProperty('cropH');

    const removed = removeSlotAssignmentAt(cleared, 0, 0);
    expect(removed.pages[0].slotAssignments).toEqual({});
    expect(updateSlotAssignmentAt(withSlot, 0, 9, { scale: 2 })).toBe(withSlot);
    expect(clearSlotCropAt(withSlot, 0, 9)).toBe(withSlot);
    expect(removeSlotAssignmentAt(project, 0, 0)).toBe(project);
  });

  it('updates project layout defaults and applies them to every page', () => {
    const withPadding = setProjectLayoutDefault(project, 'defaultLayoutPadding', 44);
    const withDefaults = setProjectLayoutDefault(withPadding, 'defaultLayoutGap', 18);
    const applied = applyLayoutDefaults(withDefaults, 44, 18);

    expect(withDefaults.meta).toMatchObject({
      defaultLayoutPadding: 44,
      defaultLayoutGap: 18,
    });
    expect(applied.pages.every((page) => (
      page.layoutPadding === 44 && page.layoutGap === 18
    ))).toBe(true);
    expect(setProjectLayoutDefault(withDefaults, 'defaultLayoutGap', 18)).toBe(withDefaults);
  });

  it('keeps cover titles, styles and chapter labels consistent', () => {
    const coverProject: Project = {
      ...project,
      pages: [{ ...project.pages[0], isCover: true, coverTitle: '' }],
    };
    const titled = setCoverTitleAt(coverProject, 0, '  Journey  ');
    expect(titled.pages[0]).toMatchObject({
      coverTitle: '  Journey  ',
      chapterTitle: 'Journey',
    });

    const untitled = setCoverTitleAt(titled, 0, '   ');
    expect(untitled.pages[0]).not.toHaveProperty('chapterTitle');

    const titleStyle = setCoverStyleAt(untitled, 0, 'title', {
      fontSize: 0,
      fontFamily: 'Georgia',
      color: '#123456',
    });
    expect(titleStyle.pages[0]).toMatchObject({
      coverTitleFontSize: 1,
      coverTitleFontFamily: 'Georgia',
      coverTitleColor: '#123456',
    });

    const subtitleStyle = setCoverStyleAt(titleStyle, 0, 'subtitle', {
      fontSize: 22,
      fontFamily: 'Arial',
      color: '#654321',
    });
    expect(subtitleStyle.pages[0]).toMatchObject({
      coverSubtitleFontSize: 22,
      coverSubtitleFontFamily: 'Arial',
      coverSubtitleColor: '#654321',
    });
  });

  it('normalizes chapter labels and supplies a missing cover title', () => {
    const withChapter = setTrimmedPageLabelAt(project, 0, 'chapterTitle', '  Summer ');
    const withSubchapter = setTrimmedPageLabelAt(
      withChapter,
      0,
      'subchapterTitle',
      ' Day one ',
    );
    expect(withSubchapter.pages[0]).toMatchObject({
      chapterTitle: 'Summer',
      subchapterTitle: 'Day one',
    });

    const cleared = setTrimmedPageLabelAt(withSubchapter, 0, 'chapterTitle', ' ');
    expect(cleared.pages[0]).not.toHaveProperty('chapterTitle');

    const cover = toggleCoverAt(cleared, 0, true);
    expect(cover.pages[0]).toMatchObject({ isCover: true, coverTitle: 'Original' });
    const unchangedTitle = toggleCoverAt(
      patchPageAt(cover, 0, { coverTitle: 'Custom' }),
      0,
      true,
    );
    expect(unchangedTitle.pages[0].coverTitle).toBe('Custom');
    expect(toggleCoverAt(unchangedTitle, 0, false).pages[0].isCover).toBe(false);
  });
});
