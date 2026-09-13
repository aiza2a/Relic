/**
 * 截屏主控制器
 */

import '@tabler/icons-webfont/dist/tabler-icons.min.css';
import * as fabric from 'fabric';

window.fabric = fabric;

import { ScreenshotAPI } from './api/screenshot-api.js';

// 导入管理器
import { CanvasSelectionManager } from './managers/canvas-selection-manager.js';
import { SelectionInfoPanel } from './managers/selection-info-panel.js';
import { ToolbarManager } from './managers/toolbar-manager.js';
import { SubToolbarManager } from './managers/sub-toolbar-manager.js';
import { EventManager } from './managers/event-manager.js';
import { BackgroundManager } from './managers/background-manager.js';
import { ExportManager } from './managers/export-manager.js';
import { FabricEditLayerManager } from './managers/fabric-edit-layer-manager.js';
import { FabricToolManager } from './managers/fabric-tool-manager.js';
import { MagnifierManager } from './managers/magnifier-manager.js';
import { OCRManager } from './managers/ocr-manager.js';
import { HelpPanelManager } from './managers/help-panel-manager.js';
import { ScrollingScreenshotManager } from './managers/scrolling-screenshot-manager.js';
import { autoSelectionManager } from './managers/auto-selection-manager.js';
import { TooltipManager } from './managers/tooltip-manager.js';
import { registerArrowClass } from './tools/fabric-simple-arrow-tool.js';

// 导入工具类
import { KeyboardHandler } from './utils/keyboard-handler.js';
import { ArrowKeyController } from './utils/arrow-key-controller.js';
import { CoordinateUtils } from './utils/coordinate-utils.js';
import { ObjectTypeMapper } from './utils/object-type-mapper.js';
import { SpecialToolHandler } from './utils/special-tool-handler.js';
import { settingsManager } from './utils/settings-manager.js';

const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;

export class ScreenshotController {
    constructor() {
        this.monitors = [];
        this.pendingScreenshotData = null;
        
        // 初始化工具类
        this.keyboardHandler = new KeyboardHandler();
        this.arrowKeyController = new ArrowKeyController();
        this.specialToolHandler = new SpecialToolHandler();

        if (typeof fabric === 'undefined') {
            setTimeout(() => this.initializeController(), 100);
            return;
        }
        
        this.initializeController();
        registerArrowClass();
    }
    
    async initializeController() {
        // 加载设置
        await settingsManager.loadSettings();

        this.setBodySize();
        window.addEventListener('resize', () => this.setBodySize());
        
        // 初始化各个管理器
        this.initializeManagers();
        
        // 设置管理器之间的引用关系
        this.setupManagerDependencies();
        
        // 设置工具类的依赖
        this.setupToolHandlers();
        
        // 绑定事件处理
        this.bindEventHandlers();
        
        // 加载显示器信息
        this.loadMonitorInfo();

        // 初始化提示管理器
        this.tooltipManager.init();
        
        // 设置全局引用
        window.screenshotController = this;
        window.screenshotApp = this;
    }

    /**
     * 初始化所有管理器
     */
    initializeManagers() {
        this.selectionManager = new CanvasSelectionManager();
        this.selectionInfoPanel = new SelectionInfoPanel();
        this.toolbarManager = new ToolbarManager();
        this.subToolbarManager = new SubToolbarManager();
        this.eventManager = new EventManager();
        this.backgroundManager = new BackgroundManager();
        this.exportManager = new ExportManager();
        this.editLayerManager = new FabricEditLayerManager();
        this.toolManager = new FabricToolManager();
        this.magnifierManager = new MagnifierManager();
        this.ocrManager = new OCRManager();
        this.helpPanelManager = new HelpPanelManager();
        this.scrollingScreenshotManager = new ScrollingScreenshotManager();
        this.tooltipManager = new TooltipManager();
    }

    /**
     * 设置管理器之间的依赖关系
     */
    setupManagerDependencies() {
        // 导出管理器依赖
        this.exportManager.setBackgroundManager(this.backgroundManager);
        this.exportManager.setEditLayerManager(this.editLayerManager);
        
        // 编辑层依赖
        this.editLayerManager.setBackgroundManager(this.backgroundManager);
        
        // 工具管理器依赖
        this.toolManager.setEditLayerManager(this.editLayerManager);
        
        // 放大镜管理器设置
        const settings = settingsManager.getSettings();
        this.magnifierManager.setColorIncludeFormat(settings.colorIncludeFormat);
        this.magnifierManager.setOnColorCopied(() => this.cancelScreenshot());
    }

