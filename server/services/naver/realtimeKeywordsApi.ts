// server/services/naver/realtimeKeywordsApi.ts
import {
  NaverRealtimeKeywordItem,
  KeywordStatus,
  KeywordFilterPolicy,
  KeywordCollectionTestResult,
  NaverNewsItem,
} from './naverTypes.js';
import { fetchNaverNews } from './newsApi.js';

interface RealtimeCacheEntry {
  data: NaverRealtimeKeywordItem[];
  rawCollectedCount: number;
  newsArticleCount: number;
  timestamp: number;
}

let realtimeMemoryCache: RealtimeCacheEntry | null = null;
const REALTIME_CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes TTL

// Default Filter Policy
const DEFAULT_KEYWORD_FILTER_POLICY: KeywordFilterPolicy = {
  minKeywordLength: 2,
  showLowKeywordsByDefault: true,
  highScoreThreshold: 80,
  mediumScoreThreshold: 55,
  excludedKeywords: [
    '오늘',
    '관련',
    '공개',
    '발표',
    '관심',
    '화제',
    '논란',
    '소식',
    '전망',
    '이유',
    '결과',
    '추천',
    '인기',
    '후기',
    '순위',
    '포토',
    '단독',
    '종합',
    '영상',
    '속보',
    '현장',
  ],
  excludedPatterns: ['^\\d+$', '^[!@#$%^&*()_+\\-=\\[\\]{};\':"\\\\|,.<>\\/?]+$'],
  manuallyExcludedKeywords: [],
};

let currentFilterPolicy: KeywordFilterPolicy = { ...DEFAULT_KEYWORD_FILTER_POLICY };

export function getKeywordFilterPolicy(): KeywordFilterPolicy {
  return { ...currentFilterPolicy };
}

export function updateKeywordFilterPolicy(newPolicy: Partial<KeywordFilterPolicy>): KeywordFilterPolicy {
  currentFilterPolicy = {
    ...currentFilterPolicy,
    ...newPolicy,
    excludedKeywords: Array.from(
      new Set((newPolicy.excludedKeywords ?? currentFilterPolicy.excludedKeywords).map((k) => k.trim()))
    ).filter(Boolean),
    manuallyExcludedKeywords: Array.from(
      new Set((newPolicy.manuallyExcludedKeywords ?? currentFilterPolicy.manuallyExcludedKeywords).map((k) => k.trim()))
    ).filter(Boolean),
  };
  // Invalidate cache so changes take effect immediately
  realtimeMemoryCache = null;
  return { ...currentFilterPolicy };
}

export function addManualExcludedKeyword(keyword: string): KeywordFilterPolicy {
  const clean = (keyword || '').trim();
  if (clean && !currentFilterPolicy.manuallyExcludedKeywords.includes(clean)) {
    currentFilterPolicy.manuallyExcludedKeywords.push(clean);
    realtimeMemoryCache = null;
  }
  return { ...currentFilterPolicy };
}

export function removeManualExcludedKeyword(keyword: string): KeywordFilterPolicy {
  const clean = (keyword || '').trim();
  currentFilterPolicy.manuallyExcludedKeywords = currentFilterPolicy.manuallyExcludedKeywords.filter(
    (k) => k.toLowerCase() !== clean.toLowerCase()
  );
  realtimeMemoryCache = null;
  return { ...currentFilterPolicy };
}

