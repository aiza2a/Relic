/**
 * 子工具栏管理器
 * 负责管理各种工具的参数设置界面
 */

import { boundsConstraint } from '../utils/bounds-constraint.js';

export class SubToolbarManager {
    constructor() {
        this.subToolbar = null;
        this.currentTool = null;
        this.parameters = new Map(); // 存储各工具的参数值
        this.callbacks = new Map(); // 参数变化回调
        this.colorPicker = null; // 颜色选择面板
        this.colorPickerClickHandler = null; // 颜色面板点击处理器
        
        // 工具参数配置
        this.toolConfigs = {
            // 公共参数（所有工具都有）
            common: {
                color: {
                    type: 'color',
                    label: '颜色',
                    default: '#ff0000',
                    icon: 'ti ti-palette'
                },
                opacity: {
                    type: 'slider',
                    label: '透明度',
                    default: 100,
                    min: 0,
                    max: 100,
                    step: 1,
                    unit: '%',
                    icon: 'ti ti-adjustments'
                }
            },
            
            // 序号标注工具参数
            number: {
                numberType: {
                    type: 'select',
                    label: '序号类型',
                    default: 'numeric',
                    options: [
                        { value: 'numeric', label: '数字 (1,2,3)', icon: 'ti ti-123' },
                        { value: 'letter', label: '字母 (A,B,C)', icon: 'ti ti-abc' },
                        { value: 'roman', label: '罗马 (I,II,III)', icon: 'ti ti-letter-case' }
                    ],
                    icon: 'ti ti-123'
                },
                shapeType: {
                    type: 'shape-panel',
                    label: '形状',
                    default: 'circle',
                    options: [
                        { value: 'circle', label: '圆形', icon: 'ti ti-circle' },
                        { value: 'square', label: '方形', icon: 'ti ti-square' },
                        { value: 'diamond', label: '菱形', icon: 'ti ti-diamonds' },
                        { value: 'hexagon', label: '六边形', icon: 'ti ti-hexagon' }
                    ],
                    icon: 'ti ti-circle'
                },
                filled: {
                    type: 'toggle',
                    label: '填充',
                    default: true,
                    icon: 'ti ti-paint'
                },
                textColor: {
                    type: 'color',
                    label: '文字颜色',
                    default: '#ffffff',
                    icon: 'ti ti-typography'
                },
                size: {
                    type: 'slider',
                    label: '大小',
                    default: 32,
                    min: 24,
                    max: 60,
                    step: 4,
                    unit: 'px',
                    icon: 'ti ti-dimensions'
                },
                currentNumber: {
                    type: 'number',
                    label: '当前序号',
                    default: 1,
                    min: 1,
                    max: 999,
                    icon: 'ti ti-number-small'
                },
                lockNumber: {
                    type: 'toggle',
                    label: '锁定序号',
                    default: false,
                    icon: 'ti ti-lock'
                }
            },
            
            // 画笔工具参数
            brush: {
                brushType: {
                    type: 'shape-panel',
                    label: '笔刷类型',
                    default: 'Pencil',
                    options: [
                        { value: 'Pencil', label: '铅笔', icon: 'ti ti-pencil' },
                        { value: 'Circle', label: '圆形', icon: 'ti ti-circle-dot' },
                        { value: 'Spray', label: '喷雾', icon: 'ti ti-spray' },
                        { value: 'hline', label: '横线', icon: 'ti ti-baseline-density-medium' },
                        { value: 'vline', label: '竖线', icon: 'ti ti-tallymark-3' },
                        { value: 'square', label: '方形', icon: 'ti ti-square' },
                        { value: 'diamond', label: '菱形', icon: 'ti ti-diamonds' }
                    ],
                    icon: 'ti ti-brush'
                },
                brushSize: {
                    type: 'slider',
                    label: '笔刷大小',
                    default: 5,
                    min: 1,
                    max: 50,
                    step: 1,
                    unit: 'px',
                    icon: 'ti ti-circle'
                }
            },
            
            // 文本工具参数
            text: {
                fontSize: {
                    type: 'slider',
                    label: '字体大小',
                    default: 16,
                    min: 8,
                    max: 72,
                    step: 1,
                    unit: 'px',
                    icon: 'ti ti-typography'
                },
                fontFamily: {
                    type: 'select',
                    label: '字体',
                    default: 'Arial',
                    options: [
                        { value: 'Arial', label: 'Arial' },
                        { value: 'Microsoft YaHei', label: '微软雅黑' },
                        { value: 'SimHei', label: '黑体' },
                        { value: 'SimSun', label: '宋体' }
                    ],
                    icon: 'ti ti-typography'
                },
                fontWeight: {
                    type: 'toggle',
                    label: '粗体',
                    default: false,
                    icon: 'ti ti-bold'
                },
                fontStyle: {
                    type: 'toggle',
                    label: '斜体',
                    default: false,
                    icon: 'ti ti-italic'
                }
            },
            
            // 专业箭头标注工具参数
            arrow: {
                strokeWidth: {
                    type: 'slider',
                    label: '线条粗细',
                    default: 2,
                    min: 1,
                    max: 8,
                    step: 1,
                    unit: 'px',
                    icon: 'ti ti-line'
                },
                arrowHeadSize: {
                    type: 'slider',
                    label: '箭头大小',
                    default: 18,
                    min: 6,
                    max: 30,
                    step: 2,
                    unit: 'px',
                    icon: 'ti ti-arrow-right'
                },
                arrowStyle: {
                    type: 'select',
                    label: '线条样式',
                    default: 'solid',
                    options: [
                        { value: 'solid', label: '实线', icon: 'ti ti-minus' },
                        { value: 'dashed', label: '虚线', icon: 'ti ti-line-dashed' }
                    ],
                    icon: 'ti ti-line'
                },
            },
            
            // 形状工具参数（几何形状：矩形、圆形、箭头形状）
            shape: {
                shapeType: {
                    type: 'shape-panel',
                    label: '形状类型',
                    default: 'rectangle',
                    options: [
                        { value: 'rectangle', label: '矩形', icon: 'ti ti-square' },
                        { value: 'circle', label: '圆形', icon: 'ti ti-circle' },
                        { value: 'ellipse', label: '椭圆', icon: 'ti ti-oval' },
                        { value: 'arrow', label: '箭头', icon: 'ti ti-arrow-right' },
                        { value: 'triangle', label: '三角形', icon: 'ti ti-triangle' },
                        { value: 'diamond', label: '菱形', icon: 'ti ti-diamonds' },
                        { value: 'pentagon', label: '五边形', icon: 'ti ti-pentagon' },
                        { value: 'hexagon', label: '六边形', icon: 'ti ti-hexagon' },
                        { value: 'star', label: '星形', icon: 'ti ti-star' }
                    ],
                    icon: 'ti ti-shapes'
                },
                strokeWidth: {
                    type: 'slider',
                    label: '边框粗细',
                    default: 2,
                    min: 0,
                    max: 20,
                    step: 1,
                    unit: 'px',
                    icon: 'ti ti-line-height'
                },
                filled: {
                    type: 'toggle',
                    label: '填充',
                    default: false,
                    icon: 'ti ti-color-fill'
                },
                fillColor: {
                    type: 'color',
                    label: '填充颜色',
                    default: '#ff0000',
                    icon: 'ti ti-palette',
                    dependsOn: 'filled' // 依赖填充开关
                }
            },
            
            // 水印工具参数
            watermark: {
                enabled: {
                    type: 'toggle',
                    label: '启用水印',
                    default: false,
                    icon: 'ti ti-wall'
                },
                text: {
                    type: 'text',
                    label: '水印文字',
                    default: '水印文字',
                    icon: 'ti ti-text'
                },
                fontSize: {
                    type: 'slider',
                    label: '字体大小',
                    default: 24,
                    min: 12,
                    max: 72,
                    step: 2,
                    unit: 'px',
                    icon: 'ti ti-text-size'
                },
                rotation: {
                    type: 'slider',
                    label: '旋转角度',
                    default: -45,
                    min: -90,
                    max: 90,
                    step: 5,
                    unit: '°',
                    icon: 'ti ti-rotate'
                },
                spacing: {
                    type: 'slider',
                    label: '间距',
                    default: 100,
                    min: 50,
                    max: 300,
                    step: 10,
                    unit: 'px',
                    icon: 'ti ti-spacing-horizontal'
                }
            },
            
            // 马赛克工具参数
            mosaic: {
                _skipCommonParams: true,
                drawMode: {
                    type: 'select',
                    label: '绘制模式',
                    default: 'brush',
                    options: [
                        { value: 'brush', label: '画笔', icon: 'ti ti-brush' },
                        { value: 'area', label: '区域', icon: 'ti ti-square' }
                    ],
                    icon: 'ti ti-brush'
                },
                effectType: {
                    type: 'select',
                    label: '图形模式',
                    default: 'mosaic',
                    options: [
                        { value: 'mosaic', label: '马赛克', icon: 'ti ti-grid-dots' },
                        { value: 'blur', label: '模糊', icon: 'ti ti-blur' }
                    ],
                    icon: 'ti ti-grid-dots'
                },
                brushSize: {
                    type: 'slider',
                    label: '画笔大小',
                    default: 30,
                    min: 10,
                    max: 100,
                    step: 5,
                    unit: 'px',
                    icon: 'ti ti-circle',
                    dependsOn: 'drawMode',
                    dependsValue: 'brush'
                },
                mosaicSize: {
                    type: 'slider',
                    label: '马赛克大小',
                    default: 10,
                    min: 3,
                    max: 30,
                    step: 1,
                    unit: 'px',
                    icon: 'ti ti-box',
                    dependsOn: 'effectType',
                    dependsValue: 'mosaic'
                },
                blurRadius: {
                    type: 'slider',
                    label: '模糊半径',
                    default: 10,
                    min: 1,
                    max: 30,
                    step: 1,
                    unit: 'px',
                    icon: 'ti ti-blur',
                    dependsOn: 'effectType',
                    dependsValue: 'blur'
                }
            },
            
            // OCR工具
            ocr: {
                _actions: true,
                recognize: {
                    type: 'action',
                    label: '识别文字',
                    icon: 'ti ti-scan'
                },
                advancedRecognize: {
                    type: 'action',
                    label: '高级识别',
                    icon: 'ti ti-wand',
                    disabled: true
                },
                copy: {
                    type: 'action',
                    label: '复制',
                    icon: 'ti ti-copy'
                },
                close: {
                    type: 'action',
                    label: '关闭',
                    icon: 'ti ti-x'
                }
            }
        };
        
        this.initParameters();
    }

