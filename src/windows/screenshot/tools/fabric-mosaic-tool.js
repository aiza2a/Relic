/**
 * Fabric.js马赛克工具
 * 支持两种绘制模式：画笔、区域
 * 支持两种图形模式：马赛克、模糊
 */
import { getCanvas, applyOpacity, getToolParams } from './common-utils.js';

export class FabricMosaicTool {
    constructor() {
        this.name = 'mosaic';
        this.fabricCanvas = null;
        this.backgroundCanvas = null;
        this.isDrawing = false;
        this.startX = 0;
        this.startY = 0;
        this.currentRect = null;
        
        //参数结构
        this.options = {
            drawMode: 'brush',      // brush: 画笔模式, area: 区域模式
            effectType: 'mosaic',   // mosaic: 马赛克, blur: 模糊
            mosaicSize: 10,         // 马赛克块大小
            blurRadius: 10,         // 模糊半径
            brushSize: 30           // 画笔大小（画笔模式）
        };
        
        // 鼠标事件处理器
        this.mouseDownHandler = null;
        this.mouseMoveHandler = null;
        this.mouseUpHandler = null;
    }

    /**
     * 设置Fabric Canvas引用
     */
    setFabricCanvas(fabricCanvas) {
        this.fabricCanvas = fabricCanvas;
    }

    /**
     * 设置背景画布引用
     */
    setBackgroundCanvas(backgroundCanvas) {
        this.backgroundCanvas = backgroundCanvas;
    }

    /**
     * 设置参数
     */
    setOptions(options) {
        Object.assign(this.options, options);
    }

    /**
     * 获取当前参数
     */
    getOptions() {
        return { ...this.options };
    }

    /**
     * 应用参数变化
     */
    applyParameter(paramName, value) {
        switch (paramName) {
            case 'drawMode':
                this.options.drawMode = value;
                this.updateDrawMode();
                break;
            case 'effectType':
                this.options.effectType = value;
                break;
            case 'mosaicSize':
                this.options.mosaicSize = value;
                break;
            case 'blurRadius':
                this.options.blurRadius = value;
                break;
            case 'brushSize':
                this.options.brushSize = value;
                break;
        }
    }

    /**
     * 更新绘制模式
     */
    updateDrawMode() {
        if (!this.fabricCanvas) return;
        
        // 根据模式切换处理方式
        if (this.options.drawMode === 'brush') {
            // 画笔模式：使用路径绘制
            this.setupBrushMode();
        } else {
            // 区域模式：使用矩形绘制
            this.setupAreaMode();
        }
    }

    /**
     * 设置画笔模式
     */
    setupBrushMode() {
        if (!this.fabricCanvas) return;
        
        // 移除区域模式的事件监听
        this.removeAreaModeEvents();
        
        // 启用自由绘制模式
        this.fabricCanvas.isDrawingMode = false;
        this.fabricCanvas.selection = false;
        
        // 添加画笔模式的事件监听
        this.setupBrushModeEvents();
    }

    /**
     * 设置区域模式
     */
    setupAreaMode() {
        if (!this.fabricCanvas) return;
        
        // 移除画笔模式的事件监听
        this.removeBrushModeEvents();
        
        // 禁用自由绘制
        this.fabricCanvas.isDrawingMode = false;
        this.fabricCanvas.selection = false;
        
        // 添加区域模式的事件监听
        this.setupAreaModeEvents();
    }

    /**
     * 设置画笔模式事件
     */
    setupBrushModeEvents() {
        if (!this.fabricCanvas) return;
        
        let pathPoints = [];
        let isDrawing = false;
        let previewPath = null; // 预览路径
        
        this.mouseDownHandler = (event) => {
            isDrawing = true;
            pathPoints = [];
            
            const pointer = this.fabricCanvas.getPointer(event.e);
            pathPoints.push({ x: pointer.x, y: pointer.y });
        };
        
        this.mouseMoveHandler = (event) => {
            if (!isDrawing) return;
            
            const pointer = this.fabricCanvas.getPointer(event.e);
            pathPoints.push({ x: pointer.x, y: pointer.y });
            
            // 绘制预览路径
            if (pathPoints.length > 1) {
                // 移除旧的预览路径
                if (previewPath) {
                    this.fabricCanvas.remove(previewPath);
                    previewPath = null;
                }
                
                // 创建新的预览路径
                const pathString = this.createPathString(pathPoints);
                previewPath = new fabric.Path(pathString, {
                    stroke: this.options.effectType === 'mosaic' ? '#00ff00' : '#0088ff',
                    strokeWidth: this.options.brushSize,
                    fill: 'transparent',
                    strokeLineCap: 'round',
                    strokeLineJoin: 'round',
                    opacity: 0.5,
                    selectable: false,
                    evented: false,
                    excludeFromExport: true,      // 标记为不导出
                    excludeFromHistory: true      // 标记为不记录到历史
                });
                
                // 添加预览路径
                this.fabricCanvas.add(previewPath);
                this.fabricCanvas.renderAll();
            }
        };
        
        this.mouseUpHandler = (event) => {
            if (!isDrawing) return;
            isDrawing = false;
            
            // 移除预览路径
            if (previewPath) {
                this.fabricCanvas.remove(previewPath);
                previewPath = null;
            }
            
            // 完成绘制，创建最终的马赛克/模糊路径对象
            if (pathPoints.length > 1) {
                this.createMosaicPath(pathPoints);
            }
            
            pathPoints = [];
            this.fabricCanvas.renderAll();
        };
        
        this.fabricCanvas.on('mouse:down', this.mouseDownHandler);
        this.fabricCanvas.on('mouse:move', this.mouseMoveHandler);
        this.fabricCanvas.on('mouse:up', this.mouseUpHandler);
    }
    
