import { TrendKeyword } from '../types';
import { SORTED_REGIONS_BY_LENGTH } from '../config/regions';
import { normalizeBrandNames } from '../config/brandSynonyms';
import {
  evaluatePostingKeyword,
  KeywordEvaluation,
  normalizeKeywordForComparison,
} from './keywordPostingEvaluator';

export const KEYWORD_SIMILARITY_THRESHOLD = 0.5;

export interface RegionalVariantInfo {
  region: string;
  keyword: TrendKeyword;
}

export interface TrendKeywordGroup {
  representative: TrendKeyword;
  relatedKeywords: TrendKeyword[];
  totalGroupVolume: number;
  evaluation?: KeywordEvaluation;
  isRegionalGroup?: boolean;
  pattern?: string;
  region?: string | null;
  regionalVariants?: RegionalVariantInfo[];
  variantCount?: number;
}

export type ClusteredKeywordGroup = TrendKeywordGroup;

/**
 * 키워드에서 브랜드 정규화 후, 부분 문자열로 포함된 지역명을 탐색하여 분리하고 나머지를 '패턴(의도/소재)'으로 반환
 * - SORTED_REGIONS_BY_LENGTH (긴 지역명 우선 정렬)을 사용하여 가장 긴 지역명을 우선 매칭
 * - 공백 여부와 상관없이 부분 문자열(substring)로 포함되어 있으면 정확히 찾아냄 (예: "제주동쪽가볼만한곳" -> region: "제주동쪽", pattern: "가볼만한곳")
 * 예: "속초 당일치기" → { region: "속초", pattern: "당일치기" }
 * 예: "강릉 1박2일 여행코스" → { region: "강릉", pattern: "1박2일 여행코스" }
 * 예: "제주도 흑돼지 맛집" → { region: "제주도", pattern: "흑돼지 맛집" }
 * 예: "브런치카페 추천" → { region: null, pattern: "브런치카페 추천" }
 */
export function extractRegionAndPattern(keyword: string): { region: string | null; pattern: string; normalizedKeyword: string } {
  if (!keyword) return { region: null, pattern: '', normalizedKeyword: '' };

  // 1. 브랜드 동의어 정규화 (예: "엘지제습기" -> "LG제습기")
  const normalizedKeyword = normalizeBrandNames(keyword.trim());
  let foundRegion: string | null = null;
  let pattern = normalizedKeyword;

  // 2. 부분 문자열 포함 탐색 (SORTED_REGIONS_BY_LENGTH가 길이 내림차순이므로 가장 긴 지역명이 우선 매칭됨)
  for (const reg of SORTED_REGIONS_BY_LENGTH) {
    const idx = pattern.indexOf(reg);
    if (idx !== -1) {
      foundRegion = reg;
      // 키워드에서 해당 지역명 부분을 제거하고 나머지 텍스트를 pattern으로 추출
      const before = pattern.slice(0, idx);
      const after = pattern.slice(idx + reg.length);
      pattern = (before + ' ' + after).trim();
      break;
    }
  }

  // 키워드 전체가 지역명 단독인 경우 (예: "속초", "제주도"), 패턴을 지역명으로 보존
  if (!pattern && foundRegion) {
    pattern = foundRegion;
  }

  // 특수문자 및 불필요한 연속 공백 정돈
  pattern = pattern.replace(/\s+/g, ' ').trim();

  return { region: foundRegion, pattern, normalizedKeyword };
}

/**
 * 카테고리 내 전체 키워드 집합으로부터 토큰별 문서빈도(df), IDF 가중치 및 상위 40% 희소 토큰(Rare Tokens) 산출
 * - 각 토큰이 몇 개의 키워드에 등장하는지(df) 계산
 * - 토큰 가중치 = log(전체 키워드 수 / df) (흔한 수식어일수록 가중치가 낮아지고, 고유 단어일수록 가중치가 높아짐)
 * - 가중치 상위 40%에 해당하는 "희소 토큰" 집합 추출 (흔한 수식어만 겹치는 오클러스터링 방지용)
 */
