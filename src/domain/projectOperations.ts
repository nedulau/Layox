import type { Page, PageElement, Project } from '../types';

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