    /**
     * 设置工具处理器
     */
    setupToolHandlers() {
        // 方向键控制器回调
        this.arrowKeyController.setMoveCallback(async (direction, step) => {
            const cssX = this.magnifierManager?.currentX ?? this.eventManager?.lastMouseX ?? 0;
            const cssY = this.magnifierManager?.currentY ?? this.eventManager?.lastMouseY ?? 0;
            
            const newPos = CoordinateUtils.moveByDirection(cssX, cssY, direction, step);
            await CoordinateUtils.setCursorPosition(newPos.x, newPos.y);
        });

        // 特殊工具处理器依赖
        this.specialToolHandler.setManagers({
            ocrManager: this.ocrManager,
            scrollingScreenshotManager: this.scrollingScreenshotManager,
            backgroundManager: this.backgroundManager,
            selectionManager: this.selectionManager,
            exportManager: this.exportManager,
            toolbarManager: this.toolbarManager,
            tooltipManager: this.tooltipManager
        });

        this.specialToolHandler.setCallbacks({
            onHideAllToolbars: () => this.hideAllToolbars(),
            onClearAllContent: () => this.clearAllContent()
        });

        // 键盘快捷键注册
        this.registerKeyboardShortcuts();
    }

    /**
     * 注册键盘快捷键
     */
    registerKeyboardShortcuts() {
        this.keyboardHandler.registerShortcut('escape', () => this.cancelScreenshot());
        
        this.keyboardHandler.registerShortcut('enter', () => {
            const selection = this.selectionManager.getSelection();
            if (selection) {
                this.confirmScreenshot();
            }
        });
        
        this.keyboardHandler.registerShortcut('ctrl+z', 
            () => this.handleUndo(),
            () => KeyboardHandler.canUseShortcuts() && this.canUseKeyboardShortcuts()
        );
        
        this.keyboardHandler.registerShortcut('ctrl+y', 
            () => this.handleRedo(),
            () => KeyboardHandler.canUseShortcuts() && this.canUseKeyboardShortcuts()
        );
        
        this.keyboardHandler.registerShortcut('ctrl+shift+z', 
            () => this.handleRedo(),
            () => KeyboardHandler.canUseShortcuts() && this.canUseKeyboardShortcuts()
        );
    }

    /**
     * 绑定所有事件处理
     */
    bindEventHandlers() {
        // 事件管理器回调
        this.eventManager.setOnSelectionStart((x, y, target) => this.handleSelectionStart(x, y, target));
        this.eventManager.setOnSelectionUpdate((x, y, shiftKey) => this.handleSelectionUpdate(x, y, shiftKey));
        this.eventManager.setOnSelectionEnd(() => this.handleSelectionEnd());
        this.eventManager.setOnRightClick((x, y) => this.handleRightClick(x, y));
        this.eventManager.setOnKeyDown((key) => this.handleKeyDown(key));
        this.eventManager.setOnKeyUp((key) => this.handleKeyUp(key));
        this.eventManager.setOnWindowFocus(() => this.handleWindowFocus());
        this.eventManager.setOnWindowBlur(() => this.handleWindowBlur());
        this.eventManager.setOnCursorUpdate((x, y) => this.handleCursorUpdate(x, y));
        
        // 工具栏管理器回调
        this.toolbarManager.setOnConfirm(() => this.confirmScreenshot());
        this.toolbarManager.setOnCancel(() => this.cancelScreenshot());
        this.toolbarManager.setOnToolSelect((toolName) => this.handleToolSelect(toolName));
        this.toolbarManager.setOnUndo(() => this.handleUndo());
        this.toolbarManager.setOnRedo(() => this.handleRedo());
        this.toolbarManager.setOnClear(() => this.handleClear());
        
        // 子工具栏参数变化回调
        this.subToolbarManager.onParameterChange((toolName, paramName, value) => {
            this.handleParameterChange(toolName, paramName, value);
        });
        
        // 选区信息面板回调
        this.selectionInfoPanel.setOnRadiusChange((radius) => {
            this.selectionManager.borderRadius = radius;
            this.selectionManager.saveBorderRadius(radius);
            this.selectionManager.scheduleDraw();
        });
        
        this.selectionInfoPanel.setOnAspectRatioSelect((ratio) => {
            this.applyAspectRatio(ratio);
        });
        
        // 编辑层回调
        this.editLayerManager.setOnHistoryChange((historyState) => {
            this.toolbarManager.updateHistoryButtons(historyState.canUndo, historyState.canRedo);
        });
        
        this.editLayerManager.setOnActiveObjectChange((objectInfo) => {
            this.handleActiveObjectChange(objectInfo);
        });
        
        // 监听后端截屏事件
        this.listenToBackendEvents();
        
        // 页面加载完成时初始化背景
        if (document.readyState === 'complete') {
            this.backgroundManager.init();
        } else {
            window.addEventListener('load', () => this.backgroundManager.init());
        }
    }

