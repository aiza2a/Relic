import { useEffect, useRef } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { sanitizeHTML } from '@shared/utils/htmlProcessor';
import { invoke } from '@tauri-apps/api/core';
import { highlightHtmlContent, clearHighlights, scrollToFirstHighlight } from '@shared/utils/highlightText';

const PLACEHOLDER_SRC = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2YwZjBmMCIvPjwvc3ZnPg==';
const ERROR_SRC = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2ZmZWJlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjEyIiBmaWxsPSIjYzYyODI4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+5Zu+54mH5Yqg6L295aSx6LSlPC90ZXh0Pjwvc3ZnPg==';

// HTML 富文本内容组件
function HtmlContent({
  htmlContent,
  lineClampClass,
  searchKeyword,
  rowHeight = 'medium',
  autoRowMaxLines = 18,
  maxContentHeightPx
}) {
  const contentRef = useRef(null);
  const processedRef = useRef(null);
  const hasScrolledRef = useRef(false);
  const prevKeywordRef = useRef('');

  useEffect(() => {
    if (!contentRef.current || processedRef.current === htmlContent) return;
    processedRef.current = htmlContent;
    const cleanHTML = sanitizeHTML(htmlContent);
    contentRef.current.innerHTML = cleanHTML;
    const images = contentRef.current.querySelectorAll('img');
    images.forEach(img => {
      const imageId = img.getAttribute('data-image-id');
      const src = img.getAttribute('src');

      // 优先使用 data-image-id
      if (imageId) {
        const originalSrc = img.src;
        img.src = PLACEHOLDER_SRC;
        img.classList.add('html-image-pending');
        invoke('get_data_directory').then(dataDir => {
          const filePath = `${dataDir}/clipboard_images/${imageId}.png`;
          const assetUrl = convertFileSrc(filePath, 'asset');
          img.src = assetUrl;
          img.classList.remove('html-image-pending');
        }).catch(error => {
          console.error('加载本地图片失败，恢复原始src:', error, 'imageId:', imageId);
          img.src = originalSrc;
          img.classList.remove('html-image-pending');
        });
      } else if (src && src.startsWith('image-id:')) {
        const legacyImageId = src.substring(9);
        img.src = PLACEHOLDER_SRC;
        img.classList.add('html-image-pending');
        invoke('get_data_directory').then(dataDir => {
          const filePath = `${dataDir}/clipboard_images/${legacyImageId}.png`;
          const assetUrl = convertFileSrc(filePath, 'asset');
          img.src = assetUrl;
          img.classList.remove('html-image-pending');
        }).catch(error => {
          console.error('加载 HTML 图片失败:', error, 'imageId:', legacyImageId);
          img.src = ERROR_SRC;
          img.alt = '图片加载失败';
          img.classList.remove('html-image-pending');
        });
      }
    });
  }, [htmlContent]);

  // 处理搜索高亮
  useEffect(() => {
    if (!contentRef.current) return;

    if (searchKeyword !== prevKeywordRef.current) {
      hasScrolledRef.current = false;
      prevKeywordRef.current = searchKeyword;
    }
    
    if (searchKeyword) {
      clearHighlights(contentRef.current);
      highlightHtmlContent(contentRef.current, searchKeyword);

      if (!hasScrolledRef.current) {
        requestAnimationFrame(() => {
          if (scrollToFirstHighlight(contentRef.current)) {
            hasScrolledRef.current = true;
          }
        });
      }
    } else {
      clearHighlights(contentRef.current);
    }
  }, [searchKeyword, htmlContent]);

  const clampClass = searchKeyword || rowHeight === 'auto' ? '' : lineClampClass;
  const autoClampStyle = !searchKeyword && rowHeight === 'auto'
    ? {
        display: '-webkit-box',
        WebkitLineClamp: autoRowMaxLines,
        WebkitBoxOrient: 'vertical'
      }
    : undefined;

  return <div ref={contentRef} className={`text-sm text-qc-fg leading-relaxed html-content overflow-hidden scrollbar-thin scrollbar-thumb-qc-border-strong scrollbar-track-transparent ${clampClass}`} style={{
    ...autoClampStyle,
    wordBreak: 'break-all',
    maxHeight: rowHeight === 'auto' && Number.isFinite(Number(maxContentHeightPx)) ? `${Number(maxContentHeightPx)}px` : '100%',
    height: rowHeight === 'auto' ? undefined : '100%',
    overflow: 'hidden',
    paddingRight: '4px',
    isolation: 'isolate',
    contain: 'layout style paint'
  }} data-html-content-scope="true" />;
}
export default HtmlContent;
