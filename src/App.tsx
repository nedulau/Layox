import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import './index.css';
import EditorCanvas from './components/canvas/EditorCanvas';
import LayoutPicker from './components/LayoutPicker';
import StartScreen from './components/StartScreen';
import CropModal from './components/CropModal';
import useProjectStore from './store/useProjectStore';
import { exportAsPdf, exportCurrentPageAsPng, exportCurrentPageAsJpeg, PDF_COMPRESSION_PRESETS } from './utils/exportProject';
import type { PdfCompressionLevel } from './utils/exportProject';

const FONTS = ['Arial', 'Times New Roman', 'Georgia', 'Verdana', 'Courier New', 'Trebuchet MS', 'Impact', 'Comic Sans MS'];
type UiTheme = 'dark' | 'light';

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
      className={`editor-surface-control px-3 py-1 text-[13px] rounded-lg border transition-all duration-150 cursor-pointer select-none ${
        isOpen
          ? 'bg-neutral-800 border-neutral-600 text-white shadow-sm'
          : 'bg-transparent border-transparent text-neutral-300 hover:bg-neutral-800/80 hover:border-neutral-700 hover:text-white'
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
      className={`editor-surface-control w-full text-left px-3 py-2 text-sm flex justify-between items-center rounded-md transition-colors cursor-pointer select-none
                  ${disabled ? 'text-neutral-600 cursor-not-allowed' : danger ? 'text-red-300 hover:bg-red-500/15' : 'text-neutral-200 hover:bg-neutral-700 hover:text-white'}`}
    >
      <span>{label}</span>
      {shortcut && <span className="text-neutral-500 text-xs ml-6">{shortcut}</span>}
    </button>
  );
}

function MenuDivider() {
  return <div className="h-px bg-neutral-700/80 my-1" />;
}

// ─── Editor ──────────────────────────────────────────────────────────────────

function Editor() {
    const [uiTheme, setUiTheme] = useState<UiTheme>(() => {
      const saved = localStorage.getItem('layox_uiTheme');
      return saved === 'light' ? 'light' : 'dark';
    });

    useEffect(() => {
      localStorage.setItem('layox_uiTheme', uiTheme);
    }, [uiTheme]);

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
  const setDefaultLayoutPadding = useProjectStore((s) => s.setDefaultLayoutPadding);
  const setDefaultLayoutGap = useProjectStore((s) => s.setDefaultLayoutGap);
  const applyLayoutDefaultsToAllPages = useProjectStore((s) => s.applyLayoutDefaultsToAllPages);
  const setCoverSubtitleVisible = useProjectStore((s) => s.setCoverSubtitleVisible);
  const setCoverTitleStyle = useProjectStore((s) => s.setCoverTitleStyle);
  const setCoverSubtitleStyle = useProjectStore((s) => s.setCoverSubtitleStyle);
  const setCurrentPageChapterTitle = useProjectStore((s) => s.setCurrentPageChapterTitle);
  const setCurrentPageSubchapterTitle = useProjectStore((s) => s.setCurrentPageSubchapterTitle);
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
  const defaultLayoutPadding = useProjectStore(
    (s) => s.project.meta.defaultLayoutPadding ?? 20,
  );
  const defaultLayoutGap = useProjectStore(
    (s) => s.project.meta.defaultLayoutGap ?? 10,
  );
  const currentLayoutPadding = useProjectStore(
    (s) => s.project.pages[s.currentPageIndex]?.layoutPadding ?? (s.project.meta.defaultLayoutPadding ?? 20),
  );
  const currentLayoutGap = useProjectStore(
    (s) => s.project.pages[s.currentPageIndex]?.layoutGap ?? (s.project.meta.defaultLayoutGap ?? 10),
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
  const currentCoverTitleFontSize = useProjectStore(
    (s) => s.project.pages[s.currentPageIndex]?.coverTitleFontSize ?? 48,
  );
  const currentCoverTitleFontFamily = useProjectStore(
    (s) => s.project.pages[s.currentPageIndex]?.coverTitleFontFamily ?? 'Arial',
  );
  const currentCoverTitleColor = useProjectStore(
    (s) => s.project.pages[s.currentPageIndex]?.coverTitleColor ?? '#ffffff',
  );
  const currentCoverSubtitleFontSize = useProjectStore(
    (s) => s.project.pages[s.currentPageIndex]?.coverSubtitleFontSize ?? 24,
  );
  const currentCoverSubtitleFontFamily = useProjectStore(
    (s) => s.project.pages[s.currentPageIndex]?.coverSubtitleFontFamily ?? 'Arial',
  );
  const currentCoverSubtitleColor = useProjectStore(
    (s) => s.project.pages[s.currentPageIndex]?.coverSubtitleColor ?? '#ffffffcc',
  );
  const currentShowCoverSubtitle = useProjectStore(
    (s) => s.project.pages[s.currentPageIndex]?.showCoverSubtitle ?? true,
  );
  const currentChapterTitle = useProjectStore(
    (s) => s.project.pages[s.currentPageIndex]?.chapterTitle ?? '',
  );
  const currentSubchapterTitle = useProjectStore(
    (s) => s.project.pages[s.currentPageIndex]?.subchapterTitle ?? '',
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
    const initial = assignment.cropX !== undefined
      ? { x: assignment.cropX, y: assignment.cropY!, w: assignment.cropW!, h: assignment.cropH! }
      : undefined;
    setCropModal({ blob, initialCrop: initial, slotIndex: selectedSlotIndex });
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

  const handleGoHome = () => {
    closeMenu();
    const confirmed = window.confirm('Möchtest du wirklich zur Startseite zurückkehren? Nicht gespeicherte Änderungen gehen verloren.');
    if (confirmed) setShowEditor(false);
  };

  // ─── Export handlers ──────────────────────────────────────────────────
  const [showPdfDialog, setShowPdfDialog] = useState(false);

  const handleExportPdfPrompt = () => {
    closeMenu();
    setShowPdfDialog(true);
  };

  const handleExportPdfConfirm = async (level: PdfCompressionLevel) => {
    setShowPdfDialog(false);
    await exportAsPdf(pages.length, setCurrentPageIndex, projectName, level);
  };

  const handleExportPng = () => {
    closeMenu();
    exportCurrentPageAsPng(projectName, currentPageIndex);
  };

  const handleExportJpeg = () => {
    closeMenu();
    exportCurrentPageAsJpeg(projectName, currentPageIndex);
  };

  const btnPageNav =
    'min-w-8 h-8 px-2 flex items-center justify-center rounded-lg border text-sm transition-all cursor-pointer select-none';
  const btnIcon =
    'w-7 h-7 flex items-center justify-center rounded-lg border text-sm transition-all cursor-pointer select-none disabled:opacity-35 disabled:cursor-not-allowed';

  const getVisiblePageItems = useCallback((total: number, current: number): Array<number | 'ellipsis-left' | 'ellipsis-right'> => {
    if (total <= 9) return Array.from({ length: total }, (_, i) => i);

    const items: Array<number | 'ellipsis-left' | 'ellipsis-right'> = [0];

    let start = Math.max(1, current - 1);
    let end = Math.min(total - 2, current + 1);

    if (current <= 2) {
      start = 1;
      end = 3;
    } else if (current >= total - 3) {
      start = total - 4;
      end = total - 2;
    }

    if (start > 1) items.push('ellipsis-left');
    for (let i = start; i <= end; i++) items.push(i);
    if (end < total - 2) items.push('ellipsis-right');

    items.push(total - 1);
    return items;
  }, []);

  const pageItems = getVisiblePageItems(pages.length, currentPageIndex);

  const chapterJumpTargets = useMemo(() => {
    const seen = new Set<string>();
    return pages
      .map((page, index) => {
        if (page.isCover) {
          const coverLabel = (page.coverTitle ?? '').trim();
          return {
            pageIndex: index,
            label: coverLabel ? `Deckblatt • ${coverLabel}` : 'Deckblatt',
          };
        }

        const chapter = (page.chapterTitle ?? '').trim();
        const subchapter = (page.subchapterTitle ?? '').trim();
        if (!chapter && !subchapter) return null;
        const key = `${chapter}__${subchapter}`;
        if (seen.has(key)) return null;
        seen.add(key);
        const label = chapter && subchapter
          ? `${chapter} • ${subchapter}`
          : chapter || `Unterkapitel: ${subchapter}`;
        return { pageIndex: index, label };
      })
      .filter((item): item is { pageIndex: number; label: string } => item !== null);
  }, [pages]);

  return (
    <div className="editor-ui relative isolate flex flex-col w-screen h-screen bg-neutral-950 text-neutral-100" data-ui-theme={uiTheme}>
      {/* ─── Menu Bar ─── */}
      <div className="editor-topbar relative z-40 flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900/95 border border-neutral-800 rounded-xl shadow-lg mx-4 mt-4 shrink-0 backdrop-blur-sm">
        {/* Project name */}
        <div className="flex items-center gap-2 mr-1 min-w-0">
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            onFocus={() => snapshot()}
            className="editor-input text-sm text-neutral-300 font-medium bg-neutral-900 border border-neutral-700 rounded-lg
                       outline-none focus:text-white focus:border-blue-500 w-44 py-0.5 px-2
                       hover:border-neutral-500 transition-colors"
            title="Projektname bearbeiten"
          />
        </div>

        <div className="w-px h-5 bg-neutral-700/80" />

        {/* Undo / Redo */}
        <button onClick={handleUndo} disabled={!canUndo} className={`${btnIcon} border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800`} title="Rückgängig (Ctrl+Z)">↩</button>
        <button onClick={handleRedo} disabled={!canRedo} className={`${btnIcon} border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800`} title="Wiederherstellen (Ctrl+Y)">↪</button>

        <button
          onClick={() => setUiTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          className={`${btnIcon} editor-surface-control border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800`}
          title={uiTheme === 'dark' ? 'Light Mode aktivieren' : 'Dark Mode aktivieren'}
        >
          {uiTheme === 'dark' ? '☀' : '🌙'}
        </button>

        <div className="w-px h-5 bg-neutral-700/80" />

        {/* ── Datei menu ── */}
        <div className="relative" data-menu>
          <MenuButton label="Datei" isOpen={openMenu === 'datei'} onClick={() => toggleMenu('datei')} />
          {openMenu === 'datei' && (
            <div className="editor-dropdown absolute top-full left-0 mt-2 min-w-[230px] bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl z-[90] p-1">
              <MenuItem label="Neues Projekt" shortcut="Ctrl+N" onClick={handleNewProject} />
              <MenuItem label="Öffnen" shortcut="Ctrl+O" onClick={handleOpen} />
              <MenuDivider />
              <MenuItem label="Speichern" shortcut="Ctrl+S" onClick={handleSave} />
              <MenuItem label="Speichern unter" shortcut="Ctrl+Shift+S" onClick={handleSaveAs} />
              <MenuDivider />
              <MenuItem label="Exportieren als PDF" onClick={handleExportPdfPrompt} />
              <MenuItem label="Seite als PNG" onClick={handleExportPng} />
              <MenuItem label="Seite als JPEG" onClick={handleExportJpeg} />
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
                    className="editor-input px-2 py-1 text-xs rounded-md bg-neutral-800 text-white border border-neutral-600"
                  >
                    <option value={10}>10s</option>
                    <option value={30}>30s</option>
                    <option value={60}>60s</option>
                    <option value={120}>2min</option>
                    <option value={300}>5min</option>
                  </select>
                )}
              </div>
              <MenuDivider />
              <MenuItem label="Startseite" onClick={handleGoHome} />
            </div>
          )}
        </div>

        {/* ── Bearbeiten menu ── */}
        <div className="relative" data-menu>
          <MenuButton label="Bearbeiten" isOpen={openMenu === 'bearbeiten'} onClick={() => toggleMenu('bearbeiten')} />
          {openMenu === 'bearbeiten' && (
            <div className="editor-dropdown absolute top-full left-0 mt-2 min-w-[230px] bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl z-[90] p-1">
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

        {/* ── Layout menu ── */}
        <div className="relative" data-menu>
          <MenuButton label="Layout" isOpen={openMenu === 'layout'} onClick={() => toggleMenu('layout')} />
          {openMenu === 'layout' && (
            <div className="editor-dropdown absolute top-full left-0 mt-2 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl z-[90] py-3 px-3 min-w-[280px]">
              <div className="mb-2">
                <LayoutPicker currentLayoutId={currentLayoutId} onSelect={(id) => { handleLayoutSelect(id); closeMenu(); }} />
              </div>
              {currentLayoutId && (
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-neutral-700">
                  <label className="text-xs text-neutral-500">Rand</label>
                  <input
                    type="number" min={0} max={100} value={currentLayoutPadding}
                    onFocus={() => snapshot()}
                    onChange={(e) => setLayoutPadding(Math.max(0, parseInt(e.target.value) || 0))}
                    className="editor-input w-16 px-2 py-1 text-sm rounded-md bg-neutral-800 text-white border border-neutral-600"
                  />
                  {showGap && (
                    <>
                      <label className="text-xs text-neutral-500">Abstand</label>
                      <input
                        type="number" min={0} max={100} value={currentLayoutGap}
                        onFocus={() => snapshot()}
                        onChange={(e) => setLayoutGap(Math.max(0, parseInt(e.target.value) || 0))}
                        className="editor-input w-16 px-2 py-1 text-sm rounded-md bg-neutral-800 text-white border border-neutral-600"
                      />
                    </>
                  )}
                </div>
              )}

              <div className="mt-3 pt-3 border-t border-neutral-700 space-y-2">
                <div className="text-xs text-neutral-400">Projekt-Standard</div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-neutral-500">Rand</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={defaultLayoutPadding}
                    onFocus={() => snapshot()}
                    onChange={(e) => setDefaultLayoutPadding(Math.max(0, parseInt(e.target.value) || 0))}
                    className="editor-input w-16 px-2 py-1 text-sm rounded-md bg-neutral-800 text-white border border-neutral-600"
                  />
                  <label className="text-xs text-neutral-500">Abstand</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={defaultLayoutGap}
                    onFocus={() => snapshot()}
                    onChange={(e) => setDefaultLayoutGap(Math.max(0, parseInt(e.target.value) || 0))}
                    className="editor-input w-16 px-2 py-1 text-sm rounded-md bg-neutral-800 text-white border border-neutral-600"
                  />
                </div>
                <button
                  onClick={() => { snapshot(); applyLayoutDefaultsToAllPages(); }}
                  className="editor-surface-control w-full mt-1 px-2.5 py-1.5 text-xs rounded-md border border-neutral-600 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors cursor-pointer select-none"
                  title="Standard-Rand und -Abstand auf alle Seiten anwenden"
                >
                  Auf alle Seiten anwenden
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Struktur menu ── */}
        <div className="relative" data-menu>
          <MenuButton label="Struktur" isOpen={openMenu === 'struktur'} onClick={() => toggleMenu('struktur')} />
          {openMenu === 'struktur' && (
            <div className="editor-dropdown absolute top-full left-0 mt-2 min-w-[290px] bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl z-[90] p-1">
              <MenuItem
                label="Deckblatt hinzufügen"
                onClick={handleAddCoverPage}
                disabled={hasCoverPage}
              />

              <MenuDivider />

              <div className="px-3 py-2 space-y-2">
                <div className="text-xs text-neutral-400">Aktuelle Seite</div>
                <input
                  type="text"
                  placeholder="Kapitel"
                  value={currentChapterTitle}
                  onFocus={() => snapshot()}
                  onChange={(e) => setCurrentPageChapterTitle(e.target.value)}
                  className="editor-input w-full px-2 py-1 text-xs rounded-md bg-neutral-800 text-white border border-neutral-600"
                  title="Kapitel für aktuelle Seite"
                />
                <input
                  type="text"
                  placeholder="Unterkapitel"
                  value={currentSubchapterTitle}
                  onFocus={() => snapshot()}
                  onChange={(e) => setCurrentPageSubchapterTitle(e.target.value)}
                  className="editor-input w-full px-2 py-1 text-xs rounded-md bg-neutral-800 text-white border border-neutral-600"
                  title="Unterkapitel für aktuelle Seite"
                />
                {(currentChapterTitle || currentSubchapterTitle) && (
                  <button
                    onClick={() => {
                      snapshot();
                      setCurrentPageChapterTitle('');
                      setCurrentPageSubchapterTitle('');
                    }}
                    className="editor-surface-control w-full px-2 py-1 text-xs rounded-md border border-neutral-600 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors cursor-pointer select-none"
                  >
                    Kapitel/Unterkapitel entfernen
                  </button>
                )}
              </div>

              {currentIsCover && (
                <>
                  <MenuDivider />
                  <div className="px-3 py-2">
                    <label className="text-xs text-neutral-400 flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={currentShowCoverSubtitle}
                        onChange={(e) => {
                          snapshot();
                          setCoverSubtitleVisible(e.target.checked);
                        }}
                        className="accent-blue-500"
                      />
                      Untertitel auf Deckblatt anzeigen
                    </label>
                  </div>
                </>
              )}

              {chapterJumpTargets.length > 0 && (
                <>
                  <MenuDivider />
                  <div className="px-3 py-2 space-y-1">
                    <div className="text-xs text-neutral-400">Kapitel wechseln</div>
                    <select
                      value=""
                      onChange={(e) => {
                        if (!e.target.value) return;
                        setCurrentPageIndex(parseInt(e.target.value, 10));
                        closeMenu();
                      }}
                      className="editor-input w-full px-2 py-1 text-xs rounded-md bg-neutral-800 text-white border border-neutral-600"
                    >
                      <option value="">Kapitel wählen…</option>
                      {chapterJumpTargets.map((target) => (
                        <option key={`${target.pageIndex}-${target.label}`} value={target.pageIndex}>
                          {target.label} (S. {target.pageIndex + 1})
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="w-px h-5 bg-neutral-700/80" />

        {/* ── Quick insert buttons (Bild + Text + Deckblatt) ── */}
        <button onClick={handleAddImage} className="editor-surface-control px-3 py-1 text-sm rounded-lg border border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800 transition-colors cursor-pointer select-none" title="Bild einfügen">
          + Bild
        </button>
        <button onClick={handleAddText} className="editor-surface-control px-3 py-1 text-sm rounded-lg border border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800 transition-colors cursor-pointer select-none" title="Text einfügen (Ctrl+T)">
          + Text
        </button>
        {!hasCoverPage && (
          <button onClick={handleAddCoverPage} className="editor-surface-control px-3 py-1 text-sm rounded-lg border border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800 transition-colors cursor-pointer select-none" title="Deckblatt hinzufügen">
            + Deckblatt
          </button>
        )}

        {/* ── Spacer ── */}
        <div className="flex-1" />

        {/* ── Page navigation (numbers + add/delete) ── */}
        <div className="flex items-center">
          <div className="mr-2 px-2.5 py-1 rounded-md border border-neutral-700 bg-neutral-900 text-[11px] uppercase tracking-wide text-neutral-400 select-none">
            Seiten
          </div>

          <div className="flex items-center gap-1">
            {pageItems.map((item) => {
              if (item === 'ellipsis-left' || item === 'ellipsis-right') {
                return (
                  <span key={item} className="px-1 text-neutral-500 text-sm select-none">…</span>
                );
              }

              const i = item;
              return (
                <button
                  key={i}
                  onClick={() => setCurrentPageIndex(i)}
                  className={`${btnPageNav} ${
                    i === currentPageIndex
                      ? 'bg-blue-600/90 border-blue-500 text-white shadow-sm'
                      : 'bg-neutral-900 border-neutral-700 hover:bg-neutral-800 text-neutral-300'
                  }`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>

          <span className="ml-2 text-xs text-neutral-400 tabular-nums select-none">
            {currentPageIndex + 1} / {pages.length}
          </span>

          <div className="flex items-center gap-1 ml-3 pl-3 border-l border-neutral-700/80">
            <button
              onClick={() => { snapshot(); addPage(); }}
              className={`${btnPageNav} bg-neutral-900 border-neutral-700 hover:bg-neutral-800 text-neutral-300`}
              title="Neue Seite"
            >
              +
            </button>
            {pages.length > 1 && (
              <button
                onClick={() => { snapshot(); removePage(currentPageIndex); }}
                className={`${btnPageNav} bg-red-900/60 border-red-800 hover:bg-red-800/70 text-red-200`}
                title="Seite löschen"
              >
                −
              </button>
            )}
          </div>
        </div>

        {/* Hidden file inputs */}
        <input ref={fileInputRef} type="file" accept=".layox" className="hidden" onChange={handleFileSelected} />
        <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelected} />
      </div>

      {/* ─── Context bar slot (fixed height to prevent layout shift) ─── */}
      <div className="relative z-30 mx-4 mt-3 shrink-0 h-[46px]">
        {selectedTextElement ? (
          <div className="editor-context-bar h-full flex items-center gap-3 px-4 py-1 bg-neutral-900/95 border border-neutral-800 rounded-xl shadow-lg text-sm">
            <label className="text-xs text-neutral-500">Schriftart</label>
            <select
              value={selectedTextElement.fontFamily}
              onChange={(e) => { snapshot(); updateElement(selectedTextElement.id, { fontFamily: e.target.value }); }}
              className="editor-input px-2 py-0.5 text-sm rounded-md bg-neutral-800 text-white border border-neutral-600"
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
              className="editor-input w-16 px-2 py-0.5 text-sm rounded-md bg-neutral-800 text-white border border-neutral-600"
            />
            <label className="text-xs text-neutral-500">Farbe</label>
            <input
              type="color" value={selectedTextElement.color}
              onFocus={() => snapshot()}
              onChange={(e) => updateElement(selectedTextElement.id, { color: e.target.value })}
              className="w-8 h-8 rounded-md border border-neutral-600 cursor-pointer p-0.5 bg-neutral-800"
            />
          </div>
        ) : currentIsCover ? (
          <div className="editor-context-bar h-full flex items-center gap-2 px-3 py-1 bg-neutral-900/95 border border-neutral-800 rounded-xl shadow-lg text-sm">
            <label className="text-[11px] text-neutral-500">Titel</label>
            <input
              type="text" value={currentCoverTitle}
              onFocus={() => snapshot()}
              onChange={(e) => setCoverTitle(e.target.value)}
              className="editor-input w-36 px-2 py-0.5 text-xs rounded-md bg-neutral-800 text-white border border-neutral-600"
              placeholder="Titel"
            />
            <select
              value={currentCoverTitleFontFamily}
              onChange={(e) => { snapshot(); setCoverTitleStyle({ fontFamily: e.target.value }); }}
              className="editor-input w-24 px-1.5 py-0.5 text-xs rounded-md bg-neutral-800 text-white border border-neutral-600"
            >
              {FONTS.map((f) => (
                <option key={`cover-title-${f}`} value={f}>{f}</option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              max={300}
              value={currentCoverTitleFontSize}
              onFocus={() => snapshot()}
              onChange={(e) => setCoverTitleStyle({ fontSize: Math.max(1, parseInt(e.target.value) || 48) })}
              className="editor-input w-14 px-1.5 py-0.5 text-xs rounded-md bg-neutral-800 text-white border border-neutral-600"
            />
            <input
              type="color"
              value={currentCoverTitleColor}
              onFocus={() => snapshot()}
              onChange={(e) => setCoverTitleStyle({ color: e.target.value })}
              className="w-7 h-7 rounded-md border border-neutral-600 cursor-pointer p-0.5 bg-neutral-800"
            />

            <label className="text-[11px] text-neutral-400 flex items-center gap-1 ml-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={currentShowCoverSubtitle}
                onChange={(e) => {
                  snapshot();
                  setCoverSubtitleVisible(e.target.checked);
                }}
                className="accent-blue-500"
              />
              Untertitel anzeigen
            </label>

            {currentShowCoverSubtitle && (
              <>
                <label className="text-[11px] text-neutral-500">Untertitel</label>
                <input
                  type="text" value={currentCoverSubtitle}
                  onFocus={() => snapshot()}
                  onChange={(e) => setCoverSubtitle(e.target.value)}
                  className="editor-input w-28 px-2 py-0.5 text-xs rounded-md bg-neutral-800 text-white border border-neutral-600"
                  placeholder="Untertitel"
                />
                <select
                  value={currentCoverSubtitleFontFamily}
                  onChange={(e) => { snapshot(); setCoverSubtitleStyle({ fontFamily: e.target.value }); }}
                  className="editor-input w-24 px-1.5 py-0.5 text-xs rounded-md bg-neutral-800 text-white border border-neutral-600"
                >
                  {FONTS.map((f) => (
                    <option key={`cover-sub-${f}`} value={f}>{f}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  max={300}
                  value={currentCoverSubtitleFontSize}
                  onFocus={() => snapshot()}
                  onChange={(e) => setCoverSubtitleStyle({ fontSize: Math.max(1, parseInt(e.target.value) || 24) })}
                  className="editor-input w-14 px-1.5 py-0.5 text-xs rounded-md bg-neutral-800 text-white border border-neutral-600"
                />
                <input
                  type="color"
                  value={currentCoverSubtitleColor}
                  onFocus={() => snapshot()}
                  onChange={(e) => setCoverSubtitleStyle({ color: e.target.value })}
                  className="w-7 h-7 rounded-md border border-neutral-600 cursor-pointer p-0.5 bg-neutral-800"
                />
              </>
            )}
          </div>
        ) : null}
      </div>

      {/* ─── Canvas area with page arrows on sides ─── */}
      <div className="relative z-0 flex-1 flex items-center justify-center overflow-hidden gap-3 px-4 pb-4 pt-3">
        {/* Left arrow */}
        <button
          onClick={goPrevPage}
          disabled={currentPageIndex === 0}
          className="shrink-0 w-11 h-11 flex items-center justify-center rounded-2xl border border-neutral-600
                     bg-gradient-to-b from-neutral-800 to-neutral-900 hover:from-neutral-700 hover:to-neutral-800 text-neutral-200 disabled:opacity-25
                     disabled:cursor-not-allowed transition-all shadow-[0_8px_18px_rgba(0,0,0,0.35)] cursor-pointer select-none"
          title="Vorherige Seite (←)"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 12H6" />
            <path d="M12 18l-6-6 6-6" />
          </svg>
        </button>

        <div className="p-2 rounded-2xl border border-neutral-800 bg-neutral-900/80 shadow-2xl">
          <EditorCanvas />
        </div>

        {/* Right arrow / Add page */}
        {currentPageIndex >= pages.length - 1 ? (
          <button
            onClick={() => { snapshot(); addPage(); }}
            className="shrink-0 w-11 h-11 flex items-center justify-center rounded-xl border border-green-700/50
                       bg-neutral-900 hover:bg-green-900/40 text-green-300
                       transition-all cursor-pointer select-none text-2xl leading-none"
            title="Neue Seite hinzufügen"
          >
            +
          </button>
        ) : (
          <button
            onClick={goNextPage}
            className="shrink-0 w-11 h-11 flex items-center justify-center rounded-2xl border border-neutral-600
                       bg-gradient-to-b from-neutral-800 to-neutral-900 hover:from-neutral-700 hover:to-neutral-800 text-neutral-200
                       transition-all shadow-[0_8px_18px_rgba(0,0,0,0.35)] cursor-pointer select-none"
            title="Nächste Seite (→)"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 12h14" />
              <path d="M12 6l6 6-6 6" />
            </svg>
          </button>
        )}
      </div>

      {/* ─── Crop modal ─── */}
      {cropModal && (
        <CropModal
          imageBlob={cropModal.blob}
          initialCrop={cropModal.initialCrop}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}

      {/* ─── PDF compression dialog ─── */}
      {showPdfDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
          <div className="editor-dropdown bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl p-5 w-80">
            <h3 className="text-white font-semibold text-base mb-3">PDF-Kompression</h3>
            <div className="flex flex-col gap-2">
              {PDF_COMPRESSION_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleExportPdfConfirm(preset.id)}
                  className="text-left px-3 py-2.5 rounded-lg bg-neutral-800 hover:bg-blue-600/20
                             border border-neutral-600 hover:border-blue-500 transition-colors
                             cursor-pointer select-none"
                >
                  <div className="text-sm text-white font-medium">{preset.label}</div>
                  <div className="text-xs text-neutral-400 mt-0.5">{preset.description}</div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowPdfDialog(false)}
              className="mt-3 w-full py-1.5 text-sm rounded-lg bg-neutral-800 hover:bg-neutral-700
                         text-neutral-300 border border-neutral-600 cursor-pointer select-none transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;