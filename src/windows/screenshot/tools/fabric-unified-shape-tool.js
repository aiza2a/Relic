/**
 * Fabric.js 形状工具
 */
import * as fabric from 'fabric';
import { getCanvas, applyOpacity, getToolParams } from './common-utils.js';

export class FabricUnifiedShapeTool {
    constructor() {
        this.name = 'shape';
        this.editLayerManager = null;
        this.fabricCanvas = null;
        this.isActive = false;
        this.isDrawing = false;
        this.startPoint = null;
        this.currentShape = null;
        this.currentShapeType = 'rectangle';
        
        // 统一参数结构
        this.options = {
            fill: 'transparent',
            stroke: '#ff0000',
            strokeWidth: 2,
            strokeDashArray: null
        };
        
        this.fillColorValue = '#ff0000';
        
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
    }

    /**
     * 设置当前形状类型
     */
    setShapeType(shapeType) {
        this.currentShapeType = shapeType;
    }

    /**
     * 获取当前形状类型
     */
    getShapeType() {
        return this.currentShapeType;
    }

    setOptions(options) {
        Object.assign(this.options, options);
    }

    getOptions() {
        return { ...this.options };
    }

    applyParameter(paramName, value) {
        switch (paramName) {
            case 'color':
                this.options.stroke = value;
                if (this.options.fill !== 'transparent') {
                    this.options.fill = value;
                }
                break;
            case 'opacity':
                this.options.stroke = applyOpacity(this.options.stroke, value);
                if (this.options.fill !== 'transparent') {
                    this.options.fill = applyOpacity(this.options.fill, value);
                }
                break;
            case 'strokeWidth':
                this.options.strokeWidth = value;
                break;
            case 'filled':
                this.options.fill = value ? this.fillColorValue : 'transparent';
                break;
            case 'fillColor':
                this.fillColorValue = value;
                if (this.options.fill !== 'transparent') {
                    this.options.fill = value;
                }
                break;
            case 'shapeType':
                this.setShapeType(value);
                break;
        }
        
        this.applyToActiveShape();
    }

    /**
     * 应用参数到选中的形状对象
     */
    applyToActiveShape() {
        const canvas = getCanvas(this);
        const activeObject = canvas?.getActiveObject();
        
        if (activeObject && ['rect', 'circle', 'ellipse', 'polygon', 'path'].includes(activeObject.type)) {
            // 支持矩形、圆形、椭圆、多边形和路径（箭头形状）
            activeObject.set(this.options);
            canvas.renderAll();
        }
    }

    /**
     * 工具激活时的处理
     */
    onActivate(editLayerManager) {
        if (!editLayerManager || !editLayerManager.getFabricCanvas) {
            console.error('形状工具激活失败：editLayerManager 无效');
            return;
        }
        
        this.editLayerManager = editLayerManager;
        this.fabricCanvas = editLayerManager.getFabricCanvas();
        
        if (!this.fabricCanvas) {
            console.error('形状工具激活失败：fabricCanvas 为空');
            return;
        }
        
        this.isActive = true;
        
        // 确保不在绘画模式，禁用选择功能专注于创建
        this.fabricCanvas.isDrawingMode = false;
        this.fabricCanvas.selection = false;
        this.fabricCanvas.forEachObject((obj) => {
            obj.selectable = false;
        });
        
        // 设置光标
        document.body.style.cursor = 'crosshair';
        
        // 从子工具栏获取当前参数值
        this.syncParametersFromSubToolbar();
        
        // 添加事件监听器
        if (this.fabricCanvas) {
            this.fabricCanvas.on('mouse:down', this.handleMouseDown);
            this.fabricCanvas.on('mouse:move', this.handleMouseMove);
            this.fabricCanvas.on('mouse:up', this.handleMouseUp);
        }
    }

    /**
     * 从子工具栏同步参数值
     */
    syncParametersFromSubToolbar() {
        const params = getToolParams('shape');
        for (const [name, value] of Object.entries(params)) {
            this.applyParameter(name, value);
        }
    }

