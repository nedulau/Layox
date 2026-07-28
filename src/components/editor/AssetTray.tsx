import { useMemo, useState } from 'react';
import type { Translator } from '../../i18n';
import BlobImage from '../common/BlobImage';

export interface AssetTrayItem {
  assetPath: string;
  blob: Blob;
  usageCount: number;
}

type AssetFilter = 'all' | 'unused' | 'used';

export default function AssetTray({
  t,
  items,
  selectedAssetPath,
  importing,
  onImport,
  onSelect,
  onOpenLibrary,
  onRemove,
}: {
  t: Translator;
  items: AssetTrayItem[];
  selectedAssetPath: string | null;
  importing: boolean;
  onImport: () => void;
  onSelect: (assetPath: string) => void;
  onOpenLibrary: () => void;
  onRemove: (assetPath: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [filter, setFilter] = useState<AssetFilter>('all');
  const [search, setSearch] = useState('');
  const visibleItems = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return items.filter((item) => {
      if (filter === 'used' && item.usageCount === 0) return false;
      if (filter === 'unused' && item.usageCount > 0) return false;
      const fileName = item.assetPath.split('/').pop() ?? item.assetPath;
      return !needle || fileName.toLocaleLowerCase().includes(needle);
    });
  }, [filter, items, search]);

  return (
    <section className="editor-asset-tray mx-4 mb-3 shrink-0 rounded-xl border border-neutral-800 bg-neutral-900/95 shadow-lg">
      <div className="flex min-h-11 items-center gap-2 px-2 py-1.5">
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className="editor-surface-control min-h-11 min-w-11 rounded-lg border border-neutral-700 bg-neutral-900 px-2 text-neutral-300 hover:bg-neutral-800"
          aria-label={collapsed ? t('expandAssets') : t('collapseAssets')}
          title={collapsed ? t('expandAssets') : t('collapseAssets')}
        >
          {collapsed ? '▴' : '▾'}
        </button>
        <strong className="text-xs font-semibold text-neutral-200">{t('assetLibrary')}</strong>
        <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-[11px] text-neutral-400">{items.length}</span>
        <button
          type="button"
          onClick={onImport}
          disabled={importing}
          className="editor-surface-control min-h-11 rounded-lg border border-blue-700 bg-blue-600/20 px-3 text-xs font-medium text-blue-100 hover:bg-blue-600/30 disabled:opacity-50"
        >
          {importing ? t('importingImages') : t('importImages')}
        </button>
        <button
          type="button"
          onClick={onOpenLibrary}
          className="editor-surface-control min-h-11 rounded-lg border border-neutral-700 bg-neutral-800 px-3 text-xs text-neutral-200 hover:bg-neutral-700"
        >
          {t('openAssetLibrary')}
        </button>
        <span className="hidden text-[11px] text-neutral-500 xl:inline">{t('assetPlacementHint')}</span>
      </div>

      {!collapsed && (
        <div className="flex items-stretch gap-2 border-t border-neutral-800 px-2 py-2">
          <div className="flex w-40 shrink-0 flex-col gap-1">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('searchImages')}
              className="editor-input min-h-9 rounded-md border border-neutral-700 bg-neutral-800 px-2 text-xs text-neutral-100"
            />
            <div className="grid grid-cols-3 gap-1">
              {([
                ['all', 'assetsAll'],
                ['unused', 'assetsUnused'],
                ['used', 'assetsUsed'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={`min-h-8 rounded px-1 text-[10px] ${
                    filter === value
                      ? 'bg-blue-600 text-white'
                      : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                  }`}
                >
                  {t(label)}
                </button>
              ))}
            </div>
          </div>

          <div className="min-w-0 flex-1 overflow-x-auto">
            {visibleItems.length === 0 ? (
              <div className="flex h-[78px] items-center justify-center text-xs text-neutral-500">
                {items.length === 0 ? t('noAssets') : t('noMatchingAssets')}
              </div>
            ) : (
              <div className="flex gap-2 pr-1">
                {visibleItems.map((item) => {
                  const fileName = item.assetPath.split('/').pop() || item.assetPath;
                  const active = selectedAssetPath === item.assetPath;
                  return (
                    <div key={item.assetPath} className="group relative shrink-0">
                      <button
                        type="button"
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = 'copy';
                          event.dataTransfer.setData('application/x-layox-asset', item.assetPath);
                        }}
                        onClick={() => onSelect(item.assetPath)}
                        className={`h-[78px] w-[104px] overflow-hidden rounded-lg border bg-neutral-950 text-left ${
                          active
                            ? 'border-blue-500 ring-1 ring-blue-500'
                            : 'border-neutral-700 hover:border-neutral-500'
                        }`}
                        title={`${fileName} · ${t('imageUsage').replace('{count}', String(item.usageCount))}`}
                      >
                        <BlobImage blob={item.blob} alt="" draggable={false} className="h-[58px] w-full object-cover" />
                        <span className="block truncate px-1.5 py-0.5 text-[10px] text-neutral-400">{fileName}</span>
                      </button>
                      {item.usageCount === 0 && (
                        <button
                          type="button"
                          onClick={() => onRemove(item.assetPath)}
                          className="absolute right-1 top-1 hidden min-h-7 min-w-7 rounded-full bg-red-950/90 text-xs text-red-100 shadow group-hover:block focus:block"
                          aria-label={t('removeUnusedAsset')}
                          title={t('removeUnusedAsset')}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
