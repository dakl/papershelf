import { Sidebar } from './components/Sidebar';
import { PaperList } from './components/PaperList';
import { PaperDetail } from './components/PaperDetail';
import { SettingsPanel } from './components/SettingsPanel';
import { useUIStore } from './stores/uiStore';

export function App() {
  const sidebarView = useUIStore((state) => state.sidebarView);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white/80 dark:bg-black/80">
      <Sidebar />
      {sidebarView === 'settings' ? (
        <SettingsPanel />
      ) : (
        <div className="flex flex-1 min-w-0">
          <PaperList />
          <PaperDetail />
        </div>
      )}
    </div>
  );
}
