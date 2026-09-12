//图片变换模块

//应用图片变换
export function applyImageTransform(img, state) {
    img.style.transform = `translate(${state.imageX}px, ${state.imageY}px) scale(${state.imageScale})`;
    img.style.transformOrigin = 'center center';
}

//限制图片位置在窗口边界内
export function constrainImagePosition(state) {
    if (state.imageScale <= 1) {
        state.imageX = 0;
        state.imageY = 0;
        return;
    }
    
    const containerWidth = window.innerWidth;
    const containerHeight = window.innerHeight;
    
    const imgWidth = state.originalImageSize?.width || containerWidth;
    const imgHeight = state.originalImageSize?.height || containerHeight;
    
    const scaledWidth = imgWidth * state.imageScale;
    const scaledHeight = imgHeight * state.imageScale;
    
    const maxOffsetX = Math.max(0, (scaledWidth - containerWidth) / 2);
    const maxOffsetY = Math.max(0, (scaledHeight - containerHeight) / 2);
    
    state.imageX = Math.max(-maxOffsetX, Math.min(maxOffsetX, state.imageX));
    state.imageY = Math.max(-maxOffsetY, Math.min(maxOffsetY, state.imageY));
}

//处理图片拖拽开始
export function startImageDrag(e, state) {
    state.isDraggingImage = true;
    state.dragStartX = e.clientX;
    state.dragStartY = e.clientY;
    state.dragStartImageX = state.imageX;
    state.dragStartImageY = state.imageY;
}

//处理图片拖拽移动
export function handleImageDragMove(e, img, state) {
    const deltaX = e.clientX - state.dragStartX;
    const deltaY = e.clientY - state.dragStartY;
    state.imageX = state.dragStartImageX + deltaX;
    state.imageY = state.dragStartImageY + deltaY;
    constrainImagePosition(state);
    applyImageTransform(img, state);
}

//处理图片缩放
export function handleImageScale(delta, e, img, state) {
    const step = e.shiftKey ? 0.5 : 0.1;
    const scaleDelta = delta < 0 ? step : -step;
    const oldScale = state.imageScale;
    state.imageScale = Math.max(1, state.imageScale + scaleDelta);
    
    if (state.imageScale > 1) {
        const windowCenterX = window.innerWidth / 2;
        const windowCenterY = window.innerHeight / 2;
        const mouseX = e.clientX - windowCenterX;
        const mouseY = e.clientY - windowCenterY;
        
        const pointX = (mouseX - state.imageX) / oldScale;
        const pointY = (mouseY - state.imageY) / oldScale;
        
        state.imageX = mouseX - pointX * state.imageScale;
        state.imageY = mouseY - pointY * state.imageScale;
        
        constrainImagePosition(state);
    } else {
        state.imageX = 0;
        state.imageY = 0;
    }
    
    applyImageTransform(img, state);
    return Math.round(state.imageScale * 100);
}

