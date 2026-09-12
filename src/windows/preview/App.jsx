import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { listen } from '@tauri-apps/api/event';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { useSnapshot } from 'valtio';
import { defaultSettings } from '@shared/services/settingsService';
import { settingsStore, initSettings } from '@shared/store/settingsStore';
import { useTheme, applyThemeToBody } from '@shared/hooks/useTheme';
import { useSettingsSync } from '@shared/hooks/useSettingsSync';
import {
  applyBackgroundImage,
  clearBackgroundImage,
} from '@shared/utils/backgroundManager';
import {
  getClipboardItemById,
  getFavoriteItemById,
  getClipboardItemPasteOptions,
} from '@shared/api';
import { getFavoriteItemPasteOptions } from '@shared/api/favorites';
import {
  extractFormatKinds,
  formatKindsToLabels,
  resolvePreviewModes as resolveFormatPreviewModes,
} from '@shared/utils/pasteFormatHints';
import { normalizeDisplayPriorityOrder } from '@shared/utils/displayFormatPriority';
import {
  ImagePreview,
  FilePreview,
  HtmlPreview,
  PreviewHint,
  TextPreview,
} from './views';
import {
  MODE_TEXT,
  MODE_HTML,
  MODE_IMAGE,
  MODE_FILE,
  TEXT_SCROLL_STEP,
  IMAGE_SCALE_STEP,
  IMAGE_SCALE_MIN,
  IMAGE_SCALE_MAX,
  IMAGE_SCALE_INDICATOR_DURATION,
  IMAGE_STATUS_IDLE,
  IMAGE_STATUS_LOADING,
  IMAGE_STATUS_READY,
  IMAGE_STATUS_ERROR,
  clamp,
  isFiniteNumber,
  resolveBoxSize,
  resolveHtmlPreviewMaxWidth,
  resolvePreviewDirectionalAvailableWidth,
  chooseContainerPosition,
  resolveTextPreviewMaxHeight,
  resolveTextPreviewMaxWidth,
  TEXT_MIN_WIDTH,
  HTML_MIN_WIDTH,
  resolvePreviewMode,
  parsePreviewFiles,
  buildPreviewFileStats,
  parseImageFilePath,
  parseRawImagePath,
  parseFirstImageId,
  parseImageDimensionsFromItem,
} from './utils';
import {
  measureHtmlPreviewSize,
  measurePlainTextPreviewSize,
} from './textMeasure';

const IMAGE_FILE_EXTENSION_PATTERN = /\.(png|jpe?g|gif|webp|bmp|svg|ico|tiff?|avif)$/i;

