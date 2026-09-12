import { convertFileSrc } from '@tauri-apps/api/core';

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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getImagePreviewCardSize(image, options = {}) {
  const sourceWidth = image.naturalWidth || image.width || 1;
  const sourceHeight = image.naturalHeight || image.height || 1;
  const maxLongSide = options.maxLongSide || 82;
  const minShortSide = options.minShortSide || 48;
  const maxRatio = options.maxRatio || 1.75;
  const ratio = clamp(sourceWidth / sourceHeight, 1 / maxRatio, maxRatio);

  if (ratio >= 1) {
    const height = Math.max(minShortSide, Math.round(maxLongSide / ratio));
    return {
      width: Math.round(height * ratio),
      height,
      radius: Math.min(14, Math.max(10, Math.round(height * 0.2))),
    };
  }

  const width = Math.max(minShortSide, Math.round(maxLongSide * ratio));
  return {
    width,
    height: Math.round(width / ratio),
    radius: Math.min(14, Math.max(10, Math.round(width * 0.2))),
  };
}

async function loadImageForDragPreview(path) {
  if (!path) {
    throw new Error('拖拽预览图片路径为空');
  }

  const source = String(path);
  const isInlineImage = source.startsWith('data:image/') || source.startsWith('blob:');
  const imageUrl = isInlineImage ? source : convertFileSrc(source, 'asset');
  const objectUrl = isInlineImage ? '' : await fetch(imageUrl)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`读取拖拽预览图片失败: ${response.status}`);
      }
      return response.blob();
    })
    .then((blob) => URL.createObjectURL(blob));

  try {
    const image = new Image();
    image.decoding = 'async';
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('加载拖拽预览图片失败'));
      image.src = objectUrl || imageUrl;
    });
    return image;
  } finally {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  }
}

function drawTablerPath(ctx, path, x, y, size) {
  if (typeof Path2D !== 'function') return false;
  try {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size / 24, size / 24);
    ctx.stroke(new Path2D(path));
    ctx.restore();
    return true;
  } catch {
    ctx.restore();
    return false;
  }
}

function getDragPreviewSize(count) {
  return count > 1
    ? { width: 84, height: 72 }
    : { width: 68, height: 68 };
}

export async function createImageDragPreviewIcon(path) {
  try {
    const image = await loadImageForDragPreview(path);

    const card = getImagePreviewCardSize(image);
    const width = card.width + 14;
    const height = card.height + 14;
    const cardX = 7;
    const cardY = 5;
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
    drawRoundRect(ctx, cardX, cardY, card.width, card.height, card.radius);
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.save();
    ctx.beginPath();
    drawRoundRect(ctx, cardX, cardY, card.width, card.height, card.radius);
    ctx.clip();
    drawObjectCoverImage(ctx, image, cardX, cardY, card.width, card.height);
    ctx.restore();

    ctx.strokeStyle = 'rgba(47, 123, 255, 0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    drawRoundRect(ctx, cardX + 1, cardY + 1, card.width - 2, card.height - 2, Math.max(8, card.radius - 1));
    ctx.stroke();

    return canvas.toDataURL('image/png');
  } catch {
    return path;
  }
}

export async function createImagesDragPreviewIcon(paths) {
  const imagePaths = Array.isArray(paths) ? paths.filter(Boolean) : [paths].filter(Boolean);
  if (imagePaths.length <= 1) {
    return createImageDragPreviewIcon(imagePaths[0]);
  }

  try {
    const image = await loadImageForDragPreview(imagePaths[0]);
    const card = getImagePreviewCardSize(image, {
      maxLongSide: 68,
      minShortSide: 44,
      maxRatio: 1.65,
    });
    const stackOffsetX = 9;
    const stackOffsetY = 6;
    const frontX = 6;
    const frontY = 5;
    const width = card.width + stackOffsetX * 2 + 26;
    const height = card.height + stackOffsetY * 2 + 18;
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
      drawRoundRect(ctx, x, y, card.width, card.height, card.radius);
      ctx.fill();

      ctx.shadowColor = 'transparent';
      if (withImage) {
        ctx.save();
        ctx.beginPath();
        drawRoundRect(ctx, x, y, card.width, card.height, card.radius);
        ctx.clip();
        drawObjectCoverImage(ctx, image, x, y, card.width, card.height);
        ctx.restore();
      }

      ctx.strokeStyle = withImage ? 'rgba(47, 123, 255, 0.7)' : 'rgba(148, 163, 184, 0.45)';
      ctx.lineWidth = withImage ? 2 : 1.5;
      ctx.beginPath();
      drawRoundRect(ctx, x + 1, y + 1, card.width - 2, card.height - 2, Math.max(8, card.radius - 1));
      ctx.stroke();
      ctx.restore();
    };

    drawCard(frontX + stackOffsetX * 2, frontY + stackOffsetY * 2, 0.72, false);
    drawCard(frontX + stackOffsetX, frontY + stackOffsetY, 0.86, false);
    drawCard(frontX, frontY, 1, true);

    const label = imagePaths.length > 99 ? '99+' : String(imagePaths.length);
    ctx.font = '700 12px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    const badgeWidth = Math.max(24, Math.ceil(ctx.measureText(label).width) + 12);
    const badgeX = Math.min(width - badgeWidth - 4, frontX + card.width + 7);
    ctx.shadowColor = 'rgba(15, 23, 42, 0.24)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = '#2563eb';
    ctx.beginPath();
    drawRoundRect(ctx, badgeX, 4, badgeWidth, 22, 11);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, badgeX + badgeWidth / 2, 15);

    return canvas.toDataURL('image/png');
  } catch {
    return imagePaths[0] || '';
  }
}

