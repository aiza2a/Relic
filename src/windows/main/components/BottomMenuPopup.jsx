import '@tabler/icons-webfont/dist/tabler-icons.min.css';
import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useSnapshot } from 'valtio';
import { settingsStore } from '@shared/store/settingsStore';
import Tooltip from '@shared/components/common/Tooltip.jsx';

// 通用底部菜单弹出组件
const BottomMenuPopup = forwardRef(({
  icon: Icon,
  label,
  title,
  menuItems = []
}, ref) => {
  const settings = useSnapshot(settingsStore);
  const uiAnimationEnabled = settings.uiAnimationEnabled !== false;
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [expandedMenuItem, setExpandedMenuItem] = useState(null);
  const closeTimerRef = useRef(null);
  const animationTimerRef = useRef(null);
  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
      if (animationTimerRef.current) {
        clearTimeout(animationTimerRef.current);
      }
    };
  }, []);
  const handleClose = () => {
    if (isPinned) return;
    setIsClosing(true);
    animationTimerRef.current = setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
    }, 200);
  };
  const togglePopup = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setIsOpen(!isOpen);
  };

  // 切换固定状态
  const togglePin = e => {
    if (e) {
      e.stopPropagation();
    }
    setIsPinned(!isPinned);
  };

  // 临时显示菜单面板
  const showTemporarily = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (!isOpen) {
      setIsOpen(true);
    }
    if (!isPinned) {
      closeTimerRef.current = setTimeout(() => {
        handleClose();
      }, 500);
    }
  };

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    togglePin: () => togglePin(null),
    showTemporarily
  }));
  const handleMouseEnter = () => {
    if (isClosing) {
      return;
    }
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };
  const handleMouseLeave = () => {
    if (!isPinned && isOpen && !isClosing) {
      closeTimerRef.current = setTimeout(() => {
        handleClose();
      }, 150);
    }
  };

  // 切换菜单项展开状态
  const toggleMenuItem = menuItemId => {
    setExpandedMenuItem(expandedMenuItem === menuItemId ? null : menuItemId);
  };
  const handleSelectOption = (menuItem, option) => {
    if (menuItem.onSelect) {
      menuItem.onSelect(option.value);
    }
    setExpandedMenuItem(null);
  };
  return <>
    <div className="relative flex flex-col h-full w-full" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      {/* 弹出面板 */}
      {isOpen && <div className={`groups-panel absolute bottom-full left-0 right-0 backdrop-blur-xl bg-qc-panel border border-b-0 border-qc-border rounded-t-xl shadow-2xl z-40 overflow-hidden flex flex-col ${uiAnimationEnabled ? (isClosing ? 'animate-slide-down' : 'animate-slide-up') : ''}`} style={{
        maxHeight: '350px'
      }}>
        {/* 头部 */}
        <div className="flex items-center justify-between px-2.5 py-2 border-b border-qc-border">
          <h3 className="text-xs font-semibold text-qc-fg">
            {title}
          </h3>
          <div className="flex items-center gap-0.5">
            <Tooltip content={isPinned ? '取消固定' : '固定'} placement="bottom" asChild>
              <button onClick={togglePin} className={`p-1 rounded transition-all ${isPinned ? 'bg-blue-500 text-white' : 'hover:bg-qc-hover text-qc-fg-muted'}`}>
                {isPinned ? <i className="ti ti-pinned" style={{
                  fontSize: 12
                }}></i> : <i className="ti ti-pin" style={{
                  fontSize: 12
                }}></i>}
              </button>
            </Tooltip>
          </div>
        </div>

        {/* 菜单项列表 */}
        <div className="flex-1 overflow-y-auto py-1">
          {menuItems.map(menuItem => {
            const isExpanded = expandedMenuItem === menuItem.id;
            const currentOption = menuItem.options?.find(opt => opt.value === menuItem.currentValue);
            return <div key={menuItem.id} className="border-b border-qc-border last:border-b-0">
              <Tooltip content={menuItem.label} placement="right" asChild>
                <div onClick={() => toggleMenuItem(menuItem.id)} className="flex items-center gap-2 px-2.5 py-1.5 cursor-pointer hover:bg-qc-hover transition-all">
                  {menuItem.icon && <div className="flex-shrink-0 text-qc-fg-muted">
                    <i className={menuItem.icon} style={{ fontSize: 14 }} />
                  </div>}

                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] text-qc-fg-muted truncate">
                      {menuItem.label}
                    </div>
                    <div className="text-xs text-qc-fg font-medium truncate">
                      {currentOption?.label || '-'}
                    </div>
                  </div>

                  <div className={`flex-shrink-0 text-qc-fg-subtle transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                    <i className="ti ti-chevron-right" style={{
                      fontSize: 12
                    }}></i>
                  </div>
                </div>
              </Tooltip>

              {/* 子选项列表 */}
              {isExpanded && menuItem.options && <div className="bg-qc-panel-2">
                {menuItem.options.map(option => {
                  const OptionIcon = option.icon;
                  const isActive = menuItem.currentValue === option.value;
                  return <div key={option.value} onClick={e => {
                    e.stopPropagation();
                    handleSelectOption(menuItem, option);
                  }} className="group relative">
                    <div className={`flex items-center gap-2 px-4 py-1.5 cursor-pointer transition-all ${isActive ? 'bg-blue-500 text-white' : 'text-qc-fg hover:bg-qc-hover'}`}>
                      {OptionIcon && <div className="flex-shrink-0">
                        <OptionIcon size={12} />
                      </div>}

                      <div className="flex-1 text-xs truncate">
                        {option.label}
                      </div>

                      {isActive && <div className="flex-shrink-0">
                        <i className="ti ti-check" style={{
                          fontSize: 10
                        }}></i>
                      </div>}
                    </div>
                  </div>;
                })}
              </div>}
            </div>;
          })}
        </div>
      </div>}

      {/* 触发按钮 */}
      <Tooltip content={title} placement="top" asChild>
        <button onClick={togglePopup} className={`flex items-center justify-center gap-1.5 w-full h-full px-3 transition-all duration-300 ${isOpen ? 'bg-qc-panel/95 text-qc-fg shadow-lg border border-t-0 border-qc-border' : 'bg-transparent text-qc-fg-muted hover:bg-qc-hover'}`}>
          {Icon && <i className={Icon} style={{ fontSize: 12 }} />}
          <span className="text-[10px] font-medium truncate">
            {label}
          </span>
        </button>
      </Tooltip>
    </div>
  </>;
});
BottomMenuPopup.displayName = 'BottomMenuPopup';
export default BottomMenuPopup;