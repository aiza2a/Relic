/**
 * Fabric.js 水印工具
 */
import { getCanvas, applyOpacity, getToolParams } from './common-utils.js';

export class FabricWatermarkTool {
    constructor() {
        this.name = 'watermark';
        this.fabricCanvas = null;
        this.editLayerManager = null;  // 保存引用以便随时获取 fabricCanvas
        this.watermarkGroup = null;     // 当前的水印组对象
        
        // 统一参数结构
        this.options = {
            enabled: false,             // 是否启用水印
            text: '水印文字',           // 水印文字
            fontSize: 24,               // 字体大小
            color: '#000000',           // 文字颜色（通用参数）
            opacity: 30,                // 透明度（通用参数）
            rotation: -45,              // 旋转角度
            spacing: 100                // 平铺间距
        };
    }

    /**
     * 设置Fabric Canvas引用
     */
    setFabricCanvas(fabricCanvas) {
        this.fabricCanvas = fabricCanvas;
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
            case 'enabled':
                this.options.enabled = value;
                break;
            case 'text':
                this.options.text = value;
                break;
            case 'fontSize':
                this.options.fontSize = value;
                break;
            case 'color':
                this.options.color = value;
                break;
            case 'opacity':
                this.options.opacity = value;
                break;
            case 'rotation':
                this.options.rotation = value;
                break;
            case 'spacing':
                this.options.spacing = value;
                break;
        }
        
        // 参数变化时实时更新水印
        // 确保有 fabricCanvas 引用
        if (!this.fabricCanvas && this.editLayerManager) {
            this.fabricCanvas = this.editLayerManager.getFabricCanvas();
        }
        
