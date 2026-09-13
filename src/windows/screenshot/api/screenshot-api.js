/**
 * 截屏后端API调用模块
 * 负责与后端Tauri命令的通信
 */

const { invoke } = window.__TAURI__.core;

export class ScreenshotAPI {
    /**
     * 获取CSS像素格式的显示器信息
     */
    static async getMonitors() {
        try {
            return await invoke('get_css_monitors');
        } catch (error) {
            console.error('获取显示器信息失败:', error);
            // 返回默认单显示器配置
            return [{
                x: 0,
                y: 0,
                width: window.innerWidth,
                height: window.innerHeight,
                is_primary: true
            }];
        }
    }

    /**
     * 约束选区或工具栏位置到合适的显示器边界内
     */
    static async constrainBounds(x, y, width, height) {
        try {
            const [constrainedX, constrainedY] = await invoke('constrain_selection_bounds', {
                x, y, width, height
            });
            return { x: constrainedX, y: constrainedY };
        } catch (error) {
            console.error('边界约束失败:', error);
            // 降级到简单边界检查
            return {
                x: Math.max(0, Math.min(x, window.innerWidth - width)),
                y: Math.max(0, Math.min(y, window.innerHeight - height))
            };
        }
    }

    /**
     * 显示截屏窗口
     */
    static async showWindow() {
        return await invoke('show_screenshot_window');
    }

    /**
     * 隐藏截屏窗口
     */
    static async hideWindow() {
        return await invoke('hide_screenshot_window');
    }

    /**
     * 初始化长截屏
     */
    static async initScrollingScreenshot(selection, panel) {
        return await invoke('init_scrolling_screenshot', { selection, panel });
    }

    /**
     * 开始长截屏
     */
    static async startScrollingScreenshot() {
        return await invoke('start_scrolling_screenshot');
    }

    /**
     * 暂停长截屏
     */
    static async pauseScrollingScreenshot() {
        return await invoke('pause_scrolling_screenshot');
    }

    /**
     * 继续长截屏
     */
    static async resumeScrollingScreenshot() {
        return await invoke('resume_scrolling_screenshot');
    }

    /**
     * 停止长截屏
     */
    static async stopScrollingScreenshot() {
        return await invoke('stop_scrolling_screenshot');
    }

    /**
     * 取消长截屏
     */
    static async cancelScrollingScreenshot() {
        return await invoke('cancel_scrolling_screenshot');
    }

    static async updateScrollingPanelRect(panel) {
        return await invoke('update_scrolling_panel_rect', { panel });
    }

    /**
     * 获取应用设置
     */
    static async getSettings() {
        try {
            return await invoke('get_settings');
        } catch (error) {
            console.error('获取设置失败:', error);
            return {};
        }
    }

}
