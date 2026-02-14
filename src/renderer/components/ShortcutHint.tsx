import type { ReactNode } from 'react';
import { formatKeys, useShortcutStore } from '../stores/shortcutStore';

interface ShortcutHintProps {
  shortcutId: string;
  children: ReactNode;
  position?: 'below' | 'above' | 'right';
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

export function ShortcutHint({ shortcutId, children, position = 'below', label, className }: ShortcutHintProps) {
  const commandDown = useShortcutStore((s) => s.commandDown);
  const shortcut = useShortcutStore((s) => s.getShortcut(shortcutId));

  if (!shortcut) return <>{children}</>;

  const pill = (
    <span className="inline-flex items-center gap-0.5 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-medium leading-none bg-gray-800/90 text-white dark:bg-gray-200/90 dark:text-gray-900 shadow-xs">
      {formatKeys(shortcut.keys)}
      {label && <span className="opacity-70">{label}</span>}
    </span>
  );

  const containerPositionClass = {
    below: 'top-full left-1/2 mt-0.5',
    above: 'bottom-full left-1/2 mb-0.5',
    right: 'left-full top-1/2 ml-1',
  }[position];

  const containerTransform = {
    below: 'translateX(-50%)',
    above: 'translateX(-50%)',
    right: 'translateY(-50%)',
  }[position];

  const containerFlexClass = {
    below: 'flex-col items-center',
    above: 'flex-col items-center',
    right: 'flex-row items-center',
  }[position];

  const content = {
    below: (
      <>
        {ARROW}
        {pill}
      </>
    ),
    above: (
      <>
        {pill}
        {ARROW_DOWN}
      </>
    ),
    right: (
      <>
        {ARROW_RIGHT}
        {pill}
      </>
    ),
  }[position];

  return (
    <span className={`relative inline-flex ${className ?? ''}`}>
      {children}
      {commandDown && (
        <span
          className={`absolute ${containerPositionClass} pointer-events-none z-50 flex ${containerFlexClass}`}
          style={{ transform: containerTransform, animation: 'shortcut-fade-in 100ms ease-out' }}
        >
          {content}
        </span>
      )}
    </span>
  );
}
