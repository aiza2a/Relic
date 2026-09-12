import { getPrimaryType } from '@shared/utils/contentType';
import {
  PREVIEW_MODE_TEXT,
  PREVIEW_MODE_HTML,
  PREVIEW_MODE_IMAGE,
  PREVIEW_MODE_FILE,
} from '@shared/utils/pasteFormatHints';

export const MODE_TEXT = PREVIEW_MODE_TEXT;
export const MODE_HTML = PREVIEW_MODE_HTML;
export const MODE_IMAGE = PREVIEW_MODE_IMAGE;
export const MODE_FILE = PREVIEW_MODE_FILE;

export const PREVIEW_OFFSET = 14;
export const PREVIEW_MAIN_GAP = 18;
export const TEXT_SCROLL_STEP = 120;
export const IMAGE_SCALE_STEP = 0.1;
export const IMAGE_SCALE_MIN = 1;
export const IMAGE_SCALE_MAX = 5;
export const IMAGE_SCALE_INDICATOR_DURATION = 1500;
export const TEXT_MIN_WIDTH = 48;
export const HTML_MIN_WIDTH = 72;
export const TEXT_MIN_HEIGHT = 46;
export const TEXT_DEFAULT_HEIGHT = 46;
export const IMAGE_STATUS_IDLE = 'idle';
export const IMAGE_STATUS_LOADING = 'loading';
export const IMAGE_STATUS_READY = 'ready';
export const IMAGE_STATUS_ERROR = 'error';

export const isFiniteNumber = (value) => Number.isFinite(value) && !Number.isNaN(value);
export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const roundSize = (value, minValue = 120) => Math.max(minValue, Math.round(value));

function resolveWorkAreaMaxWidth(workAreaWidth, minWidth) {
  if (!isFiniteNumber(workAreaWidth) || workAreaWidth <= 0) {
    return 420;
  }

  return Math.max(minWidth, workAreaWidth - 24);
}

function resolveDirectionalMaxWidth(workAreaWidth, availableWidth, minWidth) {
  const width = Number(availableWidth);
  if (!isFiniteNumber(width) || width <= 0) {
    return null;
  }

  return clamp(
    Math.floor(width),
    minWidth,
    resolveWorkAreaMaxWidth(workAreaWidth, minWidth),
  );
}

export function resolveTextPreviewMaxWidth(workAreaHeight, workAreaWidth, availableWidth = null) {
  const directionalMaxWidth = resolveDirectionalMaxWidth(workAreaWidth, availableWidth, TEXT_MIN_WIDTH);
  if (directionalMaxWidth) {
    return directionalMaxWidth;
  }

  if (!isFiniteNumber(workAreaHeight) || workAreaHeight <= 0) {
    return 420;
  }

  return clamp(
    roundSize(workAreaHeight * 0.5, 260),
    260,
    Math.max(260, resolveWorkAreaMaxWidth(workAreaWidth, TEXT_MIN_WIDTH)),
  );
}

export function resolveHtmlPreviewMaxWidth(workAreaHeight, workAreaWidth, availableWidth = null) {
  const directionalMaxWidth = resolveDirectionalMaxWidth(workAreaWidth, availableWidth, HTML_MIN_WIDTH);
  if (directionalMaxWidth) {
    return directionalMaxWidth;
  }

  return Math.max(
    HTML_MIN_WIDTH,
    resolveTextPreviewMaxWidth(workAreaHeight, workAreaWidth),
  );
}

export function resolveTextPreviewMaxHeight(workAreaHeight) {
  if (!isFiniteNumber(workAreaHeight) || workAreaHeight <= 0) {
    return 560;
  }

  return clamp(
    roundSize(workAreaHeight * (2 / 3), 300),
    300,
    Math.max(300, workAreaHeight - 24),
  );
}

function resolveFilePreviewMaxWidth(workAreaWidth, longestNameLength = 0, longestPathLength = 0) {
  const nameLength = Number(longestNameLength);
  const pathLength = Number(longestPathLength);
  const nameBonus = isFiniteNumber(nameLength) && nameLength > 0
    ? clamp(Math.round(Math.min(nameLength, 30) * 5.5), 0, 150)
    : 0;
  const pathBonus = isFiniteNumber(pathLength) && pathLength > 0
    ? clamp(Math.round(Math.min(pathLength, 64) * 3.6), 0, 230)
    : 0;
  const maxWorkAreaWidth = isFiniteNumber(workAreaWidth) && workAreaWidth > 0
    ? workAreaWidth - 24
    : 720;

  return clamp(
    620 + nameBonus + pathBonus,
    520,
    Math.max(520, maxWorkAreaWidth),
  );
}

