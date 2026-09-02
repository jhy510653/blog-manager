// server/services/naver/naverTypes.ts

export type KeywordStatus = 'HIGH' | 'MEDIUM' | 'LOW' | 'FILTERED';

export interface TrendItem {
  keyword: string;
  source: 'news' | 'shopping' | 'datalab';
  rank?: number;
  title?: string;
  publisher?: string;
  url?: string;
  collectedAt: string;
  metadata?: Record<string, unknown>;
}

export interface NaverNewsItem {
  id: string;
  title: string;
  originalLink: string;
  link: string;
  description: string;
  pubDate: string;
  pressName: string;
}

export interface NaverRealtimeKeywordItem {
  rank: number;
  originalRank: number;
  keyword: string;
  relatedArticleCount: number;
  latestArticleTime: string;
  representativeTitle: string;
  publisher: string;
  url: string;
  blogUsabilityScore: number;
  usabilityLabel: KeywordStatus;
  status: KeywordStatus;
  collectedAt: string;
  category?: string;
  source: string;
  manuallyExcluded?: boolean;
  scoreBreakdown?: {
    specificity: number;
    intent: number;
    entity: number;
    titleReady: number;
  };
}

export interface KeywordFilterPolicy {
  minKeywordLength: number;
  showLowKeywordsByDefault: boolean;
  highScoreThreshold: number;
  mediumScoreThreshold: number;
  excludedKeywords: string[];
  excludedPatterns: string[];
  manuallyExcludedKeywords: string[];
}

export interface KeywordCollectionTestResult {
  apiStatus: {
    news: { ok: boolean; message: string; latencyMs: number };
    blog: { ok: boolean; message: string; latencyMs: number };
    shopping: { ok: boolean; message: string; latencyMs: number };
    datalab: { ok: boolean; message: string; latencyMs: number };
  };
  totalCollectedCount: number;
  dedupedCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  filteredCount: number;
  hasError: boolean;
  errorMessage?: string;
  sampleKeywords: NaverRealtimeKeywordItem[];
  testedAt: string;
}

export interface NaverShoppingPopularItem {
  rank: number;
  keyword: string;
  category: string;
  period: string;
  clickRatio?: number;
}

export interface NaverSearchTrendResult {
  title: string;
  keywords: string[];
  data: Array<{
    period: string;
    ratio: number;
  }>;
}

export interface NaverApiStatus {
  news: { ok: boolean; message: string; latencyMs: number };
  blog: { ok: boolean; message: string; latencyMs: number };
  shopping: { ok: boolean; message: string; latencyMs: number };
  datalab: { ok: boolean; message: string; latencyMs: number };
  checkedAt: string;
}

