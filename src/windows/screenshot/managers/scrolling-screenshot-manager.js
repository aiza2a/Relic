/**
 * 长截屏管理器
 * 负责长截屏功能的控制和预览显示
 */

import { ScreenshotAPI } from '../api/screenshot-api.js';
import { boundsConstraint } from '../utils/bounds-constraint.js';

export class ScrollingScreenshotManager {
    constructor() {
        this.isActive = false;
        this.isPaused = false;
        this.previewImageUrl = null;
        this.selection = null;
        this.lastPanelHeight = null;
        
        // DOM元素
        this.panel = null;
        this.previewCanvas = null;
        this.previewContext = null;
        
        // 离屏Canvas缓存渲染
        this.offscreenCanvas = document.createElement('canvas');
        this.offscreenContext = this.offscreenCanvas.getContext('2d', {
            alpha: true,
            desynchronized: true,
            willReadFrequently: false
        });
        this.offscreenCanvas.width = 216;
        this.offscreenCanvas.height = 0;
        this.currentCanvasHeight = 0;
        this.isRendering = false;
        this.renderQueue = [];
        this.maxCanvasHeight = 20000;
        
        // 回调函数
        this.onCancel = null;
        this.onComplete = null;
        
        // 事件监听器引用
        this.previewListener = null;
        this.completeListener = null;
        this.errorListener = null;
        
        this.lastUpdatePanelRectTime = 0;
        
        this.initUI();
    }

