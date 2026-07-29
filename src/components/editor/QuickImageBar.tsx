import type { Translator } from '../../i18n';
import BlobImage from '../common/BlobImage';

export default function QuickImageBar({
  t,
  assetPaths,
  assetBlobs,
  selectedAssetPath,
  onSelect,
  onOpenLibrary,
}: {
  t: Translator;
  assetPaths: string[];
  assetBlobs: Record<string, Blob>;
  selectedAssetPath: string | null;
  onSelect: (assetPath: string) => void;
  onOpenLibrary: () => void;
}) {
  return (
    <div className="editor-context-bar order-3 basis-full mt-2 pt-2 border-t border-neutral-800/90 flex items-center gap-3 px-1 pb-1 text-sm">
      <div className="flex-1 min-w-0 overflow-x-auto">
        {assetPaths.length === 0 ? (
          <div className="text-xs text-neutral-500 py-1">{t('noAssets')}</div>
        ) : (
          <div className="flex items-center gap-2 pr-1">
            <button
              type="button"
              onClick={onOpenLibrary}
              className="shrink-0 h-14 px-3 rounded-md border border-neutral-700 bg-neutral-900 text-neutral-200 text-xs hover:border-neutral-500 transition-colors cursor-pointer select-none"
            >
              {t('assetLibrary')}
            </button>

            {assetPaths.map((assetPath) => {
              const isActive = selectedAssetPath === assetPath;
              return (
                <button
                  key={`quick-insert-${assetPath}`}
                  type="button"
                  onClick={() => onSelect(assetPath)}
                  className={`shrink-0 w-14 h-14 rounded-md border overflow-hidden transition-colors cursor-pointer select-none ${
                    isActive
                      ? 'border-blue-500 ring-1 ring-blue-500/80'
                      : 'border-neutral-700 hover:border-neutral-500'
                  }`}
                  title={assetPath.split('/').pop() || assetPath}
                >
                  {assetBlobs[assetPath] ? (
                    <BlobImage
                      blob={assetBlobs[assetPath]}
                      alt=""
                      className="w-full h-full object-cover"
                      draggable={false}
                    />
                  ) : (
                    <div className="w-full h-full bg-neutral-900 flex items-center justify-center text-[10px] text-neutral-500">
                      ...
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedAssetPath && (
        <span className="text-[11px] text-blue-300 whitespace-nowrap">
          {t('insertFromLibrary')}
        </span>
      )}
    </div>
  );
}
