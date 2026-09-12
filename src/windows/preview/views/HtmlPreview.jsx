import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef } from 'react';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { sanitizeHTML } from '@shared/utils/htmlProcessor';
import {
  HTML_MIN_WIDTH,
  TEXT_MIN_HEIGHT,
  clamp,
  isFiniteNumber,
} from '../utils';

const PLACEHOLDER_SRC = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeGxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiBmaWxsPSIjZjBmMGYwIi8+PC9zdmc+';
const ERROR_SRC = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeGxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiBmaWxsPSIjZmZlYmVlIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiNjNjI4MjgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7lpb3ml7bplK7mj5DmnKzmiqUgPC90ZXh0Pjwvc3ZnPg==';
const HTML_SURFACE_BORDER_SIZE = 2;
const HTML_LAYOUT_WRAP = 'wrap';
const HTML_LAYOUT_NOWRAP = 'nowrap';

const RESPONSIVE_LAYOUT_TAGS = new Set([
  'DIV',
  'P',
  'SECTION',
  'ARTICLE',
  'HEADER',
  'FOOTER',
  'MAIN',
  'ASIDE',
  'NAV',
  'BLOCKQUOTE',
  'LI',
  'UL',
  'OL',
  'SPAN',
  'STRONG',
  'EM',
  'B',
  'I',
  'U',
  'S',
  'SUB',
  'SUP',
  'SMALL',
  'FIGURE',
  'FIGCAPTION',
  'A',
]);

const MEDIA_TAGS = new Set(['IMG', 'VIDEO', 'CANVAS', 'SVG', 'IFRAME', 'OBJECT', 'EMBED']);
const PRESERVE_INTRINSIC_WIDTH_TAGS = new Set(['TABLE', 'IMG', 'VIDEO', 'CANVAS', 'SVG', 'IFRAME', 'OBJECT', 'EMBED']);

function setImportantStyle(style, property, value) {
  if (
    style.getPropertyValue(property) === value
    && style.getPropertyPriority(property) === 'important'
  ) {
    return;
  }

  style.setProperty(property, value, 'important');
}

function applyHtmlElementLayout(element, mode, isRoot = false) {
  if (!element || !element.style) {
    return;
  }

  const shouldWrap = mode !== HTML_LAYOUT_NOWRAP;
  const tagName = element.tagName;

  setImportantStyle(element.style, 'box-sizing', 'border-box');
  setImportantStyle(element.style, 'min-width', '0');
  setImportantStyle(element.style, 'white-space', shouldWrap ? 'normal' : 'pre');
  setImportantStyle(element.style, 'overflow-wrap', shouldWrap ? 'anywhere' : 'normal');
  setImportantStyle(element.style, 'word-break', shouldWrap ? 'break-word' : 'normal');

  if (tagName === 'PRE' || tagName === 'CODE') {
    setImportantStyle(element.style, 'white-space', shouldWrap ? 'pre-wrap' : 'pre');
    setImportantStyle(element.style, 'overflow-x', 'auto');
    setImportantStyle(element.style, 'width', 'auto');
    setImportantStyle(element.style, 'max-width', 'none');
  } else if (tagName === 'TABLE') {
    setImportantStyle(element.style, 'width', '100%');
    setImportantStyle(element.style, 'max-width', '100%');
    setImportantStyle(element.style, 'table-layout', 'fixed');
    setImportantStyle(element.style, 'border-collapse', 'collapse');
  } else if (tagName === 'IMG') {
    setImportantStyle(element.style, 'display', 'inline-block');
    setImportantStyle(element.style, 'width', 'auto');
    setImportantStyle(element.style, 'height', 'auto');
    setImportantStyle(element.style, 'max-width', 'none');
    setImportantStyle(element.style, 'object-fit', 'contain');
  } else if (MEDIA_TAGS.has(tagName)) {
    setImportantStyle(element.style, 'width', 'auto');
    setImportantStyle(element.style, 'height', 'auto');
    setImportantStyle(element.style, 'max-width', 'none');
  } else if (RESPONSIVE_LAYOUT_TAGS.has(tagName)) {
    setImportantStyle(element.style, 'width', 'auto');
    if (shouldWrap) {
      setImportantStyle(element.style, 'white-space', 'normal');
    }
  }

  if (!isRoot) {
    if (element.style.position && element.style.position !== 'static') {
      setImportantStyle(element.style, 'position', 'static');
      setImportantStyle(element.style, 'top', 'auto');
      setImportantStyle(element.style, 'right', 'auto');
      setImportantStyle(element.style, 'bottom', 'auto');
      setImportantStyle(element.style, 'left', 'auto');
    }

    if (element.style.float && element.style.float !== 'none') {
      setImportantStyle(element.style, 'float', 'none');
    }

    if (element.style.transform && element.style.transform !== 'none') {
      setImportantStyle(element.style, 'transform', 'none');
    }
  }

  if (!PRESERVE_INTRINSIC_WIDTH_TAGS.has(tagName)) {
    element.removeAttribute('width');
    element.removeAttribute('height');
  }
}

