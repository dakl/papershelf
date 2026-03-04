// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearHighlights,
  createDebouncedSetter,
  findMatchesInTextLayers,
  getHighlightWindow,
} from '../components/pdf/PdfSearchBar';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal DOM tree that findMatchesInTextLayers can search. */
function buildContainer(pages: { pageIndex: number; spans: string[] }[]): HTMLElement {
  const container = document.createElement('div');
  for (const page of pages) {
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-page-index', String(page.pageIndex));
    const textLayer = document.createElement('div');
    textLayer.className = 'textLayer';
    for (const text of page.spans) {
      const span = document.createElement('span');
      span.textContent = text;
      textLayer.appendChild(span);
    }
    wrapper.appendChild(textLayer);
    container.appendChild(wrapper);
  }
  return container;
}

// ===========================================================================
// Group A: findMatchesInTextLayers
// ===========================================================================
describe('findMatchesInTextLayers', () => {
  it('returns empty array for empty query', () => {
    const container = buildContainer([{ pageIndex: 0, spans: ['hello world'] }]);
    expect(findMatchesInTextLayers(container, '')).toEqual([]);
  });

  it('finds a single match', () => {
    const container = buildContainer([{ pageIndex: 0, spans: ['hello world'] }]);
    const result = findMatchesInTextLayers(container, 'world');
    expect(result).toHaveLength(1);
    expect(result[0].startOffset).toBe(6);
    expect(result[0].length).toBe(5);
    expect(result[0].pageIndex).toBe(0);
  });

  it('finds matches across multiple pages', () => {
    const container = buildContainer([
      { pageIndex: 0, spans: ['page zero foo'] },
      { pageIndex: 1, spans: ['page one foo'] },
    ]);
    const result = findMatchesInTextLayers(container, 'foo');
    expect(result).toHaveLength(2);
    expect(result[0].pageIndex).toBe(0);
    expect(result[1].pageIndex).toBe(1);
  });

  it('finds multiple matches within the same span', () => {
    const container = buildContainer([{ pageIndex: 0, spans: ['abcabc'] }]);
    const result = findMatchesInTextLayers(container, 'abc');
    expect(result).toHaveLength(2);
    expect(result[0].startOffset).toBe(0);
    expect(result[1].startOffset).toBe(3);
  });

  it('matches case-insensitively', () => {
    const container = buildContainer([{ pageIndex: 0, spans: ['Hello HELLO hElLo'] }]);
    const result = findMatchesInTextLayers(container, 'hello');
    expect(result).toHaveLength(3);
  });

  it('returns empty when page has no textLayer', () => {
    const container = document.createElement('div');
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-page-index', '0');
    // No .textLayer child
    container.appendChild(wrapper);
    expect(findMatchesInTextLayers(container, 'test')).toEqual([]);
  });
});

// ===========================================================================
// Group B: clearHighlights
// ===========================================================================
describe('clearHighlights', () => {
  it('removes all elements with pdf-search-highlight class', () => {
    const container = document.createElement('div');
    for (let i = 0; i < 3; i++) {
      const el = document.createElement('div');
      el.className = 'pdf-search-highlight';
      container.appendChild(el);
    }
    expect(container.querySelectorAll('.pdf-search-highlight')).toHaveLength(3);
    clearHighlights(container);
    expect(container.querySelectorAll('.pdf-search-highlight')).toHaveLength(0);
  });

  it('leaves other elements untouched', () => {
    const container = document.createElement('div');
    const keep = document.createElement('div');
    keep.className = 'other-element';
    container.appendChild(keep);
    const remove = document.createElement('div');
    remove.className = 'pdf-search-highlight';
    container.appendChild(remove);
    clearHighlights(container);
    expect(container.querySelectorAll('.other-element')).toHaveLength(1);
  });
});

// ===========================================================================
// Group C: getHighlightWindow
// ===========================================================================
describe('getHighlightWindow', () => {
  it('returns full range when matchCount <= maxCount', () => {
    expect(getHighlightWindow(10, 5, 500)).toEqual({ start: 0, end: 10 });
  });

  it('caps the window to maxCount', () => {
    const { start, end } = getHighlightWindow(1000, 500, 100);
    expect(end - start).toBe(100);
  });

  it('centers the window around currentIndex', () => {
    const { start, end } = getHighlightWindow(1000, 500, 100);
    expect(start).toBe(450);
    expect(end).toBe(550);
  });

  it('clamps start to 0', () => {
    const { start, end } = getHighlightWindow(1000, 10, 100);
    expect(start).toBe(0);
    expect(end).toBe(100);
  });

  it('clamps end to matchCount', () => {
    const { start, end } = getHighlightWindow(1000, 990, 100);
    expect(end).toBe(1000);
    expect(start).toBe(900);
  });

  it('handles currentIndex at 0', () => {
    const { start, end } = getHighlightWindow(1000, 0, 100);
    expect(start).toBe(0);
    expect(end).toBe(100);
  });

  it('handles currentIndex at last index', () => {
    const { start, end } = getHighlightWindow(1000, 999, 100);
    expect(end).toBe(1000);
    expect(start).toBe(900);
  });

  it('always includes currentIndex in the window', () => {
    for (const idx of [0, 50, 499, 500, 999]) {
      const { start, end } = getHighlightWindow(1000, idx, 100);
      expect(idx).toBeGreaterThanOrEqual(start);
      expect(idx).toBeLessThan(end);
    }
  });
});

// ===========================================================================
// Group D: createDebouncedSetter
// ===========================================================================
describe('createDebouncedSetter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not call setter immediately on update', () => {
    const setter = vi.fn();
    const { update } = createDebouncedSetter(setter, 150);
    update('hello');
    expect(setter).not.toHaveBeenCalled();
  });

  it('calls setter after the delay', () => {
    const setter = vi.fn();
    const { update } = createDebouncedSetter(setter, 150);
    update('hello');
    vi.advanceTimersByTime(150);
    expect(setter).toHaveBeenCalledWith('hello');
    expect(setter).toHaveBeenCalledTimes(1);
  });

  it('resets the timer on rapid calls', () => {
    const setter = vi.fn();
    const { update } = createDebouncedSetter(setter, 150);
    update('a');
    vi.advanceTimersByTime(100);
    update('ab');
    vi.advanceTimersByTime(100);
    update('abc');
    vi.advanceTimersByTime(150);
    expect(setter).toHaveBeenCalledTimes(1);
    expect(setter).toHaveBeenCalledWith('abc');
  });

  it('flush calls setter immediately', () => {
    const setter = vi.fn();
    const { flush } = createDebouncedSetter(setter, 150);
    flush('now');
    expect(setter).toHaveBeenCalledWith('now');
  });

  it('flush cancels any pending debounced call', () => {
    const setter = vi.fn();
    const { update, flush } = createDebouncedSetter(setter, 150);
    update('pending');
    flush('immediate');
    vi.advanceTimersByTime(200);
    expect(setter).toHaveBeenCalledTimes(1);
    expect(setter).toHaveBeenCalledWith('immediate');
  });

  it('cancel prevents pending call from firing', () => {
    const setter = vi.fn();
    const { update, cancel } = createDebouncedSetter(setter, 150);
    update('hello');
    cancel();
    vi.advanceTimersByTime(200);
    expect(setter).not.toHaveBeenCalled();
  });
});
