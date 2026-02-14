import { useState } from 'react';
import type { ArxivPaper } from '../../shared/types';
import { usePaperStore } from '../stores/paperStore';
import { formatKeys, useShortcutStore } from '../stores/shortcutStore';
import { toast } from '../stores/toastStore';

interface SaveToLibraryButtonProps {
  paper: ArxivPaper;
  alreadySaved: boolean;
}

export function SaveToLibraryButton({ paper, alreadySaved }: SaveToLibraryButtonProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(alreadySaved);
  const savePaper = usePaperStore((s) => s.savePaper);
  const commandDown = useShortcutStore((s) => s.commandDown);
  const saveShortcut = useShortcutStore((s) => s.getShortcut('savePaper'));

  if (saved) {
    return <span className="px-2 py-1 rounded-sm text-mac-small text-green-600 dark:text-green-400 font-medium">Saved</span>;
  }

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setSaving(true);
    const result = await savePaper(paper);
    setSaving(false);
    if (result.success) {
      setSaved(true);
    } else {
      toast(result.error ?? 'Failed to save paper', 'error');
    }
  };

  return (
    <button
      onClick={handleSave}
      disabled={saving}
      className="no-drag px-2 py-1 rounded-sm text-mac-small font-medium bg-mac-accent text-white hover:bg-blue-600 disabled:opacity-50 transition-colors"
    >
      {saving ? (
        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : commandDown && saveShortcut ? (
        <span className="opacity-90">{formatKeys(saveShortcut.keys)}</span>
      ) : (
        'Save'
      )}
    </button>
  );
}
