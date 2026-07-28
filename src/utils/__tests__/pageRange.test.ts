import { describe, expect, it } from 'vitest';
import { parsePageRange } from '../pageRange';

describe('page range parsing', () => {
  it('expands, deduplicates and sorts page ranges', () => {
    expect(parsePageRange('3, 1-2, 2, 5', 6)).toEqual([0, 1, 2, 4]);
  });

  it.each(['', '0', '3-2', '1-', 'x', '1,', '7'])('rejects or empties invalid range %s', (value) => {
    if (!value) expect(parsePageRange(value, 6)).toEqual([]);
    else expect(() => parsePageRange(value, 6)).toThrow('Invalid page range');
  });
});
