import { useMemo, useState } from 'react';
import BlobImage from '../common/BlobImage';
import { useDialogFocus } from '../common/useDialogFocus';

export default function AssetLibraryModal({
  open,
  assetBlobs,
  title,
  closeLabel,
  emptyLabel,
  searchPlaceholder,
  usageLabel,
  removeLabel,
  unusedLabel,
  usageCounts,
  onInsert,
  onRemove,
  onClose,
}: {
  open: boolean;
  assetBlobs: Record<string, Blob>;
  title: string;
  closeLabel: string;
  emptyLabel: string;
  searchPlaceholder: string;
  usageLabel: (count: number) => string;
  removeLabel: string;
  unusedLabel: string;
  usageCounts: Record<string, number>;
  onInsert: (assetPath: string) => void;
  onRemove: (assetPath: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [onlyUnused, setOnlyUnused] = useState(false);
  const assetPaths = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return Object.keys(assetBlobs)
      .filter((assetPath) => {
        if (onlyUnused && (usageCounts[assetPath] ?? 0) > 0) return false;
        const fileName = assetPath.split('/').pop() ?? assetPath;
        return !needle || fileName.toLocaleLowerCase().includes(needle);
      })
      .sort();
  }, [assetBlobs, onlyUnused, search, usageCounts]);
  const dialogRef = useDialogFocus<HTMLDivElement>(open, onClose);
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[112] bg-black/60 backdrop-blur-[1px] flex items-center justify-center px-6 py-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="asset-library-title"
        tabIndex={-1}
        className="editor-dropdown w-[min(94vw,980px)] h-[min(86vh,760px)] bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-700/80">
          <h3 id="asset-library-title" className="text-sm font-semibold text-neutral-100">{title}</h3>
          <div className="flex items-center gap-2">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={searchPlaceholder}
              className="editor-input min-h-11 w-56 rounded-md border border-neutral-600 bg-neutral-800 px-2 text-xs text-white"
            />
            <label className="flex min-h-11 items-center gap-2 rounded-md border border-neutral-700 px-2 text-xs text-neutral-300">
              <input type="checkbox" checked={onlyUnused} onChange={(event) => setOnlyUnused(event.target.checked)} />
              {unusedLabel}
            </label>
            <button type="button" onClick={onClose} className="editor-surface-control min-h-11 px-2.5 py-1 rounded-md border border-neutral-600 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs">
              {closeLabel}
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {assetPaths.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-neutral-400">{emptyLabel}</div>
          ) : (
            <div className="grid gap-3 justify-center" style={{ gridTemplateColumns: 'repeat(auto-fill, 180px)' }}>
              {assetPaths.map((assetPath) => (
                <div key={assetPath} className="group relative overflow-hidden rounded-xl border border-neutral-700 bg-neutral-900/80">
                  <button
                    type="button"
                    onClick={() => onInsert(assetPath)}
                    className="block text-left hover:bg-neutral-800/90 transition-colors"
                  >
                    <div className="w-[180px] h-[135px] bg-neutral-950 flex items-center justify-center overflow-hidden">
                      <BlobImage blob={assetBlobs[assetPath]} alt="" className="w-full h-full object-cover" draggable={false} />
                    </div>
                    <div className="border-t border-neutral-700/80 px-2 py-1.5">
                      <div className="truncate text-[11px] text-neutral-300">{assetPath.split('/').pop() || assetPath}</div>
                      <div className="mt-0.5 text-[10px] text-neutral-500">{usageLabel(usageCounts[assetPath] ?? 0)}</div>
                    </div>
                  </button>
                  {(usageCounts[assetPath] ?? 0) === 0 && (
                    <button
                      type="button"
                      onClick={() => onRemove(assetPath)}
                      className="absolute right-2 top-2 hidden min-h-9 min-w-9 rounded-full bg-red-950/90 text-red-100 shadow group-hover:block focus:block"
                      aria-label={removeLabel}
                      title={removeLabel}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
