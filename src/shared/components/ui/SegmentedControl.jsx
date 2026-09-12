function SegmentedControl({
  value,
  onChange,
  options,
  wrap = false,
  columns,
  className = ''
}) {
  const containerClass = wrap
    ? 'grid gap-0 overflow-hidden rounded-lg border border-qc-border bg-qc-panel'
    : 'inline-flex w-fit overflow-hidden rounded-lg border border-qc-border bg-qc-panel';

  const containerStyle = wrap && columns
    ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }
    : undefined;

  const getButtonClasses = (optionValue, index) => {
    if (wrap) {
      const cols = Math.max(1, Number(columns) || 1);
      const row = Math.floor(index / cols);
      const col = index % cols;
      const lastIndex = options.length - 1;
      const lastRow = Math.floor(lastIndex / cols);
      const lastInFirstRow = Math.min(cols - 1, lastIndex);

      return [
        'px-3 py-2 text-sm font-medium transition-colors duration-150',
        'focus:outline-none focus:ring-2 focus:ring-[var(--qc-accent)] focus:ring-inset',
        col !== 0 ? 'border-l border-qc-border' : '',
        row !== 0 ? 'border-t border-qc-border' : '',
        index === 0 ? 'rounded-tl-lg' : '',
        index === lastInFirstRow ? 'rounded-tr-lg' : '',
        row === lastRow && col === 0 ? 'rounded-bl-lg' : '',
        index === lastIndex ? 'rounded-br-lg' : '',
        value === optionValue
          ? 'qc-accent-button !bg-[var(--qc-accent)] hover:!bg-[var(--qc-accent-hover)] !text-[var(--qc-accent-fg)]'
          : 'bg-transparent text-qc-fg hover:bg-qc-hover'
      ].filter(Boolean).join(' ');
    }

    return [
      'px-3 py-2 text-sm font-medium transition-colors duration-150',
      'focus:outline-none focus:ring-2 focus:ring-[var(--qc-accent)] focus:ring-inset',
      index === 0 ? 'rounded-l-lg' : '',
      index === options.length - 1 ? 'rounded-r-lg' : '',
      index !== 0 ? 'border-l border-qc-border' : '',
      value === optionValue
        ? 'qc-accent-button !bg-[var(--qc-accent)] hover:!bg-[var(--qc-accent-hover)] !text-[var(--qc-accent-fg)]'
        : 'bg-transparent text-qc-fg hover:bg-qc-hover'
    ].filter(Boolean).join(' ');
  };

  return (
    <div className={`${containerClass} ${className}`} style={containerStyle}>
      {options.map((option, index) => (
        <button
          key={option.value}
          type="button"
          className={getButtonClasses(option.value, index)}
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default SegmentedControl;
