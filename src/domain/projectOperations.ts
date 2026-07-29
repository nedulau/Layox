import type { Page, PageElement, Project, SlotAssignment } from '../types';

export function renameProject(project: Project, name: string): Project {
  if (project.meta.name === name) return project;
  return { ...project, meta: { ...project.meta, name } };
}

export function appendPage(project: Project, page: Page): Project {
  return { ...project, pages: [...project.pages, page] };
}

export function removePageAt(project: Project, index: number): Project {
  if (project.pages.length <= 1 || index < 0 || index >= project.pages.length) return project;
  return { ...project, pages: project.pages.filter((_, pageIndex) => pageIndex !== index) };
}

export function duplicatePageAt(
  project: Project,
  index: number,
  createId: () => string,
): { project: Project; pageIndex: number } {
  const source = project.pages[index];
  if (!source) {
    return { project, pageIndex: Math.max(0, Math.min(index, project.pages.length - 1)) };
  }
  const duplicate = structuredClone(source);
  duplicate.id = createId();
  duplicate.elements = duplicate.elements.map((element) => ({ ...element, id: createId() }));
  const pages = [...project.pages];
  pages.splice(index + 1, 0, duplicate);
  return { project: { ...project, pages }, pageIndex: index + 1 };
}

export function movePageAt(
  project: Project,
  fromIndex: number,
  toIndex: number,
  currentPageIndex: number,
): { project: Project; currentPageIndex: number } {
  if (
    fromIndex < 0
    || toIndex < 0
    || fromIndex >= project.pages.length
    || toIndex >= project.pages.length
    || fromIndex === toIndex
  ) {
    return { project, currentPageIndex };
  }

  const pages = [...project.pages];
  const [moved] = pages.splice(fromIndex, 1);
  pages.splice(toIndex, 0, moved);

  let nextCurrentPageIndex = currentPageIndex;
  if (currentPageIndex === fromIndex) nextCurrentPageIndex = toIndex;
  else if (fromIndex < currentPageIndex && toIndex >= currentPageIndex) nextCurrentPageIndex -= 1;
  else if (fromIndex > currentPageIndex && toIndex <= currentPageIndex) nextCurrentPageIndex += 1;

  return { project: { ...project, pages }, currentPageIndex: nextCurrentPageIndex };
}

export function updatePageAt(
  project: Project,
  pageIndex: number,
  update: (page: Page) => Page,
): Project {
  const page = project.pages[pageIndex];
  if (!page) return project;
  const nextPage = update(page);
  if (nextPage === page) return project;
  const pages = [...project.pages];
  pages[pageIndex] = nextPage;
  return { ...project, pages };
}

export function addElementAt(project: Project, pageIndex: number, element: PageElement): Project {
  return updatePageAt(project, pageIndex, (page) => ({
    ...page,
    elements: [...page.elements, element],
  }));
}

export function updateElementAt(
  project: Project,
  pageIndex: number,
  elementId: string,
  changes: Partial<PageElement>,
): Project {
  return updatePageAt(project, pageIndex, (page) => {
    const elementIndex = page.elements.findIndex((element) => element.id === elementId);
    if (elementIndex < 0) return page;
    const elements = [...page.elements];
    elements[elementIndex] = { ...elements[elementIndex], ...changes } as PageElement;
    return { ...page, elements };
  });
}

export function removeElementAt(project: Project, pageIndex: number, elementId: string): Project {
  return updatePageAt(project, pageIndex, (page) => {
    const elements = page.elements.filter((element) => element.id !== elementId);
    return elements.length === page.elements.length ? page : { ...page, elements };
  });
}

export function patchPageAt(
  project: Project,
  pageIndex: number,
  changes: Partial<Page>,
): Project {
  return updatePageAt(project, pageIndex, (page) => ({ ...page, ...changes }));
}

export function removeSlotAssignmentAt(
  project: Project,
  pageIndex: number,
  slotIndex: number,
): Project {
  return updatePageAt(project, pageIndex, (page) => {
    if (!page.slotAssignments) return page;
    const slotAssignments = { ...page.slotAssignments };
    delete slotAssignments[slotIndex];
    return { ...page, slotAssignments };
  });
}

