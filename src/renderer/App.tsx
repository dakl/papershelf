import { Sidebar } from './components/Sidebar';
import { PaperList } from './components/PaperList';
import { PaperDetail } from './components/PaperDetail';
import { SettingsPanel } from './components/SettingsPanel';
import { CitationGraphView } from './components/CitationGraphView';
import { useUIStore } from './stores/uiStore';

export function App() {
  const sidebarView = useUIStore((state) => state.sidebarView);

  const renderContent = () => {
    switch (sidebarView) {
      case 'settings':
        return <SettingsPanel />;
      case 'citations':
        return <CitationGraphView />;
      default:
        return (
          <div className="flex flex-1 min-w-0">
            <PaperList />
            <PaperDetail />
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white/80 dark:bg-black/80">
      <Sidebar />
      {renderContent()}
    </div>
  );
}
