import { Participant, BlogPost, ChallengeGroup } from '../types';
import { saveParticipantToSupabase, saveDailyStatToSupabase, saveBlogPostsToSupabase, getSupabaseClient } from '../lib/supabase';
import { extractNaverBlogId, extractNaverPostId, getCanonicalNaverPostUrl, generateBlogPostKey } from '../utils/blogUtils';

export interface RssFetchResult {
  blogId: string;
  todayPostCount: number;
  latestPosts: BlogPost[];
  allPosts: BlogPost[];
  error?: string;
}

export interface TwitterFetchResult {
  twitterId: string;
  tweetCount: number;
  replyCount: number;
  status: 'stub' | 'success' | 'error';
  message: string;
}

/**
 * 챌린지 시작일(startDate) 및 종료일(endDate) 기준 날짜 필터링 헬퍼 함수.
 * targetDateStr (YYYY-MM-DD) 가 startDate (YYYY-MM-DD) 이상, endDate 이하인 경우에만 true를 반환합니다.
 */
export function filterByDate(targetDateStr: string, startDate?: string, endDate?: string): boolean {
  if (!targetDateStr) return false;
  if (startDate && startDate.trim() && targetDateStr.trim() < startDate.trim()) {
    return false;
  }
  if (endDate && endDate.trim() && targetDateStr.trim() > endDate.trim()) {
    return false;
  }
  return true;
}

/**
 * Helper to fetch XML content via robust server proxy & CORS failover for browser runtime
 */