export function computeTokenIdfWeightsAndRareTokens(keywords: string[]): {
  weights: Map<string, number>;
  rareTokens: Set<string>;
  tokenDf: Map<string, number>;
  totalKeywords: number;
} {
  const tokenDf = new Map<string, number>();
  const validKeywords = keywords.filter((k) => k && typeof k === 'string' && k.trim().length > 0);
  const totalKeywords = Math.max(validKeywords.length, 1);

  validKeywords.forEach((kw) => {
    const tokens = new Set(kw.trim().toLowerCase().split(/\s+/).filter(Boolean));
    tokens.forEach((t) => {
      tokenDf.set(t, (tokenDf.get(t) || 0) + 1);
    });
  });

  const weights = new Map<string, number>();
  const tokenList: Array<{ token: string; df: number; weight: number }> = [];

  tokenDf.forEach((df, token) => {
    // 토큰 가중치 = log(전체 키워드 수 / df)
    // df === totalKeywords 인 경우 log(1) = 0 이므로 최소 가중치(0.01) 보정
    const rawIdf = Math.log(totalKeywords / Math.max(df, 1));
    const weight = Math.max(0.01, Number(rawIdf.toFixed(4)));
    weights.set(token, weight);
    tokenList.push({ token, df, weight });
  });

  // 가중치 내림차순 (df 오름차순: 가장 희소한 토큰이 최상단) 정렬
  tokenList.sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight;
    return a.df - b.df;
  });

  // 희소 토큰 (Rare Tokens, 상위 40% 희소성) 추출:
  // 1) 고유 토큰 목록 기준 가중치 상위 40% 이내
  // 2) 문서빈도(df)가 전체 키워드의 40% 이하인 고유 단어
  // 3) 최빈출 수식어(df가 최상위인 단어)를 배제하고 고유성을 갖는 토큰
  const rareTokens = new Set<string>();
  if (tokenList.length > 0) {
    const top40RankCount = Math.max(1, Math.ceil(tokenList.length * 0.4));
    const maxDfThreshold = Math.max(1, Math.floor(totalKeywords * 0.4));
    const maxWeight = tokenList[0]?.weight || 1.0;

    tokenList.forEach((item, index) => {
      const isTop40Rank = index < top40RankCount;
      const isLowFrequency = item.df <= maxDfThreshold;
      const isHighWeight = item.weight >= maxWeight * 0.4;

      if (isTop40Rank || (isLowFrequency && isHighWeight)) {
        rareTokens.add(item.token);
      }
    });
  }

  return { weights, rareTokens, tokenDf, totalKeywords };
}

/**
 * 카테고리 내 전체 키워드 집합으로부터 토큰별 가중치(IDF) 맵 반환 (하위 호환)
 */
export function computeTokenIdfWeights(keywords: string[]): Map<string, number> {
  return computeTokenIdfWeightsAndRareTokens(keywords).weights;
}

/**
 * 두 키워드의 유사도 계산 (단어 희소성 반영 가중 자카드 유사도 + 상위 40% 희소 토큰 공유 안전장치)
 *
 * 1. 두 키워드의 토큰별 가중치 w(t) = log(전체 키워드 수 / df) 적용
 * 2. 추가 안전장치: 두 키워드가 가중치 상위 40% 안에 드는 "희소 토큰"을 최소 1개 이상 공유하지 않으면
 *    전체 유사도 점수와 무관하게 0을 반환 (흔한 수식어 '가볼만한곳', '8월' 등만 겹치는 경우 원천 차단)
 * 3. 유사도 = (공통 토큰들의 가중치 합) / (합집합 토큰들의 가중치 합)
 */
