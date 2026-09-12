import '@tabler/icons-webfont/dist/tabler-icons.min.css';
function Button({
  children,
  variant = 'primary',
  size = 'md',
  onClick,
  disabled = false,
  loading = false,
  icon,
  className = '',
  ...props
}) {
  const sizeClasses = {
    sm: 'h-9 px-3 text-sm',
    md: 'h-10 px-4 text-sm',
    lg: 'h-11 px-6 text-lg'
  };
  const baseClasses = `${sizeClasses[size]} rounded-lg font-medium transition-all duration-200 inline-flex items-center gap-2 justify-center whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed`;
  const variantClasses = {
    primary: 'bg-blue-500 hover:bg-blue-600 text-white',
    secondary: 'bg-qc-panel-2 hover:bg-qc-hover text-qc-fg border border-qc-border',
    danger: 'bg-red-500 hover:bg-red-600 text-white'
  };
  const isDisabled = disabled || loading;
  return <button onClick={onClick} disabled={isDisabled} className={`${baseClasses} ${variantClasses[variant]} ${className}`} {...props}>
      {loading ? <i className="ti ti-loader-2 h-4 w-4 animate-spin text-current"></i> : icon ? <span>{icon}</span> : null}
      {children}
    </button>;
}
export default Button;
