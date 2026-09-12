import '@tabler/icons-webfont/dist/tabler-icons.min.css';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Tooltip from '@shared/components/common/Tooltip.jsx';

const SYMBOL_CODE_TO_KEY = {
  Backquote: 'Backquote',
  Minus: 'Minus',
  Equal: 'Equal',
  BracketLeft: 'BracketLeft',
  BracketRight: 'BracketRight',
  Backslash: 'Backslash',
  Semicolon: 'Semicolon',
  Quote: 'Quote',
  Comma: 'Comma',
  Period: 'Period',
  Slash: 'Slash'
};

const KEY_TO_DISPLAY = {
  Backquote: '`',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  Space: 'Space'
};

function formatShortcutForDisplay(shortcut) {
  if (!shortcut) return '';
  return shortcut
    .split('+')
    .map(part => KEY_TO_DISPLAY[part] || part)
    .join('+');
}

function normalizeMainKeyFromEvent(e) {
  const code = typeof e.code === 'string' ? e.code : '';
  const codeMap = {
    ArrowUp: 'ArrowUp',
    ArrowDown: 'ArrowDown',
    ArrowLeft: 'ArrowLeft',
    ArrowRight: 'ArrowRight',
    Escape: 'Escape',
    Enter: 'Enter',
    Tab: 'Tab',
    Backspace: 'Backspace',
    Delete: 'Delete',
    Space: 'Space',
    ...SYMBOL_CODE_TO_KEY
  };

  if (codeMap[code]) return codeMap[code];
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Numpad\d$/.test(code)) return code;
  if (/^F\d{1,2}$/.test(code)) return code;

  const key = (e.key || '').toString();
  if (key.length === 1) return key.toUpperCase();
  return key;
}

function ShortcutInput({
  value,
  onChange,
  onReset,
  presets = [],
  hasError = false,
  errorMessage = null
}) {
  const {
    t
  } = useTranslation();
  const [isListening, setIsListening] = useState(false);
  const handleKeyDown = e => {
    if (!isListening) return;
    e.preventDefault();
    e.stopPropagation();
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
      return;
    }
    const keys = [];

    // 添加修饰键
    if (e.ctrlKey) keys.push('Ctrl');
    if (e.altKey) keys.push('Alt');
    if (e.shiftKey) keys.push('Shift');
    if (e.metaKey) keys.push('Win');

    // 映射特殊键名
    const mainKey = normalizeMainKeyFromEvent(e);
    keys.push(mainKey);
    const shortcut = keys.join('+');
    onChange(shortcut);
    setIsListening(false);
  };
  const handleClear = e => {
    e.stopPropagation();
    onChange('');
  };
  return <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="relative">
          <input type="text" value={isListening ? t('settings.shortcuts.listening') : formatShortcutForDisplay(value || '')} onClick={() => setIsListening(true)} onKeyDown={handleKeyDown} onBlur={() => setIsListening(false)} readOnly placeholder={t('settings.shortcuts.clickToSet')} className={`
              h-10 px-3 pr-8 w-72 text-sm border rounded-lg
              bg-qc-panel
              focus:outline-none cursor-pointer
              transition-all duration-200
              ${hasError ? 'text-red-600 border-red-500 ring-2 ring-red-500/30' : isListening ? 'text-qc-fg border-blue-500 ring-2 ring-blue-500/50' : 'text-qc-fg border-qc-border hover:border-qc-border-strong'}
            `} />
          {value && !isListening && !hasError && (
            <Tooltip content={t('settings.common.clear')} placement="top" asChild>
              <button onClick={handleClear} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-qc-hover text-qc-fg-muted transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </Tooltip>
          )}
          {hasError && (
            <Tooltip content={errorMessage || '快捷键冲突'} placement="top" asChild>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 text-red-500 cursor-help">
                <i className="ti ti-alert-circle" style={{
              fontSize: 16
            }}></i>
              </div>
            </Tooltip>
          )}
        </div>
        
        {onReset && (
          <Tooltip content={t('settings.common.reset')} placement="top" asChild>
            <button onClick={onReset} className="h-10 w-10 inline-flex items-center justify-center rounded-lg hover:bg-qc-hover text-qc-fg-muted transition-colors">
              <i className="ti ti-refresh w-4 h-4"></i>
            </button>
          </Tooltip>
        )}
      </div>

      {presets && presets.length > 0 && <div className="flex flex-wrap gap-2">
          <span className="text-xs text-qc-fg-muted">
            {t('settings.shortcuts.commonShortcuts')}:
          </span>
          {presets.map(preset => <button key={preset} onClick={() => onChange(preset)} className="px-2 py-1 text-xs rounded bg-qc-panel-2 hover:bg-qc-hover text-qc-fg transition-colors">
              {preset}
            </button>)}
        </div>}
    </div>;
}
export default ShortcutInput;