    /**
     * 初始化UI元素
     */
    initUI() {
        this.panel = document.createElement('div');
        this.panel.id = 'scrollingScreenshotPanel';
        this.panel.className = 'scrolling-screenshot-panel';
        this.panel.style.display = 'none';
        
        this.panel.innerHTML = `
            <div class="scrolling-preview-wrapper">
                <canvas class="scrolling-preview-canvas"></canvas>
            </div>
            <div class="scrolling-controls-area">
                <div class="scrolling-controls">
                    <button id="scrollingStartBtn" class="scrolling-control-btn" data-tooltip="开始">
                        <i class="ti ti-player-play"></i>
                    </button>
                    <button id="scrollingPauseBtn" class="scrolling-control-btn" data-tooltip="暂停" style="display: none;">
                        <i class="ti ti-player-pause"></i>
                    </button>
                    <button id="scrollingResumeBtn" class="scrolling-control-btn" data-tooltip="继续" style="display: none;">
                        <i class="ti ti-player-play"></i>
                    </button>
                    <button id="scrollingStopBtn" class="scrolling-control-btn" data-tooltip="完成">
                        <i class="ti ti-check"></i>
                    </button>
                    <button id="scrollingCancelBtn" class="scrolling-control-btn scrolling-cancel-btn" data-tooltip="取消">
                        <i class="ti ti-x"></i>
                    </button>
                </div>
                <div class="scrolling-info">
                    <span class="scrolling-info-text" id="scrollingStatus">准备</span>
                    <div class="scrolling-info-data">
                        <div class="scrolling-info-item">
                            <i class="ti ti-ruler-measure"></i>
                            <span id="scrollingHeight">0px</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.panel);
        
        this.previewCanvas = this.panel.querySelector('.scrolling-preview-canvas');
        this.previewContext = this.previewCanvas.getContext('2d', {
            alpha: true,
            desynchronized: true,
            willReadFrequently: false
        });
        
        this.previewCanvas.width = 216;
        this.previewCanvas.height = 0;
        
        this.previewWrapper = this.panel.querySelector('.scrolling-preview-wrapper');
        this.currentImageUrl = null;

        this.bindEvents();
    }

    bindEvents() {
        const startBtn = document.getElementById('scrollingStartBtn');
        const pauseBtn = document.getElementById('scrollingPauseBtn');
        const resumeBtn = document.getElementById('scrollingResumeBtn');
        const stopBtn = document.getElementById('scrollingStopBtn');
        const cancelBtn = document.getElementById('scrollingCancelBtn');
        
        if (startBtn) {
            startBtn.addEventListener('click', () => this.start());
        }
        if (pauseBtn) {
            pauseBtn.addEventListener('click', () => this.pause());
        }
        if (resumeBtn) {
            resumeBtn.addEventListener('click', () => this.resume());
        }
        if (stopBtn) {
            stopBtn.addEventListener('click', () => this.stop());
        }
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.cancel());
        }
    }

    /**
     * 激活长截屏模式
     */
    async activate(selection) {
        if (this.isActive) return;
        
        this.isActive = true;
        this.isPaused = false;
        this.selection = selection;
        
        this.clearPreview();
        this.hideSelectionElements();
        this.showPanel(selection);
        this.hideScreenshotBackground();
        this.updateStatus('准备开始');
        
        const stopBtn = document.getElementById('scrollingStopBtn');
        if (stopBtn) {
            stopBtn.disabled = true;
            stopBtn.style.opacity = '0.5';
            stopBtn.style.cursor = 'not-allowed';
        }
        
        const panelRect = this.panel.getBoundingClientRect();
        const panel = {
            left: Math.round(panelRect.left),
            top: Math.round(panelRect.top),
            width: Math.round(panelRect.width),
            height: Math.round(panelRect.height)
        };
        
        try {
            await ScreenshotAPI.initScrollingScreenshot(selection, panel);
        } catch (error) {
            console.error('初始化长截屏失败:', error);
            this.updateStatus('初始化失败');
        }
    }

    /**
     * 显示并定位面板
     */
    showPanel(selection) {
        this.panel.style.display = 'grid';
        
        const { left, top, width } = selection;
        const panelWidth = 216;
        const screenWidth = window.innerWidth;
        
        let panelLeft = left + width + 12;
        let panelTop = top;

        if (panelLeft + panelWidth > screenWidth) {
            panelLeft = left - panelWidth - 12;
            if (panelLeft < 0) {
                panelLeft = 12;
            }
        }
        
        this.panel.style.left = panelLeft + 'px';
        this.panel.style.top = panelTop + 'px';
        this.panel.style.bottom = '';

        this.panelInitialTop = panelTop;
    }

    /**
     * 开始长截屏
     */
    async start() {
        if (!this.isActive) return;
        
        try {
            await ScreenshotAPI.startScrollingScreenshot();
            
            document.getElementById('scrollingStartBtn').style.display = 'none';
            document.getElementById('scrollingPauseBtn').style.display = 'inline-block';
            
            const stopBtn = document.getElementById('scrollingStopBtn');
            if (stopBtn) {
                stopBtn.disabled = false;
                stopBtn.style.opacity = '1';
                stopBtn.style.cursor = 'pointer';
            }
            
            this.updateStatus('滚动中...');
            this.listenForPreviewUpdates();
        } catch (error) {
            console.error('开始长截屏失败:', error);
            this.updateStatus('开始失败: ' + error.message);
        }
    }

    /**
     * 暂停长截屏
     */
    async pause() {
        if (!this.isActive || this.isPaused) return;
        
        try {
            await ScreenshotAPI.pauseScrollingScreenshot();
            this.isPaused = true;
            
            document.getElementById('scrollingPauseBtn').style.display = 'none';
            document.getElementById('scrollingResumeBtn').style.display = 'inline-block';
            this.updateStatus('已暂停');
        } catch (error) {
            console.error('暂停长截屏失败:', error);
        }
    }

    /**
     * 继续长截屏
     */
    async resume() {
        if (!this.isActive || !this.isPaused) return;
        
        try {
            await ScreenshotAPI.resumeScrollingScreenshot();
            this.isPaused = false;
            
            document.getElementById('scrollingResumeBtn').style.display = 'none';
            document.getElementById('scrollingPauseBtn').style.display = 'inline-block';
            this.updateStatus('滚动中...');
        } catch (error) {
            console.error('继续长截屏失败:', error);
        }
    }

    /**
     * 结束长截屏
     */
    async stop() {
        if (!this.isActive) return;
        
        try {
            await ScreenshotAPI.stopScrollingScreenshot();
            
            if (this.onComplete) {
                this.onComplete();
            }
        } catch (error) {
            console.error('结束长截屏失败:', error);
        }
    }

    /**
     * 取消长截屏
     */
    async cancel() {
        if (!this.isActive) return;
        
        try {
            this.showSelectionElements();
            await ScreenshotAPI.cancelScrollingScreenshot();
            
            if (this.onCancel) {
                this.onCancel();
            }
            
            this.deactivate();
        } catch (error) {
            console.error('取消长截屏失败:', error);
            this.deactivate();
        }
    }

    /**
     * 清理预览状态
     */
    clearPreview() {
        if (this.previewCanvas && this.previewContext) {
            this.previewContext.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
            this.previewCanvas.width = 216;
            this.previewCanvas.height = 0;
        }
        
        if (this.offscreenCanvas && this.offscreenContext) {
            this.offscreenContext.clearRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);
            this.offscreenCanvas.width = 216;
            this.offscreenCanvas.height = 0;
        }
        
        this.currentCanvasHeight = 0;
        this.previewImageUrl = null;
        this.lastPanelHeight = null;
        this.isRendering = false;
        this.renderQueue = [];
    }

    /**
     * 停用长截屏模式
     */
    deactivate() {
        this.isActive = false;
        this.isPaused = false;
        
        this.removeEventListeners();

        this.clearPreview();
        
        this.showSelectionElements();

        this.panel.style.display = 'none';

        this.showScreenshotBackground();

        document.getElementById('scrollingStartBtn').style.display = 'inline-block';
        document.getElementById('scrollingPauseBtn').style.display = 'none';
        document.getElementById('scrollingResumeBtn').style.display = 'none';

        const stopBtn = document.getElementById('scrollingStopBtn');
        if (stopBtn) {
            stopBtn.disabled = true;
            stopBtn.style.opacity = '0.5';
            stopBtn.style.cursor = 'not-allowed';
        }
        
        this.updateStatus('准备开始');
        this.updateInfo(0);
    }

    /**
     * 监听预览更新事件
     */
    async listenForPreviewUpdates() {
        this.removeEventListeners();
        
        this.previewListener = await window.__TAURI__.event.listen('scrolling-screenshot-preview', (event) => {
            this.updatePreview(event.payload);
        });
        
        this.completeListener = await window.__TAURI__.event.listen('scrolling-screenshot-complete', (event) => {
            this.handleComplete(event.payload);
        });
        
        this.errorListener = await window.__TAURI__.event.listen('scrolling-screenshot-error', (event) => {
            this.updateStatus('错误: ' + event.payload);
        });
    }

    /**
     * 移除事件监听器
     */
    removeEventListeners() {
        if (this.previewListener) {
            this.previewListener();
            this.previewListener = null;
        }
        if (this.completeListener) {
            this.completeListener();
            this.completeListener = null;
        }
        if (this.errorListener) {
            this.errorListener();
            this.errorListener = null;
        }
    }

    /**
     * 更新预览图片 - 离屏Canvas增量渲染
     */
    async updatePreview(payload) {
        if (!payload || !this.previewCanvas) return;
        
        const { file_path, frame_height, total_height } = payload;

        this.updateInfo(total_height);
        this.renderQueue.push({ file_path, frame_height });
        
        if (this.isRendering) return;
        
        this.processRenderQueue();
    }

    /**
     * 处理渲染队列
     */
    async processRenderQueue() {
        if (this.isRendering || this.renderQueue.length === 0) return;
        
        this.isRendering = true;
        
        while (this.renderQueue.length > 0) {
            const task = this.renderQueue.shift();
            
            try {
                await this.renderFrame(task);
            } catch (error) {
                // 跳过失败的帧
            }
        }
        
        this.isRendering = false;
    }

    /**
     * 渲染单个帧
     */
    async renderFrame({ file_path, frame_height }) {
        return new Promise((resolve, reject) => {
            try {
                const assetUrl = window.__TAURI__.core.convertFileSrc(file_path, 'asset');
                const img = new Image();
                img.onload = () => {
                    try {
                        const frameHeight = img.height;
                        const newCanvasHeight = this.currentCanvasHeight + frameHeight;
                        
                        if (newCanvasHeight > this.maxCanvasHeight) {
                            resolve();
                            return;
                        }
                        
                        const oldHeight = this.offscreenCanvas.height;
                        
                        if (oldHeight > 0) {
                            const tempCanvas = document.createElement('canvas');
                            tempCanvas.width = 216;
                            tempCanvas.height = oldHeight;
                            const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: false });
                            tempCtx.drawImage(this.offscreenCanvas, 0, 0);
                            
                            this.offscreenCanvas.height = newCanvasHeight;
                            this.offscreenContext.drawImage(tempCanvas, 0, 0);
                        } else {
                            this.offscreenCanvas.height = newCanvasHeight;
                        }
                        
                        this.offscreenContext.drawImage(img, 0, oldHeight);
                        
                        this.previewCanvas.width = 216;
                        this.previewCanvas.height = newCanvasHeight;
                        this.previewContext.drawImage(this.offscreenCanvas, 0, 0);
                        
                        this.currentCanvasHeight = newCanvasHeight;
                        
                        if (this.previewWrapper) {
                            this.previewWrapper.scrollTop = this.previewWrapper.scrollHeight;
                        }
                        
                        const currentHeight = this.panel.getBoundingClientRect().height;
                        if (!this.lastPanelHeight || Math.abs(currentHeight - this.lastPanelHeight) > 10) {
                            this.lastPanelHeight = currentHeight;
                            this.updatePanelRect();
                        }
                        
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                };
                
                img.onerror = () => {
                    reject(new Error('加载图片失败'));
                };
                
                img.src = assetUrl;
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * 处理长截屏完成
     */
    handleComplete(payload) {
        this.updateStatus('长截屏完成！');
    }

    /**
     * 更新状态文本
     */
    updateStatus(text) {
        const statusText = document.getElementById('scrollingStatus');
        if (statusText) {
            statusText.textContent = text;
        }
    }

    /**
     * 更新信息显示
     */
    updateInfo(height) {
        const heightElem = document.getElementById('scrollingHeight');
        if (heightElem) {
            heightElem.textContent = `${height}px`;
        }
    }

    /**
     * 隐藏截屏背景
     */
    hideScreenshotBackground() {
        const backgroundCanvas = document.querySelector('#screenshot-background');
        if (backgroundCanvas) {
            backgroundCanvas.style.opacity = '0';
        }
    }

    /**
     * 恢复截屏背景
     */
    showScreenshotBackground() {
        const backgroundCanvas = document.querySelector('#screenshot-background');
        if (backgroundCanvas) {
            backgroundCanvas.style.opacity = '1';
        }
    }


    /**
     * 设置取消回调
     */
    setOnCancel(callback) {
        this.onCancel = callback;
    }

    setOnComplete(callback) {
        this.onComplete = callback;
    }

    /**
     * 更新面板区域（非阻塞 + 节流）
     */
    updatePanelRect() {
        if (!this.panel || !this.isActive) return;
        
        const now = Date.now();
        if (now - this.lastUpdatePanelRectTime < 500) {
            return;
        }
        this.lastUpdatePanelRectTime = now;
        
        const panelRect = this.panel.getBoundingClientRect();
        const panel = {
            left: Math.round(panelRect.left),
            top: Math.round(panelRect.top),
            width: Math.round(panelRect.width),
            height: Math.round(panelRect.height)
        };
        
        ScreenshotAPI.updateScrollingPanelRect(panel).catch(() => {});
    }

    /**
     * 调整面板位置
     */
    adjustPanelExpansion() {
        if (!this.panel || this.panelInitialTop === undefined) return;
        
        const panelRect = this.panel.getBoundingClientRect();
        const panelWidth = panelRect.width;
        const currentPanelHeight = panelRect.height;
        const panelLeft = parseInt(this.panel.style.left) || 0;
        
        const constrained = boundsConstraint.constrain(panelLeft, this.panelInitialTop, panelWidth, currentPanelHeight);
        this.panel.style.top = constrained.y + 'px';
    }

    /**
     * 隐藏选区UI
     */
    hideSelectionElements() {
        // （隐藏遮罩、边框和控制点）
        if (window.screenshotApp?.selectionManager) {
            window.screenshotApp.selectionManager.enableLongScreenshotMode();
        }
        
        // 隐藏选区信息面板
        if (window.screenshotApp?.selectionInfoPanel) {
            window.screenshotApp.selectionInfoPanel.hide();
        }

        const helpPanel = document.getElementById('helpPanel');
        if (helpPanel) {
            helpPanel.style.display = 'none';
        }

        this.elementsHidden = true;
    }

    /**
     * 显示选区UI
     */
    showSelectionElements() {
        // （恢复遮罩、边框和控制点）
        if (window.screenshotApp?.selectionManager) {
            window.screenshotApp.selectionManager.disableLongScreenshotMode();
        }
        
        // 显示选区信息面板
        if (window.screenshotApp?.selectionInfoPanel && window.screenshotApp?.selectionManager?.selectionRect) {
            const borderRadius = window.screenshotApp.selectionManager.getBorderRadius();
            window.screenshotApp.selectionInfoPanel.show(
                window.screenshotApp.selectionManager.selectionRect,
                borderRadius
            );
        }

        const helpPanel = document.getElementById('helpPanel');
        if (helpPanel) {
            helpPanel.style.display = 'flex';
        }
        
        this.elementsHidden = false;
    }

    /**
     * 清理资源
     */
    clear() {
        this.removeEventListeners();
        
        if (this.isActive) {
            this.cancel();
        }
    }
}

