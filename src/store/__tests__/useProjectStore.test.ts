import { describe, it, expect, beforeEach, vi } from 'vitest';
import { v4 as uuidv4 } from 'uuid';

// Mock fileIO and browser APIs before importing the store
vi.mock('../../utils/fileIO', () => ({
  saveProject: vi.fn(),
  saveProjectAs: vi.fn(),
  loadProject: vi.fn(),
  showOpenDialog: vi.fn(),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

// Now import the store — it reads localStorage on init
const { default: useProjectStore } = await import('../../store/useProjectStore');

function getState() {
  return useProjectStore.getState();
}

describe('useProjectStore', () => {
  beforeEach(() => {
    localStorageMock.clear();
    // Reset store to default
    getState().resetProject('Test Project');
    // Clear history
    useProjectStore.setState({ historyPast: [], historyFuture: [] });
  });

  describe('initial state', () => {
    it('has a project with a name', () => {
      expect(getState().project.meta.name).toBe('Test Project');
    });

    it('starts on page index 0', () => {
      expect(getState().currentPageIndex).toBe(0);
    });

    it('has a cover page + regular page by default', () => {
      expect(getState().project.pages.length).toBe(2);
      expect(getState().project.pages[0].isCover).toBe(true);
    });

    it('has no selected element', () => {
      expect(getState().selectedElementId).toBeNull();
    });

    it('showEditor is true after reset', () => {
      expect(getState().showEditor).toBe(true);
    });
  });

  describe('project name', () => {
    it('setProjectName changes the project name', () => {
      getState().setProjectName('New Name');
      expect(getState().project.meta.name).toBe('New Name');
    });
  });

  describe('page management', () => {
    it('addPage adds a new page and sets it as current', () => {
      const before = getState().project.pages.length;
      getState().addPage();
      expect(getState().project.pages.length).toBe(before + 1);
      expect(getState().currentPageIndex).toBe(before);
    });

    it('removePage removes a page', () => {
      getState().addPage();
      const len = getState().project.pages.length;
      getState().removePage(len - 1);
      expect(getState().project.pages.length).toBe(len - 1);
    });

    it('removePage does not remove the last remaining page', () => {
      // Remove all but one
      while (getState().project.pages.length > 1) {
        getState().removePage(getState().project.pages.length - 1);
      }
      getState().removePage(0);
      expect(getState().project.pages.length).toBe(1);
    });

    it('setCurrentPageIndex changes the current page', () => {
      getState().addPage();
      getState().setCurrentPageIndex(0);
      expect(getState().currentPageIndex).toBe(0);
      getState().setCurrentPageIndex(1);
      expect(getState().currentPageIndex).toBe(1);
    });

    it('removing current page adjusts index', () => {
      getState().addPage(); // 3 pages
      getState().setCurrentPageIndex(2);
      getState().removePage(2);
      expect(getState().currentPageIndex).toBeLessThanOrEqual(getState().project.pages.length - 1);
    });
  });

  describe('element CRUD', () => {
    it('addElement adds an element to the current page', () => {
      getState().setCurrentPageIndex(1); // non-cover page
      const el = {
        id: uuidv4(),
        type: 'text' as const,
        x: 100,
        y: 100,
        rotation: 0,
        zIndex: 0,
        content: 'Hello',
        fontSize: 24,
        fontFamily: 'Arial',
        color: '#000000',
      };
      getState().addElement(el);
      const page = getState().project.pages[1];
      expect(page.elements).toHaveLength(1);
      expect(page.elements[0].id).toBe(el.id);
    });

    it('addElement selects the new element', () => {
      getState().setCurrentPageIndex(1);
      const id = uuidv4();
      getState().addElement({
        id,
        type: 'text',
        x: 0,
        y: 0,
        rotation: 0,
        zIndex: 0,
        content: 'Test',
        fontSize: 16,
        fontFamily: 'Arial',
        color: '#000',
      });
      expect(getState().selectedElementId).toBe(id);
    });

    it('updateElement changes element properties', () => {
      getState().setCurrentPageIndex(1);
      const id = uuidv4();
      getState().addElement({
        id,
        type: 'text',
        x: 0,
        y: 0,
        rotation: 0,
        zIndex: 0,
        content: 'Test',
        fontSize: 16,
        fontFamily: 'Arial',
        color: '#000',
      });
      getState().updateElement(id, { content: 'Updated' });
      const page = getState().project.pages[1];
      const el = page.elements.find((e) => e.id === id);
      expect(el).toBeDefined();
      expect((el as any).content).toBe('Updated');
    });

    it('removeElement removes the element', () => {
      getState().setCurrentPageIndex(1);
      const id = uuidv4();
      getState().addElement({
        id,
        type: 'text',
        x: 0,
        y: 0,
        rotation: 0,
        zIndex: 0,
        content: 'Test',
        fontSize: 16,
        fontFamily: 'Arial',
        color: '#000',
      });
      expect(getState().project.pages[1].elements).toHaveLength(1);
      getState().removeElement(id);
      expect(getState().project.pages[1].elements).toHaveLength(0);
    });

    it('removeElement deselects if the removed element was selected', () => {
      getState().setCurrentPageIndex(1);
      const id = uuidv4();
      getState().addElement({
        id,
        type: 'text',
        x: 0,
        y: 0,
        rotation: 0,
        zIndex: 0,
        content: 'Test',
        fontSize: 16,
        fontFamily: 'Arial',
        color: '#000',
      });
      expect(getState().selectedElementId).toBe(id);
      getState().removeElement(id);
      expect(getState().selectedElementId).toBeNull();
    });
  });

  describe('selection', () => {
    it('setSelectedElementId clears slot selection', () => {
      useProjectStore.setState({ selectedSlotIndex: 0 });
      getState().setSelectedElementId('some-id');
      expect(getState().selectedSlotIndex).toBeNull();
    });

    it('setSelectedSlotIndex clears element selection', () => {
      useProjectStore.setState({ selectedElementId: 'some-id' });
      getState().setSelectedSlotIndex(0);
      expect(getState().selectedElementId).toBeNull();
    });
  });

  describe('undo/redo', () => {
    it('snapshot captures current state for undo', () => {
      expect(getState().historyPast).toHaveLength(0);
      getState().snapshot();
      expect(getState().historyPast).toHaveLength(1);
    });

    it('undo restores previous state', () => {
      const originalName = getState().project.meta.name;
      getState().snapshot();
      getState().setProjectName('Changed');
      expect(getState().project.meta.name).toBe('Changed');
      getState().undo();
      expect(getState().project.meta.name).toBe(originalName);
    });

    it('redo restores undone state', () => {
      getState().snapshot();
      getState().setProjectName('Changed');
      getState().snapshot();
      getState().setProjectName('Changed Again');
      getState().undo();
      expect(getState().project.meta.name).toBe('Changed');
      getState().redo();
      expect(getState().project.meta.name).toBe('Changed Again');
    });

    it('undo with empty history does nothing', () => {
      const nameBefore = getState().project.meta.name;
      getState().undo();
      expect(getState().project.meta.name).toBe(nameBefore);
    });

    it('redo with empty future does nothing', () => {
      const nameBefore = getState().project.meta.name;
      getState().redo();
      expect(getState().project.meta.name).toBe(nameBefore);
    });

    it('snapshot after undo clears the redo future', () => {
      getState().snapshot();
      getState().setProjectName('V1');
      getState().snapshot();
      getState().setProjectName('V2');
      getState().undo();
      expect(getState().historyFuture).toHaveLength(1);
      getState().snapshot();
      expect(getState().historyFuture).toHaveLength(0);
    });

    it('history is capped at 50 entries', () => {
      for (let i = 0; i < 60; i++) {
        getState().snapshot();
        getState().setProjectName(`V${i}`);
      }
      expect(getState().historyPast.length).toBeLessThanOrEqual(50);
    });
  });

  describe('cover page', () => {
    it('toggleCover sets isCover on current page', () => {
      getState().setCurrentPageIndex(1);
      getState().toggleCover(true);
      expect(getState().project.pages[1].isCover).toBe(true);
    });

    it('toggleCover sets coverTitle from project name if not set', () => {
      getState().setCurrentPageIndex(1);
      getState().toggleCover(true);
      expect(getState().project.pages[1].coverTitle).toBe(getState().project.meta.name);
    });

    it('addCoverPage inserts a cover at the beginning', () => {
      const pagesBefore = getState().project.pages.length;
      getState().addCoverPage();
      expect(getState().project.pages.length).toBe(pagesBefore + 1);
      expect(getState().project.pages[0].isCover).toBe(true);
      expect(getState().currentPageIndex).toBe(0);
    });

    it('setCoverTitle updates the cover title', () => {
      getState().setCurrentPageIndex(0); // cover page
      getState().setCoverTitle('Mein Album');
      expect(getState().project.pages[0].coverTitle).toBe('Mein Album');
    });

    it('setCoverSubtitle updates the cover subtitle', () => {
      getState().setCurrentPageIndex(0);
      getState().setCoverSubtitle('2024');
      expect(getState().project.pages[0].coverSubtitle).toBe('2024');
    });
  });

  describe('layout', () => {
    it('applyLayout sets layoutId on the page', () => {
      getState().setCurrentPageIndex(1);
      getState().applyLayout('two-side');
      expect(getState().project.pages[1].layoutId).toBe('two-side');
    });

    it('applyLayout from free mode converts images to slot assignments', () => {
      getState().setCurrentPageIndex(1);
      // Add an image element
      getState().addElement({
        id: uuidv4(),
        type: 'image',
        x: 50,
        y: 50,
        width: 200,
        height: 150,
        rotation: 0,
        zIndex: 0,
        src: 'assets/img1.jpg',
      });
      expect(getState().project.pages[1].elements).toHaveLength(1);

      getState().applyLayout('single');
      const page = getState().project.pages[1];
      // Image elements removed, assigned to slots
      expect(page.elements.filter((e) => e.type === 'image')).toHaveLength(0);
      expect(page.slotAssignments).toBeDefined();
      expect(page.slotAssignments![0]).toBeDefined();
      expect(page.slotAssignments![0].assetPath).toBe('assets/img1.jpg');
    });

    it('clearLayout converts slot assignments back to elements', () => {
      getState().setCurrentPageIndex(1);
      getState().applyLayout('single');
      // Add a slot assignment
      const pages = [...getState().project.pages];
      const page = { ...pages[1] };
      page.slotAssignments = {
        0: { assetPath: 'assets/test.jpg', offsetX: 0, offsetY: 0, scale: 1 },
      };
      pages[1] = page;
      useProjectStore.setState({ project: { ...getState().project, pages } });

      getState().clearLayout();
      const updatedPage = getState().project.pages[1];
      expect(updatedPage.layoutId).toBeUndefined();
      expect(updatedPage.slotAssignments).toBeUndefined();
      expect(updatedPage.elements.filter((e) => e.type === 'image')).toHaveLength(1);
    });
  });

  describe('layout padding & gap', () => {
    it('setLayoutPadding updates the page', () => {
      getState().setCurrentPageIndex(1);
      getState().setLayoutPadding(30);
      expect(getState().project.pages[1].layoutPadding).toBe(30);
    });

    it('setLayoutGap updates the page', () => {
      getState().setCurrentPageIndex(1);
      getState().setLayoutGap(15);
      expect(getState().project.pages[1].layoutGap).toBe(15);
    });
  });

  describe('slot management', () => {
    beforeEach(() => {
      getState().setCurrentPageIndex(1);
      getState().applyLayout('single');
      // Assign an image to slot 0
      const pages = [...getState().project.pages];
      const page = { ...pages[1] };
      page.slotAssignments = {
        0: { assetPath: 'assets/test.jpg', offsetX: 0, offsetY: 0, scale: 1 },
      };
      pages[1] = page;
      useProjectStore.setState({ project: { ...getState().project, pages } });
    });

    it('removeImageFromSlot removes the assignment', () => {
      getState().removeImageFromSlot(0);
      expect(getState().project.pages[1].slotAssignments![0]).toBeUndefined();
    });

    it('updateSlotOffset changes offset', () => {
      getState().updateSlotOffset(0, 10, 20);
      expect(getState().project.pages[1].slotAssignments![0].offsetX).toBe(10);
      expect(getState().project.pages[1].slotAssignments![0].offsetY).toBe(20);
    });

    it('updateSlotScale changes scale', () => {
      getState().updateSlotScale(0, 1.5);
      expect(getState().project.pages[1].slotAssignments![0].scale).toBe(1.5);
    });

    it('updateSlotCrop sets crop values', () => {
      getState().updateSlotCrop(0, 10, 20, 100, 80);
      const assignment = getState().project.pages[1].slotAssignments![0];
      expect(assignment.cropX).toBe(10);
      expect(assignment.cropY).toBe(20);
      expect(assignment.cropW).toBe(100);
      expect(assignment.cropH).toBe(80);
    });

    it('clearSlotCrop removes crop values', () => {
      getState().updateSlotCrop(0, 10, 20, 100, 80);
      getState().clearSlotCrop(0);
      const assignment = getState().project.pages[1].slotAssignments![0];
      expect(assignment.cropX).toBeUndefined();
      expect(assignment.cropY).toBeUndefined();
      expect(assignment.cropW).toBeUndefined();
      expect(assignment.cropH).toBeUndefined();
    });
  });

  describe('auto-save settings', () => {
    it('setAutoSaveEnabled persists to localStorage', () => {
      getState().setAutoSaveEnabled(true);
      expect(getState().autoSaveEnabled).toBe(true);
      expect(localStorageMock.getItem('layox_autoSaveEnabled')).toBe('true');
    });

    it('setAutoSaveInterval persists to localStorage', () => {
      getState().setAutoSaveInterval(60);
      expect(getState().autoSaveInterval).toBe(60);
      expect(localStorageMock.getItem('layox_autoSaveInterval')).toBe('60');
    });
  });

  describe('recent projects', () => {
    it('addRecentProject adds to list', () => {
      getState().addRecentProject('Test', 'test.layox');
      expect(getState().recentProjects).toHaveLength(1);
      expect(getState().recentProjects[0].name).toBe('Test');
    });

    it('addRecentProject deduplicates by fileName', () => {
      getState().addRecentProject('Test', 'test.layox');
      getState().addRecentProject('Test Updated', 'test.layox');
      expect(getState().recentProjects).toHaveLength(1);
      expect(getState().recentProjects[0].name).toBe('Test Updated');
    });

    it('addRecentProject caps at 10 entries', () => {
      for (let i = 0; i < 15; i++) {
        getState().addRecentProject(`Project ${i}`, `file${i}.layox`);
      }
      expect(getState().recentProjects.length).toBeLessThanOrEqual(10);
    });

    it('most recent is at the top', () => {
      getState().addRecentProject('First', 'first.layox');
      getState().addRecentProject('Second', 'second.layox');
      expect(getState().recentProjects[0].name).toBe('Second');
    });
  });

  describe('asset management', () => {
    it('addAsset stores a blob', () => {
      const blob = new Blob(['test'], { type: 'text/plain' });
      getState().addAsset('assets/test.txt', blob);
      expect(getState().assetBlobs['assets/test.txt']).toBe(blob);
    });
  });
});
