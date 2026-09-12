import { getPrimaryType } from '@shared/utils/contentType';

export const FORMAT_KIND_TEXT = 'text';
export const FORMAT_KIND_HTML = 'html';
export const FORMAT_KIND_RTF = 'rtf';
export const FORMAT_KIND_IMAGE = 'image';
export const FORMAT_KIND_FILE = 'file';

export const PREVIEW_MODE_TEXT = 'text';
export const PREVIEW_MODE_HTML = 'html';
export const PREVIEW_MODE_IMAGE = 'image';
export const PREVIEW_MODE_FILE = 'file';

const FORMAT_KIND_ORDER = [
  FORMAT_KIND_TEXT,
  FORMAT_KIND_HTML,
  FORMAT_KIND_RTF,
  FORMAT_KIND_IMAGE,
  FORMAT_KIND_FILE,
];

const PREVIEW_MODE_ORDER = [
  PREVIEW_MODE_TEXT,
  PREVIEW_MODE_HTML,
  PREVIEW_MODE_IMAGE,
  PREVIEW_MODE_FILE,
];

const PASTE_OPTION_KIND_TO_FORMAT_KIND = {
  plain_text: FORMAT_KIND_TEXT,
  html: FORMAT_KIND_HTML,
  rtf: FORMAT_KIND_RTF,
  image_bundle: FORMAT_KIND_IMAGE,
  file: FORMAT_KIND_FILE,
};

function hasType(contentType, target) {
  return String(contentType || '')
    .split(',')
    .some((part) => part.trim() === target);
}

function inferFormatKindsFromItem(item) {
  const inferred = new Set();
  const contentType = String(item?.content_type || '');
  const primaryType = getPrimaryType(contentType);
  const plainText = typeof item?.content === 'string' ? item.content : '';
  const htmlContent = typeof item?.html_content === 'string' ? item.html_content : '';

  if (
    primaryType === 'text' ||
    primaryType === 'rich_text' ||
    primaryType === 'link' ||
    (plainText.trim() && !plainText.startsWith('files:'))
  ) {
    inferred.add(FORMAT_KIND_TEXT);
  }

  if (htmlContent.trim()) {
    inferred.add(FORMAT_KIND_HTML);
  }

  if (primaryType === 'image' || hasType(contentType, 'image')) {
    inferred.add(FORMAT_KIND_IMAGE);
  }

  if (primaryType === 'file' || hasType(contentType, 'file')) {
    inferred.add(FORMAT_KIND_FILE);
  }

  return inferred;
}

export function extractFormatKinds(pasteOptions = [], item = null) {
  const kinds = new Set();

  if (Array.isArray(pasteOptions)) {
    pasteOptions.forEach((option) => {
      const optionKind = String(option?.kind || '');
      if (optionKind === 'all_formats') {
        return;
      }
      const mapped = PASTE_OPTION_KIND_TO_FORMAT_KIND[optionKind];
      if (mapped) {
        kinds.add(mapped);
      }
    });
  }

  if (kinds.size === 0 && item) {
    inferFormatKindsFromItem(item).forEach((kind) => {
      kinds.add(kind);
    });
  }

  return FORMAT_KIND_ORDER.filter((kind) => kinds.has(kind));
}

export function getFormatKindLabel(kind, t) {
  switch (kind) {
    case FORMAT_KIND_TEXT:
      return t('previewWindow.formatText', '纯文本');
    case FORMAT_KIND_HTML:
      return t('previewWindow.formatHtml', 'HTML');
    case FORMAT_KIND_RTF:
      return t('previewWindow.formatRtf', 'RTF');
    case FORMAT_KIND_IMAGE:
      return t('previewWindow.formatImage', '图片');
    case FORMAT_KIND_FILE:
      return t('previewWindow.formatFile', '文件');
    default:
      return kind;
  }
}

export function formatKindsToLabels(formatKinds = [], t) {
  return formatKinds
    .map((kind) => getFormatKindLabel(kind, t))
    .filter((label) => typeof label === 'string' && label.trim().length > 0);
}

export function resolvePreviewModes(item, formatKinds = []) {
  if (!item) {
    return [];
  }

  const modes = new Set();
  const kinds = new Set(formatKinds);
  const contentType = String(item?.content_type || '');
  const primaryType = getPrimaryType(contentType);
  const hasHtml = typeof item?.html_content === 'string' && item.html_content.trim().length > 0;
  const hasMeaningfulText =
    typeof item?.content === 'string' &&
    item.content.trim().length > 0 &&
    !item.content.startsWith('files:');

  if (kinds.has(FORMAT_KIND_TEXT) || kinds.has(FORMAT_KIND_RTF) || hasMeaningfulText) {
    modes.add(PREVIEW_MODE_TEXT);
  }

  if (kinds.has(FORMAT_KIND_HTML) && hasHtml) {
    modes.add(PREVIEW_MODE_HTML);
  }

  if (kinds.has(FORMAT_KIND_IMAGE) || primaryType === 'image' || hasType(contentType, 'image')) {
    modes.add(PREVIEW_MODE_IMAGE);
  }

  if (kinds.has(FORMAT_KIND_FILE) || primaryType === 'file' || hasType(contentType, 'file')) {
    modes.add(PREVIEW_MODE_FILE);
  }

  if (modes.size === 0) {
    if (primaryType === 'image') {
      modes.add(PREVIEW_MODE_IMAGE);
    } else if (primaryType === 'file') {
      modes.add(PREVIEW_MODE_FILE);
    } else {
      modes.add(PREVIEW_MODE_TEXT);
    }
  }

  return PREVIEW_MODE_ORDER.filter((mode) => modes.has(mode));
}
