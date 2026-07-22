import type { Translator } from '../../i18n';
import { MenuButton, MenuDivider, MenuItem } from './MenuComponents';

export interface FileMenuProps {
  t: Translator;
  open: boolean;
  isSaving: boolean;
  onToggle: () => void;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onExportPdf: () => void;
  onExportPng: () => void;
  onExportJpeg: () => void;
  onExportZipPng: () => void;
  onExportZipJpeg: () => void;
  onHome: () => void;
}

export default function FileMenu(props: FileMenuProps) {
  const { t } = props;
  return (
    <div className="relative" data-menu>
      <MenuButton label={t('file')} isOpen={props.open} onClick={props.onToggle} />
      {props.open && (
        <div className="editor-dropdown absolute top-full left-0 mt-2 min-w-[230px] bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl z-[90] p-1">
          <MenuItem label={t('newProject')} shortcut="Ctrl+N" onClick={props.onNew} />
          <MenuItem label={t('open')} shortcut="Ctrl+O" onClick={props.onOpen} />
          <MenuDivider />
          <MenuItem label={t('save')} shortcut="Ctrl+S" onClick={props.onSave} disabled={props.isSaving} />
          <MenuItem label={t('saveAs')} shortcut="Ctrl+Shift+S" onClick={props.onSaveAs} disabled={props.isSaving} />
          <MenuDivider />
          <MenuItem label={t('exportPdf')} onClick={props.onExportPdf} />
          <MenuItem label={t('exportPng')} onClick={props.onExportPng} />
          <MenuItem label={t('exportJpeg')} onClick={props.onExportJpeg} />
          <MenuItem label={t('exportZipPng')} onClick={props.onExportZipPng} />
          <MenuItem label={t('exportZipJpeg')} onClick={props.onExportZipJpeg} />
          <MenuDivider />
          <MenuItem label={t('home')} onClick={props.onHome} />
        </div>
      )}
    </div>
  );
}
