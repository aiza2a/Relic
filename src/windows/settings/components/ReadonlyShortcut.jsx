// 只读快捷键展示组件，用于展示不可修改的操作快捷键
function ReadonlyShortcut({ keys, groups }) {
  const renderKeyGroup = (keyList, groupIndex) => {
    const list = Array.isArray(keyList) ? keyList : [keyList];
    return (
      <span key={groupIndex} className="flex items-center gap-1.5">
        {list.map((key, index) => (
          <span key={index} className="flex items-center gap-1.5">
            {index > 0 && <span className="text-qc-fg-subtle text-xs">+</span>}
            <kbd className="px-2 py-1 text-xs font-medium bg-qc-panel-2 text-qc-fg rounded border border-qc-border shadow-sm min-w-[28px] text-center">
              {key}
            </kbd>
          </span>
        ))}
      </span>
    );
  };

  if (groups && groups.length > 0) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {groups.map((group, index) => (
          <span key={index} className="flex items-center gap-2">
            {index > 0 && <span className="text-qc-fg-subtle text-xs">/</span>}
            {renderKeyGroup(group, index)}
          </span>
        ))}
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-1.5">
      {renderKeyGroup(keys, 0)}
    </div>
  );
}

export default ReadonlyShortcut;
