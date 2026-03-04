import { describe, expect, it } from 'vitest';
import type { IndexingProgress } from '../../shared/types';

/**
 * Tests for the indexing progress → UI state logic used in LibraryList.
 * This mirrors the onIndexingProgress handler and isQueuedForIndexing derivation
 * without needing a DOM environment or React Testing Library.
 */

interface IndexingUIState {
  activelyIndexingPaperId: string | null;
  indexingActive: boolean;
}

function applyProgressEvent(state: IndexingUIState, progress: IndexingProgress): IndexingUIState {
  if (progress.status === 'indexing') {
    return { activelyIndexingPaperId: progress.paperId, indexingActive: true };
  }
  if (progress.status === 'complete') {
    return { activelyIndexingPaperId: null, indexingActive: false };
  }
  // 'indexed' or 'error' — clear the actively indexing paper but keep queue active
  return { activelyIndexingPaperId: null, indexingActive: state.indexingActive };
}

function isQueuedForIndexing(state: IndexingUIState, paperId: string, embeddingStatus: string | undefined): boolean {
  return state.indexingActive && embeddingStatus !== 'complete' && paperId !== state.activelyIndexingPaperId;
}

function isActivelyIndexing(state: IndexingUIState, paperId: string): boolean {
  return paperId === state.activelyIndexingPaperId;
}

const initialState: IndexingUIState = { activelyIndexingPaperId: null, indexingActive: false };

describe('indexing progress state machine', () => {
  it('sets actively indexing paper on indexing event', () => {
    const state = applyProgressEvent(initialState, {
      paperId: 'paper-1',
      paperTitle: 'Paper 1',
      current: 1,
      total: 3,
      status: 'indexing',
    });

    expect(state.activelyIndexingPaperId).toBe('paper-1');
    expect(state.indexingActive).toBe(true);
  });

  it('clears actively indexing paper on indexed event but keeps queue active', () => {
    let state = applyProgressEvent(initialState, {
      paperId: 'paper-1',
      paperTitle: 'Paper 1',
      current: 1,
      total: 3,
      status: 'indexing',
    });

    state = applyProgressEvent(state, {
      paperId: 'paper-1',
      paperTitle: 'Paper 1',
      current: 1,
      total: 3,
      status: 'indexed',
    });

    expect(state.activelyIndexingPaperId).toBeNull();
    expect(state.indexingActive).toBe(true);
  });

  it('clears all state on complete event', () => {
    let state = applyProgressEvent(initialState, {
      paperId: 'paper-1',
      paperTitle: 'Paper 1',
      current: 1,
      total: 1,
      status: 'indexing',
    });

    state = applyProgressEvent(state, {
      paperId: '',
      paperTitle: '',
      current: 1,
      total: 1,
      status: 'complete',
    });

    expect(state.activelyIndexingPaperId).toBeNull();
    expect(state.indexingActive).toBe(false);
  });

  it('clears actively indexing paper on error event but keeps queue active', () => {
    let state = applyProgressEvent(initialState, {
      paperId: 'paper-1',
      paperTitle: 'Paper 1',
      current: 1,
      total: 2,
      status: 'indexing',
    });

    state = applyProgressEvent(state, {
      paperId: 'paper-1',
      paperTitle: 'Paper 1',
      current: 1,
      total: 2,
      status: 'error',
      error: 'Something broke',
    });

    expect(state.activelyIndexingPaperId).toBeNull();
    expect(state.indexingActive).toBe(true);
  });

  it('transitions through full 3-paper indexing sequence', () => {
    let state: IndexingUIState = { ...initialState };

    // Paper A: indexing
    state = applyProgressEvent(state, {
      paperId: 'A',
      paperTitle: 'A',
      current: 1,
      total: 3,
      status: 'indexing',
    });
    expect(state).toEqual({ activelyIndexingPaperId: 'A', indexingActive: true });

    // Paper A: indexed
    state = applyProgressEvent(state, {
      paperId: 'A',
      paperTitle: 'A',
      current: 1,
      total: 3,
      status: 'indexed',
    });
    expect(state).toEqual({ activelyIndexingPaperId: null, indexingActive: true });

    // Paper B: indexing
    state = applyProgressEvent(state, {
      paperId: 'B',
      paperTitle: 'B',
      current: 2,
      total: 3,
      status: 'indexing',
    });
    expect(state).toEqual({ activelyIndexingPaperId: 'B', indexingActive: true });

    // Paper B: indexed
    state = applyProgressEvent(state, {
      paperId: 'B',
      paperTitle: 'B',
      current: 2,
      total: 3,
      status: 'indexed',
    });
    expect(state).toEqual({ activelyIndexingPaperId: null, indexingActive: true });

    // Paper C: indexing
    state = applyProgressEvent(state, {
      paperId: 'C',
      paperTitle: 'C',
      current: 3,
      total: 3,
      status: 'indexing',
    });
    expect(state).toEqual({ activelyIndexingPaperId: 'C', indexingActive: true });

    // Paper C: indexed
    state = applyProgressEvent(state, {
      paperId: 'C',
      paperTitle: 'C',
      current: 3,
      total: 3,
      status: 'indexed',
    });
    expect(state).toEqual({ activelyIndexingPaperId: null, indexingActive: true });

    // Complete
    state = applyProgressEvent(state, {
      paperId: '',
      paperTitle: '',
      current: 3,
      total: 3,
      status: 'complete',
    });
    expect(state).toEqual({ activelyIndexingPaperId: null, indexingActive: false });
  });
});

