/**
 * 导出管理器
 * 负责将截屏选区内容复制到系统剪贴板
 */

export class ExportManager {
    constructor() {
        this.backgroundManager = null;
        this.editLayerManager = null;
    }

    /**
     * 设置背景管理器引用
     */
    setBackgroundManager(backgroundManager) {
        this.backgroundManager = backgroundManager;
    }

    /**
     * 设置编辑层管理器引用
     */
    setEditLayerManager(editLayerManager) {
        this.editLayerManager = editLayerManager;
    }

    /**
     * 将选区内容复制到系统剪贴板
     */
    async copySelectionToClipboard(selection, borderRadius = 0) {
        try {
            const backgroundCanvas = this.backgroundManager?.canvas;
            const backgroundCtx = this.backgroundManager?.ctx;
            
            if (!backgroundCanvas || !backgroundCtx) {
                throw new Error('背景Canvas未准备就绪');
            }

            const selectionCanvas = await this.createSelectionCanvas(backgroundCanvas, selection, borderRadius);
            
            // 转换为PNG格式的Blob
            const blob = await this.canvasToBlob(selectionCanvas);

            // 写入系统剪贴板
            await this.writeToClipboard(blob);
            
            console.log('截屏已复制到剪贴板');
        } catch (error) {
            console.error('复制到剪贴板失败:', error);
            throw error;
        }
    }

    /**
     * 创建选区Canvas
     */
    async createSelectionCanvas(sourceCanvas, selection, borderRadius = 0) {
        // 计算Canvas实际尺寸与显示尺寸的比例
        const canvasRect = sourceCanvas.getBoundingClientRect();
        const scaleX = sourceCanvas.width / canvasRect.width;
        const scaleY = sourceCanvas.height / canvasRect.height;

        const exactLeft = selection.left * scaleX;
        const exactTop = selection.top * scaleY;
        const exactRight = (selection.left + selection.width) * scaleX;
        const exactBottom = (selection.top + selection.height) * scaleY;
        
        const actualLeft = Math.round(exactLeft);
        const actualTop = Math.round(exactTop);
        const actualRight = Math.round(exactRight);
        const actualBottom = Math.round(exactBottom);
        
        const actualWidth = actualRight - actualLeft;
        const actualHeight = actualBottom - actualTop;
        const actualRadius = Math.round(borderRadius * scaleX); 

        console.log('选区坐标转换:', {
            original: selection,
            scale: { scaleX, scaleY },
            actual: { actualLeft, actualTop, actualWidth, actualHeight, actualRadius }
        });

        // 创建新的Canvas来绘制选区部分
        const selectionCanvas = document.createElement('canvas');
        selectionCanvas.width = actualWidth;
        selectionCanvas.height = actualHeight;
        const selectionCtx = selectionCanvas.getContext('2d');

        // 获取合并后的完整Canvas
        let fullCanvas = sourceCanvas;
        if (this.editLayerManager && this.editLayerManager.hasContent()) {
            try {
                const mergeResult = this.editLayerManager.mergeWithBackground();
                if (mergeResult instanceof Promise) {
                    fullCanvas = await mergeResult;
                } else {
                    fullCanvas = mergeResult;
                }
                console.log('已合并编辑层内容');
            } catch (error) {
                console.warn('合并编辑层失败，使用背景层:', error);
                const editCanvas = this.editLayerManager.getCanvas?.() || this.editLayerManager.canvas;
                if (editCanvas) {
                    try {
                        selectionCtx.drawImage(
                            sourceCanvas,
                            actualLeft, actualTop, actualWidth, actualHeight,
                            0, 0, actualWidth, actualHeight
                        );
                        selectionCtx.drawImage(
                            editCanvas,
                            actualLeft, actualTop, actualWidth, actualHeight,
                            0, 0, actualWidth, actualHeight
                        );
                        
                        // 应用圆角
                        if (actualRadius > 0) {
                            this.applyRoundedCorners(selectionCanvas, actualRadius);
                        }
                        return selectionCanvas;
                    } catch (drawError) {
                        console.error('传统绘制方式也失败:', drawError);
                    }
                }
            }
        }

        // 从完整Canvas复制选区部分
        selectionCtx.drawImage(
            fullCanvas,
            actualLeft, actualTop, actualWidth, actualHeight,  
            0, 0, actualWidth, actualHeight  
        );

        // 应用圆角裁剪
        if (actualRadius > 0) {
            this.applyRoundedCorners(selectionCanvas, actualRadius);
        }

        return selectionCanvas;
    }

