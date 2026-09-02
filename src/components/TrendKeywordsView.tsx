// src/components/TrendKeywordsView.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  Newspaper,
  ShoppingBag,
  LineChart,
  Search,
  RefreshCw,
  ExternalLink,
  FileEdit,
  Sparkles,
  Check,
  Copy,
  Clock,
  AlertCircle,
  Activity,
  Layers,
  ChevronRight,
  Filter,
  X,
  Plus,
  Trash2,
  BarChart3,
  Calendar,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { NaverUser } from '../types';
import { KeywordAnalysisSection } from './trend/KeywordAnalysisSection';

// Tab Types
export type KeywordCollectionTab = 'realtime' | 'news' | 'shopping' | 'datalab';

// News category options
const NEWS_CATEGORIES = [
  '전체',
  '경제',
  '사회',
  '생활/문화',
  'IT/과학',
  '연예',
  '스포츠',
];

// Shopping category options
const SHOPPING_CATEGORIES = [
  '패션의류/잡화',
  '화장품/미용',
  '디지털/가전',
  '가구/인테리어',
  '출산/육아',
  '식품',
  '스포츠/레저',
  '생활/건강',
  '여가/생활편의',
  '도서',
];

interface RealtimeItem {
  rank: number;
  originalRank?: number;
  keyword: string;
  blogUsabilityScore?: number;
  usabilityLabel?: 'HIGH' | 'MEDIUM' | 'LOW' | 'FILTERED';
  status?: 'HIGH' | 'MEDIUM' | 'LOW' | 'FILTERED';
  collectedAt: string;
  source: string;
  manuallyExcluded?: boolean;
  relatedArticleCount?: number;
  latestArticleTime?: string;
  sourceCategory?: string;
  recentNewsHeadlines?: string[];
  scoreBreakdown?: {
    specificity: number;
    intent: number;
    entity: number;
    titleReady: number;
  };
}

interface NewsItem {
  id: string;
  title: string;
  originalLink: string;
  link: string;
  description: string;
  pubDate: string;
  pressName: string;
}

interface ShoppingItem {
  rank: number;
  keyword: string;
  category: string;
  period: string;
}

interface DataLabPoint {
  period: string;
  ratio: number;
}

interface DataLabResultItem {
  title: string;
  keywords: string[];
  data: DataLabPoint[];
}

interface TrendKeywordsViewProps {
  currentUser: NaverUser | null;
  isAdminLoggedIn: boolean;
  onOpenGoogleAuth: () => void;
  onSelectKeywordForDraft: (keyword: string) => void;
  onShowToast: (msg: string) => void;
}

