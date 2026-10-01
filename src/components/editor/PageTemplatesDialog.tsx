import { useState } from 'react';
import type { Page } from '../../types';
import type { Translator } from '../../i18n';
import type { PageFormat } from '../../domain/pageFormat';
import { createPageTemplate, type PageTemplate } from '../../domain/pageTemplates';
import { loadPageTemplates, savePageTemplates } from '../../utils/pageTemplateRepository';
import { useDialogFocus } from '../common/useDialogFocus';
import ConfirmDialog from '../common/ConfirmDialog';

export default function PageTemplatesDialog({ page, pageFormat, t, onApply, onClose }: {
  page: Page; pageFormat: PageFormat; t: Translator; onApply: (template: PageTemplate) => void; onClose: () => void;
}) {
  const [templates, setTemplates] = useState(loadPageTemplates);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const dialogRef = useDialogFocus<HTMLDivElement>(removeId === null, onClose);
  const persist = (next: PageTemplate[]) => {
    try { savePageTemplates(next); setTemplates(next); setError(null); return true; }
    catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)); return false; }
  };
  return <div className="fixed inset-0 z-[125] flex items-center justify-center bg-black/70 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="templates-title" tabIndex={-1} className="editor-dropdown max-h-[90vh] w-[min(94vw,760px)] overflow-auto rounded-2xl border border-neutral-700 bg-neutral-900 p-5">
      <div className="flex items-center justify-between gap-3"><h2 id="templates-title" className="text-lg text-neutral-100">{t('pageTemplates')}</h2><button type="button" onClick={onClose} className="min-h-11 px-3 text-neutral-200">{t('close')}</button></div>
      <p className="mt-2 text-sm text-neutral-400">{t('pageTemplatesHint')}</p>
      <form className="my-5 flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); if (persist([...templates, createPageTemplate(page, name, pageFormat)])) setName(''); }}>
        <label className="min-w-48 flex-1 text-xs text-neutral-400">{t('templateName')}<input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} className="editor-input mt-1 min-h-11 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 text-neutral-100" /></label>
        <button type="submit" disabled={!name.trim() || templates.length >= 50} className="self-end min-h-11 rounded-lg bg-blue-600 px-3 text-sm text-white disabled:opacity-40">{t('savePageTemplate')}</button>
      </form>
      {error && <p role="alert" className="my-3 text-sm text-red-300">{error}</p>}
      {templates.length === 0 && <p className="py-8 text-center text-neutral-400">{t('noPageTemplates')}</p>}
      <ul className="space-y-2">{templates.map((template) => <li key={template.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-700 p-3">
        <div className="min-w-0 flex-1"><div className="truncate text-neutral-100">{template.name}</div><div className="text-xs text-neutral-400">{t(({ classic: 'formatClassic', 'a4-landscape': 'formatLandscape', 'a4-portrait': 'formatPortrait', square: 'formatSquare' } as const)[template.pageFormat])}</div></div>
        <button type="button" onClick={() => onApply(template)} className="min-h-11 rounded-lg bg-blue-600 px-3 text-sm text-white" aria-label={`${t('usePageTemplate')}: ${template.name}`}>{t('usePageTemplate')}</button>
        <button type="button" onClick={() => setRemoveId(template.id)} className="min-h-11 px-3 text-sm text-red-300" aria-label={`${t('delete')}: ${template.name}`}>{t('delete')}</button>
      </li>)}</ul>
    </div>
    <ConfirmDialog open={removeId !== null} title={t('delete')} message={t('deletePageTemplateConfirm')} cancelLabel={t('cancel')} confirmLabel={t('delete')} danger onCancel={() => setRemoveId(null)} onConfirm={() => { persist(templates.filter((entry) => entry.id !== removeId)); setRemoveId(null); }} />
  </div>;
}
