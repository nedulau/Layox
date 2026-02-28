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

export interface Page {
  id: string;
  elements: PageElement[];
  background: string;
}

export interface Project {
  meta: { name: string; version: string };
  pages: Page[];
}