    /**
     * 工具取消激活时的处理
     */
    onDeactivate(editLayerManager) {
        this.isActive = false;
        this.isDrawing = false;
        this.startPoint = null;
        this.currentShape = null;
        
        // 恢复光标
        document.body.style.cursor = 'default';
        
        // 移除事件监听器
        if (this.fabricCanvas) {
            this.fabricCanvas.off('mouse:down', this.handleMouseDown);
            this.fabricCanvas.off('mouse:move', this.handleMouseMove);
            this.fabricCanvas.off('mouse:up', this.handleMouseUp);
        }
    }

    /**
     * 处理鼠标按下事件
     */
    handleMouseDown(options) {
        if (!this.isActive) return;
        
        const pointer = this.fabricCanvas.getPointer(options.e);
        this.startPoint = { x: pointer.x, y: pointer.y };
        this.isDrawing = true;
        
        // 创建预览形状（初始大小）
        let initialWidth = 1;
        let initialHeight = 1;
        
        // 对于箭头形状，需要更大的初始大小
        if (this.currentShapeType === 'arrow') {
            initialWidth = 50;  // 给箭头一个合适的初始长度
            initialHeight = 0;  // 水平箭头
        }
        
        this.currentShape = this.createShape(
            this.startPoint.x, 
            this.startPoint.y, 
            initialWidth, 
            initialHeight, 
            this.options
        );
        
        if (this.currentShape) {
            this.currentShape.excludeFromHistory = true;
            this.fabricCanvas.add(this.currentShape);
            this.fabricCanvas.renderAll();
        }
    }

    /**
     * 处理鼠标移动事件
     */
    handleMouseMove(options) {
        if (!this.isActive || !this.isDrawing || !this.startPoint || !this.currentShape) return;
        
        const pointer = this.fabricCanvas.getPointer(options.e);
        
        // 更新形状
        this.updateShape(this.currentShape, this.startPoint, pointer);
        this.fabricCanvas.renderAll();
    }

    /**
     * 处理鼠标松开事件
     */
    handleMouseUp(options) {
        if (!this.isActive || !this.isDrawing || !this.startPoint) return;
        
        const pointer = this.fabricCanvas.getPointer(options.e);
        const distance = Math.sqrt(
            Math.pow(pointer.x - this.startPoint.x, 2) + 
            Math.pow(pointer.y - this.startPoint.y, 2)
        );
        
        if (distance < 10) {
            // 距离太短，删除形状
            if (this.currentShape) {
                this.fabricCanvas.remove(this.currentShape);
            }
        } else {
            // 完成形状创建
            this.finishShape();
        }
        
        this.isDrawing = false;
        this.startPoint = null;
        this.currentShape = null;
        this.fabricCanvas.renderAll();
    }

    /**
     * 完成形状创建
     */
    finishShape() {
        if (!this.currentShape) return;
        this.currentShape.excludeFromHistory = false;
        
        // 标记对象可选择
        this.currentShape.selectable = true;
        this.currentShape.evented = true;
        this.currentShape.excludeFromHistory = false;

        if (this.editLayerManager && this.editLayerManager.requestHistorySave) {
            this.currentShape.historyAddReason = `创建${this.getShapeTypeLabel()}`;
            this.editLayerManager.requestHistorySave(`创建${this.getShapeTypeLabel()}`, { immediate: true });
        }
        
        // 切换到选择工具并选中新创建的形状
        if (window.screenshotController && window.screenshotController.toolManager) {
            window.screenshotController.toolManager.switchToSelectionTool(this.currentShape);
        }
    }

    getShapeTypeLabel() {
        switch (this.currentShapeType) {
            case 'rectangle':
                return '矩形';
            case 'circle':
                return '圆形';
            case 'ellipse':
                return '椭圆';
            case 'triangle':
                return '三角形';
            case 'diamond':
                return '菱形';
            case 'pentagon':
                return '五边形';
            case 'hexagon':
                return '六边形';
            case 'star':
                return '星形';
            case 'arrow':
                return '箭头形状';
            default:
                return '形状';
        }
    }

