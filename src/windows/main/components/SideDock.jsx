import '@tabler/icons-webfont/dist/tabler-icons.min.css';
import { useTranslation } from 'react-i18next';
import Tooltip from '@shared/components/common/Tooltip.jsx';
import GroupsPopup from './GroupsPopup';

const FILTER_IDS = ['text', 'image', 'file', 'link'];

// 右侧竖排功能坞：内容筛选、粘贴状态筛选、符号模式与分组入口
function SideDock({
  showTabs = false,
  activeTab,
  contentFilter,
  onFilterChange,
  pasteFilter,
  onPasteFilterChange,
  emojiMode,
  onEmojiModeChange,
  onGroupChange,
  groupsPopupRef,
}) {
  const { t } = useTranslation();

  const filters = [{
    id: 'text',
    label: t('filter.text') || '文本',
    icon: 'ti ti-file-text'
  }, {
    id: 'image',
    label: t('filter.image') || '图片',
    icon: 'ti ti-photo'
  }, {
    id: 'file',
    label: t('filter.file') || '文件',
    icon: 'ti ti-folder'
  }, {
    id: 'link',
    label: t('filter.link') || '链接',
    icon: 'ti ti-link'
  }];
  const pasteFilters = [{
    id: 'unpasted',
    label: '未粘贴',
    icon: 'ti ti-clipboard-x'
  }, {
    id: 'pasted',
    label: '已粘贴',
    icon: 'ti ti-clipboard-check'
  }];
  const emojiModes = [{
    id: 'emoji',
    label: t('emoji.emoji') || 'Emoji',
    icon: 'ti ti-mood-smile',
    emoji: '😀'
  }, {
    id: 'symbols',
    label: t('emoji.symbols') || '符号',
    icon: 'ti ti-math-symbols'
  }, {
    id: 'images',
    label: t('emoji.images') || '图片',
    icon: 'ti ti-photo-star'
  }];

  const selectedFilters = String(contentFilter || 'all')
    .split(',')
    .map(value => value.trim())
    .filter(value => FILTER_IDS.includes(value));
  const isFilterSelected = id => selectedFilters.includes(id);
  const selectedPasteFilters = String(pasteFilter || 'all')
    .split(',')
    .map(value => value.trim())
    .filter(value => pasteFilters.some(filter => filter.id === value));
  const isPasteFilterSelected = id => selectedPasteFilters.includes(id);

  const buttonClasses = isActive =>
    `relative z-10 flex items-center justify-center w-8 h-8 rounded-lg focus:outline-none transition-colors duration-200 ${
      isActive
        ? 'qc-active-icon-button bg-[var(--qc-accent)] text-[var(--qc-accent-fg)] shadow-md hover:bg-[var(--qc-accent)]'
        : 'text-qc-fg-muted hover:bg-qc-hover'
    }`;

  const tabs = [{
    id: 'clipboard',
    label: '剪贴板',
    icon: 'ti ti-clipboard-text'
  }, {
    id: 'favorites',
    label: '收藏',
    icon: 'ti ti-star'
  }, {
    id: 'emoji',
    label: '符号',
    icon: 'ti ti-mood-smile'
  }];

  return (
    <div
      className="flex h-full w-11 flex-shrink-0 flex-col items-center gap-1 border-l border-qc-border bg-qc-panel px-1.5 py-2 overflow-y-auto"
      data-no-drag
    >
      {showTabs && tabs.map(tab => (
        <Tooltip key={tab.id} content={tab.label} placement="left" asChild>
          <button
            type="button"
            className={`flex items-center justify-center w-8 h-8 rounded-lg focus:outline-none transition-colors duration-200 ${
              activeTab === tab.id
                ? 'qc-active-icon-button bg-[var(--qc-accent)] text-[var(--qc-accent-fg)] shadow-md hover:bg-[var(--qc-accent)]'
                : 'text-qc-fg-muted hover:bg-qc-hover'
            }`}
            onClick={() => window.dispatchEvent(new CustomEvent('relic-switch-tab', { detail: tab.id }))}
          >
            <i className={tab.icon} style={{ fontSize: 15 }} />
          </button>
        </Tooltip>
      ))}
      {showTabs && <div
        className="my-1 h-px w-6 shrink-0"
        style={{ backgroundColor: 'var(--bg-titlebar-border, var(--qc-border-strong))', opacity: 0.95 }}
      />}
      {activeTab === 'emoji'
        ? emojiModes.map(mode => (
            <Tooltip key={mode.id} content={mode.label} placement="left" asChild>
              <button
                type="button"
                className={buttonClasses(emojiMode === mode.id)}
                onClick={() => onEmojiModeChange(mode.id)}
              >
                {mode.emoji ? <span style={{ fontSize: 15 }}>{mode.emoji}</span> : <i className={mode.icon} style={{ fontSize: 15 }} />}
              </button>
            </Tooltip>
          ))
        : [...filters, ...pasteFilters].map(filter => {
            const isActive = FILTER_IDS.includes(filter.id)
              ? isFilterSelected(filter.id)
              : isPasteFilterSelected(filter.id);
            return (
              <Tooltip key={filter.id} content={filter.label} placement="left" asChild>
                <button
                  type="button"
                  className={buttonClasses(isActive)}
                  onClick={() =>
                    FILTER_IDS.includes(filter.id)
                      ? onFilterChange(filter.id)
                      : onPasteFilterChange(filter.id)}
                >
                  <i className={filter.icon} style={{ fontSize: 15 }} />
                </button>
              </Tooltip>
            );
          })}

      <div
        className="my-1 h-px w-6 shrink-0"
        style={{ backgroundColor: 'var(--bg-titlebar-border, var(--qc-border-strong))', opacity: 0.95 }}
      />

      <div className="w-full flex justify-center">
        <GroupsPopup
          ref={groupsPopupRef}
          activeTab={activeTab}
          onTabChange={() => {}}
          onGroupChange={onGroupChange}
          onOpenChange={() => {}}
          mode="tab"
          compactTrigger
        />
      </div>
    </div>
  );
}

export default SideDock;