export const TrendKeywordsView: React.FC<TrendKeywordsViewProps> = ({
  currentUser,
  isAdminLoggedIn,
  onOpenGoogleAuth,
  onSelectKeywordForDraft,
  onShowToast,
}) => {
  // Navigation tab state
  const [activeTab, setActiveTab] = useState<KeywordCollectionTab>('realtime');

  // Shared state
  const [copiedKeyword, setCopiedKeyword] = useState<string | null>(null);
  const [analyzingKeyword, setAnalyzingKeyword] = useState<string | null>(null);
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState<boolean>(false);

  // Tab 1: Realtime Keywords State
  const [realtimeList, setRealtimeList] = useState<RealtimeItem[]>([]);
  const [realtimeLoading, setRealtimeLoading] = useState<boolean>(false);
  const [realtimeError, setRealtimeError] = useState<string | null>(null);
  const [realtimeUpdatedAt, setRealtimeUpdatedAt] = useState<string | null>(null);
  const [realtimeFilter, setRealtimeFilter] = useState<string>('');
  const [showLowUsability, setShowLowUsability] = useState<boolean>(false);
  const [usabilityFilter, setUsabilityFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');
  const [excludingKeyword, setExcludingKeyword] = useState<string | null>(null);

  // Tab 2: News State
  const [newsCategory, setNewsCategory] = useState<string>('전체');
  const [newsSearchQuery, setNewsSearchQuery] = useState<string>('');
  const [newsList, setNewsList] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState<boolean>(false);
  const [newsError, setNewsError] = useState<string | null>(null);

  // Tab 3: Shopping Popular State
  const [shoppingCategory, setShoppingCategory] = useState<string>('패션의류/잡화');
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);
  const [shoppingLoading, setShoppingLoading] = useState<boolean>(false);
  const [shoppingError, setShoppingError] = useState<string | null>(null);

  // Tab 4: DataLab Trend State
  const [datalabKeywords, setDatalabKeywords] = useState<string[]>(['블로그 마케팅', '인스타그램']);
  const [newKeywordInput, setNewKeywordInput] = useState<string>('');
  const [datalabPeriod, setDatalabPeriod] = useState<string>('1m');
  const [datalabTimeUnit, setDatalabTimeUnit] = useState<string>('date');
  const [datalabDevice, setDatalabDevice] = useState<string>('all');
  const [datalabGender, setDatalabGender] = useState<string>('all');
  const [datalabResults, setDatalabResults] = useState<DataLabResultItem[]>([]);
  const [datalabLoading, setDatalabLoading] = useState<boolean>(false);
  const [datalabError, setDatalabError] = useState<string | null>(null);

  // Admin API Status Modal
  const [isAdminStatusOpen, setIsAdminStatusOpen] = useState<boolean>(false);
  const [adminApiStatus, setAdminApiStatus] = useState<any>(null);
  const [adminStatusLoading, setAdminStatusLoading] = useState<boolean>(false);

  // Copy helper
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKeyword(text);
    onShowToast(`'${text}' 키워드가 복사되었습니다.`);
    setTimeout(() => setCopiedKeyword(null), 2000);
  };

  // Open single keyword analysis
  const handleOpenAnalysis = (kw: string) => {
    setAnalyzingKeyword(kw);
    setIsAnalysisModalOpen(true);
  };

  // 1. Fetch Realtime Rising Keywords
  const loadRealtimeKeywords = useCallback(async () => {
    setRealtimeLoading(true);
    setRealtimeError(null);
    try {
      const res = await fetch('/api/naver/realtime-keywords');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setRealtimeList(data.data);
        setRealtimeUpdatedAt(data.collectedAt || new Date().toLocaleTimeString());
      } else {
        setRealtimeError(data.error || '실시간 급상승 키워드를 불러올 수 없습니다.');
      }
    } catch (err: any) {
      setRealtimeError('네트워크 오류로 실시간 키워드를 불러오지 못했습니다.');
    } finally {
      setRealtimeLoading(false);
    }
  }, []);

  // 2. Fetch News
  const loadNews = useCallback(async (cat = newsCategory, q = newsSearchQuery) => {
    setNewsLoading(true);
    setNewsError(null);
    try {
      const url = `/api/naver/news?category=${encodeURIComponent(cat)}&query=${encodeURIComponent(q)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setNewsList(data.data);
      } else {
        setNewsError(data.error || '뉴스 검색 결과를 불러올 수 없습니다.');
      }
    } catch (err: any) {
      setNewsError('네트워크 오류로 뉴스 데이터를 불러오지 못했습니다.');
    } finally {
      setNewsLoading(false);
    }
  }, [newsCategory, newsSearchQuery]);

  // 3. Fetch Shopping Popular Keywords
  const loadShopping = useCallback(async (cat = shoppingCategory) => {
    setShoppingLoading(true);
    setShoppingError(null);
    try {
      const url = `/api/naver/shopping-popular?category=${encodeURIComponent(cat)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setShoppingList(data.data);
      } else {
        setShoppingError(data.error || '쇼핑 인기 검색어를 불러올 수 없습니다.');
      }
    } catch (err: any) {
      setShoppingError('네트워크 오류로 쇼핑 데이터를 불러오지 못했습니다.');
    } finally {
      setShoppingLoading(false);
    }
  }, [shoppingCategory]);

  // 4. Fetch DataLab Search Trend
  const loadDataLabTrend = useCallback(async () => {
    if (datalabKeywords.length === 0) {
      onShowToast('분석할 키워드를 1개 이상 추가해주세요.');
      return;
    }
    setDatalabLoading(true);
    setDatalabError(null);
    try {
      const res = await fetch('/api/naver/search-trend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords: datalabKeywords,
          period: datalabPeriod,
          timeUnit: datalabTimeUnit,
          device: datalabDevice === 'all' ? undefined : datalabDevice,
          gender: datalabGender === 'all' ? undefined : datalabGender,
        }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setDatalabResults(data.data);
      } else {
        setDatalabError(data.error || '검색 트렌드 데이터를 불러올 수 없습니다.');
      }
    } catch (err: any) {
      setDatalabError('네트워크 오류로 트렌드 분석에 실패했습니다.');
    } finally {
      setDatalabLoading(false);
    }
  }, [datalabKeywords, datalabPeriod, datalabTimeUnit, datalabDevice, datalabGender, onShowToast]);

  // Admin API Status Check
  const handleCheckAdminApiStatus = async () => {
    setAdminStatusLoading(true);
    try {
      const res = await fetch('/api/admin/naver/status');
      const data = await res.json();
      if (data.success) {
        setAdminApiStatus(data);
      } else {
        onShowToast(data.error || 'API 진단 실패');
      }
    } catch (e: any) {
      onShowToast('API 상태 점검 중 오류가 발생했습니다.');
    } finally {
      setAdminStatusLoading(false);
    }
  };

  // Initial tab loading
  useEffect(() => {
    if (activeTab === 'realtime' && realtimeList.length === 0 && !realtimeLoading) {
      loadRealtimeKeywords();
    } else if (activeTab === 'news' && newsList.length === 0 && !newsLoading) {
      loadNews();
    } else if (activeTab === 'shopping' && shoppingList.length === 0 && !shoppingLoading) {
      loadShopping();
    } else if (activeTab === 'datalab' && datalabResults.length === 0 && !datalabLoading) {
      loadDataLabTrend();
    }
  }, [activeTab]);

  // Admin manual exclude keyword
  const handleExcludeKeyword = async (keyword: string, action: 'add' | 'remove' = 'add') => {
    setExcludingKeyword(keyword);
    try {
      const res = await fetch('/api/admin/naver/exclude-keyword', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword, action }),
      });
      const data = await res.json();
      if (data.success) {
        onShowToast(data.message || '키워드 제외 상태가 변경되었습니다.');
        loadRealtimeKeywords();
      } else {
        onShowToast(data.error || '처리에 실패했습니다.');
      }
    } catch {
      onShowToast('네트워크 오류가 발생했습니다.');
    } finally {
      setExcludingKeyword(null);
    }
  };

  // Realtime keyword counts
  const highCount = realtimeList.filter((item) => item.status === 'HIGH' || (item.blogUsabilityScore && item.blogUsabilityScore >= 80)).length;
  const mediumCount = realtimeList.filter((item) => item.status === 'MEDIUM' || (item.blogUsabilityScore && item.blogUsabilityScore >= 55 && item.blogUsabilityScore < 80)).length;
  const lowCount = realtimeList.filter((item) => item.status === 'LOW' || (item.blogUsabilityScore && item.blogUsabilityScore < 55)).length;

  // Filtered realtime items based on search query, toggle, and usability filter
  const filteredRealtime = realtimeList.filter((item) => {
    // 1. Text filter
    if (realtimeFilter && !item.keyword.toLowerCase().includes(realtimeFilter.toLowerCase())) {
      return false;
    }
    // 2. Usability filter
    const status = item.status || (item.blogUsabilityScore && item.blogUsabilityScore >= 80 ? 'HIGH' : item.blogUsabilityScore && item.blogUsabilityScore >= 55 ? 'MEDIUM' : 'LOW');
    if (usabilityFilter !== 'ALL') {
      return status === usabilityFilter;
    }
    // 3. If usabilityFilter is ALL and showLowUsability is false, hide LOW
    if (!showLowUsability && status === 'LOW') {
      return false;
    }
    return true;
  });

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header Section */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-6 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <Sparkles className="w-4 h-4" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">키워드 수집</h1>
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">
                네이버 실데이터 연동
              </span>
            </div>
            <p className="text-sm text-gray-600">
              네이버 실시간 검색/뉴스/쇼핑 공식 데이터를 기반으로 블로그 포스팅에 적합한 실시간 트렌드 키워드를 정밀 수집합니다.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {isAdminLoggedIn && (
              <button
                id="btn-admin-api-status"
                onClick={() => {
                  setIsAdminStatusOpen(true);
                  handleCheckAdminApiStatus();
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
              >
                <Activity className="w-3.5 h-3.5 text-emerald-600" />
                API 상태 진단
              </button>
            )}

            <button
              id="btn-refresh-current-tab"
              onClick={() => {
                if (activeTab === 'realtime') loadRealtimeKeywords();
                else if (activeTab === 'news') loadNews();
                else if (activeTab === 'shopping') loadShopping();
                else if (activeTab === 'datalab') loadDataLabTrend();
              }}
              disabled={realtimeLoading || newsLoading || shoppingLoading || datalabLoading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-sm transition"
            >
              <RefreshCw
                className={`w-4 h-4 ${
                  realtimeLoading || newsLoading || shoppingLoading || datalabLoading ? 'animate-spin' : ''
                }`}
              />
              <span>새로고침</span>
            </button>
          </div>
        </div>

        {/* 4 Main Tabs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-6 pt-6 border-t border-gray-100">
          <button
            id="tab-realtime-rising"
            onClick={() => setActiveTab('realtime')}
            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold transition ${
              activeTab === 'realtime'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs'
                : 'text-gray-600 hover:bg-gray-50 border border-transparent'
            }`}
          >
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <span>실시간 급상승</span>
            {realtimeList.length > 0 && (
              <span className="text-xs bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full font-bold">
                {realtimeList.length}
              </span>
            )}
          </button>

          <button
            id="tab-news-trend"
            onClick={() => setActiveTab('news')}
            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold transition ${
              activeTab === 'news'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs'
                : 'text-gray-600 hover:bg-gray-50 border border-transparent'
            }`}
          >
            <Newspaper className="w-4 h-4 text-emerald-600" />
            <span>뉴스</span>
          </button>

          <button
            id="tab-shopping-popular"
            onClick={() => setActiveTab('shopping')}
            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold transition ${
              activeTab === 'shopping'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs'
                : 'text-gray-600 hover:bg-gray-50 border border-transparent'
            }`}
          >
            <ShoppingBag className="w-4 h-4 text-emerald-600" />
            <span>쇼핑 인기</span>
          </button>

          <button
            id="tab-datalab-trend"
            onClick={() => setActiveTab('datalab')}
            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold transition ${
              activeTab === 'datalab'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs'
                : 'text-gray-600 hover:bg-gray-50 border border-transparent'
            }`}
          >
            <LineChart className="w-4 h-4 text-emerald-600" />
            <span>검색 트렌드</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: 실시간 급상승 키워드 */}
      {/* ========================================================================= */}
      {activeTab === 'realtime' && (
        <div className="space-y-4">
          {/* Top Filter & Toolbar */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs">
            {/* Usability Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                id="btn-filter-all"
                onClick={() => setUsabilityFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  usabilityFilter === 'ALL'
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                전체보기 ({realtimeList.length})
              </button>
              <button
                id="btn-filter-high"
                onClick={() => setUsabilityFilter('HIGH')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  usabilityFilter === 'HIGH'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>HIGH · 포스팅 적합 ({highCount})</span>
              </button>
              <button
                id="btn-filter-medium"
                onClick={() => setUsabilityFilter('MEDIUM')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  usabilityFilter === 'MEDIUM'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>MEDIUM · 소재 검토 ({mediumCount})</span>
              </button>
              {lowCount > 0 && (
                <button
                  id="btn-filter-low"
                  onClick={() => setUsabilityFilter('LOW')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    usabilityFilter === 'LOW'
                      ? 'bg-gray-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <span>LOW · 포괄적 ({lowCount})</span>
                </button>
              )}
            </div>

            {/* Right Controls: Low Toggle & Search */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-200">
                <input
                  id="checkbox-show-low"
                  type="checkbox"
                  checked={showLowUsability || usabilityFilter === 'LOW'}
                  onChange={(e) => setShowLowUsability(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                />
                <span>포괄적(LOW) 키워드 포함</span>
              </label>

              <div className="relative w-full sm:w-56">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                <input
                  id="input-realtime-filter"
                  type="text"
                  value={realtimeFilter}
                  onChange={(e) => setRealtimeFilter(e.target.value)}
                  placeholder="키워드 빠른 검색..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Collection Metadata Info */}
          <div className="flex items-center justify-between px-2 text-xs text-gray-500">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              <span>수집 시각: {realtimeUpdatedAt || '방금 전'}</span>
              <span className="text-gray-300">•</span>
              <span>네이버 실시간 검색 시그널 원문 보존</span>
            </div>
            <span>표시 중인 키워드: {filteredRealtime.length}개</span>
          </div>

          {realtimeError && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0 text-amber-600" />
              <span>{realtimeError}</span>
            </div>
          )}

          {/* Grid of Keywords */}
          {realtimeLoading ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
              <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-600 font-medium">네이버 실시간 급상승 키워드를 수집하고 정제하는 중입니다...</p>
            </div>
          ) : filteredRealtime.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
              <p className="text-gray-500 text-sm">해당 조건에 일치하는 실시간 키워드가 없습니다.</p>
              {!showLowUsability && lowCount > 0 && (
                <button
                  onClick={() => setShowLowUsability(true)}
                  className="mt-3 text-xs text-emerald-600 underline font-medium"
                >
                  포괄적(LOW) 키워드 {lowCount}개 포함하여 보기
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredRealtime.map((item) => {
                const score = item.blogUsabilityScore ?? 60;
                const status = item.status || (score >= 80 ? 'HIGH' : score >= 55 ? 'MEDIUM' : 'LOW');

                return (
                  <div
                    key={`${item.rank}-${item.keyword}`}
                    className="bg-white rounded-xl border border-gray-200/90 p-4 hover:border-emerald-300 hover:shadow-sm transition group flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Header: Rank, Status Badge, Copy */}
                      <div className="flex items-start justify-between gap-2 mb-2.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`w-6 h-6 shrink-0 rounded-md flex items-center justify-center font-bold text-xs ${
                              item.rank <= 3
                                ? 'bg-emerald-600 text-white'
                                : item.rank <= 10
                                ? 'bg-emerald-100 text-emerald-800 font-semibold'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {item.rank}
                          </span>

                          {/* Usability Badge */}
                          {status === 'HIGH' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              HIGH · 활용 추천
                            </span>
                          )}
                          {status === 'MEDIUM' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                              MEDIUM · 소재 검토
                            </span>
                          )}
                          {status === 'LOW' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                              LOW · 포괄적
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            id={`btn-copy-${item.rank}`}
                            onClick={() => handleCopy(item.keyword)}
                            className="text-gray-400 hover:text-gray-700 p-1 rounded-md hover:bg-gray-100"
                            title="키워드 복사"
                          >
                            {copiedKeyword === item.keyword ? (
                              <Check className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>

                          {isAdminLoggedIn && (
                            <button
                              id={`btn-admin-exclude-${item.rank}`}
                              onClick={() => handleExcludeKeyword(item.keyword, 'add')}
                              disabled={excludingKeyword === item.keyword}
                              className="text-gray-300 hover:text-red-600 p-1 rounded-md hover:bg-red-50 transition"
                              title="관리자: 이 키워드 수동 제외"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Main Keyword with Link to Naver Search */}
                      <div className="my-2">
                        <a
                          href={`https://search.naver.com/search.naver?query=${encodeURIComponent(item.keyword)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-base font-bold text-gray-900 hover:text-emerald-600 truncate flex items-center gap-1.5 group-hover:underline"
                          title="네이버 검색 결과로 이동 (새 창)"
                        >
                          <span className="truncate">{item.keyword}</span>
                          <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-40 group-hover:opacity-100 text-emerald-600" />
                        </a>
                      </div>

                      {/* Realtime News Signals (Article Count & Category) */}
                      {(item.relatedArticleCount || item.sourceCategory) && (
                        <div className="flex items-center gap-2 text-2xs text-gray-500 mb-2 flex-wrap">
                          {item.sourceCategory && (
                            <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-medium">
                              {item.sourceCategory}
                            </span>
                          )}
                          {item.relatedArticleCount && item.relatedArticleCount > 0 && (
                            <span className="flex items-center gap-0.5 text-emerald-700 bg-emerald-50/80 px-1.5 py-0.5 rounded font-semibold">
                              <Newspaper className="w-3 h-3" />
                              관련 기사 {item.relatedArticleCount}건
                            </span>
                          )}
                          {item.latestArticleTime && (
                            <span className="text-gray-400">
                              {item.latestArticleTime}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Usability Score Bar */}
                      <div className="mt-3 bg-gray-50 rounded-lg p-2 border border-gray-100">
                        <div className="flex items-center justify-between text-[11px] font-medium text-gray-600 mb-1">
                          <span>블로그 활용성 점수</span>
                          <span className={`font-bold ${status === 'HIGH' ? 'text-emerald-700' : status === 'MEDIUM' ? 'text-indigo-700' : 'text-gray-600'}`}>
                            {score}점
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full ${
                              status === 'HIGH'
                                ? 'bg-emerald-500'
                                : status === 'MEDIUM'
                                ? 'bg-indigo-500'
                                : 'bg-gray-400'
                            }`}
                            style={{ width: `${Math.min(100, score)}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
                      <a
                        href={`https://search.naver.com/search.naver?query=${encodeURIComponent(item.keyword)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="py-1.5 px-2.5 text-xs font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition flex items-center gap-1"
                        title="네이버 검색 결과 보기"
                      >
                        <Search className="w-3.5 h-3.5" />
                        <span>검색</span>
                      </a>
                      <button
                        id={`btn-analyze-${item.rank}`}
                        onClick={() => handleOpenAnalysis(item.keyword)}
                        className="flex-1 py-1.5 px-2.5 text-xs font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition text-center flex items-center justify-center gap-1"
                      >
                        <BarChart3 className="w-3.5 h-3.5 text-gray-500" />
                        <span>분석하기</span>
                      </button>
                      <button
                        id={`btn-draft-${item.rank}`}
                        onClick={() => onSelectKeywordForDraft(item.keyword)}
                        className="flex-1 py-1.5 px-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition flex items-center justify-center gap-1 shadow-xs"
                      >
                        <FileEdit className="w-3.5 h-3.5" />
                        <span>글감 작성</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}

      {/* TAB 2: 뉴스 검색 & 트렌드 */}
      {/* ========================================================================= */}
      {activeTab === 'news' && (
        <div className="space-y-4">
          {/* Categories & Search */}
          <div className="bg-white rounded-xl border border-gray-200/80 p-4 shadow-xs space-y-3">
            {/* Category Chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-gray-500 mr-2 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> 분야:
              </span>
              {NEWS_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  id={`btn-news-cat-${cat}`}
                  onClick={() => {
                    setNewsCategory(cat);
                    loadNews(cat, newsSearchQuery);
                  }}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition ${
                    newsCategory === cat
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Keyword Search inside News */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                loadNews(newsCategory, newsSearchQuery);
              }}
              className="flex items-center gap-2 pt-2 border-t border-gray-100"
            >
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <input
                  id="input-news-search"
                  type="text"
                  value={newsSearchQuery}
                  onChange={(e) => setNewsSearchQuery(e.target.value)}
                  placeholder="뉴스 주제 또는 관심 검색어 입력 (예: 생성형 AI, 부동산, 해외여행)"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <button
                id="btn-news-search-submit"
                type="submit"
                className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shrink-0"
              >
                검색
              </button>
            </form>
          </div>

          {newsError && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0 text-amber-600" />
              <span>{newsError}</span>
            </div>
          )}

          {/* News List */}
          {newsLoading ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
              <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-600 font-medium">네이버 실시간 뉴스를 불러오고 있습니다...</p>
            </div>
          ) : newsList.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
              <p className="text-gray-500 text-sm">검색된 뉴스 기사가 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {newsList.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-xl border border-gray-200/90 p-5 hover:border-emerald-300 hover:shadow-xs transition space-y-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                          {item.pressName}
                        </span>
                        <span>{item.pubDate}</span>
                      </div>
                      <a
                        href={item.originalLink || item.link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-base font-bold text-gray-900 hover:text-emerald-600 block transition line-clamp-1 group"
                      >
                        <span className="group-hover:underline">{item.title}</span>
                        <ExternalLink className="inline-block w-3.5 h-3.5 ml-1 text-gray-400 group-hover:text-emerald-600" />
                      </a>
                      <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 shrink-0">
                      <button
                        id={`btn-news-draft-${item.id}`}
                        onClick={() => onSelectKeywordForDraft(item.title)}
                        className="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition flex items-center gap-1"
                        title="이 뉴스를 바탕으로 AI 초안 작성"
                      >
                        <FileEdit className="w-3.5 h-3.5" />
                        <span>글감 작성</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: 쇼핑 인기 검색어 */}
      {/* ========================================================================= */}
      {activeTab === 'shopping' && (
        <div className="space-y-4">
          {/* Shopping Category Selector */}
          <div className="bg-white rounded-xl border border-gray-200/80 p-4 shadow-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-gray-500 mr-2 flex items-center gap-1">
                <ShoppingBag className="w-3.5 h-3.5" /> 쇼핑 카테고리:
              </span>
              {SHOPPING_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  id={`btn-shop-cat-${cat}`}
                  onClick={() => {
                    setShoppingCategory(cat);
                    loadShopping(cat);
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                    shoppingCategory === cat
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {shoppingError && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0 text-amber-600" />
              <span>{shoppingError}</span>
            </div>
          )}

          {/* Shopping Popular Grid */}
          {shoppingLoading ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
              <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-600 font-medium">네이버 쇼핑 인기 검색어를 불러오고 있습니다...</p>
            </div>
          ) : shoppingList.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
              <p className="text-gray-500 text-sm">해당 카테고리의 쇼핑 인기 검색어가 없습니다.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {shoppingList.map((item) => (
                <div
                  key={item.rank}
                  className="bg-white rounded-xl border border-gray-200/90 p-4 hover:border-emerald-300 hover:shadow-xs transition group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span
                        className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center font-bold text-xs ${
                          item.rank <= 3
                            ? 'bg-emerald-600 text-white'
                            : item.rank <= 10
                            ? 'bg-emerald-50 text-emerald-700 font-semibold'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {item.rank}
                      </span>
                      <div className="min-w-0">
                        <a
                          href={`https://search.shopping.naver.com/search/all?query=${encodeURIComponent(
                            item.keyword
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-base font-bold text-gray-900 hover:text-emerald-600 truncate flex items-center gap-1 group-hover:underline"
                          title="네이버 쇼핑 검색 결과로 이동"
                        >
                          <span className="truncate">{item.keyword}</span>
                          <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-40 group-hover:opacity-100 text-emerald-600" />
                        </a>
                        <span className="text-xs text-gray-500">{item.category}</span>
                      </div>
                    </div>

                    <button
                      id={`btn-copy-shop-${item.rank}`}
                      onClick={() => handleCopy(item.keyword)}
                      className="text-gray-400 hover:text-gray-700 p-1 rounded-md hover:bg-gray-100"
                      title="키워드 복사"
                    >
                      {copiedKeyword === item.keyword ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
                    <button
                      id={`btn-analyze-shop-${item.rank}`}
                      onClick={() => handleOpenAnalysis(item.keyword)}
                      className="flex-1 py-1.5 px-3 text-xs font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition text-center"
                    >
                      키워드 분석
                    </button>
                    <button
                      id={`btn-draft-shop-${item.rank}`}
                      onClick={() => onSelectKeywordForDraft(item.keyword)}
                      className="flex-1 py-1.5 px-3 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition flex items-center justify-center gap-1"
                    >
                      <FileEdit className="w-3.5 h-3.5" />
                      <span>글감 작성</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: 검색 트렌드 (네이버 데이터랩 비교 분석) */}
      {/* ========================================================================= */}
      {activeTab === 'datalab' && (
        <div className="space-y-4">
          {/* Controls */}
          <div className="bg-white rounded-xl border border-gray-200/80 p-5 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-emerald-600" />
              네이버 데이터랩 검색 트렌드 비교
            </h2>

            {/* Keyword tag input */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                비교할 키워드 (최대 5개)
              </label>
              <div className="flex flex-wrap items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded-xl min-h-[46px]">
                {datalabKeywords.map((kw, idx) => (
                  <span
                    key={kw}
                    className="flex items-center gap-1.5 px-3 py-1 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-800 shadow-2xs"
                  >
                    <span>{kw}</span>
                    <button
                      id={`btn-del-kw-${idx}`}
                      onClick={() => setDatalabKeywords(datalabKeywords.filter((k) => k !== kw))}
                      className="text-gray-400 hover:text-red-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}

                {datalabKeywords.length < 5 && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const clean = newKeywordInput.trim();
                      if (clean && !datalabKeywords.includes(clean)) {
                        setDatalabKeywords([...datalabKeywords, clean]);
                        setNewKeywordInput('');
                      }
                    }}
                    className="flex items-center gap-1 flex-1 min-w-[140px]"
                  >
                    <input
                      id="input-add-trend-kw"
                      type="text"
                      value={newKeywordInput}
                      onChange={(e) => setNewKeywordInput(e.target.value)}
                      placeholder="키워드 입력 후 Enter..."
                      className="w-full py-1 text-xs bg-transparent border-none focus:outline-hidden text-gray-800"
                    />
                    <button
                      id="btn-add-trend-kw"
                      type="submit"
                      disabled={!newKeywordInput.trim()}
                      className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-md disabled:opacity-30"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </form>
                )}
              </div>
            </div>

            {/* Period & Filter row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-gray-100">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">조회 기간</label>
                <select
                  id="select-trend-period"
                  value={datalabPeriod}
                  onChange={(e) => setDatalabPeriod(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-hidden"
                >
                  <option value="7d">최근 1주일</option>
                  <option value="1m">최근 1개월</option>
                  <option value="3m">최근 3개월</option>
                  <option value="1y">최근 1년</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">시간 단위</label>
                <select
                  id="select-trend-timeunit"
                  value={datalabTimeUnit}
                  onChange={(e) => setDatalabTimeUnit(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-hidden"
                >
                  <option value="date">일간 (date)</option>
                  <option value="week">주간 (week)</option>
                  <option value="month">월간 (month)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">기기</label>
                <select
                  id="select-trend-device"
                  value={datalabDevice}
                  onChange={(e) => setDatalabDevice(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-hidden"
                >
                  <option value="all">전체 기기</option>
                  <option value="mo">모바일만</option>
                  <option value="pc">PC만</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  id="btn-run-datalab-trend"
                  onClick={loadDataLabTrend}
                  disabled={datalabLoading || datalabKeywords.length === 0}
                  className="w-full py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg transition"
                >
                  트렌드 분석 실행
                </button>
              </div>
            </div>
          </div>

          {datalabError && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0 text-amber-600" />
              <span>{datalabError}</span>
            </div>
          )}

          {/* DataLab Results Visualizer */}
          {datalabLoading ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
              <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-600 font-medium">네이버 데이터랩 트렌드를 분석하고 있습니다...</p>
            </div>
          ) : datalabResults.length > 0 ? (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {datalabResults.map((resItem, idx) => {
                  const lastPoint = resItem.data[resItem.data.length - 1];
                  const maxPoint = resItem.data.reduce((max, cur) => (cur.ratio > max ? cur.ratio : max), 0);
                  const avgPoint =
                    resItem.data.length > 0
                      ? (
                          resItem.data.reduce((sum, cur) => sum + cur.ratio, 0) / resItem.data.length
                        ).toFixed(1)
                      : 0;

                  return (
                    <div
                      key={resItem.title}
                      className="bg-white rounded-xl border border-gray-200/90 p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-base font-bold text-gray-900">{resItem.title}</span>
                        <button
                          id={`btn-draft-trend-${idx}`}
                          onClick={() => onSelectKeywordForDraft(resItem.title)}
                          className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition"
                        >
                          글감 작성
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center bg-gray-50 p-2.5 rounded-lg text-xs">
                        <div>
                          <span className="text-gray-500 block">최근 지수</span>
                          <span className="font-bold text-gray-900">{lastPoint ? lastPoint.ratio : 0}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 block">최고 지수</span>
                          <span className="font-bold text-emerald-600">{maxPoint}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 block">평균 지수</span>
                          <span className="font-bold text-gray-700">{avgPoint}</span>
                        </div>
                      </div>

                      {/* Mini Bar sparkline */}
                      <div className="space-y-1">
                        <span className="text-2xs text-gray-400 block">최근 추이 (0~100 상대 비율)</span>
                        <div className="flex items-end gap-0.5 h-10 bg-gray-50 p-1 rounded-md">
                          {resItem.data.slice(-20).map((d, i) => (
                            <div
                              key={i}
                              title={`${d.period}: ${d.ratio}`}
                              className="flex-1 bg-emerald-500 rounded-t-xs hover:bg-emerald-600 transition"
                              style={{ height: `${Math.max(4, d.ratio)}%` }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Single Keyword Analysis Modal */}
      {isAnalysisModalOpen && analyzingKeyword && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-200 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative">
            <button
              id="btn-close-analysis-modal"
              onClick={() => setIsAnalysisModalOpen(false)}
              className="absolute top-5 right-5 p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-4">
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md">
                키워드 정밀 분석
              </span>
              <h2 className="text-xl font-bold text-gray-900 mt-1">'{analyzingKeyword}' 분석 결과</h2>
            </div>

            <KeywordAnalysisSection
              targetKeyword={analyzingKeyword}
              onSelectKeywordForDraft={(kw) => {
                setIsAnalysisModalOpen(false);
                onSelectKeywordForDraft(kw);
              }}
              onShowToast={onShowToast}
            />
          </div>
        </div>
      )}

      {/* Admin API Status Modal */}
      {isAdminStatusOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-200 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-600" />
                네이버 API 상태 진단
              </h3>
              <button
                id="btn-close-admin-status"
                onClick={() => setIsAdminStatusOpen(false)}
                className="text-gray-400 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {adminStatusLoading ? (
              <div className="py-8 text-center">
                <RefreshCw className="w-6 h-6 text-emerald-600 animate-spin mx-auto mb-2" />
                <p className="text-xs text-gray-600">API 엔드포인트를 점검하고 있습니다...</p>
              </div>
            ) : adminApiStatus?.status ? (
              <div className="space-y-2.5 text-xs">
                {/* News API */}
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-gray-900 block">네이버 뉴스 API</span>
                    <span className="text-gray-500">{adminApiStatus.status.news.message}</span>
                  </div>
                  {adminApiStatus.status.news.ok ? (
                    <span className="text-emerald-700 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" /> 정상 ({adminApiStatus.status.news.latencyMs}ms)
                    </span>
                  ) : (
                    <span className="text-red-700 font-bold flex items-center gap-1">
                      <XCircle className="w-4 h-4 text-red-600" /> 오류
                    </span>
                  )}
                </div>

                {/* DataLab Search API */}
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-gray-900 block">데이터랩 검색 트렌드</span>
                    <span className="text-gray-500">{adminApiStatus.status.datalab.message}</span>
                  </div>
                  {adminApiStatus.status.datalab.ok ? (
                    <span className="text-emerald-700 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" /> 정상 ({adminApiStatus.status.datalab.latencyMs}ms)
                    </span>
                  ) : (
                    <span className="text-red-700 font-bold flex items-center gap-1">
                      <XCircle className="w-4 h-4 text-red-600" /> 오류
                    </span>
                  )}
                </div>

                {/* Shopping Insight API */}
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-gray-900 block">쇼핑인사이트 인기어</span>
                    <span className="text-gray-500">{adminApiStatus.status.shopping.message}</span>
                  </div>
                  {adminApiStatus.status.shopping.ok ? (
                    <span className="text-emerald-700 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" /> 정상 ({adminApiStatus.status.shopping.latencyMs}ms)
                    </span>
                  ) : (
                    <span className="text-red-700 font-bold flex items-center gap-1">
                      <XCircle className="w-4 h-4 text-red-600" /> 오류
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-500">진단 데이터가 없습니다.</p>
            )}

            <button
              id="btn-recheck-status"
              onClick={handleCheckAdminApiStatus}
              className="w-full py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition"
            >
              다시 진단하기
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
