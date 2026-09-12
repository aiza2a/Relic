import { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { toast, TOAST_SIZES, TOAST_POSITIONS } from '@shared/store/toastStore';
import { useDragWithThreshold } from '@shared/hooks/useDragWithThreshold';
import { restoreLastFocus } from '@shared/api/window';
import { Virtuoso } from 'react-virtuoso';
import { useCustomScrollbar } from '@shared/hooks/useCustomScrollbar';
import * as imageLibrary from '@shared/api/imageLibrary';
import SimpleInputDialog from '../SimpleInputDialog';
import Tooltip from '@shared/components/common/Tooltip.jsx';

const IMAGE_DEFAULT_COLS = 4;
const IMAGE_MIN_COLS = 4;
const IMAGE_MAX_COLS = 20;
const IMAGE_MIN_CELL_WIDTH = 68;
const IMAGE_GAP_PX = 8;
const IMAGE_HORIZONTAL_PADDING_PX = 16;
const IMAGE_PREFETCH_COUNT = 20;

const getImageItemGroup = (item) => item?.group || item?.category || '';
const getImageItemKey = (item) => {
  if (!item || item.loading || !item.filename) return '';
  const group = getImageItemGroup(item);
  return group ? `${group}:${item.filename}` : item.filename;
};

const isSelectableImageItem = (item) => Boolean(item && !item.loading && item.path && item.filename);

const areSetsEqual = (left, right) => {
  if (left.size !== right.size) return false;
  for (const value of left) {
    if (!right.has(value)) return false;
  }
  return true;
};

const shouldIgnoreImageSelectionStart = (target) => {
  const element = target?.closest ? target : target?.parentElement;
  if (!element?.closest) return true;
  return Boolean(element.closest(
    '[data-image-tile="true"], [data-drag-ignore="true"], .custom-scrollbar, button, input, textarea, select, [contenteditable="true"]'
  ));
};

const rectsIntersect = (a, b) => (
  a.left <= b.right &&
  a.right >= b.left &&
  a.top <= b.bottom &&
  a.bottom >= b.top
);

const getImageGridCols = (width) => {
  if (!width) return IMAGE_DEFAULT_COLS;
  const availableWidth = Math.max(0, width - IMAGE_HORIZONTAL_PADDING_PX);
  const rawCols = Math.floor((availableWidth + IMAGE_GAP_PX) / (IMAGE_MIN_CELL_WIDTH + IMAGE_GAP_PX));
  return Math.max(IMAGE_MIN_COLS, Math.min(IMAGE_MAX_COLS, rawCols || IMAGE_DEFAULT_COLS));
};

async function readFileInChunks(file, chunkSize = 1024 * 1024) {
  const chunks = [];
  let offset = 0;
  
  while (offset < file.size) {
    const slice = file.slice(offset, offset + chunkSize);
    const chunk = await slice.arrayBuffer();
    chunks.push(new Uint8Array(chunk));
    offset += chunkSize;
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  
  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let position = 0;
  for (const chunk of chunks) {
    result.set(chunk, position);
    position += chunk.length;
  }
  return result;
}

function drawRoundRect(ctx, x, y, width, height, radius) {
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, width, height, radius);
    return;
  }

  const r = Math.min(radius, width / 2, height / 2);
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
}

function drawObjectCoverImage(ctx, image, x, y, width, height) {
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  if (!sourceWidth || !sourceHeight) return false;

  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = width / height;
  let sx = 0;
  let sy = 0;
  let sw = sourceWidth;
  let sh = sourceHeight;

  if (sourceRatio > targetRatio) {
    sw = sourceHeight * targetRatio;
    sx = (sourceWidth - sw) / 2;
  } else {
    sh = sourceWidth / targetRatio;
    sy = (sourceHeight - sh) / 2;
  }

  ctx.drawImage(image, sx, sy, sw, sh, x, y, width, height);
  return true;
}

async function loadImageForDragPreview(path) {
  const response = await fetch(imageLibrary.getImageUrl(path));
  if (!response.ok) {
    throw new Error(`读取拖拽预览图片失败: ${response.status}`);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.decoding = 'async';
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('加载拖拽预览图片失败'));
      image.src = objectUrl;
    });
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function createImageDragPreviewIcon(path) {
  try {
    const image = await loadImageForDragPreview(path);

    const width = 78;
    const height = 78;
    const imageSize = 64;
    const ratio = window.devicePixelRatio || 1;
    const canvas = document.createElement('canvas');
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const ctx = canvas.getContext('2d');
    if (!ctx) return path;

    ctx.scale(ratio, ratio);
    ctx.shadowColor = 'rgba(15, 23, 42, 0.22)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.98)';
    ctx.beginPath();
    drawRoundRect(ctx, 7, 5, imageSize, imageSize, 12);
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.save();
    ctx.beginPath();
    drawRoundRect(ctx, 7, 5, imageSize, imageSize, 12);
    ctx.clip();
    drawObjectCoverImage(ctx, image, 7, 5, imageSize, imageSize);
    ctx.restore();

    ctx.strokeStyle = 'rgba(47, 123, 255, 0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    drawRoundRect(ctx, 8, 6, imageSize - 2, imageSize - 2, 11);
    ctx.stroke();

    return canvas.toDataURL('image/png');
  } catch {
    return path;
  }
}