describe('isQueuedForIndexing derivation', () => {
  it('returns false when indexing is not active', () => {
    const state: IndexingUIState = { activelyIndexingPaperId: null, indexingActive: false };
    expect(isQueuedForIndexing(state, 'paper-1', 'pending')).toBe(false);
  });

  it('returns false for the paper currently being indexed', () => {
    const state: IndexingUIState = { activelyIndexingPaperId: 'paper-1', indexingActive: true };
    expect(isQueuedForIndexing(state, 'paper-1', 'pending')).toBe(false);
  });

  it('returns false for papers already complete', () => {
    const state: IndexingUIState = { activelyIndexingPaperId: 'paper-1', indexingActive: true };
    expect(isQueuedForIndexing(state, 'paper-2', 'complete')).toBe(false);
  });

  it('returns true for pending papers while another is indexing', () => {
    const state: IndexingUIState = { activelyIndexingPaperId: 'paper-1', indexingActive: true };
    expect(isQueuedForIndexing(state, 'paper-2', 'pending')).toBe(true);
  });

  it('returns true for failed papers while indexing is active', () => {
    const state: IndexingUIState = { activelyIndexingPaperId: 'paper-1', indexingActive: true };
    expect(isQueuedForIndexing(state, 'paper-3', 'failed')).toBe(true);
  });

  it('returns true for papers with undefined status while indexing is active', () => {
    const state: IndexingUIState = { activelyIndexingPaperId: 'paper-1', indexingActive: true };
    expect(isQueuedForIndexing(state, 'paper-4', undefined)).toBe(true);
  });
});

describe('badge visual state derivation', () => {
  // Mirrors EmbeddingStatusBadge logic
  type BadgeVisual = 'blue-pulsing' | 'blue-hollow' | 'green' | 'red' | 'gray';

  function getBadgeVisual(
    embeddingStatus: 'pending' | 'indexing' | 'complete' | 'failed',
    isActivelyIndexingProp: boolean,
    isQueuedProp: boolean,
  ): BadgeVisual {
    if (isActivelyIndexingProp) return 'blue-pulsing';
    if (isQueuedProp) return 'blue-hollow';
    switch (embeddingStatus) {
      case 'complete':
        return 'green';
      case 'failed':
        return 'red';
      case 'indexing':
        return 'blue-pulsing';
      case 'pending':
        return 'gray';
    }
  }

  it('shows blue-pulsing from DB status even when event state is cleared (React batching)', () => {
    // React batches rapid events: by render time, activelyIndexingPaperId may be null
    // but loadPapers returned embeddingStatus: 'indexing' from the DB
    expect(getBadgeVisual('indexing', false, false)).toBe('blue-pulsing');
  });

  it('shows blue-pulsing from event override before DB refresh', () => {
    expect(getBadgeVisual('pending', true, false)).toBe('blue-pulsing');
  });

  it('shows blue-hollow for queued papers', () => {
    expect(getBadgeVisual('pending', false, true)).toBe('blue-hollow');
  });

  it('shows green for complete papers', () => {
    expect(getBadgeVisual('complete', false, false)).toBe('green');
  });

  it('shows red for failed papers', () => {
    expect(getBadgeVisual('failed', false, false)).toBe('red');
  });

  it('shows gray for pending papers', () => {
    expect(getBadgeVisual('pending', false, false)).toBe('gray');
  });

  it('event override takes priority over DB status', () => {
    // isActivelyIndexing from event arrives before loadPapers updates embeddingStatus
    expect(getBadgeVisual('pending', true, false)).toBe('blue-pulsing');
    // isQueued takes priority over pending
    expect(getBadgeVisual('pending', false, true)).toBe('blue-hollow');
  });
});

describe('isActivelyIndexing derivation', () => {
  it('returns true for the paper being indexed', () => {
    const state: IndexingUIState = { activelyIndexingPaperId: 'paper-1', indexingActive: true };
    expect(isActivelyIndexing(state, 'paper-1')).toBe(true);
  });

  it('returns false for other papers', () => {
    const state: IndexingUIState = { activelyIndexingPaperId: 'paper-1', indexingActive: true };
    expect(isActivelyIndexing(state, 'paper-2')).toBe(false);
  });

  it('returns false when no paper is indexing', () => {
    const state: IndexingUIState = { activelyIndexingPaperId: null, indexingActive: false };
    expect(isActivelyIndexing(state, 'paper-1')).toBe(false);
  });
});
