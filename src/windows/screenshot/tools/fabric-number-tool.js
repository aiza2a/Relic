/**
 * Fabric.js 序号标注工具
 */
import { getCanvas, applyOpacity, getToolParams } from './common-utils.js';

export class FabricNumberTool {
    constructor() {
        this.name = 'number';
        this.fabricCanvas = null;
        this.currentNumber = 1; // 当前序号
        
        // 统一参数结构
        this.options = {
            numberType: 'numeric',     // 序号类型：numeric(1,2,3)、letter(A,B,C)、roman(I,II,III)
            shapeType: 'circle',       // 形状：circle、square、diamond、hexagon
            size: 32,                  // 大小
            color: '#4395ff',          // 背景颜色（通用参数）
            opacity: 100,              // 透明度（通用参数）
            textColor: '#ffffff',      // 文字颜色
            filled: true,              // 是否填充
            lockNumber: false          // 是否锁定序号
        };
    }

    /**
     * 设置Fabric Canvas引用
     */
    setFabricCanvas(fabricCanvas) {
        this.fabricCanvas = fabricCanvas;
    }

    /**
     * 设置参数
     */
    setOptions(options) {
        Object.assign(this.options, options);
    }

    /**
     * 获取当前参数
     */
    getOptions() {
        return { ...this.options };
    }

    /**
     * 应用参数变化
     */
    applyParameter(paramName, value) {
        switch (paramName) {
            case 'color':
                this.options.color = value;
                break;
            case 'opacity':
                this.options.opacity = value;
                break;
            case 'textColor':
                this.options.textColor = value;
                break;
            case 'numberType':
                this.options.numberType = value;
                break;
            case 'shapeType':
                this.options.shapeType = value;
                break;
            case 'size':
                this.options.size = value;
                break;
            case 'filled':
                this.options.filled = value;
                break;
            case 'currentNumber':
                this.currentNumber = parseInt(value);
                break;
            case 'lockNumber':
                this.options.lockNumber = value;
                break;
        }
        
        // 当影响光标显示的参数变化时，更新光标
        if (this.fabricCanvas && ['color', 'textColor', 'numberType', 'shapeType', 'filled', 'currentNumber', 'size'].includes(paramName)) {
            this.updateCursor();
        }
    }

    /**
     * 工具激活时的处理
     */
    onActivate(editLayerManager) {
        if (!editLayerManager || !editLayerManager.getFabricCanvas) {
            console.error('序号工具激活失败：editLayerManager 无效');
            return;
        }
        
        this.fabricCanvas = editLayerManager.getFabricCanvas();
        
        if (!this.fabricCanvas) {
            console.error('序号工具激活失败：fabricCanvas 为空');
            return;
        }
        
        // 从子工具栏获取当前参数值（会自动处理锁定逻辑）
        this.syncParametersFromSubToolbar();
        
        // 更新输入框显示当前序号
        this.updateCurrentNumberDisplay();
        
        // 监听画布点击事件
        this.handleCanvasClick = this.onCanvasClick.bind(this);
        this.fabricCanvas.on('mouse:down', this.handleCanvasClick);
        
        // 禁用选择模式
        editLayerManager.prepareSelectionForTool('number');
        
        // 设置自定义光标
        this.updateCursor();
    }

    /**
     * 画布点击事件处理
     */
    onCanvasClick(event) {
        if (!event.pointer) return;
        
        // 如果点击到了已存在的对象，不创建新序号（由选择工具处理）
        if (event.target) {
            // 点击到了已存在的对象，不处理
            return;
        }
        
        // 只在点击空白区域时创建序号标注
        const numberMark = this.createNumberMark(event.pointer.x, event.pointer.y);
        
        if (numberMark) {
            this.fabricCanvas.add(numberMark);
            // 不自动选中对象，避免触发选择事件导致工具切换
            this.fabricCanvas.requestRenderAll();
            
            // 自动递增序号
            this.currentNumber++;
            
            // 更新子工具栏的当前序号显示
            this.updateCurrentNumberDisplay();
            
            // 更新光标显示下一个序号
            this.updateCursor();
        }
    }

