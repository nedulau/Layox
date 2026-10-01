import { readStoredString, writeStoredString } from '../infra/storage';
import { validatePageTemplate, type PageTemplate } from '../domain/pageTemplates';

const KEY = 'layox_pageTemplates_v1';
const MAX_TEMPLATES = 50;
const MAX_BYTES = 2 * 1024 * 1024;

export function loadPageTemplates(): PageTemplate[] {
  const stored = readStoredString(KEY, '[]');
  if (new Blob([stored]).size > MAX_BYTES) return [];
  try {
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    const templates: PageTemplate[] = [];
    for (const value of parsed.slice(0, MAX_TEMPLATES)) {
      try {
        const template = validatePageTemplate(value);
        if (!templates.some((entry) => entry.id === template.id)) templates.push(template);
      } catch { /* Ignore invalid entries while retaining other templates. */ }
    }
    return templates;
  } catch { return []; }
}

export function savePageTemplates(templates: PageTemplate[]): void {
  if (templates.length > MAX_TEMPLATES) throw new Error('At most 50 page templates can be saved.');
  const serialized = JSON.stringify(templates.map(validatePageTemplate));
  if (new Blob([serialized]).size > MAX_BYTES) throw new Error('Page templates exceed the 2 MiB storage limit.');
  writeStoredString(KEY, serialized);
  if (readStoredString(KEY, '') !== serialized) throw new Error('Page templates could not be saved to local storage.');
}