function applyHtmlLayout(root, mode = HTML_LAYOUT_WRAP) {
  if (!root) {
    return;
  }

  applyHtmlElementLayout(root, mode, true);
  root.querySelectorAll('*').forEach((element) => {
    applyHtmlElementLayout(element, mode, false);
  });
}

function copyChildNodes(source, target) {
  const fragment = document.createDocumentFragment();
  source.childNodes.forEach((node) => {
    fragment.appendChild(node.cloneNode(true));
  });
  target.replaceChildren(fragment);
}

function resolveImageIdToAsset(imageId) {
  return invoke('get_data_directory').then((dataDir) => {
    const filePath = `${dataDir}/clipboard_images/${imageId}.png`;
    return convertFileSrc(filePath, 'asset');
  });
}

function readHtmlMeasureSize(node) {
  const rect = node.getBoundingClientRect();
  return {
    width: Math.ceil(Math.max(Number(node.scrollWidth) || 0, rect.width || 0)),
    height: Math.ceil(Math.max(Number(node.scrollHeight) || 0, rect.height || 0)),
  };
}

function applyHtmlMeasureLayout(node, maxWidth, mode) {
  applyHtmlLayout(node, mode);

  setImportantStyle(node.style, 'display', 'inline-block');
  setImportantStyle(node.style, 'height', 'auto');
  setImportantStyle(node.style, 'min-height', '0');

  if (mode === HTML_LAYOUT_NOWRAP) {
    setImportantStyle(node.style, 'width', 'max-content');
    setImportantStyle(node.style, 'max-width', 'none');
    return;
  }

  setImportantStyle(node.style, 'width', `${maxWidth}px`);
  setImportantStyle(node.style, 'max-width', `${maxWidth}px`);
}

function measureHtmlNodeIntrinsicSize(node, maxWidth) {
  const safeMaxWidth = Math.max(HTML_MIN_WIDTH, Math.round(maxWidth));

  applyHtmlMeasureLayout(node, safeMaxWidth, HTML_LAYOUT_NOWRAP);
  const naturalSize = readHtmlMeasureSize(node);
  if (naturalSize.width <= safeMaxWidth) {
    return {
      ...naturalSize,
      shouldWrap: false,
    };
  }

  applyHtmlMeasureLayout(node, safeMaxWidth, HTML_LAYOUT_WRAP);
  return {
    ...readHtmlMeasureSize(node),
    width: safeMaxWidth,
    shouldWrap: true,
  };
}

function toPreferredHtmlSize(size, maxWidth) {
  return {
    width: clamp(Math.ceil(size.width) + HTML_SURFACE_BORDER_SIZE, HTML_MIN_WIDTH, maxWidth),
    height: Math.max(TEXT_MIN_HEIGHT, Math.ceil(size.height) + HTML_SURFACE_BORDER_SIZE),
  };
}

