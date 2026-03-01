import { useRef, useEffect } from 'react';
import './index.css';
import EditorCanvas from './components/canvas/EditorCanvas';
import LayoutPicker from './components/LayoutPicker';
import useProjectStore from './store/useProjectStore';

function App() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const saveCurrentProject = useProjectStore((s) => s.saveCurrentProject);
  const saveCurrentProjectAs = useProjectStore((s) => s.saveCurrentProjectAs);
  const openProject = useProjectStore((s) => s.openProject);
  const loadFromFile = useProjectStore((s) => s.loadFromFile);
  const resetProject = useProjectStore((s) => s.resetProject);
  const setProjectName = useProjectStore((s) => s.setProjectName);
  const projectName = useProjectStore((s) => s.project.meta.name);
  const fileHandle = useProjectStore((s) => s.fileHandle);

  const addImageFromFile = useProjectStore((s) => s.addImageFromFile);
  const addTextElement = useProjectStore((s) => s.addTextElement);
  const removeElement = useProjectStore((s) => s.removeElement);
  const removeImageFromSlot = useProjectStore((s) => s.removeImageFromSlot);
  const selectedElementId = useProjectStore((s) => s.selectedElementId);
  const selectedSlotIndex = useProjectStore((s) => s.selectedSlotIndex);
  const applyLayout = useProjectStore((s) => s.applyLayout);
  const clearLayout = useProjectStore((s) => s.clearLayout);
  const updateElement = useProjectStore((s) => s.updateElement);
  const setLayoutPadding = useProjectStore((s) => s.setLayoutPadding);
  const setLayoutGap = useProjectStore((s) => s.setLayoutGap);
  const setCoverTitle = useProjectStore((s) => s.setCoverTitle);
  const setCoverSubtitle = useProjectStore((s) => s.setCoverSubtitle);
  const toggleCover = useProjectStore((s) => s.toggleCover);
  const addCoverPage = useProjectStore((s) => s.addCoverPage);

  const pages = useProjectStore((s) => s.project.pages);
  const currentPageIndex = useProjectStore((s) => s.currentPageIndex);
  const currentLayoutId = useProjectStore(
    (s) => s.project.pages[s.currentPageIndex]?.layoutId,
  );
  const currentSlotAssignments = useProjectStore(
    (s) => s.project.pages[s.currentPageIndex]?.slotAssignments,
  );
  const currentLayoutPadding = useProjectStore(
    (s) => s.project.pages[s.currentPageIndex]?.layoutPadding ?? 20,
  );
  const currentLayoutGap = useProjectStore(
    (s) => s.project.pages[s.currentPageIndex]?.layoutGap ?? 10,
  );
  const setCurrentPageIndex = useProjectStore((s) => s.setCurrentPageIndex);
  const addPage = useProjectStore((s) => s.addPage);
  const removePage = useProjectStore((s) => s.removePage);

  const currentIsCover = useProjectStore(
    (s) => s.project.pages[s.currentPageIndex]?.isCover ?? false,
  );
  const currentCoverTitle = useProjectStore(
    (s) => s.project.pages[s.currentPageIndex]?.coverTitle ?? '',
  );
  const currentCoverSubtitle = useProjectStore(
    (s) => s.project.pages[s.currentPageIndex]?.coverSubtitle ?? '',
  );
  const hasCoverPage = useProjectStore(
    (s) => s.project.pages[0]?.isCover ?? false,
  );

  const hasFileSystemAccess = 'showOpenFilePicker' in window;

  const goPrevPage = () => {
    if (currentPageIndex > 0) setCurrentPageIndex(currentPageIndex - 1);
  };
  const goNextPage = () => {
    if (currentPageIndex < pages.length - 1) setCurrentPageIndex(currentPageIndex + 1);
  };

  // Can we delete something?
  const canDeleteSlot =
    selectedSlotIndex !== null &&
    currentSlotAssignments?.[selectedSlotIndex] !== undefined;
  const canDelete = !!selectedElementId || canDeleteSlot;

  const selectedTextElement = useProjectStore((s) => {
    if (!s.selectedElementId) return null;
    const page = s.project.pages[s.currentPageIndex];
    if (!page) return null;
    const el = page.elements.find((e) => e.id === s.selectedElementId);
    if (el && el.type === 'text') return el;
    return null;
  });

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();

        const state = useProjectStore.getState();
        if (
          state.selectedSlotIndex !== null &&
          state.project.pages[state.currentPageIndex]?.slotAssignments?.[
            state.selectedSlotIndex
          ]
        ) {
          removeImageFromSlot(state.selectedSlotIndex);
        } else if (state.selectedElementId) {
          removeElement(state.selectedElementId);
        }
      }

      // Ctrl+S / Ctrl+Shift+S
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (e.shiftKey) {
          useProjectStore.getState().saveCurrentProjectAs();
        } else {
          useProjectStore.getState().saveCurrentProject();
        }
      }

      // Arrow keys for page navigation
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') {
        const s = useProjectStore.getState();
        if (s.currentPageIndex > 0) s.setCurrentPageIndex(s.currentPageIndex - 1);
      } else if (e.key === 'ArrowRight') {
        const s = useProjectStore.getState();
        if (s.currentPageIndex < s.project.pages.length - 1) s.setCurrentPageIndex(s.currentPageIndex + 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [removeElement, removeImageFromSlot]);

  const handleOpen = async () => {
    if (hasFileSystemAccess) {
      try {
        await openProject();
      } catch (err) {
        console.error('Fehler beim Öffnen:', err);
        alert(`Fehler beim Öffnen: ${err instanceof Error ? err.message : err}`);
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await loadFromFile(file);
    } catch (err) {
      console.error('Fehler beim Laden:', err);
      alert(`Fehler beim Laden: ${err instanceof Error ? err.message : err}`);
    }
    e.target.value = '';
  };

  const handleSave = async () => {
    try {
      await saveCurrentProject();
    } catch (err) {
      console.error('Fehler beim Speichern:', err);
      alert(`Fehler beim Speichern: ${err instanceof Error ? err.message : err}`);
    }
  };

  const handleSaveAs = async () => {
    try {
      await saveCurrentProjectAs();
    } catch (err) {
      console.error('Fehler beim Speichern:', err);
      alert(`Fehler beim Speichern: ${err instanceof Error ? err.message : err}`);
    }
  };

  const handleNewProject = () => {
    const name = prompt('Projektname:', 'Neues Projekt');
    if (name !== null) {
      resetProject(name.trim() || 'Unbenanntes Projekt');
    }
  };

  const handleAddImage = () => imageInputRef.current?.click();

  const handleImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await addImageFromFile(file);
    } catch (err) {
      console.error('Fehler beim Hinzufügen:', err);
    }
    e.target.value = '';
  };

  const handleLayoutSelect = (layoutId: string | null) => {
    if (layoutId) {
      applyLayout(layoutId);
    } else {
      clearLayout();
    }
  };

  const handleDelete = () => {
    if (canDeleteSlot && selectedSlotIndex !== null) {
      removeImageFromSlot(selectedSlotIndex);
    } else if (selectedElementId) {
      removeElement(selectedElementId);
    }
  };

  const btnBase =
    'px-3 py-1.5 text-sm rounded transition-colors cursor-pointer select-none';
  const btnPrimary = `${btnBase} bg-blue-600 hover:bg-blue-500 text-white`;
  const btnSecondary = `${btnBase} bg-neutral-700 hover:bg-neutral-600 text-white`;
  const btnDanger = `${btnBase} bg-red-700 hover:bg-red-600 text-white`;
  const btnPageNav =
    'w-7 h-7 flex items-center justify-center rounded text-sm transition-colors cursor-pointer select-none';

  return (
    <div className="flex flex-col w-screen h-screen">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-[#1a1a1a] border-b border-[#333] shrink-0 flex-wrap">
        {/* Editable project name */}
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="text-sm text-neutral-400 font-medium bg-transparent border-b border-transparent
                       outline-none focus:text-white focus:border-blue-500 w-40 py-0.5
                       hover:border-neutral-600 transition-colors"
            title="Projektname bearbeiten"
          />
          {fileHandle && (
            <span className="text-neutral-600 text-xs select-none">({fileHandle.name})</span>
          )}
        </div>
        <div className="w-px h-5 bg-[#444]" />

        {/* File actions */}
        <button onClick={handleSave} className={btnPrimary} title="Ctrl+S">
          Speichern
        </button>
        <button onClick={handleSaveAs} className={btnSecondary} title="Ctrl+Shift+S">
          Speichern unter
        </button>
        <button onClick={handleOpen} className={btnSecondary}>
          Öffnen
        </button>
        <button onClick={handleNewProject} className={btnSecondary}>
          Neues Projekt
        </button>
        {!hasCoverPage && (
          <button onClick={addCoverPage} className={btnSecondary}>
            + Deckblatt
          </button>
        )}

        <div className="w-px h-5 bg-[#444]" />

        {/* Add elements */}
        <button onClick={handleAddImage} className={btnSecondary}>
          + Bild
        </button>
        <button onClick={addTextElement} className={btnSecondary}>
          + Text
        </button>

        {canDelete && (
          <button onClick={handleDelete} className={btnDanger}>
            Löschen
          </button>
        )}

        {/* Text properties (when text selected) */}
        {selectedTextElement && (
          <>
            <div className="w-px h-5 bg-[#444]" />
            <div className="flex items-center gap-2">
              <label className="text-xs text-neutral-500">Größe</label>
              <input
                type="number"
                min={1}
                max={200}
                value={selectedTextElement.fontSize}
                onChange={(e) =>
                  updateElement(selectedTextElement.id, {
                    fontSize: Math.max(1, parseInt(e.target.value) || 24),
                  })
                }
                className="w-14 px-1.5 py-1 text-sm rounded bg-neutral-700 text-white border border-neutral-600"
              />
              <label className="text-xs text-neutral-500">Farbe</label>
              <input
                type="color"
                value={selectedTextElement.color}
                onChange={(e) =>
                  updateElement(selectedTextElement.id, { color: e.target.value })
                }
                className="w-8 h-8 rounded border border-neutral-600 cursor-pointer p-0.5"
              />
            </div>
          </>
        )}

        <div className="w-px h-5 bg-[#444]" />

        {/* Layout picker with previews */}
        <LayoutPicker
          currentLayoutId={currentLayoutId}
          onSelect={handleLayoutSelect}
        />

        {/* Layout spacing controls */}
        {currentLayoutId && (
          <>
            <div className="w-px h-5 bg-[#444]" />
            <div className="flex items-center gap-2">
              <label className="text-xs text-neutral-500">Rand</label>
              <input
                type="number"
                min={0}
                max={100}
                value={currentLayoutPadding}
                onChange={(e) => setLayoutPadding(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-14 px-1.5 py-1 text-sm rounded bg-neutral-700 text-white border border-neutral-600"
              />
              <label className="text-xs text-neutral-500">Abstand</label>
              <input
                type="number"
                min={0}
                max={100}
                value={currentLayoutGap}
                onChange={(e) => setLayoutGap(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-14 px-1.5 py-1 text-sm rounded bg-neutral-700 text-white border border-neutral-600"
              />
            </div>
          </>
        )}

        {/* Cover page controls */}
        {currentIsCover && (
          <>
            <div className="w-px h-5 bg-[#444]" />
            <div className="flex items-center gap-2">
              <label className="text-xs text-neutral-500">Titel</label>
              <input
                type="text"
                value={currentCoverTitle}
                onChange={(e) => setCoverTitle(e.target.value)}
                className="w-32 px-1.5 py-1 text-sm rounded bg-neutral-700 text-white border border-neutral-600"
                placeholder="Titel"
              />
              <label className="text-xs text-neutral-500">Untertitel</label>
              <input
                type="text"
                value={currentCoverSubtitle}
                onChange={(e) => setCoverSubtitle(e.target.value)}
                className="w-28 px-1.5 py-1 text-sm rounded bg-neutral-700 text-white border border-neutral-600"
                placeholder="Untertitel"
              />
            </div>
          </>
        )}

        <div className="w-px h-5 bg-[#444]" />

        {/* Page navigation */}
        <div className="flex items-center gap-1">
          {pages.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentPageIndex(i)}
              className={`${btnPageNav} ${
                i === currentPageIndex
                  ? 'bg-blue-600 text-white'
                  : 'bg-neutral-700 hover:bg-neutral-600 text-neutral-300'
              }`}
            >
              {i + 1}
            </button>
          ))}
          <button
            onClick={addPage}
            className={`${btnPageNav} bg-neutral-700 hover:bg-neutral-600 text-neutral-300`}
            title="Neue Seite"
          >
            +
          </button>
          {pages.length > 1 && (
            <button
              onClick={() => removePage(currentPageIndex)}
              className={`${btnPageNav} bg-red-800 hover:bg-red-700 text-neutral-300`}
              title="Seite löschen"
            >
              −
            </button>
          )}
        </div>

        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".layox"
          className="hidden"
          onChange={handleFileSelected}
        />
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageSelected}
        />
      </div>

      {/* Canvas Area with page navigation arrows */}
      <div className="flex-1 flex items-center justify-center overflow-hidden gap-2 px-2">
        {/* Left arrow */}
        <button
          onClick={goPrevPage}
          disabled={currentPageIndex === 0}
          className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full
                     bg-neutral-800 hover:bg-neutral-700 text-neutral-300 disabled:opacity-20
                     disabled:cursor-not-allowed transition-colors cursor-pointer select-none text-lg"
          title="Vorherige Seite"
        >
          ◀
        </button>

        <EditorCanvas />

        {/* Right arrow */}
        <button
          onClick={goNextPage}
          disabled={currentPageIndex >= pages.length - 1}
          className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full
                     bg-neutral-800 hover:bg-neutral-700 text-neutral-300 disabled:opacity-20
                     disabled:cursor-not-allowed transition-colors cursor-pointer select-none text-lg"
          title="Nächste Seite"
        >
          ▶
        </button>
      </div>
    </div>
  );
}

export default App;
