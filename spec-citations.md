# PaperShelf — Citations & Discovery Specification

## Overview

Add citation data and paper discovery to PaperShelf. Citation counts and graphs via Semantic Scholar, category feeds, author following, and smart recommendations turn PaperShelf into an active research assistant.

Inspired by arxbar's [citation specification](../arxbar/spec-citations.md).

## Features

### 1. Citation Data (Semantic Scholar)

arXiv doesn't track citations. Semantic Scholar fills the gap — free API, excellent arXiv coverage, provides citation counts, influential citations, and paper embeddings.

**Data flow:**
```
arXiv ID → Check local cache → Semantic Scholar API → Cache & return
                                      ↓ (not found)
                                OpenCitations fallback
```

**What we store per paper:**
- Citation count + influential citation count
- Reference count
- Semantic Scholar paper ID (for follow-up queries)
- Citing papers (title, authors, year, is_influential)
- References (title, authors, year)
- Last updated timestamp

**Display in UI:**
- Citation count badge on paper list items (e.g., `[142 citations]`)
- "Cited by" and "References" tabs in paper detail view
- Clicking a citing/referenced paper → search for it or open on arXiv

**Cache strategy:**
- Citation counts: refresh after 24 hours
- Citation lists: refresh after 7 days
- References: refresh after 30 days
- Cache 404s for 24 hours (new papers not yet indexed)

### 2. Category Subscriptions

Follow arXiv categories to see new papers in your areas of interest.

**How it works:**
- User subscribes to categories (e.g., cs.AI, cs.LG, stat.ML)
- Background job checks arXiv RSS feeds or new submissions API periodically
- New papers appear in a "Discover" section in the sidebar
- Optional native macOS notifications for new papers

**Database:**
```sql
CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  category TEXT UNIQUE NOT NULL,       -- e.g., 'cs.AI'
  last_checked INTEGER,                -- Unix timestamp
  notify_enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE feed_papers (
  id TEXT PRIMARY KEY,                 -- arXiv ID
  title TEXT NOT NULL,
  authors TEXT,                        -- JSON array
  summary TEXT,
  published TEXT,
  categories TEXT,                     -- JSON array
  seen INTEGER DEFAULT 0,             -- User has seen this
  saved INTEGER DEFAULT 0,            -- User saved to library
  subscription_id TEXT REFERENCES subscriptions(id) ON DELETE CASCADE,
  fetched_at TEXT DEFAULT (datetime('now'))
);
```

**UI:**
- Sidebar: "Discover" section with unread count badge
- Feed view: grouped by category, newest first
- Each paper: title, authors, date, abstract snippet, "Save" button
- Mark as read on click, bulk "mark all read"

### 3. Author Following

Track specific researchers and get notified when they publish.

**Database:**
```sql
CREATE TABLE followed_authors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  arxiv_query TEXT NOT NULL,           -- e.g., 'au:"Hinton, Geoffrey"'
  last_checked INTEGER,
  notify_enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
```

**How it works:**
- User follows an author (from paper detail or manual entry)
- Background job queries arXiv: `au:"{author_name}"` sorted by submittedDate
- New papers from followed authors appear in Discover feed
- Distinct from category subscriptions — author papers highlighted differently

### 4. Smart Recommendations

Surface papers the user might care about based on their library.

**v1 (keyword-based):**
- Extract top keywords from user's library (TF-IDF on titles + abstracts)
- Periodically search arXiv for those keywords
- Filter out papers already in library
- Rank by recency + keyword overlap

**v2 (embedding-based, future):**
- Use Semantic Scholar paper embeddings
- Find papers with high cosine similarity to library papers
- Cluster user's library to identify research themes

### 5. Daily Digest (optional)

Summarize new papers from subscriptions + followed authors into a daily overview. Requires LLM (uses configured provider from settings).

**How it works:**
- Collect all new papers from last 24 hours across subscriptions
- Send titles + abstracts to LLM with prompt: "Summarize these papers grouped by topic"
- Show digest in a dedicated view or as a notification

---

## MCP Tools (Iteration B additions)

### `get_citations`

Get citation data for a paper.

**Input:**
```typescript
{
  arxiv_id: string;
  include_citing_papers?: boolean;    // default true
  include_references?: boolean;       // default true
  max_citations?: number;             // default 50
  force_refresh?: boolean;            // bypass cache
}
```

**Output:**
```typescript
{
  arxiv_id: string;
  citation_count: number;
  influential_citation_count: number;
  reference_count: number;
  citing_papers?: Array<{
    arxiv_id?: string;
    title: string;
    authors: string[];
    year: number;
    is_influential: boolean;
  }>;
  references?: Array<{
    arxiv_id?: string;
    title: string;
    authors: string[];
    year: number;
  }>;
  source: 's2' | 'opencitations';
  last_updated: string;
}
```

