import '@tabler/icons-webfont/dist/tabler-icons.min.css';
import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useInputFocus, focusWindowImmediately } from '@shared/hooks/useInputFocus';
import { useSnapshot } from 'valtio';
import { settingsStore } from '@shared/store/settingsStore';
import Tooltip from '@shared/components/common/Tooltip.jsx';
const TitleBarSearch = forwardRef(({
  value,
  onChange,
  placeholder,
  isVertical = false,
  position = 'top'
}, ref) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputValue, setInputValue] = useState(value || '');
  const inputRef = useInputFocus();
  const searchRef = useRef(null);
  const isComposingRef = useRef(false);
  const settings = useSnapshot(settingsStore);
  const uiAnimationEnabled = settings.uiAnimationEnabled !== false;

  // 搜索框清空按钮样式
  const searchInputStyle = `
        .titlebar-search input[type="search"]::-webkit-search-cancel-button {
            -webkit-appearance: none;
            appearance: none;
            height: 14px;
            width: 14px;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ef4444' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cline x1='18' y1='6' x2='6' y2='18'%3E%3C/line%3E%3Cline x1='6' y1='6' x2='18' y2='18'%3E%3C/line%3E%3C/svg%3E");
            background-size: 14px 14px;
            cursor: pointer;
            opacity: 0.6;
            transition: opacity 0.2s;
        }
        .titlebar-search input[type="search"]::-webkit-search-cancel-button:hover {
            opacity: 1;
        }
    `;

  // 决定是否显示为扩展状态
  useEffect(() => {
    if (!isComposingRef.current) {
      setInputValue(value || '');
    }
  }, [value]);

  const shouldExpand = isFocused || inputValue.length > 0;
  useEffect(() => {
    setIsExpanded(shouldExpand);
  }, [shouldExpand]);
  const handleIconClick = () => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  };
  const handleFocus = () => {
    setIsFocused(true);
    if (inputRef.current && inputValue) {
      setTimeout(() => {
        inputRef.current.select();
      }, 100);
    }
  };
  const handleChange = e => {
    const nextValue = e.target.value;
    setInputValue(nextValue);

    if (e.nativeEvent?.isComposing || isComposingRef.current) {
      return;
    }

    onChange(nextValue);
  };
  const handleCompositionStart = () => {
    isComposingRef.current = true;
  };
  const handleCompositionEnd = e => {
    const nextValue = e.currentTarget.value;
    isComposingRef.current = false;
    setInputValue(nextValue);
    onChange(nextValue);
  };

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    focus: async () => {
      if (inputRef.current) {
        try {
          await focusWindowImmediately();
          inputRef.current.focus();
          inputRef.current.select();
        } catch (error) {
          console.error('聚焦搜索框失败:', error);
        }
      }
    },
    blur: () => {
      inputRef.current?.blur();
    },
    toggleFocus: async () => {
      if (document.activeElement === inputRef.current) {
        inputRef.current.blur();
        return;
      }

      if (inputRef.current) {
        try {
          await focusWindowImmediately();
          inputRef.current.focus();
          inputRef.current.select();
        } catch (error) {
          console.error('切换搜索框焦点失败:', error);
        }
      }
    },
    isFocused: () => document.activeElement === inputRef.current
  }));
  return <>
            <style>{searchInputStyle}</style>
            <div ref={searchRef} className={`titlebar-search relative flex ${isVertical ? 'flex-col items-center justify-end h-7' : 'min-w-0 flex-1 flex-row items-center justify-end'}`}>
                {/* 输入框 - 根据方向展开 */}
                <input ref={inputRef} type="search" value={inputValue} onChange={handleChange} onCompositionStart={handleCompositionStart} onCompositionEnd={handleCompositionEnd} onFocus={handleFocus} onBlur={() => setIsFocused(false)} placeholder={placeholder} style={isVertical ? {
        writingMode: 'vertical-rl',
        textAlign: 'start'
      } : {}} className={`${isVertical ? 'absolute bottom-6 left-0 w-7 py-2' : 'h-7 min-w-0'} text-sm bg-qc-panel border border-qc-border rounded-lg outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-qc-fg placeholder:text-qc-fg-subtle shadow-sm ${uiAnimationEnabled ? 'transition-all duration-300 ease-in-out' : ''} ${isExpanded ? isVertical ? 'h-48 opacity-100 mb-1' : 'flex-1 opacity-100 mr-1 px-2' : isVertical ? 'h-0 opacity-0 pointer-events-none border-0' : 'w-0 flex-none opacity-0 pointer-events-none border-0 px-0'}`} />

                {/* 搜索图标 - 始终保持在原位 */}
                <Tooltip content="搜索" placement={isVertical ? (position === 'left' ? 'right' : 'left') : 'bottom'} asChild>
                  <button onClick={handleIconClick} className={`relative z-10 flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-qc-hover text-qc-fg-muted hover:text-blue-500 ${uiAnimationEnabled ? 'transition-all duration-200' : ''}`}>
                      <i className="ti ti-search" style={{
            fontSize: 16
          }}></i>
                  </button>
                </Tooltip>
            </div>
        </>;
});
TitleBarSearch.displayName = 'TitleBarSearch';
export default TitleBarSearch;
