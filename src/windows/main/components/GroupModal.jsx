import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { addGroup, updateGroup } from '@shared/store/groupsStore';
import { showMessage, showError } from '@shared/utils/dialog';
import GroupEditModal from './GroupEditModal.jsx';

const PRESET_COLORS = [
  '#dc2626',
  '#ea580c',
  '#ca8a04',
  '#16a34a',
  '#2563eb',
  '#7c3aed',
  '#6b7280',
];

const AVAILABLE_ICONS = [
  'ti ti-folder', 'ti ti-folder-plus',
  'ti ti-file', 'ti ti-file-text',
  'ti ti-book', 'ti ti-books',
  'ti ti-notebook', 'ti ti-note', 'ti ti-notes',
  'ti ti-clipboard', 'ti ti-archive',
  'ti ti-package', 'ti ti-box',
  'ti ti-photo', 'ti ti-video',
  'ti ti-music', 'ti ti-palette',
  'ti ti-code', 'ti ti-bulb',
  'ti ti-link', 'ti ti-link-plus',
  'ti ti-paperclip',
  'ti ti-mail', 'ti ti-mail-opened',
  'ti ti-message', 'ti ti-message-circle', 'ti ti-message-dots',
  'ti ti-send', 'ti ti-share',
  'ti ti-user', 'ti ti-users', 'ti ti-building',
  'ti ti-school', 'ti ti-certificate',
  'ti ti-tag', 'ti ti-category', 'ti ti-bookmark',
  'ti ti-star', 'ti ti-heart',
  'ti ti-flag',
  'ti ti-calendar',
  'ti ti-list', 'ti ti-checklist',
  'ti ti-map-pin',
  'ti ti-database', 'ti ti-manual-gearbox',
  'ti ti-chart-bar', 'ti ti-chart-pie',
  'ti ti-layers-intersect', 'ti ti-filter',
  'ti ti-language',
  'ti ti-home',
  'ti ti-device-desktop',
  'ti ti-world',
  'ti ti-cloud',
  'ti ti-shopping-cart',
  'ti ti-gift',
  'ti ti-lock',
  'ti ti-search'
];

function GroupModal({
  group,
  onClose,
  onSave
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(group?.name || '');
  const [selectedIcon, setSelectedIcon] = useState(group?.icon || 'ti ti-folder');
  const [selectedColor, setSelectedColor] = useState(group?.color || '#dc2626');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (group) {
      setName(group.name);
      setSelectedIcon(group.icon);
      setSelectedColor(group.color || '#dc2626');
    } else {
      setName('');
      setSelectedIcon('ti ti-folder');
      setSelectedColor('#dc2626');
    }
  }, [group]);

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      await showMessage(t('groups.modal.nameRequired'), t('common.confirm'));
      return;
    }
    setSaving(true);
    try {
      if (group) {
        await updateGroup(group.name, trimmedName, selectedIcon, selectedColor);
      } else {
        await addGroup(trimmedName, selectedIcon, selectedColor);
      }
      onSave?.();
    } catch (error) {
      console.error('保存分组失败:', error);
      await showError(t('groups.deleteFailed'), t('common.confirm'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <GroupEditModal
      title={group ? t('groups.modal.titleEdit') : t('groups.modal.titleNew')}
      name={name}
      icon={selectedIcon}
      color={selectedColor}
      presetColors={PRESET_COLORS}
      availableIcons={AVAILABLE_ICONS}
      saving={saving}
      onNameChange={setName}
      onIconChange={setSelectedIcon}
      onColorChange={setSelectedColor}
      onClose={onClose}
      onSave={handleSave}
    />
  );
}

export default GroupModal;