    /**
     * 创建序号标注
     */
    createNumberMark(x, y) {
        const size = this.options.size;
        const displayText = this.getDisplayNumber(this.currentNumber);
        
        // 根据大小自动计算字体大小（约为标注大小的50%）
        const fontSize = Math.round(size * 0.5);
        
        // 创建形状背景
        const shape = this.createShape(size);
        
        // 创建文本
        const text = new fabric.Text(displayText, {
            fontSize: fontSize,
            fill: this.options.textColor,
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            originX: 'center',
            originY: 'center'
        });
        
        // 创建组合对象
        const group = new fabric.Group([shape, text], {
            left: x,
            top: y,
            originX: 'center',
            originY: 'center',
            customType: 'number-mark',
            numberValue: this.currentNumber,
            numberType: this.options.numberType,
            shapeType: this.options.shapeType,
            // 禁用选择和交互，统一由选择工具处理
            selectable: false,
            evented: false
        });
        
        return group;
    }

    /**
     * 创建形状背景
     */
    createShape(size) {
        // 应用透明度到颜色
        const bgColor = applyOpacity(this.options.color, this.options.opacity);
        
        const commonOptions = {
            originX: 'center',
            originY: 'center',
            fill: this.options.filled ? bgColor : 'transparent',
            stroke: bgColor,
            strokeWidth: this.options.filled ? 0 : 2
        };
        
        let shape;
        
        switch (this.options.shapeType) {
            case 'circle':
                shape = new fabric.Circle({
                    ...commonOptions,
                    radius: size / 2
                });
                break;
                
            case 'square':
                shape = new fabric.Rect({
                    ...commonOptions,
                    width: size,
                    height: size,
                    rx: 0,
                    ry: 0
                });
                break;
                
            case 'diamond':
                // 菱形（旋转45度的正方形）
                shape = new fabric.Rect({
                    ...commonOptions,
                    width: size * 0.7,
                    height: size * 0.7,
                    angle: 45
                });
                break;
                
            case 'hexagon':
                // 六边形
                const points = this.getHexagonPoints(size / 2);
                shape = new fabric.Polygon(points, {
                    ...commonOptions
                });
                break;
                
            default:
                shape = new fabric.Circle({
                    ...commonOptions,
                    radius: size / 2
                });
        }
        
        return shape;
    }

