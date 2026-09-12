import '@tabler/icons-webfont/dist/tabler-icons.min.css'
import 'uno.css';
import '@unocss/reset/tailwind.css';
import { listen, emit } from '@tauri-apps/api/event'
import { relaunch, exit } from '@tauri-apps/plugin-process'
import { check } from '@tauri-apps/plugin-updater'
import { getVersion } from '@tauri-apps/api/app'
import React, { useEffect, useState, useRef, useCallback } from 'react'
import { createRoot } from 'react-dom/client'
import { openUrl } from '@tauri-apps/plugin-opener'
import '@shared/i18n';
import { useTranslation } from 'react-i18next'
import '@shared/styles/index.css'
import '@shared/styles/theme-background.css'
import { initStores } from '@shared/store'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import logoIcon from '@/assets/icon1024.png';
import appLinks from '@shared/config/appLinks.json';
function App() {
  const { t, i18n } = useTranslation()
  const [forceUpdate, setForceUpdate] = useState(false)
  const [isPortable, setIsPortable] = useState(false)
  const [status, setStatus] = useState('checking')
  const [progress, setProgress] = useState({ downloaded: 0, total: 0 })
  const [message, setMessage] = useState(t('updater.checking', { defaultValue: '正在检查更新...' }))
  const [versionInfo, setVersionInfo] = useState(null)
  const [currentVersion, setCurrentVersion] = useState('')
  
  const updateInstanceRef = useRef(null)
  const configReceivedRef = useRef(false)

  useEffect(() => {
    const init = async () => {
      try {
        const version = await getVersion()
        setCurrentVersion(version)
      } catch (e) {
        console.error('无法获取当前版本：', e)
      }
      try {
        const update = await check()
        if (update) {
          updateInstanceRef.current = update
        }
      } catch (e) {
        console.error('检查更新失败：', e)
      }
    }
    init()
  }, [])

  useEffect(() => {
    const unlisten = listen('update-config', async (e) => {
      if (configReceivedRef.current) return
      configReceivedRef.current = true
      
      try {
        const cfg = e?.payload || {}
        const isForceUpdate = typeof cfg.forceUpdate === 'boolean' ? cfg.forceUpdate : false
        const portable = typeof cfg.isPortable === 'boolean' ? cfg.isPortable : false
        setForceUpdate(isForceUpdate)
        setIsPortable(portable)
        const v = cfg.version || null
        setVersionInfo(v ? { version: v, date: undefined } : null)
        setStatus('available')
        
        if (isForceUpdate && !portable) {
          const waitForUpdate = async () => {
            for (let i = 0; i < 20; i++) {
              if (updateInstanceRef.current) {
                await startDownloadInternal(updateInstanceRef.current)
                return
              }
              await new Promise(r => setTimeout(r, 200))
            }
            const update = await check()
            if (update) {
              updateInstanceRef.current = update
              await startDownloadInternal(update)
            }
          }
          waitForUpdate()
        }
      } catch (_) {}
    })
    emit('updater-ready').catch(() => {})
    return () => { unlisten.then(f => f()).catch(() => {}) }
  }, [])

  useEffect(() => {
    switch (status) {
      case 'checking':
        setMessage(t('updater.checking', { defaultValue: '正在检查更新...' }))
        break
      case 'none':
        setMessage(t('updater.noUpdate', { defaultValue: '当前已是最新版本' }))
        break
      case 'downloading':
        setMessage('')
        break
      case 'installed':
        setMessage(t('updater.installedRestarting', { defaultValue: '更新已安装，正在重启...' }))
        break
      case 'available':
        setMessage('')
        break
      default:
        break
    }
  }, [i18n.language, status, versionInfo?.version])

  async function startDownloadInternal(update) {
    try {
      setStatus('downloading')
      let downloaded = 0
      let total = 0
      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            total = event.data.contentLength || 0
            setProgress({ downloaded, total })
            break
          case 'Progress':
            downloaded += event.data.chunkLength || 0
            setProgress({ downloaded, total })
            break
          case 'Finished':
            setProgress({ downloaded: total, total })
            break
          default:
            break
        }
      })
      setStatus('installed')
      setMessage(t('updater.installedRestarting', { defaultValue: '更新已安装，正在重启...' }))
      await relaunch()
    } catch (e) {
      setStatus('error')
      setMessage(t('updater.downloadFailed', { defaultValue: '下载或安装失败' }))
    }
  }

  async function startDownload() {
    try {
      let update = updateInstanceRef.current
      if (!update) {
        update = await check()
        if (update) {
          updateInstanceRef.current = update
        }
      }
      if (!update) {
        setStatus('none')
        setMessage(t('updater.noUpdateShort', { defaultValue: '未发现新版本' }))
        return
      }
      await startDownloadInternal(update)
    } catch (e) {
      setStatus('error')
      setMessage(t('updater.downloadFailed', { defaultValue: '下载或安装失败' }))
    }
  }

  const handleClose = useCallback(async () => {
    if (forceUpdate) {
      await exit(0)
    } else {
      const w = getCurrentWebviewWindow()
      try { await w.close() } catch (_) {}
    }
  }, [forceUpdate])

  const handleViewChangelog = useCallback(async () => {
    try {
      await openUrl(appLinks.changelog)
    } catch (_) {}
  }, [])

  const pct = progress.total > 0 ? Math.min(100, Math.round(progress.downloaded * 100 / progress.total)) : 0

  return (
    <div className="h-full w-full bg-qc-surface/90 border border-qc-border text-qc-fg p-2 flex flex-col rounded-lg overflow-hidden" style={{ boxShadow: '0 0 5px 1px rgba(0, 0, 0, 0.3), 0 0 3px 0 rgba(0, 0, 0, 0.2)'}} data-tauri-drag-region>
      <style>{`
        @keyframes qc-updater-marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .qc-updater-marquee-track {
          animation: qc-updater-marquee 12s linear infinite;
        }
      `}</style>
      <div className="flex items-center justify-between shrink-0" data-tauri-drag-region>
        <div className="text-sm font-semibold flex items-center gap-2" data-tauri-drag-region>
          <img className="w-4 h-4" src={logoIcon} alt="" /> {t('updater.title', { defaultValue: '应用更新' })}        </div>

        <div className="flex-1 min-w-0 px-2" data-tauri-drag-region>
          {isPortable && status === 'available' ? (
            <div className="w-full overflow-hidden" data-tauri-drag-region>
              <div className="qc-updater-marquee-track text-xs text-amber-800 whitespace-nowrap" data-tauri-drag-region>
                {t('updater.portableNotice', { defaultValue: '便携版提示' })}：{t('updater.portableNoAutoUpdate', { defaultValue: '便携版/绿色版不支持自动更新，请手动下载新版本替换当前文件。' })}
              </div>
            </div>
          ) : null}
        </div>

        <button onClick={handleViewChangelog} className="text-xs text-blue-600 hover:underline" type="button">
          {t('updater.viewChangelog', { defaultValue: '查看更新日志' })}
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto mt-2 pr-1" data-tauri-drag-region>
        {status === 'checking' ? (
          <div className="min-h-24 flex flex-col items-center justify-center gap-2" data-tauri-drag-region>
            <i className="ti ti-loader-2 animate-spin text-3xl" />
            <div className="text-sm opacity-90">{t('updater.checking', { defaultValue: '正在检查更新...' })}</div>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5" data-tauri-drag-region>
            {status === 'error' ? null : (message ? (
              <div className="text-sm opacity-90">{message}</div>
            ) : null)}

            {versionInfo && (status === 'available' || status === 'downloading' || status === 'error') && (
              <div className="text-xs opacity-90 flex items-center gap-2 flex-wrap" data-tauri-drag-region>
                <div className="px-2 py-0.5 rounded-full bg-qc-panel">
                  <span className="font-medium">{currentVersion || '--'}</span>
                </div>
                <i className="ti ti-arrow-right text-qc-fg-subtle" />
                <div className="px-2 py-0.5 rounded-full bg-green-50 text-green-700">
                  <span className="font-semibold">{versionInfo.version || '--'}</span>
                </div>
              </div>
            )}

            {status === 'error' && (
              <div className="w-full p-2 bg-red-50 rounded-md border border-red-200" data-tauri-drag-region>
                <div className="flex items-center gap-2 text-red-700" data-tauri-drag-region>
                  <i className="ti ti-alert-circle" />
                  <span className="text-xs font-medium">{t('updater.updateFailed', { defaultValue: '更新失败' })}</span>
                </div>
                <div className="text-xs mt-1 text-red-600" data-tauri-drag-region>
                  {message}
                </div>
                <a 
                  className="text-xs mt-2 inline-block text-blue-600 hover:underline" 
                  href={appLinks.releasesLatest} 
                  target="_blank" 
                  rel="noreferrer"
                >
                  {t('updater.manualDownload', { defaultValue: '手动下载' })}
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      <div className={`shrink-0 relative pt-2 mt-2 ${status === 'downloading' ? '' : 'border-t border-qc-border'}`} data-tauri-drag-region>
        {status === 'downloading' && (
          <div className="absolute left-0 right-0 top-0 h-0.5 bg-qc-border" data-tauri-drag-region>
            <div className="h-0.5 bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
        )}
        <div className="flex gap-2 flex-wrap" data-tauri-drag-region>
          {status === 'available' && (
            <>
              {isPortable ? (
                <a 
                  href={appLinks.releasesLatest} 
                  target="_blank" 
                  rel="noreferrer"
                  className="px-3 py-2 rounded bg-blue-600 text-white text-sm flex items-center gap-2 no-underline"
                >
                  <i className="ti ti-external-link" /> {t('updater.manualDownload', { defaultValue: '手动下载' })}
                </a>
              ) : (
                <button onClick={() => startDownload()} className="px-3 py-2 rounded bg-blue-600 text-white text-sm flex items-center gap-2">
                  <i className="ti ti-download" /> {t('updater.downloadAndInstall', { defaultValue: '下载并安装' })}
                </button>
              )}
              <button onClick={handleClose} className="px-3 py-2 rounded bg-qc-panel hover:bg-qc-hover text-sm">
                {t('updater.later', { defaultValue: '稍后' })}
              </button>
            </>
          )}
          {status === 'downloading' && !forceUpdate && (
            <button
              onClick={async () => {
                const w = getCurrentWebviewWindow();
                try { await w.hide(); } catch (_) {}
              }}
              className="px-3 py-2 rounded bg-qc-panel hover:bg-qc-hover text-sm"
            >
              {t('updater.backgroundUpdate', { defaultValue: '后台更新' })}
            </button>
          )}
          {status === 'error' && (
            <>
              <button onClick={() => startDownload()} className="px-3 py-2 rounded bg-blue-600 text-white text-sm flex items-center gap-2">
                <i className="ti ti-refresh" /> {t('updater.retry', { defaultValue: '重试' })}
              </button>
              <button onClick={handleClose} className="px-3 py-2 rounded bg-qc-panel hover:bg-qc-hover text-sm flex items-center gap-2">
                {forceUpdate ? (
                  <><i className="ti ti-power" /> {t('updater.exitApp', { defaultValue: '退出程序' })}</>
                ) : (
                  <>{t('common.close', { defaultValue: '关闭' })}</>
                )}
              </button>
            </>
          )}
          {status === 'none' && (
            <button onClick={handleClose} className="px-3 py-2 rounded bg-qc-panel hover:bg-qc-hover text-sm">
              {t('common.close', { defaultValue: '关闭' })}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

initStores().then(() => {
  createRoot(document.getElementById('root')).render(<App />)
})