async function fetchXmlWithCorsProxy(targetUrl: string, blogId?: string): Promise<string> {
  // If running in Node.js server environment, fetch directly without relative proxy path
  if (typeof window === 'undefined') {
    const res = await fetch(targetUrl, {
      headers: {
        Accept: 'application/xml, text/xml, */*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  }

  // 1. In browser runtime: Try our direct backend proxy endpoint first (/api/rss-proxy)
  if (blogId || targetUrl) {
    try {
      const proxyApiUrl = blogId
        ? `/api/rss-proxy?blogId=${encodeURIComponent(blogId)}`
        : `/api/rss-proxy?url=${encodeURIComponent(targetUrl)}`;
      const res = await fetch(proxyApiUrl);
      if (res.ok) {
        const text = await res.text();
        if (text && text.trim().length > 20 && (text.includes('<') || text.includes('xml'))) {
          return text;
        }
      }
    } catch {
      // Fallback to CORS proxies below
    }
  }

  const proxies = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
    `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
  ];

  let lastError: any = null;
  for (const proxyUrl of proxies) {
    try {
      const res = await fetch(proxyUrl, { headers: { Accept: 'application/xml, text/xml, */*' } });
      if (res.ok) {
        const text = await res.text();
        if (text && text.trim().length > 20 && (text.includes('<') || text.includes('xml'))) {
          return text;
        }
      }
    } catch (e) {
      lastError = e;
    }
  }

  throw new Error(lastError?.message || 'CORS 프록시 수집 실패');
}

/**
 * 1. 네이버 블로그 RSS (https://rss.blog.naver.com/아이디.xml) 파싱 함수
 * 지정된 네이버 블로그 ID의 RSS XML을 파싱하여 공개 포스팅 목록 및 챌린지 기간 포스팅 수를 추출합니다.
 */
export async function fetchNaverBlogRssPosts(
  blogId: string,
  startDate?: string,
  forceFetch: boolean = true,
  endDate?: string
): Promise<RssFetchResult> {
  const cleanBlogId = extractNaverBlogId(blogId);
  if (!cleanBlogId) {
    return { blogId: '', todayPostCount: 0, latestPosts: [], allPosts: [], error: '블로그 ID 없음' };
  }
  
  // Cache-busting: add timestamp query parameter if forceFetch is true
  const cacheBuster = forceFetch ? `?_t=${Date.now()}` : '';
  const rssUrl = `https://rss.blog.naver.com/${cleanBlogId}.xml${cacheBuster}`;

  try {
    const xmlText = await fetchXmlWithCorsProxy(rssUrl, cleanBlogId);

    if (!xmlText || (!xmlText.includes('<rss') && !xmlText.includes('<item'))) {
      throw new Error('올바른 네이버 RSS XML 응답이 아닙니다.');
    }

    const allPosts: BlogPost[] = [];
    let challengePostCount = 0;

    const todayStr = new Date().toISOString().split('T')[0];
    const cutoffDateStr = startDate && startDate.trim() ? startDate.trim() : '2026-01-01';
    const endCutoffDateStr = endDate && endDate.trim() ? endDate.trim() : undefined;

    let parsedSuccess = false;

    if (typeof window !== 'undefined' && typeof DOMParser !== 'undefined') {
      try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        const parseError = xmlDoc.querySelector('parsererror');
        const items = xmlDoc.getElementsByTagName('item');

        if (!parseError && items && items.length > 0) {
          parsedSuccess = true;
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const titleNode = item.getElementsByTagName('title')[0];
            const linkNode = item.getElementsByTagName('link')[0];
            const pubDateNode = item.getElementsByTagName('pubDate')[0] || item.getElementsByTagName('dc:date')[0];

            const title = (titleNode?.textContent || '').trim();
            const rawLink = (linkNode?.textContent || '').trim();
            const pubDateRaw = (pubDateNode?.textContent || '').trim();

            let itemDateStr = '';
            if (pubDateRaw) {
              const itemDate = new Date(pubDateRaw);
              if (!isNaN(itemDate.getTime())) {
                const kstMs = itemDate.getTime() + 9 * 60 * 60 * 1000;
                itemDateStr = new Date(kstMs).toISOString().split('T')[0];
              }
            }

            // [비공개] 또는 [임시저장] 글은 집계 제외 (발행 완료 상태인 것만 집계)
            const isPublic = !title.includes('[비공개]') && !title.includes('[임시저장]');

            if (isPublic && rawLink) {
              const canonicalUrl = getCanonicalNaverPostUrl(cleanBlogId, rawLink);
              const postId = extractNaverPostId(rawLink);
              const postObj: BlogPost = {
                id: generateBlogPostKey(cleanBlogId, canonicalUrl),
                blogId: cleanBlogId.toLowerCase(),
                postId: postId || undefined,
                title: title || '제목 없음',
                link: canonicalUrl,
                pubDate: pubDateRaw,
                publishedDate: itemDateStr || todayStr,
              };

              allPosts.push(postObj);

              if (itemDateStr && filterByDate(itemDateStr, cutoffDateStr, endCutoffDateStr)) {
                challengePostCount++;
              }
            }
          }
        }
      } catch (domErr) {
        parsedSuccess = false;
      }
    }

    if (!parsedSuccess) {
      // Server-side / Fallback Regex parser
      const itemRegex = /<item>[\s\S]*?<\/item>/gi;
      const matches = xmlText.match(itemRegex) || [];

      matches.forEach((itemXml) => {
        const titleMatch = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/);
        const linkMatch = itemXml.match(/<link>(.*?)<\/link>/);
        const pubDateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>|<dc:date>(.*?)<\/dc:date>/);

        const title = (titleMatch ? (titleMatch[1] || titleMatch[2] || '') : '').trim();
        const rawLink = (linkMatch ? linkMatch[1] : '').trim();
        const pubDateRaw = (pubDateMatch ? (pubDateMatch[1] || pubDateMatch[2] || '') : '').trim();

        let itemDateStr = '';
        if (pubDateRaw) {
          const itemDate = new Date(pubDateRaw);
          if (!isNaN(itemDate.getTime())) {
            const kstMs = itemDate.getTime() + 9 * 60 * 60 * 1000;
            itemDateStr = new Date(kstMs).toISOString().split('T')[0];
          }
        }

        // [비공개] 또는 [임시저장] 글은 집계 제외
        const isPublic = !title.includes('[비공개]') && !title.includes('[임시저장]');

        if (isPublic && rawLink) {
          const canonicalUrl = getCanonicalNaverPostUrl(cleanBlogId, rawLink);
          const postId = extractNaverPostId(rawLink);
          const postObj: BlogPost = {
            id: generateBlogPostKey(cleanBlogId, canonicalUrl),
            blogId: cleanBlogId.toLowerCase(),
            postId: postId || undefined,
            title: title || '제목 없음',
            link: canonicalUrl,
            pubDate: pubDateRaw,
            publishedDate: itemDateStr || todayStr,
          };

          allPosts.push(postObj);

          if (itemDateStr && filterByDate(itemDateStr, cutoffDateStr, endCutoffDateStr)) {
            challengePostCount++;
          }
        }
      });
    }

    return {
      blogId: cleanBlogId,
      todayPostCount: challengePostCount,
      latestPosts: allPosts.slice(0, 5),
      allPosts,
    };
  } catch (err: any) {
    console.warn(`[RSS Parser Warning] ${cleanBlogId}:`, err.message);
    return {
      blogId: cleanBlogId,
      todayPostCount: 0,
      latestPosts: [],
      allPosts: [],
      error: err.message,
    };
  }
}

