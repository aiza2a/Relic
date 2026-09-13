/**
 * 特殊工具处理器
 * 负责处理OCR、长截屏、贴图等特殊工具的逻辑
 */
import { ScreenshotAPI } from '../api/screenshot-api.js';

export class SpecialToolHandler {
    constructor() {
        this.ocrManager = null;
        this.scrollingScreenshotManager = null;
        this.backgroundManager = null;
        this.selectionManager = null;
        this.exportManager = null;
        this.toolbarManager = null;
        this.tooltipManager = null;
        
        this.onHideAllToolbars = null;
        this.onClearAllContent = null;
    }

    /**
     * 设置依赖的管理器
     */
    setManagers({
        ocrManager,
        scrollingScreenshotManager,
        backgroundManager,
        selectionManager,
        exportManager,
        toolbarManager,
        tooltipManager
    }) {
        this.ocrManager = ocrManager;
        this.scrollingScreenshotManager = scrollingScreenshotManager;
        this.backgroundManager = backgroundManager;
        this.selectionManager = selectionManager;
        this.exportManager = exportManager;
        this.toolbarManager = toolbarManager;
        this.tooltipManager = tooltipManager;
    }

    /**
     * 设置回调
     */
    setCallbacks({ onHideAllToolbars, onClearAllContent }) {
        this.onHideAllToolbars = onHideAllToolbars;
        this.onClearAllContent = onClearAllContent;
    }

    /**
     * 处理OCR识别
     */
    async handleOCRRecognize() {
        const selection = this.selectionManager.getSelection();
        if (!selection) {
            console.warn('请先选择要识别的区域');
            return;
        }
        
        try {
            // 显示加载提示
            this.ocrManager.showLoadingDialog();
            
            // 执行OCR识别（带位置信息）
            const result = await this.ocrManager.recognizeSelection(
                this.backgroundManager.canvas,
                selection
            );
            
            // 隐藏加载提示
            this.ocrManager.hideLoadingDialog();
            
            // 在原图上显示覆盖层
            this.ocrManager.showOverlayResult(result);
        } catch (error) {
            console.error('OCR识别失败:', error);
            this.ocrManager.hideLoadingDialog();
        }
    }

    /**
     * 处理OCR复制操作
     */
    async handleOCRCopy() {
        if (this.ocrManager && this.ocrManager.copyText) {
            await this.ocrManager.copyText();
        }
    }

    /**
     * 处理OCR关闭操作
     */
    handleOCRClose() {
        if (this.ocrManager && this.ocrManager.clear) {
            this.ocrManager.clear();
        }
    }

    /**
     * 处理贴图工具
     */
    async handlePinImage() {
        const selection = this.selectionManager.getSelection();
        if (!selection) return;
        
        try {
            // 隐藏所有工具栏
            if (this.onHideAllToolbars) {
                this.onHideAllToolbars();
            }
            
            // 等待工具栏隐藏动画完成
            await new Promise(resolve => setTimeout(resolve, 50));
            
            // 导出选区为图片
            const borderRadius = this.selectionManager.getBorderRadius();
            const blob = await this.exportManager.exportSelectionAsBlob(selection, borderRadius);
            if (!blob) return;
            
            // 转换为字节数组
            const arrayBuffer = await blob.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            
            // 创建贴图窗口
            await window.__TAURI__.core.invoke('create_pin_image_window', {
                imageData: Array.from(uint8Array),
                width: Math.round(selection.width),
                height: Math.round(selection.height),
                x: Math.round(selection.left),
                y: Math.round(selection.top)
            });
            
            // 清除内容并关闭截屏窗口
            if (this.onClearAllContent) {
                this.onClearAllContent();
            }
            await ScreenshotAPI.hideWindow();
        } catch (error) {
            console.error('创建贴图窗口失败:', error);
        }
    }

    /**
     * 处理长截屏工具
     */
    async handleScrollingScreenshot() {
        const selection = this.selectionManager.getSelection();
        if (!selection) {
            return;
        }
        
        try {
            // 隐藏工具栏
            if (this.onHideAllToolbars) {
                this.onHideAllToolbars();
            }
            
            // 设置取消回调
            this.scrollingScreenshotManager.setOnCancel(() => {
                // 显示工具栏
                const mainToolbarPosition = this.toolbarManager.show(selection);

                // 更新提示
                if (this.tooltipManager) {
                    requestAnimationFrame(() => {
                        this.tooltipManager.updateAllTooltips();
                    });
                }
                
                // 取消工具激活状态
                this.toolbarManager.setActiveTool(null);
            });
            
            // 设置完成回调
            this.scrollingScreenshotManager.setOnComplete(async () => {
                try {
                    this.toolbarManager.setActiveTool(null);
                    
                    // 清除内容并关闭截屏窗口
                    if (this.onClearAllContent) {
                        this.onClearAllContent();
                    }
                    await ScreenshotAPI.hideWindow();
                } catch (error) {
                    console.error('关闭截屏窗口失败:', error);
                }
            });
            
            // 激活长截屏
            await this.scrollingScreenshotManager.activate(selection);
        } catch (error) {
            console.error('启动长截屏失败:', error);
            // 恢复工具栏显示
            this.toolbarManager.show(selection);
            this.toolbarManager.setActiveTool(null);
        }
    }
}

