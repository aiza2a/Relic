/**
 * Fabric.js画笔工具
 */
import { getCanvas, applyOpacity, getToolParams } from './common-utils.js';

export class FabricBrushTool {
    constructor() {
        this.name = 'brush';
        this.fabricCanvas = null;
        
        // 统一参数结构
        this.options = {
            color: '#ff0000',
            width: 3,
            shadowColor: '',
            shadowBlur: 0
        };
    }

    /**
     * 设置Fabric Canvas引用
     */
    setFabricCanvas(fabricCanvas) {
        this.fabricCanvas = fabricCanvas;
    }

    /**
     * 设置画笔参数
     */
    setOptions(options) {
        Object.assign(this.options, options);
        this.applyBrushOptions();
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
            case 'color':
                this.options.color = value;
                break;
            case 'opacity':
                this.options.color = applyOpacity(this.options.color, value);
                break;
            case 'brushSize':
                this.options.width = value;
                break;
            case 'brushType':
                this.setBrushType(value);
                break;
        }
        
        this.applyBrushOptions();
        this.applyToActivePath();
    }


    /**
     * 设置笔刷类型（使用 Fabric.js 官方标准画笔）
     */
    setBrushType(type) {
        this.options.brushType = type;
        const canvas = getCanvas(this);
        if (!canvas) return;
        
        // 根据类型创建不同的画笔
        switch (type) {
            case 'Pencil':
                // 铅笔：标准平滑画笔
                canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
                break;
                
            case 'Circle':
                // 圆形笔刷
                canvas.freeDrawingBrush = new fabric.CircleBrush(canvas);
                break;
                
            case 'Spray':
                // 喷雾笔刷（优化性能）
                canvas.freeDrawingBrush = new fabric.SprayBrush(canvas);
                break;
                
            case 'hline':
            case 'vline':
            case 'square':
            case 'diamond':
                // 图案画笔
                canvas.freeDrawingBrush = this.createPatternBrush(canvas, type);
                break;
                
            default:
                // 默认使用铅笔
                canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
        }
        
        // 应用当前参数到新画笔
        this.applyBrushOptions();
    }
    
    /**
     * 创建图案画笔
     */
    createPatternBrush(canvas, pattern) {
        const brush = new fabric.PatternBrush(canvas);
        brush.getPatternSrc = function() {
            const size = this.width;
            const patternCanvas = document.createElement('canvas');
            patternCanvas.width = patternCanvas.height = size + 1;
            const ctx = patternCanvas.getContext('2d');
            
            ctx.fillStyle = this.color;
            
            switch (pattern) {
                case 'hline':
                    // 横线图案
                    ctx.strokeStyle = this.color;
                    ctx.lineWidth = size / 10;
                    ctx.beginPath();
                    ctx.moveTo(0, size / 2);
                    ctx.lineTo(size, size / 2);
                    ctx.stroke();
                    break;
                    
                case 'vline':
                    // 竖线图案
                    ctx.strokeStyle = this.color;
                    ctx.lineWidth = size / 10;
                    ctx.beginPath();
                    ctx.moveTo(size / 2, 0);
                    ctx.lineTo(size / 2, size);
                    ctx.stroke();
                    break;
                    
                case 'square':
                    // 方形图案
                    ctx.fillRect(0, 0, size, size);
                    break;
                    
                case 'diamond':
                    // 菱形图案
                    ctx.beginPath();
                    ctx.moveTo(size / 2, 0);
                    ctx.lineTo(size, size / 2);
                    ctx.lineTo(size / 2, size);
                    ctx.lineTo(0, size / 2);
                    ctx.closePath();
                    ctx.fill();
                    break;
            }
            
            return patternCanvas;
        };
        
        return brush;
    }

    applyBrushOptions() {
        const canvas = getCanvas(this);
        if (!canvas?.freeDrawingBrush) return;
        
        const brush = canvas.freeDrawingBrush;
        const brushType = this.options.brushType || 'Pencil';
        
        // 基础属性
        brush.color = this.options.color;
        brush.width = this.options.width;
        
        // 根据画笔类型调整特殊参数
        if (brushType === 'Spray') {
            // 喷雾：优化性能
            const sprayWidth = Math.min(this.options.width * 2, 60);
            brush.width = sprayWidth;
            // 动态调整密度
            const density = Math.max(5, Math.min(20, 25 - this.options.width / 3));
            brush.density = density;
        } else if (brushType === 'Circle') {
            // 圆形笔刷：限制大小避免性能问题
            brush.width = Math.min(this.options.width, 30);
        }
    }

    /**
     * 应用参数到选中的路径对象
     */
    applyToActivePath() {
        const canvas = getCanvas(this);
        const activeObject = canvas?.getActiveObject();
        
        if (activeObject?.type === 'path') {
            activeObject.set({
                stroke: this.options.color,
                strokeWidth: this.options.width
            });
            canvas.renderAll();
        }
    }

    /**
     * 工具激活时的处理
     */
    onActivate(editLayerManager) {
        if (!editLayerManager || !editLayerManager.getFabricCanvas) {
            console.error('画笔工具激活失败：editLayerManager 无效');
            return;
        }
        
        this.fabricCanvas = editLayerManager.getFabricCanvas();
        
        if (!this.fabricCanvas) {
            console.error('画笔工具激活失败：fabricCanvas 为空');
            return;
        }
        
        // 从子工具栏获取当前参数值
        this.syncParametersFromSubToolbar();
        
        // 启用绘画模式
        editLayerManager.enableDrawingMode(this.brushOptions);
        
        // 设置画笔类型（确保使用正确的画笔）
        const brushType = this.options.brushType || 'Pencil';
        this.setBrushType(brushType);
        
        // 监听路径创建完成事件，优化性能
        this.pathCreatedHandler = (e) => {
            if (e.path) {
                // 启用对象缓存来提升性能
                e.path.objectCaching = true;
                
                // 对于复杂路径（喷雾、圆形、图案画笔），设置更激进的缓存
                if (this.options.brushType === 'Spray' || 
                    this.options.brushType === 'Circle' ||
                    ['hline', 'vline', 'square', 'diamond'].includes(this.options.brushType)) {
                    e.path.statefullCache = true;
                }
            }
        };
        this.fabricCanvas.on('path:created', this.pathCreatedHandler);
        
        // 设置光标
        document.body.style.cursor = 'crosshair';
        
        // 应用画笔选项
        this.applyBrushOptions();
    }

    /**
     * 从子工具栏同步参数值
     */
    syncParametersFromSubToolbar() {
        const params = getToolParams('brush');
        for (const [name, value] of Object.entries(params)) {
            this.applyParameter(name, value);
        }
    }

    /**
     * 工具取消激活时的处理
     */
    onDeactivate(editLayerManager) {
        // 移除路径创建事件监听器
        if (this.fabricCanvas && this.pathCreatedHandler) {
            this.fabricCanvas.off('path:created', this.pathCreatedHandler);
            this.pathCreatedHandler = null;
        }
        
        if (editLayerManager && editLayerManager.disableDrawingMode) {
            // 禁用绘画模式
            editLayerManager.disableDrawingMode();
        }
        
        // 恢复默认光标
        document.body.style.cursor = 'default';
        
        this.fabricCanvas = null;
    }

    /**
     * 设置画笔颜色
     */
    setColor(color) {
        this.setOptions({ color });
    }

    /**
     * 设置画笔宽度
     */
    setWidth(width) {
        this.setOptions({ width });
    }

    getColor() {
        return this.options.color;
    }

    getWidth() {
        return this.options.width;
    }
}
