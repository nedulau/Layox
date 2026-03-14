import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { Project, Page, PageElement, ImageElement, TextElement, FileSystemFileHandleExt, SlotAssignment } from '../types';
import { saveProject, saveProjectAs, loadProject, showOpenDialog } from '../utils/fileIO';
import { getLayoutById, computeLayoutSlots } from '../utils/layouts';
import { storeHandle } from '../utils/handleStore';
import { CANVAS_H, CANVAS_IMAGE_MAX_H, CANVAS_IMAGE_MAX_W, CANVAS_W } from '../constants/canvas';

const DEFAULT_LAYOUT_PADDING = 20;
const DEFAULT_LAYOUT_GAP = 10;
const DEFAULT_COVER_TITLE_FONT_SIZE = 48;
const DEFAULT_COVER_SUBTITLE_FONT_SIZE = 24;
const DEFAULT_COVER_TITLE_FONT_FAMILY = 'Arial';
const DEFAULT_COVER_SUBTITLE_FONT_FAMILY = 'Arial';
const DEFAULT_COVER_TITLE_COLOR = '#ffffff';
const DEFAULT_COVER_SUBTITLE_COLOR = '#ffffffcc';

function createEmptyPage(): Page {
  return {
    id: uuidv4(),
    elements: [],
    background: '#ffffff',
  };
}

