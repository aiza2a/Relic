import { useEffect, useMemo, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useTranslation } from 'react-i18next';
import { showConfirm } from '@shared/utils/dialog';
import { createDragPreviewIcon } from '@shared/utils/dragPreviewIcon';
import { formatUserMessage } from '@shared/utils/userMessages';
import { initSettings } from '@shared/store/settingsStore';
import { useSettingsSync } from '@shared/hooks/useSettingsSync';
import { useTheme, applyThemeToBody } from '@shared/hooks/useTheme';
import { applyBackgroundImage, clearBackgroundImage } from '@shared/utils/backgroundManager';
import {
  addReceiveBoxFileToTransferShelf,
  deleteReceiveBoxCloudFile,
  deleteReceiveBoxLocalFile,
  describeTransferShelfPaths,
  downloadReceiveBoxCloudFile,
  listReceiveBoxCloudFiles,
  listReceiveBoxLanFiles,
  openReceiveBoxLocalFile,
  revealReceiveBoxLocalFile,
  routeDropProxyPathsAtCursor,
} from '@shared/api';
import { useDragWithThreshold } from '@shared/hooks/useDragWithThreshold';

const TAB_LAN = 'lan';
const TAB_CLOUD = 'cloud';
const LAN_FILES_CHANGED_EVENT = 'receive-box-lan-files-changed';
const LAN_FILE_PROGRESS_EVENT = 'receive-box-lan-file-progress';
const CLOUD_FILES_CHANGED_EVENT = 'receive-box-cloud-files-changed';

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

function formatDate(timestamp) {
  const value = Number(timestamp) || 0;
  if (value <= 0) return '';
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return '';
  }
}

function getCloudStatusLabel(status, t) {
  if (status === 'downloaded') return t('receiveBox.statusDownloaded');
  if (status === 'missing') return t('receiveBox.statusMissing');
  return t('receiveBox.statusNotDownloaded');
}

function normalizeLanProgress(payload) {
  const transferId = typeof payload?.transferId === 'string' ? payload.transferId : '';
  if (!transferId) return null;
  return {
    transferId,
    name: payload.name || 'file',
    receivedBytes: Number(payload.receivedBytes) || 0,
    totalBytes: Number(payload.totalBytes) || 0,
    sourceDeviceId: payload.sourceDeviceId || '',
    sourceDeviceName: payload.sourceDeviceName || '',
    status: payload.status || 'receiving',
  };
}

function toLanProgressFile(progress) {
  return {
    ...progress,
    isReceiving: true,
    path: progress.transferId,
    size: progress.totalBytes,
    receivedAt: 0,
    exists: false,
    icon: '',
  };
}

