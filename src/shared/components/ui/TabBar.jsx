// 设置中的Tab 栏组件
function TabBar({ tabs, activeTab, onTabChange, className = '' }) {
  return (
    <div className={`settings-tab-bar flex gap-2 px-6 py-3 bg-qc-panel border-b border-qc-border transition-colors duration-500 ${className}`}>
      {tabs.map(tab => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            className={`h-10 px-4 inline-flex items-center justify-center whitespace-nowrap text-sm font-medium rounded-lg transition-all duration-200 ${
              isActive
                ? 'qc-accent-button shadow-md'
                : 'text-qc-fg-muted hover:bg-qc-hover hover:shadow-sm'
            }`}
            style={isActive ? {
              backgroundColor: 'var(--qc-accent)',
              color: 'var(--qc-accent-fg)'
            } : undefined}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export default TabBar;
