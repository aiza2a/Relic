import { useSnapshot } from 'valtio';
import { toastStore, TOAST_POSITIONS } from '@shared/store/toastStore';
import Toast from './Toast';

const POSITION_ORDER = [
  TOAST_POSITIONS.TOP_LEFT,
  TOAST_POSITIONS.TOP_RIGHT,
  TOAST_POSITIONS.BOTTOM_LEFT,
  TOAST_POSITIONS.BOTTOM_RIGHT
];

const POSITION_CLASS_MAP = {
  [TOAST_POSITIONS.TOP_LEFT]: 'top-14 left-3 items-start sm:left-4',
  [TOAST_POSITIONS.TOP_RIGHT]: 'top-14 right-3 items-end sm:right-4',
  [TOAST_POSITIONS.BOTTOM_LEFT]: 'bottom-4 left-3 items-start sm:left-4',
  [TOAST_POSITIONS.BOTTOM_RIGHT]: 'bottom-4 right-3 items-end sm:right-4'
};

const STACK_ALIGN_MAP = {
  [TOAST_POSITIONS.TOP_LEFT]: 'items-start',
  [TOAST_POSITIONS.TOP_RIGHT]: 'items-end',
  [TOAST_POSITIONS.BOTTOM_LEFT]: 'items-start',
  [TOAST_POSITIONS.BOTTOM_RIGHT]: 'items-end'
};

const TOAST_ALIGN_MAP = {
  [TOAST_POSITIONS.TOP_LEFT]: 'start',
  [TOAST_POSITIONS.TOP_RIGHT]: 'end',
  [TOAST_POSITIONS.BOTTOM_LEFT]: 'start',
  [TOAST_POSITIONS.BOTTOM_RIGHT]: 'end'
};

function ToastContainer() {
  const { toasts } = useSnapshot(toastStore);

  if (toasts.length === 0) return null;

  const toastsByPosition = POSITION_ORDER.reduce((groups, position) => {
    groups[position] = [];
    return groups;
  }, {});

  toasts.forEach((toast) => {
    const position = toast.position || TOAST_POSITIONS.TOP_RIGHT;
    toastsByPosition[position].push(toast);
  });

  return (
    <>
      {POSITION_ORDER.map((position) => {
        const items = toastsByPosition[position];
        if (!items.length) return null;

        return (
          <div
            key={position}
            className={[
              'pointer-events-none fixed z-9999 flex max-w-[min(32rem,calc(100vw-1.5rem))] flex-col',
              POSITION_CLASS_MAP[position]
            ].join(' ')}
          >
            <div className={['flex flex-col', STACK_ALIGN_MAP[position]].join(' ')}>
              {items.map((toast, index) => (
                <Toast
                  key={toast.id}
                  {...toast}
                  stacked={index > 0}
                  align={TOAST_ALIGN_MAP[position]}
                  onClose={toastStore.removeToast}
                />
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

export default ToastContainer;
