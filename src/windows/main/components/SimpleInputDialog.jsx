import { useTranslation } from 'react-i18next';
import { focusWindowImmediately, restoreFocus } from '@shared/hooks/useInputFocus';

function SimpleInputDialog({
  title,
  value,
  onChange,
  onConfirm,
  onCancel,
  placeholder = '',
  confirmText,
  cancelText,
  allowEmpty = true,
}) {
  const { t } = useTranslation();
  const inputValue = value ?? '';
  const canConfirm = allowEmpty || inputValue.trim().length > 0;

  const handleConfirm = () => {
    if (!canConfirm) {
      return;
    }
    onConfirm?.(inputValue);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleConfirm();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel?.();
    }
  };

  return (
    <div
      className="fixed inset-[5px] z-[199] flex items-center justify-center overflow-hidden rounded-[8px] bg-black/35 px-4 backdrop-blur-[1px]"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-[22rem] rounded-xl border border-qc-border bg-qc-panel p-4 shadow-xl"
        data-no-drag
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="mb-3 text-sm font-semibold leading-5 text-qc-fg">
          {title || t('common.title', '标题')}
        </h3>
        <input
          type="text"
          value={inputValue}
          onChange={(event) => onChange?.(event.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={focusWindowImmediately}
          onBlur={restoreFocus}
          autoFocus
          className="h-9 w-full appearance-none rounded-lg border border-qc-border bg-qc-panel-2 px-3 text-sm text-qc-fg outline-none transition-colors placeholder:text-qc-fg-subtle focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          style={{
            backgroundColor: 'var(--qc-panel-2)',
            color: 'var(--qc-fg)',
            colorScheme: 'light',
          }}
          placeholder={placeholder}
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-8 rounded-lg px-3 text-sm text-qc-fg-muted transition-colors hover:bg-qc-hover hover:text-qc-fg"
          >
            {cancelText || t('common.cancel', '取消')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="h-8 rounded-lg bg-blue-500 px-3 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {confirmText || t('common.confirm', '确认')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SimpleInputDialog;
