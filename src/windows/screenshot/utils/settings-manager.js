/**
 * 设置管理器
 * 负责加载和管理截屏相关的设置
 */
import { ScreenshotAPI } from '../api/screenshot-api.js';

export class SettingsManager {
    constructor() {
        // 默认设置
        this.settings = {
            magnifierEnabled: true,
            hintsEnabled: true,
            colorIncludeFormat: true
        };
        
        this.listeners = new Map();
    }

    /**
     * 加载设置
     */
    async loadSettings() {
        try {
            const settings = await ScreenshotAPI.getSettings();
            
            // 更新本地设置
            this.settings.magnifierEnabled = settings.screenshot_magnifier_enabled !== false;
            this.settings.hintsEnabled = settings.screenshot_hints_enabled !== false;
            this.settings.colorIncludeFormat = settings.screenshot_color_include_format !== false;
            
            // 通知监听器
            this.notifyListeners('all', this.settings);
            
            return this.settings;
        } catch (error) {
            console.error('加载设置失败:', error);
            // 返回默认设置
            return this.settings;
        }
    }

    /**
     * 获取设置
     */
    getSettings() {
        return { ...this.settings };
    }

    /**
     * 获取单个设置
     */
    getSetting(key) {
        return this.settings[key];
    }

    /**
     * 更新设置（本地）
     */
    updateSetting(key, value) {
        if (key in this.settings) {
            this.settings[key] = value;
            this.notifyListeners(key, value);
        }
    }

    /**
     * 监听设置变化
     */
    addListener(key, callback) {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, []);
        }
        this.listeners.get(key).push(callback);
    }

    /**
     * 移除监听器
     */
    removeListener(key, callback) {
        if (this.listeners.has(key)) {
            const callbacks = this.listeners.get(key);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    /**
     * 通知监听器
     */
    notifyListeners(key, value) {
        // 通知特定键的监听器
        if (this.listeners.has(key)) {
            this.listeners.get(key).forEach(callback => callback(value));
        }
        
        // 通知 'all' 监听器
        if (key !== 'all' && this.listeners.has('all')) {
            this.listeners.get('all').forEach(callback => callback(this.settings));
        }
    }

    /**
     * 重置为默认设置
     */
    reset() {
        this.settings = {
            magnifierEnabled: true,
            hintsEnabled: true,
            colorIncludeFormat: true
        };
        this.notifyListeners('all', this.settings);
    }
}

// 导出单例
export const settingsManager = new SettingsManager();

