import { useState, useEffect, useRef } from 'react';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import { useSnapshot } from 'valtio';
import { settingsStore } from '@shared/store/settingsStore';
import { formatFileSize } from '@shared/utils/format';
import Tooltip from '@shared/components/common/Tooltip.jsx';

function parseFirstImageId(imageId) {
  if (typeof imageId !== 'string' || !imageId.trim()) {
    return '';
  }

  return imageId
    .split(',')
    .map((part) => part.trim())
    .find((part) => part.length > 0) || '';
}

function ImageContent({ item, maxContentHeightPx }) {
  const settings = useSnapshot(settingsStore);
  const isAutoHeight = settings.rowHeight === 'auto';
  const isXSmallHeight = settings.rowHeight === 'xsmall';
  const maxSizeMb = settings.imageMaxSizeMb || 15;
  const maxWidth = settings.imageMaxWidth || 4096;
  const maxHeight = settings.imageMaxHeight || 4096;
  const maxSizeBytes = maxSizeMb * 1024 * 1024;
  const autoMaxHeight = Number.isFinite(Number(maxContentHeightPx))
    ? Number(maxContentHeightPx)
    : 280;

  const { t } = useTranslation();

  const [imageSrc, setImageSrc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [fileExists, setFileExists] = useState(true);
  const [isOversized, setIsOversized] = useState(false);
  const [fileSize, setFileSize] = useState(null);
  const [fileName, setFileName] = useState(null);
  const [imageDimensions, setImageDimensions] = useState(null);
  const [retryToken, setRetryToken] = useState(0);
  const retryTimerRef = useRef(null);
  const imagePathRef = useRef(null);
  const imageElementRef = useRef(null);

  useEffect(() => {
    let disposed = false;

    const loadImage = async () => {
      try {
        setLoading(true);
        setError(false);
        setImageSrc(null);
        setFileExists(true);
        setIsOversized(false);
        setFileSize(null);
        setFileName(null);
        setImageDimensions(null);

        if (item.content?.startsWith('data:image/')) {
          if (!disposed) {
            setImageSrc(item.content);
          }
          return;
        }

        if (item.content?.startsWith('files:')) {
          const filesData = JSON.parse(item.content.substring(6));
          if (filesData.files && filesData.files.length > 0) {
            const file = filesData.files[0];
            const exists = file.exists !== false;
            const actualPath = file.actual_path || file.path;
            const size = file.size || 0;
            const name = file.name || actualPath.split(/[/\\]/).pop();

            imagePathRef.current = actualPath;
            if (disposed) {
              return;
            }

            setFileExists(exists);
            setFileSize(size);
            setFileName(name);

            if (exists) {
              const imgWidth = file.width || 0;
              const imgHeight = file.height || 0;
              const isSizeOversized = size > maxSizeBytes;
              const isDimensionOversized = (imgWidth > maxWidth || imgHeight > maxHeight) && imgWidth > 0 && imgHeight > 0;

              if (imgWidth > 0 && imgHeight > 0) {
                setImageDimensions({ width: imgWidth, height: imgHeight });
              }

              if (isSizeOversized || isDimensionOversized) {
                setIsOversized(true);
              } else {
                const assetUrl = convertFileSrc(actualPath, 'asset');
                setImageSrc(assetUrl);
              }
            }
            return;
          }
        }

        const imageId = parseFirstImageId(item.image_id);
        if (imageId) {
          const dataDir = await invoke('get_data_directory');
          if (disposed) {
            return;
          }

          const normalizedDataDir = String(dataDir).replace(/\\/g, '/');
          const filePath = `${normalizedDataDir}/clipboard_images/${imageId}.png`;
          imagePathRef.current = filePath;
          setFileName(`${imageId}.png`);
          setImageSrc(`${convertFileSrc(filePath, 'asset')}?retry=${retryToken}`);
          return;
        }

        if (!disposed) {
          setError(true);
        }
      } catch (err) {
        if (!disposed) {
          console.error('加载图片失败:', err);
          setError(true);
        }
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }
    };

    loadImage();

    return () => {
      disposed = true;
      imagePathRef.current = null;
      if (imageElementRef.current) {
        // 主动断开图片资源引用，尽量让 WebView 更早释放解码缓存。
        imageElementRef.current.src = '';
      }
    };
  }, [item.id, item.content, item.image_id, retryToken]);

  useEffect(() => {
    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, []);

  const scheduleLocalImageRetry = () => {
    if (!parseFirstImageId(item.image_id)) {
      setError(true);
      return;
    }
    if (retryTimerRef.current) {
      return;
    }
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      setRetryToken((value) => value + 1);
    }, 2000);
    setError(true);
  };

  const autoContainerStyle = isAutoHeight ? { maxHeight: `${autoMaxHeight}px` } : undefined;

  if (loading) {
    return <div className={`w-full ${isXSmallHeight ? 'h-full px-2' : 'min-h-[80px]'} bg-qc-panel-2 rounded flex items-center justify-center overflow-hidden`} style={autoContainerStyle}>
      <span className="text-sm text-qc-fg-muted">加载中...</span>
    </div>;
  }
  if (error) {
    return <div className={`w-full ${isXSmallHeight ? 'h-full px-2' : 'min-h-[80px]'} bg-red-50 rounded flex items-center justify-center overflow-hidden`} style={autoContainerStyle}>
      <span className="text-sm text-red-500">{t('clipboard.imageLoadFailed', '图片加载失败')}</span>
    </div>;
  }
  if (isOversized || !fileExists) {
    const statusText = !fileExists
      ? t('clipboard.fileNotFound', '文件不存在')
      : t('clipboard.imageTooLarge', '图片过大');
    const sizeText = !fileExists
      ? null
      : `${formatFileSize(fileSize)} / ${maxSizeMb} MB ${t('clipboard.maxLimit', '上限')}`;
    const dimensionText = !fileExists || !imageDimensions
      ? null
      : `${imageDimensions.width} × ${imageDimensions.height}`;

    const colorClasses = !fileExists
      ? 'from-red-50 to-red-50 border-red-300/60'
      : 'from-amber-50 to-orange-50 border-amber-200/60';
    const iconColorClass = !fileExists ? 'text-red-400' : 'text-amber-400';
    const textColorClass = !fileExists ? 'text-red-600' : 'text-amber-600';
    const subTextColorClass = !fileExists ? 'text-red-500/70' : 'text-amber-500/70';
    const badgeColorClass = !fileExists ? 'bg-red-500' : 'bg-amber-500';
    const iconName = !fileExists ? 'ti-photo-off' : 'ti-photo';
    const badgeIcon = !fileExists ? 'ti-x' : 'ti-alert-triangle';

    if (isXSmallHeight) {
      const summaryText = [statusText, dimensionText, fileSize ? formatFileSize(fileSize) : null]
        .filter(Boolean)
        .join(' · ');

      return (
        <div
          className={`w-full h-full rounded overflow-hidden flex items-center gap-2 px-2 bg-gradient-to-br ${colorClasses} border ${!fileExists ? 'opacity-60' : ''}`}
        >
          <div className="relative flex-shrink-0">
            <i className={`ti ${iconName} text-base ${iconColorClass}`} />
            <div className={`absolute -bottom-0.5 -right-0.5 ${badgeColorClass} rounded-full w-3 h-3 flex items-center justify-center`}>
              <i className={`ti ${badgeIcon} text-white`} style={{ fontSize: 7 }} />
            </div>
          </div>
          <div className="min-w-0 flex-1 flex items-center gap-1.5 text-xs overflow-hidden">
            <Tooltip content={fileName || statusText} placement="top" asChild>
              <span className={`truncate font-medium ${textColorClass} ${!fileExists ? 'line-through' : ''}`}>
                {fileName || statusText}
              </span>
            </Tooltip>
            {summaryText ? (
              <span className={`truncate ${subTextColorClass}`}>
                {summaryText}
              </span>
            ) : null}
          </div>
        </div>
      );
    }

    return (
      <div
        className={`w-full h-full rounded overflow-hidden flex items-center bg-gradient-to-br ${colorClasses} border ${isAutoHeight ? 'justify-center py-4' : 'justify-start px-3 gap-3'} ${!fileExists ? 'opacity-60' : ''}`}
        style={autoContainerStyle}
      >
        {isAutoHeight ? (
          <div className="flex flex-col items-center justify-center gap-2">
            <div className="relative">
              <i className={`ti ${iconName} text-4xl ${iconColorClass}`} />
              <div className={`absolute -bottom-1 -right-1 ${badgeColorClass} rounded-full w-4 h-4 flex items-center justify-center`}>
                <i className={`ti ${badgeIcon} text-white text-xs`} />
              </div>
            </div>
            <div className="text-center max-w-full px-4">
              <p className={`text-sm font-medium ${textColorClass}`}>
                {statusText}
              </p>
              <Tooltip content={fileName} placement="top" asChild>
                <p className={`text-xs ${subTextColorClass} mt-0.5 truncate`}>
                  {fileName}
                </p>
              </Tooltip>
              {(sizeText || dimensionText) && (
                <p className={`text-xs ${subTextColorClass} opacity-80 mt-0.5`}>
                  {[dimensionText, sizeText].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="relative flex-shrink-0">
              <i className={`ti ${iconName} text-2xl ${iconColorClass}`} />
              <div className={`absolute -bottom-0.5 -right-0.5 ${badgeColorClass} rounded-full w-3 h-3 flex items-center justify-center`}>
                <i className={`ti ${badgeIcon} text-white`} style={{ fontSize: 8 }} />
              </div>
            </div>
            <div className="flex flex-col min-w-0">
              <Tooltip content={fileName} placement="top" asChild>
                <p className={`text-sm ${textColorClass} truncate ${!fileExists ? 'line-through' : ''}`}>
                  {fileName}
                </p>
              </Tooltip>
              <p className={`text-xs ${subTextColorClass} truncate`}>
                {statusText}{dimensionText ? ` · ${dimensionText}` : ''}{sizeText ? ` · ${formatFileSize(fileSize)}` : ''}
              </p>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div
      className={`w-full rounded overflow-hidden flex items-center justify-start bg-transparent ${isAutoHeight ? '' : 'h-full'}`}
      style={{
        contentVisibility: 'auto',
        containIntrinsicSize: '256px',
        ...(autoContainerStyle || {})
      }}
    >
      <img
        ref={imageElementRef}
        src={imageSrc}
        alt="剪贴板图片"
        className={`max-w-full object-contain pointer-events-none ${isAutoHeight ? '' : 'max-h-full'}`}
        style={isAutoHeight ? { maxHeight: `${autoMaxHeight}px` } : undefined}
        loading="lazy"
        decoding="async"
        onError={scheduleLocalImageRetry}
      />
    </div>
  );
}

export default ImageContent;