    /**
     * 监听后端事件
     */
    listenToBackendEvents() {
        window.__TAURI__.event.listen('screenshot-ready', async (event) => {
            const payload = event.payload;

            if (!payload || typeof payload !== 'object') {
                console.error('无法解析截屏事件数据', payload);
                return;
            }

            const { width, height, image_url } = payload;
            if (!width || !height || !image_url) {
                console.error('截屏事件缺少字段', payload);
                return;
            }

            this.pendingScreenshotData = { width, height, image_url };
            await this.reinitialize();
        });

        window.__TAURI__.event.listen('screenshot-error', (event) => {
            console.error('后端截屏失败:', event.payload);
        });
    }

    /* ==================== 选区处理 ==================== */

    async handleSelectionStart(x, y, target) {
        // 确认自动选区
        if (target === null && autoSelectionManager.isActive) {
            const bounds = autoSelectionManager.confirmSelection();
            
            if (bounds) {
                this.selectionManager.disableTransition();
                this.selectionManager.setSelection(bounds.x, bounds.y, bounds.width, bounds.height);
                
                const borderRadius = this.selectionManager.getBorderRadius();
                this.selectionInfoPanel.show(this.selectionManager.selectionRect, borderRadius);
                
                if (this.magnifierManager) {
                    this.magnifierManager.hide();
                }
                
                this.toolbarManager.show(this.selectionManager.selectionRect);

                if (this.tooltipManager) {
                    requestAnimationFrame(() => this.tooltipManager.updateAllTooltips());
                }
            }
            return;
        }
        
        // 停止自动选区
        if (autoSelectionManager.isActive) {
            await autoSelectionManager.stop();
        }
        
        // 开始选择操作
        const hitResult = this.selectionManager.hitTest(x, y);
        const action = this.selectionManager.startSelection(x, y, hitResult);
        
        if (action === 'select') {
            this.hideAllToolbars();
            const settings = settingsManager.getSettings();
            if (this.magnifierManager && settings.magnifierEnabled) {
                this.magnifierManager.show();
            }
        } else if (action === 'move' || action === 'resize') {
            this.hideAllToolbars();
        }
    }

    handleSelectionUpdate(x, y, shiftKey) {
        // 更新放大镜
        if (this.magnifierManager) {
            this.magnifierManager.update(x, y);
        }
        
        // 处理选择状态
        if (this.selectionManager.isSelectingState) {
            this.selectionManager.updateSelection(x, y);
            this.hideAllToolbars();
        } else if (this.selectionManager.isMovingState) {
            this.selectionManager.moveSelection(x, y);
            this.hideAllToolbars();
            const selection = this.selectionManager.getSelection();
            if (selection) {
                this.selectionInfoPanel.updateSelectionRect(selection);
            }
        } else if (this.selectionManager.isResizingState) {
            this.selectionManager.resizeSelection(x, y, shiftKey);
            this.hideAllToolbars();
            const selection = this.selectionManager.getSelection();
            const borderRadius = this.selectionManager.getBorderRadius();
            if (selection) {
                this.selectionInfoPanel.show(selection, borderRadius);
            }
        } else if (this.selectionManager.isAdjustingRadius) {
            this.selectionManager.adjustRadius(x, y);
            this.hideAllToolbars();
            const selection = this.selectionManager.getSelection();
            const borderRadius = this.selectionManager.getBorderRadius();
            if (selection) {
                this.selectionInfoPanel.show(selection, borderRadius);
            }
        }
    }