/**
 * 2. 트위터 수집용 기본 Stub (스텁) 함수
 * 트위터(X) API v2 키 또는 웹 스크래퍼 연동 시 확장 가능한 스텁 규격입니다.
 */
export async function fetchTwitterMetricsStub(twitterId: string): Promise<TwitterFetchResult> {
  if (!twitterId || twitterId.trim() === '' || twitterId === '-') {
    return {
      twitterId,
      tweetCount: 0,
      replyCount: 0,
      status: 'error',
      message: '트위터 핸들이 지정되지 않았습니다.',
    };
  }

  return {
    twitterId: twitterId.trim(),
    tweetCount: 0,
    replyCount: 0,
    status: 'stub',
    message: 'Twitter API v2 연동이 필요합니다.',
  };
}

/**
 * 4. 참가자 전체에 대한 일별 자동 수집 통합 루틴 (동일 블로그 중복 호출 방지 및 포스팅 독립 집계)
 */
export async function runBatchDataCollector(
  participants: Participant[],
  onProgress?: (index: number, total: number, participantName: string) => void,
  forceFetch: boolean = true,
  groups?: ChallengeGroup[]
): Promise<{ updatedParticipants: Participant[]; uniqueBlogPosts: BlogPost[]; logSummary: string[] }> {
  const logSummary: string[] = [];
  const todayStr = new Date().toISOString().split('T')[0];
  let completedCount = 0;

  // 1. 고유 블로그 ID별로 RSS 한 번만 수집 (중복 네트워크 호출 및 중복 집계 원천 차단)
  const uniqueBlogIds = Array.from(
    new Set(
      participants
        .filter((p) => p.platformType === 'blog' || p.platformType === 'both')
        .map((p) => (p.blogId ? extractNaverBlogId(p.blogId) : ''))
        .filter(Boolean)
    )
  );

  const blogPostsMap = new Map<string, { allPosts: BlogPost[]; error?: string }>();

  await Promise.all(
    uniqueBlogIds.map(async (blogId) => {
      const res = await fetchNaverBlogRssPosts(blogId, undefined, forceFetch);
      blogPostsMap.set(blogId.toLowerCase(), {
        allPosts: res.allPosts,
        error: res.error,
      });
    })
  );

  // 2. 전체 고유 포스팅 맵 (글 자체를 글로벌하게 1개로 유지)
  const globalUniquePostsMap = new Map<string, BlogPost>();
  blogPostsMap.forEach((data) => {
    data.allPosts.forEach((post) => {
      if (!globalUniquePostsMap.has(post.id)) {
        globalUniquePostsMap.set(post.id, post);
      }
    });
  });

  // 3. 각 참가자별 챌린지 기간에 맞는 포스팅 개수 및 통계 계산
  const updatedList: Participant[] = [];

  for (const p of participants) {
    let pStartDate = p.startDate && p.startDate.trim() ? p.startDate.trim() : '2026-07-01';
    let pEndDate: string | undefined = undefined;

    if (groups && groups.length > 0) {
      const pGroups = (p.groupNames && p.groupNames.length > 0)
        ? p.groupNames
        : p.groupName ? p.groupName.split(',').map((s) => s.trim()).filter(Boolean) : [];
      const matched = groups.filter((g) => pGroups.includes(g.name) || p.groupName === g.name);
      if (matched.length > 0) {
        const starts = matched.map((g) => g.startDate).filter((d): d is string => Boolean(d && d.trim())).sort();
        const ends = matched.map((g) => g.endDate).filter((d): d is string => Boolean(d && d.trim())).sort();
        if (starts.length > 0) pStartDate = starts[0];
        const hasOpenEnded = matched.some((g) => !g.endDate || !g.endDate.trim());
        if (!hasOpenEnded && ends.length > 0) pEndDate = ends[ends.length - 1];
      }
    }

    const cleanBlogId = p.blogId ? extractNaverBlogId(p.blogId) : null;
    const maxHistPosts = p.history ? Math.max(0, ...p.history.map((h) => h.blogPosts || 0)) : 0;
    const maxHistVisitors = p.history ? Math.max(0, ...p.history.map((h) => h.blogVisitors || 0)) : 0;

    let fetchedPostCount = 0;
    let newVisitorCount = Math.max(p.dailyVisitorCount || 0, maxHistVisitors);
    let newTweetCount = Math.max(p.tweetCount || 0, p.history ? Math.max(0, ...p.history.map((h) => h.tweets || 0)) : 0);
    let newReplyCount = Math.max(p.replyCount || 0, p.history ? Math.max(0, ...p.history.map((h) => h.replies || 0)) : 0);

    if ((p.platformType === 'blog' || p.platformType === 'both') && cleanBlogId) {
      const blogData = blogPostsMap.get(cleanBlogId.toLowerCase());
      if (blogData) {
        if (blogData.error) {
          logSummary.push(`[블로그 RSS 수집 에러] ${p.participantName} (@${cleanBlogId}): ${blogData.error}`);
        } else {
          // 해당 참가자의 챌린지 기간(startDate ~ endDate) 중에 발행된 글만 엄격히 필터링하여 카운트
          const matchingPosts = blogData.allPosts.filter((post) =>
            filterByDate(post.publishedDate, pStartDate, pEndDate)
          );
          fetchedPostCount = matchingPosts.length;
          if (fetchedPostCount > 0) {
            logSummary.push(
              `[블로그 RSS 수집 성공] ${p.participantName} (@${cleanBlogId}) - ${p.groupName}: 챌린지 기간(${pStartDate}${pEndDate ? `~${pEndDate}` : ''}) 기준 ${fetchedPostCount}개`
            );
          }
        }
      }
    } else if (p.platformType === 'blog' || p.platformType === 'both') {
      logSummary.push(`[블로그 ID 미등록] ${p.participantName}`);
    }

    // Twitter Stub 처리
    if ((p.platformType === 'twitter' || p.platformType === 'both') && p.twitterId) {
      const twRes = await fetchTwitterMetricsStub(p.twitterId);
      newTweetCount = Math.max(newTweetCount, twRes.tweetCount);
      newReplyCount = Math.max(newReplyCount, twRes.replyCount);
    }

    // 수집된 데이터를 Participant 객체에 반영
    const tempPostCount = Math.max(p.dailyPostCount || 0, maxHistPosts, fetchedPostCount);

    const currentHistory = (p.history ? [...p.history] : [])
      .map((h) => ({ ...h, blogVisitors: h.blogVisitors || newVisitorCount }))
      .filter((h) => filterByDate(h.date, pStartDate, pEndDate));

    currentHistory.sort((a, b) => a.date.localeCompare(b.date));

    const todayHistoryIndex = currentHistory.findIndex((h) => h.date === todayStr);
    const todayStatRecord = {
      date: todayStr,
      blogPosts: tempPostCount,
      blogVisitors: newVisitorCount,
      tweets: newTweetCount,
      replies: newReplyCount,
    };

    if (todayHistoryIndex >= 0) {
      currentHistory[todayHistoryIndex] = {
        ...currentHistory[todayHistoryIndex],
        ...todayStatRecord,
      };
    } else if (filterByDate(todayStr, pStartDate, pEndDate)) {
      currentHistory.push(todayStatRecord);
    }

    updatedList.push({
      ...p,
      blogId: cleanBlogId,
      dailyPostCount: tempPostCount,
      dailyVisitorCount: newVisitorCount,
      tweetCount: newTweetCount,
      replyCount: newReplyCount,
      history: currentHistory,
      _fetchedPostCount: fetchedPostCount,
    } as any);

    completedCount++;
    if (onProgress) {
      onProgress(completedCount, participants.length, p.participantName);
    }
  }

  const uniqueBlogPosts = Array.from(globalUniquePostsMap.values());
  return { updatedParticipants: updatedList, uniqueBlogPosts, logSummary };
}

