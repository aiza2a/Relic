/**
 * 帮助面板管理器
 * 负责提示面板的显示、隐藏和定位
 */

import { boundsConstraint } from '../utils/bounds-constraint.js';
import { settingsManager } from '../utils/settings-manager.js';

export class HelpPanelManager {
    constructor() {
        this.helpPanel = document.getElementById('helpPanel');
        this.currentMouseX = 0;
        this.currentMouseY = 0;
        this.monitors = [];
        this.lastMonitor = null; // 记录上次所在的显示器
        
        this.initEvents();
    }

    /**
     * 初始化事件
     */
    initEvents() {
        // 监听鼠标移动，更新鼠标位置并重新定位面板
        document.addEventListener('mousemove', (e) => {
            this.currentMouseX = e.clientX;
            this.currentMouseY = e.clientY;
            
            // 检查鼠标是否切换了显示器，如果是则重新定位
            if (this.monitors && this.monitors.length > 0) {
                const newMonitor = this.monitors.find(m => 
                    e.clientX >= m.x && e.clientX < m.x + m.width &&
                    e.clientY >= m.y && e.clientY < m.y + m.height
                );
                
                if (newMonitor && newMonitor !== this.lastMonitor) {
                    this.lastMonitor = newMonitor;
                    this.updatePosition();
                }
            }
        });

        // 鼠标移入面板时隐藏
        this.helpPanel.addEventListener('mouseenter', () => {
            this.hide();
        });

        // 鼠标移出面板区域一段时间后显示
        this.helpPanel.addEventListener('mouseleave', () => {
            setTimeout(() => {
                this.show();
            }, 500);
        });
    }

    /**
     * 设置显示器信息
     */
    setMonitors(monitors) {
        this.monitors = monitors || [];
        this.updatePosition();
    }

    /**
     * 获取面板实际尺寸
     */
    getPanelDimensions() {
        if (!this.helpPanel) {
            return { width: 200, height: 240 }; // 默认值
        }
        
        const rect = this.helpPanel.getBoundingClientRect();
        return {
            width: rect.width || 200,
            height: rect.height || 240
        };
    }

    /**
     * 更新面板位置（根据鼠标所在屏幕）
     */
    updatePosition() {
        if (!this.monitors || this.monitors.length === 0) {
            // 没有显示器信息，使用默认位置
            this.helpPanel.style.left = '20px';
            this.helpPanel.style.bottom = '20px';
            this.helpPanel.style.top = 'auto';
            return;
        }

        // 临时显示面板以获取准确尺寸
        const wasHidden = this.helpPanel.classList.contains('hidden');
        if (wasHidden) {
            this.helpPanel.style.visibility = 'hidden';
            this.helpPanel.classList.remove('hidden');
        }

        // 获取面板实际尺寸
        const { width: panelWidth, height: panelHeight } = this.getPanelDimensions();

        if (wasHidden) {
            this.helpPanel.classList.add('hidden');
            this.helpPanel.style.visibility = 'visible';
        }

        // 查找鼠标所在的显示器
        let currentMonitor = null;
        for (const monitor of this.monitors) {
            if (this.currentMouseX >= monitor.x && 
                this.currentMouseX < monitor.x + monitor.width &&
                this.currentMouseY >= monitor.y && 
                this.currentMouseY < monitor.y + monitor.height) {
                currentMonitor = monitor;
                break;
            }
        }

        // 如果没找到，使用主显示器
        if (!currentMonitor && this.monitors.length > 0) {
            currentMonitor = this.monitors[0];
        }

        if (currentMonitor) {
            // 计算期望的位置：当前显示器的左下角
            const desiredX = currentMonitor.x + 20;
            const desiredY = currentMonitor.y + currentMonitor.height - panelHeight - 20;

            // 使用 boundsConstraint 确保位置在有效范围内
            const constrained = boundsConstraint.constrain(
                desiredX, desiredY, panelWidth, panelHeight
            );

            this.helpPanel.style.left = constrained.x + 'px';
            this.helpPanel.style.top = constrained.y + 'px';
            this.helpPanel.style.bottom = 'auto'; // 清除 bottom 定位
        }
    }

    /**
     * 显示面板
     */
    show() {
        // 检查配置是否启用
        const settings = settingsManager.getSettings();
        if (!settings.hintsEnabled) {
            return;
        }
        this.helpPanel.classList.remove('hidden');
        this.updatePosition();
    }

    /**
     * 隐藏面板
     */
    hide() {
        this.helpPanel.classList.add('hidden');
    }

    /**
     * 切换显示/隐藏
     */
    toggle() {
        if (this.helpPanel.classList.contains('hidden')) {
            this.show();
        } else {
            this.hide();
        }
    }
}

