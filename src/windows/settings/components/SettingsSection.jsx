// 设置区块组件
function SettingsSection({
  title,
  description,
  children,
  className = ''
}) {
  return <div className={`settings-section mb-6 ${className}`}>
    <div className="settings-section-header inline-flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-3 bg-qc-panel border border-qc-border border-b-0 rounded-t-xl -mb-px">
      <h2 className="text-lg font-semibold text-qc-fg">
        {title}
      </h2>
      {description && (
        <span className="text-xs leading-4 text-qc-fg-muted">
          {description}
        </span>
      )}
    </div>
    <div className="settings-section-content px-5 py-5 bg-qc-panel border border-qc-border rounded-tr-xl rounded-br-xl rounded-bl-xl">
      {children}
    </div>
  </div>;
}

export default SettingsSection;
