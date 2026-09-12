import { useEffect, useMemo, useRef, useState } from 'react';
import { emit, listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { LogicalSize } from '@tauri-apps/api/dpi';
import { open as openFileDialog } from '@tauri-apps/plugin-dialog';
import { useTranslation } from 'react-i18next';
import { useSnapshot } from 'valtio';
import { showConfirm } from '@shared/utils/dialog';
import { createDragPreviewIcon } from '@shared/utils/dragPreviewIcon';
import { formatUserMessage } from '@shared/utils/userMessages';
import { initSettings, settingsStore } from '@shared/store/settingsStore';
import { useSettingsSync } from '@shared/hooks/useSettingsSync';
import { useTheme, applyThemeToBody } from '@shared/hooks/useTheme';
import { applyBackgroundImage, clearBackgroundImage } from '@shared/utils/backgroundManager';
import {
  ensureDropProxy,
  cleanupDropProxyOrphanResources,
  closeTransferShelf,
  describeTransferShelfPaths,
  hideDropProxy,
  listSyncTransferLanPairedPeers,
  loadTransferShelfState,
  renameTransferShelf,
  routeDropProxyPathsAtCursor,
  saveDropProxyResource,
  saveDropProxyUrl,
  saveTransferShelfGeometry,
  saveTransferShelfState,
  sendTransferShelf,
  showDropProxy,
  uploadTransferShelfCloud,
} from '@shared/api';
import { useDragWithThreshold } from '@shared/hooks/useDragWithThreshold';

const CLOUD_TARGET_ID = '__quickclipboard_cloud__';
const DROP_PROXY_PATHS_EVENT = 'drop-proxy-paths';
const DROP_PROXY_LEAVE_EVENT = 'drop-proxy-leave';
const INTERNAL_DRAG_EVENT = 'transfer-shelf-internal-drag';
const INTERNAL_DRAG_STORAGE_KEY = 'transferShelfInternalDrag';
const INTERNAL_DRAG_STALE_MS = 30000;
const TASK_PROGRESS_EVENT = 'transfer-shelf-task-progress';
const STATE_CHANGED_EVENT = 'transfer-shelf-state-changed';
const HTML_DROP_PROXY_TYPES = new Set(['Files']);
const URL_DROP_TYPES = ['text/uri-list', 'text/plain', 'text/html'];
const PERSIST_DEBOUNCE_MS = 400;
const GEOMETRY_DEBOUNCE_MS = 400;
const DROP_RESOURCE_CLEANUP_MIN_AGE_MS = 5000;
const DROP_RESOURCE_CLEANUP_DELAY_MS = DROP_RESOURCE_CLEANUP_MIN_AGE_MS + 1000;
const VIEW_MODE_KEY = 'transferShelfViewMode';
const PEERS_COLLAPSED_KEY = 'transferShelfPeersCollapsed';
const PEERS_MAX_INNER = 90;
const PEERS_PADDING_TOP = 8;
const PEERS_BLOCK_FALLBACK = PEERS_MAX_INNER + PEERS_PADDING_TOP;
const TOGGLE_ANIM_MS = 160;
const DEFAULT_SHELF_NAME_PATTERN = /^(?:文件盒_|File Box_)([1-9]\d*)$/;
const DEFAULT_SHELF_NAMES = new Set(['文件盒', 'File Box']);

function getShelfIdFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('shelfId') ?? '';
  } catch {
    return '';
  }
}

