import { useState, useEffect } from 'react';
import { useSnapshot } from 'valtio';
import { settingsStore } from '@shared/store/settingsStore';

function ThemeOption({
  option,
  isActive,
  onClick
}) {
  const settings = useSnapshot(settingsStore);
  const uiAnimationEnabled = settings.uiAnimationEnabled !== false;
  const [particles, setParticles] = useState([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);
  useEffect(() => {
    if (isAnimating && uiAnimationEnabled) {
      const newParticles = Array.from({
        length: 10
      }, (_, i) => ({
        id: Date.now() + i,
        angle: i * 36 + Math.random() * 20,
        distance: 20 + Math.random() * 15
      }));
      setParticles(newParticles);
      const timer = setTimeout(() => {
        setParticles([]);
        setIsAnimating(false);
      }, 600);
      return () => clearTimeout(timer);
    } else if (isAnimating) {
      setIsAnimating(false);
    }
  }, [isAnimating, uiAnimationEnabled]);
  const handleClick = () => {
    setIsAnimating(true);
    setAnimationKey(prev => prev + 1);
    onClick();
  };
  return <div className="relative w-full">
      <button onClick={handleClick} className={`
          theme-option-button w-full flex flex-col items-center gap-2 p-3 rounded-lg border-2 
          overflow-visible
          focus:outline-none
          ${uiAnimationEnabled ? 'transition-all duration-300 active:scale-95' : ''}
          ${isActive 
            ? `is-active border-[var(--qc-accent)] bg-[var(--qc-accent)] text-[var(--qc-accent-fg)] shadow-md ${uiAnimationEnabled ? 'scale-105' : ''}` 
            : `border-qc-border hover:border-qc-border-strong ${uiAnimationEnabled ? 'hover:scale-102 hover:shadow-md' : ''}`}
        `}>
        <div key={animationKey} className={`w-full h-16 rounded-md shadow-sm ${isActive && uiAnimationEnabled ? 'animate-theme-bounce' : ''}`} style={{
        background: option.preview
      }} />
        <span className={`text-xs font-medium ${isActive ? 'text-[var(--qc-accent-fg)]' : 'text-qc-fg-muted'}`}>
          {option.label}
        </span>
      </button>

      {/* 粒子效果 */}
      {uiAnimationEnabled && particles.map(particle => <div key={particle.id} className="absolute top-1/2 left-1/2 w-2 h-2 rounded-full bg-blue-400 pointer-events-none" style={{
      '--particle-angle': `${particle.angle}deg`,
      '--particle-distance': `${particle.distance}px`,
      animation: 'particleExplosion 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards'
    }} />)}
    </div>;
}
export default ThemeOption;
