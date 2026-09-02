import { CardNewsItem, CardNewsSlide, CardNewsResult, CardLayout } from '../types';
import { extractAndParseJson } from './jsonUtils';

export interface ValidatedCardNewsData {
  title: string;
  slides: CardNewsSlide[];
  cards: CardNewsItem[];
  rawObject: any;
}

function normalizeCardLayout(rawLayout: any, cardRole?: string, cardNumber?: number): CardLayout {
  const l = String(rawLayout || '').toLowerCase().trim();
  const validLayouts: CardLayout[] = ['cover', 'content', 'comparison', 'checklist', 'timeline', 'step_process', 'metric', 'summary', 'cta'];
  if (validLayouts.includes(l as CardLayout)) {
    return l as CardLayout;
  }
  const r = String(cardRole || '').toLowerCase().trim();
  if (r === 'cover' || cardNumber === 1) return 'cover';
  if (r === 'comparison') return 'comparison';
  if (r === 'summary') return 'summary';
  if (r === 'cta') return 'cta';
  if (r === 'step') return 'step_process';
  if (r === 'checklist' || r === 'tip') return 'checklist';
  return 'content';
}

function normalizeSlideType(rawType: any, cardRole?: string, cardNumber?: number): 'cover' | 'core_content' | 'key_info' | 'summary' | 'cta' {
  const t = String(rawType || cardRole || '').toLowerCase().trim();
  if (t === 'cover' || cardNumber === 1) return 'cover';
  if (t === 'summary') return 'summary';
  if (t === 'cta') return 'cta';
  if (t.includes('info') || t.includes('key') || t.includes('tip') || t.includes('warning')) return 'key_info';
  return 'core_content';
}

/**
 * AI 응답 문자열에서 JSON을 안전하게 추출하고 복구하는 함수
 */
function extractAndRepairJson(input: any): any {
  if (input === null || input === undefined) return null;
  if (typeof input === 'object') return input;

  const parsed = extractAndParseJson(input);
  if (parsed) return parsed;

  let text = String(input).trim();
  if (!text) return null;

  // 4차: 개별 카드 객체 regex 추출 시도 ({ "cardNumber": ... } 등)
  try {
    const cardObjMatches = text.match(/\{[^{}]*(?:title|cardNumber|cardRole|body|contentPoints)[^{}]*\}/g);
    if (cardObjMatches && cardObjMatches.length > 0) {
      const parsedCards: any[] = [];
      for (const cm of cardObjMatches) {
        try {
          const cleanCm = cm.replace(/,\s*([}\]])/g, '$1');
          const pc = extractAndParseJson(cleanCm);
          if (pc) parsedCards.push(pc);
        } catch (_) {}
      }
      if (parsedCards.length > 0) {
        return { cards: parsedCards };
      }
    }
  } catch (_) {}

  return null;
}

/**
 * 일반 텍스트 라인에서 카드뉴스 항목을 추출하는 폴백 파서
 */
