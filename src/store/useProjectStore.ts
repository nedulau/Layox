import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { Project, Page, PageElement, ImageElement, TextElement, FileSystemFileHandleExt } from '../types';
import { saveProject, saveProjectAs, loadProject, showOpenDialog } from '../utils/fileIO';
import { getLayoutById } from '../utils/layouts';

function createEmptyPage(): Page {
  return {
    id: uuidv4(),
    elements: [],
    background: '#ffffff',
  };
}

function createDefaultProject(): Project {
  return {
    meta: { name: 'Unbenanntes Projekt', version: '1.0' },
    pages: [createEmptyPage()],
  };
}

interface ProjectState {
  project: Project;
  currentPageIndex: number;
  assetBlobs: Record<string, Blob>;
  selectedElementId: string | null;
  fileHandle: FileSystemFileHandleExt | null;

  // Getters
  currentPage: () => Page | undefined;

  // Project mutations
  setProject: (project: Project) => void;
  addAsset: (path: string, blob: Blob) => void;
  resetProject: () => void;

  // Page management
  setCurrentPageIndex: (index: number) => void;
  addPage: () => void;
  removePage: (index: number) => void;

  // Element CRUD
  addElement: (element: PageElement) => void;
  updateElement: (elementId: string, changes: Partial<PageElement>) => void;
  removeElement: (elementId: string) => void;
  setSelectedElementId: (id: string | null) => void;

  // Convenience: add image from file
  addImageFromFile: (file: File) => Promise<void>;
  addTextElement: () => void;

  // Layout
  applyLayout: (layoutId: string) => void;

  // File I/O
  saveCurrentProject: () => Promise<void>;
  saveCurrentProjectAs: () => Promise<void>;
  openProject: () => Promise<void>;
  loadFromFile: (file: File, handle?: FileSystemFileHandleExt | null) => Promise<void>;
}

const useProjectStore = create<ProjectState>((set, get) => ({
  project: createDefaultProject(),
  currentPageIndex: 0,
  assetBlobs: {},
  selectedElementId: null,
  fileHandle: null,

  currentPage: () => {
    const { project, currentPageIndex } = get();
    return project.pages[currentPageIndex];
  },

  setProject: (project) => set({ project, currentPageIndex: 0, selectedElementId: null }),

  addAsset: (path, blob) =>
    set((state) => ({
      assetBlobs: { ...state.assetBlobs, [path]: blob },
    })),

  resetProject: () =>
    set({
      project: createDefaultProject(),
      currentPageIndex: 0,
      assetBlobs: {},
      selectedElementId: null,
      fileHandle: null,
    }),

  setCurrentPageIndex: (index) => set({ currentPageIndex: index, selectedElementId: null }),

  // --- Page management ---

  addPage: () =>
    set((state) => {
      const newPage = createEmptyPage();
      const newPages = [...state.project.pages, newPage];
      return {
        project: { ...state.project, pages: newPages },
        currentPageIndex: newPages.length - 1,
        selectedElementId: null,
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

  setSelectedElementId: (id) => set({ selectedElementId: id }),

  // --- Layout ---

  applyLayout: (layoutId) =>
    set((state) => {
      const layout = getLayoutById(layoutId);
      if (!layout) return state;

      const pages = [...state.project.pages];
      const page = { ...pages[state.currentPageIndex] };

      // Gather image elements (preserve order)
      const images = page.elements.filter((el): el is ImageElement => el.type === 'image');
      const others = page.elements.filter((el) => el.type !== 'image');

      // Assign images to layout slots
      const updatedImages = images.map((img, i) => {
        if (i >= layout.slots.length) return img; // no slot → keep position
        const slot = layout.slots[i];
        return {
          ...img,
          x: Math.round(slot.x),
          y: Math.round(slot.y),
          width: Math.round(slot.width),
          height: Math.round(slot.height),
          rotation: 0,
        };
      });

      page.elements = [...others, ...updatedImages];
      page.layoutId = layoutId;
      pages[state.currentPageIndex] = page;

      return {
        project: { ...state.project, pages },
        selectedElementId: null,
      };
    }),

  // --- Convenience: add image from file picker ---

  addImageFromFile: async (file) => {
    const id = uuidv4();
    const assetPath = `assets/${id}_${file.name}`;
    const blob = file.slice();

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

    const maxW = 600;
    const maxH = 450;
    let { w, h } = dimensions;
    if (w > maxW || h > maxH) {
      const scale = Math.min(maxW / w, maxH / h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }

    const element: ImageElement = {
      id,
      type: 'image',
      x: Math.round((800 - w) / 2),
      y: Math.round((600 - h) / 2),
      width: w,
      height: h,
      rotation: 0,
      zIndex: get().currentPage()?.elements.length ?? 0,
      src: assetPath,
    };

    get().addAsset(assetPath, blob);
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
      set({
        project,
        assetBlobs,
        currentPageIndex: 0,
        selectedElementId: null,
        fileHandle: result.handle,
      });
    }
  },

  loadFromFile: async (file, handle) => {
    const { project, assetBlobs } = await loadProject(file);
    set({
      project,
      assetBlobs,
      currentPageIndex: 0,
      selectedElementId: null,
      fileHandle: handle ?? null,
    });
  },
}));

export default useProjectStore;
