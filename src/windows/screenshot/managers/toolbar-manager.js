/**
 * 工具栏管理模块
 * 负责工具栏的显示、隐藏、定位等逻辑
 */

import { boundsConstraint } from '../utils/bounds-constraint.js';

export class ToolbarManager {
    constructor() {
        this.toolbar = document.getElementById('toolbar');
        this.confirmBtn = document.getElementById('confirmBtn');
        this.cancelBtn = document.getElementById('cancelBtn');
        this.selectionBtn = document.getElementById('selectionBtn');
        this.brushBtn = document.getElementById('brushBtn');
        this.textBtn = document.getElementById('textBtn');
        this.rectangleBtn = document.getElementById('rectangleBtn');
        this.circleBtn = document.getElementById('circleBtn');
        this.arrowBtn = document.getElementById('arrowBtn');
        this.undoBtn = document.getElementById('undoBtn');
        this.redoBtn = document.getElementById('redoBtn');
        this.clearBtn = document.getElementById('clearBtn');
        
        this.currentTool = null;
        
        this.initEvents();
    }

    /**
     * 获取工具栏实际尺寸
     */
    getToolbarDimensions() {
        if (!this.toolbar) {
            return { width: 400, height: 40 }; // 默认值
        }
        
        const rect = this.toolbar.getBoundingClientRect();
        return {
            width: rect.width || 400,
            height: rect.height || 40
        };
    }

