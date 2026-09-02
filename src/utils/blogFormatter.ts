import {
  UserBlogStyle,
  DEFAULT_USER_BLOG_STYLE,
  BlogTextAlign,
  BlogLineHeight,
  BlogParagraphSpacing,
  SubheadingStyle,
  EmphasisStyle,
} from '../types';

export const BLOG_TEXT_ALIGN_OPTIONS: { value: BlogTextAlign; label: string; iconName: string }[] = [
  { value: 'center', label: '가운데 정렬 (블로그 기본)', iconName: 'AlignCenter' },
  { value: 'left', label: '왼쪽 정렬', iconName: 'AlignLeft' },
  { value: 'justify', label: '양쪽 정렬', iconName: 'AlignJustify' },
];

export const BLOG_LINE_HEIGHT_OPTIONS: { value: BlogLineHeight; label: string }[] = [
  { value: '1.6', label: '1.6 (약간 촘촘)' },
  { value: '1.8', label: '1.8 (표준 권장)' },
  { value: '2.0', label: '2.0 (여유로움)' },
  { value: '2.2', label: '2.2 (넓은 행간)' },
];

export const BLOG_PARAGRAPH_SPACING_OPTIONS: { value: BlogParagraphSpacing; label: string }[] = [
  { value: '10px', label: '10px (좁음)' },
  { value: '14px', label: '14px (보통)' },
  { value: '18px', label: '18px (권장 표준)' },
  { value: '22px', label: '22px (넓은 여백)' },
];

/**
 * 소제목 서식 스타일 옵션 (표준 소제목 단일화)
 */
export const SUBHEADING_STYLE_OPTIONS: { value: SubheadingStyle; label: string; desc: string }[] = [
  { value: 'standard', label: '표준 소제목', desc: '네이버 블로그 표준 깔끔한 H2 소제목' },
];

/**
 * 소제목 스타일 키 정규화
 */
export function normalizeSubheadingStyle(_styleKey?: string): 'standard' {
  return 'standard';
}

/**
 * 소제목 스타일 한글 라벨 헬퍼
 */
export function getSubheadingStyleLabel(_styleKey?: string): string {
  return '표준 소제목';
}

/**
 * 본문 핵심 문구 강조 스타일 옵션
 */
export const EMPHASIS_STYLE_OPTIONS: { value: EmphasisStyle; label: string; desc: string }[] = [
  { value: 'bold', label: '굵은 글씨만 (기본)', desc: '기본 굵은 글씨 스타일' },
  { value: 'bold_color', label: '볼드 + 포인트 컬러', desc: '굵은 글씨 + 선택한 강조색' },
  { value: 'highlight_bg', label: '형광펜 배경색 효과', desc: '글자 뒤에 부드러운 배경색 채우기' },
  { value: 'color_only', label: '포인트 컬러만', desc: '글자 굵기 없이 선택한 색상만 적용' },
];

export const ACCENT_COLOR_PRESETS = [
  { name: '시그니처 오렌지', hex: '#ff9300' },
  { name: '네이버 그린', hex: '#03c75a' },
  { name: '로열 블루', hex: '#2563eb' },
  { name: '에메랄드 틸', hex: '#10b981' },
  { name: '비비드 핑크', hex: '#ec4899' },
  { name: '퍼플 바이올렛', hex: '#8b5cf6' },
  { name: '차콜 블랙', hex: '#1e293b' },
  { name: '다크 레드', hex: '#dc2626' },
];

/**
 * 본문 폰트 색상은 완전 블랙(기본) 단일 프리셋만 제공
 */
export const TEXT_COLOR_PRESETS = [
  { name: '완전 블랙 (기본)', hex: '#000000' },
];

/**
 * 헥스 컬러에서 소프트 배경색 계산 헬퍼 (글자 배경색 효과용)
 */
