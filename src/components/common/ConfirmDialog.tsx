import { useDialogFocus } from './useDialogFocus';

export default function ConfirmDialog({
  open,
  title,
  message,
  cancelLabel,
  confirmLabel,
  danger = false,
  onCancel,
  onConfirm,
  saveLabel,
  onSave,
  busy = false,
  error,
}: {
  open: boolean;
  title: string;
  message: string;
  cancelLabel: string;
  confirmLabel: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  saveLabel?: string;
  onSave?: () => void;
  busy?: boolean;
  error?: string | null;
}) {
  const dialogRef = useDialogFocus<HTMLDivElement>(open, onCancel);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/65 px-5">
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        tabIndex={-1}
        className="editor-dropdown w-[min(92vw,440px)] rounded-2xl border border-neutral-700 bg-neutral-900 p-5 shadow-2xl"
      >
        <h2 id="confirm-dialog-title" className="text-base font-semibold text-white">{title}</h2>
        <p id="confirm-dialog-message" className="mt-2 text-sm leading-6 text-neutral-300">{message}</p>
        {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
        <div className="mt-5 flex flex-wrap justify-end gap-2" aria-busy={busy}>
          <button type="button" onClick={onCancel} disabled={busy} className="min-h-11 rounded-lg border border-neutral-600 bg-neutral-800 px-4 py-2 text-neutral-200 hover:bg-neutral-700 disabled:opacity-50">
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} disabled={busy} className={`min-h-11 rounded-lg px-4 py-2 text-white disabled:opacity-50 ${danger ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'}`}>
            {confirmLabel}
          </button>
          {onSave && saveLabel && (
            <button type="button" onClick={onSave} disabled={busy} className="min-h-11 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-500 disabled:opacity-50">
              {saveLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
