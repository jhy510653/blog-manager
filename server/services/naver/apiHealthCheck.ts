// server/services/naver/apiHealthCheck.ts
import { NaverApiStatus } from './naverTypes.js';

export async function checkNaverApiHealth(
  clientId: string,
  clientSecret: string
): Promise<NaverApiStatus> {
  const result: NaverApiStatus = {
    news: { ok: false, message: '', latencyMs: 0 },
    blog: { ok: false, message: '', latencyMs: 0 },
    shopping: { ok: false, message: '', latencyMs: 0 },
    datalab: { ok: false, message: '', latencyMs: 0 },
    checkedAt: new Date().toISOString(),
  };

  if (!clientId || !clientSecret) {
    result.news = { ok: false, message: 'API Key 미설정 (NAVER_CLIENT_ID / SECRET 필요)', latencyMs: 0 };
    result.blog = { ok: false, message: 'API Key 미설정', latencyMs: 0 };
    result.shopping = { ok: false, message: 'API Key 미설정', latencyMs: 0 };
    result.datalab = { ok: false, message: 'API Key 미설정', latencyMs: 0 };
    return result;
  }

  // 1. Check News API
  const newsStart = Date.now();
  try {
    const openRes = await fetch('https://openapi.naver.com/v1/search/news.json?query=%ED%8A%B8%EB%A0%8C%EB%93%9C&display=1', {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
      signal: AbortSignal.timeout(3500),
    });
    const newsLatency = Date.now() - newsStart;
    if (openRes.ok) {
      result.news = { ok: true, message: '정상 응답 (OpenAPI)', latencyMs: newsLatency };
    } else {
      // Try NCP HUB
      const hubRes = await fetch('https://naverapihub.apigw.ntruss.com/search/v1/news?query=%ED%8A%B8%EB%A0%8C%EB%93%9C&display=1', {
        headers: {
          'X-NCP-APIGW-API-KEY-ID': clientId,
          'X-NCP-APIGW-API-KEY': clientSecret,
        },
        signal: AbortSignal.timeout(3500),
      });
      if (hubRes.ok) {
        result.news = { ok: true, message: '정상 응답 (NCP API HUB)', latencyMs: Date.now() - newsStart };
      } else {
        result.news = { ok: false, message: `HTTP ${hubRes.status} 응답`, latencyMs: Date.now() - newsStart };
      }
    }
  } catch (err: any) {
    result.news = { ok: false, message: err?.message || '연결 타임아웃', latencyMs: Date.now() - newsStart };
  }

  // 2. Check Blog API (NCP NAVER API HUB / OpenAPI)
  const blogStart = Date.now();
  try {
    const hubRes = await fetch('https://naverapihub.apigw.ntruss.com/search/v1/blog?query=%ED%85%8C%EC%8A%A4%ED%8A%B8&display=1', {
      headers: {
        'X-NCP-APIGW-API-KEY-ID': clientId,
        'X-NCP-APIGW-API-KEY': clientSecret,
      },
      signal: AbortSignal.timeout(3500),
    });
    const blogLatency = Date.now() - blogStart;
    if (hubRes.ok) {
      result.blog = { ok: true, message: '정상 응답 (NCP API HUB)', latencyMs: blogLatency };
    } else {
      const openBlogRes = await fetch('https://openapi.naver.com/v1/search/blog.json?query=%ED%85%8C%EC%8A%A4%ED%8A%B8&display=1', {
        headers: {
          'X-Naver-Client-Id': clientId,
          'X-Naver-Client-Secret': clientSecret,
        },
        signal: AbortSignal.timeout(3500),
      });
      if (openBlogRes.ok) {
        result.blog = { ok: true, message: '정상 응답 (OpenAPI)', latencyMs: Date.now() - blogStart };
      } else {
        result.blog = { ok: false, message: `HTTP ${hubRes.status} 응답`, latencyMs: blogLatency };
      }
    }
  } catch (err: any) {
    result.blog = { ok: false, message: err?.message || '연결 타임아웃', latencyMs: Date.now() - blogStart };
  }

  // 3. Check DataLab Search Trend API
  const dlStart = Date.now();
  try {
    const today = new Date();
    const past7 = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const body = {
      startDate: past7.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0],
      timeUnit: 'date',
      keywordGroups: [{ groupName: '네이버', keywords: ['네이버'] }],
    };

    const dlRes = await fetch('https://openapi.naver.com/v1/datalab/search', {
      method: 'POST',
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(3500),
    });
    const dlLatency = Date.now() - dlStart;
    if (dlRes.ok) {
      result.datalab = { ok: true, message: '정상 응답 (OpenAPI)', latencyMs: dlLatency };
    } else {
      const hubDlRes = await fetch('https://naverapihub.apigw.ntruss.com/search-trend/v1/search', {
        method: 'POST',
        headers: {
          'X-NCP-APIGW-API-KEY-ID': clientId,
          'X-NCP-APIGW-API-KEY': clientSecret,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(3500),
      });
      if (hubDlRes.ok) {
        result.datalab = { ok: true, message: '정상 응답 (NCP API HUB)', latencyMs: Date.now() - dlStart };
      } else {
        result.datalab = { ok: false, message: `HTTP ${hubDlRes.status} 응답`, latencyMs: Date.now() - dlStart };
      }
    }
  } catch (err: any) {
    result.datalab = { ok: false, message: err?.message || '연결 타임아웃', latencyMs: Date.now() - dlStart };
  }

  // 4. Check Shopping Insight API
  const shopStart = Date.now();
  try {
    const today = new Date();
    const past7 = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const shopBody = {
      startDate: past7.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0],
      timeUnit: 'date',
      category: '50000000',
      keyword: [{ name: '원피스', param: ['원피스'] }],
    };

    const shopRes = await fetch('https://openapi.naver.com/v1/datalab/shopping/category/keywords', {
      method: 'POST',
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(shopBody),
      signal: AbortSignal.timeout(3500),
    });
    const shopLatency = Date.now() - shopStart;
    if (shopRes.ok) {
      result.shopping = { ok: true, message: '정상 응답 (OpenAPI)', latencyMs: shopLatency };
    } else {
      const hubShopRes = await fetch('https://naverapihub.apigw.ntruss.com/shopping-insight/v1/keywords', {
        method: 'POST',
        headers: {
          'X-NCP-APIGW-API-KEY-ID': clientId,
          'X-NCP-APIGW-API-KEY': clientSecret,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(shopBody),
        signal: AbortSignal.timeout(3500),
      });
      if (hubShopRes.ok) {
        result.shopping = { ok: true, message: '정상 응답 (NCP API HUB)', latencyMs: Date.now() - shopStart };
      } else {
        result.shopping = { ok: false, message: `HTTP ${hubShopRes.status} 응답`, latencyMs: Date.now() - shopStart };
      }
    }
  } catch (err: any) {
    result.shopping = { ok: false, message: err?.message || '연결 타임아웃', latencyMs: Date.now() - shopStart };
  }

  return result;
}
