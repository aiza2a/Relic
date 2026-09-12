import { cloneElement, isValidElement, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSnapshot } from 'valtio';
import { settingsStore } from '@shared/store/settingsStore';

function mergeRefs(...refs) {
  return (node) => {
    refs.forEach((ref) => {
      if (!ref) return;
      if (typeof ref === 'function') {
        ref(node);
      } else {
        ref.current = node;
      }
    });
  };
}

function callAll(...fns) {
  return (...args) => {
    fns.forEach((fn) => {
      if (typeof fn === 'function') fn(...args);
    });
  };
}

function getOppositePlacement(placement) {
  switch (placement) {
    case 'top':
      return 'bottom';
    case 'bottom':
      return 'top';
    case 'left':
      return 'right';
    case 'right':
      return 'left';
    default:
      return 'top';
  }
}

function uniquePlacements(list) {
  const seen = new Set();
  const result = [];
  list.forEach((p) => {
    if (!p || seen.has(p)) return;
    seen.add(p);
    result.push(p);
  });
  return result;
}

export default function Tooltip({
  content,
  shortcut,
  placement = 'top',
  offset = 8,
  openDelay = 150,
  closeDelay = 100,
  disabled = false,
  asChild = false,
  maxWidth = 320,
  forceOpen,
  children,
}) {
  const settings = useSnapshot(settingsStore);

  const tooltipId = useId();
  const triggerRef = useRef(null);
  const tooltipRef = useRef(null);
  const openTimerRef = useRef(0);
  const closeTimerRef = useRef(0);

  const globallyDisabled = !settings.tooltipsEnabled;
  const isDisabled = disabled || globallyDisabled;

  const [open, setOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [position, setPosition] = useState({ top: -9999, left: -9999 });
  const [effectivePlacement, setEffectivePlacement] = useState(placement);
  const [arrowOffsetPos, setArrowOffsetPos] = useState(0);

  const arrowHeight = 3;
  const arrowSafePadding = 12;

  const clearTimers = useCallback(() => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = 0;
    }
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = 0;
    }
  }, []);

  const scheduleOpen = useCallback(() => {
    if (typeof forceOpen === 'boolean') return;
    if (isDisabled || !content) return;
    if (open) return;
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = 0;
    }
    if (openTimerRef.current) return;
    openTimerRef.current = setTimeout(() => {
      openTimerRef.current = 0;
      setOpen(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
    }, openDelay);
  }, [content, isDisabled, open, openDelay, forceOpen]);

  const scheduleClose = useCallback(() => {
    if (typeof forceOpen === 'boolean') return;
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = 0;
    }
    if (!open) return;
    if (closeTimerRef.current) return;
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = 0;
      setIsAnimating(false);
      setTimeout(() => {
        setOpen(false);
      }, 150);
    }, closeDelay);
  }, [closeDelay, open, forceOpen]);

  useEffect(() => {
    if (typeof forceOpen !== 'boolean') return;
    const nextOpen = Boolean(forceOpen);
    setOpen(nextOpen);
    if (nextOpen) {
      if (openTimerRef.current) {
        clearTimeout(openTimerRef.current);
        openTimerRef.current = 0;
      }
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = 0;
      }
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
    } else {
      setIsAnimating(false);
    }
  }, [forceOpen]);

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  useEffect(() => {
    if (!open) {
      setIsAnimating(false);
    }
  }, [open]);

  useEffect(() => {
    if (isDisabled && open) {
      clearTimers();
      setIsAnimating(false);
      setOpen(false);
    }
  }, [isDisabled, open, clearTimers]);

  const computePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const tip = tooltipRef.current;
    if (!trigger || !tip) return;

    const triggerRect = trigger.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();

    const viewportWidth = document.documentElement?.clientWidth || window.innerWidth;
    const viewportHeight = document.documentElement?.clientHeight || window.innerHeight;
    const margin = 8;

    const computeForPlacement = (p) => {
      let top = 0;
      let left = 0;

      if (p === 'top') {
        top = triggerRect.top - offset - arrowHeight - tipRect.height;
        left = triggerRect.left + triggerRect.width / 2 - tipRect.width / 2;
      } else if (p === 'bottom') {
        top = triggerRect.bottom + offset + arrowHeight;
        left = triggerRect.left + triggerRect.width / 2 - tipRect.width / 2;
      } else if (p === 'left') {
        top = triggerRect.top + triggerRect.height / 2 - tipRect.height / 2;
        left = triggerRect.left - offset - arrowHeight - tipRect.width;
      } else {
        top = triggerRect.top + triggerRect.height / 2 - tipRect.height / 2;
        left = triggerRect.right + offset + arrowHeight;
      }

      return { top, left, placement: p };
    };

    const fits = ({ top, left }) => {
      if (left < margin) return false;
      if (top < margin) return false;
      if (left + tipRect.width > viewportWidth - margin) return false;
      if (top + tipRect.height > viewportHeight - margin) return false;
      return true;
    };

    const candidates = uniquePlacements([
      placement,
      getOppositePlacement(placement),
      'top',
      'bottom',
      'right',
      'left',
    ]);

    let chosen = null;
    for (const p of candidates) {
      const candidate = computeForPlacement(p);
      if (fits(candidate)) {
        chosen = candidate;
        break;
      }
    }

    const base = chosen || computeForPlacement(placement);
    const clampedLeft = Math.min(
      Math.max(base.left, margin),
      viewportWidth - margin - tipRect.width
    );
    const clampedTop = Math.min(
      Math.max(base.top, margin),
      viewportHeight - margin - tipRect.height
    );

    setPosition({ top: clampedTop, left: clampedLeft });
    setEffectivePlacement((prev) => (prev === base.placement ? prev : base.placement));

    const triggerCenterX = triggerRect.left + triggerRect.width / 2;
    const triggerCenterY = triggerRect.top + triggerRect.height / 2;

    if (base.placement === 'top' || base.placement === 'bottom') {
      const localX = triggerCenterX - clampedLeft;
      const clamped = Math.min(
        Math.max(localX, arrowSafePadding),
        Math.max(arrowSafePadding, tipRect.width - arrowSafePadding)
      );
      setArrowOffsetPos(clamped);
    } else {
      const localY = triggerCenterY - clampedTop;
      const clamped = Math.min(
        Math.max(localY, arrowSafePadding),
        Math.max(arrowSafePadding, tipRect.height - arrowSafePadding)
      );
      setArrowOffsetPos(clamped);
    }
  }, [offset, placement]);

  useLayoutEffect(() => {
    if (!open) return;
    computePosition();
  }, [open, computePosition, content, shortcut]);

  useEffect(() => {
    if (!open) return;
    const handleReposition = () => computePosition();
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    return () => {
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [open, computePosition]);

  const getAnimationClass = () => {
    const baseTransition = 'transition-all duration-150 ease-out';
    if (isAnimating) {
      return `${baseTransition} opacity-100 translate-x-0 translate-y-0`;
    }
    if (effectivePlacement === 'top') {
      return `${baseTransition} opacity-0 -translate-y-2`;
    }
    if (effectivePlacement === 'bottom') {
      return `${baseTransition} opacity-0 translate-y-2`;
    }
    if (effectivePlacement === 'left') {
      return `${baseTransition} opacity-0 -translate-x-2`;
    }
    return `${baseTransition} opacity-0 translate-x-2`;
  };

  const isBackgroundTheme = typeof document !== 'undefined'
    ? document.body?.classList?.contains('theme-background') === true
    : false;

  const panelBgClass = isBackgroundTheme ? 'bg-qc-panel/75 backdrop-blur-md' : 'bg-qc-panel';
  const arrowFillBgClass = isBackgroundTheme
    ? 'after:bg-qc-panel/75 after:backdrop-blur-md'
    : 'after:bg-qc-panel';

  const tooltipNode =
    open &&
    createPortal(
      <div
        id={tooltipId}
        role="tooltip"
        className="fixed z-[9999999] pointer-events-none"
        style={{ top: position.top, left: position.left }}
      >
        <div
          ref={tooltipRef}
          className={
            `relative isolate px-2 py-1 rounded-md ${panelBgClass} text-[11px] font-medium text-qc-fg leading-snug ring-1 ring-qc-border ` +
            getAnimationClass() +
            ' ' +
            (effectivePlacement === 'top'
              ? ("before:content-[''] before:absolute before:z-10 before:pointer-events-none before:left-[var(--qc-tooltip-arrow-offset)] before:top-full before:translate-x-[-50%] before:translate-y-[-1px] before:w-[16px] before:h-[8px] before:bg-qc-border before:[clip-path:polygon(50%_100%,0_0,100%_0)] after:content-[''] after:absolute after:z-20 after:pointer-events-none after:left-[var(--qc-tooltip-arrow-offset)] after:top-full after:translate-x-[-50%] after:translate-y-[-1px] after:w-[14px] after:h-[7px] " + arrowFillBgClass + " after:[clip-path:polygon(50%_100%,0_0,100%_0)]")
              : effectivePlacement === 'bottom'
                ? ("before:content-[''] before:absolute before:z-10 before:pointer-events-none before:left-[var(--qc-tooltip-arrow-offset)] before:bottom-full before:translate-x-[-50%] before:translate-y-[1px] before:w-[16px] before:h-[8px] before:bg-qc-border before:[clip-path:polygon(50%_0,0_100%,100%_100%)] after:content-[''] after:absolute after:z-20 after:pointer-events-none after:left-[var(--qc-tooltip-arrow-offset)] after:bottom-full after:translate-x-[-50%] after:translate-y-[1px] after:w-[14px] after:h-[7px] " + arrowFillBgClass + " after:[clip-path:polygon(50%_0,0_100%,100%_100%)]")
                : effectivePlacement === 'left'
                  ? ("before:content-[''] before:absolute before:z-10 before:pointer-events-none before:top-[var(--qc-tooltip-arrow-offset)] before:left-full before:translate-y-[-50%] before:translate-x-[-1px] before:w-[8px] before:h-[16px] before:bg-qc-border before:[clip-path:polygon(0_0,0_100%,100%_50%)] after:content-[''] after:absolute after:z-20 after:pointer-events-none after:top-[var(--qc-tooltip-arrow-offset)] after:left-full after:translate-y-[-50%] after:translate-x-[-1px] after:w-[7px] after:h-[14px] " + arrowFillBgClass + " after:[clip-path:polygon(0_0,0_100%,100%_50%)]")
                  : ("before:content-[''] before:absolute before:z-10 before:pointer-events-none before:top-[var(--qc-tooltip-arrow-offset)] before:right-full before:translate-y-[-50%] before:translate-x-[1px] before:w-[8px] before:h-[16px] before:bg-qc-border before:[clip-path:polygon(100%_0,100%_100%,0_50%)] after:content-[''] after:absolute after:z-20 after:pointer-events-none after:top-[var(--qc-tooltip-arrow-offset)] after:right-full after:translate-y-[-50%] after:translate-x-[1px] after:w-[7px] after:h-[14px] " + arrowFillBgClass + " after:[clip-path:polygon(100%_0,100%_100%,0_50%)]"))
          }
          style={{
            maxWidth,
            filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.14))',
            ['--qc-tooltip-arrow-offset']: `${arrowOffsetPos}px`,
          }}
        >
          <div className="relative z-10" style={{ maxWidth }}>
            {typeof content === 'string' || typeof content === 'number' ? (
              <span>{content}</span>
            ) : (
              content
            )}
            {shortcut ? (
              <span className="ml-1 font-mono text-[10px] text-qc-fg-subtle">{shortcut}</span>
            ) : null}
          </div>
        </div>
      </div>,
      document.body
    );

  const triggerHandlers = {
    onPointerEnter: scheduleOpen,
    onPointerLeave: scheduleClose,
    onFocus: scheduleOpen,
    onBlur: scheduleClose,
  };

  let trigger = null;
  if (asChild) {
    if (!isValidElement(children)) {
      trigger = children;
    } else {
      const childProps = children.props || {};
      const childRef = childProps.ref;
      trigger = cloneElement(children, {
        ref: mergeRefs(childRef, triggerRef),
        onPointerEnter: callAll(childProps.onPointerEnter, triggerHandlers.onPointerEnter),
        onPointerLeave: callAll(childProps.onPointerLeave, triggerHandlers.onPointerLeave),
        onFocus: callAll(childProps.onFocus, triggerHandlers.onFocus),
        onBlur: callAll(childProps.onBlur, triggerHandlers.onBlur),
        'aria-describedby': open ? tooltipId : childProps['aria-describedby'],
      });
    }
  } else {
    trigger = (
      <span
        ref={triggerRef}
        className="inline-flex"
        onPointerEnter={triggerHandlers.onPointerEnter}
        onPointerLeave={triggerHandlers.onPointerLeave}
        onFocus={triggerHandlers.onFocus}
        onBlur={triggerHandlers.onBlur}
        aria-describedby={open ? tooltipId : undefined}
      >
        {children}
      </span>
    );
  }

  if (!content) {
    return trigger;
  }

  return (
    <>
      {trigger}
      {tooltipNode}
    </>
  );
}

