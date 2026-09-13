/**
 * 背景管理器
 * 负责显示截图背景
 */

export class BackgroundManager {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.isLoaded = false;
    }

    /**
     * 初始化Canvas背景
     */
    init() {
        // 如果已经初始化过，先销毁
        if (this.canvas) {
            this.destroy();
        }

        // 创建Canvas元素
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'screenshot-background';
        this.canvas.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            z-index: -1;
            pointer-events: none;
        `;

        this.ctx = this.canvas.getContext('2d');
        document.body.appendChild(this.canvas);
        this.updateCanvasSize();
    }

    /**
     * 更新Canvas尺寸
     */
    updateCanvasSize() {
        if (!this.canvas) return;
        this.canvas.style.width = `${window.innerWidth}px`;
        this.canvas.style.height = `${window.innerHeight}px`;
    }

    /**
     * 通过本地HTTP服务器加载图片
     */
    async loadScreenshot(payload) {
        try {
            const { width, height, image_url } = payload;

            // 设置Canvas的物理分辨率
            this.canvas.width = width;
            this.canvas.height = height;
            const dpr = window.devicePixelRatio || 1;
            const cssWidth = width / dpr;
            const cssHeight = height / dpr;

            this.canvas.style.width = `${cssWidth}px`;
            this.canvas.style.height = `${cssHeight}px`;

            const actualCssWidth = window.innerWidth;
            const actualCssHeight = window.innerHeight;
            const widthDiff = Math.abs(cssWidth - actualCssWidth);
            const heightDiff = Math.abs(cssHeight - actualCssHeight);
            
            if (widthDiff > 1 || heightDiff > 1) {
                console.warn(`Canvas尺寸与窗口尺寸不匹配:`,
                    `Canvas CSS: ${cssWidth}×${cssHeight}`,
                    `Window: ${actualCssWidth}×${actualCssHeight}`,
                    `Diff: ${widthDiff}×${heightDiff}`
                );
            }

            await this.loadImageFromUrl(image_url);
            this.isLoaded = true;
        } catch (error) {
            console.error('从URL加载图片失败:', error);
            throw error;
        }
    }

    /**
     * 从URL加载图片（本地HTTP服务器）
     */
    async loadImageFromUrl(image_url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            
            // 设置跨域属性，避免Canvas污染
            img.crossOrigin = 'anonymous';
            
            img.onload = () => {
                this.ctx.drawImage(img, 0, 0);
                resolve();
            };
            
            img.onerror = (error) => {
                console.error('从URL加载图像失败:', error);
                reject(new Error('从URL加载图像失败'));
            };
            
            img.src = image_url;
        });
    }

    /**
     * 清除背景
     */
    clearBackground() {
        if (this.ctx && this.canvas) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
        this.isLoaded = false;
    }

    /**
     * 销毁背景管理器
     */
    destroy() {
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
        this.canvas = null;
        this.ctx = null;
        this.isLoaded = false;
    }

    /**
     * 获取是否已加载截图
     */
    get isScreenshotLoaded() {
        return this.isLoaded;
    }
}
