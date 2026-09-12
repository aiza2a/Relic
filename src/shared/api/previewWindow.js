import { invoke } from '@tauri-apps/api/core';

function normalizePreviewAnchorRect(itemRect) {
  if (!itemRect || typeof itemRect !== 'object') {
    return null;
  }

  const left = Number(itemRect.left);
  const top = Number(itemRect.top);
  const width = Number(itemRect.width);
  const height = Number(itemRect.height);
  if (
    !Number.isFinite(left)
    || !Number.isFinite(top)
    || !Number.isFinite(width)
    || !Number.isFinite(height)
    || width <= 0
    || height <= 0
  ) {
    return null;
  }

  return { left, top, width, height };
}

export async function showPreviewWindow(mode, source, itemId, itemRect = null) {
  return await invoke('show_preview_window', {
    mode,
    source,
    itemId: String(itemId),
    itemRect: normalizePreviewAnchorRect(itemRect),
  });
}

export async function closePreviewWindow() {
  return await invoke('close_preview_window');
}

