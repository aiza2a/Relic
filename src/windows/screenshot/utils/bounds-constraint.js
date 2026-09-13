/**
 * 边界约束工具类
 * 统一处理所有前端的边界检查逻辑，避免重复实现
 */

export class BoundsConstraint {
    constructor() {
        this.monitors = [];
        this.virtualBounds = null;
    }

    /**
     * 设置显示器边界信息
     */
    setMonitorBounds(monitors, virtualBounds) {
        this.monitors = monitors;
        this.virtualBounds = virtualBounds;
    }

    /**
     * 边界约束核心逻辑
     */
    constrain(x, y, width, height) {
        if (!this.monitors || this.monitors.length === 0) {
            // 没有显示器信息，使用窗口边界
            return {
                x: Math.max(0, Math.min(x, window.innerWidth - width)),
                y: Math.max(0, Math.min(y, window.innerHeight - height))
            };
        }

        // 检查是否与多个显示器重叠
        let overlappingMonitors = [];
        this.monitors.forEach(monitor => {
            if (x < monitor.x + monitor.width && x + width > monitor.x &&
                y < monitor.y + monitor.height && y + height > monitor.y) {
                overlappingMonitors.push(monitor);
            }
        });

        if (overlappingMonitors.length > 1) {
            // 跨显示器，使用虚拟屏幕边界
            if (this.virtualBounds) {
                const { x: vx, y: vy, width: vw, height: vh } = this.virtualBounds;
                return {
                    x: Math.max(vx, Math.min(x, vx + vw - width)),
                    y: Math.max(vy, Math.min(y, vy + vh - height))
                };
            }
        } else if (overlappingMonitors.length === 1) {
            // 单显示器内，使用该显示器边界
            const monitor = overlappingMonitors[0];
            return {
                x: Math.max(monitor.x, Math.min(x, monitor.x + monitor.width - width)),
                y: Math.max(monitor.y, Math.min(y, monitor.y + monitor.height - height))
            };
        } else {
            // 在空白区域，移动到最近的显示器
            let closestMonitor = this.monitors[0];
            let minDistance = Infinity;
            
            this.monitors.forEach(monitor => {
                const centerX = monitor.x + monitor.width / 2;
                const centerY = monitor.y + monitor.height / 2;
                const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
                if (distance < minDistance) {
                    minDistance = distance;
                    closestMonitor = monitor;
                }
            });
            
            return {
                x: Math.max(closestMonitor.x, Math.min(x, closestMonitor.x + closestMonitor.width - width)),
                y: Math.max(closestMonitor.y, Math.min(y, closestMonitor.y + closestMonitor.height - height))
            };
        }

        return { x, y };
    }

    /**
     * 简单边界检查（降级方案）
     */
    constrainToWindow(x, y, width, height) {
        return {
            x: Math.max(0, Math.min(x, window.innerWidth - width)),
            y: Math.max(0, Math.min(y, window.innerHeight - height))
        };
    }
}

// 全局单例
export const boundsConstraint = new BoundsConstraint();
