/**
 * Fabric.js工具管理器
 * 管理基于Fabric.js的各种编辑工具
 */

import { FabricBrushTool } from '../tools/fabric-brush-tool.js';
import { FabricTextTool } from '../tools/fabric-text-tool.js';
import { FabricUnifiedShapeTool } from '../tools/fabric-unified-shape-tool.js';
import { FabricSimpleArrowTool } from '../tools/fabric-simple-arrow-tool.js';
import { FabricSelectionTool } from '../tools/fabric-selection-tool.js';
import { FabricNumberTool } from '../tools/fabric-number-tool.js';
import { FabricWatermarkTool } from '../tools/fabric-watermark-tool.js';
import { FabricMosaicTool } from '../tools/fabric-mosaic-tool.js';

export class FabricToolManager {
    constructor() {
        this.tools = new Map();
        this.currentTool = null;
        this.editLayerManager = null;
        this.isToolActive = false;
        
        // 初始化工具
        this.initTools();
    }

    /**
     * 初始化所有工具
     */
    initTools() {
        // 注册各种工具
        this.registerTool(new FabricSelectionTool());  // 选择工具放在第一个
        this.registerTool(new FabricBrushTool());
        this.registerTool(new FabricTextTool());
        this.registerTool(new FabricNumberTool());      // 序号标注工具
        this.registerTool(new FabricWatermarkTool());   // 水印工具
        this.registerTool(new FabricSimpleArrowTool()); // 箭头工具
        this.registerTool(new FabricUnifiedShapeTool()); // 统一的形状工具（矩形、圆形、箭头形状）
        this.registerTool(new FabricMosaicTool());      // 马赛克工具
    }

    /**
     * 注册工具
     */
    registerTool(tool) {
        this.tools.set(tool.name, tool);
    }

    /**
     * 设置编辑层管理器引用
     */
    setEditLayerManager(editLayerManager) {
        this.editLayerManager = editLayerManager;
    }

    /**
     * 激活工具
     */
    activateTool(toolName) {
        // 取消当前工具
        if (this.currentTool) {
            this.deactivateTool();
        }

        const tool = this.tools.get(toolName);
        if (!tool) {
            console.error(`工具 "${toolName}" 不存在`);
            return false;
        }

        if (!this.editLayerManager) {
            console.error('EditLayerManager 未设置');
            return false;
        }

        // 在激活新工具之前刷新当前工具的参数
        if (tool && tool.syncParametersFromSubToolbar) {
            tool.syncParametersFromSubToolbar();
        }

        this.currentTool = tool;
        this.isToolActive = true;

        if (this.editLayerManager && this.editLayerManager.prepareSelectionForTool) {
            this.editLayerManager.prepareSelectionForTool(toolName);
        }

        // 禁用选区和遮罩层的鼠标事件
        this.disableSelectionEvents();

        // 启用编辑层交互
        this.editLayerManager.enableInteraction();

        // 调用工具的激活回调
        if (tool.onActivate) {
            tool.onActivate(this.editLayerManager);
        }

        return true;
    }

    /**
     * 取消激活当前工具
     */
    deactivateTool() {
        if (!this.currentTool) return;

        // 调用工具的取消激活回调
        if (this.editLayerManager && this.editLayerManager.prepareSelectionForTool) {
            this.editLayerManager.prepareSelectionForTool(null);
        }

        if (this.currentTool.onDeactivate) {
            this.currentTool.onDeactivate(this.editLayerManager);
        }

        // 恢复选区和遮罩层的鼠标事件
        this.enableSelectionEvents();

        this.currentTool = null;
        this.isToolActive = false;
    }

    /**
     * 切换到选择工具并选中指定对象
     */
    switchToSelectionTool(objectToSelect = null) {
        // 激活选择工具
        this.activateTool('selection');
        
        // 更新工具栏按钮状态
        if (window.screenshotController && window.screenshotController.toolbarManager) {
            window.screenshotController.toolbarManager.setActiveTool('selection');
        }
        
        // 更新子工具栏状态 - 选择工具不显示参数，隐藏子工具栏
        if (window.screenshotController && window.screenshotController.subToolbarManager) {
            window.screenshotController.subToolbarManager.hide();
        }
        
        // 如果指定了要选中的对象，则选中它
        if (objectToSelect && this.currentTool && this.currentTool.selectObject) {
            this.currentTool.selectObject(objectToSelect);
        }
    }

    /**
     * 获取当前激活的工具
     */
    getCurrentTool() {
        return this.currentTool;
    }

    /**
     * 检查工具是否激活
     */
    isActive() {
        return this.isToolActive;
    }

    /**
     * 获取所有可用工具列表
     */
    getAvailableTools() {
        return Array.from(this.tools.keys());
    }

    /**
     * 获取工具选项
     */
    getToolOptions() {
        if (this.currentTool && this.currentTool.getOptions) {
            return this.currentTool.getOptions();
        }
        return null;
    }

    /**
     * 设置工具选项
     */
    setToolOptions(options) {
        if (this.currentTool && this.currentTool.setOptions) {
            this.currentTool.setOptions(options);
            return true;
        }
        return false;
    }

    /**
     * 删除选中的对象
     */
    deleteSelected() {
        // 优先使用当前工具的删除方法（如选择工具）
        if (this.currentTool && this.currentTool.deleteSelected) {
            this.currentTool.deleteSelected();
        } else if (this.editLayerManager && this.editLayerManager.deleteSelected) {
            this.editLayerManager.deleteSelected();
        }
    }

    /**
     * 清除所有编辑内容
     */
    clear() {
        if (this.editLayerManager) {
            this.editLayerManager.clear();
        }
    }

