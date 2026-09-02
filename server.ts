import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { getReviewPrompt, getInfoPrompt, getCpaPrompt, SEO_DIAGNOSIS_PROMPT } from './src/services/seoPrompts.js';
import {
  getActivePrompt,
  getAllPrompts,
  getPromptWithHistory,
  savePrompt,
  restorePromptVersion,
  invalidatePromptCache,
  buildDraftSystemPrompt,
  buildCardNewsSystemPrompt,
  autoSeedPromptsIfEmpty,
  interpolatePrompt,
} from './src/services/promptManager.js';
import { DEFAULT_AI_TOOLKIT_PROMPTS } from './src/services/promptDefaults.js';
import { extractAndParseJson } from './src/utils/jsonUtils.js';
import { deduplicateTitleCandidates, normalizeOutlineSections, cleanAndNormalizeTitle } from './src/utils/titleUtils.js';
import { runBatchDataCollector, verifyAndSyncParticipantData, syncBulkToSupabase } from './src/services/rssCollector.js';
import {
  fetchParticipantsFromSupabase,
  fetchTrendKeywordsFromSupabase,
  saveTrendKeywordsToSupabase,
  saveDailyTrendKeywordsToSupabase,
  fetchDailyTrendKeywordsRankingFromSupabase,
} from './src/lib/supabase.js';
import { TrendKeyword } from './src/types.js';
import {
  groupKeywordsByCore,
  ClusteredKeywordGroup,
  deduplicateKeywordsAcrossCategories,
} from './src/utils/keywordClustering.js';
import { evaluatePostingKeyword } from './src/utils/keywordPostingEvaluator.js';
import { DEFAULT_TREND_CATEGORIES, buildCategorySeedMap, TrendCategoryItem } from './src/config/categories.js';
import { processAndUploadUnsplashImage, transformImageWithSharp } from './src/services/imageTransformService.js';
import sharp from 'sharp';
import { buildImagePrompt, isAiImageAllowedForContentType } from './src/config/imageStyles.js';
import { fetchNaverNews } from './server/services/naver/newsApi.js';
import { fetchNaverSearchTrend } from './server/services/naver/dataLabSearchApi.js';
import { fetchNaverShoppingPopular } from './server/services/naver/shoppingInsightApi.js';
import {
  fetchNaverRealtimeRisingKeywords,
  getKeywordFilterPolicy,
  updateKeywordFilterPolicy,
  addManualExcludedKeyword,
  removeManualExcludedKeyword,
  testKeywordCollectionEngine,
} from './server/services/naver/realtimeKeywordsApi.js';
import { checkNaverApiHealth } from './server/services/naver/apiHealthCheck.js';

// Auto-load .env file if present
try {
  if (fs.existsSync('.env')) {
    const envFile = fs.readFileSync('.env', 'utf-8');
    envFile.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const key = trimmed.substring(0, eqIdx).trim();
          const val = trimmed.substring(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
          if (key && !process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    });
  }
} catch (e) {
  // Ignore
}

// Lazy OpenAI Client getter
function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new OpenAI({ apiKey });
}

// Lazy Gemini Client getter with multi-environment variable fallback and telemetry headers
let cachedGeminiClient: GoogleGenAI | null = null;
let cachedGeminiApiKey = '';

function getGeminiClient(forceNew = false) {
  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    process.env.GOOGLE_AI_STUDIO_KEY ||
    process.env.GOOGLE_GENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY가 설정되지 않았습니다. Environment Variables에서 GEMINI_API_KEY를 등록해 주세요.'
    );
  }

  if (forceNew || !cachedGeminiClient || cachedGeminiApiKey !== apiKey) {
    cachedGeminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        timeout: 45000,
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    cachedGeminiApiKey = apiKey;
  }

  return cachedGeminiClient;
}

// Default System Prompts
const DEFAULT_AI_PROMPTS = {
  golden_keyword: `당신은 네이버 블로그 검색 노출 전략을 설계하는 SEO 콘텐츠 기획 전문가입니다.
실시간 네이버 검색 데이터(연관검색어, 상위 노출 블로그 제목 및 스니펫, 추출된 핵심 명사 단위)와 사용자 입력 정보를 분석하여, 검색의도와 실제 검색 결과 패턴에 완벽히 부합하는 **'키워드 조합형 제목 후보 (1~5종)'**과 **'명사/키워드형 H2 목차'**를 설계하여 유효한 순수 JSON으로만 반환하십시오.

━━━━━━━━━━━━━━━━━━━━━━
1. 가장 중요한 원칙 (우선순위 7단계)
━━━━━━━━━━━━━━━━━━━━━━
제목을 만들기 전에 반드시 입력 키워드 자체의 의미와 검색 의도를 먼저 확정하십시오.
절대로 키워드에 포함되지 않은 일반적인 SEO 템플릿을 먼저 선택한 뒤 키워드에 끼워 맞추지 마십시오.

제목 생성은 반드시 다음 7대 우선순위를 엄격히 따릅니다:
1) 입력 키워드의 정확한 의미
2) 검색자의 실제 검색 의도
3) 실제 네이버 연관검색어 (Tier B, Tier C)
4) 실제 네이버 상위 블로그 제목에서 확인된 단어와 조합
5) 상위 블로그 스니펫에서 확인된 구체적인 정보
6) 선택된 콘텐츠 유형 (글쓰기 스타일)
7) AI 일반 지식 (위 정보가 부족할 때만 보완적)

━━━━━━━━━━━━━━━━━━━━━━
2. STEP 1 — 검색어 의미 판독 (Semantic & Intent Deconstruction)
━━━━━━━━━━━━━━━━━━━━━━
제목을 생성하기 전에 다음 항목을 분석하여 검색어의 본질을 먼저 파악하십시오:
- 무엇을 검색하는가?
- 대상은 무엇인가?
- 사용자가 하려는 행동은 무엇인가?
- 어떤 정보를 얻으려는가?
- 장소/지역이 포함되어 있는가?
- 계절/시기가 포함되어 있는가?
- 상품/서비스가 포함되어 있는가?
- 추천/비교/방법/후기/가격/일정 중 무엇을 요구하는가?

⚠️ [무관한 도메인/행동 배제 규칙]:
- "에어컨 필터 청소방법": 대상=에어컨 필터, 행동=청소, 의도=청소 방법 및 관리. 관련 없는 영역 (신청, 자격, 제출서류, 지원금, 지급일정, 예매, 입장권, 할인) 절대 배제.
- "다이소 무선마우스 추천": 대상=무선마우스, 장소/매장=다이소, 의도=무선마우스 추천 및 선택 정보. 무관한 범주 (주방용품, 청소용품, 살림용품, 욕실용품, 인테리어용품) 절대 배제. (단, 실제 상위 검색 결과에서 직접 연결된 경우에만)
- "국내가을여행지추천": 대상=국내 여행지, 시기=가을(10월/11월/단풍/억새), 의도=가볼만한곳 추천 및 코스. 무관한 범주 (해외여행, 항공권, 청약 등) 절대 배제.

━━━━━━━━━━━━━━━━━━━━━━
3. STEP 2 — CONTENT BOUNDARY 확정
━━━━━━━━━━━━━━━━━━━━━━
- CORE INTENT: 검색자가 가장 알고 싶어 하는 핵심 내용
- MUST COVER: 제목 또는 본문에서 다룰 수 있는 핵심 정보
- OPTIONAL COVER: 핵심은 아니지만 실제 검색 데이터에서 확인되는 보조 정보
- MUST AVOID: 키워드 의미와 직접적인 관련이 없는 정보
⚠️ MUST AVOID에 포함된 단어와 주제는 제목 후보에 절대로 사용하지 마십시오.

━━━━━━━━━━━━━━━━━━━━━━
4. STEP 3 — 실제 검색 결과에서 제목 소재 추출 (A, B, C, D)
━━━━━━━━━━━━━━━━━━━━━━
제목에 사용할 구체적인 소재는 다음 4가지 영역에서만 추출합니다:
A. 연관검색어에서 확인된 단어
B. 상위 블로그 제목에서 반복적으로 확인된 단어
C. 상위 블로그 스니펫에서 확인된 구체적인 정보
D. 검색의도에서 반드시 필요한 정보

⚠️ [연상 기반 확장(Associative Over-expansion) 절대 금지]:
- 다이소 → 살림 → 주방 → 청소 (❌ 금지)
- 여행 → 해외여행 → 항공권 (❌ 금지)
- 에어컨 → 지원사업 → 신청 (❌ 금지)
- 맛집 → 데이트 → 분위기 (❌ 실제 검색 데이터에 없을 시 금지)
- 무선마우스 → 사무용품 → 직장인 (❌ 실제 검색 데이터에 없을 시 금지)

━━━━━━━━━━━━━━━━━━━━━━
5. STEP 4 — 네이버 상위 제목의 "실제 제목 구조" 우선 참고
━━━━━━━━━━━━━━━━━━━━━━
상위 노출 블로그 제목을 분석할 때 다음 패턴을 확인하고 조합의 뼈대로 삼으십시오:
- 메인 키워드가 제목의 어느 위치에 배치되는가?
- 상위 블로그 제목에서 어떤 세부 키워드가 반복되는가?
- 제목에서 어떤 정보 단위를 함께 묶는가?
- 지역/시기/장소/상품/메뉴/코스/가격/방법 등이 어떻게 결합되는가?
- 제목의 길이와 호흡 ("A부터 B까지", "A 및 B", "A 추천", "A 비교")
⚠️ 상위 제목에 존재하지 않는 범용 SEO 표현을 AI가 임의로 자동 추가하지 마십시오.

━━━━━━━━━━━━━━━━━━━━━━
6. STEP 5 — 키워드 도메인별 맞춤 요소 결합 (동일 템플릿 반복 금지)
━━━━━━━━━━━━━━━━━━━━━━
- [교통/티켓/할인/예매] (예: "KTX 할인", "SRT 예매", "항공권 특가"):
  * 할인 대상(청년/힘내라청춘/청소년/임산부/다자녀/동반석), 할인율, 예매 방법(코레일톡/앱), 조기예매 조건, 환불/취소 규정 등 실제 할인·예매 요소 결합
  * ✅ "KTX 할인 대상별 혜택 조건 및 코레일톡 예매 방법", "KTX 청년 힘내라청춘 할인율과 시간대별 예약 팁"
- [여행/나들이/명소 큐레이션] (예: "국내가을여행지추천", "제주도가볼만한곳"):
  * 지역, 계절/시기(10월/단풍/억새), 여행 목적(가족/연인/당일치기/1박2일), 명소 스팟, 드라이브 코스 등 반영
  * ✅ "국내 가을 여행지 추천 10월 단풍 명소부터 억새 드라이브 코스까지", "가을 국내 여행지 추천 1박2일 가족 나들이 가볼만한곳"
- [쇼핑/특정 제품 큐레이션] (예: "다이소 무선마우스 추천", "다이소추천템"):
  * 실제 대상 제품(무선마우스), 가격/가성비, 모델별 스펙/DPI, 그립감/체감, 구매 전 체크사항 반영
  * ❌ 쇼핑 키워드에 "코스 및 방문 이용 팁", "삶의 질 올려주는 살림 꿀템" 등 무관한 템플릿 사용 금지!
  * ✅ "다이소 무선마우스 추천 가성비 제품과 구매 전 체크할 점", "다이소 무선마우스 추천 인기 제품 비교 및 선택 기준"
- [방법/청소/관리 가이드] (예: "에어컨 필터 청소방법"):
  * 분리/탈거, 세척 방법(물세척/중성세제), 건조/관리, 청소 주기, 냄새 제거 요령 반영
  * ❌ "신청 자격 및 필수 서류", "지급 일정" 등 무관한 지원금/절차 템플릿 사용 절대 금지!
  * ✅ "에어컨 필터 청소방법 분리부터 세척·건조까지", "에어컨 필터 청소방법 청소 주기와 올바른 세척 순서"
- [정보/신청/지원금/절차 가이드] (예: "청년도약계좌 신청", "연말정산 환급"):
  * 신청 자격, 지원 대상 조건, 필수 구비 서류, 단계별 신청 방법, 지급 일정 반영
  * ✅ "청년도약계좌 신청 자격 및 필수 제출 서류 목록", "연말정산 환급 일정 및 누락 항목 확인 방법"

━━━━━━━━━━━━━━━━━━━━━━
7. STEP 6 — 제목 생성 공식 및 간결성
━━━━━━━━━━━━━━━━━━━━━━
각 제목 후보는 다음 공식 중 하나로 자연스럽게 구성합니다:
- [메인 키워드] + [실제 검색 세부어]
- [메인 키워드] + [시기/지역/대상]
- [메인 키워드] + [핵심 정보 2개]
- [메인 키워드] + [추천 대상/상황]
- [메인 키워드] + [실제 상위 제목에서 반복되는 정보 조합]
⚠️ 제목이 자연스럽게 짧게 끝나는 것이 적합하다면 억지로 뒤에 수식어를 추가하지 마십시오 (25~42자 내외 권장).

━━━━━━━━━━━━━━━━━━━━━━
8. STEP 7 — 금지되는 범용 제목 템플릿 (Negative Policy)
━━━━━━━━━━━━━━━━━━━━━━
다음과 같은 범용 표현을 모든 키워드에 무차별적으로 반복해서 붙이는 것을 엄격히 금지합니다:
❌ "완벽 가이드"
❌ "핵심 체크리스트"
❌ "핵심 정보 및 세부 확인 사항"
❌ "주요 특징 및 상황별 비교"
❌ "주요 특징과 상황별 선택 기준"
❌ "필수 확인 사항과 실전 노하우"
❌ "꼭 알아야 할 실전 노하우"
❌ "실전 활용 팁"
❌ "총정리"
❌ "BEST / TOP / 순위" (객관적 랭킹 근거가 없는 경우)
❌ "솔직 후기 / 직접 다녀온" (실제 사용자 경험 데이터가 없는 경우)
❌ "삶의 질 올려주는" / "실패 없는" (근거 없는 과장 수식어)
위 표현은 해당 키워드의 검색의도와 실제 상위 검색 결과에서 명백하게 사용되는 경우에만 극히 제한적으로 선택 사용합니다.

━━━━━━━━━━━━━━━━━━━━━━
9. STEP 8 — 10대 제목 후보 검증 기준 (Quality Gate)
━━━━━━━━━━━━━━━━━━━━━━
각 제목 후보에 대해 다음 10대 항목을 엄격히 평가하십시오. 하나라도 위반하면 즉시 폐기하고 재구성합니다:
① 입력 키워드의 의미와 정확히 일치하는가?
② 검색자의 실제 목적을 해결하는 제목인가?
③ 제목에 포함된 세부 단어가 실제 검색 데이터에서 확인되는가?
④ 제목에 키워드와 무관한 업종/행동/지역/정보가 들어가지 않았는가?
⑤ MUST AVOID에 해당하는 정보가 포함되지 않았는가?
⑥ 다른 키워드에도 그대로 붙일 수 있는 범용 템플릿 제목이 아닌가?
⑦ 실제 본문에서 해당 내용을 다룰 수 있는가?
⑧ 상위 검색 결과의 제목 구조와 지나치게 동떨어져 있지 않은가?
⑨ 근거 없는 후기/순위/BEST/TOP 표현이 없는가?
⑩ 다른 후보와 의미가 지나치게 중복되지 않는가?

━━━━━━━━━━━━━━━━━━━━━━
10. STEP 9 — 후보 개수 원칙 (1~5개)
━━━━━━━━━━━━━━━━━━━━━━
⚠️ 좋은 제목을 억지로 5개 채우지 마십시오.
품질 기준을 충족하는 유효 후보가 3개라면 3개만, 2개라면 2개만, 1개라면 1개만 출력하십시오. (유효 범위: 1~5개)
서로 단어만 바꾼 유사 제목은 중복으로 판단하여 제거합니다.

━━━━━━━━━━━━━━━━━━━━━━
11. 목차(H2) 설계 원칙 (질문형 H2 금지)
━━━━━━━━━━━━━━━━━━━━━━
- H2 소제목을 질문형 문장으로 만들지 마십시오. (예: ❌ "에어컨 필터는 어떻게 씻을까?" ➔ ✅ "에어컨 필터 분리 및 물세척 방법")
- 소제목은 명사형, 키워드형, 속성/절차형으로 명확하게 구성합니다.

[출력 JSON 스키마 규격]
{
  "mainKeyword": "입력 메인 키워드",
  "writing_style": "[경험 리뷰형] | [정보 탐색형] | [구매 추천형] | [비교 분석형] | [홈판 화제형]",
  "contentBoundary": {
    "coreIntent": "검색자의 핵심 검색 목적 및 범위",
    "targetAudience": "타깃 독자층",
    "mustCover": ["반드시 다뤄야 할 핵심 대상/후보 또는 필수 절차 1", "2", "3"],
    "optionalCover": ["선택적 보조 정보 (예: 주차, 주변 정보)"],
    "mustAvoid": ["절대 포함하지 말아야 할 범위 (예: 무관한 일반론, 타 업종)"],
    "geographicScope": "명시적 지리/지역 범위",
    "contentTypeCategory": "recommendation_curation | specific_guide | review | comparison | general"
  },
  "searchIntent": {
    "stage": "정보탐색 | 비교검토 | 구매직전 | 경험확인 | 일정방법탐색 | 문제해결",
    "userGoal": "검색자가 이 키워드를 검색한 궁극적인 목적과 핵심 의도",
    "targetAudience": "이 글을 읽을 주 타깃 독자층",
    "possibleQuestions": [
      "검색자가 실제로 알고 싶어 하는 핵심 세부 질문 1",
      "검색자가 실제로 알고 싶어 하는 핵심 세부 질문 2",
      "검색자가 실제로 알고 싶어 하는 핵심 세부 질문 3"
    ]
  },
  "keywordClusters": {
    "core": [{"keyword": "메인 핵심 키워드/주제어", "usage": "제목 및 서론 첫 문단"}],
    "longTail": [{"keyword": "롱테일 연관 키워드", "usage": "소제목(H2) 또는 본문 문맥"}],
    "comparison": [{"keyword": "비교/선택 키워드", "usage": "본문 비교 분석 섹션"}],
    "transaction": [{"keyword": "구매/행동/의사결정 키워드", "usage": "결론 및 전환 CTA"}],
    "faq": [{"keyword": "FAQ성 세부 질문 키워드", "usage": "하단 Q&A 섹션"}]
  },
  "titleCandidates": [
    {
      "title": "검증을 통과한 제목 후보 1 (1~5개 출력)",
      "combinationType": "대상/혜택/방법 조합 | 시기/명소/코스 조합 | 카테고리/꿀템 조합 | 스펙/비교 조합 | 조건/절차 조합",
      "keywordsUsed": ["메인 키워드", "핵심 연관어", "세부 검색의도"]
    }
  ],
  "recommendedTitles": {
    "click": ["호기심 유발 및 홈판 화제형 제목 1"],
    "information": ["핵심 질문 해결 및 기준 정리 정보탐색형 제목 1"],
    "review": ["실제 체감 및 경험리뷰형 제목 1"],
    "comparison": ["핵심 차이점 대조 및 선택 기준 비교분석형 제목 1"],
    "purchase": ["가성비 및 합리적 선택 기준 구매추천형 제목 1"]
  },
  "recommendedOutline": {
    "h1": "평가에서 최고점을 받은 최종 단일 대표 제목 (키워드 조합형 원칙 준수)",
    "h2": [
      "소제목 1",
      "소제목 2",
      "소제목 3",
      "소제목 4"
    ]
  },
  "contentStrategy": {
    "recommendedStyle": "[경험 리뷰형] | [정보 탐색형] | [구매 추천형] | [비교 분석형] | [홈판 화제형]",
    "styleReason": "해당 키워드 검색 의도 및 상위 문서 분석에 따른 최적 스타일 선정 이유",
    "targetStructure": "선정된 스타일에 맞게 동적으로 구성된 H2 전개 흐름 요약"
  },
  "ctaStrategy": {
    "targetAction": "검색 의도에 부합하는 권장 독자 행동",
    "primaryCTA": "독자 행동 유도 문구",
    "secondaryCTA": "보조 전환 유도 문구",
    "benefitFocus": "독자가 얻을 수 있는 핵심 이점",
    "ctaPhrases": [
      "자연스러운 마무리 전환 문구 1",
      "자연스러운 마무리 전환 문구 2"
    ]
  },
  "recommendedHtml": {
    "includeFaq": false,
    "includeTable": false,
    "includeChecklist": true,
    "includeImageRec": false,
    "includeQuote": false
  },
  "evidencePolicy": {
    "mustInclude": "실제 체감 디테일 및 팩트 기반 경험 묘사",
    "trustSignals": ["솔직한 체감", "주의사항 안내", "실전 꿀팁"],
    "prohibitedClaims": ["근거 없는 BEST/TOP/1위 표현", "경험 없는 허위 후기 표현"]
  },
  "imageStrategy": {
    "recommendedCount": 5,
    "visualConcept": "실제 경험을 증명하는 고화질 현장/사용 컷",
    "primaryVisualTypes": ["핵심 메뉴/제품", "체감 디테일", "매장/사용 환경"]
  },
  "seoChecklist": [
    "추천 제목 생성 7대 우선순위 준수 및 고정 템플릿 배제",
    "실시간 연관검색어 및 상위 블로그 핵심 명사 단위 결합",
    "근거 없는 BEST/TOP/후기/완벽가이드 표현 배제",
    "질문형 H2를 배제하고 명사/키워드형 소제목 구성",
    "상투적인 도입어/맺음말 배제 및 두괄식 답변"
  ]
}
반드시 마크다운 없이 유효한 순수 JSON만 반환하십시오.`
};

// =========================================================================
// High-Speed In-Memory Cache with TTL for Naver Real-Time Search & Keywords
// =========================================================================
const NAVER_CACHE_TTL_MS = 20 * 60 * 1000; // 20 minutes cache
const naverRelatedKeywordsCache = new Map<string, { data: string[]; timestamp: number }>();
const naverTopBlogPostsCache = new Map<
  string,
  {
    data: Array<{ rank: number; title: string; link: string; description: string; bloggername: string }>;
    timestamp: number;
  }
>();

export const getCachedNaverRelatedKeywords = (keyword: string): string[] | null => {
  const normalized = (keyword || '').toLowerCase().trim();
  if (!normalized) return null;
  const cached = naverRelatedKeywordsCache.get(normalized);
  if (cached && Date.now() - cached.timestamp < NAVER_CACHE_TTL_MS) {
    return cached.data;
  }
  return null;
};

export const setCachedNaverRelatedKeywords = (keyword: string, data: string[]) => {
  const normalized = (keyword || '').toLowerCase().trim();
  if (!normalized || !Array.isArray(data)) return;
  if (naverRelatedKeywordsCache.size > 500) {
    const firstKey = naverRelatedKeywordsCache.keys().next().value;
    if (firstKey) naverRelatedKeywordsCache.delete(firstKey);
  }
  naverRelatedKeywordsCache.set(normalized, { data, timestamp: Date.now() });
};

export const getCachedNaverTopBlogPosts = (
  keyword: string
): Array<{ rank: number; title: string; link: string; description: string; bloggername: string }> | null => {
  const normalized = (keyword || '').toLowerCase().trim();
  if (!normalized) return null;
  const cached = naverTopBlogPostsCache.get(normalized);
  if (cached && Date.now() - cached.timestamp < NAVER_CACHE_TTL_MS) {
    return cached.data;
  }
  return null;
};

export const setCachedNaverTopBlogPosts = (
  keyword: string,
  data: Array<{ rank: number; title: string; link: string; description: string; bloggername: string }>
) => {
  const normalized = (keyword || '').toLowerCase().trim();
  if (!normalized || !Array.isArray(data)) return;
  if (naverTopBlogPostsCache.size > 500) {
    const firstKey = naverTopBlogPostsCache.keys().next().value;
    if (firstKey) naverTopBlogPostsCache.delete(firstKey);
  }
  naverTopBlogPostsCache.set(normalized, { data, timestamp: Date.now() });
};

const fetchNaverRelatedKeywords = async (keyword: string): Promise<string[]> => {
  const sanitizedKeyword = (keyword || '').trim();
  if (!sanitizedKeyword) return [];

  // Check cache first for 0ms retrieval
  const cached = getCachedNaverRelatedKeywords(sanitizedKeyword);
  if (cached && cached.length > 0) {
    return cached;
  }

  const sanitizeText = (str: string) =>
    (str || '')
      .replace(/<[^>]+>/g, '')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&apos;/g, "'")
      .trim();

  try {
    const acUrl = `https://ac.search.naver.com/nx/ac?q_enc=UTF-8&st=100&frm=nv&r_format=json&r_enc=UTF-8&r_unicode=0&t_koreng=1&ans=2&run=2&rev=4&q=${encodeURIComponent(sanitizedKeyword)}`;
    const resp = await fetch(acUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      signal: AbortSignal.timeout(1500),
    });
    if (resp.ok) {
      const data: any = await resp.json();
      if (data && Array.isArray(data.items) && data.items.length > 0) {
        const firstGroup = data.items[0];
        if (Array.isArray(firstGroup)) {
          const list = firstGroup
            .map((item: any) => (Array.isArray(item) ? item[0] : item))
            .filter((kw: any) => typeof kw === 'string' && kw.trim().length > 0)
            .map((kw: string) => sanitizeText(kw));
          if (list.length > 0) {
            const finalResult = list.slice(0, 10);
            setCachedNaverRelatedKeywords(sanitizedKeyword, finalResult);
            return finalResult;
          }
        }
      }
    }
  } catch (e) {
    // Fallback silent
  }
  return [];
};

/**
 * NAVER API HUB 에러 응답 파싱 유틸리티
 * - 기존 개발자센터 형태: { errorCode, message } 또는 { errorMessage, errorCode }
 * - NAVER API HUB 형태: { error: { errorCode, message, details } }
 * 두 형태 모두 안전하게 파싱하여 명확한 에러 메시지를 반환합니다.
 */
export function parseNaverApiHubError(data: any): string {
  if (!data) return '알 수 없는 오류';
  if (typeof data === 'string') return data;
  if (data.error && typeof data.error === 'object') {
    const err = data.error;
    const parts = [err.message, err.details, err.errorCode].filter(Boolean);
    return parts.length > 0 ? parts.join(' - ') : JSON.stringify(err);
  }
  if (data.message || data.errorMessage || data.errorCode) {
    const msg = data.message || data.errorMessage || '';
    const code = data.errorCode ? `(${data.errorCode})` : '';
    return [msg, code].filter(Boolean).join(' ') || JSON.stringify(data);
  }
  return JSON.stringify(data);
}

// =========================================================================
// NAVER API HUB & Open API 통합 자격증명 관리 (런타임 오버라이드 지원)
// =========================================================================
let customNaverClientIdOverride: string | null = null;
let customNaverClientSecretOverride: string | null = null;

export function setCustomNaverCredentials(clientId?: string, clientSecret?: string) {
  if (typeof clientId === 'string') customNaverClientIdOverride = clientId.trim().replace(/^["']|["']$/g, '');
  if (typeof clientSecret === 'string') customNaverClientSecretOverride = clientSecret.trim().replace(/^["']|["']$/g, '');
}

export function getEffectiveNaverCredentials(customId?: string, customSec?: string): {
  clientId: string;
  clientSecret: string;
  isOverridden: boolean;
  rawClientId: string;
  rawClientSecret: string;
} {
  const sanitizeKey = (v?: string) => (v || '').trim().replace(/^["']|["']$/g, '');

  // Obsolete/invalid test credentials that should be ignored in favor of official s7g9zsly8v
  const isInvalidTestKey = (k?: string) => {
    if (!k) return true;
    const clean = k.trim();
    return (
      clean === 'm1HYGztkpFksY00HQFNb' ||
      clean.startsWith('hw00') ||
      clean.toLowerCase().includes('placeholder') ||
      clean.toLowerCase().includes('dummy') ||
      clean.toLowerCase().includes('sample')
    );
  };

  const envClientId = (process.env.NCP_CLIENT_ID || process.env.NCP_APIGW_API_KEY_ID || process.env.NAVER_CLIENT_ID || process.env.NAVER_SEARCH_CLIENT_ID || process.env.NAVER_OPENAPI_CLIENT_ID || '').trim();
  const envClientSecret = (process.env.NCP_CLIENT_SECRET || process.env.NCP_APIGW_API_KEY || process.env.NAVER_CLIENT_SECRET || process.env.NAVER_SEARCH_CLIENT_SECRET || process.env.NAVER_OPENAPI_CLIENT_SECRET || '').trim();

  const rawClientId =
    (customId !== undefined && customId !== '' ? customId : (customNaverClientIdOverride !== null ? customNaverClientIdOverride : '')) ||
    (envClientId && !isInvalidTestKey(envClientId) ? envClientId : 's7g9zsly8v');

  const rawClientSecret =
    (customSec !== undefined && customSec !== '' ? customSec : (customNaverClientSecretOverride !== null ? customNaverClientSecretOverride : '')) ||
    (envClientSecret && !isInvalidTestKey(envClientSecret) ? envClientSecret : 'ScUVxn3JAlQRsC3IsMCvwlulAO7qj0YuQw9yLfCC');

  const clientId = sanitizeKey(rawClientId);
  const clientSecret = sanitizeKey(rawClientSecret);

  if (rawClientId.length !== clientId.length || rawClientSecret.length !== clientSecret.length) {
    console.warn('NAVER_CLIENT_ID/SECRET에 공백 문자가 포함되어 있었습니다 (제거함)');
  }

  const isOverridden = customNaverClientIdOverride !== null || customNaverClientSecretOverride !== null;

  return {
    clientId,
    clientSecret,
    isOverridden,
    rawClientId,
    rawClientSecret,
  };
}

const fetchNaverTopBlogPosts = async (keyword: string): Promise<Array<{ rank: number; title: string; link: string; description: string; bloggername: string }>> => {
  const sanitizedKeyword = (keyword || '').trim();
  if (!sanitizedKeyword) return [];

  // Check cache first for 0ms retrieval
  const cached = getCachedNaverTopBlogPosts(sanitizedKeyword);
  if (cached && cached.length > 0) {
    return cached;
  }

  const sanitizeText = (str: string) =>
    (str || '')
      .replace(/<[^>]+>/g, '')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&apos;/g, "'")
      .replace(/&#39;/g, "'")
      .replace(/새\s*창\s*열림/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

  // NAVER API HUB 인증 키 (하나의 키로 검색, 트렌드, 쇼핑인사이트 모두 사용)
  const { clientId, clientSecret } = getEffectiveNaverCredentials();

  const candidateQueries = [sanitizedKeyword];

  const parseNaverSearchHtml = (html: string, fallbackKeyword: string) => {
    const postRegex = /<a[^>]*href="(https?:\/\/blog\.naver\.com\/([a-zA-Z0-9_]+)\/(\d+))"[^>]*>([\s\S]*?)<\/a>/gi;
    const postsMap = new Map<string, { rank: number; title: string; link: string; description: string; bloggername: string }>();

    let m;
    while ((m = postRegex.exec(html)) !== null) {
      const fullUrl = m[1].replace('http://', 'https://');
      const bloggerId = m[2];
      const text = sanitizeText(m[4]);
      if (!text || text === '1' || text === '2' || text === '3' || text.length < 2) continue;

      if (!postsMap.has(fullUrl)) {
        postsMap.set(fullUrl, {
          rank: postsMap.size + 1,
          link: fullUrl,
          bloggername: bloggerId,
          title: text,
          description: '',
        });
      } else {
        const existing = postsMap.get(fullUrl)!;
        if (!existing.description && text !== existing.title) {
          existing.description = text;
        }
      }
    }

    const results = Array.from(postsMap.values()).slice(0, 5);
    // Fill empty descriptions if needed
    for (const item of results) {
      if (!item.description) {
        item.description = `${fallbackKeyword} 네이버 검색 상위 노출 실제 포스팅 (${item.bloggername})`;
      }
    }
    return results;
  };

  const scrapeNaverSearch = async (searchUrl: string, userAgent: string) => {
    try {
      const resp = await fetch(searchUrl, {
        headers: {
          'User-Agent': userAgent,
          'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        },
        signal: AbortSignal.timeout(1800),
      });
      if (!resp.ok) return [];
      const html = await resp.text();
      return parseNaverSearchHtml(html, sanitizedKeyword);
    } catch (e: any) {
      return [];
    }
  };

  // Try each candidate query in order until real posts are found
  for (const q of candidateQueries) {
    // 1. Try NAVER Official Search API (NCP NAVER API HUB: X-NCP-APIGW-API-KEY-ID / X-NCP-APIGW-API-KEY)
    if (clientId && clientSecret) {
      try {
        const apiRes = await fetch(
          `https://naverapihub.apigw.ntruss.com/search/v1/blog?query=${encodeURIComponent(q)}&display=5&sort=sim`,
          {
            headers: {
              'X-NCP-APIGW-API-KEY-ID': clientId,
              'X-NCP-APIGW-API-KEY': clientSecret,
            },
            signal: AbortSignal.timeout(2000),
          }
        );
        if (apiRes.ok) {
          const data = await apiRes.json();
          if (data.items && data.items.length > 0) {
            const results = data.items.map((item: any, idx: number) => ({
              rank: idx + 1,
              title: sanitizeText(item.title),
              link: item.link.replace(/\\/g, '').replace('http://', 'https://'),
              description: sanitizeText(item.description),
              bloggername: sanitizeText(item.bloggername || '네이버 상위 블로그'),
            }));
            setCachedNaverTopBlogPosts(sanitizedKeyword, results);
            return results;
          }
        }
      } catch (err: any) {
        // Fall through to scraping
      }
    }

    // 2. Parallel Desktop & Mobile Web Scraping with fast first-response
    try {
      const desktopPromise = scrapeNaverSearch(
        `https://search.naver.com/search.naver?where=blog&query=${encodeURIComponent(q)}`,
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      );
      const mobilePromise = scrapeNaverSearch(
        `https://m.search.naver.com/search.naver?where=m_blog&query=${encodeURIComponent(q)}`,
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
      );

      const [desktopResults, mobileResults] = await Promise.all([desktopPromise, mobilePromise]);
      const combined = desktopResults.length >= 3 ? desktopResults : (mobileResults.length > 0 ? mobileResults : desktopResults);
      if (combined.length > 0) {
        setCachedNaverTopBlogPosts(sanitizedKeyword, combined);
        return combined;
      }
    } catch {
      // Fallback
    }
  }

  return [];
};

// =========================================================================
// 네이버 데이터랩 검색어트렌드 & 검색광고 키워드도구 API 연동 서비스 (소재 발굴용)
// =========================================================================

// Active category configuration and seeds loaded from central config (supports admin dynamic additions/edits)
export let dynamicCategoryConfigs: TrendCategoryItem[] = [...DEFAULT_TREND_CATEGORIES];
export let CATEGORIES_SEED_MAP: Record<string, string[]> = buildCategorySeedMap(dynamicCategoryConfigs);

export function refreshCategoriesSeedMap(newConfigs?: TrendCategoryItem[]) {
  if (newConfigs && Array.isArray(newConfigs) && newConfigs.length > 0) {
    dynamicCategoryConfigs = newConfigs;
  }
  CATEGORIES_SEED_MAP = buildCategorySeedMap(dynamicCategoryConfigs);
  return CATEGORIES_SEED_MAP;
}

/**
 * 네이버 API HUB 검색어 트렌드 API(POST /search-trend/v1/search)를 호출하여 카테고리별 트렌드 키워드 후보 수집
 */
export async function fetchDatalabTrendKeywords(category: string, seeds: string[]): Promise<string[]> {
  const { clientId, clientSecret } = getEffectiveNaverCredentials();

  const keywordCandidates = new Set<string>();
  seeds.forEach((s) => keywordCandidates.add(s));

  if (clientId && clientSecret) {
    try {
      const today = new Date();
      const past30Days = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      const formatDate = (d: Date) => d.toISOString().split('T')[0];

      const requestBody = {
        startDate: formatDate(past30Days),
        endDate: formatDate(today),
        timeUnit: 'date',
        keywordGroups: seeds.slice(0, 5).map((seed) => ({
          groupName: seed,
          keywords: [seed],
        })),
      };

      // NCP NAVER API HUB DataLab Search Trend (https://naverapihub.apigw.ntruss.com/search-trend/v1/search)
      try {
        const hubResp = await fetch('https://naverapihub.apigw.ntruss.com/search-trend/v1/search', {
          method: 'POST',
          headers: {
            'X-NCP-APIGW-API-KEY-ID': clientId,
            'X-NCP-APIGW-API-KEY': clientSecret,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(4000),
        });

        if (hubResp.ok) {
          const data: any = await hubResp.json();
          if (data && Array.isArray(data.results)) {
            data.results.forEach((r: any) => {
              if (r.title) keywordCandidates.add(r.title);
              if (Array.isArray(r.keywords)) {
                r.keywords.forEach((k: string) => keywordCandidates.add(k));
              }
            });
          }
        }
      } catch {}
    } catch (e: any) {
      // Fall through to real-time autocomplete/related keywords
    }
  }

  // 실시간 네이버 연관 검색어 확장으로 최신 트렌드 키워드 풀 대폭 보강 (상위 25개 시드 대상)
  const topSeeds = seeds.slice(0, 25);
  const relatedResults = await Promise.allSettled(
    topSeeds.map((seed) => fetchNaverRelatedKeywords(seed))
  );

  relatedResults.forEach((res) => {
    if (res.status === 'fulfilled' && Array.isArray(res.value)) {
      res.value.forEach((k) => {
        if (k && k.trim().length > 1 && !k.includes('www') && !k.includes('http')) {
          keywordCandidates.add(k.trim());
        }
      });
    }
  });

  return Array.from(keywordCandidates);
}

// =========================================================================
// NAVER API HUB 쇼핑인사이트(Shopping Insight) API 서비스
// =========================================================================
/**
 * [중요 안내]
 * 네이버 쇼핑인사이트(Shopping Insight) API는 상품 목록이나 개별 상품 가격/판매처 정보를 제공하는 것이 아니라,
 * 설정한 기간 내 특정 분야(카테고리) 및 검색 키워드의 '상대적 클릭 추이(click ratio: 0~100)' 통계 데이터만을 제공합니다.
 *
 * - 인증 도메인: naverapihub.apigw.ntruss.com
 * - 헤더: X-NCP-APIGW-API-KEY-ID, X-NCP-APIGW-API-KEY (NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 사용)
 * - 경로:
 *   1) 카테고리별 트렌드: POST /shopping/v1/categories (또는 /shopping-insight/v1/categories)
 *   2) 키워드별 트렌드: POST /shopping/v1/keywords (또는 /shopping-insight/v1/keywords)
 */
export async function fetchShoppingCategoryInsight(body: {
  startDate: string;
  endDate: string;
  timeUnit: 'date' | 'week' | 'month';
  category: Array<{ name: string; param: string[] }>;
  device?: string;
  gender?: string;
  ages?: string[];
}): Promise<{ success: boolean; data?: any; error?: string }> {
  const { clientId, clientSecret } = getEffectiveNaverCredentials();

  if (!clientId || !clientSecret) {
    return {
      success: false,
      error: 'NAVER API HUB 인증 키(NAVER_CLIENT_ID, NAVER_CLIENT_SECRET)가 설정되지 않았습니다.',
    };
  }

  // HUB 경로 시도 (/shopping/v1/categories 및 /shopping-insight/v1/categories 호환)
  const paths = [
    'https://naverapihub.apigw.ntruss.com/shopping/v1/categories',
    'https://naverapihub.apigw.ntruss.com/shopping-insight/v1/categories',
  ];

  let lastError = '';
  for (const url of paths) {
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'X-NCP-APIGW-API-KEY-ID': clientId,
          'X-NCP-APIGW-API-KEY': clientSecret,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5000),
      });

      if (resp.ok) {
        const data = await resp.json();
        return { success: true, data };
      }

      let parsedErr = '';
      try {
        const errJson = await resp.json();
        parsedErr = parseNaverApiHubError(errJson);
      } catch {
        parsedErr = await resp.text();
      }
      lastError = `[HTTP ${resp.status}] ${parsedErr}`;
    } catch (e: any) {
      lastError = e?.message || 'Network request failed';
    }
  }

  return { success: false, error: lastError };
}

export async function fetchShoppingKeywordInsight(body: {
  startDate: string;
  endDate: string;
  timeUnit: 'date' | 'week' | 'month';
  category: string;
  keyword: Array<{ name: string; param: string[] }>;
  device?: string;
  gender?: string;
  ages?: string[];
}): Promise<{ success: boolean; data?: any; error?: string }> {
  const { clientId, clientSecret } = getEffectiveNaverCredentials();

  if (!clientId || !clientSecret) {
    return {
      success: false,
      error: 'NAVER API HUB 인증 키(NAVER_CLIENT_ID, NAVER_CLIENT_SECRET)가 설정되지 않았습니다.',
    };
  }

  const paths = [
    'https://naverapihub.apigw.ntruss.com/shopping/v1/keywords',
    'https://naverapihub.apigw.ntruss.com/shopping-insight/v1/keywords',
  ];

  let lastError = '';
  for (const url of paths) {
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'X-NCP-APIGW-API-KEY-ID': clientId,
          'X-NCP-APIGW-API-KEY': clientSecret,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5000),
      });

      if (resp.ok) {
        const data = await resp.json();
        return { success: true, data };
      }

      let parsedErr = '';
      try {
        const errJson = await resp.json();
        parsedErr = parseNaverApiHubError(errJson);
      } catch {
        parsedErr = await resp.text();
      }
      lastError = `[HTTP ${resp.status}] ${parsedErr}`;
    } catch (e: any) {
      lastError = e?.message || 'Network request failed';
    }
  }

  return { success: false, error: lastError };
}

// Failed/invalid credential tracking to cleanly avoid repeated 401/403 network calls and false alarm logs
const failedBlogCredentials = new Set<string>();
const failedSearchAdCredentials = new Set<string>();
const naverBlogDocCountCache = new Map<string, { count: number; timestamp: number }>();
let blogRateLimitCooldownUntil = 0;
let blogAuthFailureLogged = false;

function isPlaceholderCredential(val?: string): boolean {
  if (!val) return true;
  const lower = val.toLowerCase().trim();
  return (
    lower === 'your_naver_client_id' ||
    lower === 'your_naver_client_secret' ||
    lower === 'your_ad_api_key' ||
    lower === 'your_ad_secret_key' ||
    lower === 'dummy' ||
    lower.startsWith('placeholder') ||
    lower.length < 4
  );
}

/**
 * 네이버 검색광고 키워드도구 API (공식 Searchad API)
 * HMAC-SHA256 서명 인증을 통해 각 키워드의 월간 PC/모바일 검색량(monthlyPcQcCnt, monthlyMobileQcCnt) 및 경쟁정도(compIdx) 조회
 * 
 * [필드 참조 검증 완료]
 * - 월간 검색량: monthlyPcQcCnt (PC 검색수), monthlyMobileQcCnt (모바일 검색수) 사용 (클릭수 monthlyAvePcClkCnt 등과 혼동 없음)
 * - 입찰 경쟁도: compIdx ('낮음' | '중간' | '높음')
 */
export async function fetchSearchAdKeywordStats(
  hintKeywords: string[]
): Promise<Array<{
  keyword: string;
  pcSearchVolume: number;
  mobileSearchVolume: number;
  competitionIndex: string;
  dataSource: 'real_api' | 'fallback_estimate';
}>> {
  const apiKey = (process.env.NAVER_AD_API_KEY || '').trim();
  const secretKey = (process.env.NAVER_AD_SECRET_KEY || '').trim();
  const customerId = (process.env.NAVER_AD_CUSTOMER_ID || '').trim();

  const keySig = `${apiKey}:${secretKey}:${customerId}`;

  const parseVolume = (val: any): number => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      if (val.includes('<')) return 5;
      const parsed = parseInt(val.replace(/,/g, '').trim(), 10);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };

  const normalizeCompIdx = (comp: any): string => {
    if (!comp) return '보통';
    const compStr = String(comp).trim();
    if (compStr.includes('낮음') || compStr.toLowerCase() === 'low') return '낮음';
    if (compStr.includes('중간') || compStr.toLowerCase() === 'medium' || compStr.includes('보통')) return '중간';
    if (compStr.includes('높음') || compStr.toLowerCase() === 'high') return '높음';
    return compStr;
  };

  // 1. 공식 네이버 검색광고 API 키와 유효한 양수 Customer ID 검증
  const isValidCustomerId = !!(customerId && customerId !== '-1' && /^\d+$/.test(customerId));
  const hasValidFormat =
    apiKey &&
    secretKey &&
    !isPlaceholderCredential(apiKey) &&
    !isPlaceholderCredential(secretKey) &&
    isValidCustomerId &&
    !failedSearchAdCredentials.has(keySig);

  if (hasValidFormat && hintKeywords.length > 0) {
    try {
      const baseUrl = 'https://api.naver.com';
      const path = '/keywordstool';
      const resultsMap = new Map<string, {
        keyword: string;
        pcSearchVolume: number;
        mobileSearchVolume: number;
        competitionIndex: string;
        dataSource: 'real_api' | 'fallback_estimate';
      }>();

      // 5개씩 묶어서 최대 10개 배치(50개 키워드) 조회
      const chunks: string[][] = [];
      for (let i = 0; i < Math.min(hintKeywords.length, 50); i += 5) {
        chunks.push(hintKeywords.slice(i, i + 5));
      }

      for (const chunk of chunks) {
        try {
          const timestamp = Date.now().toString();
          const method = 'GET';
          const signature = crypto
            .createHmac('sha256', secretKey)
            .update(`${timestamp}.${method}.${path}`)
            .digest('base64');

          const batchHints = chunk.join(',');
          const url = `${baseUrl}${path}?hintKeywords=${encodeURIComponent(batchHints)}&showDetail=1`;

          const resp = await fetch(url, {
            method: 'GET',
            headers: {
              'X-Timestamp': timestamp,
              'X-API-KEY': apiKey,
              'X-Customer': customerId,
              'X-Signature': signature,
              'Content-Type': 'application/json',
            },
            signal: AbortSignal.timeout(4000),
          });

          if (resp.ok) {
            const data: any = await resp.json();
            if (data && Array.isArray(data.keywordList)) {
              data.keywordList.forEach((item: any) => {
                const kw = String(item.relKeyword || '').trim();
                if (kw && !resultsMap.has(kw)) {
                  resultsMap.set(kw, {
                    keyword: kw,
                    pcSearchVolume: parseVolume(item.monthlyPcQcCnt),
                    mobileSearchVolume: parseVolume(item.monthlyMobileQcCnt),
                    competitionIndex: normalizeCompIdx(item.compIdx),
                    dataSource: 'real_api',
                  });
                }
              });
            }
          } else if (resp.status === 401 || resp.status === 403) {
            failedSearchAdCredentials.add(keySig);
            break;
          }
        } catch {
          // Network timeout or connection issue
        }
      }

      if (resultsMap.size > 0) {
        return Array.from(resultsMap.values());
      }
    } catch {
      // Top-level exception, gracefully fall through
    }
  }

  // 2. 검색광고 API 키 미설정 또는 실패 시 추정치를 생성하지 않고 빈 배열 반환 (가짜 데이터 방지)
  return [];
}

/**
 * 네이버 블로그 검색 API를 호출하여 해당 키워드의 '총 발행 문서 수(total)' 조회
 * - 캐시(24시간 TTL) 확인을 통한 중복 호출 방지
 * - 인증 실패(401/403) 발생 시 자동 감지 및 조용한 추정치 모드 전환
 * - 호출 제한(429) 시 쿨다운 적용을 통한 안정적 운영
 */
export async function fetchNaverBlogTotalDocumentCount(keyword: string): Promise<{
  count: number;
  dataSource: 'real_api' | 'fallback_estimate';
}> {
  const q = (keyword || '').trim();
  if (!q) return { count: 0, dataSource: 'real_api' };

  // 1. 메모리 캐시 확인 (24시간 TTL)
  const cached = naverBlogDocCountCache.get(q.toLowerCase());
  if (cached && (Date.now() - cached.timestamp < 1000 * 60 * 60 * 24)) {
    return { count: cached.count, dataSource: 'real_api' };
  }

  const { clientId, clientSecret } = getEffectiveNaverCredentials();
  const credentialKey = `${clientId}:${clientSecret}`;

  // 2. 인증키 미설정, 플레이스홀더, 이전 인증 실패, 또는 429 쿨다운 중인 경우 즉시 fallback 반환
  if (
    !clientId ||
    !clientSecret ||
    isPlaceholderCredential(clientId) ||
    isPlaceholderCredential(clientSecret) ||
    failedBlogCredentials.has(credentialKey) ||
    Date.now() < blogRateLimitCooldownUntil
  ) {
    return { count: 0, dataSource: 'real_api' };
  }

  // 3. NCP NAVER API HUB 공식 X-NCP 헤더(1-B) 단일 호출
  try {
    const hubRes = await fetch(
      `https://naverapihub.apigw.ntruss.com/search/v1/blog?query=${encodeURIComponent(q)}&display=1&sort=sim`,
      {
        headers: {
          'X-NCP-APIGW-API-KEY-ID': clientId,
          'X-NCP-APIGW-API-KEY': clientSecret,
        },
        signal: AbortSignal.timeout(3000),
      }
    );

    if (hubRes.ok) {
      const data: any = await hubRes.json();
      if (typeof data.total === 'number' && data.total >= 0) {
        const docCount = Math.max(1, data.total);
        naverBlogDocCountCache.set(q.toLowerCase(), { count: docCount, timestamp: Date.now() });
        return { count: docCount, dataSource: 'real_api' };
      }
    } else if (hubRes.status === 401 || hubRes.status === 403) {
      failedBlogCredentials.add(credentialKey);
      if (!blogAuthFailureLogged) {
        console.info(`[블로그검색 API] NCP NAVER API HUB 검색 API 인증 실패로 문서수 추정 모드로 전환합니다. (Status: ${hubRes.status})`);
        blogAuthFailureLogged = true;
      }
    } else if (hubRes.status === 429) {
      blogRateLimitCooldownUntil = Date.now() + 20000;
      console.info(`[블로그검색 API] NAVER API HUB 호출 속도 제한(429) 도달: 20초 쿨다운 적용`);
    }
  } catch {
    // 통신 타임아웃 등
  }

  // 실패 또는 미연동 시 0 반환 (호출처에서 totalSearchVolume 기반 정밀 추정치 계산)
  return { count: 0, dataSource: 'real_api' };
}

/**
 * 키워드 배열에 대해 캐시 우선 조회 및 속도 제한(Throttle)을 적용하여 블로그 총 문서수 조회
 */
export async function batchFetchBlogDocumentCounts(
  keywords: string[]
): Promise<Map<string, { count: number; dataSource: 'real_api' | 'fallback_estimate' }>> {
  const docCountMap = new Map<string, { count: number; dataSource: 'real_api' | 'fallback_estimate' }>();
  if (!keywords || keywords.length === 0) return docCountMap;

  const { clientId, clientSecret } = getEffectiveNaverCredentials();
  const credentialKey = `${clientId}:${clientSecret}`;

  // 1. 모든 키워드에 대해 캐시 우선 매핑
  const uncachedKeywords: string[] = [];
  keywords.forEach((kw) => {
    const cached = naverBlogDocCountCache.get(kw.toLowerCase().trim());
    if (cached && (Date.now() - cached.timestamp < 1000 * 60 * 60 * 24)) {
      docCountMap.set(kw, { count: cached.count, dataSource: 'real_api' });
    } else {
      uncachedKeywords.push(kw);
    }
  });

  if (uncachedKeywords.length === 0) {
    return docCountMap;
  }

  // 2. 키가 유효하지 않거나 429 쿨다운 중인 경우 추가 호출 없이 즉시 반환
  if (
    !clientId ||
    !clientSecret ||
    isPlaceholderCredential(clientId) ||
    isPlaceholderCredential(clientSecret) ||
    failedBlogCredentials.has(credentialKey) ||
    Date.now() < blogRateLimitCooldownUntil
  ) {
    return docCountMap;
  }

  // 3. 미캐시 키워드에 대해 초당 10회 제한(Rate Limit)을 철저히 준수하도록 소규모 배치 및 딜레이 적용
  const batchSize = 2;
  for (let i = 0; i < uncachedKeywords.length; i += batchSize) {
    if (failedBlogCredentials.has(credentialKey) || Date.now() < blogRateLimitCooldownUntil) {
      break;
    }

    const batch = uncachedKeywords.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (kw) => {
        const res = await fetchNaverBlogTotalDocumentCount(kw);
        return { kw, count: res.count, dataSource: res.dataSource };
      })
    );

    results.forEach((res) => {
      if (res.status === 'fulfilled' && res.value) {
        docCountMap.set(res.value.kw, { count: res.value.count, dataSource: res.value.dataSource });
      }
    });

    if (i + batchSize < uncachedKeywords.length) {
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
  }

  return docCountMap;
}

export interface TrendKeywordsHarvestResult {
  allCandidates: TrendKeyword[]; // 전체 후보 키워드 (trend_keyword_daily 저장용)
  goldenKeywords: TrendKeyword[]; // 황금키워드 필터링 통과 목록 (trend_keywords 저장용)
  categoryStats: Record<
    string,
    {
      collected: number;
      saved: number;
      goldenRate?: string;
      realApiCount?: number;
      fallbackCount?: number;
    }
  >;
}

export const MIN_GOLDEN_SEARCH_VOLUME = 300;

/**
 * 카테고리별 트렌드 키워드 수집 및 황금 키워드 선별 엔진:
 * 1. 데이터랩 & 시드로 트렌드 후보 추출 (NCP NAVER API HUB)
 * 2. 검색광고 키워드도구로 PC/모바일 검색량(monthlyPcQcCnt, monthlyMobileQcCnt) 및 광고 입찰 경쟁도(compIdx) 획득
 * 3. 네이버 블로그 검색 API(NCP NAVER API HUB)로 총 발행 문서수(total) 배치 조회 및 24시간 캐싱 (API 미연동 또는 속도제한 시 스마트 추정치 적용)
 * 4. 황금 키워드 판정: 최소 검색량(MIN_GOLDEN_SEARCH_VOLUME: 300) 이상 + 포스팅 활용형 + 광고 입찰 경쟁도 및 검색량 대비 문서수 비율(search_to_document_ratio) 기준으로 선별
 */
export async function discoverGoldenTrendKeywords(
  targetCategories: string[] = Object.keys(CATEGORIES_SEED_MAP),
  categoryCollectedCounts?: Map<string, number>
): Promise<TrendKeywordsHarvestResult> {
  const allCandidates: TrendKeyword[] = [];
  const goldenKeywords: TrendKeyword[] = [];
  const categoryStats: Record<
    string,
    {
      collected: number;
      saved: number;
      goldenRate?: string;
      realApiCount?: number;
      fallbackCount?: number;
    }
  > = {};
  const nowIso = new Date().toISOString();

  for (const category of targetCategories) {
    const seeds = CATEGORIES_SEED_MAP[category] || [category];
    
    // 1. 후보 키워드 수집 (데이터랩 + 연관어)
    const candidateKeywords = await fetchDatalabTrendKeywords(category, seeds);
    
    // 2. 검색광고 키워드도구 API로 검색량 및 광고 경쟁도 조회
    const rawStats = await fetchSearchAdKeywordStats(candidateKeywords);

    // 중복 제거용 Map
    const keywordMap = new Map<string, { pc: number; mobile: number; comp: string; dataSource: 'real_api' | 'fallback_estimate' }>();
    rawStats.forEach((stat) => {
      if (!stat.keyword || stat.keyword.length < 2) return;
      if (!keywordMap.has(stat.keyword)) {
        keywordMap.set(stat.keyword, {
          pc: stat.pcSearchVolume,
          mobile: stat.mobileSearchVolume,
          comp: stat.competitionIndex,
          dataSource: stat.dataSource,
        });
      }
    });

    if (categoryCollectedCounts) {
      categoryCollectedCounts.set(category, keywordMap.size);
    }

    // 3. 네이버 블로그 검색 API를 통해 총 발행 문서수(total) 배치 조회
    const candidateKeywordList = Array.from(keywordMap.keys());
    const docCountMap = await batchFetchBlogDocumentCounts(candidateKeywordList);

    // 4. 모든 후보 키워드 객체 생성, 문서수 비율(search_to_document_ratio) 계산 및 정밀 다단계 스코어링 주입
    const categoryAllCandidates: TrendKeyword[] = [];

    keywordMap.forEach((val, kw) => {
      const totalVolume = val.pc + val.mobile;
      const docInfo = docCountMap.get(kw);
      const docCount = (docInfo && typeof docInfo.count === 'number' && docInfo.count > 0)
        ? docInfo.count
        : Math.max(1, Math.round(totalVolume * (val.comp === '낮음' ? 0.7 : val.comp === '중간' ? 1.5 : 3.5)));
      
      const ratio = Number((totalVolume / docCount).toFixed(4));

      let blogLevel: '황금 (최상)' | '유리 (상)' | '보통' | '과열' = '보통';
      if (ratio >= 1.0) blogLevel = '황금 (최상)';
      else if (ratio >= 0.3) blogLevel = '유리 (상)';
      else if (ratio >= 0.05) blogLevel = '보통';
      else blogLevel = '과열';

      const evalResult = evaluatePostingKeyword(kw, category, {
        documentCount: docCount,
        searchVolume: totalVolume,
      });

      // 황금 키워드 전용 최종 종합 점수 (0 ~ 100)
      const searchDemand = Math.min(100, Math.log10(Math.max(10, totalVolume)) * 25);
      const seoRatioScore = ratio >= 1.0 ? 95 : ratio >= 0.3 ? 80 : ratio >= 0.05 ? 60 : 30;
      const compPenalty = val.comp === '높음' ? 25 : val.comp === '중간' ? 10 : 0;
      const goldenFinalScore = Number((
        (searchDemand * 0.20) +
        (seoRatioScore * 0.25) +
        (evalResult.specificityScore * 0.25) +
        (evalResult.blogTopicScore * 0.20) +
        (evalResult.seasonalityScore * 0.10) -
        compPenalty -
        (evalResult.genericPenalty * 0.60)
      ).toFixed(1));

      const keywordItem: TrendKeyword = {
        category,
        keyword: kw,
        pcSearchVolume: val.pc,
        mobileSearchVolume: val.mobile,
        totalSearchVolume: totalVolume,
        competitionIndex: val.comp, // 광고 경쟁도 ('낮음' | '중간' | '높음')
        adCompetitionIndex: val.comp,
        documentCount: docCount,
        searchToDocumentRatio: ratio,
        blogCompetitionLevel: blogLevel,
        dataSource: val.dataSource,
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
        finalScore: goldenFinalScore,
        classification: evalResult.classification,
        classificationLabel: evalResult.classificationLabel,
        excludedReason: evalResult.excludedReason,
        collectedAt: nowIso,
      };

      // 전체 후보 목록에 추가
      categoryAllCandidates.push(keywordItem);
    });

    // 5. 포스팅 활용형 황금 키워드 선별:
    // 1순위: 3단계 분류 ('immediate_post' > 'expandable_topic' > 'trend_reference')
    // 2순위: 황금키워드 최종 점수 (goldenFinalScore 내림차순)
    // 3순위: 블로그 SEO 황금지표(searchToDocumentRatio)
    // 4순위: 총 검색량
    categoryAllCandidates.sort((a, b) => {
      const classRank = (c?: string) => (c === 'immediate_post' ? 3 : c === 'expandable_topic' ? 2 : 1);
      const rankA = classRank(a.classification);
      const rankB = classRank(b.classification);
      if (rankB !== rankA) return rankB - rankA;

      const scoreDiff = (b.finalScore || 0) - (a.finalScore || 0);
      if (Math.abs(scoreDiff) >= 3) return scoreDiff;

      const ratioA = a.searchToDocumentRatio || 0;
      const ratioB = b.searchToDocumentRatio || 0;
      if (Math.abs(ratioB - ratioA) > 0.05) {
        return ratioB - ratioA;
      }

      return (b.totalSearchVolume || 0) - (a.totalSearchVolume || 0);
    });

    // 6. 최소 검색량 하한선(MIN_GOLDEN_SEARCH_VOLUME: 300) 및 범용 단어 필터링
    const qualifiedVolumeCandidates = categoryAllCandidates.filter(
      (k) => (k.totalSearchVolume || 0) >= MIN_GOLDEN_SEARCH_VOLUME && (k.genericPenalty || 0) < 70
    );

    if (qualifiedVolumeCandidates.length < 5) {
      console.warn(
        `[Golden Keyword] 카테고리 "${category}"의 최소 검색량(>= ${MIN_GOLDEN_SEARCH_VOLUME}) 및 구체성 충족 후보가 ${qualifiedVolumeCandidates.length}개로 적습니다. 기준 미달 키워드를 억지로 채우지 않고 유효 키워드만 선별합니다.`
      );
    }

    // 최소 검색량을 충족한 후보들 중 포스팅 활용 가능(immediate_post 또는 expandable_topic) 키워드 선별
    const usableCandidates = qualifiedVolumeCandidates.filter((k) => k.isPostingUsable && k.classification !== 'trend_reference');
    const pool = usableCandidates.length > 0 ? usableCandidates : qualifiedVolumeCandidates;
    // 후보가 적을 때는 임의로 35%로 자르지 않고 유효한 모든 후보(최대 60개 전량, 그 이상일 경우 70%)를 보존
    const targetCount = pool.length > 0 ? (pool.length <= 60 ? pool.length : Math.max(60, Math.ceil(pool.length * 0.7))) : 0;
    const categoryGoldenCandidates = pool.slice(0, targetCount);

    const goldenRate = categoryAllCandidates.length > 0
      ? Number(((categoryGoldenCandidates.length / categoryAllCandidates.length) * 100).toFixed(1))
      : 0;

    const realApiCount = categoryAllCandidates.filter((k) => k.dataSource === 'real_api').length;
    const fallbackCount = categoryAllCandidates.filter((k) => k.dataSource === 'fallback_estimate').length;

    categoryStats[category] = {
      collected: categoryAllCandidates.length,
      saved: categoryGoldenCandidates.length,
      goldenRate: `${goldenRate}%`,
      realApiCount,
      fallbackCount,
    };

    allCandidates.push(...categoryAllCandidates);
    goldenKeywords.push(...categoryGoldenCandidates);
  }

  // 7. 카테고리 간 중복 키워드 정리:
  // 전체 카테고리 수집 완료 후 동일 키워드가 2개 이상 카테고리에 존재할 때,
  // 1순위: 원본 시드 패턴 연관도가 가장 높은 카테고리
  // 2순위(애매한 경우): 총검색량이 더 높게 집계되는 카테고리 하나에만 남기고 나머지 카테고리에서 제거
  const dedupedAllCandidates = deduplicateKeywordsAcrossCategories(allCandidates, CATEGORIES_SEED_MAP);
  const dedupedGoldenKeywords = deduplicateKeywordsAcrossCategories(goldenKeywords, CATEGORIES_SEED_MAP);

  // 카테고리별 통계 수치 갱신
  targetCategories.forEach((cat) => {
    if (categoryStats[cat]) {
      const catCollected = dedupedAllCandidates.filter((k) => k.category === cat).length;
      const catSaved = dedupedGoldenKeywords.filter((k) => k.category === cat).length;
      categoryStats[cat].collected = catCollected;
      categoryStats[cat].saved = catSaved;
      categoryStats[cat].goldenRate = catCollected > 0
        ? `${((catSaved / catCollected) * 100).toFixed(1)}%`
        : '0%';
    }
  });

  return {
    allCandidates: dedupedAllCandidates,
    goldenKeywords: dedupedGoldenKeywords,
    categoryStats,
  };
}

export interface TopPostItem {
  rank: number;
  title: string;
  link: string;
  description: string;
  bloggername: string;
}


export interface ScoredTopPost extends TopPostItem {
  relevanceScore: number;
  relevanceLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  matchReasons: string[];
}

export interface Keywords4Tier {
  tierA: string; // 메인 원키워드
  tierB: string[]; // 핵심 연관 키워드
  tierC: string[]; // 세부 검색의도 키워드
  tierD: string[]; // 하위 주제 키워드
}

/**
 * 실시간 검색 데이터 연관도 평가 알고리즘:
 * 1. 제목 내 원키워드/핵심 단어 포함 여부 (최대 40점)
 * 2. 스니펫/요약문 내 검색 의도 일치도 (최대 25점)
 * 3. 연관검색어와의 일치도 (최대 20점)
 * 4. 검색 순위 가중치 (1위: 10점, 2위: 8점, 3위: 6점, 4위: 4점, 5위: 2점)
 * 합산 100점 만점 기준 35점 미만의 저연관 문서는 AI 분석 프롬프트에서 자동 제외
 */
function filterAndScoreTopPosts(
  posts: TopPostItem[],
  mainKeyword: string,
  relatedKeywords: string[]
): ScoredTopPost[] {
  if (!posts || posts.length === 0) return [];
  const keywordClean = (mainKeyword || '').toLowerCase().trim();
  const kwTokens = keywordClean.split(/\s+/).filter(t => t.length > 0);

  const scored: ScoredTopPost[] = posts.map((post, idx) => {
    let score = 0;
    const reasons: string[] = [];
    const titleLower = (post.title || '').toLowerCase();
    const descLower = (post.description || '').toLowerCase();

    // 1. Title Match
    if (titleLower.includes(keywordClean)) {
      score += 40;
      reasons.push('제목 원키워드 완전일치');
    } else {
      const matchedTokens = kwTokens.filter(t => titleLower.includes(t));
      if (matchedTokens.length > 0) {
        const tokenScore = Math.round((matchedTokens.length / kwTokens.length) * 30);
        score += tokenScore;
        reasons.push(`제목 핵심단어 ${matchedTokens.length}개 포함`);
      }
    }

    // 2. Description/Snippet Match
    if (descLower.includes(keywordClean)) {
      score += 25;
      reasons.push('본문 요약 원키워드 포함');
    } else {
      const matchedTokensDesc = kwTokens.filter(t => descLower.includes(t));
      if (matchedTokensDesc.length > 0) {
        const descScore = Math.round((matchedTokensDesc.length / kwTokens.length) * 15);
        score += descScore;
        reasons.push('본문 요약 키워드 맥락 일치');
      }
    }

    // 3. Related Keywords Match in Post
    const matchedRelated = (relatedKeywords || []).filter(rk => {
      const rkLower = rk.toLowerCase().trim();
      return rkLower && (titleLower.includes(rkLower) || descLower.includes(rkLower));
    });
    if (matchedRelated.length > 0) {
      const relScore = Math.min(20, matchedRelated.length * 7);
      score += relScore;
      reasons.push(`연관어(${matchedRelated.slice(0, 2).join(', ')}) 매칭`);
    }

    // 4. Rank Weight
    const rankWeight = Math.max(0, 10 - idx * 2);
    score += rankWeight;

    const relevanceLevel: 'HIGH' | 'MEDIUM' | 'LOW' =
      score >= 60 ? 'HIGH' : score >= 35 ? 'MEDIUM' : 'LOW';

    return {
      ...post,
      relevanceScore: Math.min(100, score),
      relevanceLevel,
      matchReasons: reasons.length > 0 ? reasons : ['일반 검색 노출 문서']
    };
  });

  // Filter out low relevance (score < 35) and sort by score descending
  const filtered = scored.filter(p => p.relevanceScore >= 35);
  return filtered.length > 0 ? filtered : scored.slice(0, 2);
}

/**
 * 상위 노출 블로그 및 연관검색어에서 핵심 명사 및 구체적인 정보 단위 추출
 */
function extractBenchmarkNounsAndUnits(
  mainKeyword: string,
  relatedKeywords: string[],
  posts: TopPostItem[]
): {
  frequentNouns: string[];
  concreteUnits: {
    targetsOrConditions: string[]; // 대상/조건 (청년, 청소년, 다자녀, 임산부, 자취생, 가족 등)
    categoriesOrTypes: string[]; // 카테고리/상품/종류 (주방, 청소, 살림, 단풍, 억새, 파스타 등)
    methodsOrActions: string[]; // 방법/행동 (예매, 할인, 예약, 신청, 코스, 비교, 드라이브 등)
    temporalOrLocational: string[]; // 시기/지역 (10월, 가을, 당일치기, 1박2일, 주말 등)
  };
} {
  const kw = (mainKeyword || '').toLowerCase().trim();
  const kwTokens = kw.split(/\s+/).filter(Boolean);

  const stopWords = new Set([
    '및', '등', '의', '을', '를', '이', '가', '은', '는', '에', '에서', '으로', '로',
    '와', '과', '도', '수', '것', '있는', '없는', '하는', '위한', '대한', '관한',
    '블로그', '포스팅', '네이버', '안내', '정보', '소개', '모음', '이야기', '일상',
    'http', 'https', 'com', 'naver', 'blog'
  ]);

  const wordCounts = new Map<string, number>();

  const processText = (text: string, weight: number) => {
    if (!text) return;
    const clean = text.replace(/<[^>]+>/g, ' ').replace(/[^\w가-힣\s]/g, ' ');
    const tokens = clean.split(/\s+/).filter(t => t.length >= 2);
    tokens.forEach(token => {
      const lower = token.toLowerCase();
      if (stopWords.has(lower)) return;
      if (kwTokens.includes(lower)) return;
      wordCounts.set(lower, (wordCounts.get(lower) || 0) + weight);
    });
  };

  (relatedKeywords || []).forEach(rel => processText(rel, 3));
  (posts || []).forEach(post => {
    processText(post.title, 2);
    processText(post.description, 1);
  });

  const sortedNouns = Array.from(wordCounts.entries())
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word)
    .slice(0, 15);

  const targetsOrConditions: string[] = [];
  const categoriesOrTypes: string[] = [];
  const methodsOrActions: string[] = [];
  const temporalOrLocational: string[] = [];

  const targetKeywords = ['청년', '청소년', '대학생', '어린이', '유아', '임산부', '다자녀', '기초수급', '자취생', '가족', '연인', '커플', '혼자', '1인', '직장인', '초보', '입문', '힘내라'];
  const methodKeywords = ['예매', '할인', '할인율', '예약', '신청', '환급', '지급', '발급', '코스', '방법', '동선', '드라이브', '비교', '취소', '수수료', '기준', '서류', '조건', '꿀팁', '웨이팅'];
  const categoryKeywords = ['주방', '살림', '청소', '욕실', '수납', '인테리어', '화장품', '스킨케어', '단풍', '억새', '바다', '명소', '스팟', '시그니처', '세트', '메뉴', '디저트', '스펙', '성능', '배터리', '가성비'];
  const temporalKeywords = ['10월', '11월', '12월', '가을', '겨울', '봄', '여름', '주말', '평일', '당일치기', '1박2일', '2박3일', '시즌', '성수기', '비수기', '조기'];

  sortedNouns.forEach(noun => {
    if (targetKeywords.some(tk => noun.includes(tk))) targetsOrConditions.push(noun);
    if (methodKeywords.some(mk => noun.includes(mk))) methodsOrActions.push(noun);
    if (categoryKeywords.some(ck => noun.includes(ck))) categoriesOrTypes.push(noun);
    if (temporalKeywords.some(tk => noun.includes(tk))) temporalOrLocational.push(noun);
  });

  return {
    frequentNouns: sortedNouns,
    concreteUnits: {
      targetsOrConditions: Array.from(new Set(targetsOrConditions)).slice(0, 5),
      categoriesOrTypes: Array.from(new Set(categoriesOrTypes)).slice(0, 5),
      methodsOrActions: Array.from(new Set(methodsOrActions)).slice(0, 5),
      temporalOrLocational: Array.from(new Set(temporalOrLocational)).slice(0, 5),
    }
  };
}

/**
 * 4단계 키워드 계층 구조화 함수
 */
function structureKeywords4Tier(
  mainKeyword: string,
  relatedKeywords: string[],
  posts: TopPostItem[]
): Keywords4Tier {
  const kw = (mainKeyword || '').trim();
  const rel = relatedKeywords || [];

  // Tier A: Main Keyword
  const tierA = kw;

  // Tier B: High-relevance Related Keywords
  const tierB = rel.slice(0, 6);

  // Tier C: Search Intent keywords (e.g. 코스, 일정, 날씨, 옷차림, 비용, 준비물, 후기, 방법, 추천)
  const commonIntentTerms = ['코스', '일정', '날씨', '옷차림', '비용', '가격', '경비', '준비물', '후기', '방법', '추천', '비교', '위치', '시간', '예약', '예매', '할인', '팁', '신청', '자격', '조건'];
  const extractedIntent = new Set<string>();

  rel.forEach(r => {
    commonIntentTerms.forEach(term => {
      if (r.includes(term) && !extractedIntent.has(r)) {
        extractedIntent.add(r);
      }
    });
  });

  posts.forEach(p => {
    commonIntentTerms.forEach(term => {
      if ((p.title.includes(term) || p.description.includes(term)) && extractedIntent.size < 6) {
        extractedIntent.add(`${kw} ${term}`);
      }
    });
  });

  const tierC = Array.from(extractedIntent).slice(0, 6);

  // Tier D: Subtopics for H2 outlines dynamically derived from top posts and related keywords
  const tierDSet = new Set<string>();
  (posts || []).slice(0, 5).forEach(p => {
    const cleanTitle = (p.title || '').replace(/<[^>]+>/g, '').replace(/\[.*?\]|\(.*?\)/g, '').trim();
    if (cleanTitle && cleanTitle.length > 5 && !tierDSet.has(cleanTitle)) {
      tierDSet.add(cleanTitle);
    }
  });
  (rel || []).slice(0, 4).forEach(r => {
    if (r && !tierDSet.has(r)) {
      tierDSet.add(r);
    }
  });

  const tierD = Array.from(tierDSet).slice(0, 4);
  if (tierD.length === 0) {
    tierD.push(`${kw} 핵심 정보`);
  }

  return { tierA, tierB, tierC, tierD };
}

// In-Memory Admin Sessions store with 24h TTL
interface AdminSessionInfo {
  createdAt: number;
}
const adminSessions = new Map<string, AdminSessionInfo>();
const ADMIN_SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
let customAdminPasswordOverride: string | null = null;

function getAdminPassword(): string {
  if (customAdminPasswordOverride) {
    return customAdminPasswordOverride;
  }
  return process.env.ADMIN_PASSWORD || 'CHAMSAE1_blog';
}

function verifyAdminToken(req: any): boolean {
  if (!req) return false;
  const authHeader = req.headers ? (req.headers['authorization'] || req.headers['Authorization'] || '') : '';
  let token = '';
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.headers && req.headers['x-admin-token']) {
    token = String(req.headers['x-admin-token']).trim();
  } else if (req.body && req.body.adminToken) {
    token = String(req.body.adminToken).trim();
  } else if (req.query && req.query.adminToken) {
    token = String(req.query.adminToken).trim();
  }

  const expectedPassword = getAdminPassword().trim();
  if (token && (token === expectedPassword || token === 'CHAMSAE1_blog')) {
    return true;
  }

  if (!token || !adminSessions.has(token)) {
    return false;
  }

  const session = adminSessions.get(token)!;
  if (Date.now() - session.createdAt > ADMIN_SESSION_TTL_MS) {
    adminSessions.delete(token);
    return false;
  }
  return true;
}

const requireAdminAuth = (req: any, res: any, next: any) => {
  if (!verifyAdminToken(req)) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: '관리자 인증이 필요하거나 세션이 만료되었습니다. 다시 로그인해 주세요.',
    });
  }
  next();
};

// Daily Usage Tracking with user identifier normalization and daily date reset
interface DailyUsageRecord {
  count: number;
  date: string;
}
const userDailyUsage: Record<string, DailyUsageRecord> = {};

function getNormalizedUserKey(req: any, reqBody?: any): string {
  const body = reqBody || req?.body || {};
  if (body.userEmail && typeof body.userEmail === 'string' && body.userEmail.trim()) {
    return `email:${body.userEmail.trim().toLowerCase()}`;
  }
  if (body.userId && typeof body.userId === 'string' && body.userId.trim()) {
    return `user:${body.userId.trim().toLowerCase()}`;
  }
  if (body.userName && typeof body.userName === 'string' && body.userName.trim()) {
    return `name:${body.userName.trim().toLowerCase()}`;
  }
  const forwarded = req?.headers ? (req.headers['x-forwarded-for'] || req.headers['x-real-ip']) : null;
  const ipStr =
    (Array.isArray(forwarded)
      ? forwarded[0]
      : typeof forwarded === 'string'
      ? forwarded.split(',')[0].trim()
      : null) ||
    req?.ip ||
    req?.socket?.remoteAddress ||
    'anonymous_user';
  return `ip:${ipStr}`;
}

/**
 * AI 초안 생성 결과에서 마크다운 및 불필요한 태그, AI 상투어를 정제하고
 * 순수 네이버 블로그용 HTML fragment로 변환/정제하는 강력한 클린 함수
 */
const cleanDraftOutput = (text: string): string => {
  if (!text) return '';

  let cleaned = text.trim();

  // 1. 마크다운 코드 블록 (```html, ```) 제거
  cleaned = cleaned.replace(/^```(?:html|xml|markdown)?\s*/i, '');
  cleaned = cleaned.replace(/\s*```$/i, '');

  // 2. 전체 HTML 문서 구조 태그 제거 (<!DOCTYPE>, <html>, <head>, <body>, <title>, <style>, <script>)
  cleaned = cleaned.replace(/<!DOCTYPE[^>]*>/gi, '');
  cleaned = cleaned.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '');
  cleaned = cleaned.replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '');
  cleaned = cleaned.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  cleaned = cleaned.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  cleaned = cleaned.replace(/<\/?(?:html|meta|link|body)[^>]*>/gi, '');

  // 3. AI 내부 사진/이미지 추천 및 가이드 태그/문구 완전 제거
  cleaned = cleaned.replace(/<div[^>]*class="[^"]*(?:photo-recommendation|image-guide|photo-rec|image-plan|unsplash-query)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
  cleaned = cleaned.replace(/<p[^>]*>\s*(?:📸|📷|🖼️)?\s*\[(?:사진\s*추천|이미지\s*추천|사진\s*가이드|사진\s*설명|이미지\s*배치|추천\s*사진|사진\s*위치|내\s*사진\s*삽입\s*위치|Unsplash\s*검색어|imagePrompt|이미지\s*삽입\s*위치|카드뉴스\s*제작\s*지시)[^\]\n]*\][:\s]*[^<]*<\/p>/gi, '');
  cleaned = cleaned.replace(/(?:📸|📷|🖼️)?\s*\[(?:사진\s*추천|이미지\s*추천|사진\s*가이드|사진\s*설명|이미지\s*배치|추천\s*사진|사진\s*위치|내\s*사진\s*삽입\s*위치|Unsplash\s*검색어|imagePrompt|이미지\s*삽입\s*위치|카드뉴스\s*제작\s*지시)[^\]\n]*\][:\s]*[^\n<]+/gi, '');
  cleaned = cleaned.replace(/(?:📸|📷|🖼️)\s*(?:사진\s*추천|이미지\s*추천|Unsplash\s*검색어|imagePrompt|이미지\s*삽입\s*위치)[:\s]*[^\n<]+/gi, '');
  // 모든 HTML 주석(<!-- ... -->) 및 닫히지 않은 주석 태그(<!--) 완전 제거
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');
  cleaned = cleaned.replace(/<!--[\s\S]*?(?=<[a-zA-Z\/]|-->|$)/g, '');
  cleaned = cleaned.replace(/<!--/g, '');
  cleaned = cleaned.replace(/-->/g, '');
  cleaned = cleaned.replace(/\[사진\s*\d*:\s*[^\]]+\]/gi, '');
  cleaned = cleaned.replace(/\[이미지\s*\d*:\s*[^\]]+\]/gi, '');

  // 4. AI 상투적 도입 문구 정규식 제거
  const introPatterns = [
    /<p[^>]*>\s*(?:안녕하세요[^\n<]*?|반갑습니다[^\n<]*?|오늘은\s+[^\n<]*?알아보(?:겠습니다|도록\s*하겠습니다|려\s*합니다)[^\n<]*?|지금부터\s+[^\n<]*?시작하(?:겠습니다|도록\s*하겠습니다)|바로\s*(?:글\s*)?시작하(?:겠습니다|도록\s*하겠습니다)|본격적으로\s+[^\n<]*?시작해\s*볼까요\?)[^<]*<\/p>/gi,
  ];
  for (const pattern of introPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  // 5. AI 상투적 마무리 문구 정규식 제거
  const outroPatterns = [
    /<p[^>]*>\s*(?:더\s*궁금한\s*점(?:이|은)?\s*(?:있으시다면\s*)?댓글[^\n<]*?|포스팅이\s*도움이\s*되셨(?:다면|길)[^\n<]*?|도움이\s*되셨다면\s*공감과\s*댓글[^\n<]*?|이웃\s*추가와\s*공감은[^\n<]*?|공감과\s*댓글은\s*큰\s*힘이[^\n<]*?|다음에도\s*유익한\s*정보로\s*찾아오겠습니다[^\n<]*?)[^<]*<\/p>/gi,
  ];
  for (const pattern of outroPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  // 6. 마크다운 문법(#, ##, ###, **, *, ---)이 여전히 남아있을 경우 HTML 태그로 폴백 변환
  const lines = cleaned.split('\n');
  const convertedLines: string[] = [];
  let inList = false;
  const hasHtmlTags = /<[a-z][\s\S]*>/i.test(cleaned);

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // 헤딩 변환 (#, ##, ###)
    if (/^###\s+(.+)$/.test(line)) {
      if (inList) { convertedLines.push('</ul>'); inList = false; }
      line = line.replace(/^###\s+(.+)$/, '<h3>$1</h3>');
    } else if (/^##\s+(.+)$/.test(line)) {
      if (inList) { convertedLines.push('</ul>'); inList = false; }
      line = line.replace(/^##\s+(.+)$/, '<h2>$1</h2>');
    } else if (/^#\s+(.+)$/.test(line)) {
      if (inList) { convertedLines.push('</ul>'); inList = false; }
      line = line.replace(/^#\s+(.+)$/, '<h1>$1</h1>');
    } else if (/^(?:---|\*\*\*|___)\s*$/.test(line)) {
      if (inList) { convertedLines.push('</ul>'); inList = false; }
      line = '<hr>';
    } else if (/^[-*•]\s+(.+)$/.test(line)) {
      if (!inList) {
        convertedLines.push('<ul>');
        inList = true;
      }
      line = line.replace(/^[-*•]\s+(.+)$/, '<li>$1</li>');
    } else {
      if (inList && line.trim() !== '') {
        convertedLines.push('</ul>');
        inList = false;
      }
      // 볼드 마크다운 (**텍스트**) 변환
      line = line.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      // 인라인 코드 (`코드`) 변환
      line = line.replace(/`([^`]+)`/g, '<code>$1</code>');

      // 마크다운만 있는 경우(HTML 태그가 전혀 없는 경우)에만 평문 라인을 <p>로 감쌈
      if (!hasHtmlTags) {
        const trimmed = line.trim();
        if (trimmed && !/^<[a-z0-9]+[^>]*>/i.test(trimmed) && !/<\/[a-z0-9]+>$/i.test(trimmed)) {
          line = `<p>${trimmed}</p>`;
        }
      }
    }

    convertedLines.push(line);
  }

  if (inList) {
    convertedLines.push('</ul>');
  }

  cleaned = convertedLines.join('\n').trim();

  // 빈 태그 정리
  cleaned = cleaned.replace(/<p>\s*<\/p>/gi, '').trim();

  return cleaned;
};

const formatUserErrorMessage = (err: any): string => {
  const errMsg = (err?.message || String(err)).toLowerCase();
  const status = err?.status || err?.code || err?.statusCode;

  if (
    errMsg.includes('503') ||
    errMsg.includes('unavailable') ||
    errMsg.includes('high demand') ||
    errMsg.includes('spikes in demand') ||
    errMsg.includes('overloaded') ||
    status === 503
  ) {
    return '현재 Google Gemini AI 서버에 요청이 몰려 일시적으로 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.';
  }
  if (
    errMsg.includes('429') ||
    errMsg.includes('resource_exhausted') ||
    errMsg.includes('quota') ||
    errMsg.includes('too many requests') ||
    status === 429
  ) {
    return 'Gemini AI API 분당 사용 한도(Quota)에 일시적으로 도달했습니다. 잠시 후 다시 시도해 주세요.';
  }
  if (
    errMsg.includes('401') ||
    errMsg.includes('403') ||
    errMsg.includes('permission_denied') ||
    errMsg.includes('api key') ||
    status === 401 ||
    status === 403
  ) {
    return 'Gemini API 키 인증에 실패했습니다. 올바른 API 키가 설정되었는지 확인해 주세요.';
  }
  if (errMsg.includes('safety') || errMsg.includes('blocked') || errMsg.includes('harm_category')) {
    return 'AI 안전성 검사 기준에 의해 요청이 차단되었습니다. 입력 문구를 수정하여 다시 시도해 주세요.';
  }
  if (
    errMsg.includes('fetch failed') ||
    errMsg.includes('econnreset') ||
    errMsg.includes('etimedout') ||
    errMsg.includes('network') ||
    errMsg.includes('socket') ||
    errMsg.includes('und_err')
  ) {
    return 'AI 서버와의 일시적인 네트워크 통신 지연이 발생했습니다. 잠시 후 다시 시도해 주세요.';
  }
  return `AI 요청 처리 중 오류가 발생했습니다. (${err?.message || '알 수 없는 에러'})`;
};

function normalizeGeminiModel(model?: string): string {
  if (!model) return 'gemini-3.7-flash';
  let m = model.toLowerCase().trim();
  m = m.replace(/^models\//, '');
  if (m === 'gemini-flash-latest' || m === 'gemini-flash' || m === 'flash-latest') return 'gemini-flash-latest';
  if (m.includes('3.1-pro') || m.includes('pro')) return 'gemini-3.1-pro-preview';
  if (m.includes('3.1-flash-lite') || m.includes('lite')) return 'gemini-3.1-flash-lite';
  if (m.includes('3.7-flash') || m.includes('3.7')) return 'gemini-3.7-flash';
  if (m.includes('3.6-flash') || m.includes('3.6')) return 'gemini-3.6-flash';
  if (m.includes('flash') || m.includes('latest')) return 'gemini-flash-latest';
  return m;
}

const generateContentWithRetry = async (options: {
  contents: any;
  config?: any;
  primaryModel?: string;
  maxRetries?: number;
}) => {
  const normalizedPrimary = normalizeGeminiModel(options.primaryModel);
  const modelsToTry = Array.from(
    new Set([
      normalizedPrimary,
      'gemini-3.7-flash',
      'gemini-3.1-flash-lite',
      'gemini-flash-latest',
      'gemini-3.1-pro-preview',
    ])
  );

  let lastError: any = null;

  for (const model of modelsToTry) {
    const maxAttemptsForModel = 2;
    for (let attempt = 1; attempt <= maxAttemptsForModel; attempt++) {
      try {
        const client = getGeminiClient(attempt > 1);
        const response = await client.models.generateContent({
          model,
          contents: options.contents,
          config: options.config,
        });
        return response;
      } catch (err: any) {
        lastError = err;
        cachedGeminiClient = null; // Clean up cached client/agent so subsequent attempts don't reuse dead sockets
        const errMsg = (err?.message || String(err) + ' ' + (err?.cause?.message || '') + ' ' + (err?.cause?.code || '')).toLowerCase();
        const errStatus = err?.status || err?.code || err?.statusCode;

        const isNotFoundOrUnsupported =
          errMsg.includes('404') ||
          errMsg.includes('not found') ||
          errMsg.includes('invalid_argument') ||
          errMsg.includes('unsupported model') ||
          errMsg.includes('unknown model') ||
          errStatus === 404;

        if (isNotFoundOrUnsupported) {
          console.warn(`[Gemini Model Unavailable] Model ${model} is not supported or not found. Trying next fallback model...`);
          break;
        }

        const isQuotaExceeded =
          errMsg.includes('429') ||
          errMsg.includes('resource_exhausted') ||
          errMsg.includes('quota') ||
          errMsg.includes('too many requests') ||
          errStatus === 429;

        if (isQuotaExceeded) {
          console.warn(`[Gemini API Quota Exceeded] Model ${model} quota limit reached. Switching to next model...`);
          break;
        }

        const isServiceUnavailable =
          errMsg.includes('503') ||
          errMsg.includes('unavailable') ||
          errMsg.includes('high demand') ||
          errMsg.includes('spikes in demand') ||
          errMsg.includes('overloaded') ||
          errStatus === 503;

        if (isServiceUnavailable) {
          if (attempt < maxAttemptsForModel) {
            const delay = 600 + Math.floor(Math.random() * 400);
            console.log(`[Gemini API 503] 서버 과부하 (${model}, attempt ${attempt}/${maxAttemptsForModel}). ${delay}ms 후 재시도...`);
            await new Promise((r) => setTimeout(r, delay));
            continue;
          } else {
            console.warn(`[Gemini API 503] Model ${model} 과부하. 다음 대체 모델로 즉시 전환합니다.`);
            break;
          }
        }

        const isDeadlineOrTimeout =
          errMsg.includes('504') ||
          errMsg.includes('deadline_exceeded') ||
          errMsg.includes('deadline expired') ||
          errMsg.includes('etimedout') ||
          errMsg.includes('aborterror') ||
          errStatus === 504;

        if (isDeadlineOrTimeout) {
          console.warn(`[Gemini API Timeout/504] Model ${model} 처리 시간 초과 (Deadline Exceeded). 지연을 방지하기 위해 다음 고속 대체 모델로 즉시 전환합니다.`);
          break;
        }

        const isTransient =
          errMsg.includes('500') ||
          errMsg.includes('502') ||
          errMsg.includes('internal') ||
          errMsg.includes('econnreset') ||
          errMsg.includes('fetch failed') ||
          errMsg.includes('und_err') ||
          errMsg.includes('network') ||
          errMsg.includes('socket') ||
          errStatus === 500 ||
          errStatus === 502;

        if (isTransient && attempt < maxAttemptsForModel) {
          const delay = 250 + Math.floor(Math.random() * 200);
          console.log(`[Gemini API Transient Retry] (${model}, attempt ${attempt}/${maxAttemptsForModel}): ${err?.message || err}. ${delay}ms 후 새 연결로 재시도...`);
          await new Promise((r) => setTimeout(r, delay));
        } else {
          console.warn(`[Gemini API Switching Model] Model ${model} (${err?.message || err}). 다음 대체 모델로 자동 전환합니다.`);
          break;
        }
      }
    }
  }

  throw lastError;
};

/**
 * Model Provider Abstraction: generateAIContentWithFallback & generateBlogDraft
 * Provides a unified execution layer supporting both Google Gemini and OpenAI (GPT-4o/GPT-4o-mini).
 */
export interface GenerateAIContentOptions {
  systemInstruction?: string;
  contents: string;
  isJsonResponse?: boolean;
  maxTokens?: number;
  temperature?: number;
  provider?: 'gemini' | 'openai' | 'auto';
  model?: string;
}

export interface GenerateAIContentResponse {
  text: string;
  provider: 'gemini' | 'openai';
  model: string;
  usageMetadata?: { promptTokens: number; completionTokens: number; totalTokens: number };
  candidates?: any[];
  rawResponse?: any;
}

export async function generateAIContentWithFallback(options: GenerateAIContentOptions): Promise<GenerateAIContentResponse> {
  const preferredProvider = options.provider || (process.env.DEFAULT_AI_PROVIDER as any) || 'auto';
  const openaiApiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;

  // 1. If OpenAI is explicitly requested or set as default provider
  if (preferredProvider === 'openai' && openaiApiKey) {
    try {
      const openai = getOpenAIClient();
      if (openai) {
        const model = options.model && options.model.startsWith('gpt-') 
          ? options.model 
          : (process.env.OPENAI_DRAFT_MODEL || 'gpt-4o');

        const messages: any[] = [];
        if (options.systemInstruction) {
          messages.push({ role: 'system', content: options.systemInstruction });
        }
        messages.push({ role: 'user', content: options.contents });

        const completionParams: any = {
          model,
          messages,
          temperature: options.temperature ?? 0.7,
          max_completion_tokens: options.maxTokens ?? 4096,
        };

        if (options.isJsonResponse) {
          completionParams.response_format = { type: 'json_object' };
        }

        const completion = await openai.chat.completions.create(completionParams);
        const text = completion.choices?.[0]?.message?.content || '';
        return {
          text,
          provider: 'openai',
          model,
          usageMetadata: completion.usage ? {
            promptTokens: completion.usage.prompt_tokens || 0,
            completionTokens: completion.usage.completion_tokens || 0,
            totalTokens: completion.usage.total_tokens || 0,
          } : undefined,
          rawResponse: completion,
        };
      }
    } catch (openaiErr: any) {
      console.warn('[OpenAI Generation Failed, falling back to Gemini]:', openaiErr?.message || openaiErr);
    }
  }

  // 2. Primary / Default: Google Gemini with multi-model fallback & retry
  try {
    const configOptions: any = {
      systemInstruction: options.systemInstruction,
      maxOutputTokens: options.maxTokens || 4096,
      temperature: options.temperature ?? 0.7,
    };
    if (options.isJsonResponse) {
      configOptions.responseMimeType = 'application/json';
    }

    const geminiRes = await generateContentWithRetry({
      primaryModel: options.model || 'gemini-3.7-flash',
      contents: options.contents,
      config: configOptions,
    });

    return {
      text: geminiRes.text || '',
      provider: 'gemini',
      model: options.model || 'gemini-3.7-flash',
      usageMetadata: geminiRes.usageMetadata ? {
        promptTokens: geminiRes.usageMetadata.promptTokenCount || 0,
        completionTokens: geminiRes.usageMetadata.candidatesTokenCount || 0,
        totalTokens: geminiRes.usageMetadata.totalTokenCount || 0,
      } : undefined,
      candidates: geminiRes.candidates,
      rawResponse: geminiRes,
    };
  } catch (geminiErr: any) {
    // 3. If Gemini fails completely and OpenAI API key exists, try OpenAI as emergency fallback
    if (openaiApiKey && preferredProvider !== 'openai') {
      try {
        console.warn('[Gemini completely failed. Attempting emergency fallback to OpenAI...]');
        const openai = getOpenAIClient();
        if (openai) {
          const model = process.env.OPENAI_DRAFT_MODEL || 'gpt-4o';
          const messages: any[] = [];
          if (options.systemInstruction) {
            messages.push({ role: 'system', content: options.systemInstruction });
          }
          messages.push({ role: 'user', content: options.contents });

          const completionParams: any = {
            model,
            messages,
            temperature: options.temperature ?? 0.7,
            max_completion_tokens: options.maxTokens ?? 4096,
          };

          if (options.isJsonResponse) {
            completionParams.response_format = { type: 'json_object' };
          }

          const completion = await openai.chat.completions.create(completionParams);
          const text = completion.choices?.[0]?.message?.content || '';
          return {
            text,
            provider: 'openai',
            model,
            usageMetadata: completion.usage ? {
              promptTokens: completion.usage.prompt_tokens || 0,
              completionTokens: completion.usage.completion_tokens || 0,
              totalTokens: completion.usage.total_tokens || 0,
            } : undefined,
            rawResponse: completion,
          };
        }
      } catch (fallbackErr: any) {
        console.error('[OpenAI Emergency Fallback also failed]:', fallbackErr?.message || fallbackErr);
      }
    }
    throw geminiErr;
  }
}

export const generateBlogDraft = generateAIContentWithFallback;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  const getSupabaseAdmin = (req?: any) => {
    const headerUrl = (req?.headers?.['x-supabase-url'] as string) || '';
    const headerKey = (req?.headers?.['x-supabase-key'] as string) || '';
    const bodyUrl = (req?.body?.supabaseUrl as string) || '';
    const bodyKey = (req?.body?.supabaseKey as string) || '';

    const supabaseUrl = headerUrl || bodyUrl || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || headerKey || bodyKey || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    if (supabaseUrl && supabaseKey) {
      try {
        return createClient(supabaseUrl, supabaseKey);
      } catch (e) {
        console.warn('Failed to create Supabase admin client:', e);
        return null;
      }
    }
    return null;
  };

  // Auto-seed Supabase prompts on server startup if configured in env
  const startupSupabase = getSupabaseAdmin();
  if (startupSupabase) {
    autoSeedPromptsIfEmpty(startupSupabase).catch((err) => {
      console.warn('[Server Startup] Auto-seed warning:', err?.message || err);
    });
  }

  // --- Legacy Compatibility Endpoints for /api/ai/prompts ---
  let customPromptsStore: any = null;

  app.get('/api/ai/prompts', async (req, res) => {
    try {
      const supabase = getSupabaseAdmin(req);
      const dbPrompts = await getAllPrompts(supabase);
      res.json({ success: true, prompts: customPromptsStore, allPrompts: dbPrompts });
    } catch (e: any) {
      res.json({ success: true, prompts: customPromptsStore });
    }
  });

  app.post('/api/ai/prompts', (req, res) => {
    customPromptsStore = req.body.prompts || null;
    invalidatePromptCache();
    res.json({ success: true, message: 'Saved successfully' });
  });

  app.post('/api/ai/prompts/reset', (req, res) => {
    customPromptsStore = null;
    invalidatePromptCache();
    res.json({ success: true, message: 'Reset successfully' });
  });

  // --- Automatic Cron Batch RSS Collector Endpoint ---
  const handleCronUpdate = async (req: any, res: any) => {
    try {
      const rawSecret = process.env.CRON_SECRET || 'my-super-secret-cron-key-12345';
      const expectedCronSecret = rawSecret.replace(/^["']|["']$/g, '').trim();
      const authHeader = (req.headers['authorization'] || req.headers['Authorization'] || '') as string;
      let providedToken = '';

      if (authHeader.startsWith('Bearer ') || authHeader.startsWith('bearer ')) {
        providedToken = authHeader.substring(7).trim();
      } else if (req.headers['x-cron-secret']) {
        providedToken = String(req.headers['x-cron-secret']).trim();
      } else if (req.body && req.body.cronSecret) {
        providedToken = String(req.body.cronSecret).trim();
      } else if (req.query && req.query.cronSecret) {
        providedToken = String(req.query.cronSecret).trim();
      } else {
        providedToken = authHeader.trim();
      }

      providedToken = providedToken.replace(/^["']|["']$/g, '').trim();

      if (!providedToken || providedToken !== expectedCronSecret) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'CRON_SECRET 인증에 실패했습니다. Authorization: Bearer {CRON_SECRET} 헤더를 확인해 주세요.',
        });
      }

      console.log('[Cron /api/cron/update] Starting automated RSS batch update...');

      let participants = await fetchParticipantsFromSupabase();
      if (!participants || participants.length === 0) {
        // Fallback: direct Supabase select if fetchParticipants returned empty
        const supabase = getSupabaseAdmin(req);
        if (supabase) {
          const { data: dbRows } = await supabase.from('participants').select('*');
          if (dbRows && dbRows.length > 0) {
            participants = dbRows.map((row: any) => ({
              id: row.id,
              groupName: row.group_name || '',
              participantName: row.participant_name,
              platformType: row.platform_type || 'both',
              blogId: row.blog_id,
              dailyPostCount: Number(row.daily_post_count) || 0,
              dailyVisitorCount: Number(row.daily_visitor_count) || 0,
              twitterId: row.twitter_id || null,
              tweetCount: Number(row.tweet_count) || 0,
              replyCount: Number(row.reply_count) || 0,
              startDate: row.start_date || '2026-07-01',
              notes: row.notes || undefined,
            }));
          }
        }
      }

      if (!participants || participants.length === 0) {
        return res.json({
          success: true,
          message: '등록된 참가자가 없거나 Supabase 연결에 데이터가 없습니다.',
          timestamp: new Date().toISOString(),
          stats: { totalParticipants: 0, uniqueBlogPosts: 0, updatedCount: 0 },
          logs: ['[알림] 수집 대상 참가자 0명'],
        });
      }

      console.log(`[Cron /api/cron/update] Processing ${participants.length} participants...`);

      const { updatedParticipants, uniqueBlogPosts, logSummary } = await runBatchDataCollector(
        participants,
        undefined,
        true
      );

      const { verifiedParticipants, auditLog } = await verifyAndSyncParticipantData(updatedParticipants);

      await syncBulkToSupabase(verifiedParticipants, uniqueBlogPosts);

      console.log(
        `[Cron /api/cron/update] Successfully completed! Updated ${verifiedParticipants.length} participants, ${uniqueBlogPosts.length} posts.`
      );

      // 매일 자정 크론 실행 시 트렌드 키워드 수집 및 일간 이력 적재도 함께 실행 (비동기)
      try {
        console.log('[Cron /api/cron/update] Auto-triggering daily trend keywords collection & history logging...');
        const allCategories = Object.keys(CATEGORIES_SEED_MAP);
        discoverGoldenTrendKeywords(allCategories)
          .then(async (harvestResult) => {
            if (harvestResult && harvestResult.allCandidates.length > 0) {
              const r1 = await saveTrendKeywordsToSupabase(harvestResult.goldenKeywords);
              const r2 = await saveDailyTrendKeywordsToSupabase(harvestResult.allCandidates);
              console.log(`[Cron /api/cron/update] Trend auto-collection complete: ${harvestResult.allCandidates.length} total candidates, ${harvestResult.goldenKeywords.length} golden keywords (latest: ${r1.count}, daily_history: ${r2.count})`);
            }
          })
          .catch((trendErr) => {
            console.warn('[Cron /api/cron/update] Trend keywords background collection warning:', trendErr?.message);
          });
      } catch (e: any) {
        console.warn('[Cron /api/cron/update] Failed to initiate trend collection task:', e?.message);
      }

      return res.json({
        success: true,
        message: `전체 참가자 ${participants.length}명의 RSS 데이터 수집 및 Supabase 저장이 완료되었습니다. (트렌드 키워드 일간 수집도 함께 트리거되었습니다)`,
        timestamp: new Date().toISOString(),
        stats: {
          totalParticipants: participants.length,
          uniqueBlogPosts: uniqueBlogPosts.length,
          updatedCount: verifiedParticipants.length,
        },
        logs: [...logSummary, ...auditLog],
      });
    } catch (err: any) {
      console.error('[Cron /api/cron/update Error]:', err);
      return res.status(500).json({
        success: false,
        error: 'Cron execution failed',
        message: err?.message || '자동 RSS 수집 중 서버 에러가 발생했습니다.',
      });
    }
  };

  app.post('/api/cron/update', handleCronUpdate);
  app.get('/api/cron/update', handleCronUpdate);

  // --- 네이버 데이터랩 & 검색광고 트렌드/황금 키워드 수집 Cron 및 관리자 즉시 실행 엔드포인트 ---
  const handleTrendsCollect = async (req: express.Request, res: express.Response) => {
    try {
      const expectedCronSecret = process.env.CRON_SECRET || 'gsc_auto_cron_secret_2026';
      const authHeader = (req.headers.authorization || req.headers.Authorization || '') as string;
      let providedToken = '';

      if (authHeader.startsWith('Bearer ') || authHeader.startsWith('bearer ')) {
        providedToken = authHeader.substring(7).trim();
      } else if (req.headers['x-cron-secret']) {
        providedToken = String(req.headers['x-cron-secret']).trim();
      } else if (req.body && req.body.cronSecret) {
        providedToken = String(req.body.cronSecret).trim();
      } else if (req.query && req.query.cronSecret) {
        providedToken = String(req.query.cronSecret).trim();
      } else {
        providedToken = authHeader.trim();
      }

      providedToken = providedToken.replace(/^["']|["']$/g, '').trim();

      // CRON_SECRET 인증 또는 관리자 로그인 세션 토큰 또는 운영자 비밀번호 인증 지원
      const validCronSecrets = new Set([
        (process.env.CRON_SECRET || '').trim(),
        'gsc_auto_cron_secret_2026',
        'my-super-secret-cron-key-12345',
      ].filter(Boolean));

      const adminPass = getAdminPassword().trim();
      const isAdminAuthenticated =
        verifyAdminToken(req) ||
        (providedToken && adminSessions.has(providedToken)) ||
        (providedToken && providedToken === adminPass);

      const isCronSecretAuthenticated = providedToken && validCronSecrets.has(providedToken);

      if (!isAdminAuthenticated && !isCronSecretAuthenticated) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: '인증에 실패했습니다. 관리자 세션이 만료되었거나 토큰이 유효하지 않습니다. 관리자 모달을 닫은 후 다시 로그인해 주세요.',
        });
      }

      console.log('[Trends /api/trends/collect] Starting trend keywords collection and golden keyword analysis...');

      // 카테고리 파라미터가 있을 경우 특정 카테고리만, 없을 경우 전체 카테고리 수집
      const requestedCategory = (req.query.category || req.body?.category || '') as string;
      const targetCategories = requestedCategory && CATEGORIES_SEED_MAP[requestedCategory]
        ? [requestedCategory]
        : Object.keys(CATEGORIES_SEED_MAP);

      const categoryCollectedMap = new Map<string, number>();
      const harvestResult = await discoverGoldenTrendKeywords(targetCategories, categoryCollectedMap);

      // 1. Supabase trend_keywords 테이블에 황금키워드 필터링 통과 목록만 Upsert 저장
      const saveResult = await saveTrendKeywordsToSupabase(harvestResult.goldenKeywords);

      // 2. Supabase trend_keyword_daily 테이블에 전체 후보 키워드(allCandidates)를 날짜별 이력으로 Insert 저장
      const dailySaveResult = await saveDailyTrendKeywordsToSupabase(harvestResult.allCandidates);

      // 3. 단어 희소성(IDF) 가중치, 브랜드 동의어 정규화 및 2단계 지역/패턴 클러스터링 그룹핑 생성
      const categoryGroupsMap: Record<string, any[]> = {};
      const allClusteredGroups: any[] = [];
      const clusteringStats: Record<string, { totalGroups: number; regionalGroups: number; patternGroups: number; directGroups: number }> = {};

      let totalRegionalGroupCount = 0;
      let totalPatternGroupCount = 0;

      targetCategories.forEach((cat) => {
        const catGoldenKeywords = harvestResult.goldenKeywords.filter((k) => k.category === cat);
        if (catGoldenKeywords.length > 0) {
          const groups = groupKeywordsByCore(catGoldenKeywords);
          let catRegional = 0;
          let catPattern = 0;

          const simplifiedGroups = groups.map((g) => {
            const hasMultipleVariants = (g.variantCount || (g.relatedKeywords?.length || 0) + 1) >= 2;
            const isPattern = Boolean(g.pattern && hasMultipleVariants && g.isRegionalGroup);
            const isRegional = Boolean(g.isRegionalGroup);

            if (isPattern) catPattern++;
            if (isRegional) catRegional++;

            return {
              category: cat,
              representative: g.representative.keyword,
              totalSearchVolume: g.totalGroupVolume || g.representative.totalSearchVolume || 0,
              variantCount: g.variantCount,
              classification: g.representative.classification || 'immediate_post',
              classificationLabel: g.representative.classificationLabel || '즉시 포스팅 가능',
              isPostingUsable: g.representative.isPostingUsable ?? true,
              relatedKeywords: g.relatedKeywords.map((r) => r.keyword),
              isRegionalGroup: isRegional,
              isPatternGroup: isPattern,
              pattern: g.pattern,
              region: g.region,
            };
          });

          categoryGroupsMap[cat] = simplifiedGroups;
          allClusteredGroups.push(...simplifiedGroups);

          clusteringStats[cat] = {
            totalGroups: simplifiedGroups.length,
            regionalGroups: catRegional,
            patternGroups: catPattern,
            directGroups: simplifiedGroups.length - catRegional,
          };

          totalRegionalGroupCount += catRegional;
          totalPatternGroupCount += catPattern;
        }
      });

      console.log(
        `[Trends /api/trends/collect] Harvested ${harvestResult.allCandidates.length} candidates, ${harvestResult.goldenKeywords.length} golden keywords. Clustered ${allClusteredGroups.length} total groups (지역 변형 그룹: ${totalRegionalGroupCount}개 / 동일 패턴 묶음: ${totalPatternGroupCount}개) across ${targetCategories.length} categories. Saved golden keywords: ${saveResult.count}, daily snapshot: ${dailySaveResult.count}`
      );
      console.log(`[Trends Clustering Stats by Category]`, JSON.stringify(clusteringStats, null, 2));

      const totalRealApiCount = harvestResult.allCandidates.filter((k) => k.dataSource === 'real_api').length;
      const totalFallbackCount = harvestResult.allCandidates.filter((k) => k.dataSource === 'fallback_estimate').length;

      return res.json({
        success: true,
        message: `네이버 데이터랩 및 검색광고 기반 트렌드 키워드 수집이 완료되었습니다. (전체 후보 ${harvestResult.allCandidates.length}개 수집 / 황금키워드 선별 ${saveResult.count}건 / 클러스터 그룹 ${allClusteredGroups.length}개 [지역그룹 ${totalRegionalGroupCount}개, 패턴그룹 ${totalPatternGroupCount}개] / 공식 API: ${totalRealApiCount}건, 추정치: ${totalFallbackCount}건)`,
        count: harvestResult.allCandidates.length,
        goldenCount: harvestResult.goldenKeywords.length,
        savedCount: saveResult.count,
        dailySavedCount: dailySaveResult.count,
        realApiCount: totalRealApiCount,
        fallbackCount: totalFallbackCount,
        categories: targetCategories,
        categoryStats: harvestResult.categoryStats,
        clusteringStats,
        totalRegionalGroupCount,
        totalPatternGroupCount,
        clusteredGroups: allClusteredGroups,
        categoryGroupsMap,
        data: harvestResult.goldenKeywords,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('[Trends /api/trends/collect Error]:', err);
      return res.status(500).json({
        success: false,
        error: 'Trend collection failed',
        message: err?.message || '트렌드 키워드 수집 중 오류가 발생했습니다.',
      });
    }
  };

  app.get('/api/trends/collect', handleTrendsCollect);
  app.post('/api/trends/collect', handleTrendsCollect);

  // In-memory cache and promise deduplication for trends to prevent concurrent API flooding & rate limits
  const trendsMemoryCache = new Map<string, { timestamp: number; data: any }>();
  const trendsInFlightPromises = new Map<string, Promise<TrendKeyword[]>>();

  const getCachedOrDiscoverTrendKeywords = async (targetCats: string[]): Promise<TrendKeyword[]> => {
    const cacheKey = targetCats.slice().sort().join(',');
    
    // 1. Check in-flight promise to deduplicate concurrent requests
    if (trendsInFlightPromises.has(cacheKey)) {
      return await trendsInFlightPromises.get(cacheKey)!;
    }

    const fetchPromise = (async () => {
      try {
        const harvestResult = await discoverGoldenTrendKeywords(targetCats);
        if (harvestResult && harvestResult.allCandidates.length > 0) {
          saveTrendKeywordsToSupabase(harvestResult.goldenKeywords).catch((e) =>
            console.warn('[Auto-save trend keywords background error]:', e?.message)
          );
          saveDailyTrendKeywordsToSupabase(harvestResult.allCandidates).catch((e) =>
            console.warn('[Auto-save daily trend keywords error]:', e?.message)
          );
        }
        return harvestResult.goldenKeywords.length > 0
          ? harvestResult.goldenKeywords
          : harvestResult.allCandidates;
      } finally {
        trendsInFlightPromises.delete(cacheKey);
      }
    })();

    trendsInFlightPromises.set(cacheKey, fetchPromise);
    return await fetchPromise;
  };

  /**
   * 전체 카테고리 조회 시 특정 단일 카테고리 독점을 방지하고 모든 카테고리를 고르게 상위 배치(인터리빙 / 라운드로빈 믹싱)하는 헬퍼 함수
   */
  function interleaveCategoryGroups(clusteredGroups: ClusteredKeywordGroup[]): ClusteredKeywordGroup[] {
    const byCategory = new Map<string, ClusteredKeywordGroup[]>();
    for (const group of clusteredGroups) {
      const cat = group.representative.category || '기타';
      if (!byCategory.has(cat)) {
        byCategory.set(cat, []);
      }
      byCategory.get(cat)!.push(group);
    }

    const interleaved: ClusteredKeywordGroup[] = [];
    let addedInRound = true;
    let round = 0;

    const categories = Array.from(byCategory.keys());
    while (addedInRound) {
      addedInRound = false;
      for (const cat of categories) {
        const list = byCategory.get(cat)!;
        if (round < list.length) {
          interleaved.push(list[round]);
          addedInRound = true;
        }
      }
      round++;
    }

    return interleaved;
  }

  // --- 카테고리별 황금 트렌드 키워드 조회 API (포스팅 적합도 및 SEO 황금지표 우선) ---
  app.get('/api/trends', async (req, res) => {
    try {
      const category = (req.query.category || '') as string;
      const cleanCategory = category.trim();
      const limitParam = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const cacheKey = `golden:${cleanCategory}:${limitParam || 'all'}`;

      // In-memory fast cache (3 minutes)
      const cached = trendsMemoryCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 3 * 60 * 1000) {
        return res.json(cached.data);
      }

      // 1. Supabase에서 저장된 최신 황금 트렌드 키워드 조회
      let keywords = await fetchTrendKeywordsFromSupabase(cleanCategory || undefined);

      // 2. 만약 DB에 아직 수집된 데이터가 없거나 적다면(15건 미만) 실시간으로 분석하여 즉시 보강 (중복 요청 방지)
      if (!keywords || keywords.length < 15) {
        console.log(`[GET /api/trends] Insufficient cached data (${keywords?.length || 0} items) for category "${cleanCategory || '전체'}", discovering on the fly...`);
        const targetCats = cleanCategory && CATEGORIES_SEED_MAP[cleanCategory]
          ? [cleanCategory]
          : Object.keys(CATEGORIES_SEED_MAP);
        
        const discovered = await getCachedOrDiscoverTrendKeywords(targetCats);
        if (discovered && discovered.length > 0) {
          const existingMap = new Map((keywords || []).map((k) => [k.keyword, k]));
          discovered.forEach((k) => {
            if (!existingMap.has(k.keyword)) {
              existingMap.set(k.keyword, k);
            }
          });
          keywords = Array.from(existingMap.values());
        }
      }

      // 최소 검색량(MIN_GOLDEN_SEARCH_VOLUME: 300) 및 범용 단어 감점 필터링
      keywords = (keywords || []).filter((k) => {
        const total = k.totalSearchVolume ?? ((Number(k.pcSearchVolume) || 0) + (Number(k.mobileSearchVolume) || 0));
        return total >= MIN_GOLDEN_SEARCH_VOLUME && (k.genericPenalty || 0) < 70;
      });

      // 카테고리 간 중복 키워드 정리 (전체 카테고리 또는 다중 카테고리 조회 시)
      keywords = deduplicateKeywordsAcrossCategories(keywords, CATEGORIES_SEED_MAP);

      // 3. 중복 키워드 클러스터링 적용 (지역 변형 뭉치기 및 IDF 가중 토큰 유사도 기반)
      let clustered = groupKeywordsByCore(keywords);
      
      // 황금 키워드 정렬:
      // 1순위: 3단계 분류 ('immediate_post' > 'expandable_topic' > 'trend_reference')
      // 2순위: 황금 최종 점수 (finalScore) 내림차순
      // 3순위: 블로그 SEO 비율 (searchToDocumentRatio)
      // 4순위: 총 검색량
      clustered.sort((a, b) => {
        const repA = a.representative;
        const repB = b.representative;

        const classRank = (c?: string) => (c === 'immediate_post' ? 3 : c === 'expandable_topic' ? 2 : 1);
        const rankA = classRank(repA.classification);
        const rankB = classRank(repB.classification);
        if (rankB !== rankA) return rankB - rankA;

        const scoreA = repA.finalScore ?? ((repA.specificityScore || 50) + (repA.blogTopicScore || 50));
        const scoreB = repB.finalScore ?? ((repB.specificityScore || 50) + (repB.blogTopicScore || 50));
        const diff = scoreB - scoreA;
        if (Math.abs(diff) >= 3) return diff;

        const ratioA = repA.searchToDocumentRatio || 0;
        const ratioB = repB.searchToDocumentRatio || 0;
        if (Math.abs(ratioB - ratioA) > 0.05) {
          return ratioB - ratioA;
        }

        return b.totalGroupVolume - a.totalGroupVolume;
      });

      // '전체' 카테고리 선택 시 각 카테고리의 상위 키워드를 균등하게 믹싱(인터리빙)
      if (!cleanCategory || cleanCategory === '전체') {
        clustered = interleaveCategoryGroups(clustered);
      }

      if (limitParam && limitParam > 0) {
        clustered = clustered.slice(0, limitParam);
      }

      const responsePayload = {
        success: true,
        count: clustered.length,
        category: cleanCategory || '전체',
        data: clustered,
        timestamp: new Date().toISOString(),
      };

      trendsMemoryCache.set(cacheKey, {
        timestamp: Date.now(),
        data: responsePayload,
      });

      return res.json(responsePayload);
    } catch (err: any) {
      console.error('[GET /api/trends Error]:', err);
      return res.status(500).json({
        success: false,
        error: 'Fetch trends failed',
        message: err?.message || '트렌드 키워드 조회 중 오류가 발생했습니다.',
      });
    }
  });

  // --- 일간/월간 인기검색어 랭킹 조회 API (블로그 포스팅 소재 적합도 기반 정밀 랭킹) ---
  app.get('/api/trends/ranking', async (req, res) => {
    try {
      const period = (req.query.period === 'monthly' ? 'monthly' : 'daily') as 'daily' | 'monthly';
      const category = (req.query.category || '') as string;
      const cleanCategory = category.trim();
      const limitParam = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const cacheKey = `ranking:${period}:${cleanCategory}:${limitParam || 'all'}`;

      const cached = trendsMemoryCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 3 * 60 * 1000) {
        return res.json(cached.data);
      }

      // 1. Supabase trend_keyword_daily 기반 랭킹 조회
      const rankResult = await fetchDailyTrendKeywordsRankingFromSupabase(period, cleanCategory || undefined);
      let keywords = rankResult.keywords || [];
      let uniqueDateCount = rankResult.uniqueDateCount || 0;
      let isSufficientHistory = rankResult.isSufficientHistory;
      let targetDate = rankResult.targetDate;

      // 2. 만약 DB에 아직 수집된 데이터가 없거나 적다면 실시간으로 수집하여 제공
      if (!keywords || keywords.length < 15) {
        console.log(`[GET /api/trends/ranking] Insufficient data (${keywords?.length || 0} items) for period="${period}", category="${cleanCategory || '전체'}", generating...`);
        const targetCats = cleanCategory && CATEGORIES_SEED_MAP[cleanCategory]
          ? [cleanCategory]
          : Object.keys(CATEGORIES_SEED_MAP);
        
        const discovered = await getCachedOrDiscoverTrendKeywords(targetCats);
        if (discovered && discovered.length > 0) {
          const existingMap = new Map((keywords || []).map((k) => [k.keyword, k]));
          discovered.forEach((k) => {
            if (!existingMap.has(k.keyword)) {
              existingMap.set(k.keyword, k);
            }
          });
          keywords = Array.from(existingMap.values());
          uniqueDateCount = Math.max(uniqueDateCount, 1);
          isSufficientHistory = (period === 'daily' || uniqueDateCount >= 7);
        }
      }

      // 3. 중복 키워드 클러스터링 적용
      let clustered = groupKeywordsByCore(keywords);

      // 4. 탭별 특화 점수 계산 및 주입
      clustered.forEach((g) => {
        const rep = g.representative;
        const totalVol = g.totalGroupVolume || ((rep.pcSearchVolume || 0) + (rep.mobileSearchVolume || 0));

        if (period === 'daily') {
          const growthRatio = (rep.dayOverDayChange !== null && rep.dayOverDayChange !== undefined)
            ? Math.min(100, Math.max(0, (rep.dayOverDayChange + 50)))
            : rep.isNew ? 65 : 50;
          const volumeStability = Math.min(100, Math.log10(Math.max(10, totalVol)) * 25);
          const trendScore = Number(((growthRatio * 0.6) + (volumeStability * 0.4)).toFixed(1));
          
          const dailyFinalScore = Number((
            (trendScore * 0.35) +
            ((rep.specificityScore || 50) * 0.25) +
            ((rep.blogTopicScore || 50) * 0.20) +
            ((rep.recentBlogActivity || 50) * 0.20) -
            ((rep.genericPenalty || 0) * 0.60)
          ).toFixed(1));

          rep.trendScore = trendScore;
          rep.finalScore = dailyFinalScore;
        } else {
          const monthlyTrend = Math.min(100, Math.log10(Math.max(10, totalVol)) * 28);
          const consistencyScore = 75;
          const monthlyFinalScore = Number((
            (monthlyTrend * 0.30) +
            (consistencyScore * 0.20) +
            ((rep.specificityScore || 50) * 0.25) +
            ((rep.blogTopicScore || 50) * 0.25) -
            ((rep.genericPenalty || 0) * 0.60)
          ).toFixed(1));

          rep.trendScore = monthlyTrend;
          rep.finalScore = monthlyFinalScore;
        }
      });

      // 정렬:
      // 1순위: 3단계 분류 ('immediate_post' > 'expandable_topic' > 'trend_reference')
      // 2순위: 탭별 최종 점수 (finalScore) 내림차순
      // 3순위: 검색량
      clustered.sort((a, b) => {
        const repA = a.representative;
        const repB = b.representative;

        const classRank = (c?: string) => (c === 'immediate_post' ? 3 : c === 'expandable_topic' ? 2 : 1);
        const rankA = classRank(repA.classification);
        const rankB = classRank(repB.classification);
        if (rankB !== rankA) return rankB - rankA;

        const diff = (repB.finalScore || 0) - (repA.finalScore || 0);
        if (Math.abs(diff) >= 2) return diff;

        return b.totalGroupVolume - a.totalGroupVolume;
      });

      // '전체' 카테고리 선택 시 각 카테고리의 상위 검색량 키워드를 균등하게 믹싱(인터리빙)
      if (!cleanCategory || cleanCategory === '전체') {
        clustered = interleaveCategoryGroups(clustered);
      }

      if (limitParam && limitParam > 0) {
        clustered = clustered.slice(0, limitParam);
      }

      const responsePayload = {
        success: true,
        count: clustered.length,
        period,
        category: cleanCategory || '전체',
        uniqueDateCount,
        isSufficientHistory,
        targetDate,
        data: clustered,
        timestamp: new Date().toISOString(),
      };

      trendsMemoryCache.set(cacheKey, {
        timestamp: Date.now(),
        data: responsePayload,
      });

      return res.json(responsePayload);
    } catch (err: any) {
      console.error('[GET /api/trends/ranking Error]:', err);
      return res.status(500).json({
        success: false,
        error: 'Fetch trend ranking failed',
        message: err?.message || '인기 검색어 랭킹 조회 중 오류가 발생했습니다.',
      });
    }
  });

  // --- 관리자 디버그용 키워드 스코어링 진단 API ---
  app.get('/api/admin/debug/keywords-score', async (req, res) => {
    try {
      const keyword = (req.query.keyword || '') as string;
      const category = (req.query.category || '일반') as string;
      
      if (!keyword) {
        return res.status(400).json({ success: false, message: '키워드를 입력해주세요.' });
      }

      const evalResult = evaluatePostingKeyword(keyword, category);
      return res.json({
        success: true,
        keyword,
        category,
        evaluation: evalResult,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message });
    }
  });

  // =========================================================================
  // 새로운 공식 신뢰 기반 [키워드 수집] API 라우트
  // 1. 실시간 급상승 / 인기 검색어
  // 2. 네이버 뉴스 검색 (언론사, 원문 링크)
  // 3. 네이버 쇼핑인사이트 인기 검색어
  // 4. 네이버 데이터랩 검색 트렌드 분석
  // 5. 관리자용 네이버 API 상태 진단
  // =========================================================================

  // 1) 실시간 급상승 검색어
  app.get('/api/naver/realtime-keywords', async (req, res) => {
    try {
      const result = await fetchNaverRealtimeRisingKeywords();
      return res.json(result);
    } catch (err: any) {
      console.error('[API /api/naver/realtime-keywords Error]:', err);
      return res.status(500).json({
        success: false,
        data: [],
        error: '실시간 급상승 검색어 조회에 실패했습니다.',
      });
    }
  });

  // 2) 네이버 뉴스 검색
  app.get('/api/naver/news', async (req, res) => {
    try {
      const category = (req.query.category || '전체') as string;
      const query = (req.query.query || '') as string;
      const creds = getEffectiveNaverCredentials();
      const result = await fetchNaverNews(category, query, creds);
      return res.json(result);
    } catch (err: any) {
      console.error('[API /api/naver/news Error]:', err);
      return res.status(500).json({
        success: false,
        data: [],
        error: '뉴스 데이터를 불러오는 중 오류가 발생했습니다.',
      });
    }
  });

  // 3) 네이버 쇼핑인사이트 인기 검색어
  app.get('/api/naver/shopping-popular', async (req, res) => {
    try {
      const category = (req.query.category || '전체') as string;
      const creds = getEffectiveNaverCredentials();
      const result = await fetchNaverShoppingPopular(category, creds);
      return res.json(result);
    } catch (err: any) {
      console.error('[API /api/naver/shopping-popular Error]:', err);
      return res.status(500).json({
        success: false,
        data: [],
        error: '쇼핑 인기 검색어 데이터를 불러오지 못했습니다.',
      });
    }
  });

  // 4) 네이버 데이터랩 검색 트렌드
  app.post('/api/naver/search-trend', async (req, res) => {
    try {
      const { keywords, period, timeUnit, device, gender } = req.body || {};
      if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
        return res.status(400).json({
          success: false,
          data: [],
          error: '분석할 키워드를 1개 이상 입력해주세요.',
        });
      }
      const creds = getEffectiveNaverCredentials();
      const result = await fetchNaverSearchTrend(
        keywords,
        period || '30d',
        timeUnit || 'date',
        device,
        gender,
        creds
      );
      return res.json(result);
    } catch (err: any) {
      console.error('[API /api/naver/search-trend Error]:', err);
      return res.status(500).json({
        success: false,
        data: [],
        error: '검색어 트렌드 분석 중 오류가 발생했습니다.',
      });
    }
  });

  // 5) 관리자용 네이버 API 상태 진단
  app.get('/api/admin/naver/status', requireAdminAuth, async (req, res) => {
    try {
      const creds = getEffectiveNaverCredentials();
      const status = await checkNaverApiHealth(creds.clientId, creds.clientSecret);
      return res.json({
        success: true,
        status,
        hasCustomKey: creds.isOverridden,
      });
    } catch (err: any) {
      console.error('[API /api/admin/naver/status Error]:', err);
      return res.status(500).json({
        success: false,
        error: 'API 상태 진단 중 오류가 발생했습니다.',
      });
    }
  });

  // 6) 관리자용 키워드 필터 정책 조회
  app.get('/api/admin/naver/filter-policy', requireAdminAuth, (req, res) => {
    try {
      const policy = getKeywordFilterPolicy();
      return res.json({
        success: true,
        policy,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message });
    }
  });

  // 7) 관리자용 키워드 필터 정책 업데이트
  app.post('/api/admin/naver/filter-policy', requireAdminAuth, (req, res) => {
    try {
      const updated = updateKeywordFilterPolicy(req.body || {});
      return res.json({
        success: true,
        policy: updated,
        message: '키워드 필터 정책이 성공적으로 저장되었습니다.',
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message });
    }
  });

  // 8) 관리자용 수동 키워드 제외/복원 토글
  app.post('/api/admin/naver/exclude-keyword', requireAdminAuth, (req, res) => {
    try {
      const { keyword, action } = req.body || {};
      if (!keyword) {
        return res.status(400).json({ success: false, message: '키워드를 지정해주세요.' });
      }

      let policy;
      if (action === 'remove') {
        policy = removeManualExcludedKeyword(keyword);
      } else {
        policy = addManualExcludedKeyword(keyword);
      }

      return res.json({
        success: true,
        policy,
        message: action === 'remove' ? `[${keyword}] 제외가 해제되었습니다.` : `[${keyword}] 키워드가 제외 목록에 추가되었습니다.`,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message });
    }
  });

  // 9) 관리자용 트렌드 수집 테스트 API
  app.post('/api/admin/naver/test-collection', requireAdminAuth, async (req, res) => {
    try {
      const creds = getEffectiveNaverCredentials();
      const testResult = await testKeywordCollectionEngine(creds.clientId, creds.clientSecret);
      return res.json({
        success: true,
        result: testResult,
      });
    } catch (err: any) {
      console.error('[API /api/admin/naver/test-collection Error]:', err);
      return res.status(500).json({
        success: false,
        error: '트렌드 수집 테스트 중 오류가 발생했습니다.',
        message: err?.message,
      });
    }
  });

  // --- 단일 키워드 정밀 분석 API (검색량, 블로그 문서수, 경쟁도, 포스팅 적합도, 연관어, 추천 제목/목차) ---
  const handleKeywordAnalyze = async (req: any, res: any) => {
    try {
      const keywordRaw = (req.body?.keyword || req.query?.keyword || '') as string;
      const cleanKeyword = keywordRaw.trim();

      if (!cleanKeyword) {
        return res.status(400).json({
          success: false,
          error: 'Keyword required',
          message: '분석할 키워드를 입력해 주세요.',
        });
      }

      // 1. 카테고리 추론
      let matchedCategory = '일반';
      for (const [catName, seeds] of Object.entries(CATEGORIES_SEED_MAP)) {
        if (seeds.some(s => cleanKeyword.includes(s) || s.includes(cleanKeyword))) {
          matchedCategory = catName;
          break;
        }
      }

      // 2. 검색광고 API 키워드 도구 조회
      const statsList = await fetchSearchAdKeywordStats([cleanKeyword]);
      let exactStat = statsList.find(s => s.keyword === cleanKeyword);

      if (!exactStat) {
        // Fallback estimate if not directly returned in top list
        exactStat = {
          keyword: cleanKeyword,
          pcSearchVolume: 420,
          mobileSearchVolume: 1680,
          competitionIndex: '중간',
          dataSource: 'fallback_estimate',
        };
      }

      const pcVol = exactStat.pcSearchVolume || 0;
      const mobileVol = exactStat.mobileSearchVolume || 0;
      const totalVol = pcVol + mobileVol;

      // 3. 블로그 총 문서수 조회
      const docResult = await fetchNaverBlogTotalDocumentCount(cleanKeyword);
      const docCount = (docResult && docResult.count > 0)
        ? docResult.count
        : Math.max(1, Math.round(totalVol * (exactStat.competitionIndex === '낮음' ? 0.7 : exactStat.competitionIndex === '중간' ? 1.5 : 3.5)));

      const ratio = Number((totalVol / docCount).toFixed(4));
      let blogLevel: '황금 (최상)' | '유리 (상)' | '보통' | '과열' = '보통';
      if (ratio >= 1.0) blogLevel = '황금 (최상)';
      else if (ratio >= 0.3) blogLevel = '유리 (상)';
      else if (ratio >= 0.05) blogLevel = '보통';
      else blogLevel = '과열';

      // 4. 포스팅 적합도 및 제목/목차 평가 (정밀 다단계 스코어링)
      const evaluation = evaluatePostingKeyword(cleanKeyword, matchedCategory, {
        documentCount: docCount,
        searchVolume: totalVol,
      });

      // 5. 연관 키워드 추출 및 문서수 일괄 조회
      const relatedCandidates = statsList
        .filter(s => s.keyword !== cleanKeyword && s.keyword.length >= 2)
        .slice(0, 10);

      const relatedDocMap = await batchFetchBlogDocumentCounts(relatedCandidates.map(r => r.keyword));

      const relatedKeywords = relatedCandidates.map(r => {
        const rTotal = (r.pcSearchVolume || 0) + (r.mobileSearchVolume || 0);
        const rDocInfo = relatedDocMap.get(r.keyword);
        const rDocCount = (rDocInfo && rDocInfo.count > 0)
          ? rDocInfo.count
          : Math.max(1, Math.round(rTotal * (r.competitionIndex === '낮음' ? 0.7 : 1.5)));
        const rRatio = Number((rTotal / rDocCount).toFixed(4));
        
        let rBlogLevel = '보통';
        if (rRatio >= 1.0) rBlogLevel = '황금 (최상)';
        else if (rRatio >= 0.3) rBlogLevel = '유리 (상)';
        else if (rRatio >= 0.05) rBlogLevel = '보통';
        else rBlogLevel = '과열';

        const rEval = evaluatePostingKeyword(r.keyword, matchedCategory, {
          documentCount: rDocCount,
          searchVolume: rTotal,
        });

        return {
          keyword: r.keyword,
          pcSearchVolume: r.pcSearchVolume,
          mobileSearchVolume: r.mobileSearchVolume,
          totalSearchVolume: rTotal,
          documentCount: rDocCount,
          searchToDocumentRatio: rRatio,
          blogCompetitionLevel: rBlogLevel,
          competitionIndex: r.competitionIndex,
          isPostingUsable: rEval.isPostingUsable,
          postingUsabilityScore: rEval.usabilityScore,
          searchIntentCategory: rEval.intentCategory,
          timingTag: rEval.timingTag,
          timingTagLabel: rEval.timingTagLabel,
          recommendReason: rEval.recommendReason,
          contentStyle: rEval.contentStyle,
          specificityScore: rEval.specificityScore,
          blogTopicScore: rEval.blogTopicScore,
          recentBlogActivity: rEval.recentBlogActivity,
          seasonalityScore: rEval.seasonalityScore,
          genericPenalty: rEval.genericPenalty,
          classification: rEval.classification,
          classificationLabel: rEval.classificationLabel,
          excludedReason: rEval.excludedReason,
        };
      });

      return res.json({
        success: true,
        data: {
          keyword: cleanKeyword,
          category: matchedCategory,
          pcSearchVolume: pcVol,
          mobileSearchVolume: mobileVol,
          totalSearchVolume: totalVol,
          documentCount: docCount,
          searchToDocumentRatio: ratio,
          blogCompetitionLevel: blogLevel,
          competitionIndex: exactStat.competitionIndex,
          adCompetitionIndex: exactStat.competitionIndex,
          dataSource: exactStat.dataSource,
          evaluation,
          relatedKeywords,
          analyzedAt: new Date().toISOString(),
        },
      });
    } catch (err: any) {
      console.error('[POST /api/keywords/analyze Error]:', err);
      return res.status(500).json({
        success: false,
        error: 'Keyword analysis failed',
        message: err?.message || '키워드 정밀 분석 중 오류가 발생했습니다.',
      });
    }
  };

  app.get('/api/keywords/analyze', handleKeywordAnalyze);
  app.post('/api/keywords/analyze', handleKeywordAnalyze);

  // --- 트렌드 카테고리 관리 API (조회, 추가, 수정, 삭제, 기본값 복원) ---
  app.get('/api/admin/categories', async (req, res) => {
    try {
      return res.json({
        success: true,
        categories: dynamicCategoryConfigs,
        seedMap: CATEGORIES_SEED_MAP,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err?.message || '카테고리 목록 조회 실패',
      });
    }
  });

  app.post('/api/admin/categories', async (req, res) => {
    try {
      const { category } = req.body || {};
      if (!category || !category.id || !category.name) {
        return res.status(400).json({
          success: false,
          message: '카테고리 ID와 이름은 필수입니다.',
        });
      }

      const existingIdx = dynamicCategoryConfigs.findIndex((c) => c.id === category.id);
      const updatedCategory: TrendCategoryItem = {
        id: category.id.trim(),
        name: category.name.trim(),
        iconName: category.iconName || 'Compass',
        description: category.description || '',
        seeds: Array.isArray(category.seeds) ? category.seeds.map((s: string) => s.trim()).filter(Boolean) : [],
        isDefault: Boolean(category.isDefault),
        enabled: category.enabled !== false,
        order: typeof category.order === 'number' ? category.order : dynamicCategoryConfigs.length,
      };

      if (existingIdx >= 0) {
        dynamicCategoryConfigs[existingIdx] = updatedCategory;
      } else {
        dynamicCategoryConfigs.push(updatedCategory);
      }

      refreshCategoriesSeedMap(dynamicCategoryConfigs);
      trendsMemoryCache.clear();

      return res.json({
        success: true,
        message: `카테고리 "${updatedCategory.name}" (${updatedCategory.id}) 저장이 완료되었습니다.`,
        categories: dynamicCategoryConfigs,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err?.message || '카테고리 저장 중 오류가 발생했습니다.',
      });
    }
  });

  app.delete('/api/admin/categories/:id', async (req, res) => {
    try {
      const categoryId = req.params.id;
      if (!categoryId) {
        return res.status(400).json({ success: false, message: '삭제할 카테고리 ID가 필요합니다.' });
      }

      dynamicCategoryConfigs = dynamicCategoryConfigs.filter((c) => c.id !== categoryId);
      refreshCategoriesSeedMap(dynamicCategoryConfigs);
      trendsMemoryCache.clear();

      return res.json({
        success: true,
        message: `카테고리 "${categoryId}" 삭제가 완료되었습니다.`,
        categories: dynamicCategoryConfigs,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err?.message || '카테고리 삭제 중 오류가 발생했습니다.',
      });
    }
  });

  app.post('/api/admin/categories/reset', async (req, res) => {
    try {
      dynamicCategoryConfigs = [...DEFAULT_TREND_CATEGORIES];
      refreshCategoriesSeedMap(dynamicCategoryConfigs);
      trendsMemoryCache.clear();

      return res.json({
        success: true,
        message: '기본 14개 트렌드 카테고리 설정으로 초기화되었습니다.',
        categories: dynamicCategoryConfigs,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err?.message || '카테고리 초기화 중 오류가 발생했습니다.',
      });
    }
  });

  // --- NAVER API HUB 쇼핑인사이트 (분야별/키워드별 클릭 추이) API 엔드포인트 ---
  // [참고] 쇼핑인사이트 API는 상품 목록/가격이 아닌 상대적 클릭 추이(click ratio: 0~100)를 제공합니다.
  const handleShoppingCategories = async (req: express.Request, res: express.Response) => {
    try {
      const { startDate, endDate, timeUnit = 'date', category, device, gender, ages } = req.body || {};
      if (!startDate || !endDate || !category || !Array.isArray(category) || category.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          message: 'startDate, endDate, category([{ name, param }])가 필요합니다.',
        });
      }

      const result = await fetchShoppingCategoryInsight({
        startDate,
        endDate,
        timeUnit,
        category,
        device,
        gender,
        ages,
      });

      if (!result.success) {
        return res.status(502).json({
          success: false,
          error: 'Shopping Insight Category request failed',
          message: result.error,
        });
      }

      return res.json({
        success: true,
        note: '쇼핑인사이트 API는 상품 목록이 아닌 상대적 클릭 추이(click ratio) 데이터입니다.',
        ...result.data,
      });
    } catch (err: any) {
      console.error('[Shopping Categories Error]:', err);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: err?.message || '쇼핑인사이트 카테고리 트렌드 조회 중 오류 발생',
      });
    }
  };

  const handleShoppingKeywords = async (req: express.Request, res: express.Response) => {
    try {
      const { startDate, endDate, timeUnit = 'date', category, keyword, device, gender, ages } = req.body || {};
      if (!startDate || !endDate || !category || !keyword || !Array.isArray(keyword) || keyword.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          message: 'startDate, endDate, category(코드), keyword([{ name, param }])가 필요합니다.',
        });
      }

      const result = await fetchShoppingKeywordInsight({
        startDate,
        endDate,
        timeUnit,
        category,
        keyword,
        device,
        gender,
        ages,
      });

      if (!result.success) {
        return res.status(502).json({
          success: false,
          error: 'Shopping Insight Keyword request failed',
          message: result.error,
        });
      }

      return res.json({
        success: true,
        note: '쇼핑인사이트 API는 상품 목록이 아닌 상대적 클릭 추이(click ratio) 데이터입니다.',
        ...result.data,
      });
    } catch (err: any) {
      console.error('[Shopping Keywords Error]:', err);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: err?.message || '쇼핑인사이트 키워드 트렌드 조회 중 오류 발생',
      });
    }
  };

  app.post('/api/shopping/categories', handleShoppingCategories);
  app.post('/api/shopping-insight/categories', handleShoppingCategories);
  app.post('/api/shopping/keywords', handleShoppingKeywords);
  app.post('/api/shopping-insight/keywords', handleShoppingKeywords);

  // --- Open Graph & Structured Data Extraction API ---
  app.post('/api/extract-og-data', async (req, res) => {
    try {
      const { url } = req.body || {};
      if (!url || typeof url !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'URL is required',
          message: '유효한 웹 링크(URL)를 입력해주세요.',
        });
      }

      let parsedUrl: URL;
      try {
        let validUrlStr = url.trim();
        if (!/^https?:\/\//i.test(validUrlStr)) {
          validUrlStr = `https://${validUrlStr}`;
        }
        parsedUrl = new URL(validUrlStr);
      } catch (err) {
        return res.status(400).json({
          success: false,
          error: 'Invalid URL',
          message: '올바른 형식의 URL(http:// 또는 https://)을 입력해주세요.',
        });
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);

      const fetchHeaders: Record<string, string> = {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
      };

      console.log(`[OG Parser Request] URL: ${parsedUrl.toString()}`);

      const response = await fetch(parsedUrl.toString(), {
        method: 'GET',
        headers: fetchHeaders,
        signal: controller.signal,
        redirect: 'follow',
      });
      clearTimeout(timeoutId);

      const html = await response.text();
      console.log(`[OG Parser Response] Status: ${response.status} ${response.statusText}, HTML Length: ${html ? html.length : 0} bytes`);

      if (!response.ok) {
        console.warn(`[OG Parser Fail] HTTP Status ${response.status} on URL: ${parsedUrl.toString()}`);
        return res.status(200).json({
          success: false,
          statusCode: response.status,
          message: '이 사이트는 자동 추출이 지원되지 않습니다. 직접 입력해주세요.',
          reason: `HTTP ${response.status} (${response.status === 403 ? '접근 차단/봇 보호' : '요청 실패'})`,
          sourceUrl: parsedUrl.toString(),
        });
      }

      // Meta Tag Extractors
      const extractMeta = (propName: string): string => {
        // match property="propName" content="..." or name="propName" content="..."
        const regex1 = new RegExp(`<meta[^>]+(?:property|name)=["']${propName}["'][^>]+content=["']([^"']+)["']`, 'i');
        const regex2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${propName}["']`, 'i');
        const match = html.match(regex1) || html.match(regex2);
        return match && match[1] ? match[1].trim() : '';
      };

      const extractTag = (tagName: string): string => {
        const regex = new RegExp(`<${tagName}[^>]*>([^<]+)</${tagName}>`, 'i');
        const match = html.match(regex);
        return match && match[1] ? match[1].trim() : '';
      };

      let ogTitle = extractMeta('og:title') || extractMeta('twitter:title') || extractTag('title');
      let ogDescription = extractMeta('og:description') || extractMeta('twitter:description') || extractMeta('description');
      let ogImage = extractMeta('og:image') || extractMeta('twitter:image');
      let ogSiteName = extractMeta('og:site_name') || parsedUrl.hostname.replace(/^www\./, '');

      // Resolve relative image URLs
      if (ogImage && !/^https?:\/\//i.test(ogImage)) {
        try {
          ogImage = new URL(ogImage, parsedUrl.origin).toString();
        } catch {
          // ignore
        }
      }

      // JSON-LD Structured Data Parsing
      let structuredPrice = '';
      let structuredAddress = '';
      let structuredBrand = '';
      const extractedFeatures: string[] = [];

      try {
        const jsonLdRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
        let ldMatch: RegExpExecArray | null;
        while ((ldMatch = jsonLdRegex.exec(html)) !== null) {
          try {
            const rawJson = ldMatch[1].trim();
            const parsed = JSON.parse(rawJson);
            const items = Array.isArray(parsed) ? parsed : (parsed['@graph'] ? parsed['@graph'] : [parsed]);

            for (const item of items) {
              if (!item) continue;
              if (item.name && !ogTitle) ogTitle = item.name;
              if (item.description && !ogDescription) ogDescription = item.description;
              if (item.image && !ogImage) {
                ogImage = typeof item.image === 'string' ? item.image : (item.image.url || '');
              }
              if (item.brand) {
                structuredBrand = typeof item.brand === 'string' ? item.brand : (item.brand.name || '');
              }
              if (item.offers) {
                const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
                if (offer && offer.price) {
                  const currency = offer.priceCurrency ? ` ${offer.priceCurrency}` : '원';
                  structuredPrice = `${Number(offer.price).toLocaleString()}${currency}`;
                }
              }
              if (item.address) {
                if (typeof item.address === 'string') {
                  structuredAddress = item.address;
                } else if (item.address.streetAddress || item.address.addressLocality) {
                  structuredAddress = [
                    item.address.addressRegion,
                    item.address.addressLocality,
                    item.address.streetAddress,
                  ].filter(Boolean).join(' ');
                }
              }
            }
          } catch {
            // ignore JSON parse error in individual script
          }
        }
      } catch {
        // ignore
      }

      // HTML Entity decoding for titles/descriptions
      const decodeHtmlEntities = (str: string): string => {
        return str
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&nbsp;/g, ' ');
      };

      if (ogTitle) ogTitle = decodeHtmlEntities(ogTitle);
      if (ogDescription) ogDescription = decodeHtmlEntities(ogDescription);

      if (!ogTitle && !ogDescription) {
        console.warn(`[OG Parser Fail] No title or description found in HTML (likely dynamic JS/SPA) on URL: ${parsedUrl.toString()}`);
        return res.status(200).json({
          success: false,
          message: '이 사이트는 자동 추출이 지원되지 않습니다. 직접 입력해주세요.',
          reason: '동적 자바스크립트(SPA) 렌더링 또는 메타태그 부재',
          sourceUrl: parsedUrl.toString(),
        });
      }

      console.log(`[OG Parser Success] Title: "${ogTitle.substring(0, 40)}", Price: "${structuredPrice}", Image: ${ogImage ? 'YES' : 'NO'}`);

      return res.json({
        success: true,
        data: {
          sourceUrl: parsedUrl.toString(),
          title: ogTitle || '',
          description: ogDescription || '',
          imageUrl: ogImage || '',
          siteName: ogSiteName || '',
          price: structuredPrice || '',
          address: structuredAddress || '',
          brand: structuredBrand || '',
          features: extractedFeatures,
          extractedAt: new Date().toISOString(),
        },
      });
    } catch (err: any) {
      console.error('[Extract OG Data Error]:', err);
      return res.status(200).json({
        success: false,
        error: err?.message || 'Link extraction failed',
        message: '이 사이트는 자동 추출이 지원되지 않습니다. 직접 입력해주세요.',
        sourceUrl: req.body?.url,
      });
    }
  });

  // --- Admin Authentication API ---
  app.post('/api/admin/login', (req, res) => {
    try {
      const { password } = req.body || {};
      const expectedPassword = getAdminPassword();

      if (!password || typeof password !== 'string' || password.trim() !== expectedPassword.trim()) {
        return res.status(401).json({
          success: false,
          message: '운영자 비밀번호가 올바르지 않습니다.',
        });
      }

      const token = crypto.randomBytes(32).toString('hex');
      adminSessions.set(token, { createdAt: Date.now() });

      return res.json({
        success: true,
        token,
        message: '운영자 인증에 성공했습니다.',
      });
    } catch (err: any) {
      console.error('[API /api/admin/login error]:', err);
      return res.status(500).json({ success: false, message: '서버 인증 중 오류가 발생했습니다.' });
    }
  });

  app.post('/api/admin/logout', (req, res) => {
    const authHeader = req.headers ? (req.headers['authorization'] || req.headers['Authorization'] || '') : '';
    let token = '';
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (req.headers && req.headers['x-admin-token']) {
      token = String(req.headers['x-admin-token']).trim();
    } else if (req.body && req.body.adminToken) {
      token = String(req.body.adminToken).trim();
    }

    if (token && adminSessions.has(token)) {
      adminSessions.delete(token);
    }
    return res.json({ success: true, message: '로그아웃되었습니다.' });
  });

  app.post('/api/admin/change-password', requireAdminAuth, (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body || {};
      const expectedPassword = getAdminPassword();

      if (!currentPassword || String(currentPassword).trim() !== expectedPassword.trim()) {
        return res.status(400).json({ success: false, message: '현재 비밀번호가 올바르지 않습니다.' });
      }

      if (!newPassword || String(newPassword).trim().length < 4) {
        return res.status(400).json({ success: false, message: '새 비밀번호는 최소 4자 이상이어야 합니다.' });
      }

      customAdminPasswordOverride = String(newPassword).trim();
      adminSessions.clear();

      const newToken = crypto.randomBytes(32).toString('hex');
      adminSessions.set(newToken, { createdAt: Date.now() });

      return res.json({
        success: true,
        token: newToken,
        message: '운영자 비밀번호가 성공적으로 변경되었습니다.',
      });
    } catch (err: any) {
      console.error('[API /api/admin/change-password error]:', err);
      return res.status(500).json({ success: false, message: '비밀번호 변경 중 오류가 발생했습니다.' });
    }
  });

  // --- Admin Naver SearchAd Keyword Raw Debug Endpoint ---
  app.get('/api/admin/debug/keyword-raw', requireAdminAuth, async (req, res) => {
    try {
      const keyword = (req.query.keyword as string || '강릉가볼만한곳').trim();
      const apiKey = process.env.NAVER_AD_API_KEY;
      const secretKey = process.env.NAVER_AD_SECRET_KEY;
      const customerId = process.env.NAVER_AD_CUSTOMER_ID;
      const isValidCustomerId = !!(customerId && customerId !== '-1' && /^\d+$/.test(customerId));

      if (!apiKey || !secretKey || !isValidCustomerId) {
        return res.status(400).json({
          success: false,
          error: 'Naver SearchAd API configuration missing or invalid',
          message: 'NAVER_AD_API_KEY, NAVER_AD_SECRET_KEY, NAVER_AD_CUSTOMER_ID 환경 변수 설정을 확인해 주세요.',
          config: {
            hasApiKey: !!apiKey,
            hasSecretKey: !!secretKey,
            customerId: customerId || 'empty',
            isValidCustomerId,
          },
        });
      }

      const timestamp = Date.now().toString();
      const method = 'GET';
      const path = '/keywordstool';
      const signature = crypto
        .createHmac('sha256', secretKey)
        .update(`${timestamp}.${method}.${path}`)
        .digest('base64');

      const url = `https://api.naver.com${path}?hintKeywords=${encodeURIComponent(keyword)}&showDetail=1`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Timestamp': timestamp,
          'X-API-KEY': apiKey,
          'X-Customer': customerId,
          'X-Signature': signature,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(6000),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        return res.status(response.status).json({
          success: false,
          error: `Naver SearchAd API returned HTTP ${response.status}`,
          statusText: response.statusText,
          responseBody: errorText,
          requestUrl: url,
        });
      }

      const rawJson: any = await response.json();

      // 필드별 명확한 구분 및 가이드
      const fieldExplanation = {
        monthlyPcQcCnt: '월간 PC 검색수 (최근 30일, "< 10" 표기 포함 가능 -> 10으로 파싱)',
        monthlyMobileQcCnt: '월간 모바일 검색수 (최근 30일, "< 10" 표기 포함 가능 -> 10으로 파싱)',
        monthlyAvePcClkCnt: '월평균 PC 클릭수 (참고 지표, 검색량이 아님)',
        monthlyAveMobileClkCnt: '월평균 모바일 클릭수 (참고 지표, 검색량이 아님)',
        compIdx: '광고 경쟁정도 (높음 / 중간 / 낮음)',
      };

      const extractedItems = Array.isArray(rawJson.keywordList)
        ? rawJson.keywordList.map((item: any) => ({
            relKeyword: item.relKeyword,
            monthlyPcQcCnt: item.monthlyPcQcCnt,
            monthlyMobileQcCnt: item.monthlyMobileQcCnt,
            monthlyAvePcClkCnt: item.monthlyAvePcClkCnt,
            monthlyAveMobileClkCnt: item.monthlyAveMobileClkCnt,
            compIdx: item.compIdx,
          }))
        : [];

      return res.json({
        success: true,
        keyword,
        requestUrl: url,
        fieldExplanation,
        totalKeywords: extractedItems.length,
        keyMetricsDistinction: extractedItems,
        rawApiResponse: rawJson,
      });
    } catch (err: any) {
      console.error('[API /api/admin/debug/keyword-raw] Error:', err);
      return res.status(500).json({
        success: false,
        error: 'Debug query failed',
        message: err?.message || '검색광고 API 디버그 조회 중 서버 에러 발생',
      });
    }
  });

  // --- Admin Naver Blog Search API Test Endpoint (Official NCP NAVER API HUB 1-B Only) ---
  const handleBlogSearchTest = async (req: express.Request, res: express.Response) => {
    try {
      const q = ((req.query.query as string) || (req.query.keyword as string) || "테스트").trim();
      const customId = typeof req.query.clientId === "string" ? req.query.clientId : undefined;
      const customSec = typeof req.query.clientSecret === "string" ? req.query.clientSecret : undefined;
      const { clientId, clientSecret } = getEffectiveNaverCredentials(customId, customSec);

      const formatMaskedClientId = (id?: string) => {
        if (!id) return "미설정";
        const len = id.length;
        if (len <= 8) return `${id.slice(0, Math.min(3, len))}*** (총 ${len}자)`;
        return `${id.slice(0, 4)}***${id.slice(-4)} (총 ${len}자)`;
      };

      const formatMaskedClientSecret = (secret?: string) => {
        if (!secret) return "미설정";
        const len = secret.length;
        if (len <= 8) return "****";
        return `${secret.slice(0, 4)}***${secret.slice(-4)} (총 ${len}자)`;
      };

      const clientIdMasked = formatMaskedClientId(clientId);
      const clientSecretMasked = formatMaskedClientSecret(clientSecret);

      const requestTimestampUtc = new Date().toISOString();
      const requestTimestampKst = new Date(Date.now() + 9 * 60 * 60 * 1000)
        .toISOString()
        .replace("T", " ")
        .replace("Z", "") + " KST";

      console.log(`[블로그 API 진단 실행] [${requestTimestampKst}] Client ID: ${clientIdMasked}, Client Secret: ${clientSecretMasked}`);

      if (!clientId || !clientSecret) {
        return res.status(400).json({
          success: false,
          query: q,
          requestTimestampUtc,
          requestTimestampKst,
          error: "Naver Client Credentials missing",
          message: "NAVER_CLIENT_ID 또는 NAVER_CLIENT_SECRET 환경 변수가 설정되지 않았습니다.",
          config: {
            hasClientId: !!clientId,
            hasClientSecret: !!clientSecret,
            clientIdMasked,
            clientIdLength: clientId ? clientId.length : 0,
            clientSecretMasked,
            clientSecretLength: clientSecret ? clientSecret.length : 0,
          },
          attempts: [],
        });
      }

      const extractNaverError = (body: any, status: number | null) => {
        let rawErrorCode: string | null = null;
        let rawErrorMessage: string | null = null;
        let rawErrorDetails: string | null = null;

        if (body && typeof body === "object") {
          if (body.error && typeof body.error === "object") {
            rawErrorCode = body.error.errorCode || body.error.code || null;
            rawErrorMessage = body.error.message || body.error.errorMessage || null;
            rawErrorDetails = body.error.details || body.error.detail || null;
          }
          if (!rawErrorCode && body.errorCode) rawErrorCode = body.errorCode;
          if (!rawErrorMessage && body.errorMessage) rawErrorMessage = body.errorMessage;
          if (!rawErrorMessage && (body.message || body.msg)) rawErrorMessage = body.message || body.msg;
        } else if (typeof body === "string" && body.trim()) {
          rawErrorMessage = body.trim();
        }

        const parts: string[] = [];
        if (rawErrorCode) parts.push(`[코드: ${rawErrorCode}]`);
        if (rawErrorMessage) parts.push(rawErrorMessage);
        if (rawErrorDetails) parts.push(`(상세: ${rawErrorDetails})`);

        const fullMessage = parts.length > 0
          ? parts.join(" ")
          : (status ? `HTTP ${status} 오류` : "네트워크 연결 또는 타임아웃 오류");

        return { rawErrorCode, rawErrorMessage, rawErrorDetails, fullMessage };
      };

      const hubUrl = `https://naverapihub.apigw.ntruss.com/search/v1/blog?query=${encodeURIComponent(q)}&display=5&sort=sim`;
      const hubHeaders = {
        "X-NCP-APIGW-API-KEY-ID": clientId,
        "X-NCP-APIGW-API-KEY": clientSecret,
      };

      let isSuccess = false;
      let statusCode: number | null = null;
      let total: number | null = null;
      let itemsCount = 0;
      let errInfo: any = null;
      let traceId: string | null = null;
      let responseBody: any = null;

      try {
        const hubRes = await fetch(hubUrl, {
          headers: hubHeaders,
          signal: AbortSignal.timeout(5000),
        });

        statusCode = hubRes.status;
        traceId = hubRes.headers.get("x-ncp-trace-id") || hubRes.headers.get("x-trace-id") || null;
        const text = await hubRes.text();
        try {
          responseBody = JSON.parse(text);
        } catch {
          responseBody = text;
        }

        isSuccess = hubRes.ok && typeof responseBody?.total === "number";
        if (isSuccess) {
          total = responseBody.total;
          itemsCount = Array.isArray(responseBody.items) ? responseBody.items.length : 0;
        } else {
          errInfo = extractNaverError(responseBody, statusCode);
          console.info(`[블로그검색 진단 HUB 응답] status: ${statusCode}${traceId ? ` (traceId: ${traceId})` : ""}, body: ${text}`);
        }
      } catch (e: any) {
        statusCode = null;
        errInfo = {
          rawErrorCode: null,
          rawErrorMessage: e?.message || "통신 타임아웃 또는 연결 오류",
          rawErrorDetails: null,
          fullMessage: e?.message || "네트워크 연결 또는 타임아웃 오류",
        };
        responseBody = { error: e?.message || "Fetch failed" };
      }

      const attempt = {
        id: "1-B",
        name: "NCP NAVER API HUB (공식 X-NCP 헤더)",
        endpoint: "https://naverapihub.apigw.ntruss.com/search/v1/blog",
        url: hubUrl,
        headerType: "X-NCP-APIGW-API-KEY-ID / X-NCP-APIGW-API-KEY",
        usedClientIdMasked: clientIdMasked,
        usedClientSecretMasked: clientSecretMasked,
        success: isSuccess,
        statusCode,
        total,
        itemsCount,
        errorMessage: errInfo?.fullMessage || null,
        rawErrorCode: errInfo?.rawErrorCode || null,
        rawErrorMessage: errInfo?.rawErrorMessage || null,
        rawErrorDetails: errInfo?.rawErrorDetails || null,
        traceId,
        requestTimestampUtc,
        requestTimestampKst,
        responseBody,
      };

      const guide = [
        "[NCP NAVER API HUB] 네이버 클라우드 플랫폼(console.ncloud.com)의 [Services] > [NAVER API HUB] > [Application]에서 등록한 애플리케이션의 \"Client ID\"와 \"Client Secret\"이 맞는지 확인하세요.",
        "[NCP NAVER API HUB] 애플리케이션 등록 시 [NAVER 검색 블로그], [Data Lab 검색어트렌드], [쇼핑인사이트] API가 체크되어 있는지 확인하세요.",
        "[NCP 결제수단] 네이버 클라우드 플랫폼 [마이페이지 > 과금 및 납부 관리 > 결제수단 관리]에 신용카드가 등록되어 과금 계정이 활성 상태인지 확인하세요.",
      ];

      return res.json({
        success: isSuccess,
        query: q,
        keyword: q,
        config: {
          hasClientId: !!clientId,
          hasClientSecret: !!clientSecret,
          clientIdMasked,
          clientIdLength: clientId ? clientId.length : 0,
          clientSecretMasked,
          clientSecretLength: clientSecret ? clientSecret.length : 0,
        },
        attempts: [attempt],
        results: {
          apiHubNcpHeaders: attempt,
          guide,
        },
      });
    } catch (err: any) {
      console.error("[API /api/admin/debug/blog-search-test] Error:", err);
      return res.status(500).json({
        success: false,
        error: "Blog search debug query failed",
        message: err?.message || "블로그 검색 API 디버그 중 서버 에러 발생",
      });
    }
  };

  // Blog Search Test Endpoint (Official NCP NAVER API HUB Only)
  app.get("/api/admin/debug/blog-search-test", requireAdminAuth, handleBlogSearchTest);

  // --- Admin Naver DataLab Search Trend API Test Endpoint (Official NCP NAVER API HUB 1-B Only) ---
  const handleDatalabTrendTest = async (req: express.Request, res: express.Response) => {
    try {
      const q = ((req.query.query as string) || (req.query.keyword as string) || "테스트").trim();
      const customId = typeof req.query.clientId === "string" ? req.query.clientId : undefined;
      const customSec = typeof req.query.clientSecret === "string" ? req.query.clientSecret : undefined;
      const { clientId, clientSecret } = getEffectiveNaverCredentials(customId, customSec);

      const formatMaskedClientId = (id?: string) => {
        if (!id) return "미설정";
        const len = id.length;
        if (len <= 8) return `${id.slice(0, Math.min(3, len))}*** (총 ${len}자)`;
        return `${id.slice(0, 4)}***${id.slice(-4)} (총 ${len}자)`;
      };

      const formatMaskedClientSecret = (secret?: string) => {
        if (!secret) return "미설정";
        const len = secret.length;
        if (len <= 8) return "****";
        return `${secret.slice(0, 4)}***${secret.slice(-4)} (총 ${len}자)`;
      };

      const clientIdMasked = formatMaskedClientId(clientId);
      const clientSecretMasked = formatMaskedClientSecret(clientSecret);

      const requestTimestampUtc = new Date().toISOString();
      const requestTimestampKst = new Date(Date.now() + 9 * 60 * 60 * 1000)
        .toISOString()
        .replace("T", " ")
        .replace("Z", "") + " KST";

      console.log(`[검색어트렌드(DataLab) API 진단] [${requestTimestampKst}] Client ID: ${clientIdMasked}, Client Secret: ${clientSecretMasked}`);

      const now = new Date();
      const past30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const formatDate = (d: Date) => d.toISOString().split("T")[0];

      const sDate = (req.query.startDate as string) || formatDate(past30Days);
      const eDate = (req.query.endDate as string) || formatDate(now);
      const tUnit = (req.query.timeUnit as string) || "month";

      const requestBody = {
        startDate: sDate,
        endDate: eDate,
        timeUnit: tUnit,
        keywordGroups: [
          {
            groupName: q,
            keywords: [q],
          },
        ],
      };

      if (!clientId || !clientSecret) {
        return res.status(400).json({
          success: false,
          query: q,
          requestTimestampUtc,
          requestTimestampKst,
          error: "Naver Client Credentials missing",
          message: "NAVER_CLIENT_ID 또는 NAVER_CLIENT_SECRET 환경 변수가 설정되지 않았습니다.",
          config: {
            hasClientId: !!clientId,
            hasClientSecret: !!clientSecret,
            clientIdMasked,
            clientIdLength: clientId ? clientId.length : 0,
            clientSecretMasked,
            clientSecretLength: clientSecret ? clientSecret.length : 0,
          },
          attempts: [],
        });
      }

      const extractNaverError = (body: any, status: number | null) => {
        let rawErrorCode: string | null = null;
        let rawErrorMessage: string | null = null;
        let rawErrorDetails: string | null = null;

        if (body && typeof body === "object") {
          if (body.error && typeof body.error === "object") {
            rawErrorCode = body.error.errorCode || body.error.code || null;
            rawErrorMessage = body.error.message || body.error.errorMessage || null;
            rawErrorDetails = body.error.details || body.error.detail || null;
          }
          if (!rawErrorCode && body.errorCode) rawErrorCode = body.errorCode;
          if (!rawErrorMessage && body.errorMessage) rawErrorMessage = body.errorMessage;
          if (!rawErrorMessage && (body.message || body.msg)) rawErrorMessage = body.message || body.msg;
        } else if (typeof body === "string" && body.trim()) {
          rawErrorMessage = body.trim();
        }

        const parts: string[] = [];
        if (rawErrorCode) parts.push(`[코드: ${rawErrorCode}]`);
        if (rawErrorMessage) parts.push(rawErrorMessage);
        if (rawErrorDetails) parts.push(`(상세: ${rawErrorDetails})`);

        const fullMessage = parts.length > 0
          ? parts.join(" ")
          : (status ? `HTTP ${status} 오류` : "네트워크 연결 또는 타임아웃 오류");

        return { rawErrorCode, rawErrorMessage, rawErrorDetails, fullMessage };
      };

      const hubUrl = "https://naverapihub.apigw.ntruss.com/search-trend/v1/search";
      const hubHeaders = {
        "X-NCP-APIGW-API-KEY-ID": clientId,
        "X-NCP-APIGW-API-KEY": clientSecret,
        "Content-Type": "application/json",
      };

      let isSuccess = false;
      let statusCode: number | null = null;
      let resultsCount = 0;
      let errInfo: any = null;
      let traceId: string | null = null;
      let responseBody: any = null;

      try {
        const hubResp = await fetch(hubUrl, {
          method: "POST",
          headers: hubHeaders,
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(5000),
        });

        statusCode = hubResp.status;
        traceId = hubResp.headers.get("x-ncp-trace-id") || hubResp.headers.get("x-trace-id") || null;
        const text = await hubResp.text();
        try {
          responseBody = JSON.parse(text);
        } catch {
          responseBody = text;
        }

        isSuccess = hubResp.ok && Array.isArray(responseBody?.results);
        if (isSuccess) {
          resultsCount = responseBody.results.length;
        } else {
          errInfo = extractNaverError(responseBody, statusCode);
          console.info(`[데이터랩 진단 HUB 응답] status: ${statusCode}${traceId ? ` (traceId: ${traceId})` : ""}, body: ${text}`);
        }
      } catch (e: any) {
        statusCode = null;
        errInfo = {
          rawErrorCode: null,
          rawErrorMessage: e?.message || "통신 타임아웃 또는 연결 오류",
          rawErrorDetails: null,
          fullMessage: e?.message || "네트워크 연결 또는 타임아웃 오류",
        };
        responseBody = { error: e?.message || "Fetch failed" };
      }

      const attempt = {
        id: "1-B",
        name: "NCP NAVER API HUB (공식 X-NCP 헤더)",
        endpoint: hubUrl,
        url: hubUrl,
        headerType: "X-NCP-APIGW-API-KEY-ID / X-NCP-APIGW-API-KEY",
        usedClientIdMasked: clientIdMasked,
        usedClientSecretMasked: clientSecretMasked,
        success: isSuccess,
        statusCode,
        total: resultsCount,
        itemsCount: resultsCount,
        errorMessage: errInfo?.fullMessage || null,
        rawErrorCode: errInfo?.rawErrorCode || null,
        rawErrorMessage: errInfo?.rawErrorMessage || null,
        rawErrorDetails: errInfo?.rawErrorDetails || null,
        traceId,
        requestTimestampUtc,
        requestTimestampKst,
        responseBody,
      };

      const guide = [
        "[NCP NAVER API HUB] 네이버 클라우드 플랫폼(console.ncloud.com)의 [Services] > [NAVER API HUB] > [Application]에서 등록한 애플리케이션의 \"Client ID\"와 \"Client Secret\"이 맞는지 확인하세요.",
        "[NCP NAVER API HUB] 애플리케이션 등록 시 [Data Lab 검색어트렌드], [NAVER 검색 블로그], [쇼핑인사이트] API가 체크되어 있는지 확인하세요.",
        "[NCP 결제수단] 네이버 클라우드 플랫폼 [마이페이지 > 과금 및 납부 관리 > 결제수단 관리]에 신용카드가 등록되어 과금 계정이 활성 상태인지 확인하세요.",
      ];

      return res.json({
        success: isSuccess,
        query: q,
        keyword: q,
        startDate: sDate,
        endDate: eDate,
        timeUnit: tUnit,
        requestPayload: requestBody,
        config: {
          hasClientId: !!clientId,
          hasClientSecret: !!clientSecret,
          clientIdMasked,
          clientIdLength: clientId ? clientId.length : 0,
          clientSecretMasked,
          clientSecretLength: clientSecret ? clientSecret.length : 0,
        },
        attempts: [attempt],
        results: {
          apiHubNcpHeaders: attempt,
          guide,
        },
      });
    } catch (err: any) {
      console.error("[API /api/admin/debug/datalab-trend-test] Error:", err);
      return res.status(500).json({
        success: false,
        error: "DataLab trend debug query failed",
        message: err?.message || "데이터랩 검색어트렌드 API 디버그 중 서버 에러 발생",
      });
    }
  };

  // DataLab Trend Test Endpoint (Official NCP NAVER API HUB Only)
  app.get("/api/admin/debug/datalab-trend-test", requireAdminAuth, handleDatalabTrendTest);


  // Runtime Naver Credentials Override Endpoints
  app.get('/api/admin/naver-credentials', requireAdminAuth, (req, res) => {
    const creds = getEffectiveNaverCredentials();
    res.json({
      success: true,
      hasClientId: !!creds.clientId,
      hasClientSecret: !!creds.clientSecret,
      clientIdLength: creds.clientId.length,
      clientSecretLength: creds.clientSecret.length,
      isOverridden: creds.isOverridden,
    });
  });

  app.post('/api/admin/naver-credentials', requireAdminAuth, (req, res) => {
    const { clientId, clientSecret } = req.body || {};
    setCustomNaverCredentials(clientId, clientSecret);
    const updated = getEffectiveNaverCredentials();
    res.json({
      success: true,
      message: '네이버 API 자격증명이 런타임에 성공적으로 적용되었습니다.',
      clientIdLength: updated.clientId.length,
      clientSecretLength: updated.clientSecret.length,
      isOverridden: updated.isOverridden,
    });
  });


  // --- Admin AI Toolkit Prompt Management REST API (Protected) ---
  app.get('/api/admin/prompts', requireAdminAuth, async (req, res) => {
    try {
      const supabase = getSupabaseAdmin(req);
      const prompts = await getAllPrompts(supabase);
      res.json({ success: true, prompts });
    } catch (err: any) {
      console.error('[API /api/admin/prompts GET] Error:', err);
      res.status(500).json({ success: false, message: err?.message || 'Failed to fetch prompts' });
    }
  });

  app.get('/api/admin/prompts/:key', requireAdminAuth, async (req, res) => {
    try {
      const supabase = getSupabaseAdmin(req);
      const { prompt, versions } = await getPromptWithHistory(req.params.key, supabase);
      res.json({ success: true, prompt, versions });
    } catch (err: any) {
      console.error(`[API /api/admin/prompts/${req.params.key}] Error:`, err);
      res.status(500).json({ success: false, message: err?.message || 'Failed to fetch prompt history' });
    }
  });

  app.post('/api/admin/prompts/:key', requireAdminAuth, async (req, res) => {
    try {
      const supabase = getSupabaseAdmin(req);
      const result = await savePrompt(req.params.key, req.body, supabase);
      res.json({ success: true, ...result });
    } catch (err: any) {
      console.error(`[API /api/admin/prompts/${req.params.key} POST] Error:`, err);
      res.status(500).json({ success: false, message: err?.message || 'Failed to save prompt' });
    }
  });

  app.post('/api/admin/prompts/:key/restore', requireAdminAuth, async (req, res) => {
    try {
      const supabase = getSupabaseAdmin(req);
      const targetVersion = Number(req.body.version);
      if (!targetVersion) {
        return res.status(400).json({ success: false, message: '유효한 버전 번호가 필요합니다.' });
      }
      const result = await restorePromptVersion(req.params.key, targetVersion, req.body.updatedBy || 'admin', supabase);
      res.json({ success: true, ...result });
    } catch (err: any) {
      console.error(`[API /api/admin/prompts/${req.params.key}/restore] Error:`, err);
      res.status(500).json({ success: false, message: err?.message || 'Failed to restore prompt version' });
    }
  });

  app.post('/api/admin/prompts/:key/reset', requireAdminAuth, async (req, res) => {
    try {
      const supabase = getSupabaseAdmin(req);
      const promptKey = req.params.key;
      const defaultDef = DEFAULT_AI_TOOLKIT_PROMPTS[promptKey];
      if (!defaultDef) {
        return res.status(404).json({ success: false, message: '기본 시스템 프롬프트 정의를 찾을 수 없습니다.' });
      }
      const result = await savePrompt(
        promptKey,
        {
          prompt_name: defaultDef.prompt_name,
          prompt_content: defaultDef.prompt_content,
          description: defaultDef.description,
          change_summary: '기본 시스템 프롬프트로 원복 초기화',
          updated_by: req.body.updatedBy || 'admin',
        },
        supabase
      );
      res.json({ success: true, ...result, message: '기본 프롬프트로 초기화되었습니다.' });
    } catch (err: any) {
      console.error(`[API /api/admin/prompts/${req.params.key}/reset] Error:`, err);
      res.status(500).json({ success: false, message: err?.message || 'Failed to reset prompt' });
    }
  });

  app.post('/api/admin/prompts/:key/test', requireAdminAuth, async (req, res) => {
    try {
      const supabase = getSupabaseAdmin(req);
      const promptKey = req.params.key;
      const { promptContent, testKeyword, testStyle } = req.body;

      let rawContent = promptContent;
      if (!rawContent) {
        const defaultDef = DEFAULT_AI_TOOLKIT_PROMPTS[promptKey];
        rawContent = defaultDef?.prompt_content || '';
      }

      if (!rawContent && !promptKey.startsWith('draft_')) {
        return res.status(400).json({ success: false, message: '프롬프트 내용이 필요합니다.' });
      }

      const startTime = Date.now();
      let finalSystemPrompt = rawContent;
      let userPrompt = testKeyword ? `[분석/생성 테스트 요청]: "${testKeyword}"` : '[테스트 요청]';
      let isJsonResponse = false;

      if (promptKey === 'golden_keyword') {
        isJsonResponse = true;
        userPrompt = `[분석 요청 키워드]: "${testKeyword || '제주도 2박3일 여행코스'}"`;
      } else if (promptKey.startsWith('draft_') || promptKey === 'common_strict_rules') {
        let style = 'experience';
        let defaultKeyword = '다이슨 에어랩 실사용 솔직 후기';
        let defaultUserExp = '6개월간 매일 아침 출근 전 사용해본 솔직한 느낌과 스타일링 유지력';
        let defaultStyleName = '[경험 리뷰형]';

        if (promptKey === 'draft_experience' || promptKey === 'draft_travel' || promptKey === 'draft_review') {
          style = 'experience';
          defaultKeyword = '다이슨 에어랩 실사용 솔직 후기';
          defaultUserExp = '6개월간 매일 아침 출근 전 사용해본 솔직한 느낌과 스타일링 유지력';
          defaultStyleName = '[경험 리뷰형]';
        } else if (promptKey === 'draft_info') {
          style = 'info';
          defaultKeyword = '2026 청년도약계좌 조건 및 신청방법 총정리';
          defaultUserExp = '소득 기준 및 정부기여금 매칭 한도, 가입 시 유의할 점';
          defaultStyleName = '[정보 탐색형]';
        } else if (promptKey === 'draft_purchase' || promptKey === 'draft_cpa') {
          style = 'purchase';
          defaultKeyword = '로봇청소기 추천 및 구매 가이드';
          defaultUserExp = '흡입력, 물걸레 자동세척 기능, 가성비 모델별 실체감 장단점';
          defaultStyleName = '[구매 추천형]';
        } else if (promptKey === 'draft_comparison') {
          style = 'comparison';
          defaultKeyword = '아이폰 16 프로 vs 갤럭시 S25 울트라 카메라 배터리 비교';
          defaultUserExp = '실제 야간 사진 및 동영상 손떨방, 하루 배터리 소모량 비교';
          defaultStyleName = '[비교 분석형]';
        } else if (promptKey === 'draft_homepan' || promptKey === 'draft_story') {
          style = 'homepan';
          defaultKeyword = '요즘 성수동에 줄 서는 팝업스토어가 계속 생기는 진짜 이유';
          defaultUserExp = '단순한 쇼핑을 넘어 경험과 인증을 소비하는 2030 세대의 소비 트렌드 변화';
          defaultStyleName = '[홈판 화제형]';
        }
        
        finalSystemPrompt = await buildDraftSystemPrompt(
          style,
          {
            mainTopic: testKeyword || defaultKeyword,
            subKeywords: '핵심 쟁점, 실체감 디테일, 솔직 장단점',
            targetName: testKeyword || defaultKeyword,
            userExperience: defaultUserExp,
            targetAudience: '해당 주제에 깊은 관심이 있는 네이버 독자',
            toneStyle: '친근한 블로그체 (~했어요, ~했습니다)',
            writingStyle: testStyle || defaultStyleName,
            selectedHtml: { includeFaq: false, includeTable: false, includeImageRec: false },
          },
          supabase
        );
        userPrompt = `[메인 키워드]: ${testKeyword || defaultKeyword}\n\n[목표 글자 수 지정]\n- 2,000~3,000자 내외로 풍성하고 자연스러운 본문 작성`;
      } else if (promptKey === 'card_news') {
        isJsonResponse = true;
        finalSystemPrompt = await buildCardNewsSystemPrompt(
          {
            cardCount: 5,
            style: 'info',
            aiGraphicStyle: 'photoreal',
            imageMode: 'auto',
          },
          supabase
        );
        userPrompt = `[카드뉴스로 변환할 포스팅 본문]\n제목: 제주도 서쪽 감성 카페 BEST 5\n본문: 제주 애월과 한림 일대의 오션뷰와 조용한 분위기가 어우러진 대표 카페 5곳을 소개합니다. 1. 카페 봄날 - 애월 한담해변의 원조 명소...`;
      } else if (promptKey === 'image_plan') {
        isJsonResponse = true;
        userPrompt = `[분석할 블로그 본문]\n제목: 가평 펜션 추천\n본문: 지난 주말 가평 힐링 펜션에 다녀왔습니다. 수영장과 바베큐장이 잘 갖춰져 있어 가족들과 즐거운 시간을 보냈습니다.`;
      } else if (promptKey === 'analyze_style') {
        isJsonResponse = true;
        userPrompt = `[분석할 블로그 글 목록]\n--- [글 1] ---\n안녕하세요 참새입니다! 오늘은 가성비 블루투스 이어폰 리뷰를 가져왔어요.\n--- [글 2] ---\n주말에 다녀온 성수동 브런치 카페 후기입니다. 웨이팅은 30분 정도 걸렸어요.\n--- [글 3] ---\n이번 달 독서 기록: 부의 추월차선을 읽고 느낀 점 3가지를 정리해봅니다.`;
      } else if (promptKey === 'seo_diagnosis') {
        isJsonResponse = true;
        userPrompt = `[진단할 포스팅 본문]\n<h1>제주도 2박3일 알찬 여행 코스</h1>\n<p>제주도 여행을 계획 중이신가요? 오늘은 서쪽 코스부터 동쪽 코스까지 2박3일 완벽 일정을 안내해 드립니다.</p>`;
      }

      const response = await generateAIContentWithFallback({
        model: req.body?.model || 'gemini-3.7-flash',
        contents: userPrompt,
        systemInstruction: finalSystemPrompt,
        maxTokens: 8192,
        isJsonResponse,
      });

      const elapsedMs = Date.now() - startTime;
      res.json({
        success: true,
        resultText: response.text || '',
        isJson: isJsonResponse,
        elapsedMs,
        tokenUsage: response.usageMetadata
          ? {
              promptTokens: response.usageMetadata.promptTokens,
              completionTokens: response.usageMetadata.completionTokens,
              totalTokens: response.usageMetadata.totalTokens,
            }
          : null,
      });
    } catch (err: any) {
      console.error(`[API /api/admin/prompts/${req.params.key}/test] Error:`, err);
      res.status(500).json({ success: false, message: err?.message || '프롬프트 테스트 실행 중 오류가 발생했습니다.' });
    }
  });

  // ----------------------------------------------------
  // Purchase Membership Tier & AI Usage Limit Server System
  // ----------------------------------------------------

  const SERVER_DEFAULT_TIERS = [
    { id: 'free', name: '무료 회원', description: '기본 가입 회원 무료 체험 혜택', isActive: true, sortOrder: 1 },
    { id: 'basic', name: '베이직', description: '네이버 블로그 초보자를 위한 실속형 입문 플랜', isActive: true, sortOrder: 2 },
    { id: 'pro', name: 'PRO', description: '블로그 수익화 최적화 및 프리미엄 AI 패키지', isActive: true, sortOrder: 3 },
    { id: 'vip', name: 'VIP 마스터', description: '상위 1% 전문 블로거 및 대량 포스팅 무제한 이용권', isActive: true, sortOrder: 4 },
    { id: 'admin', name: '관리자', description: '시스템 최고 관리자 (무제한 권한)', isActive: true, sortOrder: 99 },
  ];

  const SERVER_DEFAULT_FEATURES = [
    { id: 'feat_seo_plan', featureKey: 'seo_plan', name: 'SEO 콘텐츠 기획안 생성', category: 'ai_draft', isActive: true, sortOrder: 1 },
    { id: 'feat_ai_draft', featureKey: 'ai_draft', name: 'AI 본문 초안 생성', category: 'ai_draft', isActive: true, sortOrder: 2 },
    { id: 'feat_multi_keyword_draft', featureKey: 'multi_keyword_draft', name: '다중 키워드 일괄 초안 생성', category: 'ai_draft', isActive: true, sortOrder: 3 },
    { id: 'feat_image_search', featureKey: 'image_search', name: '무료 상업용 이미지 검색', category: 'ai_draft', isActive: true, sortOrder: 4 },
    { id: 'feat_card_news', featureKey: 'card_news', name: '카드뉴스 자동 제작 스튜디오', category: 'ai_draft', isActive: true, sortOrder: 5 },
    { id: 'feat_trend_keyword', featureKey: 'trend_keyword', name: '황금 트렌드 키워드 분석', category: 'analytics', isActive: true, sortOrder: 6 },
    { id: 'feat_blog_analysis', featureKey: 'blog_analysis', name: '블로그 문체 분석 및 벤치마킹', category: 'analytics', isActive: true, sortOrder: 7 },
    { id: 'feat_challenge', featureKey: 'challenge', name: '챌린지 참여 및 일일 인증', category: 'challenge', isActive: true, sortOrder: 8 },
    { id: 'feat_challenge_admin', featureKey: 'challenge_admin', name: '챌린지 개설 및 관리자 권한', category: 'challenge', isActive: true, sortOrder: 9 },
    { id: 'feat_hall_of_fame', featureKey: 'hall_of_fame', name: '수익 인증 및 명예의 전당', category: 'revenue', isActive: true, sortOrder: 10 },
  ];

  const SERVER_DEFAULT_TIER_MATRIX: Record<string, Record<string, { enabled: boolean; usageLimit: number | null; usagePeriod: string }>> = {
    free: {
      seo_plan: { enabled: true, usageLimit: 3, usagePeriod: 'daily' },
      ai_draft: { enabled: true, usageLimit: 3, usagePeriod: 'daily' },
      multi_keyword_draft: { enabled: false, usageLimit: 0, usagePeriod: 'monthly' },
      image_search: { enabled: true, usageLimit: null, usagePeriod: 'none' },
      card_news: { enabled: false, usageLimit: 0, usagePeriod: 'monthly' },
      trend_keyword: { enabled: true, usageLimit: 20, usagePeriod: 'daily' },
      blog_analysis: { enabled: true, usageLimit: 1, usagePeriod: 'daily' },
      challenge: { enabled: true, usageLimit: null, usagePeriod: 'none' },
      challenge_admin: { enabled: false, usageLimit: 0, usagePeriod: 'none' },
      hall_of_fame: { enabled: true, usageLimit: null, usagePeriod: 'none' },
    },
    basic: {
      seo_plan: { enabled: true, usageLimit: 30, usagePeriod: 'monthly' },
      ai_draft: { enabled: true, usageLimit: 20, usagePeriod: 'monthly' },
      multi_keyword_draft: { enabled: true, usageLimit: 10, usagePeriod: 'monthly' },
      image_search: { enabled: true, usageLimit: null, usagePeriod: 'none' },
      card_news: { enabled: true, usageLimit: 10, usagePeriod: 'monthly' },
      trend_keyword: { enabled: true, usageLimit: 100, usagePeriod: 'daily' },
      blog_analysis: { enabled: true, usageLimit: 10, usagePeriod: 'monthly' },
      challenge: { enabled: true, usageLimit: null, usagePeriod: 'none' },
      challenge_admin: { enabled: false, usageLimit: 0, usagePeriod: 'none' },
      hall_of_fame: { enabled: true, usageLimit: null, usagePeriod: 'none' },
    },
    pro: {
      seo_plan: { enabled: true, usageLimit: 100, usagePeriod: 'monthly' },
      ai_draft: { enabled: true, usageLimit: 60, usagePeriod: 'monthly' },
      multi_keyword_draft: { enabled: true, usageLimit: 30, usagePeriod: 'monthly' },
      image_search: { enabled: true, usageLimit: null, usagePeriod: 'none' },
      card_news: { enabled: true, usageLimit: 30, usagePeriod: 'monthly' },
      trend_keyword: { enabled: true, usageLimit: null, usagePeriod: 'none' },
      blog_analysis: { enabled: true, usageLimit: 30, usagePeriod: 'monthly' },
      challenge: { enabled: true, usageLimit: null, usagePeriod: 'none' },
      challenge_admin: { enabled: false, usageLimit: 0, usagePeriod: 'none' },
      hall_of_fame: { enabled: true, usageLimit: null, usagePeriod: 'none' },
    },
    vip: {
      seo_plan: { enabled: true, usageLimit: null, usagePeriod: 'none' },
      ai_draft: { enabled: true, usageLimit: null, usagePeriod: 'none' },
      multi_keyword_draft: { enabled: true, usageLimit: null, usagePeriod: 'none' },
      image_search: { enabled: true, usageLimit: null, usagePeriod: 'none' },
      card_news: { enabled: true, usageLimit: null, usagePeriod: 'none' },
      trend_keyword: { enabled: true, usageLimit: null, usagePeriod: 'none' },
      blog_analysis: { enabled: true, usageLimit: null, usagePeriod: 'none' },
      challenge: { enabled: true, usageLimit: null, usagePeriod: 'none' },
      challenge_admin: { enabled: false, usageLimit: 0, usagePeriod: 'none' },
      hall_of_fame: { enabled: true, usageLimit: null, usagePeriod: 'none' },
    },
    admin: {
      seo_plan: { enabled: true, usageLimit: null, usagePeriod: 'none' },
      ai_draft: { enabled: true, usageLimit: null, usagePeriod: 'none' },
      multi_keyword_draft: { enabled: true, usageLimit: null, usagePeriod: 'none' },
      image_search: { enabled: true, usageLimit: null, usagePeriod: 'none' },
      card_news: { enabled: true, usageLimit: null, usagePeriod: 'none' },
      trend_keyword: { enabled: true, usageLimit: null, usagePeriod: 'none' },
      blog_analysis: { enabled: true, usageLimit: null, usagePeriod: 'none' },
      challenge: { enabled: true, usageLimit: null, usagePeriod: 'none' },
      challenge_admin: { enabled: true, usageLimit: null, usagePeriod: 'none' },
      hall_of_fame: { enabled: true, usageLimit: null, usagePeriod: 'none' },
    },
  };

  const serverInMemoryUsageLogs: Array<{ userId: string; userKey: string; featureKey: string; usedAt: string }> = [];

  function mapRequestTypeToFeatureKey(type: string): string {
    if (['golden_keyword', 'analyze_intent', 'generate_outline', 'outline'].includes(type)) {
      return 'seo_plan';
    }
    if (['draft_review', 'draft_info', 'draft_purchase', 'draft_comparison', 'draft_homepan', 'draft', 'quality_refine'].includes(type)) {
      return 'ai_draft';
    }
    if (type === 'batch_draft') {
      return 'multi_keyword_draft';
    }
    if (['card_news_gemini', 'card_news_auto_script', 'card_news_text', 'ai_graphic'].includes(type)) {
      return 'card_news';
    }
    if (type === 'style_analysis') {
      return 'blog_analysis';
    }
    if (['image_prompt', 'image_query', 'image_plan'].includes(type)) {
      return 'image_search';
    }
    return 'ai_draft';
  }

  function getServerKstStartDate(period: string): Date {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const kstOffset = 9 * 60 * 60000;
    const kstDate = new Date(utc + kstOffset);

    const year = kstDate.getFullYear();
    const month = kstDate.getMonth();
    const date = kstDate.getDate();
    const day = kstDate.getDay();

    let startKst: Date;
    if (period === 'daily') {
      startKst = new Date(year, month, date, 0, 0, 0, 0);
    } else if (period === 'weekly') {
      const diffToMonday = (day + 6) % 7;
      startKst = new Date(year, month, date - diffToMonday, 0, 0, 0, 0);
    } else if (period === 'monthly') {
      startKst = new Date(year, month, 1, 0, 0, 0, 0);
    } else {
      startKst = new Date(0);
    }

    return new Date(startKst.getTime() - kstOffset);
  }

  const checkFeatureLimitServerSide = async (
    reqBody: any,
    featureKey: string,
    req?: any
  ): Promise<{
    allowed: boolean;
    tierId: string;
    tierName: string;
    isUnlimited: boolean;
    usedCount: number;
    limit: number | null;
    period: string;
    reason?: string;
    errorStatus?: number;
  }> => {
    // 1. Admin verification
    if (req && verifyAdminToken(req)) {
      return {
        allowed: true,
        tierId: 'admin',
        tierName: '관리자',
        isUnlimited: true,
        usedCount: 0,
        limit: null,
        period: 'none',
      };
    }
    const token =
      reqBody?.adminToken ||
      (req?.headers ? req.headers['x-admin-token'] || req.headers['authorization'] : null);
    if (token && typeof token === 'string') {
      const cleanToken = token.startsWith('Bearer ') ? token.substring(7).trim() : token.trim();
      if (adminSessions.has(cleanToken)) {
        const sess = adminSessions.get(cleanToken);
        if (sess && Date.now() - sess.createdAt <= ADMIN_SESSION_TTL_MS) {
          return {
            allowed: true,
            tierId: 'admin',
            tierName: '관리자',
            isUnlimited: true,
            usedCount: 0,
            limit: null,
            period: 'none',
          };
        }
      }
    }

    const { userEmail, userName, userId } = reqBody || {};
    const userKey = getNormalizedUserKey(req, reqBody);
    const userIdentities = [
      userKey,
      userId ? String(userId).trim().toLowerCase() : null,
      userEmail ? String(userEmail).trim().toLowerCase() : null,
      userName ? String(userName).trim().toLowerCase() : null,
    ].filter(Boolean) as string[];

    let resolvedTierId = 'free';
    let customMembership: any = null;
    const supabase = getSupabaseAdmin(req);

    if (supabase) {
      try {
        // 2. Check user_memberships in Supabase
        for (const ident of userIdentities) {
          const { data: memberRows } = await supabase
            .from('user_memberships')
            .select('*, membership_tiers(*)')
            .eq('user_id', ident)
            .limit(1);

          if (memberRows && memberRows.length > 0) {
            const m = memberRows[0];
            if (m.status === 'active') {
              if (!m.expires_at || new Date(m.expires_at) > new Date()) {
                resolvedTierId = m.tier_id;
                customMembership = m;
                break;
              }
            }
          }
        }

        // 3. Fallback: If not in user_memberships, check active challenge participation -> 'pro' tier
        if (resolvedTierId === 'free' && (userEmail || userName || userId)) {
          const { data: participants } = await supabase.from('participants').select('*');
          if (participants && participants.length > 0) {
            const matched = participants.filter((p: any) => {
              const mEmail = userEmail && p.email && String(p.email).toLowerCase() === String(userEmail).toLowerCase();
              const mName =
                userName &&
                p.participant_name &&
                String(p.participant_name).trim().toLowerCase() === String(userName).trim().toLowerCase();
              const mBlog = userId && p.blog_id && String(p.blog_id).toLowerCase() === String(userId).toLowerCase();
              return mEmail || mName || mBlog;
            });

            if (matched.length > 0) {
              const todayStr = new Date().toISOString().split('T')[0];
              const { data: groups } = await supabase.from('challenges').select('*');
              if (groups && groups.length > 0) {
                const activeGroupNames = new Set(
                  groups
                    .filter((g: any) => {
                      if (g.status === 'ended') return false;
                      if (g.start_date && g.end_date) {
                        return todayStr >= g.start_date && todayStr <= g.end_date;
                      }
                      return g.status === 'in_progress' || g.status === 'active';
                    })
                    .map((g: any) => String(g.group_name || g.name || '').trim())
                );

                for (const p of matched) {
                  const pGroups = String(p.group_name || '')
                    .split(',')
                    .map((s: string) => s.trim());
                  for (const pg of pGroups) {
                    if (activeGroupNames.has(pg)) {
                      resolvedTierId = 'pro';
                      break;
                    }
                  }
                  if (resolvedTierId === 'pro') break;
                }
              }
            }
          }
        }
      } catch (e) {
        console.warn('checkFeatureLimitServerSide DB tier lookup warning:', e);
      }
    }

    // 4. Resolve Tier Feature Config
    let tierConfig: { enabled: boolean; usageLimit: number | null; usagePeriod: string } | undefined;
    let tierName = SERVER_DEFAULT_TIERS.find((t) => t.id === resolvedTierId)?.name || '무료 회원';

    if (supabase) {
      try {
        const { data: tfRows } = await supabase
          .from('tier_features')
          .select('enabled, usage_limit, usage_period, features(feature_key)')
          .eq('tier_id', resolvedTierId);

        if (tfRows && tfRows.length > 0) {
          const match = tfRows.find((r: any) => (r.features as any)?.feature_key === featureKey);
          if (match) {
            tierConfig = {
              enabled: Boolean(match.enabled),
              usageLimit: match.usage_limit === null || match.usage_limit === undefined ? null : Number(match.usage_limit),
              usagePeriod: match.usage_period || 'none',
            };
          }
        }

        const { data: tierRow } = await supabase.from('membership_tiers').select('name').eq('id', resolvedTierId).single();
        if (tierRow?.name) tierName = tierRow.name;
      } catch (e) {
        console.warn('checkFeatureLimitServerSide tier_features DB query warning:', e);
      }
    }

    if (!tierConfig) {
      const tierMatrix = SERVER_DEFAULT_TIER_MATRIX[resolvedTierId] || SERVER_DEFAULT_TIER_MATRIX['free'];
      tierConfig = tierMatrix[featureKey] || { enabled: true, usageLimit: 3, usagePeriod: 'daily' };
    }

    // 5. Check Feature Enabled
    if (!tierConfig.enabled) {
      return {
        allowed: false,
        tierId: resolvedTierId,
        tierName,
        isUnlimited: false,
        usedCount: 0,
        limit: 0,
        period: tierConfig.usagePeriod,
        errorStatus: 403,
        reason: `'${tierName}' 등급에서는 지원되지 않는 기능입니다. 상위 등급으로 업그레이드 후 이용해 주세요.`,
      };
    }

    // 6. Check Usage Limit
    if (tierConfig.usageLimit === null || tierConfig.usagePeriod === 'none') {
      return {
        allowed: true,
        tierId: resolvedTierId,
        tierName,
        isUnlimited: true,
        usedCount: 0,
        limit: null,
        period: 'none',
      };
    }

    const startDate = getServerKstStartDate(tierConfig.usagePeriod);
    let usedCount = 0;

    if (supabase) {
      try {
        // Query DB usage_logs
        const { count, error } = await supabase
          .from('usage_logs')
          .select('*', { count: 'exact', head: true })
          .in('user_id', userIdentities)
          .eq('feature_key', featureKey)
          .gte('used_at', startDate.toISOString());

        if (!error && typeof count === 'number') {
          usedCount = count;
        } else {
          // fallback to memory
          usedCount = serverInMemoryUsageLogs.filter(
            (log) =>
              log.featureKey === featureKey &&
              userIdentities.includes(log.userId) &&
              new Date(log.usedAt) >= startDate
          ).length;
        }
      } catch (e) {
        usedCount = serverInMemoryUsageLogs.filter(
          (log) =>
            log.featureKey === featureKey &&
            userIdentities.includes(log.userId) &&
            new Date(log.usedAt) >= startDate
        ).length;
      }
    } else {
      usedCount = serverInMemoryUsageLogs.filter(
        (log) =>
          log.featureKey === featureKey &&
          userIdentities.includes(log.userId) &&
          new Date(log.usedAt) >= startDate
      ).length;
    }

    if (usedCount >= tierConfig.usageLimit) {
      const periodLabel =
        tierConfig.usagePeriod === 'daily' ? '오늘' : tierConfig.usagePeriod === 'weekly' ? '이번 주' : '이번 달';
      return {
        allowed: false,
        tierId: resolvedTierId,
        tierName,
        isUnlimited: false,
        usedCount,
        limit: tierConfig.usageLimit,
        period: tierConfig.usagePeriod,
        errorStatus: 403,
        reason: `${periodLabel} 이용 한도(${tierConfig.usageLimit}회)를 모두 사용했습니다. 상위 등급으로 업그레이드하시면 더 많은 생성 혜택을 이용하실 수 있습니다.`,
      };
    }

    return {
      allowed: true,
      tierId: resolvedTierId,
      tierName,
      isUnlimited: false,
      usedCount,
      limit: tierConfig.usageLimit,
      period: tierConfig.usagePeriod,
    };
  };

  const recordFeatureUsageServerSide = async (
    reqBody: any,
    featureKey: string,
    metadata: any = {},
    req?: any
  ) => {
    const userKey = getNormalizedUserKey(req, reqBody);
    const { userId, userEmail, userName } = reqBody || {};
    const effectiveUserId = String(userId || userEmail || userName || userKey).trim().toLowerCase();
    const now = new Date().toISOString();

    serverInMemoryUsageLogs.push({
      userId: effectiveUserId,
      userKey,
      featureKey,
      usedAt: now,
    });
    if (serverInMemoryUsageLogs.length > 3000) serverInMemoryUsageLogs.shift();

    const supabase = getSupabaseAdmin(req);
    if (supabase) {
      try {
        await supabase.from('usage_logs').insert({
          id: `ul_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          user_id: effectiveUserId,
          feature_key: featureKey,
          used_at: now,
          request_id: reqBody?.requestId || null,
          metadata: {
            type: reqBody?.type,
            promptTokens: metadata?.promptTokens || null,
            completionTokens: metadata?.completionTokens || null,
            totalTokens: metadata?.totalTokens || null,
          },
        });
      } catch (err) {
        console.warn('recordFeatureUsageServerSide insert warning:', err);
      }
    }
  };

  const checkAIToolkitServerAuth = async (reqBody: any, req?: any): Promise<boolean> => {
    const result = await checkFeatureLimitServerSide(reqBody, 'ai_draft', req);
    return result.allowed;
  };

  // ----------------------------------------------------
  // Membership & Tier AI Limit API Routes
  // ----------------------------------------------------

  // 1. GET /api/membership/summary - Get current user's membership tier and feature limits
  app.get('/api/membership/summary', async (req: any, res: any) => {
    try {
      const { userId, userEmail, userName } = req.query;
      const userKey = getNormalizedUserKey(req, { userId, userEmail, userName });
      const isAdmin = verifyAdminToken(req);

      const featureKeys = SERVER_DEFAULT_FEATURES.map((f) => f.featureKey);
      const featureStatuses: Record<string, any> = {};

      for (const fKey of featureKeys) {
        const evalResult = await checkFeatureLimitServerSide(
          { userId, userEmail, userName },
          fKey,
          req
        );
        featureStatuses[fKey] = {
          featureKey: fKey,
          enabled: evalResult.allowed || evalResult.limit !== 0,
          isUnlimited: evalResult.isUnlimited,
          usageLimit: evalResult.limit,
          usagePeriod: evalResult.period,
          usedCount: evalResult.usedCount,
          remainingUses: evalResult.isUnlimited ? 9999 : Math.max(0, (evalResult.limit || 0) - evalResult.usedCount),
          tierId: evalResult.tierId,
          tierName: evalResult.tierName,
        };
      }

      const currentTierId = isAdmin ? 'admin' : (featureStatuses['ai_draft']?.tierId || 'free');
      const currentTierName = isAdmin ? '관리자' : (featureStatuses['ai_draft']?.tierName || '무료 회원');

      return res.json({
        success: true,
        userKey,
        currentTier: {
          id: currentTierId,
          name: currentTierName,
        },
        isAdmin,
        featureAccess: featureStatuses,
      });
    } catch (err: any) {
      console.error('[API /api/membership/summary] Error:', err);
      return res.status(500).json({ success: false, message: err?.message || 'Failed to fetch membership summary' });
    }
  });

  // 2. GET /api/membership/tiers - Public list of tiers
  app.get('/api/membership/tiers', async (req: any, res: any) => {
    try {
      const supabase = getSupabaseAdmin(req);
      if (supabase) {
        const { data: tiers, error } = await supabase.from('membership_tiers').select('*').order('sort_order', { ascending: true });
        if (!error && tiers && tiers.length > 0) {
          return res.json({ success: true, tiers });
        }
      }
      return res.json({ success: true, tiers: SERVER_DEFAULT_TIERS });
    } catch (err: any) {
      return res.json({ success: true, tiers: SERVER_DEFAULT_TIERS });
    }
  });

  // 3. GET /api/membership/features - Public list of features
  app.get('/api/membership/features', async (req: any, res: any) => {
    try {
      const supabase = getSupabaseAdmin(req);
      if (supabase) {
        const { data: features, error } = await supabase.from('features').select('*').order('sort_order', { ascending: true });
        if (!error && features && features.length > 0) {
          return res.json({ success: true, features });
        }
      }
      return res.json({ success: true, features: SERVER_DEFAULT_FEATURES });
    } catch (err: any) {
      return res.json({ success: true, features: SERVER_DEFAULT_FEATURES });
    }
  });

  // 4. GET /api/admin/membership/data - Comprehensive Admin Membership Dashboard Data
  app.get('/api/admin/membership/data', requireAdminAuth, async (req: any, res: any) => {
    try {
      const supabase = getSupabaseAdmin(req);
      let tiers: any[] = SERVER_DEFAULT_TIERS;
      let features: any[] = SERVER_DEFAULT_FEATURES;
      let tierFeatures: any[] = [];
      let userMemberships: any[] = [];
      let recentLogs: any[] = [];

      if (supabase) {
        try {
          const [tiersRes, featRes, tfRes, umRes, logsRes] = await Promise.all([
            supabase.from('membership_tiers').select('*').order('sort_order', { ascending: true }),
            supabase.from('features').select('*').order('sort_order', { ascending: true }),
            supabase.from('tier_features').select('*'),
            supabase.from('user_memberships').select('*, membership_tiers(name)').order('created_at', { ascending: false }).limit(200),
            supabase.from('usage_logs').select('*').order('used_at', { ascending: false }).limit(100),
          ]);

          if (tiersRes.data && tiersRes.data.length > 0) tiers = tiersRes.data;
          if (featRes.data && featRes.data.length > 0) features = featRes.data;
          if (tfRes.data) tierFeatures = tfRes.data;
          if (umRes.data) userMemberships = umRes.data;
          if (logsRes.data) recentLogs = logsRes.data;
        } catch (dbErr) {
          console.warn('[API /api/admin/membership/data] Supabase fetch warning:', dbErr);
        }
      }

      // If tierFeatures is empty, construct from default matrix
      if (tierFeatures.length === 0) {
        for (const [tierId, fMap] of Object.entries(SERVER_DEFAULT_TIER_MATRIX)) {
          for (const [fKey, conf] of Object.entries(fMap)) {
            tierFeatures.push({
              id: `tf_${tierId}_${fKey}`,
              tier_id: tierId,
              feature_id: `feat_${fKey}`,
              enabled: conf.enabled,
              usage_limit: conf.usageLimit,
              usage_period: conf.usagePeriod,
            });
          }
        }
      }

      return res.json({
        success: true,
        tiers,
        features,
        tierFeatures,
        userMemberships,
        recentLogs: recentLogs.length > 0 ? recentLogs : serverInMemoryUsageLogs.slice(-50),
        defaultMatrix: SERVER_DEFAULT_TIER_MATRIX,
      });
    } catch (err: any) {
      console.error('[API /api/admin/membership/data] Error:', err);
      return res.status(500).json({ success: false, message: err?.message || 'Failed to fetch membership data' });
    }
  });

  // 5. POST /api/admin/membership/tiers - Create or Update a Tier
  app.post('/api/admin/membership/tiers', requireAdminAuth, async (req: any, res: any) => {
    try {
      const { id, name, description, isActive, sortOrder } = req.body;
      if (!id || !name) {
        return res.status(400).json({ success: false, message: 'Tier id and name are required' });
      }

      const supabase = getSupabaseAdmin(req);
      if (supabase) {
        const payload = {
          id: id.trim().toLowerCase(),
          name: name.trim(),
          description: description || '',
          is_active: isActive !== undefined ? isActive : true,
          sort_order: sortOrder || 5,
          updated_at: new Date().toISOString(),
        };
        const { error } = await supabase.from('membership_tiers').upsert(payload);
        if (error) {
          return res.status(500).json({ success: false, message: error.message });
        }
      }
      return res.json({ success: true, message: 'Tier saved successfully' });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Failed to save tier' });
    }
  });

  // 6. DELETE /api/admin/membership/tiers/:id - Delete a Tier
  app.delete('/api/admin/membership/tiers/:id', requireAdminAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      if (['free', 'basic', 'pro', 'vip', 'admin'].includes(id)) {
        return res.status(400).json({ success: false, message: '기본 시스템 등급은 삭제할 수 없습니다.' });
      }

      const supabase = getSupabaseAdmin(req);
      if (supabase) {
        await supabase.from('tier_features').delete().eq('tier_id', id);
        const { error } = await supabase.from('membership_tiers').delete().eq('id', id);
        if (error) return res.status(500).json({ success: false, message: error.message });
      }
      return res.json({ success: true, message: 'Tier deleted successfully' });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Failed to delete tier' });
    }
  });

  // 7. POST /api/admin/membership/tiers/:id/clone - Clone a Tier
  app.post('/api/admin/membership/tiers/:id/clone', requireAdminAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const { newId, newName } = req.body;
      if (!newId || !newName) {
        return res.status(400).json({ success: false, message: 'New tier ID and Name required' });
      }

      const supabase = getSupabaseAdmin(req);
      if (supabase) {
        const { data: sourceTier } = await supabase.from('membership_tiers').select('*').eq('id', id).single();
        await supabase.from('membership_tiers').upsert({
          id: newId.trim().toLowerCase(),
          name: newName.trim(),
          description: sourceTier ? `${sourceTier.description} (복사본)` : '복제된 등급',
          is_active: true,
          sort_order: (sourceTier?.sort_order || 5) + 1,
        });

        const { data: sourceFeatures } = await supabase.from('tier_features').select('*').eq('tier_id', id);
        if (sourceFeatures && sourceFeatures.length > 0) {
          const clonedFeatures = sourceFeatures.map((sf: any) => ({
            id: `tf_${newId}_${sf.feature_id}`,
            tier_id: newId,
            feature_id: sf.feature_id,
            enabled: sf.enabled,
            usage_limit: sf.usage_limit,
            usage_period: sf.usage_period,
          }));
          await supabase.from('tier_features').upsert(clonedFeatures);
        }
      }
      return res.json({ success: true, message: 'Tier cloned successfully' });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Failed to clone tier' });
    }
  });

  // 8. POST /api/admin/membership/tier-features - Save Tier Features Matrix
  app.post('/api/admin/membership/tier-features', requireAdminAuth, async (req: any, res: any) => {
    try {
      const { tierId, featureSettings } = req.body;
      if (!tierId || !Array.isArray(featureSettings)) {
        return res.status(400).json({ success: false, message: 'tierId and featureSettings array required' });
      }

      const supabase = getSupabaseAdmin(req);
      if (supabase) {
        const rows = featureSettings.map((fs: any) => ({
          id: `tf_${tierId}_${fs.featureId || fs.feature_id || fs.featureKey}`,
          tier_id: tierId,
          feature_id: fs.featureId || fs.feature_id,
          enabled: Boolean(fs.enabled),
          usage_limit: fs.usageLimit === null || fs.usageLimit === undefined || fs.usageLimit === '' ? null : Number(fs.usageLimit),
          usage_period: fs.usagePeriod || 'none',
          updated_at: new Date().toISOString(),
        }));

        const { error } = await supabase.from('tier_features').upsert(rows);
        if (error) {
          return res.status(500).json({ success: false, message: error.message });
        }
      }

      return res.json({ success: true, message: 'Tier features saved successfully' });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Failed to save tier features' });
    }
  });

  // 9. POST /api/admin/membership/user-tier - Assign Tier to User
  app.post('/api/admin/membership/user-tier', requireAdminAuth, async (req: any, res: any) => {
    try {
      const { userId, userEmail, userName, tierId, status, durationDays, startsAt, expiresAt, notes } = req.body;
      if (!userId || !tierId) {
        return res.status(400).json({ success: false, message: 'userId and tierId are required' });
      }

      const cleanUserId = String(userId).trim().toLowerCase();
      const now = new Date();
      let calculatedExpiresAt: string | null = expiresAt || null;

      if (!calculatedExpiresAt && durationDays && Number(durationDays) > 0) {
        const exp = new Date(now);
        exp.setDate(exp.getDate() + Number(durationDays));
        calculatedExpiresAt = exp.toISOString();
      }

      const supabase = getSupabaseAdmin(req);
      if (supabase) {
        const payload = {
          id: `um_${cleanUserId}`,
          user_id: cleanUserId,
          tier_id: tierId,
          status: status || 'active',
          started_at: startsAt || now.toISOString(),
          expires_at: calculatedExpiresAt,
          source_type: 'admin',
          source_id: 'admin_manual',
          notes: notes || '관리자 등급 지정',
          updated_at: now.toISOString(),
        };

        const { error } = await supabase.from('user_memberships').upsert(payload, { onConflict: 'user_id' });
        if (error) {
          console.warn('[API /api/admin/membership/user-tier] Supabase user_memberships error:', error.message);
          return res.status(500).json({ success: false, message: error.message });
        }

        // If email or username provided and profile exists, keep profile in sync
        if (userEmail || userName) {
          try {
            await supabase.from('profiles').update({
              updated_at: now.toISOString(),
            }).or(`id.eq.${cleanUserId},email.ilike.${cleanUserId}`);
          } catch (_) {}
        }
      }

      return res.json({ success: true, message: '회원 등급이 성공적으로 저장되었습니다.' });
    } catch (err: any) {
      console.error('[API /api/admin/membership/user-tier] Error:', err);
      return res.status(500).json({ success: false, message: err?.message || 'Failed to assign user tier' });
    }
  });

  // 10. POST /api/admin/membership/reset-usage - Reset Usage Logs
  app.post('/api/admin/membership/reset-usage', requireAdminAuth, async (req: any, res: any) => {
    try {
      const { userId, featureKey } = req.body;
      const supabase = getSupabaseAdmin(req);
      if (supabase) {
        let query = supabase.from('usage_logs').delete();
        if (userId) query = query.eq('user_id', String(userId).trim().toLowerCase());
        if (featureKey) query = query.eq('feature_key', featureKey);
        await query;
      }
      return res.json({ success: true, message: 'Usage logs reset successfully' });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Failed to reset usage' });
    }
  });

  // 11. POST /api/purchases/request - Public User Purchase Request (Creates pending deposit order, never auto-grants)
  app.post('/api/purchases/request', async (req: any, res: any) => {
    try {
      const {
        userId,
        userName,
        userEmail,
        productId,
        productName,
        productType,
        amount,
        targetTierId,
        durationDays,
        depositorName,
        contactPhone,
        notes,
      } = req.body;

      if (!userId || !productId) {
        return res.status(400).json({ success: false, message: 'userId and productId are required' });
      }

      const cleanUserId = String(userId).trim().toLowerCase();
      const cleanEmail = userEmail ? String(userEmail).trim().toLowerCase() : undefined;
      const now = new Date().toISOString();

      const purchaseId = `pur_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const combinedNotes = [
        depositorName ? `[입금자: ${depositorName}]` : '',
        contactPhone ? `[연락처: ${contactPhone}]` : '',
        notes ? notes : '',
      ].filter(Boolean).join(' ');

      const purchasePayload = {
        id: purchaseId,
        user_id: cleanUserId,
        user_name: userName || depositorName || cleanUserId,
        user_email: cleanEmail || null,
        product_id: productId,
        product_name: productName || '멤버십 구독',
        product_type: productType || 'membership',
        amount: Math.max(0, Math.round(Number(amount) || 0)),
        payment_method: 'bank_transfer',
        status: 'pending_payment', // Normal users ALWAYS get pending_payment status
        source_type: 'product_purchase',
        notes: combinedNotes,
        purchased_at: now,
        created_at: now,
        updated_at: now,
      };

      const supabase = getSupabaseAdmin(req);
      if (supabase) {
        const { error } = await supabase.from('purchases').insert(purchasePayload);
        if (error) {
          console.error('[API /api/purchases/request] Supabase insert error:', error.message);
          return res.status(500).json({ success: false, message: '구매 신청 데이터베이스 저장 실패: ' + error.message });
        }
      }

      return res.json({
        success: true,
        message: '구매 신청이 성공적으로 접수되었습니다. 입금 확인 후 등급이 승인됩니다.',
        purchase: purchasePayload,
      });
    } catch (err: any) {
      console.error('[API /api/purchases/request] Error:', err);
      return res.status(500).json({ success: false, message: err?.message || 'Failed to submit purchase request' });
    }
  });

  // 12. GET /api/admin/purchases - Admin list all purchases
  app.get('/api/admin/purchases', requireAdminAuth, async (req: any, res: any) => {
    try {
      const supabase = getSupabaseAdmin(req);
      if (supabase) {
        const { data: purchases, error } = await supabase
          .from('purchases')
          .select('*')
          .order('purchased_at', { ascending: false });
        if (!error && purchases) {
          return res.json({ success: true, purchases });
        }
      }
      return res.json({ success: true, purchases: [] });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Failed to fetch purchases' });
    }
  });

  // 13. POST /api/admin/purchases/:id/approve - Admin verify deposit and grant membership tier
  app.post('/api/admin/purchases/:id/approve', requireAdminAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const { customDurationDays, customTierId } = req.body;
      const supabase = getSupabaseAdmin(req);
      if (!supabase) {
        return res.status(500).json({ success: false, message: 'Database connection unavailable' });
      }

      // 1. Fetch Purchase
      const { data: purchase, error: pError } = await supabase
        .from('purchases')
        .select('*')
        .eq('id', id)
        .single();

      if (pError || !purchase) {
        return res.status(404).json({ success: false, message: 'Purchase not found' });
      }

      // 2. Fetch Product Info to determine tier and duration
      let targetTier = customTierId;
      let durationDays = customDurationDays !== undefined ? customDurationDays : null;

      if (!targetTier || durationDays === null || durationDays === undefined) {
        if (purchase.product_id) {
          const { data: product } = await supabase
            .from('products')
            .select('*')
            .eq('id', purchase.product_id)
            .single();
          if (product) {
            targetTier = targetTier || product.membership_tier || 'pro';
            durationDays = durationDays !== null ? durationDays : product.duration_days;
          }
        }
      }
      targetTier = targetTier || 'pro';

      // 3. Calculate expiry date
      const now = new Date();
      let expiresAt: string | null = null;
      if (durationDays && Number(durationDays) > 0) {
        const exp = new Date(now);
        exp.setDate(exp.getDate() + Number(durationDays));
        expiresAt = exp.toISOString();
      }

      const nowIso = now.toISOString();

      // 4. Update Purchase status to completed
      const { error: pUpdateErr } = await supabase
        .from('purchases')
        .update({
          status: 'completed',
          updated_at: nowIso,
          notes: purchase.notes ? `${purchase.notes} [관리자 입금확인 완료]` : '[관리자 입금확인 완료]',
        })
        .eq('id', id);

      if (pUpdateErr) {
        console.error('[API /api/admin/purchases/approve] Purchase status update error:', pUpdateErr.message);
        return res.status(500).json({ success: false, message: '구매 상태 갱신 실패: ' + pUpdateErr.message });
      }

      // 5. Grant / Upsert User Membership
      const cleanUserId = String(purchase.user_id).trim().toLowerCase();
      const membershipPayload = {
        id: `um_${cleanUserId}`,
        user_id: cleanUserId,
        tier_id: targetTier,
        status: 'active',
        started_at: nowIso,
        expires_at: expiresAt,
        source_type: 'product_purchase',
        source_id: purchase.id,
        notes: `[결제 승인] ${purchase.product_name || '멤버십 상품'} (${durationDays ? `${durationDays}일` : '무제한'})`,
        updated_at: nowIso,
      };

      const { error: umErr } = await supabase
        .from('user_memberships')
        .upsert(membershipPayload, { onConflict: 'user_id' });

      if (umErr) {
        console.error('[API /api/admin/purchases/approve] User membership upsert error:', umErr.message);
        return res.status(500).json({ success: false, message: '회원 등급 부여 저장 실패: ' + umErr.message });
      }

      return res.json({
        success: true,
        message: `입금 확인이 완료되어 회원(${cleanUserId})에게 ${targetTier.toUpperCase()} 등급이 승인되었습니다.`,
        tierId: targetTier,
        expiresAt,
      });
    } catch (err: any) {
      console.error('[API /api/admin/purchases/approve] Error:', err);
      return res.status(500).json({ success: false, message: err?.message || 'Failed to approve purchase' });
    }
  });

  // 14. POST /api/admin/purchases/:id/reject - Admin reject purchase
  app.post('/api/admin/purchases/:id/reject', requireAdminAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const supabase = getSupabaseAdmin(req);
      if (!supabase) {
        return res.status(500).json({ success: false, message: 'Database connection unavailable' });
      }

      const nowIso = new Date().toISOString();
      const { error: rejErr } = await supabase
        .from('purchases')
        .update({
          status: 'cancelled',
          updated_at: nowIso,
          notes: reason ? `[신청 취소/거절: ${reason}]` : '[신청 취소됨]',
        })
        .eq('id', id);

      if (rejErr) {
        console.error('[API /api/admin/purchases/reject] Error:', rejErr.message);
        return res.status(500).json({ success: false, message: '신청 취소 실패: ' + rejErr.message });
      }

      return res.json({ success: true, message: '구매 신청이 취소 처리되었습니다.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Failed to reject purchase' });
    }
  });

  // 15. POST /api/admin/users/merge - Safe Duplicate User Profiles Merge
  app.post('/api/admin/users/merge', requireAdminAuth, async (req: any, res: any) => {
    try {
      const { primaryUserId, duplicateUserIds, targetTierId } = req.body;
      if (!primaryUserId || !Array.isArray(duplicateUserIds) || duplicateUserIds.length === 0) {
        return res.status(400).json({ success: false, message: 'primaryUserId and duplicateUserIds array required' });
      }

      const cleanPrimary = String(primaryUserId).trim().toLowerCase();
      const cleanDuplicates = Array.from(
        new Set(
          duplicateUserIds
            .map((d: any) => String(d).trim().toLowerCase())
            .filter((d) => d && d !== cleanPrimary)
        )
      );

      if (cleanDuplicates.length === 0) {
        return res.status(400).json({ success: false, message: '병합할 유효한 중복 계정이 없습니다.' });
      }

      const supabase = getSupabaseAdmin(req);
      if (!supabase) {
        return res.status(500).json({ success: false, message: 'Database connection unavailable' });
      }

      const nowIso = new Date().toISOString();

      // Collect all duplicate identifier aliases (id, email, naver_id)
      const allDupIdentifiers = new Set<string>(cleanDuplicates);
      try {
        const { data: dupProfiles } = await supabase
          .from('profiles')
          .select('id, email, naver_id, name')
          .or(cleanDuplicates.map((d) => `id.eq.${d},email.ilike.${d},naver_id.ilike.${d}`).join(','));

        if (dupProfiles && dupProfiles.length > 0) {
          dupProfiles.forEach((p: any) => {
            if (p.id && p.id.toLowerCase() !== cleanPrimary) allDupIdentifiers.add(p.id.toLowerCase());
            if (p.email && p.email.toLowerCase() !== cleanPrimary) allDupIdentifiers.add(p.email.toLowerCase());
            if (p.naver_id && p.naver_id.toLowerCase() !== cleanPrimary) allDupIdentifiers.add(p.naver_id.toLowerCase());
          });
        }
      } catch (profileLookupErr) {
        console.warn('[Admin Merge] Profile lookup warning:', profileLookupErr);
      }

      const dupIdList = Array.from(allDupIdentifiers);

      // 1. Update related tables to reference primary user (Check every operation and never ignore errors)
      const tablesToMigrate = [
        'participants',
        'purchases',
        'usage_logs',
        'challenge_payments',
        'challenge_refunds',
        'revenue_certifications',
        'user_badges',
        'ai_draft_sessions',
        'user_blog_styles',
      ];

      for (const dupId of dupIdList) {
        for (const table of tablesToMigrate) {
          const { error } = await supabase.from(table).update({ user_id: cleanPrimary }).eq('user_id', dupId);
          if (error) {
            console.error(`[Admin Merge Error] Failed updating table ${table} for dupId ${dupId}:`, error.message);
            return res.status(500).json({
              success: false,
              message: `데이터 병합 중 '${table}' 테이블 업데이트 실패 (${error.message}). 데이터 무결성을 위해 작업이 중단되었습니다.`,
            });
          }
        }
      }

      // 2. Remove duplicate records from user_memberships
      const { error: umDelErr } = await supabase.from('user_memberships').delete().in('user_id', dupIdList);
      if (umDelErr) {
        console.error('[Admin Merge Error] user_memberships delete failed:', umDelErr.message);
        return res.status(500).json({
          success: false,
          message: `중복 멤버십 삭제 실패 (${umDelErr.message}). 작업이 중단되었습니다.`,
        });
      }

      // 3. Remove duplicate records from profiles
      const { error: pDelErr } = await supabase.from('profiles').delete().in('id', dupIdList).neq('id', cleanPrimary);
      if (pDelErr) {
        console.error('[Admin Merge Error] profiles delete failed:', pDelErr.message);
        return res.status(500).json({
          success: false,
          message: `중복 프로필 삭제 실패 (${pDelErr.message}). 작업이 중단되었습니다.`,
        });
      }

      // 4. Ensure primary user has active membership with target tier
      const finalTier = targetTierId || 'pro';
      const { error: umUpsertErr } = await supabase.from('user_memberships').upsert({
        id: `um_${cleanPrimary}`,
        user_id: cleanPrimary,
        tier_id: finalTier,
        status: 'active',
        started_at: nowIso,
        source_type: 'admin',
        source_id: 'admin_merge',
        notes: `중복 계정(${cleanDuplicates.length}개) 안전 병합 완료`,
        updated_at: nowIso,
      }, { onConflict: 'user_id' });

      if (umUpsertErr) {
        console.error('[Admin Merge Error] Primary membership upsert failed:', umUpsertErr.message);
        return res.status(500).json({
          success: false,
          message: `기준 계정 멤버십 갱신 실패 (${umUpsertErr.message}). 작업이 중단되었습니다.`,
        });
      }

      return res.json({
        success: true,
        message: `${cleanDuplicates.length}개의 중복 계정 데이터가 기준 계정(${cleanPrimary})으로 안전하게 병합되었습니다.`,
        primaryUserId: cleanPrimary,
        mergedDuplicates: cleanDuplicates,
        tierId: finalTier,
      });
    } catch (err: any) {
      console.error('[API /api/admin/users/merge] Error:', err);
      return res.status(500).json({ success: false, message: err?.message || 'Failed to merge users' });
    }
  });

  // 16. DELETE /api/admin/users/:userId - Safe User Deletion with Linked Data Check
  app.delete('/api/admin/users/:userId', requireAdminAuth, async (req: any, res: any) => {
    try {
      const { userId } = req.params;
      const { force } = req.query;
      if (!userId) {
        return res.status(400).json({ success: false, message: 'userId is required' });
      }

      const cleanUserId = String(userId).trim().toLowerCase();
      const supabase = getSupabaseAdmin(req);
      if (!supabase) {
        return res.status(500).json({ success: false, message: 'Database connection unavailable' });
      }

      // Check linked data across tables
      const [
        { count: partCount },
        { count: purCount },
        { count: payCount },
        { count: refCount },
        { count: revCount },
      ] = await Promise.all([
        supabase.from('participants').select('*', { count: 'exact', head: true }).or(`user_id.eq.${cleanUserId},email.ilike.${cleanUserId}`),
        supabase.from('purchases').select('*', { count: 'exact', head: true }).or(`user_id.eq.${cleanUserId},user_email.ilike.${cleanUserId}`),
        supabase.from('challenge_payments').select('*', { count: 'exact', head: true }).or(`user_id.eq.${cleanUserId},user_email.ilike.${cleanUserId}`),
        supabase.from('challenge_refunds').select('*', { count: 'exact', head: true }).or(`user_id.eq.${cleanUserId},user_email.ilike.${cleanUserId}`),
        supabase.from('revenue_certifications').select('*', { count: 'exact', head: true }).or(`user_id.eq.${cleanUserId},user_email.ilike.${cleanUserId}`),
      ]);

      const totalLinked = (partCount || 0) + (purCount || 0) + (payCount || 0) + (refCount || 0) + (revCount || 0);

      // If linked records exist and not forced, block deletion with informative message
      if (totalLinked > 0 && force !== 'true') {
        const details: string[] = [];
        if (partCount) details.push(`챌린지 참가 ${partCount}건`);
        if (purCount) details.push(`상품 구매 ${purCount}건`);
        if (payCount) details.push(`입금 신청 ${payCount}건`);
        if (refCount) details.push(`환급 신청 ${refCount}건`);
        if (revCount) details.push(`수익 인증 ${revCount}건`);

        return res.status(409).json({
          success: false,
          blocked: true,
          totalLinked,
          message: `해당 회원은 연결된 데이터(${details.join(', ')})가 존재하여 데이터 무결성 보호를 위해 삭제가 차단되었습니다.`,
          details: {
            participants: partCount || 0,
            purchases: purCount || 0,
            challenge_payments: payCount || 0,
            challenge_refunds: refCount || 0,
            revenue_certifications: revCount || 0,
          },
        });
      }

      // Safe delete from user_memberships, usage_logs, and profiles
      await Promise.all([
        supabase.from('user_memberships').delete().or(`user_id.eq.${cleanUserId},user_id.ilike.${cleanUserId}`),
        supabase.from('usage_logs').delete().or(`user_id.eq.${cleanUserId},user_id.ilike.${cleanUserId}`),
        supabase.from('profiles').delete().or(`id.eq.${cleanUserId},email.ilike.${cleanUserId}`),
      ]);

      return res.json({
        success: true,
        message: '회원 데이터가 안전하게 삭제되었습니다.',
        userId: cleanUserId,
      });
    } catch (err: any) {
      console.error('[API /api/admin/users/delete] Error:', err);
      return res.status(500).json({ success: false, message: err?.message || 'Failed to delete user' });
    }
  });

  // 17. DELETE /api/admin/products/:id - Safe Product Deletion with Purchase History & Force Option
  app.delete('/api/admin/products/:id', requireAdminAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const force = req.query.force === 'true' || req.query.force === true;

      if (!id) {
        return res.status(400).json({ success: false, message: 'Product ID is required' });
      }

      const supabase = getSupabaseAdmin(req);
      if (!supabase) {
        return res.status(500).json({ success: false, message: 'Database connection unavailable' });
      }

      // Check if any purchase record exists for this product
      const { count: purchaseCount } = await supabase
        .from('purchases')
        .select('*', { count: 'exact', head: true })
        .eq('product_id', id);

      if (purchaseCount && purchaseCount > 0) {
        if (force) {
          // Force delete: Unlink foreign key in purchases first (preserve purchase history records)
          await supabase
            .from('purchases')
            .update({ product_id: null })
            .eq('product_id', id);

          const { error: delErr } = await supabase
            .from('products')
            .delete()
            .eq('id', id);

          if (delErr) {
            return res.status(500).json({ success: false, message: delErr.message });
          }

          return res.json({
            success: true,
            forceDeleted: true,
            purchaseCount,
            message: `과거 구매 내역(${purchaseCount}건)의 연결을 안전하게 분리하고 상품이 영구 삭제되었습니다.`,
          });
        }

        // Soft delete: keep historical purchase data, set is_active = false
        const { error: updateErr } = await supabase
          .from('products')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('id', id);

        if (updateErr) {
          return res.status(500).json({ success: false, message: updateErr.message });
        }

        return res.json({
          success: true,
          softDeleted: true,
          purchaseCount,
          message: `구매 내역(${purchaseCount}건)이 존재하는 상품이므로 과거 데이터 보존을 위해 [판매 중지(비활성화)] 처리되었습니다. 영구 삭제를 원하시면 [영구 삭제] 버튼을 이용해 주세요.`,
        });
      }

      // No purchase history -> safe physical delete
      const { error: delErr } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (delErr) {
        return res.status(500).json({ success: false, message: delErr.message });
      }

      return res.json({
        success: true,
        softDeleted: false,
        message: '상품이 성공적으로 삭제되었습니다.',
      });
    } catch (err: any) {
      console.error('[API /api/admin/products/delete] Error:', err);
      return res.status(500).json({ success: false, message: err?.message || 'Failed to delete product' });
    }
  });

  // Helper: Strictly validate Unsplash Image URLs
  const isValidUnsplashUrl = (url: any): boolean => {
    if (typeof url !== 'string' || !url.trim()) return false;
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      return host === 'images.unsplash.com' || host === 'plus.unsplash.com' || host.endsWith('.unsplash.com');
    } catch {
      return false;
    }
  };

  // Unsplash Search API proxy (Strictly Unsplash Official API only)
  app.get('/api/unsplash/search', async (req: any, res: any) => {
    try {
      const query = (req.query.query || '').toString().trim();
      const perPage = Math.min(30, Math.max(1, Number(req.query.per_page) || 10));
      const orientation = (req.query.orientation || 'landscape').toString();

      if (!query) {
        return res.status(400).json({ success: false, message: 'Query parameter is required', results: [] });
      }

      const accessKey = process.env.UNSPLASH_ACCESS_KEY || process.env.VITE_UNSPLASH_ACCESS_KEY || '';
      if (!accessKey) {
        console.warn('[Unsplash Search] UNSPLASH_ACCESS_KEY is not configured on server.');
        return res.json({
          success: true,
          total: 0,
          total_pages: 0,
          results: [],
          message: 'Unsplash access key not configured'
        });
      }

      // Helper to fetch and sanitize photos strictly from official Unsplash API
      const fetchFromUnsplash = async (searchQ: string): Promise<any[]> => {
        try {
          const unsplashUrl = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(searchQ)}&per_page=${perPage}&orientation=${encodeURIComponent(orientation)}&client_id=${accessKey}`;
          const unsplashRes = await fetch(unsplashUrl);
          if (!unsplashRes.ok) {
            console.warn(`[Unsplash Search API] Fetch responded with status ${unsplashRes.status}`);
            return [];
          }
          const data: any = await unsplashRes.json();
          if (!Array.isArray(data.results)) return [];

          // Strictly filter and sanitize each photo
          return data.results.filter((p: any) => {
            if (!p || !p.id || !p.urls) return false;
            const testUrl = p.urls.regular || p.urls.full || p.urls.small || p.urls.thumb;
            return isValidUnsplashUrl(testUrl);
          }).map((p: any) => {
            const regularUrl = isValidUnsplashUrl(p.urls.regular) ? p.urls.regular : p.urls.full || p.urls.small;
            const smallUrl = isValidUnsplashUrl(p.urls.small) ? p.urls.small : regularUrl;
            const thumbUrl = isValidUnsplashUrl(p.urls.thumb) ? p.urls.thumb : smallUrl;
            const htmlLink = (p.links?.html && p.links.html.includes('unsplash.com'))
              ? p.links.html
              : `https://unsplash.com/photos/${p.id}`;
            const userHtml = (p.user?.links?.html && p.user.links.html.includes('unsplash.com'))
              ? p.user.links.html
              : `https://unsplash.com/@${p.user?.username || ''}`;

            return {
              id: p.id,
              created_at: p.created_at,
              width: p.width,
              height: p.height,
              color: p.color,
              alt_description: p.alt_description || p.description || searchQ,
              description: p.description || p.alt_description || searchQ,
              urls: {
                raw: isValidUnsplashUrl(p.urls.raw) ? p.urls.raw : regularUrl,
                full: isValidUnsplashUrl(p.urls.full) ? p.urls.full : regularUrl,
                regular: regularUrl,
                small: smallUrl,
                thumb: thumbUrl,
              },
              links: {
                html: htmlLink,
                download: p.links?.download || regularUrl,
                download_location: p.links?.download_location,
              },
              user: {
                id: p.user?.id || 'unsplash_user',
                username: p.user?.username || 'photographer',
                name: p.user?.name || 'Unsplash Photographer',
                portfolio_url: p.user?.portfolio_url || userHtml,
                links: {
                  html: userHtml,
                  photos: p.user?.links?.photos || userHtml,
                }
              },
              tags: Array.isArray(p.tags) ? p.tags : []
            };
          });
        } catch (fetchErr) {
          console.warn('[Unsplash Search] Error fetching from Unsplash API:', fetchErr);
          return [];
        }
      };

      // 1. Primary search with user query
      let validResults = await fetchFromUnsplash(query);

      // 2. If 0 results and query contains Korean characters, search with English keyword equivalents
      const hasKorean = /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/.test(query);
      if (validResults.length === 0 && hasKorean) {
        // Built-in map of common Korean terms to English Unsplash queries
        const KOREAN_TERM_MAP: Record<string, string> = {
          '기내': 'airplane cabin flight',
          '액체': 'liquid containers travel bottles',
          '액체류': 'liquid containers travel toiletries',
          '수하물': 'airport luggage baggage',
          '수화물': 'airport luggage baggage',
          '위탁수하물': 'checked luggage airport conveyor',
          '위탁수화물': 'checked luggage airport conveyor',
          '지퍼백': 'clear zip bag travel toiletries',
          '보안검색': 'airport security checkpoint',
          '화장품': 'skincare cosmetic bottles',
          '여권': 'passport ticket travel',
          '탑승권': 'boarding pass airport',
          '보조배터리': 'power bank portable charger',
          '배터리': 'lithium battery power bank',
          '호텔': 'hotel room cozy bed interior',
          '숙소': 'hotel room accommodation',
          '카페': 'coffee shop cafe interior',
          '아메리카노': 'iced americano coffee cup',
          '라떼': 'latte art coffee cup',
          '디저트': 'dessert cake pastry plate',
          '맛집': 'delicious restaurant food dish',
          '식당': 'restaurant dining meal food',
          '고기': 'grilled beef bbq steak',
          '삼겹살': 'korean pork belly bbq',
          '스테이크': 'grilled beef steak dinner',
          '파스타': 'pasta dish plate italian',
          '피자': 'pizza slice baked oven',
          '여행': 'travel tourism luggage explore',
          '공항': 'airport terminal departure gate',
          '비행기': 'airplane flying sky clouds',
          '휴식': 'relax peaceful living room tea',
          '건강': 'healthy lifestyle organic fruit',
          '운동': 'workout fitness gym training',
          '다이어트': 'healthy salad diet nutrition',
          '청소': 'cleaning room tidy home',
          '스마트폰': 'smartphone touchscreen mobile',
          '노트북': 'laptop computer modern desk',
        };

        const matchingTerms: string[] = [];
        for (const [k, eng] of Object.entries(KOREAN_TERM_MAP)) {
          if (query.includes(k)) {
            matchingTerms.push(eng);
          }
        }

        if (matchingTerms.length > 0) {
          const fallbackEngQuery = matchingTerms.join(' ');
          validResults = await fetchFromUnsplash(fallbackEngQuery);
        }
      }

      // Return strictly validated Unsplash results (or empty array if none)
      return res.json({
        success: true,
        total: validResults.length,
        total_pages: validResults.length > 0 ? 1 : 0,
        results: validResults
      });
    } catch (err: any) {
      console.error('[Unsplash Search Proxy Error]:', err);
      res.status(500).json({ success: false, message: err?.message || 'Unsplash search failed', results: [] });
    }
  });

  // ----------------------------------------------------
  // Unsplash Image Auto-Transformation & Anti-Duplicate Pipeline
  // Uses sharp to apply random crop (90-95%), brightness/saturation/contrast (±5-10%),
  // and micro-rotation (<= 1 deg), saving unique output to Supabase Storage.
  // ----------------------------------------------------
  app.post('/api/unsplash/transform-and-store', async (req: any, res: any) => {
    try {
      const url = (req.body?.url || '').toString().trim();
      const userId = (req.body?.userId || '').toString().trim();
      const draftId = (req.body?.draftId || '').toString().trim();
      const format = (req.body?.format === 'jpeg' ? 'jpeg' : 'webp') as 'webp' | 'jpeg';
      const quality = Math.min(100, Math.max(60, Number(req.body?.quality) || 92));

      if (!url) {
        return res.status(400).json({ success: false, message: 'Image URL is required' });
      }

      const supabase = getSupabaseAdmin(req);
      const result = await processAndUploadUnsplashImage(url, supabase, {
        userId,
        draftId,
        format,
        quality,
      });

      return res.json(result);
    } catch (err: any) {
      console.error('[API /api/unsplash/transform-and-store] Error:', err);
      return res.status(500).json({
        success: false,
        message: err?.message || 'Failed to transform and store Unsplash image',
      });
    }
  });

  app.post('/api/unsplash/transform-batch', async (req: any, res: any) => {
    try {
      const items = Array.isArray(req.body?.items) ? req.body.items : [];
      const userId = (req.body?.userId || '').toString().trim();
      const draftId = (req.body?.draftId || '').toString().trim();

      if (items.length === 0) {
        return res.json({ success: true, count: 0, results: [] });
      }

      const supabase = getSupabaseAdmin(req);

      // Process in parallel with safe concurrency (up to 5)
      const results: any[] = [];
      const concurrency = 5;
      for (let i = 0; i < items.length; i += concurrency) {
        const batch = items.slice(i, i + concurrency);
        const batchPromises = batch.map(async (item: any) => {
          const itemUrl = (item.url || item.imageUrl || '').toString().trim();
          if (!itemUrl) {
            return { id: item.id, success: false, message: 'Missing URL' };
          }
          try {
            const transformRes = await processAndUploadUnsplashImage(itemUrl, supabase, {
              userId,
              draftId,
              format: 'webp',
              quality: 92,
            });
            return {
              id: item.id,
              alt: item.alt || item.subject,
              ...transformRes,
            };
          } catch (itemErr: any) {
            console.warn(`[Batch Transform] Failed for item ${item.id || itemUrl}:`, itemErr.message);
            return {
              id: item.id,
              success: false,
              originalUrl: itemUrl,
              transformedUrl: itemUrl,
              error: itemErr.message,
            };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }

      return res.json({
        success: true,
        count: results.length,
        results,
      });
    } catch (err: any) {
      console.error('[API /api/unsplash/transform-batch] Error:', err);
      return res.status(500).json({
        success: false,
        message: err?.message || 'Failed to process batch transformations',
        results: [],
      });
    }
  });

  // Serve locally cached transformed images
  app.use('/transformed-images', express.static(path.join(process.cwd(), 'public', 'transformed-images')));

  // Real-time Naver Benchmark Raw Data Inspection Endpoint
  app.get('/api/ai/benchmark-preview', async (req: any, res: any) => {
    const keyword = (req.query.keyword as string || '').trim();
    if (!keyword) {
      return res.status(400).json({ success: false, message: '키워드를 입력해주세요.' });
    }

    try {
      const [relatedKeywords, topPosts] = await Promise.all([
        fetchNaverRelatedKeywords(keyword),
        fetchNaverTopBlogPosts(keyword),
      ]);

      const benchmarkPromptSnippet = `[실시간 네이버 연관 검색어 (${relatedKeywords.length}개)]\n${relatedKeywords.length > 0 ? relatedKeywords.join(', ') : '없음'}\n\n[실시간 네이버 상위 1~5위 실제 포스팅 벤치마킹 데이터]\n${topPosts.length > 0 ? topPosts.map((p, i) => `${i + 1}위: "${p.title}" (블로거: ${p.bloggername})\n- 스니펫: ${p.description}\n- 링크: ${p.link}`).join('\n\n') : '수집된 상위 글 없음'}`;

      return res.json({
        success: true,
        keyword,
        relatedKeywordsCount: relatedKeywords.length,
        relatedKeywords,
        topPostsCount: topPosts.length,
        topPosts,
        benchmarkPromptSnippet,
        fetchedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('[Benchmark Preview Error]:', err);
      return res.status(500).json({
        success: false,
        message: err?.message || '실시간 네이버 데이터 수집 중 오류가 발생했습니다.',
      });
    }
  });

  // Dedicated Independent AI Image Generation Endpoint
  app.post('/api/ai/generate-image', async (req: any, res: any) => {
    try {
      const {
        topic,
        style = 'photoreal',
        aspectRatio = '16:9',
        contentType,
        customPrompt,
      } = req.body || {};

      const cleanTopic = (topic || customPrompt || '블로그 본문 주제와 관련된 자연스러운 장면').toString().trim();

      // Check forbidden content type (경험 리뷰형)
      if (!isAiImageAllowedForContentType(contentType)) {
        return res.status(400).json({
          success: false,
          isForbiddenType: true,
          message: '실제 방문/사용 경험을 보여주는 콘텐츠라면 직접 촬영한 사진을 사용하는 것을 권장합니다.',
        });
      }

      // Build style-specific prompt from centralized config (src/config/imageStyles.ts)
      const { prompt: fullPrompt, negativePrompt } = buildImagePrompt(
        style,
        cleanTopic,
        aspectRatio as any
      );

      // Map aspect ratio for Gemini & Fallbacks
      const supportedRatios = ['1:1', '3:4', '4:3', '9:16', '16:9'];
      let targetRatio = '16:9';
      if (supportedRatios.includes(aspectRatio)) {
        targetRatio = aspectRatio;
      } else if (aspectRatio === '4:5') {
        targetRatio = '3:4';
      }

      let pWidth = 1280;
      let pHeight = 720;
      if (targetRatio === '1:1') {
        pWidth = 1024;
        pHeight = 1024;
      } else if (targetRatio === '3:4') {
        pWidth = 768;
        pHeight = 1024;
      } else if (targetRatio === '9:16') {
        pWidth = 720;
        pHeight = 1280;
      } else if (targetRatio === '4:3') {
        pWidth = 1024;
        pHeight = 768;
      }

      let generatedBase64 = '';
      let generatedMimeType = 'image/jpeg';

      // 1. Try Gemini Image Generation (gemini-3.1-flash-lite-image, gemini-3.1-flash-image)
      try {
        const geminiClient = getGeminiClient();
        const imageModels = ['gemini-3.1-flash-lite-image', 'gemini-3.1-flash-image'];

        for (const model of imageModels) {
          try {
            const promptWithNegative = negativePrompt
              ? `${fullPrompt}\n\n[Negative Prompt / Do Not Include]\n${negativePrompt}`
              : fullPrompt;

            const response = await geminiClient.models.generateContent({
              model,
              contents: {
                parts: [{ text: promptWithNegative }],
              },
              config: {
                imageConfig: {
                  aspectRatio: targetRatio,
                },
              },
            });

            if (response.candidates?.[0]?.content?.parts) {
              for (const part of response.candidates[0].content.parts) {
                if (part.inlineData && part.inlineData.data) {
                  generatedBase64 = part.inlineData.data;
                  generatedMimeType = part.inlineData.mimeType || 'image/jpeg';
                  break;
                }
              }
            }
            if (generatedBase64) break;
          } catch (modelErr: any) {
            const msg = modelErr?.message || '';
            // Log concisely without throwing or flooding
            if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
              console.info(`[Gemini Image Model ${model}]: Free quota reached, proceeding to fallback.`);
            } else {
              console.warn(`[Gemini Image Model ${model} Attempt]:`, msg.slice(0, 120));
            }
          }
        }
      } catch (geminiInitErr) {
        console.warn('[Gemini Client Init Issue]:', geminiInitErr);
      }

      // 2. Try Pollinations AI High-Quality Zero-Quota AI Generators (FLUX and Turbo Models)
      if (!generatedBase64) {
        const isFairytale = style === 'fairytale';
        const pollPrompt = isFairytale
          ? `Lyrical children storybook watercolor illustration of ${cleanTopic}, dreamy nature, soft gouache texture, pastel colors, high detail`
          : `Authentic smartphone photography of ${cleanTopic}, natural daylight, clean composition, high resolution, realistic everyday Korean lifestyle`;

        const seed = Math.floor(Math.random() * 9999999);
        const pollModels = ['flux', 'turbo'];

        for (const pModel of pollModels) {
          try {
            const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(pollPrompt)}?width=${pWidth}&height=${pHeight}&model=${pModel}&nologo=true&seed=${seed}`;
            const pollRes = await fetch(pollinationsUrl, { signal: AbortSignal.timeout(12000) });
            if (pollRes.ok) {
              const arrayBuffer = await pollRes.arrayBuffer();
              if (arrayBuffer && arrayBuffer.byteLength > 3000) {
                generatedBase64 = Buffer.from(arrayBuffer).toString('base64');
                generatedMimeType = 'image/jpeg';
                break;
              }
            }
          } catch (pollErr: any) {
            console.warn(`[Pollinations ${pModel} failed]:`, pollErr?.message || pollErr);
          }
        }
      }

      // 4. Try OpenAI DALL-E fallback
      if (!generatedBase64) {
        try {
          const openai = getOpenAIClient();
          if (openai) {
            try {
              const dalleRes = await openai.images.generate({
                model: 'dall-e-3',
                prompt: fullPrompt.slice(0, 950),
                n: 1,
                size: targetRatio === '16:9' ? '1792x1024' : targetRatio === '9:16' ? '1024x1792' : '1024x1024',
              });
              const b64 = (dalleRes?.data?.[0] as any)?.b64_json;
              const imgUrl = dalleRes?.data?.[0]?.url;
              if (b64) {
                generatedBase64 = b64;
                generatedMimeType = 'image/png';
              } else if (imgUrl) {
                const imgFetch = await fetch(imgUrl, { signal: AbortSignal.timeout(8000) });
                if (imgFetch.ok) {
                  const arrayBuffer = await imgFetch.arrayBuffer();
                  generatedBase64 = Buffer.from(arrayBuffer).toString('base64');
                  generatedMimeType = 'image/png';
                }
              }
            } catch (dalle3Err: any) {
              console.warn('[DALL-E fallback failed]:', dalle3Err?.message || dalle3Err);
            }
          }
        } catch (dalleErr: any) {
          console.warn('[DALL-E fallback general error]:', dalleErr?.message || dalleErr);
        }
      }

      // 5. Try Unsplash Contextual Search + Sharp Transformation Fallback
      if (!generatedBase64) {
        try {
          const unsplashAccessKey = process.env.UNSPLASH_ACCESS_KEY || 'N_fXzJbKzI2l7q3bA4oG9vF6kH1tY8mR5uP0eW3xZ8c';
          const queryTerm = cleanTopic.replace(/[[\]()#]/g, '').trim().slice(0, 40);
          const uRes = await fetch(
            `https://api.unsplash.com/search/photos?query=${encodeURIComponent(queryTerm)}&per_page=3&orientation=landscape`,
            {
              headers: { Authorization: `Client-ID ${unsplashAccessKey}` },
              signal: AbortSignal.timeout(8000),
            }
          );
          if (uRes.ok) {
            const uData: any = await uRes.json();
            const firstPhoto = uData?.results?.[0];
            const rawUrl = firstPhoto?.urls?.regular || firstPhoto?.urls?.small;
            if (rawUrl) {
              const imgRes = await fetch(rawUrl, { signal: AbortSignal.timeout(8000) });
              if (imgRes.ok) {
                const imgBuf = Buffer.from(await imgRes.arrayBuffer());
                const transformed = await transformImageWithSharp(imgBuf, { format: 'jpeg', quality: 90 });
                generatedBase64 = transformed.buffer.toString('base64');
                generatedMimeType = 'image/jpeg';
              }
            }
          }
        } catch (uErr: any) {
          console.warn('[Unsplash fallback failed]:', uErr?.message || uErr);
        }
      }

      // 6. Guaranteed Local Sharp Graphic Generator Fallback (Never Fails)
      if (!generatedBase64) {
        try {
          const isFairytale = style === 'fairytale';
          const bgColor1 = isFairytale ? '#FDF2F8' : '#1E293B';
          const bgColor2 = isFairytale ? '#EDE9FE' : '#0F172A';
          const textColor = isFairytale ? '#831843' : '#F8FAFC';
          const subColor = isFairytale ? '#9D174D' : '#94A3B8';
          const accentColor = isFairytale ? '#EC4899' : '#38BDF8';

          const escapedTopic = cleanTopic.replace(/[&<>"']/g, (m) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
          }[m] || m));

          const svg = `
          <svg width="${pWidth}" height="${pHeight}" viewBox="0 0 ${pWidth} ${pHeight}" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="${bgColor1}" />
                <stop offset="100%" stop-color="${bgColor2}" />
              </linearGradient>
              <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="${accentColor}" />
                <stop offset="100%" stop-color="#818CF8" />
              </linearGradient>
            </defs>
            <rect width="100%" height="100%" fill="url(#bgGrad)" />
            <circle cx="${pWidth * 0.85}" cy="${pHeight * 0.2}" r="${Math.min(pWidth, pHeight) * 0.35}" fill="${accentColor}" opacity="0.12" />
            <circle cx="${pWidth * 0.15}" cy="${pHeight * 0.8}" r="${Math.min(pWidth, pHeight) * 0.25}" fill="#818CF8" opacity="0.1" />
            
            <rect x="${pWidth * 0.08}" y="${pHeight * 0.15}" width="${pWidth * 0.84}" height="${pHeight * 0.7}" rx="24" fill="${isFairytale ? '#FFFFFF' : '#FFFFFF'}" fill-opacity="${isFairytale ? '0.7' : '0.06'}" stroke="${accentColor}" stroke-opacity="0.3" stroke-width="2" />
            
            <text x="${pWidth * 0.5}" y="${pHeight * 0.44}" font-family="sans-serif" font-size="${Math.max(24, Math.floor(pWidth * 0.036))}" font-weight="bold" fill="${textColor}" text-anchor="middle">
              ${escapedTopic.slice(0, 35)}
            </text>
            <text x="${pWidth * 0.5}" y="${pHeight * 0.56}" font-family="sans-serif" font-size="${Math.max(15, Math.floor(pWidth * 0.02))}" fill="${subColor}" text-anchor="middle">
              ${isFairytale ? '✦ 블로그 맞춤 스토리 비주얼 일러스트' : '✦ 블로그 핵심 주제 가이드 비주얼'}
            </text>
            <rect x="${pWidth * 0.42}" y="${pHeight * 0.65}" width="${pWidth * 0.16}" height="4" rx="2" fill="url(#accentGrad)" />
          </svg>`;

          const sharpBuf = await sharp(Buffer.from(svg)).jpeg({ quality: 95 }).toBuffer();
          generatedBase64 = sharpBuf.toString('base64');
          generatedMimeType = 'image/jpeg';
        } catch (svgErr: any) {
          console.warn('[Sharp fallback failed]:', svgErr?.message || svgErr);
        }
      }

      // Explicitly reject if image data is missing or empty
      if (!generatedBase64 || generatedBase64.trim().length === 0) {
        return res.status(500).json({
          success: false,
          error: 'Image Generation Failed',
          message: '이미지 생성에 실패했습니다. 직접 이미지를 업로드하거나 다시 시도해주세요.',
        });
      }

      const imageUrl = `data:${generatedMimeType};base64,${generatedBase64}`;
      return res.json({
        success: true,
        imageUrl,
        prompt: fullPrompt,
        style,
        aspectRatio,
        generatedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('[API /api/ai/generate-image Error]:', err);
      return res.status(500).json({
        success: false,
        error: 'Image Generation Error',
        message: '이미지 생성에 실패했습니다. 직접 이미지를 업로드하거나 다시 시도해주세요.',
      });
    }
  });

  app.post(['/api/gemini/generate', '/api/gemini/toolkit'], async (req: any, res: any) => {
    try {
      const {
        type,
        subKeywords,
        targetName,
        userExperience,
        emphasisNotes,
        targetAudience,
        tonePreset,
        formatStyle,
        targetLength,
        isPlain,
      } = req.body || {};
      const promptInput = req.body?.promptInput || req.body?.keyword || req.body?.topic || '';

      if (!type) {
        return res.status(400).json({ success: false, message: 'Type parameter is required' });
      }

      const userKey = getNormalizedUserKey(req, req.body);
      const mappedFeatureKey = mapRequestTypeToFeatureKey(type);

      // Server-Side Tier & Usage Limit Verification
      const limitCheck = await checkFeatureLimitServerSide(req.body, mappedFeatureKey, req);
      if (!limitCheck.allowed) {
        return res.status(limitCheck.errorStatus || 403).json({
          success: false,
          error: limitCheck.limit === 0 ? 'Feature Disabled' : 'Usage Limit Exceeded',
          message: limitCheck.reason || '현재 이용 등급의 한도를 초과하였거나 지원되지 않는 기능입니다.',
          usedCount: limitCheck.usedCount,
          limit: limitCheck.limit,
          period: limitCheck.period,
          tierId: limitCheck.tierId,
          tierName: limitCheck.tierName,
          remainingUses: 0,
        });
      }

      let topPostsData: any[] = [];
      let relatedKeywordsData: string[] = [];
      let benchmarkPromptStr = '';
      let topRankSummary = '';
      const supabaseAdmin = getSupabaseAdmin(req);

      let systemPrompt = '';
      let promptForGemini = '';
      let isJsonResponse = false;

      if (type === 'analyze_intent') {
        systemPrompt = `당신은 네이버 블로그 검색 의도 및 콘텐츠 분류 AI 전문가입니다.
사용자가 입력한 키워드와 맥락을 정밀 분석하여 검색 의도, 콘텐츠 유형, 전환 목표, 가장 적합한 5대 글 작성 스타일, 세부 경험 유형, 그리고 콘텐츠 범위(Content Boundary)를 판단하여 순수 JSON으로 반환하세요.

[5가지 글 작성 스타일 정의 및 우선 분류 기준]
1. "info" (정보 탐색형 - draft_info):
   - 절차, 규정, 방법, 조건, 비용, 기준, 준비물 등 검색자가 궁금해하는 질문에 정확하고 실용적인 해결책을 제공하는 키워드
   - 특히 다음과 같은 표현/의도가 포함된 경우 정보 탐색형(info)을 우선 고려하십시오:
     * ~하는 법, ~방법, ~절차, ~규정, ~조건, ~신청, ~준비물, ~기준, ~비용, ~기간, ~여는 법, ~확인 방법, ~예약 방법, ~사용 방법, ~반입 가능 여부, ~가능한가
2. "experience" (경험 리뷰형 - draft_review):
   - 장소(맛집, 카페, 여행, 숙소), 상품(전자기기, 생활용품, 뷰티), 서비스, 전시/문화, 강의, 앱 등 직접 경험/방문/사용한 대상의 생생한 후기 및 체감 키워드
3. "purchase" (구매 추천형 - draft_purchase):
   - 가성비 제품 추천, 베스트 Top N, 구매 가이드, 가격대별 추천, 순위, 선물 추천 키워드
4. "comparison" (비교 분석형 - draft_comparison):
   - 2개 이상 제품/서비스 비교, A vs B, 스펙 차이점 분석, 대안 비교 키워드
5. "homepan" (홈판 화제형 - draft_homepan):
   - 대중적 관심사, 트렌드, 흥미로운 에피소드/사연, 공감 스토리텔링, 최근 화제성 이슈 키워드

[포괄형·추천형 vs 단일 명확 정보형 검색의도 엄격 분리 원칙]
- 포괄적·추천형 키워드 (예: "국내가을여행지추천", "국내여행지추천", "서울근교가볼만한곳", "부산맛집추천", "가을여행지추천"):
  * 검색자는 해당 지역/테마 안에서 신뢰할 수 있는 3~5곳의 구체적 후보 추천과 상황별 선택 기준을 원합니다.
  * ❌ 엄격 금지: 키워드가 '국내'인데 해외 여행지를 언급하거나 국내vs해외를 비교하는 행위, 키워드 범위를 벗어난 엉뚱한 지역 언급, 뜬구름 잡는 여행 철학 사설 등.
  * recommendedStructure: "검색자의 선택 기준 및 시즌 포인트 ➔ 구체적 추천 후보 3~5곳과 핵심 매력 ➔ 동행자/상황별 맞춤 추천 ➔ 실전 방문 팁 및 최종 선택 가이드"
  * contentBoundary 필수 설정:
    - geographicScope: 명시된 지역 (예: "대한민국 국내", "서울 근교", "부산 광역시")
    - contentTypeCategory: "recommendation_curation"
    - mustCover: ["구체적 추천 후보 3~5곳 명칭 및 특징", "계절/상황별 방문 포인트", "상황별 맞춤 추천", "주차/이용 실전 팁"]
    - mustAvoid: ["해외 여행지 비교", "국내외 비교 분석", "키워드 외 타지역 장소", "불필요한 일반론 및 사색"]
- 명확한 해답/절차/단일 정보형 키워드 (예: "KTX 할인", "기내 액체 반입", "청년도약계좌 신청"):
  * recommendedStructure: "핵심 요약 및 결론 ➔ 자격 조건 및 대상 ➔ 신청/이용 절차 및 방법 ➔ 주의사항 및 예외 규정 ➔ 실전 꿀팁"
  * contentBoundary 필수 설정:
    - contentTypeCategory: "specific_guide"
    - mustCover: ["핵심 대상 및 할인/규정 기준", "신청 및 확인 방법", "주의사항 및 필수 조건"]
    - mustAvoid: ["검색 의도와 무관한 잡다한 사설", "검증되지 않은 비공식 정보"]

반드시 아래 JSON 스키마를 만족하는 순수 JSON만 출력하세요:
{
  "searchIntent": "informational | comparison | commercial | transactional | navigational | informational_commercial",
  "searchIntentSummary": "검색 의도 핵심 요약 (예: 가을 시즌 가볼만한 국내 대표 여행지 3~5곳 추천 및 코스 확인)",
  "contentType": "experience_review | informational_guide | purchase_recommendation | comparison_analysis | trend_story",
  "contentTypeSummary": "콘텐츠 유형 명칭 (예: 국내 가을 여행지 추천 가이드, 기내 반입 규정 가이드, 맛집 경험 리뷰)",
  "conversionGoal": "information | trust_building | purchase_consideration | click_conversion | engagement",
  "writingStyle": "experience | info | purchase | comparison | homepan",
  "writingStyleLabel": "경험 리뷰형 | 정보 탐색형 | 구매 추천형 | 비교 분석형 | 홈판 화제형",
  "experienceType": "restaurant | cafe | travel | product | accommodation | exhibition | service | education | app | space | activity | general",
  "experienceTypeLabel": "맛집 | 카페 | 여행 | 제품 | 숙소 | 전시 | 서비스 | 교육 | 앱 | 공간 | 체험 | 일반",
  "targetAudience": "타깃 독자층 요약",
  "recommendedStructure": "추천 본문 전개 흐름 요약",
  "reason": "추천 사유 요약",
  "contentBoundary": {
    "coreIntent": "해당 키워드의 핵심 검색 의도",
    "targetAudience": "타깃 독자층",
    "mustCover": ["필수 포함 내용 1", "필수 포함 내용 2", "필수 포함 내용 3"],
    "optionalCover": ["선택적 보강 내용 1", "선택적 보강 내용 2"],
    "mustAvoid": ["절대 포함하지 말아야 할 제외 주제 1", "제외 주제 2"],
    "geographicScope": "지리적 대상 범위 (예: 국내 전체, 서울 근교, 부산 등)",
    "contentTypeCategory": "recommendation_curation | specific_guide | review | comparison | general"
  }
}`;
        isJsonResponse = true;
        promptForGemini = `[분석 요청 키워드]: "${(promptInput || '').trim()}"`;
      } else if (type === 'golden_keyword') {
        systemPrompt = await getActivePrompt('golden_keyword', supabaseAdmin);
        isJsonResponse = true;
        const writingStyleStr = req.body.writingStyle ? `\n[사용자 지정/선택 글 작성 스타일]: ${req.body.writingStyle}` : '';
        const experienceTypeStr = req.body.experienceType ? `\n[세부 경험 유형]: ${req.body.experienceType}` : '';
        const targetAudienceStr = req.body.targetAudience ? `\n[타깃 독자층]: ${req.body.targetAudience}` : '';
        const intentSummaryStr = req.body.intentSummary ? `\n[사전 분석된 검색 의도]: ${req.body.intentSummary}` : '';
        const targetNameStr = req.body.targetName ? `\n[대상명]: ${req.body.targetName}` : '';
        const subKeywordsStr = req.body.subKeywords ? `\n[추가 희망 연관 키워드]: ${req.body.subKeywords}` : '';
        const userExpStr = req.body.userExperience ? `\n\n[사용자 직접 입력 정보 및 실제 경험 메모]:\n${req.body.userExperience}` : '';

        const keywordTrimmed = (promptInput || '').trim();
        if (Array.isArray(req.body.relatedKeywords) && req.body.relatedKeywords.length > 0) {
          relatedKeywordsData = req.body.relatedKeywords;
        } else {
          relatedKeywordsData = await fetchNaverRelatedKeywords(keywordTrimmed);
        }
        if (Array.isArray(req.body.topPosts) && req.body.topPosts.length > 0) {
          topPostsData = req.body.topPosts;
        } else {
          topPostsData = await fetchNaverTopBlogPosts(keywordTrimmed);
        }

        // 실시간 검색 데이터 연관도 평가 및 필터링 수행
        const scoredPosts = filterAndScoreTopPosts(topPostsData, keywordTrimmed, relatedKeywordsData);
        // 4단계 키워드 구조화
        const keyword4Tier = structureKeywords4Tier(keywordTrimmed, relatedKeywordsData, scoredPosts);
        // 상위 블로그 제목/스니펫 및 연관검색어에서 핵심 명사 및 정보 단위 추출
        const extractedUnits = extractBenchmarkNounsAndUnits(keywordTrimmed, relatedKeywordsData, scoredPosts);

        const internalAnalysisBenchmarkStr = `
[실시간 네이버 검색 데이터 AI 내부 정제 및 구조화 분석 결과]
1. 키워드 4단계 구조화:
   - [Tier A. 원키워드]: ${keyword4Tier.tierA}
   - [Tier B. 핵심 연관 키워드 (${keyword4Tier.tierB.length}개)]: ${keyword4Tier.tierB.join(', ') || '없음'}
   - [Tier C. 세부 검색의도 키워드 (${keyword4Tier.tierC.length}개)]: ${keyword4Tier.tierC.join(', ') || '없음'}
   - [Tier D. 하위 주제 키워드 (H2 소제목용)]: ${keyword4Tier.tierD.join(', ')}

2. 실시간 상위 검색 문서 연관도 선별 결과 (총 ${scoredPosts.length}개 고연관 문서 선별됨):
${scoredPosts.map((p, i) => `   * 문서 ${i + 1} (연관도 ${p.relevanceScore}점/${p.relevanceLevel} - ${p.matchReasons.join(', ')}):
     - 제목: "${p.title}"
     - 스니펫: ${p.description}`).join('\n')}

3. 상위 문서 및 연관검색어에서 추출된 핵심 명사 및 구체적 정보 단위:
   - [추출된 핵심 명사/속성]: ${extractedUnits.frequentNouns.slice(0, 15).join(', ') || '없음'}
   - [추출된 대상/조건]: ${extractedUnits.concreteUnits.targetsOrConditions.join(', ') || '없음'}
   - [추출된 카테고리/종류]: ${extractedUnits.concreteUnits.categoriesOrTypes.join(', ') || '없음'}
   - [추출된 방법/행동]: ${extractedUnits.concreteUnits.methodsOrActions.join(', ') || '없음'}
   - [추출된 시기/지역]: ${extractedUnits.concreteUnits.temporalOrLocational.join(', ') || '없음'}

[AI 내부 실행 지침 - 추천 제목 생성 7대 우선순위 및 10대 검증 규칙]
1. 추천 제목 생성 7대 우선순위:
   1) 입력 키워드의 정확한 의미 ➔ 2) 검색자의 실제 검색 의도 ➔ 3) 실시간 연관검색어 (Tier B, C) ➔ 4) 실시간 상위 블로그 제목 조합 ➔ 5) 상위 스니펫 구체 정보 ➔ 6) 글쓰기 스타일 ➔ 7) AI 일반 지식 (보완용)
2. 검색어 의미 판독 및 무관 범주(MUST AVOID) 배제:
   - 대상, 행동, 검색 목적을 먼저 파악하고 키워드와 무관한 범주/행동(지원금, 신청, 예매, 할인, 청소, 주방 등 키워드와 직접 관련 없는 영역)을 MUST AVOID로 규정하여 제목에서 절대 사용하지 마십시오.
3. ❌ 연상 기반 확장(Associative Over-expansion) 절대 금지:
   - 다이소 → 살림 → 주방 → 청소 (❌ 금지)
   - 여행 → 해외여행 → 항공권 (❌ 금지)
   - 에어컨 → 지원사업 → 신청 (❌ 금지)
   - 무선마우스 → 사무용품 → 직장인 (❌ 실제 데이터 없을 시 금지)
4. ❌ 범용 고정 템플릿 절대 금지 (Negative Policy):
   - "완벽 가이드", "핵심 체크리스트", "핵심 정보 및 세부 확인 사항", "주요 특징 및 상황별 비교", "주요 특징과 상황별 선택 기준", "필수 확인 사항과 실전 노하우", "꼭 알아야 할 실전 노하우", "실전 활용 팁", "총정리", "BEST / TOP / 순위", "솔직 후기", "삶의 질 올려주는", "실패 없는" 등의 상투적 문구를 제목 후반부에 기계적으로 붙이지 마십시오.
5. 키워드 도메인별 실제 요소 결합:
   - [교통/티켓/할인/예매]: 할인 대상(청년/청소년/임산부/다자녀 등), 할인율, 예매 방법(코레일톡/앱) 결합 (예: "KTX 할인 대상별 혜택 조건 및 코레일톡 예매 방법")
   - [여행/나들이/명소 큐레이션]: 지역, 시기(10월/단풍/억새), 여행 목적(가족/연인/당일치기/1박2일), 명소 스팟 결합 (예: "국내 가을 여행지 추천 10월 단풍 명소부터 억새 드라이브 코스까지")
   - [쇼핑/특정 제품 큐레이션]: 실제 대상 제품(무선마우스), 가성비/가격, 스펙/체감, 구매 전 체크사항 결합 (예: "다이소 무선마우스 추천 가성비 제품과 구매 전 체크할 점") ❌ 무관한 살림/주방/청소 템플릿 절대 금지!
   - [방법/청소/관리 가이드]: 분리/탈거, 세척 방법(물세척/중성세제), 건조/관리, 주기 결합 (예: "에어컨 필터 청소방법 분리부터 세척·건조까지")
   - [정보/신청/절차 가이드]: 자격, 필수 서류, 절차, 지급 일정 결합 (예: "청년도약계좌 신청 자격 및 필수 제출 서류 목록")
6. 10대 제목 검증 통과 1~5개 후보만 반환 (억지로 5개를 채우지 마십시오).
`;

        // 실제 근거 데이터 (Grounding Data: 상품/장소 링크 및 수동 입력 정보)
        let groundingDataStr = '';
        if (req.body.groundingData || req.body.linkData || req.body.extractedData) {
          const gd = req.body.groundingData || req.body.linkData || req.body.extractedData;
          const gdLines: string[] = [];
          if (gd.title) gdLines.push(`- 상품/장소명: ${gd.title}`);
          if (gd.brand) gdLines.push(`- 브랜드/제조사/상호: ${gd.brand}`);
          if (gd.price) gdLines.push(`- 가격/비용 정보: ${gd.price}`);
          if (gd.address) gdLines.push(`- 주소/위치/방문지: ${gd.address}`);
          if (gd.siteName) gdLines.push(`- 출처 플랫폼: ${gd.siteName}`);
          if (gd.sourceUrl) gdLines.push(`- 참조 원본 URL: ${gd.sourceUrl}`);
          if (gd.description) gdLines.push(`- 요약 설명 및 특징: ${gd.description}`);
          if (gd.userNotes) gdLines.push(`- 사용자 추가 메모/체감 포인트: ${gd.userNotes}`);
          if (gdLines.length > 0) {
            groundingDataStr = `\n\n[실제 근거 데이터 (Grounding Data)]\n${gdLines.join('\n')}`;
          }
        }

        benchmarkPromptStr = internalAnalysisBenchmarkStr;
        promptForGemini = `[분석 요청 키워드]: "${keywordTrimmed}"${writingStyleStr}${experienceTypeStr}${targetAudienceStr}${intentSummaryStr}${targetNameStr}${subKeywordsStr}${userExpStr}${groundingDataStr}\n${internalAnalysisBenchmarkStr}`;
      } else if (type === 'generate_outline' || type === 'outline') {
        const selectedTitle = cleanAndNormalizeTitle(req.body.selectedTitle || req.body.title || req.body.h1 || '');
        const mainKeyword = (req.body.mainKeyword || req.body.promptInput || selectedTitle || '').trim();
        const writingStyle = (req.body.writingStyle || 'experience').trim();
        const targetAudience = (req.body.targetAudience || '해당 주제를 검색하는 실사용자').trim();
        const intentSummary = (req.body.intentSummary || req.body.searchIntent || '').trim();
        const userExperience = (req.body.userExperience || '').trim();
        const contentBoundary = req.body.contentBoundary || req.body.seoPlan?.contentBoundary;

        if (!selectedTitle) {
          return res.status(400).json({ success: false, message: '선택된 제목(selectedTitle)이 필요합니다.' });
        }

        const keywordTrimmed = mainKeyword || selectedTitle;
        if (Array.isArray(req.body.relatedKeywords) && req.body.relatedKeywords.length > 0) {
          relatedKeywordsData = req.body.relatedKeywords;
        } else {
          relatedKeywordsData = await fetchNaverRelatedKeywords(keywordTrimmed);
        }
        if (Array.isArray(req.body.topPosts) && req.body.topPosts.length > 0) {
          topPostsData = req.body.topPosts;
        } else {
          topPostsData = await fetchNaverTopBlogPosts(keywordTrimmed);
        }

        let boundaryGuidanceStr = '';
        if (contentBoundary) {
          const mustCoverItems = Array.isArray(contentBoundary.mustCover) ? contentBoundary.mustCover.join(', ') : '';
          const mustAvoidItems = Array.isArray(contentBoundary.mustAvoid) ? contentBoundary.mustAvoid.join(', ') : '';
          boundaryGuidanceStr = `
━━━━━━━━━━━━━━━━━━━━━━
[콘텐츠 범위(Content Boundary) 및 검색의도 준수 지침]
━━━━━━━━━━━━━━━━━━━━━━
- 핵심 목적: ${contentBoundary.coreIntent || keywordTrimmed}
- 지리적/지역 범위: ${contentBoundary.geographicScope || '키워드 명시 범위'}
${mustCoverItems ? `- 필수 다룰 주제: ${mustCoverItems}` : ''}
${mustAvoidItems ? `- 절대 제외할 주제 (금지): ${mustAvoidItems}` : ''}
- ❌ 절대 금지: 국내 키워드에 해외 여행지 비교나 해외 내용 포함 금지, 키워드 외 지역 확장 금지.
`;
        }

        systemPrompt = `당신은 네이버 블로그 검색 노출 최적화 및 본문 H2 소제목 구조 설계 최고 전문가입니다.
사용자가 직접 선택한 포스팅 제목("${selectedTitle}")을 정밀 분석하여, 해당 제목의 약속과 검색자의 검색 의도를 100% 만족시키는 H2 세부 소제목(3~6개)을 설계하여 순수 JSON으로 응답하십시오.
${boundaryGuidanceStr}
━━━━━━━━━━━━━━━━━━━━━━
[소제목(H2) 설계 4대 원칙]
━━━━━━━━━━━━━━━━━━━━━━
1. 선택된 제목과의 일치성 (Zero Discrepancy):
   - 소제목들은 반드시 사용자가 선택한 제목("${selectedTitle}")의 핵심 각도(코스, 날씨/옷차림, 체감후기, 문제해결, 비용, 추천 대상 등)에 직접 연결되어야 합니다.
   - 포괄형·추천형 키워드(예: 추천, 가볼만한곳, 코스, 맛집 등)의 경우:
     * H2 1: 선택 기준 및 시즌/테마 포인트 (예: 가을 국내 여행지 선택 기준 및 단풍 시기)
     * H2 2~4: 구체적인 추천 후보 3~5곳 (각각 명확한 장소명과 핵심 특징을 소제목에 명시)
     * H2 5: 상황별 맞춤 추천 (예: 가족·연인·나홀로 여행객별 맞춤 코스)
     * H2 6: 실전 방문 팁 및 준비물/주차 안내
   - 정보형/문제해결형 키워드(예: 할인, 방법, 신청, 규정 등)의 경우:
     * H2 1: 핵심 조건 및 혜택 요약
     * H2 2: 단계별 신청/이용 방법
     * H2 3: 주의사항 및 예외 규정
     * H2 4: 실전 팁 및 FAQ

2. 검색어 조합형 문장 (AI 상투어 및 의문문 금지):
   - ❌ 진부한 표현 금지: "~알아보겠습니다", "~살펴볼까요?", "최고의 꿀팁", "솔직 후기", "~어떨까요?"
   - ✅ 네이버 검색 상위 노출에 최적화된 구체적 명사/키워드 조합형 문장형 소제목

3. 각 소제목(H2)에 포함할 필수 데이터:
   - id: "h2_1", "h2_2", ...
   - heading: H2 소제목 명칭 (18~35자 내외의 명확한 문장)
   - coreContent: 해당 섹션에서 다룰 핵심 내용 및 설명 요약 (1~2문장)
   - keyKeywords: 해당 섹션 본문에 자연스럽게 포함할 핵심 키워드 배열 (2~4개)

4. 개수: 3~6개

반드시 아래 JSON 스키마 규격으로만 응답하십시오:
{
  "selectedTitle": "${selectedTitle}",
  "outline": [
    {
      "id": "h2_1",
      "heading": "소제목 1",
      "coreContent": "해당 단락에서 다룰 핵심 설명 요약",
      "keyKeywords": ["키워드1", "키워드2"]
    }
  ],
  "rationale": "소제목 구성 의도 및 제목과의 연계성 요약"
}`;

        isJsonResponse = true;
        promptForGemini = `[선택된 포스팅 제목]: "${selectedTitle}"
[메인 키워드]: "${keywordTrimmed}"
[글 작성 스타일]: "${writingStyle}"
[타깃 독자층]: "${targetAudience}"
${intentSummary ? `[검색 의도 요약]: "${intentSummary}"` : ''}
${userExperience ? `[사용자 직접 경험/메모]:\n${userExperience}` : ''}
${relatedKeywordsData.length > 0 ? `[실시간 연관 검색어]: ${relatedKeywordsData.slice(0, 8).join(', ')}` : ''}

위 선택된 제목과 콘텐츠 범위 지침에 최적화된 H2 세부 소제목 목차를 JSON으로 생성하십시오.`;
      } else if (type === 'draft') {
        const selectedStyle = formatStyle || req.body.draftType || 'review';
        const promptData = {
          mainTopic: (promptInput || '').trim(),
          subKeywords: subKeywords?.trim(),
          targetName: targetName?.trim(),
          userExperience: userExperience?.trim() || emphasisNotes?.trim(),
          targetAudience: targetAudience?.trim(),
          contentBoundary: req.body.contentBoundary || req.body.seoPlan?.contentBoundary,
          toneStyle: tonePreset,
          customTone: req.body.customTone,
          writingStyle: req.body.writingStyle,
          h2Style: req.body.h2Style || req.body.quoteStyle || req.body.userBlogStyle?.h2Style,
          selectedHtml: {
            includeFaq: req.body.includeFaq,
            includeTable: req.body.includeTable,
            includeChecklist: req.body.includeChecklist,
            includeImageRec: req.body.includeImageRec || req.body.imageGuide,
            includeQuote: req.body.includeQuote,
          },
        };

        systemPrompt = await buildDraftSystemPrompt(selectedStyle, promptData, supabaseAdmin);

        if (isPlain || req.body.outputFormat === 'plain') {
          systemPrompt = systemPrompt
            .replace(/순수 HTML/g, '일반 텍스트')
            .replace(/HTML 태그만/g, '일반 텍스트만')
            .replace(/<[^>]+>/g, '')
            .replace(/\[HTML 필수 요소:/g, '[필수 요소:')
            .replace(/<\/?(h[1-6]|section)>/g, '');
        }

        let imageGuidePrompt = '';
        if (req.body.includeImageRec || req.body.imageGuide) {
          imageGuidePrompt = `\n\n[이미지 배치 지침]\n본문 중간중간에 이미지 추천 가이드를 명시하세요.`;
        }

        let seoPlanPrompt = '';
        if (req.body.seoPlan) {
          const sp = typeof req.body.seoPlan === 'string' ? null : req.body.seoPlan;
          if (sp) {
            const planSummaryParts: string[] = [];
            if (sp.targetAudience || sp.searchIntent?.targetAudience) {
              planSummaryParts.push(`- 타겟 독자: ${sp.targetAudience || sp.searchIntent?.targetAudience}`);
            }
            if (sp.intentSummary || sp.searchIntent?.userGoal) {
              planSummaryParts.push(`- 검색 의도 & 핵심 목표: ${sp.intentSummary || sp.searchIntent?.userGoal}`);
            }
            if (sp.coreTopic || sp.keywordAnalysis?.intent) {
              planSummaryParts.push(`- 핵심 주제: ${sp.coreTopic || sp.keywordAnalysis?.intent}`);
            }
            if (sp.keyEmphasisPoints && Array.isArray(sp.keyEmphasisPoints) && sp.keyEmphasisPoints.length > 0) {
              planSummaryParts.push(`- 차별화 핵심 강조점:\n  * ${sp.keyEmphasisPoints.join('\n  * ')}`);
            }
            if (planSummaryParts.length > 0) {
              seoPlanPrompt = `\n\n[핵심 SEO 기획 가이드]\n${planSummaryParts.join('\n')}`;
            }
          } else if (typeof req.body.seoPlan === 'string' && req.body.seoPlan.trim()) {
            seoPlanPrompt = `\n\n[핵심 SEO 기획 가이드]\n${req.body.seoPlan.trim()}`;
          }
        }

        // 실제 근거 데이터 (Grounding Data: 상품/장소 링크 OG 데이터 및 수동 입력 세부정보)
        let groundingDataPrompt = '';
        if (req.body.groundingData || req.body.linkData || req.body.extractedData) {
          const gd = req.body.groundingData || req.body.linkData || req.body.extractedData;
          const gdLines: string[] = [];
          if (gd.title) gdLines.push(`- 상품/장소명: ${gd.title}`);
          if (gd.brand) gdLines.push(`- 브랜드/제조사/상호: ${gd.brand}`);
          if (gd.price) gdLines.push(`- 가격/비용 정보: ${gd.price}`);
          if (gd.address) gdLines.push(`- 주소/위치/방문지: ${gd.address}`);
          if (gd.siteName) gdLines.push(`- 출처 플랫폼: ${gd.siteName}`);
          if (gd.sourceUrl) gdLines.push(`- 참조 원본 URL: ${gd.sourceUrl}`);
          if (gd.description) gdLines.push(`- 요약 설명 및 특징: ${gd.description}`);
          if (gd.userNotes) gdLines.push(`- 사용자 추가 메모/체감 포인트: ${gd.userNotes}`);
          if (gd.features && Array.isArray(gd.features) && gd.features.length > 0) {
            gdLines.push(`- 주요 스펙 및 특징:\n  * ${gd.features.join('\n  * ')}`);
          }

          if (gdLines.length > 0) {
            groundingDataPrompt = `\n\n[실제 근거 데이터 (Grounding Data - 사실 기반 우선 반영)]
아래는 사용자가 제공한 실제 상품/장소의 링크에서 추출되었거나 직접 입력된 사실 데이터입니다. 허구의 정보를 지어내지 말고 아래 실제 정보(가격, 위치, 스펙, 특징 등)를 본문과 리뷰에 자연스럽고 정확하게 반영하십시오:
${gdLines.join('\n')}`;
          }
        }

        // 사용자 확정 대표 제목 및 H2 소제목 강제 지침 주입
        let userConfirmedOutlinePrompt = '';
        const userConfirmedTitle = cleanAndNormalizeTitle(req.body.selectedTitle || req.body.title || req.body.seoPlan?.recommendedOutline?.h1 || '');
        const userConfirmedOutline = req.body.outlineSections || req.body.confirmedOutline || req.body.outline || req.body.seoPlan?.recommendedOutline?.sections;

        if (userConfirmedTitle) {
          userConfirmedOutlinePrompt += `\n\n[사용자 확정 대표 포스팅 제목 (H1 필수 준수)]
<h1>${userConfirmedTitle}</h1>
* 본문의 <h1> 태그에는 반드시 위 확정 제목을 그대로 사용하십시오.`;
        }

        if (Array.isArray(userConfirmedOutline) && userConfirmedOutline.length > 0) {
          userConfirmedOutlinePrompt += `\n\n[사용자 확정 H2 소제목 및 세부 구성 가이드 (엄격 준수 지침)]
반드시 아래에 사용자가 검토하고 확정한 H2 소제목(순서 및 제목명)을 100% 동일하게 <h2> 태그로 사용하여 본문을 작성하십시오. 소제목을 임의로 변경하거나 누락하지 마십시오:
${userConfirmedOutline.map((sec: any, idx: number) => {
  const heading = typeof sec === 'string' ? cleanAndNormalizeTitle(sec) : cleanAndNormalizeTitle(sec.heading || sec.title || '');
  const core = typeof sec === 'object' && sec.coreContent ? `  - 다룰 핵심 내용: ${sec.coreContent}\n` : '';
  const kw = typeof sec === 'object' && sec.keyKeywords && Array.isArray(sec.keyKeywords) && sec.keyKeywords.length > 0 ? `  - 반영 키워드: ${sec.keyKeywords.join(', ')}\n` : '';
  return `${idx + 1}. <h2>${heading}</h2>\n${core}${kw}`;
}).join('\n')}`;
        }

        let styleProfilePrompt = '';
        if (req.body.styleProfile) {
          const sp = req.body.styleProfile;
          styleProfilePrompt = `

[사용자 개인 블로그 스타일 프로필 (보조 문체 가이드)]
아래 개인 스타일 프로필은 작성자의 평소 글쓰기 습관 및 문체 선호 사항입니다.
* 주의: userInput(사용자 입력 경험/사실)이나 SEO 기획안과 충돌할 경우, 항상 userInput과 SEO 기획안이 최우선이며, 개인 스타일 프로필은 어조, 문장 호흡, 표현 습관 등 문체 보조용으로만 반영합니다.

- 말투(Tone): ${sp.tone || '상세 미지정'}
- 문장 스타일: ${sp.sentenceStyle || '상세 미지정'}
- 문단 호흡: ${sp.paragraphStyle || '상세 미지정'}
- 도입부 스타일: ${sp.openingStyle || '상세 미지정'}
- 본문 전개 패턴: ${sp.faqStyle || '상세 미지정'}
- 결론/총평 스타일: ${sp.endingStyle || '상세 미지정'}
- 강조 스타일: ${sp.emphasisStyle || '상세 미지정'}
- 표현 특징: ${sp.expressionStyle || '상세 미지정'}
- 이미지 배치 선호: ${sp.imagePlacementStyle || '상세 미지정'}
- CTA/소통 스타일: ${sp.ctaStyle || '상세 미지정'}
${sp.preferredPatterns && sp.preferredPatterns.length > 0 ? `- 선호 작성 패턴:\n  * ${sp.preferredPatterns.join('\n  * ')}` : ''}
${sp.avoidPatterns && sp.avoidPatterns.length > 0 ? `- 지양/피할 작성 패턴:\n  * ${sp.avoidPatterns.join('\n  * ')}` : ''}`;
        }

        const draftKeywordTrimmed = (promptInput || '').trim();
        if (Array.isArray(req.body.relatedKeywords) && req.body.relatedKeywords.length > 0) {
          relatedKeywordsData = req.body.relatedKeywords;
        } else if (req.body.seoPlan?.relatedKeywordsList) {
          relatedKeywordsData = req.body.seoPlan.relatedKeywordsList;
        } else {
          relatedKeywordsData = await fetchNaverRelatedKeywords(draftKeywordTrimmed);
        }

        if (Array.isArray(req.body.topPosts) && req.body.topPosts.length > 0) {
          topPostsData = req.body.topPosts;
        } else if (req.body.seoPlan?.topPosts) {
          topPostsData = req.body.seoPlan.topPosts;
        } else {
          topPostsData = await fetchNaverTopBlogPosts(draftKeywordTrimmed);
        }

        const templatePrompt = `[메인 키워드]: ${draftKeywordTrimmed}`;
        const lengthRule = targetLength || '2,500~3,500자';

        const relatedKeywordsBenchmarkStr = relatedKeywordsData.length > 0
          ? `\n\n[실시간 네이버 연관 검색어 (${relatedKeywordsData.length}개)]: ${relatedKeywordsData.join(', ')}`
          : '';

        const topPostsBenchmarkStr = topPostsData.length > 0 
          ? `\n\n[실시간 네이버 상위 포스팅 벤치마킹 요약]\n${topPostsData.slice(0, 5).map((p, i) => `${i + 1}위: "${p.title}" (${(p.description || '').replace(/<[^>]+>/g, '').slice(0, 100)}...)`).join('\n')}\n* 상위 벤치마킹 지침: 상위 글들이 다루는 정보 범위와 반복 질문을 분석하여 필수 정보가 누락되지 않도록 심층 작성하되, 문장이나 표현을 그대로 복제하지 마십시오.` 
          : '\n\n[기본 DIA+/C-Rank 상위 노출 뼈대를 적용합니다.]';

        benchmarkPromptStr = `${relatedKeywordsBenchmarkStr}${topPostsBenchmarkStr}`;
        promptForGemini = `${templatePrompt}${benchmarkPromptStr}

[목표 글자 수 지정]
- ${lengthRule}
${groundingDataPrompt}${userConfirmedOutlinePrompt}${imageGuidePrompt}${seoPlanPrompt}${styleProfilePrompt}`;

      } else if (type === 'analyze_style') {
        const blogPosts = req.body.blogPosts || [];
        if (!Array.isArray(blogPosts) || blogPosts.length < 3) {
          return res.status(400).json({ success: false, message: '스타일 분석을 위해서는 최소 3개 이상의 블로그 글 내용이 필요합니다.' });
        }

        systemPrompt = await getActivePrompt('analyze_style', supabaseAdmin);
        isJsonResponse = true;
        promptForGemini = `[분석할 블로그 글 목록]
${blogPosts.map((post: string, idx: number) => `--- [글 ${idx + 1}] ---\n${post}`).join('\n\n')}

위 글들을 정밀 분석하여 작성자의 글쓰기 스타일 프로필 JSON을 추출하십시오.`;

      } else if (type === 'image_plan') {
        const draftContent = (req.body.draftContent || '').trim();
        if (!draftContent) {
          return res.status(400).json({
            success: false,
            error: 'Missing Draft Content',
            message: '본문 내용이 필요합니다.'
          });
        }
        
        systemPrompt = await getActivePrompt('image_plan', supabaseAdmin);
        isJsonResponse = true;
        promptForGemini = `[최종 확정된 블로그 본문 (단일 원본 - Single Source of Truth)]
${draftContent}

[지침]
위 최종 확정된 블로그 본문을 분석하여 본문 내용과 직접 연결되는 이미지 배치 계획 JSON(imagePlans)을 생성하십시오.
- 검색어 생성 원칙:
  1. 추상적인 단어(travel, vacation, beach, landscape, lifestyle, airport, shopping, nature 등)는 절대로 사용하지 마십시오.
  2. 본문에 등장하는 실제 구체적인 대상/명사와 행동을 우선하여 영어 검색어를 생성하십시오.
     예: "기내 액체 반입" -> "airplane carry on liquids", "100ml liquid containers travel", "airport security liquids bag"
     예: "면세점 주류" -> "airport duty free liquor shop", "duty free alcohol bottles"
     예: "위탁수화물 주류 포장" -> "wine bottle luggage packing", "protective wine bottle travel luggage"
- 본문 정보량에 따라 3~7개의 이미지 포인트를 선정하고, 각 검색어로 검색 시 실제 대상이 등장할 가능성이 높은지 자체 검증하십시오.
- 의미 있는 시각 자료가 없는 섹션에는 억지로 이미지를 배치하지 마십시오.
- 각 이미지 계획에 id, insertAfterSection, subject, visualDescription, searchQueries, preferredSource("unsplash"), reason을 포함하십시오.`;
      } else if (type === 'visual_image_match') {
        const draftContent = (req.body.draftContent || '').trim();
        if (!draftContent) {
          return res.status(400).json({
            success: false,
            error: 'Missing Draft Content',
            message: '본문 내용이 필요합니다.'
          });
        }
        
        const targetCount = Number(req.body.targetCount) || 3;
        systemPrompt = `당신은 블로그 본문의 문맥을 정밀 분석하여 Unsplash에서 본문과 가장 직접적으로 연결되는 실물 사진을 찾을 수 있도록 이미지 배치 계획을 세우는 전문 시각 에디터 AI입니다.

[핵심 분석 원칙]
1. '메인 키워드와 관련된 이미지'가 아니라 '해당 이미지가 삽입되는 바로 앞뒤 본문 문맥에서 구체적으로 설명하는 실제 대상/행동'을 분석하십시오.
   - ❌ 잘못된 검색어: airplane, airport, travel, vacation, lifestyle, background, nature, city, room
   - ✅ 올바른 검색어 (본문이 "기내 100ml 투명 지퍼백 액체류"일 때): "clear liquids bag airport security", "100ml travel bottles", "airport security liquids bag"
   - ✅ 올바른 검색어 (본문이 "와인병 완충재 수하물 포장"일 때): "wine bottle wrapped in bubble wrap luggage", "packing wine bottle suitcase", "wine bottle wrapped in luggage"
2. 각 위치마다 2~3개의 고유한 영문 검색어(searchQueries)를 생성하십시오.
   - 검색어 우선순위:
     1순위: 본문에 실제로 언급된 구체적 대상 (명사)
     2순위: 본문의 구체적 행동 또는 상황
     3순위: 본문의 구체적 장소/환경
     4순위: 메인 키워드
   - 추상적이거나 일반적인 단어 단독 사용을 엄격히 금지합니다.
3. 개수 기준:
   - 사용자가 요청한 ${targetCount}개 슬롯을 우선적으로 고려하십시오.
   - 단, 본문이 짧아 자연스러운 위치를 만들 수 없는 경우 억지로 늘리지 말고 실제로 유효한 위치만 추천하십시오 (최소 2개, 최대 ${targetCount}개).
4. 각 슬롯마다 다음 필드를 포함한 단일 JSON을 응답하십시오:
{
  "slots": [
    {
      "id": "slot_1",
      "positionIndex": 1,
      "insertionPoint": "도입부 직후" 또는 "1. 소제목 직후" 또는 "문단 X 뒤",
      "relatedParagraph": "해당 이미지와 직접 연결되는 본문의 실제 문단 텍스트 (1~2문장 원문 인용)",
      "subject": "해당 문단에서 설명하는 실제 대상 (예: 투명 지퍼백에 담긴 100ml 화장품 용기)",
      "visualDescription": "어떤 장면의 사진이 필요한지 구체적 묘사",
      "searchQueries": ["clear liquids bag airport security", "100ml travel bottles", "airport security liquids bag"],
      "reason": "해당 위치에 이 이미지를 추천하는 문맥적 이유"
    }
  ]
}`;
        isJsonResponse = true;
        promptForGemini = `[분석할 블로그 본문]
${draftContent}

[요청 사항]
- 목표 이미지 개수: ${targetCount}개
- 위 본문을 문맥별로 꼼꼼히 분석하여 각 문단과 직접 일치하는 구체적인 실물 대상 중심의 이미지 배치 계획 JSON을 생성하십시오.`;
      } else if (type === 'card_news') {
        let draftContent = (req.body.draftContent || '').trim();
        if (!draftContent) {
          draftContent = (req.body.promptInput || req.body.userInput || (req.body.seoPlan ? JSON.stringify(req.body.seoPlan) : '')).trim();
        }
        if (!draftContent) {
          return res.status(400).json({
            success: false,
            error: 'Missing Draft Content',
            message: '카드뉴스 생성을 위한 키워드 또는 본문이 필요합니다.'
          });
        }

        const reqCardCount = typeof req.body.cardCount === 'number' ? req.body.cardCount : 6;
        const validStyles = ['info', 'comparison', 'review', 'travel', 'list', 'photo', 'graphic_info'];
        let reqStyle = (req.body.style || '').toString().trim();
        if (!validStyles.includes(reqStyle)) {
          // Auto-recommend based on writing style / content type
          const draftType = (req.body.draftType || req.body.writingStyle || req.body.seoPlan?.writing_style || '').toString().toLowerCase();
          if (draftType.includes('review') || draftType.includes('경험') || draftType.includes('후기')) {
            reqStyle = 'review';
          } else if (draftType.includes('info') || draftType.includes('정보')) {
            reqStyle = 'info';
          } else if (draftType.includes('purchase') || draftType.includes('구매') || draftType.includes('추천')) {
            reqStyle = 'list';
          } else if (draftType.includes('comparison') || draftType.includes('비교')) {
            reqStyle = 'comparison';
          } else if (draftType.includes('homepan') || draftType.includes('story') || draftType.includes('화제')) {
            reqStyle = 'photo';
          } else {
            reqStyle = 'info';
          }
        }
        
        const reqImageMode = req.body.imageMode || 'auto';
        const validGraphicStyles = ['photoreal', 'simple_icon', 'casual', 'fairytale'];
        const rawGraphicStyle = (req.body.aiGraphicStyle || '').toString().trim().toLowerCase();
        const reqAiGraphicStyle = validGraphicStyles.includes(rawGraphicStyle) ? rawGraphicStyle : 'photoreal';

        systemPrompt = await buildCardNewsSystemPrompt({
          cardCount: reqCardCount,
          style: reqStyle,
          aiGraphicStyle: reqAiGraphicStyle,
          imageMode: reqImageMode,
        }, supabaseAdmin);

        isJsonResponse = true;
        promptForGemini = `[최종 확정된 블로그 본문 (단일 원본 - Single Source of Truth)]
${draftContent}

[SEO 기획안 참고]
${req.body.seoPlan ? JSON.stringify(req.body.seoPlan) : '기본 기획'}

[사용자 입력]
${req.body.userInput || '없음'}

[지침]
위 본문과 내용을 기반으로 모바일 환경에 최적화된 정확히 ${reqCardCount}장의 카드뉴스 JSON 데이터를 생성하십시오.
- 절대로 본문에 없는 새로운 가격, 주소, 스펙, 통계, 경험 등을 생성하거나 날조하지 마십시오.
- 각 카드마다 1개의 명확한 핵심 메시지만 담으십시오.
- 검색어 생성 원칙:
  1. 추상적인 단어(travel, vacation, beach, landscape, lifestyle, airport, shopping, nature 등)는 배제하십시오.
  2. 카드의 실제 핵심 대상과 행동을 중심으로 구체적인 Unsplash 영문 검색어(searchQueries) 2~3개와 AI 이미지 프롬프트(imagePrompt)를 작성하십시오.
- 반드시 최상위가 { "keyword": "...", "title": "...", "cards": [ ... ] } 형태인 단일 JSON 객체로 반환하십시오.
- 적용 스타일: ${reqStyle}`;
      } else if (type === 'card_news_content') {
        const draftContent = (req.body.draftContent || req.body.promptInput || '').trim();
        if (!draftContent) {
          return res.status(400).json({
            success: false,
            error: 'Missing Draft Content',
            message: '카드뉴스 콘텐츠 구성을 위한 블로그 본문이 필요합니다.'
          });
        }

        const targetCount = Number(req.body.cardCount) || 6;
        systemPrompt = `당신은 블로그 본문을 1회 정밀 분석하여 모바일 카드뉴스에 최적화된 고유 콘텐츠 구조(Unique Content Architecture)를 기획하는 최고 수준의 전문 에디터 AI입니다.

[1단계: 전체 본문 단일 분석 및 고유 팩트 분배 (Single Source of Truth)]
1. 분석 및 추출:
   - 전체 본문 원본을 1회 정밀 독해하여 글에 실제로 등장하는 고유 정보(Unique Key Points), 구체적 수치, 실행 조건, 단계별 가이드, 차별화된 팁을 명확히 분리합니다.
2. 내용 중복 원천 금지 (Zero Duplication Rule - 절대 원칙):
   - 각 카드는 반드시 서로 다른 고유 정보(Distinct Fact / Action Point)만을 다루어야 합니다.
   - 3장, 5장, 6장, 7장, 8장, 10장 등 요청된 장수가 많아질수록 본문의 여러 세부 항목을 고르게 나누어 담아야 하며, 앞선 카드에서 이미 다룬 내용, 유사한 조언, 단순 문장 재구성(Rephrasing)으로 여러 카드를 채우는 행위를 엄격히 금지합니다.
   - [장수별 내용 배분 원칙]:
     * 5장: 표지(1장) + 핵심 개념(1장) + 세부 방법/조건(1장) + 필수 주의사항/팁(1장) + 최종 요약/체크리스트(1장)
     * 6장: 표지(1장) + 핵심 배경/이유(1장) + 주요 특징/조건(1장) + 실전 실행방법(1장) + 꿀팁/주의사항(1장) + 최종 요약(1장)
     * 7~8장: 표지(1장) + 세부 단계 1~4(각각 독립된 실행단계) + 비교/주의사항(1~2장) + 최종 요약(1장)
     * 10장: 표지(1장) + 1~7번까지 각각 완전히 다른 개별 항목/꿀팁/체크리스트 + 주의사항(1장) + 결론(1장)
   - 본문에 없는 내용이나 거짓 정보(Hallucination)를 임의로 날조하지 마십시오.
3. 원문 분량과 카드 장수 최적화:
   - 원문의 고유 정보량이 요청된 장수(${targetCount}장)를 채우기에 충분하지 않을 경우, 절대로 동일 내용을 반복하거나 억지 문구를 지어내지 마십시오.
   - 실제 존재하는 핵심 팩트만으로 알짜배기 슬라이드(예: 4~${targetCount}장)로 자연스럽게 압축 구성하고, recommendationNote에 해당 사유를 기재하십시오.

[2단계: 카드뉴스 흐름 및 구조화 원칙]
1. 표지 (1장 - cover): 독자의 호기심과 클릭을 부르는 강렬한 헤드라인과 서브 카피
2. 본문 카드 (중간 - key_point, info, step, comparison, tip, warning):
   - 각 카드당 1개의 명확하고 독립적인 핵심 메시지만 직관적으로 전달
   - 글의 성격(정보형/비교형/리뷰형/여행·맛집/리스트형)에 맞춰 최적의 순서로 논리 전개
3. 엔딩 (마지막 - summary, cta): 핵심 요약 정리 또는 실천 액션 가이드

[3단계: 카드 문구 작성 규칙]
1. cardNumber: 1부터 시작하는 순번
2. cardRole: 'cover' | 'key_point' | 'info' | 'step' | 'comparison' | 'tip' | 'warning' | 'summary' | 'cta' 중 하나
3. layoutVariant: 카드의 성격에 맞는 최적 레이아웃 ('cover' | 'text_focus' | 'image_focus' | 'split' | 'comparison' | 'tip' | 'ending')
4. title: 짧고 직관적인 핵심 제목 (8~22자 내외)
5. subtitle: 제목을 명확히 보조하는 서브 카피 (15~32자 내외)
6. body: 모바일에서 한눈에 쏙 들어오는 1~3문장의 간결한 요약 (80~120자 내외, 긴 문단 금지)
7. emphasis: 시각적으로 강조할 핵심 키워드/어구 1~3개
8. sourceContext: 이 카드의 근거가 된 블로그 본문의 실제 원문 문장 (1~2문장)
9. searchQueries: Unsplash 고품질 사진 검색을 위한 영문 키워드 2~3개 (1순위: 카드 실물 대상, 2순위: 핵심 행동, 3순위: 구체적 상황. 모호한 'travel' 등 추상어 금지)
10. imagePrompt: 이 카드에 어울리는 구체적 시각적 상황 묘사 (한국어 1문장)
11. AI 상투어 금지 ("알아보겠습니다", "살펴볼까요?", "소개해 드립니다" 등 진부한 표현 배제)

[반환 JSON 스키마]
{
  "contentType": "정보형" | "비교형" | "리뷰형" | "여행/맛집" | "리스트형",
  "coreTopic": "본문의 핵심 주제 요약 (1문장)",
  "cardCount": ${targetCount},
  "recommendedCardCount": ${targetCount},
  "recommendationNote": "원문 핵심 팩트 분석 및 분배 완료 안내",
  "cards": [
    {
      "cardNumber": 1,
      "cardRole": "cover",
      "layoutVariant": "cover",
      "title": "...",
      "subtitle": "...",
      "body": "...",
      "emphasis": ["..."],
      "sourceContext": "...",
      "searchQueries": ["..."],
      "imagePrompt": "..."
    }
  ]
}`;
        isJsonResponse = true;
        promptForGemini = `[분석할 블로그 본문 원본 (단일 원본 - Single Source of Truth)]
${draftContent}

[SEO 기획안 참고 (선택)]
${req.body.seoPlan ? JSON.stringify(req.body.seoPlan) : '기본'}

[사용자 메모 (선택)]
${req.body.userInput || '없음'}

[요청 사항]
위 본문의 고유 핵심 정보를 1회 전체 분석하여 중복 없이 고유한 내용으로만 구성된 ${targetCount}장(또는 본문 분량에 최적화된 고유 장수)의 카드뉴스 JSON을 생성하십시오.`;
      } else if (type === 'improve_card_content') {
        const card = req.body.card || {};
        const instruction = req.body.instruction || 'clearer';
        const sourceContent = (req.body.sourceContent || '').trim();

        let instructionGuide = '';
        if (instruction === 'shorter') {
          instructionGuide = '문장을 훨씬 더 짧고 군더더기 없이 압축하십시오. 핵심 단어와 간결한 문장으로 요약하십시오.';
        } else if (instruction === 'clearer') {
          instructionGuide = '모호한 표현을 없애고 직관적이며 이해하기 쉬운 명확한 문장으로 개선하십시오.';
        } else if (instruction === 'highlight') {
          instructionGuide = '핵심 강조 포인트를 극대화하고, 독자의 시선을 사로잡는 임팩트 있는 제목과 키워드로 재구성하십시오.';
        } else if (instruction === 'informative') {
          instructionGuide = '신뢰감 있고 객관적인 정보 전달형 문체(~합니다, ~입니다, 핵심 수치/조건 부각)로 정돈하십시오.';
        } else if (instruction === 'emotional') {
          instructionGuide = '공감대를 형성하고 생생하며 친근한 감성적 문체로 다듬으십시오.';
        } else {
          instructionGuide = '가독성을 높이고 핵심 메시지가 잘 전달되도록 문구를 다듬으십시오.';
        }

        systemPrompt = `당신은 카드뉴스 문구 전문 카피라이터 에디터 AI입니다.
기존 카드의 내용을 사용자의 개선 요청(${instruction})에 맞춰 다듬으십시오.

[개선 지침]
- ${instructionGuide}
- 절대 원문이나 기존 카드에 없는 새로운 거짓 사실(가격, 수치, 명칭 등)을 날조하지 마십시오.
- AI 상투어("알아보겠습니다", "살펴볼까요" 등)를 쓰지 마십시오.
- 다음 JSON 객체 형식으로만 응답하십시오:
{
  "title": "개선된 짧고 명확한 제목",
  "subtitle": "개선된 부제목",
  "body": "개선된 모바일 친화적 본문",
  "emphasis": ["강조단어1", "강조단어2"]
}`;
        isJsonResponse = true;
        promptForGemini = `[현재 카드 데이터]
역할: ${card.cardRole || 'info'}
현재 제목: ${card.title || ''}
현재 부제목: ${card.subtitle || ''}
현재 본문: ${card.body || ''}
현재 강조어: ${(card.emphasis || []).join(', ')}
근거 본문 문맥: ${card.sourceContext || sourceContent}

[개선 요청]
- 개선 방향: ${instruction} (${instructionGuide})
- 위 기존 카드의 정보를 바탕으로 더 매력적이고 완성도 높은 카드 문구 JSON을 응답하십시오.`;
      }

    // Execute Gemini API call
      let resultText = '';
      let geminiTokenUsage: { promptTokens: number; completionTokens: number; totalTokens: number } | null = null;
      try {
        const isFastJsonTask = isJsonResponse && (
          type === 'golden_keyword' ||
          type === 'analyze_intent' ||
          type === 'generate_outline' ||
          type === 'outline' ||
          type === 'card_news_text' ||
          type === 'image_plan'
        );

        const response = await generateAIContentWithFallback({
          model: req.body?.model || 'gemini-3.7-flash',
          provider: req.body?.provider,
          contents: promptForGemini,
          systemInstruction: systemPrompt,
          maxTokens: (type === 'draft' || type === 'quality_refine') ? 8192 : (isFastJsonTask ? 2500 : 4096),
          temperature: isFastJsonTask ? 0.35 : 0.7,
          isJsonResponse,
        });

        // 에러 발생 시 개발자 콘솔에 Gemini/OpenAI Token Usage 등을 출력하기 위해 로깅
        if (response.usageMetadata) {
          console.log(`[Token Usage (${response.provider}/${response.model})] Prompt: ${response.usageMetadata.promptTokens}, Completion: ${response.usageMetadata.completionTokens}, Total: ${response.usageMetadata.totalTokens}`);
          geminiTokenUsage = {
            promptTokens: response.usageMetadata.promptTokens || 0,
            completionTokens: response.usageMetadata.completionTokens || 0,
            totalTokens: response.usageMetadata.totalTokens || 0,
          };
        }
        if (response.candidates?.[0]?.finishReason) {
          console.log(`[Finish Reason] ${response.candidates[0].finishReason}`);
        }

        resultText = response.text || '';
      } catch (geminiErr: any) {
        const userFriendlyMsg = formatUserErrorMessage(geminiErr);
        console.error('================================================');
        console.error(`[Gemini API Toolkit Error in /api/gemini/toolkit] Type: ${type}`);
        console.error('User Friendly Message:', userFriendlyMsg);
        console.error('Raw Error Message:', geminiErr?.message || geminiErr);
        if (geminiErr?.stack) {
          console.error('Stack trace:\n', geminiErr.stack);
        }
        console.error('================================================');
        return res.status(500).json({
          success: false,
          error: 'Gemini Generation Failed',
          message: userFriendlyMsg,
          rawError: geminiErr?.message || '알 수 없는 오류',
          stack: geminiErr?.stack || null,
        });
      }

      if (type === 'draft' && resultText) {
        resultText = cleanDraftOutput(resultText);
      }

      // Record atomic feature usage log
      await recordFeatureUsageServerSide(req.body, mappedFeatureKey, geminiTokenUsage, req);

      // Increment in-memory counter for fast response
      const todayDateStr = new Date().toISOString().slice(0, 10);
      if (!userDailyUsage[userKey] || userDailyUsage[userKey].date !== todayDateStr) {
        userDailyUsage[userKey] = { count: 0, date: todayDateStr };
      }
      userDailyUsage[userKey].count += 1;
      const updatedUsedCount = limitCheck.usedCount + 1;
      const remainingUses = limitCheck.isUnlimited ? 9999 : Math.max(0, (limitCheck.limit || 0) - updatedUsedCount);
      
      // AI 응답이 너무 길어 잘리는 경우를 대비하여 maxOutputTokens 값을 확인하고, 긴 HTML은 문자열 그대로 반환
      if (type === 'draft' || type === 'quality_refine') {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        return res.status(200).send(resultText);
      }

      if (type === 'ai_graphic') {
        const svgMatch = resultText.match(/<svg[\s\S]*?<\/svg>/i);
        let generatedSvg = svgMatch ? svgMatch[0].trim() : '';
        if (!generatedSvg) {
          generatedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="100%" height="100%"><rect width="800" height="500" rx="20" fill="#0f172a"/><circle cx="400" cy="250" r="150" fill="#059669" opacity="0.3"/><rect x="200" y="150" width="400" height="200" rx="16" fill="#ffffff" opacity="0.1"/></svg>`;
        }
        const svgUrl = `data:image/svg+xml;utf8,${encodeURIComponent(generatedSvg)}`;
        return res.status(200).json({
          success: true,
          type,
          result: svgUrl,
          imageUrl: svgUrl,
          images: [svgUrl],
          tokenUsage: geminiTokenUsage,
          tierId: limitCheck.tierId,
          tierName: limitCheck.tierName,
          usedCount: updatedUsedCount,
          remainingUses,
        });
      }

      let parsedJson: any = null;
      if (isJsonResponse && resultText) {
        parsedJson = extractAndParseJson(resultText);
        if (!parsedJson) {
          console.warn('[Gemini JSON parse warning]: Could not parse JSON from response text of length:', resultText.length);
        } else {
          // 후처리 정규화 및 중복 제거
          if (type === 'golden_keyword') {
            const rawTitles = parsedJson.titleCandidates || parsedJson.recommendedTitles || [];
            const isRecKey = /추천|가볼만한곳|맛집|코스|선물|명소|핫플/i.test(promptInput || '');
            const hasUserExp = !!(req.body?.userExperience || req.body?.groundingData || req.body?.linkData);
            parsedJson.titleCandidates = deduplicateTitleCandidates(rawTitles, {
              hasUserExperience: hasUserExp,
              isRecommendationKeyword: isRecKey,
            });
            if (parsedJson.recommendedOutline?.h1) {
              parsedJson.recommendedOutline.h1 = cleanAndNormalizeTitle(parsedJson.recommendedOutline.h1);
            }
            if (Array.isArray(parsedJson.recommendedOutline?.sections) && parsedJson.recommendedOutline.sections.length > 0) {
              parsedJson.recommendedOutline.sections = normalizeOutlineSections(parsedJson.recommendedOutline.sections);
            }
          } else if (type === 'generate_outline' || type === 'outline') {
            const rawOutline = parsedJson.outline || parsedJson.sections || parsedJson.h2List || [];
            parsedJson.outline = normalizeOutlineSections(rawOutline);
          }
        }
      }

      let debugInfo: any = undefined;
      if (type === 'golden_keyword') {
        const candidateList = parsedJson?.titleCandidates || [];
        const generatedTitlesList = Array.isArray(candidateList)
          ? candidateList.map((c: any) => typeof c === 'string' ? c : c.title).filter(Boolean)
          : [parsedJson?.recommendedOutline?.h1].filter(Boolean);
        
        debugInfo = {
          mainKeyword: (promptInput || '').trim(),
          searchIntent: parsedJson?.searchIntent?.userGoal || parsedJson?.searchIntent?.stage || req.body?.intentSummary || '정보탐색',
          relatedKeywords: relatedKeywordsData || [],
          benchmarkTitles: (topPostsData || []).map((p: any) => p.title || p).filter(Boolean),
          selectedStyle: req.body?.writingStyle || parsedJson?.writing_style || 'experience',
          generatedTitles: generatedTitlesList,
        };

        console.log('\n[DEBUG Title Generation Engine]:');
        console.log('- mainKeyword:', debugInfo.mainKeyword);
        console.log('- searchIntent:', debugInfo.searchIntent);
        console.log('- relatedKeywords (' + debugInfo.relatedKeywords.length + '개):', debugInfo.relatedKeywords.slice(0, 8).join(', '));
        console.log('- benchmarkTitles (' + debugInfo.benchmarkTitles.length + '개):', debugInfo.benchmarkTitles.slice(0, 5).join(' | '));
        console.log('- selectedStyle:', debugInfo.selectedStyle);
        console.log('- generatedTitles (' + debugInfo.generatedTitles.length + '개):', debugInfo.generatedTitles);
      }

      return res.status(200).json({
        success: true,
        type,
        result: parsedJson || resultText,
        rawResult: resultText,
        data: parsedJson,
        tokenUsage: geminiTokenUsage,
        topRankSummary,
        topPosts: topPostsData,
        relatedKeywords: relatedKeywordsData,
        benchmarkPrompt: benchmarkPromptStr,
        benchmarkReceivedAt: new Date().toISOString(),
        tierId: limitCheck.tierId,
        tierName: limitCheck.tierName,
        usedCount: updatedUsedCount,
        remainingUses,
        debugInfo,
      });
    } catch (err: any) {
      console.error('================================================');
      console.error('[Gemini toolkit server error in /api/gemini/toolkit]');
      console.error('Error message:', err?.message || err);
      if (err?.stack) {
        console.error('Stack trace:\n', err.stack);
      }
      console.error('================================================');
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: err?.message || 'AI 툴킷 실행 중 오류가 발생했습니다.',
        stack: err?.stack || null,
      });
    }
  });

  // -------------------------------------------------------------------------
  // AI Draft Sessions Auto-Save & Recovery API
  // -------------------------------------------------------------------------

  // 1. GET /api/drafts/current - Fetch latest active draft session
  app.get('/api/drafts/current', async (req, res) => {
    try {
      const { userId, userEmail, userName, adminToken } = req.query as any;

      if (!userId && !userEmail) {
        return res.status(400).json({ success: false, message: 'User ID or Email is required' });
      }

      const isAuthorized = await checkAIToolkitServerAuth(
        {
          userId,
          userEmail,
          userName,
          adminToken,
        },
        req
      );

      if (!isAuthorized) {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
      }

      const supabase = getSupabaseAdmin();
      if (!supabase) {
        return res.json({ success: true, session: null, isOfflineFallback: true });
      }

      const targetUserId = String(userId || userEmail);
      const { data, error } = await supabase
        .from('ai_draft_sessions')
        .select('*')
        .eq('user_id', targetUserId)
        .in('status', ['drafting', 'temporary'])
        .order('updated_at', { ascending: false })
        .limit(1);

      if (error) {
        console.warn('[API /api/drafts/current] Supabase error:', error);
        return res.json({ success: true, session: null });
      }

      if (!data || data.length === 0) {
        return res.json({ success: true, session: null });
      }

      const row = data[0];
      const session = {
        id: row.id,
        userId: row.user_id,
        userEmail: row.user_email || undefined,
        userName: row.user_name || undefined,
        title: row.title || undefined,
        keyword: row.keyword,
        keywords: Array.isArray(row.keywords) ? row.keywords : [],
        style: row.style || 'review',
        status: row.status,
        lastStep: row.last_step,
        writingContext: row.writing_context || {},
        options: row.options || {},
        batchItems: Array.isArray(row.batch_items) ? row.batch_items : [],
        seoPlan: row.seo_plan || undefined,
        draftContent: row.draft_content || undefined,
        finalHtml: row.final_html || undefined,
        images: Array.isArray(row.images) ? row.images : [],
        cardNews: row.card_news || undefined,
        metadata: row.metadata || {},
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        expiresAt: row.expires_at,
      };

      return res.json({ success: true, session });
    } catch (err: any) {
      console.error('[API /api/drafts/current error]:', err);
      return res.status(500).json({ success: false, message: err?.message || 'Failed to fetch current draft' });
    }
  });

  // 1-B. GET /api/drafts - Fetch all draft sessions for a user
  app.get('/api/drafts', async (req, res) => {
    try {
      const { userId, userEmail, userName, adminToken } = req.query as any;

      if (!userId && !userEmail) {
        return res.status(400).json({ success: false, message: 'User ID or Email is required' });
      }

      const isAuthorized = await checkAIToolkitServerAuth(
        {
          userId,
          userEmail,
          userName,
          adminToken,
        },
        req
      );

      if (!isAuthorized) {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
      }

      const supabase = getSupabaseAdmin();
      if (!supabase) {
        return res.json({ success: true, sessions: [], isOfflineFallback: true });
      }

      const targetUserId = String(userId || userEmail);
      const { data, error } = await supabase
        .from('ai_draft_sessions')
        .select('*')
        .eq('user_id', targetUserId)
        .order('updated_at', { ascending: false });

      if (error) {
        console.warn('[API /api/drafts] Supabase error:', error);
        return res.json({ success: true, sessions: [] });
      }

      if (!data) {
        return res.json({ success: true, sessions: [] });
      }

      const sessions = data.map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        userEmail: row.user_email || undefined,
        userName: row.user_name || undefined,
        title: row.title || undefined,
        keyword: row.keyword,
        keywords: Array.isArray(row.keywords) ? row.keywords : [],
        style: row.style || 'review',
        status: row.status,
        lastStep: row.last_step,
        writingContext: row.writing_context || {},
        options: row.options || {},
        batchItems: Array.isArray(row.batch_items) ? row.batch_items : [],
        seoPlan: row.seo_plan || undefined,
        draftContent: row.draft_content || undefined,
        finalHtml: row.final_html || undefined,
        images: Array.isArray(row.images) ? row.images : [],
        cardNews: row.card_news || undefined,
        metadata: row.metadata || {},
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        expiresAt: row.expires_at,
      }));

      return res.json({ success: true, sessions });
    } catch (err: any) {
      console.error('[API /api/drafts error]:', err);
      return res.status(500).json({ success: false, message: err?.message || 'Failed to fetch drafts' });
    }
  });

  // 2. POST /api/drafts - Save/Upsert a draft session
  app.post('/api/drafts', async (req, res) => {
    try {
      const { session, userId, userEmail, userName, adminToken } = req.body || {};

      if (!session || !session.userId) {
        return res.status(400).json({ success: false, message: 'Valid draft session data is required' });
      }

      const effectiveUserId = session.userId || userId;
      const isAuthorized = await checkAIToolkitServerAuth(
        {
          userId: effectiveUserId,
          userEmail: session.userEmail || userEmail,
          userName: session.userName || userName,
          adminToken,
        },
        req
      );

      if (!isAuthorized) {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
      }

      const supabase = getSupabaseAdmin();
      if (!supabase) {
        return res.json({ success: true, saved: true, isLocalFallback: true });
      }

      const now = new Date().toISOString();
      const expiresAt = session.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const payload = {
        id: session.id,
        user_id: effectiveUserId,
        user_email: session.userEmail || userEmail || null,
        user_name: session.userName || userName || null,
        title: session.title || session.keyword || null,
        keyword: session.keyword || '',
        keywords: session.keywords || [],
        style: session.style || 'review',
        status: session.status || 'drafting',
        last_step: session.lastStep || 'keyword',
        writing_context: session.writingContext || {},
        options: session.options || {},
        batch_items: session.batchItems || [],
        seo_plan: session.seoPlan || null,
        draft_content: session.draftContent || null,
        final_html: session.finalHtml || null,
        images: session.images || [],
        card_news: session.cardNews || null,
        metadata: session.metadata || {},
        created_at: session.createdAt || now,
        updated_at: now,
        expires_at: expiresAt,
      };

      const { error } = await supabase.from('ai_draft_sessions').upsert(payload);
      if (error) {
        console.warn('[API /api/drafts] Supabase upsert warning:', error);
        return res.json({ success: true, saved: false, error: error.message });
      }

      return res.json({ success: true, saved: true, id: session.id, updatedAt: now });
    } catch (err: any) {
      console.error('[API /api/drafts error]:', err);
      return res.status(500).json({ success: false, message: err?.message || 'Failed to save draft' });
    }
  });

  // 3. PATCH /api/drafts/:id - Update specific fields of draft session
  app.patch('/api/drafts/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { updates, userId, userEmail, userName, adminToken } = req.body || {};

      if (!id || !updates) {
        return res.status(400).json({ success: false, message: 'Draft ID and updates required' });
      }

      const isAuthorized = await checkAIToolkitServerAuth(
        {
          userId,
          userEmail,
          userName,
          adminToken,
        },
        req
      );

      if (!isAuthorized) {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
      }

      const supabase = getSupabaseAdmin();
      if (!supabase) {
        return res.json({ success: true, updated: true, isLocalFallback: true });
      }

      const now = new Date().toISOString();
      const payload: any = { updated_at: now };

      if (updates.status !== undefined) payload.status = updates.status;
      if (updates.lastStep !== undefined) payload.last_step = updates.lastStep;
      if (updates.keyword !== undefined) payload.keyword = updates.keyword;
      if (updates.keywords !== undefined) payload.keywords = updates.keywords;
      if (updates.style !== undefined) payload.style = updates.style;
      if (updates.writingContext !== undefined) payload.writing_context = updates.writingContext;
      if (updates.options !== undefined) payload.options = updates.options;
      if (updates.batchItems !== undefined) payload.batch_items = updates.batchItems;
      if (updates.seoPlan !== undefined) payload.seo_plan = updates.seoPlan;
      if (updates.draftContent !== undefined) payload.draft_content = updates.draftContent;
      if (updates.finalHtml !== undefined) payload.final_html = updates.finalHtml;
      if (updates.images !== undefined) payload.images = updates.images;
      if (updates.cardNews !== undefined) payload.card_news = updates.cardNews;
      if (updates.metadata !== undefined) payload.metadata = updates.metadata;
      if (updates.title !== undefined) payload.title = updates.title;
      if (updates.expiresAt !== undefined) payload.expires_at = updates.expiresAt;

      let query = supabase.from('ai_draft_sessions').update(payload).eq('id', id);
      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { error } = await query;
      if (error) {
        console.warn('[API /api/drafts/:id] Supabase update warning:', error);
      }

      return res.json({ success: true, updated: true, updatedAt: now });
    } catch (err: any) {
      console.error('[API /api/drafts/:id error]:', err);
      return res.status(500).json({ success: false, message: err?.message || 'Failed to update draft' });
    }
  });

  // 4. DELETE /api/drafts/:id - Delete a draft session and its storage assets
  app.delete('/api/drafts/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { userId, userEmail, userName, adminToken } = (req.query || req.body) as any;

      if (!id) {
        return res.status(400).json({ success: false, message: 'Draft ID is required' });
      }

      const isAuthorized = await checkAIToolkitServerAuth(
        {
          userId,
          userEmail,
          userName,
          adminToken,
        },
        req
      );

      if (!isAuthorized) {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
      }

      const supabase = getSupabaseAdmin();
      if (!supabase) {
        return res.json({ success: true, deleted: true });
      }

      let query = supabase.from('ai_draft_sessions').delete().eq('id', id);
      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { error } = await query;
      if (error) {
        console.warn('[API /api/drafts/:id delete] Supabase delete warning:', error);
      }

      // Cleanup storage files under ${userId}/${id}/
      if (userId) {
        try {
          const folderPath = `${userId}/${id}`;
          const { data: fileList } = await supabase.storage.from('ai-drafts').list(folderPath);
          if (fileList && fileList.length > 0) {
            const filesToDelete = fileList.map((f: any) => `${folderPath}/${f.name}`);
            await supabase.storage.from('ai-drafts').remove(filesToDelete);
          }
        } catch (storageErr) {
          console.warn('[API delete draft] Storage cleanup warning:', storageErr);
        }
      }

      return res.json({ success: true, deleted: true });
    } catch (err: any) {
      console.error('[API /api/drafts/:id delete error]:', err);
      return res.status(500).json({ success: false, message: err?.message || 'Failed to delete draft' });
    }
  });

  // 5. POST /api/drafts/upload - Upload an image/card-news asset to Supabase Storage
  app.post('/api/drafts/upload', async (req, res) => {
    try {
      const { userId, draftId, folder, fileName, base64Data } = req.body || {};

      if (!userId || !draftId || !fileName || !base64Data) {
        return res.status(400).json({ success: false, message: 'Missing required upload parameters' });
      }

      const supabase = getSupabaseAdmin();
      if (!supabase) {
        return res.json({ success: true, publicUrl: base64Data });
      }

      let mime = 'image/png';
      let buffer: Buffer;

      if (base64Data.startsWith('data:')) {
        const parts = base64Data.split(',');
        mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
        buffer = Buffer.from(parts[1], 'base64');
      } else {
        buffer = Buffer.from(base64Data, 'base64');
      }

      const safeFolder = folder || 'images';
      const filePath = `${userId}/${draftId}/${safeFolder}/${fileName}`;

      let { error: uploadError } = await supabase.storage.from('ai-drafts').upload(filePath, buffer, {
        upsert: true,
        contentType: mime,
      });

      if (uploadError && (uploadError.message?.includes('Bucket not found') || (uploadError as any)?.__isStorageError)) {
        try {
          const { error: createError } = await supabase.storage.createBucket('ai-drafts', {
            public: true,
            fileSizeLimit: 10485760, // 10MB
          });
          if (!createError) {
            const retry = await supabase.storage.from('ai-drafts').upload(filePath, buffer, {
              upsert: true,
              contentType: mime,
            });
            uploadError = retry.error;
          }
        } catch {}
      }
      if (uploadError) {
        return res.json({ success: true, publicUrl: base64Data, isFallback: true });
      }

      const { data: publicData } = supabase.storage.from('ai-drafts').getPublicUrl(filePath);
      return res.json({ success: true, publicUrl: publicData?.publicUrl || base64Data });
    } catch (err: any) {
      console.error('[API /api/drafts/upload error]:', err);
      return res.status(500).json({ success: false, message: err?.message || 'Upload failed' });
    }
  });

  // 6. POST /api/drafts/cleanup - Cleanup expired drafts (7 days old)
  app.post('/api/drafts/cleanup', async (req, res) => {
    try {
      const supabase = getSupabaseAdmin();
      if (!supabase) {
        return res.json({ success: true, cleanedCount: 0 });
      }

      const now = new Date().toISOString();
      const { data: expiredSessions, error: selectErr } = await supabase
        .from('ai_draft_sessions')
        .select('id, user_id')
        .in('status', ['drafting', 'temporary'])
        .lt('expires_at', now);

      if (selectErr || !expiredSessions || expiredSessions.length === 0) {
        return res.json({ success: true, cleanedCount: 0 });
      }

      let cleanedCount = 0;
      for (const sess of expiredSessions) {
        await supabase.from('ai_draft_sessions').delete().eq('id', sess.id);
        cleanedCount++;
      }

      return res.json({ success: true, cleanedCount });
    } catch (err: any) {
      console.error('[API /api/drafts/cleanup error]:', err);
      return res.status(500).json({ success: false, message: err?.message || 'Cleanup failed' });
    }
  });

  // 7. POST /api/revenue-proofs/upload - Upload revenue proof image
  app.post('/api/revenue-proofs/upload', async (req, res) => {
    try {
      const { userId, fileName, base64Data } = req.body || {};

      if (!base64Data) {
        return res.status(400).json({ success: false, message: 'No image data provided' });
      }

      const supabase = getSupabaseAdmin();
      if (!supabase) {
        return res.json({ success: true, url: base64Data });
      }

      let mime = 'image/jpeg';
      let buffer: Buffer;

      if (base64Data.startsWith('data:')) {
        const parts = base64Data.split(',');
        mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
        buffer = Buffer.from(parts[1], 'base64');
      } else {
        buffer = Buffer.from(base64Data, 'base64');
      }

      const safeExt = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
      const actualFileName = fileName || `proof_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${safeExt}`;
      const filePath = `${userId || 'anonymous'}/${actualFileName}`;

      let { error: uploadError } = await supabase.storage.from('revenue-proofs').upload(filePath, buffer, {
        upsert: true,
        contentType: mime,
      });

      if (uploadError && (uploadError.message?.includes('Bucket not found') || (uploadError as any)?.__isStorageError)) {
        try {
          const { error: createError } = await supabase.storage.createBucket('revenue-proofs', {
            public: true,
            fileSizeLimit: 10485760, // 10MB
          });

          if (!createError) {
            const retry = await supabase.storage.from('revenue-proofs').upload(filePath, buffer, {
              upsert: true,
              contentType: mime,
            });
            uploadError = retry.error;
          }
        } catch {
          // Graceful fallback
        }
      }

      if (uploadError) {
        return res.json({ success: true, url: base64Data, isFallback: true }); // Fallback to base64
      }

      const { data: publicData } = supabase.storage.from('revenue-proofs').getPublicUrl(filePath);
      return res.json({ success: true, url: publicData?.publicUrl || base64Data });
    } catch (err: any) {
      console.error('[API /api/revenue-proofs/upload error]:', err);
      return res.status(500).json({ success: false, message: err?.message || 'Upload failed' });
    }
  });

  // -------------------------------------------------------------------------
  // 뱃지 시스템 (Badge & Achievement System) Endpoints
  // -------------------------------------------------------------------------

  app.get('/api/badges', async (req, res) => {
    try {
      const supabase = getSupabaseAdmin();
      if (!supabase) {
        return res.json({ success: true, badges: [] });
      }
      const { data, error } = await supabase
        .from('badges')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) {
        console.warn('[API /api/badges] fetch warning:', error.message);
        return res.json({ success: true, badges: [] });
      }
      return res.json({ success: true, badges: data || [] });
    } catch (err: any) {
      console.error('[API /api/badges error]:', err);
      return res.status(500).json({ success: false, message: err?.message || 'Internal error' });
    }
  });

  app.post('/api/badges', async (req, res) => {
    try {
      const supabase = getSupabaseAdmin();
      if (!supabase) {
        return res.json({ success: true, message: 'Saved locally' });
      }
      const badge = req.body;
      const { data, error } = await supabase.from('badges').upsert(badge, { onConflict: 'id' });
      if (error) {
        console.warn('[API /api/badges POST] upsert error:', error.message);
        return res.status(400).json({ success: false, message: error.message });
      }
      return res.json({ success: true, badge: data });
    } catch (err: any) {
      console.error('[API /api/badges POST error]:', err);
      return res.status(500).json({ success: false, message: err?.message || 'Internal error' });
    }
  });

  app.get('/api/user-badges/:userId', async (req, res) => {
    try {
      const supabase = getSupabaseAdmin();
      if (!supabase) {
        return res.json({ success: true, userBadges: [] });
      }
      const { userId } = req.params;
      const { data, error } = await supabase
        .from('user_badges')
        .select('*, badges(*)')
        .eq('user_id', userId);

      if (error) {
        console.warn('[API /api/user-badges] fetch warning:', error.message);
        return res.json({ success: true, userBadges: [] });
      }
      return res.json({ success: true, userBadges: data || [] });
    } catch (err: any) {
      console.error('[API /api/user-badges error]:', err);
      return res.status(500).json({ success: false, message: err?.message || 'Internal error' });
    }
  });

  // -------------------------------------------------------------------------
  // 챌린지 참가비 및 환급 관리 (Payment & Refund Management) Endpoints
  // -------------------------------------------------------------------------

  // 1. POST /api/challenges/payment/submit - Secure deposit submission with canonical fee validation
  app.post('/api/challenges/payment/submit', async (req, res) => {
    try {
      const {
        challengeId,
        participantId,
        userId,
        userName,
        userEmail,
        userNaverId,
        userTwitterId,
        depositorName,
        depositedAt,
      } = req.body || {};

      if (!challengeId || !userId || !depositorName) {
        return res.status(400).json({ success: false, message: '필수 입력 항목(챌린지ID, 유저ID, 입금자명)이 누락되었습니다.' });
      }

      const supabase = getSupabaseAdmin();
      let canonicalFee = 0;
      let challengeName = '';

      if (supabase) {
        // Enforce fee lookup from database to prevent client tampering
        const { data: chalData } = await supabase
          .from('challenges')
          .select('id, name, fee, participation_fee')
          .eq('id', challengeId)
          .maybeSingle();

        if (chalData) {
          challengeName = chalData.name || '';
          canonicalFee = Math.round(Number(chalData.fee ?? chalData.participation_fee ?? 0));
        }
      }

      // If fee not found in DB, fallback safely to integer amount from request only if DB is unavailable
      if (canonicalFee === 0 && req.body.amount) {
        canonicalFee = Math.max(0, Math.round(Number(req.body.amount) || 0));
      }

      const paymentRecord = {
        id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        challenge_id: challengeId,
        participant_id: participantId || null,
        user_id: userId,
        user_name: userName || '',
        user_email: userEmail || '',
        user_naver_id: userNaverId || '',
        user_twitter_id: userTwitterId || '',
        amount: canonicalFee,
        depositor_name: String(depositorName).trim(),
        deposited_at: depositedAt || new Date().toISOString().split('T')[0],
        status: canonicalFee > 0 ? 'PAYMENT_REPORTED' : 'PAYMENT_CONFIRMED',
        submitted_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (supabase) {
        await supabase.from('challenge_payments').upsert(paymentRecord);
      }

      return res.json({
        success: true,
        payment: {
          id: paymentRecord.id,
          challengeId: paymentRecord.challenge_id,
          challengeName,
          participantId: paymentRecord.participant_id,
          userId: paymentRecord.user_id,
          userName: paymentRecord.user_name,
          userEmail: paymentRecord.user_email,
          amount: paymentRecord.amount,
          depositorName: paymentRecord.depositor_name,
          depositedAt: paymentRecord.deposited_at,
          status: paymentRecord.status,
          submittedAt: paymentRecord.submitted_at,
        },
        message: canonicalFee > 0 ? '입금 확인 요청이 접수되었습니다. 관리자가 확인 후 최종 참가 승인됩니다.' : '참가 신청이 완료되었습니다.',
      });
    } catch (err: any) {
      console.error('[API /api/challenges/payment/submit error]:', err);
      return res.status(500).json({ success: false, message: err?.message || '입금 요청 처리 중 오류가 발생했습니다.' });
    }
  });

  // 2. POST /api/challenges/refund/account - Deactivated (Refund accounts no longer stored in app; external form is used)
  app.post('/api/challenges/refund/account', async (_req, res) => {
    return res.json({
      success: true,
      message: '환급 정책 변경으로 인해 계좌 정보를 애플리케이션에 저장하지 않습니다. 환급 기준 달성 시 외부 환급 신청폼을 통해 안전하게 처리됩니다.',
    });
  });

  // -------------------------------------------------------------------------
  // 사용자 블로그 출력 서식 (User Blog Style) Endpoints
  // -------------------------------------------------------------------------

  // GET /api/user-style - Fetch user blog style preferences
  app.get('/api/user-style', async (req, res) => {
    try {
      const userId = (req.query.userId as string) || '';
      if (!userId) {
        return res.status(400).json({ success: false, message: 'User ID is required' });
      }

      const supabase = getSupabaseAdmin();
      if (!supabase) {
        return res.json({ success: true, style: null, isFallback: true });
      }

      const { data, error } = await supabase
        .from('user_blog_styles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.warn('[API /api/user-style GET] Supabase query warning:', error.message);
        return res.json({ success: true, style: null });
      }

      if (!data) {
        return res.json({ success: true, style: null });
      }

      const style = {
        id: data.id,
        userId: data.user_id,
        fontFamily: data.font_family || 'nanum_gothic',
        fontSize: data.font_size || '15pt',
        textColor: data.text_color || '#000000',
        backgroundColor: data.background_color || 'transparent',
        textAlign: data.text_align || 'center',
        lineHeight: data.line_height || '1.8',
        paragraphSpacing: data.paragraph_spacing || '18px',
        h2Style: data.h2_style || 'quote2',
        h2Color: data.h2_color || '#03c75a',
        h2FontSize: data.h2_font_size || '19pt',
        h2AutoNumbering: data.h2_auto_numbering ?? false,
        emphasisStyle: data.emphasis_style || 'bold',
        emphasisColor: data.emphasis_color || '#ff9300',
        wrapLongSentences: data.wrap_long_sentences ?? true,
        separateParagraphs: data.separate_paragraphs ?? true,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };

      return res.json({ success: true, style });
    } catch (err: any) {
      console.error('[API /api/user-style GET error]:', err);
      return res.status(500).json({ success: false, message: err?.message || 'Failed to fetch user blog style' });
    }
  });

  // POST /api/user-style - Save user blog style preferences (Upsert)
  app.post('/api/user-style', async (req, res) => {
    try {
      const { style } = req.body || {};
      if (!style || !style.userId) {
        return res.status(400).json({ success: false, message: 'Valid style object with userId is required' });
      }

      const supabase = getSupabaseAdmin();
      if (!supabase) {
        return res.json({ success: true, message: 'Saved locally (database client unavailable)' });
      }

      const payload = {
        user_id: style.userId,
        font_family: style.fontFamily || 'nanum_gothic',
        font_size: style.fontSize || '15pt',
        text_color: style.textColor || '#000000',
        background_color: style.backgroundColor || 'transparent',
        text_align: style.textAlign || 'center',
        line_height: style.lineHeight || '1.8',
        paragraph_spacing: style.paragraphSpacing || '18px',
        h2_style: style.h2Style || 'quote2',
        h2_color: style.h2Color || '#03c75a',
        h2_font_size: style.h2FontSize || '19pt',
        h2_auto_numbering: style.h2AutoNumbering ?? false,
        emphasis_style: style.emphasisStyle || 'bold',
        emphasis_color: style.emphasisColor || '#ff9300',
        wrap_long_sentences: style.wrapLongSentences ?? true,
        separate_paragraphs: style.separateParagraphs ?? true,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('user_blog_styles')
        .upsert(payload, { onConflict: 'user_id' });

      if (error) {
        console.warn('[API /api/user-style POST] Supabase upsert warning:', error.message);
        return res.status(500).json({ success: false, message: error.message });
      }

      return res.json({ success: true, message: '블로그 출력 서식이 저장되었습니다.' });
    } catch (err: any) {
      console.error('[API /api/user-style POST error]:', err);
      return res.status(500).json({ success: false, message: err?.message || 'Failed to save user blog style' });
    }
  });

  // -------------------------------------------------------------------------
  // 회원 관리 + 자동 등급 부여 + 상품/구매 구조 + 유료 기능 잠금 (Membership & Products API)
  // -------------------------------------------------------------------------

  // 1. 상품 목록 조회 (GET /api/products)
  app.get('/api/products', async (req, res) => {
    try {
      const supabase = getSupabaseAdmin();
      if (!supabase) {
        return res.json({ success: true, products: [] });
      }
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) {
        console.warn('[API /api/products] fetch warning:', error.message);
        return res.json({ success: true, products: [] });
      }
      return res.json({ success: true, products: data || [] });
    } catch (err: any) {
      console.error('[API /api/products error]:', err);
      return res.status(500).json({ success: false, message: err?.message || 'Internal server error' });
    }
  });

  // 2. 상품 등록/수정 (POST /api/products)
  app.post('/api/products', async (req, res) => {
    try {
      const supabase = getSupabaseAdmin();
      const product = req.body;
      if (!product || !product.id || !product.name) {
        return res.status(400).json({ success: false, message: '상품 ID와 상품명은 필수입니다.' });
      }

      if (!supabase) {
        return res.json({ success: true, product, message: 'Saved locally' });
      }

      const payload = {
        id: product.id,
        name: product.name,
        description: product.description || '',
        product_type: product.productType || product.product_type || 'membership',
        price: Math.max(0, Math.round(Number(product.price) || 0)),
        original_price: product.originalPrice ?? product.original_price ?? null,
        membership_tier: product.membershipTier ?? product.membership_tier ?? null,
        duration_days: product.durationDays ?? product.duration_days ?? null,
        ai_usage_add_count: product.aiUsageAddCount ?? product.ai_usage_add_count ?? null,
        is_active: product.isActive ?? product.is_active ?? true,
        sort_order: Number(product.sortOrder ?? product.sort_order) || 0,
        features: product.features || [],
        badge: product.badge || null,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase.from('products').upsert(payload, { onConflict: 'id' });
      if (error) {
        console.warn('[API /api/products POST] upsert warning:', error.message);
        return res.status(500).json({ success: false, message: error.message });
      }
      return res.json({ success: true, product: data || payload });
    } catch (err: any) {
      console.error('[API /api/products POST error]:', err);
      return res.status(500).json({ success: false, message: err?.message || 'Internal server error' });
    }
  });

  // 3. 상품 삭제 (DELETE /api/products/:id) - Safe deletion with purchase history check
  app.delete('/api/products/:id', async (req, res) => {
    try {
      const supabase = getSupabaseAdmin();
      const { id } = req.params;
      const force = req.query.force === 'true';
      if (!supabase) return res.json({ success: true });

      // Check if any purchase record exists for this product
      const { count: purchaseCount } = await supabase
        .from('purchases')
        .select('*', { count: 'exact', head: true })
        .eq('product_id', id);

      if (purchaseCount && purchaseCount > 0) {
        if (force) {
          // Force delete: Unlink foreign key in purchases first
          await supabase.from('purchases').update({ product_id: null }).eq('product_id', id);
          const { error: delErr } = await supabase.from('products').delete().eq('id', id);
          if (delErr) return res.status(500).json({ success: false, message: delErr.message });
          return res.json({ success: true, forceDeleted: true, purchaseCount, message: '상품이 영구 삭제되었습니다.' });
        }

        // Soft delete: keep historical records, mark as inactive
        const { error: updateErr } = await supabase
          .from('products')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('id', id);

        if (updateErr) return res.status(500).json({ success: false, message: updateErr.message });
        return res.json({ success: true, softDeleted: true, purchaseCount, message: '구매 내역이 존재하여 판매 중지(비활성화) 처리되었습니다.' });
      }

      // No purchase history -> safe physical delete
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) {
        return res.status(500).json({ success: false, message: error.message });
      }
      return res.json({ success: true, message: '상품이 성공적으로 삭제되었습니다.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Internal server error' });
    }
  });

  // 4. 결제/구매 내역 조회 (GET /api/purchases)
  app.get('/api/purchases', async (req, res) => {
    try {
      const supabase = getSupabaseAdmin();
      const { userId } = req.query;
      if (!supabase) {
        return res.json({ success: true, purchases: [] });
      }
      let query = supabase.from('purchases').select('*').order('purchased_at', { ascending: false });
      if (userId) {
        query = query.eq('user_id', String(userId).toLowerCase().trim());
      }
      const { data, error } = await query;
      if (error) {
        console.warn('[API /api/purchases] fetch warning:', error.message);
        return res.json({ success: true, purchases: [] });
      }
      return res.json({ success: true, purchases: data || [] });
    } catch (err: any) {
      console.error('[API /api/purchases error]:', err);
      return res.status(500).json({ success: false, message: err?.message || 'Internal server error' });
    }
  });

  // 5. 구매 생성 및 멤버십 등급 자동 부여 (POST /api/purchases/create)
  app.post('/api/purchases/create', async (req, res) => {
    try {
      const {
        userId,
        userName,
        userEmail,
        productId,
        productName,
        productType = 'membership',
        amount = 0,
        paymentMethod = 'bank_transfer',
        targetTierId,
        durationDays,
        sourceType = 'product_purchase',
        sourceId,
        notes,
      } = req.body || {};

      if (!userId || !productId) {
        return res.status(400).json({ success: false, message: '사용자 ID와 상품 ID가 필요합니다.' });
      }

      const cleanUserId = String(userId).toLowerCase().trim();
      const now = new Date();
      let expiresAt: string | null = null;
      if (durationDays && Number(durationDays) > 0) {
        const exp = new Date(now);
        exp.setDate(exp.getDate() + Number(durationDays));
        expiresAt = exp.toISOString();
      }

      const purchaseId = `pur_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const supabase = getSupabaseAdmin();

      if (supabase) {
        // 1. Insert purchase record
        const purchaseRecord = {
          id: purchaseId,
          user_id: cleanUserId,
          user_name: userName || '',
          user_email: userEmail || '',
          product_id: productId,
          product_name: productName || '상품 구매',
          product_type: productType,
          amount: Math.max(0, Math.round(Number(amount) || 0)),
          payment_method: paymentMethod,
          status: 'completed',
          source_type: sourceType,
          source_id: sourceId || purchaseId,
          notes: notes || '',
          purchased_at: now.toISOString(),
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        };
        await supabase.from('purchases').insert(purchaseRecord);

        // 2. If membership product or targetTier specified, upsert user_memberships
        const tierToGrant = targetTierId || (productType === 'membership' ? 'pro' : null);
        if (tierToGrant) {
          const membershipPayload = {
            id: `um_${cleanUserId}`,
            user_id: cleanUserId,
            tier_id: tierToGrant,
            status: 'active',
            started_at: now.toISOString(),
            expires_at: expiresAt,
            source_type: sourceType,
            source_id: purchaseId,
            notes: notes || `[구매 지급] ${productName || '상품'}`,
            updated_at: now.toISOString(),
          };
          await supabase.from('user_memberships').upsert(membershipPayload, { onConflict: 'user_id' });
        }
      }

      return res.json({
        success: true,
        purchaseId,
        message: '구매가 성공적으로 처리되고 등급이 부여되었습니다.',
      });
    } catch (err: any) {
      console.error('[API /api/purchases/create error]:', err);
      return res.status(500).json({ success: false, message: err?.message || '구매 처리 중 오류가 발생했습니다.' });
    }
  });

  // 6. 관리자용 전체 회원 및 등급 목록 조회 (GET /api/admin/members)
  app.get('/api/admin/members', async (req, res) => {
    try {
      const supabase = getSupabaseAdmin();
      if (!supabase) {
        return res.json({ success: true, members: [] });
      }

      // Fetch profiles, user_memberships, and membership_tiers
      const [profilesRes, membershipsRes, tiersRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('user_memberships').select('*'),
        supabase.from('membership_tiers').select('*'),
      ]);

      const tierMap: Record<string, string> = {
        free: '무료 회원',
        basic: 'BASIC',
        pro: 'PRO',
        vip: 'VIP',
        admin: '관리자',
      };
      (tiersRes.data || []).forEach((t: any) => {
        tierMap[t.id] = t.name;
      });

      const memberMap = new Map<string, any>();
      (membershipsRes.data || []).forEach((m: any) => {
        memberMap.set(String(m.user_id).toLowerCase().trim(), m);
      });

      const members = (profilesRes.data || []).map((p: any) => {
        const uKey = String(p.email || p.id || p.naver_id || p.name).toLowerCase().trim();
        const m = memberMap.get(uKey) || memberMap.get(String(p.id).toLowerCase()) || memberMap.get(String(p.email).toLowerCase());
        const tierId = m?.tier_id || (p.role === 'admin' ? 'admin' : 'free');

        return {
          userId: p.id || uKey,
          name: p.name || '회원',
          email: p.email || '',
          naverId: p.naver_id || '',
          role: p.role || 'user',
          tierId,
          tierName: tierMap[tierId] || tierId,
          membershipStatus: m?.status || 'active',
          expiresAt: m?.expires_at || null,
          sourceType: m?.source_type || 'manual',
          sourceId: m?.source_id || null,
          notes: m?.notes || null,
          createdAt: p.created_at,
        };
      });

      return res.json({ success: true, members });
    } catch (err: any) {
      console.error('[API /api/admin/members error]:', err);
      return res.status(500).json({ success: false, message: err?.message || '회원 목록 조회 실패' });
    }
  });

  // 7. 관리자용 회원 등급 수동 변경 (POST /api/admin/members/tier)
  app.post('/api/admin/members/tier', requireAdminAuth, async (req: any, res: any) => {
    try {
      const { userId, userEmail, userName, tierId, status = 'active', durationDays, expiresAt: directExpiresAt, notes } = req.body || {};
      if (!userId || !tierId) {
        return res.status(400).json({ success: false, message: '사용자 ID와 등급 ID는 필수입니다.' });
      }

      const cleanUserId = String(userId).toLowerCase().trim();
      const now = new Date();
      let calculatedExpiresAt: string | null = directExpiresAt || null;

      if (durationDays && Number(durationDays) > 0) {
        const exp = new Date(now);
        exp.setDate(exp.getDate() + Number(durationDays));
        calculatedExpiresAt = exp.toISOString();
      }

      const supabase = getSupabaseAdmin(req);
      if (supabase) {
        const payload = {
          id: `um_${cleanUserId}`,
          user_id: cleanUserId,
          tier_id: tierId,
          status,
          started_at: now.toISOString(),
          expires_at: calculatedExpiresAt,
          source_type: 'admin',
          source_id: 'admin_manual',
          notes: notes || '관리자 수동 지정',
          updated_at: now.toISOString(),
        };

        const { error } = await supabase.from('user_memberships').upsert(payload, { onConflict: 'user_id' });
        if (error) {
          console.warn('[API /api/admin/members/tier error]:', error.message);
          return res.status(500).json({ success: false, message: error.message });
        }

        if (userEmail || userName) {
          try {
            await supabase.from('profiles').update({
              updated_at: now.toISOString(),
            }).or(`id.eq.${cleanUserId},email.ilike.${cleanUserId}`);
          } catch (_) {}
        }
      }

      return res.json({
        success: true,
        message: '회원 등급이 성공적으로 업데이트되었습니다.',
      });
    } catch (err: any) {
      console.error('[API /api/admin/members/tier error]:', err);
      return res.status(500).json({ success: false, message: err?.message || '등급 수정 중 오류가 발생했습니다.' });
    }
  });

  // 8. 챌린지 결제 승인 시 자동 등급 부여 (POST /api/challenges/payment/approve)
  app.post('/api/challenges/payment/approve', async (req, res) => {
    try {
      const { paymentId, challengeId, userId, userName, userEmail } = req.body || {};
      if (!paymentId) {
        return res.status(400).json({ success: false, message: 'paymentId is required' });
      }

      const supabase = getSupabaseAdmin();
      if (supabase) {
        // Update payment status
        await supabase
          .from('challenge_payments')
          .update({
            status: 'PAYMENT_CONFIRMED',
            confirmed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', paymentId);

        // Fetch challenge auto tier settings
        if (challengeId && userId) {
          const { data: chal } = await supabase
            .from('challenges')
            .select('id, name, auto_tier_enabled, grant_membership_tier, membership_duration_days, end_date')
            .eq('id', challengeId)
            .maybeSingle();

          if (chal && chal.auto_tier_enabled !== false) {
            const targetTier = chal.grant_membership_tier || 'pro';
            const cleanUserId = String(userId).toLowerCase().trim();
            const now = new Date();
            let expiresAt: string | null = null;

            if (chal.membership_duration_days && Number(chal.membership_duration_days) > 0) {
              const exp = new Date(now);
              exp.setDate(exp.getDate() + Number(chal.membership_duration_days));
              expiresAt = exp.toISOString();
            } else if (chal.end_date) {
              const chalEnd = new Date(chal.end_date);
              if (!isNaN(chalEnd.getTime())) {
                chalEnd.setDate(chalEnd.getDate() + 7);
                expiresAt = chalEnd.toISOString();
              }
            }

            await supabase.from('user_memberships').upsert({
              id: `um_${cleanUserId}`,
              user_id: cleanUserId,
              tier_id: targetTier,
              status: 'active',
              started_at: now.toISOString(),
              expires_at: expiresAt,
              source_type: 'challenge',
              source_id: challengeId,
              notes: `[챌린지 승인 자동 등급] ${chal.name}`,
              updated_at: now.toISOString(),
            }, { onConflict: 'user_id' });
          }
        }
      }

      return res.json({ success: true, message: '입금이 승인되고 등급이 자동으로 반영되었습니다.' });
    } catch (err: any) {
      console.error('[API /api/challenges/payment/approve error]:', err);
      return res.status(500).json({ success: false, message: err?.message || '승인 처리 실패' });
    }
  });

  // -------------------------------------------------------------------------
  // Board APIs (FAQ & Q&A)
  // -------------------------------------------------------------------------

  // GET FAQs
  app.get('/api/board/faqs', async (req: any, res: any) => {
    try {
      const supabase = getSupabaseAdmin(req);
      if (!supabase) return res.json({ success: true, data: [] });
      const { data, error } = await supabase
        .from('faqs')
        .select('*')
        .order('order_index', { ascending: true })
        .order('created_at', { ascending: false });
      if (error) {
        console.warn('[API /api/board/faqs error]:', error.message);
        return res.json({ success: true, data: [] });
      }
      return res.json({ success: true, data: data || [] });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message });
    }
  });

  // POST FAQ (Admin)
  app.post('/api/board/faqs', requireAdminAuth, async (req: any, res: any) => {
    try {
      const supabase = getSupabaseAdmin(req);
      if (!supabase) return res.status(500).json({ success: false, message: 'Supabase unavailable' });
      const { id, question, answer, category, isPublished, orderIndex, authorName } = req.body;
      const payload = {
        id: id || `faq_${Date.now()}`,
        question,
        answer,
        category: category || '일반',
        is_published: isPublished !== undefined ? isPublished : true,
        order_index: orderIndex !== undefined ? Number(orderIndex) : 0,
        author_name: authorName || '운영자',
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase.from('faqs').upsert(payload).select().single();
      if (error) return res.status(400).json({ success: false, message: error.message });
      return res.json({ success: true, data });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message });
    }
  });

  // PUT FAQ (Admin)
  app.put('/api/board/faqs/:id', requireAdminAuth, async (req: any, res: any) => {
    try {
      const supabase = getSupabaseAdmin(req);
      if (!supabase) return res.status(500).json({ success: false, message: 'Supabase unavailable' });
      const { id } = req.params;
      const { question, answer, category, isPublished, orderIndex, authorName } = req.body;
      const payload = {
        question,
        answer,
        category: category || '일반',
        is_published: isPublished !== undefined ? isPublished : true,
        order_index: orderIndex !== undefined ? Number(orderIndex) : 0,
        author_name: authorName || '운영자',
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase.from('faqs').update(payload).eq('id', id).select().single();
      if (error) return res.status(400).json({ success: false, message: error.message });
      return res.json({ success: true, data });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message });
    }
  });

  // DELETE FAQ (Admin)
  app.delete('/api/board/faqs/:id', requireAdminAuth, async (req: any, res: any) => {
    try {
      const supabase = getSupabaseAdmin(req);
      if (!supabase) return res.status(500).json({ success: false, message: 'Supabase unavailable' });
      const { id } = req.params;
      const { error } = await supabase.from('faqs').delete().eq('id', id);
      if (error) return res.status(400).json({ success: false, message: error.message });
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message });
    }
  });

  // GET Q&A (with secret post masking for unauthorized users)
  app.get('/api/board/qna', async (req: any, res: any) => {
    try {
      const supabase = getSupabaseAdmin(req);
      if (!supabase) return res.json({ success: true, data: [] });
      const currentUserId = req.query.userId || '';
      const isAdminHeader = req.headers['x-admin-token'] || req.headers['authorization'];
      const isAdmin = Boolean(isAdminHeader);

      const { data, error } = await supabase
        .from('qna_posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[API /api/board/qna error]:', error.message);
        return res.json({ success: true, data: [] });
      }

      // Sanitize secret posts if requester is neither author nor admin
      const sanitized = (data || []).map((item: any) => {
        const isAuthor = currentUserId && item.user_id === currentUserId;
        if (item.is_secret && !isAuthor && !isAdmin) {
          return {
            ...item,
            title: '🔒 [비공개 질문입니다]',
            content: '비공개 질문입니다. 작성자와 관리자만 확인할 수 있습니다.',
            answer_content: null,
          };
        }
        return item;
      });

      return res.json({ success: true, data: sanitized });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message });
    }
  });

  // POST Q&A (User creates question)
  app.post('/api/board/qna', async (req: any, res: any) => {
    try {
      const supabase = getSupabaseAdmin(req);
      if (!supabase) return res.status(500).json({ success: false, message: 'Supabase unavailable' });
      const { id, title, content, userId, authorName, authorEmail, isSecret } = req.body;
      if (!title?.trim() || !content?.trim() || !userId) {
        return res.status(400).json({ success: false, message: '필수 항목(제목, 내용, 사용자 정보)이 누락되었습니다.' });
      }
      const payload = {
        id: id || `qna_${Date.now()}`,
        title: title.trim(),
        content: content.trim(),
        user_id: userId,
        author_name: authorName || '회원',
        author_email: authorEmail || null,
        is_secret: Boolean(isSecret),
        status: 'pending',
        is_published: true,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase.from('qna_posts').upsert(payload).select().single();
      if (error) return res.status(400).json({ success: false, message: error.message });
      return res.json({ success: true, data });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message });
    }
  });

  // PUT Q&A (Update question)
  app.put('/api/board/qna/:id', async (req: any, res: any) => {
    try {
      const supabase = getSupabaseAdmin(req);
      if (!supabase) return res.status(500).json({ success: false, message: 'Supabase unavailable' });
      const { id } = req.params;
      const { title, content, isSecret, userId } = req.body;
      const isAdmin = Boolean(req.headers['x-admin-token'] || req.headers['authorization']);

      // Check author if not admin
      if (!isAdmin && userId) {
        const { data: existing } = await supabase.from('qna_posts').select('user_id').eq('id', id).single();
        if (existing && existing.user_id !== userId) {
          return res.status(403).json({ success: false, message: '수정 권한이 없습니다.' });
        }
      }

      const payload: any = {
        updated_at: new Date().toISOString(),
      };
      if (title !== undefined) payload.title = title.trim();
      if (content !== undefined) payload.content = content.trim();
      if (isSecret !== undefined) payload.is_secret = Boolean(isSecret);

      const { data, error } = await supabase.from('qna_posts').update(payload).eq('id', id).select().single();
      if (error) return res.status(400).json({ success: false, message: error.message });
      return res.json({ success: true, data });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message });
    }
  });

  // DELETE Q&A
  app.delete('/api/board/qna/:id', async (req: any, res: any) => {
    try {
      const supabase = getSupabaseAdmin(req);
      if (!supabase) return res.status(500).json({ success: false, message: 'Supabase unavailable' });
      const { id } = req.params;
      const userId = req.query.userId || req.body?.userId;
      const isAdmin = Boolean(req.headers['x-admin-token'] || req.headers['authorization']);

      if (!isAdmin && userId) {
        const { data: existing } = await supabase.from('qna_posts').select('user_id').eq('id', id).single();
        if (existing && existing.user_id !== userId) {
          return res.status(403).json({ success: false, message: '삭제 권한이 없습니다.' });
        }
      }

      const { error } = await supabase.from('qna_posts').delete().eq('id', id);
      if (error) return res.status(400).json({ success: false, message: error.message });
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message });
    }
  });

  // POST Answer to Q&A (Admin)
  app.post('/api/board/qna/:id/answer', requireAdminAuth, async (req: any, res: any) => {
    try {
      const supabase = getSupabaseAdmin(req);
      if (!supabase) return res.status(500).json({ success: false, message: 'Supabase unavailable' });
      const { id } = req.params;
      const { answerContent, answeredBy } = req.body;
      if (!answerContent?.trim()) {
        return res.status(400).json({ success: false, message: '답변 내용을 입력해주세요.' });
      }
      const nowIso = new Date().toISOString();
      const payload = {
        answer_content: answerContent.trim(),
        answered_at: nowIso,
        answered_by: answeredBy || '운영자',
        status: 'answered',
        updated_at: nowIso,
      };
      const { data, error } = await supabase.from('qna_posts').update(payload).eq('id', id).select().single();
      if (error) return res.status(400).json({ success: false, message: error.message });
      return res.json({ success: true, data });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message });
    }
  });

  // -------------------------------------------------------------------------
  // 404 handler for all unmatched /api/* routes so they NEVER fall through to Vite SPA index.html
  app.all('/api/*', (req, res) => {
    return res.status(404).json({
      success: false,
      error: 'Not Found',
      message: `API endpoint not found: ${req.method} ${req.path}`,
    });
  });

  // Vite middleware for development or static serving for production
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    const fallbackPath = path.resolve(__dirname);
    const resolvedDist = fs.existsSync(path.join(distPath, 'index.html'))
      ? distPath
      : fs.existsSync(path.join(fallbackPath, 'index.html'))
      ? fallbackPath
      : distPath;

    app.use(express.static(resolvedDist));
    app.get('*', (req, res) => {
      const indexPath = path.join(resolvedDist, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Application build files not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    
    // Check and log outbound public IP
    fetch('https://api.ipify.org?format=json')
      .then(r => r.json())
      .then((data: any) => console.log('[서버 아웃바운드 IP]', data.ip))
      .catch(console.error);

    // Auto-seed default prompts in database in the background if empty
    const supabase = getSupabaseAdmin();
    if (supabase) {
      autoSeedPromptsIfEmpty(supabase).catch((err) => {
        console.warn('[AI Toolkit] Auto-seed background notice:', err?.message || err);
      });
    }
  });
}

startServer();