    handleSelectionEnd() {
        const action = this.selectionManager.endSelection();
        
        if (action === 'move-end' || action === 'select-end' || action === 'resize-end' || action === 'radius-end') {
            const selection = this.selectionManager.getSelection();
            if (selection) {
                const mainToolbarPosition = this.toolbarManager.show(selection);
                
                const borderRadius = this.selectionManager.getBorderRadius();
                this.selectionInfoPanel.show(selection, borderRadius);
                
                if (this.magnifierManager) {
                    this.magnifierManager.hide();
                }

                if (this.tooltipManager) {
                    requestAnimationFrame(() => this.tooltipManager.updateAllTooltips());
                }
                
                // 显示子工具栏
                const currentTool = this.toolbarManager.getCurrentTool();
                if (currentTool && mainToolbarPosition) {
                    this.showSubToolbarForTool(currentTool, selection, mainToolbarPosition);
                }
            } else {
                this.disableAllTools();
            }
        }
    }

    async handleRightClick(x, y) {
        // 长截屏激活时，右键不清除选区
        if (this.scrollingScreenshotManager.isActive) {
            return;
        }
        
        const selection = this.selectionManager.getSelection();
        
        if (selection) {
            await this.clearSelection();
        } else {
            this.cancelScreenshot();
        }
    }

    /* ==================== 键盘处理 ==================== */

    handleKeyDown(key) {
        // 处理方向键
        if (key.startsWith('arrow:')) {
            const direction = key.split(':')[1];
            this.arrowKeyController.handleKeyDown(direction);
            return;
        }
        
        // 处理其他快捷键
        this.keyboardHandler.handleKeyDown(key);
    }
    
    handleKeyUp(key) {
        if (key.startsWith('arrow:')) {
            this.arrowKeyController.handleKeyUp();
        }
    }

    /**
     * 检查是否可以使用键盘快捷键
     */
    canUseKeyboardShortcuts() {
        if (this.toolManager && this.toolManager.canUseKeyboardShortcuts) {
            return this.toolManager.canUseKeyboardShortcuts();
        }

        if (this.editLayerManager && this.editLayerManager.getFabricCanvas) {
            const canvas = this.editLayerManager.getFabricCanvas();
            if (canvas) {
                const activeObject = canvas.getActiveObject();
                if (activeObject && activeObject.type === 'text' && activeObject.isEditing) {
                    return false;
                }
            }
        }
        
        return true;
    }

    /* ==================== 窗口事件 ==================== */

    handleWindowFocus() {
        if (this.scrollingScreenshotManager && this.scrollingScreenshotManager.isActive) {
            return;
        }
        this.reset();
    }

    handleWindowBlur() {
        if (this.scrollingScreenshotManager && this.scrollingScreenshotManager.isActive) {
            return;
        }
        this.reset();
    }
    
    handleCursorUpdate(x, y) {
        if (this.selectionManager.isSelectingState || 
            this.selectionManager.isMovingState || 
            this.selectionManager.isResizingState ||
            this.selectionManager.isAdjustingRadius) {
            return;
        }
        
        const hitResult = this.selectionManager.hitTest(x, y);
        const cursorStyle = this.selectionManager.getCursorStyle(hitResult);
        
        const overlay = document.getElementById('overlay');
        if (overlay) {
            overlay.style.cursor = cursorStyle;
        }
    }

    /* ==================== 工具处理 ==================== */

    handleToolSelect(toolName) {
        // OCR工具
        if (toolName === 'ocr') {
            this.toolbarManager.setActiveTool('ocr');
            this.showSubToolbarForTool('ocr');
            return;
        }
        
        // 长截屏工具
        if (toolName === 'scrolling') {
            this.specialToolHandler.handleScrollingScreenshot();
            return;
        }
        
        // 贴图工具
        if (toolName === 'pin-image') {
            this.specialToolHandler.handlePinImage();
            return;
        }
        
        // 普通工具
        if (toolName) {
            this.toolManager.activateTool(toolName);
            this.toolbarManager.setActiveTool(toolName);
            this.showSubToolbarForTool(toolName);
            
            if (toolName === 'brush') {
                this.editLayerManager.updateBrushCursor();
            }
        } else {
            this.toolManager.deactivateTool();
            this.toolbarManager.setActiveTool(null);
            this.subToolbarManager.hide();
        }
    }

