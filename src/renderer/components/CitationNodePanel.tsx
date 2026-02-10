import type { CitationNode } from '../../shared/types';
import { useCitationStore } from '../stores/citationStore';
import { usePaperStore } from '../stores/paperStore';

interface CitationNodePanelProps {
  node: CitationNode;
}

export function CitationNodePanel({ node }: CitationNodePanelProps) {
  const { expandNode, loading, edges } = useCitationStore();
  const { savePaper } = usePaperStore();

  const referenceCount = edges.filter((e) => e.source === node.semanticScholarId).length;
  const citationCount = edges.filter((e) => e.target === node.semanticScholarId).length;

  const handleSaveToLibrary = async () => {
    if (!node.arxivId) return;
    await savePaper({
      id: node.arxivId,
      title: node.title,
      authors: node.authors,
      abstract: '',
      publishedDate: node.year ? `${node.year}-01-01` : '',
      updatedDate: node.year ? `${node.year}-01-01` : '',
      categories: [],
      arxivUrl: `https://arxiv.org/abs/${node.arxivId}`,
      pdfUrl: `https://arxiv.org/pdf/${node.arxivId}.pdf`,
    });

    // Reload subgraph to update inLibrary flags
    await useCitationStore.getState().reloadSubgraph();
  };

  const handleExpand = () => {
    expandNode(node.semanticScholarId);
  };

  return (
    <div className="w-[320px] flex-shrink-0 border-l border-gray-200 dark:border-gray-700 flex flex-col bg-white/60 dark:bg-white/5">
      <div className="drag-region h-[38px] flex-shrink-0" />
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        <div>
          <h2 className="text-mac-body font-semibold leading-snug">{node.title}</h2>
          <p className="text-mac-small text-gray-500 dark:text-gray-400 mt-1">
            {node.authors.slice(0, 5).join(', ')}
            {node.authors.length > 5 && ` +${node.authors.length - 5} more`}
          </p>
          {node.year && <p className="text-mac-small text-gray-400 dark:text-gray-500 mt-0.5">{node.year}</p>}
        </div>

        <div className="flex gap-3 text-mac-small text-gray-500 dark:text-gray-400">
          <span>References: {referenceCount}</span>
          <span>Cited by: {citationCount}</span>
        </div>

        {node.inLibrary && (
          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-mac-small">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            In Library
          </div>
        )}

        <div className="space-y-2">
          {node.arxivId && (
            <a
              href={`https://arxiv.org/abs/${node.arxivId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-600 text-mac-body hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
            >
              View on arXiv
            </a>
          )}

          <a
            href={`https://www.semanticscholar.org/paper/${node.semanticScholarId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-600 text-mac-body hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
          >
            View on Semantic Scholar
          </a>

          {!node.inLibrary && node.arxivId && (
            <button
              onClick={handleSaveToLibrary}
              className="w-full px-3 py-1.5 rounded-md bg-blue-500 text-white text-mac-body hover:bg-blue-600 transition-colors"
            >
              Save to Library
            </button>
          )}

          <button
            onClick={handleExpand}
            disabled={loading}
            className={`w-full px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-600 text-mac-body transition-colors ${
              loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50 dark:hover:bg-white/5'
            }`}
          >
            {loading ? 'Expanding...' : 'Expand Citations'}
          </button>
        </div>
      </div>
    </div>
  );
}
