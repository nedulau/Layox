import { v4 as uuidv4 } from 'uuid';
import type { ImageElement, Project } from '../types';
import { getLayoutById } from '../utils/layouts';

export interface ImportedAsset {
  id: string;
  assetPath: string;
  blob: Blob;
}

export function prepareImportedAsset(file: File): ImportedAsset {
  const id = uuidv4();
  const safeFileName = file.name
    .replace(/\.\.+/g, '.')
    .replace(/[^\p{L}\p{N}._ -]/gu, '_')
    .slice(0, 240) || 'image';
  return {
    id,
    assetPath: `assets/${id}_${safeFileName}`,
    blob: file.slice(),
  };
}

export function assignAssetToLayoutPage(
  project: Project,
  pageId: string,
  requestedSlot: number | null,
  assetPath: string,
): Project | null {
  const pageIndex = project.pages.findIndex((page) => page.id === pageId);
  const page = project.pages[pageIndex];
  if (!page?.layoutId) return null;
  const layout = getLayoutById(page.layoutId);
  if (!layout) return null;

  const assignments = page.slotAssignments ?? {};
  const slotIndex = requestedSlot ?? layout.slots.findIndex((_, index) => !assignments[index]);
  if (slotIndex < 0 || slotIndex >= layout.slots.length) return null;

  const pages = [...project.pages];
  pages[pageIndex] = {
    ...page,
    slotAssignments: {
      ...assignments,
      [slotIndex]: { assetPath, offsetX: 0, offsetY: 0, scale: 1 },
    },
  };
  return { ...project, pages };
}

export function appendImageToFreePage(
  project: Project,
  pageId: string,
  expectedLayoutId: string | undefined,
  element: ImageElement,
  placeholderId?: string | null,
): Project | null {
  const pageIndex = project.pages.findIndex((page) => page.id === pageId);
  const page = project.pages[pageIndex];
  if (!page || page.layoutId !== expectedLayoutId) return null;
  const pages = [...project.pages];
  const placeholder = page.elements.find((candidate) => candidate.id === placeholderId && candidate.type === 'image' && candidate.isPlaceholder);
  if (placeholder?.type === 'image') {
    const fit = Math.min(placeholder.width / element.width, placeholder.height / element.height);
    const placed = { ...element, x: placeholder.x, y: placeholder.y, width: element.width * fit, height: element.height * fit, rotation: placeholder.rotation, zIndex: placeholder.zIndex };
    pages[pageIndex] = { ...page, elements: page.elements.map((candidate) => candidate.id === placeholder.id ? placed : candidate) };
  } else {
    pages[pageIndex] = { ...page, elements: [...page.elements, element] };
  }
  return { ...project, pages };
}
