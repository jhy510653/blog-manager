/**
 * [AI 모델별 원가 설정 및 계산 유틸리티]
 * 향후 모델 가격 변동 시 이 파일의 AI_MODEL_PRICING 객체만 수정하시면 됩니다.
 */

export interface AiModelPricingConfig {
  textModel: {
    name: string;
    inputCostPer1kTokensKRW: number;   // 원 / 1,000 토큰
    outputCostPer1kTokensKRW: number;  // 원 / 1,000 토큰
    estimatedInputTokensPerDraft: number;  // 포스팅 1회당 평균 입력 토큰 추정치
    estimatedOutputTokensPerDraft: number; // 포스팅 1회당 평균 출력 토큰 추정치
  };
  imageGeneration: {
    costPerAiImageKRW: number;       // 원 / AI 이미지 생성 1회
    costPerFreeSearchKRW: number;    // 원 / 무료 상업용 이미지 검색 (0원)
  };
  cardNewsGeneration: {
    costPerCardNewsKRW: number;      // 원 / 카드뉴스 세트 생성 1회
  };
}

export const AI_MODEL_PRICING: AiModelPricingConfig = {
  textModel: {
    name: 'Gemini Flash (최적화 모델)',
    inputCostPer1kTokensKRW: 0.15,  // 1k 입력 토큰당 약 0.15원
    outputCostPer1kTokensKRW: 0.60, // 1k 출력 토큰당 약 0.60원
    estimatedInputTokensPerDraft: 1500,  // 평균 1,500 토큰
    estimatedOutputTokensPerDraft: 3000, // 평균 3,000 토큰
  },
  imageGeneration: {
    costPerAiImageKRW: 20,          // AI 이미지 생성 1회당 20원
    costPerFreeSearchKRW: 0,         // Unsplash 상업용 이미지 검색 0원
  },
  cardNewsGeneration: {
    costPerCardNewsKRW: 15,         // 카드뉴스 1세트(6장) 생성 15원
  },
};

export interface AiCostBreakdown {
  textCost: number;       // 원
  imageCost: number;      // 원
  cardNewsCost: number;   // 원
  totalCost: number;      // 원
  isActualTokens?: boolean;
}

/**
 * 예상 또는 실제 생성 조건에 따른 AI 원가 계산 함수
 */
export function calculateAiCost(options?: {
  imageMode?: 'free_image' | 'ai_graphic' | 'user_photo';
  createCardNews?: boolean;
  actualPromptTokens?: number;
  actualCompletionTokens?: number;
}): AiCostBreakdown {
  const pricing = AI_MODEL_PRICING;

  // 1. 본문 AI 텍스트 원가
  let textCost = 0;
  let isActualTokens = false;

  if (typeof options?.actualPromptTokens === 'number' && typeof options?.actualCompletionTokens === 'number') {
    textCost =
      (options.actualPromptTokens / 1000) * pricing.textModel.inputCostPer1kTokensKRW +
      (options.actualCompletionTokens / 1000) * pricing.textModel.outputCostPer1kTokensKRW;
    isActualTokens = true;
  } else {
    // 예상 토큰 기준
    textCost =
      (pricing.textModel.estimatedInputTokensPerDraft / 1000) * pricing.textModel.inputCostPer1kTokensKRW +
      (pricing.textModel.estimatedOutputTokensPerDraft / 1000) * pricing.textModel.outputCostPer1kTokensKRW;
  }

  // 2. 이미지 생성 원가 (기본 0원)
  let imageCost = 0;
  if (!options?.createCardNews && options?.imageMode === 'ai_graphic') {
    imageCost = pricing.imageGeneration.costPerAiImageKRW;
  } else {
    imageCost = pricing.imageGeneration.costPerFreeSearchKRW;
  }

  // 3. 카드뉴스 생성 원가
  let cardNewsCost = 0;
  if (options?.createCardNews) {
    cardNewsCost = pricing.cardNewsGeneration.costPerCardNewsKRW;
  }

  const totalCost = Math.round((textCost + imageCost + cardNewsCost) * 10) / 10;

  return {
    textCost: Math.round(textCost * 10) / 10,
    imageCost: Math.round(imageCost * 10) / 10,
    cardNewsCost: Math.round(cardNewsCost * 10) / 10,
    totalCost,
    isActualTokens,
  };
}
