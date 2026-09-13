/**
 * 选择工具
 * 负责选择和操作已创建的对象
 */

export class FabricSelectionTool {
    constructor() {
        this.name = 'selection';
        this.isActive = false;
        this.fabricCanvas = null;
        this.editLayerManager = null;
        
        // 框选相关
        this.isSelecting = false;
        this.selectionStart = null;
        this.selectionRect = null;
        
        // 绑定事件处理器
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
    }

    /**
     * 工具激活时的处理
     */
    onActivate(editLayerManager) {
        if (!editLayerManager || !editLayerManager.getFabricCanvas) {
            console.error('选择工具激活失败：editLayerManager 无效');
            return;
        }
        
        this.editLayerManager = editLayerManager;
        this.fabricCanvas = editLayerManager.getFabricCanvas();
        
        if (!this.fabricCanvas) {
            console.error('选择工具激活失败：fabricCanvas 为空');
            return;
        }
        
        this.isActive = true;
        
        // 确保不在绘画模式，启用选择功能
        this.fabricCanvas.isDrawingMode = false;
        this.fabricCanvas.selection = true;
        this.fabricCanvas.defaultCursor = 'default';
        this.fabricCanvas.hoverCursor = 'move';
        this.fabricCanvas.moveCursor = 'move';
        
        // 确保所有对象可选择
        this.fabricCanvas.forEachObject((obj) => {
            obj.selectable = true;
            obj.evented = true;
        });
        
        // 设置光标
        document.body.style.cursor = 'default';
        
        // 添加事件监听器
        if (this.fabricCanvas) {
            this.fabricCanvas.on('mouse:down', this.handleMouseDown);
            this.fabricCanvas.on('mouse:move', this.handleMouseMove);
            this.fabricCanvas.on('mouse:up', this.handleMouseUp);
        }
        
        // 添加键盘事件监听
        document.addEventListener('keydown', this.handleKeyDown);
        
    }

    /**
     * 工具取消激活时的处理
     */
    onDeactivate(editLayerManager) {
        this.isActive = false;
        this.isSelecting = false;
        
        // 清理框选矩形
        if (this.selectionRect) {
            this.fabricCanvas.remove(this.selectionRect);
            this.selectionRect = null;
        }
        
        // 恢复默认光标
        document.body.style.cursor = 'default';
        
        // 移除事件监听器
        if (this.fabricCanvas) {
            this.fabricCanvas.off('mouse:down', this.handleMouseDown);
            this.fabricCanvas.off('mouse:move', this.handleMouseMove);
            this.fabricCanvas.off('mouse:up', this.handleMouseUp);
        }
        
        // 移除键盘事件监听
        document.removeEventListener('keydown', this.handleKeyDown);
        
        this.fabricCanvas = null;
        this.editLayerManager = null;
    }

    /**
     * 处理鼠标按下事件
     */
    handleMouseDown(e) {
        if (!this.isActive || !this.fabricCanvas) return;
        
        
        // 如果点击的是对象，让Fabric自己处理选择
        if (e.target && e.target !== this.fabricCanvas) {
            return; // Fabric会自动选中对象
        }
        
        // 点击空白区域，开始框选
        this.isSelecting = true;
        const pointer = this.fabricCanvas.getPointer(e.e);
        this.selectionStart = { x: pointer.x, y: pointer.y };
        
        // 取消当前选择
        this.fabricCanvas.discardActiveObject();
        this.fabricCanvas.renderAll();
    }

    /**
     * 处理鼠标移动事件
     */
    handleMouseMove(e) {
        if (!this.isSelecting) return;
        
        const pointer = this.fabricCanvas.getPointer(e.e);
        
        // 计算选择框大小
        const left = Math.min(this.selectionStart.x, pointer.x);
        const top = Math.min(this.selectionStart.y, pointer.y);
        const width = Math.abs(pointer.x - this.selectionStart.x);
        const height = Math.abs(pointer.y - this.selectionStart.y);
        
        // 如果拖拽距离太小，不显示选择框
        if (width < 3 && height < 3) {
            if (this.selectionRect) {
                this.fabricCanvas.remove(this.selectionRect);
                this.selectionRect = null;
                this.fabricCanvas.renderAll();
            }
            return;
        }
        
        // 更新或创建选择框
        if (this.selectionRect) {
            this.selectionRect.set({
                left: left,
                top: top,
                width: width,
                height: height
            });
        } else {
            this.selectionRect = new fabric.Rect({
                left: left,
                top: top,
                width: width,
                height: height,
                fill: 'rgba(0, 123, 255, 0.1)',
                stroke: 'rgba(0, 123, 255, 0.8)',
                strokeWidth: 1,
                strokeDashArray: [5, 5],
                selectable: false,
                evented: false,
                excludeFromExport: true
            });
            this.fabricCanvas.add(this.selectionRect);
        }
        
        this.fabricCanvas.renderAll();
    }

