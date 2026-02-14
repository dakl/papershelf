import { useEffect, useState } from 'react';
import { AboutDialog } from './components/AboutDialog';
import { PaperDetail } from './components/PaperDetail';
import { PaperList } from './components/PaperList';
import { ResizeHandle } from './components/ResizeHandle';
import { SettingsPanel } from './components/SettingsPanel';
import { Sidebar } from './components/Sidebar';
import { ToastContainer } from './components/Toast';
import { Toolbar } from './components/Toolbar';
import { useUIStore } from './stores/uiStore';

export function App() {
  const sidebarView = useUIStore((state) => state.sidebarView);
  const paperListWidth = useUIStore((state) => state.paperListWidth);
  const [showAbout, setShowAbout] = useState(false);

  useEffect(() => {
    return window.electronAPI.onShowAbout(() => setShowAbout(true));
  }, []);

  const renderContent = () => {
    switch (sidebarView) {
      case 'settings':
        return <SettingsPanel />;
      default:
        return (
          <div className="flex flex-1 min-w-0">
            <PaperList width={paperListWidth} />
            <ResizeHandle />
            <PaperDetail />
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-white/80 dark:bg-black/80">
      <Toolbar />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        {renderContent()}
      </div>
      {showAbout && <AboutDialog onClose={() => setShowAbout(false)} />}
      <ToastContainer />
    </div>
  );
}
