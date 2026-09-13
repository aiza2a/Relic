/**
 * Fabric.js文本工具
 */
import { getCanvas, applyOpacity, getToolParams } from './common-utils.js';

export class FabricTextTool {
    constructor() {
        this.name = 'text';
        this.fabricCanvas = null;
        this.editLayerManager = null;
        this.isActive = false;
        this.editCompleteTimeout = null;
        
        // 统一参数结构
        this.options = {
            fontFamily: 'Arial',
            fontSize: 20,
            color: '#000000',
            fontWeight: 'normal',
            fontStyle: 'normal',
            textAlign: 'left'
        };
        
        this.handleCanvasClick = this.handleCanvasClick.bind(this);
    }

    /**
     * 设置文本参数
     */
    setOptions(options) {
        Object.assign(this.options, options);
    }

    getOptions() {
        return { ...this.options };
    }

    applyParameter(paramName, value) {
        switch (paramName) {
            case 'color':
                this.options.color = value;
                break;
            case 'opacity':
                this.options.color = applyOpacity(this.options.color, value);
                break;
            case 'fontSize':
                this.options.fontSize = value;
                break;
            case 'fontFamily':
                this.options.fontFamily = value;
                break;
            case 'fontWeight':
                this.options.fontWeight = value ? 'bold' : 'normal';
                break;
            case 'fontStyle':
                this.options.fontStyle = value ? 'italic' : 'normal';
                break;
        }
        
        this.applyToActiveText();
    }


    /**
     * 应用参数到选中的文本对象
     */
    applyToActiveText() {
        const canvas = getCanvas(this);
        const activeObject = canvas?.getActiveObject();
        
        if (activeObject && (activeObject.type === 'text' || activeObject.type === 'i-text' || activeObject.type === 'textbox')) {
            activeObject.set({
                fontFamily: this.options.fontFamily,
                fontSize: this.options.fontSize,
                fill: this.options.color,
                fontWeight: this.options.fontWeight,
                fontStyle: this.options.fontStyle
            });
            canvas.renderAll();
        }
    }

