import { describe, expect, it } from 'vitest';
import { buildSearchQuery } from '../arxiv-client';

describe('buildSearchQuery', () => {
  it('builds query with general search term', () => {
    const result = buildSearchQuery({ query: 'transformer' });
    expect(result).toBe('all:transformer');
  });

  it('builds query with author only', () => {
    const result = buildSearchQuery({ author: 'Vaswani' });
    expect(result).toBe('au:Vaswani');
  });

  it('builds query with title only', () => {
    const result = buildSearchQuery({ title: 'attention' });
    expect(result).toBe('ti:attention');
  });

  it('combines query and author with AND', () => {
    const result = buildSearchQuery({ query: 'transformer', author: 'Vaswani' });
    expect(result).toBe('all:transformer+AND+au:Vaswani');
  });

  it('combines author and title with AND', () => {
    const result = buildSearchQuery({ author: 'Vaswani', title: 'attention' });
    expect(result).toBe('au:Vaswani+AND+ti:attention');
  });

  it('combines all three fields with AND', () => {
    const result = buildSearchQuery({ query: 'deep learning', author: 'Vaswani', title: 'attention' });
    expect(result).toBe('all:deep%20learning+AND+au:Vaswani+AND+ti:attention');
  });

  it('encodes special characters in query', () => {
    const result = buildSearchQuery({ query: 'neural network & transformers' });
    expect(result).toBe('all:neural%20network%20%26%20transformers');
  });

  it('encodes special characters in author', () => {
    const result = buildSearchQuery({ author: "O'Brien" });
    expect(result).toBe("au:O'Brien");
  });

  it('appends category filter', () => {
    const result = buildSearchQuery({ query: 'transformer', categories: ['cs.AI'] });
    expect(result).toBe('all:transformer+AND+%28cat:cs.AI%29');
  });

  it('appends multiple categories with OR', () => {
    const result = buildSearchQuery({ query: 'transformer', categories: ['cs.AI', 'cs.CL'] });
    expect(result).toBe('all:transformer+AND+%28cat:cs.AI+OR+cat:cs.CL%29');
  });

  it('combines author + title + categories', () => {
    const result = buildSearchQuery({ author: 'Vaswani', title: 'attention', categories: ['cs.CL'] });
    expect(result).toBe('au:Vaswani+AND+ti:attention+AND+%28cat:cs.CL%29');
  });

  it('throws when no fields provided', () => {
    expect(() => buildSearchQuery({})).toThrow('At least one of query, author, or title is required');
  });

  it('ignores empty categories array', () => {
    const result = buildSearchQuery({ query: 'test', categories: [] });
    expect(result).toBe('all:test');
  });
});
