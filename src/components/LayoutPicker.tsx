import { useState, useRef, useEffect } from 'react';
import { LAYOUT_TEMPLATES } from '../utils/layouts';
import type { LayoutTemplate } from '../types';

const THUMB_W = 80;
const THUMB_H = 60;
const SCALE_X = THUMB_W / 800;
const SCALE_Y = THUMB_H / 600;

function LayoutThumb({ layout, isActive }: { layout: LayoutTemplate; isActive: boolean }) {
  return (
    <svg width={THUMB_W} height={THUMB_H} className="block shrink-0">
      <rect width={THUMB_W} height={THUMB_H} fill="#fff" rx={3} />
      {layout.slots.map((s, i) => (
        <rect
          key={i}
          x={s.x * SCALE_X}
          y={s.y * SCALE_Y}
          width={s.width * SCALE_X}
          height={s.height * SCALE_Y}
          fill={isActive ? '#3b82f6' : '#94a3b8'}
          rx={2}
        />
      ))}
    </svg>
  );
}

export default function LayoutPicker({
  currentLayoutId,
  onSelect,
}: {
  currentLayoutId?: string;
  onSelect: (layoutId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const active = LAYOUT_TEMPLATES.find((l) => l.id === currentLayoutId);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-2.5 py-1.5 text-sm rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-600 cursor-pointer select-none transition-colors"
      >
        {active ? (
          <>
            <LayoutThumb layout={active} isActive />
            <span className="max-w-24 truncate">{active.name}</span>
          </>
        ) : (
          <span className="text-neutral-400">Layout…</span>
        )}
        <span className="text-[10px] ml-auto">▾</span>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl z-50 p-2 w-[310px] max-h-[400px] overflow-y-auto">
          {/* Free mode */}
          <button
            onClick={() => { onSelect(null); setOpen(false); }}
            className={`flex items-center gap-3 w-full px-3 py-2 rounded text-left text-sm cursor-pointer ${
              !currentLayoutId ? 'bg-blue-600/20 border border-blue-500/40 text-blue-300' : 'hover:bg-neutral-800 text-neutral-300 border border-transparent'
            }`}
          >
            <svg width={THUMB_W} height={THUMB_H} className="block shrink-0">
              <rect width={THUMB_W} height={THUMB_H} fill="#fff" rx={3} />
              <text
                x={THUMB_W / 2}
                y={THUMB_H / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="10"
                fill="#aaa"
              >
                Frei
              </text>
            </svg>
            <span>Freie Anordnung</span>
          </button>

          <div className="h-px bg-neutral-700 my-1" />

          {LAYOUT_TEMPLATES.map((layout) => (
            <button
              key={layout.id}
              onClick={() => { onSelect(layout.id); setOpen(false); }}
              className={`flex items-center gap-3 w-full px-3 py-2 rounded text-left text-sm cursor-pointer ${
                currentLayoutId === layout.id ? 'bg-blue-600/20 border border-blue-500/40 text-blue-300' : 'hover:bg-neutral-800 text-neutral-300 border border-transparent'
              }`}
            >
              <LayoutThumb layout={layout} isActive={currentLayoutId === layout.id} />
              <div>
                <div className="font-medium">{layout.name}</div>
                <div className="text-xs text-neutral-500">
                  {layout.slots.length} {layout.slots.length === 1 ? 'Platz' : 'Plätze'}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
