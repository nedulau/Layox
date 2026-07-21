export function MenuButton({
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
          ? 'bg-neutral-800 border-neutral-500 text-white shadow-sm'
          : 'bg-neutral-900 border-neutral-700 text-neutral-200 hover:bg-neutral-800 hover:border-neutral-600 hover:text-white'
      }`}
    >
      {label}
    </button>
  );
}

export function MenuItem({
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

export function MenuDivider() {
  return <div className="h-px bg-neutral-700/80 my-1" />;
}
