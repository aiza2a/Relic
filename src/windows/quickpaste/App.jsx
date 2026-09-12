import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { invoke } from '@tauri-apps/api/core';
import { useSnapshot } from 'valtio';
import { useTranslation } from 'react-i18next';
import { navigationStore } from '@shared/store/navigationStore';
import { groupsStore } from '@shared/store/groupsStore';
import { clipboardStore, loadClipboardRange, pasteClipboardItem, initClipboardItems } from '@shared/store/clipboardStore';
import { favoritesStore, loadFavoritesRange, pasteFavorite, initFavorites } from '@shared/store/favoritesStore';
import { settingsStore } from '@shared/store/settingsStore';
import { useTheme, applyThemeToBody } from '@shared/hooks/useTheme';
import { useSettingsSync } from '@shared/hooks/useSettingsSync';
import { ImageContent, FileContent, HtmlContent, TextContent } from '@windows/main/components/ClipboardContent';
import { getPrimaryType } from '@shared/utils/contentType';
import {
  DISPLAY_FORMAT_HTML,
  DISPLAY_FORMAT_IMAGE,
  resolveDisplayFormatByPriority,
} from '@shared/utils/displayFormatPriority';
import { playScrollSound } from '@shared/api';

const ITEM_HEIGHT = 52;
const ITEM_PADDING = 16;
const WHEEL_GESTURE_IDLE_DELAY = 80;

