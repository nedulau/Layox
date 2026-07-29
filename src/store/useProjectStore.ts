import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { Project, Page, PageElement, ImageElement, TextElement, SlotAssignment } from '../types';
import { loadProject } from '../utils/fileIO';
import { getLayoutById, computeLayoutSlots } from '../utils/layouts';
import { storeHandle } from '../utils/handleStore';
import { CANVAS_H, CANVAS_IMAGE_MAX_H, CANVAS_IMAGE_MAX_W, CANVAS_W } from '../constants/canvas';
import { readStoredBoolean, readStoredJson, readStoredNumber, writeStoredString } from '../infra/storage';
import { getFileSystemPort } from '../infra/fileSystem';
import type { ProjectLocation, SaveOutcome } from '../infra/ports/fileSystemPort';
import {
  createCoverPage,
  createDefaultProject,
  createEmptyPage,
  DEFAULT_LAYOUT_GAP,
  DEFAULT_LAYOUT_PADDING,
  DEFAULT_TEXT_COLOR,
  DEFAULT_TEXT_FONT_FAMILY,
  DEFAULT_TEXT_FONT_SIZE,
  normalizeProject,
} from '../domain/projectDefaults';
import {
  addElementAt,
  appendPage,
  collectUsedAssetPaths,
  duplicatePageAt,
  movePageAt,
  pruneUnusedAssetBlobs,
  removeElementAt,
  removePageAt,
  renameProject,
  updateElementAt,
} from '../domain/projectOperations';
import { createSaveCoordinator } from '../services/saveCoordinator';
const fileSystemPort = getFileSystemPort();

interface RecentProject {
  name: string;
  fileName: string;
  filePath?: string;
  lastOpened: number; // timestamp
}

export type { RecentProject };

export interface AddImageResult {
  assetPath: string;
  placement: 'placed' | 'library-only';
}

interface HistoryEntry {
  project: Project;
  assetBlobs: Record<string, Blob>;
}

interface ProjectState {
  project: Project;
  currentPageIndex: number;
  assetBlobs: Record<string, Blob>;
  selectedElementId: string | null;
  selectedSlotIndex: number | null;
  projectLocation: ProjectLocation | null;
  revision: number;
  savedRevision: number;
  isDirty: boolean;
  isSaving: boolean;
  saveError: string | null;
  autoSaveEnabled: boolean;
  autoSaveInterval: number; // seconds
  showEditor: boolean;
  recentProjects: RecentProject[];

  currentPage: () => Page | undefined;

  setProject: (project: Project) => void;
  restoreRecoveredProject: (project: Project, assetBlobs: Record<string, Blob>, pageIndex: number) => void;
  setProjectName: (name: string) => void;
  addAsset: (path: string, blob: Blob) => void;
  resetProject: (name?: string) => void;
  setAutoSaveEnabled: (enabled: boolean) => void;
  setAutoSaveInterval: (seconds: number) => void;
  setShowEditor: (show: boolean) => void;
  addRecentProject: (name: string, fileName: string, filePath?: string) => void;
  removeRecentProject: (fileName: string, filePath?: string) => void;
  openRecentProjectByPath: (filePath: string) => Promise<boolean>;

  setCurrentPageIndex: (index: number) => void;
  addPage: () => void;
  removePage: (index: number) => void;
  movePage: (fromIndex: number, toIndex: number) => void;
  duplicatePage: (index: number) => void;

  addElement: (element: PageElement) => void;
  updateElement: (elementId: string, changes: Partial<PageElement>) => void;
  removeElement: (elementId: string) => void;
  setSelectedElementId: (id: string | null) => void;
  setSelectedSlotIndex: (index: number | null) => void;

  addImageFromFile: (file: File) => Promise<AddImageResult>;
  addImageFromAsset: (assetPath: string) => Promise<void>;
  removeAsset: (assetPath: string) => boolean;
  pruneUnusedAssets: () => void;
  addTextElement: () => void;
  removeImageFromSlot: (slotIndex: number) => void;
  updateSlotOffset: (slotIndex: number, offsetX: number, offsetY: number) => void;
  updateSlotScale: (slotIndex: number, scale: number) => void;
  updateSlotCrop: (slotIndex: number, cropX: number, cropY: number, cropW: number, cropH: number) => void;
  clearSlotCrop: (slotIndex: number) => void;
  setLayoutPadding: (padding: number) => void;
  setLayoutGap: (gap: number) => void;
  setPageBackground: (color: string) => void;
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

  saveCurrentProject: () => Promise<SaveOutcome>;
  saveCurrentProjectAs: () => Promise<SaveOutcome>;
  openProject: () => Promise<void>;
  loadFromFile: (file: File, location?: ProjectLocation | null) => Promise<void>;

