import '@tabler/icons-webfont/dist/tabler-icons.min.css';
import { useTranslation } from 'react-i18next';
import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import Tooltip from '@shared/components/common/Tooltip.jsx';

const MIN_BOTTOM_POSITION = 16;

function FloatingToolbar({
  showScrollTop = false,
  showAddFavorite = false,
  onScrollTop,
  onAddFavorite
}) {
  const {
    t
  } = useTranslation();
  const [bottomPosition, setBottomPosition] = useState(MIN_BOTTOM_POSITION);
  const [isDragging, setIsDragging] = useState(false);
  const [maxBottom, setMaxBottom] = useState(null);
  const dragRef = useRef({
    startY: 0,
    startBottom: 0
  });
  const containerRef = useRef(null);

  // 判断是否应该显示工具栏
  const shouldShow = showScrollTop || showAddFavorite;

  // 计算最大位置并调整当前位置
  useLayoutEffect(() => {
    if (!shouldShow || !containerRef.current) return undefined;

    const toolbar = containerRef.current;
    const parent = toolbar.offsetParent;
    if (!parent) return undefined;

    const updateMaxBottom = () => {
      const parentHeight = parent.clientHeight;
      const toolbarHeight = toolbar.clientHeight;
      const newMaxBottom = parentHeight - toolbarHeight - MIN_BOTTOM_POSITION;
      if (newMaxBottom < MIN_BOTTOM_POSITION) {
        return;
      }

      setMaxBottom(current => current === newMaxBottom ? current : newMaxBottom);
      setBottomPosition(current => Math.min(Math.max(current, MIN_BOTTOM_POSITION), newMaxBottom));
    };

    updateMaxBottom();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(updateMaxBottom);
      observer.observe(parent);
      observer.observe(toolbar);
      return () => observer.disconnect();
    }

    window.addEventListener('resize', updateMaxBottom);
    return () => {
      window.removeEventListener('resize', updateMaxBottom);
    };
  }, [shouldShow]);

  // 处理拖拽开始
  const handleDragStart = e => {
    e.preventDefault();
    setIsDragging(true);
    dragRef.current = {
      startY: e.clientY,
      startBottom: bottomPosition
    };
  };

  // 处理拖拽移动
  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = e => {
      const deltaY = dragRef.current.startY - e.clientY;
      let newBottom = dragRef.current.startBottom + deltaY;
      newBottom = Math.max(MIN_BOTTOM_POSITION, newBottom);
      if (maxBottom !== null) {
        newBottom = Math.min(newBottom, maxBottom);
      }
      setBottomPosition(newBottom);
    };
    const handleMouseUp = () => {
      setIsDragging(false);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, bottomPosition, maxBottom]);

  // 工具栏容器类名
  const containerClasses = `
    absolute
    right-4
    flex flex-col
    bg-qc-panel
    rounded-md
    shadow-lg
    p-1
    z-30
    border border-qc-border
    ${isDragging ? '' : 'transition-all duration-300'}
    ${shouldShow ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}
  `.trim().replace(/\s+/g, ' ');

  // 按钮基础类名
  const buttonClasses = `
    flex items-center justify-center
    w-6 h-6
    rounded
    bg-qc-panel-2
    hover:bg-qc-hover
    text-qc-fg
    transition-colors duration-150
    cursor-pointer
  `.trim().replace(/\s+/g, ' ');
  const getButtonWrapperClasses = (show, hasMargin) => `
    transition-all duration-200 origin-center overflow-hidden
    ${show ? `opacity-100 scale-100 h-6 ${hasMargin ? 'mt-1' : ''}` : 'opacity-0 scale-0 h-0 mt-0'}
  `.trim().replace(/\s+/g, ' ');

  // 拖拽手柄类名
  const dragHandleClasses = `
    w-full h-2 mt-1
    flex items-center justify-center
    ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}
    text-qc-fg-subtle
    hover:text-qc-fg-muted
    transition-colors duration-150
  `.trim().replace(/\s+/g, ' ');
  return <div ref={containerRef} className={containerClasses} style={{
    bottom: `${bottomPosition}px`
  }} data-no-drag>
      {/* 返回顶部按钮 */}
      <div className={getButtonWrapperClasses(showScrollTop, false)}>
        <Tooltip content={t('floatingToolbar.scrollToTop')} placement="left" asChild>
          <button className={buttonClasses} onClick={onScrollTop} aria-label={t('floatingToolbar.scrollToTop')}>
            <i className="ti ti-arrow-bar-to-up" style={{
            fontSize: 14
          }}></i>
          </button>
        </Tooltip>
      </div>
      
      {/* 添加收藏按钮 */}
      <div className={getButtonWrapperClasses(showAddFavorite, showScrollTop)}>
        <Tooltip content={t('floatingToolbar.addFavorite')} placement="left" asChild>
          <button className={buttonClasses} onClick={onAddFavorite} aria-label={t('floatingToolbar.addFavorite')}>
            <i className="ti ti-plus" style={{
            fontSize: 14
          }}></i>
          </button>
        </Tooltip>
      </div>
      
      {/* 拖拽手柄 */}
      <Tooltip content={t('floatingToolbar.dragToMove')} placement="left" asChild>
        <div className={dragHandleClasses} onMouseDown={handleDragStart}>
          <i className="ti ti-grip-horizontal" style={{
          fontSize: 14
        }}></i>
        </div>
      </Tooltip>
    </div>;
}
export default FloatingToolbar;
