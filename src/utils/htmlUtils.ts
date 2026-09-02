/**
 * HTML 및 텍스트 렌더링/변환 유틸리티
 */

/**
 * HTML 엔티티를 디코딩합니다.
 */
export function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&#x2F;/gi, '/')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec));
}

/**
 * HTML 문자열에서 태그를 안전하게 제거하고 순수 텍스트로 변환합니다.
 * 줄바꿈(<br>, </div>, </p>, </li> 등)과 문단 구분을 자연스럽게 유지합니다.
 */
export function stripHtmlToPlainText(html: string): string {
  if (!html) return '';

  let text = html;

  // 만약 &lt;div&gt; 와 같이 인코딩된 HTML 태그가 포함되어 있다면 먼저 디코딩
  if (/&lt;[a-z/][\s\S]*?&gt;/i.test(text)) {
    text = decodeHtmlEntities(text);
  }

  // 1. 연속된 빈 줄바꿈 태그 (<div><br></div>, <p><br></p>, <p></p>, <div></div> 등) 정리
  text = text.replace(/<(div|p|span)[^>]*>\s*(<br\s*\/?>)?\s*<\/\1>/gi, '\n');

  // 2. <br> 태그를 줄바꿈 문자로 변환
  text = text.replace(/<br\s*\/?>/gi, '\n');

  // 3. 블록 레벨 닫는 태그들을 줄바꿈 문자로 변환
  text = text.replace(/<\/(div|p|h[1-6]|li|blockquote|tr)>/gi, '\n');

  // 4. 나머지 모든 HTML 태그 제거
  text = text.replace(/<[^>]+>/g, ' ');

  // 5. HTML 엔티티 디코딩
  text = decodeHtmlEntities(text);

  // 6. 연속된 공백 및 줄바꿈 정리 (3개 이상의 연속 줄바꿈은 2개로 압축)
  text = text
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text;
}

/**
 * 한 줄 요약/미리보기용 텍스트 추출 (줄바꿈 없이 한 줄로 압축)
 */
export function getSingleLinePlainText(html: string, maxLength: number = 100): string {
  if (!html) return '';
  const plain = stripHtmlToPlainText(html).replace(/\s+/g, ' ').trim();
  if (plain.length <= maxLength) return plain;
  return plain.slice(0, maxLength) + '...';
}

/**
 * HTML 본문 또는 명시적 URL에서 썸네일 이미지 URL을 추출합니다.
 */
export function extractThumbnailFromHtml(html: string, explicitUrl?: string): string {
  if (explicitUrl && explicitUrl.trim()) return explicitUrl.trim();
  if (!html) return '';
  let content = html;
  if (/&lt;img/i.test(content)) {
    content = decodeHtmlEntities(content);
  }
  const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  return imgMatch && imgMatch[1] ? imgMatch[1] : '';
}

/**
 * 본문 내용이 HTML인지 순수 텍스트인지 판단하여 안전한 HTML 문자열로 반환합니다.
 * (순수 텍스트일 경우 줄바꿈을 <br />로 변환하여 동일하게 서식 유지)
 */
export function formatAnnouncementHtml(content: string): string {
  if (!content) return '';

  let html = content;

  // 만약 &lt;div&gt; 와 같이 인코딩된 HTML 태그가 포함되어 있다면 디코딩
  if (/&lt;(div|p|span|br|h[1-6]|ul|ol|li|strong|b|em|i|img|a|table)/i.test(html)) {
    html = decodeHtmlEntities(html);
  }

  const hasHtmlTag = /<[a-z][\s\S]*>/i.test(html);
  if (!hasHtmlTag) {
    // 순수 텍스트인 경우 줄바꿈을 <br/>로 치환하여 줄바꿈 유지
    return html.replace(/\n/g, '<br />');
  }

  // HTML인 경우 원본 반환
  return html;
}
