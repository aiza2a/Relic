import { useState, useEffect } from 'react';
import { useSnapshot } from 'valtio';
import { settingsStore } from '@shared/store/settingsStore';

function SidebarButton({
  id,
  icon: Icon,
  label,
  isActive,
  onClick,
  index
}) {
  const settings = useSnapshot(settingsStore);
  const uiAnimationEnabled = settings.uiAnimationEnabled !== false;
  const [particles, setParticles] = useState([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [bounceKey, setBounceKey] = useState(0);
  useEffect(() => {
    if (isAnimating && uiAnimationEnabled) {
      setBounceKey(prev => prev + 1);
      const newParticles = Array.from({
        length: 8
      }, (_, i) => ({
        id: Date.now() + i,
        angle: i * 45 + Math.random() * 20,
        distance: 15 + Math.random() * 10
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
    onClick(id);
  };
  return <div className="relative">
      <button key={`button-${bounceKey}`} onClick={handleClick} className={`
          group w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm font-medium 
          focus:outline-none
          ${uiAnimationEnabled ? 'active:scale-[0.98] animate-slide-in-left-fast' : ''}
          ${isActive 
            ? `qc-active-icon-button bg-[var(--qc-accent)] text-[var(--qc-accent-fg)] shadow-md ${uiAnimationEnabled ? 'scale-[1.02] animate-button-bounce' : ''}` 
            : `text-qc-fg-muted hover:bg-qc-hover hover:shadow-sm ${uiAnimationEnabled ? 'hover:scale-[1.01] hover:translate-x-0.5' : ''}`}
        `} style={uiAnimationEnabled ? {
      animationDelay: `${index * 25}ms`,
      animationFillMode: 'backwards',
      transitionProperty: 'transform, box-shadow, background-color, color',
      transitionDuration: '200ms, 200ms, 500ms, 500ms'
    } : {}}>
        <i className={`
    ${Icon}
    ${uiAnimationEnabled ? 'transition-transform duration-200' : ''}
    ${isActive ? (uiAnimationEnabled ? 'scale-110' : '') : (uiAnimationEnabled ? 'group-hover:scale-110 group-hover:rotate-3' : '')}
  `} style={{
        fontSize: 18
      }} data-strokewidth={2} />

        <span className={`${uiAnimationEnabled ? 'transition-transform duration-200 group-hover:translate-x-0.5' : ''} whitespace-nowrap`}>
          {label}
        </span>
      </button>

      {/* 粒子效果 */}
      {uiAnimationEnabled && particles.map(particle => <div key={particle.id} className="absolute top-1/2 left-6 w-1.5 h-1.5 rounded-full bg-blue-400 pointer-events-none" style={{
      '--particle-angle': `${particle.angle}deg`,
      '--particle-distance': `${particle.distance}px`,
      animation: 'particleExplosion 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards'
    }} />)}
    </div>;
}
export default SidebarButton;
