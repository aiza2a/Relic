import { useRef, useCallback } from 'react';
import { startDrag } from '@crabnebula/tauri-plugin-drag';

const DRAG_THRESHOLD = 5;

export function useDragWithThreshold(options = {}) {
  const { onDragPending, onDragStart, onDragEnd, onDragCancel, shouldStartDrag } = options;
  const dragStateRef = useRef(null);

  const resolveDragIcon = useCallback(async (iconPath, paths, mode, event) => {
    try {
      if (typeof iconPath === 'function') {
        return await iconPath({ paths, mode, event });
      }
      if (iconPath?.then) {
        return await iconPath;
      }
    } catch (err) {
      console.warn('生成拖拽预览失败:', err);
    }
    return iconPath || paths[0];
  }, []);

  const handleMouseDown = useCallback((e, filePaths, iconPath, mode = 'copy') => {
    if (e.button !== 0) return;
    
    const paths = Array.isArray(filePaths) ? filePaths.filter(Boolean) : [];
    if (!paths.length) return;

    const startX = e.clientX;
    const startY = e.clientY;
    let isDragging = false;

    const handleMouseMove = async (moveEvent) => {
      if (isDragging) return;

      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance >= DRAG_THRESHOLD) {
        if (shouldStartDrag && !shouldStartDrag(moveEvent)) {
          onDragPending?.({ event: moveEvent, paths, mode, iconPath: iconPath || paths[0] });
          return;
        }

        isDragging = true;
        cleanup();
        
        onDragStart?.();
        let dragPayload = null;
        try {
          const dragIcon = await resolveDragIcon(iconPath, paths, mode, moveEvent);
          await startDrag({ 
            item: paths, 
            icon: dragIcon || paths[0],
            mode,
          }, (payload) => {
            dragPayload = payload || null;
          });
        } catch (err) {
          console.error('拖拽失败:', err);
        }
        onDragEnd?.({ paths, mode, result: dragPayload?.result || null, cursorPos: dragPayload?.cursorPos || null });
      }
    };

    const handleMouseUp = () => {
      onDragCancel?.();
      cleanup();
    };

    const cleanup = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      dragStateRef.current = null;
    };

    dragStateRef.current = { cleanup };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

  }, [onDragPending, onDragStart, onDragEnd, onDragCancel, shouldStartDrag, resolveDragIcon]);

  return handleMouseDown;
}

export default useDragWithThreshold;
