/**
 * Fabric.js 箭头工具
 */
import * as fabric from 'fabric';
import { classRegistry as fabricClassRegistry } from 'fabric';
import { getCanvas, applyOpacity, getToolParams } from './common-utils.js';

// 修复1：直接继承 fabric.Path，统一坐标系
export class Arrow extends fabric.Path {
    static TYPE = 'arrow';
    static DEFAULT_ARROW_HEAD_LENGTH = 18;
    static ARROW_HEAD_ANGLE = Math.PI / 6;

    constructor(startPoint, endPoint, options = {}) {
        // 创建初始占位路径
        super('M 0 0 L 10 0', {
            fill: 'transparent',
            stroke: options?.stroke || '#ff0000',
            strokeWidth: options?.strokeWidth || 2,
            opacity: options?.opacity ?? 1,
            hasControls: true,
            selectable: true,
            evented: true,
            left: 0,
            top: 0,
            objectCaching: false,
            noScaleCache: true,
            ...options
        });
        this.objectCaching = false;
        this.noScaleCache = true;
        this.arrowOptions = {
            stroke: options?.stroke || this.stroke || '#ff0000',
            strokeWidth: options?.strokeWidth || this.strokeWidth || 2,
            opacity: options?.opacity ?? this.opacity ?? 1,
            arrowHeadSize: options?.arrowHeadSize || Arrow.DEFAULT_ARROW_HEAD_LENGTH,
            arrowStyle: options?.arrowStyle || 'solid',
            strokeDashArray: options?.strokeDashArray || null
        };
        
        if (this.arrowOptions.strokeDashArray) {
            this.set({ strokeDashArray: this.arrowOptions.strokeDashArray });
        }

        // 存储世界坐标
        this.worldStartPoint = { x: startPoint.x, y: startPoint.y };
        this.worldEndPoint = { x: endPoint.x, y: endPoint.y };
        this.worldMiddlePoint = {
            x: (startPoint.x + endPoint.x) / 2,
            y: (startPoint.y + endPoint.y) / 2
        };
        
        // 初始化局部坐标
        this.localStartPoint = { x: 0, y: 0 };
        this.localEndPoint = { x: 0, y: 0 };
        this.localMiddlePoint = { x: 0, y: 0 };
        
        this.setupCustomControls();
        
        // 监听对象移动事件，同步更新世界坐标
        this.on('moving', this.updateWorldCoordinates.bind(this));
        this.on('modified', this.updateWorldCoordinates.bind(this));

        // 根据当前世界坐标计算几何信A
        this.customType = Arrow.TYPE;
        this.recalculateGeometryFromWorldPoints();
    }

    toObject(propertiesToInclude = []) {
        const baseObject = super.toObject(propertiesToInclude);
        return {
            ...baseObject,
            type: Arrow.TYPE,
            customType: Arrow.TYPE,
            arrowOptions: { ...this.arrowOptions },
            worldStartPoint: { ...this.worldStartPoint },
            worldMiddlePoint: { ...this.worldMiddlePoint },
            worldEndPoint: { ...this.worldEndPoint }
        };
    }

    static async fromObject(object, callback) {
        return Arrow._fromObjectInternal(object, callback);
    }

    static fromObject(object, callback) {
        return Promise.resolve(Arrow._fromObjectInternal(object, callback));
    }

    static _fromObjectInternal(object, callback) {
        const {
            worldStartPoint,
            worldMiddlePoint,
            worldEndPoint,
            arrowOptions,
            customType,
            ...rest
        } = object;

        const start = worldStartPoint || { x: 0, y: 0 };
        const end = worldEndPoint || { x: 100, y: 0 };
        const middle = worldMiddlePoint || {
            x: (start.x + end.x) / 2,
            y: (start.y + end.y) / 2
        };

        const arrow = new Arrow(start, end, arrowOptions || {});

        arrow.worldStartPoint = { ...start };
        arrow.worldMiddlePoint = { ...middle };
        arrow.worldEndPoint = { ...end };
        arrow.arrowOptions = { ...arrow.arrowOptions, ...(arrowOptions || {}) };

        const { type, arrowOptions: ignoredOptions, customType: ignoredCustomType, ...restOptions } = rest || {};
        arrow.set({ ...restOptions, arrowOptions: arrow.arrowOptions });
        arrow.customType = customType || ignoredCustomType || Arrow.TYPE;
        arrow.recalculateGeometryFromWorldPoints();
        arrow.updateWorldCoordinates();
        arrow.setCoords();

        if (typeof callback === 'function') {
            callback(arrow);
        }
        return arrow;
    }
    
