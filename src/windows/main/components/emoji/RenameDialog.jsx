import { useTranslation } from 'react-i18next';
import SimpleInputDialog from '../SimpleInputDialog';

function RenameDialog({ value, onChange, onConfirm, onCancel }) {
  const { t } = useTranslation();

  return (
    <SimpleInputDialog
      title={t('common.rename', '重命名')}
      value={value}
      onChange={onChange}
      onConfirm={onConfirm}
      onCancel={onCancel}
      allowEmpty={false}
    />
  );
}

export default RenameDialog;
