import type { Translator } from '../../i18n';
import { useDialogFocus } from '../common/useDialogFocus';

const SHORTCUTS = [
  ['Ctrl+S', 'save'],
  ['Ctrl+Shift+S', 'saveAs'],
  ['Ctrl+O', 'open'],
  ['Ctrl+N', 'newProject'],
  ['Ctrl+I', 'addImageLabel'],
  ['Ctrl+T', 'addTextLabel'],
  ['Ctrl+Z', 'undo'],
  ['Ctrl+Y / Ctrl+Shift+Z', 'redo'],
  ['Delete / Backspace', 'delete'],
  ['← / →', 'pages'],
] as const;

export default function KeyboardShortcutsDialog({
  open,
  t,
  onClose,
}: {
  open: boolean;
  t: Translator;
  onClose: () => void;
}) {
  const dialogRef = useDialogFocus<HTMLDivElement>(open, onClose);
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/65 px-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="keyboard-shortcuts-title"
        tabIndex={-1}
        className="editor-dropdown w-[min(92vw,520px)] rounded-2xl border border-neutral-700 bg-neutral-900 p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between gap-4">
          <h2 id="keyboard-shortcuts-title" className="text-base font-semibold text-neutral-100">
            {t('keyboardShortcuts')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="editor-surface-control min-h-11 rounded-lg border border-neutral-600 bg-neutral-800 px-3 text-sm text-neutral-200 hover:bg-neutral-700"
          >
            {t('close')}
          </button>
        </div>
        <dl className="mt-4 divide-y divide-neutral-700/70">
          {SHORTCUTS.map(([shortcut, labelKey]) => (
            <div key={shortcut} className="flex items-center justify-between gap-5 py-2.5">
              <dt className="text-sm text-neutral-300">{t(labelKey)}</dt>
              <dd>
                <kbd className="rounded-md border border-neutral-600 bg-neutral-800 px-2 py-1 font-mono text-xs text-neutral-100">
                  {shortcut}
                </kbd>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
