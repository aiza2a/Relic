/**
 * 选区信息面板管理器
 */

export class SelectionInfoPanel {
    constructor() {
        this.panel = document.createElement('div');
        this.panel.className = 'selection-info-panel';
        this.panel.style.cssText = `
            position: fixed;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            z-index: 5;
            pointer-events: auto;
            border: 1px solid rgba(255, 255, 255, 0.3);
            display: none;
            align-items: center;
            gap: 6px;
            width: fit-content;
            white-space: nowrap;
        `;
        document.body.appendChild(this.panel);
        
        this.selectionRect = null;
        this.borderRadius = 0;
    }
    
    /**
     * 显示信息面板
     */
    show(selectionRect, borderRadius) {
        this.selectionRect = selectionRect;
        this.borderRadius = borderRadius;

        this.updateContent();

        this.updatePosition();

        this.panel.style.display = 'flex';
    }
    
    /**
     * 隐藏信息面板
     */
    hide() {
        this.panel.style.display = 'none';
        this.selectionRect = null;
    }
    
    /**
     * 更新内容
     */
    updateContent() {
        if (!this.selectionRect) return;
        
        const { width, height } = this.selectionRect;
        
        let infoHTML = `
            <span class="info-content" style="display: flex; align-items: center; gap: 4px;">
                <i class="ti ti-ruler"></i> ${Math.round(width)} × ${Math.round(height)}
                ${this.borderRadius > 0 ? `
                    <span style="display: inline-block; width: 1px; height: 12px; background: rgba(255, 255, 255, 0.3); margin: 0 2px;"></span> 
                    <i class="ti ti-border-radius"></i> 
                    <input type="number" class="radius-input" value="${this.borderRadius}" 
                           min="0" max="${Math.floor(Math.min(width, height) / 2)}" 
                           style="background: transparent; border: none; outline: none; color: white; font-size: 12px; width: 35px; padding: 0; margin: 0 -2px; text-align: center; cursor: text;" />
                ` : ''}
            </span>
            <button class="aspect-ratio-btn" data-tooltip="调整比例" 
                    style="background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); color: white; width: 20px; height: 20px; border-radius: 3px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s ease; padding: 0;">
                <i class="ti ti-aspect-ratio" style="font-size: 12px;"></i>
            </button>
        `;
        
        this.panel.innerHTML = infoHTML;

        this.bindEvents();
    }
    
    /**
     * 更新位置
     */
    updatePosition() {
        if (!this.selectionRect) return;
        
        const { left, top, height } = this.selectionRect;

        const infoX = left + 8;
        const infoY = top < 40 ? top + height + 8 : top - 32;
        
        this.panel.style.left = infoX + 'px';
        this.panel.style.top = infoY + 'px';
    }
    
    /**
     * 更新选区数据
     */
    updateSelectionRect(selectionRect) {
        this.selectionRect = selectionRect;
        this.updatePosition();
    }
    
    /**
     * 绑定事件
     */
    bindEvents() {
        const radiusInput = this.panel.querySelector('.radius-input');
        if (radiusInput) {
            radiusInput.addEventListener('input', (e) => {
                e.stopPropagation();
                this.handleRadiusChange(e);
            });
            
            radiusInput.addEventListener('mousedown', (e) => {
                e.stopPropagation();
            });
            
            radiusInput.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }

        const aspectBtn = this.panel.querySelector('.aspect-ratio-btn');
        if (aspectBtn) {
            aspectBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showAspectRatioMenu(aspectBtn);
            });

            aspectBtn.addEventListener('mouseenter', () => {
                aspectBtn.style.background = 'rgba(255, 255, 255, 0.2)';
                aspectBtn.style.borderColor = 'rgba(255, 255, 255, 0.4)';
            });
            aspectBtn.addEventListener('mouseleave', () => {
                aspectBtn.style.background = 'rgba(255, 255, 255, 0.1)';
                aspectBtn.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            });
        }
    }
    
    /**
     * 处理圆角输入变化
     */
    handleRadiusChange(e) {
        const value = parseInt(e.target.value, 10);
        if (!isNaN(value) && this.selectionRect) {
            const maxRadius = Math.min(this.selectionRect.width, this.selectionRect.height) / 2;
            this.borderRadius = Math.max(0, Math.min(value, maxRadius));
   
            if (this.onRadiusChange) {
                this.onRadiusChange(this.borderRadius);
            }
        }
    }
    
    /**
     * 显示比例菜单
     */
    showAspectRatioMenu(btn) {
        const oldMenu = document.querySelector('.aspect-ratio-menu');
        if (oldMenu) {
            oldMenu.remove();
            return;
        }
        
        const menu = document.createElement('div');
        menu.className = 'aspect-ratio-menu';
        menu.style.cssText = `
            position: fixed;
            background: rgba(0, 0, 0, 0.9);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 6px;
            padding: 4px;
            min-width: 120px;
            opacity: 0;
            visibility: hidden;
            transform: translateY(-8px);
            transition: all 0.2s ease;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
        `;
        
        const ratios = [
            { icon: 'ti-maximize', label: '全屏', value: null },
            { icon: 'ti-square', label: '1:1', value: 1 },
            { icon: 'ti-rectangle-vertical', label: '3:4', value: 3/4 },
            { icon: 'ti-device-mobile', label: '9:16', value: 9/16 },
            { icon: 'ti-rectangle', label: '16:9', value: 16/9 },
            { icon: 'ti-layout', label: '4:3', value: 4/3 }
        ];
        
        ratios.forEach(ratio => {
            const item = document.createElement('div');
            item.className = 'aspect-ratio-item';
            item.style.cssText = `
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 6px 10px;
                color: white;
                cursor: pointer;
                border-radius: 4px;
                transition: all 0.15s ease;
                font-size: 12px;
                white-space: nowrap;
            `;
            item.innerHTML = `<i class="ti ${ratio.icon}" style="font-size: 16px; opacity: 0.8; width: 16px;"></i><span style="flex: 1;">${ratio.label}</span>`;
            
            item.addEventListener('mouseenter', () => {
                item.style.background = 'rgba(255, 255, 255, 0.15)';
            });
            item.addEventListener('mouseleave', () => {
                item.style.background = '';
            });
            
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.onAspectRatioSelect) {
                    this.onAspectRatioSelect(ratio.value);
                }
                menu.remove();
            });
            menu.appendChild(item);
        });
        
        document.body.appendChild(menu);

        const btnRect = btn.getBoundingClientRect();
        menu.style.left = btnRect.left + 'px';
        menu.style.top = (btnRect.bottom + 4) + 'px';

        requestAnimationFrame(() => {
            menu.style.opacity = '1';
            menu.style.visibility = 'visible';
            menu.style.transform = 'translateY(0)';
        });

        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        setTimeout(() => {
            document.addEventListener('click', closeMenu);
        }, 0);
    }
    
    /**
     * 设置圆角变化回调
     */
    setOnRadiusChange(callback) {
        this.onRadiusChange = callback;
    }
    
    /**
     * 设置比例选择回调
     */
    setOnAspectRatioSelect(callback) {
        this.onAspectRatioSelect = callback;
    }
    
    /**
     * 销毁
     */
    destroy() {
        if (this.panel && this.panel.parentNode) {
            this.panel.parentNode.removeChild(this.panel);
        }

        const menu = document.querySelector('.aspect-ratio-menu');
        if (menu) {
            menu.remove();
        }
    }
}

