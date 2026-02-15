import { useEffect, useState } from 'react';
import type { AppInfo } from '../../shared/types';

interface AboutDialogProps {
  onClose: () => void;
}

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center px-3 py-2">
      <span className="text-xl font-semibold tabular-nums">{value}</span>
      <span className="text-[11px] text-gray-500 dark:text-gray-400">{label}</span>
    </div>
  );
}

export function AboutDialog({ onClose }: AboutDialogProps) {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);

  useEffect(() => {
    window.electronAPI.getAppInfo().then(setAppInfo);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-[340px] rounded-xl border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 shadow-2xl backdrop-blur-xl overflow-hidden select-none"
        style={{ animation: 'about-pop-in 200ms ease-out' }}
      >
        {/* Decorative header gradient */}
        <div className="h-28 bg-gradient-to-br from-pink-300 via-purple-200 to-indigo-300 flex items-center justify-center">
          <img
            src="./icon.png"
            alt="PaperShelf"
            className="w-20 h-20 rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.25)]"
            draggable={false}
          />
        </div>

        {/* Content */}
        <div className="px-6 pb-5 pt-4 text-center">
          <h2 className="text-lg font-semibold tracking-tight">PaperShelf</h2>
          {appInfo && (
            <p className="mt-0.5 text-[12px] text-gray-400 dark:text-gray-500 tabular-nums">
              Version {appInfo.version} &middot; Electron {appInfo.electronVersion}
            </p>
          )}
          <p className="mt-3 text-[12px] leading-relaxed text-gray-500 dark:text-gray-400">
            Search arXiv, organize papers, and annotate PDFs — all from your desktop.
          </p>

          {/* Library stats */}
          {appInfo && (
            <div className="mt-4 flex justify-center divide-x divide-gray-200 dark:divide-gray-700 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-white/5">
              <StatCard value={appInfo.stats.paperCount} label="Papers" />
              <StatCard value={appInfo.stats.favoriteCount} label="Favorites" />
              <StatCard value={appInfo.stats.collectionCount} label="Collections" />
              <StatCard value={appInfo.stats.tagCount} label="Tags" />
            </div>
          )}

          {/* Credits */}
          <p className="mt-4 text-[11px] text-gray-400 dark:text-gray-500">Made with ❤️ in 🇸🇪 by Daniel Klevebring</p>
        </div>
      </div>

      <style>{`
        @keyframes about-pop-in {
          from { opacity: 0; transform: scale(0.95) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
