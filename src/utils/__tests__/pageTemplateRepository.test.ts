import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPageTemplate } from '../../domain/pageTemplates';
import { createDefaultProject } from '../../domain/projectDefaults';
const storage = vi.hoisted(() => ({ value: '[]', writable: true }));
vi.mock('../../infra/storage', () => ({
  readStoredString: () => storage.value,
  writeStoredString: (_key: string, value: string) => { if (storage.writable) storage.value = value; },
}));
import { loadPageTemplates, savePageTemplates } from '../pageTemplateRepository';

describe('local template repository', () => {
  beforeEach(() => { storage.value = '[]'; storage.writable = true; });
  it('retains valid templates while ignoring malformed entries and duplicates', () => {
    const template = createPageTemplate(createDefaultProject().pages[0], 'Cover');
    storage.value = JSON.stringify([null, template, template]);
    expect(loadPageTemplates().map((entry) => entry.id)).toEqual([template.id]);
    storage.value = '{broken';
    expect(loadPageTemplates()).toEqual([]);
    storage.value = '{}';
    expect(loadPageTemplates()).toEqual([]);
    storage.value = 'x'.repeat(2 * 1024 * 1024 + 1);
    expect(loadPageTemplates()).toEqual([]);
  });
  it('persists templates and reports storage and count limits', () => {
    const template = createPageTemplate(createDefaultProject().pages[0], 'Cover');
    savePageTemplates([template]);
    expect(loadPageTemplates()[0].name).toBe('Cover');
    expect(() => savePageTemplates(Array.from({ length: 51 }, () => template))).toThrow('50');
    const large = { ...template, page: { ...template.page, elements: Array.from({ length: 30 }, (_, i) => ({ id: `t-${i}`, type: 'text' as const, content: 'x'.repeat(100_000), x: 0, y: 0, fontSize: 20, fontFamily: 'Arial', color: '#000', rotation: 0, zIndex: i })) } };
    expect(() => savePageTemplates([large])).toThrow('2 MiB');
    storage.writable = false;
    expect(() => savePageTemplates([])).toThrow('local storage');
  });
});
