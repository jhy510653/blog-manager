import { AiContentAnalysisResult, SeoWritingStyleKey } from '../types';
import { extractAndParseJson } from './jsonUtils';

export const STYLE_KEY_TO_LABEL: Record<string, string> = {
  experience: '경험 리뷰형',
  info: '정보 탐색형',
  purchase: '구매 추천형',
  comparison: '비교 분석형',
  homepan: '홈판 화제형',
  travel: '경험 리뷰형',
  review: '경험 리뷰형',
  story: '홈판 화제형',
};

export const EXPERIENCE_TYPE_LABELS: Record<string, string> = {
  restaurant: '맛집',
  cafe: '카페/디저트',
  travel: '여행/코스',
  accommodation: '숙소/호텔',
  product: '제품/상품',
  exhibition: '전시/문화',
  service: '서비스/매장',
  education: '교육/강의',
  app: '앱/소프트웨어',
  space: '공간/인테리어',
  activity: '체험/액티비티',
  general: '일반 경험',
  mixed: '복합 경험',
};

/**
 * Fast, zero-lag heuristic classification for instant UI adaptation before/while Gemini responds.
 */
export function classifyKeywordInstant(keyword: string): AiContentAnalysisResult {
  const kw = (keyword || '').trim().toLowerCase();
  if (!kw) {
    return {
      searchIntent: 'informational',
      searchIntentSummary: '주제 관련 유용한 정보 탐색',
      contentType: 'informational_guide',
      contentTypeSummary: '정보 탐색 가이드',
      conversionGoal: 'information',
      writingStyle: 'info',
      writingStyleLabel: '정보 탐색형',
      experienceType: 'general',
      experienceTypeLabel: '일반',
      targetAudience: '해당 정보를 찾는 대중 독자',
      recommendedStructure: '개념 정의 ➔ 핵심 절차 ➔ 주의사항 ➔ 요약 및 FAQ',
      reason: '기본 정보성 키워드',
    };
  }

  // 1. Comparison Analysis (비교 분석형)
  const isComparison =
    /\bvs\b| vs |대결|비교|차이점|차이|스펙 비교|장단점 비교|어떤게|뭐가 더|어느게|비교분석/.test(kw);
  if (isComparison) {
    return {
      searchIntent: 'comparison',
      searchIntentSummary: '대상 간 스펙, 성능, 가격, 실사용 장단점 비교 검토',
      contentType: 'comparison_analysis',
      contentTypeSummary: '1:1 비교 분석 가이드',
      conversionGoal: 'purchase_consideration',
      writingStyle: 'comparison',
      writingStyleLabel: '비교 분석형',
      targetAudience: '두 개 이상의 선택지 사이에서 고민 중인 실구매/이용 예정자',
      recommendedStructure: '비교 배경 ➔ 핵심 스펙/특징 대조표 ➔ 실사용 체감 차이 ➔ 용도별 선택 가이드 ➔ 최종 총평',
      reason: '키워드 내 비교(VS) 및 차이점 분석 의도 감지',
    };
  }

  // 2. Purchase Recommendation (구매 추천형)
  const isPurchase =
    /추천|가성비|순위|\btop\b|베스트|선물 추천|구매 가이드|고르는 법|고르는법|인기순|가격대별|선물용|쇼핑/.test(kw) &&
    !/맛집|카페|식당|여행|코스/.test(kw);
  if (isPurchase) {
    return {
      searchIntent: 'commercial',
      searchIntentSummary: '가격대비 만족도 높은 추천 모델 및 구매 기준 탐색',
      contentType: 'purchase_recommendation',
      contentTypeSummary: '타깃 맞춤 구매 추천 가이드',
      conversionGoal: 'click_conversion',
      writingStyle: 'purchase',
      writingStyleLabel: '구매 추천형',
      targetAudience: '합리적인 소비를 위해 검증된 제품/서비스를 찾는 구매자',
      recommendedStructure: '추천 대상 선정 이유 ➔ 핵심 선택 기준 ➔ Best 모델 상세 분석 ➔ 가격/혜택 체크 ➔ 최종 구매 팁',
      reason: '키워드 내 추천/가성비/구매 의도 감지',
    };
  }

  // 3. Information & Guide (정보 탐색형 - draft_info)
  // ~하는 법, ~방법, ~절차, ~규정, ~조건, ~신청, ~준비물, ~기준, ~비용, ~기간, ~여는 법, ~확인 방법, ~예약 방법, ~사용 방법, ~반입 가능 여부, ~가능한가 등
  const isInfo =
    /하는 법|하는법|방법|절차|규정|조건|자격|신청|신청방법|준비물|필수서류|서류|기준|비용|가격|요금|수수료|기간|일정|여는 법|여는법|확인 방법|확인방법|확인법|예약 방법|예약방법|예약법|사용 방법|사용방법|사용법|반입 가능 여부|반입 가능|반입여부|가능한가|가능할까|뜻|의미|정의|계산법|조회|발급|등록|해지|변경|가이드|총정리|알아보기|과태료|지원금|환급|법령/.test(kw);
  if (isInfo) {
    return {
      searchIntent: 'informational',
      searchIntentSummary: '절차, 규정, 조건, 비용, 실행 방법 등 실용 정보 탐색',
      contentType: 'informational_guide',
      contentTypeSummary: '핵심 정보 및 실전 해결 가이드',
      conversionGoal: 'trust_building',
      writingStyle: 'info',
      writingStyleLabel: '정보 탐색형',
      targetAudience: '정확한 사실 확인과 실질적인 문제 해결이 필요한 검색자',
      recommendedStructure: '핵심 요약 ➔ 신청 자격/조건 ➔ 단계별 실행 절차 ➔ 주의사항 및 제출서류 ➔ 자주 묻는 질문(FAQ)',
      reason: '키워드 내 절차/규정/방법/기준 등 정보 탐색 의도 감지 (draft_info 우선)',
    };
  }

  // 4. Trend & Storytelling (홈판 화제형)
  const isHomepan =
    /썰|이야기|사연|후기 썰|인생|경험담|느낀점|후회|결말|비하인드|꿀팁 썰|일상|회고|도전기|후기담/.test(kw);
  if (isHomepan) {
    return {
      searchIntent: 'informational_commercial',
      searchIntentSummary: '생생한 개인 경험담 및 공감 스토리 탐색',
      contentType: 'trend_story',
      contentTypeSummary: '트렌드 & 공감 에피소드',
      conversionGoal: 'engagement',
      writingStyle: 'homepan',
      writingStyleLabel: '홈판 화제형',
      targetAudience: '흥미로운 실제 경험과 솔직한 이야기를 통해 인사이트를 얻고자 하는 독자',
      recommendedStructure: '호기심 유발 도입 ➔ 실제 발생한 사건/상황 전개 ➔ 극적인 반전 및 해결 ➔ 느낀 점과 배운 교훈',
      reason: '키워드 내 스토리텔링 및 공감 에피소드 의도 감지',
    };
  }

  // 5. Experience Review (경험 리뷰형) - sub-types
  let expType: string = 'general';
  let expLabel: string = '일반 경험';
  let contentTypeSummary = '솔직 경험 리뷰';
  let searchIntentSummary = '방문/이용 전 실제 사용자 솔직 후기 및 만족도 확인';

  if (/맛집|식당|고기집|횟집|오마카세|브런치|술집|포차|뷔페|먹방|배달맛집|포장|메뉴/.test(kw)) {
    expType = 'restaurant';
    expLabel = '맛집';
    contentTypeSummary = '맛집 솔직 방문 후기';
    searchIntentSummary = '방문 전 분위기, 주문 메뉴, 맛, 웨이팅 정보 탐색';
  } else if (/카페|디저트|베이커리|빵집|원두|로스터리/.test(kw)) {
    expType = 'cafe';
    expLabel = '카페/디저트';
    contentTypeSummary = '카페 & 디저트 감성 후기';
    searchIntentSummary = '매장 감성, 시그니처 음료/디저트, 좌석 및 주차 확인';
  } else if (/호텔|숙소|펜션|리조트|글램핑|풀빌라|게스트하우스|에어비앤비|모텔/.test(kw)) {
    expType = 'accommodation';
    expLabel = '숙소/호텔';
    contentTypeSummary = '숙소 & 호캉스 솔직 후기';
    searchIntentSummary = '객실 룸 컨디션, 부대시설, 조식, 뷰 및 가성비 확인';
  } else if (/여행|코스|명소|가볼만한곳|투어|드라이브|일정|1박2일|2박3일|3박4일|비행기|렌트카/.test(kw)) {
    expType = 'travel';
    expLabel = '여행/코스';
    contentTypeSummary = '여행 일정 & 명소 후기';
    searchIntentSummary = '실제 여행 동선, 추천 명소, 예산 및 준비 팁 탐색';
  } else if (/전시회|미술관|박물관|팝업|팝업스토어|공연|뮤지컬|페스티벌|테마파크/.test(kw)) {
    expType = 'exhibition';
    expLabel = '전시/문화';
    contentTypeSummary = '전시 & 문화행사 체험 후기';
    searchIntentSummary = '관람 포인트, 포토존, 사전 예약 및 주차 꿀팁 확인';
  } else if (/사용기|실사용|솔직후기|언박싱|내돈내산|개봉기|착용기|한달사용|1년사용|청소기|드라이기|이어폰|노트북|스마트폰|아이폰|갤럭시|워치|화장품|영양제/.test(kw)) {
    expType = 'product';
    expLabel = '제품/상품';
    contentTypeSummary = '제품 실사용 솔직 후기';
    searchIntentSummary = '실사용 체감 장단점, 내구성 및 실구매 만족도 확인';
  } else if (/강의|수강|클래스|원데이클래스|학원|교육|자격증후기/.test(kw)) {
    expType = 'education';
    expLabel = '교육/강의';
    contentTypeSummary = '강의 및 클래스 수강 후기';
    searchIntentSummary = '커리큘럼 퀄리티, 강사 전달력, 실무 적용성 확인';
  } else if (/앱|어플|프로그램|소프트웨어|플랫폼|서비스/.test(kw)) {
    expType = 'app';
    expLabel = '앱/서비스';
    contentTypeSummary = '서비스 및 앱 이용 후기';
    searchIntentSummary = '실제 편의성, 주요 기능 활용법, 유무료 차이 확인';
  }

  return {
    searchIntent: 'informational_commercial',
    searchIntentSummary,
    contentType: 'experience_review',
    contentTypeSummary,
    conversionGoal: 'trust_building',
    writingStyle: 'experience',
    writingStyleLabel: '경험 리뷰형',
    experienceType: expType as any,
    experienceTypeLabel: expLabel,
    targetAudience: '실제 경험자의 신뢰도 높은 후기를 바탕으로 의사결정을 하려는 방문자',
    recommendedStructure: '방문/이용 계기 ➔ 첫인상 및 환경 ➔ 핵심 경험/체험 과정 ➔ 솔직 장단점 ➔ 꿀팁 및 추천 대상',
    reason: `직접 경험(${expLabel}) 기반의 솔직 체감 공유에 최적화된 키워드`,
  };
}