    /**
     * 创建SVG路径字符串
     */
    createPathString(points) {
        if (points.length < 2) return '';
        
        let pathString = `M ${points[0].x} ${points[0].y}`;
        
        for (let i = 1; i < points.length; i++) {
            pathString += ` L ${points[i].x} ${points[i].y}`;
        }
        
        return pathString;
    }

    /**
     * 移除画笔模式事件
     */
    removeBrushModeEvents() {
        if (!this.fabricCanvas) return;
        
        if (this.mouseDownHandler) {
            this.fabricCanvas.off('mouse:down', this.mouseDownHandler);
        }
        if (this.mouseMoveHandler) {
            this.fabricCanvas.off('mouse:move', this.mouseMoveHandler);
        }
        if (this.mouseUpHandler) {
            this.fabricCanvas.off('mouse:up', this.mouseUpHandler);
        }
        
        // 清理可能存在的预览路径
        this.clearPreviewPath();
    }
    
    /**
     * 清理预览路径和临时对象
     */
    clearPreviewPath() {
        if (!this.fabricCanvas) return;
        const objects = this.fabricCanvas.getObjects();
        const previewObjects = objects.filter(obj => 
            obj.excludeFromHistory === true && 
            obj.excludeFromExport === true
        );
        
        previewObjects.forEach(obj => {
            this.fabricCanvas.remove(obj);
        });
        
        this.fabricCanvas.renderAll();
    }

    /**
     * 设置区域模式事件
     */
    setupAreaModeEvents() {
        if (!this.fabricCanvas) return;
        
        this.mouseDownHandler = (event) => {
            this.isDrawing = true;
            const pointer = this.fabricCanvas.getPointer(event.e);
            this.startX = pointer.x;
            this.startY = pointer.y;
            
            // 创建临时矩形显示选区
            this.currentRect = new fabric.Rect({
                left: this.startX,
                top: this.startY,
                width: 0,
                height: 0,
                fill: 'transparent',
                stroke: '#00ff00',
                strokeWidth: 2,
                strokeDashArray: [5, 5],
                selectable: false,
                evented: false,
                excludeFromExport: true,      
                excludeFromHistory: true    
            });
            this.fabricCanvas.add(this.currentRect);
            this.fabricCanvas.renderAll();
        };
        
        this.mouseMoveHandler = (event) => {
            if (!this.isDrawing || !this.currentRect) return;
            
            const pointer = this.fabricCanvas.getPointer(event.e);
            const width = pointer.x - this.startX;
            const height = pointer.y - this.startY;
            
            // 更新矩形大小
            if (width >= 0) {
                this.currentRect.set({ width: width });
            } else {
                this.currentRect.set({ left: pointer.x, width: Math.abs(width) });
            }
            
            if (height >= 0) {
                this.currentRect.set({ height: height });
            } else {
                this.currentRect.set({ top: pointer.y, height: Math.abs(height) });
            }
            
            this.fabricCanvas.renderAll();
        };
        
        this.mouseUpHandler = (event) => {
            if (!this.isDrawing) return;
            this.isDrawing = false;
            
            if (this.currentRect) {
                const rectBounds = {
                    left: this.currentRect.left,
                    top: this.currentRect.top,
                    width: this.currentRect.width,
                    height: this.currentRect.height
                };
                
                // 移除临时矩形
                this.fabricCanvas.remove(this.currentRect);
                this.currentRect = null;
                
                // 只有在矩形足够大时才创建效果
                if (rectBounds.width > 5 && rectBounds.height > 5) {
                    this.createMosaicRect(rectBounds);
                }
                
                this.fabricCanvas.renderAll();
            }
        };
        
        this.fabricCanvas.on('mouse:down', this.mouseDownHandler);
        this.fabricCanvas.on('mouse:move', this.mouseMoveHandler);
        this.fabricCanvas.on('mouse:up', this.mouseUpHandler);
    }

