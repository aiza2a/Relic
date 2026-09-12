import { useTranslation } from 'react-i18next';
import { useSnapshot } from 'valtio';
import { settingsStore } from '@shared/store/settingsStore';
import SettingsSection from '../components/SettingsSection';
import SettingItem from '../components/SettingItem';
import Toggle from '@shared/components/ui/Toggle';
import Select from '@shared/components/ui/Select';
import Slider from '@shared/components/ui/Slider';
import ShortcutInput from '../components/ShortcutInput';
import ShortcutComboInput from '../components/ShortcutComboInput';
import ReadonlyShortcut from '../components/ReadonlyShortcut';
import { useShortcutStatuses } from '@shared/hooks/useShortcutStatuses';
import { useShortcutDuplicateCheck } from '@shared/hooks/useShortcutDuplicateCheck';
import { promptDisableWinVHotkeyIfNeeded, promptEnableWinVHotkey } from '@shared/api/system';

function ShortcutsSection({ settings, onSettingChange, activeTab }) {
  const { t } = useTranslation();
  const globalSettings = useSnapshot(settingsStore);
  const uiAnimationEnabled = globalSettings.uiAnimationEnabled !== false;
  
  const { statuses, hasError: hasBackendError, getError: getBackendError, reload } = useShortcutStatuses();
  const { hasDuplicate, getDuplicateError } = useShortcutDuplicateCheck(settings);

  const handleShortcutChange = async (key, value) => {
    if (key === 'toggleShortcut' && value === 'Win+V' && settings.toggleShortcut !== 'Win+V') {
      try {
        const ok = await promptDisableWinVHotkeyIfNeeded();
        if (!ok) {
          setTimeout(() => reload(), 150);
          return;
        }
      } catch (error) {
        console.error('调用 Win+V 禁用提示命令失败:', error);
        setTimeout(() => reload(), 150);
        return;
      }
    }
    await onSettingChange(key, value);
    setTimeout(() => reload(), 150);
  };

  const getErrorMessage = (key, backendId) => {
    const duplicateError = getDuplicateError(key);
    const backendError = backendId ? getBackendError(backendId) : null;
    if (duplicateError && backendError) return `${duplicateError}；${backendError}`;
    return duplicateError || backendError;
  };

  const hasErrorStatus = (key, backendId) => {
    return hasDuplicate(key) || (backendId && hasBackendError(backendId));
  };

  const numberKeyTypeOptions = [
    { value: '1~9', label: '1~9' },
    { value: 'F', label: 'F1~F9' },
  ];
  const mouseModifierOptions = ['Ctrl', 'Shift', 'Alt'];
  const mouseTriggerOptions = [
    { value: 'short_press', label: t('settings.shortcuts.mouseMiddleTriggerShortPress') },
    { value: 'long_press', label: t('settings.shortcuts.mouseMiddleTriggerLongPress') }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'globalHotkey':
        return (
          <SettingsSection title={t('settings.shortcuts.globalTitle')} description={t('settings.shortcuts.globalDesc')}>
            <SettingItem label={t('settings.shortcuts.toggleWindow')} description={t('settings.shortcuts.toggleWindowDesc')}>
              <div className="flex flex-col items-end gap-1">
                <ShortcutInput
                  value={settings.toggleShortcut}
                  onChange={value => handleShortcutChange('toggleShortcut', value)}
                  onReset={() => handleShortcutChange('toggleShortcut', 'Shift+Space')}
                  presets={['Shift+Space', 'Win+V', 'Ctrl+Alt+V', 'F1']}
                  hasError={hasErrorStatus('toggleShortcut', 'toggle')}
                  errorMessage={getErrorMessage('toggleShortcut', 'toggle')}
                />
                <button
                  type="button"
                  className="text-xs text-blue-500 hover:text-blue-600 hover:underline"
                  onClick={async () => {
                    try {
                      await onSettingChange('toggleShortcut', 'Shift+Space');
                      await promptEnableWinVHotkey();
                      setTimeout(() => reload(), 150);
                    } catch (error) {
                      console.error('调用恢复系统 Win+V 命令失败:', error);
                    }
                  }}
                >
                  {t('settings.shortcuts.restoreSystemWinV')}
                </button>
              </div>
            </SettingItem>
            <SettingItem label={t('settings.shortcuts.openSettings')} description={t('settings.shortcuts.openSettingsDesc')}>
              <ShortcutInput value={settings.openSettingsShortcut} onChange={value => handleShortcutChange('openSettingsShortcut', value)} onReset={() => handleShortcutChange('openSettingsShortcut', '')} hasError={hasErrorStatus('openSettingsShortcut', 'open_settings')} errorMessage={getErrorMessage('openSettingsShortcut', 'open_settings')} />
            </SettingItem>
            <SettingItem label={t('settings.shortcuts.quickpasteWindow')} description={t('settings.shortcuts.quickpasteWindowDesc')}>
              <ShortcutInput value={settings.quickpasteShortcut} onChange={value => handleShortcutChange('quickpasteShortcut', value)} onReset={() => handleShortcutChange('quickpasteShortcut', 'Ctrl+`')} hasError={hasErrorStatus('quickpasteShortcut', 'quickpaste')} errorMessage={getErrorMessage('quickpasteShortcut', 'quickpaste')} />
            </SettingItem>
            <SettingItem label={t('settings.shortcuts.transferShelfCreate')} description={t('settings.shortcuts.transferShelfCreateDesc')}>
              <ShortcutInput value={settings.transferShelfCreateShortcut} onChange={value => handleShortcutChange('transferShelfCreateShortcut', value)} onReset={() => handleShortcutChange('transferShelfCreateShortcut', '')} hasError={hasErrorStatus('transferShelfCreateShortcut', 'transfer_shelf_create')} errorMessage={getErrorMessage('transferShelfCreateShortcut', 'transfer_shelf_create')} />
            </SettingItem>
            <SettingItem label={t('settings.shortcuts.webdavPush')} description={t('settings.shortcuts.webdavPushDesc')}>
              <ShortcutInput value={settings.webdavPushShortcut} onChange={value => handleShortcutChange('webdavPushShortcut', value)} onReset={() => handleShortcutChange('webdavPushShortcut', '')} hasError={hasErrorStatus('webdavPushShortcut', 'webdav_push')} errorMessage={getErrorMessage('webdavPushShortcut', 'webdav_push')} />
            </SettingItem>
            <SettingItem label={t('settings.shortcuts.webdavPull')} description={t('settings.shortcuts.webdavPullDesc')}>
              <ShortcutInput value={settings.webdavPullShortcut} onChange={value => handleShortcutChange('webdavPullShortcut', value)} onReset={() => handleShortcutChange('webdavPullShortcut', '')} hasError={hasErrorStatus('webdavPullShortcut', 'webdav_pull')} errorMessage={getErrorMessage('webdavPullShortcut', 'webdav_pull')} />
            </SettingItem>
            <SettingItem label={t('settings.shortcuts.toggleClipboardMonitor')} description={t('settings.shortcuts.toggleClipboardMonitorDesc')}>
              <ShortcutInput value={settings.toggleClipboardMonitorShortcut} onChange={value => handleShortcutChange('toggleClipboardMonitorShortcut', value)} onReset={() => handleShortcutChange('toggleClipboardMonitorShortcut', '')} hasError={hasErrorStatus('toggleClipboardMonitorShortcut', 'toggle_clipboard_monitor')} errorMessage={getErrorMessage('toggleClipboardMonitorShortcut', 'toggle_clipboard_monitor')} />
            </SettingItem>
            <SettingItem label={t('settings.shortcuts.togglePasteWithFormat')} description={t('settings.shortcuts.togglePasteWithFormatDesc')}>
              <ShortcutInput value={settings.togglePasteWithFormatShortcut} onChange={value => handleShortcutChange('togglePasteWithFormatShortcut', value)} onReset={() => handleShortcutChange('togglePasteWithFormatShortcut', '')} hasError={hasErrorStatus('togglePasteWithFormatShortcut', 'toggle_paste_with_format')} errorMessage={getErrorMessage('togglePasteWithFormatShortcut', 'toggle_paste_with_format')} />
            </SettingItem>
            <SettingItem label={t('settings.shortcuts.toggleLowMemoryMode')} description={t('settings.shortcuts.toggleLowMemoryModeDesc')}>
              <ShortcutInput value={settings.toggleLowMemoryModeShortcut} onChange={value => handleShortcutChange('toggleLowMemoryModeShortcut', value)} onReset={() => handleShortcutChange('toggleLowMemoryModeShortcut', '')} hasError={hasErrorStatus('toggleLowMemoryModeShortcut', 'toggle_low_memory_mode')} errorMessage={getErrorMessage('toggleLowMemoryModeShortcut', 'toggle_low_memory_mode')} />
            </SettingItem>
            <SettingItem label={t('settings.shortcuts.pastePlainText')} description={t('settings.shortcuts.pastePlainTextDesc')}>
              <ShortcutComboInput value={settings.pastePlainTextShortcut} onChange={value => handleShortcutChange('pastePlainTextShortcut', value)} modifierOptions={['Ctrl', 'Shift', 'Alt']} disabledKeys={['C', 'X', 'A', 'Z', 'Y']} hasError={hasErrorStatus('pastePlainTextShortcut', 'paste_plain_text')} errorMessage={getErrorMessage('pastePlainTextShortcut', 'paste_plain_text')} />
            </SettingItem>
          </SettingsSection>
        );

      case 'pinOps':
        return (
          <SettingsSection title={t('settings.shortcuts.pinTitle')} description={t('settings.shortcuts.pinDesc')}>
            <SettingItem label={t('settings.shortcuts.pinDrag')} description={t('settings.shortcuts.pinDragDesc')}>
              <ReadonlyShortcut keys={[t('settings.shortcuts.pinKeys.leftDrag')]} />
            </SettingItem>
            <SettingItem label={t('settings.shortcuts.pinClose')} description={t('settings.shortcuts.pinCloseDesc')}>
              <ReadonlyShortcut keys={[t('settings.shortcuts.pinKeys.doubleClick')]} />
            </SettingItem>
            <SettingItem label={t('settings.shortcuts.pinMenu')} description={t('settings.shortcuts.pinMenuDesc')}>
              <ReadonlyShortcut keys={[t('settings.shortcuts.pinKeys.rightClick')]} />
            </SettingItem>
            <SettingItem label={t('settings.shortcuts.pinThumbnail')} description={t('settings.shortcuts.pinThumbnailDesc')}>
              <ReadonlyShortcut keys={[t('settings.shortcuts.pinKeys.leftHold'), t('settings.shortcuts.pinKeys.rightClick')]} />
            </SettingItem>
            <SettingItem label={t('settings.shortcuts.pinZoom')} description={t('settings.shortcuts.pinZoomDesc')}>
              <ReadonlyShortcut keys={[t('settings.shortcuts.pinKeys.scroll')]} />
            </SettingItem>
            <SettingItem label={t('settings.shortcuts.pinZoomFast')} description={t('settings.shortcuts.pinZoomFastDesc')}>
              <ReadonlyShortcut keys={['Shift', t('settings.shortcuts.pinKeys.scroll')]} />
            </SettingItem>
            <SettingItem label={t('settings.shortcuts.pinZoomFine')} description={t('settings.shortcuts.pinZoomFineDesc')}>
              <ReadonlyShortcut keys={['Ctrl', t('settings.shortcuts.pinKeys.scroll')]} />
            </SettingItem>
            <SettingItem label={t('settings.shortcuts.pinInnerZoom')} description={t('settings.shortcuts.pinInnerZoomDesc')}>
              <ReadonlyShortcut keys={['Alt', t('settings.shortcuts.pinKeys.scroll')]} />
            </SettingItem>
            <SettingItem label={t('settings.shortcuts.pinInnerZoomFast')} description={t('settings.shortcuts.pinInnerZoomFastDesc')}>
              <ReadonlyShortcut keys={['Alt', 'Shift', t('settings.shortcuts.pinKeys.scroll')]} />
            </SettingItem>
            <SettingItem label={t('settings.shortcuts.pinInnerDrag')} description={t('settings.shortcuts.pinInnerDragDesc')}>
              <ReadonlyShortcut keys={['Alt', t('settings.shortcuts.pinKeys.leftDrag')]} />
            </SettingItem>
          </SettingsSection>
        );

      case 'navigation':
        return (
          <SettingsSection title={t('settings.shortcuts.windowTitle')} description={t('settings.shortcuts.windowDesc')}>
            <SettingItem label={t('settings.shortcuts.navigateUp')} description={t('settings.shortcuts.navigateUpDesc')}>
              <ShortcutInput value={settings.navigateUpShortcut} onChange={value => onSettingChange('navigateUpShortcut', value)} onReset={() => onSettingChange('navigateUpShortcut', 'ArrowUp')} hasError={hasErrorStatus('navigateUpShortcut')} errorMessage={getErrorMessage('navigateUpShortcut')} />
            </SettingItem>
            <SettingItem label={t('settings.shortcuts.navigateDown')} description={t('settings.shortcuts.navigateDownDesc')}>
              <ShortcutInput value={settings.navigateDownShortcut} onChange={value => onSettingChange('navigateDownShortcut', value)} onReset={() => onSettingChange('navigateDownShortcut', 'ArrowDown')} hasError={hasErrorStatus('navigateDownShortcut')} errorMessage={getErrorMessage('navigateDownShortcut')} />
            </SettingItem>
            <SettingItem label={t('settings.shortcuts.tabLeft')} description={t('settings.shortcuts.tabLeftDesc')}>
              <ShortcutInput value={settings.tabLeftShortcut} onChange={value => onSettingChange('tabLeftShortcut', value)} onReset={() => onSettingChange('tabLeftShortcut', 'ArrowLeft')} hasError={hasErrorStatus('tabLeftShortcut')} errorMessage={getErrorMessage('tabLeftShortcut')} />
            </SettingItem>
            <SettingItem label={t('settings.shortcuts.tabRight')} description={t('settings.shortcuts.tabRightDesc')}>
              <ShortcutInput value={settings.tabRightShortcut} onChange={value => onSettingChange('tabRightShortcut', value)} onReset={() => onSettingChange('tabRightShortcut', 'ArrowRight')} hasError={hasErrorStatus('tabRightShortcut')} errorMessage={getErrorMessage('tabRightShortcut')} />
            </SettingItem>
            <SettingItem label={t('settings.shortcuts.focusSearch')} description={t('settings.shortcuts.focusSearchDesc')}>
              <ShortcutInput value={settings.focusSearchShortcut} onChange={value => onSettingChange('focusSearchShortcut', value)} onReset={() => onSettingChange('focusSearchShortcut', 'Tab')} hasError={hasErrorStatus('focusSearchShortcut')} errorMessage={getErrorMessage('focusSearchShortcut')} />
            </SettingItem>
            <SettingItem label={t('settings.shortcuts.hideWindow')} description={t('settings.shortcuts.hideWindowDesc')}>
              <ShortcutInput value={settings.hideWindowShortcut} onChange={value => onSettingChange('hideWindowShortcut', value)} onReset={() => onSettingChange('hideWindowShortcut', 'Escape')} hasError={hasErrorStatus('hideWindowShortcut')} errorMessage={getErrorMessage('hideWindowShortcut')} />
            </SettingItem>
            <SettingItem label={t('settings.shortcuts.executeItem')} description={t('settings.shortcuts.executeItemDesc')}>
              <ShortcutInput value={settings.pasteItemShortcut} onChange={value => onSettingChange('pasteItemShortcut', value)} onReset={() => onSettingChange('pasteItemShortcut', 'Enter')} hasError={hasErrorStatus('pasteItemShortcut')} errorMessage={getErrorMessage('pasteItemShortcut')} />
            </SettingItem>
            <SettingItem label={t('settings.shortcuts.previousGroup')} description={t('settings.shortcuts.previousGroupDesc')}>
              <ShortcutInput value={settings.previousGroupShortcut} onChange={value => onSettingChange('previousGroupShortcut', value)} onReset={() => onSettingChange('previousGroupShortcut', 'Ctrl+ArrowUp')} hasError={hasErrorStatus('previousGroupShortcut')} errorMessage={getErrorMessage('previousGroupShortcut')} />
            </SettingItem>
            <SettingItem label={t('settings.shortcuts.nextGroup')} description={t('settings.shortcuts.nextGroupDesc')}>
              <ShortcutInput value={settings.nextGroupShortcut} onChange={value => onSettingChange('nextGroupShortcut', value)} onReset={() => onSettingChange('nextGroupShortcut', 'Ctrl+ArrowDown')} hasError={hasErrorStatus('nextGroupShortcut')} errorMessage={getErrorMessage('nextGroupShortcut')} />
            </SettingItem>
            <SettingItem label={t('settings.shortcuts.togglePin')} description={t('settings.shortcuts.togglePinDesc')}>
              <ShortcutInput value={settings.togglePinShortcut} onChange={value => onSettingChange('togglePinShortcut', value)} onReset={() => onSettingChange('togglePinShortcut', 'Ctrl+P')} hasError={hasErrorStatus('togglePinShortcut')} errorMessage={getErrorMessage('togglePinShortcut')} />
            </SettingItem>
          </SettingsSection>
        );

      case 'quickActions':
        return (
          <>
            <SettingsSection title={t('settings.shortcuts.numberTitle')} description={t('settings.shortcuts.numberDesc')}>
              <SettingItem label={t('settings.shortcuts.enableNumber')} description={t('settings.shortcuts.enableNumberDesc')}>
                <Toggle checked={settings.numberShortcuts} onChange={checked => onSettingChange('numberShortcuts', checked)} />
              </SettingItem>
              <SettingItem label={t('settings.shortcuts.numberModifier')} description={t('settings.shortcuts.numberModifierDesc')}>
                <ShortcutComboInput value={settings.numberShortcutsModifier} onChange={value => onSettingChange('numberShortcutsModifier', value)} modifierOptions={['Ctrl', 'Shift', 'Alt']} fixedKeyOptions={numberKeyTypeOptions} />
              </SettingItem>
              {hasBackendError('number_shortcuts') && (
                <div className="px-4 py-2 text-sm text-amber-600 bg-amber-50 rounded-md">
                  <span className="font-medium">{t('settings.shortcuts.numberRegistrationFailed')}：</span>
                  {statuses['number_shortcuts']?.shortcut}
                </div>
              )}
            </SettingsSection>
            <SettingsSection title={t('settings.shortcuts.mouseTitle')} description={t('settings.shortcuts.mouseDesc')}>
              <SettingItem label={t('settings.shortcuts.enableMouseMiddle')} description={t('settings.shortcuts.enableMouseMiddleDesc')}>
                <Toggle checked={settings.mouseMiddleButtonEnabled} onChange={checked => onSettingChange('mouseMiddleButtonEnabled', checked)} />
              </SettingItem>
              <SettingItem label={t('settings.shortcuts.mouseMiddleModifier')} description={t('settings.shortcuts.mouseMiddleModifierDesc')}>
                <ShortcutComboInput value={settings.mouseMiddleButtonModifier === 'None' ? '' : settings.mouseMiddleButtonModifier} onChange={value => onSettingChange('mouseMiddleButtonModifier', value || 'None')} modifierOptions={mouseModifierOptions} fixedKey={t('settings.shortcuts.middleButton')} allowEmpty />
              </SettingItem>
              {settings.mouseMiddleButtonModifier === 'None' && (
                <SettingItem label={t('settings.shortcuts.mouseMiddleTrigger')} description={t('settings.shortcuts.mouseMiddleTriggerDesc')}>
                  <Select value={settings.mouseMiddleButtonTrigger} onChange={value => onSettingChange('mouseMiddleButtonTrigger', value)} options={mouseTriggerOptions} className="w-56" />
                </SettingItem>
              )}
              {settings.mouseMiddleButtonModifier === 'None' && (
                <SettingItem label={t('settings.shortcuts.mouseMiddleLongPressThreshold')} description={t('settings.shortcuts.mouseMiddleLongPressThresholdDesc')}>
                  <Slider value={settings.mouseMiddleButtonLongPressMs} onChange={value => onSettingChange('mouseMiddleButtonLongPressMs', value)} min={100} max={1000} step={50} unit="ms" />
                </SettingItem>
              )}
            </SettingsSection>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className={uiAnimationEnabled ? 'animate-slide-in-left-fast-no-opacity' : ''} key={activeTab}>
      {renderTabContent()}
    </div>
  );
}

export default ShortcutsSection;
