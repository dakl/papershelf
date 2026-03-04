export interface GoldenPaper {
  arxivId: string;
  title: string;
  authors: string[];
  abstract: string;
  categories: string[];
  bodyExcerpt: string;
  publishedDate: string;
}

export interface RelevanceJudgment {
  paperId: string;
  relevance: 0 | 1 | 2 | 3;
}

export interface GoldenQuery {
  id: string;
  query: string;
  description: string;
  judgments: RelevanceJudgment[];
}

export interface GoldenSet {
  papers: GoldenPaper[];
  queries: GoldenQuery[];
}

export interface QueryEvalResult {
  queryId: string;
  query: string;
  mrr: number;
  ndcgAt10: number;
  precisionAt5: number;
  precisionAt10: number;
  rankedResults: { arxivId: string | null; title: string; score: number; matchType: string }[];
}

export type SearchMode = 'keyword' | 'semantic' | 'hybrid';

export interface ModeEvalOutput {
  mode: SearchMode;
  aggregated: { meanMRR: number; meanNDCG10: number; meanP5: number; meanP10: number };
  queries: QueryEvalResult[];
}

export interface EvalOutput {
  modes: ModeEvalOutput[];
}