function formatSize(size) {
  if (!Number.isFinite(size) || size <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = size;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

function createFileItem(info) {
  return {
    id: info.path,
    path: info.path,
    name: info.name || info.path,
    size: Number(info.size) || 0,
    isDir: Boolean(info.isDir),
    exists: Boolean(info.exists),
    icon: info.icon || '',
    addedAt: Date.now(),
  };
}

function normalizeFileProgresses(items) {
  if (!Array.isArray(items)) return {};
  const out = {};
  items.forEach((item) => {
    const path = typeof item?.path === 'string' ? item.path : '';
    if (!path) return;
    out[path] = {
      sentBytes: Number(item.sentBytes) || 0,
      totalBytes: Number(item.totalBytes) || 0,
      total: Number(item.total) || 0,
      done: Number(item.done) || 0,
      failed: Number(item.failed) || 0,
      status: item.status || 'pending',
    };
  });
  return out;
}

function buildInitialFileProgresses(targets, fileMap) {
  const out = {};
  targets.forEach((target) => {
    const file = fileMap.get(target.path);
    if (!file) return;
    const current = out[target.path] || {
      sentBytes: 0,
      totalBytes: 0,
      total: 0,
      done: 0,
      failed: 0,
      status: 'pending',
    };
    current.total += 1;
    current.totalBytes += Number(file.size) || 0;
    out[target.path] = current;
  });
  return out;
}

function toPersistedFile(file) {
  return {
    path: file.path,
    name: file.name,
    size: Number(file.size) || 0,
    isDir: Boolean(file.isDir),
    exists: Boolean(file.exists),
    icon: file.icon || '',
  };
}

function readStoredViewMode() {
  try {
    const value = localStorage.getItem(VIEW_MODE_KEY);
    return value === 'grid' ? 'grid' : 'list';
  } catch {
    return 'list';
  }
}

function readStoredPeersCollapsed() {
  try {
    const value = localStorage.getItem(PEERS_COLLAPSED_KEY);
    return value !== '0';
  } catch {
    return true;
  }
}

function formatShelfDisplayName(name, t) {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (!trimmed || DEFAULT_SHELF_NAMES.has(trimmed)) {
    return t('transferShelf.defaultName');
  }
  const match = trimmed.match(DEFAULT_SHELF_NAME_PATTERN);
  if (match) {
    return t('transferShelf.defaultNameWithIndex', { index: Number(match[1]) });
  }
  return trimmed;
}

function getDataTransferTypes(dataTransfer) {
  return Array.from(dataTransfer?.types || []);
}

function hasNativeFiles(dataTransfer) {
  return getDataTransferTypes(dataTransfer).some((type) => HTML_DROP_PROXY_TYPES.has(type));
}

function hasUrlDropData(dataTransfer) {
  const types = getDataTransferTypes(dataTransfer);
  return types.some((type) => URL_DROP_TYPES.includes(type));
}

function shouldUseNativeDropProxy(dataTransfer) {
  return hasNativeFiles(dataTransfer) && !hasUrlDropData(dataTransfer);
}

function hasSupportedDropPayload(dataTransfer) {
  return hasNativeFiles(dataTransfer) || hasUrlDropData(dataTransfer);
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function firstUrlFromText(value) {
  if (!value) return '';
  const lines = String(value)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
  return lines.find(isHttpUrl) || '';
}

function extractImageUrlsFromHtml(html) {
  if (!html) return [];
  const urls = [];
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('img[src]').forEach((image) => {
      const src = image.getAttribute('src') || '';
      if (isHttpUrl(src) || src.startsWith('data:image/')) urls.push(src);
    });
  } catch {
    // ignore
  }
  return urls;
}

function extractDropUrls(dataTransfer) {
  const urls = [];
  const uriList = firstUrlFromText(dataTransfer?.getData('text/uri-list'));
  if (uriList) urls.push(uriList);

  extractImageUrlsFromHtml(dataTransfer?.getData('text/html')).forEach((url) => {
    if (!urls.includes(url)) urls.push(url);
  });

  const plainUrl = firstUrlFromText(dataTransfer?.getData('text/plain'));
  if (plainUrl && !urls.includes(plainUrl)) urls.push(plainUrl);
  return urls;
}

function extensionFromMime(mime) {
  const normalized = String(mime || '').split(';')[0].trim().toLowerCase();
  const map = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/bmp': 'bmp',
    'image/svg+xml': 'svg',
  };
  return map[normalized] || '';
}

function filenameFromUrl(url, fallbackExt = '') {
  try {
    const parsed = new URL(url);
    const pathname = decodeURIComponent(parsed.pathname || '');
    const name = pathname.split('/').filter(Boolean).pop() || 'drop-resource';
    if (/\.[A-Za-z0-9]{1,8}$/.test(name)) return name;
  } catch {
    // ignore
  }
  return fallbackExt ? `drop-resource.${fallbackExt}` : 'drop-resource';
}

async function readBlobBytes(blob) {
  return new Uint8Array(await blob.arrayBuffer());
}

function getCurrentWindowLabel() {
  try {
    return getCurrentWindow().label || '';
  } catch {
    return '';
  }
}

function readStoredInternalDragSource() {
  try {
    const raw = localStorage.getItem(INTERNAL_DRAG_STORAGE_KEY);
    if (!raw) return '';
    const state = JSON.parse(raw);
    const sourceLabel = typeof state?.sourceLabel === 'string' ? state.sourceLabel : '';
    const startedAt = Number(state?.startedAt) || 0;
    if (!sourceLabel || Date.now() - startedAt > INTERNAL_DRAG_STALE_MS) {
      localStorage.removeItem(INTERNAL_DRAG_STORAGE_KEY);
      return '';
    }
    return sourceLabel;
  } catch {
    return '';
  }
}

function writeStoredInternalDragSource(sourceLabel) {
  try {
    localStorage.setItem(INTERNAL_DRAG_STORAGE_KEY, JSON.stringify({
      sourceLabel,
      startedAt: Date.now(),
    }));
  } catch {
    // ignore
  }
}

function clearStoredInternalDragSource() {
  try {
    localStorage.removeItem(INTERNAL_DRAG_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export default function App() {
  const { t } = useTranslation();
  const settings = useSnapshot(settingsStore);
  const {
    theme,
    effectiveTheme,
    isDark,
    isBackground,
    backgroundImagePath,
    lightThemeStyle,
    darkThemeStyle,
  } = useTheme();
  const shelfId = useMemo(() => getShelfIdFromUrl(), []);
  const defaultShelfName = t('transferShelf.defaultName');
  const [files, setFiles] = useState([]);
  const [peers, setPeers] = useState([]);
  const [selectedPeerIds, setSelectedPeerIds] = useState([]);
  const [dropActive, setDropActive] = useState(false);
  const [task, setTask] = useState({
    status: 'idle',
    total: 0,
    done: 0,
    failed: 0,
    sentBytes: 0,
    totalBytes: 0,
    currentFileName: '',
  });
  const [failedTargets, setFailedTargets] = useState([]);
  const [fileProgresses, setFileProgresses] = useState({});
  const [errorText, setErrorText] = useState('');
  const [restored, setRestored] = useState(false);
  const [viewMode, setViewMode] = useState(readStoredViewMode);
  const [peersCollapsed, setPeersCollapsed] = useState(readStoredPeersCollapsed);
  const [shelfName, setShelfName] = useState(defaultShelfName);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(defaultShelfName);
  const [selectedFilePaths, setSelectedFilePaths] = useState([]);
  const [lastSelectedPath, setLastSelectedPath] = useState('');
  const persistTimerRef = useRef(null);
  const cleanupDropResourceTimerRef = useRef(null);
  const geometryTimerRef = useRef(null);
  const filesPanelRef = useRef(null);
  const peersRef = useRef(null);
  const peersWrapperRef = useRef(null);
  const peersHeightRef = useRef(PEERS_BLOCK_FALLBACK);
  const animatingRef = useRef(false);
  const rootRef = useRef(null);
  const windowLabelRef = useRef(getCurrentWindowLabel());
  const nativeDropProxyVisibleRef = useRef(false);
  const nativeDropProxyPendingRef = useRef(false);
  const nativeDropProxyShowPromiseRef = useRef(null);
  const selfExternalDragRef = useRef(false);
  const selfExternalDragClearTimerRef = useRef(null);
  const internalDragSourceLabelRef = useRef(readStoredInternalDragSource());
  const isBusyRef = useRef(false);
  const displayShelfName = useMemo(
    () => formatShelfDisplayName(shelfName, t),
    [shelfName, t],
  );

  useSettingsSync();

  useEffect(() => {
    applyThemeToBody(theme, 'transfer-shelf');
  }, [theme, lightThemeStyle, darkThemeStyle, effectiveTheme]);

  useEffect(() => {
    if (isBackground && backgroundImagePath) {
      applyBackgroundImage({
        containerSelector: '.shelf-shell',
        backgroundImagePath,
        windowName: 'transfer-shelf',
      });
      return () => clearBackgroundImage('.shelf-shell');
    }

    clearBackgroundImage('.shelf-shell');
    return undefined;
  }, [isBackground, backgroundImagePath]);

  const isSending = task.status === 'sending';
  const isUploading = task.status === 'uploading';
  const isBusy = isSending || isUploading;
  isBusyRef.current = isBusy;
  const cloudEnabled = Boolean(settings.webdavEnabled) && Boolean(String(settings.webdavUrl || '').trim());
  const cloudSelected = selectedPeerIds.includes(CLOUD_TARGET_ID);
  const selectedLanPeerIds = selectedPeerIds.filter((id) => id !== CLOUD_TARGET_ID);
  const canSend = files.length > 0 && selectedPeerIds.length > 0 && !isBusy && (!cloudSelected || cloudEnabled);
  const canRetry = !isBusy && failedTargets.length > 0;
  const canResetTransferState = !isBusy && (
    task.status !== 'idle'
    || failedTargets.length > 0
    || errorText.trim().length > 0
    || Object.keys(fileProgresses).length > 0
  );
  const formatError = (error, fallbackKey = 'errors.operationFailed') => formatUserMessage(error, t, fallbackKey);
  const formatSendError = (error) => formatError(error, 'errors.transferShelf.sendFailed');
  const formatUploadError = (error) => formatError(error, 'errors.transferShelf.uploadFailed');
  const selectedFileSet = useMemo(() => new Set(selectedFilePaths), [selectedFilePaths]);
  const activeFiles = useMemo(
    () => {
      const selected = files.filter((file) => selectedFileSet.has(file.path));
      return selected.length > 0 ? selected : files;
    },
    [files, selectedFileSet],
  );
  const validSelectedFileCount = files.filter((file) => selectedFileSet.has(file.path)).length;
  const selectedPeers = peers.filter((peer) => selectedLanPeerIds.includes(peer.device_id));
  const peersCountLabel = `${selectedPeers.length + (cloudSelected ? 1 : 0)}/${peers.length + 1}`;
  const sendTitle = !canSend
    ? (files.length === 0
      ? t('transferShelf.sendTitleNoFiles')
      : cloudSelected && !cloudEnabled
        ? t('transferShelf.cloudDisabled')
        : t('transferShelf.sendTitleNoPeers'))
    : cloudSelected
      ? t('transferShelf.uploadCloudTitle', { fileCount: activeFiles.length })
      : t('transferShelf.sendTitle', { fileCount: activeFiles.length, peerCount: selectedPeers.length });

  const addPaths = async (paths) => {
    if (isBusyRef.current) return;
    const uniquePaths = [...new Set(paths.filter((path) => typeof path === 'string' && path.length > 0))];
    if (uniquePaths.length === 0) return;

    const infos = await describeTransferShelfPaths(uniquePaths);
    setFiles((current) => {
      const next = new Map(current.map((file) => [file.path, file]));
      infos
        .filter((info) => info.exists && !info.isDir)
        .map(createFileItem)
        .forEach((item) => next.set(item.path, item));
      return Array.from(next.values());
    });
    setErrorText('');
  };

  useEffect(() => {
    initSettings().catch(() => { });
  }, []);

  useEffect(() => () => {
    if (selfExternalDragClearTimerRef.current) {
      window.clearTimeout(selfExternalDragClearTimerRef.current);
      selfExternalDragClearTimerRef.current = null;
    }
    if (cleanupDropResourceTimerRef.current) {
      window.clearTimeout(cleanupDropResourceTimerRef.current);
      cleanupDropResourceTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    // 提前创建隐藏的原生拖放层，避免首次拖入时边拖边初始化导致丢失 drop。
    ensureDropProxy().catch(() => { });
  }, []);

  useEffect(() => {
    let unlisten = null;
    listen(INTERNAL_DRAG_EVENT, (event) => {
      const payload = event.payload || {};
      const sourceLabel = typeof payload.sourceLabel === 'string' ? payload.sourceLabel : '';
      if (payload.active && sourceLabel) {
        internalDragSourceLabelRef.current = sourceLabel;
        return;
      }
      internalDragSourceLabelRef.current = '';
      resetLocalDropLayer();
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  // 启动时恢复持久化的暂存与窗口几何
  useEffect(() => {
    if (!shelfId) {
      setRestored(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const snapshot = await loadTransferShelfState(shelfId);
        if (cancelled || !snapshot) return;
        const restoredFiles = Array.isArray(snapshot.files)
          ? snapshot.files.filter((info) => info && !info.isDir).map(createFileItem)
          : [];
        if (restoredFiles.length > 0) setFiles(restoredFiles);
        if (typeof snapshot.name === 'string' && snapshot.name.trim()) {
          setShelfName(snapshot.name);
          setDraftName(snapshot.name);
        }
        if (Array.isArray(snapshot.selectedPeerIds) && snapshot.selectedPeerIds.length > 0) {
          setSelectedPeerIds(snapshot.selectedPeerIds);
        }
      } catch {
        // 持久化数据无效时静默忽略
      } finally {
        if (!cancelled) setRestored(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shelfId]);

  useEffect(() => {
    getCurrentWindow().setTitle(displayShelfName).catch(() => { });
  }, [displayShelfName]);

  useEffect(() => {
    if (!shelfId) return;
    let unlisten = null;
    listen(STATE_CHANGED_EVENT, async (event) => {
      if (event.payload?.shelfId !== shelfId) return;
      try {
        const snapshot = await loadTransferShelfState(shelfId);
        const restoredFiles = Array.isArray(snapshot.files)
          ? snapshot.files.filter((info) => info && !info.isDir).map(createFileItem)
          : [];
        setFiles(restoredFiles);
        if (Array.isArray(snapshot.selectedPeerIds)) {
          setSelectedPeerIds(snapshot.selectedPeerIds);
        }
      } catch {
        // 外部追加失败时保持当前列表
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, [shelfId]);

  useEffect(() => {
    let unlisten = null;
    getCurrentWindow().listen(DROP_PROXY_PATHS_EVENT, async (event) => {
      if (event.payload?.targetLabel !== windowLabelRef.current) return;
      const paths = Array.isArray(event.payload?.paths) ? event.payload.paths : [];
      if (paths.length === 0) return;
      resetLocalDropLayer();
      await addPaths(paths);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  useEffect(() => {
    if (!shelfId) return;
    let unlisten = null;
    listen(TASK_PROGRESS_EVENT, (event) => {
      const payload = event.payload || {};
      if (payload.shelfId !== shelfId) return;

      const errors = Array.isArray(payload.errors) ? payload.errors : [];
      setTask({
        status: payload.status || 'idle',
        total: Number(payload.total) || 0,
        done: Number(payload.done) || 0,
        failed: Number(payload.failed) || 0,
        sentBytes: Number(payload.sentBytes) || 0,
        totalBytes: Number(payload.totalBytes) || 0,
        currentFileName: payload.currentFileName || '',
      });
      setFileProgresses(normalizeFileProgresses(payload.fileProgresses));
      setFailedTargets(errors.map((item) => ({
        peerId: item.peerId,
        path: item.path,
        message: item.message ? formatSendError(item.message) : '',
      })));
      setErrorText(errors.length > 0 ? formatSendError(errors[errors.length - 1].message || '') : '');
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, [shelfId]);

  useEffect(() => {
    let unlisten = null;
    getCurrentWindow().listen(DROP_PROXY_LEAVE_EVENT, (event) => {
      if (event.payload?.targetLabel !== windowLabelRef.current) return;
      resetLocalDropLayer();
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadPeers() {
      try {
        const result = await listSyncTransferLanPairedPeers();
        if (!cancelled) setPeers(Array.isArray(result) ? result : []);
      } catch {
        if (!cancelled) setPeers([]);
      }
    }

    loadPeers();
    const timer = window.setInterval(loadPeers, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  // 文件队列与目标设备变化后防抖写入持久化
  useEffect(() => {
    if (!shelfId || !restored) return;
    if (persistTimerRef.current) {
      window.clearTimeout(persistTimerRef.current);
    }
    persistTimerRef.current = window.setTimeout(() => {
      saveTransferShelfState(shelfId, files.map(toPersistedFile), selectedPeerIds)
        .then(() => {
          cleanupDropProxyOrphanResources(DROP_RESOURCE_CLEANUP_MIN_AGE_MS).catch(() => { });
          if (cleanupDropResourceTimerRef.current) {
            window.clearTimeout(cleanupDropResourceTimerRef.current);
          }
          cleanupDropResourceTimerRef.current = window.setTimeout(() => {
            cleanupDropResourceTimerRef.current = null;
            cleanupDropProxyOrphanResources(DROP_RESOURCE_CLEANUP_MIN_AGE_MS).catch(() => { });
          }, DROP_RESOURCE_CLEANUP_DELAY_MS);
        })
        .catch(() => {
          // 持久化失败不影响内存状态
        });
    }, PERSIST_DEBOUNCE_MS);
    return () => {
      if (persistTimerRef.current) {
        window.clearTimeout(persistTimerRef.current);
      }
    };
  }, [shelfId, restored, files, selectedPeerIds]);

  // 监听窗口位置 / 尺寸变化并防抖保存
  useEffect(() => {
    if (!shelfId || !restored) return;
    const win = getCurrentWindow();
    let unlistenMove = null;
    let unlistenResize = null;
    const schedule = () => {
      if (geometryTimerRef.current) {
        window.clearTimeout(geometryTimerRef.current);
      }
      geometryTimerRef.current = window.setTimeout(() => {
        saveTransferShelfGeometry(shelfId).catch(() => {
          // 写入失败不阻塞 UI
        });
      }, GEOMETRY_DEBOUNCE_MS);
    };
    win.onMoved(schedule).then((fn) => {
      unlistenMove = fn;
    });
    win.onResized(schedule).then((fn) => {
      unlistenResize = fn;
    });
    return () => {
      if (unlistenMove) unlistenMove();
      if (unlistenResize) unlistenResize();
      if (geometryTimerRef.current) {
        window.clearTimeout(geometryTimerRef.current);
      }
    };
  }, [shelfId, restored]);

  // 视图模式持久化
  useEffect(() => {
    try {
      localStorage.setItem(VIEW_MODE_KEY, viewMode);
    } catch {
      // ignore
    }
  }, [viewMode]);

  // 折叠状态持久化
  useEffect(() => {
    try {
      localStorage.setItem(PEERS_COLLAPSED_KEY, peersCollapsed ? '1' : '0');
    } catch {
      // ignore
    }
  }, [peersCollapsed]);

  useEffect(() => {
    const pathSet = new Set(files.map((file) => file.path));
    setSelectedFilePaths((current) => current.filter((path) => pathSet.has(path)));
    setLastSelectedPath((current) => (current && pathSet.has(current) ? current : ''));
  }, [files]);

  const removeFile = (path) => {
    if (isBusy) return;
    setFiles((current) => current.filter((file) => file.path !== path));
    setFailedTargets((current) => current.filter((item) => item.path !== path));
    setFileProgresses((current) => {
      const next = { ...current };
      delete next[path];
      return next;
    });
    setSelectedFilePaths((current) => current.filter((item) => item !== path));
    setLastSelectedPath((current) => (current === path ? '' : current));
  };

  const clearFiles = () => {
    if (isBusy) return;
    setFiles([]);
    setErrorText('');
    setFailedTargets([]);
    setFileProgresses({});
    setSelectedFilePaths([]);
    setLastSelectedPath('');
    setTask({ status: 'idle', total: 0, done: 0, failed: 0, sentBytes: 0, totalBytes: 0, currentFileName: '' });
  };

  const selectFile = (event, path) => {
    if (isBusy) return;
    if (event.shiftKey && lastSelectedPath) {
      const startIndex = files.findIndex((file) => file.path === lastSelectedPath);
      const endIndex = files.findIndex((file) => file.path === path);
      if (startIndex >= 0 && endIndex >= 0) {
        const [from, to] = startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
        const rangePaths = files.slice(from, to + 1).map((file) => file.path);
        setSelectedFilePaths((current) => Array.from(new Set([...current, ...rangePaths])));
        setLastSelectedPath(path);
        return;
      }
    }

    if (event.ctrlKey || event.metaKey) {
      setSelectedFilePaths((current) => (
        current.includes(path)
          ? current.filter((item) => item !== path)
          : [...current, path]
      ));
      setLastSelectedPath(path);
      return;
    }

    setSelectedFilePaths([path]);
    setLastSelectedPath(path);
  };

  const togglePeer = (deviceId) => {
    if (isBusy) return;
    if (deviceId === CLOUD_TARGET_ID) {
      if (!cloudEnabled) return;
      setSelectedPeerIds((current) => (
        current.includes(CLOUD_TARGET_ID) ? [] : [CLOUD_TARGET_ID]
      ));
      return;
    }
    setSelectedPeerIds((current) => (
      current.includes(deviceId)
        ? current.filter((id) => id !== deviceId && id !== CLOUD_TARGET_ID)
        : [...current.filter((id) => id !== CLOUD_TARGET_ID), deviceId]
    ));
  };

  const selectFiles = async () => {
    if (isBusy) return;
    const selected = await openFileDialog({ multiple: true, directory: false });
    const paths = Array.isArray(selected) ? selected : selected ? [selected] : [];
    if (paths.length > 0) {
      await addPaths(paths);
    }
  };

  const handleClose = async () => {
    if (files.length > 0) {
      const confirmed = await showConfirm(
        t('transferShelf.closeConfirmMessage', { count: files.length }),
        t('transferShelf.closeConfirmTitle'),
      );
      if (!confirmed) return;
    }

    if (shelfId) {
      try {
        await closeTransferShelf(shelfId);
        return;
      } catch {
        // fall through to window close
      }
    }
    try {
      await getCurrentWindow().close();
    } catch {
      // ignore
    }
  };

  const handleMinimize = async () => {
    try {
      await getCurrentWindow().minimize();
    } catch {
      // ignore
    }
  };

  const handleStartDrag = async (event) => {
    if (event.button !== 0) return;
    if (event.target.closest([
      'button',
      'input',
      'textarea',
      'select',
      'a',
      '[data-no-window-drag]',
      '.shelf-file',
      '.shelf-peer',
      '.shelf-files__list',
      '.shelf-peers__inner',
      '.shelf-error',
    ].join(','))) return;
    if (event?.preventDefault) event.preventDefault();
    try {
      await getCurrentWindow().startDragging();
    } catch {
      // ignore
    }
  };

  const resetLocalDropLayer = () => {
    nativeDropProxyVisibleRef.current = false;
    nativeDropProxyPendingRef.current = false;
    setDropActive(false);
  };

  const hideDropLayer = async () => {
    resetLocalDropLayer();
    try {
      await hideDropProxy();
    } catch {
      // ignore
    }
  };

  const getInternalDragSourceLabel = () => {
    const sourceLabel = internalDragSourceLabelRef.current || readStoredInternalDragSource();
    internalDragSourceLabelRef.current = sourceLabel;
    return sourceLabel;
  };

  const isInternalDragFromAnotherShelf = () => {
    const sourceLabel = getInternalDragSourceLabel();
    return Boolean(sourceLabel && sourceLabel !== windowLabelRef.current);
  };

  const beginInternalShelfDrag = () => {
    const sourceLabel = windowLabelRef.current;
    internalDragSourceLabelRef.current = sourceLabel;
    writeStoredInternalDragSource(sourceLabel);
    emit(INTERNAL_DRAG_EVENT, { active: true, sourceLabel }).catch(() => { });
  };

  const finishInternalShelfDrag = () => {
    const sourceLabel = windowLabelRef.current;
    internalDragSourceLabelRef.current = '';
    clearStoredInternalDragSource();
    emit(INTERNAL_DRAG_EVENT, { active: false, sourceLabel }).catch(() => { });
  };

  const isPointerInsideRoot = (event) => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return false;
    const x = Number(event.clientX);
    const y = Number(event.clientY);
    return Number.isFinite(x)
      && Number.isFinite(y)
      && x > rect.left
      && x < rect.right
      && y > rect.top
      && y < rect.bottom;
  };

  const showNativeDropLayer = async () => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    if (nativeDropProxyVisibleRef.current) return;
    if (nativeDropProxyShowPromiseRef.current) return nativeDropProxyShowPromiseRef.current;

    nativeDropProxyPendingRef.current = true;

    const showPromise = (async () => {
      try {
        await showDropProxy({
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
        });
        if (!nativeDropProxyPendingRef.current) {
          nativeDropProxyVisibleRef.current = false;
          await hideDropProxy().catch(() => { });
          return;
        }
        nativeDropProxyVisibleRef.current = true;
      } catch (error) {
        nativeDropProxyVisibleRef.current = false;
        setErrorText(formatError(error));
      } finally {
        nativeDropProxyPendingRef.current = false;
        nativeDropProxyShowPromiseRef.current = null;
      }
    })();

    nativeDropProxyShowPromiseRef.current = showPromise;
    return showPromise;
  };

  const handleHtmlDragEnter = async (event) => {
    if (isBusyRef.current) {
      setDropActive(false);
      return;
    }
    if (!hasSupportedDropPayload(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    setDropActive(true);
    if (isInternalDragFromAnotherShelf()) return;
    if (shouldUseNativeDropProxy(event.dataTransfer) && !selfExternalDragRef.current) {
      await showNativeDropLayer();
    }
  };

  const handleHtmlDragOver = (event) => {
    if (isBusyRef.current) {
      setDropActive(false);
      return;
    }
    if (!hasSupportedDropPayload(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
    setDropActive(true);
    if (isInternalDragFromAnotherShelf()) return;
    if (shouldUseNativeDropProxy(event.dataTransfer) && !selfExternalDragRef.current) {
      showNativeDropLayer().catch(() => { });
    }
  };

  const handleHtmlDragLeave = (event) => {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    if (isPointerInsideRoot(event)) return;
    if (nativeDropProxyPendingRef.current) {
      nativeDropProxyPendingRef.current = false;
      setDropActive(false);
      return;
    }
    if (nativeDropProxyVisibleRef.current) return;
    hideDropLayer();
  };

  const saveDroppedFile = async (file) => {
    if (!file) return '';
    const bytes = await readBlobBytes(file);
    const ext = extensionFromMime(file.type);
    const filename = file.name || (ext ? `drop-resource.${ext}` : 'drop-resource');
    const saved = await saveDropProxyResource(filename, bytes);
    return saved?.path || '';
  };

  const saveDroppedUrl = async (url) => {
    if (!url) return '';
    if (url.startsWith('data:image/')) {
      const blob = await (await fetch(url)).blob();
      const ext = extensionFromMime(blob.type || 'image/png');
      const filename = filenameFromUrl(url, ext);
      const saved = await saveDropProxyResource(filename, await readBlobBytes(blob));
      return saved?.path || '';
    }
    if (!isHttpUrl(url)) return '';
    const filename = filenameFromUrl(url);
    const saved = await saveDropProxyUrl(filename, url);
    return saved?.path || '';
  };

  const handleHtmlDrop = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDropActive(false);

    if (isBusyRef.current) {
      await hideDropProxy().catch(() => { });
      return;
    }

    let shouldHideProxy = true;
    try {
      if (isInternalDragFromAnotherShelf()) {
        return;
      }

      if (selfExternalDragRef.current && shouldUseNativeDropProxy(event.dataTransfer)) {
        await hideDropProxy();
        return;
      }

      if (shouldUseNativeDropProxy(event.dataTransfer)) {
        const filesFromHtml = Array.from(event.dataTransfer?.files || []);
        if (!nativeDropProxyVisibleRef.current) {
          const directPaths = filesFromHtml
            .map((file) => (typeof file?.path === 'string' ? file.path : ''))
            .filter(Boolean);
          if (directPaths.length > 0) {
            await addPaths(directPaths);
            await hideDropProxy();
            return;
          }

          if (filesFromHtml.length > 0) {
            const paths = [];
            for (const file of filesFromHtml) {
              const path = await saveDroppedFile(file);
              if (path) paths.push(path);
            }
            if (paths.length > 0) {
              await addPaths(paths);
            }
            await hideDropProxy();
            return;
          }
        }
        shouldHideProxy = false;
        return;
      }

      const filesFromHtml = Array.from(event.dataTransfer?.files || []);
      if (filesFromHtml.length > 0) {
        const paths = [];
        for (const file of filesFromHtml) {
          const path = await saveDroppedFile(file);
          if (path) paths.push(path);
        }
        if (paths.length > 0) {
          await addPaths(paths);
        }
        await hideDropProxy();
        return;
      }

      const urls = extractDropUrls(event.dataTransfer);
      if (urls.length > 0) {
        const paths = [];
        for (const url of urls) {
          const path = await saveDroppedUrl(url);
          if (path) paths.push(path);
        }
        if (paths.length > 0) {
          await addPaths(paths);
        }
      }
    } catch (error) {
      setErrorText(formatError(error, 'errors.file.saveFailed'));
    } finally {
      if (shouldHideProxy) {
        await hideDropProxy().catch(() => { });
      }
    }
  };

  const toggleViewMode = () => {
    setViewMode((mode) => (mode === 'list' ? 'grid' : 'list'));
  };

  const startEditName = () => {
    setDraftName(displayShelfName);
    setEditingName(true);
  };

  const cancelEditName = () => {
    setDraftName(displayShelfName);
    setEditingName(false);
  };

  const saveName = async () => {
    const nextName = draftName.trim();
    if (!nextName) {
      cancelEditName();
      return;
    }
    if (nextName === displayShelfName) {
      setEditingName(false);
      return;
    }
    try {
      const summary = await renameTransferShelf(shelfId, nextName);
      const savedName = summary?.name || nextName;
      setShelfName(savedName);
      setDraftName(formatShelfDisplayName(savedName, t));
      setEditingName(false);
    } catch (error) {
      setErrorText(formatError(error));
    }
  };

  const handleExternalDragMouseDown = useDragWithThreshold({
    onDragStart: () => {
      if (selfExternalDragClearTimerRef.current) {
        window.clearTimeout(selfExternalDragClearTimerRef.current);
        selfExternalDragClearTimerRef.current = null;
      }
      selfExternalDragRef.current = true;
      beginInternalShelfDrag();
      nativeDropProxyVisibleRef.current = false;
      nativeDropProxyPendingRef.current = false;
      setDropActive(false);
      hideDropProxy().catch(() => { });
    },
    onDragEnd: async ({ paths, mode, result, cursorPos }) => {
      resetLocalDropLayer();
      selfExternalDragClearTimerRef.current = window.setTimeout(() => {
        selfExternalDragRef.current = false;
        selfExternalDragClearTimerRef.current = null;
      }, 300);
      try {
        if (Array.isArray(paths) && paths.length > 0 && cursorPos) {
          try {
            const routeResult = await routeDropProxyPathsAtCursor(paths, cursorPos);
            if (routeResult?.routed) return;
          } catch {
            // 兜底路由失败时继续按普通外部拖拽结果处理
          }
        }
        if (mode !== 'move' || result !== 'Dropped' || !Array.isArray(paths) || paths.length === 0) return;
        if (cursorPos && Number.isFinite(cursorPos.x) && Number.isFinite(cursorPos.y)) {
          try {
            const win = getCurrentWindow();
            const position = await win.outerPosition();
            const size = await win.outerSize();
            const insideWindow = cursorPos.x >= position.x
              && cursorPos.x <= position.x + size.width
              && cursorPos.y >= position.y
              && cursorPos.y <= position.y + size.height;
            if (insideWindow) return;
          } catch {
            // 无法判断落点时继续按插件 Dropped 结果处理
          }
        }
        let movedPaths = [];
        try {
          await new Promise((resolve) => window.setTimeout(resolve, 500));
          const infos = await describeTransferShelfPaths(paths);
          movedPaths = Array.isArray(infos)
            ? infos.filter((info) => info && info.exists === false).map((info) => info.path)
            : [];
        } catch {
          movedPaths = [];
        }
        if (movedPaths.length === 0) return;

        const movedSet = new Set(movedPaths);
        setFiles((current) => current.filter((file) => !movedSet.has(file.path)));
        setFailedTargets((current) => current.filter((item) => !movedSet.has(item.path)));
        setFileProgresses((current) => {
          const next = { ...current };
          movedSet.forEach((path) => delete next[path]);
          return next;
        });
        setSelectedFilePaths((current) => current.filter((path) => !movedSet.has(path)));
        setLastSelectedPath((current) => (movedSet.has(current) ? '' : current));
        setErrorText('');
      } finally {
        finishInternalShelfDrag();
      }
    },
    onDragCancel: () => {
      if (selfExternalDragClearTimerRef.current) {
        window.clearTimeout(selfExternalDragClearTimerRef.current);
        selfExternalDragClearTimerRef.current = null;
      }
      selfExternalDragRef.current = false;
      resetLocalDropLayer();
      finishInternalShelfDrag();
    },
  });

  // 折叠/展开设备列表：冻结文件区，避免窗口尺寸变化时 flex 把中间区域推来推去
  const togglePeersCollapsed = async () => {
    if (animatingRef.current) return;
    const next = !peersCollapsed;
    const wrapper = peersWrapperRef.current;
    const inner = peersRef.current;
    const filesPanel = filesPanelRef.current;
    // 真实可见高度被 inner 的 max-height 夹住，不能直接用 scrollHeight
    const innerVisible = inner
      ? Math.min(inner.scrollHeight, PEERS_MAX_INNER)
      : PEERS_MAX_INNER;
    const targetWrapperH = innerVisible + PEERS_PADDING_TOP;
    if (innerVisible > 0) peersHeightRef.current = targetWrapperH;
    const delta = peersHeightRef.current || PEERS_BLOCK_FALLBACK;

    animatingRef.current = true;

    try {
      const win = getCurrentWindow();
      const factor = await win.scaleFactor();
      const innerSize = await win.innerSize();
      const logicalW = innerSize.width / factor;
      const currentLogicalH = innerSize.height / factor;
      const targetLogicalH = next
        ? Math.max(currentLogicalH - delta, 220)
        : currentLogicalH + delta;

      let frozenFilesHeight = 0;
      if (filesPanel) {
        frozenFilesHeight = filesPanel.getBoundingClientRect().height;
        filesPanel.style.flex = '0 0 auto';
        filesPanel.style.boxSizing = 'border-box';
        filesPanel.style.height = `${frozenFilesHeight}px`;
      }

      if (wrapper) {
        wrapper.style.transition = 'none';
        wrapper.style.overflow = 'hidden';
        wrapper.style.maxHeight = next ? `${targetWrapperH}px` : '0px';
        wrapper.style.paddingTop = next ? `${PEERS_PADDING_TOP}px` : '0px';
        wrapper.style.opacity = next ? '1' : '0';
        wrapper.style.pointerEvents = next ? '' : 'none';
      }

      if (!next) {
        await win.setSize(new LogicalSize(logicalW, targetLogicalH));
        setPeersCollapsed(false);
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      } else {
        setPeersCollapsed(false);
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }

      if (wrapper) {
        wrapper.style.transition = `max-height ${TOGGLE_ANIM_MS}ms cubic-bezier(0.4, 0, 0.2, 1), padding-top ${TOGGLE_ANIM_MS}ms cubic-bezier(0.4, 0, 0.2, 1), opacity ${TOGGLE_ANIM_MS - 20}ms ease`;
        wrapper.style.maxHeight = next ? '0px' : `${targetWrapperH}px`;
        wrapper.style.paddingTop = next ? '0px' : `${PEERS_PADDING_TOP}px`;
        wrapper.style.opacity = next ? '0' : '1';
        wrapper.style.pointerEvents = next ? 'none' : '';
      }

      await new Promise((resolve) => window.setTimeout(resolve, TOGGLE_ANIM_MS));

      if (next) {
        setPeersCollapsed(true);
        await win.setSize(new LogicalSize(logicalW, targetLogicalH));
      } else if (filesPanel && frozenFilesHeight > 0) {
        const diff = filesPanel.getBoundingClientRect().height - frozenFilesHeight;
        if (Math.abs(diff) > 0.25) {
          await win.setSize(new LogicalSize(logicalW, targetLogicalH - diff));
        }
      }

      if (wrapper) {
        wrapper.style.transition = '';
        wrapper.style.overflow = '';
        wrapper.style.maxHeight = '';
        wrapper.style.paddingTop = '';
        wrapper.style.opacity = '';
        wrapper.style.pointerEvents = '';
      }
      if (filesPanel) {
        filesPanel.style.flex = '';
        filesPanel.style.boxSizing = '';
        filesPanel.style.height = '';
      }
    } catch (error) {
      console.warn('调整文件盒窗口高度失败', error);
    } finally {
      if (filesPanel) {
        filesPanel.style.flex = '';
        filesPanel.style.boxSizing = '';
        filesPanel.style.height = '';
      }
      animatingRef.current = false;
    }
  };

  // 把 (peer, file) 对作为单元发送，便于失败时只重试失败项
  const runSendBatch = async (targets) => {
    if (!Array.isArray(targets) || targets.length === 0) return;
    const fileMap = new Map(files.map((file) => [file.path, file]));
    const peerSet = new Set(peers.map((peer) => peer.device_id));

    const validTargets = targets.filter((target) => fileMap.has(target.path) && peerSet.has(target.peerId));
    if (validTargets.length === 0) {
      setErrorText(t('transferShelf.invalidTargets'));
      return;
    }

    setErrorText('');
    setFailedTargets([]);
    const initialFileProgresses = buildInitialFileProgresses(validTargets, fileMap);
    setFileProgresses(initialFileProgresses);
    const totalBytes = validTargets.reduce((sum, target) => {
      const file = fileMap.get(target.path);
      return sum + (Number(file?.size) || 0);
    }, 0);
    setTask({
      status: 'sending',
      total: validTargets.length,
      done: 0,
      failed: 0,
      sentBytes: 0,
      totalBytes,
      currentFileName: '',
    });

    try {
      const result = await sendTransferShelf(shelfId, validTargets);
      const errors = Array.isArray(result?.errors) ? result.errors : [];
      setFailedTargets(errors.map((item) => ({
        peerId: item.peerId,
        path: item.path,
        message: item.message ? formatSendError(item.message) : '',
      })));
      setTask({
        status: result?.status || (errors.length > 0 ? 'failed' : 'done'),
        total: Number(result?.total) || validTargets.length,
        done: Number(result?.done) || 0,
        failed: Number(result?.failed) || errors.length,
        sentBytes: Number(result?.sentBytes) || totalBytes,
        totalBytes: Number(result?.totalBytes) || totalBytes,
        currentFileName: '',
      });
      setFileProgresses(normalizeFileProgresses(result?.fileProgresses));
      setErrorText(errors.length > 0 ? formatSendError(errors[errors.length - 1].message || '') : '');
    } catch (error) {
      const message = formatSendError(error);
      setErrorText(message);
      setTask({
        status: 'failed',
        total: validTargets.length,
        done: 0,
        failed: validTargets.length,
        sentBytes: 0,
        totalBytes,
        currentFileName: '',
      });
      setFileProgresses(Object.fromEntries(Object.entries(initialFileProgresses).map(([path, progress]) => [
        path,
        {
          ...progress,
          status: 'failed',
          failed: progress.total,
        },
      ])));
    }
  };

  const runCloudUploadBatch = async (targets) => {
    if (!Array.isArray(targets) || targets.length === 0) return;
    const fileMap = new Map(files.map((file) => [file.path, file]));

    const validTargets = targets
      .filter((target) => fileMap.has(target.path))
      .map((target) => ({ path: target.path }));
    if (validTargets.length === 0) {
      setErrorText(t('transferShelf.invalidTargets'));
      return;
    }

    setErrorText('');
    setFailedTargets([]);
    const initialFileProgresses = buildInitialFileProgresses(
      validTargets.map((target) => ({ ...target, peerId: 'cloud' })),
      fileMap,
    );
    setFileProgresses(initialFileProgresses);
    const totalBytes = validTargets.reduce((sum, target) => {
      const file = fileMap.get(target.path);
      return sum + (Number(file?.size) || 0);
    }, 0);
    setTask({
      status: 'uploading',
      total: validTargets.length,
      done: 0,
      failed: 0,
      sentBytes: 0,
      totalBytes,
      currentFileName: '',
    });

    try {
      const result = await uploadTransferShelfCloud(shelfId, validTargets);
      const errors = Array.isArray(result?.errors) ? result.errors : [];
      setFailedTargets(errors.map((item) => ({
        peerId: item.peerId || 'cloud',
        path: item.path,
        message: item.message ? formatUploadError(item.message) : '',
      })));
      setTask({
        status: result?.status || (errors.length > 0 ? 'failed' : 'done'),
        total: Number(result?.total) || validTargets.length,
        done: Number(result?.done) || 0,
        failed: Number(result?.failed) || errors.length,
        sentBytes: Number(result?.sentBytes) || totalBytes,
        totalBytes: Number(result?.totalBytes) || totalBytes,
        currentFileName: '',
      });
      setFileProgresses(normalizeFileProgresses(result?.fileProgresses));
      setErrorText(errors.length > 0 ? formatUploadError(errors[errors.length - 1].message || '') : '');
    } catch (error) {
      const message = formatUploadError(error);
      setErrorText(message);
      setTask({
        status: 'failed',
        total: validTargets.length,
        done: 0,
        failed: validTargets.length,
        sentBytes: 0,
        totalBytes,
        currentFileName: '',
      });
      setFailedTargets(validTargets.map((target) => ({
        peerId: 'cloud',
        path: target.path,
        message,
      })));
      setFileProgresses(Object.fromEntries(Object.entries(initialFileProgresses).map(([path, progress]) => [
        path,
        {
          ...progress,
          status: 'failed',
          failed: progress.total,
        },
      ])));
    }
  };

  const sendFiles = async () => {
    if (!canSend) return;
    if (cloudSelected) {
      await runCloudUploadBatch(activeFiles.map((file) => ({ path: file.path })));
      return;
    }

    const targets = [];
    for (const peerId of selectedLanPeerIds) {
      for (const file of activeFiles) {
        targets.push({ peerId, path: file.path });
      }
    }
    await runSendBatch(targets);
  };

  const retryFailed = async () => {
    if (!canRetry) return;
    if (failedTargets.some((target) => target.peerId === 'cloud')) {
      await runCloudUploadBatch(failedTargets.map((target) => ({ path: target.path })));
      return;
    }
    await runSendBatch(failedTargets);
  };

  const resetTransferState = () => {
    if (!canResetTransferState) return;
    setErrorText('');
    setFailedTargets([]);
    setFileProgresses({});
    setTask({ status: 'idle', total: 0, done: 0, failed: 0, sentBytes: 0, totalBytes: 0, currentFileName: '' });
  };

  return (
    <main
      ref={rootRef}
      className={[
        'shelf-root',
        dropActive ? 'is-drop-active' : '',
        isDark ? 'dark' : '',
        isBackground ? 'is-background-theme' : '',
      ].filter(Boolean).join(' ')}
      onPointerDown={handleStartDrag}
      onDragEnter={handleHtmlDragEnter}
      onDragOver={handleHtmlDragOver}
      onDragLeave={handleHtmlDragLeave}
      onDrop={handleHtmlDrop}
    >
      <section className="shelf-shell">
        <header className="shelf-header">
          {!editingName && (
            <button
              type="button"
              className="shelf-header__rename"
              title={t('common.rename')}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={startEditName}
            >
              <i className="ti ti-pencil" />
            </button>
          )}
          {editingName ? (
            <input
              className="shelf-header__name-input"
              value={draftName}
              maxLength={48}
              autoFocus
              onPointerDown={(event) => event.stopPropagation()}
              onChange={(event) => setDraftName(event.target.value)}
              onBlur={saveName}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  saveName();
                } else if (event.key === 'Escape') {
                  event.preventDefault();
                  cancelEditName();
                }
              }}
            />
          ) : (
            <span className="shelf-header__title" title={displayShelfName}>
              {displayShelfName}
            </span>
          )}
          <div className="shelf-header__actions" onPointerDown={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="shelf-icon-btn"
              title={viewMode === 'list' ? t('transferShelf.switchToGrid') : t('transferShelf.switchToList')}
              onClick={toggleViewMode}
            >
              <i className={`ti ${viewMode === 'list' ? 'ti-layout-grid' : 'ti-layout-list'}`} />
            </button>
            <button type="button" className="shelf-icon-btn" title={t('common.minimize')} onClick={handleMinimize}>
              <i className="ti ti-minus" />
            </button>
            <button type="button" className="shelf-icon-btn is-danger" title={t('common.close')} onClick={handleClose}>
              <i className="ti ti-x" />
            </button>
          </div>
        </header>

        <section className="shelf-files" ref={filesPanelRef}>
          {files.length === 0 ? (
            <div className="shelf-files__empty">
              <span className="shelf-files__empty-icon">
                <i className="ti ti-cloud-upload" />
              </span>
              <span className="shelf-files__empty-title">{t('transferShelf.dropFilesHere')}</span>
            </div>
          ) : (
            <div className={`shelf-files__list ${viewMode === 'grid' ? 'is-grid' : ''}`}>
              {files.map((file) => {
                const failedCount = failedTargets.filter((target) => target.path === file.path).length;
                const progress = fileProgresses[file.path];
                const progressRatio = progress?.totalBytes > 0
                  ? Math.min(1, Math.max(0, progress.sentBytes / progress.totalBytes))
                  : 0;
                const progressVisible = Boolean(progress)
                  && (isBusy || progress.status === 'done' || progress.status === 'failed');
                const missing = file.exists === false;
                const selected = selectedFileSet.has(file.path);
                const canExternalDrag = !missing && !isBusy;
                const dragFiles = selected
                  ? files.filter((item) => selectedFileSet.has(item.path) && item.exists !== false)
                  : [file];
                const dragPaths = dragFiles.map((item) => item.path);
                const className = [
                  'shelf-file',
                  canExternalDrag ? 'is-draggable' : '',
                  selected ? 'is-selected' : '',
                  missing ? 'is-missing' : '',
                  failedCount > 0 ? 'is-failed' : '',
                  progressVisible ? 'has-progress' : '',
                  progress?.status ? `is-progress-${progress.status}` : '',
                ].filter(Boolean).join(' ');
                const sizeLabel = missing
                  ? t('clipboard.fileNotFound')
                  : progressVisible && progress.totalBytes > 0
                    ? `${formatSize(progress.sentBytes)} / ${formatSize(progress.totalBytes)}`
                    : formatSize(file.size);
                const dragAction = selected && dragPaths.length > 1
                  ? t('transferShelf.dragSelectedFiles', { count: dragPaths.length })
                  : t('transferShelf.dragToExternal');
                const fileTitle = canExternalDrag
                  ? t('transferShelf.fileDragTitle', {
                    name: file.name,
                    action: dragAction,
                    hint: t('transferShelf.shiftMoveHint'),
                  })
                  : file.name;
                return (
                  <div
                    className={className}
                    key={file.path}
                    title={fileTitle}
                    onClick={(event) => {
                      if (!isBusy) selectFile(event, file.path);
                    }}
                    onMouseDown={canExternalDrag
                      ? (event) => {
                        const dragMode = event.shiftKey ? 'move' : 'copy';
                        const dragIcon = createDragPreviewIcon(
                          dragFiles.find((item) => item.icon)?.icon || '',
                          dragPaths.length,
                          dragMode,
                          {
                            copy: t('common.copy'),
                            move: t('transferShelf.move'),
                          },
                        ) || dragPaths[0];
                        handleExternalDragMouseDown(event, dragPaths, dragIcon, dragMode);
                      }
                      : undefined}
                  >
                    <span className="shelf-file__icon">
                      {!missing && file.icon ? (
                        <img src={file.icon} alt="" draggable={false} />
                      ) : (
                        <i className={`ti ${missing ? 'ti-file-off' : 'ti-file'}`} />
                      )}
                    </span>
                    <div className="shelf-file__meta">
                      <span className="shelf-file__name">{file.name}</span>
                      <span className="shelf-file__size">
                        {sizeLabel}
                        {failedCount > 0 && (
                          <span className="shelf-file__badge">
                            {t('transferShelf.failedBadge', { count: failedCount })}
                          </span>
                        )}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="shelf-icon-btn shelf-file__remove"
                      title={t('transferShelf.remove')}
                      disabled={isBusy}
                      onMouseDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        removeFile(file.path);
                      }}
                    >
                      <i className="ti ti-x" />
                    </button>
                    {progressVisible && (
                      <span
                        className="shelf-file__progress"
                        style={{ transform: `scaleX(${progressRatio})` }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <footer className="shelf-dock">
          <div className="shelf-dock__row">
            <button
              type="button"
              className="shelf-send"
              disabled={!canSend}
              onClick={sendFiles}
              title={sendTitle}
              aria-label={sendTitle}
            >
              <i className={`ti ${isBusy ? 'ti-loader-2 shelf-spin' : cloudSelected ? 'ti-cloud-up' : 'ti-send'}`} />
            </button>
            <button
              type="button"
              className="shelf-icon-btn"
              title={t('transferShelf.addFiles')}
              disabled={isBusy}
              onClick={selectFiles}
            >
              <i className="ti ti-plus" />
            </button>
            <button
              type="button"
              className="shelf-icon-btn is-danger"
              title={t('transferShelf.clear')}
              disabled={files.length === 0 || isBusy}
              onClick={clearFiles}
            >
              <i className="ti ti-trash" />
            </button>
            {(canRetry || canResetTransferState) && (
              <div className="shelf-status-actions">
                <button
                  type="button"
                  className="shelf-icon-btn"
                  title={canRetry
                    ? t('transferShelf.retryFailed', { count: failedTargets.length })
                    : t('transferShelf.resetStatus')}
                  onClick={canRetry ? retryFailed : resetTransferState}
                >
                  <i className={`ti ${canRetry ? 'ti-refresh' : 'ti-eraser'}`} />
                </button>
                {canRetry && canResetTransferState && (
                  <div className="shelf-status-actions__menu">
                    <button
                      type="button"
                      className="shelf-icon-btn"
                      title={t('transferShelf.resetStatus')}
                      onClick={resetTransferState}
                    >
                      <i className="ti ti-refresh-alert" />
                    </button>
                  </div>
                )}
              </div>
            )}
            <span className="shelf-dock__progress">
              {task.status === 'idle' && validSelectedFileCount > 0 && (
                t('transferShelf.selectedCount', { count: validSelectedFileCount })
              )}
              {task.status !== 'idle' && (
                isBusy
                  ? task.totalBytes > 0
                    ? `${formatSize(task.sentBytes)} / ${formatSize(task.totalBytes)}`
                    : `${task.done}/${task.total}`
                  : task.status === 'done'
                    ? t('transferShelf.done')
                    : t('transferShelf.failedProgress', { failed: task.failed, total: task.total })
              )}
            </span>
            <button
              type="button"
              className="shelf-icon-btn shelf-dock__toggle"
              title={peersCollapsed
                ? t('transferShelf.expandPeers', { count: peersCountLabel })
                : t('transferShelf.collapsePeers', { count: peersCountLabel })}
              onClick={togglePeersCollapsed}
            >
              <i className={`ti ${peersCollapsed ? 'ti-chevron-down' : 'ti-chevron-up'}`} />
            </button>
          </div>

          <div
            className={`shelf-peers ${peersCollapsed ? 'is-collapsed' : ''}`}
            aria-hidden={peersCollapsed}
            ref={peersWrapperRef}
          >
            <div className="shelf-peers__inner" ref={peersRef}>
              <button
                type="button"
                className={`shelf-peer shelf-peer--cloud ${cloudSelected ? 'is-selected' : ''}`}
                title={cloudEnabled ? t('transferShelf.cloudTarget') : t('transferShelf.cloudDisabled')}
                disabled={!cloudEnabled || isBusy}
                onClick={() => togglePeer(CLOUD_TARGET_ID)}
                tabIndex={peersCollapsed ? -1 : 0}
              >
                <span className="shelf-peer__icon">
                  <i className={`ti ${cloudSelected ? 'ti-check' : 'ti-cloud'}`} />
                </span>
                <span className="shelf-peer__name">{t('transferShelf.cloudTarget')}</span>
              </button>
              {peers.length === 0 ? (
                <div className="shelf-peers__empty">{t('transferShelf.noPeers')}</div>
              ) : (
                peers.map((peer) => {
                  const selected = selectedLanPeerIds.includes(peer.device_id);
                  const name = peer.device_name || peer.name || t('transferShelf.unnamedPeer');
                  return (
                    <button
                      type="button"
                      key={peer.device_id}
                      className={`shelf-peer ${selected ? 'is-selected' : ''}`}
                      title={name}
                      disabled={isBusy}
                      onClick={() => togglePeer(peer.device_id)}
                      tabIndex={peersCollapsed ? -1 : 0}
                    >
                      <span className="shelf-peer__icon">
                        <i className={`ti ${selected ? 'ti-check' : 'ti-device-desktop'}`} />
                      </span>
                      <span className="shelf-peer__name">{name}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {errorText && <div className="shelf-error" title={errorText}>{errorText}</div>}
        </footer>
      </section>
    </main>
  );
}