    /**
     * 初始化默认参数值
     */
    initParameters() {
        for (const [toolName, config] of Object.entries(this.toolConfigs)) {
            this.parameters.set(toolName, {});
            for (const [paramName, paramConfig] of Object.entries(config)) {
                // 跳过特殊标记（如 _actions）
                if (paramName.startsWith('_')) continue;
                
                // 只初始化有 default 属性的参数
                if (paramConfig && paramConfig.default !== undefined) {
                    this.parameters.get(toolName)[paramName] = paramConfig.default;
                }
            }
        }
    }

    /**
     * 创建子工具栏DOM结构
     */
    createSubToolbar() {
        if (this.subToolbar) return;
        
        this.subToolbar = document.createElement('div');
        this.subToolbar.className = 'sub-toolbar';
        this.subToolbar.id = 'subToolbar';
        
        document.body.appendChild(this.subToolbar);
    }

    /**
     * 显示指定工具的参数工具栏
     */
    showForTool(toolName, mainToolbarPosition, selectionRect = null) {
        if (!toolName) {
            this.hide();
            return;
        }
        
        // 选择工具不显示子工具栏
        if (toolName === 'selection') {
            this.hide();
            return;
        }
        
        this.currentTool = toolName;
        
        // 尝试从活动对象同步参数
        this.syncParametersFromActiveObject(toolName);
        
        this.createSubToolbar();
        this.renderToolParameters(toolName);
        this.positionSubToolbar(mainToolbarPosition, selectionRect);
        this.subToolbar.classList.add('visible');
    }

