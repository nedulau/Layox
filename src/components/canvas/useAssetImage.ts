import { useEffect, useState } from 'react';
import type { PageElement, SlotAssignment } from '../../types';

type CachedImageEntry = {
  blob: Blob;
  image: HTMLImageElement;
  promise?: Promise<HTMLImageElement>;
};

const cachedImages = new Map<string, CachedImageEntry>();
let cachedProjectId: string | null = null;

function cacheKey(projectId: string, path: string): string {
  return `${projectId}::${path}`;
}

export function bindImageCacheToProject(projectId: string, assets: Record<string, Blob>): void {
  if (cachedProjectId !== projectId) {
    cachedImages.clear();
    cachedProjectId = projectId;
  }
  for (const [key, entry] of cachedImages) {
    const separator = key.indexOf('::');
    const path = separator >= 0 ? key.slice(separator + 2) : key;
    if (assets[path] !== entry.blob) cachedImages.delete(key);
  }
}

export function loadCachedBlobImage(
  projectId: string,
  path: string,
  blob: Blob,
): Promise<HTMLImageElement> {
  const key = cacheKey(projectId, path);
  const existing = cachedImages.get(key);
  if (existing && existing.blob === blob) {
    if (existing.image.complete && existing.image.naturalWidth > 0) return Promise.resolve(existing.image);
    if (existing.promise) return existing.promise;
  }

  const image = new window.Image();
  const url = URL.createObjectURL(blob);
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    image.onload = () => {
      URL.revokeObjectURL(url);
      cachedImages.set(key, { blob, image });
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      cachedImages.delete(key);
      reject(new Error(`Failed to load image for path: ${path}`));
    };
  });
  cachedImages.set(key, { blob, image, promise });
  image.src = url;
  return promise;
}

export function useCachedBlobImage(
  projectId: string,
  assetPath: string | undefined,
  assetBlobs: Record<string, Blob>,
): HTMLImageElement | null {
  const [loaded, setLoaded] = useState<{
    path: string;
    blob: Blob;
    image: HTMLImageElement;
  } | null>(null);

  useEffect(() => {
    if (!assetPath) return;
    const blob = assetBlobs[assetPath];
    if (!blob) return;
    let cancelled = false;
    loadCachedBlobImage(projectId, assetPath, blob)
      .then((loadedImage) => {
        if (!cancelled) setLoaded({ path: assetPath, blob, image: loadedImage });
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [assetPath, assetBlobs, projectId]);

  if (!assetPath) return null;
  const blob = assetBlobs[assetPath];
  return loaded?.path === assetPath && loaded.blob === blob ? loaded.image : null;
}

export function collectImagePathsFromPage(elementPage: {
  elements: PageElement[];
  slotAssignments?: Record<number, SlotAssignment>;
}): string[] {
  const paths = new Set<string>();
  Object.values(elementPage.slotAssignments ?? {}).forEach((assignment) => {
    if (assignment?.assetPath) paths.add(assignment.assetPath);
  });
  elementPage.elements.forEach((element) => {
    if (element.type === 'image' && !element.isPlaceholder) paths.add(element.src);
  });
  return [...paths];
}
