/**
 * 坐标和边界计算工具类
 * 提供各种坐标转换和边界计算的静态方法
 */
const { invoke } = window.__TAURI__.core;

export class CoordinateUtils {
    /**
     * CSS坐标转物理像素坐标
     */
    static cssToPhysical(cssX, cssY, dpr = null) {
        const devicePixelRatio = dpr || window.devicePixelRatio || 1;
        return {
            x: Math.round(cssX * devicePixelRatio),
            y: Math.round(cssY * devicePixelRatio)
        };
    }

    /**
     * 物理像素坐标转CSS坐标
     */
    static physicalToCss(physicalX, physicalY, dpr = null) {
        const devicePixelRatio = dpr || window.devicePixelRatio || 1;
        return {
            x: physicalX / devicePixelRatio,
            y: physicalY / devicePixelRatio
        };
    }

    /**
     * 限制坐标在指定边界内
     */
    static clampCoordinates(x, y, minX = 0, minY = 0, maxX = null, maxY = null) {
        const clampedX = Math.max(minX, Math.min(x, maxX !== null ? maxX : window.innerWidth - 1));
        const clampedY = Math.max(minY, Math.min(y, maxY !== null ? maxY : window.innerHeight - 1));
        return { x: clampedX, y: clampedY };
    }

    /**
     * 计算两点之间的距离
     */
    static distance(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * 计算矩形的中心点
     */
    static getRectCenter(rect) {
        return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };
    }

    /**
     * 检查点是否在矩形内
     */
    static isPointInRect(x, y, rect) {
        return x >= rect.left && 
               x <= rect.left + rect.width && 
               y >= rect.top && 
               y <= rect.top + rect.height;
    }

    /**
     * 计算虚拟屏幕边界（多显示器）
     */
    static calculateVirtualBounds(monitors) {
        if (!monitors || monitors.length === 0) {
            return { 
                x: 0, 
                y: 0, 
                width: window.innerWidth, 
                height: window.innerHeight 
            };
        }
        
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        
        monitors.forEach(monitor => {
            minX = Math.min(minX, monitor.x);
            minY = Math.min(minY, monitor.y);
            maxX = Math.max(maxX, monitor.x + monitor.width);
            maxY = Math.max(maxY, monitor.y + monitor.height);
        });
        
        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
        };
    }

    /**
     * 根据方向计算新坐标
     */
    static moveByDirection(x, y, direction, step = 1) {
        let newX = x;
        let newY = y;
        
        switch (direction) {
            case 'up':
                newY -= step;
                break;
            case 'down':
                newY += step;
                break;
            case 'left':
                newX -= step;
                break;
            case 'right':
                newX += step;
                break;
        }
        
        return { x: newX, y: newY };
    }

    /**
     * 设置光标位置（物理像素）
     */
    static async setCursorPosition(cssX, cssY) {
        try {
            // 边界检查
            const clamped = CoordinateUtils.clampCoordinates(
                cssX, 
                cssY, 
                0, 
                0, 
                window.innerWidth - 1, 
                window.innerHeight - 1
            );
            
            // 转换为物理像素并移动
            const physical = CoordinateUtils.cssToPhysical(clamped.x, clamped.y);
            await invoke('set_cursor_position_physical', {
                x: physical.x,
                y: physical.y
            });
            
            return clamped;
        } catch (error) {
            console.error('设置光标位置失败:', error);
            return null;
        }
    }
}

