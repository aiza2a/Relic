/**
 * Canvas 选区和遮罩管理器
 */

import { boundsConstraint } from '../utils/bounds-constraint.js';

export class CanvasSelectionManager {
    constructor() {
        // 创建独立的 canvas 层
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'selectionCanvas';
        this.canvas.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 4;
            pointer-events: none;
        `;
        document.body.appendChild(this.canvas);
        
        this.ctx = this.canvas.getContext('2d', { alpha: true });
        this.updateCanvasSize();
        
        // 选区状态
        this.selectionRect = null;
        this.isSelecting = false;
        this.isMoving = false;
        this.isResizing = false;
        this.isAdjustingRadius = false;
        
        // 选择起点和当前点
        this.startX = 0;
        this.startY = 0;
        this.currentX = 0;
        this.currentY = 0;
        
        // 移动选区时的偏移
        this.moveOffsetX = 0;
        this.moveOffsetY = 0;
        
        // 调整大小相关
        this.resizeDirection = '';
        this.resizeStartX = 0;
        this.resizeStartY = 0;
        this.resizeStartRect = null;
        this.isKeepingAspectRatio = false; 
        
        // 圆角相关
        this.borderRadius = this.loadBorderRadius();
        this.radiusCorner = '';
        this.radiusStartX = 0;
        this.radiusStartY = 0;
        this.radiusStartValue = 0;
        
        // 控制点显示状态
        this.handlesVisible = false;
        
        // 长截屏模式
        this.longScreenshotMode = false;
        
        // 缓存的显示器边界信息
        this.monitors = [];
        this.virtualBounds = null;
        
        // 自动选区预览
        this.autoSelectionBounds = null;
        this.autoSelectionActive = false;
        
        // 遮罩过渡动画
        this.transitionEnabled = false;
        
        // 过渡动画相关
        this.animationFrame = null;
        this.currentAnimBounds = null; 
        this.targetAnimBounds = null; 
        this.animationStartTime = 0;
        this.animationDuration = 80;
        
        this.rafScheduled = false;
        this.pendingDraw = false;
        
        window.addEventListener('resize', () => this.updateCanvasSize());
        
        this.scheduleDraw();
    }
    
    /**
     * 更新 canvas 尺寸
     */
    updateCanvasSize() {
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = window.innerWidth * dpr;
        this.canvas.height = window.innerHeight * dpr;
        this.ctx.scale(dpr, dpr);
        this.scheduleDraw();
    }
    
    /**
     * 调度绘制（使用RAF合并多次调用）
     */
    scheduleDraw() {
        if (this.rafScheduled) {
            return;
        }
        
        this.rafScheduled = true;
        requestAnimationFrame(() => {
            this.rafScheduled = false;
            this.drawImmediate();
        });
    }
    
    /**
     * 立即绘制
     */
    drawImmediate() {
        const ctx = this.ctx;
        const width = window.innerWidth;
        const height = window.innerHeight;

        ctx.clearRect(0, 0, width, height);

        if (this.autoSelectionActive && this.autoSelectionBounds) {
            this.drawMaskWithCutout(ctx, this.autoSelectionBounds, 0);

            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 2;
            this.drawRoundedRect(
                ctx,
                this.autoSelectionBounds.x + 0.5,
                this.autoSelectionBounds.y + 0.5,
                this.autoSelectionBounds.width - 1,
                this.autoSelectionBounds.height - 1,
                0
            );
            ctx.stroke();
        } else if (this.selectionRect) {
            const { left, top, width: w, height: h } = this.selectionRect;
            
            // 长截屏模式：只绘制边框，不绘制遮罩和控制点
            if (this.longScreenshotMode) {
                ctx.strokeStyle = '#007bff';
                ctx.lineWidth = 2;
                this.drawRoundedRect(ctx, left + 0.5, top + 0.5, w - 1, h - 1, this.borderRadius);
                ctx.stroke();
                return;
            }
            
            this.drawMaskWithCutout(ctx, { x: left, y: top, width: w, height: h }, this.borderRadius);

            if (this.isKeepingAspectRatio) {
                ctx.strokeStyle = '#00ff00';
                ctx.lineWidth = 2;
                ctx.shadowColor = '#00ff00';
                ctx.shadowBlur = 8;
                this.drawRoundedRect(ctx, left + 0.5, top + 0.5, w - 1, h - 1, this.borderRadius);
                ctx.stroke();
                ctx.shadowBlur = 0;
            } else {
                ctx.strokeStyle = '#007bff';
                ctx.lineWidth = 2;
                this.drawRoundedRect(ctx, left + 0.5, top + 0.5, w - 1, h - 1, this.borderRadius);
                ctx.stroke();
            }

            if (this.handlesVisible) {
                this.drawHandles(ctx, left, top, w, h);
            }
        } else {

            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(0, 0, width, height);
        }
    }
    
    /**
     * 绘制带镂空的遮罩层
     */
    drawMaskWithCutout(ctx, bounds, radius) {
        const width = window.innerWidth;
        const height = window.innerHeight;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, width, height);

        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(0, 0, 0, 1)';
        this.drawRoundedRect(ctx, bounds.x, bounds.y, bounds.width, bounds.height, radius);
        ctx.fill();
        ctx.restore();
    }
    
    /**
     * 绘制圆角矩形路径
     */
    drawRoundedRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        
        if (radius <= 0) {
            ctx.rect(x, y, width, height);
        } else {
            const r = Math.min(radius, width / 2, height / 2);
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + width - r, y);
            ctx.arcTo(x + width, y, x + width, y + r, r);
            ctx.lineTo(x + width, y + height - r);
            ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
            ctx.lineTo(x + r, y + height);
            ctx.arcTo(x, y + height, x, y + height - r, r);
            ctx.lineTo(x, y + r);
            ctx.arcTo(x, y, x + r, y, r);
        }
        
        ctx.closePath();
    }
    
    /**
     * 绘制控制点
     */
    drawHandles(ctx, left, top, width, height) {
        const handleSize = 8;
        const halfHandle = handleSize / 2;

        const resizeHandles = [
            { x: left, y: top, type: 'nw' },                          // 左上
            { x: left + width / 2, y: top, type: 'n' },               // 上中
            { x: left + width, y: top, type: 'ne' },                  // 右上
            { x: left + width, y: top + height / 2, type: 'e' },      // 右中
            { x: left + width, y: top + height, type: 'se' },         // 右下
            { x: left + width / 2, y: top + height, type: 's' },      // 下中
            { x: left, y: top + height, type: 'sw' },                 // 左下
            { x: left, y: top + height / 2, type: 'w' },              // 左中
        ];

        resizeHandles.forEach(handle => {
            ctx.fillStyle = '#007bff';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.fillRect(handle.x - halfHandle, handle.y - halfHandle, handleSize, handleSize);
            ctx.strokeRect(handle.x - halfHandle, handle.y - halfHandle, handleSize, handleSize);
        });

        const r = this.borderRadius;
        const arcPoint = r > 0 ? r * (1 - Math.SQRT1_2) : 0;
        const nodeOffset = arcPoint + 12;
        
        const radiusHandles = [
            { x: left + nodeOffset, y: top + nodeOffset, type: 'nw' },
            { x: left + width - nodeOffset, y: top + nodeOffset, type: 'ne' },
            { x: left + width - nodeOffset, y: top + height - nodeOffset, type: 'se' },
            { x: left + nodeOffset, y: top + height - nodeOffset, type: 'sw' },
        ];

        radiusHandles.forEach(handle => {
            ctx.fillStyle = 'rgba(255, 165, 0, 0.9)';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(handle.x, handle.y, halfHandle, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        });
    }
    
    /**
     * 检测点击位置
     */
    hitTest(x, y) {
        if (!this.selectionRect) return null;
        
        const { left, top, width, height } = this.selectionRect;
        const handleSize = 8;
        const hitTolerance = 5;

        const r = this.borderRadius;
        const arcPoint = r > 0 ? r * (1 - Math.SQRT1_2) : 0;
        const nodeOffset = arcPoint + 12;
        
        const radiusHandles = [
            { x: left + nodeOffset, y: top + nodeOffset, type: 'radius', corner: 'nw' },
            { x: left + width - nodeOffset, y: top + nodeOffset, type: 'radius', corner: 'ne' },
            { x: left + width - nodeOffset, y: top + height - nodeOffset, type: 'radius', corner: 'se' },
            { x: left + nodeOffset, y: top + height - nodeOffset, type: 'radius', corner: 'sw' },
        ];
        
        for (const handle of radiusHandles) {
            const dx = x - handle.x;
            const dy = y - handle.y;
            if (Math.sqrt(dx * dx + dy * dy) <= handleSize + hitTolerance) {
                return handle;
            }
        }

        const resizeHandles = [
            { x: left, y: top, direction: 'nw' },
            { x: left + width / 2, y: top, direction: 'n' },
            { x: left + width, y: top, direction: 'ne' },
            { x: left + width, y: top + height / 2, direction: 'e' },
            { x: left + width, y: top + height, direction: 'se' },
            { x: left + width / 2, y: top + height, direction: 's' },
            { x: left, y: top + height, direction: 'sw' },
            { x: left, y: top + height / 2, direction: 'w' },
        ];
        
        for (const handle of resizeHandles) {
            if (Math.abs(x - handle.x) <= handleSize + hitTolerance &&
                Math.abs(y - handle.y) <= handleSize + hitTolerance) {
                return { type: 'resize', direction: handle.direction };
            }
        }

        if (x >= left && x <= left + width && y >= top && y <= top + height) {
            return { type: 'move' };
        }
        
        return null;
    }
    
    /**
     * 显示控制点
     */
    showHandles() {
        if (!this.handlesVisible) {
            this.handlesVisible = true;
            this.scheduleDraw();
        }
    }
    
    /**
     * 隐藏控制点
     */
    hideHandles() {
        if (this.handlesVisible) {
            this.handlesVisible = false;
            this.scheduleDraw();
        }
    }
    
    /**
     * 开始选择、移动或调整大小
     */
    startSelection(mouseX, mouseY, hitResult) {
        if (hitResult) {
            if (hitResult.type === 'radius') {
                this.isAdjustingRadius = true;
                this.radiusCorner = hitResult.corner;
                this.radiusStartX = mouseX;
                this.radiusStartY = mouseY;
                this.radiusStartValue = this.borderRadius;
                return 'radius';
            } else if (hitResult.type === 'resize') {
                this.isResizing = true;
                this.resizeDirection = hitResult.direction;
                this.resizeStartX = mouseX;
                this.resizeStartY = mouseY;
                this.resizeStartRect = { ...this.selectionRect };
                return 'resize';
            } else if (hitResult.type === 'move') {
                this.isMoving = true;
                this.moveOffsetX = mouseX - this.selectionRect.left;
                this.moveOffsetY = mouseY - this.selectionRect.top;
                return 'move';
            }
        }

        this.isSelecting = true;
        this.startX = mouseX;
        this.startY = mouseY;
        this.currentX = mouseX;
        this.currentY = mouseY;
        this.hideHandles();
        this.scheduleDraw();
        return 'select';
    }
    
    /**
     * 更新选区（选择模式）
     */
    updateSelection(mouseX, mouseY) {
        if (!this.isSelecting) return;
        
        this.currentX = mouseX;
        this.currentY = mouseY;
        
        const left = Math.min(this.startX, this.currentX);
        const top = Math.min(this.startY, this.currentY);
        const width = Math.abs(this.currentX - this.startX);
        const height = Math.abs(this.currentY - this.startY);
        
        this.selectionRect = { left, top, width, height };
        this.scheduleDraw();
    }
    
    /**
     * 移动选区
     */
    moveSelection(mouseX, mouseY) {
        if (!this.selectionRect) return;
        
        let newLeft = mouseX - this.moveOffsetX;
        let newTop = mouseY - this.moveOffsetY;
        const { width, height } = this.selectionRect;

        const constrained = boundsConstraint.constrain(newLeft, newTop, width, height);
        
        this.selectionRect = {
            left: constrained.x,
            top: constrained.y,
            width: width,
            height: height
        };
        
        this.scheduleDraw();
    }
    
    /**
     * 调整选区大小
     */
    resizeSelection(mouseX, mouseY, shiftKey = false) {
        if (!this.selectionRect || !this.resizeStartRect) return;
        
        const deltaX = mouseX - this.resizeStartX;
        const deltaY = mouseY - this.resizeStartY;
        
        let { left, top, width, height } = this.resizeStartRect;

        const isCorner = ['nw', 'ne', 'se', 'sw'].includes(this.resizeDirection);
        const keepAspectRatio = shiftKey && isCorner;

        this.isKeepingAspectRatio = keepAspectRatio;
        
        if (keepAspectRatio) {
            const aspectRatio = this.resizeStartRect.width / this.resizeStartRect.height;
            
            switch (this.resizeDirection) {
                case 'nw':
                case 'se':
                    const diagDelta = (deltaX + deltaY) / 2;
                    if (this.resizeDirection === 'nw') {
                        left += diagDelta;
                        top += diagDelta;
                        width -= diagDelta;
                        height = width / aspectRatio;
                    } else {
                        width += diagDelta;
                        height = width / aspectRatio;
                    }
                    break;
                case 'ne':
                case 'sw':
                    const antiDiagDelta = (deltaX - deltaY) / 2;
                    if (this.resizeDirection === 'ne') {
                        top -= antiDiagDelta;
                        width += antiDiagDelta;
                        height = width / aspectRatio;
                    } else {
                        left -= antiDiagDelta;
                        width += antiDiagDelta;
                        height = width / aspectRatio;
                    }
                    break;
            }
        } else {
            switch (this.resizeDirection) {
                case 'nw':
                    left += deltaX;
                    top += deltaY;
                    width -= deltaX;
                    height -= deltaY;
                    break;
                case 'n':
                    top += deltaY;
                    height -= deltaY;
                    break;
                case 'ne':
                    top += deltaY;
                    width += deltaX;
                    height -= deltaY;
                    break;
                case 'e':
                    width += deltaX;
                    break;
                case 'se':
                    width += deltaX;
                    height += deltaY;
                    break;
                case 's':
                    height += deltaY;
                    break;
                case 'sw':
                    left += deltaX;
                    width -= deltaX;
                    height += deltaY;
                    break;
                case 'w':
                    left += deltaX;
                    width -= deltaX;
                    break;
            }
        }

        const minSize = 10;
        if (width < minSize) {
            if (this.resizeDirection.includes('w')) left -= minSize - width;
            width = minSize;
        }
        if (height < minSize) {
            if (this.resizeDirection.includes('n')) top -= minSize - height;
            height = minSize;
        }

        const constrained = boundsConstraint.constrain(left, top, width, height);
        
        this.selectionRect = {
            left: constrained.x,
            top: constrained.y,
            width: width,
            height: height
        };
        
        this.scheduleDraw();
    }
    
    /**
     * 调整圆角大小
     */
    adjustRadius(mouseX, mouseY) {
        if (!this.selectionRect) return;
        
        let delta = 0;
        switch (this.radiusCorner) {
            case 'nw':
                delta = Math.sqrt(Math.pow(mouseX - this.radiusStartX, 2) + Math.pow(mouseY - this.radiusStartY, 2));
                if (mouseX < this.radiusStartX || mouseY < this.radiusStartY) delta = -delta;
                break;
            case 'ne':
                delta = Math.sqrt(Math.pow(mouseX - this.radiusStartX, 2) + Math.pow(mouseY - this.radiusStartY, 2));
                if (mouseX > this.radiusStartX || mouseY < this.radiusStartY) delta = -delta;
                break;
            case 'se':
                delta = Math.sqrt(Math.pow(mouseX - this.radiusStartX, 2) + Math.pow(mouseY - this.radiusStartY, 2));
                if (mouseX > this.radiusStartX || mouseY > this.radiusStartY) delta = -delta;
                break;
            case 'sw':
                delta = Math.sqrt(Math.pow(mouseX - this.radiusStartX, 2) + Math.pow(mouseY - this.radiusStartY, 2));
                if (mouseX < this.radiusStartX || mouseY > this.radiusStartY) delta = -delta;
                break;
        }
        
        let newRadius = this.radiusStartValue + delta;
        const maxRadius = Math.min(this.selectionRect.width, this.selectionRect.height) / 2;
        newRadius = Math.max(0, Math.min(newRadius, maxRadius));
        
        this.borderRadius = Math.round(newRadius);
        this.saveBorderRadius(this.borderRadius);
        this.scheduleDraw();
    }
    
    /**
     * 结束选择或移动
     */
    endSelection() {
        if (this.isMoving) {
            this.isMoving = false;
            this.scheduleDraw();
            return 'move-end';
        } else if (this.isResizing) {
            this.isResizing = false;
            this.resizeDirection = '';
            this.resizeStartRect = null;
            this.isKeepingAspectRatio = false;
            this.scheduleDraw(); 
            return 'resize-end';
        } else if (this.isAdjustingRadius) {
            this.isAdjustingRadius = false;
            this.radiusCorner = '';
            this.scheduleDraw();
            return 'radius-end';
        } else if (this.isSelecting) {
            this.isSelecting = false;
            
            if (this.selectionRect && this.selectionRect.width > 10 && this.selectionRect.height > 10) {
                this.showHandles();
                return 'select-end';
            } else {
                this.reset();
                return 'select-cancel';
            }
        }
        return 'none';
    }
    
    /**
     * 直接设置选区
     */
    setSelection(left, top, width, height) {
        this.selectionRect = { left, top, width, height };
        this.showHandles();
        this.scheduleDraw();
    }
    
    /**
     * 清除选区
     */
    clearSelection() {
        this.selectionRect = null;
        this.hideHandles();
        this.scheduleDraw();
    }
    
    /**
     * 重置状态
     */
    reset() {
        this.isSelecting = false;
        this.isMoving = false;
        this.isResizing = false;
        this.isAdjustingRadius = false;
        this.selectionRect = null;
        this.hideHandles();
        this.scheduleDraw();
    }
    
    /**
     * 设置显示器边界信息
     */
    setMonitorBounds(monitors, virtualBounds) {
        this.monitors = monitors;
        this.virtualBounds = virtualBounds;
        boundsConstraint.setMonitorBounds(monitors, virtualBounds);
    }
    
    /**
     * 启用自动选区预览
     */
    showAutoSelection(bounds) {
        if (this.selectionRect) {
            return;
        }
        
        this.autoSelectionActive = true;
        
        if (this.transitionEnabled && this.autoSelectionBounds) {
            this.startTransition(this.autoSelectionBounds, bounds);
        } else {
            this.autoSelectionBounds = bounds;
            this.currentAnimBounds = bounds;
            this.scheduleDraw();
        }
    }
    
    /**
     * 启动过渡动画
     */
    startTransition(from, to) {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        
        this.currentAnimBounds = { ...from };
        this.targetAnimBounds = to;
        this.animationStartTime = performance.now();
        
        this.animate();
    }
    
    /**
     * 动画循环
     */
    animate() {
        const now = performance.now();
        const elapsed = now - this.animationStartTime;
        const progress = Math.min(elapsed / this.animationDuration, 1);

        const easeProgress = 1 - Math.pow(1 - progress, 3);

        this.currentAnimBounds = {
            x: this.lerp(this.currentAnimBounds.x, this.targetAnimBounds.x, easeProgress),
            y: this.lerp(this.currentAnimBounds.y, this.targetAnimBounds.y, easeProgress),
            width: this.lerp(this.currentAnimBounds.width, this.targetAnimBounds.width, easeProgress),
            height: this.lerp(this.currentAnimBounds.height, this.targetAnimBounds.height, easeProgress)
        };

        this.autoSelectionBounds = this.currentAnimBounds;
        this.drawImmediate();
  
        if (progress < 1) {
            this.animationFrame = requestAnimationFrame(() => this.animate());
        } else {
            this.autoSelectionBounds = this.targetAnimBounds;
            this.currentAnimBounds = this.targetAnimBounds;
            this.animationFrame = null;
            this.drawImmediate();
        }
    }
    
    /**
     * 线性插值
     */
    lerp(start, end, progress) {
        return start + (end - start) * progress;
    }
    
    /**
     * 隐藏自动选区预览
     */
    hideAutoSelection() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
        
        this.autoSelectionActive = false;
        this.autoSelectionBounds = null;
        this.currentAnimBounds = null;
        this.targetAnimBounds = null;
        this.scheduleDraw();
    }
    
    /**
     * 获取当前选区
     */
    getSelection() {
        return this.selectionRect;
    }
    
    /**
     * 获取圆角半径
     */
    getBorderRadius() {
        return this.borderRadius;
    }
    
    /**
     * 获取状态
     */
    get isSelectingState() {
        return this.isSelecting;
    }
    
    get isMovingState() {
        return this.isMoving;
    }
    
    get isResizingState() {
        return this.isResizing;
    }
    
    /**
     * 根据hitTest结果获取光标样式
     */
    getCursorStyle(hitResult) {
        if (!hitResult) {
            return 'crosshair';
        }
        
        if (hitResult.type === 'radius') {
            return 'pointer';
        }
        
        if (hitResult.type === 'resize') {
            const cursorMap = {
                'nw': 'nw-resize',
                'n': 'n-resize',
                'ne': 'ne-resize',
                'e': 'e-resize',
                'se': 'se-resize',
                's': 's-resize',
                'sw': 'sw-resize',
                'w': 'w-resize'
            };
            return cursorMap[hitResult.direction] || 'default';
        }
        
        if (hitResult.type === 'move') {
            return 'move';
        }
        
        return 'crosshair';
    }
    
    /**
     * 启用长截屏模式（隐藏遮罩、边框和控制点）
     */
    enableLongScreenshotMode() {
        this.longScreenshotMode = true;
        this.scheduleDraw();
    }
    
    /**
     * 禁用长截屏模式
     */
    disableLongScreenshotMode() {
        this.longScreenshotMode = false;
        this.scheduleDraw();
    }
    
    /**
     * 从本地存储加载圆角值
     */
    loadBorderRadius() {
        try {
            const saved = localStorage.getItem('screenshot_borderRadius');
            if (saved !== null) {
                const radius = parseInt(saved, 10);
                return isNaN(radius) ? 0 : Math.max(0, radius);
            }
        } catch (e) {
            console.warn('加载圆角值失败:', e);
        }
        return 0;
    }
    
    /**
     * 保存圆角值到本地存储
     */
    saveBorderRadius(radius) {
        try {
            localStorage.setItem('screenshot_borderRadius', radius.toString());
        } catch (e) {
            console.warn('保存圆角值失败:', e);
        }
    }
    
    /**
     * 启用过渡动画
     */
    enableTransition() {
        this.transitionEnabled = true;
    }
    
    /**
     * 禁用过渡动画
     */
    disableTransition() {
        this.transitionEnabled = false;
    }
    
    /**
     * 销毁
     */
    destroy() {
        // 取消动画
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
        
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
    }
}

