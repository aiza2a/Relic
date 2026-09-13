/**
 * OCR管理模块
 * 负责识别截图区域中的文字
 */

import Tesseract from 'tesseract.js';

export class OCRManager {
    constructor() {
        this.worker = null;
        this.isInitialized = false;
        this.isProcessing = false;
        this.supportedLanguages = ['eng', 'chi_sim']; // 英文和简体中文
    }

    /**
     * 初始化OCR Worker (Tesseract.js v6 API)
     */
    async initialize() {
        if (this.isInitialized) return;
        
        try {
            this.worker = await Tesseract.createWorker('chi_sim+eng', 1, {
                errorHandler: err => console.error('OCR错误:', err)
            });
            
            // 设置参数提高识别准确率
            await this.worker.setParameters({
                tessedit_pageseg_mode: '3',
                preserve_interword_spaces: '1',
            });
            
            this.isInitialized = true;
        } catch (error) {
            console.error('OCR Worker 初始化失败:', error);
            throw error;
        }
    }

    /**
     * 识别图像中的文字
     */
    async recognize(image) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        if (this.isProcessing) {
            console.warn('OCR正在处理中，请稍候...');
            return '';
        }

        try {
            this.isProcessing = true;
            const { data } = await this.worker.recognize(image);
            return data.text.trim();
        } catch (error) {
            console.error('OCR识别失败:', error);
            throw error;
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * 识别选区内的文字（带位置信息）
     */
    async recognizeSelection(backgroundCanvas, selection) {
        if (!selection || !backgroundCanvas) {
            throw new Error('缺少必要参数');
        }

        // 创建临时画布，提取选区图像
        const tempCanvas = document.createElement('canvas');
        const ctx = tempCanvas.getContext('2d');
        
        // 将选区尺寸转换为画布实际尺寸
        const rect = backgroundCanvas.getBoundingClientRect();
        const scaleX = backgroundCanvas.width / rect.width;
        const scaleY = backgroundCanvas.height / rect.height;
        
        const exactLeft = selection.left * scaleX;
        const exactTop = selection.top * scaleY;
        const exactRight = (selection.left + selection.width) * scaleX;
        const exactBottom = (selection.top + selection.height) * scaleY;
        
        const canvasX = Math.round(exactLeft);
        const canvasY = Math.round(exactTop);
        const canvasWidth = Math.round(exactRight) - Math.round(exactLeft);
        const canvasHeight = Math.round(exactBottom) - Math.round(exactTop);
        
        tempCanvas.width = canvasWidth;
        tempCanvas.height = canvasHeight;
        
        // 绘制选区内容
        ctx.drawImage(
            backgroundCanvas,
            canvasX, canvasY, canvasWidth, canvasHeight,
            0, 0, canvasWidth, canvasHeight
        );
        
        // 图像预处理：增强对比度和清晰度
        this.enhanceImageForOCR(ctx, canvasWidth, canvasHeight);
        
        // 识别文字（获取完整数据）
        if (!this.isInitialized) {
            await this.initialize();
        }

        if (this.isProcessing) {
            console.warn('OCR正在处理中，请稍候...');
            return { text: '', lines: [], words: [] };
        }

        try {
            this.isProcessing = true;
            const result = await this.worker.recognize(tempCanvas, {}, {
                blocks: true,
                text: true
            });
            const data = result.data;

            const lines = [];
            const words = [];
            
            if (data.blocks) {
                data.blocks.forEach(block => {
                    if (block.paragraphs) {
                        block.paragraphs.forEach(paragraph => {
                            if (paragraph.lines) {
                                paragraph.lines.forEach(line => {
                                    lines.push({
                                        text: line.text,
                                        bbox: line.bbox,
                                        confidence: line.confidence
                                    });
                                    
                                    if (line.words) {
                                        line.words.forEach(word => {
                                            words.push({
                                                text: word.text,
                                                bbox: word.bbox,
                                                confidence: word.confidence
                                            });
                                        });
                                    }
                                });
                            }
                        });
                    }
                });
            }
            
            return {
                text: (data.text || '').trim(),
                lines,
                words,
                selection: {
                    left: selection.left,
                    top: selection.top,
                    width: selection.width,
                    height: selection.height
                },
                canvasSize: {
                    width: canvasWidth,
                    height: canvasHeight
                }
            };
        } catch (error) {
            console.error('OCR识别失败:', error);
            throw error;
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * 在原图上显示OCR文字覆盖层
     */
    showOverlayResult(result) {
        if (!result || !result.lines || result.lines.length === 0) {
            console.warn('未识别到文字');
            return;
        }

        // 创建或获取覆盖层容器
        let overlay = document.getElementById('ocrOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'ocrOverlay';
            overlay.className = 'ocr-overlay';
            document.body.appendChild(overlay);
        } else {
            overlay.innerHTML = ''; 
        }

        // 为每一行创建文字覆盖元素
        result.lines.forEach((line, index) => {
            const lineElement = document.createElement('div');
            lineElement.className = 'ocr-text-line';
            lineElement.textContent = line.text;
            lineElement.setAttribute('data-line-index', index);
            
            // 计算位置：bbox 是物理像素坐标，需要转换为 CSS 像素坐标
            const { selection, canvasSize } = result;
            
            const scaleX = selection.width / canvasSize.width;
            const scaleY = selection.height / canvasSize.height;
            
            const paddingX = 8;
            const paddingY = 4;
            
            const bboxLeft = selection.left + line.bbox.x0 * scaleX;
            const bboxTop = selection.top + line.bbox.y0 * scaleY;
            const bboxWidth = (line.bbox.x1 - line.bbox.x0) * scaleX;
            const bboxHeight = (line.bbox.y1 - line.bbox.y0) * scaleY;
            const left = bboxLeft - paddingX;
            const top = bboxTop - paddingY;
            
            lineElement.style.left = `${left}px`;
            lineElement.style.top = `${top}px`;
            
            lineElement.style.height = `${bboxHeight}px`;
            const fontSize = bboxHeight * 0.85;
            lineElement.style.fontSize = `${fontSize}px`;
            lineElement.style.lineHeight = `${bboxHeight}px`;
            
            // 计算理想的文字宽度
            const textLength = line.text.length;
            if (textLength > 0) {
                // 创建临时元素测量实际文字宽度
                const tempSpan = document.createElement('span');
                tempSpan.style.cssText = `
                    position: absolute;
                    visibility: hidden;
                    font-size: ${fontSize}px;
                    font-family: ${window.getComputedStyle(lineElement).fontFamily};
                    white-space: nowrap;
                `;
                tempSpan.textContent = line.text;
                document.body.appendChild(tempSpan);
                const naturalWidth = tempSpan.offsetWidth;
                document.body.removeChild(tempSpan);
                
                // 计算缩放比例，使文字精确匹配 bbox 宽度
                const scaleXRatio = bboxWidth / naturalWidth;
                if (scaleXRatio > 0.7 && scaleXRatio < 1.3) {
                    lineElement.style.transform = `scaleX(${scaleXRatio})`;
                    lineElement.style.transformOrigin = 'left center';
                    lineElement.style.width = `${naturalWidth}px`;
                } else {
                    // 如果缩放比例过大/过小，使用字间距调整
                    lineElement.style.width = `${bboxWidth}px`;
                    const letterSpacing = (bboxWidth - naturalWidth) / Math.max(textLength - 1, 1);
                    if (Math.abs(letterSpacing) < fontSize * 0.3) {
                        lineElement.style.letterSpacing = `${letterSpacing}px`;
                    }
                }
            } else {
                lineElement.style.width = `${bboxWidth}px`;
            }
            
            overlay.appendChild(lineElement);
        });
    }

    /**
     * 复制 OCR 识别的文字
     */
    async copyText() {
        const overlay = document.getElementById('ocrOverlay');
        if (!overlay) {
            console.warn('没有可复制的文字');
            return;
        }

        try {
            const selection = window.getSelection();
            let textToCopy = selection.toString().trim();
            
            if (!textToCopy) {
                // 如果没有选中文字，复制全部
                const range = document.createRange();
                range.selectNodeContents(overlay);
                selection.removeAllRanges();
                selection.addRange(range);
                
                // 获取选中的文本
                textToCopy = selection.toString().trim();
                
                // 清除选中状态
                selection.removeAllRanges();
            }
            
            if (textToCopy) {
                await navigator.clipboard.writeText(textToCopy);
                console.log('已复制到剪贴板');
            }
        } catch (err) {
            console.error('复制失败:', err);
        }
    }

    /**
     * 显示加载提示
     */
    showLoadingDialog() {
        const loading = document.createElement('div');
        loading.className = 'ocr-loading-dialog';
        loading.id = 'ocrLoadingDialog';
        loading.innerHTML = `
            <div class="ocr-loading-content">
                <div class="ocr-loading-spinner"></div>
                <div class="ocr-loading-text">正在识别文字...</div>
            </div>
        `;
        document.body.appendChild(loading);
    }

    /**
     * 隐藏加载提示
     */
    hideLoadingDialog() {
        const loading = document.getElementById('ocrLoadingDialog');
        if (loading) {
            loading.remove();
        }
    }

    /**
     * 图像预处理：增强对比度，提高OCR识别率
     */
    enhanceImageForOCR(ctx, width, height) {
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        // 计算亮度和对比度增强因子
        const contrast = 1.2;  // 对比度增强 20%
        const brightness = 10; // 亮度增加 10
        
        for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.min(255, Math.max(0, contrast * (data[i] - 128) + 128 + brightness));     // R
            data[i + 1] = Math.min(255, Math.max(0, contrast * (data[i + 1] - 128) + 128 + brightness)); // G
            data[i + 2] = Math.min(255, Math.max(0, contrast * (data[i + 2] - 128) + 128 + brightness)); // B
        }
        
        ctx.putImageData(imageData, 0, 0);
    }

    /**
     * 清理 OCR 界面元素
     */
    clear() {
        // 移除 OCR 覆盖层
        const overlay = document.getElementById('ocrOverlay');
        if (overlay) {
            overlay.remove();
        }
        
        // 移除加载对话框
        const loading = document.getElementById('ocrLoadingDialog');
        if (loading) {
            loading.remove();
        }
    }

    /**
     * 清理资源
     */
    async terminate() {
        if (this.worker) {
            await this.worker.terminate();
            this.worker = null;
            this.isInitialized = false;
        }
    }
}
