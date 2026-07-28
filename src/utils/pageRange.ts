export function parsePageRange(input: string, pageCount: number): number[] {
  const trimmed = input.trim();
  if (!trimmed || pageCount <= 0) return [];
  const indices = new Set<number>();
  for (const token of trimmed.split(',')) {
    const part = token.trim();
    if (!part) throw new Error('Invalid page range.');
    const match = part.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new Error('Invalid page range.');
    const start = Number(match[1]);
    const end = Number(match[2] ?? match[1]);
    if (start < 1 || end < start || end > pageCount) throw new Error('Invalid page range.');
    for (let pageNumber = start; pageNumber <= end; pageNumber += 1) {
      indices.add(pageNumber - 1);
    }
  }
  return [...indices].sort((first, second) => first - second);
}
