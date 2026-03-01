import { useRef } from 'react';
import useProjectStore from '../store/useProjectStore';

function StartScreen() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetProject = useProjectStore((s) => s.resetProject);
  const openProject = useProjectStore((s) => s.openProject);
  const loadFromFile = useProjectStore((s) => s.loadFromFile);
  const recentProjects = useProjectStore((s) => s.recentProjects);

  const hasFileSystemAccess = 'showOpenFilePicker' in window;

  const handleNewProject = () => {
    const name = prompt('Projektname:', 'Neues Projekt');
    if (name !== null) {
      resetProject(name.trim() || 'Unbenanntes Projekt');
    }
  };

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

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="w-screen h-screen bg-[#111] flex items-center justify-center">
      <div className="flex flex-col items-center gap-8 max-w-lg w-full px-6">
        {/* Logo / Title */}
        <div className="text-center">
          <h1 className="text-5xl font-bold text-white tracking-tight">Layox</h1>
          <p className="text-neutral-400 mt-2 text-sm">
            Lokaler Fotoalbum-Editor — privat &amp; ohne Cloud
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleNewProject}
            className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium
                       transition-colors cursor-pointer select-none"
          >
            Neues Projekt
          </button>
          <button
            onClick={handleOpen}
            className="px-5 py-2.5 rounded-lg bg-neutral-700 hover:bg-neutral-600 text-white font-medium
                       transition-colors cursor-pointer select-none"
          >
            Projekt öffnen
          </button>
        </div>

        {/* Recent projects */}
        {recentProjects.length > 0 && (
          <div className="w-full">
            <h2 className="text-sm text-neutral-500 font-medium mb-2 uppercase tracking-wider">
              Zuletzt geöffnet
            </h2>
            <div className="flex flex-col gap-1">
              {recentProjects.map((rp, i) => (
                <div
                  key={`${rp.fileName}-${i}`}
                  className="flex items-center justify-between px-4 py-2.5 rounded-lg
                             bg-neutral-800/60 hover:bg-neutral-700/80 transition-colors"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-white text-sm font-medium truncate">
                      {rp.name}
                    </span>
                    <span className="text-neutral-500 text-xs truncate">
                      {rp.fileName}
                    </span>
                  </div>
                  <span className="text-neutral-600 text-xs shrink-0 ml-4">
                    {formatDate(rp.lastOpened)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Hidden file input for browsers without File System Access */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".layox"
          className="hidden"
          onChange={handleFileSelected}
        />
      </div>
    </div>
  );
}

export default StartScreen;