    createShape(x, y, width, height, options) {
        switch (this.currentShapeType) {
            case 'circle':
                const radius = Math.min(Math.abs(width), Math.abs(height)) / 2;
                const circle = new fabric.Circle({
                    radius,
                    left: x - radius,
                    top: y - radius,
                    ...options
                });
                circle.customType = 'circle';
                return circle;
                
            case 'ellipse':
                const ellipse = new fabric.Ellipse({
                    rx: Math.abs(width) / 2,
                    ry: Math.abs(height) / 2,
                    left: x,
                    top: y,
                    ...options
                });
                ellipse.customType = 'ellipse';
                return ellipse;
                
            case 'triangle':
                return this.createTriangle(x, y, width, height, options);
                
            case 'diamond':
                return this.createDiamond(x, y, width, height, options);
                
            case 'pentagon':
                return this.createPolygon(x, y, width, height, 5, options);
                
            case 'hexagon':
                return this.createPolygon(x, y, width, height, 6, options);
                
            case 'star':
                return this.createStar(x, y, width, height, options);
                
            case 'arrow':
                // 箭头形状 - 从起点到终点创建几何箭头
                const endX = x + width;
                const endY = y + height;
                const arrow = this.createArrowShape(x, y, endX, endY, options);
                if (arrow) {
                    arrow.customType = 'shape-arrow'; // 区分形状工具的箭头和箭头标注工具
                }
                return arrow;
                
            default: // rectangle
                const rect = new fabric.Rect({
                    left: x,
                    top: y,
                    width: Math.abs(width),
                    height: Math.abs(height),
                    ...options
                });
                rect.customType = 'rectangle';
                return rect;
        }
    }

    /**
     * 创建箭头形状（几何形状，可填充）
     */
    createArrowShape(startX, startY, endX, endY, options) {
        const length = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2);
        if (length < 3) return null;
        
        // 优化的箭头参数，让头部更突出
        const arrowWidth = Math.max(4, Math.min(8, length / 12));           // 轴线宽度（相对较细）
        const arrowHeadLength = Math.max(15, Math.min(30, length * 0.3));    // 头部长度
        const arrowHeadWidth = Math.max(arrowWidth * 2, Math.min(36, arrowHeadLength * 1.2)); // 头部宽度至少是轴线的2倍
        
        // 确保轴线长度不为负
        const shaftEnd = Math.max(0, length - arrowHeadLength);
        
        const pathCommands = [
            'M', 0, -arrowWidth/2,                    // 起点上边缘
            'L', shaftEnd, -arrowWidth/2,             // 轴线上边缘
            'L', shaftEnd, -arrowHeadWidth/2,         // 箭头上边缘
            'L', length, 0,                          // 箭头尖端
            'L', shaftEnd, arrowHeadWidth/2,          // 箭头下边缘
            'L', shaftEnd, arrowWidth/2,              // 轴线下边缘
            'L', 0, arrowWidth/2,                    // 起点下边缘
            'Z'                                      // 闭合路径
        ];
        
        const pathString = pathCommands.join(' ');
        
