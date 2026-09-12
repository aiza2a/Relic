import '@tabler/icons-webfont/dist/tabler-icons.min.css';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import SettingsSection from '../components/SettingsSection';
import SettingItem from '../components/SettingItem';
import Button from '@shared/components/ui/Button';
import { open, save } from '@tauri-apps/plugin-dialog';
import { openPath } from '@tauri-apps/plugin-opener';
import { getCurrentStoragePath, getDefaultStoragePath, changeStoragePath, resetStoragePathToDefault, exportDataZip, importDataZip, resetAllData, checkTargetHasData, listBackups } from '@shared/api/dataManagement';
import { showError, showMessage, showConfirm } from '@shared/utils/dialog';
import { reloadAllWindows } from '@shared/api/window';
import { resetSettingsToDefault } from '@shared/api/settings';
import { isPortableMode } from '@shared/api/system';
import { clearClipboardHistory } from '@shared/api/clipboard';
import { formatUserMessage } from '@shared/utils/userMessages';
function DataManagementSection() {
  const {
    t
  } = useTranslation();
  const [storagePath, setStoragePath] = useState(t('common.loading'));
  const [importMode, setImportMode] = useState('replace');
  const [portable, setPortable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyText, setBusyText] = useState('');
  const [migrationDialog, setMigrationDialog] = useState(null); // { type: 'change' | 'reset', targetPath?: string, targetInfo?: object }
  const [backupDialog, setBackupDialog] = useState(null); // { backups: [] }
  const messageOf = (error) => formatUserMessage(error, t, 'errors.operationFailed');

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  useEffect(() => {
    (async () => {
      try {
        const path = await getCurrentStoragePath();
        setStoragePath(path);
      } catch (e) {
        setStoragePath(t('common.loadError'));
      }
      try {
        const p = await isPortableMode();
        setPortable(!!p);
      } catch (_) {}
    })();
  }, []);

  const handleExportData = async () => {
    try {
      const ts = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const tsText = `${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}_${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}`;
      const suggested = `quickclipboardData_${tsText}.zip`;

      const target = await save({
        defaultPath: suggested,
        filters: [{ name: 'Zip', extensions: ['zip'] }]
      });
      if (!target) return;

      const targetPath = target.toLowerCase().endsWith('.zip') ? target : `${target}.zip`;
      setBusyText(t('settings.dataManagement.overlayExporting'));
      setBusy(true);
      const out = await exportDataZip(targetPath);
      await showMessage(t('settings.dataManagement.exportSuccess', { path: out }));
    } catch (e) {
      await showError(t('settings.dataManagement.exportFailed', { message: messageOf(e) }));
    } finally {
      setBusy(false);
      setBusyText('');
    }
  };

  const handleImportFromFile = async () => {
    try {
      const file = await open({ multiple: false, filters: [{ name: 'Zip', extensions: ['zip'] }] });
      if (!file) return;
      await doImport(file);
    } catch (e) {
      await showError(t('settings.dataManagement.importFailed', { message: messageOf(e) }));
    }
  };

  const handleImportFromBackup = async () => {
    try {
      const backups = await listBackups();
      if (backups.length === 0) {
        await showMessage(t('settings.dataManagement.noBackups'));
        return;
      }
      setBackupDialog({ backups });
    } catch (e) {
      await showError(messageOf(e));
    }
  };

  const handleSelectBackup = async (backupPath) => {
    setBackupDialog(null);
    await doImport(backupPath);
  };

  const doImport = async (filePath) => {
    try {
      setBusyText(t('settings.dataManagement.overlayImporting'));
      setBusy(true);
      const resultPath = await importDataZip(filePath, importMode);
      const latest = await getCurrentStoragePath();
      setStoragePath(latest);
      await showMessage(t('settings.dataManagement.importSuccess', { path: resultPath }));
      try { await reloadAllWindows(); } catch (_) {}
    } catch (e) {
      await showError(t('settings.dataManagement.importFailed', { message: messageOf(e) }));
    } finally {
      setBusy(false);
      setBusyText('');
    }
  };

  const handleOpenStorageFolder = async () => {
    try {
      if (storagePath && typeof storagePath === 'string') {
        await openPath(storagePath);
      }
    } catch (e) {}
  };

  const handleChangeStorageLocation = async () => {
    try {
      const dir = await open({ directory: true, multiple: false });
      if (!dir) return;

      // 检测目标位置是否有数据
      const targetInfo = await checkTargetHasData(dir);

      if (targetInfo.has_data) {
        setMigrationDialog({ type: 'change', targetPath: dir, targetInfo });
        return;
      }

      setBusyText(t('settings.dataManagement.overlayMigrating'));
      setBusy(true);
      await changeStoragePath(dir, 'source_only');
      const latest = await getCurrentStoragePath();
      setStoragePath(latest);
      await showMessage(t('settings.dataManagement.updateSuccess'));
      try { await reloadAllWindows(); } catch (_) {}
    } catch (e) {
      await showError(t('settings.dataManagement.changeFailed', { message: messageOf(e) }));
    }
    finally {
      setBusy(false);
      setBusyText('');
    }
  };

  const handleMigrationModeSelect = async (mode) => {
    const dialog = migrationDialog;
    setMigrationDialog(null);

    if (!dialog) return;

    try {
      setBusyText(t('settings.dataManagement.overlayMigrating'));
      setBusy(true);

      if (dialog.type === 'change') {
        await changeStoragePath(dialog.targetPath, mode);
      } else if (dialog.type === 'reset') {
        await resetStoragePathToDefault(mode);
      }

      const latest = await getCurrentStoragePath();
      setStoragePath(latest);
      await showMessage(dialog.type === 'change'
        ? t('settings.dataManagement.updateSuccess')
        : t('settings.dataManagement.resetSuccess'));
      try { await reloadAllWindows(); } catch (_) {}
    } catch (e) {
      const errorKey = dialog.type === 'change'
        ? 'settings.dataManagement.changeFailed'
        : 'settings.dataManagement.resetFailed';
      await showError(t(errorKey, { message: messageOf(e) }));
    } finally {
      setBusy(false);
      setBusyText('');
    }
  };

  const handleResetStorageLocation = async () => {
    try {
      const defaultPath = await getDefaultStoragePath();
      const currentPath = await getCurrentStoragePath();

      if (currentPath === defaultPath) {
        await showMessage(t('settings.dataManagement.alreadyDefault'));
        return;
      }

      const targetInfo = await checkTargetHasData(defaultPath);

      if (targetInfo.has_data) {
        setMigrationDialog({ type: 'reset', targetPath: defaultPath, targetInfo });
        return;
      }

      setBusyText(t('settings.dataManagement.overlayMigrating'));
      setBusy(true);
      await resetStoragePathToDefault('source_only');
      const latest = await getCurrentStoragePath();
      setStoragePath(latest);
      await showMessage(t('settings.dataManagement.resetSuccess'));
      try { await reloadAllWindows(); } catch (_) {}
    } catch (e) {
      await showError(t('settings.dataManagement.resetFailed', { message: messageOf(e) }));
    }
    finally {
      setBusy(false);
      setBusyText('');
    }
  };

  const handleClearHistory = async () => {
    const ok = await showConfirm(t('settings.dataManagement.clearConfirm'));
    if (!ok) return;
    try {
      setBusyText(t('settings.dataManagement.overlayCleaning') || t('settings.dataManagement.overlayMigrating'));
      setBusy(true);
      await clearClipboardHistory();
      await showMessage(t('settings.dataManagement.clearSuccess') || t('common.success'));
      try { await reloadAllWindows(); } catch (_) {}
    } catch (e) {
      await showError(t('settings.dataManagement.clearFailed', { message: messageOf(e) }));
    } finally {
      setBusy(false);
      setBusyText('');
    }
  };

  const handleResetSettings = async () => {
    const ok = await showConfirm(t('settings.dataManagement.resetConfirm'));
    if (!ok) return;
    try {
      setBusyText(t('settings.dataManagement.overlayResetSettings') || t('settings.dataManagement.overlayMigrating'));
      setBusy(true);
      await resetSettingsToDefault();
      try { window.localStorage?.clear?.(); } catch (_) {}
      await showMessage(t('settings.dataManagement.resetSettingsSuccess') || t('common.success'));
      try { await reloadAllWindows(); } catch (_) {}
    } catch (e) {
      await showError(t('settings.dataManagement.resetSettingsFailed', { message: messageOf(e) }));
    } finally {
      setBusy(false);
      setBusyText('');
    }
  };

  const handleResetAllData = async () => {
    const ok = await showConfirm(t('settings.dataManagement.resetAllConfirm'));
    if (!ok) return;
    try {
      setBusyText(t('settings.dataManagement.overlayResetAll') || t('settings.dataManagement.overlayMigrating'));
      setBusy(true);
      const dir = await resetAllData();
      try { window.localStorage?.clear?.(); } catch (_) {}
      const latest = await getCurrentStoragePath();
      setStoragePath(latest);
      await showMessage(t('settings.dataManagement.resetAllSuccess', { path: dir }) || t('common.success'));
      try { await reloadAllWindows(); } catch (_) {}
    } catch (e) {
      await showError(t('settings.dataManagement.resetAllFailed', { message: messageOf(e) }));
    } finally {
      setBusy(false);
      setBusyText('');
    }
  };

  return (
    <>
      {/* 数据导出 */}
      <SettingsSection title={t('settings.dataManagement.exportTitle')} description={t('settings.dataManagement.exportDesc')}>
        <SettingItem label={t('settings.dataManagement.exportAllData')} description={t('settings.dataManagement.exportAllDataDesc')}>
          <Button onClick={handleExportData} variant="primary" icon={<i className="ti ti-download"></i>}>
            {t('settings.dataManagement.exportButton')}
          </Button>
        </SettingItem>
      </SettingsSection>

      {/* 数据导入 */}
      <SettingsSection title={t('settings.dataManagement.importTitle')} description={t('settings.dataManagement.importDesc')}>
        <SettingItem label={t('settings.dataManagement.importData')} description={t('settings.dataManagement.importDataDesc')}>
          <div className="flex gap-2">
            <Button onClick={handleImportFromFile} variant="secondary" icon={<i className="ti ti-file-upload"></i>}>
              {t('settings.dataManagement.selectFile')}
            </Button>
            <Button onClick={handleImportFromBackup} variant="secondary" icon={<i className="ti ti-history"></i>}>
              {t('settings.dataManagement.fromBackup')}
            </Button>
          </div>
        </SettingItem>

        <SettingItem stacked label={t('settings.dataManagement.importMode')} description={t('settings.dataManagement.importModeDesc')}>
          <div className="flex flex-col gap-2">
            <label className="flex items-start gap-3 p-3 border border-qc-border rounded-lg cursor-pointer hover:bg-qc-hover transition-colors">
              <input type="radio" name="import-mode" value="replace" checked={importMode === 'replace'} onChange={e => setImportMode(e.target.value)} className="mt-1" />
              <div className="flex-1">
                <div className="font-medium text-qc-fg">
                  {t('settings.dataManagement.modeReplace')}
                </div>
                <div className="text-xs text-qc-fg-muted mt-1">
                  {t('settings.dataManagement.modeReplaceDesc')}
                </div>
              </div>
            </label>
            <label className="flex items-start gap-3 p-3 border border-qc-border rounded-lg cursor-pointer hover:bg-qc-hover transition-colors">
              <input type="radio" name="import-mode" value="merge" checked={importMode === 'merge'} onChange={e => setImportMode(e.target.value)} className="mt-1" />
              <div className="flex-1">
                <div className="font-medium text-qc-fg">
                  {t('settings.dataManagement.modeMerge')}
                </div>
                <div className="text-xs text-qc-fg-muted mt-1">
                  {t('settings.dataManagement.modeMergeDesc')}
                </div>
              </div>
            </label>
          </div>
        </SettingItem>
      </SettingsSection>

      {/* 数据存储位置 */}
      <SettingsSection title={t('settings.dataManagement.storageTitle')} description={t('settings.dataManagement.storageDesc')}>
        <SettingItem label={t('settings.dataManagement.currentPath')} description={storagePath}>
          <Button onClick={handleOpenStorageFolder} disabled={busy} variant="secondary" icon={<i className="ti ti-folder-open"></i>}>
            {t('settings.dataManagement.openFolder')}
          </Button>
        </SettingItem>

        <SettingItem label={t('settings.dataManagement.changePath')} description={t('settings.dataManagement.changePathDesc')}>
          <Button onClick={handleChangeStorageLocation} disabled={busy || portable} variant="primary" icon={<i className="ti ti-folder-plus"></i>}>
            {t('settings.dataManagement.selectNewPath')}
          </Button>
        </SettingItem>

        <SettingItem label={t('settings.dataManagement.resetPath')} description={t('settings.dataManagement.resetPathDesc')}>
          <Button onClick={handleResetStorageLocation} disabled={busy || portable} variant="secondary" icon={<i className="ti ti-home"></i>}>
            {t('settings.dataManagement.resetPathButton')}
          </Button>
        </SettingItem>
      </SettingsSection>

      {/* 数据清理 */}
      <SettingsSection title={t('settings.dataManagement.cleanupTitle')} description={t('settings.dataManagement.cleanupDesc')}>
        <SettingItem label={t('settings.dataManagement.clearHistory')} description={t('settings.dataManagement.clearHistoryDesc')}>
          <Button onClick={handleClearHistory} variant="danger" icon={<i className="ti ti-trash"></i>}>
            {t('settings.dataManagement.clearButton')}
          </Button>
        </SettingItem>

        <SettingItem label={t('settings.dataManagement.resetSettings')} description={t('settings.dataManagement.resetSettingsDesc')}>
          <Button onClick={handleResetSettings} variant="danger" icon={<i className="ti ti-restore"></i>}>
            {t('settings.dataManagement.resetButton')}
          </Button>
        </SettingItem>

        <SettingItem label={t('settings.dataManagement.resetAll')} description={t('settings.dataManagement.resetAllDesc')}>
          <Button onClick={handleResetAllData} variant="danger" icon={<i className="ti ti-refresh"></i>}>
            {t('settings.dataManagement.resetAllButton')}
          </Button>
        </SettingItem>
      </SettingsSection>

      {busy && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-qc-surface rounded-xl p-6 shadow-xl flex items-center gap-3 border border-qc-border">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <div className="text-sm text-qc-fg">{busyText || t('settings.dataManagement.overlayMigrating')}</div>
          </div>
        </div>,
        document.body
      )}

      {/* 迁移模式选择对话框 */}
      {migrationDialog && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-qc-surface rounded-xl p-6 shadow-xl max-w-md w-full mx-4 border border-qc-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <i className="ti ti-alert-triangle text-amber-600 text-xl"></i>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-qc-fg">
                  {t('settings.dataManagement.migrationConflictTitle')}
                </h3>
              </div>
            </div>
            
            <p className="text-sm text-qc-fg-muted mb-4">
              {t('settings.dataManagement.migrationConflictDesc')}
            </p>
            
            {migrationDialog.targetInfo && (
              <div className="bg-qc-panel rounded-lg p-3 mb-4 text-sm">
                <div className="flex items-center gap-2 text-qc-fg-muted">
                  <i className="ti ti-database"></i>
                  <span>{t('settings.dataManagement.targetHasDatabase')}: {migrationDialog.targetInfo.has_database ? t('common.confirm') : '-'}</span>
                  {migrationDialog.targetInfo.has_database && (
                    <span className="text-qc-fg-muted">({formatSize(migrationDialog.targetInfo.database_size)})</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-qc-fg-muted mt-1">
                  <i className="ti ti-photo"></i>
                  <span>{t('settings.dataManagement.targetHasImages')}: {migrationDialog.targetInfo.images_count} {t('settings.dataManagement.imagesCount')}</span>
                  {migrationDialog.targetInfo.images_count > 0 && (
                    <span className="text-qc-fg-muted">({formatSize(migrationDialog.targetInfo.images_size)})</span>
                  )}
                </div>
                {(migrationDialog.targetInfo.has_image_library || migrationDialog.targetInfo.image_library_count > 0) && (
                  <div className="flex items-center gap-2 text-qc-fg-muted mt-1">
                    <i className="ti ti-photo-star"></i>
                    <span>{t('settings.dataManagement.targetHasImageLibrary')}: {migrationDialog.targetInfo.image_library_count} {t('settings.dataManagement.imagesCount')}</span>
                    {migrationDialog.targetInfo.image_library_count > 0 && (
                      <span className="text-qc-fg-muted">({formatSize(migrationDialog.targetInfo.image_library_size)})</span>
                    )}
                  </div>
                )}
              </div>
            )}
            
            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleMigrationModeSelect('source_only')}
                className="flex items-start gap-3 p-3 border border-qc-border rounded-lg hover:bg-qc-hover transition-colors text-left"
              >
                <i className="ti ti-replace text-blue-500 mt-0.5"></i>
                <div className="flex-1">
                  <div className="font-medium text-qc-fg">
                    {t('settings.dataManagement.migrationSourceOnly')}
                  </div>
                  <div className="text-xs text-qc-fg-muted mt-0.5">
                    {t('settings.dataManagement.migrationSourceOnlyDesc')}
                  </div>
                </div>
              </button>
              
              <button
                onClick={() => handleMigrationModeSelect('target_only')}
                className="flex items-start gap-3 p-3 border border-qc-border rounded-lg hover:bg-qc-hover transition-colors text-left"
              >
                <i className="ti ti-file-check text-green-500 mt-0.5"></i>
                <div className="flex-1">
                  <div className="font-medium text-qc-fg">
                    {t('settings.dataManagement.migrationTargetOnly')}
                  </div>
                  <div className="text-xs text-qc-fg-muted mt-0.5">
                    {t('settings.dataManagement.migrationTargetOnlyDesc')}
                  </div>
                </div>
              </button>
              
              <button
                onClick={() => handleMigrationModeSelect('merge')}
                className="flex items-start gap-3 p-3 border border-qc-border rounded-lg hover:bg-qc-hover transition-colors text-left"
              >
                <i className="ti ti-git-merge text-purple-500 mt-0.5"></i>
                <div className="flex-1">
                  <div className="font-medium text-qc-fg">
                    {t('settings.dataManagement.migrationMerge')}
                  </div>
                  <div className="text-xs text-qc-fg-muted mt-0.5">
                    {t('settings.dataManagement.migrationMergeDesc')}
                  </div>
                </div>
              </button>
            </div>
            
            <div className="mt-4 pt-4 border-t border-qc-border flex justify-end">
              <button
                onClick={() => setMigrationDialog(null)}
                className="px-4 py-2 text-sm text-qc-fg-muted hover:text-qc-fg transition-colors"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 备份选择对话框 */}
      {backupDialog && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-qc-surface rounded-xl p-6 shadow-xl max-w-lg w-full mx-4 max-h-[80vh] flex flex-col border border-qc-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <i className="ti ti-history text-blue-600 text-xl"></i>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-qc-fg">
                  {t('settings.dataManagement.selectBackup')}
                </h3>
                <p className="text-sm text-qc-fg-muted">
                  {t('settings.dataManagement.selectBackupDesc')}
                </p>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
              {backupDialog.backups.map((backup, index) => (
                <button
                  key={index}
                  onClick={() => handleSelectBackup(backup.path)}
                  className="w-full flex items-center gap-3 p-3 border border-qc-border rounded-lg hover:bg-qc-hover transition-colors text-left"
                >
                  <i className="ti ti-file-zip text-blue-500 text-xl"></i>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-qc-fg truncate">
                      {backup.name}
                    </div>
                    <div className="text-xs text-qc-fg-muted flex gap-3">
                      <span>{backup.created_at}</span>
                      <span>{formatSize(backup.size)}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            
            <div className="mt-4 pt-4 border-t border-qc-border flex justify-end">
              <button
                onClick={() => setBackupDialog(null)}
                className="px-4 py-2 text-sm text-qc-fg-muted hover:text-qc-fg transition-colors"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export default DataManagementSection;
