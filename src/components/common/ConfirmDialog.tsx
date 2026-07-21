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
}: {
  open: boolean;
  title: string;
  message: string;
  cancelLabel: string;
  confirmLabel: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
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
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="min-h-11 rounded-lg border border-neutral-600 bg-neutral-800 px-4 py-2 text-neutral-200 hover:bg-neutral-700">
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} className={`min-h-11 rounded-lg px-4 py-2 text-white ${danger ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
