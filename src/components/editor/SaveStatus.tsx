import type { Translator } from '../../i18n';

export default function SaveStatus({
  t,
  isDirty,
  isSaving,
  error,
}: {
  t: Translator;
  isDirty: boolean;
  isSaving: boolean;
  error: string | null;
}) {
  return (
    <span
      className={`text-[11px] tabular-nums ${
        error ? 'text-red-300' : isSaving ? 'text-blue-300' : isDirty ? 'text-amber-300' : 'text-emerald-300'
      }`}
      title={error ?? undefined}
      role="status"
      aria-live="polite"
    >
      {error ? t('saveFailed') : isSaving ? t('saving') : isDirty ? t('unsaved') : t('saved')}
    </span>
  );
}
