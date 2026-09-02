/**
 * Naver Blog ID extractor utility
 * Extracts pure naver_ID from various Naver Blog URL formats or raw strings.
 *
 * Supported formats:
 * - https://blog.naver.com/naver_ID
 * - https://m.blog.naver.com/naver_ID
 * - http://blog.naver.com/naver_ID/223123456789
 * - https://blog.naver.com/PostView.naver?blogId=naver_ID...
 * - https://section.blog.naver.com/BlogHome.naver?directoryNo=0&currentPage=1&groupId=0&blogId=naver_ID
 * - @naver_ID
 * - naver_ID
 */
export function extractNaverBlogId(input: string | null | undefined): string {
  if (!input) return '';
  let str = input.trim();
  if (!str || str === '-') return '';

  // 1. Check if query parameter contains 'blogId=xxx'
  const blogIdQueryMatch = str.match(/[?&]blogId=([a-zA-Z0-9_-]+)/i);
  if (blogIdQueryMatch && blogIdQueryMatch[1]) {
    return blogIdQueryMatch[1];
  }

  // 2. Remove protocol (http://, https://)
  str = str.replace(/^https?:\/\//i, '');

  // 3. Remove leading domain prefixes
  str = str.replace(/^(m\.)?blog\.naver\.com\//i, '');
  str = str.replace(/^section\.blog\.naver\.com\/(BlogHome\.naver)?/i, '');

  // 4. Extract first path segment before slashes, query params, or hash fragments
  const pathSegment = str.split('/')[0].split('?')[0].split('#')[0];

  // 5. Clean leading '@' if present and trim whitespace
  const cleanId = pathSegment.replace(/^@/, '').trim();

  return cleanId;
}

/**
 * URL 정규화(Normalization) 유틸리티
 * - 프로토콜(http/https) 제거
 * - www. 제거
 * - 후행 슬래시(/) 제거
 * - 모두 소문자로 변환
 * 목적: 서로 다른 환경(RSS vs 사용자 입력)에서 수집된 URL이 형식 차이에도 동일하게 인식되도록 지원
 */
export function normalizeUrl(url: string | null | undefined): string {
  if (!url) return '';
  let normalized = url.trim().toLowerCase();
  
  // 프로토콜 제거
  normalized = normalized.replace(/^https?:\/\//, '');
  
  // www. 제거
  normalized = normalized.replace(/^www\./, '');
  
  // 후행 슬래시 제거
  normalized = normalized.replace(/\/$/, '');
  
  return normalized;
}

/**
 * 두 URL이 실질적으로 동일한지 비교하는 함수
 */
export function isSameUrl(url1: string, url2: string): boolean {
  return normalizeUrl(url1) === normalizeUrl(url2);
}

/**
 * 네이버 블로그 포스팅 고유 ID (logNo / post id) 추출 함수
 * 예: https://blog.naver.com/id/223123456789 -> '223123456789'
 * 예: https://blog.naver.com/PostView.nhn?blogId=id&logNo=223123456789 -> '223123456789'
 * 예: https://m.blog.naver.com/id/223123456789 -> '223123456789'
 */
export function extractNaverPostId(url: string | null | undefined): string {
  if (!url) return '';
  const str = url.trim();

  // 1. logNo 쿼리 파라미터 매칭 (?logNo=223123456789)
  const logNoMatch = str.match(/[?&]logNo=(\d+)/i);
  if (logNoMatch && logNoMatch[1]) {
    return logNoMatch[1];
  }

  // 2. 경로 끝의 숫자 매칭 (naver.com/userId/223123456789)
  const pathMatch = str.match(/\/(\d{5,20})(?:[/?#]|$)/);
  if (pathMatch && pathMatch[1]) {
    return pathMatch[1];
  }

  return '';
}

/**
 * 네이버 블로그 포스팅 표준(Canonical) URL 생성 함수
 * 동일한 포스팅이 서로 다른 URL 형태(m.blog, PostView.nhn, 데스크톱)로 수집되어도
 * 항상 https://blog.naver.com/{blogId}/{logNo} 형태의 표준 URL로 정규화합니다.
 */
export function getCanonicalNaverPostUrl(blogId: string, url: string): string {
  const cleanBlogId = extractNaverBlogId(blogId) || extractNaverBlogId(url);
  const postId = extractNaverPostId(url);

  if (cleanBlogId && postId) {
    return `https://blog.naver.com/${cleanBlogId.toLowerCase()}/${postId}`;
  }

  return normalizeUrl(url);
}

/**
 * 포스팅 고유 식별 키 생성
 * 포스팅 자체와 챌린지 참여를 분리하여 동일 포스팅 중복 저장을 원천 차단
 */
export function generateBlogPostKey(blogId: string, url: string): string {
  const cleanBlogId = (extractNaverBlogId(blogId) || extractNaverBlogId(url) || 'unknown').toLowerCase();
  const postId = extractNaverPostId(url);

  if (postId) {
    return `post_${cleanBlogId}_${postId}`;
  }

  // postId가 없을 경우 URL 해시 기반 고유 키 생성
  const norm = normalizeUrl(url);
  let hash = 0;
  for (let i = 0; i < norm.length; i++) {
    hash = ((hash << 5) - hash) + norm.charCodeAt(i);
    hash |= 0;
  }
  return `post_${cleanBlogId}_${Math.abs(hash)}`;
}
