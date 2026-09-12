function ImagePreview({ imageUrl, imageLoadState, onLoad, onError }) {
  return (
    <div className="w-full h-full overflow-visible flex items-start justify-start">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt="图片预览"
          className="preview-image-content w-full h-full object-contain select-none pointer-events-none block"
          onLoad={onLoad}
          onError={onError}
          style={{
            objectPosition: 'left top',
            filter: 'drop-shadow(0 0 5px rgba(0, 0, 0, 0.3)) drop-shadow(0 0 3px rgba(0, 0, 0, 0.2))',
          }}
        />
      ) : imageLoadState === 'error' ? (
        <div className="preview-image-error text-xs text-qc-fg-muted bg-qc-panel/80 rounded px-2 py-1 inline-block">
          图片不可用
        </div>
      ) : (
        <div className="w-full h-full" />
      )}
    </div>
  );
}

export default ImagePreview;
