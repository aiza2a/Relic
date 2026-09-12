import { useState, useEffect } from 'react';
import { useSnapshot } from 'valtio';
import { settingsStore } from '@shared/store/settingsStore';

function Toggle({
  checked,
  onChange,
  disabled = false,
  contained = false
}) {
  const settings = useSnapshot(settingsStore);
  const uiAnimationEnabled = settings.uiAnimationEnabled !== false;
  const [particles, setParticles] = useState([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);
  useEffect(() => {
    if (isAnimating && uiAnimationEnabled) {
      const newParticles = Array.from({
        length: 8
      }, (_, i) => ({
        id: Date.now() + i,
        angle: i * 45 + Math.random() * 20,
        distance: 12 + Math.random() * 8
      }));
      setParticles(newParticles);
      const timer = setTimeout(() => {
        setParticles([]);
        setIsAnimating(false);
      }, 500);
      return () => clearTimeout(timer);
    } else if (isAnimating) {
      setIsAnimating(false);
    }
  }, [isAnimating, uiAnimationEnabled]);
  const handleClick = () => {
    if (disabled) return;
    const newChecked = !checked;
    setIsAnimating(true);
    setAnimationKey(prev => prev + 1);
    onChange(newChecked);
  };
  const handleKeyDown = e => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const newChecked = !checked;
      setIsAnimating(true);
      setAnimationKey(prev => prev + 1);
      onChange(newChecked);
    }
  };
  const trackBackgroundColor = checked
    ? (contained
      ? 'var(--qc-toggle-track-contained-on, rgba(255, 255, 255, 0.28))'
      : 'var(--qc-toggle-track-on, #3b82f6)')
    : 'var(--qc-toggle-track-off, var(--qc-panel-2))';
  const trackBorderColor = checked && contained
    ? 'rgba(255, 255, 255, 0.36)'
    : 'var(--qc-border)';
  const thumbBackgroundColor = checked && contained
    ? 'var(--qc-accent-fg, #ffffff)'
    : 'var(--qc-toggle-thumb, var(--qc-surface))';
  return <div className="relative flex h-6 items-center">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={`w-11 h-6 rounded-full relative overflow-visible transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer border border-qc-border ${uiAnimationEnabled ? 'hover:scale-105 active:scale-95' : ''}`}
        style={{
          backgroundColor: trackBackgroundColor,
          borderColor: trackBorderColor
        }}
      >
        <span
          className="absolute top-1/2 left-0"
          style={{ transform: 'translateY(-50%)' }}
        >
          <span
            key={animationKey}
            className={`block w-5 h-5 rounded-full transition-transform duration-200 ring-1 ring-qc-border-strong shadow-md ${uiAnimationEnabled ? 'animate-toggle-bounce' : ''}`}
            style={uiAnimationEnabled ? {
              '--toggle-start': checked ? '2px' : '22px',
              '--toggle-end': checked ? '22px' : '2px',
              backgroundColor: thumbBackgroundColor
            } : {
              transform: checked ? 'translateX(22px)' : 'translateX(2px)',
              backgroundColor: thumbBackgroundColor
            }}
          />
        </span>

        {/* 粒子效果 */}
        {uiAnimationEnabled && particles.map(particle => <div key={particle.id} className="absolute top-1/2 w-1.5 h-1.5 rounded-full bg-blue-400 pointer-events-none" style={{
        left: checked ? 'calc(100% - 12px)' : '12px',
        '--particle-angle': `${particle.angle}deg`,
        '--particle-distance': `${particle.distance}px`,
        animation: 'particleExplosion 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards'
      }} />)}
      </button>
    </div>;
}
export default Toggle;