  historyPast: HistoryEntry[];
  historyFuture: HistoryEntry[];
  snapshot: () => void;
  undo: () => void;
  redo: () => void;
}

type ProjectStateUpdate =
  | Partial<ProjectState>
  | ProjectState
  | ((state: ProjectState) => Partial<ProjectState> | ProjectState);

const useProjectStore = create<ProjectState>((baseSet, get) => {
  const set = (update: ProjectStateUpdate): void => {
    baseSet((state) => {
      const partial = typeof update === 'function' ? update(state) : update;
      if (partial === state) return state;
      if (
        ((partial.project !== undefined && partial.project !== state.project) ||
          (partial.assetBlobs !== undefined && partial.assetBlobs !== state.assetBlobs)) &&
        partial.revision === undefined &&
        partial.isDirty === undefined
      ) {
        return {
          ...partial,
          revision: state.revision + 1,
          isDirty: true,
        };
      }
      return partial;
    });
  };

  const runSave = createSaveCoordinator({
    fileSystemPort,
    getState: get,
    updateSaveState: (patch) => set(patch),
    onSavedProject: ({ projectName, fileName, filePath }) => {
      get().addRecentProject(projectName, fileName, filePath);
    },
  });

  return ({
  project: createDefaultProject(),
  currentPageIndex: 0,
  assetBlobs: {},
  selectedElementId: null,
  selectedSlotIndex: null,
  projectLocation: null,
  revision: 0,
  savedRevision: 0,
  isDirty: false,
  isSaving: false,
  saveError: null,
  autoSaveEnabled: readStoredBoolean('layox_autoSaveEnabled', false),
  autoSaveInterval: readStoredNumber('layox_autoSaveInterval', 30),
  showEditor: false,
  recentProjects: readStoredJson<RecentProject[]>('layox_recentProjects', []),
  historyPast: [],
  historyFuture: [],

  currentPage: () => {
    const { project, currentPageIndex } = get();
    return project.pages[currentPageIndex];
  },

  setProject: (project) =>
    set({ project: normalizeProject(project), currentPageIndex: 0, selectedElementId: null, selectedSlotIndex: null }),

  restoreRecoveredProject: (project, assetBlobs, pageIndex) =>
    set((state) => {
      const recoveredCopy = normalizeProject(structuredClone(project));
      recoveredCopy.meta.id = uuidv4();
      return {
        project: recoveredCopy,
        assetBlobs,
        currentPageIndex: Math.max(0, Math.min(pageIndex, project.pages.length - 1)),
        selectedElementId: null,
        selectedSlotIndex: null,
        projectLocation: null,
        revision: state.revision + 1,
        savedRevision: state.savedRevision,
        isDirty: true,
        isSaving: false,
        saveError: null,
        showEditor: true,
        historyPast: [],
        historyFuture: [],
      };
    }),

  setProjectName: (name) =>
    set((state) => ({ project: renameProject(state.project, name) })),

  addAsset: (path, blob) =>
    set((state) => ({
      assetBlobs: { ...state.assetBlobs, [path]: blob },
    })),

  resetProject: (name) => {
    const projectName = name || 'Untitled Project';
    set({
      project: createDefaultProject(projectName),
      currentPageIndex: 0,
      assetBlobs: {},
      selectedElementId: null,
      selectedSlotIndex: null,
      projectLocation: null,
      revision: 1,
      savedRevision: 0,
      isDirty: true,
      isSaving: false,
      saveError: null,
      historyPast: [],
      historyFuture: [],
      showEditor: true,
    });
  },

  setAutoSaveEnabled: (enabled) => {
    writeStoredString('layox_autoSaveEnabled', String(enabled));
    set({ autoSaveEnabled: enabled });
  },

  setAutoSaveInterval: (seconds) => {
    writeStoredString('layox_autoSaveInterval', String(seconds));
    set({ autoSaveInterval: seconds });
  },

  setShowEditor: (show) => set({ showEditor: show }),

  addRecentProject: (name, fileName, filePath) => {
    const recents = get().recentProjects.filter((r) => {
      if (filePath && r.filePath) return r.filePath !== filePath;
      return r.fileName !== fileName;
    });
    recents.unshift({ name, fileName, filePath, lastOpened: Date.now() });
    const trimmed = recents.slice(0, 10);
    writeStoredString('layox_recentProjects', JSON.stringify(trimmed));
    set({ recentProjects: trimmed });
  },

  removeRecentProject: (fileName, filePath) => {
    const recentProjects = get().recentProjects.filter((recent) => (
      filePath && recent.filePath
        ? recent.filePath !== filePath
        : recent.fileName !== fileName
    ));
    writeStoredString('layox_recentProjects', JSON.stringify(recentProjects));
    set({ recentProjects });
  },

  openRecentProjectByPath: async (filePath) => {
    const result = await fileSystemPort.openProjectFromPath(filePath);
    if (!result) return false;

    const { project, assetBlobs } = await loadProject(result.file);
    const normalizedProject = normalizeProject(project);
    set({
      project: normalizedProject,
      assetBlobs,
      currentPageIndex: 0,
      selectedElementId: null,
      selectedSlotIndex: null,
      projectLocation: result.location,
      revision: 0,
      savedRevision: 0,
      isDirty: false,
      isSaving: false,
      saveError: null,
      showEditor: true,
    });
    const recentPath = result.location?.kind === 'native-path' ? result.location.filePath : undefined;
    get().addRecentProject(normalizedProject.meta.name, result.file.name, recentPath);
    return true;
  },

  snapshot: () => {
    const { project, assetBlobs, historyPast } = get();
    const entry: HistoryEntry = {
      project: JSON.parse(JSON.stringify(project)) as Project,
      assetBlobs: { ...assetBlobs },
    };
    set({
      historyPast: [...historyPast, entry].slice(-50),
      historyFuture: [],
    });
  },

  undo: () => {
    const { historyPast, historyFuture, project, assetBlobs } = get();
    if (historyPast.length === 0) return;
    const prev = historyPast[historyPast.length - 1];
    const currentEntry: HistoryEntry = {
      project: JSON.parse(JSON.stringify(project)) as Project,
      assetBlobs: { ...assetBlobs },
    };
    set({
      historyPast: historyPast.slice(0, -1),
      historyFuture: [currentEntry, ...historyFuture].slice(0, 50),
      project: prev.project,
      assetBlobs: prev.assetBlobs,
      selectedElementId: null,
      selectedSlotIndex: null,
    });
  },

  redo: () => {
    const { historyPast, historyFuture, project, assetBlobs } = get();
    if (historyFuture.length === 0) return;
    const next = historyFuture[0];
    const currentEntry: HistoryEntry = {
      project: JSON.parse(JSON.stringify(project)) as Project,
      assetBlobs: { ...assetBlobs },
    };
    set({
      historyPast: [...historyPast, currentEntry],
      historyFuture: historyFuture.slice(1),
      project: next.project,
      assetBlobs: next.assetBlobs,
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
      const project = appendPage(state.project, newPage);
      return {
        project,
        currentPageIndex: project.pages.length - 1,
        selectedElementId: null,
        selectedSlotIndex: null,
      };
    }),

  removePage: (index) =>
    set((state) => {
      const project = removePageAt(state.project, index);
      if (project === state.project) return state;
      const newIndex = Math.min(state.currentPageIndex, project.pages.length - 1);
      return {
        project,
        currentPageIndex: newIndex,
        selectedElementId: null,
        selectedSlotIndex: null,
      };
    }),

  movePage: (fromIndex, toIndex) =>
    set((state) => {
      const moved = movePageAt(state.project, fromIndex, toIndex, state.currentPageIndex);
      if (moved.project === state.project) return state;

      return {
        project: moved.project,
        currentPageIndex: moved.currentPageIndex,
        selectedElementId: null,
        selectedSlotIndex: null,
      };
    }),

  duplicatePage: (index) =>
    set((state) => {
      const result = duplicatePageAt(state.project, index, uuidv4);
      if (result.project === state.project) return state;
      return {
        project: result.project,
        currentPageIndex: result.pageIndex,
        selectedElementId: null,
        selectedSlotIndex: null,
      };
    }),

  // --- Element CRUD ---

  addElement: (element) =>
    set((state) => ({
      project: addElementAt(state.project, state.currentPageIndex, element),
      selectedElementId: element.id,
    })),

  updateElement: (elementId, changes) =>
    set((state) => ({
      project: updateElementAt(state.project, state.currentPageIndex, elementId, changes),
    })),

  removeElement: (elementId) =>
    set((state) => ({
      project: removeElementAt(state.project, state.currentPageIndex, elementId),
      selectedElementId: state.selectedElementId === elementId ? null : state.selectedElementId,
    })),

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

  setPageBackground: (color) =>
    set((state) => {
      const pages = [...state.project.pages];
      const page = pages[state.currentPageIndex];
      if (!page || page.background === color) return state;
      pages[state.currentPageIndex] = { ...page, background: color };
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
      const coverPage = createCoverPage(state.project.meta.name);
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

      const padding = page.layoutPadding ?? DEFAULT_LAYOUT_PADDING;
      const gap = page.layoutGap ?? DEFAULT_LAYOUT_GAP;
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
    if (!page) throw new Error('No active page.');

    const id = uuidv4();
    const safeFileName = file.name
      .replace(/\.\.+/g, '.')
      .replace(/[^\p{L}\p{N}._ -]/gu, '_')
      .slice(0, 240) || 'image';
    const assetPath = `assets/${id}_${safeFileName}`;
    const blob = file.slice();

    if (page.layoutId) {
      // Layout mode: assign to slot
      const layout = getLayoutById(page.layoutId);
      if (!layout) {
        set((state) => ({ assetBlobs: { ...state.assetBlobs, [assetPath]: blob } }));
        return { assetPath, placement: 'library-only' };
      }

      let targetSlot = get().selectedSlotIndex;
      if (targetSlot === null) {
        // Find next empty slot
        const assignments = page.slotAssignments ?? {};
        const emptyIdx = layout.slots.findIndex((_, i) => !assignments[i]);
        if (emptyIdx === -1) {
          set((state) => ({ assetBlobs: { ...state.assetBlobs, [assetPath]: blob } }));
          return { assetPath, placement: 'library-only' };
        }
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
      return { assetPath, placement: 'placed' };
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

      set((state) => {
        const pages = [...state.project.pages];
        const current = pages[state.currentPageIndex];
        if (!current) return state;
        pages[state.currentPageIndex] = {
          ...current,
          elements: [...current.elements, element],
        };
        return {
          project: { ...state.project, pages },
          assetBlobs: { ...state.assetBlobs, [assetPath]: blob },
          selectedElementId: element.id,
          selectedSlotIndex: null,
        };
      });
      return { assetPath, placement: 'placed' };
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

  removeAsset: (assetPath) => {
    if (collectUsedAssetPaths(get().project).has(assetPath)) return false;
    if (!get().assetBlobs[assetPath]) return false;
    set((state) => {
      const nextAssets = { ...state.assetBlobs };
      delete nextAssets[assetPath];
      return { assetBlobs: nextAssets };
    });
    return true;
  },

  pruneUnusedAssets: () =>
    set((state) => ({
      assetBlobs: pruneUnusedAssetBlobs(state.project, state.assetBlobs),
    })),

  addTextElement: () => {
    const element: TextElement = {
      id: uuidv4(),
      type: 'text',
      x: 300,
      y: 260,
      rotation: 0,
      zIndex: get().currentPage()?.elements.length ?? 0,
      content: 'Edit text',
      fontSize: DEFAULT_TEXT_FONT_SIZE,
      fontFamily: DEFAULT_TEXT_FONT_FAMILY,
      color: DEFAULT_TEXT_COLOR,
    };
    get().addElement(element);
  },

  // --- File I/O ---

  saveCurrentProject: () => runSave(false),

  saveCurrentProjectAs: () => runSave(true),

  openProject: async () => {
    const result = await fileSystemPort.openProjectDialog();
    if (result) {
      const { project, assetBlobs } = await loadProject(result.file);
      const normalizedProject = normalizeProject(project);
      set({
        project: normalizedProject,
        assetBlobs,
        currentPageIndex: 0,
        selectedElementId: null,
        selectedSlotIndex: null,
        projectLocation: result.location,
        revision: 0,
        savedRevision: 0,
        isDirty: false,
        isSaving: false,
        saveError: null,
        historyPast: [],
        historyFuture: [],
        showEditor: true,
      });
      const handle = result.location?.kind === 'web-handle' ? result.location.handle : null;
      const filePath = result.location?.kind === 'native-path' ? result.location.filePath : undefined;
      get().addRecentProject(normalizedProject.meta.name, handle?.name ?? result.file.name, filePath);
      // Persist handle in IndexedDB for later re-open
      if (handle) {
        storeHandle(handle.name, handle as unknown as FileSystemFileHandle).catch(() => {});
      }
    }
  },

  loadFromFile: async (file, location) => {
    const { project, assetBlobs } = await loadProject(file);
    const normalizedProject = normalizeProject(project);
    set({
      project: normalizedProject,
      assetBlobs,
      currentPageIndex: 0,
      selectedElementId: null,
      selectedSlotIndex: null,
      projectLocation: location ?? null,
      revision: 0,
      savedRevision: 0,
      isDirty: false,
      isSaving: false,
      saveError: null,
      historyPast: [],
      historyFuture: [],
      showEditor: true,
    });
    const handle = location?.kind === 'web-handle' ? location.handle : null;
    const filePath = location?.kind === 'native-path' ? location.filePath : undefined;
    get().addRecentProject(normalizedProject.meta.name, handle?.name ?? file.name, filePath);
    // Persist handle in IndexedDB if available
    if (handle) {
      storeHandle(handle.name, handle as unknown as FileSystemFileHandle).catch(() => {});
    }
  },
  });
});

export default useProjectStore;
