// 设置项容器组件
function SettingItem({
  label,
  description,
  children,
  stacked = false
}) {
  const anchor = typeof label === 'string' ? encodeURIComponent(label) : '';
  const labelBlock = (
    <>
      <label className="block text-sm font-semibold leading-5 text-qc-fg">
        {label}
      </label>
      {description && (
        <p className="mt-1 text-xs leading-5 text-qc-fg-subtle">
          {description}
        </p>
      )}
    </>
  );

  if (stacked) {
    return (
      <div className="flex flex-col gap-3 py-3.5 border-b border-qc-border last:border-0" data-setting-anchor={anchor}>
        <div>{labelBlock}</div>
        <div className="min-w-0 w-full">{children}</div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between py-3.5 border-b border-qc-border last:border-0" data-setting-anchor={anchor}>
      <div className="flex-1 pr-6 min-w-0">
        {labelBlock}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}
export default SettingItem;
