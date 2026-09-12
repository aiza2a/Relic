import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { showError, showMessage } from '@shared/utils/dialog';
import * as imageLibrary from '@shared/api/imageLibrary';
import GroupEditModal from '../GroupEditModal.jsx';

const DEFAULT_IMAGE_GROUP_NAME = '默认';

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
  'ti ti-mood-smile', 'ti ti-mood-happy', 'ti ti-mood-wink',
  'ti ti-mood-heart', 'ti ti-mood-kid', 'ti ti-face-id',
  'ti ti-heart', 'ti ti-heart-filled', 'ti ti-message-circle-heart',
  'ti ti-star', 'ti ti-star-filled', 'ti ti-sparkles',
  'ti ti-icons', 'ti ti-sticker', 'ti ti-gif',
  'ti ti-photo', 'ti ti-library-photo', 'ti ti-camera',
  'ti ti-palette', 'ti ti-brush', 'ti ti-color-swatch',
  'ti ti-balloon', 'ti ti-gift', 'ti ti-cake', 'ti ti-confetti',
  'ti ti-flower', 'ti ti-plant', 'ti ti-sun', 'ti ti-moon',
  'ti ti-cloud', 'ti ti-bolt', 'ti ti-flame',
  'ti ti-crown', 'ti ti-diamond', 'ti ti-music',
  'ti ti-device-gamepad-2', 'ti ti-ghost', 'ti ti-alien',
  'ti ti-robot', 'ti ti-apple', 'ti ti-pizza',
  'ti ti-coffee', 'ti ti-shirt', 'ti ti-car', 'ti ti-plane',
  'ti ti-baby-carriage', 'ti ti-friends', 'ti ti-user-heart',
];

function ImageGroupModal({ group, onClose, onSave }) {
  const { t } = useTranslation();
  const [name, setName] = useState(group?.name || '');
  const [selectedIcon, setSelectedIcon] = useState(group?.icon || 'ti ti-photo');
  const [selectedColor, setSelectedColor] = useState(group?.color || '#2563eb');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const isEditing = Boolean(group);
  const isDefaultGroup = group?.name === DEFAULT_IMAGE_GROUP_NAME;
  const itemCount = group?.item_count || 0;
  const canDelete = isEditing && !isDefaultGroup;

  useEffect(() => {
    setName(group?.name || '');
    setSelectedIcon(group?.icon || 'ti ti-photo');
    setSelectedColor(group?.color || '#2563eb');
    setShowDeleteConfirm(false);
  }, [group]);

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      await showMessage(t('groups.modal.nameRequired'), t('common.confirm'));
      return;
    }

    setSaving(true);
    try {
      const savedGroup = group
        ? await imageLibrary.updateImageGroup(group.name, trimmedName, selectedIcon, selectedColor)
        : await imageLibrary.addImageGroup(trimmedName, selectedIcon, selectedColor);
      onSave?.(savedGroup);
    } catch (error) {
      console.error('保存图库分组失败:', error);
      await showError(t('common.saveFailed'), t('common.confirm'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGroup = async (moveImagesToDefault) => {
    if (!canDelete || deleting) return;

    setDeleting(true);
    try {
      const groups = await imageLibrary.deleteImageGroup(group.name, moveImagesToDefault);
      onSave?.({ deleted: true, deletedName: group.name, groups });
    } catch (error) {
      console.error('删除图库分组失败:', error);
      await showError(t('groups.deleteFailed'), t('common.confirm'));
    } finally {
      setDeleting(false);
    }
  };

  const deleteContent = showDeleteConfirm ? (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-md border border-red-200 bg-red-50 p-3 text-red-700">
        <i className="ti ti-alert-triangle mt-0.5 text-lg"></i>
        <div className="min-w-0">
          <div className="text-sm font-semibold">
            {t('groups.imageDelete.title', { name: group.name })}
          </div>
          <div className="mt-1 text-xs leading-relaxed">
            {itemCount > 0
              ? t('groups.imageDelete.nonEmptyDesc', { count: itemCount, target: DEFAULT_IMAGE_GROUP_NAME })
              : t('groups.imageDelete.emptyDesc')}
          </div>
        </div>
      </div>

      {itemCount > 0 ? (
        <div className="space-y-2">
          <button
            onClick={() => handleDeleteGroup(true)}
            disabled={deleting}
            className="w-full px-3 py-2 text-sm font-medium rounded-md border border-qc-border text-qc-fg hover:bg-qc-hover transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <i className="ti ti-folder-symlink text-base"></i>
            {t('groups.imageDelete.moveThenDelete')}
          </button>
          <button
            onClick={() => handleDeleteGroup(false)}
            disabled={deleting}
            className="w-full px-3 py-2 text-sm font-medium rounded-md bg-red-500 text-white hover:bg-red-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <i className="ti ti-trash text-base"></i>
            {t('groups.imageDelete.deleteAll')}
          </button>
        </div>
      ) : (
        <button
          onClick={() => handleDeleteGroup(false)}
          disabled={deleting}
          className="w-full px-3 py-2 text-sm font-medium rounded-md bg-red-500 text-white hover:bg-red-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <i className="ti ti-trash text-base"></i>
          {t('groups.imageDelete.deleteEmpty')}
        </button>
      )}
    </div>
  ) : null;

  return (
    <GroupEditModal
      title={isEditing ? t('groups.modal.titleEdit') : t('groups.modal.titleNew')}
      name={name}
      icon={selectedIcon}
      color={selectedColor}
      presetColors={PRESET_COLORS}
      availableIcons={AVAILABLE_ICONS}
      saving={saving || deleting}
      nameDisabled={isDefaultGroup}
      onNameChange={setName}
      onIconChange={setSelectedIcon}
      onColorChange={setSelectedColor}
      onClose={onClose}
      onSave={handleSave}
      customContent={deleteContent}
      showSave={!showDeleteConfirm}
      onCancel={showDeleteConfirm ? () => setShowDeleteConfirm(false) : onClose}
      footerStart={canDelete && !showDeleteConfirm ? (
        <button
          onClick={() => setShowDeleteConfirm(true)}
          disabled={saving || deleting}
          className="mr-auto px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          <i className="ti ti-trash text-base"></i>
          {t('groups.delete')}
        </button>
      ) : null}
    />
  );
}

export default ImageGroupModal;
