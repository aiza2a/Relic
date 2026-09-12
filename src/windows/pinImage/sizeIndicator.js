//大小指示器模块

let sizeIndicatorTimer = null;

//检查鼠标是否在大小指示器上
function isMouseOverIndicator(sizeIndicator, mouseX, mouseY) {
    const rect = sizeIndicator.getBoundingClientRect();
    return mouseX >= rect.left && mouseX <= rect.right && 
           mouseY >= rect.top && mouseY <= rect.bottom;
}

//显示大小指示器
export function showSizeIndicator(sizeIndicator, width, height, level, isImageScale = false, mouseX = 0, mouseY = 0) {
    let mainText = '';
    
    if (isImageScale) {
        mainText = `图片 ${level}%`;
    } else {
        const scalePercent = level * 10;
        mainText = `${Math.round(width)} × ${Math.round(height)} (${scalePercent}%)`;
    }
    
    const hintText = `
        <span style="font-size: 10px; opacity: 0.8;">
            滚轮: 缩放窗口 | Shift+滚轮: 快速缩放窗口<br>
            Alt+滚轮: 缩放图片 | Shift+Alt+滚轮: 快速缩放图片
        </span>
    `;
    
    sizeIndicator.innerHTML = `${mainText}<br>${hintText}`;
    
    if (isMouseOverIndicator(sizeIndicator, mouseX, mouseY)) {
        sizeIndicator.classList.remove('show');
        if (sizeIndicatorTimer) {
            clearTimeout(sizeIndicatorTimer);
            sizeIndicatorTimer = null;
        }
        return;
    }
    
    sizeIndicator.classList.add('show');
    
    if (sizeIndicatorTimer) {
        clearTimeout(sizeIndicatorTimer);
    }
    
    sizeIndicatorTimer = setTimeout(() => {
        sizeIndicator.classList.remove('show');
    }, 2000);
}

//设置大小指示器鼠标事件
export function setupSizeIndicatorEvents(sizeIndicator) {
    sizeIndicator.addEventListener('mouseenter', () => {
        sizeIndicator.classList.remove('show');
        if (sizeIndicatorTimer) {
            clearTimeout(sizeIndicatorTimer);
            sizeIndicatorTimer = null;
        }
    });
}

