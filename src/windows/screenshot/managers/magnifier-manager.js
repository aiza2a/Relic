/**
 * 放大镜管理模块
 * 负责显示鼠标位置的放大镜，包括像素网格、颜色信息等
 */

export class MagnifierManager {
    constructor() {
        this.magnifierElement = null;
        this.gridCanvas = null;
        this.infoElement = null;
        this.isVisible = false;
        this.currentX = 0;
        this.currentY = 0;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.gridRows = 7;
        this.gridCols = 11;
        this.pixelSize = 12; // 每个像素格子的大小（减小以减少整体尺寸）
        this.centerRow = Math.floor(this.gridRows / 2);
        this.centerCol = Math.floor(this.gridCols / 2);
        
        // 颜色格式：hex, rgb, hsl
        this.colorFormat = 'hex';
        
        // 背景画布（用于获取像素颜色）
        this.backgroundCanvas = null;
        
        // 设置项
        this.includeColorFormat = true; // 默认包含格式名
        
        this.onColorCopiedCallback = null;
        
        this.updatePending = false;
        this.rafId = null;
        
        // 全局鼠标位置监听器（仅用于跟踪位置）
        this.mouseTracker = (e) => {
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
        };
        
        this.initMagnifier();
        this.initKeyboardEvents();
        
        // 立即开始全局跟踪鼠标位置，这样 show() 时就能获取到当前位置
        document.addEventListener('mousemove', this.mouseTracker);
    }
    
    /**
     * 设置是否包含颜色格式名
     */
    setColorIncludeFormat(includeFormat) {
        this.includeColorFormat = includeFormat !== false;
    }

    setOnColorCopied(callback) {
        this.onColorCopiedCallback = callback;
    }
    
    /**
     * 初始化放大镜DOM结构
     */
    initMagnifier() {
        // 创建放大镜容器
        this.magnifierElement = document.createElement('div');
        this.magnifierElement.className = 'magnifier-container';
        this.magnifierElement.style.display = 'none';
        
        // 创建网格画布
        this.gridCanvas = document.createElement('canvas');
        this.gridCanvas.className = 'magnifier-grid';
        this.gridCanvas.width = this.gridCols * this.pixelSize;
        this.gridCanvas.height = this.gridRows * this.pixelSize;
        
        // 创建信息区域
        this.infoElement = document.createElement('div');
        this.infoElement.className = 'magnifier-info';
        // 设置信息区域宽度与网格一致
        this.infoElement.style.width = (this.gridCols * this.pixelSize) + 'px';
        this.infoElement.innerHTML = `
            <div class="magnifier-info-row">
                <span class="magnifier-label">坐标:</span>
                <span class="magnifier-coord" id="magnifierCoord">0, 0</span>
            </div>
            <div class="magnifier-info-row">
                <span class="magnifier-label">颜色:</span>
                <span class="magnifier-color" id="magnifierColor">#000000</span>
            </div>
            <div class="magnifier-info-row magnifier-shortcuts">
                <span class="magnifier-shortcut">Shift: 切换格式 | C: 复制</span>
            </div>
        `;
        
        // 组装DOM
        this.magnifierElement.appendChild(this.gridCanvas);
        this.magnifierElement.appendChild(this.infoElement);
        document.body.appendChild(this.magnifierElement);
    }
    
    /**
     * 初始化键盘事件
     */
    initKeyboardEvents() {
        document.addEventListener('keydown', (e) => {
            if (!this.isVisible) return;
            
            // Shift键切换颜色格式
            if (e.key === 'Shift') {
                this.toggleColorFormat();
                this.updateInfo();
            }
            
            // C键复制颜色
            if (e.key === 'c' || e.key === 'C') {
                this.copyColor();
            }
        });
    }
    
    /**
     * 设置背景画布（用于获取像素颜色）
     */
    setBackgroundCanvas(canvas) {
        this.backgroundCanvas = canvas;
    }
    
    /**
     * 显示放大镜（每次截屏时统一调用此方法初始化）
     */
    show() {
        // 使用全局跟踪到的鼠标位置初始化
        this.currentX = this.lastMouseX;
        this.currentY = this.lastMouseY;
        
        // 立即显示
        this.isVisible = true;
        this.magnifierElement.style.display = 'block';
        
        // 强制立即渲染一次（不使用 RAF），确保放大镜立即出现在正确位置
        this.updatePosition(this.currentX, this.currentY);
        this.updateGrid();
        this.updateInfo();
    }
    
    /**
     * 隐藏放大镜
     */
    hide() {
        this.isVisible = false;
        this.magnifierElement.style.display = 'none';
        
        // 取消待处理的动画帧
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        this.updatePending = false;
    }
    
