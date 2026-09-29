import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '../projectDefaults';
import { createPageTemplate, instantiatePageTemplate, validatePageTemplate } from '../pageTemplates';
import { collectReferencedAssetPaths, migrateAndValidateProject } from '../projectSchema';
import { appendImageToFreePage } from '../../services/projectImagePlacement';
import { createProjectArchiveBlob, loadProjectArchive } from '../../utils/projectArchive';
import useProjectStore from '../../store/useProjectStore';

function sourcePage() {
  const page = createDefaultProject().pages[1];
  page.elements = [
    { id: 'photo', type: 'image', src: 'assets/photo.jpg', originalSrc: '/private/photo.jpg', x: 80, y: 70, width: 400, height: 200, rotation: 25, zIndex: 0 },
    { id: 'text', type: 'text', content: 'Caption', fontFamily: 'Arial', fontSize: 24, color: '#123456', x: 40, y: 40, rotation: 0, zIndex: 1 },
  ];
  return page;
}

describe('page templates', () => {
  it('retains design and text without retaining photo data or private file paths', () => {
    const page = sourcePage();
    const template = createPageTemplate(page, '  Travel  ');
    expect(template.name).toBe('Travel');
    expect(template.page.elements[0]).toMatchObject({ isPlaceholder: true, rotation: 25, width: 400, height: 200 });
    expect(JSON.stringify(template)).not.toContain('/private/');
    expect(template.page.elements[1]).toEqual(page.elements[1]);
    expect(page.elements[0]).not.toHaveProperty('isPlaceholder');
    const layout = createDefaultProject().pages[0];
    layout.slotAssignments = { 0: { assetPath: 'assets/photo.jpg', offsetX: 0, offsetY: 0, scale: 2 } };
    expect(createPageTemplate(layout, 'Cover').page.slotAssignments).toBeUndefined();
  });

  it('creates independent pages and adapts geometry to the target format', () => {
    const template = createPageTemplate(sourcePage(), 'Travel');
    const one = instantiatePageTemplate(template, 'square');
    const two = instantiatePageTemplate(template, 'square');
    expect(one.id).not.toBe(two.id);
    expect(one.elements[0].id).not.toBe(two.elements[0].id);
    expect(one.elements[0].y).toBeCloseTo(70 * 1200 / 900);
    expect(template.page.elements[0].y).toBe(70);
    one.elements[1].x = 123;
    expect(two.elements[1].x).toBe(40);
  });

  it('round-trips placeholders without image assets and supports undo after insertion', async () => {
    const project = createDefaultProject();
    const template = createPageTemplate(sourcePage(), 'Travel');
    project.pages = [instantiatePageTemplate(template)];
    expect(collectReferencedAssetPaths(project).size).toBe(0);
    const archive = await createProjectArchiveBlob(project, {});
    const loaded = await loadProjectArchive(archive);
    expect(loaded.project.pages[0].elements[0]).toMatchObject({ isPlaceholder: true });
    useProjectStore.getState().setProject(createDefaultProject());
    useProjectStore.getState().snapshot();
    useProjectStore.getState().addPageFromTemplate(template);
    expect(useProjectStore.getState().project.pages).toHaveLength(3);
    expect(useProjectStore.getState().currentPageIndex).toBe(1);
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().project.pages).toHaveLength(2);
  });

  it('replaces only the selected placeholder while preserving photo proportions and rotation', () => {
    const project = createDefaultProject();
    const page = sourcePage();
    project.pages = [instantiatePageTemplate(createPageTemplate(page, 'Template'))];
    const placeholder = project.pages[0].elements[0];
    const actual = { id: 'new-photo', type: 'image' as const, src: 'assets/new.jpg', x: 0, y: 0, width: 100, height: 100, rotation: 0, zIndex: 10 };
    const updated = appendImageToFreePage(project, project.pages[0].id, undefined, actual, placeholder.id)!;
    expect(updated.pages[0].elements[0]).toMatchObject({ id: 'new-photo', x: 80, y: 70, width: 200, height: 200, rotation: 25, zIndex: 0 });
    expect(updated.pages[0].elements).toHaveLength(2);
    expect(collectReferencedAssetPaths(updated)).toEqual(new Set(['assets/new.jpg']));
  });

  it.each([null, {}, { id: '', name: 'T' }, { id: 'id', name: '' }, { id: 'id', name: 'x'.repeat(101) }])('rejects invalid template metadata', (value) => {
    expect(() => validatePageTemplate(value)).toThrow();
  });

  it('rejects invalid placeholder flags and template names', () => {
    expect(() => createPageTemplate(sourcePage(), '')).toThrow();
    expect(() => createPageTemplate(sourcePage(), 'x'.repeat(101))).toThrow();
    const project = createDefaultProject();
    project.pages = [sourcePage()];
    Reflect.set(project.pages[0].elements[0], 'isPlaceholder', 'yes');
    expect(() => migrateAndValidateProject(project)).toThrow();
  });
});
