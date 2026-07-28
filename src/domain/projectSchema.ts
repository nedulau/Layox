import { v4 as uuidv4 } from 'uuid';
import type { Page, PageElement, Project, SlotAssignment } from '../types';

export const CURRENT_PROJECT_VERSION = '1.1' as const;
export const MAX_PROJECT_JSON_BYTES = 5 * 1024 * 1024;
export const MAX_PROJECT_ARCHIVE_BYTES = 2 * 1024 * 1024 * 1024;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, path: string): UnknownRecord {
  if (!isRecord(value)) throw new Error(`${path} must be an object.`);
  return value;
}

function requireString(value: unknown, path: string, maxLength = 10_000): string {
  if (typeof value !== 'string' || value.length > maxLength) {
    throw new Error(`${path} must be a string with at most ${maxLength} characters.`);
  }
  return value;
}

function optionalString(value: unknown, path: string, maxLength = 10_000): string | undefined {
  if (value === undefined) return undefined;
  return requireString(value, path, maxLength);
}

function requireFiniteNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${path} must be a finite number.`);
  }
  return value;
}

function optionalFiniteNumber(value: unknown, path: string): number | undefined {
  if (value === undefined) return undefined;
  return requireFiniteNumber(value, path);
}

function optionalBoolean(value: unknown, path: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') throw new Error(`${path} must be a boolean.`);
  return value;
}

function optionalEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  path: string,
): T | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new Error(`${path} is invalid.`);
  }
  return value as T;
}

function validateAssetPath(value: unknown, path: string): string {
  const assetPath = requireString(value, path, 1_024);
  if (!assetPath.startsWith('assets/') || assetPath.includes('..') || assetPath.endsWith('/')) {
    throw new Error(`${path} must reference a file below assets/.`);
  }
  return assetPath;
}

function validateElement(value: unknown, path: string): PageElement {
  const element = requireRecord(value, path);
  const type = requireString(element.type, `${path}.type`, 20);
  const base = {
    id: requireString(element.id, `${path}.id`, 200),
    x: requireFiniteNumber(element.x, `${path}.x`),
    y: requireFiniteNumber(element.y, `${path}.y`),
    rotation: requireFiniteNumber(element.rotation, `${path}.rotation`),
    zIndex: requireFiniteNumber(element.zIndex, `${path}.zIndex`),
  };

  if (type === 'image') {
    const width = requireFiniteNumber(element.width, `${path}.width`);
    const height = requireFiniteNumber(element.height, `${path}.height`);
    if (width <= 0 || height <= 0) throw new Error(`${path} image dimensions must be positive.`);
    return {
      ...base,
      type: 'image',
      width,
      height,
      src: validateAssetPath(element.src, `${path}.src`),
      originalSrc: optionalString(element.originalSrc, `${path}.originalSrc`, 4_096),
    };
  }

  if (type === 'text') {
    const fontSize = requireFiniteNumber(element.fontSize, `${path}.fontSize`);
    if (fontSize <= 0) throw new Error(`${path}.fontSize must be positive.`);
    const width = optionalFiniteNumber(element.width, `${path}.width`);
    if (width !== undefined && width <= 0) throw new Error(`${path}.width must be positive.`);
    const lineHeight = optionalFiniteNumber(element.lineHeight, `${path}.lineHeight`);
    if (lineHeight !== undefined && (lineHeight < 0.5 || lineHeight > 5)) {
      throw new Error(`${path}.lineHeight must be between 0.5 and 5.`);
    }
    return {
      ...base,
      type: 'text',
      content: requireString(element.content, `${path}.content`, 100_000),
      fontSize,
      fontFamily: requireString(element.fontFamily, `${path}.fontFamily`, 200),
      color: requireString(element.color, `${path}.color`, 100),
      width,
      align: optionalEnum(element.align, ['left', 'center', 'right'] as const, `${path}.align`),
      fontStyle: optionalEnum(
        element.fontStyle,
        ['normal', 'bold', 'italic', 'bold italic'] as const,
        `${path}.fontStyle`,
      ),
      lineHeight,
    };
  }

  throw new Error(`${path}.type is unsupported.`);
}

function validateSlotAssignment(value: unknown, path: string): SlotAssignment {
  const assignment = requireRecord(value, path);
  const scale = requireFiniteNumber(assignment.scale, `${path}.scale`);
  if (scale <= 0) throw new Error(`${path}.scale must be positive.`);

  const cropValues = [assignment.cropX, assignment.cropY, assignment.cropW, assignment.cropH];
  const hasAnyCrop = cropValues.some((part) => part !== undefined);
  const hasAllCrop = cropValues.every((part) => part !== undefined);
  if (hasAnyCrop && !hasAllCrop) throw new Error(`${path} must contain a complete crop rectangle.`);

  const result: SlotAssignment = {
    assetPath: validateAssetPath(assignment.assetPath, `${path}.assetPath`),
    offsetX: requireFiniteNumber(assignment.offsetX, `${path}.offsetX`),
    offsetY: requireFiniteNumber(assignment.offsetY, `${path}.offsetY`),
    scale,
  };

  if (hasAllCrop) {
    result.cropX = requireFiniteNumber(assignment.cropX, `${path}.cropX`);
    result.cropY = requireFiniteNumber(assignment.cropY, `${path}.cropY`);
    result.cropW = requireFiniteNumber(assignment.cropW, `${path}.cropW`);
    result.cropH = requireFiniteNumber(assignment.cropH, `${path}.cropH`);
    if (result.cropW <= 0 || result.cropH <= 0) throw new Error(`${path} crop dimensions must be positive.`);
  }

  return result;
}

function validatePage(value: unknown, index: number): Page {
  const path = `project.pages[${index}]`;
  const page = requireRecord(value, path);
  if (!Array.isArray(page.elements) || page.elements.length > 10_000) {
    throw new Error(`${path}.elements must be an array with at most 10000 entries.`);
  }

  let slotAssignments: Record<number, SlotAssignment> | undefined;
  if (page.slotAssignments !== undefined) {
    const source = requireRecord(page.slotAssignments, `${path}.slotAssignments`);
    slotAssignments = {};
    for (const [key, assignment] of Object.entries(source)) {
      const slotIndex = Number(key);
      if (!Number.isInteger(slotIndex) || slotIndex < 0) {
        throw new Error(`${path}.slotAssignments contains an invalid slot index.`);
      }
      slotAssignments[slotIndex] = validateSlotAssignment(assignment, `${path}.slotAssignments.${key}`);
    }
  }

  const layoutPadding = optionalFiniteNumber(page.layoutPadding, `${path}.layoutPadding`);
  const layoutGap = optionalFiniteNumber(page.layoutGap, `${path}.layoutGap`);
  if (layoutPadding !== undefined && layoutPadding < 0) throw new Error(`${path}.layoutPadding cannot be negative.`);
  if (layoutGap !== undefined && layoutGap < 0) throw new Error(`${path}.layoutGap cannot be negative.`);

  return {
    id: requireString(page.id, `${path}.id`, 200),
    elements: page.elements.map((element, elementIndex) => validateElement(element, `${path}.elements[${elementIndex}]`)),
    background: requireString(page.background, `${path}.background`, 100),
    layoutId: optionalString(page.layoutId, `${path}.layoutId`, 200),
    layoutPadding,
    layoutGap,
    slotAssignments,
    isCover: optionalBoolean(page.isCover, `${path}.isCover`),
    coverTitle: optionalString(page.coverTitle, `${path}.coverTitle`, 100_000),
    coverSubtitle: optionalString(page.coverSubtitle, `${path}.coverSubtitle`, 100_000),
    showCoverSubtitle: optionalBoolean(page.showCoverSubtitle, `${path}.showCoverSubtitle`),
    coverTitleFontSize: optionalFiniteNumber(page.coverTitleFontSize, `${path}.coverTitleFontSize`),
    coverTitleFontFamily: optionalString(page.coverTitleFontFamily, `${path}.coverTitleFontFamily`, 200),
    coverTitleColor: optionalString(page.coverTitleColor, `${path}.coverTitleColor`, 100),
    coverTitleX: optionalFiniteNumber(page.coverTitleX, `${path}.coverTitleX`),
    coverTitleY: optionalFiniteNumber(page.coverTitleY, `${path}.coverTitleY`),
    coverSubtitleFontSize: optionalFiniteNumber(page.coverSubtitleFontSize, `${path}.coverSubtitleFontSize`),
    coverSubtitleFontFamily: optionalString(page.coverSubtitleFontFamily, `${path}.coverSubtitleFontFamily`, 200),
    coverSubtitleColor: optionalString(page.coverSubtitleColor, `${path}.coverSubtitleColor`, 100),
    coverSubtitleX: optionalFiniteNumber(page.coverSubtitleX, `${path}.coverSubtitleX`),
    coverSubtitleY: optionalFiniteNumber(page.coverSubtitleY, `${path}.coverSubtitleY`),
    chapterTitle: optionalString(page.chapterTitle, `${path}.chapterTitle`, 10_000),
    subchapterTitle: optionalString(page.subchapterTitle, `${path}.subchapterTitle`, 10_000),
  };
}

export function migrateAndValidateProject(value: unknown): Project {
  const project = requireRecord(value, 'project');
  const meta = requireRecord(project.meta, 'project.meta');
  const sourceVersion = meta.version;
  if (sourceVersion !== undefined && sourceVersion !== '1.0' && sourceVersion !== CURRENT_PROJECT_VERSION) {
    throw new Error(`Unsupported Layox project version: ${String(sourceVersion)}.`);
  }
  if (!Array.isArray(project.pages) || project.pages.length === 0 || project.pages.length > 10_000) {
    throw new Error('project.pages must contain between 1 and 10000 pages.');
  }

  const defaultLayoutPadding = optionalFiniteNumber(meta.defaultLayoutPadding, 'project.meta.defaultLayoutPadding');
  const defaultLayoutGap = optionalFiniteNumber(meta.defaultLayoutGap, 'project.meta.defaultLayoutGap');
  if (defaultLayoutPadding !== undefined && defaultLayoutPadding < 0) {
    throw new Error('project.meta.defaultLayoutPadding cannot be negative.');
  }
  if (defaultLayoutGap !== undefined && defaultLayoutGap < 0) {
    throw new Error('project.meta.defaultLayoutGap cannot be negative.');
  }

  return {
    meta: {
      id: sourceVersion === CURRENT_PROJECT_VERSION
        ? requireString(meta.id, 'project.meta.id', 200)
        : optionalString(meta.id, 'project.meta.id', 200) || uuidv4(),
      name: requireString(meta.name, 'project.meta.name', 500),
      version: CURRENT_PROJECT_VERSION,
      defaultLayoutPadding,
      defaultLayoutGap,
    },
    pages: project.pages.map(validatePage),
  };
}

export function collectReferencedAssetPaths(project: Project): Set<string> {
  const paths = new Set<string>();
  for (const page of project.pages) {
    for (const element of page.elements) {
      if (element.type === 'image') paths.add(element.src);
    }
    for (const assignment of Object.values(page.slotAssignments ?? {})) {
      paths.add(assignment.assetPath);
    }
  }
  return paths;
}
