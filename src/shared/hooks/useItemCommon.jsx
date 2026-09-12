import { useSnapshot } from 'valtio';
import { settingsStore } from '@shared/store';
import { clipboardStore } from '@shared/store/clipboardStore';
import { favoritesStore } from '@shared/store/favoritesStore';
import { TextContent, ImageContent, FileContent, HtmlContent } from '@windows/main/components/ClipboardContent';
import { getPrimaryType, hasType } from '@shared/utils/contentType';
import {
  DISPLAY_FORMAT_TEXT,
  DISPLAY_FORMAT_HTML,
  DISPLAY_FORMAT_IMAGE,
  resolveDisplayFormatByPriority,
} from '@shared/utils/displayFormatPriority';

// 行高配置常量
export const ROW_HEIGHT_CONFIG = {
  auto: { px: 90, cardPx: 90, class: '', cardClass: '', itemClass: 'min-h-[50px]', lineClamp: 'line-clamp-none', lineClampWithTitle: 'line-clamp-none' },
  large: { px: 120, cardPx: 120, class: 'h-[120px]', cardClass: 'h-[120px]', itemClass: 'h-full', lineClamp: 'line-clamp-4', lineClampWithTitle: 'line-clamp-3' },
  medium: { px: 90, cardPx: 90, class: 'h-[90px]', cardClass: 'h-[90px]', itemClass: 'h-full', lineClamp: 'line-clamp-3', lineClampWithTitle: 'line-clamp-2' },
  small: { px: 50, cardPx: 50, class: 'h-[50px]', cardClass: 'h-[50px]', itemClass: 'h-full', lineClamp: 'line-clamp-2', lineClampWithTitle: 'line-clamp-2' },
  xsmall: { px: 34, cardPx: 34, class: 'h-[34px]', cardClass: 'h-[34px]', itemClass: 'h-full', lineClamp: 'line-clamp-1', lineClampWithTitle: 'line-clamp-1' }
};

const DEFAULT_AUTO_ROW_MAX_LINES = 18;
const AUTO_ROW_LINE_HEIGHT_PX = 20;

function normalizeAutoRowMaxLines(value) {
  const lines = Math.round(Number(value));
  if (!Number.isFinite(lines)) {
    return DEFAULT_AUTO_ROW_MAX_LINES;
  }
  return Math.min(20, Math.max(1, lines));
}

function matchesFilterType(contentType, filterType) {
  if (!contentType || !filterType || filterType === 'all') {
    return false;
  }

  if (filterType === 'text') {
    return hasType(contentType, 'text') || hasType(contentType, 'rich_text') || hasType(contentType, 'link');
  }

  return hasType(contentType, filterType) || getPrimaryType(contentType) === filterType;
}

function resolveRenderType(contentType, activeFilterType) {
  const primaryType = getPrimaryType(contentType);
  const normalizedFilterType = String(activeFilterType || '').trim();

  if (!normalizedFilterType || normalizedFilterType === 'all') {
    return primaryType;
  }

  if ((normalizedFilterType === 'image' || normalizedFilterType === 'file')
    && matchesFilterType(contentType, normalizedFilterType)) {
    return normalizedFilterType;
  }

  return primaryType;
}