    /**
     * 更新放大镜位置和内容
     */
    update(mouseX, mouseY) {
        this.currentX = mouseX;
        this.currentY = mouseY;
        
        if (!this.isVisible) return;
        
        if (!this.updatePending) {
            this.updatePending = true;
            this.rafId = requestAnimationFrame(() => {
                this.updatePosition(this.currentX, this.currentY);
                this.updateGrid();
                this.updateInfo();
                this.updatePending = false;
            });
        }
    }
    
    /**
     * 更新放大镜位置（显示在鼠标右下方）
     */
    updatePosition(mouseX, mouseY) {
        const offset = 15; // 距离鼠标的偏移量
        let left = mouseX + offset;
        let top = mouseY + offset;
        
        const rect = this.magnifierElement.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // 边界检测，防止放大镜超出屏幕
        if (left + rect.width > viewportWidth) {
            left = mouseX - rect.width - offset; // 放到左边
        }
        if (top + rect.height > viewportHeight) {
            top = mouseY - rect.height - offset; // 放到上边
        }
        
        // 确保不会超出左上边界
        left = Math.max(10, left);
        top = Math.max(10, top);
        
        this.magnifierElement.style.left = left + 'px';
        this.magnifierElement.style.top = top + 'px';
    }
    
    /**
     * 更新网格显示
     */
    updateGrid() {
        if (!this.backgroundCanvas) return;
        
        const ctx = this.gridCanvas.getContext('2d');
        const bgCtx = this.backgroundCanvas.getContext('2d', { willReadFrequently: true });
        const dpr = window.devicePixelRatio || 1;
        
        ctx.clearRect(0, 0, this.gridCanvas.width, this.gridCanvas.height);
        
        const cssStartX = Math.floor(this.currentX - this.centerCol);
        const cssStartY = Math.floor(this.currentY - this.centerRow);
        
        // 绘制每个像素格子
        for (let row = 0; row < this.gridRows; row++) {
            for (let col = 0; col < this.gridCols; col++) {
                const cssPosX = cssStartX + col;
                const cssPosY = cssStartY + row;
                
                const pixelX = Math.round(cssPosX * dpr);
                const pixelY = Math.round(cssPosY * dpr);
                
                // 获取像素颜色
                let color = 'rgba(0, 0, 0, 0)';
                if (pixelX >= 0 && pixelX < this.backgroundCanvas.width &&
                    pixelY >= 0 && pixelY < this.backgroundCanvas.height) {
                    try {
                        const imageData = bgCtx.getImageData(pixelX, pixelY, 1, 1);
                        const [r, g, b, a] = imageData.data;
                        color = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
                    } catch (e) {
                        // 如果无法读取，使用透明色
                        color = 'rgba(128, 128, 128, 0.1)';
                    }
                }
                
                // 绘制像素
                ctx.fillStyle = color;
                ctx.fillRect(col * this.pixelSize, row * this.pixelSize, this.pixelSize, this.pixelSize);
            }
        }
        
        // 绘制网格线
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= this.gridCols; i++) {
            ctx.beginPath();
            ctx.moveTo(i * this.pixelSize, 0);
            ctx.lineTo(i * this.pixelSize, this.gridCanvas.height);
            ctx.stroke();
        }
        for (let i = 0; i <= this.gridRows; i++) {
            ctx.beginPath();
            ctx.moveTo(0, i * this.pixelSize);
            ctx.lineTo(this.gridCanvas.width, i * this.pixelSize);
            ctx.stroke();
        }
        