const HtmlPreview = forwardRef(function HtmlPreview(
  {
    htmlContent,
    maxWidth,
    onPreferredSizeChange,
    onScrollabilityChange,
  },
  ref,
) {
  const scrollContainerRef = useRef(null);
  const contentRef = useRef(null);
  const measureRef = useRef(null);
  const renderedHtml = useMemo(() => {
    const html = typeof htmlContent === 'string' ? htmlContent : '';
    return sanitizeHTML(html);
  }, [htmlContent]);
  const onPreferredSizeChangeRef = useRef(onPreferredSizeChange);
  const onScrollabilityChangeRef = useRef(onScrollabilityChange);
  const preferredSizeRef = useRef({ width: 0, height: 0 });
  const measureTimerRef = useRef(0);

  useImperativeHandle(
    ref,
    () => ({
      scrollBy(delta) {
        scrollContainerRef.current?.scrollBy({ top: delta, behavior: 'auto' });
      },
      hasVerticalOverflow() {
        const element = scrollContainerRef.current;
        if (!element) {
          return false;
        }
        return (element.scrollHeight - element.clientHeight) > 2;
      },
    }),
    [],
  );

  useEffect(() => {
    onPreferredSizeChangeRef.current = onPreferredSizeChange;
  }, [onPreferredSizeChange]);

  useEffect(() => {
    onScrollabilityChangeRef.current = onScrollabilityChange;
  }, [onScrollabilityChange]);

  const measurePreferredSize = (htmlSource = null) => {
    const root = contentRef.current;
    const measureRoot = measureRef.current;
    if (!root || !measureRoot) {
      return;
    }

    const widthLimit = Number(maxWidth);
    const safeMaxWidth = isFiniteNumber(widthLimit) && widthLimit > 0
      ? widthLimit
      : Math.max(HTML_MIN_WIDTH, root.clientWidth || 420);

    measureRoot.innerHTML = typeof htmlSource === 'string' ? htmlSource : root.innerHTML;

    const measuredSize = measureHtmlNodeIntrinsicSize(measureRoot, safeMaxWidth);
    const bestSize = measuredSize.height > 0
      ? toPreferredHtmlSize(measuredSize, safeMaxWidth)
      : null;

    if (!bestSize) {
      if (typeof htmlSource === 'string') {
        copyChildNodes(measureRoot, root);
        applyHtmlElementLayout(root, HTML_LAYOUT_WRAP, true);
      }
      return;
    }

    const layoutMode = measuredSize.shouldWrap ? HTML_LAYOUT_WRAP : HTML_LAYOUT_NOWRAP;
    if (typeof htmlSource === 'string') {
      copyChildNodes(measureRoot, root);
      applyHtmlElementLayout(root, layoutMode, true);
    } else {
      applyHtmlLayout(root, layoutMode);
    }

    const previousSize = preferredSizeRef.current;
    if (
      bestSize.width === previousSize.width
      && bestSize.height === previousSize.height
    ) {
      return;
    }

    preferredSizeRef.current = bestSize;
    onPreferredSizeChangeRef.current?.(bestSize);
  };

  const scheduleMeasure = () => {
    if (measureTimerRef.current) {
      cancelAnimationFrame(measureTimerRef.current);
    }

    measureTimerRef.current = requestAnimationFrame(() => {
      measureTimerRef.current = 0;
      measurePreferredSize();
    });
  };

  useLayoutEffect(() => {
    const root = contentRef.current;
    if (!root) {
      return;
    }

    preferredSizeRef.current = { width: 0, height: 0 };
    if (measureTimerRef.current) {
      cancelAnimationFrame(measureTimerRef.current);
      measureTimerRef.current = 0;
    }
    measurePreferredSize(renderedHtml);
  }, [renderedHtml, maxWidth]);

  useEffect(() => {
    const root = contentRef.current;
    if (!root) {
      return undefined;
    }

    let cancelled = false;

    const images = Array.from(root.querySelectorAll('img'));
    const cleanupFns = [];
    if (images.length === 0) {
      return undefined;
    }

    const loadImages = async () => {
      const dataDir = await invoke('get_data_directory');
      if (cancelled) return;

      for (const img of images) {
        const handleImageChange = () => {
          scheduleMeasure();
        };
        img.addEventListener('load', handleImageChange);
        img.addEventListener('error', handleImageChange);
        cleanupFns.push(() => {
          img.removeEventListener('load', handleImageChange);
          img.removeEventListener('error', handleImageChange);
        });

        const imageId = img.getAttribute('data-image-id');
        const src = img.getAttribute('src');

        if (imageId) {
          const originalSrc = img.src;
          img.src = PLACEHOLDER_SRC;
          img.classList.add('html-image-pending');
          try {
            const filePath = `${dataDir}/clipboard_images/${imageId}.png`;
            img.src = convertFileSrc(filePath, 'asset');
          } catch (error) {
            console.error('加载本地图片失败，恢复原始src:', error, 'imageId:', imageId);
            img.src = originalSrc;
          } finally {
            img.classList.remove('html-image-pending');
          }
          scheduleMeasure();
          continue;
        }

        if (src && src.startsWith('image-id:')) {
          const legacyImageId = src.substring(9);
          img.src = PLACEHOLDER_SRC;
          img.classList.add('html-image-pending');
          try {
            img.src = await resolveImageIdToAsset(legacyImageId);
          } catch (error) {
            console.error('加载 HTML 图片失败:', error, 'imageId:', legacyImageId);
            img.src = ERROR_SRC;
            img.alt = '图片加载失败';
          } finally {
            img.classList.remove('html-image-pending');
          }
          scheduleMeasure();
        }
      }
    };

    loadImages().catch((error) => {
      console.error('处理 HTML 图片失败:', error);
    });

    return () => {
      cancelled = true;
      cleanupFns.forEach((fn) => fn());
    };
  }, [renderedHtml]);

  useEffect(() => {
    return () => {
      if (measureTimerRef.current) {
        cancelAnimationFrame(measureTimerRef.current);
        measureTimerRef.current = 0;
      }
    };
  }, []);

  useEffect(() => {
    const element = scrollContainerRef.current;
    if (!element) {
      onScrollabilityChangeRef.current?.(false);
      return undefined;
    }

    let rafId = 0;
    let observer = null;
    let previousValue = null;

    const measure = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        const nextValue = (element.scrollHeight - element.clientHeight) > 2;
        if (nextValue === previousValue) {
          return;
        }
        previousValue = nextValue;
        onScrollabilityChangeRef.current?.(nextValue);
      });
    };

    measure();

    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(measure);
      observer.observe(element);
      if (contentRef.current) {
        observer.observe(contentRef.current);
      }
    } else {
      window.addEventListener('resize', measure);
    }

    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      if (observer) {
        observer.disconnect();
      } else {
        window.removeEventListener('resize', measure);
      }
    };
  }, [renderedHtml]);

  return (
    <div ref={scrollContainerRef} className="w-full h-full min-h-0 min-w-0 overflow-auto">
      <div
        ref={contentRef}
        className="w-full max-w-full min-w-0 text-sm text-qc-fg leading-relaxed html-content"
        style={{
          wordBreak: 'break-word',
          overflowWrap: 'anywhere',
          padding: '10px 12px',
          isolation: 'isolate',
        }}
      />
      <div
        ref={measureRef}
        className="text-sm text-qc-fg leading-relaxed html-content"
        aria-hidden="true"
        style={{
          position: 'fixed',
          left: '-10000px',
          top: '0',
          height: 'auto',
          minHeight: '0',
          overflow: 'hidden',
          visibility: 'hidden',
          pointerEvents: 'none',
          wordBreak: 'break-word',
          overflowWrap: 'anywhere',
          padding: '10px 12px',
          isolation: 'isolate',
          contain: 'layout style',
        }}
      />
    </div>
  );
});

export default HtmlPreview;
