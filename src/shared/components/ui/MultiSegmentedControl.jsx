import Toggle from './Toggle'

function MultiSegmentedControl({
  values = [],
  onChange,
  options,
  wrap = false,
  columns,
  className = ''
}) {
  const activeValues = Array.isArray(values) ? values : []
  const useGridLayout = wrap && Number.isInteger(columns) && columns > 1
  const containerClass = useGridLayout
    ? 'grid gap-2'
    : wrap
      ? 'flex flex-wrap gap-2'
      : 'inline-flex w-fit gap-2'
  const containerStyle = useGridLayout
    ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }
    : undefined

  const getItemClasses = optionValue => {
    const isActive = activeValues.includes(optionValue)

    return [
      'h-10 px-3 rounded-lg border transition-all duration-150',
      'flex items-center justify-between gap-3',
      'cursor-pointer select-none',
      isActive
        ? 'border-[var(--qc-accent)] bg-[var(--qc-accent)] text-[var(--qc-accent-fg)] shadow-md'
        : 'border-qc-border bg-transparent hover:bg-qc-hover'
    ].filter(Boolean).join(' ')
  }

  const handleToggle = optionValue => {
    if (!onChange) return

    const nextValues = activeValues.includes(optionValue)
      ? activeValues.filter(value => value !== optionValue)
      : [...activeValues, optionValue]

    onChange(nextValues)
  }

  return (
    <div className={`${containerClass} ${className}`} style={containerStyle}>
      {options.map(option => {
        const isActive = activeValues.includes(option.value)

        return (
          <div
            key={option.value}
            className={getItemClasses(option.value)}
            onClick={() => handleToggle(option.value)}
            role="switch"
            aria-checked={isActive}
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                handleToggle(option.value)
              }
            }}
          >
            <span className={`truncate text-sm font-medium ${isActive ? 'text-[var(--qc-accent-fg)]' : 'text-qc-fg'}`}>
              {option.label}
            </span>
            <div
              className="shrink-0 h-full flex items-center self-center"
              onClick={(event) => {
                event.stopPropagation()
              }}
            >
              <Toggle
                checked={isActive}
                contained={isActive}
                onChange={() => handleToggle(option.value)}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default MultiSegmentedControl