function QuickPasteWindow() {
  const { t } = useTranslation();
  const containerRef = useRef(null);
  const [activeIndex, setActiveIndexState] = useState(0);
  const [isHoveringCancel, setIsHoveringCancel] = useState(false);
  const [isContentReady, setIsContentReady] = useState(false);
  const [visibleCount, setVisibleCount] = useState(5);
  const showRequestRef = useRef(0);
  const activeIndexRef = useRef(0);
  const wheelBoundaryRef = useRef({ edge: null, lastEventAt: 0 });
  const navSnap = useSnapshot(navigationStore);
  const groupSnap = useSnapshot(groupsStore);
  const clipSnap = useSnapshot(clipboardStore);
  const favSnap = useSnapshot(favoritesStore);
  const settings = useSnapshot(settingsStore);
  const { theme, effectiveTheme, isDark, lightThemeStyle, darkThemeStyle } = useTheme();
  useSettingsSync();

  const isClipboardTab = navSnap.activeTab === 'clipboard';
  const currentItems = isClipboardTab ? clipSnap.items : favSnap.items;
  const totalCount = isClipboardTab ? clipSnap.totalCount : favSnap.totalCount;
  const itemsArray = useMemo(() => Array.from({ length: totalCount }, (_, i) => currentItems[i] || null), [currentItems, totalCount]);
  const title = isClipboardTab ? t('settings.quickpaste.window.clipboardHistory') : groupSnap.currentGroup;

  const resetWheelBoundary = useCallback(() => {
    wheelBoundaryRef.current = { edge: null, lastEventAt: 0 };
  }, []);

  const setActiveIndex = useCallback((index) => {
    activeIndexRef.current = index;
    setActiveIndexState(index);
  }, []);

  // 计算可见项目数量
  useEffect(() => {
    const updateVisibleCount = () => {
      if (containerRef.current) {
        const height = containerRef.current.clientHeight - ITEM_PADDING * 2;
        const count = Math.floor(height / ITEM_HEIGHT);
        setVisibleCount(Math.max(1, count));
      }
    };

    updateVisibleCount();
    window.addEventListener('resize', updateVisibleCount);
    return () => window.removeEventListener('resize', updateVisibleCount);
  }, []);

  const scrollOffset = useMemo(() => {
    if (totalCount <= visibleCount) {
      return 0;
    }

    const middlePosition = Math.floor(visibleCount / 2);
    const idealOffset = activeIndex - middlePosition;

    return Math.max(0, Math.min(idealOffset, totalCount - visibleCount));
  }, [activeIndex, visibleCount, totalCount]);

  // 计算可见的项目范围
  const visibleItems = useMemo(() => {
    const items = [];
    for (let i = 0; i < visibleCount && i + scrollOffset < totalCount; i++) {
      items.push({
        index: i + scrollOffset,
        item: itemsArray[i + scrollOffset]
      });
    }
    return items;
  }, [scrollOffset, visibleCount, totalCount, itemsArray]);

  useEffect(() => {
    const loadVisibleData = async () => {
      const start = scrollOffset;
      const end = Math.min(scrollOffset + visibleCount + 2, totalCount - 1);
      
      let needLoad = false;
      for (let i = start; i <= end; i++) {
        if (!(i in currentItems)) {
          needLoad = true;
          break;
        }
      }
      
      if (needLoad) {
        if (isClipboardTab) {
          await loadClipboardRange(start, end);
        } else {
          await loadFavoritesRange(groupSnap.currentGroup, start, end);
        }
      }
    };
    
    loadVisibleData();
  }, [scrollOffset, visibleCount, totalCount, currentItems, isClipboardTab, groupSnap.currentGroup]);

  useEffect(() => {
    const handleMouseLeave = () => setIsHoveringCancel(true);
    const handleMouseEnter = () => setIsHoveringCancel(false);

    document.documentElement.addEventListener('mouseleave', handleMouseLeave);
    document.documentElement.addEventListener('mouseenter', handleMouseEnter);
    return () => {
      document.documentElement.removeEventListener('mouseleave', handleMouseLeave);
      document.documentElement.removeEventListener('mouseenter', handleMouseEnter);
    };
  }, []);
  const handleItemClick = useCallback((index) => {
    resetWheelBoundary();
    setActiveIndex(index);
  }, [resetWheelBoundary, setActiveIndex]);
  useEffect(() => {
    applyThemeToBody(theme, 'quickpaste');
  }, [theme, lightThemeStyle, darkThemeStyle, effectiveTheme]);

  // 窗口隐藏时执行粘贴
  useEffect(() => {
    const unlisten = listen('quickpaste-hide', async () => {
      showRequestRef.current += 1;
      setIsContentReady(false);

      if (isHoveringCancel) return;
      const item = itemsArray[activeIndexRef.current];
      if (!item) return;
      try {
        isClipboardTab ? await pasteClipboardItem(item.id) : await pasteFavorite(item.id);
      } catch (error) {
        console.error('粘贴失败:', error);
      }
    });
    return () => unlisten.then(fn => fn());
  }, [isHoveringCancel, itemsArray, isClipboardTab]);
  useEffect(() => {
    const unlisten = listen('quickpaste-show', async () => {
      const requestId = showRequestRef.current + 1;
      showRequestRef.current = requestId;
      setIsContentReady(false);
      resetWheelBoundary();
      setActiveIndex(0);
      setIsHoveringCancel(false);

      try {
        if (navigationStore.activeTab === 'clipboard') {
          await initClipboardItems();
        } else {
          await initFavorites();
        }
      } catch (error) {
        console.error('刷新便捷粘贴数据失败:', error);
      }

      requestAnimationFrame(() => {
        if (showRequestRef.current === requestId) {
          setIsContentReady(true);
        }
      });
    });
    return () => {
      showRequestRef.current += 1;
      unlisten.then(fn => fn());
    };
  }, [resetWheelBoundary, setActiveIndex]);
  useEffect(() => {
    const unlisten = listen('navigation-changed', async event => {
      const { activeTab, currentGroup } = event.payload;
      navigationStore.activeTab = activeTab;
      if (currentGroup !== undefined) {
        groupsStore.currentGroup = currentGroup;
      }
      if (activeTab === 'clipboard') {
        await initClipboardItems();
      } else {
        await initFavorites();
      }
    });
    return () => unlisten.then(fn => fn());
  }, []);
  useEffect(() => {
    resetWheelBoundary();
    setActiveIndex(0);
  }, [navSnap.activeTab, groupSnap.currentGroup, totalCount, resetWheelBoundary, setActiveIndex]);

  // 滚轮切换项
  useEffect(() => {
    const handleWheel = (e) => {
      e.preventDefault();

      if (e.deltaY === 0 || totalCount <= 1) {
        return;
      }

      const direction = e.deltaY > 0 ? 1 : -1;
      const max = totalCount - 1;
      const currentIndex = activeIndexRef.current;
      const edge = direction > 0 ? 'end' : 'start';
      const reachedEdge = direction > 0 ? currentIndex === max : currentIndex === 0;

      if (!reachedEdge) {
        resetWheelBoundary();
        setActiveIndex(currentIndex + direction);
        playScrollSound();
        return;
      }

      const wheelBoundary = wheelBoundaryRef.current;
      const now = performance.now();
      if (
        wheelBoundary.edge === edge
        && now - wheelBoundary.lastEventAt >= WHEEL_GESTURE_IDLE_DELAY
      ) {
        resetWheelBoundary();
        setActiveIndex(direction > 0 ? 0 : max);
        playScrollSound();
        return;
      }

      wheelBoundaryRef.current = { edge, lastEventAt: now };
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      window.removeEventListener('wheel', handleWheel);
      resetWheelBoundary();
    };
  }, [totalCount, resetWheelBoundary, setActiveIndex]);

  useEffect(() => {
    const unlisten = listen('quickpaste-next', () => {
      resetWheelBoundary();
      playScrollSound();
      const max = totalCount - 1;
      const currentIndex = activeIndexRef.current;
      setActiveIndex(currentIndex < max ? currentIndex + 1 : 0);
    });
    return () => unlisten.then(fn => fn());
  }, [totalCount, resetWheelBoundary, setActiveIndex]);
  useEffect(() => {
    let resizeTimeout;
    const handleResize = async () => {
      const window = getCurrentWebviewWindow();
      const size = await window.innerSize();
      const scaleFactor = await window.scaleFactor();
      const logicalWidth = size.width / scaleFactor;
      const logicalHeight = size.height / scaleFactor;
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(async () => {
        try {
          await invoke('save_quickpaste_window_size', {
            width: Math.round(logicalWidth),
            height: Math.round(logicalHeight)
          });
        } catch (error) {
          console.error('保存窗口尺寸失败:', error);
        }
      }, 500);
    };
    const unlisten = listen('tauri://resize', handleResize);
    return () => {
      clearTimeout(resizeTimeout);
      unlisten.then(fn => fn());
    };
  }, []);

  const getTypeLabel = (item) => {
    if (!item || !item.content_type) return '';
    const primaryType = getPrimaryType(item.content_type);
    switch (primaryType) {
      case 'image': return t('filter.image');
      case 'file': return t('filter.file');
      case 'link': return t('filter.link');
      default: return t('filter.text');
    }
  };

  // 渲染内容
  const renderItemContent = (item) => {
    if (!item || !item.content_type) {
      return (
        <div className="w-full flex items-center">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-qc-fg-subtle rounded-full animate-pulse" />
            <span className="text-xs text-qc-fg-muted">加载中...</span>
          </div>
        </div>
      );
    }

    const primaryType = getPrimaryType(item.content_type);

    if (primaryType === 'image') {
      return (
        <div className="w-full h-7 overflow-hidden rounded flex items-center">
          <ImageContent item={item} />
        </div>
      );
    }

    if (primaryType === 'file') {
      return (
        <div className="w-full h-7 overflow-hidden flex items-center">
          <FileContent item={item} compact={true} />
        </div>
      );
    }

    const displayFormat = resolveDisplayFormatByPriority(item, settings.displayPriorityOrder);
    if (displayFormat === DISPLAY_FORMAT_IMAGE) {
      return (
        <div className="w-full h-7 overflow-hidden rounded flex items-center">
          <ImageContent item={item} />
        </div>
      );
    }

    if (displayFormat === DISPLAY_FORMAT_HTML && item.html_content) {
      return (
        <div className="w-full h-7 overflow-hidden">
          <HtmlContent htmlContent={item.html_content} lineClampClass="line-clamp-1" />
        </div>
      );
    }

    return (
      <div className="w-full h-7 overflow-hidden">
        <TextContent content={item.content || ''} lineClampClass="truncate leading-7" item={item} source={isClipboardTab ? 'clipboard' : 'favorite'} />
      </div>
    );
  };

  return (
    <div className={`absolute inset-0 transition-opacity duration-100 ease-out ${isContentReady ? 'visible opacity-100' : 'invisible opacity-0'} ${isDark ? 'dark' : ''}`}>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        :root, html, body, #root { background: transparent !important; background-color: transparent !important; }
      `}</style>

      <div 
        ref={containerRef}
        className="w-full h-full flex flex-col justify-center overflow-hidden"
        style={{ padding: `${ITEM_PADDING}px` }}
      >
        {!totalCount ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="px-6 py-4 bg-qc-surface/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-qc-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 flex items-center justify-center bg-qc-panel rounded-xl">
                  <i className={`ti ti-${isClipboardTab ? 'clipboard-off' : 'star-off'} text-qc-fg-subtle text-lg`} />
                </div>
                <span className="text-sm text-qc-fg-muted font-medium">
                  {isClipboardTab ? t('settings.quickpaste.window.emptyClipboard') : t('settings.quickpaste.window.emptyFavorites')}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div 
            className="flex flex-col items-center gap-1 transition-opacity duration-150"
            style={{ opacity: isHoveringCancel ? 0.4 : 1 }}
          >
            {/* 标题 */}
            <div className="flex items-center justify-center mb-0.5">
              <span 
                className="text-xs font-semibold text-white truncate"
                style={{ 
                  WebkitTextStroke: '0.5px rgba(0,0,0,0.8)',
                  textShadow: '0 1px 3px rgba(0,0,0,0.5)'
                }}
              >
                {title} · {totalCount}
              </span>
            </div>
            
            {/* 项目列表 */}
            {visibleItems.map(({ index, item }) => {
              const active = activeIndex === index;
              
              return (
                <div
                  key={index}
                  className={`
                    w-full flex items-center gap-3 px-4 rounded-xl cursor-pointer
                    transition-all duration-100 ease-out origin-center
                    ${active
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 shadow-lg shadow-blue-500/40 scale-100'
                      : 'bg-qc-surface/80 backdrop-blur-xl shadow-md shadow-black/8 scale-[0.92] opacity-80 hover:opacity-90 hover:shadow-lg'
                    }
                  `}
                  style={{ 
                    height: `${ITEM_HEIGHT - 8}px`,
                    border: '0.5px solid rgba(0,0,0,0.1)'
                  }}
                  onClick={() => handleItemClick(index)}
                >
                  {/* 序号 */}
                  <div className={`
                    flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-md text-xs font-bold
                    ${active
                      ? 'bg-white/25 text-white'
                      : 'bg-qc-panel text-qc-fg-muted'
                    }
                  `}>
                    {index + 1}
                  </div>

                  {/* 内容区域 */}
                  <div className={`
                    flex-1 min-w-0 text-sm
                    ${active ? 'text-white font-medium' : 'text-qc-fg'}
                  `}>
                    {item ? renderItemContent(item) : (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-qc-fg-subtle rounded-full animate-pulse" />
                        <div className="flex-1 h-3 bg-qc-panel rounded animate-pulse" />
                      </div>
                    )}
                  </div>

                  {/* 类型标签 */}
                  {item && (
                    <div className={`
                      flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium
                      ${active
                        ? 'bg-white/20 text-white/90'
                        : 'bg-qc-panel text-qc-fg-subtle'
                      }
                    `}>
                      {getTypeLabel(item)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
export default QuickPasteWindow;
