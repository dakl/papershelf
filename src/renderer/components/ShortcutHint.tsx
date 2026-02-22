import { type ReactNode, useCallback, useRef, useState } from 'react';
import { formatKeys, useShortcutStore } from '../stores/shortcutStore';

const HOVER_DELAY_MS = 600;

interface ShortcutHintProps {
  shortcutId: string;
  children: ReactNode;
  position?: 'below' | 'above' | 'right';
  align?: 'center' | 'end';
  label?: string;
  className?: string;
}

const ARROW = (
  <span className="block w-0 h-0 border-l-4 border-r-4 border-l-transparent border-r-transparent border-b-4 border-b-gray-800/90 dark:border-b-gray-200/90" />
);

const ARROW_DOWN = (
  <span className="block w-0 h-0 border-l-4 border-r-4 border-l-transparent border-r-transparent border-t-4 border-t-gray-800/90 dark:border-t-gray-200/90" />
);

const ARROW_RIGHT = (
  <span className="block w-0 h-0 border-t-4 border-b-4 border-t-transparent border-b-transparent border-r-4 border-r-gray-800/90 dark:border-r-gray-200/90" />
);

export function ShortcutHint({
  shortcutId,
  children,
  position = 'below',
  align = 'center',
  label,
  className,
}: ShortcutHintProps) {
  const commandDown = useShortcutStore((s) => s.commandDown);
  const shortcut = useShortcutStore((s) => s.getShortcut(shortcutId));
  const [hovered, setHovered] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onMouseEnter = useCallback(() => {
    timerRef.current = setTimeout(() => setHovered(true), HOVER_DELAY_MS);
  }, []);

  const onMouseLeave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setHovered(false);
  }, []);

  if (!shortcut) return <>{children}</>;

  const shortcutPill = (
    <span className="inline-flex items-center gap-0.5 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-medium leading-none bg-gray-800/90 text-white dark:bg-gray-200/90 dark:text-gray-900 shadow-xs">
      {formatKeys(shortcut.keys)}
    </span>
  );

  const hoverTooltip = label ? (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium leading-none bg-gray-800/90 text-white dark:bg-gray-200/90 dark:text-gray-900 shadow-xs">
      <span>{label}</span>
      <span className="opacity-50">{formatKeys(shortcut.keys)}</span>
    </span>
  ) : (
    shortcutPill
  );

  const isEnd = align === 'end';

  const containerPositionClass = {
    below: isEnd ? 'top-full right-0 mt-0.5' : 'top-full left-1/2 mt-0.5',
    above: isEnd ? 'bottom-full right-0 mb-0.5' : 'bottom-full left-1/2 mb-0.5',
    right: 'left-full top-1/2 ml-1',
  }[position];

  const containerTransform = {
    below: isEnd ? undefined : 'translateX(-50%)',
    above: isEnd ? undefined : 'translateX(-50%)',
    right: 'translateY(-50%)',
  }[position];

  const containerFlexClass = {
    below: isEnd ? 'flex-col items-end' : 'flex-col items-center',
    above: isEnd ? 'flex-col items-end' : 'flex-col items-center',
    right: 'flex-row items-center',
  }[position];

  const arrowFor = (pos: string) => ({ below: ARROW, above: ARROW_DOWN, right: ARROW_RIGHT })[pos];

  const showTooltip = !commandDown && hovered && label;
  const showShortcut = commandDown;

  return (
    <span className={`relative inline-flex ${className ?? ''}`} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      {children}
      {(showShortcut || showTooltip) && (
        <span
          className={`absolute ${containerPositionClass} pointer-events-none z-50 flex ${containerFlexClass}`}
          style={{ transform: containerTransform, animation: 'shortcut-fade-in 100ms ease-out' }}
        >
          {position === 'above' ? (
            <>
              {showShortcut ? shortcutPill : hoverTooltip}
              {arrowFor(position)}
            </>
          ) : (
            <>
              {arrowFor(position)}
              {showShortcut ? shortcutPill : hoverTooltip}
            </>
          )}
        </span>
      )}
    </span>
  );
}
