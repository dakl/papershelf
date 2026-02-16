import { useState } from 'react';
import type { ArxivPaper } from '../../shared/types';
import { usePaperStore } from '../stores/paperStore';
import { formatKeys, useShortcutStore } from '../stores/shortcutStore';
import { toast } from '../stores/toastStore';

interface SaveToLibraryButtonProps {
  paper: ArxivPaper;
  alreadySaved: boolean;
  isSelected?: boolean;
}

export function SaveToLibraryButton({ paper, alreadySaved, isSelected }: SaveToLibraryButtonProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(alreadySaved);
  const savePaper = usePaperStore((s) => s.savePaper);
  const commandDown = useShortcutStore((s) => s.commandDown);
  const saveShortcut = useShortcutStore((s) => s.getShortcut('savePaper'));

  if (saved) {
    return (
      <span className="px-2 py-1 rounded-sm text-mac-small text-green-600 dark:text-green-400 font-medium">Saved</span>
    );
  }

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setSaving(true);
    const result = await savePaper(paper);
    setSaving(false);
    if (result.success) {
      setSaved(true);
      if (result.alreadyExisted) {
        toast('Paper already in library', 'info');
      }
    } else {
      toast(result.error ?? 'Failed to save paper', 'error');
    }
  };

  // When Cmd is held on the selected paper, show black tooltip-style hint
  if (commandDown && isSelected && saveShortcut) {
    return (
      <span
        className="inline-flex items-center gap-0.5 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-medium leading-none bg-gray-800/90 text-white dark:bg-gray-200/90 dark:text-gray-900 shadow-xs"
        style={{ animation: 'shortcut-fade-in 100ms ease-out' }}
      >
        {formatKeys(saveShortcut.keys)} Save
      </span>
    );
  }

  return (
    <button
      onClick={handleSave}
      disabled={saving}
      className="no-drag px-2 py-1 rounded-sm text-mac-small font-medium bg-mac-accent text-white hover:bg-blue-600 disabled:opacity-50 transition-colors"
    >
      {saving ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Save'}
    </button>
  );
}