    handleParameterChange(toolName, paramName, value) {
        // OCR工具参数
        if (toolName === 'ocr') {
            switch (paramName) {
                case 'recognize':
                    this.specialToolHandler.handleOCRRecognize();
                    break;
                case 'copy':
                    this.specialToolHandler.handleOCRCopy();
                    break;
                case 'close':
                    this.specialToolHandler.handleOCRClose();
                    break;
            }
            return;
        }
        
        // 其他工具参数
        const targetTool = this.toolManager.getTool(toolName);
        if (targetTool && targetTool.applyParameter) {
            targetTool.applyParameter(paramName, value);
        }
        
        if (!targetTool) {
            const currentTool = this.toolManager.getCurrentTool();
            if (currentTool && currentTool.applyParameter) {
                currentTool.applyParameter(paramName, value);
            }
        }
        
        // 画笔工具更新光标
        if (toolName === 'brush' && (paramName === 'brushSize' || paramName === 'color' || paramName === 'opacity')) {
            this.editLayerManager.updateBrushCursor();
        }
    }

    handleActiveObjectChange(objectInfo) {
        const { activeObject, type } = objectInfo;
        
        if (!activeObject || !type) {
            this.subToolbarManager.hide();
            return;
        }
        
        const toolName = ObjectTypeMapper.mapObjectTypeToToolName(type);
        if (toolName) {
            const selectionRect = this.getActiveObjectBounds(activeObject);
            this.showSubToolbarForTool(toolName, selectionRect);
        } else {
            this.subToolbarManager.hide();
        }
    }

    getActiveObjectBounds(activeObject) {
        if (!activeObject) return null;
        
        try {
            const bounds = activeObject.getBoundingRect();
            return {
                left: bounds.left,
                top: bounds.top,
                width: bounds.width,
                height: bounds.height
            };
        } catch (error) {
            console.warn('获取对象边界失败:', error);
            return null;
        }
    }

    showSubToolbarForTool(toolName, selectionRect = null, mainToolbarPosition = null) {
        const selection = selectionRect || this.selectionManager.getSelection();
        
        if (selection && this.toolbarManager.isVisible()) {
            if (!mainToolbarPosition) {
                const mainToolbarRect = this.toolbarManager.toolbar.getBoundingClientRect();
                mainToolbarPosition = {
                    left: mainToolbarRect.left,
                    top: mainToolbarRect.top,
                    width: mainToolbarRect.width,
                    height: mainToolbarRect.height
                };
            }
            
            this.subToolbarManager.showForTool(toolName, mainToolbarPosition, selection);

            if (this.tooltipManager) {
                requestAnimationFrame(() => this.tooltipManager.updateAllTooltips());
            }
        }
    }

    /* ==================== 编辑操作 ==================== */

    async handleUndo() {
        try {
            await this.editLayerManager.undo();
        } catch (error) {
            console.error('撤销失败:', error);
        }
    }

    async handleRedo() {
        try {
            await this.editLayerManager.redo();
        } catch (error) {
            console.error('重做失败:', error);
        }
    }

    handleClear() {
        if (this.editLayerManager) {
            this.editLayerManager.clear();
        }
    }

    /* ==================== UI管理 ==================== */

    hideAllToolbars() {
        this.toolbarManager.hide();
        this.subToolbarManager.hide();
        this.selectionInfoPanel.hide();
    }

    disableAllTools() {
        if (this.toolManager) {
            this.toolManager.deactivateTool();
        }
        
        if (this.toolbarManager) {
            this.toolbarManager.setActiveTool(null);
        }
        
        this.hideAllToolbars();
    }

    /* ==================== 截屏操作 ==================== */

    async confirmScreenshot() {
        const selection = this.selectionManager.getSelection();
        if (!selection) return;
        
        try {
            this.hideAllToolbars();
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const borderRadius = this.selectionManager.getBorderRadius();
            await this.exportManager.copySelectionToClipboard(selection, borderRadius);
            
            this.clearAllContent();
            await ScreenshotAPI.hideWindow();
        } catch (error) {
            console.error('截屏失败:', error);
        }
    }

    async cancelScreenshot() {
        try {
            if (autoSelectionManager.isActive) {
                await autoSelectionManager.stop();
            }

            this.toolbarManager.setActiveTool(null);
            this.clearAllContent();
            await ScreenshotAPI.hideWindow();
        } catch (error) {
            console.error('取消截屏失败:', error);
        }
    }

