import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { Project } from '../types';

/**
 * Saves a Project and its asset blobs as a .layox ZIP file.
 *
 * Structure inside the ZIP:
 *   project.json          – serialized Project object
 *   assets/img1.jpg       – image blobs referenced by ImageElement.src
 */
export async function saveProject(
  project: Project,
  assetBlobs: Record<string, Blob>,
): Promise<void> {
  const zip = new JSZip();

  // Add project manifest
  zip.file('project.json', JSON.stringify(project, null, 2));

  // Add asset blobs
  for (const [path, blob] of Object.entries(assetBlobs)) {
    zip.file(path, blob);
  }

  const content = await zip.generateAsync({ type: 'blob' });

  const safeName = project.meta.name.replace(/[^a-zA-Z0-9_\-äöüÄÖÜß ]/g, '_');
  saveAs(content, `${safeName}.layox`);
}

/**
 * Loads a .layox ZIP file and returns the Project + asset blobs.
 */
export async function loadProject(
  file: File,
): Promise<{ project: Project; assetBlobs: Record<string, Blob> }> {
  const zip = await JSZip.loadAsync(file);

  // Read and parse project.json
  const projectFile = zip.file('project.json');
  if (!projectFile) {
    throw new Error('Ungültige .layox-Datei: project.json fehlt.');
  }

  const projectJson = await projectFile.async('string');
  const project = JSON.parse(projectJson) as Project;

  // Basic validation
  if (!project.meta || !project.pages || !Array.isArray(project.pages)) {
    throw new Error(
      'Ungültige .layox-Datei: project.json hat ein ungültiges Format.',
    );
  }

  // Extract asset blobs
  const assetBlobs: Record<string, Blob> = {};
  const assetFiles = zip.file(/^assets\//);

  for (const entry of assetFiles) {
    const blob = await entry.async('blob');
    assetBlobs[entry.name] = blob;
  }

  return { project, assetBlobs };
}