export function updateSlotAssignmentAt(
  project: Project,
  pageIndex: number,
  slotIndex: number,
  changes: Partial<SlotAssignment>,
): Project {
  return updatePageAt(project, pageIndex, (page) => {
    const assignment = page.slotAssignments?.[slotIndex];
    if (!assignment) return page;
    return {
      ...page,
      slotAssignments: {
        ...page.slotAssignments,
        [slotIndex]: { ...assignment, ...changes },
      },
    };
  });
}

export function clearSlotCropAt(
  project: Project,
  pageIndex: number,
  slotIndex: number,
): Project {
  return updatePageAt(project, pageIndex, (page) => {
    const current = page.slotAssignments?.[slotIndex];
    if (!current) return page;
    const assignment = { ...current };
    delete assignment.cropX;
    delete assignment.cropY;
    delete assignment.cropW;
    delete assignment.cropH;
    return {
      ...page,
      slotAssignments: {
        ...page.slotAssignments,
        [slotIndex]: assignment,
      },
    };
  });
}

export function setProjectLayoutDefault(
  project: Project,
  property: 'defaultLayoutPadding' | 'defaultLayoutGap',
  value: number,
): Project {
  if (project.meta[property] === value) return project;
  return {
    ...project,
    meta: {
      ...project.meta,
      [property]: value,
    },
  };
}

export function applyLayoutDefaults(
  project: Project,
  defaultPadding: number,
  defaultGap: number,
): Project {
  return {
    ...project,
    pages: project.pages.map((page) => ({
      ...page,
      layoutPadding: defaultPadding,
      layoutGap: defaultGap,
    })),
  };
}

export function setCoverTitleAt(
  project: Project,
  pageIndex: number,
  title: string,
): Project {
  return updatePageAt(project, pageIndex, (page) => {
    const nextPage = { ...page, coverTitle: title };
    if (page.isCover) {
      const trimmed = title.trim();
      if (trimmed) nextPage.chapterTitle = trimmed;
      else delete nextPage.chapterTitle;
    }
    return nextPage;
  });
}

export function setCoverStyleAt(
  project: Project,
  pageIndex: number,
  target: 'title' | 'subtitle',
  changes: { fontSize?: number; fontFamily?: string; color?: string },
): Project {
  return updatePageAt(project, pageIndex, (page) => {
    const nextPage = { ...page };
    const prefix = target === 'title' ? 'coverTitle' : 'coverSubtitle';
    if (changes.fontSize !== undefined) {
      if (prefix === 'coverTitle') nextPage.coverTitleFontSize = Math.max(1, changes.fontSize);
      else nextPage.coverSubtitleFontSize = Math.max(1, changes.fontSize);
    }
    if (changes.fontFamily !== undefined) {
      if (prefix === 'coverTitle') nextPage.coverTitleFontFamily = changes.fontFamily;
      else nextPage.coverSubtitleFontFamily = changes.fontFamily;
    }
    if (changes.color !== undefined) {
      if (prefix === 'coverTitle') nextPage.coverTitleColor = changes.color;
      else nextPage.coverSubtitleColor = changes.color;
    }
    return nextPage;
  });
}

export function setTrimmedPageLabelAt(
  project: Project,
  pageIndex: number,
  property: 'chapterTitle' | 'subchapterTitle',
  value: string,
): Project {
  return updatePageAt(project, pageIndex, (page) => {
    const nextPage = { ...page };
    const trimmed = value.trim();
    if (trimmed) nextPage[property] = trimmed;
    else delete nextPage[property];
    return nextPage;
  });
}

export function toggleCoverAt(
  project: Project,
  pageIndex: number,
  isCover: boolean,
): Project {
  return updatePageAt(project, pageIndex, (page) => ({
    ...page,
    isCover,
    coverTitle: isCover && !page.coverTitle ? project.meta.name : page.coverTitle,
  }));
}

export function collectUsedAssetPaths(project: Project): Set<string> {
  const paths = new Set<string>();
  project.pages.forEach((page) => {
    Object.values(page.slotAssignments ?? {}).forEach((assignment) => {
      if (assignment?.assetPath) paths.add(assignment.assetPath);
    });
    page.elements.forEach((element) => {
      if (element.type === 'image') paths.add(element.src);
    });
  });
  return paths;
}

export function pruneUnusedAssetBlobs(
  project: Project,
  assets: Record<string, Blob>,
): Record<string, Blob> {
  const usedPaths = collectUsedAssetPaths(project);
  return Object.fromEntries(Object.entries(assets).filter(([path]) => usedPaths.has(path)));
}
