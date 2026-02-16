import { useShortcutStore } from '../stores/shortcutStore';
import { type ActivePanel, useUIStore } from '../stores/uiStore';

const HINT_STYLE =
  'inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-medium leading-none bg-gray-800/90 text-white dark:bg-gray-200/90 dark:text-gray-900 shadow-xs';

const HINTS: Record<string, { keys: string; label: string }[]> = {
  list: [{ keys: '⌘↑↓', label: 'Navigate' }, { keys: '⌘←→', label: 'Panels' }],
};

export function NavigationHints({ panel }: { panel: ActivePanel }) {
  const commandDown = useShortcutStore((s) => s.commandDown);

  if (!commandDown) return null;

  const hints = HINTS[panel];
  if (!hints) return null;

  return (
    <div className="flex items-center gap-1.5" style={{ animation: 'shortcut-fade-in 100ms ease-out' }}>
      {hints.map((hint) => (
        <span key={hint.keys} className={HINT_STYLE}>
          <span>{hint.keys}</span>
          <span className="opacity-70">{hint.label}</span>
        </span>
      ))}
    </div>
  );
}
