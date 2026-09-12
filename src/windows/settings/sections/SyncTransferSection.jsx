import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listen } from '@tauri-apps/api/event';
import SettingsSection from '../components/SettingsSection';
import SettingItem from '../components/SettingItem';
import Button from '@shared/components/ui/Button';
import Input from '@shared/components/ui/Input';
import Toggle from '@shared/components/ui/Toggle';
import SegmentedControl from '@shared/components/ui/SegmentedControl';
import Tooltip from '@shared/components/common/Tooltip.jsx';
import {
  discoverSyncTransferLanPeers,
  fetchSyncTransferLanPeerSnapshot,
  getSyncTransferLanAutoSyncStatus,
  getSyncTransferLanStatus,
  getSyncTransferLanLocalSnapshot,
  getSyncTransferModeInfos,
  listSyncTransferLanPairedPeers,
  pairSyncTransferLanPeer,
  pushSyncTransferLanPeer,
  refreshSyncTransferLanPairingCode,
  removeSyncTransferLanPairedPeer,
  updateSyncTransferLanAutoSyncSettings,
} from '@shared/api/syncTransfer';
import { toast } from '@shared/store/toastStore';
import WebdavSection from './WebdavSection';
import { formatUserMessage } from '@shared/utils/userMessages';

function SyncTransferSection({ settings, onSettingChange }) {
  const { t } = useTranslation();
  const [activeMode, setActiveMode] = useState(settings.syncTransferActiveMode === 'lan' ? 'lan' : 'webdav');
  const [modeInfos, setModeInfos] = useState([]);
  const [lanStatus, setLanStatus] = useState(null);
  const [pairedPeers, setPairedPeers] = useState([]);
  const [lanBusy, setLanBusy] = useState('');
  const [lastActionReport, setLastActionReport] = useState(null);
  const [localSnapshot, setLocalSnapshot] = useState(null);
  const [autoSyncStatus, setAutoSyncStatus] = useState(null);
  const [discoveredPeers, setDiscoveredPeers] = useState([]);
  const [peerBaseUrl, setPeerBaseUrl] = useState('');
  const [peerPairingCode, setPeerPairingCode] = useState('');
  const [pairingCodeVisible, setPairingCodeVisible] = useState(true);
  const lanError = (error) => formatUserMessage(error, t, 'errors.lan.connectFailed');

  useEffect(() => {
    let mounted = true;
    getSyncTransferModeInfos()
      .then(items => {
        if (mounted && Array.isArray(items)) setModeInfos(items);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const savedMode = settings.syncTransferActiveMode === 'lan' ? 'lan' : 'webdav';
    setActiveMode(current => (current === savedMode ? current : savedMode));
  }, [settings.syncTransferActiveMode]);

  const loadLanState = async () => {
    const [status, peers, snapshot] = await Promise.all([
      getSyncTransferLanStatus(),
      listSyncTransferLanPairedPeers(),
      getSyncTransferLanLocalSnapshot(),
    ]);
    setLanStatus(status);
    setPairedPeers(Array.isArray(peers) ? peers : []);
    setLocalSnapshot(snapshot);
    try {
      setAutoSyncStatus(await getSyncTransferLanAutoSyncStatus());
    } catch {
      setAutoSyncStatus(null);
    }
  };

  useEffect(() => {
    if (activeMode !== 'lan') return;
    loadLanState().catch(e => {
      toast.error(lanError(e), { duration: 5000 });
    });
  }, [activeMode]);

  useEffect(() => {
    if (activeMode !== 'lan') return;
    const expiresAtMs = Number(lanStatus?.pairing_code?.expires_at_ms || 0);
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= 0) return;
    const delayMs = Math.max(1000, expiresAtMs - Date.now() + 300);
    const timer = window.setTimeout(() => {
      loadLanState().catch(() => {});
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [activeMode, lanStatus?.pairing_code?.expires_at_ms]);

  useEffect(() => {
    if (activeMode !== 'lan') return;
    let disposed = false;
    let unlisten = null;
    listen('sync-transfer-lan-peers-changed', () => {
      if (!disposed) {
        loadLanState().catch(() => {});
      }
    }).then(fn => {
      unlisten = fn;
      if (disposed) fn();
    });
    return () => {
      disposed = true;
      if (unlisten) unlisten();
    };
  }, [activeMode]);

  useEffect(() => {
    if (activeMode !== 'lan') return;
    let cancelled = false;
    const discover = async () => {
      try {
        const peers = await discoverSyncTransferLanPeers(900);
        if (!cancelled) {
          setDiscoveredPeers(Array.isArray(peers) ? peers : []);
        }
      } catch {
        if (!cancelled) {
          setDiscoveredPeers([]);
        }
      }
    };
    discover();
    const timer = window.setInterval(discover, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeMode]);

  const runLanAction = async (actionId, action) => {
    try {
      setLanBusy(actionId);
      await action();
      await loadLanState();
    } catch (e) {
      toast.error(lanError(e), { duration: 5000 });
    } finally {
      setLanBusy('');
    }
  };

  const recordReport = (kind, deviceId, payload) => {
    setLastActionReport({ kind, deviceId, payload, time: Date.now() });
  };

  const modes = [
    { value: 'webdav', label: t('settings.syncTransfer.modes.webdav') },
    { value: 'lan', label: t('settings.syncTransfer.modes.lan') },
  ];
  const modeInfoById = new Map(modeInfos.map(info => [info.mode, info]));
  const modeOptions = modes.map(mode => {
    const info = modeInfoById.get(mode.value);
    const available = info?.available !== false;
    return {
      value: mode.value,
      label: available ? mode.label : `${mode.label} (${t('settings.syncTransfer.pending')})`,
    };
  });
  const handleModeChange = async mode => {
    const nextMode = mode === 'lan' ? 'lan' : 'webdav';
    setActiveMode(nextMode);
    if (settings.syncTransferActiveMode !== nextMode) {
      await onSettingChange('syncTransferActiveMode', nextMode);
    }
  };

  return (
    <div className="space-y-5">
      {/* 顶部紧凑模式切换条 */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-qc-border bg-qc-panel px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-base font-semibold text-qc-fg">
            <i className="ti ti-arrows-transfer-up-down text-qc-fg-muted" />
            {t('settings.syncTransfer.title')}
          </div>
          <p className="mt-0.5 text-xs text-qc-fg-muted">{t('settings.syncTransfer.description')}</p>
        </div>
        <SegmentedControl
          value={activeMode}
          onChange={handleModeChange}
          options={modeOptions}
        />
      </div>

      {activeMode === 'webdav' ? (
        <WebdavSection settings={settings} onSettingChange={onSettingChange} />
      ) : (
        <LanModePanel
          status={lanStatus}
          localSnapshot={localSnapshot}
          autoSyncStatus={autoSyncStatus}
          peers={pairedPeers}
          busy={lanBusy}
          onRefresh={() => runLanAction('refresh', refreshSyncTransferLanPairingCode)}
          discoveredPeers={discoveredPeers}
          onDiscoverPeers={() => runLanAction('discoverPeers', async () => {
            const peers = await discoverSyncTransferLanPeers();
            setDiscoveredPeers(Array.isArray(peers) ? peers : []);
          })}
          peerBaseUrl={peerBaseUrl}
          peerPairingCode={peerPairingCode}
          onPeerBaseUrlChange={setPeerBaseUrl}
          onPairingCodeChange={setPeerPairingCode}
          onPairPeer={() => runLanAction('pairPeer', () => pairSyncTransferLanPeer(peerBaseUrl, peerPairingCode))}
          onFetchPeerSnapshot={deviceId => runLanAction(`snapshot-${deviceId}`, async () => {
            const snapshot = await fetchSyncTransferLanPeerSnapshot(deviceId);
            recordReport('snapshot', deviceId, snapshot);
          })}
          onPushPeer={deviceId => runLanAction(`push-${deviceId}`, async () => {
            const report = await pushSyncTransferLanPeer(deviceId);
            recordReport('push', deviceId, report);
          })}
          pairingCodeVisible={pairingCodeVisible}
          onTogglePairingCodeVisible={() => setPairingCodeVisible(value => !value)}
          onRemovePeer={deviceId => runLanAction(`remove-${deviceId}`, () => removeSyncTransferLanPairedPeer(deviceId))}
          onUpdateAutoSync={settings => runLanAction('updateAutoSync', () => updateSyncTransferLanAutoSyncSettings(settings))}
          lastActionReport={lastActionReport}
          onClearActionReport={() => setLastActionReport(null)}
          t={t}
        />
      )}
    </div>
  );
}

function LanModePanel({
  status,
  localSnapshot,
  autoSyncStatus,
  peers,
  busy,
  peerBaseUrl,
  peerPairingCode,
  onPeerBaseUrlChange,
  onPairingCodeChange,
  onRefresh,
  discoveredPeers,
  onDiscoverPeers,
  onPairPeer,
  onFetchPeerSnapshot,
  onPushPeer,
  pairingCodeVisible,
  onTogglePairingCodeVisible,
  onRemovePeer,
  onUpdateAutoSync,
  lastActionReport,
  onClearActionReport,
  t,
}) {
  const localPairingCode = status?.pairing_code;
  const autoSettings = autoSyncStatus?.settings || {
    send_enabled: false,
    receive_enabled: false,
  };
  const sendEnabled = Boolean(autoSettings.send_enabled ?? autoSettings.auto_push);
  const receiveEnabled = Boolean(autoSettings.receive_enabled ?? autoSettings.auto_pull);

  const updateAutoDirection = (direction, checked) => {
    onUpdateAutoSync({ ...autoSettings, [direction]: checked });
  };

  const formatTime = (value) => {
    if (!value) return t('settings.syncTransfer.neverSeen');
    try {
      return new Date(value).toLocaleString();
    } catch {
      return t('settings.syncTransfer.neverSeen');
    }
  };

  const pairingCodeText = localPairingCode?.pairing_code || '------';
  const displayedPairingCode = pairingCodeVisible ? pairingCodeText : '••••••';
  const selectDiscoveredPeer = (peer) => {
    onPeerBaseUrlChange(peer.base_url);
  };

  const httpRunning = Boolean(status?.http_running);
  const receiveRunning = receiveEnabled && httpRunning;

  return (
    <div className="space-y-5">
      <SettingsSection
        title={t('settings.syncTransfer.lanTitle')}
        description={t('settings.syncTransfer.lanSimpleDesc')}
      >
        <div className="space-y-4">
          {/* 1) 服务开关 + 状态概览 */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-qc-border">
            <div className="flex items-center gap-3">
              <Toggle
                checked={receiveEnabled}
                onChange={checked => updateAutoDirection('receive_enabled', checked)}
                disabled={busy === 'updateAutoSync'}
              />
              <div>
                <div className="text-sm font-medium text-qc-fg">
                  {receiveRunning ? t('settings.syncTransfer.serviceRunning') : t('settings.syncTransfer.stopped')}
                </div>
                <div className="text-xs text-qc-fg-muted">{t('settings.syncTransfer.receivePanelDesc')}</div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill
                label={t('settings.syncTransfer.httpState')}
                value={httpRunning ? t('settings.syncTransfer.running') : t('settings.syncTransfer.stopped')}
                active={httpRunning}
              />
              <StatusPill
                label={t('settings.syncTransfer.pairedCount')}
                value={String(status?.paired_count ?? 0)}
              />
              <StatusPill
                label={t('settings.syncTransfer.localSnapshot')}
                value={t('settings.syncTransfer.compactSnapshot', {
                  history: Object.keys(localSnapshot?.history_states || {}).length,
                  favorites: Object.keys(localSnapshot?.favorite_states || {}).length,
                })}
              />
            </div>
          </div>

          {/* 2) 本机信息：配对码 + 本机地址 平分 */}
          <div className="grid gap-3 lg:grid-cols-2">
            {/* 配对码 */}
            <div className="rounded-lg border border-qc-border bg-qc-panel-2 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs text-qc-fg-muted">{t('settings.syncTransfer.pairingCode')}</span>
                <div className="flex items-center gap-1">
                  <Tooltip content={pairingCodeVisible ? t('settings.syncTransfer.hidePairingCode') : t('settings.syncTransfer.showPairingCode')} asChild>
                    <button
                      type="button"
                      onClick={onTogglePairingCodeVisible}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-qc-fg-muted hover:bg-qc-hover hover:text-qc-fg transition-colors"
                    >
                      <i className={pairingCodeVisible ? 'ti ti-eye-off' : 'ti ti-eye'} />
                    </button>
                  </Tooltip>
                  <Tooltip content={t('settings.syncTransfer.refreshPairingCode')} asChild>
                    <button
                      type="button"
                      onClick={onRefresh}
                      disabled={!receiveEnabled || busy === 'refresh'}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-qc-fg-muted hover:bg-qc-hover hover:text-qc-fg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <i className={busy === 'refresh' ? 'ti ti-loader-2 animate-spin' : 'ti ti-refresh'} />
                    </button>
                  </Tooltip>
                </div>
              </div>
              <div className="rounded-lg border border-qc-border bg-qc-surface px-3 py-2 text-center font-mono text-2xl tracking-[0.4em] text-qc-fg">
                {displayedPairingCode}
              </div>
              <div className="mt-2 text-xs text-qc-fg-muted">
                {t('settings.syncTransfer.pairingMeta', { attempts: localPairingCode?.remaining_attempts ?? 0 })}
              </div>
            </div>

            {/* 本机地址 */}
            <div className="min-w-0 rounded-lg border border-qc-border bg-qc-panel-2 p-3">
              <div className="mb-2 text-xs text-qc-fg-muted">{t('settings.syncTransfer.localEndpoints')}</div>
              {(status?.local_endpoints || []).length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {status.local_endpoints.map(endpoint => (
                    <span
                      key={endpoint.base_url}
                      className="max-w-full break-all rounded-lg border border-qc-border bg-qc-surface px-2.5 py-1.5 text-left font-mono text-xs text-qc-fg"
                    >
                      {endpoint.base_url}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-qc-fg-muted">{t('settings.syncTransfer.noLocalEndpoints')}</div>
              )}
            </div>
          </div>

          {/* 3) 连接其他设备 */}
          <div className="rounded-lg border border-qc-border bg-qc-surface/50 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-qc-fg">{t('settings.syncTransfer.connectPanelTitle')}</div>
                <div className="text-xs text-qc-fg-muted">{t('settings.syncTransfer.connectPanelDesc')}</div>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={onDiscoverPeers}
                loading={busy === 'discoverPeers'}
                icon={<i className="ti ti-radar" />}
              >
                {t('settings.syncTransfer.refreshDiscovery')}
              </Button>
            </div>

            <div className="mb-3 max-h-56 divide-y divide-qc-border overflow-y-auto rounded-lg border border-qc-border bg-qc-panel-2">
              {discoveredPeers.length > 0 ? discoveredPeers.map(peer => {
                const selected = peer.base_url === peerBaseUrl;
                return (
                  <button
                    key={peer.device_id}
                    type="button"
                    className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-qc-hover ${selected ? 'bg-qc-hover' : ''}`}
                    onClick={() => selectDiscoveredPeer(peer)}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-qc-fg">{peer.device_name || peer.device_id}</span>
                      <span className="block truncate text-xs text-qc-fg-muted">{peer.base_url}</span>
                    </span>
                    {selected ? (
                      <i className="ti ti-check shrink-0 text-blue-500" />
                    ) : (
                      <span className="shrink-0 text-xs text-qc-fg-muted">{t('settings.syncTransfer.clickToUse')}</span>
                    )}
                  </button>
                );
              }) : (
                <div className="px-3 py-6 text-center text-sm text-qc-fg-muted">{t('settings.syncTransfer.noDiscoveredPeersHint')}</div>
              )}
            </div>

            <div className="grid gap-2 lg:grid-cols-[minmax(220px,1fr)_minmax(160px,220px)_auto]">
              <Input
                value={peerBaseUrl}
                onChange={e => onPeerBaseUrlChange(e.target.value)}
                placeholder="http://192.168.1.10:35691"
                className="w-full"
              />
              <Input
                value={peerPairingCode}
                onChange={e => onPairingCodeChange(e.target.value)}
                placeholder={t('settings.syncTransfer.peerPairingCode')}
                className="w-full"
              />
              <Button
                size="sm"
                variant="primary"
                onClick={onPairPeer}
                loading={busy === 'pairPeer'}
                disabled={!peerBaseUrl.trim() || !peerPairingCode.trim()}
                icon={<i className="ti ti-link-plus" />}
                className="w-full lg:w-auto"
              >
                {t('settings.syncTransfer.pairPeer')}
              </Button>
            </div>
          </div>

          {/* 4) 已配对设备 */}
          <div className="rounded-lg border border-qc-border bg-qc-surface/50 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-qc-fg">{t('settings.syncTransfer.pairedPeers')}</div>
                <div className="text-xs text-qc-fg-muted">{t('settings.syncTransfer.lanDevicesStepDesc')}</div>
              </div>
            </div>

            {peers.length === 0 ? (
              <div className="rounded-lg border border-dashed border-qc-border px-3 py-6 text-center text-sm text-qc-fg-muted">
                {t('settings.syncTransfer.noPairedPeers')}
              </div>
            ) : (
              <div className="divide-y divide-qc-border">
                {peers.map(peer => (
                  <div
                    key={peer.device_id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-qc-fg">{peer.device_name || peer.device_id}</div>
                      <div className="truncate text-xs text-qc-fg-muted">{peer.base_url || peer.device_id}</div>
                      <div className="truncate text-xs text-qc-fg-subtle">
                        {t('settings.syncTransfer.lastSeen')}: {formatTime(peer.last_seen_at_ms)}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onPushPeer(peer.device_id)}
                        disabled={busy === `push-${peer.device_id}`}
                        className="qc-accent-button inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[var(--qc-accent)] !bg-[var(--qc-accent)] px-3 text-sm font-medium !text-[var(--qc-accent-fg)] shadow-sm transition-colors hover:!bg-[var(--qc-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <i className={busy === `push-${peer.device_id}` ? 'ti ti-loader-2 animate-spin' : 'ti ti-upload'} />
                        {t('settings.syncTransfer.pushPeer')}
                      </button>
                      <IconActionButton
                        tooltip={t('settings.syncTransfer.fetchSnapshot')}
                        icon="ti ti-list-search"
                        onClick={() => onFetchPeerSnapshot(peer.device_id)}
                        loading={busy === `snapshot-${peer.device_id}`}
                      />
                      <IconActionButton
                        tooltip={t('common.delete')}
                        icon="ti ti-trash"
                        variant="danger"
                        onClick={() => onRemovePeer(peer.device_id)}
                        loading={busy === `remove-${peer.device_id}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 5) 最近操作结果（合并） */}
          {lastActionReport && (
            <ActionResultCard
              report={lastActionReport}
              peers={peers}
              onClear={onClearActionReport}
              t={t}
            />
          )}
        </div>
      </SettingsSection>

      <SettingsSection
        title={t('settings.syncTransfer.advancedTitle')}
        description={t('settings.syncTransfer.advancedDesc')}
      >
        <SettingItem
          label={t('settings.syncTransfer.autoSyncDirections')}
          description={t('settings.syncTransfer.autoSyncDirectionsDesc')}
        >
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-qc-fg">
              <Toggle
                checked={sendEnabled}
                onChange={checked => updateAutoDirection('send_enabled', checked)}
                disabled={busy === 'updateAutoSync'}
              />
              {t('settings.syncTransfer.autoPush')}
            </label>
            <label className="flex items-center gap-2 text-sm text-qc-fg">
              <Toggle
                checked={receiveEnabled}
                onChange={checked => updateAutoDirection('receive_enabled', checked)}
                disabled={busy === 'updateAutoSync'}
              />
              {t('settings.syncTransfer.autoPull')}
            </label>
          </div>
        </SettingItem>
      </SettingsSection>
    </div>
  );
}

function StatusPill({ label, value, active = false }) {
  return (
    <span
      className={`rounded-lg border px-3 py-1.5 text-xs ${
        active
          ? 'border-blue-400/60 bg-blue-500/10 text-qc-fg'
          : 'border-qc-border bg-qc-panel-2 text-qc-fg-muted'
      }`}
    >
      <span className="text-qc-fg-muted">{label}：</span>
      <span className={active ? 'font-medium text-qc-fg' : 'font-medium'}>{value}</span>
    </span>
  );
}

function IconActionButton({
  tooltip,
  icon,
  onClick,
  loading = false,
  disabled = false,
  variant = 'secondary',
}) {
  const isDisabled = disabled || loading;
  const variantClasses = {
    primary: 'bg-blue-500 hover:bg-blue-600 text-white border border-transparent',
    secondary: 'bg-qc-panel-2 hover:bg-qc-hover text-qc-fg border border-qc-border',
    danger: 'bg-qc-panel-2 hover:bg-red-500/10 hover:text-red-500 text-qc-fg border border-qc-border',
  };
  return (
    <Tooltip content={tooltip} asChild>
      <button
        type="button"
        onClick={onClick}
        disabled={isDisabled}
        className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]}`}
      >
        <i className={loading ? 'ti ti-loader-2 animate-spin' : icon} />
      </button>
    </Tooltip>
  );
}

function ActionResultCard({ report, peers, onClear, t }) {
  const peer = peers.find(p => p.device_id === report.deviceId);
  const peerName = peer?.device_name || peer?.device_id || report.deviceId || '';

  let icon = 'ti ti-info-circle';
  let kindLabel = '';
  let summary = '';

  if (report.kind === 'snapshot') {
    icon = 'ti ti-list-search';
    kindLabel = t('settings.syncTransfer.fetchSnapshot');
    summary = t('settings.syncTransfer.peerSnapshotSummary', {
      history: Object.keys(report.payload?.history_states || {}).length,
      favorites: Object.keys(report.payload?.favorite_states || {}).length,
      groups: (report.payload?.groups || []).length,
    });
  } else if (report.kind === 'pull') {
    icon = 'ti ti-download';
    kindLabel = t('settings.syncTransfer.pullPeer');
    summary = t('settings.syncTransfer.pullResultSummary', {
      total: report.payload?.pulled || 0,
      history: report.payload?.pulled_clipboard || 0,
      favorites: report.payload?.pulled_favorites || 0,
      groups: report.payload?.pulled_groups || 0,
    });
  } else if (report.kind === 'push') {
    icon = 'ti ti-upload';
    kindLabel = t('settings.syncTransfer.pushPeer');
    summary = t('settings.syncTransfer.pushResultSummary', {
      total: report.payload?.pushed || 0,
      history: report.payload?.pushed_clipboard || 0,
      favorites: report.payload?.pushed_favorites || 0,
      groups: report.payload?.pushed_groups || 0,
    });
  }

  let timeText = '';
  try {
    timeText = new Date(report.time).toLocaleTimeString();
  } catch {
    timeText = '';
  }

  return (
    <div className="rounded-lg border border-qc-border bg-qc-surface/60 p-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
          <i className={icon} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
            <span className="font-medium text-qc-fg">{kindLabel}</span>
            {peerName && (
              <span className="text-qc-fg-muted">· {peerName}</span>
            )}
            {timeText && (
              <span className="text-xs text-qc-fg-subtle">{timeText}</span>
            )}
          </div>
          <div className="mt-1 break-all text-xs text-qc-fg-muted">{summary}</div>
        </div>
        <Tooltip content={t('common.close') || '关闭'} asChild>
          <button
            type="button"
            onClick={onClear}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-qc-fg-muted hover:bg-qc-hover hover:text-qc-fg transition-colors"
          >
            <i className="ti ti-x" />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}

export default SyncTransferSection;
