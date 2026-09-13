/**
 * 方向键控制器
 * 负责处理方向键的连续移动和加速
 */
export class ArrowKeyController {
    constructor() {
        this.state = {
            pressing: false,           // 是否正在按键
            direction: null,           // 当前方向
            startTime: 0,              // 开始按键时间
            intervalId: null,          // 定时器ID
            currentStep: 1,            // 当前步进（像素）
            interval: 50               // 固定间隔(ms)
        };
        
        this.moveCallback = null;      // 移动回调函数
    }

    /**
     * 设置移动回调
     */
    setMoveCallback(callback) {
        this.moveCallback = callback;
    }

    /**
     * 处理方向键按下 - 延迟启动连续移动
     */
    handleKeyDown(direction) {
        const state = this.state;

        // 如果按下不同方向键，先停止之前的移动
        if (state.pressing && state.direction !== direction) {
            this.stop();
        }

        // 如果已经在按相同方向键，忽略
        if (state.pressing && state.direction === direction) {
            return;
        }
        
        // 记录状态
        state.pressing = true;
        state.direction = direction;
        state.startTime = Date.now();
        state.currentStep = 1;

        // 立即移动一次
        this.executeMove(direction, 1);

        // 延迟150ms后开始连续移动
        state.intervalId = setTimeout(() => {
            if (!state.pressing) return;

            // 开始定时器，根据按住时间动态调整步进
            state.intervalId = setInterval(() => {
                const elapsed = Date.now() - state.startTime;
                
                // 根据按住时间动态调整步进
                if (elapsed < 1000) {
                    state.currentStep = 1;
                } else if (elapsed < 2000) {
                    state.currentStep = 5;
                } else if (elapsed < 3000) {
                    state.currentStep = 10;
                } else {
                    state.currentStep = 20;
                }
                
                this.executeMove(state.direction, state.currentStep);
            }, state.interval);
        }, 150);
    }

    /**
     * 处理方向键松开 - 停止移动
     */
    handleKeyUp() {
        this.stop();
    }

    /**
     * 停止移动
     */
    stop() {
        const state = this.state;
        
        if (state.intervalId) {
            clearTimeout(state.intervalId);
            clearInterval(state.intervalId);
            state.intervalId = null;
        }
        
        state.pressing = false;
        state.direction = null;
        state.startTime = 0;
    }

    /**
     * 执行单次移动
     */
    executeMove(direction, step = 1) {
        if (this.moveCallback) {
            this.moveCallback(direction, step);
        }
    }

    /**
     * 清理资源
     */
    destroy() {
        this.stop();
        this.moveCallback = null;
    }
}

