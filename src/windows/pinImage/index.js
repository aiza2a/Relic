//贴图窗口主入口

import '@tabler/icons-webfont/dist/tabler-icons.min.css';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { loadSettings, saveSettings } from './settings.js';
import { createContextMenu } from './contextMenu.js';
import { enterThumbnailMode, exitThumbnailMode } from './thumbnail.js';
import { applyImageTransform } from './imageTransform.js';
import { setupSizeIndicatorEvents } from './sizeIndicator.js';
import {
    setupMouseDown,
    setupMouseMove,
    setupMouseUp,
    setupWheel,
    setupDoubleClick,
    preventDefaults
} from './mouseHandler.js';

(async () => {
    const img = document.getElementById('pinImage');
    const sizeIndicator = document.getElementById('sizeIndicator');
    const currentWindow = getCurrentWindow();
    const savedSettings = loadSettings();

    const states = {
        shadow: { enabled: savedSettings.shadow },
        lockPosition: { locked: savedSettings.lockPosition },
        pixelRender: { enabled: savedSettings.pixelRender },
        thumbnail: { enabled: savedSettings.thumbnailMode || false },
        thumbnailRestoreMode: savedSettings.thumbnailRestoreMode || 'follow',

        mouseDown: false,
        hasMoved: false,
        mouseDownX: 0,
        mouseDownY: 0,

        initialSize: null,
        originalImageSize: null,
        scaleLevel: 10,

        imageScale: 1,
        imageX: 0,
        imageY: 0,
        isDraggingImage: false,
        dragStartX: 0,
        dragStartY: 0,
        dragStartImageX: 0,
        dragStartImageY: 0,

        isInThumbnailMode: savedSettings.thumbnailMode || false,
        savedWindowSize: null,
        savedWindowCenter: null,
        savedThumbnailPosition: savedSettings.savedThumbnailPosition || null
    };

    async function handleThumbnailToggle(enabled) {
        if (enabled) {
            await enterThumbnailMode(currentWindow, states);
        } else {
            await exitThumbnailMode(currentWindow, states);
        }
        applyImageTransform(img, states);
    }

    async function onToggleThumbnail() {
        const isCurrentlyThumbnail = document.body.classList.contains('thumbnail-mode');
        const newThumbnailState = !isCurrentlyThumbnail;

        states.thumbnail.enabled = newThumbnailState;

        await handleThumbnailToggle(newThumbnailState);
        const settings = loadSettings();
        settings.thumbnailMode = newThumbnailState;
        saveSettings(settings);
    }

    await createContextMenu(currentWindow, states, handleThumbnailToggle);

    setupSizeIndicatorEvents(sizeIndicator);

    setupMouseDown(img, currentWindow, states);
    setupMouseMove(img, currentWindow, states);

    setupMouseUp(img, states, onToggleThumbnail, currentWindow);
    setupWheel(img, sizeIndicator, currentWindow, states);
    setupDoubleClick(img);
    preventDefaults(img);

    try {
        const data = await invoke('get_pin_image_data', { window: currentWindow });
        if (data && data.file_path) {
            const assetUrl = convertFileSrc(data.file_path, 'asset');
            
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = assetUrl;
            });
            
            if (data.preview_mode) {
                document.body.classList.add('preview-mode');
                img.classList.add('ready');
                return;
            }
            
            const physicalWidth = img.naturalWidth;
            const physicalHeight = img.naturalHeight;
            
            const dpr = window.devicePixelRatio || 1;
            const textScale = await invoke('get_system_text_scale');
            const exactWidth = physicalWidth / dpr;
            const exactHeight = physicalHeight / dpr;
            const logicalWidth = Math.round(exactWidth);
            const logicalHeight = Math.round(exactHeight);
            
            img.style.width = `${exactWidth}px`;
            img.style.height = `${exactHeight}px`;
            img.removeAttribute('width');
            img.removeAttribute('height');
            
            const paddingPhysical = Math.round(5 * dpr);
            const paddingCss = paddingPhysical / dpr;
            const imageClip = document.querySelector('.image-clip');
            imageClip.style.top = `${paddingCss}px`;
            imageClip.style.left = `${paddingCss}px`;
            
            states.originalImageSize = { width: logicalWidth, height: logicalHeight };
            states.initialSize = { width: logicalWidth, height: logicalHeight };
            
            const SHADOW_PADDING = 10;
            const windowWidth = logicalWidth + SHADOW_PADDING;
            const windowHeight = logicalHeight + SHADOW_PADDING;
            const { LogicalSize, PhysicalPosition } = await import('@tauri-apps/api/window');
            await currentWindow.setSize(new LogicalSize(windowWidth * textScale, windowHeight * textScale));
            
            if (data.image_physical_x != null && data.image_physical_y != null) {
                const windowX = data.image_physical_x - paddingPhysical;
                const windowY = data.image_physical_y - paddingPhysical;
                await currentWindow.setPosition(new PhysicalPosition(windowX, windowY));
            }
            
            img.classList.add('ready');
        }

        if (savedSettings.alwaysOnTop) {
            await currentWindow.setAlwaysOnTop(true);
        }

        if (savedSettings.shadow) {
            document.body.classList.add('shadow-enabled');
        }

        if (savedSettings.opacity !== 100) {
            img.style.opacity = savedSettings.opacity / 100;
        }

        if (savedSettings.pixelRender) {
            img.style.imageRendering = 'pixelated';
        }

        if (savedSettings.thumbnailMode) {
            states.isInThumbnailMode = false;
            states.thumbnail.enabled = false;
            const resetSettings = loadSettings();
            resetSettings.thumbnailMode = false;
            saveSettings(resetSettings);
        }
        
        currentWindow.listen('pin-image:refresh', async (event) => {
            const { file_path } = event.payload;
            if (!file_path) return;
            img.src = convertFileSrc(file_path, 'asset') + '?t=' + Date.now();
        });
    } catch (error) {
        console.error('加载图片失败:', error);
    }
})();

