// server/services/naver/dataLabSearchApi.ts
import { NaverSearchTrendResult } from './naverTypes.js';

interface DatalabCacheEntry {
  data: NaverSearchTrendResult[];
  timestamp: number;
}

const datalabMemoryCache = new Map<string, DatalabCacheEntry>();
const DATALAB_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes TTL for exact searches

export async function fetchNaverSearchTrend(
  keywords: string[],
  period: '7d' | '30d' | '90d' = '30d',
  timeUnit: 'date' | 'week' | 'month' = 'date',
  device?: string,
  gender?: string,
  credentials?: { clientId: string; clientSecret: string }
): Promise<{ success: boolean; data: NaverSearchTrendResult[]; error?: string; periodInfo?: { start: string; end: string } }> {
  const cleanKeywords = keywords.map((k) => k.trim()).filter((k) => k.length > 0).slice(0, 5);

  if (cleanKeywords.length === 0) {
    return {
      success: false,
      data: [],
      error: '검색어를 1개 이상 입력해주세요.',
    };
  }

  const today = new Date();
  const endDateStr = today.toISOString().split('T')[0];

  let daysAgo = 30;
  if (period === '7d') daysAgo = 7;
  if (period === '90d') daysAgo = 90;

  const startDate = new Date(today.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  const startDateStr = startDate.toISOString().split('T')[0];

  const cacheKey = `${cleanKeywords.sort().join(',')}_${period}_${timeUnit}_${device || 'all'}_${gender || 'all'}`;
  const cached = datalabMemoryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < DATALAB_CACHE_TTL_MS) {
    return { success: true, data: cached.data, periodInfo: { start: startDateStr, end: endDateStr } };
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

  const keywordGroups = cleanKeywords.map((kw) => ({
    groupName: kw,
    keywords: [kw],
  }));

  const requestBody: any = {
    startDate: startDateStr,
    endDate: endDateStr,
    timeUnit: timeUnit,
    keywordGroups: keywordGroups,
  };

  if (device && (device === 'pc' || device === 'mo')) {
    requestBody.device = device;
  }
  if (gender && (gender === 'm' || gender === 'f')) {
    requestBody.gender = gender;
  }

  // 1. Try Naver Developers Open API (openapi.naver.com/v1/datalab/search)
  try {
    const openRes = await fetch('https://openapi.naver.com/v1/datalab/search', {
      method: 'POST',
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(5000),
    });

    if (openRes.ok) {
      const json: any = await openRes.json();
      if (json && Array.isArray(json.results) && json.results.length > 0) {
        const results: NaverSearchTrendResult[] = json.results.map((r: any) => ({
          title: r.title,
          keywords: r.keywords || [r.title],
          data: Array.isArray(r.data)
            ? r.data.map((d: any) => ({
                period: d.period,
                ratio: typeof d.ratio === 'number' ? Number(d.ratio.toFixed(2)) : 0,
              }))
            : [],
        }));

        datalabMemoryCache.set(cacheKey, { data: results, timestamp: Date.now() });
        return { success: true, data: results, periodInfo: { start: startDateStr, end: endDateStr } };
      }
    }
  } catch {
    // Fall through to NCP API HUB
  }

  // 2. Try NCP NAVER API HUB (naverapihub.apigw.ntruss.com/search-trend/v1/search)
  try {
    const hubRes = await fetch('https://naverapihub.apigw.ntruss.com/search-trend/v1/search', {
      method: 'POST',
      headers: {
        'X-NCP-APIGW-API-KEY-ID': clientId,
        'X-NCP-APIGW-API-KEY': clientSecret,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(5000),
    });

    if (hubRes.ok) {
      const json: any = await hubRes.json();
      if (json && Array.isArray(json.results) && json.results.length > 0) {
        const results: NaverSearchTrendResult[] = json.results.map((r: any) => ({
          title: r.title,
          keywords: r.keywords || [r.title],
          data: Array.isArray(r.data)
            ? r.data.map((d: any) => ({
                period: d.period,
                ratio: typeof d.ratio === 'number' ? Number(d.ratio.toFixed(2)) : 0,
              }))
            : [],
        }));

        datalabMemoryCache.set(cacheKey, { data: results, timestamp: Date.now() });
        return { success: true, data: results, periodInfo: { start: startDateStr, end: endDateStr } };
      }
    }
  } catch (err: any) {
    return {
      success: false,
      data: [],
      error: '검색어 트렌드 분석 중 네트워크 오류가 발생했습니다.',
    };
  }

  return {
    success: false,
    data: [],
    error: '해당 키워드의 검색 트렌드 데이터를 찾을 수 없습니다.',
  };
}