    /**
     * 获取特定工具实例
     */
    getTool(toolName) {
        return this.tools.get(toolName);
    }

    /**
     * 设置画笔颜色
     */
    setBrushColor(color) {
        if (this.currentTool && this.currentTool.setColor) {
            this.currentTool.setColor(color);
        }
    }

    /**
     * 设置画笔宽度
     */
    setBrushWidth(width) {
        if (this.currentTool && this.currentTool.setWidth) {
            this.currentTool.setWidth(width);
        }
    }

    /**
     * 设置填充颜色
     */
    setFillColor(color) {
        if (this.currentTool && this.currentTool.setFill) {
            this.currentTool.setFill(color);
        }
    }

    /**
     * 设置边框颜色
     */
    setStrokeColor(color) {
        if (this.currentTool && this.currentTool.setStroke) {
            this.currentTool.setStroke(color);
        }
    }

    /**
     * 设置字体大小
     */
    setFontSize(fontSize) {
        if (this.currentTool && this.currentTool.setFontSize) {
            this.currentTool.setFontSize(fontSize);
        }
    }

    /**
     * 设置字体
     */
    setFont(fontFamily) {
        if (this.currentTool && this.currentTool.setFont) {
            this.currentTool.setFont(fontFamily);
        }
    }

    /**
     * 获取工具类型信息
     */
    getToolInfo(toolName) {
        const tool = this.tools.get(toolName);
        if (!tool) return null;

        return {
            name: tool.name,
            type: this.getToolType(tool),
            hasColorOption: typeof tool.setColor === 'function',
            hasWidthOption: typeof tool.setWidth === 'function',
            hasFillOption: typeof tool.setFill === 'function',
            hasStrokeOption: typeof tool.setStroke === 'function',
            hasFontOption: typeof tool.setFont === 'function',
            hasFontSizeOption: typeof tool.setFontSize === 'function'
        };
    }

    /**
     * 获取工具类型
     */
    getToolType(tool) {
        if (!tool) return 'unknown';
        
        if (tool.name === 'brush') return 'drawing';
        if (tool.name === 'text') return 'text';
        if (['rectangle', 'circle', 'arrow'].includes(tool.name)) return 'shape';
        
        return 'other';
    }

    /**
     * 批量设置工具选项
     */
    setMultipleToolOptions(options) {
        const results = {};
        
        for (const [toolName, toolOptions] of Object.entries(options)) {
            const tool = this.tools.get(toolName);
            if (tool && tool.setOptions) {
                tool.setOptions(toolOptions);
                results[toolName] = true;
            } else {
                results[toolName] = false;
            }
        }
        
        return results;
    }

    /**
     * 获取所有工具的当前选项
     */
    getAllToolOptions() {
        const options = {};
        
        for (const [toolName, tool] of this.tools.entries()) {
            if (tool.getOptions) {
                options[toolName] = tool.getOptions();
            }
        }
        
        return options;
    }

    /**
     * 检查是否可以使用键盘快捷键
     */
    canUseKeyboardShortcuts() {
        // 如果正在编辑文本，禁用快捷键
        if (this.editLayerManager && this.editLayerManager.getFabricCanvas) {
            const canvas = this.editLayerManager.getFabricCanvas();
            const activeObject = canvas.getActiveObject();
            
            if (activeObject && activeObject.type === 'text' && activeObject.isEditing) {
                return false;
            }
        }
        
        return true;
    }

    /**
     * 处理键盘快捷键
     */
    handleKeyboardShortcut(key) {
        if (!this.canUseKeyboardShortcuts()) return false;
        
        switch (key) {
            case 'delete':
            case 'backspace':
                this.deleteSelected();
                return true;
                
            case 'escape':
                this.deactivateTool();
                return true;
                
            default:
                return false;
        }
    }

    /**
     * 禁用选区和遮罩层的鼠标事件
     */
    disableSelectionEvents() {
        const overlay = document.getElementById('overlay');
        const selectionArea = document.getElementById('selectionArea');
        const maskLayers = document.getElementById('maskLayers');
        const resizeHandles = document.querySelectorAll('.resize-handle');
        
        if (overlay) {
            overlay.style.pointerEvents = 'none';
        }
        if (selectionArea) {
            selectionArea.style.pointerEvents = 'none';
        }
        if (maskLayers) {
            maskLayers.style.pointerEvents = 'none';
        }
        // 禁用调整大小节点
        resizeHandles.forEach(handle => {
            handle.style.pointerEvents = 'none';
        });
    }

    /**
     * 恢复选区和遮罩层的鼠标事件
     */
    enableSelectionEvents() {
        const overlay = document.getElementById('overlay');
        const selectionArea = document.getElementById('selectionArea');
        const maskLayers = document.getElementById('maskLayers');
        const resizeHandles = document.querySelectorAll('.resize-handle');
        
        if (overlay) {
            overlay.style.pointerEvents = 'auto';
        }
        if (selectionArea) {
            selectionArea.style.pointerEvents = 'auto';
        }
        if (maskLayers) {
            maskLayers.style.pointerEvents = 'auto';
        }
        // 恢复调整大小节点
        resizeHandles.forEach(handle => {
            handle.style.pointerEvents = 'auto';
        });
    }

    /**
     * 销毁工具管理器
     */
    destroy() {
        // 取消激活当前工具
        this.deactivateTool();
        
        // 清理所有工具
        for (const tool of this.tools.values()) {
            if (tool.destroy) {
                tool.destroy();
            }
        }
        
        this.tools.clear();
        this.editLayerManager = null;
    }
}
