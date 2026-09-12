// 截图遮罩窗口主入口：展示屏幕快照，支持拖拽框选、双击/Enter 复制、Esc 取消
import '@tabler/icons-webfont/dist/tabler-icons.min.css';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

const img = document.getElementById('shot');
const selection = document.getElementById('selection');
const sizeBadge = document.getElementById('size-badge');
const toolbar = document.getElementById('toolbar');
const hint = document.getElementById('hint');

const state = {
    info: null,
    dragging: false,
    startX: 0,
    startY: 0,
    rect: null, // {x, y, w, h} in CSS px
};

function hideHint() {
    hint.classList.add('hidden');
}

function clampRect(x1, y1, x2, y2) {
    const x = Math.max(0, Math.min(x1, x2));
    const y = Math.max(0, Math.min(y1, y2));
    const w = Math.max(0, Math.min(Math.max(x1, x2), window.innerWidth) - x);
    const h = Math.max(0, Math.min(Math.max(y1, y2), window.innerHeight) - y);
    return { x, y, w, h };
}

function renderSelection() {
    const { x, y, w, h } = state.rect;
    selection.style.display = 'block';
    selection.style.left = `${x}px`;
    selection.style.top = `${y}px`;
    selection.style.width = `${w}px`;
    selection.style.height = `${h}px`;

    sizeBadge.style.display = 'block';
    const info = state.info;
    const imgW = Math.round(w * info.width / window.innerWidth);
    const imgH = Math.round(h * info.height / window.innerHeight);
    sizeBadge.textContent = `${imgW} × ${imgH}`;
    const badgeY = y > 26 ? y - 24 : y + h + 6;
    sizeBadge.style.left = `${x}px`;
    sizeBadge.style.top = `${badgeY}px`;

    if (w > 8 && h > 8) {
        selection.classList.add('confirmable');
        toolbar.style.display = 'flex';
        const toolX = Math.min(x + w - 76, window.innerWidth - 90);
        const toolY = y + h + 10 > window.innerHeight - 48 ? y - 46 : y + h + 10;
        toolbar.style.left = `${Math.max(8, toolX)}px`;
        toolbar.style.top = `${Math.max(8, toolY)}px`;
    } else {
        selection.classList.remove('confirmable');
        toolbar.style.display = 'none';
    }
}

function toImageRect() {
    const { x, y, w, h } = state.rect;
    const info = state.info;
    return {
        x: Math.round(x * info.width / window.innerWidth),
        y: Math.round(y * info.height / window.innerHeight),
        width: Math.round(w * info.width / window.innerWidth),
        height: Math.round(h * info.height / window.innerHeight),
    };
}

async function finish() {
    if (!state.rect || state.rect.w <= 8 || state.rect.h <= 8) return;
    const rect = toImageRect();
    try {
        await invoke('finish_screenshot', rect);
    } catch (error) {
        console.error('完成截图失败:', error);
        await invoke('cancel_screenshot').catch(() => {});
    }
}

async function cancel() {
    await invoke('cancel_screenshot').catch(() => {});
}

function onMouseDown(event) {
    if (event.button !== 0) return;
    if (toolbar.contains(event.target)) return;
    // 点击已有选区内不重置，留给双击复制
    if (state.rect && event.target === selection) return;
    hideHint();
    state.dragging = true;
    state.startX = event.clientX;
    state.startY = event.clientY;
    state.rect = clampRect(event.clientX, event.clientY, event.clientX, event.clientY);
    renderSelection();
}

function onMouseMove(event) {
    if (!state.dragging) return;
    state.rect = clampRect(state.startX, state.startY, event.clientX, event.clientY);
    renderSelection();
}

function onMouseUp() {
    if (!state.dragging) return;
    state.dragging = false;
    if (state.rect.w <= 2 || state.rect.h <= 2) {
        state.rect = null;
        selection.style.display = 'none';
        sizeBadge.style.display = 'none';
        toolbar.style.display = 'none';
    }
}

function onKeyDown(event) {
    if (event.key === 'Escape') {
        event.preventDefault();
        cancel();
    } else if (event.key === 'Enter') {
        event.preventDefault();
        finish();
    }
}

(async () => {
    const currentWindow = getCurrentWindow();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    selection.addEventListener('dblclick', finish);
    toolbar.addEventListener('mousedown', event => event.stopPropagation());
    document.getElementById('btn-confirm').addEventListener('click', finish);
    document.getElementById('btn-cancel').addEventListener('click', cancel);

    try {
        state.info = await invoke('get_screenshot_info');
        img.src = convertFileSrc(state.info.path, 'asset');
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
        });
    } catch (error) {
        console.error('加载截图数据失败:', error);
        cancel();
    }
})();