    /**
     * 对Canvas应用圆角裁剪
     */
    applyRoundedCorners(canvas, radius) {
        const width = canvas.width;
        const height = canvas.height;
        const ctx = canvas.getContext('2d');
        
        // 创建临时canvas保存原始图像
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(canvas, 0, 0);
        
        // 清空原画布
        ctx.clearRect(0, 0, width, height);
        
        // 绘制圆角矩形路径
        ctx.beginPath();
        ctx.moveTo(radius, 0);
        ctx.lineTo(width - radius, 0);
        ctx.arcTo(width, 0, width, radius, radius);
        ctx.lineTo(width, height - radius);
        ctx.arcTo(width, height, width - radius, height, radius);
        ctx.lineTo(radius, height);
        ctx.arcTo(0, height, 0, height - radius, radius);
        ctx.lineTo(0, radius);
        ctx.arcTo(0, 0, radius, 0, radius);
        ctx.closePath();
        
        // 裁剪
        ctx.clip();

        ctx.drawImage(tempCanvas, 0, 0);
    }

    /**
     * 将Canvas转换为Blob
     */
    async canvasToBlob(canvas) {
        return new Promise((resolve) => {
            canvas.toBlob(resolve, 'image/png');
        });
    }

    /**
     * 写入系统剪贴板
     */
    async writeToClipboard(blob) {
        if (navigator.clipboard && navigator.clipboard.write) {
            const clipboardItem = new ClipboardItem({
                'image/png': blob
            });
            await navigator.clipboard.write([clipboardItem]);
        } else {
            throw new Error('浏览器不支持剪贴板API');
        }
    }

    /**
     * 导出选区为Blob（用于贴图窗口）
     */
    async exportSelectionAsBlob(selection, borderRadius = 0) {
        try {
            const backgroundCanvas = this.backgroundManager?.canvas;
            
            if (!backgroundCanvas) {
                throw new Error('背景Canvas未准备就绪');
            }

            // 创建选区Canvas
            const selectionCanvas = await this.createSelectionCanvas(backgroundCanvas, selection, borderRadius);
            
            // 转换为Blob
            const blob = await this.canvasToBlob(selectionCanvas);
            
            console.log('选区已导出为Blob');
            return blob;
        } catch (error) {
            console.error('导出Blob失败:', error);
            throw error;
        }
    }

    /**
     * 合并背景层和编辑层
     */
    mergeLayersCanvas() {
        const backgroundCanvas = this.backgroundManager.canvas;
        const editCanvas = this.editLayerManager.canvas;
        
        if (!backgroundCanvas || !editCanvas) {
            throw new Error('Canvas未准备就绪');
        }

        // 创建合并Canvas
        const mergedCanvas = document.createElement('canvas');
        mergedCanvas.width = backgroundCanvas.width;
        mergedCanvas.height = backgroundCanvas.height;
        const mergedCtx = mergedCanvas.getContext('2d', { willReadFrequently: true });

        try {
            // 先绘制背景层
            mergedCtx.drawImage(backgroundCanvas, 0, 0);
            
            // 再绘制编辑层
            mergedCtx.drawImage(editCanvas, 0, 0);

            console.log('图层合并完成', {
                backgroundSize: `${backgroundCanvas.width}x${backgroundCanvas.height}`,
                editSize: `${editCanvas.width}x${editCanvas.height}`,
                mergedSize: `${mergedCanvas.width}x${mergedCanvas.height}`
            });

            return mergedCanvas;
        } catch (error) {
            console.error('合并图层时发生错误:', error);
            throw new Error('图层合并失败: ' + error.message);
        }
    }
}
