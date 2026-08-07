import type { Project } from '../types';

const MAX_HISTORY_ENTRIES = 50;
const MAX_RETAINED_ASSET_BYTES = 256 * 1024 * 1024;

export interface HistoryEntry {
  project: Project;
  assetBlobs: Record<string, Blob>;
  projectFingerprint: string;
}

function sameAssets(left: Record<string, Blob>, right: Record<string, Blob>): boolean {
  const leftPaths = Object.keys(left);
  const rightPaths = Object.keys(right);
  return leftPaths.length === rightPaths.length
    && leftPaths.every((path) => left[path] === right[path]);
}

export function createHistoryEntry(
  project: Project,
  assetBlobs: Record<string, Blob>,
): HistoryEntry {
  const projectFingerprint = JSON.stringify(project);
  return {
    project: JSON.parse(projectFingerprint) as Project,
    assetBlobs: { ...assetBlobs },
    projectFingerprint,
  };
}

export function historyEntryMatches(
  entry: HistoryEntry,
  project: Project,
  assetBlobs: Record<string, Blob>,
): boolean {
  return entry.projectFingerprint === JSON.stringify(project)
    && sameAssets(entry.assetBlobs, assetBlobs);
}

function entriesMatch(left: HistoryEntry, right: HistoryEntry): boolean {
  return left.projectFingerprint === right.projectFingerprint
    && sameAssets(left.assetBlobs, right.assetBlobs);
}

export function appendHistoryEntry(
  entries: HistoryEntry[],
  entry: HistoryEntry,
  activeAssetBlobs: Record<string, Blob>,
): HistoryEntry[] {
  if (entries.at(-1) && entriesMatch(entries.at(-1)!, entry)) return entries;

  const activeBlobs = new Set(Object.values(activeAssetBlobs));
  const retainedBlobs = new Set<Blob>();
  let retainedBytes = 0;
  const keptNewestFirst: HistoryEntry[] = [];

  for (let index = entries.length; index >= 0; index -= 1) {
    const candidate = index === entries.length ? entry : entries[index];
    if (keptNewestFirst.length >= MAX_HISTORY_ENTRIES) break;
    const newlyRetained = Object.values(candidate.assetBlobs).filter(
      (blob) => !activeBlobs.has(blob) && !retainedBlobs.has(blob),
    );
    const additionalBytes = newlyRetained.reduce((total, blob) => total + blob.size, 0);
    if (keptNewestFirst.length > 0 && retainedBytes + additionalBytes > MAX_RETAINED_ASSET_BYTES) break;
    newlyRetained.forEach((blob) => retainedBlobs.add(blob));
    retainedBytes += additionalBytes;
    keptNewestFirst.push(candidate);
  }

  return keptNewestFirst.reverse();
}

export function discardMatchingHistoryTail(
  entries: HistoryEntry[],
  project: Project,
  assetBlobs: Record<string, Blob>,
): HistoryEntry[] {
  let end = entries.length;
  while (end > 0 && historyEntryMatches(entries[end - 1], project, assetBlobs)) end -= 1;
  return entries.slice(0, end);
}

export function prependFutureEntry(entries: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  return [entry, ...entries].slice(0, MAX_HISTORY_ENTRIES);
}
