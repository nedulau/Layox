import { createWebFileSystemPort } from './adapters/webFileSystemPort';
import { createElectronFileSystemPort } from './adapters/electronFileSystemPort';
import { createCapacitorFileSystemPort } from './adapters/capacitorFileSystemPort';
import { detectRuntimePlatform } from './runtime';
import type { FileSystemPort } from './ports/fileSystemPort';

let fileSystemPort: FileSystemPort | null = null;

function createFileSystemPortForRuntime(): FileSystemPort {
  const runtime = detectRuntimePlatform();

  switch (runtime) {
    case 'electron':
      return createElectronFileSystemPort();
    case 'capacitor':
      return createCapacitorFileSystemPort();
    case 'web':
    default:
      return createWebFileSystemPort();
  }
}

export function getFileSystemPort(): FileSystemPort {
  if (!fileSystemPort) {
    fileSystemPort = createFileSystemPortForRuntime();
  }
  return fileSystemPort;
}
