import { type ToastType, useToastStore } from '../stores/toastStore';

const ICON: Record<ToastType, string> = {
  success: '\u2713',
  error: '\u2717',
  info: '\u2139',
};

const TYPE_CLASSES: Record<ToastType, string> = {
  success: 'bg-green-600 text-white',
  error: 'bg-red-600 text-white',
  info: 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900',
};

export function ToastContainer() {
  const toasts = useToastStore((state) => state.toasts);
  const removeToast = useToastStore((state) => state.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg text-mac-body font-medium ${TYPE_CLASSES[t.type]}`}
          style={{ animation: 'toast-slide-up 200ms ease-out' }}
        >
          <span className="text-sm">{ICON[t.type]}</span>
          <span>{t.message}</span>
          <button onClick={() => removeToast(t.id)} className="ml-2 opacity-70 hover:opacity-100 text-sm leading-none">
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}
