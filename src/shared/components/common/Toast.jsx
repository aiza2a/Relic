import '@tabler/icons-webfont/dist/tabler-icons.min.css';
import { useEffect, useState } from 'react';
import { TOAST_POSITIONS, TOAST_SIZES } from '@shared/store/toastStore';

const EXIT_DURATION_MS = 220;

const TOAST_TYPE_CONFIG = {
  success: {
    icon: 'ti ti-circle-check-filled',
    accent: '#22c55e'
  },
  error: {
    icon: 'ti ti-alert-circle-filled',
    accent: '#ef4444'
  },
  warning: {
    icon: 'ti ti-alert-triangle-filled',
    accent: '#f59e0b'
  },
  info: {
    icon: 'ti ti-info-circle-filled',
    accent: 'var(--qc-accent)'
  }
};

const TOAST_SIZE_CONFIG = {
  [TOAST_SIZES.EXTRA_SMALL]: {
    frame: 'max-w-72 rounded-lg',
    content: 'gap-1.5 px-2 py-1',
    progressInset: '0.5rem',
    iconWrap: 'h-5.5 w-5.5',
    iconSize: 14,
    text: 'text-[13px] leading-4 font-medium',
    closeButton: 'h-4.5 w-4.5 rounded-md',
    closeIcon: 12
  },
  [TOAST_SIZES.SMALL]: {
    frame: 'max-w-80 rounded-lg',
    content: 'gap-1.5 px-2.5 py-1.25',
    progressInset: '0.625rem',
    iconWrap: 'h-6 w-6',
    iconSize: 15,
    text: 'text-[13px] leading-4 font-medium',
    closeButton: 'h-5 w-5 rounded-md',
    closeIcon: 13
  },
  [TOAST_SIZES.MEDIUM]: {
    frame: 'max-w-96 rounded-xl',
    content: 'gap-2 px-3 py-1.5',
    progressInset: '0.75rem',
    iconWrap: 'h-7 w-7',
    iconSize: 17,
    text: 'text-[15px] leading-5 font-medium',
    closeButton: 'h-5.5 w-5.5 rounded-lg',
    closeIcon: 14
  },
  [TOAST_SIZES.LARGE]: {
    frame: 'max-w-[28rem] rounded-xl',
    content: 'gap-2 px-3 py-1.75',
    progressInset: '0.75rem',
    iconWrap: 'h-7.5 w-7.5',
    iconSize: 18,
    text: 'text-[15px] leading-5 font-medium',
    closeButton: 'h-6 w-6 rounded-lg',
    closeIcon: 16
  },
  [TOAST_SIZES.EXTRA_LARGE]: {
    frame: 'max-w-[32rem] rounded-xl',
    content: 'gap-2.5 px-3.5 py-2',
    progressInset: '0.875rem',
    iconWrap: 'h-8 w-8',
    iconSize: 20,
    text: 'text-base leading-5 font-medium',
    closeButton: 'h-6.5 w-6.5 rounded-lg',
    closeIcon: 16
  }
};

const STACK_GAP_BY_SIZE = {
  [TOAST_SIZES.EXTRA_SMALL]: 6,
  [TOAST_SIZES.SMALL]: 8,
  [TOAST_SIZES.MEDIUM]: 10,
  [TOAST_SIZES.LARGE]: 10,
  [TOAST_SIZES.EXTRA_LARGE]: 12
};

