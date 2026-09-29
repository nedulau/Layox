import { useEffect, useMemo, useState } from 'react';
import type { Page } from '../../types';
import type { Translator } from '../../i18n';
import { filterAndSortAssets, indexAssetUsage, getAssetFileName, type AssetUsageLocation } from '../../domain/assetLibrary';
import { readImageMetadata, type ImageMetadata, type ImageOrientation } from '../../utils/imageMetadata';
import BlobImage from '../common/BlobImage';
import { useDialogFocus } from '../common/useDialogFocus';

export default function AssetLibraryModal({
  open,
  assetBlobs,
  pages,
  t,
  onNavigate,
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
  pages: Page[];
  t: Translator;
  onNavigate: (location: AssetUsageLocation) => void;
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
  const usageLocations = useMemo(() => indexAssetUsage(pages), [pages]);
  const [search, setSearch] = useState('');
  const [onlyUnused, setOnlyUnused] = useState(false);
  const [orientation, setOrientation] = useState<'all' | ImageOrientation>('all');
  const [sort, setSort] = useState<'name' | 'capture-newest' | 'capture-oldest'>('name');
  const [metadata, setMetadata] = useState<Record<string, { blob: Blob; value: ImageMetadata }>>({});
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const entries = Object.entries(assetBlobs);
    void (async () => {
      // Limit concurrent work and publish metadata incrementally for large albums.
      for (let start = 0; start < entries.length && !cancelled; start += 4) {
        const batch = await Promise.all(entries.slice(start, start + 4).map(async ([path, blob]) => [path, { blob, value: await readImageMetadata(blob) }] as const));
        if (!cancelled) setMetadata((current) => ({ ...Object.fromEntries(Object.entries(current).filter(([path, entry]) => assetBlobs[path] === entry.blob)), ...Object.fromEntries(batch) }));
      }
    })();
    return () => { cancelled = true; };
  }, [assetBlobs, open]);
  const details = useMemo(() => Object.fromEntries(Object.entries(metadata).filter(([path, entry]) => assetBlobs[path] === entry.blob).map(([path, entry]) => [path, entry.value])), [assetBlobs, metadata]);
  const assetPaths = useMemo(() => filterAndSortAssets(Object.keys(assetBlobs), details, { search, onlyUnused, orientation, sort, usageCounts }), [assetBlobs, details, onlyUnused, orientation, search, sort, usageCounts]);
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
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-neutral-700/80">
          <h3 id="asset-library-title" className="text-sm font-semibold text-neutral-100">{title}</h3>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label={searchPlaceholder}
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
        <div className="flex flex-wrap gap-3 border-b border-neutral-700 px-4 py-3">
          <label className="text-xs text-neutral-400">{t('imageOrientation')}<select value={orientation} onChange={(event) => setOrientation(event.target.value as typeof orientation)} className="editor-input ml-2 min-h-11 rounded-lg border border-neutral-700 bg-neutral-800 px-2 text-neutral-200">
            {(['all', 'landscape', 'portrait', 'square', 'unknown'] as const).map((value) => <option key={value} value={value}>{t(({ all: 'assetsAll', landscape: 'imageLandscape', portrait: 'imagePortrait', square: 'imageSquare', unknown: 'imageUnknown' } as const)[value])}</option>)}
          </select></label>
          <label className="text-xs text-neutral-400">{t('imageSort')}<select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} className="editor-input ml-2 min-h-11 rounded-lg border border-neutral-700 bg-neutral-800 px-2 text-neutral-200">
            <option value="name">{t('imageSortName')}</option><option value="capture-newest">{t('imageSortNewest')}</option><option value="capture-oldest">{t('imageSortOldest')}</option>
          </select></label>
          <span className="self-center text-xs text-neutral-400" role="status">{assetPaths.length} / {Object.keys(assetBlobs).length}</span>
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
                      <BlobImage blob={assetBlobs[assetPath]} alt="" className="w-full h-full object-cover" draggable={false} loading="lazy" />
                    </div>
                    <div className="border-t border-neutral-700/80 px-2 py-1.5">
                      <div className="truncate text-[11px] text-neutral-300">{getAssetFileName(assetPath)}</div>
                      <div className="mt-0.5 text-[10px] text-neutral-500">{usageLabel(usageCounts[assetPath] ?? 0)}</div>
                      <div className="mt-1 text-[10px] text-neutral-400">{details[assetPath] ? `${details[assetPath].width} × ${details[assetPath].height} px` : '…'}</div>
                      <div className="mt-1 text-[10px] text-neutral-400">{details[assetPath]?.capturedAt?.replace('T', ' ') ?? t('noCaptureDate')}</div>
                    </div>
                  </button>
                  <div className="flex flex-wrap gap-1 px-2 pb-2">{(usageLocations[assetPath] ?? []).map((location) => <button key={`${location.pageIndex}-${location.slotIndex ?? location.elementId}`} type="button" onClick={() => onNavigate(location)} className="min-h-11 rounded-lg border border-neutral-700 px-2 text-[11px] text-blue-200" aria-label={`${t('goToImageUsage')}: ${t('pageLabel')} ${location.pageIndex + 1}${location.slotIndex === undefined ? '' : `, ${t('imageSlotLabel')} ${location.slotIndex + 1}`}`}>
                    {t('pageLabel')} {location.pageIndex + 1}{location.slotIndex === undefined ? '' : ` · ${location.slotIndex + 1}`}
                  </button>)}</div>
                  {(usageCounts[assetPath] ?? 0) === 0 && (
                    <button
                      type="button"
                      onClick={() => onRemove(assetPath)}
                      className="absolute right-2 top-2 min-h-11 min-w-11 rounded-full bg-red-950/90 text-red-100 shadow "
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