/**
 * 5. 관리자 전용 데이터 정합성 검사
 */
export async function verifyAndSyncParticipantData(
  participants: Participant[],
  onProgress?: (index: number, total: number, participantName: string) => void,
  forceFetch: boolean = true
): Promise<{ verifiedParticipants: Participant[]; auditLog: string[] }> {
  const auditLog: string[] = [];
  const verifiedParticipants: Participant[] = [];
  let completedCount = 0;

  for (const p of participants) {
    let actualPostCount = p.dailyPostCount || 0;
    const oldVal = p.history && p.history.length > 0 ? Math.max(...p.history.map((h) => h.blogPosts || 0)) : 0;

    if (actualPostCount < oldVal) {
      auditLog.push(`[정합성 실패/롤백] ${p.participantName}: 비정상적 수치 감소 (${actualPostCount} < ${oldVal}) -> 보정 처리`);
      actualPostCount = oldVal;
    } else {
      auditLog.push(`[정합성 검증 완료] ${p.participantName}: 포스팅 수 ${actualPostCount}개`);
    }

    const verifiedP: Participant = {
      ...p,
      dailyPostCount: actualPostCount,
    };
    delete (verifiedP as any)._fetchedPostCount;

    verifiedParticipants.push(verifiedP);
    completedCount++;
    if (onProgress) {
      onProgress(completedCount, participants.length, p.participantName);
    }
  }

  return { verifiedParticipants, auditLog };
}