function createDefaultProject(name: string = 'Unbenanntes Projekt'): Project {
  const coverPage: Page = {
    id: uuidv4(),
    elements: [],
    background: '#ffffff',
    isCover: true,
    coverTitle: name,
    chapterTitle: name,
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
  return {
    meta: {
      name,
      version: '1.0',
      defaultLayoutPadding: DEFAULT_LAYOUT_PADDING,
      defaultLayoutGap: DEFAULT_LAYOUT_GAP,
    },
    pages: [coverPage, createEmptyPage()],
  };
}

function normalizeProject(project: Project): Project {
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

interface RecentProject {
  name: string;
  fileName: string;
  lastOpened: number; // timestamp
}

interface ProjectState {
  project: Project;
  currentPageIndex: number;
  assetBlobs: Record<string, Blob>;
  selectedElementId: string | null;
  selectedSlotIndex: number | null;
  fileHandle: FileSystemFileHandleExt | null;
  autoSaveEnabled: boolean;
  autoSaveInterval: number; // seconds
  showEditor: boolean;
  recentProjects: RecentProject[];

  currentPage: () => Page | undefined;

  setProject: (project: Project) => void;
  setProjectName: (name: string) => void;
  addAsset: (path: string, blob: Blob) => void;
  resetProject: (name?: string) => void;
  setAutoSaveEnabled: (enabled: boolean) => void;
  setAutoSaveInterval: (seconds: number) => void;
  setShowEditor: (show: boolean) => void;
  addRecentProject: (name: string, fileName: string) => void;

  setCurrentPageIndex: (index: number) => void;
  addPage: () => void;
  removePage: (index: number) => void;
  movePage: (fromIndex: number, toIndex: number) => void;

  addElement: (element: PageElement) => void;
  updateElement: (elementId: string, changes: Partial<PageElement>) => void;
  removeElement: (elementId: string) => void;
  setSelectedElementId: (id: string | null) => void;
  setSelectedSlotIndex: (index: number | null) => void;

  addImageFromFile: (file: File) => Promise<void>;
  addImageFromAsset: (assetPath: string) => Promise<void>;
  addTextElement: () => void;
  removeImageFromSlot: (slotIndex: number) => void;
  updateSlotOffset: (slotIndex: number, offsetX: number, offsetY: number) => void;
  updateSlotScale: (slotIndex: number, scale: number) => void;
  updateSlotCrop: (slotIndex: number, cropX: number, cropY: number, cropW: number, cropH: number) => void;
  clearSlotCrop: (slotIndex: number) => void;
  setLayoutPadding: (padding: number) => void;
  setLayoutGap: (gap: number) => void;
  setDefaultLayoutPadding: (padding: number) => void;
  setDefaultLayoutGap: (gap: number) => void;
  applyLayoutDefaultsToAllPages: () => void;

  setCoverTitle: (title: string) => void;
  setCoverSubtitle: (subtitle: string) => void;
  setCoverSubtitleVisible: (visible: boolean) => void;
  setCoverTitleStyle: (changes: { fontSize?: number; fontFamily?: string; color?: string }) => void;
  setCoverSubtitleStyle: (changes: { fontSize?: number; fontFamily?: string; color?: string }) => void;
  setCoverTitlePosition: (x: number, y: number) => void;
  setCoverSubtitlePosition: (x: number, y: number) => void;
  setCurrentPageChapterTitle: (title: string) => void;
  setCurrentPageSubchapterTitle: (title: string) => void;
  toggleCover: (isCover: boolean) => void;
  addCoverPage: () => void;

  applyLayout: (layoutId: string) => void;
  clearLayout: () => void;

  saveCurrentProject: () => Promise<void>;
  saveCurrentProjectAs: () => Promise<void>;
  openProject: () => Promise<void>;
  loadFromFile: (file: File, handle?: FileSystemFileHandleExt | null) => Promise<void>;

  historyPast: Project[];
  historyFuture: Project[];
  snapshot: () => void;
  undo: () => void;
  redo: () => void;
}

const useProjectStore = create<ProjectState>((set, get) => ({
  project: createDefaultProject(),
  currentPageIndex: 0,
  assetBlobs: {},
  selectedElementId: null,
  selectedSlotIndex: null,
  fileHandle: null,
  autoSaveEnabled: localStorage.getItem('layox_autoSaveEnabled') === 'true',
  autoSaveInterval: parseInt(localStorage.getItem('layox_autoSaveInterval') || '30', 10),
  showEditor: false,
  recentProjects: JSON.parse(localStorage.getItem('layox_recentProjects') || '[]') as RecentProject[],
  historyPast: [],
  historyFuture: [],

  currentPage: () => {
    const { project, currentPageIndex } = get();
    return project.pages[currentPageIndex];
  },

  setProject: (project) =>
    set({ project: normalizeProject(project), currentPageIndex: 0, selectedElementId: null, selectedSlotIndex: null }),

  setProjectName: (name) =>
    set((state) => ({
      project: {
        ...state.project,
        meta: { ...state.project.meta, name },
      },
    })),

  addAsset: (path, blob) =>
    set((state) => ({
      assetBlobs: { ...state.assetBlobs, [path]: blob },
    })),

  resetProject: (name) => {
    const projectName = name || 'Unbenanntes Projekt';
    set({
      project: createDefaultProject(projectName),
      currentPageIndex: 0,
      assetBlobs: {},
      selectedElementId: null,
      selectedSlotIndex: null,
      fileHandle: null,
      showEditor: true,
    });
  },

  setAutoSaveEnabled: (enabled) => {
    localStorage.setItem('layox_autoSaveEnabled', String(enabled));
    set({ autoSaveEnabled: enabled });
  },

  setAutoSaveInterval: (seconds) => {
    localStorage.setItem('layox_autoSaveInterval', String(seconds));
    set({ autoSaveInterval: seconds });
  },

  setShowEditor: (show) => set({ showEditor: show }),

  addRecentProject: (name, fileName) => {
    const recents = get().recentProjects.filter((r) => r.fileName !== fileName);
    recents.unshift({ name, fileName, lastOpened: Date.now() });
    const trimmed = recents.slice(0, 10);
    localStorage.setItem('layox_recentProjects', JSON.stringify(trimmed));
    set({ recentProjects: trimmed });
  },

  snapshot: () => {
    const { project, historyPast } = get();
    set({
      historyPast: [...historyPast, JSON.parse(JSON.stringify(project))].slice(-50),
      historyFuture: [],
    });
  },

  undo: () => {
    const { historyPast, historyFuture, project } = get();
    if (historyPast.length === 0) return;
    const prev = historyPast[historyPast.length - 1];
    set({
      historyPast: historyPast.slice(0, -1),
      historyFuture: [JSON.parse(JSON.stringify(project)), ...historyFuture].slice(0, 50),
      project: prev,
      selectedElementId: null,
      selectedSlotIndex: null,
    });
  },

  redo: () => {
    const { historyPast, historyFuture, project } = get();
    if (historyFuture.length === 0) return;
    const next = historyFuture[0];
    set({
      historyPast: [...historyPast, JSON.parse(JSON.stringify(project))],
      historyFuture: historyFuture.slice(1),
      project: next,
      selectedElementId: null,
      selectedSlotIndex: null,
    });
  },

  setCurrentPageIndex: (index) =>
    set({ currentPageIndex: index, selectedElementId: null, selectedSlotIndex: null }),

  // --- Page management ---

  addPage: () =>
    set((state) => {
      const newPage = createEmptyPage();
      const newPages = [...state.project.pages, newPage];
      return {
        project: { ...state.project, pages: newPages },
        currentPageIndex: newPages.length - 1,
        selectedElementId: null,
        selectedSlotIndex: null,
      };
    }),

  removePage: (index) =>
    set((state) => {
      if (state.project.pages.length <= 1) return state;
      const newPages = state.project.pages.filter((_, i) => i !== index);
      const newIndex = Math.min(state.currentPageIndex, newPages.length - 1);
      return {
        project: { ...state.project, pages: newPages },
        currentPageIndex: newIndex,
        selectedElementId: null,
        selectedSlotIndex: null,
      };
    }),

  movePage: (fromIndex, toIndex) =>
    set((state) => {
      const pages = [...state.project.pages];
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= pages.length ||
        toIndex >= pages.length ||
        fromIndex === toIndex
      ) {
        return state;
      }

      const [moved] = pages.splice(fromIndex, 1);
      pages.splice(toIndex, 0, moved);

      let nextCurrentPageIndex = state.currentPageIndex;
      if (state.currentPageIndex === fromIndex) {
        nextCurrentPageIndex = toIndex;
      } else if (fromIndex < state.currentPageIndex && toIndex >= state.currentPageIndex) {
        nextCurrentPageIndex -= 1;
      } else if (fromIndex > state.currentPageIndex && toIndex <= state.currentPageIndex) {
        nextCurrentPageIndex += 1;
      }

      return {
        project: { ...state.project, pages },
        currentPageIndex: nextCurrentPageIndex,
        selectedElementId: null,
        selectedSlotIndex: null,
      };
    }),

  // --- Element CRUD ---

  addElement: (element) =>
    set((state) => {
      const pages = [...state.project.pages];
      const page = { ...pages[state.currentPageIndex] };
      page.elements = [...page.elements, element];
      pages[state.currentPageIndex] = page;
      return {
        project: { ...state.project, pages },
        selectedElementId: element.id,
      };
    }),

  updateElement: (elementId, changes) =>
    set((state) => {
      const pages = [...state.project.pages];
      const page = { ...pages[state.currentPageIndex] };
      page.elements = page.elements.map((el) =>
        el.id === elementId ? ({ ...el, ...changes } as PageElement) : el,
      );
      pages[state.currentPageIndex] = page;
      return { project: { ...state.project, pages } };
    }),

  removeElement: (elementId) =>
    set((state) => {
      const pages = [...state.project.pages];
      const page = { ...pages[state.currentPageIndex] };
      page.elements = page.elements.filter((el) => el.id !== elementId);
      pages[state.currentPageIndex] = page;
      return {
        project: { ...state.project, pages },
        selectedElementId:
          state.selectedElementId === elementId ? null : state.selectedElementId,
      };
    }),

  setSelectedElementId: (id) => set({ selectedElementId: id, selectedSlotIndex: null }),

  setSelectedSlotIndex: (index) => set({ selectedSlotIndex: index, selectedElementId: null }),

  // --- Slot management ---

  removeImageFromSlot: (slotIndex) =>
    set((state) => {
      const pages = [...state.project.pages];
      const page = { ...pages[state.currentPageIndex] };
      if (!page.slotAssignments) return state;
      const assignments = { ...page.slotAssignments };
      delete assignments[slotIndex];
      page.slotAssignments = assignments;
      pages[state.currentPageIndex] = page;
      return {
        project: { ...state.project, pages },
        selectedSlotIndex: null,
      };
    }),

  updateSlotOffset: (slotIndex, offsetX, offsetY) =>
    set((state) => {
      const pages = [...state.project.pages];
      const page = { ...pages[state.currentPageIndex] };
      if (!page.slotAssignments?.[slotIndex]) return state;
      page.slotAssignments = {
        ...page.slotAssignments,
        [slotIndex]: { ...page.slotAssignments[slotIndex], offsetX, offsetY },
      };
      pages[state.currentPageIndex] = page;
      return { project: { ...state.project, pages } };
    }),

  updateSlotScale: (slotIndex, scale) =>
    set((state) => {
      const pages = [...state.project.pages];
      const page = { ...pages[state.currentPageIndex] };
      if (!page.slotAssignments?.[slotIndex]) return state;
      page.slotAssignments = {
        ...page.slotAssignments,
        [slotIndex]: { ...page.slotAssignments[slotIndex], scale },
      };
      pages[state.currentPageIndex] = page;
      return { project: { ...state.project, pages } };
    }),

  updateSlotCrop: (slotIndex, cropX, cropY, cropW, cropH) =>
    set((state) => {
      const pages = [...state.project.pages];
      const page = { ...pages[state.currentPageIndex] };
      if (!page.slotAssignments?.[slotIndex]) return state;
      page.slotAssignments = {
        ...page.slotAssignments,
        [slotIndex]: { ...page.slotAssignments[slotIndex], cropX, cropY, cropW, cropH },
      };
      pages[state.currentPageIndex] = page;
      return { project: { ...state.project, pages } };
    }),

  clearSlotCrop: (slotIndex) =>
    set((state) => {
      const pages = [...state.project.pages];
      const page = { ...pages[state.currentPageIndex] };
      if (!page.slotAssignments?.[slotIndex]) return state;
      const assignment = { ...page.slotAssignments[slotIndex] };
      delete assignment.cropX;
      delete assignment.cropY;
      delete assignment.cropW;
      delete assignment.cropH;
      page.slotAssignments = {
        ...page.slotAssignments,
        [slotIndex]: assignment,
      };
      pages[state.currentPageIndex] = page;
      return { project: { ...state.project, pages } };
    }),

  setLayoutPadding: (padding) =>
    set((state) => {
      const pages = [...state.project.pages];
      const page = { ...pages[state.currentPageIndex] };
      page.layoutPadding = padding;
      pages[state.currentPageIndex] = page;
      return { project: { ...state.project, pages } };
    }),

  setLayoutGap: (gap) =>
    set((state) => {
      const pages = [...state.project.pages];
      const page = { ...pages[state.currentPageIndex] };
      page.layoutGap = gap;
      pages[state.currentPageIndex] = page;
      return { project: { ...state.project, pages } };
    }),

  setDefaultLayoutPadding: (padding) =>
    set((state) => ({
      project: {
        ...state.project,
        meta: {
          ...state.project.meta,
          defaultLayoutPadding: padding,
        },
      },
    })),

  setDefaultLayoutGap: (gap) =>
    set((state) => ({
      project: {
        ...state.project,
        meta: {
          ...state.project.meta,
          defaultLayoutGap: gap,
        },
      },
    })),

  applyLayoutDefaultsToAllPages: () =>
    set((state) => {
      const defaultPadding = state.project.meta.defaultLayoutPadding ?? DEFAULT_LAYOUT_PADDING;
      const defaultGap = state.project.meta.defaultLayoutGap ?? DEFAULT_LAYOUT_GAP;
      const pages = state.project.pages.map((page) => ({
        ...page,
        layoutPadding: defaultPadding,
        layoutGap: defaultGap,
      }));
      return {
        project: {
          ...state.project,
          pages,
        },
      };
    }),

  setCoverTitle: (title) =>
    set((state) => {
      const pages = [...state.project.pages];
      const page = { ...pages[state.currentPageIndex] };
      page.coverTitle = title;
      if (page.isCover) {
        const trimmed = title.trim();
        if (trimmed) page.chapterTitle = trimmed;
        else delete page.chapterTitle;
      }
      pages[state.currentPageIndex] = page;
      return { project: { ...state.project, pages } };
    }),

  setCoverSubtitle: (subtitle) =>
    set((state) => {
      const pages = [...state.project.pages];
      const page = { ...pages[state.currentPageIndex] };
      page.coverSubtitle = subtitle;
      pages[state.currentPageIndex] = page;
      return { project: { ...state.project, pages } };
    }),

  setCoverSubtitleVisible: (visible) =>
    set((state) => {
      const pages = [...state.project.pages];
      const page = { ...pages[state.currentPageIndex] };
      page.showCoverSubtitle = visible;
      pages[state.currentPageIndex] = page;
      return { project: { ...state.project, pages } };
    }),

  setCoverTitleStyle: (changes) =>
    set((state) => {
      const pages = [...state.project.pages];
      const page = { ...pages[state.currentPageIndex] };
      if (changes.fontSize !== undefined) {
        page.coverTitleFontSize = Math.max(1, changes.fontSize);
      }
      if (changes.fontFamily !== undefined) {
        page.coverTitleFontFamily = changes.fontFamily;
      }
      if (changes.color !== undefined) {
        page.coverTitleColor = changes.color;
      }
      pages[state.currentPageIndex] = page;
      return { project: { ...state.project, pages } };
    }),

  setCoverSubtitleStyle: (changes) =>
    set((state) => {
      const pages = [...state.project.pages];
      const page = { ...pages[state.currentPageIndex] };
      if (changes.fontSize !== undefined) {
        page.coverSubtitleFontSize = Math.max(1, changes.fontSize);
      }
      if (changes.fontFamily !== undefined) {
        page.coverSubtitleFontFamily = changes.fontFamily;
      }
      if (changes.color !== undefined) {
        page.coverSubtitleColor = changes.color;
      }
      pages[state.currentPageIndex] = page;
      return { project: { ...state.project, pages } };
    }),

  setCoverTitlePosition: (x, y) =>
    set((state) => {
      const pages = [...state.project.pages];
      const page = { ...pages[state.currentPageIndex] };
      page.coverTitleX = x;
      page.coverTitleY = y;
      pages[state.currentPageIndex] = page;
      return { project: { ...state.project, pages } };
    }),

  setCoverSubtitlePosition: (x, y) =>
    set((state) => {
      const pages = [...state.project.pages];
      const page = { ...pages[state.currentPageIndex] };
      page.coverSubtitleX = x;
      page.coverSubtitleY = y;
      pages[state.currentPageIndex] = page;
      return { project: { ...state.project, pages } };
    }),

  setCurrentPageChapterTitle: (title) =>
    set((state) => {
      const pages = [...state.project.pages];
      const page = { ...pages[state.currentPageIndex] };
      const trimmed = title.trim();
      if (trimmed) page.chapterTitle = trimmed;
      else delete page.chapterTitle;
      pages[state.currentPageIndex] = page;
      return { project: { ...state.project, pages } };
    }),

  setCurrentPageSubchapterTitle: (title) =>
    set((state) => {
      const pages = [...state.project.pages];
      const page = { ...pages[state.currentPageIndex] };
      const trimmed = title.trim();
      if (trimmed) page.subchapterTitle = trimmed;
      else delete page.subchapterTitle;
      pages[state.currentPageIndex] = page;
      return { project: { ...state.project, pages } };
    }),

  toggleCover: (isCover) =>
    set((state) => {
      const pages = [...state.project.pages];
      const page = { ...pages[state.currentPageIndex] };
      page.isCover = isCover;
      if (isCover && !page.coverTitle) page.coverTitle = state.project.meta.name;
      pages[state.currentPageIndex] = page;
      return { project: { ...state.project, pages } };
    }),

  addCoverPage: () =>
    set((state) => {
      const coverPage: Page = {
        id: uuidv4(),
        elements: [],
        background: '#ffffff',
        isCover: true,
        coverTitle: state.project.meta.name,
        chapterTitle: state.project.meta.name,
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
      const newPages = [coverPage, ...state.project.pages];
      return {
        project: { ...state.project, pages: newPages },
        currentPageIndex: 0,
        selectedElementId: null,
        selectedSlotIndex: null,
      };
    }),

  // --- Layout ---

  applyLayout: (layoutId) =>
    set((state) => {
      const layout = getLayoutById(layoutId);
      if (!layout) return state;

      const pages = [...state.project.pages];
      const page = { ...pages[state.currentPageIndex] };

      if (!page.layoutId) {
        // Switching from free mode → layout: auto-assign existing images to slots
        const images = page.elements.filter(
          (el): el is ImageElement => el.type === 'image',
        );
        const assignments: Record<number, SlotAssignment> = {};
        images.forEach((img, i) => {
          if (i < layout.slots.length) {
            assignments[i] = { assetPath: img.src, offsetX: 0, offsetY: 0, scale: 1 };
          }
        });
        // Remove image elements (keep text)
        page.elements = page.elements.filter((el) => el.type !== 'image');
        page.slotAssignments = assignments;
      } else {
        // Switching between layouts: keep existing slot assignments
        page.slotAssignments = { ...(page.slotAssignments ?? {}) };
      }

      page.layoutId = layoutId;
      pages[state.currentPageIndex] = page;

      return {
        project: { ...state.project, pages },
        selectedElementId: null,
        selectedSlotIndex: null,
      };
    }),

  clearLayout: () =>
    set((state) => {
      const pages = [...state.project.pages];
      const page = { ...pages[state.currentPageIndex] };
      if (!page.layoutId) return state;

      const padding = page.layoutPadding ?? 20;
      const gap = page.layoutGap ?? 10;
      const slots = computeLayoutSlots(page.layoutId, padding, gap);

      // Convert slot assignments back to free ImageElements
      if (page.slotAssignments) {
        const newElements = [...page.elements];
        for (const [indexStr, slotData] of Object.entries(page.slotAssignments)) {
          const slotIndex = parseInt(indexStr, 10);
          const slot = slots[slotIndex];
          if (!slot) continue;
          const element: ImageElement = {
            id: uuidv4(),
            type: 'image',
            x: Math.round(slot.x),
            y: Math.round(slot.y),
            width: Math.round(slot.width),
            height: Math.round(slot.height),
            rotation: 0,
            zIndex: newElements.length,
            src: slotData.assetPath,
          };
          newElements.push(element);
        }
        page.elements = newElements;
      }

      delete page.layoutId;
      delete page.layoutPadding;
      delete page.layoutGap;
      delete page.slotAssignments;
      pages[state.currentPageIndex] = page;

      return {
        project: { ...state.project, pages },
        selectedSlotIndex: null,
        selectedElementId: null,
      };
    }),

  // --- Add image (slot-aware) ---

  addImageFromFile: async (file) => {
    const page = get().currentPage();
    if (!page) return;

    const id = uuidv4();
    const assetPath = `assets/${id}_${file.name}`;
    const blob = file.slice();

    if (page.layoutId) {
      // Layout mode: assign to slot
      const layout = getLayoutById(page.layoutId);
      if (!layout) return;

      let targetSlot = get().selectedSlotIndex;
      if (targetSlot === null) {
        // Find next empty slot
        const assignments = page.slotAssignments ?? {};
        const emptyIdx = layout.slots.findIndex((_, i) => !assignments[i]);
        if (emptyIdx === -1) return; // all slots full
        targetSlot = emptyIdx;
      }

      const finalSlot = targetSlot;
      set((state) => {
        const pages = [...state.project.pages];
        const p = { ...pages[state.currentPageIndex] };
        p.slotAssignments = { ...(p.slotAssignments ?? {}), [finalSlot]: { assetPath, offsetX: 0, offsetY: 0, scale: 1 } };
        pages[state.currentPageIndex] = p;
        return {
          project: { ...state.project, pages },
          assetBlobs: { ...state.assetBlobs, [assetPath]: blob },
          selectedSlotIndex: null,
        };
      });
    } else {
      // Free mode: create ImageElement
      const dimensions = await new Promise<{ w: number; h: number }>((resolve) => {
        const url = URL.createObjectURL(blob);
        const img = new window.Image();
        img.onload = () => {
          resolve({ w: img.naturalWidth, h: img.naturalHeight });
          URL.revokeObjectURL(url);
        };
        img.onerror = () => {
          resolve({ w: 300, h: 200 });
          URL.revokeObjectURL(url);
        };
        img.src = url;
      });

      let { w, h } = dimensions;
      if (w > CANVAS_IMAGE_MAX_W || h > CANVAS_IMAGE_MAX_H) {
        const scale = Math.min(CANVAS_IMAGE_MAX_W / w, CANVAS_IMAGE_MAX_H / h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }

      const element: ImageElement = {
        id,
        type: 'image',
        x: Math.round((CANVAS_W - w) / 2),
        y: Math.round((CANVAS_H - h) / 2),
        width: w,
        height: h,
        rotation: 0,
        zIndex: get().currentPage()?.elements.length ?? 0,
        src: assetPath,
      };

      get().addAsset(assetPath, blob);
      get().addElement(element);
    }
  },

  addImageFromAsset: async (assetPath) => {
    const page = get().currentPage();
    if (!page) return;

    const blob = get().assetBlobs[assetPath];
    if (!blob) return;

    if (page.layoutId) {
      const layout = getLayoutById(page.layoutId);
      if (!layout) return;

      let targetSlot = get().selectedSlotIndex;
      if (targetSlot === null) {
        const assignments = page.slotAssignments ?? {};
        const emptyIdx = layout.slots.findIndex((_, i) => !assignments[i]);
        if (emptyIdx === -1) return;
        targetSlot = emptyIdx;
      }

      const finalSlot = targetSlot;
      set((state) => {
        const pages = [...state.project.pages];
        const p = { ...pages[state.currentPageIndex] };
        p.slotAssignments = {
          ...(p.slotAssignments ?? {}),
          [finalSlot]: { assetPath, offsetX: 0, offsetY: 0, scale: 1 },
        };
        pages[state.currentPageIndex] = p;
        return {
          project: { ...state.project, pages },
          selectedSlotIndex: null,
          selectedElementId: null,
        };
      });
      return;
    }

    const dimensions = await new Promise<{ w: number; h: number }>((resolve) => {
      const url = URL.createObjectURL(blob);
      const img = new window.Image();
      img.onload = () => {
        resolve({ w: img.naturalWidth, h: img.naturalHeight });
        URL.revokeObjectURL(url);
      };
      img.onerror = () => {
        resolve({ w: 300, h: 200 });
        URL.revokeObjectURL(url);
      };
      img.src = url;
    });

    let { w, h } = dimensions;
    if (w > CANVAS_IMAGE_MAX_W || h > CANVAS_IMAGE_MAX_H) {
      const scale = Math.min(CANVAS_IMAGE_MAX_W / w, CANVAS_IMAGE_MAX_H / h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }

    const element: ImageElement = {
      id: uuidv4(),
      type: 'image',
      x: Math.round((CANVAS_W - w) / 2),
      y: Math.round((CANVAS_H - h) / 2),
      width: w,
      height: h,
      rotation: 0,
      zIndex: get().currentPage()?.elements.length ?? 0,
      src: assetPath,
    };

    get().addElement(element);
  },

  addTextElement: () => {
    const element: TextElement = {
      id: uuidv4(),
      type: 'text',
      x: 300,
      y: 260,
      rotation: 0,
      zIndex: get().currentPage()?.elements.length ?? 0,
      content: 'Text bearbeiten',
      fontSize: 24,
      fontFamily: 'Arial',
      color: '#000000',
    };
    get().addElement(element);
  },

  // --- File I/O ---

  saveCurrentProject: async () => {
    const { project, assetBlobs, fileHandle } = get();
    const newHandle = await saveProject(project, assetBlobs, fileHandle);
    if (newHandle && newHandle !== fileHandle) {
      set({ fileHandle: newHandle });
    }
  },

  saveCurrentProjectAs: async () => {
    const { project, assetBlobs } = get();
    const newHandle = await saveProjectAs(project, assetBlobs);
    if (newHandle) {
      set({ fileHandle: newHandle });
    }
  },

  openProject: async () => {
    const result = await showOpenDialog();
    if (result) {
      const { project, assetBlobs } = await loadProject(result.file);
      const normalizedProject = normalizeProject(project);
      set({
        project: normalizedProject,
        assetBlobs,
        currentPageIndex: 0,
        selectedElementId: null,
        selectedSlotIndex: null,
        fileHandle: result.handle,
        showEditor: true,
      });
      get().addRecentProject(normalizedProject.meta.name, result.handle.name);
      // Persist handle in IndexedDB for later re-open
      storeHandle(result.handle.name, result.handle as unknown as FileSystemFileHandle).catch(() => {});
    }
  },

  loadFromFile: async (file, handle) => {
    const { project, assetBlobs } = await loadProject(file);
    const normalizedProject = normalizeProject(project);
    set({
      project: normalizedProject,
      assetBlobs,
      currentPageIndex: 0,
      selectedElementId: null,
      selectedSlotIndex: null,
      fileHandle: handle ?? null,
      showEditor: true,
    });
    get().addRecentProject(normalizedProject.meta.name, handle?.name ?? file.name);
    // Persist handle in IndexedDB if available
    if (handle) {
      storeHandle(handle.name, handle as unknown as FileSystemFileHandle).catch(() => {});
    }
  },
}));

// Expose store globally for export utility
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).__layoxStore = useProjectStore;

export default useProjectStore;