export function getSoftBackgroundColor(hexColor: string): string {
  if (!hexColor || !hexColor.startsWith('#')) return '#fff3bf';
  const cleanHex = hexColor.replace('#', '');
  if (cleanHex.length === 6) {
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, 0.18)`;
  }
  return '#fff3bf';
}

/**
 * 소제목(H2) 텍스트 인라인 스타일 생성 (간결한 표준 스타일)
 */
export function getH2StyleCss(style: UserBlogStyle): string {
  const textAlign = style.textAlign || 'center';
  return `margin: 36px 0 16px 0; font-weight: 700; line-height: 1.45; text-align: ${textAlign}; letter-spacing: -0.5px; word-break: keep-all;`;
}

/**
 * 표준 소제목(H2) HTML 렌더링 헬퍼
 */
export function renderH2Html(
  rawText: string,
  userStyle: UserBlogStyle,
  h2Index?: number
): string {
  let cleanText = rawText
    .replace(/^<div[^>]*>/i, '')
    .replace(/<\/div>$/i, '')
    .replace(/^<h2[^>]*>/i, '')
    .replace(/<\/h2>$/i, '')
    .replace(/^[“"']\s*/, '')
    .replace(/\s*[”"']$/, '')
    .trim();

  // 자동 번호 매기기 처리
  if (userStyle.h2AutoNumbering && typeof h2Index === 'number' && h2Index > 0) {
    const hasNumberPrefix = /^(\d+[\.\)]\s*|\[\d+\]\s*|Q\d+[\.\:]\s*)/i.test(cleanText);
    if (!hasNumberPrefix) {
      cleanText = `${h2Index}. ${cleanText}`;
    }
  }

  const h2Style = getH2StyleCss(userStyle);
  return `<h2 style="${h2Style}">${cleanText}</h2>`;
}

/**
 * 강조(Strong) 스타일 CSS 문자열 생성
 */
export function getStrongStyleCss(style: UserBlogStyle): string {
  const emphasisColor = style.emphasisColor || '#ff9300';
  const textColor = style.textColor || '#000000';

  switch (style.emphasisStyle) {
    case 'bold_color':
      return `font-weight: 700; color: ${emphasisColor};`;

    case 'highlight_bg':
      const softBg = getSoftBackgroundColor(emphasisColor);
      return `background-color: ${softBg}; color: ${textColor}; font-weight: 700; padding: 2px 6px; border-radius: 4px; display: inline; line-height: 1.4;`;

    case 'color_only':
      return `font-weight: normal; color: ${emphasisColor};`;

    case 'bold':
    default:
      return `font-weight: 700;`;
  }
}

/**
 * 가독성을 위한 줄바꿈 정리
 */
export function formatReadabilityLines(rawHtml: string): string {
  if (!rawHtml) return '';
  return rawHtml;
}

/**
 * 내부 이미지 가이드 및 마크다운 태그 정제
 */
export function cleanInternalDraftArtifacts(html: string): string {
  if (!html) return '';

  return html
    .replace(/^```html\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!--[\s\S]*?(?=<[a-zA-Z\/]|-->|$)/g, '')
    .replace(/<!--/g, '')
    .replace(/-->/g, '')
    .replace(/<div\s+class=["']image-placeholder["'][^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<figure[^>]*>[\s\S]*?<\/figure>/gi, '')
    .replace(/\[\s*(?:이미지|사진|IMAGE|사진위치|이미지설명|포토|카드뉴스)[\s\S]*?\]/gi, '')
    .replace(/\[\s*(?:추천\s*이미지|이미지\s*가이드)[\s\S]*?\]/gi, '')
    .replace(/<p>\s*\[\s*(?:이미지|사진)[\s\S]*?\]\s*<\/p>/gi, '')
    .trim();
}

/**
 * 핵심 서식 엔진: AI가 생성한 원본 HTML에 사용자의 블로그 서식(UserBlogStyle)을 일관되게 적용
 * 폰트/글자크기 강제 인라인 스타일을 배제하여 깔끔하고 가벼운 표준 HTML 출력
 */
export function applyUserBlogStyle(rawHtml: string, userStyle?: Partial<UserBlogStyle>): string {
  if (!rawHtml || !rawHtml.trim()) return '';

  const style: UserBlogStyle = {
    ...DEFAULT_USER_BLOG_STYLE,
    ...(userStyle || {}),
  };

  const textAlign = style.textAlign || 'center';
  const lineHeight = style.lineHeight || '1.8';
  const paragraphSpacing = style.paragraphSpacing || '18px';
  const strongStyleCss = getStrongStyleCss(style);

  // 1. 내부 아티팩트 및 마크다운 펜스 정리
  let cleaned = cleanInternalDraftArtifacts(rawHtml);

  // 2. 표(table) 안에 잘못 래핑된 소제목(H2)이 있을 경우 표 태그 제거 및 순수 H2로 언랩
  cleaned = cleaned.replace(/<table[^>]*>[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>[\s\S]*?<\/table>/gi, '<h2>$1</h2>');

  // 3. 기존 네이버 인용구 div 래퍼가 있는 경우 순수 H2 태그로 언랩하여 이중 래핑 방지
  cleaned = cleaned.replace(/<div\s+class=["']naver-quote(?:\s+[\w-]+)*["'][^>]*>[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>[\s\S]*?<\/div>/gi, '<h2>$1</h2>');

  // 4. H1 제목 스타일 적용
  cleaned = cleaned.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_match, text) => {
    return `<h1 style="font-weight: 800; line-height: 1.4; margin: 30px 0 20px 0; text-align: ${textAlign}; letter-spacing: -0.5px; word-break: keep-all;">${text.trim()}</h1>`;
  });

  // 5. H2 소제목 스타일 적용 (표준 소제목)
  let h2Index = 0;
  cleaned = cleaned.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_match, text) => {
    h2Index += 1;
    return renderH2Html(text, style, h2Index);
  });

  // 6. H3 소제목 스타일 적용
  cleaned = cleaned.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_match, text) => {
    return `<h3 style="font-weight: 700; line-height: 1.5; margin: 24px 0 12px 0; text-align: ${textAlign}; letter-spacing: -0.3px; word-break: keep-all;">${text.trim()}</h3>`;
  });

  // 7. 본문 문단 (<p>) 스타일 적용
  cleaned = cleaned.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_match, text) => {
    const trimmed = text.trim();
    if (!trimmed) return '';
    return `<p style="line-height: ${lineHeight}; text-align: ${textAlign}; margin: 0 0 ${paragraphSpacing} 0; word-break: keep-all; overflow-wrap: break-word;">${trimmed}</p>`;
  });

  // 8. 강조 태그 (<strong>, <b>) 스타일 적용
  cleaned = cleaned.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, (_match, _tag, text) => {
    return `<strong style="${strongStyleCss}">${text}</strong>`;
  });

  // 9. 목록 태그 (<ul>, <ol>, <li>) 스타일 적용
  const listPadding = textAlign === 'center' ? '0' : '24px';
  cleaned = cleaned.replace(/<ul[^>]*>/gi, `<ul style="line-height: ${lineHeight}; margin: 16px 0 24px 0; padding-left: ${listPadding}; list-style-position: inside; text-align: ${textAlign};">`);
  cleaned = cleaned.replace(/<ol[^>]*>/gi, `<ol style="line-height: ${lineHeight}; margin: 16px 0 24px 0; padding-left: ${listPadding}; list-style-position: inside; text-align: ${textAlign};">`);
  cleaned = cleaned.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_match, text) => {
    return `<li style="line-height: ${lineHeight}; margin-bottom: 8px; text-align: ${textAlign}; word-break: keep-all;">${text.trim()}</li>`;
  });

  // 10. 테이블 (<table>, <th>, <td>) 스타일 적용
  cleaned = cleaned.replace(/<table[^>]*>/gi, `<table style="width: 100%; border-collapse: collapse; margin: 24px 0; line-height: 1.6; border-top: 2px solid #333333; border-bottom: 2px solid #333333;">`);
  cleaned = cleaned.replace(/<th[^>]*>([\s\S]*?)<\/th>/gi, (_match, text) => {
    return `<th style="background-color: #f8f9fa; font-weight: 700; padding: 10px 12px; border-bottom: 1px solid #dddddd; text-align: center;">${text.trim()}</th>`;
  });
  cleaned = cleaned.replace(/<td[^>]*>([\s\S]*?)<\/td>/gi, (_match, text) => {
    return `<td style="padding: 10px 12px; border-bottom: 1px solid #eeeeee; text-align: center; word-break: keep-all;">${text.trim()}</td>`;
  });

  // 11. 인용문 (<blockquote>) 스타일 적용
  cleaned = cleaned.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_match, text) => {
    return `<blockquote style="margin: 20px 0; padding: 14px 18px; background-color: #f8fafc; border-left: 4px solid #03c75a; line-height: ${lineHeight}; text-align: ${textAlign}; border-radius: 4px;">${text.trim()}</blockquote>`;
  });

  // 12. 링크 (<a>) 및 구분선 (<hr>)
  cleaned = cleaned.replace(/<a([^>]*)>/gi, `<a$1 style="color: #2563eb; text-decoration: underline;">`);
  cleaned = cleaned.replace(/<hr[^>]*>/gi, `<hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 32px 0;" />`);

  // 13. 전체 루트 컨테이너 감싸기
  return `<div style="line-height: ${lineHeight}; text-align: ${textAlign}; max-width: 760px; margin: 0 auto; word-break: keep-all; box-sizing: border-box;">
${cleaned}
</div>`;
}

/**
 * 네이버 스마트에디터 복사용 HTML 생성 (prepareNaverBlogHtml 호환)
 */
export function prepareNaverBlogHtml(htmlContent: string, styleConfig?: UserBlogStyle): string {
  return applyUserBlogStyle(htmlContent, styleConfig);
}

/**
 * 클립보드 plain/text 복사용 텍스트 변환
 */
export function preparePlainTextFromHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