    // 当对象移动时，同步更新世界坐标
    updateWorldCoordinates() {
        const offsetX = (this.left ?? 0) - (this.pathOffset?.x ?? 0);
        const offsetY = (this.top ?? 0) - (this.pathOffset?.y ?? 0);
        this.worldStartPoint = {
            x: this.localStartPoint.x + offsetX,
            y: this.localStartPoint.y + offsetY
        };
        this.worldMiddlePoint = {
            x: this.localMiddlePoint.x + offsetX,
            y: this.localMiddlePoint.y + offsetY
        };
        this.worldEndPoint = {
            x: this.localEndPoint.x + offsetX,
            y: this.localEndPoint.y + offsetY
        };
    }
    
    static createArrowPathString(start, end, middle, controlOverride, options = {}) {
        const control = controlOverride || Arrow.computeQuadraticControlPoint(start, middle, end);
        const { angle } = Arrow.computeArrowHeadGeometry(start, control, end, options.arrowHeadSize ?? Arrow.DEFAULT_ARROW_HEAD_LENGTH);
        const arrowLength = options.arrowHeadSize ?? Arrow.DEFAULT_ARROW_HEAD_LENGTH;
        const arrowAngle = Arrow.ARROW_HEAD_ANGLE;
        
        const headX1 = end.x - arrowLength * Math.cos(angle - arrowAngle);
        const headY1 = end.y - arrowLength * Math.sin(angle - arrowAngle);
        const headX2 = end.x - arrowLength * Math.cos(angle + arrowAngle);
        const headY2 = end.y - arrowLength * Math.sin(angle + arrowAngle);
        
        // 创建路径字符串
        const pathString = `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y} M ${headX1} ${headY1} L ${end.x} ${end.y} L ${headX2} ${headY2}`;
        return { pathString, excludeFromHistory: true };
    }

    static computeQuadraticControlPoint(start, middle, end) {
        return {
            x: 2 * middle.x - 0.5 * (start.x + end.x),
            y: 2 * middle.y - 0.5 * (start.y + end.y)
        };
    }

    static computeArrowHeadGeometry(start, control, end, arrowHeadSize = Arrow.DEFAULT_ARROW_HEAD_LENGTH) {
        let dx = end.x - control.x;
        let dy = end.y - control.y;
        if (Math.abs(dx) < 0.0001 && Math.abs(dy) < 0.0001) {
            dx = end.x - start.x;
            dy = end.y - start.y;
        }

        const angle = Math.atan2(dy, dx);
        const length = arrowHeadSize;
        const headAngle = Arrow.ARROW_HEAD_ANGLE;

        const head1 = {
            x: end.x - length * Math.cos(angle - headAngle),
            y: end.y - length * Math.sin(angle - headAngle)
        };
        const head2 = {
            x: end.x - length * Math.cos(angle + headAngle),
            y: end.y - length * Math.sin(angle + headAngle)
        };

        return { angle, head1, head2 };
    }

    static evaluateQuadraticPoint(start, control, end, t) {
        const mt = 1 - t;
        const x = mt * mt * start.x + 2 * mt * t * control.x + t * t * end.x;
        const y = mt * mt * start.y + 2 * mt * t * control.y + t * t * end.y;
        return { x, y };
    }

    static computeCurveBounds(start, control, end) {
        const candidates = [0, 1];

        const denomX = start.x - 2 * control.x + end.x;
        if (Math.abs(denomX) > 1e-6) {
            const tx = (start.x - control.x) / denomX;
            if (tx > 0 && tx < 1) candidates.push(tx);
        }

        const denomY = start.y - 2 * control.y + end.y;
        if (Math.abs(denomY) > 1e-6) {
            const ty = (start.y - control.y) / denomY;
            if (ty > 0 && ty < 1) candidates.push(ty);
        }

        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;

        candidates.forEach((t) => {
            const point = Arrow.evaluateQuadraticPoint(start, control, end, t);
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
            minY = Math.min(minY, point.y);
            maxY = Math.max(maxY, point.y);
        });

        return { minX, maxX, minY, maxY };
    }
    
