/**
 * 自动选区管理器
 * 使用 UI Automation API 实现智能元素识别
 */

const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;

export class AutoSelectionManager {
    constructor() {
        this.isActive = false;
        this.currentBounds = null;
        this.listeners = [];
        
        // 标记是否首次显示
        this.isFirstShow = true;
        
        // 元素层级（从小到大）
        this.elementHierarchy = [];
        this.currentHierarchyIndex = 0;
        
        // 绑定滚轮事件
        this.handleWheel = this.handleWheel.bind(this);
    }

    /**
     * 启动自动选区
     */
    async start() {
        if (this.isActive) {
            return;
        }

        try {
            await this.setupListeners();
            this.isActive = true;
            
            // 启用遮罩层过渡动画
            if (window.screenshotApp?.selectionManager) {
                window.screenshotApp.selectionManager.enableTransition();
            }
            
            // 添加滚轮事件监听
            window.addEventListener('wheel', this.handleWheel, { passive: false });
            
            await invoke('start_auto_selection');
        } catch (error) {
            console.error('[AutoSelection] 启动失败:', error);
            throw error;
        }
    }

    /**
     * 停止自动选区
     */
    async stop() {
        if (!this.isActive) {
            return;
        }

        // 立即设置为非激活状态，阻止后续更新
        this.isActive = false;
        this.removeListeners();
        this.currentBounds = null;
        
        // 移除滚轮事件监听
        window.removeEventListener('wheel', this.handleWheel);
        
        // 清空元素层级
        this.elementHierarchy = [];
        this.currentHierarchyIndex = 0;
        
        // 禁用遮罩层过渡动画
        if (window.screenshotApp?.selectionManager) {
            window.screenshotApp.selectionManager.disableTransition();
        }
        
        // 隐藏预览框
        this.hidePreview();

        try {
            await invoke('stop_auto_selection');
        } catch (error) {
            console.error('[AutoSelection] 停止失败:', error);
        }
    }


    /**
     * 设置监听器
     */
    async setupListeners() {
        // 监听元素层级事件
        const unlistenHierarchy = await listen('auto-selection-hierarchy', (event) => {
            this.handleElementHierarchy(event.payload);
        });
        this.listeners.push(unlistenHierarchy);

        // 监听清除事件
        const unlistenClear = await listen('auto-selection-clear', () => {
            this.handleElementCleared();
        });
        this.listeners.push(unlistenClear);
    }

    /**
     * 移除监听器
     */
    removeListeners() {
        this.listeners.forEach(unlisten => unlisten());
        this.listeners = [];
    }

    /**
     * 处理元素层级
     */
    handleElementHierarchy(hierarchyData) {
        if (!this.isActive) {
            return;
        }
        
        const selectionManager = window.screenshotApp?.selectionManager;
        if (selectionManager) {
            if (selectionManager.isSelectingState || 
                selectionManager.isMovingState || 
                selectionManager.isResizingState ||
                selectionManager.isAdjustingRadius ||
                selectionManager.selectionRect) {
                this.stop();
                return;
            }
        }

        // 保存元素层级
        this.elementHierarchy = hierarchyData.hierarchy;
        this.currentHierarchyIndex = hierarchyData.current_index;
        
        // 显示当前层级的元素
        if (this.elementHierarchy.length > 0) {
            const bounds = this.elementHierarchy[this.currentHierarchyIndex];
            this.currentBounds = bounds;
            this.updatePreview(bounds);
        }
    }

    /**
     * 处理元素清除
     */
    handleElementCleared() {
        // 如果已经停止，忽略事件
        if (!this.isActive) {
            return;
        }

        this.currentBounds = null;
        
        this.hidePreview();

        window.dispatchEvent(new CustomEvent('auto-selection-clear'));
    }

    /**
     * 更新预览显示
     */
    updatePreview(bounds) {
        const selectionManager = window.screenshotApp?.selectionManager;
        if (selectionManager) {
            if (selectionManager.isSelectingState || 
                selectionManager.isMovingState || 
                selectionManager.isResizingState ||
                selectionManager.isAdjustingRadius ||
                selectionManager.selectionRect) {
                this.stop();
                return;
            }
            
            selectionManager.showAutoSelection(bounds);
        }
    }
    
    /**
     * 隐藏预览框
     */
    hidePreview() {
        this.isFirstShow = true;
        
        if (window.screenshotApp?.selectionManager) {
            window.screenshotApp.selectionManager.hideAutoSelection();
        }
    }
    
    /**
     * 确认选区 - 转换为正常的手动选区
     */
    confirmSelection() {
        if (!this.currentBounds) {
            return null;
        }
        
        // 保存当前边界
        const bounds = { ...this.currentBounds };
        
        this.stop();
        
        // 返回边界供外部创建正常选区
        return bounds;
    }

    /**
     * 获取当前检测到的边界
     */
    getCurrentBounds() {
        return this.currentBounds;
    }

    /**
     * 处理滚轮事件（切换元素层级）
     */
    handleWheel(event) {
        // 只在自动选区激活且有层级数据时处理
        if (!this.isActive || this.elementHierarchy.length === 0) {
            return;
        }

        // 阻止默认的页面滚动
        event.preventDefault();

        // 向上滚动：选择更大的父元素（索引+1）
        // 向下滚动：选择更小的子元素（索引-1，但不能小于0）
        const delta = event.deltaY > 0 ? -1 : 1;
        const newIndex = this.currentHierarchyIndex + delta;

        // 边界检查
        if (newIndex < 0 || newIndex >= this.elementHierarchy.length) {
            return;
        }

        // 更新索引
        this.currentHierarchyIndex = newIndex;

        // 显示新层级的元素
        const bounds = this.elementHierarchy[this.currentHierarchyIndex];
        this.currentBounds = bounds;
        this.updatePreview(bounds);
    }

    /**
     * 销毁
     */
    async destroy() {
        await this.stop();
        this.selectionManager = null;
    }
}

// 创建全局单例
export const autoSelectionManager = new AutoSelectionManager();

