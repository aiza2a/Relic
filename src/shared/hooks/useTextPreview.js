import { useState, useRef, useEffect } from 'react';
import { getClipboardItemById, getFavoriteItemById } from '@shared/api';
import { getPrimaryType } from '@shared/utils/contentType';

// 文本预览
export function useTextPreview(item, contentType, formatTime, t, isFavorite = false, enabled = true) {
  const [previewTitle, setPreviewTitle] = useState('');
  const previewLoadedRef = useRef(false);
  const previewCacheRef = useRef('');

  useEffect(() => {
    if (!enabled) {
      setPreviewTitle('');
      previewLoadedRef.current = false;
      previewCacheRef.current = '';
    }
  }, [enabled]);

  const loadPreview = async () => {
    if (!enabled) {
      return;
    }

    if (previewCacheRef.current) {
      setPreviewTitle(previewCacheRef.current);
      return;
    }

    if (previewLoadedRef.current) {
      return;
    }

    const isTextType = getPrimaryType(contentType) === 'text' || 
                       getPrimaryType(contentType) === 'rich_text' ||
                       getPrimaryType(contentType) === 'link';
    
    if (!isTextType) {
      return;
    }

    try {
      const needsFullContent = item.content && item.content.includes('...(内容过长已截断)');
      const MAX_PREVIEW_LENGTH = 10000;
      
      let displayContent = item.content;
      let displayCharCount = item.char_count;
      let displayTitle = isFavorite ? item.title : null;
      
      if (needsFullContent) {
        const fullItem = isFavorite 
          ? await getFavoriteItemById(item.id, MAX_PREVIEW_LENGTH)
          : await getClipboardItemById(item.id, MAX_PREVIEW_LENGTH);
          
        if (fullItem) {
          displayContent = fullItem.content;
          displayCharCount = fullItem.char_count;
          if (isFavorite) {
            displayTitle = fullItem.title;
          }
        }
      }
      
      if (displayContent) {
        const parts = [];

        if (isFavorite && displayTitle) {
          parts.push(`【${t('common.title')}】${displayTitle}`);
        }

        parts.push(`【${t('common.type')}】${t(`contentType.${contentType}`, contentType)}`);

        if (displayCharCount != null) {
          parts.push(`【${t('common.chars')}】${displayCharCount.toLocaleString()}`);
        }

        if (!isFavorite && item.source_app) {
          parts.push(`【${t('common.source')}】${item.source_app}`);
        }

        parts.push(`【${t('common.time')}】${formatTime()}`);

        parts.push('─'.repeat(30));

        parts.push(displayContent);
        
        const preview = parts.join('\n');
        previewCacheRef.current = preview;
        setPreviewTitle(preview);
        previewLoadedRef.current = true;
      }
    } catch (error) {
      console.error('加载完整内容失败:', error);
    }
  };

  const clearPreview = () => {
    setPreviewTitle('');
  };

  return {
    previewTitle,
    loadPreview,
    clearPreview
  };
}
