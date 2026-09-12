import {
  measureLineStats,
  measureNaturalWidth,
  prepareWithSegments,
} from '@chenglou/pretext';
import {
  HTML_MIN_WIDTH,
  TEXT_DEFAULT_HEIGHT,
  TEXT_MIN_HEIGHT,
  TEXT_MIN_WIDTH,
  clamp,
  isFiniteNumber,
} from './utils';

export const TEXT_PREVIEW_FONT = '14px Consolas, Menlo, "SFMono-Regular", "Liberation Mono", monospace';
export const HTML_PREVIEW_FONT = '14px Inter, Arial, sans-serif';
export const TEXT_PREVIEW_LINE_HEIGHT = 22.4;
export const HTML_PREVIEW_LINE_HEIGHT = 21;
export const TEXT_PREVIEW_CONTENT_HORIZONTAL_PADDING = 24;
export const TEXT_PREVIEW_VERTICAL_PADDING = 20;
export const HTML_PREVIEW_HORIZONTAL_PADDING = 24;
export const HTML_PREVIEW_VERTICAL_PADDING = 20;

const TEXT_SAMPLE_LIMIT = 18000;
const HTML_SAMPLE_LIMIT = 24000;
const TEXT_WIDTH_SAFETY = 10;
const HTML_WIDTH_SAFETY = 10;
export const PREVIEW_SURFACE_VERTICAL_BORDER_SIZE = 2;

function normalizeMaxWidth(maxWidth, minWidth) {
  const width = Number(maxWidth);
  return isFiniteNumber(width) && width > 0 ? Math.max(minWidth, Math.floor(width)) : 420;
}

function sampleText(value, limit) {
  const text = typeof value === 'string' ? value : '';
  if (text.length <= limit) {
    return { sample: text, ratio: 1 };
  }

  const newlineIndex = text.lastIndexOf('\n', limit);
  const end = newlineIndex > limit * 0.45 ? newlineIndex : limit;
  return {
    sample: text.slice(0, end),
    ratio: text.length / Math.max(1, end),
  };
}

function countHardLines(text) {
  let lines = 1;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code === 10) {
      lines += 1;
    } else if (code === 13) {
      lines += 1;
      if (text.charCodeAt(index + 1) === 10) {
        index += 1;
      }
    }
  }
  return lines;
}

function estimateLongestLineWidth(text) {
  let current = 0;
  let longest = 0;

  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code === 10 || code === 13) {
      longest = Math.max(longest, current);
      current = 0;
      if (code === 13 && text.charCodeAt(index + 1) === 10) {
        index += 1;
      }
    } else {
      current += 1;
    }
  }

  return Math.max(longest, current) * 8.1;
}

function fallbackSize(text, maxWidth, minWidth, lineHeight, horizontalPadding, verticalPadding, extraWidth = 0) {
  const { sample, ratio } = sampleText(text, TEXT_SAMPLE_LIMIT);
  const lines = Math.ceil(countHardLines(sample) * ratio);
  const width = Math.round(estimateLongestLineWidth(sample)) + horizontalPadding + extraWidth;
  return {
    width: clamp(width, minWidth, maxWidth),
    height: Math.max(
      TEXT_MIN_HEIGHT,
      Math.ceil(lines * lineHeight + verticalPadding) + PREVIEW_SURFACE_VERTICAL_BORDER_SIZE,
    ),
  };
}

function measureTextBlock({
  text,
  font,
  lineHeight,
  minWidth,
  maxWidth,
  horizontalPadding,
  verticalPadding,
  extraWidth = 0,
  ratio = 1,
}) {
  const contentMaxWidth = Math.max(1, maxWidth - horizontalPadding - extraWidth);

  try {
    const prepared = prepareWithSegments(text || ' ', font, { whiteSpace: 'pre-wrap' });
    const naturalWidth = measureNaturalWidth(prepared);
    const contentWidth = clamp(Math.ceil(naturalWidth), 1, contentMaxWidth);
    const stats = measureLineStats(prepared, contentWidth);
    const lineCount = Math.max(1, Math.ceil((stats.lineCount || 1) * ratio));
    const measuredWidth = Math.ceil(Math.max(stats.maxLineWidth || 0, contentWidth));

    return {
      width: clamp(measuredWidth + horizontalPadding + extraWidth, minWidth, maxWidth),
      height: Math.max(
        TEXT_DEFAULT_HEIGHT,
        Math.ceil(lineCount * lineHeight + verticalPadding) + PREVIEW_SURFACE_VERTICAL_BORDER_SIZE,
      ),
    };
  } catch (error) {
    console.warn('预览文本测量失败，使用估算尺寸:', error);
    return fallbackSize(text, maxWidth, minWidth, lineHeight, horizontalPadding, verticalPadding, extraWidth);
  }
}

export function measurePlainTextPreviewSize(text, options = {}) {
  const maxWidth = normalizeMaxWidth(options.maxWidth, TEXT_MIN_WIDTH);
  const { sample, ratio } = sampleText(text, TEXT_SAMPLE_LIMIT);

  return measureTextBlock({
    text: sample,
    font: TEXT_PREVIEW_FONT,
    lineHeight: TEXT_PREVIEW_LINE_HEIGHT,
    minWidth: TEXT_MIN_WIDTH,
    maxWidth,
    horizontalPadding: TEXT_PREVIEW_CONTENT_HORIZONTAL_PADDING,
    verticalPadding: TEXT_PREVIEW_VERTICAL_PADDING,
    extraWidth: TEXT_WIDTH_SAFETY,
    ratio,
  });
}

function extractHtmlText(html) {
  if (typeof DOMParser === 'undefined') {
    return String(html || '').replace(/<[^>]*>/g, ' ');
  }

  const doc = new DOMParser().parseFromString(html || '', 'text/html');
  doc.querySelectorAll('script, style, noscript, template').forEach((node) => node.remove());
  doc.querySelectorAll('br, p, div, li, tr, table, blockquote, pre, h1, h2, h3, h4, h5, h6')
    .forEach((node) => node.append('\n'));

  return (doc.body?.textContent || '')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n+ */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function measureHtmlPreviewSize(htmlContent, options = {}) {
  const maxWidth = normalizeMaxWidth(options.maxWidth, HTML_MIN_WIDTH);
  const htmlSample = sampleText(htmlContent, HTML_SAMPLE_LIMIT);
  const textSample = sampleText(extractHtmlText(htmlSample.sample), TEXT_SAMPLE_LIMIT);
  const baseSize = measureTextBlock({
    text: textSample.sample,
    font: HTML_PREVIEW_FONT,
    lineHeight: HTML_PREVIEW_LINE_HEIGHT,
    minWidth: HTML_MIN_WIDTH,
    maxWidth,
    horizontalPadding: HTML_PREVIEW_HORIZONTAL_PADDING,
    verticalPadding: HTML_PREVIEW_VERTICAL_PADDING,
    extraWidth: HTML_WIDTH_SAFETY,
    ratio: Math.max(htmlSample.ratio, textSample.ratio),
  });

  const imageCount = (htmlSample.sample.match(/<img\b/gi) || []).length;
  const hasTable = /<table\b/i.test(htmlSample.sample);
  return {
    width: clamp(
      Math.max(
        baseSize.width,
        imageCount > 0 ? 260 + HTML_PREVIEW_HORIZONTAL_PADDING : 0,
        hasTable ? 360 + HTML_PREVIEW_HORIZONTAL_PADDING : 0,
      ),
      HTML_MIN_WIDTH,
      maxWidth,
    ),
    height: baseSize.height + Math.min(220, imageCount * 72),
  };
}