        // 高亮中心像素
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 2;
        ctx.strokeRect(
            this.centerCol * this.pixelSize + 1,
            this.centerRow * this.pixelSize + 1,
            this.pixelSize - 2,
            this.pixelSize - 2
        );
    }
    
    /**
     * 更新信息显示
     */
    updateInfo() {
        // 更新坐标 - 显示CSS像素坐标
        const coordElement = document.getElementById('magnifierCoord');
        if (coordElement) {
            coordElement.textContent = `${Math.round(this.currentX)}, ${Math.round(this.currentY)}`;
        }
        
        // 更新颜色
        const colorElement = document.getElementById('magnifierColor');
        if (colorElement && this.backgroundCanvas) {
            const color = this.getPixelColor(this.currentX, this.currentY);
            colorElement.textContent = color;
            
            // 获取实际的RGB值用于计算亮度
            const rgb = this.getCurrentPixelRGB(this.currentX, this.currentY);
            
            // 设置颜色预览背景
            colorElement.style.background = this.colorFormat === 'hex' ? color : this.hexToRgb(color);
            
            // 根据背景颜色亮度自动调整文字颜色
            if (rgb) {
                const textColor = this.getContrastTextColor(rgb.r, rgb.g, rgb.b);
                colorElement.style.color = textColor;
            }
        }
    }
    
    /**
     * 获取当前像素的RGB值（用于计算亮度）
     */
    getCurrentPixelRGB(x, y) {
        if (!this.backgroundCanvas) return null;
        
        // CSS坐标转物理像素坐标
        const dpr = window.devicePixelRatio || 1;
        const canvasX = Math.round(x * dpr);
        const canvasY = Math.round(y * dpr);
        
        if (canvasX < 0 || canvasX >= this.backgroundCanvas.width ||
            canvasY < 0 || canvasY >= this.backgroundCanvas.height) {
            return { r: 0, g: 0, b: 0 };
        }
        
        try {
            const ctx = this.backgroundCanvas.getContext('2d', { willReadFrequently: true });
            const imageData = ctx.getImageData(canvasX, canvasY, 1, 1);
            const [r, g, b] = imageData.data;
            return { r, g, b };
        } catch (e) {
            return { r: 0, g: 0, b: 0 };
        }
    }
    
    /**
     * 获取指定位置的像素颜色
     */
    getPixelColor(x, y) {
        if (!this.backgroundCanvas) return '#000000';
        
        const rgb = this.getCurrentPixelRGB(x, y);
        if (!rgb) return this.formatColor(0, 0, 0);
        
        return this.formatColor(rgb.r, rgb.g, rgb.b);
    }
    
    /**
     * 根据背景颜色亮度计算对比文字颜色
     */
    getContrastTextColor(r, g, b) {
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance > 0.5 ? '#000000' : '#ffffff';
    }
    
    /**
     * 根据当前格式格式化颜色
     */
    formatColor(r, g, b) {
        switch (this.colorFormat) {
            case 'hex':
                return this.rgbToHex(r, g, b);
            case 'rgb':
                return `rgb(${r}, ${g}, ${b})`;
            case 'hsl':
                return this.rgbToHsl(r, g, b);
            default:
                return this.rgbToHex(r, g, b);
        }
    }
    
    /**
     * RGB转HEX
     */
    rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(x => {
            const hex = x.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    }
    
    /**
     * HEX转RGB
     */
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (result) {
            const r = parseInt(result[1], 16);
            const g = parseInt(result[2], 16);
            const b = parseInt(result[3], 16);
            return `rgb(${r}, ${g}, ${b})`;
        }
        return hex;
    }
    
    /**
     * RGB转HSL
     */
    rgbToHsl(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;
        
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;
        
        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }
        
        h = Math.round(h * 360);
        s = Math.round(s * 100);
        l = Math.round(l * 100);
        
        return `hsl(${h}, ${s}%, ${l}%)`;
    }
    
    /**
     * 切换颜色格式
     */
    toggleColorFormat() {
        const formats = ['hex', 'rgb', 'hsl'];
        const currentIndex = formats.indexOf(this.colorFormat);
        const nextIndex = (currentIndex + 1) % formats.length;
        this.colorFormat = formats[nextIndex];
    }
    
    /**
     * 复制颜色到剪贴板
     */
    async copyColor() {
        let color = this.getPixelColor(this.currentX, this.currentY);
        
        // 如果设置为不包含格式名，则去除格式前缀
        if (!this.includeColorFormat) {
            if (color.startsWith('#')) {
                // HEX格式：去除#号
                color = color.substring(1);
            } else {
                // RGB或HSL格式：提取括号内的值
                const match = color.match(/\((.+)\)/);
                if (match) {
                    color = match[1];
                }
            }
        }
        
        try {
            await navigator.clipboard.writeText(color);
            this.showCopyFeedback();
            
            if (this.onColorCopiedCallback) {
                setTimeout(() => {
                    this.onColorCopiedCallback();
                }, 300);
            }
        } catch (err) {
            console.error('复制颜色失败:', err);
        }
    }
    
    /**
     * 显示复制反馈
     */
    showCopyFeedback() {
        const colorElement = document.getElementById('magnifierColor');
        if (colorElement) {
            const originalText = colorElement.textContent;
            const originalColor = colorElement.style.color;
            const originalBackground = colorElement.style.background;
            
            colorElement.textContent = '已复制!';
            // 使用绿色背景，文字颜色根据绿色亮度自适应
            colorElement.style.background = '#4ade80';
            colorElement.style.color = '#000000'; // 绿色背景用黑色文字
            
            setTimeout(() => {
                colorElement.textContent = originalText;
                colorElement.style.color = originalColor;
                colorElement.style.background = originalBackground;
            }, 500);
        }
    }
    
    /**
     * 清理资源
     */
    clear() {
        this.hide();
        this.backgroundCanvas = null;
        this.currentX = 0;
        this.currentY = 0;
    }
}