export function calculateTokenSimilarity(
  keywordA: string,
  keywordB: string,
  tokenWeights?: Map<string, number>,
  rareTokens?: Set<string>
): number {
  if (!keywordA || !keywordB) return 0;

  const normA = normalizeKeywordForComparison(keywordA);
  const normB = normalizeKeywordForComparison(keywordB);

  // 1. 공백/기호 제거 시 동일한 경우 완전 일치 (e.g., '맥도날드 감튀 홀더' vs '맥도날드 감튀홀더')
  if (normA === normB && normA.length > 0) {
    return 1.0;
  }

  const tokensA = new Set(keywordA.trim().toLowerCase().split(/\s+/).filter(Boolean));
  const tokensB = new Set(keywordB.trim().toLowerCase().split(/\s+/).filter(Boolean));

  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  // 2. 공통 토큰(Intersection) 추출
  const intersection: string[] = [];
  tokensA.forEach((token) => {
    if (tokensB.has(token)) {
      intersection.push(token);
    }
  });

  if (intersection.length === 0) return 0;

  // 3. [핵심 안전장치] 가중치 상위 40% 희소 토큰 공유 여부 검사
  // 흔한 수식어(예: '가볼만한곳', '8월', '추천', '베스트')만 겹치고 핵심 고유어('가평' vs '강릉')가 다르면 0점 반환
  if (rareTokens && rareTokens.size > 0) {
    const hasSharedRareToken = intersection.some((token) => rareTokens.has(token));
    if (!hasSharedRareToken) {
      return 0; // 희소 토큰을 공유하지 않으면 같은 그룹으로 묶지 않음!
    }
  }

  // 4. 가중 자카드 유사도: (공통 토큰들의 가중치 합) / (합집합 토큰들의 가중치 합)
  const union = new Set([...tokensA, ...tokensB]);
  const defaultWeight = 1.0;

  let intersectionWeight = 0;
  intersection.forEach((t) => {
    intersectionWeight += tokenWeights?.get(t) ?? defaultWeight;
  });

  let unionWeight = 0;
  union.forEach((t) => {
    unionWeight += tokenWeights?.get(t) ?? defaultWeight;
  });

  if (unionWeight <= 0) return 0;

  const weightedJaccard = intersectionWeight / unionWeight;
  return Number(weightedJaccard.toFixed(4));
}

/**
 * 키워드와 카테고리 시드 간의 연관도 점수 계산 (0 ~ 100)
 */
export function calculateSeedRelevance(keyword: string, category: string, seeds: string[]): number {
  if (!seeds || seeds.length === 0) return 0;
  const normKw = normalizeKeywordForComparison(keyword);

  let maxScore = 0;
  for (const s of seeds) {
    const normSeed = normalizeKeywordForComparison(s);
    if (normKw === normSeed) return 100;
    if (normKw.includes(normSeed) || normSeed.includes(normKw)) {
      const score = 60 + Math.min(30, Math.min(normKw.length, normSeed.length) * 2);
      if (score > maxScore) maxScore = score;
    }
  }

  // 토큰 레벨 일치도
  const kwTokens = new Set(keyword.toLowerCase().split(/\s+/).filter(Boolean));
  for (const s of seeds) {
    const seedTokens = new Set(s.toLowerCase().split(/\s+/).filter(Boolean));
    let common = 0;
    kwTokens.forEach((t) => {
      if (seedTokens.has(t)) common++;
    });
    if (common > 0) {
      const tokenScore = 30 + common * 10;
      if (tokenScore > maxScore) maxScore = tokenScore;
    }
  }

  return maxScore;
}

/**
 * 카테고리 간 중복 키워드 정리:
 * 전체 카테고리 수집이 끝난 뒤, 동일한 키워드 텍스트가 2개 이상 카테고리에 동시에 존재하면:
 * 1. 그 키워드가 어느 시드 패턴에서 나왔는지(원본 시드 연관도) 기준으로 가장 관련도 높은 카테고리 하나에만 남김
 * 2. 판단이 애매한 경우(동점/유사 점수)에는 총검색량이 더 높게 집계되는 카테고리에 배정하고 나머지에서는 제거
 */