    setupCustomControls() {
        this.controls = {};
        
        // 起点控制
        this.controls.startPoint = new fabric.Control({
            x: 0, y: 0,
            cursorStyle: 'move',
            actionHandler: this.changeStartPoint.bind(this),
            render: function(ctx, left, top) {
                const size = 12;
                ctx.save();
                ctx.fillStyle = '#00ff00';
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(left, top, size / 2, 0, 2 * Math.PI);
                ctx.fill();
                ctx.stroke();
                ctx.restore();
            },
            positionHandler: this.startPointPositionHandler.bind(this)
        });
        
        // 中点控制
        this.controls.middlePoint = new fabric.Control({
            x: 0, y: 0,
            cursorStyle: 'move',
            actionHandler: this.changeMiddlePoint.bind(this),
            render: function(ctx, left, top) {
                const size = 12;
                ctx.save();
                ctx.fillStyle = '#ffff00';
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(left, top, size / 2, 0, 2 * Math.PI);
                ctx.fill();
                ctx.stroke();
                ctx.restore();
            },
            positionHandler: this.middlePointPositionHandler.bind(this)
        });
        
        // 终点控制
        this.controls.endPoint = new fabric.Control({
            x: 0, y: 0,
            cursorStyle: 'move',
            actionHandler: this.changeEndPoint.bind(this),
            render: function(ctx, left, top) {
                const size = 12;
                ctx.save();
                ctx.fillStyle = '#ff0000';
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(left, top, size / 2, 0, 2 * Math.PI);
                ctx.fill();
                ctx.stroke();
                ctx.restore();
            },
            positionHandler: this.endPointPositionHandler.bind(this)
        });
        
        // 修复4：显式启用自定义控制点
        this.setControlsVisibility({
            mt: false, mb: false, ml: false, mr: false,
            tl: false, tr: false, bl: false, br: false,
            mtr: false,
            startPoint: true,
            middlePoint: true,
            endPoint: true
        });
    }
    
    // 直接返回世界坐标，无需变换
    startPointPositionHandler() {
        return new fabric.Point(this.worldStartPoint.x, this.worldStartPoint.y);
    }
    
    middlePointPositionHandler() {
        return new fabric.Point(this.worldMiddlePoint.x, this.worldMiddlePoint.y);
    }
    
    endPointPositionHandler() {
        return new fabric.Point(this.worldEndPoint.x, this.worldEndPoint.y);
    }
    
    // 同时更新世界坐标和局部坐标
    changeStartPoint(eventData, transform, x, y) {
        this.setWorldGeometry({ x, y }, this.worldEndPoint, this.worldMiddlePoint);
        return true;
    }
    
    changeMiddlePoint(eventData, transform, x, y) {
        this.setWorldGeometry(this.worldStartPoint, this.worldEndPoint, { x, y });
        return true;
    }
    
    changeEndPoint(eventData, transform, x, y) {
        this.setWorldGeometry(this.worldStartPoint, { x, y }, this.worldMiddlePoint);
        return true;
    }

    setWorldGeometry(startPoint, endPoint, middlePoint) {
        const start = startPoint ? { x: startPoint.x, y: startPoint.y } : this.worldStartPoint;
        const end = endPoint ? { x: endPoint.x, y: endPoint.y } : this.worldEndPoint;
        const middle = middlePoint
            ? { x: middlePoint.x, y: middlePoint.y }
            : {
                x: (start.x + end.x) / 2,
                y: (start.y + end.y) / 2
            };

        this.worldStartPoint = start;
        this.worldEndPoint = end;
        this.worldMiddlePoint = middle;

        this.recalculateGeometryFromWorldPoints();
    }
    