async function createImagesDragPreviewIcon(paths) {
  const imagePaths = Array.isArray(paths) ? paths.filter(Boolean) : [paths].filter(Boolean);
  if (imagePaths.length <= 1) {
    return createImageDragPreviewIcon(imagePaths[0]);
  }

  try {
    const image = await loadImageForDragPreview(imagePaths[0]);
    const width = 96;
    const height = 88;
    const imageSize = 58;
    const ratio = window.devicePixelRatio || 1;
    const canvas = document.createElement('canvas');
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const ctx = canvas.getContext('2d');
    if (!ctx) return imagePaths[0];

    ctx.scale(ratio, ratio);

    const drawCard = (x, y, alpha, withImage) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowColor = 'rgba(15, 23, 42, 0.2)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 4;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.98)';
      ctx.beginPath();
      drawRoundRect(ctx, x, y, imageSize, imageSize, 12);
      ctx.fill();

      ctx.shadowColor = 'transparent';
      if (withImage) {
        ctx.save();
        ctx.beginPath();
        drawRoundRect(ctx, x, y, imageSize, imageSize, 12);
        ctx.clip();
        drawObjectCoverImage(ctx, image, x, y, imageSize, imageSize);
        ctx.restore();
      }

      ctx.strokeStyle = withImage ? 'rgba(47, 123, 255, 0.7)' : 'rgba(148, 163, 184, 0.45)';
      ctx.lineWidth = withImage ? 2 : 1.5;
      ctx.beginPath();
      drawRoundRect(ctx, x + 1, y + 1, imageSize - 2, imageSize - 2, 11);
      ctx.stroke();
      ctx.restore();
    };

    drawCard(24, 17, 0.72, false);
    drawCard(15, 11, 0.86, false);
    drawCard(6, 5, 1, true);

    const label = imagePaths.length > 99 ? '99+' : String(imagePaths.length);
    ctx.font = '700 12px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    const badgeWidth = Math.max(24, Math.ceil(ctx.measureText(label).width) + 12);
    ctx.shadowColor = 'rgba(15, 23, 42, 0.24)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = '#2563eb';
    ctx.beginPath();
    drawRoundRect(ctx, 66, 4, badgeWidth, 22, 11);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 66 + badgeWidth / 2, 15);

    return canvas.toDataURL('image/png');
  } catch {
    return imagePaths[0] || '';
  }
}

function ImageTile({
  item,
  t,
  isDragging,
  isSelected,
  onClick,
  onMouseDown,
  onCopy,
  onRename,
  onDelete
}) {
  const title = item.loading
    ? ''
    : item.filename?.replace(/^\d+_?/, '').replace(/\.[^.]+$/, '') || '';
  const [isActionHovering, setIsActionHovering] = useState(false);

  return (
    <Tooltip
      content={title}
      placement="top"
      maxWidth={260}
      disabled={!title || isDragging || isActionHovering}
      asChild
    >
      <div
        data-image-tile="true"
        data-image-key={getImageItemKey(item) || undefined}
        onClick={(e) => onClick(e, item)}
        onMouseDown={(e) => !item.loading && item.path && onMouseDown(e, item)}
        role="button"
        className={`relative group aspect-square rounded-lg bg-qc-panel-2 flex items-center justify-center cursor-pointer transition-all overflow-hidden ${
          isDragging
            ? 'opacity-45 scale-95 saturate-50 ring-2 ring-dashed ring-blue-400 bg-qc-active'
            : isSelected
              ? 'bg-qc-active ring-2 ring-blue-500 shadow-sm'
              : 'hover:bg-qc-hover hover:ring-2 hover:ring-blue-400'
        }`}
        style={{ touchAction: 'none' }}
      >
        {isSelected && !isDragging && (
          <div className="absolute left-1 top-1 z-20 w-4 h-4 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-sm pointer-events-none">
            <i className="ti ti-check text-[10px]"></i>
          </div>
        )}
        {isDragging && (
          <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center bg-qc-surface/25">
            <i className="ti ti-drag-drop text-xl text-blue-500"></i>
          </div>
        )}
        <div className="absolute inset-0 rounded-lg overflow-hidden">
          {item.loading ? (
            <div className="w-full h-full flex items-center justify-center">
              <i className="ti ti-loader-2 animate-spin text-2xl text-qc-fg-subtle"></i>
            </div>
          ) : (
            <img
              src={imageLibrary.getImageUrl(item.path)}
              alt={item.filename}
              className="w-full h-full object-cover pointer-events-none"
              loading="lazy"
              draggable={false}
            />
          )}

          {!item.loading && !isDragging && (
            <div
              className="absolute inset-x-0.5 top-0.5 z-10 flex max-w-full flex-wrap justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
            >
              <Tooltip content={t('common.copy') || '复制'} placement="left" asChild>
                <button
                  data-drag-ignore="true"
                  onPointerEnter={() => setIsActionHovering(true)}
                  onPointerLeave={() => setIsActionHovering(false)}
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => onCopy(e, item)}
                  className="w-5 h-5 shrink-0 rounded-full bg-black/50 hover:bg-green-500 text-white flex items-center justify-center pointer-events-auto"
                >
                  <i className="ti ti-copy text-xs"></i>
                </button>
              </Tooltip>
              <Tooltip content={t('common.rename') || '重命名'} placement="left" asChild>
                <button
                  data-drag-ignore="true"
                  onPointerEnter={() => setIsActionHovering(true)}
                  onPointerLeave={() => setIsActionHovering(false)}
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => onRename(e, item)}
                  className="w-5 h-5 shrink-0 rounded-full bg-black/50 hover:bg-blue-500 text-white flex items-center justify-center pointer-events-auto"
                >
                  <i className="ti ti-pencil text-xs"></i>
                </button>
              </Tooltip>
              <Tooltip content={t('common.delete') || '删除'} placement="left" asChild>
                <button
                  data-drag-ignore="true"
                  onPointerEnter={() => setIsActionHovering(true)}
                  onPointerLeave={() => setIsActionHovering(false)}
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => onDelete(e, item)}
                  className="w-5 h-5 shrink-0 rounded-full bg-black/50 hover:bg-red-500 text-white flex items-center justify-center pointer-events-auto"
                >
                  <i className="ti ti-x text-xs"></i>
                </button>
              </Tooltip>
            </div>
          )}
        </div>
      </div>
    </Tooltip>
  );
}

