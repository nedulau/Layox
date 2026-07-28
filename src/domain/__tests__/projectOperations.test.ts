import { describe, expect, it } from 'vitest';
import type { Project, TextElement } from '../../types';
import {
  addElementAt,
  duplicatePageAt,
  movePageAt,
  pruneUnusedAssetBlobs,
  removeElementAt,
  removePageAt,
  renameProject,
  updateElementAt,
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
});
