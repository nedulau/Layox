import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { Project, FileSystemFileHandleExt } from '../types';

/**
 * Builds the ZIP blob for a project.
 */
async function generateProjectBlob(
  project: Project,
  assetBlobs: Record<string, Blob>,
): Promise<Blob> {
  const zip = new JSZip();
  zip.file('project.json', JSON.stringify(project, null, 2));
  for (const [path, blob] of Object.entries(assetBlobs)) {
    zip.file(path, blob);
  }
  return zip.generateAsync({ type: 'blob' });
}

/**
 * Writes a blob to an existing FileSystemFileHandle (overwrite in place).
 */
async function saveToHandle(
  handle: FileSystemFileHandleExt,
  blob: Blob,
): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
}

/**
 * Shows a "Save As" picker dialog.
 * Returns the chosen handle, or null if cancelled / unsupported.
 */
async function showSaveAsDialog(
  suggestedName: string,
): Promise<FileSystemFileHandleExt | null> {
  if (!('showSaveFilePicker' in window)) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handle = await (window as any).showSaveFilePicker({
      suggestedName,
      types: [
        {
          description: 'Layox-Projekt',
          accept: { 'application/zip': ['.layox'] },
        },
      ],
    });
    return handle as FileSystemFileHandleExt;
  } catch {
    return null; // user cancelled
  }
}

/**
 * Shows an "Open" file picker dialog.
 * Returns { file, handle } or null if cancelled / unsupported.
 */
export async function showOpenDialog(): Promise<{
  file: File;
  handle: FileSystemFileHandleExt;
} | null> {
  if (!('showOpenFilePicker' in window)) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [handle] = await (window as any).showOpenFilePicker({
      types: [
        {
          description: 'Layox-Projekt',
          accept: { 'application/zip': ['.layox'] },
        },
      ],
      multiple: false,
    });
    const file = await (handle as FileSystemFileHandleExt).getFile();
    return { file, handle: handle as FileSystemFileHandleExt };
  } catch {
    return null;
  }
}

/**
 * Saves a project: if handle exists → overwrite in place; otherwise "Save As" flow.
 * Returns the (possibly new) handle, or null if user cancelled / fallback download.
 */
export async function saveProject(
  project: Project,
  assetBlobs: Record<string, Blob>,
  existingHandle: FileSystemFileHandleExt | null,
): Promise<FileSystemFileHandleExt | null> {
  const blob = await generateProjectBlob(project, assetBlobs);

  // Try to overwrite existing file
  if (existingHandle) {
    try {
      await saveToHandle(existingHandle, blob);
      return existingHandle;
    } catch {
      // permission lost → fall through to Save As
    }
  }

  // Try File System Access API picker
  const safeName =
    project.meta.name.replace(/[^a-zA-Z0-9_\-äöüÄÖÜß ]/g, '_') + '.layox';
  const newHandle = await showSaveAsDialog(safeName);
  if (newHandle) {
    await saveToHandle(newHandle, blob);
    return newHandle;
  }

  // Fallback: classic download
  saveAs(blob, safeName);
  return null;
}

/**
 * "Save As" — always shows a picker, regardless of existing handle.
 */
export async function saveProjectAs(
  project: Project,
  assetBlobs: Record<string, Blob>,
): Promise<FileSystemFileHandleExt | null> {
  const blob = await generateProjectBlob(project, assetBlobs);
  const safeName =
    project.meta.name.replace(/[^a-zA-Z0-9_\-äöüÄÖÜß ]/g, '_') + '.layox';

  const handle = await showSaveAsDialog(safeName);
  if (handle) {
    await saveToHandle(handle, blob);
    return handle;
  }

  // Fallback
  saveAs(blob, safeName);
  return null;
}

/**
 * Loads a .layox ZIP file and returns the Project + asset blobs.
 */
export async function loadProject(
  file: File,
): Promise<{ project: Project; assetBlobs: Record<string, Blob> }> {
  const zip = await JSZip.loadAsync(file);

  const projectFile = zip.file('project.json');
  if (!projectFile) {
    throw new Error('Ungültige .layox-Datei: project.json fehlt.');
  }

  const projectJson = await projectFile.async('string');
  const project = JSON.parse(projectJson) as Project;

  if (!project.meta || !project.pages || !Array.isArray(project.pages)) {
    throw new Error(
      'Ungültige .layox-Datei: project.json hat ein ungültiges Format.',
    );
  }

  const assetBlobs: Record<string, Blob> = {};
  const assetFiles = zip.file(/^assets\//);

  for (const entry of assetFiles) {
    const blob = await entry.async('blob');
    assetBlobs[entry.name] = blob;
  }

  return { project, assetBlobs };
}
