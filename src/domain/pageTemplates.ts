import { v4 as uuidv4 } from 'uuid';
import type { Page, Project } from '../types';
import { changePageFormat, type PageFormat } from './pageFormat';
import { migrateAndValidateProject } from './projectSchema';

export interface PageTemplate {
  id: string;
  name: string;
  pageFormat: PageFormat;
  page: Page;
}

export function createPageTemplate(page: Page, name: string, pageFormat: PageFormat = 'classic'): PageTemplate {
  const label = name.trim();
  if (!label || label.length > 100) throw new Error('Template name must contain 1–100 characters.');
  const copy = structuredClone(page);
  delete copy.slotAssignments;
  delete copy.chapterTitle;
  delete copy.subchapterTitle;
  copy.elements = copy.elements.map((element) => element.type === 'image'
    ? { ...element, src: 'assets/placeholder', originalSrc: undefined, isPlaceholder: true }
    : element);
  return { id: uuidv4(), name: label, pageFormat, page: copy };
}

export function validatePageTemplate(value: unknown): PageTemplate {
  if (!value || typeof value !== 'object') throw new Error('Invalid template.');
  const candidate = value as PageTemplate;
  if (typeof candidate.id !== 'string' || !candidate.id || candidate.id.length > 200
    || typeof candidate.name !== 'string' || !candidate.name.trim() || candidate.name.length > 100) throw new Error('Invalid template.');
  const project = migrateAndValidateProject({ meta: { id: 'template', name: candidate.name, version: '1.2', pageFormat: candidate.pageFormat }, pages: [candidate.page] });
  // Sanitizing also prevents stored templates from carrying external asset references.
  return { ...createPageTemplate(project.pages[0], candidate.name, project.meta.pageFormat), id: candidate.id };
}

export function instantiatePageTemplate(template: PageTemplate, pageFormat: PageFormat = 'classic'): Page {
  const clean = validatePageTemplate(template);
  const project: Project = { meta: { id: 'template', name: clean.name, version: '1.2', pageFormat: clean.pageFormat }, pages: [clean.page] };
  const page = structuredClone(changePageFormat(project, pageFormat).pages[0]);
  return { ...page, id: uuidv4(), elements: page.elements.map((element) => ({ ...element, id: uuidv4() })) };
}