    /**
     * 隐藏子工具栏
     */
    hide() {
        if (this.subToolbar) {
            this.subToolbar.classList.remove('visible');
        }
        this.currentTool = null;
    }

    /**
     * 渲染工具参数
     */
    renderToolParameters(toolName) {
        if (!this.subToolbar) return;
        
        // 形状工具（rectangle、circle、arrow-shape）都使用 'shape' 配置
        let toolConfigKey = toolName;
        if (['rectangle', 'circle'].includes(toolName)) {
            toolConfigKey = 'shape';
        }
        
        const toolConfig = this.toolConfigs[toolConfigKey] || {};
        
        // 检查是否是纯操作按钮工具（如 OCR）
        const isActionsOnly = toolConfig._actions === true;
        
        // 检查是否跳过公共参数
        const skipCommonParams = toolConfig._skipCommonParams === true;
        
        // 构建配置对象，排除特殊标记
        let allConfig;
        if (isActionsOnly) {
            // 只使用工具特定参数，排除 _actions 标记
            const { _actions, ...restConfig } = toolConfig;
            allConfig = restConfig;
        } else if (skipCommonParams) {
            const { _skipCommonParams, ...restConfig } = toolConfig;
            allConfig = restConfig;
        } else {
            const commonConfig = this.toolConfigs.common || {};
            const { _actions, _skipCommonParams, ...restConfig } = toolConfig;
            allConfig = { ...commonConfig, ...restConfig };
        }
        
        // 清空现有内容
        this.subToolbar.innerHTML = '';
        
        // 渲染参数控件
        for (const [paramName, paramConfig] of Object.entries(allConfig)) {
            const paramElement = this.createParameterElement(toolName, paramName, paramConfig);
            this.subToolbar.appendChild(paramElement);
        }
    }

    /**
     * 创建参数控件元素
     */
    createParameterElement(toolName, paramName, config) {
        const wrapper = document.createElement('div');
        wrapper.className = 'param-item';
        
        // 检查依赖条件
        if (config.dependsOn) {
            const dependValue = this.getParameter(toolName, config.dependsOn);
            if (config.dependsValue !== undefined) {
                if (dependValue !== config.dependsValue) {
                    wrapper.style.display = 'none';
                }
                wrapper.dataset.dependsOn = config.dependsOn;
                wrapper.dataset.dependsValue = config.dependsValue;
            } else {
                if (!dependValue) {
                    wrapper.style.display = 'none';
                }
                wrapper.dataset.dependsOn = config.dependsOn;
            }
        }
        
        // 根据参数类型创建不同的控件
        switch (config.type) {
            case 'color':
                wrapper.appendChild(this.createColorPicker(toolName, paramName, config));
                break;
            case 'slider':
                wrapper.appendChild(this.createSlider(toolName, paramName, config));
                break;
            case 'select':
                wrapper.appendChild(this.createSelect(toolName, paramName, config));
                break;
            case 'shape-panel':
                wrapper.appendChild(this.createShapePanel(toolName, paramName, config));
                break;
            case 'toggle':
                wrapper.appendChild(this.createToggle(toolName, paramName, config));
                break;
            case 'number':
                wrapper.appendChild(this.createNumberInput(toolName, paramName, config));
                break;
            case 'text':
                wrapper.appendChild(this.createTextInput(toolName, paramName, config));
                break;
            case 'action':
                wrapper.appendChild(this.createActionButton(toolName, paramName, config));
                break;
        }
        
        return wrapper;
    }

    /**
     * 创建颜色选择器
     */
    createColorPicker(toolName, paramName, config) {
        const button = document.createElement('button');
        button.className = 'param-color';
        button.dataset.tooltip = config.label;
        
        const currentValue = this.getParameter(toolName, paramName);
        button.style.setProperty('--color-bg', currentValue);
        button.style.backgroundColor = currentValue;
        
        // 颜色选择器图标
        button.innerHTML = `<i class="${config.icon}"></i>`;
        
        // 点击事件
        button.addEventListener('click', () => {
            this.showColorPicker(toolName, paramName, button);
        });
        
        return button;
    }