function estimateFilePreviewTextWidth(text, fontSize) {
  const value = String(text || '');
  if (!value) {
    return 0;
  }

  let width = 0;
  for (const char of value) {
    const code = char.codePointAt(0);
    if (/\s/.test(char)) {
      width += fontSize * 0.32;
    } else if (code >= 0x2e80) {
      width += fontSize;
    } else if (/[ilI1|.,:;'`!]/.test(char)) {
      width += fontSize * 0.34;
    } else if (/[mwMW@#%&]/.test(char)) {
      width += fontSize * 0.78;
    } else if (/[A-Z]/.test(char)) {
      width += fontSize * 0.62;
    } else if (/[0-9]/.test(char)) {
      width += fontSize * 0.56;
    } else if (/[\\/[\\](){}_\-]/.test(char)) {
      width += fontSize * 0.42;
    } else {
      width += fontSize * 0.55;
    }
  }

  return Math.ceil(width);
}

export function resolvePreviewMode(requestedMode, item) {
  const primaryType = getPrimaryType(item?.content_type);

  if (requestedMode === MODE_IMAGE || primaryType === 'image') {
    return MODE_IMAGE;
  }

  if (requestedMode === MODE_FILE || primaryType === 'file') {
    return MODE_FILE;
  }

  if (requestedMode === MODE_HTML) {
    return MODE_HTML;
  }

  return MODE_TEXT;
}

function normalizePreviewFileEntry(file = {}) {
  const rawPath = typeof file?.path === 'string' ? file.path.trim() : '';
  const actualPath = typeof file?.actual_path === 'string' ? file.actual_path.trim() : '';
  const derivedName = (actualPath || rawPath)
    .split(/[/\\]/)
    .filter(Boolean)
    .pop() || '';
  const name = typeof file?.name === 'string' && file.name.trim()
    ? file.name.trim()
    : derivedName || '未命名文件';

  return {
    name,
    path: rawPath,
    actualPath,
    displayPath: actualPath || rawPath,
    size: Number(file?.size) || 0,
    isDirectory: Boolean(file?.is_directory),
    exists: file?.exists !== false,
    fileType: typeof file?.file_type === 'string' ? file.file_type.trim() : '',
    iconData: typeof file?.icon_data === 'string' ? file.icon_data : '',
    width: Number(file?.width) || null,
    height: Number(file?.height) || null,
  };
}

export function parsePreviewFiles(item) {
  const content = typeof item?.content === 'string' ? item.content.trim() : '';
  if (!content.startsWith('files:')) {
    return [];
  }

  try {
    const filesData = JSON.parse(content.slice(6));
    const files = Array.isArray(filesData?.files) ? filesData.files : [];
    return files
      .map((file) => normalizePreviewFileEntry(file))
      .filter((file) => file.path || file.actualPath || file.name);
  } catch {
    return [];
  }
}

export function buildPreviewFileStats(files = []) {
  const stats = {
    fileCount: 0,
    directoryCount: 0,
    missingCount: 0,
    existingCount: 0,
    totalSize: 0,
    longestNameLength: 0,
    longestPathLength: 0,
    longestNameWidth: 0,
    longestPathLineWidth: 0,
  };

  files.forEach((file) => {
    if (!file) return;

    stats.fileCount += 1;
    if (file.isDirectory) {
      stats.directoryCount += 1;
    } else {
      stats.totalSize += Number(file.size) > 0 ? Number(file.size) : 0;
    }

    if (file.exists === false) {
      stats.missingCount += 1;
    } else {
      stats.existingCount += 1;
    }

    const nameText = String(file.name || '');
    const pathText = String(file.displayPath || file.actualPath || file.path || '');
    const nameLength = nameText.length;
    const pathLength = pathText.length;
    const width = Number(file.width);
    const height = Number(file.height);
    const detailText = isFiniteNumber(width) && isFiniteNumber(height) && width > 0 && height > 0
      ? `${width} × ${height}`
      : '';
    const storedPathText = file.actualPath && file.path && file.actualPath !== file.path
      ? `存储路径：${file.path}`
      : '';
    const nameWidth = estimateFilePreviewTextWidth(nameText, 13);
    const pathLineWidth = Math.max(
      estimateFilePreviewTextWidth(pathText, 11)
        + (detailText ? estimateFilePreviewTextWidth(detailText, 11) + 8 : 0),
      estimateFilePreviewTextWidth(storedPathText, 11),
    );
    if (nameLength > stats.longestNameLength) {
      stats.longestNameLength = nameLength;
    }
    if (pathLength > stats.longestPathLength) {
      stats.longestPathLength = pathLength;
    }
    if (nameWidth > stats.longestNameWidth) {
      stats.longestNameWidth = nameWidth;
    }
    if (pathLineWidth > stats.longestPathLineWidth) {
      stats.longestPathLineWidth = pathLineWidth;
    }
  });

  return stats;
}

export function resolveBoxSize(mode, workAreaHeight, workAreaWidth, options = {}) {
  if (!isFiniteNumber(workAreaHeight) || workAreaHeight <= 0) {
    return { width: 420, height: 560 };
  }

  if (mode === MODE_IMAGE) {
    const maxEdge = clamp(
      roundSize(workAreaHeight * 0.5, 180),
      180,
      Math.max(180, Math.min(workAreaWidth - 24, workAreaHeight - 24)),
    );
    const imageWidth = Number(options.imageWidth);
    const imageHeight = Number(options.imageHeight);
    if (isFiniteNumber(imageWidth) && imageWidth > 0 && isFiniteNumber(imageHeight) && imageHeight > 0) {
      const scale = Math.min(maxEdge / imageWidth, maxEdge / imageHeight);
      const width = clamp(roundSize(imageWidth * scale, 120), 120, Math.max(120, workAreaWidth - 24));
      const height = clamp(roundSize(imageHeight * scale, 120), 120, Math.max(120, workAreaHeight - 24));
      return { width, height };
    }

    return { width: maxEdge, height: maxEdge };
  }

  if (mode === MODE_FILE) {
    const fileCount = Number(options.fileCount);
    const visibleRows = isFiniteNumber(fileCount) && fileCount > 0
      ? Math.min(fileCount, 9)
      : 4;
    const longestNameLength = Number(options.longestFileNameLength);
    const longestPathLength = Number(options.longestFilePathLength);
    const longestNameWidth = Number(options.longestFileNameWidth);
    const longestPathLineWidth = Number(options.longestFilePathLineWidth);
    const nameWidth = isFiniteNumber(longestNameWidth) && longestNameWidth > 0
      ? clamp(Math.round(longestNameWidth), 96, 420)
      : isFiniteNumber(longestNameLength) && longestNameLength > 0
        ? clamp(Math.round(longestNameLength * 7.2), 96, 420)
      : 128;
    const pathWidth = isFiniteNumber(longestPathLineWidth) && longestPathLineWidth > 0
      ? clamp(Math.round(longestPathLineWidth), 160, 760)
      : isFiniteNumber(longestPathLength) && longestPathLength > 0
        ? clamp(Math.round(longestPathLength * 5.8), 160, 760)
      : 128;
    const contentWidth = Math.max(nameWidth + 58, pathWidth) + 156;
    const maxFileWidth = resolveFilePreviewMaxWidth(
      workAreaWidth,
      longestNameLength,
      longestPathLength,
    );
    const width = clamp(
      contentWidth + 32,
      340,
      maxFileWidth,
    );
    const maxHeight = clamp(
      roundSize(workAreaHeight * 0.58, 220),
      220,
      Math.max(220, workAreaHeight - 24),
    );
    const summaryHeight = 34;
    const verticalPadding = 16;
    const heightSafety = 6;
    const height = clamp(
      summaryHeight + verticalPadding + visibleRows * 58 + heightSafety,
      summaryHeight + verticalPadding + 58 + heightSafety,
      maxHeight,
    );

    return { width, height };
  }

  if (mode === MODE_HTML) {
    const preferredWidth = Number(options.htmlWidth);
    const preferredHeight = Number(options.htmlHeight);
    const maxWidth = resolveHtmlPreviewMaxWidth(workAreaHeight, workAreaWidth, options.htmlMaxWidth);
    const maxHeight = resolveTextPreviewMaxHeight(workAreaHeight);

    const width = isFiniteNumber(preferredWidth) && preferredWidth > 0
      ? Math.round(preferredWidth)
      : maxWidth;
    const height = isFiniteNumber(preferredHeight) && preferredHeight > 0
      ? Math.round(preferredHeight)
      : TEXT_DEFAULT_HEIGHT;

    return {
      width: clamp(width, HTML_MIN_WIDTH, maxWidth),
      height: clamp(height, TEXT_MIN_HEIGHT, maxHeight),
    };
  }

  const maxWidth = resolveTextPreviewMaxWidth(workAreaHeight, workAreaWidth, options.textMaxWidth);
  const maxHeight = resolveTextPreviewMaxHeight(workAreaHeight);
  const preferredWidth = Number(options.textWidth);
  const preferredHeight = Number(options.textHeight);
  const finalWidth = clamp(
    isFiniteNumber(preferredWidth) && preferredWidth > 0 ? Math.round(preferredWidth) : maxWidth,
    TEXT_MIN_WIDTH,
    maxWidth,
  );
  const finalHeight = clamp(
    isFiniteNumber(preferredHeight) && preferredHeight > 0 ? Math.round(preferredHeight) : TEXT_DEFAULT_HEIGHT,
    TEXT_MIN_HEIGHT,
    maxHeight,
  );
  return { width: finalWidth, height: finalHeight };
}

function isValidRect(rect) {
  return rect
    && isFiniteNumber(rect.left)
    && isFiniteNumber(rect.top)
    && isFiniteNumber(rect.width)
    && isFiniteNumber(rect.height)
    && rect.width > 0
    && rect.height > 0;
}

function resolveBestPositiveSpace(spaces, minWidth) {
  const validSpaces = spaces
    .map((space) => Number(space))
    .filter((space) => isFiniteNumber(space) && space >= minWidth);

  if (validSpaces.length === 0) {
    return null;
  }

  return Math.max(...validSpaces);
}

export function resolvePreviewDirectionalAvailableWidth(
  workArea,
  mainWindowRect = null,
  mousePosition = null,
  minWidth = TEXT_MIN_WIDTH,
) {
  if (!isValidRect(workArea)) {
    return null;
  }

  const safeMinWidth = isFiniteNumber(Number(minWidth)) && Number(minWidth) > 0
    ? Number(minWidth)
    : TEXT_MIN_WIDTH;
  const workLeft = workArea.left;
  const workTop = workArea.top;
  const workRight = workLeft + workArea.width;
  const workBottom = workTop + workArea.height;
  const maxWorkAreaWidth = resolveWorkAreaMaxWidth(workArea.width, safeMinWidth);

  if (isValidRect(mainWindowRect)) {
    const mainLeft = mainWindowRect.left;
    const mainTop = mainWindowRect.top;
    const mainRight = mainLeft + mainWindowRect.width;
    const mainBottom = mainTop + mainWindowRect.height;
    const horizontalSpace = resolveBestPositiveSpace(
      [
        mainLeft - workLeft - PREVIEW_MAIN_GAP,
        workRight - mainRight - PREVIEW_MAIN_GAP,
      ],
      safeMinWidth,
    );

    if (horizontalSpace) {
      return clamp(Math.floor(horizontalSpace), safeMinWidth, maxWorkAreaWidth);
    }

    const verticalSpace = resolveBestPositiveSpace(
      [
        mainTop - workTop - PREVIEW_MAIN_GAP,
        workBottom - mainBottom - PREVIEW_MAIN_GAP,
      ],
      TEXT_MIN_HEIGHT,
    );

    if (verticalSpace) {
      return maxWorkAreaWidth;
    }
  }

  const mouseX = Number(mousePosition?.x);
  if (isFiniteNumber(mouseX)) {
    const pointerSpace = resolveBestPositiveSpace(
      [
        workRight - mouseX - PREVIEW_OFFSET,
        mouseX - workLeft - PREVIEW_OFFSET,
      ],
      safeMinWidth,
    );

    if (pointerSpace) {
      return clamp(Math.floor(pointerSpace), safeMinWidth, maxWorkAreaWidth);
    }
  }

  return maxWorkAreaWidth;
}

function choosePositionOutsideMainWindow(mouseX, mouseY, width, height, workArea, mainWindowRect) {
  if (!isValidRect(mainWindowRect)) {
    return null;
  }

  const workLeft = workArea.left;
  const workTop = workArea.top;
  const workRight = workLeft + workArea.width;
  const workBottom = workTop + workArea.height;
  const mainLeft = mainWindowRect.left;
  const mainTop = mainWindowRect.top;
  const mainRight = mainLeft + mainWindowRect.width;
  const mainBottom = mainTop + mainWindowRect.height;

  const rightSpace = workRight - mainRight - PREVIEW_MAIN_GAP;
  const leftSpace = mainLeft - workLeft - PREVIEW_MAIN_GAP;
  const canPlaceRight = rightSpace >= width;
  const canPlaceLeft = leftSpace >= width;
  const preferredTop = clamp(
    mouseY - height / 2,
    workTop,
    Math.max(workTop, workBottom - height),
  );

  if (canPlaceRight || canPlaceLeft) {
    const placeRight = canPlaceRight && (!canPlaceLeft || rightSpace >= leftSpace);
    return {
      left: placeRight
        ? mainRight + PREVIEW_MAIN_GAP
        : mainLeft - PREVIEW_MAIN_GAP - width,
      top: preferredTop,
    };
  }

  const bottomSpace = workBottom - mainBottom - PREVIEW_MAIN_GAP;
  const topSpace = mainTop - workTop - PREVIEW_MAIN_GAP;
  const canPlaceBottom = bottomSpace >= height;
  const canPlaceTop = topSpace >= height;
  const preferredLeft = clamp(
    mouseX - width / 2,
    workLeft,
    Math.max(workLeft, workRight - width),
  );

  if (canPlaceBottom || canPlaceTop) {
    const placeBottom = canPlaceBottom && (!canPlaceTop || bottomSpace >= topSpace);
    return {
      left: preferredLeft,
      top: placeBottom
        ? mainBottom + PREVIEW_MAIN_GAP
        : mainTop - PREVIEW_MAIN_GAP - height,
    };
  }

  return null;
}

export function chooseContainerPosition(mouseX, mouseY, width, height, workArea, mainWindowRect = null) {
  const workLeft = workArea.left;
  const workTop = workArea.top;
  const workRight = workLeft + workArea.width;
  const workBottom = workTop + workArea.height;

  if (
    !isFiniteNumber(mouseX) ||
    !isFiniteNumber(mouseY) ||
    !isFiniteNumber(width) ||
    !isFiniteNumber(height) ||
    !isFiniteNumber(workLeft) ||
    !isFiniteNumber(workTop) ||
    !isFiniteNumber(workRight) ||
    !isFiniteNumber(workBottom)
  ) {
    return { left: 0, top: 0 };
  }

  const outsideMainWindow = choosePositionOutsideMainWindow(
    mouseX,
    mouseY,
    width,
    height,
    workArea,
    mainWindowRect,
  );
  if (outsideMainWindow) {
    return outsideMainWindow;
  }

  // 右下 -> 左下 -> 左上 -> 右上
  const candidates = [
    { x: mouseX + PREVIEW_OFFSET, y: mouseY + PREVIEW_OFFSET },
    { x: mouseX - PREVIEW_OFFSET - width, y: mouseY + PREVIEW_OFFSET },
    { x: mouseX - PREVIEW_OFFSET - width, y: mouseY - PREVIEW_OFFSET - height },
    { x: mouseX + PREVIEW_OFFSET, y: mouseY - PREVIEW_OFFSET - height },
  ];

  const canFit = (x, y) =>
    x >= workLeft &&
    y >= workTop &&
    x + width <= workRight &&
    y + height <= workBottom;

  const matched = candidates.find((candidate) => canFit(candidate.x, candidate.y));
  const fallback = matched || candidates[0];

  return {
    left: clamp(fallback.x, workLeft, Math.max(workLeft, workRight - width)),
    top: clamp(fallback.y, workTop, Math.max(workTop, workBottom - height)),
  };
}

export function parseImageFilePath(content) {
  if (typeof content !== 'string' || !content.startsWith('files:')) {
    return '';
  }

  try {
    const filesData = JSON.parse(content.slice(6));
    const first = filesData?.files?.[0];
    if (!first) return '';
    return first.actual_path || first.path || '';
  } catch {
    return '';
  }
}

export function parseRawImagePath(content) {
  if (typeof content !== 'string') {
    return '';
  }
  const trimmed = content.trim();
  if (!trimmed || trimmed.startsWith('files:') || trimmed.startsWith('data:image/')) {
    return '';
  }
  return trimmed;
}

export function parseFirstImageId(imageId) {
  if (typeof imageId !== 'string' || !imageId.trim()) {
    return '';
  }
  return imageId
    .split(',')
    .map((part) => part.trim())
    .find((part) => part.length > 0) || '';
}

export function parseImageDimensionsFromItem(item) {
  const content = typeof item?.content === 'string' ? item.content : '';
  if (!content.startsWith('files:')) {
    return null;
  }

  try {
    const filesData = JSON.parse(content.slice(6));
    const first = filesData?.files?.[0];
    const width = Number(first?.width);
    const height = Number(first?.height);
    if (isFiniteNumber(width) && width > 0 && isFiniteNumber(height) && height > 0) {
      return { width, height };
    }
  } catch {
    return null;
  }

  return null;
}
