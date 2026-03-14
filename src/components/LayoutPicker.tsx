import { useState, useRef, useEffect } from 'react';
import { LAYOUT_TEMPLATES } from '../utils/layouts';
import type { LayoutTemplate } from '../types';
import { CANVAS_H, CANVAS_W } from '../constants/canvas';

const THUMB_W = 80;
const THUMB_H = 60;
const SCALE_X = THUMB_W / CANVAS_W;
const SCALE_Y = THUMB_H / CANVAS_H;

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
  uiTheme,
  layoutPlaceholder,
  freeLabel,
  freeThumbLabel,
  slotSingularLabel,
  slotPluralLabel,
  onSelect,
}: {
  currentLayoutId?: string;
  uiTheme: 'dark' | 'light';
  layoutPlaceholder: string;
  freeLabel: string;
  freeThumbLabel: string;
  slotSingularLabel: string;
  slotPluralLabel: string;
  onSelect: (layoutId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isLight = uiTheme === 'light';

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
        className={`editor-surface-control flex items-center gap-2 px-2.5 py-1.5 text-sm rounded-lg border cursor-pointer select-none transition-colors ${
          isLight
            ? 'bg-slate-100 hover:bg-slate-200 text-slate-900 border-slate-300'
            : 'bg-neutral-800 hover:bg-neutral-700 text-white border-neutral-600'
        }`}
      >
        {active ? (
          <>
            <LayoutThumb layout={active} isActive />
            <span className="max-w-24 truncate">{active.name}</span>
          </>
        ) : (
          <span className={isLight ? 'text-slate-500' : 'text-neutral-400'}>{layoutPlaceholder}</span>
        )}
        <span className={`text-[10px] ml-auto ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>▾</span>
      </button>

      {open && (
        <div
          className={`editor-dropdown absolute top-full left-0 mt-2 rounded-xl shadow-2xl z-50 p-2 w-[310px] max-h-[400px] overflow-y-auto ${
            isLight ? 'bg-white border border-slate-300' : 'bg-neutral-900 border border-neutral-700'
          }`}
        >
          {/* Free mode */}
          <button
            onClick={() => { onSelect(null); setOpen(false); }}
            className={`editor-surface-control flex items-center gap-3 w-full px-3 py-2 rounded text-left text-sm cursor-pointer ${
              !currentLayoutId
                ? isLight
                  ? 'bg-blue-50 border border-blue-300 text-blue-700'
                  : 'bg-blue-600/20 border border-blue-500/40 text-blue-300'
                : isLight
                  ? 'hover:bg-slate-100 text-slate-700 border border-transparent'
                  : 'hover:bg-neutral-800 text-neutral-300 border border-transparent'
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
                {freeThumbLabel}
              </text>
            </svg>
            <span>{freeLabel}</span>
          </button>

          <div className={`h-px my-1 ${isLight ? 'bg-slate-200' : 'bg-neutral-700'}`} />

          {LAYOUT_TEMPLATES.map((layout) => (
            <button
              key={layout.id}
              onClick={() => { onSelect(layout.id); setOpen(false); }}
              className={`editor-surface-control flex items-center gap-3 w-full px-3 py-2 rounded text-left text-sm cursor-pointer ${
                currentLayoutId === layout.id
                  ? isLight
                    ? 'bg-blue-50 border border-blue-300 text-blue-700'
                    : 'bg-blue-600/20 border border-blue-500/40 text-blue-300'
                  : isLight
                    ? 'hover:bg-slate-100 text-slate-700 border border-transparent'
                    : 'hover:bg-neutral-800 text-neutral-300 border border-transparent'
              }`}
            >
              <LayoutThumb layout={layout} isActive={currentLayoutId === layout.id} />
              <div>
                <div className="font-medium">{layout.name}</div>
                <div className={`text-xs ${isLight ? 'text-slate-500' : 'text-neutral-500'}`}>
                  {layout.slots.length} {layout.slots.length === 1 ? slotSingularLabel : slotPluralLabel}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