    /**
     * 移除区域模式事件
     */
    removeAreaModeEvents() {
        if (!this.fabricCanvas) return;
        
        if (this.mouseDownHandler) {
            this.fabricCanvas.off('mouse:down', this.mouseDownHandler);
        }
        if (this.mouseMoveHandler) {
            this.fabricCanvas.off('mouse:move', this.mouseMoveHandler);
        }
        if (this.mouseUpHandler) {
            this.fabricCanvas.off('mouse:up', this.mouseUpHandler);
        }
        
        // 清理临时矩形
        if (this.currentRect) {
            this.fabricCanvas.remove(this.currentRect);
            this.currentRect = null;
        }
    }

    /**
     * 创建马赛克路径对象
     */
    createMosaicPath(points) {
        if (!this.backgroundCanvas || points.length < 2) return;
        
        const brushSize = this.options.brushSize;
        const brushRadius = brushSize / 2;
        
        // 计算坐标缩放比例（编辑层坐标 -> 背景层坐标）
        const scaleX = this.backgroundCanvas.width / this.fabricCanvas.width;
        const scaleY = this.backgroundCanvas.height / this.fabricCanvas.height;
        
        // 将所有点转换为背景层坐标
        const bgPoints = points.map(p => ({
            x: p.x * scaleX,
            y: p.y * scaleY
        }));
        
        const bgBrushSize = brushSize * Math.min(scaleX, scaleY);
        const bgBrushRadius = bgBrushSize / 2;
        
        // 计算路径的边界框
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        bgPoints.forEach(p => {
            minX = Math.min(minX, p.x - bgBrushRadius);
            minY = Math.min(minY, p.y - bgBrushRadius);
            maxX = Math.max(maxX, p.x + bgBrushRadius);
            maxY = Math.max(maxY, p.y + bgBrushRadius);
        });
        
        // 确保边界有效
        minX = Math.max(0, Math.floor(minX));
        minY = Math.max(0, Math.floor(minY));
        maxX = Math.min(this.backgroundCanvas.width, Math.ceil(maxX));
        maxY = Math.min(this.backgroundCanvas.height, Math.ceil(maxY));
        
        const width = maxX - minX;
        const height = maxY - minY;
        
        if (width <= 0 || height <= 0) return;
        
        // 获取边界框内的图像数据
        const bgCtx = this.backgroundCanvas.getContext('2d');
        const imageData = bgCtx.getImageData(minX, minY, width, height);
        
        // 应用效果
        let processedData;
        if (this.options.effectType === 'mosaic') {
            processedData = this.applyMosaicEffect(imageData, this.options.mosaicSize);
        } else {
            processedData = this.applyBlurEffect(imageData, this.options.blurRadius);
        }
        
        // 创建效果画布
        const effectCanvas = document.createElement('canvas');
        effectCanvas.width = width;
        effectCanvas.height = height;
        const effectCtx = effectCanvas.getContext('2d');
        effectCtx.putImageData(processedData, 0, 0);
        
        // 创建遮罩画布
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = width;
        maskCanvas.height = height;
        const maskCtx = maskCanvas.getContext('2d');
        
        // 绘制路径遮罩
        maskCtx.lineCap = 'round';
        maskCtx.lineJoin = 'round';
        maskCtx.lineWidth = bgBrushSize;
        maskCtx.strokeStyle = '#000000';
        
        maskCtx.beginPath();
        maskCtx.moveTo(bgPoints[0].x - minX, bgPoints[0].y - minY);
        for (let i = 1; i < bgPoints.length; i++) {
            maskCtx.lineTo(bgPoints[i].x - minX, bgPoints[i].y - minY);
        }
        maskCtx.stroke();
        
        // 创建最终画布，应用遮罩
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = width;
        finalCanvas.height = height;
        const finalCtx = finalCanvas.getContext('2d');
        
        // 先绘制遮罩
        finalCtx.drawImage(maskCanvas, 0, 0);
        finalCtx.globalCompositeOperation = 'source-in';
        finalCtx.drawImage(effectCanvas, 0, 0);
        
        // 将位置转换回编辑层坐标
        const fabricLeft = minX / scaleX;
        const fabricTop = minY / scaleY;
        const fabricWidth = width / scaleX;
        const fabricHeight = height / scaleY;
        
        // 创建Fabric图像对象
        const image = new fabric.Image(finalCanvas, {
            left: fabricLeft,
            top: fabricTop,
            scaleX: 1 / scaleX,
            scaleY: 1 / scaleY,
            selectable: false,
            hasControls: true,
            hasBorders: true,
            customType: 'mosaic-path'
        });
        
        this.fabricCanvas.add(image);
        this.fabricCanvas.discardActiveObject(); 
        this.fabricCanvas.renderAll();
    }

