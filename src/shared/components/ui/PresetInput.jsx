import '@tabler/icons-webfont/dist/tabler-icons.min.css';
import { useEffect, useRef, useState } from 'react';

function PresetInput({
  type = 'text',
  value,
  onChange,
  onCommit,
  options = [],
  className = '',
  inputClassName = '',
  menuClassName = '',
  disabled = false,
  placeholder = '',
  onBlur,
  onFocus,
  onKeyDown,
  ...restProps
}) {
  const [draftValue, setDraftValue] = useState(value ?? '');
  const [open, setOpen] = useState(false);
  const [menuDirection, setMenuDirection] = useState('down');
  const rootRef = useRef(null);
  const isNumberInput = type === 'number';
  const inputType = isNumberInput ? 'text' : type;
  const inputMode = isNumberInput ? restProps.inputMode || 'numeric' : restProps.inputMode;
  const pattern = isNumberInput ? restProps.pattern || '[0-9]*' : restProps.pattern;

  useEffect(() => {
    setDraftValue(value ?? '');
  }, [value]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const updateMenuDirection = () => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;

      const estimatedMenuHeight = Math.min(options.length * 36 + 10, 256);
      const bottomSpace = window.innerHeight - rect.bottom;
      const topSpace = rect.top;
      setMenuDirection(bottomSpace < estimatedMenuHeight && topSpace > bottomSpace ? 'up' : 'down');
    };

    updateMenuDirection();
    window.addEventListener('resize', updateMenuDirection);
    window.addEventListener('scroll', updateMenuDirection, true);
    return () => {
      window.removeEventListener('resize', updateMenuDirection);
      window.removeEventListener('scroll', updateMenuDirection, true);
    };
  }, [open, options.length]);

  const commitValue = (nextValue = draftValue) => {
    const committedValue = onCommit?.(nextValue);
    if (committedValue !== undefined && typeof committedValue?.then !== 'function') {
      setDraftValue(committedValue);
    }
  };

  const handleInputChange = (event) => {
    const nextValue = event.target.value;
    setDraftValue(nextValue);
    onChange?.(nextValue, event);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.currentTarget.blur();
      return;
    }
    onKeyDown?.(event);
  };

  const handleOptionSelect = (option) => {
    const nextValue = option.value;
    setDraftValue(nextValue);
    setOpen(false);
    onChange?.(nextValue);
    commitValue(nextValue);
  };

  const handleToggleMenu = () => {
    if (!open) {
      const rect = rootRef.current?.getBoundingClientRect();
      if (rect) {
        const estimatedMenuHeight = Math.min(options.length * 36 + 10, 256);
        const bottomSpace = window.innerHeight - rect.bottom;
        const topSpace = rect.top;
        setMenuDirection(bottomSpace < estimatedMenuHeight && topSpace > bottomSpace ? 'up' : 'down');
      }
    }
    setOpen(current => !current);
  };

  const menuPositionClass = menuDirection === 'up' ? 'bottom-full mb-1' : 'top-full mt-1';

  return (
    <div ref={rootRef} className={`relative inline-flex ${className}`}>
      <div className="flex h-10 w-full items-center rounded-lg border border-qc-border bg-qc-panel text-qc-fg transition-shadow focus-within:ring-2 focus-within:ring-blue-500">
        <input
          value={draftValue}
          disabled={disabled}
          placeholder={placeholder}
          {...restProps}
          type={inputType}
          inputMode={inputMode}
          pattern={pattern}
          className={`min-w-0 flex-1 rounded-l-lg bg-transparent px-3 py-2 text-sm text-qc-fg placeholder:text-qc-fg-subtle focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 ${inputClassName}`}
          onChange={handleInputChange}
          onBlur={(event) => {
            commitValue();
            onBlur?.(event);
          }}
          onFocus={onFocus}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          disabled={disabled || options.length === 0}
          className="flex h-full w-9 flex-shrink-0 items-center justify-center rounded-r-lg border-l border-qc-border text-qc-fg-muted transition-colors hover:bg-qc-hover hover:text-qc-fg disabled:cursor-not-allowed disabled:opacity-60"
          onMouseDown={(event) => event.preventDefault()}
          onClick={handleToggleMenu}
        >
          <i className={`ti ti-chevron-down text-base transition-transform ${open ? 'rotate-180' : ''}`}></i>
        </button>
      </div>

      {open && (
        <div className={`absolute right-0 ${menuPositionClass} z-50 max-h-64 min-w-full overflow-y-auto rounded-lg border border-qc-border bg-qc-panel py-1 shadow-lg ${menuClassName}`}>
          {options.map(option => (
            <button
              key={option.value}
              type="button"
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-qc-fg transition-colors hover:bg-qc-hover"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => handleOptionSelect(option)}
            >
              <span className="whitespace-nowrap">{option.label}</span>
              {String(option.value) === String(value) && (
                <i className="ti ti-check text-sm text-blue-500"></i>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default PresetInput;