export function createDragPreviewIcon(icon, count, mode, labels = { copy: 'Copy', move: 'Move' }) {
  try {
    const canvas = document.createElement('canvas');
    const { width, height } = getDragPreviewSize(count);
    const ratio = window.devicePixelRatio || 1;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const ctx = canvas.getContext('2d');
    if (!ctx) return icon;
    ctx.scale(ratio, ratio);

    const drawFallbackFile = (x, y, alpha, size = 25) => {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(47, 123, 255, 0.1)';
      ctx.strokeStyle = 'rgba(47, 123, 255, 0.55)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      drawRoundRect(ctx, x, y, size, size + 6, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(47, 123, 255, 0.2)';
      ctx.beginPath();
      ctx.moveTo(x + size - 8, y);
      ctx.lineTo(x + size, y + 8);
      ctx.lineTo(x + size - 8, y + 8);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    };

    const drawFileCard = (x, y, alpha) => {
      ctx.globalAlpha = alpha;
      ctx.shadowColor = 'rgba(15, 23, 42, 0.16)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 3;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
      ctx.strokeStyle = 'rgba(47, 123, 255, 0.18)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      drawRoundRect(ctx, x, y, 46, 54, 9);
      ctx.fill();
      ctx.stroke();
      ctx.shadowColor = 'transparent';

      ctx.fillStyle = 'rgba(47, 123, 255, 0.08)';
      ctx.beginPath();
      drawRoundRect(ctx, x + 7, y + 36, 32, 4, 2);
      ctx.fill();
      ctx.beginPath();
      drawRoundRect(ctx, x + 7, y + 44, 24, 4, 2);
      ctx.fill();

      const iconSize = 26;
      const iconX = x + 10;
      const iconY = y + 9;
      if (icon?.startsWith('data:image/')) {
        const image = new Image();
        image.src = icon;
        if (image.complete) {
          ctx.drawImage(image, iconX, iconY, iconSize, iconSize);
        } else {
          drawFallbackFile(iconX, iconY - 1, 1, 23);
        }
      } else {
        drawFallbackFile(iconX, iconY - 1, 1, 23);
      }
      ctx.globalAlpha = 1;
    };

    const drawActionBadge = (x, y) => {
      const label = mode === 'move' ? labels.move : labels.copy;
      const badgeWidth = label.length > 2 ? 46 : 40;
      const badgeHeight = 19;
      ctx.fillStyle = mode === 'move' ? '#16a34a' : '#2f7bff';
      ctx.beginPath();
      drawRoundRect(ctx, x, y, badgeWidth, badgeHeight, badgeHeight / 2);
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.7;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      if (mode === 'move') {
        const drawn = drawTablerPath(ctx, 'M5 12l14 0M13 18l6 -6M13 6l6 6', x + 3.5, y + 3.5, 12);
        if (!drawn) {
          const iconX = x + 8;
          const iconY = y + badgeHeight / 2;
          ctx.moveTo(iconX - 3, iconY);
          ctx.lineTo(iconX + 4, iconY);
          ctx.moveTo(iconX + 1, iconY - 3);
          ctx.lineTo(iconX + 4, iconY);
          ctx.lineTo(iconX + 1, iconY + 3);
          ctx.stroke();
        }
      } else {
        const copied = [
          'M7 7m0 2.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667z',
          'M4.012 16.737a2 2 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1',
        ].every((path) => drawTablerPath(ctx, path, x + 2.5, y + 2.5, 13));
        if (!copied) {
          const iconX = x + 6;
          const iconY = y + 5;
          drawRoundRect(ctx, iconX + 3, iconY, 8, 9, 2);
          drawRoundRect(ctx, iconX, iconY + 3, 8, 9, 2);
          ctx.stroke();
        }
      }

      ctx.fillStyle = '#ffffff';
      ctx.font = '700 10px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x + 18, y + badgeHeight / 2 + 0.5);
    };

    if (count > 1) {
      drawFileCard(24, 5, 0.42);
      drawFileCard(16, 10, 0.66);
      drawFileCard(8, 15, 1);
    } else {
      drawFileCard(8, 8, 1);
    }

    ctx.shadowColor = 'transparent';
    if (count > 1) {
      ctx.fillStyle = mode === 'move' ? '#16a34a' : '#2f7bff';
      ctx.beginPath();
      ctx.arc(55, 16, 11, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = '700 12px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(Math.min(count, 99)), 55, 16.5);
    }

    drawActionBadge(count > 1 ? 43 : 28, count > 1 ? 53 : 50);

    return canvas.toDataURL('image/png');
  } catch {
    return icon;
  }
}
