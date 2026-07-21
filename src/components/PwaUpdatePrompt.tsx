import { useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { tr, type Language } from '../i18n';

export default function PwaUpdatePrompt({ language, isDirty }: { language: Language; isDirty: boolean }) {
  const [updateError, setUpdateError] = useState<string | null>(null);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError: (error) => setUpdateError(error instanceof Error ? error.message : String(error)),
  });

  if (!needRefresh && !updateError) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[180] w-[min(92vw,360px)] rounded-xl border border-neutral-600 bg-neutral-900 p-4 text-neutral-100 shadow-2xl" role="status">
      <div className="text-sm font-semibold">{tr(language, 'updateAvailable')}</div>
      <div className="mt-1 text-xs leading-5 text-neutral-400">
        {updateError ?? (isDirty ? tr(language, 'updateSaveFirst') : tr(language, 'updateDescription'))}
      </div>
      {needRefresh && (
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" onClick={() => setNeedRefresh(false)} className="min-h-11 rounded-lg border border-neutral-600 px-3 py-2 text-sm hover:bg-neutral-800">
            {tr(language, 'later')}
          </button>
          <button type="button" disabled={isDirty} onClick={() => void updateServiceWorker(true)} className="min-h-11 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40">
            {tr(language, 'updateNow')}
          </button>
        </div>
      )}
    </div>
  );
}
