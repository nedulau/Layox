import type { Translator } from '../../i18n';
import type { ImageElement, TextElement } from '../../types';
import useProjectStore from '../../store/useProjectStore';

function NumberField({
  label,
  value,
  min,
  max,
  onFocus,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onFocus: () => void;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid grid-cols-[1fr_72px] items-center gap-2 text-xs text-neutral-400">
      <span>{label}</span>
      <input
        type="number"
        value={Math.round(value)}
        min={min}
        max={max}
        onFocus={onFocus}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(next);
        }}
        className="editor-input min-h-9 w-full rounded-md border border-neutral-700 bg-neutral-800 px-2 text-right text-xs text-neutral-100"
      />
    </label>
  );
}

export default function PropertiesInspector({
  t,
  fonts,
  onStartCrop,
  onReplaceImage,
  onDelete,
}: {
  t: Translator;
  fonts: string[];
  onStartCrop: () => void;
  onReplaceImage: () => void;
  onDelete: () => void;
}) {
  const page = useProjectStore((state) => state.project.pages[state.currentPageIndex]);
  const selectedElementId = useProjectStore((state) => state.selectedElementId);
  const selectedSlotIndex = useProjectStore((state) => state.selectedSlotIndex);
  const selectedElement = page?.elements.find((element) => element.id === selectedElementId);
  const assignment = selectedSlotIndex === null ? undefined : page?.slotAssignments?.[selectedSlotIndex];
  const snapshot = useProjectStore((state) => state.snapshot);
  const updateElement = useProjectStore((state) => state.updateElement);
  const updateSlotOffset = useProjectStore((state) => state.updateSlotOffset);
  const updateSlotScale = useProjectStore((state) => state.updateSlotScale);
  const clearSlotCrop = useProjectStore((state) => state.clearSlotCrop);
  const setPageBackground = useProjectStore((state) => state.setPageBackground);

  const updateText = (element: TextElement, changes: Partial<TextElement>) => {
    updateElement(element.id, changes);
  };
  const updateImage = (element: ImageElement, changes: Partial<ImageElement>) => {
    updateElement(element.id, changes);
  };

  return (
    <aside className="editor-properties hidden h-full w-64 shrink-0 overflow-y-auto rounded-xl border border-neutral-800 bg-neutral-900/95 p-3 xl:block">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-300">{t('properties')}</h2>

      {assignment && selectedSlotIndex !== null ? (
        <section className="mt-3 space-y-3">
          <h3 className="text-sm font-medium text-neutral-100">{t('selectedImage')}</h3>
          <div className="truncate text-[10px] text-neutral-500">{assignment.assetPath.split('/').pop()}</div>
          <label className="block text-xs text-neutral-400">
            <span className="mb-1 flex justify-between">
              <span>{t('imageZoom')}</span>
              <span>{Math.round(assignment.scale * 100)}%</span>
            </span>
            <input
              type="range"
              min={1}
              max={5}
              step={0.05}
              value={assignment.scale}
              disabled={assignment.cropX !== undefined}
              onPointerDown={snapshot}
              onChange={(event) => updateSlotScale(selectedSlotIndex, Number(event.target.value))}
              className="w-full accent-blue-500 disabled:opacity-40"
            />
          </label>
          <NumberField
            label={t('horizontalPosition')}
            value={assignment.offsetX}
            onFocus={snapshot}
            onChange={(value) => updateSlotOffset(selectedSlotIndex, value, assignment.offsetY)}
          />
          <NumberField
            label={t('verticalPosition')}
            value={assignment.offsetY}
            onFocus={snapshot}
            onChange={(value) => updateSlotOffset(selectedSlotIndex, assignment.offsetX, value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={onStartCrop} className="editor-surface-control min-h-11 rounded-lg border border-neutral-700 bg-neutral-800 px-2 text-xs text-neutral-200 hover:bg-neutral-700">
              {t('crop')}
            </button>
            <button
              type="button"
              onClick={() => {
                snapshot();
                updateSlotOffset(selectedSlotIndex, 0, 0);
                updateSlotScale(selectedSlotIndex, 1);
                clearSlotCrop(selectedSlotIndex);
              }}
              className="editor-surface-control min-h-11 rounded-lg border border-neutral-700 bg-neutral-800 px-2 text-xs text-neutral-200 hover:bg-neutral-700"
            >
              {t('resetPlacement')}
            </button>
            <button type="button" onClick={onReplaceImage} className="editor-surface-control min-h-11 rounded-lg border border-neutral-700 bg-neutral-800 px-2 text-xs text-neutral-200 hover:bg-neutral-700">
              {t('replaceImage')}
            </button>
            <button type="button" onClick={onDelete} className="min-h-11 rounded-lg border border-red-800 bg-red-950/60 px-2 text-xs text-red-200 hover:bg-red-900">
              {t('delete')}
            </button>
          </div>
        </section>
      ) : selectedElement?.type === 'text' ? (
        <section className="mt-3 space-y-3">
          <h3 className="text-sm font-medium text-neutral-100">{t('selectedText')}</h3>
          <textarea
            value={selectedElement.content}
            onFocus={snapshot}
            onChange={(event) => updateText(selectedElement, { content: event.target.value })}
            className="editor-input min-h-24 w-full resize-y rounded-lg border border-neutral-700 bg-neutral-800 p-2 text-sm text-neutral-100"
          />
          <select
            value={selectedElement.fontFamily}
            onChange={(event) => {
              snapshot();
              updateText(selectedElement, { fontFamily: event.target.value });
            }}
            className="editor-input min-h-11 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-2 text-sm text-neutral-100"
          >
            {fonts.map((font) => <option key={font} value={font}>{font}</option>)}
          </select>
          <NumberField
            label={t('size')}
            value={selectedElement.fontSize}
            min={1}
            max={300}
            onFocus={snapshot}
            onChange={(value) => updateText(selectedElement, { fontSize: Math.max(1, value) })}
          />
          <NumberField
            label={t('lineHeight')}
            value={(selectedElement.lineHeight ?? 1.2) * 100}
            min={50}
            max={500}
            onFocus={snapshot}
            onChange={(value) => updateText(selectedElement, { lineHeight: value / 100 })}
          />
          <label className="flex items-center justify-between text-xs text-neutral-400">
            {t('color')}
            <input type="color" value={selectedElement.color} onFocus={snapshot} onChange={(event) => updateText(selectedElement, { color: event.target.value })} className="editor-color-input h-10 w-14 rounded-md border border-neutral-700 bg-neutral-800" />
          </label>
          <div className="grid grid-cols-3 gap-1" role="group" aria-label={t('textAlign')}>
            {([
              ['left', 'alignLeft', '⇤'],
              ['center', 'alignCenter', '↔'],
              ['right', 'alignRight', '⇥'],
            ] as const).map(([align, label, icon]) => (
              <button
                key={align}
                type="button"
                onClick={() => {
                  snapshot();
                  updateText(selectedElement, { align });
                }}
                className={`min-h-11 rounded-lg border text-sm ${
                  (selectedElement.align ?? 'left') === align
                    ? 'border-blue-500 bg-blue-600/20 text-blue-100'
                    : 'border-neutral-700 bg-neutral-800 text-neutral-300'
                }`}
                aria-label={t(label)}
                title={t(label)}
              >
                {icon}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {([
              ['bold', 'bold', 'B'],
              ['italic', 'italic', 'I'],
            ] as const).map(([style, label, icon]) => {
              const active = selectedElement.fontStyle?.includes(style) ?? false;
              return (
                <button
                  key={style}
                  type="button"
                  onClick={() => {
                    snapshot();
                    const bold = style === 'bold' ? !active : selectedElement.fontStyle?.includes('bold') ?? false;
                    const italic = style === 'italic' ? !active : selectedElement.fontStyle?.includes('italic') ?? false;
                    updateText(selectedElement, {
                      fontStyle: bold && italic ? 'bold italic' : bold ? 'bold' : italic ? 'italic' : 'normal',
                    });
                  }}
                  className={`min-h-11 rounded-lg border ${
                    active
                      ? 'border-blue-500 bg-blue-600/20 text-blue-100'
                      : 'border-neutral-700 bg-neutral-800 text-neutral-300'
                  } ${style === 'italic' ? 'italic' : 'font-bold'}`}
                >
                  <span aria-hidden="true">{icon}</span>
                  <span className="sr-only">{t(label)}</span>
                </button>
              );
            })}
          </div>
          <button type="button" onClick={onDelete} className="min-h-11 w-full rounded-lg border border-red-800 bg-red-950/60 px-2 text-xs text-red-200 hover:bg-red-900">
            {t('delete')}
          </button>
        </section>
      ) : selectedElement?.type === 'image' ? (
        <section className="mt-3 space-y-3">
          <h3 className="text-sm font-medium text-neutral-100">{t('selectedImage')}</h3>
          <NumberField label={t('horizontalPosition')} value={selectedElement.x} onFocus={snapshot} onChange={(value) => updateImage(selectedElement, { x: value })} />
          <NumberField label={t('verticalPosition')} value={selectedElement.y} onFocus={snapshot} onChange={(value) => updateImage(selectedElement, { y: value })} />
          <NumberField label={t('width')} value={selectedElement.width} min={20} onFocus={snapshot} onChange={(value) => updateImage(selectedElement, { width: Math.max(20, value) })} />
          <NumberField label={t('height')} value={selectedElement.height} min={20} onFocus={snapshot} onChange={(value) => updateImage(selectedElement, { height: Math.max(20, value) })} />
          <NumberField label={t('rotation')} value={selectedElement.rotation} min={-360} max={360} onFocus={snapshot} onChange={(value) => updateImage(selectedElement, { rotation: value })} />
          <button type="button" onClick={onDelete} className="min-h-11 w-full rounded-lg border border-red-800 bg-red-950/60 px-2 text-xs text-red-200 hover:bg-red-900">
            {t('delete')}
          </button>
        </section>
      ) : (
        <p className="mt-3 text-xs leading-5 text-neutral-500">{t('noSelectionHint')}</p>
      )}

      <section className="mt-5 border-t border-neutral-800 pt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{t('pageProperties')}</h3>
        <label className="mt-3 flex items-center justify-between text-xs text-neutral-400">
          {t('pageBackground')}
          <input
            type="color"
            value={page?.background ?? '#ffffff'}
            onFocus={snapshot}
            onChange={(event) => setPageBackground(event.target.value)}
            className="editor-color-input h-10 w-14 rounded-md border border-neutral-700 bg-neutral-800"
          />
        </label>
      </section>
    </aside>
  );
}
