import { create } from 'zustand';
import type { CitationNode, CitationEdge } from '../../shared/types';

interface CitationState {
  seedArxivIds: string[];
  expandedS2Ids: string[];
  nodes: CitationNode[];
  edges: CitationEdge[];
  selectedNodeId: string | null;
  loading: boolean;
  fetchProgress: { done: number; total: number } | null;
  error: string | null;

  startSession: (arxivIds: string[]) => Promise<void>;
  expandNode: (s2Id: string) => Promise<void>;
  reloadSubgraph: () => Promise<void>;
  resetSession: () => void;
  selectNode: (s2Id: string | null) => void;
}

export const useCitationStore = create<CitationState>((set, get) => ({
  seedArxivIds: [],
  expandedS2Ids: [],
  nodes: [],
  edges: [],
  selectedNodeId: null,
  loading: false,
  fetchProgress: null,
  error: null,

  startSession: async (arxivIds) => {
    set({
      seedArxivIds: arxivIds,
      expandedS2Ids: [],
      nodes: [],
      edges: [],
      selectedNodeId: null,
      loading: true,
      fetchProgress: { done: 0, total: arxivIds.length },
      error: null,
    });

    // Fetch S2 data for seeds that aren't cached yet
    const batchSize = 5;
    let totalDone = 0;

    for (let i = 0; i < arxivIds.length; i += batchSize) {
      const batch = arxivIds.slice(i, i + batchSize);
      const result = await window.electronAPI.fetchCitationsBatch(batch);
      totalDone += result.fetched + result.failed;
      set({ fetchProgress: { done: totalDone, total: arxivIds.length } });
    }

    set({ fetchProgress: null });
    await get().reloadSubgraph();
    set({ loading: false });
  },

  expandNode: async (s2Id) => {
    set({ loading: true, error: null });
    const result = await window.electronAPI.expandCitationNode(s2Id);
    if (!result.success) {
      set({ loading: false, error: result.error });
      return;
    }

    const { expandedS2Ids } = get();
    const newExpanded = expandedS2Ids.includes(s2Id)
      ? expandedS2Ids
      : [...expandedS2Ids, s2Id];
    set({ expandedS2Ids: newExpanded });

    await get().reloadSubgraph();
    set({ loading: false });
  },

  reloadSubgraph: async () => {
    const { seedArxivIds, expandedS2Ids } = get();
    const data = await window.electronAPI.getCitationSubgraph(seedArxivIds, expandedS2Ids);
    set({ nodes: data.nodes, edges: data.edges });
  },

  resetSession: () =>
    set({
      seedArxivIds: [],
      expandedS2Ids: [],
      nodes: [],
      edges: [],
      selectedNodeId: null,
      loading: false,
      fetchProgress: null,
      error: null,
    }),

  selectNode: (s2Id) => set({ selectedNodeId: s2Id }),
}));
