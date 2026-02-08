import { useState } from 'react';
import { usePaperStore } from '../stores/paperStore';

const COLORS = ['#007AFF', '#FF3B30', '#FF9500', '#34C759', '#AF52DE', '#FF2D55', '#5856D6', '#00C7BE'];

interface TagManagerProps {
  onClose: () => void;
  editId?: string;
  editName?: string;
  editColor?: string;
}

export function TagManager({ onClose, editId, editName, editColor }: TagManagerProps) {
  const [name, setName] = useState(editName ?? '');
  const [color, setColor] = useState(editColor ?? COLORS[0]);
  const { createTag, updateTag } = usePaperStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (editId) {
      await updateTag(editId, name.trim(), color);
    } else {
      await createTag(name.trim(), color);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-72 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-mac-emphasis font-semibold mb-3">
          {editId ? 'Edit Tag' : 'New Tag'}
        </h3>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tag name"
            autoFocus
            className="w-full px-3 py-1.5 rounded-md bg-black/5 dark:bg-white/10 border border-mac-separator text-mac-body placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-mac-accent/40 mb-3"
          />
          <div className="flex gap-2 mb-4">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full transition-transform ${
                  color === c ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : ''
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-md text-mac-small text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-3 py-1.5 rounded-md text-mac-small font-medium bg-mac-accent text-white hover:bg-blue-600 disabled:opacity-50"
            >
              {editId ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
