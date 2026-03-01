import { useRef, useEffect } from 'react';
import './index.css';
import EditorCanvas from './components/canvas/EditorCanvas';
import useProjectStore from './store/useProjectStore';

function App() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const saveCurrentProject = useProjectStore((s) => s.saveCurrentProject);
  const loadFromFile = useProjectStore((s) => s.loadFromFile);
  const resetProject = useProjectStore((s) => s.resetProject);
  const projectName = useProjectStore((s) => s.project.meta.name);

  const addImageFromFile = useProjectStore((s) => s.addImageFromFile);
  const addTextElement = useProjectStore((s) => s.addTextElement);
  const removeElement = useProjectStore((s) => s.removeElement);
  const selectedElementId = useProjectStore((s) => s.selectedElementId);

  const pages = useProjectStore((s) => s.project.pages);
  const currentPageIndex = useProjectStore((s) => s.currentPageIndex);
  const setCurrentPageIndex = useProjectStore((s) => s.setCurrentPageIndex);
  const addPage = useProjectStore((s) => s.addPage);
  const removePage = useProjectStore((s) => s.removePage);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Don't delete when typing in an input
        if ((e.target as HTMLElement).tagName === 'INPUT') return;
        const id = useProjectStore.getState().selectedElementId;
        if (id) {
          e.preventDefault();
          removeElement(id);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [removeElement]);

  const handleOpen = () => fileInputRef.current?.click();

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
        {/* Project name */}
        <span className="text-sm text-neutral-400 font-medium select-none">
          {projectName}
        </span>
        <div className="w-px h-5 bg-[#444]" />

        {/* File actions */}
        <button onClick={handleSave} className={btnPrimary}>
          Speichern
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
