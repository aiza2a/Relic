import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useTranslation } from 'react-i18next';
import SettingsSection from '../components/SettingsSection';
import SettingItem from '../components/SettingItem';
import Button from '@shared/components/ui/Button';
import Input from '@shared/components/ui/Input';
import Toggle from '@shared/components/ui/Toggle';
import { showConfirm } from '@shared/utils/dialog';
import { formatUserMessage, formatUserMessages } from '@shared/utils/userMessages';
import { toast } from '@shared/store/toastStore';
import {
  downloadAllWebdav,
  downloadWebdav,
  getWebdavLastReport,
  hasSavedWebdavEncryptionPassword,
  hasSavedWebdavPassword,
  setWebdavEncryptionPassword,
  setWebdavPassword,
  startWebdavScheduler,
  stopWebdavScheduler,
  testWebdavConnection,
  uploadWebdav
} from '@shared/api/webdavSync';

function SubGroupTitle({ icon, title, description }) {
  return (
    <div className="mb-2 mt-1 flex items-baseline gap-2">
      <i className={`${icon} text-qc-fg-muted`} />
      <h3 className="text-sm font-semibold text-qc-fg">{title}</h3>
      {description && (
        <span className="text-xs text-qc-fg-muted">{description}</span>
      )}
    </div>
  );
}