export function deduplicateKeywordsAcrossCategories<T extends TrendKeyword>(
  keywords: T[],
  seedMap: Record<string, string[]> = {}
): T[] {
  if (!keywords || keywords.length === 0) return [];

  const normMap = new Map<string, T[]>();

  keywords.forEach((item) => {
    const norm = normalizeKeywordForComparison(item.keyword);
    if (!norm) return;
    if (!normMap.has(norm)) {
      normMap.set(norm, []);
    }
    normMap.get(norm)!.push(item);
  });

  const result: T[] = [];

  normMap.forEach((candidates) => {
    if (candidates.length === 1) {
      result.push(candidates[0]);
      return;
    }

    // 2개 이상의 카테고리에 중복 출현한 경우
    let bestCandidate = candidates[0];
    let bestScore = -1;
    let bestSeedRelevance = -1;

    for (const cand of candidates) {
      const seeds = seedMap[cand.category] || [];
      const seedRel = calculateSeedRelevance(cand.keyword, cand.category, seeds);
      const vol =
        cand.totalSearchVolume ??
        (Number(cand.pcSearchVolume) || 0) + (Number(cand.mobileSearchVolume) || 0);
      const qScore = cand.finalScore || 0;

      // 시드 연관도가 확연히 높으면 해당 카테고리 우선 (차이 >= 20)
      if (seedRel > bestSeedRelevance + 20) {
        bestCandidate = cand;
        bestSeedRelevance = seedRel;
        bestScore = vol;
      } else if (Math.abs(seedRel - bestSeedRelevance) <= 20) {
        // 판단이 애매한 경우: 총검색량이 더 높은 카테고리에 배정
        if (vol > bestScore) {
          bestCandidate = cand;
          bestScore = vol;
          bestSeedRelevance = Math.max(bestSeedRelevance, seedRel);
        } else if (vol === bestScore && qScore > (bestCandidate.finalScore || 0)) {
          bestCandidate = cand;
        }
      }
    }

    result.push(bestCandidate);
  });

  return result;
}

/**
 * 키워드 클러스터링 및 포스팅 활용형 키워드 대표어 선출
 *
 * [핵심 기능]
 * 1. 지역 변형 뭉치기: 동일한 패턴을 가진 지역 키워드들(예: "속초 당일치기", "강릉 당일치기", "부산 당일치기")을
 *    하나의 그룹으로 묶고, 총검색량이 가장 높은 키워드를 대표어로 선출하며 나머지는 "지역 변형"으로 묶음.
 * 2. 비지역 키워드: 문서빈도(df) 기반 IDF 가중치 토큰 유사도로 묶음.
 * 3. 각 키워드의 '포스팅 소재 적합성(blogTopicScore)', '구체성(specificityScore)', 3단계 분류 주입.
 */
