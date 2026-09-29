import { useMemo, useState } from 'react';
import type { Translator } from '../../i18n';
import type { PdfCompressionLevel, ProjectExportContext, ExportIssue } from '../../utils/exportProject';
import { PDF_COMPRESSION_PRESETS } from '../../utils/exportProject';
import { parsePageRange } from '../../utils/pageRange';
import { getPageSize, getExportPixelRatio } from '../../domain/pageFormat';
import { useExportPreflight } from '../../hooks/useExportPreflight';
import { getAssetFileName } from '../../domain/assetLibrary';
import { useDialogFocus } from '../common/useDialogFocus';

export type ExportFormat = 'pdf' | 'png' | 'jpeg';
export type ExportScope = 'current' | 'all' | 'range';

export interface ExportRequest {
  format: ExportFormat;
  scope: ExportScope;
  pageIndices: number[];
  compression: PdfCompressionLevel;
  fileName: string;
  dpi?: number;
}

function estimateSize(format: ExportFormat, compression: PdfCompressionLevel, pageCount: number, pixels: number): string {
  const bytesPerPage = format === 'png'
    ? 2_200_000
    : format === 'jpeg'
      ? 720_000
      : compression === 'none'
        ? 2_400_000
        : compression === 'low'
          ? 1_100_000
          : compression === 'medium'
            ? 720_000
            : 420_000;
  const classic = getPageSize();
  const bytes = bytesPerPage * Math.max(1, pageCount) * pixels / (classic.width * classic.height * 4);
  return bytes >= 1_000_000
    ? `~${(bytes / 1_000_000).toFixed(bytes >= 10_000_000 ? 0 : 1)} MB`
    : `~${Math.round(bytes / 1_000)} KB`;
}

