import { useEffect, useRef, useState } from 'react';

type NewProjectModalProps = {
  open: boolean;
  title?: string;
  description?: string;
  initialName?: string;
  cancelLabel?: string;
  confirmLabel?: string;
  placeholder?: string;
  onClose: () => void;
  onConfirm: (name: string) => void;
};

function NewProjectModal({
  open,
  title = 'Neues Projekt',
  description = 'Gib einen Namen für dein Projekt ein.',
  initialName = 'Neues Projekt',
  cancelLabel = 'Abbrechen',
  confirmLabel = 'Erstellen',
  placeholder = 'Projektname',
  onClose,
  onConfirm,
}: NewProjectModalProps) {
  const [name, setName] = useState(initialName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open, initialName]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 backdrop-blur-sm">
      <div className="w-[min(92vw,420px)] rounded-2xl border border-neutral-700 bg-neutral-900 shadow-2xl p-5">
        <h3 className="text-white text-base font-semibold">{title}</h3>
        <p className="text-neutral-400 text-xs mt-1">{description}</p>

        <form
          className="mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            onConfirm(name.trim() || 'Unbenanntes Projekt');
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-neutral-600 bg-neutral-800 text-white text-sm outline-none focus:border-blue-500"
            placeholder={placeholder}
          />

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-neutral-600 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-sm transition-colors cursor-pointer select-none"
            >
              {cancelLabel}
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg border border-blue-600 bg-blue-600 hover:bg-blue-500 text-white text-sm transition-colors cursor-pointer select-none"
            >
              {confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default NewProjectModal;
