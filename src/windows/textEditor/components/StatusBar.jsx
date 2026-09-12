import '@tabler/icons-webfont/dist/tabler-icons.min.css';
import { useTranslation } from 'react-i18next';
function StatusBar({
  charCount,
  lineCount,
  hasChanges,
  onSave,
  onCancel
}) {
  const {
    t
  } = useTranslation();
  return <div className="text-editor-statusbar min-h-14 flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-t border-qc-border bg-qc-surface/80 backdrop-blur-sm">
      <div className="flex flex-wrap items-center gap-3 text-sm text-qc-fg-muted">
        <span className="whitespace-nowrap">{t('textEditor.charCount', {
          count: charCount
        })}</span>
        <span className="whitespace-nowrap">{t('textEditor.lineCount', {
          count: lineCount
        })}</span>
        {hasChanges && <span className="text-orange-500 whitespace-nowrap">{t('textEditor.unsaved')}</span>}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <button className="flex items-center gap-2 px-3 h-9 rounded border border-qc-border bg-qc-surface hover:bg-qc-hover text-qc-fg font-medium transition-colors" onClick={onCancel}>
          <i className="ti ti-x" style={{
          fontSize: 16
        }}></i>
          <span className="hidden sm:inline">{t('common.cancel')}</span>
        </button>
        <button className="flex items-center gap-2 px-3 h-9 rounded bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors" onClick={onSave}>
          <i className="ti ti-device-floppy" style={{
          fontSize: 16
        }}></i>
          <span className="hidden sm:inline">{t('common.save')}</span>
        </button>
      </div>
    </div>;
}
export default StatusBar;
