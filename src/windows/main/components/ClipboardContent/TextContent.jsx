import { useRef, useLayoutEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { highlightText } from '@shared/utils/highlightText';
import { toast, TOAST_POSITIONS, TOAST_SIZES } from '@shared/store/toastStore';
import Tooltip from '@shared/components/common/Tooltip.jsx';
import { formatColorCodeLike, parseStandaloneColorCode } from '@shared/utils/colorCode';

// 文本内容组件
function TextContent({
  content,
  lineClampClass,
  searchKeyword,
  rowHeight = 'medium',
  item,
  source = 'clipboard',
  autoRowMaxLines = 18,
  maxContentHeightPx
}) {
  const { t } = useTranslation();
  const wrapperRef = useRef(null);
  const containerRef = useRef(null);
  const [isPickingColor, setIsPickingColor] = useState(false);
  const colorInfo = useMemo(() => parseStandaloneColorCode(content), [content]);
  const pickColorLabel = t('clipboard.pickColor', '选择颜色');
  const clampLineCount = useMemo(() => {
    const match = String(lineClampClass || '').match(/line-clamp-(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }, [lineClampClass]);
  const shouldUseAdaptiveLineHeight = rowHeight !== 'auto'
    && Number.isFinite(clampLineCount)
    && clampLineCount > 0;

  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    const container = containerRef.current;

    if (!shouldUseAdaptiveLineHeight || !wrapper || !container) {
      container?.style.removeProperty('line-height');
      container?.style.removeProperty('max-height');
      return;
    }

    let frameId = null;
    let lastWrapperHeight = null;

    const applyLineHeight = () => {
      const wrapperHeight = wrapper.getBoundingClientRect().height;
      const nextLineHeight = Math.floor((wrapperHeight / clampLineCount) * 100) / 100;

      if (!Number.isFinite(nextLineHeight) || nextLineHeight <= 0) {
        return;
      }
      if (lastWrapperHeight !== null && Math.abs(wrapperHeight - lastWrapperHeight) < 0.1) {
        return;
      }
      lastWrapperHeight = wrapperHeight;

      // 向下取整，避免 WebView 子像素取整后最后一行超出内容区而被整行裁掉。
      container.style.lineHeight = `${nextLineHeight}px`;
      container.style.removeProperty('max-height');
    };

    const scheduleLineHeightUpdate = () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }

      frameId = requestAnimationFrame(() => {
        frameId = null;
        applyLineHeight();
      });
    };

    // 根据真实内容区高度分配行高，避免 padding 和字体取整导致裁剪。
    applyLineHeight();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', scheduleLineHeightUpdate);
      return () => {
        if (frameId) {
          cancelAnimationFrame(frameId);
        }
        window.removeEventListener('resize', scheduleLineHeightUpdate);
        container.style.removeProperty('line-height');
        container.style.removeProperty('max-height');
      };
    }

    const resizeObserver = new ResizeObserver(entries => {
      const nextHeight = entries[0]?.contentRect.height;
      if (Number.isFinite(nextHeight)
        && lastWrapperHeight !== null
        && Math.abs(nextHeight - lastWrapperHeight) < 0.1) {
        return;
      }
      scheduleLineHeightUpdate();
    });
    resizeObserver.observe(wrapper);

    return () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
      resizeObserver.disconnect();
      container.style.removeProperty('line-height');
      container.style.removeProperty('max-height');
    };
  }, [clampLineCount, shouldUseAdaptiveLineHeight]);

  const handlePickColor = async (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (!colorInfo || !item?.id || isPickingColor) {
      return;
    }

    if (typeof window === 'undefined' || !window.EyeDropper) {
      toast.warning(t('clipboard.eyeDropperUnsupported', '当前环境不支持 EyeDropper 取色器'), {
        position: TOAST_POSITIONS.BOTTOM_RIGHT,
        size: TOAST_SIZES.EXTRA_SMALL
      });
      return;
    }

    setIsPickingColor(true);
    try {
      const result = await new window.EyeDropper().open();
      const nextContent = formatColorCodeLike(colorInfo, result.sRGBHex);

      if (source === 'favorite') {
        const { updateFavorite } = await import('@shared/api/favorites');
        await updateFavorite(item.id, item.title || '', nextContent, item.group_name);
      } else {
        const { updateClipboardItem } = await import('@shared/api/clipboard');
        await updateClipboardItem(item.id, nextContent);
      }
    } catch (error) {
      if (error?.name !== 'AbortError') {
        console.error('更新颜色失败:', error);
        toast.error(t('clipboard.colorUpdateFailed', '更新颜色失败'), {
          position: TOAST_POSITIONS.BOTTOM_RIGHT,
          size: TOAST_SIZES.EXTRA_SMALL
        });
      }
    } finally {
      setIsPickingColor(false);
    }
  };

  const renderedContent = searchKeyword
    ? highlightText(content, searchKeyword)
    : content;

  const clampClass = rowHeight === 'auto' ? '' : lineClampClass;
  const autoClampStyle = rowHeight === 'auto'
    ? {
        display: '-webkit-box',
        WebkitLineClamp: autoRowMaxLines,
        WebkitBoxOrient: 'vertical'
      }
    : undefined;

  const textClass = rowHeight === 'auto'
    ? 'text-sm leading-normal'
    : 'text-sm';
  const contentClass = colorInfo
    ? 'flex h-full items-center gap-2 min-w-0 max-w-full'
    : '';

  const wrapperStyle = rowHeight === 'auto' && Number.isFinite(Number(maxContentHeightPx))
    ? { maxHeight: `${Number(maxContentHeightPx)}px` }
    : undefined;

  return (
    <div ref={wrapperRef} className="h-full min-h-0 overflow-hidden" style={wrapperStyle}>
      <div
        ref={containerRef}
        className={`${textClass} text-qc-fg break-all whitespace-pre-wrap ${clampClass} overflow-hidden min-h-0 w-full`}
        style={autoClampStyle}
      >
        <span className={contentClass}>
          {colorInfo && (
            <Tooltip content={pickColorLabel} placement="top" asChild>
              <button
                type="button"
                data-no-drag="true"
                aria-label={pickColorLabel}
                className="relative top-[0.5px] block h-4 w-4 flex-none cursor-pointer rounded-[4px] border border-qc-border-strong p-0 leading-none shadow-sm transition-transform duration-150 hover:scale-110 disabled:cursor-wait disabled:opacity-70"
                style={{ backgroundColor: colorInfo.srgbHex }}
                disabled={isPickingColor}
                onClick={handlePickColor}
                onMouseDown={(event) => event.stopPropagation()}
              />
            </Tooltip>
          )}
          <span className="min-w-0 break-all">{renderedContent}</span>
        </span>
      </div>
    </div>
  );
}
export default TextContent;
