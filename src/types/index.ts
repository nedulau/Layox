export type ElementType = 'image' | 'text';

export interface BaseElement {
  id: string; // UUID
  x: number;
  y: number;
  rotation: number;
  zIndex: number;
}

export interface ImageElement extends BaseElement {
  type: 'image';
  width: number;
  height: number;
  src: string; // Relative path inside ZIP (e.g., "assets/img1.jpg")
  originalSrc?: string; // Optional: Path to original on disk
}

export interface TextElement extends BaseElement {
  type: 'text';
  content: string;
  fontSize: number;
  fontFamily: string;
  color: string;
  width?: number; // Wraps text if defined
}

export type PageElement = ImageElement | TextElement;

// ─── Layouts ─────────────────────────────────────────────────────────────────

export interface LayoutSlot {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutTemplate {
  id: string;
  name: string;
  slots: LayoutSlot[];
}

// ─── Page & Project ──────────────────────────────────────────────────────────

export interface Page {
  id: string;
  elements: PageElement[];
  background: string;
  layoutId?: string; // ID of the applied layout template
  slotAssignments?: Record<number, string>; // slot index → asset path
}

export interface Project {
  meta: { name: string; version: string };
  pages: Page[];
}

// ─── File System Access API types ────────────────────────────────────────────

export interface FileSystemWritableFileStream extends WritableStream {
  write(data: Blob | BufferSource | string | Record<string, unknown>): Promise<void>;
  seek(position: number): Promise<void>;
  truncate(size: number): Promise<void>;
}

export interface FileSystemFileHandleExt {
  kind: 'file';
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<FileSystemWritableFileStream>;
}