export default function ExportDialog({
  t,
  context,
  currentPageIndex,
  defaultCompression,
  onClose,
  onExport,
  onNavigateToIssue,
}: {
  t: Translator;
  context: ProjectExportContext;
  currentPageIndex: number;
  defaultCompression: PdfCompressionLevel;
  onClose: () => void;
  onExport: (request: ExportRequest) => void;
  onNavigateToIssue?: (issue: ExportIssue) => void;
}) {
  const [dpi, setDpi] = useState(300);
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [scope, setScope] = useState<ExportScope>('all');
  const [range, setRange] = useState('');
  const [compression, setCompression] = useState(defaultCompression);
  const [fileName, setFileName] = useState(context.projectName);
  const size = getPageSize(context.pageFormat);
  const pixelRatio = getExportPixelRatio(context.pageFormat, dpi);
  const outputWidth = Math.floor(size.width * pixelRatio);
  const outputHeight = Math.floor(size.height * pixelRatio);
  const dialogRef = useDialogFocus<HTMLDivElement>(true, onClose);

  const pageSelection = useMemo(() => {
    try {
      if (scope === 'current') return { indices: [currentPageIndex], error: false };
      if (scope === 'all') return { indices: context.pages.map((_, index) => index), error: false };
      const indices = parsePageRange(range, context.pages.length);
      return { indices, error: indices.length === 0 };
    } catch {
      return { indices: [], error: true };
    }
  }, [context.pages, currentPageIndex, range, scope]);

  const { preflight, error: preflightError } = useExportPreflight(context, pageSelection.indices, dpi);

  const issues = preflight
    ? preflight.emptySlotCount + preflight.missingAssetCount + preflight.lowResolutionCount
    : 0;

  return (
    <div className="fixed inset-0 z-[135] flex items-center justify-center bg-black/70 px-4" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-dialog-title"
        tabIndex={-1}
        className="editor-dropdown max-h-[92vh] w-[min(94vw,720px)] overflow-y-auto rounded-2xl border border-neutral-700 bg-neutral-900 p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="export-dialog-title" className="text-lg font-semibold text-neutral-100">{t('export')}</h2>
          <button type="button" onClick={onClose} className="editor-surface-control min-h-11 rounded-lg border border-neutral-700 bg-neutral-800 px-3 text-sm text-neutral-200">{t('close')}</button>
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <section className="space-y-4">
            <label className="block text-xs text-neutral-400">
              <span className="mb-1 block">{t('exportFormat')}</span>
              <select value={format} onChange={(event) => setFormat(event.target.value as ExportFormat)} className="editor-input min-h-11 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 text-sm text-neutral-100">
                <option value="pdf">PDF</option>
                <option value="png">PNG</option>
                <option value="jpeg">JPEG</option>
              </select>
            </label>

            <fieldset>
              <legend className="mb-2 text-xs text-neutral-400">{t('exportScope')}</legend>
              <div className="grid grid-cols-3 gap-1">
                {([
                  ['current', 'exportCurrentPage'],
                  ['all', 'exportAllPages'],
                  ['range', 'exportPageRange'],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setScope(value)}
                    className={`min-h-11 rounded-lg border px-2 text-xs ${
                      scope === value ? 'border-blue-500 bg-blue-600/20 text-blue-100' : 'border-neutral-700 bg-neutral-800 text-neutral-300'
                    }`}
                  >
                    {t(label)}
                  </button>
                ))}
              </div>
            </fieldset>

            {scope === 'range' && (
              <label className="block text-xs text-neutral-400">
                <span className="mb-1 block">{t('exportPageRange')}</span>
                <input value={range} onChange={(event) => setRange(event.target.value)} placeholder={t('pageRangePlaceholder')} className="editor-input min-h-11 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 text-sm text-neutral-100" />
                {pageSelection.error && <span className="mt-1 block text-red-300">{t('invalidPageRange')}</span>}
              </label>
            )}

            <label className="block text-xs text-neutral-400">
              <span className="mb-1 block">{t('exportResolution')}</span>
              <select value={dpi} onChange={(event) => setDpi(Number(event.target.value))} className="editor-input min-h-11 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 text-sm text-neutral-100">
                {[150, 300, 600].map((value) => <option key={value} value={value}>{value} DPI</option>)}
              </select>
              <span className="mt-1 block">{outputWidth} × {outputHeight} px</span>
            </label>
            <label className="block text-xs text-neutral-400">
              <span className="mb-1 block">{t('outputFilename')}</span>
              <input value={fileName} onChange={(event) => setFileName(event.target.value)} className="editor-input min-h-11 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 text-sm text-neutral-100" />
            </label>

            {(format === 'pdf' || format === 'jpeg') && (
              <label className="block text-xs text-neutral-400">
                <span className="mb-1 block">{t('pdfCompression')}</span>
                <select value={compression} onChange={(event) => setCompression(event.target.value as PdfCompressionLevel)} className="editor-input min-h-11 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 text-sm text-neutral-100">
                  {PDF_COMPRESSION_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>{t(preset.labelKey)}</option>
                  ))}
                </select>
              </label>
            )}
          </section>

          <section className="rounded-xl border border-neutral-700 bg-neutral-950/50 p-4">
            <h3 className="text-sm font-semibold text-neutral-200">{t('exportPreflight')}</h3>
            {preflightError ? <p role="alert" className="mt-3 text-sm text-red-300">{t('preflightFailed')}: {preflightError}</p> : !preflight ? (
              <div role="status" className="mt-3 text-xs text-neutral-400">{t('preflightChecking')}</div>
            ) : issues === 0 ? (
              <div className="mt-3 rounded-lg border border-emerald-800 bg-emerald-950/40 p-3 text-xs text-emerald-200">{t('preflightReady')}</div>
            ) : (
              <ul className="mt-3 space-y-2 text-xs">
                {preflight.emptySlotCount > 0 && <li className="rounded-lg border border-amber-800 bg-amber-950/30 p-2 text-amber-200">{t('preflightEmptySlots').replace('{count}', String(preflight.emptySlotCount))}</li>}
                {preflight.missingAssetCount > 0 && <li className="rounded-lg border border-red-800 bg-red-950/30 p-2 text-red-200">{t('preflightMissingAssets').replace('{count}', String(preflight.missingAssetCount))}</li>}
                {preflight.lowResolutionCount > 0 && <li className="rounded-lg border border-amber-800 bg-amber-950/30 p-2 text-amber-200">{t('preflightLowResolution').replace('{count}', String(preflight.lowResolutionCount))}</li>}
              </ul>
            )}
            {preflight && preflight.issues.length > 0 && onNavigateToIssue && <>
              <p className="mt-3 text-xs text-neutral-400">{t('preflightIssueHint')}</p>
              <ul className="mt-2 max-h-64 space-y-2 overflow-auto">{preflight.issues.map((issue) => <li key={`${issue.pageId}-${issue.slotIndex ?? issue.elementId}-${issue.kind}`}>
                <button type="button" onClick={() => onNavigateToIssue(issue)} className={`min-h-11 w-full rounded-lg border p-2 text-left text-xs ${issue.kind === 'missing-asset' ? 'border-red-800 text-red-200' : 'border-amber-800 text-amber-200'}`}>
                  <span className="block font-medium">{t('pageLabel')} {issue.pageIndex + 1} · {t('imageSlotLabel')} {issue.imageNumber}: {t(({ 'empty-slot': 'preflightIssueEmpty', 'missing-asset': 'preflightIssueMissing', 'low-resolution': 'preflightIssueLow' } as const)[issue.kind])}</span>
                  {issue.assetPath && <span className="mt-1 block break-all text-neutral-400">{getAssetFileName(issue.assetPath)}</span>}
                </button>
              </li>)}</ul>
            </>}
            <div className="mt-4 flex items-center justify-between border-t border-neutral-800 pt-3 text-xs text-neutral-400">
              <span>{t('estimatedSize')}</span>
              <strong className="text-neutral-200">{estimateSize(format, compression, pageSelection.indices.length, outputWidth * outputHeight)}</strong>
            </div>
          </section>
        </div>

        <button
          type="button"
          disabled={!preflight || !!preflightError || pageSelection.error || pageSelection.indices.length === 0 || !fileName.trim() || (preflight?.missingAssetCount ?? 0) > 0}
          onClick={() => onExport({
            format,
            dpi,
            scope,
            pageIndices: pageSelection.indices,
            compression,
            fileName: fileName.trim(),
          })}
          className="mt-5 min-h-12 w-full rounded-xl bg-blue-600 px-4 font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t('startExport')}
        </button>
      </div>
    </div>
  );
}