    recalculateGeometryFromWorldPoints() {
        const points = [
            this.worldStartPoint,
            this.worldMiddlePoint,
            this.worldEndPoint
        ];

        const controlPoint = Arrow.computeQuadraticControlPoint(
            this.worldStartPoint,
            this.worldMiddlePoint,
            this.worldEndPoint
        );

        const arrowHeadSize = this.arrowOptions.arrowHeadSize ?? Arrow.DEFAULT_ARROW_HEAD_LENGTH;
        const { head1, head2 } = Arrow.computeArrowHeadGeometry(
            this.worldStartPoint,
            controlPoint,
            this.worldEndPoint,
            arrowHeadSize
        );

        const curveBounds = Arrow.computeCurveBounds(
            this.worldStartPoint,
            controlPoint,
            this.worldEndPoint
        );

        points.push(head1, head2);

        const padding = Math.max(this.strokeWidth || 2, 4);
        const minX = Math.min(curveBounds.minX, ...points.map(p => p.x)) - padding;
        const minY = Math.min(curveBounds.minY, ...points.map(p => p.y)) - padding;
        const maxX = Math.max(curveBounds.maxX, ...points.map(p => p.x)) + padding;
        const maxY = Math.max(curveBounds.maxY, ...points.map(p => p.y)) + padding;

        const width = maxX - minX;
        const height = maxY - minY;

        // 更新局部坐标（相对于边界框左上角）
        this.localStartPoint = {
            x: this.worldStartPoint.x - minX,
            y: this.worldStartPoint.y - minY
        };
        this.localMiddlePoint = {
            x: this.worldMiddlePoint.x - minX,
            y: this.worldMiddlePoint.y - minY
        };
        this.localEndPoint = {
            x: this.worldEndPoint.x - minX,
            y: this.worldEndPoint.y - minY
        };

        const localControlPoint = {
            x: controlPoint.x - minX,
            y: controlPoint.y - minY
        };

        const pathOptions = {
            arrowHeadSize,
            arrowStyle: this.arrowOptions.arrowStyle,
            strokeDashArray: this.arrowOptions.arrowStyle === 'dashed' ? [12, 6] : null
        };

        const { pathString, excludeFromHistory } = Arrow.createArrowPathString(
            this.localStartPoint,
            this.localEndPoint,
            this.localMiddlePoint,
            localControlPoint,
            pathOptions
        );

        const pathArray = fabric.util.parsePath(pathString);
        this.set({
            strokeDashArray: pathOptions.strokeDashArray || null
        });
        this._setPath(pathArray);
        this.dirty = true;

        if (!this.pathOffset) {
            this.pathOffset = new fabric.Point(0, 0);
        }
        this.pathOffset.setXY(width / 2, height / 2);
        const centerX = minX + width / 2;
        const centerY = minY + height / 2;
        this.set({ left: centerX, top: centerY, originX: 'center', originY: 'center' });
        this.width = width;
        this.height = height;
        this.setCoords();

        if (this.canvas) {
            this.canvas.requestRenderAll();
        }
        return excludeFromHistory;
    }
}
Arrow.fromObject = (object, callback) => Promise.resolve(Arrow._fromObjectInternal(object, callback));
Arrow.async = true;
if (fabric?.util?.enlivenObjectEnliveners) {
  fabric.util.enlivenObjectEnliveners[Arrow.TYPE] = Arrow._fromObjectInternal;
  fabric.util.enlivenObjectAsyncEnliveners[Arrow.TYPE] = Arrow._fromObjectInternal;
}
export function registerArrowClass() {
    const registry = fabricClassRegistry ?? fabric?.util?.classRegistry;
    if (!registry?.setClass) return;

    const type = Arrow.TYPE;
    const capitalized = type.charAt(0).toUpperCase() + type.slice(1);

    const register = (cls, name, namespace) => {
        if (namespace) {
            registry.setClass(cls, name, namespace);
        } else {
            registry.setClass(cls, name);
        }
    };

    register(Arrow, type);
    register(Arrow, capitalized);
    register(Arrow, type, 'canvas');
    register(Arrow, type, 'svg');
    register(Arrow, type, 'async');
    register(Arrow.fromObject, type, 'fromObject');
    register(Arrow.fromObject, type, 'async');

    const patchClass = (name) => {
        const cls = registry.getClass?.(name);
        if (cls) {
            cls.fromObject = (object, callback) => Promise.resolve(Arrow._fromObjectInternal(object, callback));
            cls.async = true;
        }
    };

    patchClass(type);
    patchClass(capitalized);

    if (fabric?.util?.enlivenObjectEnliveners) {
        fabric.util.enlivenObjectEnliveners[type] = (object, callback) => Promise.resolve(Arrow._fromObjectInternal(object, callback));
    }
    if (fabric?.util?.enlivenObjectAsyncEnliveners) {
        fabric.util.enlivenObjectAsyncEnliveners[type] = (object, callback) => Promise.resolve(Arrow._fromObjectInternal(object, callback));
    }
}