### `get_citation_graph`

Build a citation network around a paper.

**Input:**
```typescript
{
  arxiv_id: string;
  depth?: number;                     // 1–3, default 1
  max_nodes?: number;                 // default 100
}
```

**Output:**
```typescript
{
  nodes: Array<{ arxiv_id: string; title: string; citation_count: number; year: number }>;
  edges: Array<{ from: string; to: string; is_influential: boolean }>;
  center_node: string;
}
```

### `get_recommendations`

Get paper recommendations based on the user's library.

**Input:**
```typescript
{
  based_on?: string;                  // arXiv ID to find similar papers (optional)
  limit?: number;                     // default 20
}
```

**Output:** Array of recommended papers with relevance scores.

### `list_subscriptions`

List active category subscriptions.

### `get_feed`

Get recent papers from subscriptions.

**Input:**
```typescript
{
  category?: string;                  // Filter to specific category
  unseen_only?: boolean;              // default true
  limit?: number;                     // default 50
}
```

---

## Database Schema Additions

```sql
-- Citation metadata
CREATE TABLE citations (
  arxiv_id TEXT PRIMARY KEY,
  citation_count INTEGER DEFAULT 0,
  influential_citation_count INTEGER DEFAULT 0,
  reference_count INTEGER DEFAULT 0,
  s2_paper_id TEXT,
  last_updated INTEGER NOT NULL,
  source TEXT NOT NULL DEFAULT 's2',
  FOREIGN KEY (arxiv_id) REFERENCES papers(id)
);

-- Individual citation relationships
CREATE TABLE citation_edges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  citing_id TEXT,
  cited_id TEXT,
  is_influential INTEGER DEFAULT 0,
  citing_title TEXT,
  citing_authors TEXT,
  citing_year INTEGER
);

CREATE INDEX idx_citation_edges_cited ON citation_edges(cited_id);
CREATE INDEX idx_citation_edges_citing ON citation_edges(citing_id);

-- Category subscriptions
CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  category TEXT UNIQUE NOT NULL,
  last_checked INTEGER,
  notify_enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Papers from feeds (not yet in library)
CREATE TABLE feed_papers (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  authors TEXT,
  summary TEXT,
  published TEXT,
  categories TEXT,
  seen INTEGER DEFAULT 0,
  saved INTEGER DEFAULT 0,
  subscription_id TEXT REFERENCES subscriptions(id) ON DELETE CASCADE,
  fetched_at TEXT DEFAULT (datetime('now'))
);

-- Followed authors
CREATE TABLE followed_authors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  arxiv_query TEXT NOT NULL,
  last_checked INTEGER,
  notify_enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
```

## Project Structure Additions

```
src/main/
├── citations/
│   ├── client.ts              # Main citation client with cache logic
│   ├── semantic-scholar.ts    # S2 API wrapper
│   └── types.ts               # Citation types
├── discovery/
│   ├── subscriptions.ts       # Category subscription management
│   ├── feed.ts                # Feed fetching + storage
│   ├── authors.ts             # Author following
│   └── recommendations.ts     # Recommendation engine
```

## Semantic Scholar API Details

**Base URL:** `https://api.semanticscholar.org/graph/v1`

**Rate limits:**
- 100 requests / 5 minutes (unauthenticated)
- 5000 requests / 5 minutes (with free API key)

**Key endpoints:**
- `GET /paper/arXiv:{id}?fields=citationCount,influentialCitationCount,references,citations`
- `GET /paper/{s2Id}/citations?fields=title,authors,year,isInfluential&limit=50`
- `GET /paper/{s2Id}/references?fields=title,authors,year&limit=50`

**API key:** Optional but recommended. Store in settings table, encrypted via Electron `safeStorage`.

## Implementation Order

1. **Citation client** — Semantic Scholar API wrapper + cache
2. **`get_citations` MCP tool** — Wire up to existing MCP server
3. **Citation UI** — Badge on paper list, cited-by tab in detail
4. **Category subscriptions** — Database + background job + feed view
5. **Author following** — Database + arXiv query + feed integration
6. **`get_citation_graph` MCP tool**
7. **Recommendations v1** — Keyword-based
8. **Daily digest** — LLM summarization (optional, requires configured provider)

## Dependencies (new)

No new npm dependencies needed — `fetch` is sufficient for Semantic Scholar API calls.

Optional: `node-cron` or simple `setInterval` for background jobs.