    async clearSelection() {
        this.selectionManager.clearSelection();
        this.selectionInfoPanel.hide();
        this.disableAllTools();
        
        const settings = settingsManager.getSettings();
        if (this.magnifierManager && settings.magnifierEnabled && this.backgroundManager?.isScreenshotLoaded) {
            this.magnifierManager.show();
        }
        
        await autoSelectionManager.start();
    }

    applyAspectRatio(ratio) {
        const selection = this.selectionManager.getSelection();
        if (!selection) return;
        
        const { left, top } = selection;
        let newWidth, newHeight;
        
        if (ratio === null) {
            newWidth = window.innerWidth;
            newHeight = window.innerHeight;
            this.selectionManager.setSelection(0, 0, newWidth, newHeight);
        } else {
            const baseSize = 300;
            
            if (ratio >= 1) {
                newWidth = baseSize;
                newHeight = baseSize / ratio;
            } else {
                newHeight = baseSize;
                newWidth = baseSize * ratio;
            }
            
            const clampedLeft = Math.max(0, Math.min(left, window.innerWidth - newWidth));
            const clampedTop = Math.max(0, Math.min(top, window.innerHeight - newHeight));
            
            this.selectionManager.setSelection(clampedLeft, clampedTop, newWidth, newHeight);
        }
        
        this.selectionManager.scheduleDraw();
        const updatedSelection = this.selectionManager.getSelection();
        const borderRadius = this.selectionManager.getBorderRadius();
        this.selectionInfoPanel.show(updatedSelection, borderRadius);
    }

    clearAllContent() {
        try {
            if (this.editLayerManager) {
                this.editLayerManager.clear();
                this.editLayerManager.clearHistory();
            }
            
            if (this.backgroundManager?.clearBackground) {
                this.backgroundManager.clearBackground();
            }
            
            if (this.selectionManager?.reset) {
                this.selectionManager.reset();
            }
            
            if (this.magnifierManager?.clear) {
                this.magnifierManager.clear();
            }
            
            if (this.helpPanelManager?.hide) {
                this.helpPanelManager.hide();
            }
            
            if (this.ocrManager?.clear) {
                this.ocrManager.clear();
            }
            
            if (this.scrollingScreenshotManager?.clear) {
                this.scrollingScreenshotManager.clear();
            }
            
            this.hideAllToolbars();
        } catch (error) {
            console.error('清空内容失败:', error);
        }
    }

    reset() {
        this.selectionManager.reset();
        this.disableAllTools(); 
        this.editLayerManager.restoreCursor();
    }

    /* ==================== 初始化相关 ==================== */

    async reinitialize() {
        try {
            await settingsManager.loadSettings();
            
            await autoSelectionManager.start();
            
            const settings = settingsManager.getSettings();
            if (this.magnifierManager) {
                this.magnifierManager.setColorIncludeFormat(settings.colorIncludeFormat);
            }

            if (!this.backgroundManager.canvas) {
                this.backgroundManager.init();
            }
            
            if (this.pendingScreenshotData) {
                await this.backgroundManager.loadScreenshot(this.pendingScreenshotData);
            }
            
            this.editLayerManager.init();
            
            if (this.backgroundManager.canvas) {
                this.magnifierManager.setBackgroundCanvas(this.backgroundManager.canvas);
                if (settings.magnifierEnabled) {
                    this.magnifierManager.show();
                }
            }
            
            if (settings.hintsEnabled) {
                this.helpPanelManager.show();
            }
        } catch (error) {
            console.error('重新初始化失败:', error);
        }
    }

    async loadMonitorInfo() {
        try {
            this.monitors = await ScreenshotAPI.getMonitors();
            const virtualBounds = CoordinateUtils.calculateVirtualBounds(this.monitors);
            
            this.selectionManager.setMonitorBounds(this.monitors, virtualBounds);
            this.helpPanelManager.setMonitors(this.monitors);
        } catch (error) {
            console.error('加载显示器信息失败:', error);
            this.monitors = [];
        }
    }
    
    setBodySize() {
        document.body.style.width = `${window.innerWidth}px`;
        document.body.style.height = `${window.innerHeight}px`;
    }
}

// 初始化
let screenshotController = null;

document.addEventListener('DOMContentLoaded', () => {
    screenshotController = new ScreenshotController();
});