function isLikelyImageFilePath(value) {
  if (typeof value !== 'string') {
    return false;
  }

  const trimmed = value.trim();
  if (!trimmed || /[\r\n]/.test(trimmed)) {
    return false;
  }

  const pathWithoutQuery = trimmed.split(/[?#]/)[0];
  const hasPathMarker =
    pathWithoutQuery.includes(':')
    || pathWithoutQuery.startsWith('\\\\')
    || pathWithoutQuery.includes('/')
    || pathWithoutQuery.includes('\\');

  return hasPathMarker && IMAGE_FILE_EXTENSION_PATTERN.test(pathWithoutQuery);
}

async function loadItemData(source, itemId) {
  if (source === 'clipboard') {
    const numericId = Number(itemId);
    if (!Number.isFinite(numericId)) {
      throw new Error('剪贴板项目 ID 无效');
    }
    return await getClipboardItemById(numericId);
  }

  if (source === 'favorite') {
    return await getFavoriteItemById(String(itemId));
  }

  throw new Error('未知预览来源');
}

async function loadPasteOptions(source, itemId) {
  if (source === 'clipboard') {
    const numericId = Number(itemId);
    if (!Number.isFinite(numericId)) {
      return [];
    }
    return await getClipboardItemPasteOptions(numericId);
  }

  if (source === 'favorite') {
    return await getFavoriteItemPasteOptions(String(itemId));
  }

  return [];
}

async function resolveImageUrlFromItem(item) {
  const content = typeof item?.content === 'string' ? item.content.trim() : '';
  if (content.startsWith('data:image/')) {
    return content;
  }

  const parsedPath = parseImageFilePath(content);
  if (parsedPath) {
    const resolvedPath = parsedPath.includes(':') || parsedPath.startsWith('\\\\')
      ? parsedPath
      : await invoke('resolve_image_path', { storedPath: parsedPath });
    return convertFileSrc(resolvedPath, 'asset');
  }

  const imageId = parseFirstImageId(item?.image_id);
  if (imageId) {
    const dataDir = await invoke('get_data_directory');
    const normalizedDataDir = String(dataDir).replace(/\\/g, '/');
    const filePath = `${normalizedDataDir}/clipboard_images/${imageId}.png`;
    return convertFileSrc(filePath, 'asset');
  }

  const rawPath = parseRawImagePath(content);
  if (isLikelyImageFilePath(rawPath)) {
    const resolvedPath = rawPath.includes(':') || rawPath.startsWith('\\\\')
      ? rawPath
      : await invoke('resolve_image_path', { storedPath: rawPath });
    return convertFileSrc(resolvedPath, 'asset');
  }

  if (rawPath.startsWith('image-id:')) {
    const legacyImageId = rawPath.slice('image-id:'.length).trim();
    const dataDir = await invoke('get_data_directory');
    const normalizedDataDir = String(dataDir).replace(/\\/g, '/');
    const filePath = `${normalizedDataDir}/clipboard_images/${legacyImageId}.png`;
    return convertFileSrc(filePath, 'asset');
  }

  return '';
}

function orderPreviewModesByDisplayPriority(modes, displayPriorityOrder) {
  if (!Array.isArray(modes) || modes.length <= 1) {
    return Array.isArray(modes) ? modes : [];
  }

  const orderedFormats = normalizeDisplayPriorityOrder(displayPriorityOrder);
  const modeOrderMap = {
    text: MODE_TEXT,
    html: MODE_HTML,
    image: MODE_IMAGE,
    file: MODE_FILE,
  };
  const orderedModes = orderedFormats
    .map((format) => modeOrderMap[format])
    .filter((mode) => typeof mode === 'string' && mode.length > 0);

  const weight = new Map(orderedModes.map((mode, index) => [mode, index]));
  const fallbackWeight = orderedModes.length + 10;
  return [...modes].sort((a, b) => {
    const wa = weight.has(a) ? weight.get(a) : fallbackWeight;
    const wb = weight.has(b) ? weight.get(b) : fallbackWeight;
    return wa - wb;
  });
}

function isValidPreviewAnchorRect(rect) {
  return rect
    && isFiniteNumber(Number(rect.left))
    && isFiniteNumber(Number(rect.top))
    && isFiniteNumber(Number(rect.width))
    && isFiniteNumber(Number(rect.height))
    && Number(rect.width) > 0
    && Number(rect.height) > 0;
}

function buildRectSideAnchors(rect) {
  return [
    {
      side: 'left',
      x: rect.left,
      y: rect.top + (rect.height / 2),
      normalX: -1,
      normalY: 0,
    },
    {
      side: 'right',
      x: rect.left + rect.width,
      y: rect.top + (rect.height / 2),
      normalX: 1,
      normalY: 0,
    },
    {
      side: 'top',
      x: rect.left + (rect.width / 2),
      y: rect.top,
      normalX: 0,
      normalY: -1,
    },
    {
      side: 'bottom',
      x: rect.left + (rect.width / 2),
      y: rect.top + rect.height,
      normalX: 0,
      normalY: 1,
    },
  ];
}

function isPointInsideRect(point, rect) {
  return point.x > rect.left
    && point.x < rect.left + rect.width
    && point.y > rect.top
    && point.y < rect.top + rect.height;
}

function segmentOverlapsRectInterior(start, end, rect, steps = 24) {
  if (!rect || rect.width <= 0 || rect.height <= 0) {
    return false;
  }

  const margin = 6;
  const innerRect = {
    left: rect.left + margin,
    top: rect.top + margin,
    width: Math.max(0, rect.width - (margin * 2)),
    height: Math.max(0, rect.height - (margin * 2)),
  };

  if (innerRect.width <= 0 || innerRect.height <= 0) {
    return false;
  }

  for (let index = 1; index < steps; index += 1) {
    const t = index / steps;
    const point = {
      x: start.x + ((end.x - start.x) * t),
      y: start.y + ((end.y - start.y) * t),
    };
    if (isPointInsideRect(point, innerRect)) {
      return true;
    }
  }

  return false;
}

function resolveBestRectConnection(sourceRect, targetRect) {
  const sourceAnchors = buildRectSideAnchors(sourceRect);
  const targetAnchors = buildRectSideAnchors(targetRect);
  const candidates = [];

  sourceAnchors.forEach((sourceAnchor) => {
    targetAnchors.forEach((targetAnchor) => {
      const start = { x: sourceAnchor.x, y: sourceAnchor.y };
      const end = { x: targetAnchor.x, y: targetAnchor.y };
      const deltaX = end.x - start.x;
      const deltaY = end.y - start.y;
      const distance = Math.hypot(deltaX, deltaY);
      const crossesPreview = segmentOverlapsRectInterior(start, end, targetRect);
      const outwardPenalty = (deltaX * sourceAnchor.normalX) + (deltaY * sourceAnchor.normalY) >= 0 ? 0 : 40;
      const inwardPenalty = ((-deltaX) * targetAnchor.normalX) + ((-deltaY) * targetAnchor.normalY) >= 0 ? 0 : 40;
      const handleDistance = clamp(distance * 0.22, 20, 64);
      const control1 = {
        x: start.x + (sourceAnchor.normalX * handleDistance),
        y: start.y + (sourceAnchor.normalY * handleDistance),
      };
      const control2 = {
        x: end.x + (targetAnchor.normalX * handleDistance),
        y: end.y + (targetAnchor.normalY * handleDistance),
      };
      const connectorPath = [
        `M ${start.x} ${start.y}`,
        `C ${control1.x} ${control1.y}, ${control2.x} ${control2.y}, ${end.x} ${end.y}`,
      ].join(' ');
      const score = (crossesPreview ? 100000 : 0) + outwardPenalty + inwardPenalty + distance;

      candidates.push({
        connectorPath,
        control1,
        control2,
        score,
        sourceSide: sourceAnchor.side,
        targetSide: targetAnchor.side,
        sourceX: start.x,
        sourceY: start.y,
        targetX: end.x,
        targetY: end.y,
      });
    });
  });

  return candidates.reduce((best, current) => (current.score < best.score ? current : best));
}

function App() {
  const { t } = useTranslation();
  const [previewData, setPreviewData] = useState(null);
  const [previewMode, setPreviewMode] = useState(MODE_TEXT);
  const [previewItem, setPreviewItem] = useState(null);
  const [formatKinds, setFormatKinds] = useState([]);
  const [textContent, setTextContent] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [textHeightOverflow, setTextHeightOverflow] = useState(0);
  const [htmlMeasuredSize, setHtmlMeasuredSize] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [imageLoadState, setImageLoadState] = useState(IMAGE_STATUS_IDLE);
  const [imageDimensions, setImageDimensions] = useState(null);
  const [imageScale, setImageScale] = useState(1);
  const [showImageScaleIndicator, setShowImageScaleIndicator] = useState(false);
  const [scrollability, setScrollability] = useState({
    text: false,
    html: false,
    file: false,
  });
  const [hasMousePosition, setHasMousePosition] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [mousePositionPhysical, setMousePositionPhysical] = useState({ x: 0, y: 0 });
  const revealedRequestIdRef = useRef(0);
  const revealAnimationFrameRef = useRef(0);
  const textPreviewRef = useRef(null);
  const htmlPreviewRef = useRef(null);
  const filePreviewRef = useRef(null);
  const imageScaleIndicatorTimerRef = useRef(null);
  const settings = useSnapshot(settingsStore);
  const { theme, lightThemeStyle, darkThemeStyle, backgroundImagePath } = settings;
  const { effectiveTheme, isDark, isBackground } = useTheme();
  useSettingsSync();

  const resetPreviewState = () => {
    revealedRequestIdRef.current = 0;
    setPreviewData(null);
    setPreviewItem(null);
    setFormatKinds([]);
    setPreviewMode(MODE_TEXT);
    setTextContent('');
    setHtmlContent('');
    setTextHeightOverflow(0);
    setHtmlMeasuredSize(null);
    setImageUrl('');
    setImageLoadState(IMAGE_STATUS_IDLE);
    setImageDimensions(null);
    setImageScale(1);
    setShowImageScaleIndicator(false);
    setScrollability({
      text: false,
      html: false,
      file: false,
    });
    setHasMousePosition(false);
    setIsVisible(false);
    if (revealAnimationFrameRef.current) {
      cancelAnimationFrame(revealAnimationFrameRef.current);
      revealAnimationFrameRef.current = 0;
    }
  };

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const oldHtmlOverflow = html.style.overflow;
    const oldBodyOverflow = body.style.overflow;
    const oldBodyMargin = body.style.margin;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    body.style.margin = '0';
    return () => {
      html.style.overflow = oldHtmlOverflow;
      body.style.overflow = oldBodyOverflow;
      body.style.margin = oldBodyMargin;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    initSettings().catch(() => { });
    invoke('get_preview_window_data')
      .then((data) => {
        if (!mounted) return;
        setPreviewData(data);
        revealedRequestIdRef.current = 0;
        const cursorX = Number(data?.cursor_x);
        const cursorY = Number(data?.cursor_y);
        if (isFiniteNumber(cursorX) && isFiniteNumber(cursorY)) {
          setMousePositionPhysical({ x: cursorX, y: cursorY });
          setHasMousePosition(true);
        }
      })
      .catch((error) => {
        console.error('获取预览窗口数据失败:', error);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const applyPreviewData = (data) => {
      setPreviewData(data);
      revealedRequestIdRef.current = 0;
      const cursorX = Number(data?.cursor_x);
      const cursorY = Number(data?.cursor_y);
      if (isFiniteNumber(cursorX) && isFiniteNumber(cursorY)) {
        setMousePositionPhysical({ x: cursorX, y: cursorY });
        setHasMousePosition(true);
      }
    };

    const unlistenPromise = listen('preview-window-data-updated', (event) => {
      applyPreviewData(event.payload);
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten()).catch(() => { });
    };
  }, []);

  useEffect(() => {
    const unlistenPromise = listen('preview-window-will-hide', (event) => {
      const requestId = Number(event.payload);
      if (!Number.isFinite(requestId) || requestId <= 0) {
        return;
      }
      if (previewData?.request_id && Number(previewData.request_id) !== requestId) {
        return;
      }

      flushSync(() => {
        resetPreviewState();
      });

      requestAnimationFrame(() => {
        invoke('finalize_hide_preview_window', { requestId }).catch((error) => {
          console.error('完成预览窗口隐藏失败:', error);
        });
      });
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten()).catch(() => { });
    };
  }, [previewData]);

  useEffect(() => {
    applyThemeToBody(theme || defaultSettings.theme, 'preview');
  }, [theme, lightThemeStyle, darkThemeStyle, effectiveTheme]);

  useEffect(() => {
    if (isBackground && backgroundImagePath) {
      applyBackgroundImage({
        containerSelector: '.preview-theme-anchor',
        backgroundImagePath,
        windowName: 'preview',
      });
    } else {
      clearBackgroundImage('.preview-theme-anchor');
    }
    return () => {
      clearBackgroundImage('.preview-theme-anchor');
    };
  }, [isBackground, backgroundImagePath]);

  useEffect(() => {
    if (!previewData) return;
    let cancelled = false;

    setPreviewItem(null);
    setFormatKinds([]);
    setPreviewMode(
      previewData.mode === MODE_IMAGE
        ? MODE_IMAGE
        : previewData.mode === MODE_FILE
          ? MODE_FILE
        : previewData.mode === MODE_HTML
          ? MODE_HTML
          : MODE_TEXT,
    );
    setTextContent('');
    setHtmlContent('');
    setTextHeightOverflow(0);
    setHtmlMeasuredSize(null);
    setImageUrl('');
    setImageLoadState(IMAGE_STATUS_IDLE);
    setImageDimensions(null);
    setImageScale(1);
    setShowImageScaleIndicator(false);

    const run = async () => {
      try {
        const [item, pasteOptions] = await Promise.all([
          loadItemData(previewData.source, previewData.item_id),
          loadPasteOptions(previewData.source, previewData.item_id).catch(() => []),
        ]);
        if (cancelled) return;

        const nextFormatKinds = extractFormatKinds(pasteOptions, item);
        const supportedPreviewModes = orderPreviewModesByDisplayPriority(
          resolveFormatPreviewModes(item, nextFormatKinds),
          settings.displayPriorityOrder,
        );
        const requestedMode = resolvePreviewMode(previewData.mode, item);
        const initialMode = supportedPreviewModes.includes(requestedMode)
          ? requestedMode
          : (supportedPreviewModes[0] || MODE_TEXT);

        setPreviewItem(item);
        setFormatKinds(nextFormatKinds);
        setPreviewMode(initialMode);
        setTextContent(item?.content || '');
        setTextHeightOverflow(0);
        setHtmlMeasuredSize(null);
        setHtmlContent(item?.html_content || '');
      } catch (error) {
        console.error('加载预览内容失败:', error);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [previewData, settings.displayPriorityOrder]);

  const currentRequestId = useMemo(() => {
    const requestId = Number(previewData?.request_id);
    return Number.isFinite(requestId) ? requestId : 0;
  }, [previewData?.request_id]);

  useEffect(() => {
    if (!previewItem || previewMode !== MODE_IMAGE) {
      setImageUrl('');
      setImageLoadState(IMAGE_STATUS_IDLE);
      setImageDimensions(null);
      setImageScale(1);
      return;
    }

    let cancelled = false;
    setImageLoadState(IMAGE_STATUS_LOADING);
    setImageUrl('');
    setImageDimensions(parseImageDimensionsFromItem(previewItem));
    setImageScale(1);

    resolveImageUrlFromItem(previewItem)
      .then((url) => {
        if (cancelled) return;
        if (!url) {
          console.warn('图片预览未解析到可用地址:', {
            source: previewData?.source,
            itemId: previewData?.item_id,
            contentType: previewItem?.content_type,
            imageId: previewItem?.image_id,
          });
          setImageLoadState(IMAGE_STATUS_ERROR);
          setImageDimensions(null);
          return;
        }
        setImageUrl(url);
        setImageLoadState(IMAGE_STATUS_LOADING);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('加载图片预览失败:', error);
        setImageLoadState(IMAGE_STATUS_ERROR);
      });

    return () => {
      cancelled = true;
    };
  }, [previewItem, previewMode, previewData]);

  const previewReady = useMemo(() => {
    if (!previewData || !previewItem) {
      return false;
    }

    if (previewMode === MODE_IMAGE) {
      return imageLoadState === IMAGE_STATUS_READY || imageLoadState === IMAGE_STATUS_ERROR;
    }

    return true;
  }, [previewData, previewItem, previewMode, imageLoadState]);

  useEffect(() => {
    if (!previewReady || currentRequestId <= 0) {
      return;
    }
    if (revealedRequestIdRef.current === currentRequestId) {
      return;
    }

    let cancelled = false;
    const rafId = requestAnimationFrame(() => {
      if (cancelled) {
        return;
      }
      invoke('reveal_preview_window', { requestId: currentRequestId })
        .then(() => {
          if (!cancelled) {
            revealedRequestIdRef.current = currentRequestId;
            if (revealAnimationFrameRef.current) {
              cancelAnimationFrame(revealAnimationFrameRef.current);
            }
            revealAnimationFrameRef.current = requestAnimationFrame(() => {
              revealAnimationFrameRef.current = 0;
              if (!cancelled) {
                setIsVisible(true);
              }
            });
          }
        })
        .catch((error) => {
          console.error('显示预览窗口失败:', error);
        });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      if (revealAnimationFrameRef.current) {
        cancelAnimationFrame(revealAnimationFrameRef.current);
        revealAnimationFrameRef.current = 0;
      }
    };
  }, [currentRequestId, previewReady]);

  useEffect(() => {
    return () => {
      if (imageScaleIndicatorTimerRef.current) {
        clearTimeout(imageScaleIndicatorTimerRef.current);
        imageScaleIndicatorTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (previewMode === MODE_IMAGE) {
      return;
    }

    setShowImageScaleIndicator(false);
    if (imageScaleIndicatorTimerRef.current) {
      clearTimeout(imageScaleIndicatorTimerRef.current);
      imageScaleIndicatorTimerRef.current = null;
    }
  }, [previewMode]);

  useEffect(() => {
    setScrollability({
      text: false,
      html: false,
      file: false,
    });
  }, [currentRequestId, previewMode, previewItem?.id, previewItem?.item_id, previewItem?.favorite_id]);

  const showImageScaleIndicatorTemporarily = () => {
    setShowImageScaleIndicator(true);
    if (imageScaleIndicatorTimerRef.current) {
      clearTimeout(imageScaleIndicatorTimerRef.current);
    }
    imageScaleIndicatorTimerRef.current = setTimeout(() => {
      setShowImageScaleIndicator(false);
      imageScaleIndicatorTimerRef.current = null;
    }, IMAGE_SCALE_INDICATOR_DURATION);
  };

  useEffect(() => {
    if (!previewData) return;
    let cancelled = false;
    let inFlight = false;

    const pollMousePosition = () => {
      if (cancelled || inFlight) {
        return;
      }

      inFlight = true;
      invoke('get_mouse_position')
        .then((result) => {
          if (cancelled || !Array.isArray(result)) {
            return;
          }
          const [x, y] = result;
          setHasMousePosition(true);
          setMousePositionPhysical((prev) => {
            if (prev.x === x && prev.y === y) return prev;
            return { x, y };
          });
        })
        .catch(() => { })
        .finally(() => {
          inFlight = false;
        });
    };

    pollMousePosition();
    const timer = setInterval(pollMousePosition, 16);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [previewData]);

  useEffect(() => {
    setIsVisible(false);
    if (revealAnimationFrameRef.current) {
      cancelAnimationFrame(revealAnimationFrameRef.current);
      revealAnimationFrameRef.current = 0;
    }
  }, [currentRequestId]);

  useEffect(() => {
    if (!previewData) return;

    const unlistenPromise = listen('preview-window-scroll', (event) => {
      const payload = event.payload || {};
      if (
        payload.itemId !== previewData.item_id ||
        payload.source !== previewData.source ||
        payload.mode !== previewData.mode
      ) {
        return;
      }

      const direction = payload.direction === 'up' ? 'up' : 'down';
      if (previewMode === MODE_TEXT) {
        const delta = direction === 'up' ? -TEXT_SCROLL_STEP : TEXT_SCROLL_STEP;
        textPreviewRef.current?.scrollBy(delta);
        return;
      }

      if (previewMode === MODE_HTML) {
        const delta = direction === 'up' ? -TEXT_SCROLL_STEP : TEXT_SCROLL_STEP;
        htmlPreviewRef.current?.scrollBy(delta);
        return;
      }

      if (previewMode === MODE_FILE) {
        const delta = direction === 'up' ? -TEXT_SCROLL_STEP : TEXT_SCROLL_STEP;
        filePreviewRef.current?.scrollBy(delta);
        return;
      }

      if (previewMode === MODE_IMAGE) {
        setImageScale((prev) => {
          const next = direction === 'up' ? prev + IMAGE_SCALE_STEP : prev - IMAGE_SCALE_STEP;
          const clampedScale = clamp(Number(next.toFixed(2)), IMAGE_SCALE_MIN, IMAGE_SCALE_MAX);
          if (clampedScale !== prev) {
            showImageScaleIndicatorTemporarily();
          }
          return clampedScale;
        });
      }
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten()).catch(() => { });
    };
  }, [previewData, previewMode]);

  const supportedPreviewModes = useMemo(
    () => orderPreviewModesByDisplayPriority(
      resolveFormatPreviewModes(previewItem, formatKinds).filter((mode) => (
        mode !== MODE_FILE || settings.filePreview !== false
      )),
      settings.displayPriorityOrder,
    ),
    [previewItem, formatKinds, settings.displayPriorityOrder, settings.filePreview],
  );

  const filePreviewFiles = useMemo(
    () => parsePreviewFiles(previewItem),
    [previewItem],
  );

  const filePreviewStats = useMemo(
    () => buildPreviewFileStats(filePreviewFiles),
    [filePreviewFiles],
  );

  useEffect(() => {
    if (!supportedPreviewModes.length) {
      return;
    }
    if (!supportedPreviewModes.includes(previewMode)) {
      setPreviewMode(supportedPreviewModes[0]);
    }
  }, [supportedPreviewModes, previewMode]);

  useEffect(() => {
    if (!previewData) {
      return;
    }

    const unlistenPromise = listen('preview-window-cycle-format', (event) => {
      const payload = event.payload || {};
      if (
        payload.itemId !== previewData.item_id ||
        payload.source !== previewData.source
      ) {
        return;
      }

      if (supportedPreviewModes.length <= 1) {
        return;
      }

      const direction = payload.direction === 'prev' ? 'prev' : 'next';
      setPreviewMode((currentMode) => {
        const currentIndex = supportedPreviewModes.indexOf(currentMode);
        const safeIndex = currentIndex >= 0 ? currentIndex : 0;
        const nextIndex = direction === 'prev'
          ? (safeIndex - 1 + supportedPreviewModes.length) % supportedPreviewModes.length
          : (safeIndex + 1) % supportedPreviewModes.length;
        const nextMode = supportedPreviewModes[nextIndex];
        return nextMode;
      });
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten()).catch(() => { });
    };
  }, [previewData, supportedPreviewModes]);

  const scaleFactor = useMemo(() => {
    const value = Number(previewData?.scale_factor);
    return isFiniteNumber(value) && value > 0 ? value : 1;
  }, [previewData]);

  const workAreaLogical = useMemo(() => {
    if (!previewData) {
      return { left: 0, top: 0, width: 0, height: 0 };
    }
    return {
      left: previewData.work_area_x / scaleFactor,
      top: previewData.work_area_y / scaleFactor,
      width: previewData.work_area_width / scaleFactor,
      height: previewData.work_area_height / scaleFactor,
    };
  }, [previewData, scaleFactor]);

  const mainWindowLogical = useMemo(() => {
    if (!previewData) {
      return null;
    }

    const left = Number(previewData.main_window_x) / scaleFactor;
    const top = Number(previewData.main_window_y) / scaleFactor;
    const width = Number(previewData.main_window_width) / scaleFactor;
    const height = Number(previewData.main_window_height) / scaleFactor;

    if (![left, top, width, height].every((value) => isFiniteNumber(value)) || width <= 0 || height <= 0) {
      return null;
    }

    return { left, top, width, height };
  }, [previewData, scaleFactor]);

  const viewportLogical = useMemo(() => {
    const fallbackWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
    const fallbackHeight = typeof window !== 'undefined' ? window.innerHeight : 0;
    return {
      width: workAreaLogical.width > 0 ? workAreaLogical.width : fallbackWidth,
      height: workAreaLogical.height > 0 ? workAreaLogical.height : fallbackHeight,
    };
  }, [workAreaLogical.width, workAreaLogical.height]);

  const mousePositionLogical = useMemo(() => ({
    x: mousePositionPhysical.x / scaleFactor,
    y: mousePositionPhysical.y / scaleFactor,
  }), [mousePositionPhysical, scaleFactor]);

  const textPreviewMaxWidth = useMemo(() => {
    const availableWidth = resolvePreviewDirectionalAvailableWidth(
      workAreaLogical,
      mainWindowLogical,
      mousePositionLogical,
      TEXT_MIN_WIDTH,
    );

    return resolveTextPreviewMaxWidth(
      workAreaLogical.height,
      workAreaLogical.width,
      availableWidth,
    );
  }, [
    mainWindowLogical,
    mousePositionLogical,
    workAreaLogical,
  ]);

  const htmlPreviewMaxWidth = useMemo(() => {
    const availableWidth = resolvePreviewDirectionalAvailableWidth(
      workAreaLogical,
      mainWindowLogical,
      mousePositionLogical,
      HTML_MIN_WIDTH,
    );

    return resolveHtmlPreviewMaxWidth(
      workAreaLogical.height,
      workAreaLogical.width,
      availableWidth,
    );
  }, [
    mainWindowLogical,
    mousePositionLogical,
    workAreaLogical,
  ]);

  const textPreferredSize = useMemo(() => {
    if (previewMode !== MODE_TEXT) {
      return null;
    }

    const measuredSize = measurePlainTextPreviewSize(textContent, { maxWidth: textPreviewMaxWidth });
    return {
      ...measuredSize,
      height: measuredSize.height + Math.max(0, textHeightOverflow || 0),
    };
  }, [previewMode, textContent, textHeightOverflow, textPreviewMaxWidth]);

  const htmlPreferredSize = useMemo(() => {
    if (previewMode !== MODE_HTML || !htmlContent) {
      return null;
    }

    const measuredSize = measureHtmlPreviewSize(htmlContent, { maxWidth: htmlPreviewMaxWidth });
    if (htmlMeasuredSize?.width > 0 && htmlMeasuredSize?.height > 0) {
      return htmlMeasuredSize;
    }
    return {
      ...measuredSize,
    };
  }, [previewMode, htmlContent, htmlMeasuredSize, htmlPreviewMaxWidth]);

  const boxSize = useMemo(() => {
    return resolveBoxSize(previewMode, workAreaLogical.height, workAreaLogical.width, {
      textWidth: textPreferredSize?.width,
      textHeight: textPreferredSize?.height,
      imageWidth: imageDimensions?.width,
      imageHeight: imageDimensions?.height,
      htmlWidth: htmlPreferredSize?.width,
      htmlHeight: htmlPreferredSize?.height,
      textMaxWidth: textPreviewMaxWidth,
      htmlMaxWidth: htmlPreviewMaxWidth,
      fileCount: filePreviewStats.fileCount,
      longestFileNameLength: filePreviewStats.longestNameLength,
      longestFilePathLength: filePreviewStats.longestPathLength,
      longestFileNameWidth: filePreviewStats.longestNameWidth,
      longestFilePathLineWidth: filePreviewStats.longestPathLineWidth,
    });
  }, [
    previewMode,
    workAreaLogical.height,
    workAreaLogical.width,
    textPreferredSize,
    textPreviewMaxWidth,
    imageDimensions,
    htmlPreferredSize,
    htmlPreviewMaxWidth,
    filePreviewStats,
  ]);

  const displaySize = useMemo(() => {
    if (previewMode === MODE_IMAGE) {
      return {
        width: boxSize.width * imageScale,
        height: boxSize.height * imageScale,
      };
    }

    return {
      width: boxSize.width,
      height: boxSize.height,
    };
  }, [previewMode, boxSize, imageScale]);

  const containerPosition = useMemo(() => {
    if (!previewData) {
      return { left: -99999, top: -99999 };
    }

    return chooseContainerPosition(
      mousePositionLogical.x,
      mousePositionLogical.y,
      displaySize.width,
      displaySize.height,
      workAreaLogical,
      mainWindowLogical,
    );
  }, [previewData, mousePositionLogical, displaySize, workAreaLogical, mainWindowLogical]);

  const isPreviewOnLeftOfMainWindow = useMemo(() => {
    if (!mainWindowLogical) {
      return false;
    }
    return containerPosition.left + displaySize.width <= mainWindowLogical.left;
  }, [containerPosition.left, displaySize.width, mainWindowLogical]);
  const previewAnchorRectLogical = useMemo(() => {
    if (!mainWindowLogical || !isValidPreviewAnchorRect(previewData?.item_rect)) {
      return null;
    }

    return {
      left: mainWindowLogical.left + Number(previewData.item_rect.left),
      top: mainWindowLogical.top + Number(previewData.item_rect.top),
      width: Number(previewData.item_rect.width),
      height: Number(previewData.item_rect.height),
    };
  }, [mainWindowLogical, previewData]);
  const visiblePreviewAnchorRectLogical = useMemo(() => {
    if (!mainWindowLogical || !previewAnchorRectLogical) {
      return null;
    }

    const visibleLeft = Math.max(previewAnchorRectLogical.left, mainWindowLogical.left);
    const visibleTop = Math.max(previewAnchorRectLogical.top, mainWindowLogical.top);
    const visibleRight = Math.min(
      previewAnchorRectLogical.left + previewAnchorRectLogical.width,
      mainWindowLogical.left + mainWindowLogical.width,
    );
    const visibleBottom = Math.min(
      previewAnchorRectLogical.top + previewAnchorRectLogical.height,
      mainWindowLogical.top + mainWindowLogical.height,
    );
    const visibleWidth = visibleRight - visibleLeft;
    const visibleHeight = visibleBottom - visibleTop;

    if (visibleWidth <= 0 || visibleHeight <= 0) {
      return previewAnchorRectLogical;
    }

    return {
      left: visibleLeft,
      top: visibleTop,
      width: visibleWidth,
      height: visibleHeight,
    };
  }, [mainWindowLogical, previewAnchorRectLogical]);

  const imageScalePercent = useMemo(() => `${Math.round(imageScale * 100)}%`, [imageScale]);
  const previewModeLabel = useMemo(() => {
    if (previewMode === MODE_IMAGE) {
      return t('previewWindow.formatImage', '图片');
    }
    if (previewMode === MODE_FILE) {
      return t('previewWindow.formatFile', '文件');
    }
    if (previewMode === MODE_HTML) {
      return t('previewWindow.formatHtml', 'HTML');
    }
    return t('previewWindow.formatText', '纯文本');
  }, [previewMode, t]);
  const formatHintLabels = useMemo(() => formatKindsToLabels(formatKinds, t), [formatKinds, t]);
  const formatHintText = useMemo(() => formatHintLabels.join(' / '), [formatHintLabels]);
  const textContainerBackgroundColor = useMemo(() => {
    if (isBackground) {
      return 'color-mix(in srgb, var(--qc-panel) 58%, transparent)';
    }
    return 'color-mix(in srgb, var(--qc-surface) 90%, transparent)';
  }, [isBackground]);
  const textContainerBackgroundImageStyle = useMemo(() => {
    if (!isBackground || !backgroundImagePath) {
      return undefined;
    }

    try {
      const assetUrl = convertFileSrc(backgroundImagePath, 'asset');
      return {
        backgroundImage: `url("${assetUrl}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      };
    } catch {
      return undefined;
    }
  }, [isBackground, backgroundImagePath]);
  const blurredBackgroundLayerStyle = useMemo(() => {
    if (!textContainerBackgroundImageStyle) {
      return undefined;
    }

    return {
      ...textContainerBackgroundImageStyle,
      position: 'absolute',
      inset: '-12px',
      filter: 'blur(var(--theme-superbg-blur-10, 10px))',
      transform: 'scale(1.06)',
      transformOrigin: 'center',
      opacity: 0.92,
      pointerEvents: 'none',
    };
  }, [textContainerBackgroundImageStyle]);
  const previewHintStyle = isBackground
    ? {
      backgroundColor: 'var(--bg-titlebar-bg, rgb(240, 240, 240))',
      color: 'var(--bg-titlebar-text, #333333)',
      border: '2px solid var(--bg-titlebar-border, rgba(232, 233, 234, 0.8))',
      backdropFilter: 'none',
      WebkitBackdropFilter: 'none',
      boxShadow: '0 0 5px 1px rgba(0, 0, 0, 0.3), 0 0 3px 0 rgba(0, 0, 0, 0.2)',
    }
    : {
      backgroundColor: 'var(--qc-surface)',
      border: '2px solid color-mix(in srgb, var(--qc-fg) 30%, transparent)',
      boxShadow: '0 0 5px 1px rgba(0, 0, 0, 0.3), 0 0 3px 0 rgba(0, 0, 0, 0.2)',
    };
  const previewConnectorColors = useMemo(() => {
    if (isBackground) {
      return {
        line: isDark
          ? 'color-mix(in srgb, white 60%, var(--qc-border-strong) 40%)'
          : 'color-mix(in srgb, var(--bg-titlebar-text, #333333) 72%, var(--qc-border-strong) 28%)',
        lineGlow: isDark
          ? 'color-mix(in srgb, white 26%, transparent)'
          : 'color-mix(in srgb, var(--bg-titlebar-text, #333333) 18%, transparent)',
        sourceFill: isDark
          ? 'color-mix(in srgb, white 74%, var(--qc-border-strong) 26%)'
          : 'var(--bg-titlebar-text, #333333)',
        sourceStroke: 'color-mix(in srgb, var(--qc-surface) 84%, transparent)',
        sourceHighlight: 'color-mix(in srgb, white 78%, transparent)',
        targetFill: isDark
          ? 'color-mix(in srgb, white 82%, var(--qc-border-strong) 18%)'
          : 'color-mix(in srgb, var(--qc-border-strong) 82%, var(--bg-titlebar-text, #333333) 18%)',
        targetStroke: isDark
          ? 'color-mix(in srgb, white 65%, var(--qc-border-strong) 35%)'
          : 'var(--qc-border-strong)',
        targetHighlight: 'color-mix(in srgb, white 82%, transparent)',
      };
    }

    if (isDark) {
      return {
        line: 'color-mix(in srgb, white 56%, var(--qc-border-strong) 44%)',
        lineGlow: 'color-mix(in srgb, white 24%, transparent)',
        sourceFill: 'color-mix(in srgb, white 72%, var(--qc-border-strong) 28%)',
        sourceStroke: 'color-mix(in srgb, var(--qc-surface) 82%, transparent)',
        sourceHighlight: 'color-mix(in srgb, white 84%, transparent)',
        targetFill: 'color-mix(in srgb, white 78%, var(--qc-border-strong) 22%)',
        targetStroke: 'color-mix(in srgb, white 58%, var(--qc-border-strong) 42%)',
        targetHighlight: 'color-mix(in srgb, white 88%, transparent)',
      };
    }

    return {
      line: 'color-mix(in srgb, var(--qc-border-strong) 88%, var(--qc-fg) 12%)',
      lineGlow: 'color-mix(in srgb, var(--qc-border-strong) 20%, transparent)',
      sourceFill: 'color-mix(in srgb, var(--qc-fg) 72%, var(--qc-border-strong) 28%)',
      sourceStroke: 'color-mix(in srgb, white 76%, var(--qc-surface) 24%)',
      sourceHighlight: 'color-mix(in srgb, white 88%, transparent)',
      targetFill: 'color-mix(in srgb, var(--qc-border-strong) 90%, var(--qc-fg) 10%)',
      targetStroke: 'var(--qc-border-strong)',
      targetHighlight: 'color-mix(in srgb, white 92%, transparent)',
    };
  }, [isBackground, isDark]);
  const previewHintPrimaryStyle = useMemo(() => ({
    ...previewHintStyle,
    fontWeight: 600,
    border: isBackground
      ? '2px solid color-mix(in srgb, var(--bg-titlebar-text, #333333) 16%, transparent)'
      : '1px solid color-mix(in srgb, var(--qc-fg) 16%, transparent)',
    boxShadow: isBackground
      ? '0 2px 8px rgba(0, 0, 0, 0.16)'
      : '0 2px 10px rgba(0, 0, 0, 0.14)',
  }), [isBackground, previewHintStyle]);
  const previewHintSecondaryStyle = useMemo(() => ({
    ...previewHintStyle,
    opacity: 0.84,
    border: isBackground
      ? '1px solid color-mix(in srgb, var(--bg-titlebar-text, #333333) 10%, transparent)'
      : '1px solid color-mix(in srgb, var(--qc-fg) 10%, transparent)',
    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.10)',
  }), [isBackground, previewHintStyle]);
  const previewHintAccentStyle = useMemo(() => ({
    ...previewHintStyle,
    fontWeight: 700,
    opacity: 0.98,
    border: isBackground
      ? '2px solid color-mix(in srgb, var(--qc-border-strong) 42%, transparent)'
      : '1px solid color-mix(in srgb, var(--qc-border-strong) 56%, transparent)',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.16)',
  }), [isBackground, previewHintStyle]);
  const previewHintVisibility = useMemo(() => {
    const width = displaySize.width;
    const isCompact = width < 420;
    const isTight = width < 340;
    const isVeryTight = width < 280;

    return {
      showFormatHint: !isCompact,
      showSwitchHint: !isTight,
      showActionHint: !isVeryTight,
    };
  }, [displaySize.width]);

  const relativeLeft = clamp(
    containerPosition.left - workAreaLogical.left,
    0,
    Math.max(0, viewportLogical.width - displaySize.width),
  );
  const relativeTop = clamp(
    containerPosition.top - workAreaLogical.top,
    0,
    Math.max(0, viewportLogical.height - displaySize.height),
  );
  const previewHintTop = Math.max(0, relativeTop - 28);
  const previewHintMaxWidth = Math.max(240, viewportLogical.width - 24);
  const previewConnectorCandidate = useMemo(() => {
    if (!visiblePreviewAnchorRectLogical) {
      return null;
    }

    const sourceRect = {
      left: visiblePreviewAnchorRectLogical.left - workAreaLogical.left,
      top: visiblePreviewAnchorRectLogical.top - workAreaLogical.top,
      width: visiblePreviewAnchorRectLogical.width,
      height: visiblePreviewAnchorRectLogical.height,
    };
    const targetRect = {
      left: relativeLeft,
      top: relativeTop,
      width: displaySize.width,
      height: displaySize.height,
    };

    return resolveBestRectConnection(sourceRect, targetRect);
  }, [
    displaySize.height,
    displaySize.width,
    relativeLeft,
    relativeTop,
    visiblePreviewAnchorRectLogical,
    workAreaLogical.left,
    workAreaLogical.top,
  ]);
  const previewEntranceStyle = useMemo(() => {
    const targetWidth = Math.max(1, displaySize.width);
    const targetHeight = Math.max(1, displaySize.height);
    const minAnchorWidth = 14;
    const maxAnchorWidth = Math.min(24, Math.max(minAnchorWidth, Math.round(targetWidth * 0.08)));

    let anchorLeft = mousePositionLogical.x - workAreaLogical.left;
    let anchorTop = mousePositionLogical.y - workAreaLogical.top;
    let anchorWidth = maxAnchorWidth;
    let anchorHeight = clamp(Math.round(Math.min(targetHeight, 56)), 36, Math.max(36, targetHeight));
    let transformOrigin = isPreviewOnLeftOfMainWindow ? 'right center' : 'left center';

    if (previewConnectorCandidate && visiblePreviewAnchorRectLogical) {
      const itemLeft = visiblePreviewAnchorRectLogical.left - workAreaLogical.left;
      const itemTop = visiblePreviewAnchorRectLogical.top - workAreaLogical.top;
      const itemWidth = visiblePreviewAnchorRectLogical.width;
      const itemHeight = visiblePreviewAnchorRectLogical.height;
      const itemCenterX = itemLeft + (itemWidth / 2);
      const itemCenterY = itemTop + (itemHeight / 2);

      if (previewConnectorCandidate.targetSide === 'left' || previewConnectorCandidate.targetSide === 'right') {
        anchorWidth = maxAnchorWidth;
        anchorHeight = clamp(
          Math.round(itemHeight * 0.82),
          36,
          Math.max(36, Math.min(targetHeight, Math.round(itemHeight + 18))),
        );
        anchorLeft = previewConnectorCandidate.targetSide === 'left'
          ? relativeLeft
          : relativeLeft + targetWidth - anchorWidth;
        anchorTop = previewConnectorCandidate.targetY - (anchorHeight / 2);
        transformOrigin = previewConnectorCandidate.targetSide === 'left' ? 'left center' : 'right center';
      } else {
        anchorWidth = clamp(
          Math.round(itemWidth * 0.88),
          52,
          Math.max(52, Math.min(targetWidth, Math.round(itemWidth + 24))),
        );
        anchorHeight = clamp(Math.min(24, Math.round(targetHeight * 0.09)), 14, 24);
        anchorLeft = previewConnectorCandidate.targetX - (anchorWidth / 2);
        anchorTop = previewConnectorCandidate.targetSide === 'top'
          ? relativeTop
          : relativeTop + targetHeight - anchorHeight;
        transformOrigin = previewConnectorCandidate.targetSide === 'top' ? 'center top' : 'center bottom';
      }

      anchorLeft = Number.isFinite(anchorLeft) ? anchorLeft : itemCenterX;
      anchorTop = Number.isFinite(anchorTop) ? anchorTop : itemCenterY;
    } else {
      anchorLeft = isPreviewOnLeftOfMainWindow
        ? relativeLeft + targetWidth - anchorWidth
        : relativeLeft;
      anchorTop = mousePositionLogical.y - workAreaLogical.top - anchorHeight / 2;
    }

    const clampedAnchorWidth = clamp(anchorWidth, minAnchorWidth, targetWidth);
    const clampedAnchorHeight = clamp(anchorHeight, 24, targetHeight);
    const clampedAnchorLeft = clamp(
      anchorLeft,
      0,
      Math.max(0, viewportLogical.width - clampedAnchorWidth),
    );
    const clampedAnchorTop = clamp(
      anchorTop,
      0,
      Math.max(0, viewportLogical.height - clampedAnchorHeight),
    );

    const targetRight = relativeLeft + targetWidth;
    const targetBottom = relativeTop + targetHeight;
    const anchorRight = clampedAnchorLeft + clampedAnchorWidth;
    const anchorBottom = clampedAnchorTop + clampedAnchorHeight;
    const targetCenterX = relativeLeft + targetWidth / 2;
    const targetCenterY = relativeTop + targetHeight / 2;
    const anchorCenterX = clampedAnchorLeft + clampedAnchorWidth / 2;
    const anchorCenterY = clampedAnchorTop + clampedAnchorHeight / 2;
    let startTranslateX = isPreviewOnLeftOfMainWindow
      ? anchorRight - targetRight
      : clampedAnchorLeft - relativeLeft;
    let startTranslateY = anchorCenterY - targetCenterY;

    if (previewConnectorCandidate?.targetSide === 'right') {
      startTranslateX = anchorRight - targetRight;
    } else if (previewConnectorCandidate?.targetSide === 'left') {
      startTranslateX = clampedAnchorLeft - relativeLeft;
    } else if (previewConnectorCandidate?.targetSide === 'top') {
      startTranslateX = anchorCenterX - targetCenterX;
      startTranslateY = clampedAnchorTop - relativeTop;
    } else if (previewConnectorCandidate?.targetSide === 'bottom') {
      startTranslateX = anchorCenterX - targetCenterX;
      startTranslateY = anchorBottom - targetBottom;
    }

    const startScaleX = clamp(clampedAnchorWidth / targetWidth, 0.08, 1);
    const startScaleY = clamp(clampedAnchorHeight / targetHeight, 0.12, 1);

    return {
      opacity: isVisible ? 1 : 0,
      transform: isVisible
        ? 'translate(0px, 0px) scale(1, 1)'
        : `translate(${startTranslateX}px, ${startTranslateY}px) scale(${startScaleX}, ${startScaleY})`,
      transformOrigin,
      transition: [
        'transform 190ms cubic-bezier(0.22, 1, 0.36, 1)',
        'opacity 130ms ease-out',
      ].join(', '),
      willChange: 'transform, opacity',
    };
  }, [
    displaySize.height,
    displaySize.width,
    isPreviewOnLeftOfMainWindow,
    isVisible,
    mousePositionLogical.x,
    mousePositionLogical.y,
    previewConnectorCandidate,
    relativeLeft,
    relativeTop,
    visiblePreviewAnchorRectLogical,
    viewportLogical.height,
    viewportLogical.width,
    workAreaLogical.left,
    workAreaLogical.top,
  ]);
  const previewConnectorData = useMemo(() => {
    if (!previewConnectorCandidate) {
      return null;
    }

    return {
      connectorPath: previewConnectorCandidate.connectorPath,
      sourceX: previewConnectorCandidate.sourceX,
      sourceY: previewConnectorCandidate.sourceY,
      targetX: previewConnectorCandidate.targetX,
      targetY: previewConnectorCandidate.targetY,
      endpointRadius: 3.5,
      strokeWidth: 2.25,
    };
  }, [
    previewConnectorCandidate,
  ]);

  if (!previewData || !hasMousePosition) {
    return (
      <div className="preview-container fixed inset-0 overflow-hidden bg-transparent">
        <div
          className="preview-theme-anchor pointer-events-none absolute opacity-0"
          style={{ width: 0, height: 0, overflow: 'hidden' }}
        />
      </div>
    );
  }

  const renderPrimaryPreviewHint = (content) => (
    <PreviewHint className="preview-hint-primary tracking-[0.01em]" style={previewHintPrimaryStyle}>
      {content}
    </PreviewHint>
  );
  const renderSecondaryPreviewHint = (content) => (
    <PreviewHint className="preview-hint-secondary text-[10.5px]" style={previewHintSecondaryStyle}>
      {content}
    </PreviewHint>
  );
  const renderAccentPreviewHint = (content) => (
    <PreviewHint className="preview-hint-accent tracking-[0.01em]" style={previewHintAccentStyle}>
      {content}
    </PreviewHint>
  );
  const renderPreviewHint = () => {
    const showSwitchHint = supportedPreviewModes.length > 1 && previewHintVisibility.showSwitchHint;
    const formatHintNode = formatHintText && previewHintVisibility.showFormatHint
      ? renderSecondaryPreviewHint(t('previewWindow.formatsHint', { formats: formatHintText }))
      : null;
    const switchHintNode = showSwitchHint
      ? renderSecondaryPreviewHint(t('previewWindow.switchFormatHint'))
      : null;
    const showTextScrollHint = previewHintVisibility.showActionHint && scrollability.text;
    const showHtmlScrollHint = previewHintVisibility.showActionHint && scrollability.html;
    const showFileScrollHint = previewHintVisibility.showActionHint && scrollability.file;

    if (previewMode === MODE_IMAGE) {
      return (
        <div className="flex items-center gap-2">
          {renderPrimaryPreviewHint(t('previewWindow.currentFormatHint', { format: previewModeLabel }))}
          {formatHintNode}
          {switchHintNode}
          {previewHintVisibility.showActionHint && renderSecondaryPreviewHint(t('previewWindow.imageHint'))}
          {showImageScaleIndicator && (
            renderAccentPreviewHint(imageScalePercent)
          )}
        </div>
      );
    }

    if (previewMode === MODE_FILE) {
      return (
        <div className="flex items-center gap-2">
          {renderPrimaryPreviewHint(t('previewWindow.currentFormatHint', { format: previewModeLabel }))}
          {formatHintNode}
          {switchHintNode}
          {showFileScrollHint && renderSecondaryPreviewHint(t('previewWindow.fileHint', 'Ctrl+滚轮，滚动文件列表'))}
        </div>
      );
    }

    if (previewMode === MODE_HTML) {
      return (
        <div className="flex items-center gap-2">
          {renderPrimaryPreviewHint(t('previewWindow.currentFormatHint', { format: previewModeLabel }))}
          {formatHintNode}
          {switchHintNode}
          {showHtmlScrollHint && renderSecondaryPreviewHint(t('previewWindow.textHint'))}
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2">
        {renderPrimaryPreviewHint(t('previewWindow.currentFormatHint', { format: previewModeLabel }))}
        {formatHintNode}
        {switchHintNode}
        {showTextScrollHint && renderSecondaryPreviewHint(t('previewWindow.textHint'))}
      </div>
    );
  };

  return (
    <div className={`preview-container fixed inset-0 overflow-hidden bg-transparent ${isDark ? 'dark' : ''}`}>
      <div
        className="preview-theme-anchor pointer-events-none absolute opacity-0"
        style={{ width: 0, height: 0, overflow: 'hidden' }}
      />
      <div
        className="absolute z-20 pointer-events-none"
        style={{
          left: isPreviewOnLeftOfMainWindow ? 'auto' : `${relativeLeft}px`,
          right: isPreviewOnLeftOfMainWindow
            ? `${Math.max(0, viewportLogical.width - relativeLeft - displaySize.width)}px`
            : 'auto',
          top: `${previewHintTop}px`,
          maxWidth: `${previewHintMaxWidth}px`,
          opacity: isVisible ? 1 : 0,
          transition: 'opacity 120ms ease-out',
        }}
      >
        <div className={`flex ${isPreviewOnLeftOfMainWindow ? 'justify-end' : 'justify-start'}`}>
          {renderPreviewHint()}
        </div>
      </div>

      {previewConnectorData && (
        <svg
          className="absolute inset-0 z-10 pointer-events-none overflow-visible"
          width={viewportLogical.width}
          height={viewportLogical.height}
          viewBox={`0 0 ${viewportLogical.width} ${viewportLogical.height}`}
          style={{
            opacity: isVisible ? 1 : 0,
            transition: 'opacity 140ms ease-out',
            filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.12))',
          }}
        >
          <path
            d={previewConnectorData.connectorPath}
            fill="none"
            stroke={previewConnectorColors.lineGlow}
            strokeWidth={previewConnectorData.strokeWidth + 1.1}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.55"
          />
          <path
            d={previewConnectorData.connectorPath}
            fill="none"
            stroke="color-mix(in srgb, white 28%, transparent)"
            strokeWidth={previewConnectorData.strokeWidth + 0.3}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.22"
          />
          <path
            d={previewConnectorData.connectorPath}
            fill="none"
            stroke={previewConnectorColors.line}
            strokeWidth={previewConnectorData.strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            cx={previewConnectorData.sourceX}
            cy={previewConnectorData.sourceY}
            r={previewConnectorData.endpointRadius + 1.2}
            fill={previewConnectorColors.lineGlow}
            opacity="0.62"
          />
          <circle
            cx={previewConnectorData.sourceX}
            cy={previewConnectorData.sourceY}
            r={previewConnectorData.endpointRadius}
            fill={previewConnectorColors.sourceFill}
            stroke={previewConnectorColors.sourceStroke}
            strokeWidth="1"
          />
          <circle
            cx={previewConnectorData.sourceX - 0.8}
            cy={previewConnectorData.sourceY - 0.8}
            r={Math.max(1.1, previewConnectorData.endpointRadius * 0.42)}
            fill={previewConnectorColors.sourceHighlight}
            opacity="0.78"
          />
          <circle
            cx={previewConnectorData.targetX}
            cy={previewConnectorData.targetY}
            r={previewConnectorData.endpointRadius + 1.2}
            fill={previewConnectorColors.lineGlow}
            opacity="0.66"
          />
          <circle
            cx={previewConnectorData.targetX}
            cy={previewConnectorData.targetY}
            r={previewConnectorData.endpointRadius}
            fill={previewConnectorColors.targetFill}
            stroke={previewConnectorColors.targetStroke}
            strokeWidth="0.5"
          />
          <circle
            cx={previewConnectorData.targetX - 0.8}
            cy={previewConnectorData.targetY - 0.8}
            r={Math.max(1.1, previewConnectorData.endpointRadius * 0.42)}
            fill={previewConnectorColors.targetHighlight}
            opacity="0.82"
          />
        </svg>
      )}

      {(previewMode === MODE_TEXT || previewMode === MODE_HTML) && (
        <div
          className="absolute overflow-visible"
          style={{
            width: `${boxSize.width}px`,
            height: `${boxSize.height}px`,
            left: `${relativeLeft}px`,
            top: `${relativeTop}px`,
            ...previewEntranceStyle,
          }}
        >
          <div
            className="preview-surface preview-text-surface relative z-10 w-full h-full border border-qc-border-strong overflow-hidden"
            style={{
              borderRadius: '8px',
              boxSizing: 'border-box',
              backgroundColor: textContainerBackgroundColor,
              boxShadow: '0 0 5px 1px rgba(0, 0, 0, 0.3), 0 0 3px 0 rgba(0, 0, 0, 0.2)',
            }}
          >
            {blurredBackgroundLayerStyle && <div style={blurredBackgroundLayerStyle} />}
            <div className="relative z-10 w-full h-full overflow-hidden">
              {previewMode === MODE_HTML ? (
                <HtmlPreview
                  key={currentRequestId}
                  ref={htmlPreviewRef}
                  htmlContent={htmlContent}
                  maxWidth={htmlPreviewMaxWidth}
                  maxHeight={resolveTextPreviewMaxHeight(workAreaLogical.height)}
                  onPreferredSizeChange={(nextSize) => {
                    const nextWidth = Number(nextSize?.width);
                    const nextHeight = Number(nextSize?.height);
                    if (
                      !isFiniteNumber(nextWidth)
                      || !isFiniteNumber(nextHeight)
                      || nextWidth <= 0
                      || nextHeight <= 0
                    ) {
                      return;
                    }
                    setHtmlMeasuredSize((current) => (
                      current?.width === nextWidth && current?.height === nextHeight
                        ? current
                        : { width: nextWidth, height: nextHeight }
                    ));
                  }}
                  onScrollabilityChange={(nextValue) => {
                    setScrollability((current) => (current.html === nextValue
                      ? current
                      : { ...current, html: nextValue }));
                  }}
                />
              ) : (
                <TextPreview
                  ref={textPreviewRef}
                  content={textContent}
                  isDark={isDark}
                  isBackground={isBackground}
                  onHeightOverflowChange={(nextOverflow) => {
                    const overflow = Number(nextOverflow);
                    if (!isFiniteNumber(overflow) || overflow < 0) {
                      return;
                    }
                    setTextHeightOverflow((current) => Math.max(current, overflow));
                  }}
                  onScrollabilityChange={(nextValue) => {
                    setScrollability((current) => (current.text === nextValue
                      ? current
                      : { ...current, text: nextValue }));
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {previewMode === MODE_FILE && (
        <div
          className="absolute overflow-visible"
          style={{
            width: `${boxSize.width}px`,
            height: `${boxSize.height}px`,
            left: `${relativeLeft}px`,
            top: `${relativeTop}px`,
            ...previewEntranceStyle,
          }}
        >
          <div
            className="preview-surface preview-file-surface relative z-10 w-full h-full border border-qc-border-strong overflow-hidden"
            style={{
              borderRadius: '8px',
              backgroundColor: textContainerBackgroundColor,
              boxShadow: '0 0 5px 1px rgba(0, 0, 0, 0.3), 0 0 3px 0 rgba(0, 0, 0, 0.2)',
            }}
          >
            {blurredBackgroundLayerStyle && <div style={blurredBackgroundLayerStyle} />}
            <div className="relative z-10 w-full h-full overflow-hidden">
              <FilePreview
                ref={filePreviewRef}
                files={filePreviewFiles}
                stats={filePreviewStats}
                t={t}
                onScrollabilityChange={(nextValue) => {
                  setScrollability((current) => (current.file === nextValue
                    ? current
                    : { ...current, file: nextValue }));
                }}
              />
            </div>
          </div>
        </div>
      )}

      {previewMode === MODE_IMAGE && (
        <div
          className="absolute overflow-visible pointer-events-none"
          style={{
            width: `${displaySize.width}px`,
            height: `${displaySize.height}px`,
            left: `${relativeLeft}px`,
            top: `${relativeTop}px`,
            ...previewEntranceStyle,
          }}
        >
          <div
            className="preview-image-stage relative z-10 overflow-visible"
            style={{
              width: `${boxSize.width}px`,
              height: `${boxSize.height}px`,
              transform: `scale(${imageScale})`,
              transformOrigin: 'left top',
            }}
          >
            <ImagePreview
              imageUrl={imageUrl}
              imageLoadState={imageLoadState}
              onLoad={(event) => {
                const { naturalWidth, naturalHeight } = event.currentTarget;
                if (naturalWidth > 0 && naturalHeight > 0) {
                  setImageDimensions({ width: naturalWidth, height: naturalHeight });
                }
                setImageLoadState(IMAGE_STATUS_READY);
              }}
              onError={() => {
                setImageLoadState(IMAGE_STATUS_ERROR);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
