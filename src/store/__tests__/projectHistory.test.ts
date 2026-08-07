import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '../../domain/projectDefaults';
import { appendHistoryEntry, createHistoryEntry } from '../projectHistory';

describe('project history', () => {
  it('drops older entries when removed assets exceed the retention budget', () => {
    const project = createDefaultProject('History');
    const firstLargeBlob = { size: 180 * 1024 * 1024 } as Blob;
    const secondLargeBlob = { size: 180 * 1024 * 1024 } as Blob;
    const first = createHistoryEntry(project, { 'assets/first.jpg': firstLargeBlob });
    project.meta.name = 'Second';
    const second = createHistoryEntry(project, { 'assets/second.jpg': secondLargeBlob });
    project.meta.name = 'Current';

    const history = appendHistoryEntry([first], second, {});

    expect(history).toEqual([second]);
  });
});
