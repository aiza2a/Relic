//窗口缩放模块

import { LogicalSize } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';

const SHADOW_PADDING = 10;

//初始化窗口大小
export async function initWindowSize(window, state) {
    if (state.originalImageSize) {
        state.initialSize = { ...state.originalImageSize };
        return;
    }

    const currentSize = await window.innerSize();
    const scaleFactor = await window.scaleFactor();
    state.initialSize = {
        width: currentSize.width / scaleFactor - SHADOW_PADDING,
        height: currentSize.height / scaleFactor - SHADOW_PADDING
    };
}

//处理窗口缩放
export async function handleWindowResize(delta, isShiftKey, window, state) {
    if (!state.initialSize) {
        await initWindowSize(window, state);
    }
    
    if (!state.initialSize) {
        return { width: 0, height: 0 };
    }
    
    const step = isShiftKey ? 5 : 1;
    
    if (delta < 0) {
        state.scaleLevel += step;
    } else {
        state.scaleLevel = Math.max(1, state.scaleLevel - step);
    }
    
    const contentWidth = Math.max(1, state.initialSize.width * (state.scaleLevel / 10));
    const contentHeight = Math.max(1, state.initialSize.height * (state.scaleLevel / 10));
    const newWidth = contentWidth + SHADOW_PADDING;
    const newHeight = contentHeight + SHADOW_PADDING;
    
    const textScale = await invoke('get_system_text_scale');
    await window.setSize(new LogicalSize(newWidth * textScale, newHeight * textScale));

    if (state.imageScale > 1) {
        state.imageScale = 1;
        state.imageX = 0;
        state.imageY = 0;
    }
    
    return { width: contentWidth, height: contentHeight };
}