/**
 * Call server AI analysis endpoint for deep semantic classification.
 */
export async function analyzeKeywordWithAi(
  keyword: string,
  userAuthMeta?: { id?: string; email?: string; name?: string; isAdmin?: boolean }
): Promise<AiContentAnalysisResult> {
  const cleanKw = (keyword || '').trim();
  if (!cleanKw) {
    return classifyKeywordInstant('');
  }

  try {
    const res = await fetch('/api/gemini/toolkit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'analyze_intent',
        promptInput: cleanKw,
        userId: userAuthMeta?.id,
        userEmail: userAuthMeta?.email,
        userName: userAuthMeta?.name,
        isAdmin: userAuthMeta?.isAdmin,
        isChallengeParticipant: true,
      }),
    });

    if (res.ok) {
      let data: any = null;
      try {
        data = await res.json();
      } catch (_) {
        try {
          const txt = await res.text();
          data = extractAndParseJson(txt);
        } catch (_) {}
      }

      let raw = data?.result || data;
      if (typeof raw === 'string') {
        raw = extractAndParseJson(raw) || raw;
      }

      if (raw && typeof raw === 'object' && (raw.writingStyle || raw.searchIntent)) {
        // Normalize writingStyle to valid SeoWritingStyleKey
        let style = (raw.writingStyle || '').toString().toLowerCase().trim();
        if (style.includes('경험') || style.includes('리뷰') || style.includes('travel') || style.includes('review')) {
          style = 'experience';
        } else if (style.includes('정보') || style.includes('탐색') || style.includes('info')) {
          style = 'info';
        } else if (style.includes('구매') || style.includes('추천') || style.includes('purchase')) {
          style = 'purchase';
        } else if (style.includes('비교') || style.includes('분석') || style.includes('comparison')) {
          style = 'comparison';
        } else if (style.includes('홈판') || style.includes('화제') || style.includes('스토리') || style.includes('story') || style.includes('homepan')) {
          style = 'homepan';
        }

        const validStyle = ['experience', 'info', 'purchase', 'comparison', 'homepan'].includes(style)
          ? (style as any)
          : 'experience';

        return {
          searchIntent: raw.searchIntent || 'informational',
          searchIntentSummary: raw.searchIntentSummary || '검색 의도 분석 완료',
          contentType: raw.contentType || 'experience_review',
          contentTypeSummary: raw.contentTypeSummary || '맞춤 콘텐츠',
          conversionGoal: raw.conversionGoal || 'trust_building',
          writingStyle: validStyle,
          writingStyleLabel: STYLE_KEY_TO_LABEL[validStyle] || '경험 리뷰형',
          experienceType: raw.experienceType || 'general',
          experienceTypeLabel: EXPERIENCE_TYPE_LABELS[raw.experienceType] || '일반 경험',
          targetAudience: raw.targetAudience || '관련 주제를 찾는 네이버 검색 독자',
          recommendedStructure: raw.recommendedStructure || '도입 ➔ 본문 핵심 ➔ 솔직 체감 ➔ 요약 및 결론',
          reason: raw.reason || 'AI 검색 의도 분석 결과',
        };
      }
    }
  } catch (err) {
    console.warn('[AI Content Analyzer] Server call failed, using heuristic classification:', err);
  }

  // Fallback to instant heuristic
  return classifyKeywordInstant(cleanKw);
}
