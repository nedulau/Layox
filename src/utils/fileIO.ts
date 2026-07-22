import type { Project, FileSystemFileHandleExt } from '../types';
import { createProjectArchiveBlob, loadProjectArchive } from './projectArchive';
import type { SaveOutcome } from '../infra/ports/fileSystemPort';

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

async function downloadBlob(blob: Blob, fileName: string): Promise<void> {
  const { saveAs } = await import('file-saver');
  saveAs(blob, fileName);
}

/**
 * Shows a "Save As" picker dialog.
 * Returns the chosen handle, or null if cancelled / unsupported.
 */
async function showSaveAsDialog(
  suggestedName: string,
): Promise<
  | { status: 'selected'; handle: FileSystemFileHandleExt }
  | { status: 'unsupported' }
  | { status: 'cancelled' }
> {
  const showSaveFilePicker = window.showSaveFilePicker;
  if (!showSaveFilePicker) return { status: 'unsupported' };
  try {
    const handle = await showSaveFilePicker({
      suggestedName,
      types: [
        {
          description: 'Layox Project',
          accept: { 'application/zip': ['.layox'] },
        },
      ],
    });
    return { status: 'selected', handle: handle as FileSystemFileHandleExt };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return { status: 'cancelled' };
    throw error;
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
  const showOpenFilePicker = window.showOpenFilePicker;
  if (!showOpenFilePicker) return null;
  try {
    const [handle] = await showOpenFilePicker({
      types: [
        {
          description: 'Layox Project',
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
): Promise<SaveOutcome> {
  const blob = await createProjectArchiveBlob(project, assetBlobs);

  // Try to overwrite existing file
  if (existingHandle) {
    try {
      await saveToHandle(existingHandle, blob);
      return { status: 'saved', location: { kind: 'web-handle', handle: existingHandle } };
    } catch {
      // permission lost → fall through to Save As
    }
  }

  // Try File System Access API picker
  const safeName =
    project.meta.name.replace(/[^\p{L}\p{N}_\- ]/gu, '_') + '.layox';
  const picker = await showSaveAsDialog(safeName);
  if (picker.status === 'selected') {
    await saveToHandle(picker.handle, blob);
    return { status: 'saved', location: { kind: 'web-handle', handle: picker.handle } };
  }
  if (picker.status === 'cancelled') return { status: 'cancelled' };

  // Fallback: classic download
  await downloadBlob(blob, safeName);
  return { status: 'downloaded' };
}

/**
 * "Save As" — always shows a picker, regardless of existing handle.
 */
export async function saveProjectAs(
  project: Project,
  assetBlobs: Record<string, Blob>,
): Promise<SaveOutcome> {
  const blob = await createProjectArchiveBlob(project, assetBlobs);
  const safeName =
    project.meta.name.replace(/[^\p{L}\p{N}_\- ]/gu, '_') + '.layox';

  const picker = await showSaveAsDialog(safeName);
  if (picker.status === 'selected') {
    await saveToHandle(picker.handle, blob);
    return { status: 'saved', location: { kind: 'web-handle', handle: picker.handle } };
  }
  if (picker.status === 'cancelled') return { status: 'cancelled' };

  // Fallback
  await downloadBlob(blob, safeName);
  return { status: 'downloaded' };
}

/**
 * Loads a .layox ZIP file and returns the Project + asset blobs.
 */
export async function loadProject(
  file: File,
): Promise<{ project: Project; assetBlobs: Record<string, Blob> }> {
  return loadProjectArchive(file);
}
