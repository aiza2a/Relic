import { getPrimaryType, hasType } from '@shared/utils/contentType';

export const DISPLAY_FORMAT_TEXT = 'text';
export const DISPLAY_FORMAT_HTML = 'html';
export const DISPLAY_FORMAT_IMAGE = 'image';

export const DISPLAY_PRIORITY_DEFAULT_ORDER = [
  DISPLAY_FORMAT_TEXT,
  DISPLAY_FORMAT_HTML,
  DISPLAY_FORMAT_IMAGE,
];

export const DISPLAY_PRIORITY_DEFAULT_VALUE = DISPLAY_PRIORITY_DEFAULT_ORDER.join(',');

const DISPLAY_FORMAT_SET = new Set(DISPLAY_PRIORITY_DEFAULT_ORDER);

function parseDisplayPriorityTokens(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    return value
      .split(/[,\s>]+/)
      .map((token) => token.trim())
      .filter(Boolean);
  }

  return [];
}

export function normalizeDisplayPriorityOrder(value) {
  const parsed = parseDisplayPriorityTokens(value);
  const normalized = [];

  parsed.forEach((token) => {
    const key = String(token || '').trim().toLowerCase();
    if (!DISPLAY_FORMAT_SET.has(key)) return;
    if (normalized.includes(key)) return;
    normalized.push(key);
  });

  DISPLAY_PRIORITY_DEFAULT_ORDER.forEach((key) => {
    if (!normalized.includes(key)) {
      normalized.push(key);
    }
  });

  return normalized;
}

export function normalizeDisplayPriorityValue(value) {
  return normalizeDisplayPriorityOrder(value).join(',');
}

function hasMeaningfulText(item) {
  const content = typeof item?.content === 'string' ? item.content : '';
  if (!content.trim()) return false;
  return !content.startsWith('files:');
}

function hasMeaningfulHtml(item) {
  const html = typeof item?.html_content === 'string' ? item.html_content : '';
  return html.trim().length > 0;
}

function hasImageFormat(item) {
  const contentType = String(item?.content_type || item?.type || '');
  const primaryType = getPrimaryType(contentType);
  return primaryType === 'image' || hasType(contentType, 'image');
}

export function resolveDisplayFormatByPriority(item, displayPriority) {
  const availableFormats = new Set();
  if (hasMeaningfulText(item)) {
    availableFormats.add(DISPLAY_FORMAT_TEXT);
  }
  if (hasMeaningfulHtml(item)) {
    availableFormats.add(DISPLAY_FORMAT_HTML);
  }
  if (hasImageFormat(item)) {
    availableFormats.add(DISPLAY_FORMAT_IMAGE);
  }

  const order = normalizeDisplayPriorityOrder(displayPriority);
  for (const format of order) {
    if (availableFormats.has(format)) {
      return format;
    }
  }

  if (availableFormats.has(DISPLAY_FORMAT_TEXT)) return DISPLAY_FORMAT_TEXT;
  if (availableFormats.has(DISPLAY_FORMAT_HTML)) return DISPLAY_FORMAT_HTML;
  if (availableFormats.has(DISPLAY_FORMAT_IMAGE)) return DISPLAY_FORMAT_IMAGE;
  return DISPLAY_FORMAT_TEXT;
}
