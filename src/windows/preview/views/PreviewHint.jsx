function PreviewHint({ children, className = '', style }) {
  return (
    <div
      className={`preview-hint px-2 py-0.5 rounded text-[11px] leading-4 text-qc-fg border border-qc-border/70 shadow-sm select-none whitespace-nowrap ${className}`}
      style={{
        backgroundColor: 'color-mix(in srgb, var(--qc-surface) 72%, transparent)',
        backdropFilter: 'blur(var(--theme-superbg-blur-8, 8px))',
        WebkitBackdropFilter: 'blur(var(--theme-superbg-blur-8, 8px))',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export default PreviewHint;
