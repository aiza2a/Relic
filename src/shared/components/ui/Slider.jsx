import { useState, useEffect } from 'react';
function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  unit = '',
  className = '',
  sliderClassName = ''
}) {
  const [displayValue, setDisplayValue] = useState(value);
  const [isDragging, setIsDragging] = useState(false);
  
  useEffect(() => {
    setDisplayValue(value);
  }, [value]);
  
  const handleInput = e => {
    const newValue = parseFloat(e.target.value);
    setDisplayValue(newValue);
  };
  
  const handleMouseDown = () => {
    setIsDragging(true);
  };
  
  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      onChange(displayValue);
    }
  };
  
  const handleTouchEnd = () => {
    if (isDragging) {
      setIsDragging(false);
      onChange(displayValue);
    }
  };
  
  return <div className={`flex items-center justify-end gap-2 ${className}`}>
      <input 
        type="range" 
        min={min} 
        max={max} 
        step={step} 
        value={displayValue} 
        onInput={handleInput}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onTouchEnd={handleTouchEnd}
        className={`h-2 bg-qc-panel-2 rounded-lg appearance-none cursor-pointer accent-[var(--qc-accent)] ${sliderClassName || 'w-24'}`} 
      />
      <span className="text-sm font-medium text-qc-fg-muted whitespace-nowrap">
        {displayValue}{unit}
      </span>
    </div>;
}
export default Slider;
