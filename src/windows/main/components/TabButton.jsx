import { useSnapshot } from 'valtio';
import { settingsStore } from '@shared/store/settingsStore';
import Tooltip from '@shared/components/common/Tooltip.jsx';

function TabButton({
  id,
  label,
  icon,
  isActive,
  onClick,
  index,
  buttonRef,
  navigationMode = 'horizontal',
  showLabel = true,
  badgeCount = 0
}) {
  const settings = useSnapshot(settingsStore);
  const uiAnimationEnabled = settings.uiAnimationEnabled !== false;
  const isSidebarLayout = navigationMode === 'sidebar';
  const tooltipPlacement = isSidebarLayout ? 'right' : 'bottom';

  const handleClick = () => {
    onClick(id);
  };

  const buttonClassName = `
    relative z-10 flex items-center rounded-lg
    focus:outline-none
    ${isSidebarLayout
      ? (showLabel
        ? 'justify-start px-3 gap-2 w-full h-9 whitespace-nowrap'
        : 'justify-center px-0 gap-0 w-10 h-9')
      : 'justify-center w-full h-full'}
    ${uiAnimationEnabled ? 'hover:scale-105' : ''}
    ${isActive
      ? 'qc-active-icon-button bg-[var(--qc-accent)] text-[var(--qc-accent-fg)] shadow-md hover:bg-[var(--qc-accent)]'
      : 'text-qc-fg-muted hover:bg-qc-hover'}
  `;
  const buttonStyle = uiAnimationEnabled ? {
    transitionProperty: 'transform, box-shadow, background-color, color',
    transitionDuration: '200ms, 200ms, 500ms, 500ms'
  } : {};
  const showBadge = Number(badgeCount) > 0;
  const badgeText = Number(badgeCount) > 99 ? '99+' : String(badgeCount);

  return (
    <div
      ref={buttonRef}
      className={isSidebarLayout
        ? (showLabel ? 'relative inline-flex h-9 w-full' : 'relative inline-flex h-9 w-10')
        : 'relative flex-1 h-7'}
    >
      <Tooltip content={label} placement={tooltipPlacement} asChild>
        <button
          onClick={handleClick}
          className={buttonClassName}
          style={buttonStyle}
        >
          <i className={icon} style={{ fontSize: 16 }} />
          {isSidebarLayout && showLabel && (
            <span className="text-[12px] font-medium leading-none truncate">
              {label}
            </span>
          )}
          {showBadge && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] leading-4 text-center">
              {badgeText}
            </span>
          )}
        </button>
      </Tooltip>
    </div>
  );
}

export default TabButton;