    /**
     * 工具激活时的处理
     */
    onActivate(editLayerManager) {
        if (!editLayerManager || !editLayerManager.getFabricCanvas) {
            console.error('文本工具激活失败：editLayerManager 无效');
            return;
        }
        
        this.editLayerManager = editLayerManager;
        this.fabricCanvas = editLayerManager.getFabricCanvas();
        
        if (!this.fabricCanvas) {
            console.error('文本工具激活失败：fabricCanvas 为空');
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
        document.body.style.cursor = 'text';
        
        // 从子工具栏获取当前参数值
        this.syncParametersFromSubToolbar();
        
        // 添加点击事件监听器
        if (this.fabricCanvas) {
            this.fabricCanvas.on('mouse:down', this.handleCanvasClick);
        }
    }

    /**
     * 从子工具栏同步参数值
     */
    syncParametersFromSubToolbar() {
        const params = getToolParams('text');
        for (const [name, value] of Object.entries(params)) {
            this.applyParameter(name, value);
        }
    }

    /**
     * 工具取消激活时的处理
     */
    onDeactivate(editLayerManager) {
        this.isActive = false;
        
        // 恢复默认光标
        document.body.style.cursor = 'default';
        
        // 移除事件监听器
        if (this.fabricCanvas) {
            this.fabricCanvas.off('mouse:down', this.handleCanvasClick);
        }
        
        // 清理编辑完成超时定时器
        if (this.editCompleteTimeout) {
            clearTimeout(this.editCompleteTimeout);
            this.editCompleteTimeout = null;
        }
        
        this.fabricCanvas = null;
        this.editLayerManager = null;
    }

    /**
     * 进入文本编辑模式
     */
    enterTextEditMode(textObj) {
        try {
            // 进入编辑模式
            if (typeof textObj.enterEdit === 'function') {
                textObj.enterEdit();
            } else if (typeof textObj.enterEditing === 'function') {
                textObj.enterEditing();
            } else {
                textObj.isEditing = true;
                if (typeof textObj.initHiddenTextarea === 'function') {
                    textObj.initHiddenTextarea();
                }
            }
            
            // 全选文本
            setTimeout(() => {
                if (textObj.isEditing) {
                    if (typeof textObj.selectAll === 'function') {
                        textObj.selectAll();
                    } else {
                        textObj.selectionStart = 0;
                        textObj.selectionEnd = textObj.text ? textObj.text.length : 0;
                    }
                    this.fabricCanvas.renderAll();
                }
            }, 50);
            
        } catch (error) {
            // 编辑失败时静默处理
        }
    }

    /**
     * 设置编辑完成监听器
     */
    setupEditCompleteListener(textObj) {
        const onEditingExited = () => {
            this.switchToSelectionTool(textObj);
            textObj.off('editing:exited', onEditingExited);
            if (this.editCompleteTimeout) {
                clearTimeout(this.editCompleteTimeout);
                this.editCompleteTimeout = null;
            }
        };
        
        textObj.on('editing:exited', onEditingExited);
        
        // 超时保护机制
        this.editCompleteTimeout = setTimeout(() => {
            textObj.off('editing:exited', onEditingExited);
            this.switchToSelectionTool(textObj);
            this.editCompleteTimeout = null;
        }, 30000);
    }

    /**
     * 切换到选择工具并选中指定对象
     */
    switchToSelectionTool(objectToSelect) {
        if (window.screenshotController?.toolManager) {
            window.screenshotController.toolManager.switchToSelectionTool(objectToSelect);
        }
    }

    /**
     * 处理Canvas点击事件
     */
    handleCanvasClick(e) {
        if (!this.isActive || !this.fabricCanvas || !this.editLayerManager) return;
        
        // 如果点击的是已存在的对象，不创建新文本
        if (e.target && e.target !== this.fabricCanvas) return;
        
        const pointer = this.fabricCanvas.getPointer(e.e);
        this.addTextAt(pointer.x, pointer.y);
    }

    /**
     * 在指定位置添加文本
     */
    addTextAt(x, y) {
        if (!this.fabricCanvas || !this.editLayerManager) return null;
        
        const textObj = new fabric.IText('输入文本', {
            left: x,
            top: y,
            fontFamily: this.options.fontFamily,
            fontSize: this.options.fontSize,
            fill: this.options.color,
            fontWeight: this.options.fontWeight,
            fontStyle: this.options.fontStyle,
            textAlign: this.options.textAlign,
            selectable: true,
            editable: true
        });
        textObj.customType = 'text';
        textObj.historyAddReason = '添加文本';

        this.fabricCanvas.add(textObj);
        
        // 设置为可选择
        textObj.selectable = true;
        
        // 设置为活动对象并进入编辑模式
        this.fabricCanvas.setActiveObject(textObj);
        
        setTimeout(() => {
            this.enterTextEditMode(textObj);
            this.setupEditCompleteListener(textObj);
        }, 50);
        
        // 保存历史状态
        setTimeout(() => {
            if (this.editLayerManager?.requestHistorySave) {
                this.editLayerManager.requestHistorySave('添加文本', { immediate: true });
            }
        }, 200);
        
        return textObj;
    }

    /**
     * 设置字体
     */
    setFont(fontFamily) {
        this.setOptions({ fontFamily });
    }

    /**
     * 设置字体大小
     */
    setFontSize(fontSize) {
        this.setOptions({ fontSize });
    }

    /**
     * 设置文本颜色
     */
    setColor(color) {
        this.setOptions({ color });
    }

    /**
     * 设置字体粗细
     */
    setFontWeight(fontWeight) {
        this.setOptions({ fontWeight });
    }

    /**
     * 设置字体样式
     */
    setFontStyle(fontStyle) {
        this.setOptions({ fontStyle });
    }

    getColor() {
        return this.options.color;
    }

    getFontSize() {
        return this.options.fontSize;
    }
}