export function groupKeywordsByCore(
  keywords: TrendKeyword[],
  similarityThreshold: number = KEYWORD_SIMILARITY_THRESHOLD
): TrendKeywordGroup[] {
  if (!keywords || keywords.length === 0) {
    return [];
  }

  // 1. 모든 키워드에 대해 포스팅 활용도 및 정밀 점수 평가 주입
  const evaluatedKeywords: TrendKeyword[] = keywords.map((k) => {
    const totalVol = k.totalSearchVolume ?? (Number(k.pcSearchVolume) || 0) + (Number(k.mobileSearchVolume) || 0);
    const evalResult = evaluatePostingKeyword(k.keyword, k.category, {
      documentCount: k.documentCount,
      searchVolume: totalVol,
    });

    return {
      ...k,
      totalSearchVolume: totalVol,
      isPostingUsable: evalResult.isPostingUsable,
      postingUsabilityScore: evalResult.usabilityScore,
      searchIntentCategory: evalResult.intentCategory,
      searchIntentDescription: evalResult.intentDescription,
      keywordCombinationType: evalResult.combinationType,
      suggestedTitleHint: evalResult.postingTitleHint,
      timingTag: evalResult.timingTag,
      timingTagLabel: evalResult.timingTagLabel,
      recommendReason: evalResult.recommendReason,
      contentStyle: evalResult.contentStyle,
      suggestedTitles: evalResult.suggestedTitles,
      suggestedOutlines: evalResult.suggestedOutlines,
      specificityScore: evalResult.specificityScore,
      blogTopicScore: evalResult.blogTopicScore,
      recentBlogActivity: evalResult.recentBlogActivity,
      seasonalityScore: evalResult.seasonalityScore,
      genericPenalty: evalResult.genericPenalty,
      classification: evalResult.classification,
      classificationLabel: evalResult.classificationLabel,
      excludedReason: evalResult.excludedReason,
    };
  });

  // 2. 카테고리/후보 키워드 전체 집합으로부터 토큰별 df, IDF 가중치, 상위 40% 희소 토큰 계산
  const allKeywordStrings = evaluatedKeywords.map((k) => k.keyword);
  const { weights: tokenWeights, rareTokens } = computeTokenIdfWeightsAndRareTokens(allKeywordStrings);

  // 3. 지역 및 패턴 정보 추출 (브랜드 정규화 -> 지역 추출 -> 패턴 정규화)
  interface ExtractedItem {
    keywordItem: TrendKeyword;
    normalizedKeyword: string;
    region: string | null;
    pattern: string;
    normalizedPattern: string;
  }

  const extractedList: ExtractedItem[] = evaluatedKeywords.map((k) => {
    const { region, pattern, normalizedKeyword } = extractRegionAndPattern(k.keyword);
    const normalizedPattern = normalizeKeywordForComparison(pattern);
    return {
      keywordItem: k,
      normalizedKeyword,
      region,
      pattern,
      normalizedPattern,
    };
  });

  // 대표어 선별용 정렬 비교 함수
  const compareRepresentativePriority = (a: ExtractedItem, b: ExtractedItem): number => {
    const kA = a.keywordItem;
    const kB = b.keywordItem;

    const classRank = (c?: string) => (c === 'immediate_post' ? 3 : c === 'expandable_topic' ? 2 : 1);
    const rankA = classRank(kA.classification);
    const rankB = classRank(kB.classification);
    if (rankB !== rankA) return rankB - rankA;

    const effScoreA = (kA.specificityScore || 0) + (kA.blogTopicScore || 0) - (kA.genericPenalty || 0);
    const effScoreB = (kB.specificityScore || 0) + (kB.blogTopicScore || 0) - (kB.genericPenalty || 0);
    if (Math.abs(effScoreB - effScoreA) >= 15) {
      return effScoreB - effScoreA;
    }

    const volA = kA.totalSearchVolume ?? (kA.pcSearchVolume || 0) + (kA.mobileSearchVolume || 0);
    const volB = kB.totalSearchVolume ?? (kB.pcSearchVolume || 0) + (kB.mobileSearchVolume || 0);
    return volB - volA;
  };

  interface InternalGroup {
    all: ExtractedItem[];
    representative: TrendKeyword;
    isRegionalGroup?: boolean;
    isPatternGroup?: boolean;
  }

  const stage1Groups: InternalGroup[] = [];
  const processedIndices = new Set<number>();

  // [1단계]: 지역을 제거한 "패턴"이 완전히 동일한 키워드끼리 먼저 묶기
  // (예: "가볼만한곳" 패턴을 가진 모든 지역 변형 "속초 가볼만한곳", "강릉 가볼만한곳", "가평 가볼만한곳" 등을 하나의 패턴 그룹으로)
  const patternBuckets = new Map<string, number[]>();
  extractedList.forEach((item, idx) => {
    if (item.region && item.normalizedPattern && item.normalizedPattern.length >= 2) {
      if (!patternBuckets.has(item.normalizedPattern)) {
        patternBuckets.set(item.normalizedPattern, []);
      }
      patternBuckets.get(item.normalizedPattern)!.push(idx);
    }
  });

  patternBuckets.forEach((indices, normPat) => {
    // 2개 이상의 서로 다른 키워드가 동일한 패턴을 공유하는 경우 1단계 패턴 그룹으로 통합
    if (indices.length >= 2) {
      const groupItems = indices.map((i) => extractedList[i]);
      indices.forEach((i) => processedIndices.add(i));

      groupItems.sort(compareRepresentativePriority);

      stage1Groups.push({
        all: groupItems,
        representative: groupItems[0].keywordItem,
        isRegionalGroup: true,
        isPatternGroup: true,
      });
    }
  });

  // [2단계]: 1단계로 묶이지 않은 나머지 키워드들에 대한 클러스터링
  // - 같은 지역 내에서는 가중 자카드 유사도로 진짜 비슷한 표현끼리 합침 ("제주도 동쪽 코스" vs "제주도 동쪽 여행 코스" 합침, "제주도 서쪽 코스"와는 유사도 낮아 분리)
  // - 비지역 키워드들도 가중 자카드 유사도 + 희소 토큰 안전장치로 유사 표현 묶음
  const remainingItems: ExtractedItem[] = [];
  extractedList.forEach((item, idx) => {
    if (!processedIndices.has(idx)) {
      remainingItems.push(item);
    }
  });

  remainingItems.sort(compareRepresentativePriority);

  const stage2Groups: InternalGroup[] = [];

  for (const cur of remainingItems) {
    const kw = cur.keywordItem;
    let bestGroup: InternalGroup | null = null;
    let maxSim = -1;

    for (const group of stage2Groups) {
      const repItem = group.all[0];

      // 1. 공백 및 브랜드 정규화 후 완전 일치 시 최우선 그룹 편입
      const normKw = normalizeKeywordForComparison(cur.normalizedKeyword);
      const normRep = normalizeKeywordForComparison(repItem.normalizedKeyword);
      if (normKw === normRep && normKw.length > 0) {
        bestGroup = group;
        maxSim = 1.0;
        break;
      }

      // 2. 지역 키워드 간의 비교 규칙:
      // 둘 다 지역을 가진 경우, 서로 다른 지역이면 묶지 않음 (예: "제주도 동쪽 코스" vs "부산 서면 카페")
      if (cur.region && repItem.region && cur.region !== repItem.region) {
        continue;
      }

      // 한쪽만 지역이 있고 다른 쪽은 지역이 없는 경우 묶지 않음 (지역 고유성 보호)
      if ((cur.region && !repItem.region) || (!cur.region && repItem.region)) {
        continue;
      }

      // 3. 같은 지역 내의 키워드 또는 둘 다 비지역인 키워드:
      // 단어 희소성 가중치 및 상위 40% 희소 토큰 안전장치 기반 가중 자카드 유사도 검사
      const sim = calculateTokenSimilarity(
        cur.normalizedKeyword,
        repItem.normalizedKeyword,
        tokenWeights,
        rareTokens
      );

      if (sim >= similarityThreshold && sim > maxSim) {
        maxSim = sim;
        bestGroup = group;
      }
    }

    if (bestGroup) {
      bestGroup.all.push(cur);
      bestGroup.all.sort(compareRepresentativePriority);
      bestGroup.representative = bestGroup.all[0].keywordItem;
      if (cur.region || bestGroup.all[0].region) {
        bestGroup.isRegionalGroup = true;
      }
    } else {
      stage2Groups.push({
        all: [cur],
        representative: kw,
        isRegionalGroup: !!cur.region,
      });
    }
  }

  // 6. 1단계와 2단계 그룹 결합 및 최종 TrendKeywordGroup 생성
  const combinedGroups = [...stage1Groups, ...stage2Groups];

  // 그룹 대표어의 검색량/품질 기준으로 전체 그룹 정렬
  combinedGroups.sort((a, b) => compareRepresentativePriority(a.all[0], b.all[0]));

  const finalGroups: TrendKeywordGroup[] = [];

  combinedGroups.forEach((tg) => {
    const totalGroupVolume = tg.all.reduce(
      (sum, item) =>
        sum +
        (item.keywordItem.totalSearchVolume ??
          (item.keywordItem.pcSearchVolume || 0) + (item.keywordItem.mobileSearchVolume || 0)),
      0
    );
    const relatedKeywords = tg.all
      .filter((item) => item.keywordItem !== tg.representative)
      .map((item) => item.keywordItem);

    const repExtracted = tg.all.find((item) => item.keywordItem === tg.representative) || tg.all[0];

    const evalData = evaluatePostingKeyword(tg.representative.keyword, tg.representative.category, {
      documentCount: tg.representative.documentCount,
      searchVolume: totalGroupVolume,
    });

    const regionalVariants: RegionalVariantInfo[] = tg.all
      .filter((item) => item.region)
      .map((item) => ({
        region: item.region || '기타',
        keyword: item.keywordItem,
      }));

    const isRegionalGroup = tg.isRegionalGroup || regionalVariants.length > 0;

    finalGroups.push({
      representative: {
        ...tg.representative,
        isPostingUsable: evalData.isPostingUsable,
        postingUsabilityScore: evalData.usabilityScore,
        specificityScore: evalData.specificityScore,
        blogTopicScore: evalData.blogTopicScore,
        recentBlogActivity: evalData.recentBlogActivity,
        seasonalityScore: evalData.seasonalityScore,
        genericPenalty: evalData.genericPenalty,
        classification: evalData.classification,
        classificationLabel: evalData.classificationLabel,
        excludedReason: evalData.excludedReason,
      },
      relatedKeywords,
      totalGroupVolume,
      evaluation: evalData,
      isRegionalGroup,
      pattern: repExtracted.pattern,
      region: repExtracted.region,
      regionalVariants: isRegionalGroup ? regionalVariants : undefined,
      variantCount: tg.all.length,
    });
  });

  return finalGroups;
}
