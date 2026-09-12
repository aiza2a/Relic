function Select({
  value,
  onChange,
  options,
  className = '',
  disabled = false
}) {
  return <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled} className={`px-3 py-2 bg-qc-panel border border-qc-border rounded-lg text-qc-fg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${className}`}>
      {options.map(option => <option key={option.value} value={option.value}>
          {option.label}
        </option>)}
    </select>;
}
export default Select;
