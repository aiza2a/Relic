import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * 组合快捷键输入组件
 * 修饰键下拉选择 + 自定义按键输入/固定按键选择
 */
function ShortcutComboInput({ 
  value = '', 
  onChange,
  modifierOptions = ['Ctrl', 'Shift', 'Alt'],
  fixedModifiers = [],
  fixedKey = null,
  fixedKeyOptions = null,
  disabledKeys = [],
  allowEmpty = false,
  hasError,
  errorMessage 
}) {
  const { t } = useTranslation();
  // dropdownType: null | 'modifier' | 'keyType'
  const [dropdownType, setDropdownType] = useState(null);
  const [isListeningKey, setIsListeningKey] = useState(false);
  const containerRef = useRef(null);
  const keyInputRef = useRef(null);
  
  const showKeyInput = !fixedKey && !fixedKeyOptions;
  const showKeySelect = !!fixedKeyOptions;
  
  const parseValue = (val) => {
    if (!val) {
      return { modifiers: [...fixedModifiers], keyType: fixedKeyOptions?.[0]?.value || '', customKey: '' };
    }
    
    const parts = val.split('+');
    const allModifiers = ['Ctrl', 'Shift', 'Alt', 'Meta', 'Win'];
    const modifiers = [];
    let keyType = '';
    let customKey = '';
    
    for (const part of parts) {
      if (allModifiers.includes(part)) {
        modifiers.push(part);
      } else if (part) {
        if (fixedKeyOptions?.some(opt => opt.value === part)) {
          keyType = part;
        } else {
          customKey = part;
        }
      }
    }
    
    for (const fixed of fixedModifiers) {
      if (!modifiers.includes(fixed)) {
        modifiers.unshift(fixed);
      }
    }
    
    if (fixedKeyOptions && !keyType) {
      keyType = parts.includes('F') ? 'F' : '1~9';
    }
    
    return { modifiers, keyType, customKey };
  };
  
  const { modifiers: parsedModifiers, keyType: parsedKeyType, customKey: parsedCustomKey } = parseValue(value);
  
  const [internalModifiers, setInternalModifiers] = useState(parsedModifiers);
  const [internalKeyType, setInternalKeyType] = useState(parsedKeyType);
  const [internalCustomKey, setInternalCustomKey] = useState(parsedCustomKey);
  
  const buildAndNotify = (modifiers, keyType, customKey) => {
    if (fixedKey) {
      if (modifiers.length > 0) {
        onChange(modifiers.join('+'));
      } else if (allowEmpty) {
        onChange('');
      }
    } else if (fixedKeyOptions) {
      const parts = [...modifiers];
      if (keyType && keyType !== '1~9') {
        parts.push(keyType);
      }
      onChange(parts.join('+') || (allowEmpty ? '' : modifiers[0] || ''));
    } else {
      if (customKey) {
        onChange([...modifiers, customKey].join('+'));
      } else {
        setInternalModifiers(modifiers);
      }
    }
  };
  
  const modifiers = internalModifiers;
  const keyType = internalKeyType;
  const customKey = internalCustomKey;

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setDropdownType(null);
        setIsListeningKey(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleModifier = (mod) => {
    if (fixedModifiers.includes(mod)) return;
    
    let newModifiers;
    if (modifiers.includes(mod)) {
      newModifiers = modifiers.filter(m => m !== mod);
    } else {
      newModifiers = [...modifiers, mod];
    }
    setInternalModifiers(newModifiers);
    buildAndNotify(newModifiers, keyType, customKey);
  };

  const removeModifier = (mod, e) => {
    e.stopPropagation();
    if (fixedModifiers.includes(mod)) return;
    const newModifiers = modifiers.filter(m => m !== mod);
    setInternalModifiers(newModifiers);
    buildAndNotify(newModifiers, keyType, customKey);
  };
  
  const selectKeyType = (newKeyType) => {
    setInternalKeyType(newKeyType);
    setDropdownType(null);
    buildAndNotify(modifiers, newKeyType, customKey);
  };
  
  const codeToKeyName = (code) => {
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    if (code.startsWith('Numpad')) return 'Num' + code.slice(6);
    if (/^F\d+$/.test(code)) return code;
    
    const specialKeys = {
      'Space': 'Space', 'Enter': 'Enter', 'Backspace': 'Backspace',
      'Tab': 'Tab', 'Escape': 'Escape', 'Delete': 'Delete',
      'Insert': 'Insert', 'Home': 'Home', 'End': 'End',
      'PageUp': 'PageUp', 'PageDown': 'PageDown',
      'ArrowUp': 'ArrowUp', 'ArrowDown': 'ArrowDown',
      'ArrowLeft': 'ArrowLeft', 'ArrowRight': 'ArrowRight',
      'Backquote': '`', 'Minus': '-', 'Equal': '=',
      'BracketLeft': '[', 'BracketRight': ']', 'Backslash': '\\',
      'Semicolon': ';', 'Quote': "'", 'Comma': ',', 'Period': '.', 'Slash': '/',
    };
    return specialKeys[code] || null;
  };

  const handleKeyDown = (e) => {
    if (!isListeningKey) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const code = e.code;
    
    if (code === 'Escape') {
      setIsListeningKey(false);
      return;
    }
    
    if (['ControlLeft', 'ControlRight', 'ShiftLeft', 'ShiftRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight'].includes(code)) {
      return;
    }
    
    const keyName = codeToKeyName(code);
    if (!keyName || disabledKeys.includes(keyName)) return;
    
    setInternalCustomKey(keyName);
    onChange([...modifiers, keyName].join('+'));
    setIsListeningKey(false);
  };

  const removeCustomKey = (e) => {
    e.stopPropagation();
    setInternalCustomKey('');
    onChange('');
    setIsListeningKey(true);
    setTimeout(() => keyInputRef.current?.focus(), 0);
  };

  useEffect(() => {
    if (value === '') {
      setInternalCustomKey('');
      if (fixedKeyOptions) {
        setInternalKeyType(fixedKeyOptions[0]?.value || '');
      }
    } else {
      const { modifiers: newModifiers, keyType: newKeyType, customKey: newCustomKey } = parseValue(value);
      setInternalModifiers(newModifiers);
      setInternalKeyType(newKeyType);
      setInternalCustomKey(newCustomKey);
    }
  }, [value]);
  
  const startListeningKey = (e) => {
    e.stopPropagation();
    setDropdownType(null);
    setIsListeningKey(true);
    keyInputRef.current?.focus();
  };
  
  const currentKeyLabel = fixedKeyOptions?.find(opt => opt.value === keyType)?.label || keyType;
  const isDropdownOpen = dropdownType !== null;
  
  return (
    <div className="flex flex-col items-end gap-1">
      <div ref={containerRef} className="relative">
        <div 
          className={`
            inline-flex items-center h-9 px-2 gap-1
            border rounded-lg cursor-pointer
            bg-qc-panel
            transition-all duration-200
            ${hasError 
              ? 'border-red-500 ring-1 ring-red-500/30' 
              : isDropdownOpen || isListeningKey
                ? 'border-blue-500 ring-1 ring-blue-500/50' 
                : 'border-qc-border hover:border-qc-border-strong'
            }
          `}
          onClick={() => {
            if (isListeningKey) return;
            setDropdownType(dropdownType === 'modifier' ? null : 'modifier');
          }}
        >
          {/* 修饰键标签 */}
          {modifiers.map(mod => (
            <span 
              key={mod}
              className={`
                inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-xs font-medium
                ${fixedModifiers.includes(mod)
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-qc-panel-2 text-qc-fg'
                }
              `}
            >
              {mod}
              {!fixedModifiers.includes(mod) && (
                <button
                  type="button"
                  onClick={(e) => removeModifier(mod, e)}
                  className="ml-0.5 hover:text-red-500 transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </span>
          ))}
          
          {/* 固定按键文本显示 */}
          {fixedKey && (
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
              {fixedKey}
            </span>
          )}
          
          {/* 固定按键下拉选择 */}
          {showKeySelect && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDropdownType(dropdownType === 'keyType' ? null : 'keyType');
              }}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100"
            >
              {currentKeyLabel}
              <svg className={`w-3 h-3 transition-transform ${dropdownType === 'keyType' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
          
          {/* 自定义按键输入 */}
          {showKeyInput && (
            customKey ? (
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                {customKey}
                <button
                  type="button"
                  onClick={removeCustomKey}
                  className="ml-0.5 hover:text-red-500 transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={startListeningKey}
                className={`
                  px-2 py-0.5 rounded text-xs border border-dashed
                  ${isListeningKey 
                    ? 'border-blue-400 bg-blue-50 text-blue-600 animate-pulse'
                    : 'border-qc-border text-qc-fg-subtle hover:border-qc-border-strong hover:text-qc-fg-muted'
                  }
                `}
              >
                {isListeningKey ? t('settings.shortcuts.pressKey') : t('settings.shortcuts.addKey')}
              </button>
            )
          )}
          
          {/* 隐藏输入框 */}
          {showKeyInput && (
            <input
              ref={keyInputRef}
              type="text"
              className="absolute opacity-0 w-0 h-0"
              onKeyDown={handleKeyDown}
              onBlur={() => setIsListeningKey(false)}
            />
          )}
          
          {/* 下拉箭头 */}
          <svg 
            className={`w-4 h-4 ml-auto text-qc-fg-subtle transition-transform ${dropdownType === 'modifier' ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        
        {/* 下拉菜单 */}
        {isDropdownOpen && (
          <div className="absolute top-full left-0 mt-1 min-w-full bg-qc-panel border border-qc-border rounded-lg shadow-lg z-50 py-1">
            {dropdownType === 'modifier' && modifierOptions.map(mod => {
              const isSelected = modifiers.includes(mod);
              const isFixed = fixedModifiers.includes(mod);
              
              return (
                <button
                  key={mod}
                  type="button"
                  onClick={() => toggleModifier(mod)}
                  disabled={isFixed}
                  className={`
                    w-full px-3 py-1.5 text-left text-sm flex items-center justify-between
                    ${isFixed 
                      ? 'text-qc-fg-subtle cursor-not-allowed' 
                      : isSelected
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-qc-fg hover:bg-qc-hover'
                    }
                  `}
                >
                  <span>{mod}</span>
                  {isSelected && (
                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })}
            
            {dropdownType === 'keyType' && fixedKeyOptions?.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => selectKeyType(opt.value)}
                className={`
                  w-full px-3 py-1.5 text-left text-sm flex items-center justify-between
                  ${keyType === opt.value
                    ? 'bg-purple-50 text-purple-700 font-medium'
                    : 'text-qc-fg hover:bg-qc-hover'
                  }
                `}
              >
                <span>{opt.label}</span>
                {keyType === opt.value && (
                  <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
      
      {/* 错误信息 */}
      {hasError && errorMessage && (
        <span className="text-xs text-red-500">
          {errorMessage}
        </span>
      )}
    </div>
  );
}

export default ShortcutComboInput;
