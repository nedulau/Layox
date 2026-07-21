import { v4 as uuidv4 } from 'uuid';
import type { Page, Project } from '../types';

export const DEFAULT_LAYOUT_PADDING = 20;
export const DEFAULT_LAYOUT_GAP = 20;
export const DEFAULT_PAGE_BACKGROUND = '#ffffff';
export const DEFAULT_COVER_TITLE_FONT_SIZE = 48;
export const DEFAULT_COVER_SUBTITLE_FONT_SIZE = 24;
export const DEFAULT_COVER_TITLE_FONT_FAMILY = 'Arial';
export const DEFAULT_COVER_SUBTITLE_FONT_FAMILY = 'Arial';
export const DEFAULT_COVER_TITLE_COLOR = '#ffffff';
export const DEFAULT_COVER_SUBTITLE_COLOR = '#ffffffcc';
export const DEFAULT_TEXT_FONT_SIZE = 24;
export const DEFAULT_TEXT_FONT_FAMILY = 'Arial';
export const DEFAULT_TEXT_COLOR = '#000000';

export function createEmptyPage(): Page {
  return {
    id: uuidv4(),
    elements: [],
    background: DEFAULT_PAGE_BACKGROUND,
  };
}

export function createCoverPage(projectName: string): Page {
  return {
    id: uuidv4(),
    elements: [],
    background: DEFAULT_PAGE_BACKGROUND,
    isCover: true,
    coverTitle: projectName,
    chapterTitle: projectName,
    coverSubtitle: '',
    showCoverSubtitle: false,
    coverTitleFontSize: DEFAULT_COVER_TITLE_FONT_SIZE,
    coverTitleFontFamily: DEFAULT_COVER_TITLE_FONT_FAMILY,
    coverTitleColor: DEFAULT_COVER_TITLE_COLOR,
    coverSubtitleFontSize: DEFAULT_COVER_SUBTITLE_FONT_SIZE,
    coverSubtitleFontFamily: DEFAULT_COVER_SUBTITLE_FONT_FAMILY,
    coverSubtitleColor: DEFAULT_COVER_SUBTITLE_COLOR,
    layoutId: 'cover-full',
  };
}

export function createDefaultProject(name = 'Untitled Project'): Project {
  return {
    meta: {
      id: uuidv4(),
      name,
      version: '1.1',
      defaultLayoutPadding: DEFAULT_LAYOUT_PADDING,
      defaultLayoutGap: DEFAULT_LAYOUT_GAP,
    },
    pages: [createCoverPage(name), createEmptyPage()],
  };
}

export function normalizeProject(project: Project): Project {
  return {
    ...project,
    pages: project.pages.map((page) => {
      if (!page.isCover) return page;
      const normalizedCoverTitle = page.coverTitle ?? '';
      return {
        ...page,
        chapterTitle: page.chapterTitle ?? normalizedCoverTitle,
        showCoverSubtitle: page.showCoverSubtitle ?? false,
        coverTitleFontSize: page.coverTitleFontSize ?? DEFAULT_COVER_TITLE_FONT_SIZE,
        coverTitleFontFamily: page.coverTitleFontFamily ?? DEFAULT_COVER_TITLE_FONT_FAMILY,
        coverTitleColor: page.coverTitleColor ?? DEFAULT_COVER_TITLE_COLOR,
        coverSubtitleFontSize: page.coverSubtitleFontSize ?? DEFAULT_COVER_SUBTITLE_FONT_SIZE,
        coverSubtitleFontFamily: page.coverSubtitleFontFamily ?? DEFAULT_COVER_SUBTITLE_FONT_FAMILY,
        coverSubtitleColor: page.coverSubtitleColor ?? DEFAULT_COVER_SUBTITLE_COLOR,
      };
    }),
    meta: {
      ...project.meta,
      defaultLayoutPadding: project.meta.defaultLayoutPadding ?? DEFAULT_LAYOUT_PADDING,
      defaultLayoutGap: project.meta.defaultLayoutGap ?? DEFAULT_LAYOUT_GAP,
    },
  };
}
