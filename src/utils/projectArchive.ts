import JSZip from 'jszip';
import type { Project } from '../types';
import {
  collectReferencedAssetPaths,
  MAX_PROJECT_ARCHIVE_BYTES,
  MAX_PROJECT_JSON_BYTES,
  migrateAndValidateProject,
} from '../domain/projectSchema';

export async function createProjectArchiveBlob(
  project: Project,
  assetBlobs: Record<string, Blob>,
): Promise<Blob> {
  const zip = new JSZip();
  zip.file('project.json', JSON.stringify(project, null, 2));
  for (const [path, blob] of Object.entries(assetBlobs)) {
    if (!path.startsWith('assets/') || path.includes('..') || path.endsWith('/')) {
      throw new Error(`Invalid asset path: ${path}.`);
    }
    zip.file(path, blob);
  }
  return zip.generateAsync({ type: 'blob', streamFiles: true });
}

export async function loadProjectArchive(
  file: Blob,
): Promise<{ project: Project; assetBlobs: Record<string, Blob> }> {
  if (file.size > MAX_PROJECT_ARCHIVE_BYTES) {
    throw new Error('The Layox project exceeds the 2 GiB archive limit.');
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    throw new Error('Invalid .layox file: the ZIP archive is damaged.');
  }

  const projectFile = zip.file('project.json');
  if (!projectFile) throw new Error('Invalid .layox file: missing project.json.');
  const projectBlob = await projectFile.async('blob');
  if (projectBlob.size > MAX_PROJECT_JSON_BYTES) {
    throw new Error('Invalid .layox file: project.json exceeds 5 MiB.');
  }

  let rawProject: unknown;
  try {
    rawProject = JSON.parse(await projectBlob.text()) as unknown;
  } catch {
    throw new Error('Invalid .layox file: project.json is not valid JSON.');
  }
  const project = migrateAndValidateProject(rawProject);

  const assetBlobs: Record<string, Blob> = {};
  for (const entry of zip.file(/^assets\//)) {
    if (entry.dir || entry.name.includes('..')) continue;
    assetBlobs[entry.name] = await entry.async('blob');
  }

  const missingAssets = [...collectReferencedAssetPaths(project)].filter((path) => !assetBlobs[path]);
  if (missingAssets.length > 0) {
    const preview = missingAssets.slice(0, 3).join(', ');
    throw new Error(`Invalid .layox file: missing referenced assets (${preview}).`);
  }

  return { project, assetBlobs };
}