function WebdavSection({ settings, onSettingChange }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState('');
  const [lastReport, setLastReport] = useState(null);
  const [passwordDraft, setPasswordDraft] = useState('');
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [encryptionPasswordDraft, setEncryptionPasswordDraft] = useState('');
  const [encryptionPasswordSaved, setEncryptionPasswordSaved] = useState(false);
  const [encryptionPasswordBusy, setEncryptionPasswordBusy] = useState(false);

  const webdavUrl = String(settings.webdavUrl || '').trim();
  const webdavUsername = String(settings.webdavUsername || '').trim();
  const webdavRootPath = String(settings.webdavRootPath || 'quickclipboard').trim() || 'quickclipboard';

  useEffect(() => {
    let mounted = true;
    getWebdavLastReport()
      .then(report => {
        if (!mounted || !report?.result || !report?.mode) return;
        setLastReport({ actionId: `${report.automatic ? 'auto' : 'manual'}-${report.mode}`, mode: report.mode, result: report.result, time: Date.now(), automatic: Boolean(report.automatic) });
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const unlistenPromise = listen('webdav-sync-report', event => {
      const payload = event.payload || {};
      if (!payload.result || !payload.mode) return;
      setLastReport({ actionId: `auto-${payload.mode}`, mode: payload.mode, result: payload.result, time: Date.now(), automatic: true });
    });

    return () => {
      unlistenPromise.then(unlisten => unlisten()).catch(() => {});
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    if (!webdavUrl || !webdavUsername) {
      setPasswordSaved(false);
      return () => {
        mounted = false;
      };
    }
    hasSavedWebdavPassword(webdavUrl, webdavUsername)
      .then(saved => {
        if (mounted) setPasswordSaved(Boolean(saved));
      })
      .catch(() => {
        if (mounted) setPasswordSaved(false);
      });
    return () => {
      mounted = false;
    };
  }, [webdavUrl, webdavUsername]);

  useEffect(() => {
    let mounted = true;
    if (!webdavUrl) {
      setEncryptionPasswordSaved(false);
      return () => {
        mounted = false;
      };
    }
    hasSavedWebdavEncryptionPassword(webdavUrl, webdavUsername, webdavRootPath)
      .then(saved => {
        if (mounted) setEncryptionPasswordSaved(Boolean(saved));
      })
      .catch(() => {
        if (mounted) setEncryptionPasswordSaved(false);
      });
    return () => {
      mounted = false;
    };
  }, [webdavUrl, webdavUsername, webdavRootPath]);

  const update = async (key, value) => {
    await onSettingChange(key, value);
    if (key === 'webdavEnabled') {
      if (value) {
        await startWebdavScheduler().catch(() => {});
      } else {
        await stopWebdavScheduler().catch(() => {});
      }
    }
  };

  const formatReport = (result, mode) => {
    const total = mode === 'push' ? result?.pushed || 0 : result?.pulled || 0;
    const clipboard = mode === 'push' ? result?.pushed_clipboard || 0 : result?.pulled_clipboard || 0;
    const favorites = mode === 'push' ? result?.pushed_favorites || 0 : result?.pulled_favorites || 0;
    const groups = mode === 'push' ? result?.pushed_groups || 0 : result?.pulled_groups || 0;

    return t('settings.webdav.syncResultDetail', { total, clipboard, favorites, groups });
  };

  const webdavError = (error) => formatUserMessage(error, t, 'errors.webdav.operationFailed');

  const saveWebdavPasswordDraft = async () => {
    if (!passwordDraft) return true;
    try {
      setPasswordBusy(true);
      const saved = await setWebdavPassword(webdavUrl, webdavUsername, passwordDraft);
      setPasswordSaved(Boolean(saved));
      setPasswordDraft('');
      toast.success(t('settings.webdav.passwordSaved'));
      return true;
    } catch (e) {
      toast.error(webdavError(e), { duration: 6000 });
      return false;
    } finally {
      setPasswordBusy(false);
    }
  };

  const clearWebdavPassword = async () => {
    try {
      setPasswordBusy(true);
      await setWebdavPassword(webdavUrl, webdavUsername, '');
      setPasswordDraft('');
      setPasswordSaved(false);
      toast.success(t('settings.webdav.passwordCleared'));
    } catch (e) {
      toast.error(webdavError(e), { duration: 6000 });
    } finally {
      setPasswordBusy(false);
    }
  };

  const saveWebdavEncryptionPasswordDraft = async () => {
    if (!encryptionPasswordDraft) return true;
    try {
      setEncryptionPasswordBusy(true);
      const saved = await setWebdavEncryptionPassword(
        webdavUrl,
        webdavUsername,
        webdavRootPath,
        encryptionPasswordDraft
      );
      setEncryptionPasswordSaved(Boolean(saved));
      setEncryptionPasswordDraft('');
      toast.success(t('settings.webdav.encryptionPasswordSaved'));
      return true;
    } catch (e) {
      toast.error(webdavError(e), { duration: 6000 });
      return false;
    } finally {
      setEncryptionPasswordBusy(false);
    }
  };

  const clearWebdavEncryptionPassword = async () => {
    try {
      setEncryptionPasswordBusy(true);
      await setWebdavEncryptionPassword(webdavUrl, webdavUsername, webdavRootPath, '');
      setEncryptionPasswordDraft('');
      setEncryptionPasswordSaved(false);
      toast.success(t('settings.webdav.encryptionPasswordCleared'));
    } catch (e) {
      toast.error(webdavError(e), { duration: 6000 });
    } finally {
      setEncryptionPasswordBusy(false);
    }
  };

  const runAction = async (actionId, action, successKey, mode) => {
    if (!(await saveWebdavPasswordDraft())) return;
    if (!(await saveWebdavEncryptionPasswordDraft())) return;
    try {
      setBusy(actionId);
      const result = await action();
      if (result && typeof result === 'object' && ('pulled' in result || 'pushed' in result)) {
        setLastReport({ actionId, mode, result, time: Date.now() });
        toast.success(t('settings.webdav.successWithDetail', {
          title: t(successKey),
          detail: formatReport(result, mode),
        }), { duration: 5000 });
        if (Array.isArray(result.errors) && result.errors.length > 0) {
          toast.warning(
            formatUserMessages(result.errors, t, 'errors.webdav.operationFailed')
              .join(t('settings.webdav.warningSeparator')),
            { duration: 6000 },
          );
        }
      } else {
        setLastReport(null);
        toast.success(t(successKey));
      }
    } catch (e) {
      toast.error(webdavError(e), { duration: 6000 });
    } finally {
      setBusy('');
    }
  };

  const handleDownloadAll = async () => {
    const ok = await showConfirm(t('settings.webdav.pullAllConfirm'));
    if (!ok) return;
    await runAction('downloadAllWebdav', downloadAllWebdav, 'settings.webdav.pullAllComplete', 'pull');
  };

  const reportItems = lastReport?.result
    ? (lastReport.mode === 'push' ? lastReport.result.pushed_items : lastReport.result.pulled_items) || []
    : [];

  const renderReportDetail = () => {
    if (!lastReport) return null;

    const result = lastReport.result;
    const total = lastReport.mode === 'push' ? result.pushed || 0 : result.pulled || 0;

    return (
      <div className="mt-3 rounded-xl border border-qc-border bg-qc-surface/60 p-3 text-sm text-qc-fg">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="font-medium">
            {t('settings.webdav.lastSyncDetail')}
            {lastReport.automatic ? ` · ${t('settings.webdav.autoSyncSource')}` : ''}
          </span>
          <span className="text-xs text-qc-fg-muted">{formatReport(result, lastReport.mode)}</span>
        </div>
        {total === 0 ? (
          <div className="text-qc-fg-muted">{t('settings.webdav.noChanges')}</div>
        ) : (
          <div className="max-h-40 space-y-1 overflow-auto pr-1">
            {reportItems.slice(0, 30).map((item, index) => (
              <div key={`${item.category}-${item.id}-${index}`} className="flex items-center gap-2 text-xs text-qc-fg-muted">
                <span className="shrink-0 rounded-md bg-qc-hover px-1.5 py-0.5 text-qc-fg">{t(`settings.webdav.category.${item.category}`)}</span>
                <span className="min-w-0 flex-1 truncate">{item.summary || item.id}</span>
                <span className="shrink-0 truncate max-w-28">{item.source_device_id}</span>
              </div>
            ))}
            {reportItems.length > 30 && (
              <div className="text-xs text-qc-fg-muted">{t('settings.webdav.moreItems', { count: reportItems.length - 30 })}</div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <SettingsSection
      title={t('settings.webdav.title')}
      description={t('settings.webdav.description')}
    >
      {/* 子区 1：连接配置 */}
      <SettingItem label={t('settings.webdav.enabled')} description={t('settings.webdav.enabledDesc')}>
        <Toggle checked={Boolean(settings.webdavEnabled)} onChange={checked => update('webdavEnabled', checked)} />
      </SettingItem>

      <SettingItem label={t('settings.webdav.url')}>
        <Input value={settings.webdavUrl || ''} commitOnBlur onCommit={v => update('webdavUrl', String(v))} placeholder={t('settings.webdav.urlPlaceholder')} className="w-80" />
      </SettingItem>

      <SettingItem label={t('settings.webdav.username')}>
        <Input value={settings.webdavUsername || ''} commitOnBlur onCommit={v => update('webdavUsername', String(v))} placeholder={t('settings.webdav.usernamePlaceholder')} className="w-80" />
      </SettingItem>

      <SettingItem label={t('settings.webdav.password')}>
        <div className="flex w-80 items-center gap-2">
          <Input
            type="password"
            value={passwordDraft}
            onChange={e => setPasswordDraft(e.target.value)}
            onBlur={saveWebdavPasswordDraft}
            onKeyDown={e => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
            placeholder={passwordSaved ? t('settings.webdav.passwordSavedPlaceholder') : t('settings.webdav.passwordPlaceholder')}
            className="min-w-0 flex-1"
            disabled={passwordBusy}
          />
          {passwordSaved && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="shrink-0"
              onClick={clearWebdavPassword}
              disabled={passwordBusy}
              loading={passwordBusy}
              icon={<i className="ti ti-key-off" />}
            >
              {t('settings.webdav.clearPassword')}
            </Button>
          )}
        </div>
      </SettingItem>

      <SettingItem label={t('settings.webdav.rootPath')}>
        <Input value={settings.webdavRootPath || 'quickclipboard'} commitOnBlur onCommit={v => update('webdavRootPath', String(v))} placeholder={t('settings.webdav.rootPathPlaceholder')} className="w-80" />
      </SettingItem>

      <div className="pt-5">
        <SubGroupTitle
          icon="ti ti-lock"
          title={t('settings.webdav.encryptionTitle')}
          description={t('settings.webdav.encryptionDesc')}
        />
      </div>
      <SettingItem label={t('settings.webdav.encryptionPassword')} description={t('settings.webdav.encryptionPasswordDesc')}>
        <div className="flex w-80 items-center gap-2">
          <Input
            type="password"
            value={encryptionPasswordDraft}
            onChange={e => setEncryptionPasswordDraft(e.target.value)}
            onBlur={saveWebdavEncryptionPasswordDraft}
            onKeyDown={e => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
            placeholder={encryptionPasswordSaved ? t('settings.webdav.encryptionPasswordSavedPlaceholder') : t('settings.webdav.encryptionPasswordPlaceholder')}
            className="min-w-0 flex-1"
            disabled={encryptionPasswordBusy}
          />
          {encryptionPasswordSaved && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="shrink-0"
              onClick={clearWebdavEncryptionPassword}
              disabled={encryptionPasswordBusy}
              loading={encryptionPasswordBusy}
              icon={<i className="ti ti-lock-off" />}
            >
              {t('settings.webdav.clearEncryptionPassword')}
            </Button>
          )}
        </div>
      </SettingItem>

      {/* 子区 2：同步操作 */}
      <div className="pt-5">
        <SubGroupTitle
          icon="ti ti-cloud-up"
          title={t('settings.webdav.syncTitle')}
          description={t('settings.webdav.syncDesc')}
        />
      </div>
      <SettingItem label={t('settings.webdav.syncCategories')} description={t('settings.webdav.syncCategoriesDesc')}>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-qc-fg">
            <Toggle checked={settings.webdavSyncClipboard !== false} onChange={checked => update('webdavSyncClipboard', checked)} />
            {t('settings.webdav.syncClipboard')}
          </label>
          <label className="flex items-center gap-2 text-sm text-qc-fg">
            <Toggle checked={settings.webdavSyncFavorites !== false} onChange={checked => update('webdavSyncFavorites', checked)} />
            {t('settings.webdav.syncFavorites')}
          </label>
          <label className="flex items-center gap-2 text-sm text-qc-fg">
            <Toggle checked={Boolean(settings.webdavSyncImages)} onChange={checked => update('webdavSyncImages', checked)} />
            {t('settings.webdav.syncImages')}
          </label>
        </div>
      </SettingItem>

      <SettingItem stacked label={t('settings.webdav.manualActions')} description={t('settings.webdav.manualActionsDesc')}>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => runAction('testWebdavConnection', testWebdavConnection, 'settings.webdav.testSuccess', 'push')} disabled={Boolean(busy)} variant="secondary" icon={<i className="ti ti-plug-connected" />}>
              {busy === 'testWebdavConnection' ? t('settings.webdav.testing') : t('settings.webdav.testConnection')}
            </Button>
            <Button onClick={() => runAction('uploadWebdav', uploadWebdav, 'settings.webdav.pushComplete', 'push')} disabled={Boolean(busy)} variant="primary" icon={<i className="ti ti-upload" />}>
              {busy === 'uploadWebdav' ? t('settings.webdav.pushing') : t('settings.webdav.upload')}
            </Button>
            <Button onClick={() => runAction('downloadWebdav', downloadWebdav, 'settings.webdav.pullComplete', 'pull')} disabled={Boolean(busy)} variant="secondary" icon={<i className="ti ti-download" />}>
              {busy === 'downloadWebdav' ? t('settings.webdav.pulling') : t('settings.webdav.download')}
            </Button>
            <Button onClick={handleDownloadAll} disabled={Boolean(busy)} variant="secondary" icon={<i className="ti ti-restore" />}>
              {busy === 'downloadAllWebdav' ? t('settings.webdav.pullingAll') : t('settings.webdav.downloadAll')}
            </Button>
          </div>
          {renderReportDetail()}
        </div>
      </SettingItem>

      {/* 子区 3：自动同步 */}
      <div className="pt-5">
        <SubGroupTitle
          icon="ti ti-clock-play"
          title={t('settings.webdav.autoSyncTitle')}
          description={t('settings.webdav.autoSyncDesc')}
        />
      </div>
      <SettingItem label={t('settings.webdav.autoPullOnWindowShow')} description={t('settings.webdav.autoPullOnWindowShowDesc')}>
        <Toggle checked={Boolean(settings.webdavAutoPullOnWindowShow)} onChange={checked => update('webdavAutoPullOnWindowShow', checked)} />
      </SettingItem>

      <SettingItem label={t('settings.webdav.autoPush')} description={t('settings.webdav.autoPushDesc')}>
        <div className="flex flex-wrap items-center gap-3">
          <Toggle checked={Boolean(settings.webdavAutoPush)} onChange={checked => update('webdavAutoPush', checked)} />
          <span className="text-sm text-qc-fg-muted">{t('settings.webdav.pushDelaySecs')}</span>
          <Input type="number" value={settings.webdavPushDelaySecs ?? 10} commitOnBlur onCommit={v => update('webdavPushDelaySecs', Math.max(1, parseInt(String(v), 10) || 10))} min={1} className="w-24" />
        </div>
      </SettingItem>

      <SettingItem label={t('settings.webdav.pollingPull')} description={t('settings.webdav.pollingPullDesc')}>
        <div className="flex flex-wrap items-center gap-3">
          <Toggle checked={Boolean(settings.webdavAutoPull)} onChange={checked => update('webdavAutoPull', checked)} />
          <span className="text-sm text-qc-fg-muted">{t('settings.webdav.pullIntervalSecs')}</span>
          <Input type="number" value={settings.webdavPullIntervalSecs ?? 30} commitOnBlur onCommit={v => update('webdavPullIntervalSecs', Math.max(1, parseInt(String(v), 10) || 30))} min={1} className="w-24" />
        </div>
      </SettingItem>
    </SettingsSection>
  );
}

export default WebdavSection;