// Broad stop-words that must never become standalone trend topics
const NEWS_STOPWORDS = new Set([
  '오늘',
  '내일',
  '어제',
  '관련',
  '공개',
  '발표',
  '관심',
  '화제',
  '논란',
  '소식',
  '전망',
  '이유',
  '결과',
  '추천',
  '인기',
  '후기',
  '순위',
  '차트',
  '포토',
  '단독',
  '종합',
  '영상',
  '속보',
  '현장',
  '기자',
  '뉴스',
  '보도',
  '진행',
  '시작',
  '예정',
  '개최',
  '확인',
  '기록',
  '최고',
  '최대',
  '역대',
  '첫날',
  '최초',
  '본격',
  '결정',
  '강조',
  '주장',
  '지적',
  '비판',
  '우려',
  '기대',
  '추진',
  '선정',
  '선택',
  '도입',
  '확대',
  '강화',
  '발견',
  '포착',
  '출시',
  '출격',
  '도전',
  '참여',
  '참가',
  '방문',
  '방영',
  '방송',
  '개봉',
  '등장',
  '변화',
  '상황',
  '문제',
  '사건',
  '사고',
  '논의',
  '합의',
  '대응',
  '극복',
  '해결',
  '지원',
  '제공',
  '안내',
  '운영',
  '관리',
  '마련',
  '달성',
  '기록',
  '돌파',
  '성공',
  '주목',
  '눈길',
  '차지',
  '차례',
  '위치',
  '중심',
  '이후',
  '직후',
  '당시',
  '한편',
  '이날',
  '이번',
  '지난',
  '올해',
  '작년',
  '내년',
  '상반기',
  '하반기',
  '1위',
  '2위',
  '3위',
]);

// High-value bloggable entity markers (brands, products, locations, tech, specific items)
const HIGH_VALUE_PATTERNS = [
  /(전자|반도체|모빌리티|바이오|에너지|통신|엔터|식품|패션|금융|증권|생명|화재)/,
  /(스마트폰|갤럭시|아이폰|노트북|태블릿|ai|gpt|반도체|전기차|배터리|로봇|드론|vr|ar)/i,
  /(팝업스토어|신제품|콜라보|할인|프로모션|전시회|페스티벌|콘서트|페스타|박람회)/,
  /(시리즈|시즌|드라마|영화|예능|뮤지컬|애니|웹툰|음원|앨범|ost)/,
  /(호텔|리조트|파크|카페|베이커리|맛집|공항|스타디움|센터|타워|빌딩|뮤지엄)/,
  /(신약|치료제|비타민|백신|임상|다이어트|영양제|화장품|스킨케어)/,
  /(스니커즈|의류|패딩|아우터|가방|잡화|뷰티|메이크업)/,
];

/**
 * Clean text: remove HTML tags, symbols, extra spaces
 */
