import '@tabler/icons-webfont/dist/tabler-icons.min.css';
import { useTranslation } from 'react-i18next';
import { useInputFocus } from '@shared/hooks/useInputFocus';
import Tooltip from '@shared/components/common/Tooltip.jsx';

function GroupEditModal({
  title,
  name,
  icon,
  color,
  presetColors,
  availableIcons,
  saving = false,
  nameDisabled = false,
  onNameChange,
  onIconChange,
  onColorChange,
  onClose,
  onSave,
  footerStart = null,
  customContent = null,
  showSave = true,
  cancelLabel,
  onCancel,
}) {
  const { t } = useTranslation();
  const inputRef = useInputFocus();

  const handleKeyDown = e => {
    if (e.key === 'Enter') onSave?.();
    else if (e.key === 'Escape') onClose?.();
  };

  const handleOverlayClick = e => {
    if (e.target === e.currentTarget) onClose?.();
  };

  return (
    <div
      className="fixed inset-[5px] rounded-[8px] overflow-hidden flex items-center justify-center z-50 backdrop-blur-[6px]"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--qc-surface) 28%, transparent)',
      }}
      onClick={handleOverlayClick}
    >
      <div className="group-modal bg-qc-panel rounded-lg shadow-xl w-[clamp(320px,72vw,520px)] max-h-[80vh] overflow-hidden flex flex-col border border-qc-border">
        <div className="flex items-center justify-between px-4 py-3 border-b border-qc-border">
          <h3 className="text-lg font-semibold text-qc-fg">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-qc-hover text-qc-fg-muted"
          >
            <i className="ti ti-x" style={{ fontSize: 20 }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {customContent || (
            <>
              <div>
                <label className="block text-sm font-medium text-qc-fg mb-2">
                  {t('groups.modal.nameLabel')}
                </label>
                <input
                  ref={inputRef}
                  type="text"
                  value={name}
                  onChange={e => onNameChange?.(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t('groups.modal.namePlaceholder')}
                  disabled={nameDisabled}
                  className="w-full px-3 py-2 appearance-none bg-qc-panel-2 border border-qc-border rounded-md text-qc-fg placeholder:text-qc-fg-subtle focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-70 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: 'var(--qc-panel-2)',
                    color: 'var(--qc-fg)',
                    colorScheme: 'light',
                  }}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-qc-fg mb-2">
                  颜色
                </label>
                <div className="flex gap-2">
                  <Tooltip content={t('groups.modal.customColor')} placement="top" asChild>
                    <label className="w-8 h-8 rounded-md border border-qc-border-strong flex items-center justify-center cursor-pointer hover:border-blue-500 transition text-qc-fg-muted">
                      <input
                        type="color"
                        value={color}
                        onChange={e => onColorChange?.(e.target.value)}
                        className="absolute opacity-0 w-0 h-0"
                      />
                      <i className="ti ti-adjustments" />
                    </label>
                  </Tooltip>
                  {presetColors.map(presetColor => (
                    <button
                      key={presetColor}
                      onClick={() => onColorChange?.(presetColor)}
                      className={`w-8 h-8 rounded-md border transition ${
                        color === presetColor
                          ? 'border-blue-500 scale-110 shadow'
                          : 'border-qc-border hover:border-qc-border-strong'
                      }`}
                      style={{ backgroundColor: presetColor }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-qc-fg mb-2">
                  {t('groups.modal.iconLabel')}
                </label>
                <div className="grid grid-cols-6 gap-2 max-h-[300px] overflow-y-auto p-2 bg-qc-panel-2 rounded-md">
                  {availableIcons.map(iconName => (
                    <button
                      key={iconName}
                      onClick={() => onIconChange?.(iconName)}
                      className={`p-2 rounded-md transition flex items-center justify-center border ${
                        icon === iconName
                          ? 'bg-blue-500 border-blue-500 text-white shadow-md'
                          : 'bg-qc-panel text-qc-fg border-qc-border hover:border-blue-400'
                      }`}
                    >
                      <i
                        className={iconName}
                        style={{
                          fontSize: 18,
                          color: icon === iconName ? '#fff' : color,
                          filter: icon === iconName ? 'none' : 'grayscale(0.3) opacity(0.8)',
                          transition: 'all 0.2s',
                        }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-qc-border">
          {footerStart}
          <button
            onClick={onCancel || onClose}
            className="px-4 py-2 text-sm font-medium text-qc-fg hover:bg-qc-hover rounded-md transition"
          >
            {cancelLabel || t('common.cancel')}
          </button>
          {showSave && (
            <button
              onClick={onSave}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? t('groups.modal.saving') : t('common.save')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default GroupEditModal;