    /**
     * 创建滑块控件
     */
    createSlider(toolName, paramName, config) {
        const container = document.createElement('div');
        container.className = 'param-slider-container';
        container.dataset.tooltip = config.label;
        
        // 图标
        const icon = document.createElement('i');
        icon.className = config.icon;
        container.appendChild(icon);
        
        // 滑块
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.className = 'param-slider';
        slider.min = config.min;
        slider.max = config.max;
        slider.step = config.step;
        slider.value = this.getParameter(toolName, paramName);
        
        // 数值显示
        const valueDisplay = document.createElement('span');
        valueDisplay.className = 'param-value';
        valueDisplay.textContent = slider.value + (config.unit || '');
        
        // 滑块变化事件
        slider.addEventListener('input', () => {
            const value = parseFloat(slider.value);
            valueDisplay.textContent = value + (config.unit || '');
            this.setParameter(toolName, paramName, value);
        });
        
        container.appendChild(slider);
        container.appendChild(valueDisplay);
        
        return container;
    }

    /**
     * 创建选择器
     */
    createSelect(toolName, paramName, config) {
        const button = document.createElement('button');
        button.className = 'param-select';
        button.dataset.tooltip = config.label;
        
        // 获取当前值并更新显示
        const updateButtonDisplay = () => {
            const currentValue = this.getParameter(toolName, paramName);
            const currentOption = config.options.find(opt => opt.value === currentValue);
            
            if (currentOption && currentOption.icon) {
                button.innerHTML = `<i class="${currentOption.icon}"></i>`;
            } else {
                button.innerHTML = `<i class="${config.icon}"></i>`;
            }
        };
        
        // 初始显示
        updateButtonDisplay();
        
        // 点击事件 - 循环切换选项
        button.addEventListener('click', () => {
            // 每次点击时重新获取当前值，而不是使用闭包中的固定值
            const actualCurrentValue = this.getParameter(toolName, paramName);
            const currentIndex = config.options.findIndex(opt => opt.value === actualCurrentValue);
            const nextIndex = (currentIndex + 1) % config.options.length;
            const nextOption = config.options[nextIndex];
            
            this.setParameter(toolName, paramName, nextOption.value);
            
            // 更新显示
            updateButtonDisplay();
        });
        
        return button;
    }