function cleanText(text: string): string {
  if (!text) return '';
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/[\[\]\(\)\{\}【】『』「」"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract meaningful noun phrases and entities from news headlines
 */
function extractEntitiesFromTitle(title: string): string[] {
  const cleaned = cleanText(title);
  if (!cleaned) return [];

  // Match Korean/English/Alphanumeric words with 2 or more characters
  const rawTokens = cleaned.split(/[\s,·…:;!?'"|\/]+/).filter(Boolean);
  const candidates: string[] = [];

  // 1. Single word tokens (excluding particle endings and pure numbers)
  for (const token of rawTokens) {
    // Strip trailing Korean particles (은, 는, 이, 가, 을, 를, 에, 의, 로, 와, 과, 도, 만, 서, 에서, 까지, 에게)
    const stripped = token
      .replace(/(에서는|에게서|에서도|까지는|으로는|으로는|으로|에서|에게|까지|부터|보다|처럼|만큼|대로|하고|이며|에는|에도|의|은|는|이|가|을|를|에|로|와|과|도|만|서)$/g, '')
      .trim();

    if (stripped.length >= 2 && !/^\d+$/.test(stripped)) {
      candidates.push(stripped);
    }
  }

  // 2. Compound noun pairs (e.g. "삼성전자 파운드리", "엔비디아 블랙웰", "성심당 튀김소보로")
  for (let i = 0; i < rawTokens.length - 1; i++) {
    const t1 = rawTokens[i].replace(/(의|은|는|이|가|을|를|에|로|와|과|도)$/g, '').trim();
    const t2 = rawTokens[i + 1].replace(/(의|은|는|이|가|을|를|에|로|와|과|도|에서|까지)$/g, '').trim();

    if (
      t1.length >= 2 &&
      t2.length >= 2 &&
      !NEWS_STOPWORDS.has(t1) &&
      !NEWS_STOPWORDS.has(t2) &&
      !/^\d+$/.test(t1) &&
      !/^\d+$/.test(t2)
    ) {
      candidates.push(`${t1} ${t2}`);
    }
  }

  return candidates;
}

/**
 * Determine blog usability label based purely on code rules (NO AI)
 */
function evaluateBlogUsability(keyword: string): { score: number; status: KeywordStatus } {
  const lower = keyword.toLowerCase();

  // Check manual/policy exclusions
  if (currentFilterPolicy.manuallyExcludedKeywords.some((k) => k.toLowerCase() === lower)) {
    return { score: 0, status: 'FILTERED' };
  }

  for (const pattern of currentFilterPolicy.excludedPatterns || []) {
    try {
      if (new RegExp(pattern).test(keyword)) {
        return { score: 0, status: 'FILTERED' };
      }
    } catch {}
  }

  if (keyword.length < currentFilterPolicy.minKeywordLength) {
    return { score: 10, status: 'LOW' };
  }

  let score = 50;

  // Check high value entity patterns (products, brands, places, tech)
  let isHigh = false;
  for (const pat of HIGH_VALUE_PATTERNS) {
    if (pat.test(keyword)) {
      score += 35;
      isHigh = true;
      break;
    }
  }

  // Compound terms (has space or longer specific keyword)
  if (keyword.includes(' ') && keyword.length >= 5) {
    score += 15;
  }

  // Brand/English mixed keyword (e.g. OpenAI, K-방산, 갤럭시S24)
  if (/[a-zA-Z가-힣]+[0-9a-zA-Z가-힣]*/.test(keyword) && /[a-zA-Z]/.test(keyword)) {
    score += 10;
  }

  score = Math.min(98, Math.max(20, score));

  if (isHigh || score >= 80) {
    return { score, status: 'HIGH' };
  } else if (score >= 55) {
    return { score, status: 'MEDIUM' };
  } else {
    return { score, status: 'LOW' };
  }
}

/**
 * Core Realtime Issue Extraction Engine
 * Fetches real Naver News data and calculates trending entity topics based on frequency & recency
 */
export async function fetchNaverRealtimeRisingKeywords(forceRefresh = false): Promise<{
  success: boolean;
  data: NaverRealtimeKeywordItem[];
  collectedAt: string;
  totalCollectedCount?: number;
  newsArticleCount?: number;
  dedupedCount?: number;
  error?: string;
}> {
  const now = Date.now();
  if (!forceRefresh && realtimeMemoryCache && now - realtimeMemoryCache.timestamp < REALTIME_CACHE_TTL_MS) {
    return {
      success: true,
      data: realtimeMemoryCache.data,
      collectedAt: new Date(realtimeMemoryCache.timestamp).toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      totalCollectedCount: realtimeMemoryCache.rawCollectedCount,
      newsArticleCount: realtimeMemoryCache.newsArticleCount,
      dedupedCount: realtimeMemoryCache.data.length,
    };
  }

  const collectedTimeStr = new Date().toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  try {
    // 1. Fetch latest news across diverse categories to capture real current affairs & trends
    const newsCategories = ['전체', '경제', 'IT/과학', '생활/문화', '사회', '연예'];
    const newsPromises = newsCategories.map((cat) => fetchNaverNews(cat, undefined));
    const settledResults = await Promise.allSettled(newsPromises);

    const allArticles: NaverNewsItem[] = [];
    for (const res of settledResults) {
      if (res.status === 'fulfilled' && res.value.success && Array.isArray(res.value.data)) {
        allArticles.push(...res.value.data);
      }
    }

    if (allArticles.length === 0) {
      // Fallback to cached if available
      if (realtimeMemoryCache && realtimeMemoryCache.data.length > 0) {
        return {
          success: true,
          data: realtimeMemoryCache.data,
          collectedAt: collectedTimeStr,
          totalCollectedCount: realtimeMemoryCache.rawCollectedCount,
          newsArticleCount: realtimeMemoryCache.newsArticleCount,
          dedupedCount: realtimeMemoryCache.data.length,
        };
      }
      return {
        success: false,
        data: [],
        collectedAt: collectedTimeStr,
        error: '뉴스 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.',
      };
    }

    // 2. Extract keywords and aggregate metrics
    interface KeywordAggregate {
      keyword: string;
      frequency: number;
      articles: NaverNewsItem[];
      latestPubDate: string;
    }

    const keywordMap = new Map<string, KeywordAggregate>();
    let rawKeywordCount = 0;

    for (const article of allArticles) {
      const entities = extractEntitiesFromTitle(article.title);
      rawKeywordCount += entities.length;

      for (const entity of entities) {
        const cleanEntity = entity.trim();
        const lower = cleanEntity.toLowerCase();

        // Check stopwords & filter policy
        if (
          NEWS_STOPWORDS.has(cleanEntity) ||
          NEWS_STOPWORDS.has(lower) ||
          currentFilterPolicy.excludedKeywords.includes(cleanEntity) ||
          currentFilterPolicy.manuallyExcludedKeywords.includes(cleanEntity)
        ) {
          continue;
        }

        if (cleanEntity.length < currentFilterPolicy.minKeywordLength) {
          continue;
        }

        const existing = keywordMap.get(cleanEntity);
        if (!existing) {
          keywordMap.set(cleanEntity, {
            keyword: cleanEntity,
            frequency: 1,
            articles: [article],
            latestPubDate: article.pubDate,
          });
        } else {
          existing.frequency += 1;
          if (!existing.articles.some((a) => a.id === article.id || a.title === article.title)) {
            existing.articles.push(article);
          }
          if (new Date(article.pubDate).getTime() > new Date(existing.latestPubDate).getTime()) {
            existing.latestPubDate = article.pubDate;
          }
        }
      }
    }

    // 3. Filter out single-occurrence trivial noise if we have sufficient candidate pool
    const candidates = Array.from(keywordMap.values());
    const filteredCandidates = candidates.filter((c) => {
      // Keep if frequency >= 2 OR if it's a high-value entity compound keyword
      return c.frequency >= 2 || (c.keyword.includes(' ') && c.keyword.length >= 4) || HIGH_VALUE_PATTERNS.some((p) => p.test(c.keyword));
    });

    // 4. Sort by real news frequency and article count
    filteredCandidates.sort((a, b) => {
      if (b.frequency !== a.frequency) {
        return b.frequency - a.frequency;
      }
      return b.articles.length - a.articles.length;
    });

    // 5. Build final structured realtime items
    const finalItems: NaverRealtimeKeywordItem[] = [];
    let rank = 1;

    for (const item of filteredCandidates.slice(0, 40)) {
      const evaluation = evaluateBlogUsability(item.keyword);
      if (evaluation.status === 'FILTERED') continue;

      const repArticle: any = item.articles[0] || null;
      const repTitle = repArticle ? cleanText(repArticle.title || `${item.keyword} 관련 주요 소식`) : `${item.keyword} 관련 주요 소식`;
      const publisher = repArticle?.pressName || '네이버 뉴스';

      // Format relative/friendly time
      let timeDisplay = '최근 1시간 내';
      if (item.latestPubDate) {
        try {
          const d = new Date(item.latestPubDate);
          const nowMs = Date.now();
          const diffMinutes = Math.max(1, Math.floor((nowMs - d.getTime()) / (60 * 1000)));
          if (diffMinutes < 60) {
            timeDisplay = `${diffMinutes}분 전`;
          } else {
            const diffHours = Math.floor(diffMinutes / 60);
            timeDisplay = `${diffHours}시간 전`;
          }
        } catch {}
      }

      finalItems.push({
        rank: rank++,
        originalRank: rank,
        keyword: item.keyword,
        relatedArticleCount: Math.max(item.articles.length, item.frequency),
        latestArticleTime: timeDisplay,
        representativeTitle: repTitle,
        publisher: publisher,
        url: `https://search.naver.com/search.naver?query=${encodeURIComponent(item.keyword)}`,
        blogUsabilityScore: evaluation.score,
        usabilityLabel: evaluation.status,
        status: evaluation.status,
        collectedAt: collectedTimeStr,
        source: '네이버 뉴스 실시간 토픽',
        manuallyExcluded: currentFilterPolicy.manuallyExcludedKeywords.includes(item.keyword),
      });
    }

    // Cache the result
    realtimeMemoryCache = {
      data: finalItems,
      rawCollectedCount: rawKeywordCount,
      newsArticleCount: allArticles.length,
      timestamp: now,
    };

    return {
      success: true,
      data: finalItems,
      collectedAt: collectedTimeStr,
      totalCollectedCount: rawKeywordCount,
      newsArticleCount: allArticles.length,
      dedupedCount: finalItems.length,
    };
  } catch (err: any) {
    if (realtimeMemoryCache && realtimeMemoryCache.data.length > 0) {
      return {
        success: true,
        data: realtimeMemoryCache.data,
        collectedAt: collectedTimeStr,
        totalCollectedCount: realtimeMemoryCache.rawCollectedCount,
        newsArticleCount: realtimeMemoryCache.newsArticleCount,
        dedupedCount: realtimeMemoryCache.data.length,
      };
    }
    return {
      success: false,
      data: [],
      collectedAt: collectedTimeStr,
      error: '실시간 이슈 키워드를 불러오지 못했습니다.',
    };
  }
}

/**
 * Diagnostics and Test Engine for Admin Dashboard
 */
export async function testKeywordCollectionEngine(
  clientId: string,
  clientSecret: string
): Promise<KeywordCollectionTestResult> {
  const testedAt = new Date().toISOString();
  const apiStatus: KeywordCollectionTestResult['apiStatus'] = {
    news: { ok: false, message: '미확인', latencyMs: 0 },
    blog: { ok: false, message: '미확인', latencyMs: 0 },
    shopping: { ok: false, message: '미확인', latencyMs: 0 },
    datalab: { ok: false, message: '미확인', latencyMs: 0 },
  };

  // 1. Test News API
  const newsStart = Date.now();
  try {
    if (clientId && clientSecret) {
      const openRes = await fetch(
        'https://openapi.naver.com/v1/search/news.json?query=%ED%8A%B8%EB%A0%8C%EB%93%9C&display=1',
        {
          headers: {
            'X-Naver-Client-Id': clientId,
            'X-Naver-Client-Secret': clientSecret,
          },
          signal: AbortSignal.timeout(3000),
        }
      );
      apiStatus.news = {
        ok: openRes.ok,
        message: openRes.ok ? '정상 응답 (OpenAPI)' : `HTTP ${openRes.status}`,
        latencyMs: Date.now() - newsStart,
      };
    } else {
      apiStatus.news = { ok: false, message: 'API Key 미설정', latencyMs: 0 };
    }
  } catch (e: any) {
    apiStatus.news = { ok: false, message: e?.message || '연결 오류', latencyMs: Date.now() - newsStart };
  }

  // 2. Test Realtime Extraction
  const realtimeRes = await fetchNaverRealtimeRisingKeywords(true);
  const sampleKeywords = realtimeRes.data.slice(0, 10);

  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;
  let filteredCount = 0;

  realtimeRes.data.forEach((item) => {
    if (item.status === 'HIGH') highCount++;
    else if (item.status === 'MEDIUM') mediumCount++;
    else if (item.status === 'LOW') lowCount++;
    else if (item.status === 'FILTERED') filteredCount++;
  });

  return {
    apiStatus,
    totalCollectedCount: realtimeRes.totalCollectedCount || 0,
    dedupedCount: realtimeRes.dedupedCount || 0,
    highCount,
    mediumCount,
    lowCount,
    filteredCount,
    hasError: !realtimeRes.success,
    errorMessage: realtimeRes.error,
    sampleKeywords,
    testedAt,
  };
}
