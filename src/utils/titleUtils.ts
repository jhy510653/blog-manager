import { TitleCandidate, OutlineSection } from '../types';

/**
 * Clean, sanitize and normalize blog post titles & headings
 */
export function cleanAndNormalizeTitle(title: string): string {
  if (!title || typeof title !== 'string') return '';
  
  let cleaned = title.trim();
  // Strip leading numbering e.g. "1. ", "후보 1: ", "[1] ", "제목 1: "
  cleaned = cleaned.replace(/^(?:후보\s*\d+[:.\s-]*|제목\s*\d+[:.\s-]*|\d+[:.\s-]*|\[\d+\]\s*)/i, '');
  // Strip surrounding quotes & brackets
  cleaned = cleaned.replace(/^["'“”‘’`]+|["'“”‘’`]+$/g, '');
  // Strip trailing punctuation like '?' or '!' if present in H2 headings (excluding legitimate emojis/symbols)
  cleaned = cleaned.replace(/\s*([?!~]+)$/, '');
  // Normalize internal whitespaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}

/**
 * Key for fuzzy deduplication comparison (ignores punctuation, casing, spacing)
 */
function getFuzzyKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s가-힣]/g, '')
    .replace(/\s+/g, '');
}

const DEFAULT_COMBINATION_TYPES = [
  '코스/일정/방법 조합',
  '시기/조건/비교 조합',
  '실제 체감/후기 조합',
  '핵심 해결/준비물 조합',
  '비용/꿀팁/기준 조합',
];

export interface TitleValidationOptions {
  hasUserExperience?: boolean;
  hasRankingData?: boolean;
  isRecommendationKeyword?: boolean;
}

/**
 * Checks whether a generated title violates the core anti-slop rules
 */
export function isInvalidTitlePattern(title: string, options?: TitleValidationOptions): boolean {
  if (!title || title.length < 5) return true;

  // 1. AI cliches and conversational junk
  const aiClicheRegex = /(?:알아보겠습니다|살펴볼까요|이것만\s*알면\s*됩니다|당신이\s*몰랐던|생각보다\s*.*했던\s*이유|~의\s*모든\s*것)/i;
  if (aiClicheRegex.test(title)) return true;

  // 2. Unfounded BEST / TOP / Ranking assertions if no ranking data
  if (options?.hasRankingData === false) {
    if (/(?:BEST\s*\d*|TOP\s*\d*|\b1위\b|추천\s*순위)/i.test(title)) {
      return true;
    }
  }

  // 3. Unfounded direct experience claims if no user experience given
  if (options?.hasUserExperience === false) {
    if (/(?:솔직\s*후기|직접\s*다녀온|실제\s*경험|내돈내산)/i.test(title)) {
      return true;
    }
  }

  // 4. Generic SEO boilerplate tail templates that repeat across different keywords
  const genericBoilerplateRegex = /(?:핵심\s*정보\s*및\s*세부\s*확인\s*사항|주요\s*특징\s*및\s*상황별\s*비교|주요\s*특징과\s*상황별\s*선택\s*기준|필수\s*확인\s*사항과\s*실전\s*노하우|꼭\s*알아야\s*할\s*실전\s*노하우|핵심\s*내용\s*및\s*세부\s*안내|상황별\s*비교\s*및\s*실전\s*팁|완벽\s*가이드.*총정리|핵심\s*체크리스트\s*총정리|삶의\s*질\s*올려주는.*꿀템|실패\s*없는\s*인기\s*상품|A부터\s*Z까지)/i;
  if (genericBoilerplateRegex.test(title)) return true;

  // 5. Recommendation keywords with inappropriate mechanical info templates
  // e.g. "국내가을여행지추천 완벽 가이드 및 핵심 체크리스트 총정리"
  if (options?.isRecommendationKeyword) {
    if (/완벽\s*가이드|체크리스트\s*총정리|솔직\s*후기\s*&\s*주의사항/i.test(title)) {
      return true;
    }
  }

  return false;
}

