import { useRef, useEffect, useState, useCallback } from 'react';
import './index.css';
import EditorCanvas from './components/canvas/EditorCanvas';
import LayoutPicker from './components/LayoutPicker';
import StartScreen from './components/StartScreen';
import CropModal from './components/CropModal';
import useProjectStore from './store/useProjectStore';
import { computeLayoutSlots } from './utils/layouts';

const FONTS = ['Arial', 'Times New Roman', 'Georgia', 'Verdana', 'Courier New', 'Trebuchet MS', 'Impact', 'Comic Sans MS'];

function App() {
  const showEditor = useProjectStore((s) => s.showEditor);
  if (!showEditor) return <StartScreen />;
  return <Editor />;
}

// ─── Dropdown menu helper ────────────────────────────────────────────────────

function MenuButton({
  label,
  isOpen,
  onClick,
}: {
  label: string;
  isOpen: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      data-menu
      className={`px-2.5 py-1 text-sm rounded transition-colors cursor-pointer select-none ${
        isOpen ? 'bg-neutral-700 text-white' : 'text-neutral-300 hover:bg-neutral-800 hover:text-white'
      }`}
    >
      {label}
    </button>
  );
}

function MenuItem({
  label,
  shortcut,
  onClick,
  disabled,
  danger,
}: {
  label: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left px-3 py-1.5 text-sm flex justify-between items-center transition-colors cursor-pointer select-none
                  ${disabled ? 'text-neutral-600 cursor-not-allowed' : danger ? 'text-red-400 hover:bg-red-600/20' : 'text-neutral-200 hover:bg-blue-600 hover:text-white'}`}
    >
      <span>{label}</span>
      {shortcut && <span className="text-neutral-500 text-xs ml-6">{shortcut}</span>}
    </button>
  );
}

function MenuDivider() {
  return <div className="h-px bg-[#444] my-1" />;
}

// ─── Editor ──────────────────────────────────────────────────────────────────

function Editor() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Store selectors
  const saveCurrentProject = useProjectStore((s) => s.saveCurrentProject);
  const saveCurrentProjectAs = useProjectStore((s) => s.saveCurrentProjectAs);
  const openProject = useProjectStore((s) => s.openProject);
  const loadFromFile = useProjectStore((s) => s.loadFromFile);
  const resetProject = useProjectStore((s) => s.resetProject);
  const setProjectName = useProjectStore((s) => s.setProjectName);
  const projectName = useProjectStore((s) => s.project.meta.name);
  const fileHandle = useProjectStore((s) => s.fileHandle);
  const snapshot = useProjectStore((s) => s.snapshot);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const canUndo = useProjectStore((s) => s.historyPast.length > 0);
  const canRedo = useProjectStore((s) => s.historyFuture.length > 0);

  const addImageFromFile = useProjectStore((s) => s.addImageFromFile);
  const addTextElement = useProjectStore((s) => s.addTextElement);
  const removeElement = useProjectStore((s) => s.removeElement);
  const removeImageFromSlot = useProjectStore((s) => s.removeImageFromSlot);
  const clearSlotCrop = useProjectStore((s) => s.clearSlotCrop);
  const updateSlotCrop = useProjectStore((s) => s.updateSlotCrop);
  const selectedElementId = useProjectStore((s) => s.selectedElementId);
  const selectedSlotIndex = useProjectStore((s) => s.selectedSlotIndex);
  const applyLayout = useProjectStore((s) => s.applyLayout);
  const clearLayout = useProjectStore((s) => s.clearLayout);
  const updateElement = useProjectStore((s) => s.updateElement);
  const setLayoutPadding = useProjectStore((s) => s.setLayoutPadding);
  const setLayoutGap = useProjectStore((s) => s.setLayoutGap);
  const setCoverTitle = useProjectStore((s) => s.setCoverTitle);
  const setCoverSubtitle = useProjectStore((s) => s.setCoverSubtitle);
  const addCoverPage = useProjectStore((s) => s.addCoverPage);
  const assetBlobs = useProjectStore((s) => s.assetBlobs);
  const setShowEditor = useProjectStore((s) => s.setShowEditor);

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

  const autoSaveEnabled = useProjectStore((s) => s.autoSaveEnabled);
  const autoSaveInterval = useProjectStore((s) => s.autoSaveInterval);
  const setAutoSaveEnabled = useProjectStore((s) => s.setAutoSaveEnabled);
  const setAutoSaveInterval = useProjectStore((s) => s.setAutoSaveInterval);

  const hasFileSystemAccess = 'showOpenFilePicker' in window;

  // Derived state
  const canDeleteSlot =
    selectedSlotIndex !== null &&
    currentSlotAssignments?.[selectedSlotIndex] !== undefined;
  const slotHasCrop =
    selectedSlotIndex !== null &&
    currentSlotAssignments?.[selectedSlotIndex]?.cropX !== undefined;
  const canDelete = !!selectedElementId || canDeleteSlot;
  const isSingleLayout = currentLayoutId === 'single';
  const showGap = !!currentLayoutId && !isSingleLayout;

  const selectedTextElement = useProjectStore((s) => {
    if (!s.selectedElementId) return null;
    const page = s.project.pages[s.currentPageIndex];
    if (!page) return null;
    const el = page.elements.find((e) => e.id === s.selectedElementId);
    if (el && el.type === 'text') return el;
    return null;
  });

  // ─── Dropdown menu state ────────────────────────────────────────────────
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const toggleMenu = useCallback(
    (name: string) => setOpenMenu((prev) => (prev === name ? null : name)),
    [],
  );
  const closeMenu = useCallback(() => setOpenMenu(null), []);

  // Close menu on outside click
  useEffect(() => {
    if (!openMenu) return;
    const handle = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-menu]')) setOpenMenu(null);
    };
    requestAnimationFrame(() => document.addEventListener('mousedown', handle));
    return () => document.removeEventListener('mousedown', handle);
  }, [openMenu]);

  // ─── Crop modal state ──────────────────────────────────────────────────
  const [cropModal, setCropModal] = useState<{
    blob: Blob;
    aspectRatio: number;
    initialCrop?: { x: number; y: number; w: number; h: number };
    slotIndex: number;
  } | null>(null);

  // ─── Page navigation ──────────────────────────────────────────────────
  const goPrevPage = () => {
    if (currentPageIndex > 0) setCurrentPageIndex(currentPageIndex - 1);
  };
  const goNextPage = () => {
    if (currentPageIndex < pages.length - 1) setCurrentPageIndex(currentPageIndex + 1);
  };

  // ─── Keyboard shortcuts ─────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA';

      // Ctrl+Z – Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        useProjectStore.getState().undo();
        return;
      }
      // Ctrl+Y or Ctrl+Shift+Z – Redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey) || (e.key === 'Z' && e.shiftKey))) {
        e.preventDefault();
        useProjectStore.getState().redo();
        return;
      }
      // Ctrl+S / Ctrl+Shift+S
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (e.shiftKey) {
          useProjectStore.getState().saveCurrentProjectAs();
        } else {
          useProjectStore.getState().saveCurrentProject();
        }
        return;
      }
      // Ctrl+O – Open
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        useProjectStore.getState().openProject();
        return;
      }
      // Ctrl+N – New project
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        const name = prompt('Projektname:', 'Neues Projekt');
        if (name !== null) resetProject(name.trim() || 'Unbenanntes Projekt');
        return;
      }
      // Ctrl+T – Add text
      if ((e.ctrlKey || e.metaKey) && e.key === 't') {
        if (!isInput) {
          e.preventDefault();
          useProjectStore.getState().snapshot();
          addTextElement();
        }
        return;
      }
      // Escape – Deselect / close menu
      if (e.key === 'Escape') {
        setOpenMenu(null);
        useProjectStore.getState().setSelectedElementId(null);
        useProjectStore.getState().setSelectedSlotIndex(null);
        return;
      }
      // Delete / Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (isInput) return;
        e.preventDefault();
        const state = useProjectStore.getState();
        state.snapshot();
        if (
          state.selectedSlotIndex !== null &&
          state.project.pages[state.currentPageIndex]?.slotAssignments?.[state.selectedSlotIndex]
        ) {
          removeImageFromSlot(state.selectedSlotIndex);
        } else if (state.selectedElementId) {
          removeElement(state.selectedElementId);
        }
        return;
      }
      // Arrow keys for page navigation
      if (isInput) return;
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
  }, [removeElement, removeImageFromSlot, addTextElement, resetProject]);

  // Auto-save
  useEffect(() => {
    if (!autoSaveEnabled || autoSaveInterval <= 0) return;
    const id = setInterval(() => {
      const state = useProjectStore.getState();
      if (state.fileHandle) {
        state.saveCurrentProject().catch((err) =>
          console.error('Auto-save Fehler:', err),
        );
      }
    }, autoSaveInterval * 1000);
    return () => clearInterval(id);
  }, [autoSaveEnabled, autoSaveInterval]);

  // ─── Handlers ─────────────────────────────────────────────────────────
  const handleOpen = async () => {
    closeMenu();
    if (hasFileSystemAccess) {
      try { await openProject(); } catch (err) {
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
    try { await loadFromFile(file); } catch (err) {
      console.error('Fehler beim Laden:', err);
      alert(`Fehler beim Laden: ${err instanceof Error ? err.message : err}`);
    }
    e.target.value = '';
  };

  const handleSave = async () => { closeMenu(); try { await saveCurrentProject(); } catch (err) { alert(`Fehler: ${err}`); } };
  const handleSaveAs = async () => { closeMenu(); try { await saveCurrentProjectAs(); } catch (err) { alert(`Fehler: ${err}`); } };

  const handleNewProject = () => {
    closeMenu();
    const name = prompt('Projektname:', 'Neues Projekt');
    if (name !== null) resetProject(name.trim() || 'Unbenanntes Projekt');
  };

  const handleAddImage = () => { closeMenu(); imageInputRef.current?.click(); };
  const handleImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    snapshot();
    try { await addImageFromFile(file); } catch (err) { console.error(err); }
    e.target.value = '';
  };

  const handleAddText = () => { closeMenu(); snapshot(); addTextElement(); };
  const handleAddCoverPage = () => { closeMenu(); snapshot(); addCoverPage(); };

  const handleLayoutSelect = (layoutId: string | null) => {
    snapshot();
    if (layoutId) applyLayout(layoutId); else clearLayout();
  };

  const handleDelete = () => {
    closeMenu();
    snapshot();
    if (canDeleteSlot && selectedSlotIndex !== null) {
      removeImageFromSlot(selectedSlotIndex);
    } else if (selectedElementId) {
      removeElement(selectedElementId);
    }
  };

  const handleUndo = () => { closeMenu(); undo(); };
  const handleRedo = () => { closeMenu(); redo(); };

  const handleStartCrop = async () => {
    closeMenu();
    if (selectedSlotIndex === null) return;
    const assignment = currentSlotAssignments?.[selectedSlotIndex];
    if (!assignment) return;
    const blob = assetBlobs[assignment.assetPath];
    if (!blob) return;
    const slots = currentLayoutId ? computeLayoutSlots(currentLayoutId, currentLayoutPadding, currentLayoutGap) : [];
    const slot = slots[selectedSlotIndex];
    if (!slot) return;
    const initial = assignment.cropX !== undefined
      ? { x: assignment.cropX, y: assignment.cropY!, w: assignment.cropW!, h: assignment.cropH! }
      : undefined;
    setCropModal({ blob, aspectRatio: slot.width / slot.height, initialCrop: initial, slotIndex: selectedSlotIndex });
  };

  const handleCropConfirm = (crop: { x: number; y: number; w: number; h: number }) => {
    snapshot();
    updateSlotCrop(cropModal!.slotIndex, crop.x, crop.y, crop.w, crop.h);
    setCropModal(null);
  };

  const handleCropCancel = () => setCropModal(null);

  const handleClearCrop = () => {
    closeMenu();
    if (selectedSlotIndex !== null) { snapshot(); clearSlotCrop(selectedSlotIndex); }
  };

  const handleGoHome = () => { closeMenu(); setShowEditor(false); };

  const btnPageNav =
    'w-7 h-7 flex items-center justify-center rounded text-sm transition-colors cursor-pointer select-none';
  const btnIcon =
    'w-8 h-8 flex items-center justify-center rounded text-base transition-colors cursor-pointer select-none disabled:opacity-30 disabled:cursor-not-allowed';

  return (
    <div className="flex flex-col w-screen h-screen">
      {/* ─── Menu Bar ─── */}
      <div className="flex items-center gap-1 px-2 py-1 bg-[#1e1e1e] border-b border-[#333] shrink-0">
        {/* Project name */}
        <div className="flex items-center gap-1 mr-1">
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            onFocus={() => snapshot()}
            className="text-sm text-neutral-400 font-medium bg-transparent border-b border-transparent
                       outline-none focus:text-white focus:border-blue-500 w-36 py-0.5
                       hover:border-neutral-600 transition-colors"
            title="Projektname bearbeiten"
          />
          {fileHandle && (
            <span className="text-neutral-600 text-xs select-none">({fileHandle.name})</span>
          )}
        </div>

        <div className="w-px h-4 bg-[#444]" />

        {/* Undo / Redo */}
        <button onClick={handleUndo} disabled={!canUndo} className={`${btnIcon} text-neutral-300 hover:bg-neutral-700`} title="Rückgängig (Ctrl+Z)">↩</button>
        <button onClick={handleRedo} disabled={!canRedo} className={`${btnIcon} text-neutral-300 hover:bg-neutral-700`} title="Wiederherstellen (Ctrl+Y)">↪</button>

        <div className="w-px h-4 bg-[#444]" />

        {/* ── Datei menu ── */}
        <div className="relative" data-menu>
          <MenuButton label="Datei" isOpen={openMenu === 'datei'} onClick={() => toggleMenu('datei')} />
          {openMenu === 'datei' && (
            <div className="absolute top-full left-0 mt-1 min-w-[220px] bg-[#252525] border border-[#444] rounded-lg shadow-xl z-50 py-1">
              <MenuItem label="Neues Projekt" shortcut="Ctrl+N" onClick={handleNewProject} />
              <MenuItem label="Öffnen" shortcut="Ctrl+O" onClick={handleOpen} />
              <MenuDivider />
              <MenuItem label="Speichern" shortcut="Ctrl+S" onClick={handleSave} />
              <MenuItem label="Speichern unter" shortcut="Ctrl+Shift+S" onClick={handleSaveAs} />
              <MenuDivider />
              <MenuItem label="Startseite" onClick={handleGoHome} />
            </div>
          )}
        </div>

        {/* ── Bearbeiten menu ── */}
        <div className="relative" data-menu>
          <MenuButton label="Bearbeiten" isOpen={openMenu === 'bearbeiten'} onClick={() => toggleMenu('bearbeiten')} />
          {openMenu === 'bearbeiten' && (
            <div className="absolute top-full left-0 mt-1 min-w-[220px] bg-[#252525] border border-[#444] rounded-lg shadow-xl z-50 py-1">
              <MenuItem label="Rückgängig" shortcut="Ctrl+Z" onClick={handleUndo} disabled={!canUndo} />
              <MenuItem label="Wiederherstellen" shortcut="Ctrl+Y" onClick={handleRedo} disabled={!canRedo} />
              <MenuDivider />
              <MenuItem label="Löschen" shortcut="Entf" onClick={handleDelete} disabled={!canDelete} danger />
              {canDeleteSlot && (
                <>
                  <MenuDivider />
                  <MenuItem label="Beschneiden" onClick={handleStartCrop} disabled={!canDeleteSlot} />
                  <MenuItem label="Beschnitt zurücksetzen" onClick={handleClearCrop} disabled={!slotHasCrop} />
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Einfügen menu ── */}
        <div className="relative" data-menu>
          <MenuButton label="Einfügen" isOpen={openMenu === 'einfuegen'} onClick={() => toggleMenu('einfuegen')} />
          {openMenu === 'einfuegen' && (
            <div className="absolute top-full left-0 mt-1 min-w-[220px] bg-[#252525] border border-[#444] rounded-lg shadow-xl z-50 py-1">
              <MenuItem label="Bild" onClick={handleAddImage} />
              <MenuItem label="Text" shortcut="Ctrl+T" onClick={handleAddText} />
              <MenuDivider />
              <MenuItem label="Deckblatt" onClick={handleAddCoverPage} disabled={hasCoverPage} />
            </div>
          )}
        </div>

        {/* ── Layout menu ── */}
        <div className="relative" data-menu>
          <MenuButton label="Layout" isOpen={openMenu === 'layout'} onClick={() => toggleMenu('layout')} />
          {openMenu === 'layout' && (
            <div className="absolute top-full left-0 mt-1 bg-[#252525] border border-[#444] rounded-lg shadow-xl z-50 py-2 px-3 min-w-[260px]">
              <div className="mb-2">
                <LayoutPicker currentLayoutId={currentLayoutId} onSelect={(id) => { handleLayoutSelect(id); closeMenu(); }} />
              </div>
              {currentLayoutId && (
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[#444]">
                  <label className="text-xs text-neutral-500">Rand</label>
                  <input
                    type="number" min={0} max={100} value={currentLayoutPadding}
                    onFocus={() => snapshot()}
                    onChange={(e) => setLayoutPadding(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-14 px-1.5 py-1 text-sm rounded bg-neutral-700 text-white border border-neutral-600"
                  />
                  {showGap && (
                    <>
                      <label className="text-xs text-neutral-500">Abstand</label>
                      <input
                        type="number" min={0} max={100} value={currentLayoutGap}
                        onFocus={() => snapshot()}
                        onChange={(e) => setLayoutGap(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-14 px-1.5 py-1 text-sm rounded bg-neutral-700 text-white border border-neutral-600"
                      />
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Seite menu ── */}
        <div className="relative" data-menu>
          <MenuButton label="Seite" isOpen={openMenu === 'seite'} onClick={() => toggleMenu('seite')} />
          {openMenu === 'seite' && (
            <div className="absolute top-full left-0 mt-1 min-w-[220px] bg-[#252525] border border-[#444] rounded-lg shadow-xl z-50 py-1">
              <MenuItem label="Neue Seite" onClick={() => { closeMenu(); snapshot(); addPage(); }} />
              <MenuItem label="Seite löschen" onClick={() => { closeMenu(); snapshot(); removePage(currentPageIndex); }} disabled={pages.length <= 1} danger />
              {currentIsCover && (
                <>
                  <MenuDivider />
                  <div className="px-3 py-1.5 flex items-center gap-2">
                    <label className="text-xs text-neutral-500">Titel</label>
                    <input
                      type="text" value={currentCoverTitle}
                      onFocus={() => snapshot()}
                      onChange={(e) => setCoverTitle(e.target.value)}
                      className="flex-1 px-1.5 py-1 text-sm rounded bg-neutral-700 text-white border border-neutral-600"
                      placeholder="Titel"
                    />
                  </div>
                  <div className="px-3 py-1.5 flex items-center gap-2">
                    <label className="text-xs text-neutral-500">Untertitel</label>
                    <input
                      type="text" value={currentCoverSubtitle}
                      onFocus={() => snapshot()}
                      onChange={(e) => setCoverSubtitle(e.target.value)}
                      className="flex-1 px-1.5 py-1 text-sm rounded bg-neutral-700 text-white border border-neutral-600"
                      placeholder="Untertitel"
                    />
                  </div>
                </>
              )}
              <MenuDivider />
              <div className="px-3 py-1.5 flex items-center gap-2">
                <label className="text-xs text-neutral-500 flex items-center gap-1 cursor-pointer select-none">
                  <input
                    type="checkbox" checked={autoSaveEnabled}
                    onChange={(e) => setAutoSaveEnabled(e.target.checked)}
                    className="accent-blue-500"
                  />
                  Auto-Save
                </label>
                {autoSaveEnabled && (
                  <select
                    value={autoSaveInterval}
                    onChange={(e) => setAutoSaveInterval(parseInt(e.target.value, 10))}
                    className="px-1.5 py-1 text-xs rounded bg-neutral-700 text-white border border-neutral-600"
                  >
                    <option value={10}>10s</option>
                    <option value={30}>30s</option>
                    <option value={60}>60s</option>
                    <option value={120}>2min</option>
                    <option value={300}>5min</option>
                  </select>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Spacer ── */}
        <div className="flex-1" />

        {/* ── Page navigation ── */}
        <div className="flex items-center gap-1">
          <button
            onClick={goPrevPage}
            disabled={currentPageIndex === 0}
            className={`${btnPageNav} bg-neutral-800 hover:bg-neutral-700 text-neutral-400 disabled:opacity-20`}
            title="Vorherige Seite (←)"
          >◀</button>
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
            onClick={goNextPage}
            disabled={currentPageIndex >= pages.length - 1}
            className={`${btnPageNav} bg-neutral-800 hover:bg-neutral-700 text-neutral-400 disabled:opacity-20`}
            title="Nächste Seite (→)"
          >▶</button>
        </div>

        {/* Hidden file inputs */}
        <input ref={fileInputRef} type="file" accept=".layox" className="hidden" onChange={handleFileSelected} />
        <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelected} />
      </div>

      {/* ─── Context bar (text format, etc.) ─── */}
      {selectedTextElement && (
        <div className="flex items-center gap-3 px-4 py-1.5 bg-[#222] border-b border-[#333] shrink-0 text-sm">
          <label className="text-xs text-neutral-500">Schriftart</label>
          <select
            value={selectedTextElement.fontFamily}
            onChange={(e) => { snapshot(); updateElement(selectedTextElement.id, { fontFamily: e.target.value }); }}
            className="px-1.5 py-1 text-sm rounded bg-neutral-700 text-white border border-neutral-600"
          >
            {FONTS.map((f) => (
              <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
            ))}
          </select>
          <label className="text-xs text-neutral-500">Größe</label>
          <input
            type="number" min={1} max={200} value={selectedTextElement.fontSize}
            onFocus={() => snapshot()}
            onChange={(e) => updateElement(selectedTextElement.id, { fontSize: Math.max(1, parseInt(e.target.value) || 24) })}
            className="w-14 px-1.5 py-1 text-sm rounded bg-neutral-700 text-white border border-neutral-600"
          />
          <label className="text-xs text-neutral-500">Farbe</label>
          <input
            type="color" value={selectedTextElement.color}
            onFocus={() => snapshot()}
            onChange={(e) => updateElement(selectedTextElement.id, { color: e.target.value })}
            className="w-8 h-8 rounded border border-neutral-600 cursor-pointer p-0.5"
          />
        </div>
      )}

      {/* ─── Canvas area ─── */}
      <div className="flex-1 flex items-center justify-center overflow-hidden px-2">
        <EditorCanvas />
      </div>

      {/* ─── Crop modal ─── */}
      {cropModal && (
        <CropModal
          imageBlob={cropModal.blob}
          aspectRatio={cropModal.aspectRatio}
          initialCrop={cropModal.initialCrop}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}
    </div>
  );
}

export default App;