import { useMemo } from 'react';
import BlobImage from '../common/BlobImage';
import { useDialogFocus } from '../common/useDialogFocus';

export default function AssetLibraryModal({
  open,
  assetBlobs,
  title,
  closeLabel,
  emptyLabel,
  onInsert,
  onClose,
}: {
  open: boolean;
  assetBlobs: Record<string, Blob>;
  title: string;
  closeLabel: string;
  emptyLabel: string;
  onInsert: (assetPath: string) => void;
  onClose: () => void;
}) {
  const assetPaths = useMemo(() => Object.keys(assetBlobs).sort(), [assetBlobs]);
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
          <button type="button" onClick={onClose} className="editor-surface-control px-2.5 py-1 rounded-md border border-neutral-600 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs">
            {closeLabel}
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {assetPaths.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-neutral-400">{emptyLabel}</div>
          ) : (
            <div className="grid gap-3 justify-center" style={{ gridTemplateColumns: 'repeat(auto-fill, 180px)' }}>
              {assetPaths.map((assetPath) => (
                <button
                  key={assetPath}
                  type="button"
                  onClick={() => {
                    onInsert(assetPath);
                    onClose();
                  }}
                  className="group text-left rounded-xl border border-neutral-700 bg-neutral-900/80 hover:bg-neutral-800/90 transition-colors overflow-hidden"
                >
                  <div className="w-[180px] h-[135px] bg-neutral-950 flex items-center justify-center overflow-hidden">
                    <BlobImage blob={assetBlobs[assetPath]} alt="" className="w-full h-full object-cover" draggable={false} />
                  </div>
                  <div className="px-2 py-1.5 border-t border-neutral-700/80 text-[11px] text-neutral-400 truncate">
                    {assetPath.split('/').pop() || assetPath}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