        if (this.fabricCanvas) {
            this.updateWatermark();
        }
    }

    /**
     * 工具激活时的处理
     */
    onActivate(editLayerManager) {
        if (!editLayerManager || !editLayerManager.getFabricCanvas) {
            console.error('水印工具激活失败：editLayerManager 无效');
            return;
        }
        
        // 保存 editLayerManager 引用，以便随时获取 fabricCanvas
        this.editLayerManager = editLayerManager;
        this.fabricCanvas = editLayerManager.getFabricCanvas();
        
        if (!this.fabricCanvas) {
            console.error('水印工具激活失败：fabricCanvas 为空');
            return;
        }
        
        // 从子工具栏同步参数值到 options（不触发更新）
        const params = getToolParams('watermark');
        for (const [name, value] of Object.entries(params)) {
            if (this.options.hasOwnProperty(name)) {
                this.options[name] = value;
            }
        }
        
        // 禁用选择模式
        editLayerManager.prepareSelectionForTool('watermark');
    }


    /**
     * 创建水印
     */
    createWatermark() {
        if (!this.fabricCanvas || !this.options.text) return;
        
        const canvasWidth = this.fabricCanvas.width;
        const canvasHeight = this.fabricCanvas.height;
        
        // 应用透明度到颜色
        const watermarkColor = applyOpacity(this.options.color, this.options.opacity);
        
        const originalFireEvents = this.fabricCanvas.fire;
        const originalRenderOnAddRemove = this.fabricCanvas.renderOnAddRemove;
        this.fabricCanvas.fire = () => {};
        this.fabricCanvas.renderOnAddRemove = false;
        
        if (this.watermarkGroup) {
            // 已存在水印对象，只更新 Pattern
            this.updateWatermarkPattern(watermarkColor);
        } else {
            // 首次创建水印对象
            this.createWatermarkRect(canvasWidth, canvasHeight, watermarkColor);
        }
        
        // 恢复事件触发和自动渲染
        this.fabricCanvas.fire = originalFireEvents;
        this.fabricCanvas.renderOnAddRemove = originalRenderOnAddRemove;
        
        // 将水印移到最底层
        if (this.watermarkGroup) {
            const objects = this.fabricCanvas.getObjects();
            const watermarkIndex = objects.indexOf(this.watermarkGroup);
            if (watermarkIndex > 0) {
                objects.splice(watermarkIndex, 1);
                objects.unshift(this.watermarkGroup);
                this.fabricCanvas._objects = objects;
            }
        }
        
        // 手动触发一次渲染
        this.fabricCanvas.requestRenderAll();
    }

    /**
     * 更新水印（参数变化时）
     */
    updateWatermark() {
        if (this.options.enabled) {
            // 启用状态：重新创建水印
            this.createWatermark();
        } else {
            // 禁用状态：移除水印
            this.removeWatermark();
        }
    }

    /**
     * 移除水印
     */
    removeWatermark() {
        if (!this.fabricCanvas) return;
        
        if (this.watermarkGroup) {
            const originalFireEvents = this.fabricCanvas.fire;
            const originalRenderOnAddRemove = this.fabricCanvas.renderOnAddRemove;
            this.fabricCanvas.fire = () => {};
            this.fabricCanvas.renderOnAddRemove = false;
            
            this.fabricCanvas.remove(this.watermarkGroup);
            this.watermarkGroup = null;
            
            // 恢复事件触发和自动渲染
            this.fabricCanvas.fire = originalFireEvents;
            this.fabricCanvas.renderOnAddRemove = originalRenderOnAddRemove;
            
            // 手动触发一次渲染
            this.fabricCanvas.requestRenderAll();
        }
    }

    /**
     * 创建水印矩形（使用 Pattern 填充）
     */
    createWatermarkRect(canvasWidth, canvasHeight, color) {
        // 创建 Pattern
        const pattern = this.createWatermarkPattern(color);
        
        // 创建覆盖整个画布的矩形
        this.watermarkGroup = new fabric.Rect({
            left: 0,
            top: 0,
            width: canvasWidth,
            height: canvasHeight,
            fill: pattern,
            selectable: false,
            evented: false,
            hasControls: false,
            hasBorders: false,
            lockMovementX: true,
            lockMovementY: true,
            objectCaching: false,
            customType: 'watermark'
        });
        
        this.fabricCanvas.add(this.watermarkGroup);
    }

    /**
     * 更新水印 Pattern
     */
    updateWatermarkPattern(color) {
        if (!this.watermarkGroup) return;
        
        // 重新创建 Pattern
        const pattern = this.createWatermarkPattern(color);
        this.watermarkGroup.set('fill', pattern);
    }

    /**
     * 创建水印 Pattern（离屏 Canvas）
     */
    createWatermarkPattern(color) {
        const spacing = this.options.spacing;
        const fontSize = this.options.fontSize;
        const rotation = this.options.rotation;
        const text = this.options.text;
        
        // 使用高分辨率渲染消除锯齿
        const scale = window.devicePixelRatio || 2;
        
        // 创建离屏 Canvas
        const patternCanvas = document.createElement('canvas');
        const ctx = patternCanvas.getContext('2d');
        
        // Pattern 尺寸（逻辑尺寸）
        const logicalWidth = spacing;
        const logicalHeight = spacing;
        
        // 设置物理尺寸（放大以消除锯齿）
        patternCanvas.width = logicalWidth * scale;
        patternCanvas.height = logicalHeight * scale;
        
        // 缩放上下文以匹配物理尺寸
        ctx.scale(scale, scale);
        
        // 设置字体（使用逻辑尺寸）
        ctx.font = `${fontSize}px Arial, Microsoft YaHei, sans-serif`;
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // 绘制平铺水印
        ctx.save();
        ctx.translate(spacing / 2, spacing / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.fillText(text, 0, 0);
        ctx.restore();
        
        // 创建 Fabric.js Pattern，指定缩放比例
        return new fabric.Pattern({
            source: patternCanvas,
            repeat: 'repeat',
            patternTransform: [1/scale, 0, 0, 1/scale, 0, 0]  // 缩小到逻辑尺寸
        });
    }


    /**
     * 从子工具栏同步参数值
     */
    syncParametersFromSubToolbar() {
        const params = getToolParams('watermark');
        for (const [name, value] of Object.entries(params)) {
            this.applyParameter(name, value);
        }
    }

    /**
     * 工具取消激活时的处理
     */
    onDeactivate(editLayerManager) {
 
    }
}