    /**
     * 创建矩形区域的马赛克/模糊效果
     */
    createMosaicRect(bounds) {
        if (!this.backgroundCanvas) return;
        
        const effectImage = this.createEffectImage(
            bounds.left, bounds.top, bounds.width, bounds.height
        );
        
        if (effectImage) {
            this.fabricCanvas.add(effectImage);
            this.fabricCanvas.discardActiveObject();  // 取消任何选中状态
            this.fabricCanvas.renderAll();
        }
    }

    /**
     * 创建效果图像（矩形区域）
     */
    createEffectImage(left, top, width, height) {
        try {
            // 计算坐标缩放比例（编辑层坐标 -> 背景层坐标）
            const scaleX = this.backgroundCanvas.width / this.fabricCanvas.width;
            const scaleY = this.backgroundCanvas.height / this.fabricCanvas.height;
            
            // 转换为背景层坐标
            const bgLeft = left * scaleX;
            const bgTop = top * scaleY;
            const bgWidth = width * scaleX;
            const bgHeight = height * scaleY;
            
            // 确保坐标和尺寸有效
            const safeLeft = Math.max(0, Math.floor(bgLeft));
            const safeTop = Math.max(0, Math.floor(bgTop));
            const safeWidth = Math.max(1, Math.floor(bgWidth));
            const safeHeight = Math.max(1, Math.floor(bgHeight));
            
            // 获取背景图像数据
            const bgCtx = this.backgroundCanvas.getContext('2d');
            
            // 确保不超出画布边界
            const maxWidth = Math.min(safeWidth, this.backgroundCanvas.width - safeLeft);
            const maxHeight = Math.min(safeHeight, this.backgroundCanvas.height - safeTop);
            
            if (maxWidth <= 0 || maxHeight <= 0) {
                console.warn('区域超出画布范围');
                return null;
            }
            
            const imageData = bgCtx.getImageData(safeLeft, safeTop, maxWidth, maxHeight);
            
            // 应用效果
            let processedData;
            if (this.options.effectType === 'mosaic') {
                processedData = this.applyMosaicEffect(imageData, this.options.mosaicSize);
            } else {
                processedData = this.applyBlurEffect(imageData, this.options.blurRadius);
            }
            
            // 创建临时画布绘制效果
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = maxWidth;
            tempCanvas.height = maxHeight;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.putImageData(processedData, 0, 0);
            
            // 创建Fabric图像对象（转换回编辑层坐标）
            const image = new fabric.Image(tempCanvas, {
                left: safeLeft / scaleX,
                top: safeTop / scaleY,
                scaleX: 1 / scaleX,
                scaleY: 1 / scaleY,
                selectable: false, 
                hasControls: true,
                hasBorders: true,
                customType: 'mosaic'
            });
            
            return image;
        } catch (error) {
            console.error('创建效果图像失败:', error);
            return null;
        }
    }

    /**
     * 应用马赛克效果
     */
    applyMosaicEffect(imageData, mosaicSize) {
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        
        // 创建新的图像数据
        const newImageData = new ImageData(width, height);
        const newData = newImageData.data;
        
        // 遍历每个马赛克块
        for (let y = 0; y < height; y += mosaicSize) {
            for (let x = 0; x < width; x += mosaicSize) {
                // 计算块的平均颜色
                let r = 0, g = 0, b = 0, a = 0, count = 0;
                
                for (let dy = 0; dy < mosaicSize && y + dy < height; dy++) {
                    for (let dx = 0; dx < mosaicSize && x + dx < width; dx++) {
                        const index = ((y + dy) * width + (x + dx)) * 4;
                        r += data[index];
                        g += data[index + 1];
                        b += data[index + 2];
                        a += data[index + 3];
                        count++;
                    }
                }
                
                r = Math.round(r / count);
                g = Math.round(g / count);
                b = Math.round(b / count);
                a = Math.round(a / count);
                
                // 填充整个块为平均颜色
                for (let dy = 0; dy < mosaicSize && y + dy < height; dy++) {
                    for (let dx = 0; dx < mosaicSize && x + dx < width; dx++) {
                        const index = ((y + dy) * width + (x + dx)) * 4;
                        newData[index] = r;
                        newData[index + 1] = g;
                        newData[index + 2] = b;
                        newData[index + 3] = a;
                    }
                }
            }
        }
        
        return newImageData;
    }

