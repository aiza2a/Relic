/**
 * Tooltip管理模块
 */

import { boundsConstraint } from '../utils/bounds-constraint.js';

export class TooltipManager {
    constructor() {
        this.tooltipElements = new Set();
        this.observers = new Map();
        this.tooltipHeight = 40; 
        this.mainToolbarHeight = 50;

        this.handleMouseEnter = this.handleMouseEnter.bind(this);
    }

    /**
     * 初始化，监听所有带有data-tooltip的元素
     */
    init() {
        document.addEventListener('mouseover', this.handleMouseEnter, true);
    }

    /**
     * 处理鼠标悬停事件
     */
    handleMouseEnter(e) {
        const element = e.target.closest('[data-tooltip]');
        if (!element) return;
        requestAnimationFrame(() => {
            this.updateTooltipPosition(element);
        });
    }

    /**
     * 更新tooltip位置
     */
    updateTooltipPosition(element) {
        const rect = element.getBoundingClientRect();

        const toolbar = element.closest('.toolbar');
        const subToolbar = element.closest('.sub-toolbar');
        
        let shouldShowTop = false;
        
        if (toolbar || subToolbar) {

            const tooltipBottom = rect.bottom + this.tooltipHeight;

            const constrainedPos = boundsConstraint.constrain(
                rect.left,
                rect.bottom + 8,
                50, 
                this.tooltipHeight
            );

            const expectedY = rect.bottom + 8;
            if (Math.abs(constrainedPos.y - expectedY) > 10) {
                shouldShowTop = true;
            }

            if (subToolbar && !shouldShowTop) {
                const mainToolbar = document.querySelector('.toolbar');
                if (mainToolbar) {
                    const mainToolbarRect = mainToolbar.getBoundingClientRect();
                    const subToolbarRect = subToolbar.getBoundingClientRect();

                    if (subToolbarRect.bottom < mainToolbarRect.top) {

                        if (tooltipBottom > mainToolbarRect.top - 10) {
                            shouldShowTop = true;
                        }
                    }
                }
            }
        }

        if (shouldShowTop) {
            element.classList.add('tooltip-top');
        } else {
            element.classList.remove('tooltip-top');
        }
    }

    /**
     * 注册需要监听的容器
     */
    registerContainer(container) {
        if (!container) return;

        const elements = container.querySelectorAll('[data-tooltip]');
        elements.forEach(element => {
            this.tooltipElements.add(element);
        });
    }

    /**
     * 批量更新所有tooltip位置
     */
    updateAllTooltips() {
        const elements = document.querySelectorAll('[data-tooltip]');
        elements.forEach(element => {
            this.updateTooltipPosition(element);
        });
    }

    /**
     * 清理资源
     */
    destroy() {
        document.removeEventListener('mouseover', this.handleMouseEnter, true);
        this.tooltipElements.clear();
        this.observers.forEach(observer => observer.disconnect());
        this.observers.clear();
    }
}