function ImageLibraryTab({
  currentGroup,
  imageGroups = [],
  searchQuery,
  onGroupsChange,
  onImageDragStart,
  onImageDragEnd,
  onImageDragCancel,
  reloadKey = 0
}) {
  const { t } = useTranslation();
  const [imageTotal, setImageTotal] = useState(0);
  const [imageItems, setImageItems] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [draggingImageKeys, setDraggingImageKeys] = useState(() => new Set());
  const [selectedImageKeys, setSelectedImageKeys] = useState(() => new Set());
  const [selectionAnchorKey, setSelectionAnchorKey] = useState('');
  const [selectionBox, setSelectionBox] = useState(null);
  const [renamingItem, setRenamingItem] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const isMountedRef = useRef(true);
  const uploadTokenRef = useRef(0);
  const loadedImageIndexesRef = useRef(new Set());
  const loadingImageIndexesRef = useRef(new Set());
  const pendingLoadRangeRef = useRef(null);
  const loadRequestRef = useRef(null);
  const loadGenerationRef = useRef(0);
  const imageScrollerRef = useRef(null);
  const gridMeasureRef = useRef(null);
  const [contentWidth, setContentWidth] = useState(0);
  const imageCols = useMemo(() => getImageGridCols(contentWidth), [contentWidth]);
  const [scrollerElement, setScrollerElement] = useState(null);
  const scrollerRefCallback = useCallback(element => element && setScrollerElement(element), []);
  useCustomScrollbar(scrollerElement);
  const selfPluginDragRef = useRef(false);
  const pluginDragItemsRef = useRef([]);
  const pluginDragClearTimerRef = useRef(null);
  const suppressClickRef = useRef(false);
  const selectedImageKeysRef = useRef(selectedImageKeys);
  const selectedImageItemsRef = useRef([]);
  const selectionAnchorKeyRef = useRef(selectionAnchorKey);
  const displayImageItemsRef = useRef([]);
  const selectionDraftRef = useRef(null);
  const resetImageLoadCache = useCallback(() => {
    if (loadRequestRef.current) {
      window.clearTimeout(loadRequestRef.current);
      loadRequestRef.current = null;
    }
    pendingLoadRangeRef.current = null;
    loadedImageIndexesRef.current = new Set();
    loadingImageIndexesRef.current = new Set();
    loadGenerationRef.current += 1;
  }, []);
  const activeGroupMeta = useMemo(
    () => imageGroups.find(group => group.name === currentGroup) || null,
    [imageGroups, currentGroup]
  );
  selectedImageKeysRef.current = selectedImageKeys;
  selectionAnchorKeyRef.current = selectionAnchorKey;

  useLayoutEffect(() => {
    const target = gridMeasureRef.current;
    if (!target) return undefined;

    let rafId = 0;
    let observer = null;

    const measure = () => {
      rafId = requestAnimationFrame(() => {
        const nextWidth = target.clientWidth || 0;
        setContentWidth(prev => (prev === nextWidth ? prev : nextWidth));
      });
    };

    measure();

    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(measure);
      observer.observe(target);
    } else {
      window.addEventListener('resize', measure);
    }

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (observer) observer.disconnect();
      else window.removeEventListener('resize', measure);
    };
  }, [imageTotal]);

  const clearSelfPluginDragSoon = useCallback(() => {
    if (pluginDragClearTimerRef.current) {
      window.clearTimeout(pluginDragClearTimerRef.current);
    }
    pluginDragClearTimerRef.current = window.setTimeout(() => {
      selfPluginDragRef.current = false;
      suppressClickRef.current = false;
      pluginDragItemsRef.current = [];
      setDraggingImageKeys(new Set());
      pluginDragClearTimerRef.current = null;
    }, 250);
  }, []);

  const handleDragMouseDown = useDragWithThreshold({
    onDragStart: () => {
      if (pluginDragClearTimerRef.current) {
        window.clearTimeout(pluginDragClearTimerRef.current);
        pluginDragClearTimerRef.current = null;
      }
      selfPluginDragRef.current = true;
      suppressClickRef.current = true;
      const items = pluginDragItemsRef.current || [];
      setDraggingImageKeys(new Set(items.map(getImageItemKey).filter(Boolean)));
      onImageDragStart?.(items);
    },
    onDragEnd: () => {
      onImageDragEnd?.(pluginDragItemsRef.current);
      clearSelfPluginDragSoon();
    },
    onDragCancel: () => {
      selfPluginDragRef.current = false;
      suppressClickRef.current = false;
      pluginDragItemsRef.current = [];
      setDraggingImageKeys(new Set());
      onImageDragCancel?.();
    }
  });

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      uploadTokenRef.current += 1;
      if (pluginDragClearTimerRef.current) {
        window.clearTimeout(pluginDragClearTimerRef.current);
      }
      resetImageLoadCache();
    };
  }, [resetImageLoadCache]);

  useEffect(() => {
    setSelectedImageKeys(new Set());
    setSelectionAnchorKey('');
    setSelectionBox(null);
  }, [currentGroup, reloadKey]);

  const loadImageCount = useCallback(async () => {
    if (!currentGroup) {
      setImageTotal(0);
      setImageItems([]);
      return;
    }

    try {
      const count = await imageLibrary.getImageCount(currentGroup);
      setImageTotal(count);
      if (count === 0) {
        setImageItems([]);
      }
    } catch (err) {
      console.error('加载图片总数失败:', err);
    }
  }, [currentGroup]);

  const loadImageRange = useCallback(async (startIndex, endIndex) => {
    if (!currentGroup || imageTotal <= 0) return;
    
    const rowStart = Math.floor(startIndex / imageCols) * imageCols;
    const rowEnd = Math.min(imageTotal, Math.ceil((endIndex + 1) / imageCols) * imageCols);
    let firstMissingIndex = -1;
    let lastMissingIndex = -1;
    
    for (let index = rowStart; index < rowEnd; index += 1) {
      if (!loadedImageIndexesRef.current.has(index) && !loadingImageIndexesRef.current.has(index)) {
        if (firstMissingIndex === -1) firstMissingIndex = index;
        lastMissingIndex = index;
      }
    }

    if (firstMissingIndex === -1) return;

    const requestStart = Math.floor(firstMissingIndex / imageCols) * imageCols;
    const requestEnd = Math.min(
      imageTotal,
      Math.ceil((lastMissingIndex + 1) / imageCols) * imageCols + IMAGE_PREFETCH_COUNT
    );

    for (let index = requestStart; index < requestEnd; index += 1) {
      loadingImageIndexesRef.current.add(index);
    }

    const requestGeneration = loadGenerationRef.current;
    const requestGroup = currentGroup;
    
    try {
      const result = await imageLibrary.getImageList(requestGroup, requestStart, requestEnd - requestStart);
      if (!isMountedRef.current || loadGenerationRef.current !== requestGeneration) return;

      if (Number.isFinite(result?.total) && result.total !== imageTotal) {
        setImageTotal(result.total);
      }

      const items = Array.isArray(result?.items) ? result.items : [];
      setImageItems(prev => {
        const newItems = [...prev];
        items.forEach((item, idx) => {
          newItems[requestStart + idx] = item;
        });
        return newItems;
      });

      items.forEach((item, idx) => {
        if (item) {
          loadedImageIndexesRef.current.add(requestStart + idx);
        }
      });
    } catch (err) {
      console.error('加载图片列表失败:', err);
    } finally {
      if (loadGenerationRef.current === requestGeneration) {
        for (let index = requestStart; index < requestEnd; index += 1) {
          loadingImageIndexesRef.current.delete(index);
        }
      }
    }
  }, [currentGroup, imageCols, imageTotal]);

  const scheduleLoadRange = useCallback((startIndex, endIndex) => {
    pendingLoadRangeRef.current = pendingLoadRangeRef.current
      ? {
          start: Math.min(pendingLoadRangeRef.current.start, startIndex),
          end: Math.max(pendingLoadRangeRef.current.end, endIndex)
        }
      : { start: startIndex, end: endIndex };

    if (loadRequestRef.current) return;

    loadRequestRef.current = window.setTimeout(() => {
      const pendingRange = pendingLoadRangeRef.current;
      pendingLoadRangeRef.current = null;
      loadRequestRef.current = null;
      if (pendingRange) {
        loadImageRange(pendingRange.start, pendingRange.end);
      }
    }, 50);
  }, [loadImageRange]);

  useEffect(() => {
    resetImageLoadCache();
    setImageItems([]);
    loadImageCount();
  }, [currentGroup, reloadKey, loadImageCount, resetImageLoadCache]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (selfPluginDragRef.current) return;
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (selfPluginDragRef.current) return;
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (isUploading) return;
    if (!currentGroup) {
      toast.warning(t('emoji.noImageGroup') || '请先创建图库分组', {
        size: TOAST_SIZES.EXTRA_SMALL,
        position: TOAST_POSITIONS.BOTTOM_RIGHT
      });
      return;
    }

    if (selfPluginDragRef.current) {
      return;
    }

    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(f => f.type.startsWith('image/'));

    if (imageFiles.length === 0) {
      toast.warning(t('emoji.noValidImages'), {
        size: TOAST_SIZES.EXTRA_SMALL,
        position: TOAST_POSITIONS.BOTTOM_RIGHT
      });
      return;
    }

    const myToken = uploadTokenRef.current + 1;
    uploadTokenRef.current = myToken;
    setIsUploading(true);
    setUploadProgress({ current: 0, total: imageFiles.length });

    let addedCount = 0;

    const processFile = async (file, index) => {
      if (uploadTokenRef.current !== myToken || !isMountedRef.current) return null;
      setUploadProgress(prev => ({ ...prev, current: index + 1 }));
      
      try {
        const data = await readFileInChunks(file);
        if (uploadTokenRef.current !== myToken || !isMountedRef.current) return null;
        await imageLibrary.saveImage(currentGroup, file.name, data);
        return true;
      } catch (err) {
        console.error('保存图片失败:', err);
        toast.error(t('emoji.saveFailed', { name: file.name }), {
          size: TOAST_SIZES.EXTRA_SMALL,
          position: TOAST_POSITIONS.BOTTOM_RIGHT
        });
        return null;
      }
    };

    try {
      for (let i = 0; i < imageFiles.length; i++) {
        const result = await processFile(imageFiles[i], i);
        if (uploadTokenRef.current !== myToken || !isMountedRef.current) return;
        if (result) addedCount++;
      }

      if (uploadTokenRef.current !== myToken || !isMountedRef.current) return;

      if (addedCount > 0) {
        toast.success(t('emoji.addedToImageGroup', { count: addedCount, group: currentGroup }) || t('emoji.addedImages', { count: addedCount }), {
          size: TOAST_SIZES.EXTRA_SMALL,
          position: TOAST_POSITIONS.BOTTOM_RIGHT
        });
      }
      
      loadImageCount();
      onGroupsChange?.();
      resetImageLoadCache();
      setImageItems([]);
    } finally {
      if (isMountedRef.current && uploadTokenRef.current === myToken) {
        setIsUploading(false);
      }
    }
  }, [t, loadImageCount, isUploading, currentGroup, onGroupsChange, resetImageLoadCache]);

  const handleDeleteImage = useCallback(async (e, item) => {
    e.stopPropagation();
    if (!item || item.loading || isUploading) return;
    
    try {
      await imageLibrary.deleteImage(item.group || item.category, item.filename);
      loadImageCount();
      onGroupsChange?.();
      resetImageLoadCache();
      setImageItems([]);
    } catch (err) {
      console.error('删除图片失败:', err);
      toast.error(t('common.deleteFailed') || '删除失败', {
        size: TOAST_SIZES.EXTRA_SMALL,
        position: TOAST_POSITIONS.BOTTOM_RIGHT
      });
    }
  }, [t, loadImageCount, isUploading, onGroupsChange, resetImageLoadCache]);

  const handleRenameStart = useCallback((e, item) => {
    e.stopPropagation();
    if (!item || item.loading || isUploading) return;
    const nameWithoutExt = item.filename.replace(/\.[^/.]+$/, '');
    setRenamingItem(item);
    setRenameValue(nameWithoutExt);
  }, [isUploading]);

  const handleCopyImage = useCallback(async (e, item) => {
    e.stopPropagation();
    if (!item || item.loading || isUploading) return;
    
    try {
      await invoke('copy_image_to_clipboard', { filePath: item.path });
      toast.success(t('common.copied'), {
        size: TOAST_SIZES.EXTRA_SMALL,
        position: TOAST_POSITIONS.BOTTOM_RIGHT
      });
    } catch (err) {
      console.error('复制图片失败:', err);
      toast.error(t('common.copyFailed'), {
        size: TOAST_SIZES.EXTRA_SMALL,
        position: TOAST_POSITIONS.BOTTOM_RIGHT
      });
    }
  }, [t, isUploading]);

  const handleRenameConfirm = useCallback(async (nextValue = renameValue) => {
    const nextName = nextValue.trim();
    if (!renamingItem || !nextName) {
      return;
    }
    
    try {
      await imageLibrary.renameImage(renamingItem.group || renamingItem.category, renamingItem.filename, nextName);
      loadImageCount();
      resetImageLoadCache();
      setImageItems([]);
      setRenamingItem(null);
      setRenameValue('');
    } catch (err) {
      console.error('重命名失败:', err);
      toast.error(t('emoji.renameFailed'), {
        size: TOAST_SIZES.EXTRA_SMALL,
        position: TOAST_POSITIONS.BOTTOM_RIGHT
      });
    }
  }, [renamingItem, renameValue, loadImageCount, t, resetImageLoadCache]);

  const handleImageDragMouseDown = useCallback((e, item) => {
    if (e.target?.closest?.('[data-drag-ignore="true"]')) return;
    if (!isSelectableImageItem(item)) return;

    const itemKey = getImageItemKey(item);
    const currentSelectedKeys = selectedImageKeysRef.current;
    const currentSelectedItems = selectedImageItemsRef.current;
    const shouldDragSelection = currentSelectedKeys.has(itemKey) && currentSelectedItems.length > 1;
    const dragItems = shouldDragSelection ? currentSelectedItems : [item];
    const dragPaths = dragItems.map(dragItem => dragItem.path).filter(Boolean);

    if (!currentSelectedKeys.has(itemKey) && currentSelectedKeys.size > 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      setSelectedImageKeys(new Set([itemKey]));
      setSelectionAnchorKey(itemKey);
    }

    pluginDragItemsRef.current = dragItems;
    handleDragMouseDown(e, dragPaths, () => createImagesDragPreviewIcon(dragPaths), 'copy');
  }, [handleDragMouseDown]);

  const handleRenameCancel = useCallback(() => {
    setRenamingItem(null);
    setRenameValue('');
  }, []);

  const hasSearchQuery = Boolean(searchQuery?.trim());

  const filteredImageItems = useMemo(() => {
    if (!hasSearchQuery) return imageItems;
    const query = searchQuery.toLowerCase();
    return imageItems.filter(item => 
      item && !item.loading && item.filename.toLowerCase().includes(query)
    );
  }, [imageItems, searchQuery, hasSearchQuery]);

  const filteredImageTotal = useMemo(() => {
    if (!hasSearchQuery) return imageTotal;
    return filteredImageItems.length;
  }, [hasSearchQuery, imageTotal, filteredImageItems]);

  const displayImageItems = useMemo(
    () => (hasSearchQuery ? filteredImageItems : imageItems),
    [hasSearchQuery, filteredImageItems, imageItems]
  );

  const displayImageTotal = hasSearchQuery ? filteredImageTotal : imageTotal;

  const selectedImageItems = useMemo(() => (
    displayImageItems.filter(item => {
      if (!isSelectableImageItem(item)) return false;
      return selectedImageKeys.has(getImageItemKey(item));
    })
  ), [displayImageItems, selectedImageKeys]);

  displayImageItemsRef.current = displayImageItems;
  selectedImageItemsRef.current = selectedImageItems;

  const imageRowCount = useMemo(() => {
    return Math.ceil(displayImageTotal / imageCols);
  }, [displayImageTotal, imageCols]);

  const getDisplayImageEntries = useCallback(() => {
    const entries = [];
    displayImageItemsRef.current.forEach((item, index) => {
      if (!isSelectableImageItem(item)) return;
      entries.push({ item, index, key: getImageItemKey(item) });
    });
    return entries;
  }, []);

  const selectImageRange = useCallback((item, additive = false) => {
    const currentKey = getImageItemKey(item);
    if (!currentKey) return;

    const entries = getDisplayImageEntries();
    const currentEntry = entries.find(entry => entry.key === currentKey);
    if (!currentEntry) {
      setSelectedImageKeys(new Set([currentKey]));
      setSelectionAnchorKey(currentKey);
      return;
    }

    const anchorEntry = entries.find(entry => entry.key === selectionAnchorKeyRef.current) || currentEntry;
    const start = Math.min(anchorEntry.index, currentEntry.index);
    const end = Math.max(anchorEntry.index, currentEntry.index);
    const rangeKeys = entries
      .filter(entry => entry.index >= start && entry.index <= end)
      .map(entry => entry.key);

    setSelectedImageKeys(prev => {
      const next = additive ? new Set(prev) : new Set();
      rangeKeys.forEach(key => next.add(key));
      return areSetsEqual(prev, next) ? prev : next;
    });

    if (!selectionAnchorKeyRef.current) {
      setSelectionAnchorKey(currentKey);
    }
  }, [getDisplayImageEntries]);

  const handleImageClick = useCallback(async (e, item) => {
    if (suppressClickRef.current) return;
    if (!isSelectableImageItem(item) || isUploading) return;

    const itemKey = getImageItemKey(item);
    if (e.shiftKey) {
      e.preventDefault();
      selectImageRange(item, e.ctrlKey || e.metaKey);
      return;
    }

    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setSelectedImageKeys(prev => {
        const next = new Set(prev);
        if (next.has(itemKey)) {
          next.delete(itemKey);
        } else {
          next.add(itemKey);
        }
        return next;
      });
      setSelectionAnchorKey(itemKey);
      return;
    }

    if (selectedImageKeysRef.current.size > 0) {
      setSelectedImageKeys(new Set());
      setSelectionAnchorKey(itemKey);
    }

    try {
      await restoreLastFocus();
      await invoke('paste_image_file', { filePath: item.path });
    } catch (err) {
      console.error('粘贴图片失败:', err);
      toast.error(t('common.pasteFailed') || '粘贴失败', {
        size: TOAST_SIZES.EXTRA_SMALL,
        position: TOAST_POSITIONS.BOTTOM_RIGHT
      });
    }
  }, [t, isUploading, selectImageRange]);

  const updateSelectionByClientRect = useCallback((clientRect, additive, baseKeys) => {
    const container = gridMeasureRef.current;
    if (!container) return;

    const selectedKeys = [];
    container.querySelectorAll('[data-image-key]').forEach(element => {
      const key = element.dataset.imageKey;
      if (!key) return;
      if (rectsIntersect(clientRect, element.getBoundingClientRect())) {
        selectedKeys.push(key);
      }
    });

    setSelectedImageKeys(prev => {
      const next = additive ? new Set(baseKeys) : new Set();
      selectedKeys.forEach(key => next.add(key));
      return areSetsEqual(prev, next) ? prev : next;
    });

    if (selectedKeys.length > 0) {
      setSelectionAnchorKey(selectedKeys[selectedKeys.length - 1]);
    }
  }, []);

  const handleSelectionMouseMove = useCallback((event) => {
    const draft = selectionDraftRef.current;
    const container = gridMeasureRef.current;
    if (!draft || !container) return;

    const dx = event.clientX - draft.startClientX;
    const dy = event.clientY - draft.startClientY;
    const moved = draft.moved || Math.sqrt(dx * dx + dy * dy) >= 4;
    draft.moved = moved;

    const containerRect = container.getBoundingClientRect();
    const currentX = Math.max(0, Math.min(event.clientX - containerRect.left, containerRect.width));
    const currentY = Math.max(0, Math.min(event.clientY - containerRect.top, containerRect.height));
    const left = Math.min(draft.startX, currentX);
    const top = Math.min(draft.startY, currentY);
    const width = Math.abs(currentX - draft.startX);
    const height = Math.abs(currentY - draft.startY);

    setSelectionBox({ left, top, width, height, visible: moved });

    if (!moved) return;

    updateSelectionByClientRect({
      left: Math.min(draft.startClientX, event.clientX),
      right: Math.max(draft.startClientX, event.clientX),
      top: Math.min(draft.startClientY, event.clientY),
      bottom: Math.max(draft.startClientY, event.clientY)
    }, draft.additive, draft.baseKeys);
  }, [updateSelectionByClientRect]);

  const handleSelectionMouseUp = useCallback(() => {
    document.removeEventListener('mousemove', handleSelectionMouseMove);
    document.removeEventListener('mouseup', handleSelectionMouseUp);

    const draft = selectionDraftRef.current;
    if (draft && !draft.moved && !draft.additive) {
      setSelectedImageKeys(prev => (prev.size > 0 ? new Set() : prev));
      setSelectionAnchorKey('');
    }

    selectionDraftRef.current = null;
    setSelectionBox(null);
  }, [handleSelectionMouseMove]);

  useEffect(() => () => {
    document.removeEventListener('mousemove', handleSelectionMouseMove);
    document.removeEventListener('mouseup', handleSelectionMouseUp);
  }, [handleSelectionMouseMove, handleSelectionMouseUp]);

  const handleSelectionMouseDown = useCallback((e) => {
    if (e.button !== 0 || isUploading || selfPluginDragRef.current || !currentGroup || displayImageTotal === 0) return;
    if (shouldIgnoreImageSelectionStart(e.target)) return;

    const container = gridMeasureRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const startX = Math.max(0, Math.min(e.clientX - containerRect.left, containerRect.width));
    const startY = Math.max(0, Math.min(e.clientY - containerRect.top, containerRect.height));
    const additive = e.ctrlKey || e.metaKey;

    selectionDraftRef.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX,
      startY,
      additive,
      moved: false,
      baseKeys: additive ? new Set(selectedImageKeysRef.current) : new Set()
    };

    if (!additive) {
      setSelectedImageKeys(prev => (prev.size > 0 ? new Set() : prev));
      setSelectionAnchorKey('');
    }

    setSelectionBox({ left: startX, top: startY, width: 0, height: 0, visible: false });
    document.addEventListener('mousemove', handleSelectionMouseMove);
    document.addEventListener('mouseup', handleSelectionMouseUp);
    e.preventDefault();
  }, [currentGroup, displayImageTotal, handleSelectionMouseMove, handleSelectionMouseUp, isUploading]);

  const renderImageRow = useCallback((rowIndex) => {
    const startIdx = rowIndex * imageCols;
    const rowItems = [];
    
    for (let i = 0; i < imageCols; i++) {
      const idx = startIdx + i;
      if (idx >= displayImageTotal) break;
      const item = displayImageItems[idx];
      rowItems.push(item || { id: `loading-${idx}`, loading: true });
    }

    if (!hasSearchQuery && rowItems.some(item => item.loading)) {
      scheduleLoadRange(startIdx, startIdx + imageCols - 1);
    }

    return (
      <div
        className="grid gap-2 px-2 py-1"
        style={{ gridTemplateColumns: `repeat(${imageCols}, minmax(0, 1fr))` }}
        data-no-drag
      >
        {rowItems.map((item) => {
          const itemKey = getImageItemKey(item);
          return (
            <ImageTile
              key={item.id || itemKey}
              item={item}
              t={t}
              isDragging={Boolean(itemKey && draggingImageKeys.has(itemKey))}
              isSelected={Boolean(itemKey && selectedImageKeys.has(itemKey))}
              onClick={handleImageClick}
              onMouseDown={handleImageDragMouseDown}
              onCopy={handleCopyImage}
              onRename={handleRenameStart}
              onDelete={handleDeleteImage}
            />
          );
        })}
      </div>
    );
  }, [displayImageItems, displayImageTotal, hasSearchQuery, imageCols, scheduleLoadRange, handleImageClick, handleImageDragMouseDown, handleCopyImage, handleDeleteImage, handleRenameStart, draggingImageKeys, selectedImageKeys, t]);

  return (
    <div
      ref={gridMeasureRef}
      data-no-drag
      className="h-full flex flex-col overflow-hidden relative"
      onMouseDownCapture={handleSelectionMouseDown}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
        {!currentGroup ? (
          <div className="flex-1 flex flex-col items-center justify-center text-qc-fg-subtle">
            <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-qc-border-strong flex items-center justify-center mb-3">
              <i className="ti ti-folder-plus text-4xl"></i>
            </div>
            <p className="text-sm mb-1">{t('emoji.noImageGroup') || '请先创建图库分组'}</p>
          </div>
        ) : imageTotal === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-qc-fg-subtle">
            <div className={`w-20 h-20 rounded-2xl border-2 border-dashed flex items-center justify-center mb-3 transition-colors ${
              isDragging ? 'border-blue-500 bg-blue-50' : 'border-qc-border-strong'
            }`}>
              <i className={`${activeGroupMeta?.icon || 'ti ti-photo'} text-4xl ${isDragging ? 'text-blue-500' : ''}`}></i>
            </div>
            <p className="text-sm mb-1">{t('emoji.dragToAdd') || '拖入图片添加'}</p>
            <p className="text-xs text-qc-fg-subtle">{t('emoji.supportFormats') || '支持 PNG, JPG, GIF, WebP'}</p>
          </div>
        ) : imageRowCount === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-qc-fg-subtle text-sm">{t('common.noResults') || '无搜索结果'}</p>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden custom-scrollbar-container">
            <Virtuoso
              key={`${currentGroup}-${imageCols}-${searchQuery?.trim() || ''}`}
              ref={imageScrollerRef}
              totalCount={imageRowCount}
              itemContent={renderImageRow}
              computeItemKey={(index) => `row-${currentGroup}-${imageCols}-${searchQuery}-${index}`}
              scrollerRef={scrollerRefCallback}
              overscan={3}
              className="h-full"
              style={{ height: '100%' }}
            />
          </div>
        )}

      {isDragging && (
        <div className="absolute inset-0 bg-blue-500/10 pointer-events-none flex items-center justify-center z-10 ring-2 ring-blue-500 ring-inset">
          <div className="bg-qc-panel rounded-xl shadow-lg px-6 py-4 flex items-center gap-3">
            <i className="ti ti-upload text-2xl text-blue-500"></i>
            <span className="text-qc-fg">{t('emoji.dropToAdd')}</span>
          </div>
        </div>
      )}

      {selectionBox && (
        <div
          className={`absolute z-30 pointer-events-none rounded border border-blue-500 bg-blue-500/15 ${
            selectionBox.visible ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            left: `${selectionBox.left}px`,
            top: `${selectionBox.top}px`,
            width: `${selectionBox.width}px`,
            height: `${selectionBox.height}px`
          }}
        />
      )}

      {isUploading && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[9999]">
          <div className="bg-qc-panel rounded-xl shadow-lg px-6 py-4 flex flex-col items-center gap-3">
            <i className="ti ti-loader-2 animate-spin text-3xl text-blue-500"></i>
            <span className="text-qc-fg">
              {t('emoji.uploading', { current: uploadProgress.current, total: uploadProgress.total })}
            </span>
            <div className="w-40 h-1.5 bg-qc-panel-2 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all duration-200"
                style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {renamingItem && (
        <SimpleInputDialog
          title={t('common.rename', '重命名')}
          value={renameValue}
          onChange={setRenameValue}
          onConfirm={handleRenameConfirm}
          onCancel={handleRenameCancel}
          allowEmpty={false}
        />
      )}
    </div>
  );
}

export default ImageLibraryTab;
