import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface ConfirmPopupProps {
  x: number;
  y: number;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmPopup({ x, y, message, confirmLabel = 'Delete', onConfirm, onCancel }: ConfirmPopupProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const left = Math.min(x, window.innerWidth - rect.width - 8);
    const top = Math.min(y, window.innerHeight - rect.height - 8);
    setPosition({ left: Math.max(8, left), top: Math.max(8, top) });
  }, [x, y]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onCancel();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onCancel]);

  return createPortal(
    <div
      ref={ref}
      className="fixed z-50 rounded-lg shadow-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3"
      style={{ left: position.left, top: position.top }}
    >
      <p className="text-mac-small mb-2">{message}</p>
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-2 py-0.5 text-mac-small rounded-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="px-2 py-0.5 text-mac-small rounded-sm bg-red-500 text-white hover:bg-red-600 transition-colors"
        >
          {confirmLabel}
        </button>
      </div>
    </div>,
    document.body,
  );
}
