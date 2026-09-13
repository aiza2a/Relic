/**
 * 工具共享函数
 */


export function getCanvas(tool) {
    return tool.fabricCanvas || window.screenshotController?.editLayerManager?.getFabricCanvas();
}

/**
 * 颜色透明度处理 - 统一重复的颜色处理逻辑
 */
export function applyOpacity(color, opacityPercent) {
    const opacity = Math.max(0, Math.min(100, opacityPercent)) / 100;
    
    if (color.startsWith('#')) {
        const hex = color.slice(1);
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    } else if (color.startsWith('rgb(')) {
        return color.replace('rgb(', 'rgba(').replace(')', `, ${opacity})`);
    } else if (color.startsWith('rgba(')) {
        return color.replace(/,\s*[\d.]+\s*\)$/, `, ${opacity})`);
    }
    return color;
}

/**
 * 从子工具栏获取参数 
 */
export function getToolParams(toolName) {
    return window.screenshotController?.subToolbarManager?.getToolParameters(toolName) || {};
}