/**
 * Deduplicates title candidates strictly, keeping 2 to 5 unique, valid items.
 * Does NOT force duplicate or padded items if only 2 or 3 distinct candidates exist.
 */
export function deduplicateTitleCandidates(rawCandidates: any, options?: TitleValidationOptions): TitleCandidate[] {
  if (!rawCandidates) return [];

  let candidateList: any[] = [];

  if (Array.isArray(rawCandidates)) {
    candidateList = rawCandidates;
  } else if (typeof rawCandidates === 'object') {
    // Check if it's a grouped object (e.g. { click: [], information: [], review: [], comparison: [] })
    const keys = Object.keys(rawCandidates);
    for (const k of keys) {
      const val = rawCandidates[k];
      if (Array.isArray(val)) {
        val.forEach((item) => {
          if (typeof item === 'string') {
            candidateList.push({ title: item, combinationType: k });
          } else if (item && typeof item === 'object') {
            candidateList.push(item);
          }
        });
      } else if (typeof val === 'string') {
        candidateList.push({ title: val, combinationType: k });
      }
    }
  }

  if (candidateList.length === 0) {
    return [];
  }

  const seenFuzzy = new Set<string>();
  const results: TitleCandidate[] = [];

  for (let i = 0; i < candidateList.length; i++) {
    const raw = candidateList[i];
    let titleStr = '';
    let comboType = '';
    let keywords: string[] | undefined = undefined;

    if (typeof raw === 'string') {
      titleStr = cleanAndNormalizeTitle(raw);
    } else if (raw && typeof raw === 'object') {
      titleStr = cleanAndNormalizeTitle(raw.title || raw.name || raw.h1 || '');
      comboType = raw.combinationType || raw.type || raw.category || '';
      if (Array.isArray(raw.keywordsUsed)) {
        keywords = raw.keywordsUsed;
      }
    }

    if (!titleStr) continue;

    // Filter obvious bad patterns if options provided
    if (options && isInvalidTitlePattern(titleStr, options)) {
      continue;
    }

    const fuzzy = getFuzzyKey(titleStr);
    if (!fuzzy || seenFuzzy.has(fuzzy)) {
      continue;
    }

    seenFuzzy.add(fuzzy);

    const typeToUse = comboType || DEFAULT_COMBINATION_TYPES[results.length % DEFAULT_COMBINATION_TYPES.length];

    results.push({
      title: titleStr,
      combinationType: typeToUse,
      keywordsUsed: keywords,
    });

    if (results.length >= 5) {
      break;
    }
  }

  return results;
}

/**
 * Normalizes raw outline list into structured OutlineSection array (H2 sections)
 */
export function normalizeOutlineSections(raw: any[]): OutlineSection[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];

  const results: OutlineSection[] = [];
  const seenHeadings = new Set<string>();

  raw.forEach((item, idx) => {
    let heading = '';
    let coreContent = '';
    let keyKeywords: string[] = [];
    const id = (typeof item === 'object' && item.id) ? String(item.id) : `h2_${idx + 1}`;

    if (typeof item === 'string') {
      heading = cleanAndNormalizeTitle(item);
    } else if (item && typeof item === 'object') {
      heading = cleanAndNormalizeTitle(item.heading || item.title || item.name || '');
      coreContent = (item.coreContent || item.description || item.summary || '').trim();
      if (Array.isArray(item.keyKeywords)) {
        keyKeywords = item.keyKeywords.map((k: any) => String(k).trim()).filter(Boolean);
      } else if (Array.isArray(item.keywords)) {
        keyKeywords = item.keywords.map((k: any) => String(k).trim()).filter(Boolean);
      }
    }

    if (!heading) return;

    const fuzzy = getFuzzyKey(heading);
    if (seenHeadings.has(fuzzy)) return;
    seenHeadings.add(fuzzy);

    results.push({
      id,
      heading,
      coreContent: coreContent || undefined,
      keyKeywords: keyKeywords.length > 0 ? keyKeywords : undefined,
    });
  });

  return results;
}