export default function App() {
  const { t } = useTranslation();
  const {
    theme,
    effectiveTheme,
    isDark,
    isBackground,
    backgroundImagePath,
    lightThemeStyle,
    darkThemeStyle,
  } = useTheme();
  const [activeTab, setActiveTab] = useState(TAB_LAN);
  const [lanFiles, setLanFiles] = useState([]);
  const [lanProgresses, setLanProgresses] = useState({});
  const [cloudFiles, setCloudFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [downloadingIds, setDownloadingIds] = useState([]);
  const [operatingKeys, setOperatingKeys] = useState([]);
  const [errorText, setErrorText] = useState('');

  useSettingsSync();

  useEffect(() => {
    applyThemeToBody(theme, 'receive-box');
  }, [theme, lightThemeStyle, darkThemeStyle, effectiveTheme]);

  useEffect(() => {
    if (isBackground && backgroundImagePath) {
      applyBackgroundImage({
        containerSelector: '.receive-shell',
        backgroundImagePath,
        windowName: 'receive-box',
      });
      return () => clearBackgroundImage('.receive-shell');
    }

    clearBackgroundImage('.receive-shell');
    return undefined;
  }, [isBackground, backgroundImagePath]);

  const downloadInProgress = downloadingIds.length > 0;
  const operationInProgress = operatingKeys.length > 0;
  const refreshDisabled = loading || downloadInProgress;
  const lanProgressItems = useMemo(
    () => Object.values(lanProgresses)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(toLanProgressFile),
    [lanProgresses],
  );
  const receivingLanCount = lanProgressItems.filter((file) => file.status !== 'failed').length;
  const currentFiles = activeTab === TAB_LAN ? [...lanProgressItems, ...lanFiles] : cloudFiles;
  const formatError = (error, fallbackKey = 'errors.operationFailed') => formatUserMessage(error, t, fallbackKey);
  const emptyText = activeTab === TAB_LAN
    ? t('receiveBox.noLanFiles')
    : t('receiveBox.noCloudFiles');

  const statusText = useMemo(() => {
    if (loading) return t('receiveBox.refreshing');
    if (downloadInProgress) return t('receiveBox.downloading');
    if (activeTab === TAB_LAN && receivingLanCount > 0) {
      return t('receiveBox.receivingLan', { count: receivingLanCount });
    }
    if (activeTab === TAB_LAN) return t('receiveBox.lanCount', { count: lanFiles.length });
    return t('receiveBox.cloudCount', { count: cloudFiles.length });
  }, [activeTab, cloudFiles.length, downloadInProgress, lanFiles.length, loading, receivingLanCount, t]);

  const refresh = async (tab = activeTab) => {
    if (downloadInProgress) return;
    setLoading(true);
    setErrorText('');
    try {
      if (tab === TAB_LAN) {
        const result = await listReceiveBoxLanFiles();
        setLanFiles(Array.isArray(result) ? result : []);
      } else {
        const result = await listReceiveBoxCloudFiles();
        setCloudFiles(Array.isArray(result) ? result : []);
      }
    } catch (error) {
      setErrorText(formatError(
        error,
        tab === TAB_LAN ? 'errors.receiveBox.listLanFailed' : 'errors.webdav.operationFailed',
      ));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initSettings().catch(() => { });
    refresh(TAB_LAN);
  }, []);

  useEffect(() => {
    let unlistenLan = null;
    let unlistenLanProgress = null;
    let unlistenCloud = null;
    const refreshChangedTab = (tab) => {
      if (downloadInProgress || activeTab !== tab) return;
      refresh(tab);
    };

    listen(LAN_FILES_CHANGED_EVENT, () => refreshChangedTab(TAB_LAN)).then((fn) => {
      unlistenLan = fn;
    });
    listen(LAN_FILE_PROGRESS_EVENT, (event) => {
      const progress = normalizeLanProgress(event.payload);
      if (!progress) return;

      if (progress.status === 'done') {
        setLanProgresses((current) => {
          const next = { ...current };
          delete next[progress.transferId];
          return next;
        });
        refreshChangedTab(TAB_LAN);
        return;
      }

      setLanProgresses((current) => {
        const previous = current[progress.transferId];
        return {
          ...current,
          [progress.transferId]: {
            ...previous,
            ...progress,
            receivedBytes: Math.max(Number(previous?.receivedBytes) || 0, progress.receivedBytes),
          },
        };
      });

      if (progress.status === 'failed') {
        window.setTimeout(() => {
          setLanProgresses((current) => {
            const next = { ...current };
            delete next[progress.transferId];
            return next;
          });
        }, 1800);
      }
    }).then((fn) => {
      unlistenLanProgress = fn;
    });
    listen(CLOUD_FILES_CHANGED_EVENT, () => refreshChangedTab(TAB_CLOUD)).then((fn) => {
      unlistenCloud = fn;
    });

    return () => {
      if (unlistenLan) unlistenLan();
      if (unlistenLanProgress) unlistenLanProgress();
      if (unlistenCloud) unlistenCloud();
    };
  }, [activeTab, downloadInProgress]);

  const switchTab = (tab) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    if (!downloadInProgress) {
      refresh(tab);
    }
  };

  const handleDownloadCloudFile = async (file) => {
    if (!file?.id || loading || downloadInProgress || operationInProgress) return;
    setDownloadingIds([file.id]);
    setErrorText('');
    try {
      const result = await downloadReceiveBoxCloudFile(file.id);
      if (result?.id) {
        setCloudFiles((current) => current.map((item) => (
          item.id === result.id ? result : item
        )));
      }
    } catch (error) {
      setErrorText(formatError(error, 'errors.webdav.operationFailed'));
    } finally {
      setDownloadingIds([]);
    }
  };

  const runFileOperation = async (key, operation) => {
    if (!key || loading || downloadInProgress || operationInProgress) return false;
    setOperatingKeys([key]);
    setErrorText('');
    try {
      await operation();
      return true;
    } catch (error) {
      setErrorText(formatError(error, 'errors.operationFailed'));
      return false;
    } finally {
      setOperatingKeys([]);
    }
  };

  const handleOpenLocalFile = async (file, isCloud) => {
    const path = isCloud ? file.localPath : file.path;
    if (!path) return;
    await runFileOperation(isCloud ? `cloud:${file.id}` : `lan:${file.path}`, () => openReceiveBoxLocalFile(path));
  };

  const handleRevealLocalFile = async (file, isCloud) => {
    const path = isCloud ? file.localPath : file.path;
    if (!path) return;
    await runFileOperation(isCloud ? `cloud:${file.id}` : `lan:${file.path}`, () => revealReceiveBoxLocalFile(path));
  };

  const handleAddToTransferShelf = async (file, isCloud) => {
    const path = isCloud ? file.localPath : file.path;
    if (!path) return;
    await runFileOperation(isCloud ? `cloud:${file.id}` : `lan:${file.path}`, () => addReceiveBoxFileToTransferShelf(path));
  };

  const handleDeleteLocalFile = async (file, isCloud) => {
    const path = isCloud ? file.localPath : file.path;
    if (!path) return;
    const confirmed = await showConfirm(
      t('receiveBox.confirmDeleteLocalMessage', { name: file.name }),
      t('receiveBox.confirmDeleteLocalTitle'),
    );
    if (!confirmed) return;
    const done = await runFileOperation(
      isCloud ? `cloud:${file.id}` : `lan:${file.path}`,
      () => deleteReceiveBoxLocalFile(path),
    );
    if (!done) return;
    if (isCloud) {
      setCloudFiles((current) => current.map((item) => (
        item.id === file.id ? { ...item, localStatus: 'missing' } : item
      )));
    } else {
      setLanFiles((current) => current.filter((item) => item.path !== file.path));
    }
  };

  const handleDeleteCloudFile = async (file) => {
    if (!file?.id) return;
    const confirmed = await showConfirm(
      t('receiveBox.confirmDeleteCloudMessage', { name: file.name }),
      t('receiveBox.confirmDeleteCloudTitle'),
    );
    if (!confirmed) return;
    const done = await runFileOperation(`cloud:${file.id}`, () => deleteReceiveBoxCloudFile(file.id));
    if (done) {
      setCloudFiles((current) => current.filter((item) => item.id !== file.id));
    }
  };

  const handleExternalDragMouseDown = useDragWithThreshold({
    onDragEnd: async ({ paths, mode, result, cursorPos }) => {
      try {
        if (Array.isArray(paths) && paths.length > 0 && cursorPos) {
          try {
            const routeResult = await routeDropProxyPathsAtCursor(paths, cursorPos);
            if (routeResult?.routed) return;
          } catch {
            // 路由到文件盒失败时继续按普通外部拖拽结果处理
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
            // 无法判断落点时继续按插件结果处理
          }
        }

        await new Promise((resolve) => window.setTimeout(resolve, 500));
        const infos = await describeTransferShelfPaths(paths);
        const movedPaths = Array.isArray(infos)
          ? infos.filter((info) => info && info.exists === false).map((info) => info.path)
          : [];
        if (movedPaths.length === 0) return;

        const movedSet = new Set(movedPaths);
        const movedLanPaths = lanFiles
          .filter((file) => movedSet.has(file.path))
          .map((file) => file.path);
        if (movedLanPaths.length > 0) {
          await Promise.allSettled(movedLanPaths.map((path) => deleteReceiveBoxLocalFile(path)));
        }
        setLanFiles((current) => current.filter((file) => !movedSet.has(file.path)));
        setCloudFiles((current) => current.map((file) => (
          file.localPath && movedSet.has(file.localPath)
            ? { ...file, localStatus: 'missing' }
            : file
        )));
      } catch (error) {
        setErrorText(formatError(error, 'errors.operationFailed'));
      }
    },
  });

  const handleStartDrag = async (event) => {
    if (event.button !== 0) return;
    if (event.target.closest('button, [data-no-window-drag]')) return;
    event.preventDefault();
    try {
      await getCurrentWindow().startDragging();
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

  const handleClose = async () => {
    try {
      await getCurrentWindow().close();
    } catch {
      // ignore
    }
  };

  return (
    <main
      className={['receive-root', isDark ? 'dark' : '', isBackground ? 'is-background-theme' : ''].filter(Boolean).join(' ')}
      onPointerDown={handleStartDrag}
    >
      <section className="receive-shell">
        <header className="receive-header">
          <span className="receive-header__title">{t('receiveBox.title')}</span>
          <div className="receive-header__actions" onPointerDown={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="receive-icon-btn"
              title={downloadInProgress ? t('receiveBox.refreshDisabledDuringDownload') : t('common.refresh')}
              disabled={refreshDisabled}
              onClick={() => refresh()}
            >
              <i className={`ti ${loading ? 'ti-loader-2 receive-spin' : 'ti-refresh'}`} />
            </button>
            <button type="button" className="receive-icon-btn" title={t('common.minimize')} onClick={handleMinimize}>
              <i className="ti ti-minus" />
            </button>
            <button type="button" className="receive-icon-btn is-danger" title={t('common.close')} onClick={handleClose}>
              <i className="ti ti-x" />
            </button>
          </div>
        </header>

        <div className="receive-tabs" onPointerDown={(event) => event.stopPropagation()}>
          <button
            type="button"
            className={`receive-tab ${activeTab === TAB_LAN ? 'is-active' : ''}`}
            onClick={() => switchTab(TAB_LAN)}
          >
            {t('receiveBox.lanFiles')}
          </button>
          <button
            type="button"
            className={`receive-tab ${activeTab === TAB_CLOUD ? 'is-active' : ''}`}
            onClick={() => switchTab(TAB_CLOUD)}
          >
            {t('receiveBox.cloudFiles')}
          </button>
        </div>

        <section className="receive-list" data-no-window-drag>
          {currentFiles.length === 0 ? (
            <div className="receive-empty">
              <span className="receive-empty__icon">
                <i className={`ti ${activeTab === TAB_LAN ? 'ti-inbox' : 'ti-cloud'}`} />
              </span>
              <span>{emptyText}</span>
            </div>
          ) : (
            currentFiles.map((file) => {
              const isCloud = activeTab === TAB_CLOUD;
              const isReceiving = !isCloud && file.isReceiving;
              const cloudStatus = file.localStatus || 'notDownloaded';
              const rowKey = isReceiving
                ? `receiving:${file.transferId}`
                : isCloud ? `cloud:${file.id}` : `lan:${file.path}`;
              const isDownloading = isCloud && downloadingIds.includes(file.id);
              const isOperating = operatingKeys.includes(rowKey);
              const actionLocked = loading || downloadInProgress || operationInProgress;
              const hasLocalFile = !isReceiving && (isCloud
                ? cloudStatus === 'downloaded' && Boolean(file.localPath)
                : Boolean(file.path) && file.exists !== false);
              const canDownload = isCloud
                && (cloudStatus === 'notDownloaded' || cloudStatus === 'missing')
                && !loading
                && !downloadInProgress;
              const detailParts = isReceiving
                ? [`${formatSize(file.receivedBytes)} / ${formatSize(file.totalBytes)}`]
                : [formatSize(file.size)];
              if (!isCloud && !isReceiving && file.receivedAt) detailParts.push(formatDate(file.receivedAt));
              if (isCloud && file.uploadedAt) detailParts.push(formatDate(file.uploadedAt));
              if (!isCloud) {
                detailParts.push(t('receiveBox.sourceDevice', {
                  name: file.sourceDeviceName || file.sourceDeviceId || t('receiveBox.unknownDevice'),
                }));
              }
              if (isCloud && file.sourceDeviceName) {
                detailParts.push(t('receiveBox.sourceDevice', { name: file.sourceDeviceName }));
              }
              const iconName = isReceiving
                ? file.status === 'failed' ? 'ti-alert-circle' : 'ti-loader-2 receive-spin'
                : activeTab === TAB_LAN
                  ? file.exists === false ? 'ti-file-off' : 'ti-file'
                : isDownloading
                  ? 'ti-loader-2 receive-spin'
                  : cloudStatus === 'downloaded'
                    ? 'ti-file-check'
                    : cloudStatus === 'missing'
                      ? 'ti-file-off'
                      : 'ti-cloud';
              const actionTitle = cloudStatus === 'downloaded'
                ? t('receiveBox.statusDownloaded')
                : isDownloading
                  ? t('receiveBox.statusDownloading')
                  : t('receiveBox.download');
              const canExternalDrag = hasLocalFile && !actionLocked;
              const dragPath = isCloud ? file.localPath : file.path;
              const fileIcon = hasLocalFile && file.icon ? file.icon : '';
              const progressRatio = isReceiving && file.totalBytes > 0
                ? Math.min(1, Math.max(0, file.receivedBytes / file.totalBytes))
                : 0;
              return (
                <article
                  className={[
                    'receive-file',
                    canExternalDrag ? 'is-draggable' : '',
                    isReceiving ? 'is-receiving has-progress' : '',
                    isReceiving && file.status === 'failed' ? 'is-progress-failed' : '',
                    isCloud ? `is-cloud-${cloudStatus}` : '',
                    isDownloading ? 'is-downloading' : '',
                  ].filter(Boolean).join(' ')}
                  key={rowKey}
                  title={file.name}
                  onMouseDown={canExternalDrag
                    ? (event) => {
                      if (event.target.closest('button')) return;
                      const dragMode = event.shiftKey ? 'move' : 'copy';
                      const dragIcon = createDragPreviewIcon(fileIcon, 1, dragMode, {
                        copy: t('common.copy'),
                        move: t('transferShelf.move'),
                      }) || dragPath;
                      handleExternalDragMouseDown(event, [dragPath], dragIcon, dragMode);
                    }
                    : undefined}
                >
                  <span className="receive-file__icon">
                    {fileIcon ? (
                      <img src={fileIcon} alt="" draggable={false} />
                    ) : (
                      <i className={`ti ${iconName}`} />
                    )}
                  </span>
                  <div className="receive-file__meta">
                    <span className="receive-file__name">{file.name}</span>
                    <span className="receive-file__detail">
                      <span className="receive-file__detail-text">{detailParts.filter(Boolean).join(' · ')}</span>
                      {isCloud && (
                        <span className={`receive-file__status is-${cloudStatus}`}>
                          {isDownloading ? t('receiveBox.statusDownloading') : getCloudStatusLabel(cloudStatus, t)}
                        </span>
                      )}
                      {isReceiving && (
                        <span className={`receive-file__status is-${file.status === 'failed' ? 'failed' : 'receiving'}`}>
                          {file.status === 'failed' ? t('receiveBox.statusReceiveFailed') : t('receiveBox.statusReceiving')}
                        </span>
                      )}
                      {!isCloud && !isReceiving && file.exists === false && (
                        <span className="receive-file__status is-missing">
                          {t('receiveBox.statusMissing')}
                        </span>
                      )}
                    </span>
                  </div>
                  {isCloud && (
                    <div
                      className="receive-file__actions"
                      onPointerDown={(event) => event.stopPropagation()}
                      onMouseDown={(event) => event.stopPropagation()}
                    >
                      {hasLocalFile && (
                        <>
                          <button
                            type="button"
                            className="receive-icon-btn receive-file__action"
                            title={t('receiveBox.open')}
                            disabled={actionLocked}
                            onClick={() => handleOpenLocalFile(file, true)}
                          >
                            <i className={`ti ${isOperating ? 'ti-loader-2 receive-spin' : 'ti-external-link'}`} />
                          </button>
                          <button
                            type="button"
                            className="receive-icon-btn receive-file__action"
                            title={t('receiveBox.addToTransferShelf')}
                            disabled={actionLocked}
                            onClick={() => handleAddToTransferShelf(file, true)}
                          >
                            <i className="ti ti-package-import" />
                          </button>
                          <button
                            type="button"
                            className="receive-icon-btn receive-file__action"
                            title={t('receiveBox.reveal')}
                            disabled={actionLocked}
                            onClick={() => handleRevealLocalFile(file, true)}
                          >
                            <i className="ti ti-folder-open" />
                          </button>
                          <button
                            type="button"
                            className="receive-icon-btn receive-file__action is-danger"
                            title={t('receiveBox.deleteLocal')}
                            disabled={actionLocked}
                            onClick={() => handleDeleteLocalFile(file, true)}
                          >
                            <i className="ti ti-trash" />
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        className="receive-icon-btn receive-file__action"
                        title={actionTitle}
                        disabled={!canDownload || actionLocked}
                        onClick={() => handleDownloadCloudFile(file)}
                      >
                        <i className={`ti ${isDownloading ? 'ti-loader-2 receive-spin' : cloudStatus === 'downloaded' ? 'ti-check' : 'ti-download'}`} />
                      </button>
                      <button
                        type="button"
                        className="receive-icon-btn receive-file__action is-danger"
                        title={t('receiveBox.deleteCloud')}
                        disabled={actionLocked}
                        onClick={() => handleDeleteCloudFile(file)}
                      >
                        <i className="ti ti-cloud-x" />
                      </button>
                    </div>
                  )}
                  {!isCloud && !isReceiving && (
                    <div
                      className="receive-file__actions"
                      onPointerDown={(event) => event.stopPropagation()}
                      onMouseDown={(event) => event.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="receive-icon-btn receive-file__action"
                        title={t('receiveBox.open')}
                        disabled={!hasLocalFile || actionLocked}
                        onClick={() => handleOpenLocalFile(file, false)}
                      >
                        <i className={`ti ${isOperating ? 'ti-loader-2 receive-spin' : 'ti-external-link'}`} />
                      </button>
                      <button
                        type="button"
                        className="receive-icon-btn receive-file__action"
                        title={t('receiveBox.addToTransferShelf')}
                        disabled={!hasLocalFile || actionLocked}
                        onClick={() => handleAddToTransferShelf(file, false)}
                      >
                        <i className="ti ti-package-import" />
                      </button>
                      <button
                        type="button"
                        className="receive-icon-btn receive-file__action"
                        title={t('receiveBox.reveal')}
                        disabled={!hasLocalFile || actionLocked}
                        onClick={() => handleRevealLocalFile(file, false)}
                      >
                        <i className="ti ti-folder-open" />
                      </button>
                      <button
                        type="button"
                        className="receive-icon-btn receive-file__action is-danger"
                        title={t('receiveBox.deleteLocal')}
                        disabled={actionLocked}
                        onClick={() => handleDeleteLocalFile(file, false)}
                      >
                        <i className="ti ti-trash" />
                      </button>
                    </div>
                  )}
                  {isReceiving && (
                    <span
                      className="receive-file__progress"
                      style={{ transform: `scaleX(${progressRatio})` }}
                    />
                  )}
                </article>
              );
            })
          )}
        </section>

        <footer className="receive-footer">
          <span>{statusText}</span>
        </footer>
        {errorText && <div className="receive-error" title={errorText}>{errorText}</div>}
      </section>
    </main>
  );
}
