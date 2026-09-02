// server/services/naver/newsApi.ts
import { NaverNewsItem } from './naverTypes.js';

interface NewsCacheEntry {
  data: NaverNewsItem[];
  timestamp: number;
}

const newsMemoryCache = new Map<string, NewsCacheEntry>();
const NEWS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL

// Clean HTML tags and decode common entities
function cleanHtml(text: string): string {
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
    .replace(/\s+/g, ' ')
    .trim();
}

// Extract press name from link or format
function extractPressName(item: any): string {
  if (item.originallink) {
    const url = item.originallink.toLowerCase();
    if (url.includes('chosun.com')) return '조선일보';
    if (url.includes('donga.com')) return '동아일보';
    if (url.includes('joins.com') || url.includes('joongang.co.kr')) return '중앙일보';
    if (url.includes('hani.co.kr')) return '한겨레';
    if (url.includes('khan.co.kr')) return '경향신문';
    if (url.includes('yna.co.kr') || url.includes('yonhapnews')) return '연합뉴스';
    if (url.includes('newsis.com')) return '뉴시스';
    if (url.includes('news1.kr')) return '뉴스1';
    if (url.includes('mk.co.kr')) return '매일경제';
    if (url.includes('hankyung.com')) return '한국경제';
    if (url.includes('sedaily.com')) return '서울경제';
    if (url.includes('heraldcorp.com')) return '헤럴드경제';
    if (url.includes('etnews.com')) return '전자신문';
    if (url.includes('zdnet.co.kr')) return 'ZDNet Korea';
    if (url.includes('sbs.co.kr')) return 'SBS';
    if (url.includes('kbs.co.kr')) return 'KBS';
    if (url.includes('mbc.co.kr') || url.includes('imnews')) return 'MBC';
    if (url.includes('ytn.co.kr')) return 'YTN';
    if (url.includes('jtbc.co.kr')) return 'JTBC';
    if (url.includes('ichannela.com')) return '채널A';
    if (url.includes('tvchosun.com')) return 'TV조선';
    if (url.includes('ohmynews.com')) return '오마이뉴스';
    if (url.includes('pressian.com')) return '프레시안';
    if (url.includes('moneytoday.co.kr') || url.includes('mt.co.kr')) return '머니투데이';
    if (url.includes('edaily.co.kr')) return '이데일리';
    if (url.includes('inews24.com')) return '아이뉴스24';
    if (url.includes('sportalkorea.com')) return '스포탈코리아';
    if (url.includes('sportsseoul.com')) return '스포츠서울';
    if (url.includes('sportschosun.com')) return '스포츠조선';
    if (url.includes('osen.co.kr')) return 'OSEN';
    if (url.includes('starin.edaily.co.kr') || url.includes('e-daily')) return '이데일리스타';
  }
  return '네이버 뉴스';
}

const CATEGORY_SEARCH_QUERIES: Record<string, string> = {
  전체: '주요 뉴스 이슈',
  정치: '정치 국회 정책',
  경제: '경제 금융 증시 시장',
  사회: '사회 사건 종합',
  '생활/문화': '생활 문화 여행 건강 라이프',
  'IT/과학': 'IT 기술 과학 AI 스마트폰',
  연예: '연예 방송 스타 드라마 영화',
  스포츠: '스포츠 경기 야구 축구 골프',
};

