import '@tabler/icons-webfont/dist/tabler-icons.min.css';
import { useTranslation } from 'react-i18next';
import Tooltip from '@shared/components/common/Tooltip.jsx';

function EditorToolbar({
  onReset,
  title,
  onTitleChange,
  wordWrap,
  onWordWrapChange,
  showTitle = true,
  groups = [],
  selectedGroup = '全部',
  onGroupChange,
  showGroupSelector = false,
  editableTypes = ['text'],
  editMode = 'text',
  onEditModeChange,
}) {
  const { t } = useTranslation();
  const showModeSwitch = editableTypes.length > 1;

  const buttonClasses = `
    flex items-center gap-1 px-3 h-8
    rounded
    text-sm font-medium
    bg-qc-surface
    hover:bg-qc-hover
    text-qc-fg
    border border-qc-border
    transition-colors
    cursor-pointer
  `.trim().replace(/\s+/g, ' ');

  const activeButtonClasses = `
    flex items-center gap-1 px-3 h-8
    rounded
    text-sm font-medium
    bg-blue-500
    hover:bg-blue-600
    text-white
    border border-blue-500
    transition-colors
    cursor-pointer
  `.trim().replace(/\s+/g, ' ');

  const modeButtonClasses = `
    h-8 px-3 text-sm
    border-r border-qc-border
    last:border-r-0
    transition-colors
  `.trim().replace(/\s+/g, ' ');

  return (
    <div className="text-editor-toolbar min-h-12 flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b border-qc-border bg-qc-surface/80 backdrop-blur-sm">
      <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
        {showTitle ? (
          <>
            <div className="flex items-center gap-2 min-w-0">
              <label className="text-sm text-qc-fg-muted whitespace-nowrap">
                {t('textEditor.titleLabel')}:
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder={t('textEditor.titlePlaceholder')}
                className="text-editor-input min-w-32 max-w-48 h-8 px-2 text-sm rounded border border-qc-border bg-qc-surface text-qc-fg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {showGroupSelector && (
              <div className="flex items-center gap-2">
                <label className="text-sm text-qc-fg-muted whitespace-nowrap">
                  {t('textEditor.group')}:
                </label>
                <select
                  value={selectedGroup}
                  onChange={(e) => onGroupChange(e.target.value)}
                  className="text-editor-input h-8 px-2 text-sm rounded border border-qc-border bg-qc-surface text-qc-fg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {groups.map((group) => (
                    <option key={group.name} value={group.name}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </>
        ) : (
          <div className="text-sm font-medium text-qc-fg truncate">
            {title}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {showModeSwitch && (
          <div className="text-editor-mode-switch flex items-center rounded border border-qc-border bg-qc-surface overflow-hidden">
            <button
              className={`${modeButtonClasses} ${editMode === 'text' ? 'bg-blue-500 text-white border-blue-500' : 'text-qc-fg hover:bg-qc-hover'}`}
              onClick={() => onEditModeChange?.('text')}
            >
              {t('textEditor.plainText')}
            </button>
            <button
              className={`${modeButtonClasses} ${editMode === 'html' ? 'bg-blue-500 text-white border-blue-500' : 'text-qc-fg hover:bg-qc-hover'}`}
              onClick={() => onEditModeChange?.('html')}
            >
              {t('textEditor.htmlMode', 'HTML')}
            </button>
          </div>
        )}

        <Tooltip content={t('textEditor.wordWrap')} placement="bottom" asChild>
          <button className={wordWrap ? activeButtonClasses : buttonClasses} onClick={onWordWrapChange}>
            <i className="ti ti-text-wrap" style={{ fontSize: 16 }}></i>
          </button>
        </Tooltip>

        <Tooltip content={t('textEditor.reset')} placement="bottom" asChild>
          <button className={buttonClasses} onClick={onReset}>
            <i className="ti ti-refresh" style={{ fontSize: 16 }}></i>
          </button>
        </Tooltip>
      </div>
    </div>
  );
}

export default EditorToolbar;
