/**
 * 输入对话框前端逻辑
 */

import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
document.addEventListener('contextmenu', event => event.preventDefault());
const currentWindow = getCurrentWindow();
const messageEl = document.getElementById('message');
const inputEl = document.getElementById('input');
const confirmBtn = document.getElementById('confirmBtn');
const cancelBtn = document.getElementById('cancelBtn');

let currentOptions = null; // 保存当前配置
let originalMessage = ''; // 保存原始消息

// 应用配置到UI
function applyOptions(options) {
    currentOptions = options;
    originalMessage = options.message || '';
    
    // 设置消息
    if (options.message) {
        messageEl.textContent = options.message;
        messageEl.style.color = '';
    }
    
    // 设置占位符
    if (options.placeholder) {
        inputEl.placeholder = options.placeholder;
    } else {
        inputEl.placeholder = '';
    }
    
    // 设置输入框类型
    inputEl.type = options.input_type || 'text';
    
    // 设置数字输入的 min/max 属性
    if (options.input_type === 'number') {
        if (options.min_value !== undefined && options.min_value !== null) {
            inputEl.min = options.min_value;
        } else {
            inputEl.removeAttribute('min');
        }
        if (options.max_value !== undefined && options.max_value !== null) {
            inputEl.max = options.max_value;
        } else {
            inputEl.removeAttribute('max');
        }
    }
    
    // 设置默认值
    if (options.default_value) {
        inputEl.value = options.default_value;
        inputEl.select();
    } else {
        inputEl.value = ''; 
    }
    
    // 自动聚焦
    inputEl.focus();
}

// 验证输入
function validateInput() {
    const value = inputEl.value.trim();
    
    // 数字类型验证
    if (currentOptions && currentOptions.input_type === 'number') {
        const num = parseFloat(value);
        
        if (value === '' || isNaN(num)) {
            return { valid: false, error: '请输入有效的数字' };
        }
        
        if (currentOptions.min_value !== undefined && currentOptions.min_value !== null && num < currentOptions.min_value) {
            return { valid: false, error: `数字不能小于 ${currentOptions.min_value}` };
        }
        
        if (currentOptions.max_value !== undefined && currentOptions.max_value !== null && num > currentOptions.max_value) {
            return { valid: false, error: `数字不能大于 ${currentOptions.max_value}` };
        }
    }
    
    return { valid: true };
}

// 显示错误消息
function showError(errorMsg) {
    messageEl.textContent = `❌ ${errorMsg}`;
    messageEl.style.color = '#e74c3c';
    inputEl.select();
    inputEl.focus();
}

// 页面加载完成后，请求后端发送配置
(async () => {
    try {
        const options = await invoke('get_input_dialog_options');
        applyOptions(options);
    } catch (error) {
        console.error('获取配置失败:', error);
    }
})();

// 确定按钮
confirmBtn.addEventListener('click', async (e) => {
    e.preventDefault(); // 防止默认行为
    
    // 先验证输入
    const validation = validateInput();
    
    if (!validation.valid) {
        showError(validation.error);
        return;
    }
    
    const value = inputEl.value.trim();
    try {
        await invoke('submit_input_dialog', { value: value || null });
        await currentWindow.close();
    } catch (error) {
        console.error('提交失败:', error);
    }
});

// 取消按钮
cancelBtn.addEventListener('click', async () => {
    try {
        await invoke('submit_input_dialog', { value: null });
        await currentWindow.close();
    } catch (error) {
        console.error('取消失败:', error);
    }
});

// 回车确认
inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        confirmBtn.click();
    } else if (e.key === 'Escape') {
        cancelBtn.click();
    }
});