    /**
     * 处理鼠标释放事件
     */
    handleMouseUp(e) {
        if (!this.isSelecting) return;
        
        this.isSelecting = false;
        
        // 如果有选择框，进行框选
        if (this.selectionRect) {
            this.selectObjectsInRect();
            
            // 移除选择框
            this.fabricCanvas.remove(this.selectionRect);
            this.selectionRect = null;
            this.fabricCanvas.renderAll();
        }
        
        this.selectionStart = null;
    }

    /**
     * 选择框内的所有对象
     */
    selectObjectsInRect() {
        const rect = this.selectionRect;
        const selectedObjects = [];
        
        // 获取选择框的坐标
        const rectLeft = rect.left;
        const rectTop = rect.top;
        const rectRight = rect.left + rect.width;
        const rectBottom = rect.top + rect.height;
        
        this.fabricCanvas.forEachObject((obj) => {
            // 跳过选择框自己
            if (obj === this.selectionRect) return;
            
            // 确保对象可选择
            obj.selectable = true;
            
            // 获取对象的边界
            const objBounds = obj.getBoundingRect();
            
            // 检查对象是否在选择框内（任何部分相交都算选中）
            if (this.isRectIntersect(objBounds, {
                left: rectLeft,
                top: rectTop,
                width: rect.width,
                height: rect.height
            })) {
                selectedObjects.push(obj);
            }
        });
        
        
        // 确保Canvas启用选择功能
        this.fabricCanvas.selection = true;
        
        // 设置选中的对象
        if (selectedObjects.length === 0) {
            this.fabricCanvas.discardActiveObject();
        } else if (selectedObjects.length === 1) {
            this.fabricCanvas.setActiveObject(selectedObjects[0]);
        } else {
            // 多选
            const selection = new fabric.ActiveSelection(selectedObjects, {
                canvas: this.fabricCanvas
            });
            this.fabricCanvas.setActiveObject(selection);
        }
        
        this.fabricCanvas.renderAll();
    }

    /**
     * 检查两个矩形是否相交
     */
    isRectIntersect(objBounds, selectRect) {
        // 对象的边界
        const objLeft = objBounds.left;
        const objTop = objBounds.top;
        const objRight = objBounds.left + objBounds.width;
        const objBottom = objBounds.top + objBounds.height;
        
        // 选择框的边界
        const selectLeft = selectRect.left;
        const selectTop = selectRect.top;
        const selectRight = selectRect.left + selectRect.width;
        const selectBottom = selectRect.top + selectRect.height;
        
        // 检查是否相交
        const intersect = !(
            objRight < selectLeft ||    // 对象在选择框左边
            objLeft > selectRight ||    // 对象在选择框右边
            objBottom < selectTop ||    // 对象在选择框上边
            objTop > selectBottom       // 对象在选择框下边
        );
        
        
        return intersect;
    }

    /**
     * 选择指定对象
     */
    selectObject(object) {
        if (!this.fabricCanvas || !object) return;
        
        this.fabricCanvas.setActiveObject(object);
        this.fabricCanvas.renderAll();
    }

    /**
     * 取消所有选择
     */
    clearSelection() {
        if (!this.fabricCanvas) return;
        
        this.fabricCanvas.discardActiveObject();
        this.fabricCanvas.renderAll();
    }

    /**
     * 处理键盘按下事件
     */
    handleKeyDown(e) {
        if (!this.isActive || !this.fabricCanvas) return;
        
        if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            
            this.deleteSelected();
        }
    }

    /**
     * 删除选中的对象
     */
    deleteSelected() {
        if (!this.fabricCanvas) return;
        
        const activeObjects = this.fabricCanvas.getActiveObjects();
        if (activeObjects.length > 0) {
            this.fabricCanvas.remove(...activeObjects);
            this.fabricCanvas.discardActiveObject();
            this.fabricCanvas.renderAll();
            
            // 保存状态
            if (this.editLayerManager && this.editLayerManager.requestHistorySave) {
                activeObjects.forEach(obj => {
                    if (obj) {
                        obj.historyRemoveReason = '删除对象';
                    }
                });
                this.editLayerManager.requestHistorySave('删除对象', { immediate: true });
            }
        }
    }
}