registerArrowClass();

if (typeof window !== 'undefined') {
    try {
        if (window.fabric) {
            Object.defineProperty(window.fabric, 'registerArrowClass', {
                value: registerArrowClass,
                configurable: true,
                enumerable: false,
                writable: true
            });
        }
    } catch (error) {
        console.warn('Unable to define fabric.registerArrowClass:', error);
    }
}

export class FabricSimpleArrowTool {
    constructor() {
        this.name = 'arrow';
        this.editLayerManager = null;
        this.fabricCanvas = null;
        this.isActive = false;
        this.isDrawing = false;
        this.startPoint = null;
        this.previewArrow = null;
        
        // 统一参数结构
        this.options = {
            stroke: '#ff0000',
            strokeWidth: 2,
            opacity: 100,
            arrowHeadSize: Arrow.DEFAULT_ARROW_HEAD_LENGTH,
            arrowStyle: 'solid',
            strokeDashArray: null
        };
        
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
    }
    
    onActivate(editLayerManager) {
        if (!editLayerManager || !editLayerManager.getFabricCanvas) {
            console.error('箭头工具激活失败：editLayerManager 无效');
            return;
        }
        
        this.editLayerManager = editLayerManager;
        this.fabricCanvas = editLayerManager.getFabricCanvas();
        
        if (!this.fabricCanvas) {
            console.error('箭头工具激活失败：fabricCanvas 为空');
            return;
        }
        
        this.isActive = true;

        // 从子工具栏同步参数
        this.syncParametersFromSubToolbar();
        
        // 禁用选择模式，专注于创建
        this.fabricCanvas.isDrawingMode = false;
        this.fabricCanvas.selection = false;
        this.fabricCanvas.forEachObject((obj) => {
            obj.selectable = false;
        });
        
        document.body.style.cursor = 'crosshair';
        
        // 添加事件监听器
        this.fabricCanvas.on('mouse:down', this.handleMouseDown);
        this.fabricCanvas.on('mouse:move', this.handleMouseMove);
        this.fabricCanvas.on('mouse:up', this.handleMouseUp);
    }
    
    onDeactivate() {
        this.isActive = false;
        this.isDrawing = false;
        this.startPoint = null;
        
        document.body.style.cursor = 'default';
        
        // 移除事件监听器
        if (this.fabricCanvas) {
            this.fabricCanvas.off('mouse:down', this.handleMouseDown);
            this.fabricCanvas.off('mouse:move', this.handleMouseMove);
            this.fabricCanvas.off('mouse:up', this.handleMouseUp);
        }
    }
    
    handleMouseDown(options) {
        if (!this.isActive) return;
        const pointer = this.fabricCanvas.getPointer(options.e);
        this.startPoint = { x: pointer.x, y: pointer.y };
        this.isDrawing = true;

        // 使用子工具栏当前参数直接创建预览箭头
        const initialEnd = { x: this.startPoint.x + 0.1, y: this.startPoint.y + 0.1 };
        const arrow = new Arrow(this.startPoint, initialEnd, this.options);
        arrow.set({
            selectable: false,
            evented: false,
            hasControls: false,
            hoverCursor: 'default'
        });
        arrow.excludeFromExport = true;
        arrow.excludeFromHistory = true;
        arrow.preview = true;
        this.previewArrow = arrow;
        this.fabricCanvas.add(arrow);
        if (this.fabricCanvas.bringObjectToFront) {
            this.fabricCanvas.bringObjectToFront(arrow);
        }
    }
    
