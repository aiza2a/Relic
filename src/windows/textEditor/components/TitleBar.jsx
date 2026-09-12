import '@tabler/icons-webfont/dist/tabler-icons.min.css';
import { useTranslation } from 'react-i18next';
import { getCurrentWindow } from '@tauri-apps/api/window';
import Tooltip from '@shared/components/common/Tooltip.jsx';
function TitleBar({
  title,
  hasChanges
}) {
  const {
    t
  } = useTranslation();
  const window = getCurrentWindow();
  const handleMinimize = () => {
    window.minimize();
  };
  const handleMaximize = () => {
    window.toggleMaximize();
  };
  const handleClose = () => {
    window.close();
  };
  return <div className="text-editor-titlebar h-12 flex items-center justify-between px-4 bg-qc-surface/80 border-b border-qc-border backdrop-blur-sm" data-tauri-drag-region>
      <div className="flex items-center gap-2 flex-1 min-w-0 pointer-events-none">
        <i className="ti ti-edit text-qc-fg flex-shrink-0" style={{
        fontSize: 18
      }}></i>
        <h1 className="text-base font-semibold text-qc-fg truncate">
          {title || t('textEditor.title')}
          {hasChanges && <span className="ml-1 text-amber-500">*</span>}
        </h1>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0 pointer-events-auto">
        <Tooltip content={t('common.minimize')} placement="bottom" asChild>
          <button className="w-9 h-9 flex items-center justify-center rounded hover:bg-qc-hover text-qc-fg-muted transition-colors" onClick={handleMinimize}>
            <i className="ti ti-minus" style={{
            fontSize: 16
          }}></i>
          </button>
        </Tooltip>
        <Tooltip content={t('common.maximize')} placement="bottom" asChild>
          <button className="w-9 h-9 flex items-center justify-center rounded hover:bg-qc-hover text-qc-fg-muted transition-colors" onClick={handleMaximize}>
            <i className="ti ti-square" style={{
            fontSize: 14
          }}></i>
          </button>
        </Tooltip>
        <Tooltip content={t('common.close')} placement="bottom" asChild>
          <button className="w-9 h-9 flex items-center justify-center rounded hover:bg-red-500 hover:text-white text-qc-fg-muted transition-colors" onClick={handleClose}>
            <i className="ti ti-x" style={{
            fontSize: 16
          }}></i>
          </button>
        </Tooltip>
      </div>
    </div>;
}
export default TitleBar;
