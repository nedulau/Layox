import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '../../domain/projectDefaults';
import { appendImageToFreePage, assignAssetToLayoutPage, prepareImportedAsset } from '../projectImagePlacement';

describe('project image placement', () => {
  it('sanitizes imported asset names', () => {
    const imported = prepareImportedAsset(new File(['photo'], '../trip?.jpg'));
    expect(imported.assetPath).toMatch(/^assets\//);
    expect(imported.assetPath).not.toContain('..');
    expect(imported.assetPath).not.toContain('?');
  });

  it('assigns assets to the next empty layout slot', () => {
    const project = createDefaultProject();
    const coverId = project.pages[0].id;
    const updated = assignAssetToLayoutPage(project, coverId, null, 'assets/photo.jpg');
    expect(updated?.pages[0].slotAssignments?.[0].assetPath).toBe('assets/photo.jpg');
  });

  it('refuses free placement after the target layout changed', () => {
    const project = createDefaultProject();
    const freePage = project.pages[1];
    const element = {
      id: 'image', type: 'image' as const, x: 0, y: 0, width: 100, height: 100,
      rotation: 0, zIndex: 0, src: 'assets/photo.jpg',
    };
    freePage.layoutId = 'single';
    expect(appendImageToFreePage(project, freePage.id, undefined, element)).toBeNull();
  });
});
