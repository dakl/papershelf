import { useEffect, useRef, useState } from 'react';
import { useCitationStore } from '../stores/citationStore';
import { usePaperStore } from '../stores/paperStore';
import { useUIStore } from '../stores/uiStore';
import { CitationForceGraph } from './CitationForceGraph';
import { CitationNodePanel } from './CitationNodePanel';

export function CitationGraphView() {
  const { nodes, seedArxivIds, selectedNodeId, loading, fetchProgress, error, startSession, resetSession } =
    useCitationStore();
  const citationSeedArxivIds = useUIStore((s) => s.citationSeedArxivIds);
  const { papers, loadPapers } = usePaperStore();
  const [showSeedPicker, setShowSeedPicker] = useState(false);
  const [seedSearch, setSeedSearch] = useState('');
  const [pickerSelection, setPickerSelection] = useState<string[]>([]);
  const hasStartedRef = useRef(false);

  // Load library papers for the seed picker
  useEffect(() => {
    loadPapers({ view: 'all-papers' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-start session from uiStore seeds (e.g. "Explore Citations" button)
  useEffect(() => {
    if (citationSeedArxivIds.length > 0 && !hasStartedRef.current) {
      hasStartedRef.current = true;
      startSession(citationSeedArxivIds);
    }
  }, [citationSeedArxivIds, startSession]);

  // Reset the ref when we leave and come back
  useEffect(() => {
    return () => {
      hasStartedRef.current = false;
    };
  }, []);

  const selectedNode = selectedNodeId ? (nodes.find((n) => n.semanticScholarId === selectedNodeId) ?? null) : null;

  const libraryNodeCount = nodes.filter((n) => n.inLibrary).length;
  const externalNodeCount = nodes.length - libraryNodeCount;

  const filteredPapers = papers.filter(
    (p) =>
      p.title.toLowerCase().includes(seedSearch.toLowerCase()) ||
      p.arxivId.toLowerCase().includes(seedSearch.toLowerCase()),
  );

  const togglePickerItem = (arxivId: string) => {
    setPickerSelection((prev) => (prev.includes(arxivId) ? prev.filter((id) => id !== arxivId) : [...prev, arxivId]));
  };

  const handleExploreFromPicker = () => {
    if (pickerSelection.length === 0) return;
    setShowSeedPicker(false);
    setSeedSearch('');
    startSession(pickerSelection);
    setPickerSelection([]);
  };

  const handleAddPapers = () => {
    setPickerSelection([]);
    setShowSeedPicker(true);
  };

  const handleAddToSession = () => {
    if (pickerSelection.length === 0) return;
    setShowSeedPicker(false);
    setSeedSearch('');
    const combined = [...new Set([...seedArxivIds, ...pickerSelection])];
    startSession(combined);
    setPickerSelection([]);
  };

  const handleRemoveSeed = (arxivId: string) => {
    const remaining = seedArxivIds.filter((id) => id !== arxivId);
    if (remaining.length === 0) {
      resetSession();
    } else {
      startSession(remaining);
    }
  };

  const handleReset = () => {
    resetSession();
    useUIStore.getState().navigateToCitations([]);
  };

  const seedPaperNames = seedArxivIds.map((id) => {
    const paper = papers.find((p) => p.arxivId === id);
    return { arxivId: id, title: paper?.title ?? id };
  });

  const hasSession = seedArxivIds.length > 0;

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="drag-region h-[38px] flex-shrink-0" />

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 flex-wrap">
        {hasSession && (
          <>
            {/* Seed chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-mac-small text-gray-400 dark:text-gray-500">Seeds:</span>
              {seedPaperNames.map(({ arxivId, title }) => (
                <span
                  key={arxivId}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800"
                >
                  {title.length > 30 ? title.slice(0, 30) + '...' : title}
                  <button
                    onClick={() => handleRemoveSeed(arxivId)}
                    className="ml-0.5 hover:text-red-500 transition-colors"
                    title="Remove seed"
                  >
                    x
                  </button>
                </span>
              ))}
            </div>

            <div className="relative">
              <button
                onClick={handleAddPapers}
                className="px-2.5 py-1 rounded-md text-mac-small font-medium border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
              >
                + Add Papers
              </button>
              {showSeedPicker && (
                <SeedPickerDropdown
                  papers={filteredPapers}
                  seedSearch={seedSearch}
                  onSearchChange={setSeedSearch}
                  selection={pickerSelection}
                  onToggle={togglePickerItem}
                  onExplore={handleAddToSession}
                  onClose={() => setShowSeedPicker(false)}
                  buttonLabel="Add to Graph"
                />
              )}
            </div>

            <button
              onClick={handleReset}
              className="px-2.5 py-1 rounded-md text-mac-small font-medium border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-red-500"
            >
              Reset
            </button>
          </>
        )}

        {fetchProgress && (
          <div className="flex items-center gap-2 text-mac-small text-gray-500 dark:text-gray-400">
            <div className="w-32 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${(fetchProgress.done / fetchProgress.total) * 100}%` }}
              />
            </div>
            <span>
              {fetchProgress.done}/{fetchProgress.total}
            </span>
          </div>
        )}

        {nodes.length > 0 && !loading && (
          <span className="text-mac-small text-gray-400 dark:text-gray-500">
            {libraryNodeCount} library · {externalNodeCount} discovered · {nodes.length} total
          </span>
        )}

        {error && <span className="text-mac-small text-red-500">{error}</span>}
      </div>

      {/* Content */}
      <div className="flex flex-1 min-h-0">
        {!hasSession && !loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-4 max-w-md">
              <div className="text-4xl">&#128269;</div>
              <p className="text-mac-body font-medium text-gray-700 dark:text-gray-300">
                Select papers to explore their citations
              </p>
              <p className="text-mac-small text-gray-400 dark:text-gray-500">
                Pick one or more papers from your library as seeds, then explore their citation neighborhood.
              </p>
              <div className="relative inline-block">
                <button
                  onClick={() => {
                    setPickerSelection([]);
                    setShowSeedPicker(true);
                  }}
                  disabled={papers.length === 0}
                  className={`px-4 py-2 rounded-md text-mac-body font-medium transition-colors ${
                    papers.length === 0
                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
                >
                  Choose Papers
                </button>
                {showSeedPicker && (
                  <SeedPickerDropdown
                    papers={filteredPapers}
                    seedSearch={seedSearch}
                    onSearchChange={setSeedSearch}
                    selection={pickerSelection}
                    onToggle={togglePickerItem}
                    onExplore={handleExploreFromPicker}
                    onClose={() => setShowSeedPicker(false)}
                    buttonLabel="Explore"
                  />
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            <CitationForceGraph />
            {selectedNode && <CitationNodePanel node={selectedNode} />}
          </>
        )}
      </div>
    </div>
  );
}

interface SeedPickerDropdownProps {
  papers: { arxivId: string; title: string }[];
  seedSearch: string;
  onSearchChange: (value: string) => void;
  selection: string[];
  onToggle: (arxivId: string) => void;
  onExplore: () => void;
  onClose: () => void;
  buttonLabel: string;
}

function SeedPickerDropdown({
  papers,
  seedSearch,
  onSearchChange,
  selection,
  onToggle,
  onExplore,
  onClose,
  buttonLabel,
}: SeedPickerDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={dropdownRef}
      className="absolute top-full left-0 mt-1 w-80 bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-mac-separator z-20 flex flex-col"
    >
      <div className="p-2 border-b border-mac-separator">
        <input
          type="text"
          value={seedSearch}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search library papers..."
          className="w-full px-2.5 py-1.5 rounded-md text-mac-small bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
          autoFocus
        />
      </div>
      <div className="max-h-60 overflow-y-auto py-1">
        {papers.length === 0 ? (
          <div className="px-3 py-4 text-center text-mac-small text-gray-400">No papers found</div>
        ) : (
          papers.map((paper) => {
            const isSelected = selection.includes(paper.arxivId);
            return (
              <button
                key={paper.arxivId}
                onClick={() => onToggle(paper.arxivId)}
                className="w-full text-left px-3 py-2 text-mac-small hover:bg-gray-50 dark:hover:bg-gray-800 flex items-start gap-2"
              >
                <span
                  className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center text-[10px] ${
                    isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300 dark:border-gray-600'
                  }`}
                >
                  {isSelected && '\u2713'}
                </span>
                <span className="flex-1 leading-snug">{paper.title}</span>
              </button>
            );
          })
        )}
      </div>
      <div className="p-2 border-t border-mac-separator flex items-center justify-between">
        <span className="text-mac-small text-gray-400">{selection.length} selected</span>
        <button
          onClick={onExplore}
          disabled={selection.length === 0}
          className={`px-3 py-1.5 rounded-md text-mac-small font-medium transition-colors ${
            selection.length === 0
              ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
              : 'bg-blue-500 text-white hover:bg-blue-600'
          }`}
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}
