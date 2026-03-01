import { useRef, useEffect } from 'react';
import './index.css';
import EditorCanvas from './components/canvas/EditorCanvas';
import useProjectStore from './store/useProjectStore';
import { LAYOUT_TEMPLATES } from './utils/layouts';

function App() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const saveCurrentProject = useProjectStore((s) => s.saveCurrentProject);
  const saveCurrentProjectAs = useProjectStore((s) => s.saveCurrentProjectAs);
  const openProject = useProjectStore((s) => s.openProject);
  const loadFromFile = useProjectStore((s) => s.loadFromFile);
  const resetProject = useProjectStore((s) => s.resetProject);
  const projectName = useProjectStore((s) => s.project.meta.name);
  const fileHandle = useProjectStore((s) => s.fileHandle);

  const addImageFromFile = useProjectStore((s) => s.addImageFromFile);
  const addTextElement = useProjectStore((s) => s.addTextElement);
  const removeElement = useProjectStore((s) => s.removeElement);
  const selectedElementId = useProjectStore((s) => s.selectedElementId);
  const applyLayout = useProjectStore((s) => s.applyLayout);

  const pages = useProjectStore((s) => s.project.pages);
  const currentPageIndex = useProjectStore((s) => s.currentPageIndex);
  const currentLayoutId = useProjectStore(
    (s) => s.project.pages[s.currentPageIndex]?.layoutId,
  );
  const setCurrentPageIndex = useProjectStore((s) => s.setCurrentPageIndex);
  const addPage = useProjectStore((s) => s.addPage);
  const removePage = useProjectStore((s) => s.removePage);

  const hasFileSystemAccess = 'showOpenFilePicker' in window;

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (tag === 'INPUT' || tag === 'SELECT') return;
        const id = useProjectStore.getState().selectedElementId;
        if (id) {
          e.preventDefault();
          removeElement(id);
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
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [removeElement]);

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

  const handleLayoutChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const layoutId = e.target.value;
    if (layoutId) applyLayout(layoutId);
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
        {/* Project name + file indicator */}
        <span className="text-sm text-neutral-400 font-medium select-none" title={fileHandle?.name}>
          {projectName}
          {fileHandle && (
            <span className="text-neutral-600 ml-1 text-xs">({fileHandle.name})</span>
          )}
        </span>
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
        <button onClick={resetProject} className={btnSecondary}>
          Neues Projekt
        </button>

        <div className="w-px h-5 bg-[#444]" />

        {/* Add elements */}
        <button onClick={handleAddImage} className={btnSecondary}>
          + Bild
        </button>
        <button onClick={addTextElement} className={btnSecondary}>
          + Text
        </button>

        {selectedElementId && (
          <button
            onClick={() => removeElement(selectedElementId)}
            className={btnDanger}
          >
            Löschen
          </button>
        )}

        <div className="w-px h-5 bg-[#444]" />

        {/* Layout selector */}
        <select
          value={currentLayoutId ?? ''}
          onChange={handleLayoutChange}
          className="px-2 py-1.5 text-sm rounded bg-neutral-700 text-white border border-neutral-600 cursor-pointer"
        >
          <option value="" disabled>
            Layout wählen…
          </option>
          {LAYOUT_TEMPLATES.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} ({l.slots.length})
            </option>
          ))}
        </select>

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

      {/* Canvas Area */}
      <div className="flex-1 flex items-center justify-center overflow-hidden">
        <EditorCanvas />
      </div>
    </div>
  );
}

export default App;
