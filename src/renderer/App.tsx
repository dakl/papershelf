import { Sidebar } from './components/Sidebar';
import { PaperList } from './components/PaperList';
import { PaperDetail } from './components/PaperDetail';

export function App() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white/80 dark:bg-black/80">
      <Sidebar />
      <div className="flex flex-1 min-w-0">
        <PaperList />
        <PaperDetail />
      </div>
    </div>
  );
}
