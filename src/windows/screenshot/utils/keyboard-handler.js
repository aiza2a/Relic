/**
 * 键盘事件处理工具类
 * 负责处理截屏相关的所有键盘快捷键
 */
export class KeyboardHandler {
    constructor() {
        this.shortcuts = new Map();
        this.enabled = true;
    }

    /**
     * 注册快捷键
     */
    registerShortcut(key, handler, condition = null) {
        this.shortcuts.set(key, { handler, condition });
    }

    /**
     * 注销快捷键
     */
    unregisterShortcut(key) {
        this.shortcuts.delete(key);
    }

    /**
     * 处理按键事件
     */
    handleKeyDown(key) {
        if (!this.enabled) return false;

        const shortcut = this.shortcuts.get(key);
        if (shortcut) {
            // 如果有条件检查，先检查条件
            if (shortcut.condition && !shortcut.condition()) {
                return false;
            }
            shortcut.handler();
            return true;
        }
        return false;
    }

    /**
     * 启用键盘处理
     */
    enable() {
        this.enabled = true;
    }

    /**
     * 禁用键盘处理
     */
    disable() {
        this.enabled = false;
    }

    /**
     * 清空所有快捷键
     */
    clear() {
        this.shortcuts.clear();
    }

    /**
     * 检查是否可以使用键盘快捷键（不在编辑文本时）
     */
    static canUseShortcuts() {
        const activeElement = document.activeElement;
        if (!activeElement) return true;
        
        const tagName = activeElement.tagName.toLowerCase();
        const isEditable = activeElement.isContentEditable;
        const isInput = tagName === 'input' || tagName === 'textarea';
        
        return !isEditable && !isInput;
    }
}