    /**
     * 应用模糊效果
     */
    applyBlurEffect(imageData, radius) {
        let tempData = this.boxBlurHorizontal(imageData, radius);
        return this.boxBlurVertical(tempData, radius);
    }

    /**
     * 水平方向盒式模糊
     */
    boxBlurHorizontal(imageData, radius) {
        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;
        const newImageData = new ImageData(width, height);
        const newData = newImageData.data;
        
        for (let y = 0; y < height; y++) {
            // 滑动窗口
            for (let x = 0; x < width; x++) {
                let r = 0, g = 0, b = 0, a = 0;
                let count = 0;
                
                // 计算窗口范围
                const xMin = Math.max(0, x - radius);
                const xMax = Math.min(width - 1, x + radius);
                
                // 累加窗口内的所有像素
                for (let xi = xMin; xi <= xMax; xi++) {
                    const idx = (y * width + xi) * 4;
                    r += data[idx];
                    g += data[idx + 1];
                    b += data[idx + 2];
                    a += data[idx + 3];
                    count++;
                }
                
                // 写入平均值
                const outIdx = (y * width + x) * 4;
                newData[outIdx] = r / count;
                newData[outIdx + 1] = g / count;
                newData[outIdx + 2] = b / count;
                newData[outIdx + 3] = a / count;
            }
        }
        
        return newImageData;
    }

    /**
     * 垂直方向盒式模糊
     */
    boxBlurVertical(imageData, radius) {
        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;
        const newImageData = new ImageData(width, height);
        const newData = newImageData.data;
        
        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
                let r = 0, g = 0, b = 0, a = 0;
                let count = 0;

                const yMin = Math.max(0, y - radius);
                const yMax = Math.min(height - 1, y + radius);
                
                for (let yi = yMin; yi <= yMax; yi++) {
                    const idx = (yi * width + x) * 4;
                    r += data[idx];
                    g += data[idx + 1];
                    b += data[idx + 2];
                    a += data[idx + 3];
                    count++;
                }
                
                const outIdx = (y * width + x) * 4;
                newData[outIdx] = r / count;
                newData[outIdx + 1] = g / count;
                newData[outIdx + 2] = b / count;
                newData[outIdx + 3] = a / count;
            }
        }
        
        return newImageData;
    }

    /**
     * 工具激活时的处理
     */
    onActivate(editLayerManager) {
        if (!editLayerManager || !editLayerManager.getFabricCanvas) {
            console.error('马赛克工具激活失败：editLayerManager 无效');
            return;
        }
        
        this.fabricCanvas = editLayerManager.getFabricCanvas();
        
        if (!this.fabricCanvas) {
            console.error('马赛克工具激活失败：fabricCanvas 为空');
            return;
        }
        
        // 获取背景画布
        if (window.screenshotController?.backgroundManager) {
            this.backgroundCanvas = window.screenshotController.backgroundManager.canvas;
        }
        
        if (!this.backgroundCanvas) {
            console.error('马赛克工具激活失败：backgroundCanvas 为空');
            return;
        }
        
        // 从子工具栏获取当前参数值
        this.syncParametersFromSubToolbar();
        
        // 启用编辑层交互
        editLayerManager.enableInteraction();
        
        // 根据绘制模式设置
        this.updateDrawMode();
        
        // 设置光标
        document.body.style.cursor = 'crosshair';
    }

    /**
     * 从子工具栏同步参数值
     */
    syncParametersFromSubToolbar() {
        const params = getToolParams('mosaic');
        for (const [name, value] of Object.entries(params)) {
            this.applyParameter(name, value);
        }
    }

    /**
     * 工具取消激活时的处理
     */
    onDeactivate(editLayerManager) {
        // 移除所有事件监听
        this.removeBrushModeEvents();
        this.removeAreaModeEvents();
        
        // 清理所有临时元素
        this.clearPreviewPath();
        
        if (editLayerManager && editLayerManager.disableDrawingMode) {
            editLayerManager.disableDrawingMode();
        }
        
        // 恢复默认光标
        document.body.style.cursor = 'default';
        
        this.fabricCanvas = null;
        this.backgroundCanvas = null;
        this.isDrawing = false;
    }
}

