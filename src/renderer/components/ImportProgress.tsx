import { usePaperStore } from '../stores/paperStore';

export function ImportProgressOverlay() {
  const importProgress = usePaperStore((s) => s.importProgress);

  if (!importProgress) return null;

  const percent = Math.round((importProgress.current / importProgress.total) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-80">
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">Importing PDFs...</div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-3 truncate">
          {importProgress.current} of {importProgress.total} &mdash; {importProgress.filename}
        </div>
        <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-mac-accent rounded-full transition-all duration-150"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