export async function fetchNaverNews(
  category: string = '전체',
  query?: string,
  credentials?: { clientId: string; clientSecret: string }
): Promise<{ success: boolean; data: NaverNewsItem[]; error?: string }> {
  const searchQuery = (query && query.trim()) || CATEGORY_SEARCH_QUERIES[category] || '주요 뉴스';
  const cacheKey = `news_${category}_${searchQuery}`;

  // Check cache
  const cached = newsMemoryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < NEWS_CACHE_TTL_MS) {
    return { success: true, data: cached.data };
  }

  const clientId = credentials?.clientId || process.env.NAVER_CLIENT_ID || process.env.NCP_CLIENT_ID || '';
  const clientSecret = credentials?.clientSecret || process.env.NAVER_CLIENT_SECRET || process.env.NCP_CLIENT_SECRET || '';

  if (!clientId || !clientSecret) {
    return {
      success: false,
      data: [],
      error: '네이버 API 인증 정보가 설정되지 않았습니다.',
    };
  }

  const display = 25;
  const encodedQuery = encodeURIComponent(searchQuery);

  // 1. Try Naver Developers Open API (openapi.naver.com)
  try {
    const openApiUrl = `https://openapi.naver.com/v1/search/news.json?query=${encodedQuery}&display=${display}&sort=date`;
    const openRes = await fetch(openApiUrl, {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
      signal: AbortSignal.timeout(4000),
    });

    if (openRes.ok) {
      const json: any = await openRes.json();
      if (json && Array.isArray(json.items) && json.items.length > 0) {
        const items: NaverNewsItem[] = json.items.map((item: any, idx: number) => ({
          id: `news_${idx}_${Date.now()}`,
          title: cleanHtml(item.title),
          originalLink: item.originallink || item.link,
          link: item.link || item.originallink,
          description: cleanHtml(item.description),
          pubDate: item.pubDate || new Date().toISOString(),
          pressName: extractPressName(item),
        }));

        newsMemoryCache.set(cacheKey, { data: items, timestamp: Date.now() });
        return { success: true, data: items };
      }
    }
  } catch {
    // Fall through to NCP API HUB
  }

  // 2. Try NCP NAVER API HUB (naverapihub.apigw.ntruss.com)
  try {
    const hubApiUrl = `https://naverapihub.apigw.ntruss.com/search/v1/news?query=${encodedQuery}&display=${display}&sort=date`;
    const hubRes = await fetch(hubApiUrl, {
      headers: {
        'X-NCP-APIGW-API-KEY-ID': clientId,
        'X-NCP-APIGW-API-KEY': clientSecret,
      },
      signal: AbortSignal.timeout(4000),
    });

    if (hubRes.ok) {
      const json: any = await hubRes.json();
      if (json && Array.isArray(json.items) && json.items.length > 0) {
        const items: NaverNewsItem[] = json.items.map((item: any, idx: number) => ({
          id: `news_hub_${idx}_${Date.now()}`,
          title: cleanHtml(item.title),
          originalLink: item.originallink || item.link,
          link: item.link || item.originallink,
          description: cleanHtml(item.description),
          pubDate: item.pubDate || new Date().toISOString(),
          pressName: extractPressName(item),
        }));

        newsMemoryCache.set(cacheKey, { data: items, timestamp: Date.now() });
        return { success: true, data: items };
      }
    }
  } catch {}

  // 3. Robust Real Naver News Search Fallback (Direct Real Naver Search Engine Parsing)
  try {
    const naverNewsSearchUrl = `https://search.naver.com/search.naver?where=news&query=${encodedQuery}&sm=tab_opt&sort=1`;
    const htmlRes = await fetch(naverNewsSearchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(4000),
    });

    if (htmlRes.ok) {
      const html = await htmlRes.text();
      const items: NaverNewsItem[] = [];

      // Regex for tit and body links
      const titMatches = [...html.matchAll(/<a[^>]*href="([^"]+)"[^>]*data-heatmap-target="\.tit"[^>]*>([\s\S]*?)<\/a>/gi)];
      const bodyMatches = [...html.matchAll(/<a[^>]*href="([^"]+)"[^>]*data-heatmap-target="\.body"[^>]*>([\s\S]*?)<\/a>/gi)];

      titMatches.forEach((tm, idx) => {
        if (items.length >= 25) return;
        const rawLink = (tm[1] || '').replace(/&amp;/g, '&');
        const rawTitle = tm[2] || '';
        const title = cleanHtml(rawTitle.replace(/새\s*창\s*열림/gi, ''));

        let desc = '';
        if (bodyMatches[idx] && bodyMatches[idx][2]) {
          desc = cleanHtml(bodyMatches[idx][2].replace(/새\s*창\s*열림/gi, ''));
        }

        const press = extractPressName({ originallink: rawLink });

        if (title && rawLink && rawLink.startsWith('http')) {
          items.push({
            id: `news_live_${idx}_${Date.now()}`,
            title,
            originalLink: rawLink,
            link: rawLink,
            description: desc || title,
            pubDate: '최신 뉴스',
            pressName: press,
          });
        }
      });

      if (items.length > 0) {
        newsMemoryCache.set(cacheKey, { data: items, timestamp: Date.now() });
        return { success: true, data: items };
      }
    }
  } catch (err: any) {
    return {
      success: false,
      data: [],
      error: '네이버 뉴스 데이터를 불러오는 중 오류가 발생했습니다.',
    };
  }

  return {
    success: false,
    data: [],
    error: '네이버 뉴스 검색 결과가 없습니다.',
  };
}
