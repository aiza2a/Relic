function Textarea({
  value,
  onChange,
  rows = 3,
  placeholder,
  className = '',
  ...props
}) {
  const baseClassName = 'px-3 py-2 w-full text-sm border border-qc-border rounded-lg bg-qc-panel text-qc-fg placeholder:text-qc-fg-subtle focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none';
  return <textarea value={value} onChange={onChange} rows={rows} placeholder={placeholder} className={`${baseClassName} ${className}`} {...props} />;
}
export default Textarea;