    /**
     * 创建形状选择面板
     */
    createShapePanel(toolName, paramName, config) {
        const container = document.createElement('div');
        container.className = 'param-shape-panel';
        
        // 当前选中的形状按钮
        const currentButton = document.createElement('button');
        currentButton.className = 'param-shape-current';
        currentButton.dataset.tooltip = config.label;
        
        // 更新当前按钮显示
        const updateCurrentButton = () => {
            const currentValue = this.getParameter(toolName, paramName);
            const currentOption = config.options.find(opt => opt.value === currentValue);
            
            if (currentOption && currentOption.icon) {
                currentButton.innerHTML = `<i class="${currentOption.icon}"></i>`;
                currentButton.dataset.tooltip = `当前形状: ${currentOption.label}`;
            } else {
                currentButton.innerHTML = `<i class="${config.icon}"></i>`;
                currentButton.dataset.tooltip = config.label;
            }
        };
        
        // 初始显示
        updateCurrentButton();
        
        // 创建形状选择面板
        const shapePanel = document.createElement('div');
        shapePanel.className = 'shape-selection-panel';
        shapePanel.style.display = 'none';
        shapePanel.style.visibility = 'hidden'; // 额外确保隐藏
        
        // 创建形状选项网格
        const shapeGrid = document.createElement('div');
        shapeGrid.className = 'shape-grid';
        
        config.options.forEach(option => {
            const shapeItem = document.createElement('button');
            shapeItem.className = 'shape-item';
            shapeItem.innerHTML = `<i class="${option.icon}"></i>`;
            shapeItem.dataset.tooltip = option.label;
            shapeItem.dataset.value = option.value;
            
            // 标记当前选中的形状
            const currentValue = this.getParameter(toolName, paramName);
            if (option.value === currentValue) {
                shapeItem.classList.add('active');
            }
            
            // 点击选择形状
            shapeItem.addEventListener('click', () => {
                this.setParameter(toolName, paramName, option.value);
                updateCurrentButton();
                
                // 更新活跃状态
                shapeGrid.querySelectorAll('.shape-item').forEach(item => {
                    item.classList.remove('active');
                });
                shapeItem.classList.add('active');
                
                // 隐藏面板
                this.hideShapePanel(shapePanel);
            });
            
            shapeGrid.appendChild(shapeItem);
        });
        
        shapePanel.appendChild(shapeGrid);
        
        // 点击当前按钮显示/隐藏面板
        currentButton.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // 隐藏其他可能打开的面板
            document.querySelectorAll('.shape-selection-panel').forEach(panel => {
                if (panel !== shapePanel) {
                    panel.style.display = 'none';
                }
            });
            
            // 切换当前面板
            if (shapePanel.style.display === 'none') {
                this.showShapePanel(shapePanel, currentButton);
            } else {
                this.hideShapePanel(shapePanel);
            }
        });
        
        container.appendChild(currentButton);
        // 将面板直接添加到body中以避免父容器限制
        document.body.appendChild(shapePanel);
        
        // 点击外部隐藏面板
        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) {
                this.hideShapePanel(shapePanel);
            }
        });
        
        return container;
    }

    /**
     * 显示形状选择面板
     */
    showShapePanel(panel, button) {
        panel.style.display = 'block';
        panel.style.visibility = 'visible';
        
        const buttonRect = button.getBoundingClientRect();
        const panelRect = panel.getBoundingClientRect();
        
        // 优先在按钮下方显示
        let left = buttonRect.left;
        let top = buttonRect.bottom + 4;
        
        // 使用边界约束工具
        const constrainedBounds = boundsConstraint.constrain(
            left, top, panelRect.width, panelRect.height
        );
        
        left = constrainedBounds.x;
        top = constrainedBounds.y;
        
        // 如果约束后位置与预期差距太大，说明下方空间不足，尝试上方
        if (top < buttonRect.bottom + 4 - 10) { // 允许一些误差
            const upperTop = buttonRect.top - panelRect.height - 4;
            const upperBounds = boundsConstraint.constrain(
                buttonRect.left, upperTop, panelRect.width, panelRect.height
            );
            
            // 如果上方位置更合适，使用上方
            if (upperBounds.y >= upperTop - 10) {
                left = upperBounds.x;
                top = upperBounds.y;
            }
        }
        
        panel.style.position = 'fixed';
        panel.style.left = left + 'px';
        panel.style.top = top + 'px';
        panel.style.zIndex = '10000';
    }

    /**
     * 隐藏形状选择面板
     */
    hideShapePanel(panel) {
        panel.style.display = 'none';
        panel.style.visibility = 'hidden';
    }

    /**
     * 创建开关按钮
     */
    createToggle(toolName, paramName, config) {
        const button = document.createElement('button');
        button.className = 'param-toggle';
        button.dataset.tooltip = config.label;
        
        const currentValue = this.getParameter(toolName, paramName);
        if (currentValue) {
            button.classList.add('active');
        }
        
        button.innerHTML = `<i class="${config.icon}"></i>`;
        
        // 点击事件
        button.addEventListener('click', () => {
            const newValue = !this.getParameter(toolName, paramName);
            this.setParameter(toolName, paramName, newValue);
            
            if (newValue) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
            
            // 检查依赖关系
            this.updateDependentParameters(toolName, paramName);
        });
        
        return button;
    }

    /**
     * 创建数字输入框
     */
    createNumberInput(toolName, paramName, config) {
        const container = document.createElement('div');
        container.className = 'param-number-container';
        
        const label = document.createElement('label');
        label.className = 'param-number-label';
        label.textContent = config.label;
        
        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'param-number-input';
        input.min = config.min || 1;
        input.max = config.max || 999;
        input.value = this.getParameter(toolName, paramName);
        input.dataset.tooltip = config.label;
        
        // 输入事件
        input.addEventListener('input', () => {
            let value = parseInt(input.value);
            if (isNaN(value)) value = config.default || 1;
            if (value < input.min) value = parseInt(input.min);
            if (value > input.max) value = parseInt(input.max);
            
            this.setParameter(toolName, paramName, value);
            this.triggerParameterChange(toolName, paramName, value);
        });
        
        // 失焦时确保值有效
        input.addEventListener('blur', () => {
            if (input.value === '' || isNaN(parseInt(input.value))) {
                const defaultValue = this.getParameter(toolName, paramName);
                input.value = defaultValue;
            }
        });
        
        container.appendChild(label);
        container.appendChild(input);
        
        return container;
    }

    /**
     * 创建文本输入框
     */
    createTextInput(toolName, paramName, config) {
        const container = document.createElement('div');
        container.className = 'param-text-container';
        container.dataset.tooltip = config.label;
        
        const icon = document.createElement('i');
        icon.className = config.icon;
        container.appendChild(icon);
        
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'param-text-input';
        input.value = this.getParameter(toolName, paramName);
        input.placeholder = config.label;
        
        // 输入事件
        input.addEventListener('input', () => {
            const value = input.value;
            this.setParameter(toolName, paramName, value);
            this.triggerParameterChange(toolName, paramName, value);
        });
        
        container.appendChild(input);
        
        return container;
    }

    /**
     * 创建操作按钮（用于 OCR 等工具）
     */
    createActionButton(toolName, paramName, config) {
        const button = document.createElement('button');
        button.className = 'param-action-btn';
        button.dataset.tooltip = config.label;
        
        button.innerHTML = `<i class="${config.icon}"></i><span>${config.label}</span>`;

        if (config.disabled) {
            button.disabled = true;
            button.classList.add('disabled');
        }
        
        // 点击事件：触发回调
        button.addEventListener('click', () => {
            if (!config.disabled) {
                this.triggerParameterChange(toolName, paramName, 'action');
            }
        });
        
        return button;
    }

    /**
     * 定位子工具栏（智能根据主工具栏相对选区的位置调整）
     */
    positionSubToolbar(mainToolbarPosition, selectionRect = null) {
        if (!this.subToolbar || !mainToolbarPosition) return;
        
        const subToolbarRect = this.subToolbar.getBoundingClientRect();
        const gap = 2;
        
        // 子工具栏与主工具栏右对齐
        let subToolbarLeft = mainToolbarPosition.left + mainToolbarPosition.width - subToolbarRect.width;
        let subToolbarTop;
        
        // 根据主工具栏相对于选区的位置决定子工具栏位置
        if (selectionRect) {
            const selectionBottom = selectionRect.top + selectionRect.height;
            
            // 检测主工具栏是在选区上方还是下方
            if (mainToolbarPosition.top < selectionBottom) {
                // 主工具栏在选区上方，子工具栏应该在主工具栏上方
                subToolbarTop = mainToolbarPosition.top - subToolbarRect.height - gap;
            } else {
                // 主工具栏在选区下方，子工具栏在主工具栏下方
                subToolbarTop = mainToolbarPosition.top + mainToolbarPosition.height + gap;
            }
        } else {
            // 没有选区信息，默认在主工具栏下方
            subToolbarTop = mainToolbarPosition.top + mainToolbarPosition.height + gap;
        }
        
        // 使用通用边界约束
        const constrainedBounds = boundsConstraint.constrain(
            subToolbarLeft, subToolbarTop, subToolbarRect.width, subToolbarRect.height
        );
        
        subToolbarLeft = constrainedBounds.x;
        subToolbarTop = constrainedBounds.y;
        
        // 如果边界约束改变了位置太多，尝试另一边
        const expectedTop = selectionRect && mainToolbarPosition.top < selectionRect.top + selectionRect.height 
            ? mainToolbarPosition.top - subToolbarRect.height - gap
            : mainToolbarPosition.top + mainToolbarPosition.height + gap;
            
        if (Math.abs(subToolbarTop - expectedTop) > gap + 2) {
            // 原位置不可行，尝试另一边
            const alternativeTop = selectionRect && mainToolbarPosition.top < selectionRect.top + selectionRect.height
                ? mainToolbarPosition.top + mainToolbarPosition.height + gap  // 改为下方
                : mainToolbarPosition.top - subToolbarRect.height - gap;       // 改为上方
                
            const alternativeBounds = boundsConstraint.constrain(
                mainToolbarPosition.left + mainToolbarPosition.width - subToolbarRect.width,
                alternativeTop,
                subToolbarRect.width,
                subToolbarRect.height
            );
            
            // 如果另一边的位置更合适，使用另一边
            if (Math.abs(alternativeBounds.y - alternativeTop) <= gap + 2) {
                subToolbarLeft = alternativeBounds.x;
                subToolbarTop = alternativeBounds.y;
            }
        }
        
        // 应用最终位置
        this.subToolbar.style.left = subToolbarLeft + 'px';
        this.subToolbar.style.top = subToolbarTop + 'px';
    }

    /**
     * 显示颜色选择器
     */
    showColorPicker(toolName, paramName, button) {
        // 如果已经有颜色面板，先关闭
        this.hideColorPicker();
        
        // 创建颜色选择面板
        this.colorPicker = this.createColorPickerPanel(toolName, paramName, button);
        document.body.appendChild(this.colorPicker);
        
        // 定位颜色面板
        this.positionColorPicker(button);
        
        // 显示面板
        requestAnimationFrame(() => {
            this.colorPicker.classList.add('visible');
        });
        
        // 点击外部关闭面板
        this.colorPickerClickHandler = (e) => {
            if (!this.colorPicker.contains(e.target) && !button.contains(e.target)) {
                this.hideColorPicker();
            }
        };
        document.addEventListener('click', this.colorPickerClickHandler);
    }

    /**
     * 创建颜色选择面板
     */
    createColorPickerPanel(toolName, paramName, button) {
        const panel = document.createElement('div');
        panel.className = 'color-picker-panel';
        
        // 常用颜色预设
        const presetColors = [
            '#ff0000', '#ff8800', '#ffff00', '#88ff00', '#00ff00', '#00ff88',
            '#00ffff', '#0088ff', '#0000ff', '#8800ff', '#ff00ff', '#ff0088',
            '#000000', '#333333', '#666666', '#999999', '#cccccc', '#ffffff'
        ];
        
        // 预设颜色区域
        const presetsContainer = document.createElement('div');
        presetsContainer.className = 'color-presets';
        
        const presetsTitle = document.createElement('div');
        presetsTitle.className = 'color-section-title';
        presetsTitle.textContent = '常用颜色';
        presetsContainer.appendChild(presetsTitle);
        
        const presetsGrid = document.createElement('div');
        presetsGrid.className = 'color-presets-grid';
        
        presetColors.forEach(color => {
            const colorItem = document.createElement('div');
            colorItem.className = 'color-preset-item';
            colorItem.style.backgroundColor = color;
            colorItem.dataset.tooltip = color;
            
            colorItem.addEventListener('click', () => {
                this.selectColor(toolName, paramName, button, color);
                this.hideColorPicker();
            });
            
            presetsGrid.appendChild(colorItem);
        });
        
        presetsContainer.appendChild(presetsGrid);
        panel.appendChild(presetsContainer);
        
        // 自定义颜色区域
        const customContainer = document.createElement('div');
        customContainer.className = 'color-custom';
        
        const customTitle = document.createElement('div');
        customTitle.className = 'color-section-title';
        customTitle.textContent = '自定义颜色';
        customContainer.appendChild(customTitle);
        
        const customInput = document.createElement('input');
        customInput.type = 'color';
        customInput.className = 'color-custom-input';
        customInput.value = this.getParameter(toolName, paramName) || '#ff0000';
        
        customInput.addEventListener('change', () => {
            this.selectColor(toolName, paramName, button, customInput.value);
        });
        
        customContainer.appendChild(customInput);
        panel.appendChild(customContainer);
        
        // 透明度控制（如果是透明度参数的话）
        if (paramName === 'opacity') {
            const opacityContainer = document.createElement('div');
            opacityContainer.className = 'color-opacity';
            
            const opacityTitle = document.createElement('div');
            opacityTitle.className = 'color-section-title';
            opacityTitle.textContent = '透明度';
            opacityContainer.appendChild(opacityTitle);
            
            const opacitySlider = document.createElement('input');
            opacitySlider.type = 'range';
            opacitySlider.className = 'color-opacity-slider';
            opacitySlider.min = 0;
            opacitySlider.max = 100;
            opacitySlider.value = this.getParameter(toolName, 'opacity') || 100;
            
            const opacityValue = document.createElement('span');
            opacityValue.className = 'color-opacity-value';
            opacityValue.textContent = opacitySlider.value + '%';
            
            opacitySlider.addEventListener('input', () => {
                const opacity = parseInt(opacitySlider.value);
                opacityValue.textContent = opacity + '%';
                this.setParameter(toolName, 'opacity', opacity);
            });
            
            opacityContainer.appendChild(opacitySlider);
            opacityContainer.appendChild(opacityValue);
            panel.appendChild(opacityContainer);
        }
        
        return panel;
    }

    /**
     * 定位颜色选择面板
     */
    positionColorPicker(button) {
        if (!this.colorPicker) return;
        
        const buttonRect = button.getBoundingClientRect();
        const panelRect = this.colorPicker.getBoundingClientRect();
        
        // 优先在按钮下方显示
        let left = buttonRect.left;
        let top = buttonRect.bottom + 4;
        
        // 使用边界约束工具
        const constrainedBounds = boundsConstraint.constrain(
            left, top, panelRect.width, panelRect.height
        );
        
        left = constrainedBounds.x;
        top = constrainedBounds.y;
        
        // 如果约束后位置与预期差距太大，说明下方空间不足，尝试上方
        if (top < buttonRect.bottom + 4 - 10) { // 允许一些误差
            const upperTop = buttonRect.top - panelRect.height - 4;
            const upperBounds = boundsConstraint.constrain(
                buttonRect.left, upperTop, panelRect.width, panelRect.height
            );
            
            // 如果上方位置更合适，使用上方
            if (upperBounds.y >= upperTop - 10) {
                left = upperBounds.x;
                top = upperBounds.y;
            }
        }
        
        this.colorPicker.style.left = left + 'px';
        this.colorPicker.style.top = top + 'px';
    }

    /**
     * 选择颜色
     */
    selectColor(toolName, paramName, button, color) {
        this.setParameter(toolName, paramName, color);
        button.style.setProperty('--color-bg', color);
        button.style.backgroundColor = color;
        
        // 更新按钮显示的颜色
        const currentColor = color.toLowerCase();
        if (currentColor === '#ffffff' || currentColor === '#fff') {
            button.style.borderColor = 'rgba(255, 255, 255, 0.5)';
        } else {
            button.style.borderColor = 'rgba(255, 255, 255, 0.3)';
        }
    }

    /**
     * 隐藏颜色选择器
     */
    hideColorPicker() {
        if (this.colorPicker && this.colorPicker.parentNode) {
            this.colorPicker.parentNode.removeChild(this.colorPicker);
            this.colorPicker = null;
        }
        
        if (this.colorPickerClickHandler) {
            document.removeEventListener('click', this.colorPickerClickHandler);
            this.colorPickerClickHandler = null;
        }
    }

    /**
     * 更新依赖参数的显示状态
     */
    updateDependentParameters(toolName, changedParam) {
        if (!this.subToolbar) return;
        
        const dependentItems = this.subToolbar.querySelectorAll(`[data-depends-on="${changedParam}"]`);
        const paramValue = this.getParameter(toolName, changedParam);
        
        dependentItems.forEach(item => {
            const dependsValue = item.dataset.dependsValue;
            if (dependsValue !== undefined) {
                if (paramValue === dependsValue) {
                    item.style.display = '';
                } else {
                    item.style.display = 'none';
                }
            } else {
                if (paramValue) {
                    item.style.display = '';
                } else {
                    item.style.display = 'none';
                }
            }
        });
    }

    /**
     * 获取参数值
     */
    getParameter(toolName, paramName) {
        // 形状工具都使用 'shape' 参数（不包括独立的箭头标注工具）
        let paramKey = toolName;
        if (['rectangle', 'circle'].includes(toolName)) {
            paramKey = 'shape';
        }
        
        // 先查找工具特定参数，再查找公共参数
        const toolParams = this.parameters.get(paramKey) || {};
        const commonParams = this.parameters.get('common') || {};
        
        let value = toolParams[paramName] !== undefined ? 
                   toolParams[paramName] : commonParams[paramName];
        
        // 如果没有找到值，使用配置中的默认值
        if (value === undefined) {
            const toolConfig = this.toolConfigs[paramKey] || {};
            const paramConfig = toolConfig[paramName];
            if (paramConfig && paramConfig.default !== undefined) {
                value = paramConfig.default;
            }
        }
        
        return value;
    }

    /**
     * 设置参数值
     */
    setParameter(toolName, paramName, value) {
        this.setParameterInternal(toolName, paramName, value, true);
    }

    /**
     * 静默设置参数值（不触发回调）
     */
    setParameterSilent(toolName, paramName, value) {
        this.setParameterInternal(toolName, paramName, value, false);
    }

    /**
     * 内部参数设置方法
     */
    setParameterInternal(toolName, paramName, value, triggerCallback = true) {
        // 确定参数属于哪个类别
        const isCommonParam = this.toolConfigs.common && this.toolConfigs.common[paramName];
        
        if (isCommonParam) {
            // 公共参数
            if (!this.parameters.has('common')) {
                this.parameters.set('common', {});
            }
            this.parameters.get('common')[paramName] = value;
        } else {
            // 工具特定参数 - 形状工具都使用 'shape' 参数存储（不包括独立的箭头标注工具）
            let paramKey = toolName;
            if (['rectangle', 'circle'].includes(toolName)) {
                paramKey = 'shape';
            }
            
            if (!this.parameters.has(paramKey)) {
                this.parameters.set(paramKey, {});
            }
            this.parameters.get(paramKey)[paramName] = value;
        }
        
        // 更新依赖参数的显示状态
        this.updateDependentParameters(toolName, paramName);
        
        // 根据需要触发回调
        if (triggerCallback) {
            this.triggerParameterChange(toolName, paramName, value);
        }
    }

    /**
     * 获取工具的所有参数
     */
    getToolParameters(toolName) {
        const commonParams = this.parameters.get('common') || {};
        
        // 形状工具（rectangle、circle）都使用 'shape' 参数（不包括独立的箭头标注工具）
        let paramKey = toolName;
        if (['rectangle', 'circle'].includes(toolName)) {
            paramKey = 'shape';
        }
        
        const toolParams = this.parameters.get(paramKey) || {};
        const mergedParams = { ...commonParams, ...toolParams };
        if (toolName === 'arrow' && mergedParams.opacity !== undefined) {
            mergedParams.opacity = Math.max(0, Math.min(100, mergedParams.opacity));
        }
        return mergedParams;
    }

    /**
     * 设置参数变化回调
     */
    onParameterChange(callback) {
        this.callbacks.set('global', callback);
    }

    /**
     * 触发参数变化回调
     */
    triggerParameterChange(toolName, paramName, value) {
        const globalCallback = this.callbacks.get('global');
        if (globalCallback) {
            globalCallback(toolName, paramName, value);
        }
    }

    /**
     * 从活动对象同步参数（如果有选中对象）
     */
    syncParametersFromActiveObject(toolName) {
        // 尝试获取fabricCanvas和活动对象
        if (!window.screenshotController?.editLayerManager) return;
        
        const fabricCanvas = window.screenshotController.editLayerManager.getFabricCanvas();
        if (!fabricCanvas) return;
        
        const activeObject = fabricCanvas.getActiveObject();
        if (!activeObject) return;
        
        try {
            // 根据对象类型提取属性
            const properties = this.extractObjectProperties(activeObject, toolName);
            
            // 静默设置参数（不触发回调）
            for (const [paramName, value] of Object.entries(properties)) {
                this.setParameterSilent(toolName, paramName, value);
            }
        } catch (error) {
            console.warn('同步对象属性失败:', error);
        }
    }

    /**
     * 从对象中提取属性
     */
    extractObjectProperties(obj, toolName) {
        const properties = {};
        
        // 通用属性：透明度
        properties.opacity = Math.round((obj.opacity || 1) * 100);
        
        switch (toolName) {
            case 'brush':
                // 画笔路径：stroke 颜色
                if (obj.stroke) {
                    properties.color = obj.stroke;
                }
                if (obj.strokeWidth) {
                    properties.brushSize = obj.strokeWidth;
                }
                break;
                
            case 'text':
                // 文本对象：fill 颜色，字体属性
                if (obj.fill) {
                    properties.color = obj.fill;
                }
                if (obj.fontSize) {
                    properties.fontSize = obj.fontSize;
                }
                if (obj.fontFamily) {
                    properties.fontFamily = obj.fontFamily;
                }
                if (obj.fontWeight) {
                    properties.fontWeight = obj.fontWeight === 'bold';
                }
                if (obj.fontStyle) {
                    properties.fontStyle = obj.fontStyle === 'italic';
                }
                break;
                
            case 'arrow':
                // 箭头对象：stroke 颜色，线条粗细
                if (obj.stroke) {
                    properties.color = obj.stroke;
                }
                if (obj.strokeWidth) {
                    properties.strokeWidth = obj.strokeWidth;
                }
                // 如果是自定义箭头对象，还可以提取箭头特定属性
                if (obj.arrowOptions) {
                    if (obj.arrowOptions.arrowHeadSize) {
                        properties.arrowHeadSize = obj.arrowOptions.arrowHeadSize;
                    }
                    if (obj.arrowOptions.arrowStyle) {
                        properties.arrowStyle = obj.arrowOptions.arrowStyle;
                    }
                }
                break;
                
            case 'shape':
                // 形状对象：边框和填充
                if (obj.stroke) {
                    properties.color = obj.stroke;
                }
                if (obj.strokeWidth) {
                    properties.strokeWidth = obj.strokeWidth;
                }
                if (obj.fill && obj.fill !== 'transparent') {
                    properties.filled = true;
                    properties.fillColor = obj.fill;
                } else {
                    properties.filled = false;
                }
                
                // 根据对象的自定义类型确定形状类型
                if (obj.customType) {
                    switch (obj.customType) {
                        case 'rectangle':
                            properties.shapeType = 'rectangle';
                            break;
                        case 'circle':
                            properties.shapeType = 'circle';
                            break;
                        case 'ellipse':
                            properties.shapeType = 'ellipse';
                            break;
                        case 'triangle':
                            properties.shapeType = 'triangle';
                            break;
                        case 'diamond':
                            properties.shapeType = 'diamond';
                            break;
                        case '5-gon':
                            properties.shapeType = 'pentagon';
                            break;
                        case '6-gon':
                            properties.shapeType = 'hexagon';
                            break;
                        case 'star':
                            properties.shapeType = 'star';
                            break;
                        case 'shape-arrow':
                            properties.shapeType = 'arrow';
                            break;
                    }
                } else if (obj.type) {
                    // 根据Fabric.js内置类型推断
                    switch (obj.type) {
                        case 'rect':
                            properties.shapeType = 'rectangle';
                            break;
                        case 'circle':
                            properties.shapeType = 'circle';
                            break;
                        case 'ellipse':
                            properties.shapeType = 'ellipse';
                            break;
                        case 'polygon':
                            properties.shapeType = 'triangle';
                            break;
                    }
                }
                break;
        }
        
        return properties;
    }

    /**
     * 销毁子工具栏
     */
    destroy() {
        // 清理颜色选择器
        this.hideColorPicker();
        
        // 清理子工具栏
        if (this.subToolbar && this.subToolbar.parentNode) {
            this.subToolbar.parentNode.removeChild(this.subToolbar);
            this.subToolbar = null;
        }
        
        // 清理其他资源
        this.currentTool = null;
        this.parameters.clear();
        this.callbacks.clear();
    }
}