    initEvents() {
        this.confirmBtn.addEventListener('click', () => this.onConfirm?.());
        this.cancelBtn.addEventListener('click', () => this.onCancel?.());
        this.undoBtn.addEventListener('click', () => this.onUndo?.());
        this.redoBtn.addEventListener('click', () => this.onRedo?.());
        this.clearBtn.addEventListener('click', () => this.onClear?.());
        
        // 通用工具按钮事件处理
        const toolButtons = this.toolbar.querySelectorAll('.tool-btn');
        toolButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const toolName = e.currentTarget.dataset.tool;
                if (toolName) {
                    this.handleToolClick(toolName);
                }
            });
        });
    }

    /**
     * 显示工具栏
     */
    show(selectionRect) {
        if (!selectionRect) return null;
        
        // 显示工具栏以获取准确尺寸（临时显示）
        this.toolbar.style.visibility = 'hidden';
        this.toolbar.classList.add('visible');
        
        // 获取工具栏实际尺寸
        const { width: toolbarWidth, height: toolbarHeight } = this.getToolbarDimensions();
        
        const { left, top, width, height } = selectionRect;
        
        let toolbarLeft = left + width - toolbarWidth;
        let toolbarTop;
        
        // 优先尝试下方
        const lowerToolbarTop = top + height + 8;
        const lowerConstrained = boundsConstraint.constrain(
            toolbarLeft, lowerToolbarTop, toolbarWidth, toolbarHeight
        );
        
        // 检查约束后的位置是否与期望位置接近（容差4px）
        const hasSpaceBelow = Math.abs(lowerConstrained.y - lowerToolbarTop) < 4;
        
        if (hasSpaceBelow) {
            // 下方有空间
            toolbarLeft = lowerConstrained.x;
            toolbarTop = lowerConstrained.y;
        } else {
            // 下方没空间，尝试上方
            const upperToolbarTop = top - toolbarHeight - 8;
            const upperConstrained = boundsConstraint.constrain(
                toolbarLeft, upperToolbarTop, toolbarWidth, toolbarHeight
            );
            
            // 检查上方是否有空间
            const hasSpaceAbove = Math.abs(upperConstrained.y - upperToolbarTop) < 4;
            
            if (hasSpaceAbove) {
                // 上方有空间
                toolbarLeft = upperConstrained.x;
                toolbarTop = upperConstrained.y;
            } else {
                // 上下都没有足够空间，尝试选区内部的多个位置
                // 按照右对齐的设计优先级排序
                const innerPositions = [
                    { x: left + width - toolbarWidth - 8, y: top + height - toolbarHeight - 8, name: '右下角' },
                    { x: left + width - toolbarWidth - 8, y: top + 8, name: '右上角' },
                    { x: left + 8, y: top + height - toolbarHeight - 8, name: '左下角' },
                    { x: left + 8, y: top + 8, name: '左上角' }
                ];
                
                let bestPosition = null;
                let bestScore = -1;
                
                for (const pos of innerPositions) {
                    // 确保在选区范围内
                    let x = Math.max(left + 8, Math.min(pos.x, left + width - toolbarWidth - 8));
                    let y = Math.max(top + 8, Math.min(pos.y, top + height - toolbarHeight - 8));
                    
                    // 使用边界约束检查这个位置
                    const constrained = boundsConstraint.constrain(x, y, toolbarWidth, toolbarHeight);
                    
                    // 计算约束后的偏移量（越小越好）
                    const offsetX = Math.abs(constrained.x - x);
                    const offsetY = Math.abs(constrained.y - y);
                    const totalOffset = offsetX + offsetY;
                    
                    // 如果完全没有偏移，直接使用这个位置
                    if (totalOffset === 0) {
                        toolbarLeft = constrained.x;
                        toolbarTop = constrained.y;
                        bestPosition = pos;
                        break;
                    }
                    
                    // 记录偏移最小的位置
                    const score = 1000 - totalOffset; // 偏移越小分数越高
                    if (score > bestScore) {
                        bestScore = score;
                        bestPosition = pos;
                        toolbarLeft = constrained.x;
                        toolbarTop = constrained.y;
                    }
                }
            }
        }
        
        // 设置工具栏位置并正常显示
        this.toolbar.style.left = toolbarLeft + 'px';
        this.toolbar.style.top = toolbarTop + 'px';
        this.toolbar.style.visibility = 'visible';
        
        // 返回计算后的位置和尺寸，供子工具栏使用
        return {
            left: toolbarLeft,
            top: toolbarTop,
            width: toolbarWidth,
            height: toolbarHeight
        };
    }

    /**
     * 隐藏工具栏
     */
    hide() {
        this.toolbar.classList.remove('visible');
    }

    /**
     * 设置确认回调
     */
    setOnConfirm(callback) {
        this.onConfirm = callback;
    }

    /**
     * 设置取消回调
     */
    setOnCancel(callback) {
        this.onCancel = callback;
    }

    /**
     * 设置工具选择回调
     */
    setOnToolSelect(callback) {
        this.onToolSelect = callback;
    }

    /**
     * 设置撤销回调
     */
    setOnUndo(callback) {
        this.onUndo = callback;
    }

    /**
     * 设置重做回调
     */
    setOnRedo(callback) {
        this.onRedo = callback;
    }

    /**
     * 设置清空回调
     */
    setOnClear(callback) {
        this.onClear = callback;
    }

    /**
     * 处理工具按钮点击
     */
    handleToolClick(toolName) {
        // 切换工具状态
        if (this.currentTool === toolName) {
            // 取消当前工具
            this.setActiveTool(null);
        } else {
            // 激活新工具
            this.setActiveTool(toolName);
        }

        // 调用回调
        if (this.onToolSelect) {
            this.onToolSelect(this.currentTool);
        }
    }

    /**
     * 设置激活的工具
     */
    setActiveTool(toolName) {
        // 清除所有工具按钮的激活状态
        const toolButtons = this.toolbar.querySelectorAll('.tool-btn');
        toolButtons.forEach(btn => btn.classList.remove('active'));

        this.currentTool = toolName;

        // 设置当前工具按钮为激活状态
        if (toolName) {
            const activeButton = this.toolbar.querySelector(`[data-tool="${toolName}"]`);
            if (activeButton) {
                activeButton.classList.add('active');
            }
        }
    }

    /**
     * 获取当前激活的工具
     */
    getCurrentTool() {
        return this.currentTool;
    }

    /**
     * 检查工具栏是否可见
     */
    isVisible() {
        return this.toolbar.classList.contains('visible');
    }

    /**
     * 更新历史按钮状态
     */
    updateHistoryButtons(canUndo, canRedo) {
        if (this.undoBtn) {
            this.undoBtn.disabled = !canUndo;
        }
        if (this.redoBtn) {
            this.redoBtn.disabled = !canRedo;
        }
    }

    /**
     * 重置历史按钮状态（禁用所有）
     */
    resetHistoryButtons() {
        this.updateHistoryButtons(false, false);
    }

    /**
     * 获取工具栏元素
     */
    getElement() {
        return this.toolbar;
    }

}