// 剪贴板和收藏项的共同逻辑
export function useItemCommon(item, options = {}) {
  const settings = useSnapshot(settingsStore);
  const clipSnap = useSnapshot(clipboardStore);
  const favSnap = useSnapshot(favoritesStore);
  const rowConfig = ROW_HEIGHT_CONFIG[settings.rowHeight] || ROW_HEIGHT_CONFIG.medium;

  const searchKeyword = options.searchKeyword ?? ((options.isFavorite ? favSnap.filter : clipSnap.filter) || '');

  // 获取固定行高
  const getHeightClass = () => rowConfig.itemClass;

  // 获取文本行数限制
  const getLineClampClass = (hasTitle = false) => {
    if (hasTitle && (settings.rowHeight === 'large' || settings.rowHeight === 'medium')) {
      return rowConfig.lineClampWithTitle;
    }
    return rowConfig.lineClamp;
  };

  // 获取内容类型
  const contentType = item.content_type || item.type || 'text';
  const activeFilterType = options.activeFilterType ?? ((options.isFavorite ? favSnap.contentType : clipSnap.contentType) || 'all');
  const renderType = resolveRenderType(contentType, activeFilterType);

  // 格式化时间
  const formatTime = () => {
    const timestamp = item.created_at || item.timestamp;
    if (!timestamp) return '';
    const date = new Date(timestamp * 1000);
    const now = new Date();

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const oneWeekAgo = new Date(today);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const recordDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const timeFormat = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    let timeStr = '';

    // 今天
    if (recordDate.getTime() === today.getTime()) {
      timeStr = `今天 ${timeFormat}`;
    }
    // 昨天
    else if (recordDate.getTime() === yesterday.getTime()) {
      timeStr = `昨天 ${timeFormat}`;
    }
    // 一周内
    else if (recordDate >= oneWeekAgo) {
      const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      timeStr = `${days[date.getDay()]} ${timeFormat}`;
    }
    // 更早的日期
    else {
      timeStr = `${date.getMonth() + 1}/${date.getDate()} ${timeFormat}`;
    }

    // 如果是文件类型，添加文件数量
    if (getPrimaryType(contentType) === 'file') {
      try {
        if (item.content?.startsWith('files:')) {
          const filesData = JSON.parse(item.content.substring(6));
          const fileCount = filesData.files?.length || 0;
          timeStr += ` • ${fileCount} 个文件`;
        }
      } catch (e) {
        // 解析失败，只显示时间
      }
    }
    return timeStr;
  };

  // 渲染内容组件
  const renderContent = (compact = false, hasTitle = false, layout = {}) => {
    const disableExternalDrag = Boolean(layout?.disableExternalDrag);
    const disableExternalTooltip = Boolean(layout?.disableExternalTooltip);
    const lineClampClass = getLineClampClass(hasTitle);
    const primaryType = renderType;
    const rowHeight = settings.rowHeight;
    const clampLines = (() => {
      const m = String(lineClampClass).match(/line-clamp-(\d+)/);
      return m ? parseInt(m[1], 10) : null;
    })();
    const textLayout = {
      availableHeightPx: layout?.availableHeightPx,
      clampLines,
      autoRowMaxLines: normalizeAutoRowMaxLines(settings.autoRowMaxLines)
    };
    const autoRowMaxContentHeightPx = rowHeight === 'auto'
      ? textLayout.autoRowMaxLines * AUTO_ROW_LINE_HEIGHT_PX
      : undefined;

    // 图片类型
    if (primaryType === 'image') {
      return <ImageContent item={item} maxContentHeightPx={autoRowMaxContentHeightPx} disableExternalDrag={disableExternalDrag} disableExternalTooltip={disableExternalTooltip} />;
    }

    // 文件类型
    if (primaryType === 'file') {
      return <FileContent item={item} compact={compact} searchKeyword={searchKeyword} maxContentHeightPx={autoRowMaxContentHeightPx} disableExternalDrag={disableExternalDrag} disableExternalTooltip={disableExternalTooltip} />;
    }

    const displayFormat = searchKeyword
      ? DISPLAY_FORMAT_TEXT
      : resolveDisplayFormatByPriority(item, settings.displayPriorityOrder);

    if (displayFormat === DISPLAY_FORMAT_IMAGE) {
      return <ImageContent item={item} maxContentHeightPx={autoRowMaxContentHeightPx} disableExternalDrag={disableExternalDrag} disableExternalTooltip={disableExternalTooltip} />;
    }

    if (displayFormat === DISPLAY_FORMAT_HTML && item.html_content) {
      return <HtmlContent htmlContent={item.html_content} lineClampClass={lineClampClass} searchKeyword={searchKeyword} compact={compact} rowHeight={rowHeight} autoRowMaxLines={textLayout.autoRowMaxLines} maxContentHeightPx={autoRowMaxContentHeightPx} />;
    }

    return <TextContent content={item.content || ''} lineClampClass={lineClampClass} searchKeyword={searchKeyword} compact={compact} rowHeight={rowHeight} item={item} source={options.isFavorite ? 'favorite' : 'clipboard'} {...textLayout} />;
  };
  return {
    settings,
    getHeightClass,
    getLineClampClass,
    contentType,
    renderType,
    formatTime,
    renderContent,
    searchKeyword
  };
}
