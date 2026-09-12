//缩略图模式模块

import { invoke } from '@tauri-apps/api/core';
import { loadSettings, saveSettings } from './settings.js';

const THUMBNAIL_SIZE = 50;

//进入缩略图模式
export async function enterThumbnailMode(window, state) {
    try {
        const currentSize = await window.innerSize();
        const currentPosition = await window.outerPosition();
        const scaleFactor = await window.scaleFactor();
        
        state.savedWindowSize = {
            physicalWidth: currentSize.width,
            physicalHeight: currentSize.height,
            scaleFactor: scaleFactor,
            x: currentPosition.x,
            y: currentPosition.y
        };
        
        const centerX = currentPosition.x + currentSize.width / 2;
        const centerY = currentPosition.y + currentSize.height / 2;
        state.savedWindowCenter = { x: centerX, y: centerY };
        
        const restoreMode = state.thumbnailRestoreMode || 'follow';
        
        let newX, newY, thumbnailPhysicalSize;
        
        if (restoreMode === 'keep' && state.savedThumbnailPosition) {
            const targetScaleFactor = state.savedThumbnailPosition.scaleFactor || scaleFactor;
            thumbnailPhysicalSize = THUMBNAIL_SIZE * targetScaleFactor;
            newX = state.savedThumbnailPosition.x;
            newY = state.savedThumbnailPosition.y;
        } else {
            thumbnailPhysicalSize = THUMBNAIL_SIZE * scaleFactor;
            newX = Math.round(centerX - thumbnailPhysicalSize / 2);
            newY = Math.round(centerY - thumbnailPhysicalSize / 2);
        }
        
        await invoke('animate_window_resize', {
            startW: currentSize.width,
            startH: currentSize.height,
            startX: currentPosition.x,
            startY: currentPosition.y,
            endW: thumbnailPhysicalSize,
            endH: thumbnailPhysicalSize,
            endX: newX,
            endY: newY,
            durationMs: 300
        });
        
        state.imageScale = 1;
        state.imageX = 0;
        state.imageY = 0;
        
        document.body.classList.add('thumbnail-mode');
        
        state.isInThumbnailMode = true;
    } catch (error) {
        console.error('进入缩略图模式失败:', error);
    }
}

//退出缩略图模式
export async function exitThumbnailMode(window, state) {
    try {
        if (state.savedWindowSize && state.savedWindowCenter) {
            const currentSize = await window.innerSize();
            const currentPosition = await window.outerPosition();
            const scaleFactor = await window.scaleFactor();
            
            state.savedThumbnailPosition = {
                x: currentPosition.x,
                y: currentPosition.y,
                scaleFactor: scaleFactor
            };

            const settings = loadSettings();
            settings.savedThumbnailPosition = state.savedThumbnailPosition;
            saveSettings(settings);

            const restoreMode = state.thumbnailRestoreMode || 'follow';
            
            let centerX, centerY;
            
            if (restoreMode === 'keep') {
                centerX = state.savedWindowCenter.x;
                centerY = state.savedWindowCenter.y;
            } else {
                centerX = currentPosition.x + currentSize.width / 2;
                centerY = currentPosition.y + currentSize.height / 2;
            }
            
            const endWidth = state.savedWindowSize.physicalWidth;
            const endHeight = state.savedWindowSize.physicalHeight;
            const endX = Math.round(centerX - endWidth / 2);
            const endY = Math.round(centerY - endHeight / 2);
            
            await invoke('animate_window_resize', {
                startW: currentSize.width,
                startH: currentSize.height,
                startX: currentPosition.x,
                startY: currentPosition.y,
                endW: endWidth,
                endH: endHeight,
                endX: endX,
                endY: endY,
                durationMs: 300
            });
            
            const savedLogicalWidth = state.savedWindowSize.physicalWidth / state.savedWindowSize.scaleFactor;
            if (state.initialSize) {
                state.scaleLevel = Math.round((savedLogicalWidth / state.initialSize.width) * 10);
            }

            state.imageScale = 1;
            state.imageX = 0;
            state.imageY = 0;
        }
        
        document.body.classList.remove('thumbnail-mode');
        
        state.isInThumbnailMode = false;
        state.savedWindowSize = null;
        state.savedWindowCenter = null;
    } catch (error) {
        console.error('退出缩略图模式失败:', error);
    }
}