/**
 * 6. 검증 완료된 참가자 데이터 및 고유 포스팅 원장을 Supabase DB에 일괄 저장
 */
export async function syncBulkToSupabase(
  participants: Participant[],
  uniquePostsOrProgress?: BlogPost[] | ((index: number, total: number, participantName: string) => void),
  onProgress?: (index: number, total: number, participantName: string) => void
): Promise<void> {
  const todayStr = new Date().toISOString().split('T')[0];
  let completedCount = 0;

  let uniquePosts: BlogPost[] = [];
  let progressCallback = onProgress;

  if (Array.isArray(uniquePostsOrProgress)) {
    uniquePosts = uniquePostsOrProgress;
  } else if (typeof uniquePostsOrProgress === 'function') {
    progressCallback = uniquePostsOrProgress;
  }

  // 1. 고유 블로그 포스팅 원장 저장 (중복 무시 및 upsert)
  if (uniquePosts.length > 0) {
    try {
      await saveBlogPostsToSupabase(uniquePosts);
    } catch (err) {
      console.warn('[Supabase Blog Posts Sync Error]:', err);
    }
  }

  // 2. 참가자 및 일별 통계 저장
  const promises = participants.map(async (p) => {
    try {
      await saveParticipantToSupabase(p);
      await saveDailyStatToSupabase({
        participantId: p.id,
        recordDate: todayStr,
        blogPosts: p.dailyPostCount || 0,
        blogVisitors: p.dailyVisitorCount || 0,
        tweets: p.tweetCount || 0,
        replies: p.replyCount || 0,
      });
    } catch (err) {
      console.warn(`[Supabase Bulk Sync Error] ${p.participantName}:`, err);
    }
    completedCount++;
    if (progressCallback) {
      progressCallback(completedCount, participants.length, p.participantName);
    }
  });

  await Promise.all(promises);
}


