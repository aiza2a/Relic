import { useTranslation } from 'react-i18next';
import SettingsSection from '../components/SettingsSection';
import SettingItem from '../components/SettingItem';
import Toggle from '@shared/components/ui/Toggle';
function PreviewSection({
  settings,
  onSettingChange
}) {
  const {
    t
  } = useTranslation();
  return <SettingsSection title={t('settings.quickpaste.title')} description={t('settings.quickpaste.description')}>
      <SettingItem label={t('settings.quickpaste.enabled')} description={t('settings.quickpaste.enabledDesc')}>
        <Toggle checked={settings.quickpasteEnabled} onChange={checked => onSettingChange('quickpasteEnabled', checked)} />
      </SettingItem>

      <SettingItem label={t('settings.quickpaste.pasteOnModifierRelease')} description={t('settings.quickpaste.pasteOnModifierReleaseDesc')}>
        <Toggle checked={settings.quickpastePasteOnModifierRelease} onChange={checked => onSettingChange('quickpastePasteOnModifierRelease', checked)} />
      </SettingItem>
    </SettingsSection>;
}
export default PreviewSection;