        try {
            const path = new fabric.Path(pathString, {
                ...options,
                left: startX,
                top: startY,
                originX: 'left',
                originY: 'center'
            });
            
            // 计算旋转角度
            const angle = Math.atan2(endY - startY, endX - startX) * 180 / Math.PI;
            path.set({ angle: angle });
            
            return path;
            
        } catch (error) {
            // 如果Path创建失败，使用矩形作为替代方案
            const rect = new fabric.Rect({
                left: startX,
                top: startY - arrowWidth/4,
                width: length * 0.7,
                height: arrowWidth/2,
                ...options
            });
            
            // 计算旋转角度
            const angle = Math.atan2(endY - startY, endX - startX) * 180 / Math.PI;
            rect.set({ 
                angle: angle,
                originX: 'left',
                originY: 'center'
            });
            
            return rect;
        }
    }

    /**
     * 创建三角形
     */
    createTriangle(x, y, width, height, options) {
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        const size = Math.min(Math.abs(width), Math.abs(height)) / 2;
        
        const points = [
            { x: centerX, y: centerY - size },           // 顶部
            { x: centerX - size * 0.866, y: centerY + size * 0.5 },  // 左下
            { x: centerX + size * 0.866, y: centerY + size * 0.5 }   // 右下
        ];
        
        const triangle = new fabric.Polygon(points, {
            ...options,
            left: x,
            top: y
        });
        triangle.customType = 'triangle';
        return triangle;
    }

    /**
     * 创建菱形
     */
    createDiamond(x, y, width, height, options) {
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        const halfWidth = Math.abs(width) / 2;
        const halfHeight = Math.abs(height) / 2;
        
        const points = [
            { x: centerX, y: centerY - halfHeight },      // 上
            { x: centerX + halfWidth, y: centerY },       // 右
            { x: centerX, y: centerY + halfHeight },      // 下
            { x: centerX - halfWidth, y: centerY }        // 左
        ];
        
        const diamond = new fabric.Polygon(points, {
            ...options,
            left: x,
            top: y
        });
        diamond.customType = 'diamond';
        return diamond;
    }

    /**
     * 创建正多边形
     */
    createPolygon(x, y, width, height, sides, options) {
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        const radius = Math.min(Math.abs(width), Math.abs(height)) / 2;
        
        const points = [];
        for (let i = 0; i < sides; i++) {
            const angle = (i * 2 * Math.PI) / sides - Math.PI / 2; // 从顶部开始
            points.push({
                x: centerX + radius * Math.cos(angle),
                y: centerY + radius * Math.sin(angle)
            });
        }
        
        const polygon = new fabric.Polygon(points, {
            ...options,
            left: x,
            top: y
        });
        polygon.customType = `${sides}-gon`;
        return polygon;
    }

    /**
     * 创建星形
     */
    createStar(x, y, width, height, options) {
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        const outerRadius = Math.min(Math.abs(width), Math.abs(height)) / 2;
        const innerRadius = outerRadius * 0.4;
        const numPoints = 5;
        
        const points = [];
        for (let i = 0; i < numPoints * 2; i++) {
            const angle = (i * Math.PI) / numPoints - Math.PI / 2;
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            points.push({
                x: centerX + radius * Math.cos(angle),
                y: centerY + radius * Math.sin(angle)
            });
        }
        
        const star = new fabric.Polygon(points, {
            ...options,
            left: x,
            top: y
        });
        star.customType = 'star';
        return star;
    }

    /**
     * 更新形状
     */
    updateShape(shape, startPoint, currentPoint) {
        if (!shape || !startPoint) return;
        
        const width = currentPoint.x - startPoint.x;
        const height = currentPoint.y - startPoint.y;
        const left = Math.min(startPoint.x, currentPoint.x);
        const top = Math.min(startPoint.y, currentPoint.y);

        switch (this.currentShapeType) {
            case 'rectangle':
                shape.set({
                    left,
                    top,
                    width: Math.abs(width),
                    height: Math.abs(height)
                });
                break;
                
            case 'circle':
                const radius = Math.min(Math.abs(width), Math.abs(height)) / 2;
                shape.set({
                    radius,
                    left: startPoint.x - radius,
                    top: startPoint.y - radius
                });
                break;
                
            case 'ellipse':
                shape.set({
                    rx: Math.abs(width) / 2,
                    ry: Math.abs(height) / 2,
                    left,
                    top
                });
                break;
                
            case 'triangle':
            case 'diamond':
            case 'pentagon':
            case 'hexagon':
            case 'star':
            case 'arrow':
                // 对于多边形和复杂形状，需要重新创建
                const newShape = this.createShape(
                    startPoint.x,
                    startPoint.y,
                    width,
                    height,
                    this.options
                );
                if (newShape) {
                    // 移除旧形状并添加新形状
                    this.fabricCanvas.remove(shape);
                    newShape.excludeFromHistory = true;
                    this.fabricCanvas.add(newShape);
                    this.currentShape = newShape;
                }
                break;
        }
    }
}
