import { describe, expect, it } from 'vitest';
import { de, en, tr } from '../i18n';

describe('translations', () => {
  it('keeps German and English translation keys in sync', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(de).sort());
  });

  it('returns a localized value for every key', () => {
    for (const key of Object.keys(de) as Array<keyof typeof de>) {
      expect(tr('de', key)).not.toBe('');
      expect(tr('en', key)).not.toBe('');
    }
  });
});