function parseCardNewsFromPlainText(text: string, fallbackTitle: string): ValidatedCardNewsData {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const cards: CardNewsItem[] = [];
  let currentCard: Partial<CardNewsItem> | null = null;
  let cardIndex = 1;

  for (const line of lines) {
    const cardHeaderMatch = line.match(/(?:카드|슬라이드|Slide|Card|#)\s*(\d+)[:.\s-]*([^\n]*)/i) ||
                             line.match(/^(\d+)[.)]\s*([^\n]+)/);

    if (cardHeaderMatch) {
      if (currentCard && (currentCard.title || currentCard.body)) {
        cards.push(finalizeCard(currentCard, cards.length + 1));
      }
      const titleCandidate = (cardHeaderMatch[2] || '').trim();
      currentCard = {
        cardNumber: parseInt(cardHeaderMatch[1], 10) || cardIndex++,
        title: titleCandidate || `${cardIndex}번째 핵심 가이드`,
        contentPoints: [],
      };
      continue;
    }

    if (!currentCard) {
      currentCard = {
        cardNumber: cardIndex++,
        title: fallbackTitle || '카드뉴스 안내',
        contentPoints: [],
      };
    }

    if (line.startsWith('-') || line.startsWith('•') || line.startsWith('*')) {
      const pt = line.replace(/^[-•*]\s*/, '').trim();
      if (pt) {
        if (!currentCard.contentPoints) currentCard.contentPoints = [];
        currentCard.contentPoints.push(pt);
      }
    } else if (line.includes('소제목:') || line.includes('부제:')) {
      currentCard.subtitle = line.replace(/.*(?:소제목|부제):\s*/, '').trim();
    } else if (line.includes('내용:') || line.includes('본문:')) {
      currentCard.body = line.replace(/.*(?:내용|본문):\s*/, '').trim();
    } else if (line.includes('CTA:') || line.includes('행동:')) {
      currentCard.cta = line.replace(/.*(?:CTA|행동):\s*/, '').trim();
    } else {
      if (!currentCard.body) {
        currentCard.body = line;
      } else {
        if (!currentCard.contentPoints) currentCard.contentPoints = [];
        currentCard.contentPoints.push(line);
      }
    }
  }

  if (currentCard && (currentCard.title || currentCard.body)) {
    cards.push(finalizeCard(currentCard, cards.length + 1));
  }

  // 여전히 카드가 없으면 기본 4장 생성
  if (cards.length === 0) {
    cards.push(
      finalizeCard({ cardNumber: 1, cardRole: 'cover', title: fallbackTitle || '핵심 블로그 가이드' }, 1),
      finalizeCard({ cardNumber: 2, cardRole: 'key_point', title: '핵심 포인트', body: text.slice(0, 80) }, 2),
      finalizeCard({ cardNumber: 3, cardRole: 'summary', title: '한눈에 보기', body: '상세 내용을 블로그 본문에서 확인하세요.' }, 3),
      finalizeCard({ cardNumber: 4, cardRole: 'cta', title: '도움이 되셨다면', cta: '이웃추가 & 공감' }, 4)
    );
  }

  const validSlides: CardNewsSlide[] = cards.map(c => ({
    slideNumber: c.cardNumber,
    type: normalizeSlideType(c.cardRole, c.cardRole, c.cardNumber),
    title: c.title,
    subtitle: c.subtitle,
    contentPoints: c.contentPoints || [],
    highlightText: c.cta || '',
  }));

  return {
    title: fallbackTitle || '블로그 카드뉴스',
    slides: validSlides,
    cards,
    rawObject: { title: fallbackTitle, cards },
  };
}

function finalizeCard(c: Partial<CardNewsItem> & { searchQuery?: string; imageQuery?: string }, fallbackNumber: number): CardNewsItem {
  const cardNumber = c.cardNumber || fallbackNumber;
  const cardRole = c.cardRole || (cardNumber === 1 ? 'cover' : 'key_point');
  const title = c.title || `${cardNumber}. 핵심 내용`;
  const body = c.body || '';
  const contentPoints = (c.contentPoints && c.contentPoints.length > 0)
    ? c.contentPoints
    : (body ? [body] : [title]);

  const rawSearchQueries = c.searchQueries || (c.searchQuery ? [c.searchQuery] : (c.imageQuery ? [c.imageQuery] : []));
  const searchQueries = Array.isArray(rawSearchQueries) ? rawSearchQueries.map(String).filter(Boolean) : [];

  return {
    cardNumber,
    cardRole,
    title,
    subtitle: c.subtitle || '',
    body,
    contentPoints,
    imageSource: c.imageSource || 'none',
    imageId: c.imageId,
    imageUrl: c.imageUrl,
    imagePrompt: c.imagePrompt,
    searchQueries,
    subject: c.subject || title,
    reason: c.reason || '',
    preferredSource: c.preferredSource || 'unsplash',
    layout: normalizeCardLayout(c.layout, cardRole, cardNumber),
    emphasis: Array.isArray(c.emphasis) ? c.emphasis : [],
    graphicElements: c.graphicElements,
    cta: c.cta || '',
    style: c.style,
    visualStyle: c.visualStyle,
  };
}

/**
 * AI가 반환한 카드뉴스 응답을 안전하게 파싱 및 검증하는 유틸리티
 */
export function validateAndParseCardNews(
  rawResponse: any,
  fallbackTitle: string = '블로그 카드뉴스'
): ValidatedCardNewsData {
  if (!rawResponse) {
    return parseCardNewsFromPlainText('', fallbackTitle);
  }

  // 1. 객체 내부의 문자열/중첩 결과 평탄화
  let dataToParse = rawResponse;
  if (typeof rawResponse === 'object' && rawResponse !== null) {
    if (rawResponse.result !== undefined) {
      dataToParse = rawResponse.result;
    } else if (rawResponse.data !== undefined) {
      dataToParse = rawResponse.data;
    } else if (rawResponse.response !== undefined) {
      dataToParse = rawResponse.response;
    }
  }

  let parsed: any = null;

  if (typeof dataToParse === 'string') {
    parsed = extractAndRepairJson(dataToParse);
    if (!parsed) {
      // 텍스트 폴백 파서 구동
      return parseCardNewsFromPlainText(dataToParse, fallbackTitle);
    }
  } else if (typeof dataToParse === 'object' && dataToParse !== null) {
    parsed = dataToParse;
  }

  if (!parsed || typeof parsed !== 'object') {
    return parseCardNewsFromPlainText(String(rawResponse), fallbackTitle);
  }

  // 2. cards / slides / cardNews / items / pages / 배열 형태 탐색
  let rawCards: any[] | null = null;

  if (Array.isArray(parsed)) {
    rawCards = parsed;
  } else if (Array.isArray(parsed.cards)) {
    rawCards = parsed.cards;
  } else if (Array.isArray(parsed.slides)) {
    rawCards = parsed.slides;
  } else if (Array.isArray(parsed.cardNews)) {
    rawCards = parsed.cardNews;
  } else if (Array.isArray(parsed.card_news)) {
    rawCards = parsed.card_news;
  } else if (Array.isArray(parsed.items)) {
    rawCards = parsed.items;
  } else if (Array.isArray(parsed.pages)) {
    rawCards = parsed.pages;
  } else if (Array.isArray(parsed.list)) {
    rawCards = parsed.list;
  } else if (parsed.engineResult && Array.isArray(parsed.engineResult.cards)) {
    rawCards = parsed.engineResult.cards;
  } else if (typeof parsed === 'object') {
    // 키 이름 중 배열인 첫 번째 필드 탐색
    const potentialArrayKey = Object.keys(parsed).find(k => Array.isArray(parsed[k]) && parsed[k].length > 0);
    if (potentialArrayKey) {
      rawCards = parsed[potentialArrayKey];
    }
  }

  if (!rawCards || !Array.isArray(rawCards) || rawCards.length === 0) {
    // 단일 카드 형태이거나 필드만 있는 경우
    if (parsed.title || parsed.body || parsed.keyword) {
      const singleTitle = parsed.title || fallbackTitle;
      return {
        title: singleTitle,
        slides: [{ slideNumber: 1, type: 'cover', title: singleTitle, contentPoints: [singleTitle] }],
        cards: [finalizeCard({ cardNumber: 1, cardRole: 'cover', title: singleTitle, body: parsed.body }, 1)],
        rawObject: parsed,
      };
    }
    return parseCardNewsFromPlainText(JSON.stringify(parsed), fallbackTitle);
  }

  // 3. 각 카드 항목 표준화
  const validCards: CardNewsItem[] = [];
  const validSlides: CardNewsSlide[] = [];

  rawCards.forEach((c: any, idx: number) => {
    if (!c || typeof c !== 'object') return;

    const cardNumber = Number(c.cardNumber || c.slideNumber || c.slide_number || c.card_number || c.page || idx + 1) || (idx + 1);
    const title = String(c.title || c.header || c.subject || c.name || `${idx + 1}. 핵심 포인트`).trim();
    const subtitle = String(c.subtitle || c.sub_title || c.subHeader || '').trim();
    const body = String(c.body || c.content || c.description || c.text || '').trim();

    let contentPoints: string[] = [];
    if (Array.isArray(c.contentPoints) && c.contentPoints.length > 0) {
      contentPoints = c.contentPoints.map((p: any) => String(p || '').trim()).filter(Boolean);
    } else if (Array.isArray(c.points) && c.points.length > 0) {
      contentPoints = c.points.map((p: any) => String(p || '').trim()).filter(Boolean);
    } else if (Array.isArray(c.bullets) && c.bullets.length > 0) {
      contentPoints = c.bullets.map((p: any) => String(p || '').trim()).filter(Boolean);
    } else if (body) {
      contentPoints = [body];
    } else {
      contentPoints = [title];
    }

    const cardRole = String(c.cardRole || c.role || c.type || (cardNumber === 1 ? 'cover' : 'key_point')).toLowerCase().trim();
    const layout: CardLayout = normalizeCardLayout(c.layout, cardRole, cardNumber);

    const searchQueries: string[] = Array.isArray(c.searchQueries)
      ? c.searchQueries.map(String).filter(Boolean)
      : (c.searchQuery ? [String(c.searchQuery)] : (c.imageQuery ? [String(c.imageQuery)] : []));

    const cardItem: CardNewsItem = {
      cardNumber,
      cardRole,
      title,
      subtitle,
      body,
      contentPoints,
      imageSource: c.imageSource || 'none',
      imageId: c.imageId,
      imageUrl: c.imageUrl,
      imagePrompt: c.imagePrompt,
      searchQueries,
      subject: c.subject || title,
      reason: c.reason || '',
      preferredSource: c.preferredSource || (c.imageSource === 'ai_graphic' ? 'ai_graphic' : 'unsplash'),
      layout,
      emphasis: Array.isArray(c.emphasis) ? c.emphasis : [],
      graphicElements: c.graphicElements,
      cta: c.cta || c.highlightText || '',
      style: c.style || parsed.style,
      visualStyle: c.visualStyle || c.style || parsed.globalStyle,
    };

    validCards.push(cardItem);
    validSlides.push({
      slideNumber: cardNumber,
      type: normalizeSlideType(c.type || cardRole, cardRole, cardNumber),
      title,
      subtitle,
      contentPoints,
      highlightText: cardItem.cta || '',
    });
  });

  if (validCards.length === 0) {
    return parseCardNewsFromPlainText(typeof rawResponse === 'string' ? rawResponse : JSON.stringify(rawResponse), fallbackTitle);
  }

  const finalTitle = parsed.title || fallbackTitle;

  return {
    title: finalTitle,
    slides: validSlides,
    cards: validCards,
    rawObject: parsed,
  };
}