function Toast({
  id,
  message,
  type,
  position,
  duration = 3000,
  size = TOAST_SIZES.MEDIUM,
  stacked = false,
  align = 'start',
  onClose
}) {
  const [phase, setPhase] = useState('enter');
  const currentType = TOAST_TYPE_CONFIG[type] || TOAST_TYPE_CONFIG.info;
  const currentSize = TOAST_SIZE_CONFIG[size] || TOAST_SIZE_CONFIG[TOAST_SIZES.MEDIUM];
  const stackGap = STACK_GAP_BY_SIZE[size] ?? STACK_GAP_BY_SIZE[TOAST_SIZES.MEDIUM];
  const messageText = typeof message === 'string' ? message : String(message ?? '');
  const shouldShowProgress = duration > 0;

  useEffect(() => {
    const timer = setTimeout(() => {
      setPhase('idle');
    }, 16);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (duration <= 0 || phase === 'leave') return undefined;

    const timer = setTimeout(() => {
      requestClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, phase]);

  const requestClose = () => {
    if (phase === 'leave') return;

    setPhase('leave');

    window.setTimeout(() => {
      onClose(id);
    }, EXIT_DURATION_MS);
  };

  const getMotionClass = () => {
    const isLeftSide = position === TOAST_POSITIONS.TOP_LEFT || position === TOAST_POSITIONS.BOTTOM_LEFT;
    const isTopSide = position === TOAST_POSITIONS.TOP_LEFT || position === TOAST_POSITIONS.TOP_RIGHT;

    if (phase === 'enter') {
      return isLeftSide
        ? '-translate-x-3 opacity-0'
        : 'translate-x-3 opacity-0';
    }

    if (phase === 'leave') {
      return isTopSide
        ? '-translate-y-2 scale-[0.985] opacity-0'
        : 'translate-y-2 scale-[0.985] opacity-0';
    }

    return 'opacity-100';
  };

  return (
    <div
      className={[
        'inline-grid overflow-visible transition-[grid-template-rows,opacity,margin] duration-200 ease-out',
        align === 'end' ? 'self-end' : 'self-start'
      ].join(' ')}
      style={{
        gridTemplateRows: phase === 'leave' ? '0fr' : '1fr',
        marginTop: phase === 'leave' ? 0 : stacked ? `${stackGap}px` : 0,
        opacity: phase === 'leave' ? 0 : 1
      }}
    >
      <div className="min-h-0 overflow-visible">
        <div
          className={[
            'pointer-events-none relative inline-flex bg-qc-surface text-qc-fg ring-1 ring-inset ring-qc-border',
            'transition-all duration-200 ease-out',
            currentSize.frame,
            getMotionClass()
          ].join(' ')}
          style={{
            boxShadow: '0 10px 24px color-mix(in srgb, var(--qc-fg) 10%, transparent)',
            '--toast-accent': currentType.accent
          }}
          role="status"
          aria-live={type === 'error' ? 'assertive' : 'polite'}
        >
          <div className={['relative flex w-full items-center rounded-[inherit]', currentSize.content].join(' ')}>
            <div
              className={['shrink-0 flex items-center justify-center', currentSize.iconWrap].join(' ')}
              style={{ color: 'var(--toast-accent)' }}
              aria-hidden="true"
            >
              <i className={currentType.icon} style={{ fontSize: currentSize.iconSize }} />
            </div>

            <div className="min-w-0 flex-1">
              <p className={`${currentSize.text} break-words text-qc-fg`}>
                {messageText}
              </p>
            </div>

            <button
              type="button"
              onClick={requestClose}
              className={[
                'pointer-events-auto shrink-0 flex items-center justify-center text-qc-fg-muted transition-colors duration-150',
                'hover:bg-qc-hover hover:text-qc-fg focus:outline-none focus:ring-2 focus:ring-qc-border-strong',
                currentSize.closeButton
              ].join(' ')}
              aria-label="关闭提示"
            >
              <i className="ti ti-x" style={{ fontSize: currentSize.closeIcon }} />
            </button>

            {shouldShowProgress && (
              <span
                className="pointer-events-none absolute bottom-0 left-0 h-px origin-right rounded-full"
                style={{
                  left: currentSize.progressInset,
                  width: `calc(100% - ${currentSize.progressInset} * 2)`,
                  backgroundColor: 'color-mix(in srgb, var(--toast-accent) 78%, transparent)',
                  transform: phase === 'idle' || phase === 'leave' ? 'scaleX(0)' : 'scaleX(1)',
                  transition: `transform ${duration}ms linear`
                }}
                aria-hidden="true"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Toast;