    /**
     * 获取六边形的点
     */
    getHexagonPoints(radius) {
        const points = [];
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i - Math.PI / 6;
            points.push({
                x: radius * Math.cos(angle),
                y: radius * Math.sin(angle)
            });
        }
        return points;
    }

    /**
     * 获取显示的序号文本
     */
    getDisplayNumber(num) {
        switch (this.options.numberType) {
            case 'numeric':
                return String(num);
                
            case 'letter':
                // A, B, C, ... Z, AA, AB, ...
                return this.numberToLetter(num);
                
            case 'roman':
                // I, II, III, IV, V, ...
                return this.numberToRoman(num);
                
            default:
                return String(num);
        }
    }

    /**
     * 数字转字母
     */
    numberToLetter(num) {
        let result = '';
        while (num > 0) {
            const remainder = (num - 1) % 26;
            result = String.fromCharCode(65 + remainder) + result;
            num = Math.floor((num - 1) / 26);
        }
        return result || 'A';
    }

    /**
     * 数字转罗马数字
     */
    numberToRoman(num) {
        if (num >= 4000) return String(num); // 超过范围返回数字
        
        const romanNumerals = [
            { value: 1000, symbol: 'M' },
            { value: 900, symbol: 'CM' },
            { value: 500, symbol: 'D' },
            { value: 400, symbol: 'CD' },
            { value: 100, symbol: 'C' },
            { value: 90, symbol: 'XC' },
            { value: 50, symbol: 'L' },
            { value: 40, symbol: 'XL' },
            { value: 10, symbol: 'X' },
            { value: 9, symbol: 'IX' },
            { value: 5, symbol: 'V' },
            { value: 4, symbol: 'IV' },
            { value: 1, symbol: 'I' }
        ];
        
        let result = '';
        for (const { value, symbol } of romanNumerals) {
            while (num >= value) {
                result += symbol;
                num -= value;
            }
        }
        return result;
    }

    /**
     * 从子工具栏同步参数值
     */
    syncParametersFromSubToolbar() {
        const params = getToolParams('number');
        
        // 先同步 lockNumber 状态
        for (const [name, value] of Object.entries(params)) {
            if (name === 'lockNumber') {
                this.applyParameter(name, value);
            }
        }
        
        // 再同步其他参数
        for (const [name, value] of Object.entries(params)) {
            // 如果锁定了，不同步 currentNumber（保持工具实例中的值）
            if (name === 'currentNumber') {
                if (this.options.lockNumber) {
                    continue;
                }
            }
            // 避免重复应用 lockNumber
            if (name === 'lockNumber') {
                continue;
            }
            this.applyParameter(name, value);
        }
    }

    /**
     * 更新子工具栏的当前序号显示
     */
    updateCurrentNumberDisplay() {
        // 由于子工具栏可能还未渲染，使用setTimeout延迟更新
        setTimeout(() => {
            const numberInput = document.querySelector('.param-number-input');
            if (numberInput) {
                numberInput.value = this.currentNumber;
            }
        }, 0);
    }

    /**
     * 生成光标SVG
     */
    generateCursorSVG() {
        const size = this.options.size; // 使用用户设置的大小
        const displayText = this.getDisplayNumber(this.currentNumber);
        const fontSize = size * 0.5;
        const bgColor = this.options.color;
        const textColor = this.options.textColor;
        
        let shapePath = '';
        const center = size / 2;
        const radius = size / 2 - 2;
        
        // 根据形状类型生成路径
        switch (this.options.shapeType) {
            case 'circle':
                shapePath = `<circle cx="${center}" cy="${center}" r="${radius}" />`;
                break;
            case 'square':
                shapePath = `<rect x="2" y="2" width="${size - 4}" height="${size - 4}" />`;
                break;
            case 'diamond':
                shapePath = `<rect x="${center - radius * 0.7}" y="${center - radius * 0.7}" width="${radius * 1.4}" height="${radius * 1.4}" transform="rotate(45 ${center} ${center})" />`;
                break;
            case 'hexagon':
                const points = [];
                for (let i = 0; i < 6; i++) {
                    const angle = (Math.PI / 3) * i - Math.PI / 6;
                    const x = center + radius * Math.cos(angle);
                    const y = center + radius * Math.sin(angle);
                    points.push(`${x},${y}`);
                }
                shapePath = `<polygon points="${points.join(' ')}" />`;
                break;
        }
        
        // 构建SVG
        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
                <!-- 形状 -->
                <g ${this.options.filled ? `fill="${bgColor}"` : `fill="none" stroke="${bgColor}" stroke-width="2"`}>
                    ${shapePath}
                </g>
                <!-- 文字 -->
                <text 
                    x="${center}" 
                    y="${center}" 
                    text-anchor="middle" 
                    dominant-baseline="central" 
                    font-family="Arial, sans-serif" 
                    font-size="${fontSize}" 
                    font-weight="bold" 
                    fill="${textColor}"
                    stroke="${this.options.filled ? 'none' : bgColor}"
                    stroke-width="${this.options.filled ? 0 : 0.5}"
                >${displayText}</text>
            </svg>
        `;
        
        return svg;
    }

    /**
     * 更新光标
     */
    updateCursor() {
        if (!this.fabricCanvas) return;
        
        const svg = this.generateCursorSVG();
        const encodedSvg = encodeURIComponent(svg);
        // 光标锚点设置为中心点
        const hotspotX = this.options.size / 2;
        const hotspotY = this.options.size / 2;
        const cursorUrl = `url('data:image/svg+xml;utf8,${encodedSvg}') ${hotspotX} ${hotspotY}, auto`;
        
        this.fabricCanvas.defaultCursor = cursorUrl;
        this.fabricCanvas.freeDrawingCursor = cursorUrl;
        document.body.style.cursor = cursorUrl;
    }

    /**
     * 工具取消激活时的处理
     */
    onDeactivate(editLayerManager) {
        // 移除事件监听器
        if (this.fabricCanvas && this.handleCanvasClick) {
            this.fabricCanvas.off('mouse:down', this.handleCanvasClick);
            this.handleCanvasClick = null;
        }
        
        // 恢复默认光标
        if (this.fabricCanvas) {
            this.fabricCanvas.defaultCursor = 'default';
        }
        document.body.style.cursor = 'default';
        
        this.fabricCanvas = null;
    }

    /**
     * 获取当前序号
     */
    getCurrentNumber() {
        return this.currentNumber;
    }

    /**
     * 设置当前序号
     */
    setCurrentNumber(num) {
        this.currentNumber = parseInt(num);
    }
}
