import '@tabler/icons-webfont/dist/tabler-icons.min.css';
import { useTranslation } from 'react-i18next';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Virtuoso } from 'react-virtuoso';
import SettingsSection from '../components/SettingsSection';
import Toggle from '@shared/components/ui/Toggle';
import Input from '@shared/components/ui/Input';
import Button from '@shared/components/ui/Button';
import SegmentedControl from '@shared/components/ui/SegmentedControl';
import Tooltip from '@shared/components/common/Tooltip.jsx';

import { getAllWindowsInfo } from '@shared/api/settings';

const listItemClass = 'flex h-10 items-center gap-2 rounded-md border border-transparent bg-qc-panel px-2.5 py-0 hover:border-qc-border hover:bg-qc-hover transition-colors';

function normalizeAppName(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function findAvailableAppMatch(appName, availableApps) {
  const appNameLower = normalizeAppName(appName).toLowerCase();
  if (!appNameLower) return null;

  const exactMatch = availableApps.find(app => normalizeAppName(app?.process).toLowerCase() === appNameLower);
  if (exactMatch) return exactMatch;

  const fuzzyMatches = availableApps.filter(app => {
    const processLower = normalizeAppName(app?.process).toLowerCase();
    return processLower && (processLower.includes(appNameLower) || appNameLower.includes(processLower));
  });
  return fuzzyMatches.length === 1 ? fuzzyMatches[0] : null;
}

function dedupeAppNames(items, availableApps = []) {
  const seen = new Set();
  const result = [];
  items.forEach(item => {
    const name = normalizeAppName(item);
    const matchedApp = findAvailableAppMatch(name, availableApps);
    const canonicalName = normalizeAppName(matchedApp?.process) || name;
    const key = canonicalName.toLowerCase();
    if (!canonicalName || seen.has(key)) return;
    seen.add(key);
    result.push(canonicalName);
  });
  return result;
}

function isSameAppNameList(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function hasAppName(items, appName) {
  const key = normalizeAppName(appName).toLowerCase();
  return Boolean(key) && items.some(item => item.toLowerCase() === key);
}

function normalizeKeySet(items) {
  return new Set(items.map(item => normalizeAppName(item).toLowerCase()).filter(Boolean));
}

function toggleSetValue(items, value) {
  const key = normalizeAppName(value).toLowerCase();
  if (!key) return items;
  const next = normalizeKeySet(items);
  if (next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
  }
  return Array.from(next);
}

function pruneSelectedKeys(items, existingNames) {
  const existingKeys = normalizeKeySet(existingNames);
  return items.filter(item => existingKeys.has(normalizeAppName(item).toLowerCase()));
}

function pruneSelectedKeysStable(items, existingNames) {
  const pruned = pruneSelectedKeys(items, existingNames);
  return isSameAppNameList(items, pruned) ? items : pruned;
}

function AppIcon({ src }) {
  return src ? <img src={src} alt="" className="w-4 h-4 flex-shrink-0" /> : null;
}

function StatusPill({
  label,
  value,
  active = false
}) {
  return (
    <span className={`rounded-lg border px-3 py-1.5 text-xs ${active ? 'border-[var(--qc-accent)] bg-qc-active text-qc-fg' : 'border-qc-border bg-qc-panel-2 text-qc-fg-muted'}`}>
      <span className="text-qc-fg-muted">{label}</span>
      <span className="ml-1 font-semibold">{value}</span>
    </span>
  );
}

function IconTransferButton({
  icon,
  label,
  onClick,
  disabled = false,
  loading = false
}) {
  return (
    <Tooltip content={label} asChild>
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        disabled={disabled || loading}
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-qc-border bg-qc-panel-2 text-qc-fg transition-colors hover:bg-qc-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        <i className={`${icon} text-lg ${loading ? 'animate-spin' : ''}`}></i>
      </button>
    </Tooltip>
  );
}

function AppListItem({
  name,
  icon,
  selected,
  actionIcon,
  actionLabel,
  selectLabel,
  onToggleSelected,
  onAction
}) {
  const selectedRowStyle = selected
    ? {
        borderColor: 'var(--qc-accent)',
        backgroundColor: 'var(--qc-active)',
        boxShadow: 'inset 3px 0 0 var(--qc-accent)'
      }
    : undefined;
  const selectedButtonStyle = selected
    ? {
        borderColor: 'var(--qc-accent)',
        backgroundColor: 'var(--qc-accent)',
        color: 'var(--qc-accent-fg)',
        boxShadow: '0 0 0 2px var(--qc-active)'
      }
    : undefined;

  return (
    <div className={`app-filter-list-item ${listItemClass}`} style={selectedRowStyle}>
      <button
        type="button"
        aria-label={selectLabel}
        aria-pressed={selected}
        onClick={onToggleSelected}
        className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border border-qc-border bg-qc-panel-2 text-transparent transition-colors hover:border-[var(--qc-accent)] hover:text-qc-fg-muted"
        style={selectedButtonStyle}
      >
        <i className="ti ti-check text-sm"></i>
      </button>
      <AppIcon src={icon} />
      <span className={`min-w-0 flex-1 truncate text-sm text-qc-fg ${selected ? 'font-semibold' : ''}`}>
        {name}
      </span>
      <button
        type="button"
        onClick={onAction}
        className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded text-qc-fg-muted transition-colors hover:bg-qc-hover hover:text-[var(--qc-accent)]"
        aria-label={actionLabel}
      >
        <i className={`${actionIcon} w-4 h-4`}></i>
      </button>
    </div>
  );
}

function AppListPanel({
  title,
  description,
  meta,
  items,
  emptyText,
  getKey,
  renderItem
}) {
  return (
    <div className="app-filter-list-panel min-w-0 overflow-hidden rounded-lg border border-qc-border bg-qc-surface/50">
      <div className="flex items-center justify-between gap-3 border-b border-qc-border px-3 py-3">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold leading-5 text-qc-fg">
            {title}
          </h4>
          {description && (
            <p className="truncate text-xs leading-5 text-qc-fg-subtle">
              {description}
            </p>
          )}
        </div>
        {meta && (
          <span className="flex-shrink-0 rounded-md border border-qc-border bg-qc-panel-2 px-2 py-1 text-xs text-qc-fg-muted">
            {meta}
          </span>
        )}
      </div>
      <div className="h-[24rem] overflow-hidden bg-qc-panel-2 p-2">
        {items.length === 0 ? (
          <div className="flex h-full items-center justify-center px-3 text-center text-sm text-qc-fg-muted">
            {emptyText}
          </div>
        ) : (
          <Virtuoso
            totalCount={items.length}
            computeItemKey={index => getKey(items[index], index)}
            itemContent={index => <div className={index === 0 ? '' : 'mt-2'}>{renderItem(items[index], index)}</div>}
            style={{ height: '100%' }}
          />
        )}
      </div>
    </div>
  );
}

function AppFilterSection({
  settings,
  onSettingChange
}) {
  const {
    t
  } = useTranslation();
  const [customAppInput, setCustomAppInput] = useState('');
  const [blocklist, setBlocklist] = useState([]);
  const [availableApps, setAvailableApps] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [appIconMap, setAppIconMap] = useState(new Map());
  const [selectedAvailableApps, setSelectedAvailableApps] = useState([]);
  const [selectedBlockedApps, setSelectedBlockedApps] = useState([]);
  const filterEffect = settings.appFilterEffect === 'global_disable' ? 'global_disable' : 'clipboard_only';
  const effectOptions = [
    {
      value: 'clipboard_only',
      label: t('settings.appFilter.effectClipboardOnly')
    },
    {
      value: 'global_disable',
      label: t('settings.appFilter.effectGlobalDisable')
    }
  ];
  const effectLabel = filterEffect === 'clipboard_only'
    ? t('settings.appFilter.effectClipboardOnly')
    : t('settings.appFilter.effectGlobalDisable');
  const effectDescription = filterEffect === 'clipboard_only'
    ? t('settings.appFilter.effectClipboardOnlyDesc')
    : t('settings.appFilter.effectGlobalDisableDesc');

  useEffect(() => {
    const value = settings.appFilterBlocklist;
    let nextBlocklist = [];
    if (Array.isArray(value)) {
      nextBlocklist = dedupeAppNames(value, availableApps);
    } else if (typeof value === 'string') {
      nextBlocklist = dedupeAppNames(value.split('\n'), availableApps);
    }
    setBlocklist(prev => isSameAppNameList(prev, nextBlocklist) ? prev : nextBlocklist);
    if ((Array.isArray(value) || typeof value === 'string') && !isSameAppNameList(value, nextBlocklist)) {
      onSettingChange('appFilterBlocklist', nextBlocklist);
    }
  }, [settings.appFilterBlocklist, availableApps, onSettingChange]);

  const commitBlocklist = useCallback(nextList => {
    const normalized = dedupeAppNames(nextList, availableApps);
    setBlocklist(normalized);
    onSettingChange('appFilterBlocklist', normalized);
  }, [availableApps, onSettingChange]);

  const matchAppIcon = useCallback(appName => {
    const matchedApp = findAvailableAppMatch(appName, availableApps);
    return matchedApp?.icon;
  }, [availableApps]);

  const handleAddCustomApp = () => {
    const appName = normalizeAppName(customAppInput);
    const matchedApp = findAvailableAppMatch(appName, availableApps);
    const canonicalName = normalizeAppName(matchedApp?.process) || appName;
    if (!canonicalName || hasAppName(blocklist, canonicalName)) return;
    commitBlocklist([...blocklist, canonicalName]);
    const icon = matchedApp?.icon || matchAppIcon(canonicalName);
    if (icon) {
      setAppIconMap(prev => new Map(prev).set(canonicalName, icon));
    }
    setCustomAppInput('');
  };

  const handleRemoveApp = appName => {
    const key = normalizeAppName(appName).toLowerCase();
    commitBlocklist(blocklist.filter(item => item.toLowerCase() !== key));
    setSelectedBlockedApps(prev => prev.filter(item => item !== key));
  };

  const handleClearList = () => {
    commitBlocklist([]);
    setSelectedBlockedApps([]);
  };

  const handleRefreshWindows = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const windows = await getAllWindowsInfo();
      const uniqueApps = [];
      const seenProcesses = new Set();
      const iconMap = new Map();
      for (const win of windows) {
        if (!win?.process) continue;
        const key = win.process.toLowerCase();
        if (!seenProcesses.has(key)) {
          seenProcesses.add(key);
          uniqueApps.push(win);
          if (win.icon) iconMap.set(win.process, win.icon);
        }
      }
      setAvailableApps(uniqueApps.sort((a, b) => a.process.localeCompare(b.process)));
      setAppIconMap(prevIconMap => new Map([...prevIconMap, ...iconMap]));
    } catch (error) {
      console.error('获取窗口信息失败:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    handleRefreshWindows();
  }, [handleRefreshWindows]);

  const handleAddAvailableApp = appInfo => {
    const appName = normalizeAppName(appInfo?.process || appInfo);
    if (!appName || hasAppName(blocklist, appName)) return;
    commitBlocklist([...blocklist, appName]);
    setSelectedAvailableApps(prev => prev.filter(item => item !== appName.toLowerCase()));
    if (typeof appInfo === 'object' && appInfo.icon) {
      setAppIconMap(prev => new Map(prev).set(appName, appInfo.icon));
    }
  };

  const availableToAdd = useMemo(
    () => availableApps.filter(app => app?.process && !hasAppName(blocklist, app.process)),
    [availableApps, blocklist]
  );
  const selectedAvailableSet = useMemo(() => normalizeKeySet(selectedAvailableApps), [selectedAvailableApps]);
  const selectedBlockedSet = useMemo(() => normalizeKeySet(selectedBlockedApps), [selectedBlockedApps]);
  const selectedAvailableToAdd = useMemo(
    () => availableToAdd.filter(app => selectedAvailableSet.has(app.process.toLowerCase())),
    [availableToAdd, selectedAvailableSet]
  );
  const selectedBlockedToRemove = useMemo(
    () => blocklist.filter(app => selectedBlockedSet.has(app.toLowerCase())),
    [blocklist, selectedBlockedSet]
  );
  const handleAddAllAvailable = () => {
    if (availableToAdd.length === 0) return;
    commitBlocklist([...blocklist, ...availableToAdd.map(app => app.process)]);
    setSelectedAvailableApps([]);
  };
  const handleAddSelectedAvailable = () => {
    if (selectedAvailableToAdd.length === 0) return;
    commitBlocklist([...blocklist, ...selectedAvailableToAdd.map(app => app.process)]);
    setSelectedAvailableApps([]);
  };
  const handleRemoveSelectedBlocked = () => {
    if (selectedBlockedToRemove.length === 0) return;
    const removingKeys = normalizeKeySet(selectedBlockedToRemove);
    commitBlocklist(blocklist.filter(app => !removingKeys.has(app.toLowerCase())));
    setSelectedBlockedApps(prev => prev.filter(item => !removingKeys.has(item)));
  };
  const statusDescription = settings.appFilterEnabled
    ? t('settings.appFilter.blocklistStatus', { count: blocklist.length })
    : t('settings.appFilter.enabledDesc');

  useEffect(() => {
    setSelectedAvailableApps(prev => pruneSelectedKeysStable(prev, availableToAdd.map(app => app.process)));
  }, [availableToAdd]);

  useEffect(() => {
    setSelectedBlockedApps(prev => pruneSelectedKeysStable(prev, blocklist));
  }, [blocklist]);

  return (
    <SettingsSection title={t('settings.appFilter.title')} description={t('settings.appFilter.description')}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-qc-border pb-4">
          <div className="flex items-center gap-3">
            <Toggle checked={settings.appFilterEnabled} onChange={checked => onSettingChange('appFilterEnabled', checked)} />
            <div className="min-w-0">
              <div className="text-sm font-semibold leading-5 text-qc-fg">
                {settings.appFilterEnabled ? t('settings.appFilter.statusTitle') : t('settings.appFilter.enabled')}
              </div>
              <div className="text-xs leading-5 text-qc-fg-subtle">
                {statusDescription}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusPill label={t('settings.appFilter.blocklistApps')} value={String(blocklist.length)} active={settings.appFilterEnabled} />
            <StatusPill label={t('settings.appFilter.effectTitle')} value={effectLabel} active={settings.appFilterEnabled} />
          </div>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-qc-border bg-qc-surface/50 p-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold leading-5 text-qc-fg">
              {t('settings.appFilter.effectTitle')}
            </div>
            <div className="text-xs leading-5 text-qc-fg-subtle">
              {effectDescription}
            </div>
          </div>
          <SegmentedControl
            value={filterEffect}
            onChange={value => onSettingChange('appFilterEffect', value)}
            options={effectOptions}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-qc-border bg-qc-surface/50 p-3">
          <div className="min-w-0 flex-1">
            <Input
              value={customAppInput}
              onChange={e => setCustomAppInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddCustomApp()}
              placeholder={t('settings.appFilter.inputPlaceholder')}
              className="w-full"
            />
          </div>
          <Button onClick={handleAddCustomApp} icon={<i className="ti ti-plus"></i>} size="sm">
            {t('settings.appFilter.addToBlocklist')}
          </Button>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-2">
          <AppListPanel
            title={t('settings.appFilter.allApps')}
            description={t('settings.appFilter.allAppsDesc')}
            meta={t('settings.appFilter.selectedCount', { count: selectedAvailableToAdd.length })}
            items={availableToAdd}
            emptyText={t('settings.appFilter.noAllApps')}
            getKey={(app, index) => app?.process || `avail-${index}`}
            renderItem={app => app && (
              <AppListItem
                name={app.process}
                icon={app.icon}
                selected={selectedAvailableSet.has(app.process.toLowerCase())}
                actionIcon="ti ti-plus"
                actionLabel={t('settings.appFilter.addToBlocklist')}
                selectLabel={t(selectedAvailableSet.has(app.process.toLowerCase()) ? 'settings.appFilter.unselectApp' : 'settings.appFilter.selectApp', { app: app.process })}
                onToggleSelected={() => setSelectedAvailableApps(prev => toggleSetValue(prev, app.process))}
                onAction={() => handleAddAvailableApp(app)}
              />
            )}
          />

          <div className="flex min-h-[24rem] flex-col items-center justify-center gap-3 py-1">
            <div className="flex flex-col items-center gap-2">
              <IconTransferButton
                icon="ti ti-arrow-right"
                label={t('settings.appFilter.addSelectedToBlocklist')}
                onClick={handleAddSelectedAvailable}
                disabled={selectedAvailableToAdd.length === 0}
              />
              <IconTransferButton
                icon="ti ti-arrow-left"
                label={t('settings.appFilter.removeSelectedFromBlocklist')}
                onClick={handleRemoveSelectedBlocked}
                disabled={selectedBlockedToRemove.length === 0}
              />
            </div>
            <IconTransferButton
              icon="ti ti-refresh"
              label={t('settings.common.refresh')}
              onClick={handleRefreshWindows}
              loading={isRefreshing}
            />
            <div className="flex flex-col items-center gap-2">
              <IconTransferButton
                icon="ti ti-chevrons-right"
                label={t('settings.appFilter.addAllToBlocklist')}
                onClick={handleAddAllAvailable}
                disabled={availableToAdd.length === 0}
              />
              <IconTransferButton
                icon="ti ti-chevrons-left"
                label={t('settings.appFilter.removeAllFromBlocklist')}
                onClick={handleClearList}
                disabled={blocklist.length === 0}
              />
            </div>
          </div>

          <AppListPanel
            title={t('settings.appFilter.blocklistApps')}
            description={t('settings.appFilter.blocklistDesc')}
            meta={t('settings.appFilter.selectedCount', { count: selectedBlockedToRemove.length })}
            items={blocklist}
            emptyText={t('settings.appFilter.noBlocklistApps')}
            getKey={(app, index) => app || `block-${index}`}
            renderItem={app => (
              <AppListItem
                name={app}
                icon={appIconMap.get(app)}
                selected={selectedBlockedSet.has(app.toLowerCase())}
                actionIcon="ti ti-x"
                actionLabel={t('settings.appFilter.removeFromBlocklist')}
                selectLabel={t(selectedBlockedSet.has(app.toLowerCase()) ? 'settings.appFilter.unselectApp' : 'settings.appFilter.selectApp', { app })}
                onToggleSelected={() => setSelectedBlockedApps(prev => toggleSetValue(prev, app))}
                onAction={() => handleRemoveApp(app)}
              />
            )}
          />
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-lg border border-qc-border bg-qc-panel-2 px-3 py-2 text-xs leading-5 text-qc-fg-subtle">
          <span className="inline-flex items-center gap-1">
            <i className="ti ti-info-circle text-qc-fg-muted"></i>
            {t('settings.appFilter.tip1')}
          </span>
          <span>{t('settings.appFilter.tip2')}</span>
        </div>
      </div>
    </SettingsSection>
  );
}
export default AppFilterSection;