    handleMouseMove(options) {
        if (!this.isActive || !this.isDrawing || !this.startPoint || !this.previewArrow) return;
        const pointer = this.fabricCanvas.getPointer(options.e);
        const middlePoint = {
            x: (this.startPoint.x + pointer.x) / 2,
            y: (this.startPoint.y + pointer.y) / 2
        };
        this.previewArrow.setWorldGeometry(this.startPoint, { x: pointer.x, y: pointer.y }, middlePoint);
        this.fabricCanvas.requestRenderAll();
    }
    
    handleMouseUp(options) {
        if (!this.isActive || !this.isDrawing || !this.startPoint) return;

        const startPoint = { ...this.startPoint };
        const pointer = this.fabricCanvas.getPointer(options.e);
        const distance = Math.sqrt(
            Math.pow(pointer.x - startPoint.x, 2) + 
            Math.pow(pointer.y - startPoint.y, 2)
        );

        this.isDrawing = false;
        this.startPoint = null;
        
        const previewArrow = this.previewArrow;
        this.previewArrow = null;

        if (previewArrow) {
            this.fabricCanvas.remove(previewArrow);
        }

        if (distance > 10) {
            const finalArrow = new Arrow(startPoint, { x: pointer.x, y: pointer.y }, this.options);
            finalArrow.excludeFromHistory = false;
            finalArrow.set({
                selectable: true,
                evented: true,
                hasControls: true,
                hoverCursor: 'move'
            });
            finalArrow.historyAddReason = '创建箭头';
            this.fabricCanvas.add(finalArrow);

            if (this.editLayerManager && this.editLayerManager.requestHistorySave) {
                this.editLayerManager.requestHistorySave('创建箭头', { immediate: true });
            }

            if (this.editLayerManager) {
                this.editLayerManager.prepareSelectionForTool('selection');
            }
            if (window.screenshotController && window.screenshotController.toolManager) {
                window.screenshotController.toolManager.switchToSelectionTool(finalArrow);
            }
        }
    }
    
    applyParameter(paramName, value) {
        switch (paramName) {
            case 'color':
                this.options.stroke = value;
                break;
            case 'opacity':
                this.options.opacity = Math.max(0, Math.min(100, value));
                break;
            case 'strokeWidth':
                this.options.strokeWidth = Math.max(1, value);
                break;
            case 'arrowHeadSize':
                this.options.arrowHeadSize = Math.max(6, Math.min(60, value));
                break;
            case 'arrowStyle':
                this.options.arrowStyle = value;
                this.options.strokeDashArray = value === 'dashed' ? [12, 6] : null;
                break;
        }

        // 更新预览箭头
        if (this.previewArrow) {
            this.previewArrow.set({
                stroke: this.options.stroke,
                strokeWidth: this.options.strokeWidth,
                opacity: this.options.opacity / 100,
                strokeDashArray: this.options.strokeDashArray
            });
            this.previewArrow.arrowOptions = { ...this.options };
            if (this.previewArrow.recalculateGeometryFromWorldPoints) {
                this.previewArrow.recalculateGeometryFromWorldPoints();
            }
        }

        this.applyToActiveArrow();
    }

    /**
     * 应用参数到选中的箭头对象
     */
    applyToActiveArrow() {
        const canvas = getCanvas(this);
        const activeObject = canvas?.getActiveObject();
        
        if (activeObject instanceof Arrow) {
            // 更新箭头的选项
            activeObject.arrowOptions = { ...this.options };
            
            activeObject.set({
                stroke: this.options.stroke,
                strokeWidth: this.options.strokeWidth,
                opacity: this.options.opacity / 100,
                strokeDashArray: this.options.strokeDashArray || null
            });
            
            // 重新计算箭头几何（这会应用头部大小等特殊属性）
            if (activeObject.recalculateGeometryFromWorldPoints) {
                activeObject.recalculateGeometryFromWorldPoints();
            }
            canvas.renderAll();
        }
    }
    
    syncParametersFromSubToolbar() {
        const params = getToolParams('arrow');
        for (const [name, value] of Object.entries(params)) {
            this.applyParameter(name, value);
        }
    }

    getOptions() {
        return { ...this.options };
    }
}