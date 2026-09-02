/**
 * 주요 브랜드명 및 브랜드 동의어/표기 변형 매핑 사전
 * - 브랜드 정규화: "엘지제습기", "LG전자 제습기", "휘센 제습기" -> "LG 제습기" 등으로 정규화하여
 *   표기 차이로 인한 중복 분리를 방지하고 정확한 클러스터링을 지원합니다.
 */

export interface BrandSynonymMapping {
  canonical: string;
  synonyms: string[];
}

export const BRAND_SYNONYMS: Record<string, string[]> = {
  LG: ['LG전자', '엘지전자', '엘지', 'LG휘센', '휘센', 'LG트롬', '트롬', 'LG오브제', '오브제컬렉션', 'LG코드제로', '코드제로', 'LG그램', 'LG스탠바이미', '스탠바이미', 'LG시네빔'],
  삼성: ['삼성전자', '삼성비스포크', '비스포크', '갤럭시', '갤럭시북', '삼성그랑데', '그랑데', '무풍', '삼성무풍', '더세로', '더프레임', '스마트싱스', '삼성제트'],
  위닉스: ['위닉스뽀송', '뽀송', '위닉스타워', '위닉스제로', '위닉스마스터'],
  다이슨: ['dyson', '에어랩', '슈퍼소닉', '에어로스트레이트', '다이슨청소기', '다이슨드라이기'],
  쿠쿠: ['쿠쿠전자', '쿠쿠트윈프레셔', '트윈프레셔', '쿠쿠인스퓨어', '인스퓨어', '쿠쿠밥솥'],
  쿠첸: ['쿠첸밥솥', '쿠첸트리플', '쿠첸브레인'],
  샤오미: ['xiaomi', '미지아', '드리미', '로보락', '로이드미'],
  발뮤다: ['balmuda', '더토스터', '더팟', '더브루', '그린팬'],
  신일: ['신일전자', '신일팬히터', '신일서큘레이터', '신일선풍기'],
  파세코: ['창문형에어컨', '파세코창문형', '파세코캠핑난로', '파세코난로'],
  SK매직: ['동양매직', 'sk매직', '에스케이매직'],
  필립스: ['philips', '소닉케어', '라떼고', '필립스면도기'],
  네스프레소: ['nespresso', '버츄오', '버츄오팝', '버츄오플러스', '오리지널캡슐'],
  드롱기: ['delonghi', '마그니피카', '데디카', '디나미카'],
  애플: ['apple', '아이폰', '맥북', '아이패드', '에어팟', '애플워치', '맥미니', '맥스튜디오'],
  소니: ['sony', '플레이스테이션', '플스', '노이즈캔슬링'],
  코웨이: ['coway', '아이콘정수기', '노블정수기', '비렉스'],
  한샘: ['샘키즈', '한샘몰', '한샘인테리어'],
};

/**
 * 긴 동의어가 짧은 동의어보다 먼저 치환되도록 정렬된 사전 목록
 */
export interface CompiledBrandSynonym {
  pattern: string;
  canonical: string;
}

export const SORTED_BRAND_SYNONYMS: CompiledBrandSynonym[] = (() => {
  const list: CompiledBrandSynonym[] = [];
  for (const [canonical, synonyms] of Object.entries(BRAND_SYNONYMS)) {
    for (const syn of synonyms) {
      list.push({ pattern: syn, canonical });
    }
  }
  // 긴 단어 우선 정렬 (예: "LG전자"가 "LG"보다 먼저 매칭)
  list.sort((a, b) => b.pattern.length - a.pattern.length);
  return list;
})();

/**
 * 텍스트 내의 브랜드 동의어를 표준 대표 브랜드명으로 치환/정규화
 * 예: "엘지제습기" -> "LG제습기"
 * 예: "LG전자 제습기 추천" -> "LG 제습기 추천"
 * 예: "위닉스뽀송 제습기" -> "위닉스 제습기"
 */
export function normalizeBrandNames(text: string): string {
  if (!text || typeof text !== 'string') return '';
  let result = text;

  for (const item of SORTED_BRAND_SYNONYMS) {
    if (result.includes(item.pattern)) {
      // 대소문자 무시 정규식 치환
      const escaped = item.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'gi');
      result = result.replace(regex, item.canonical);
    }
  }

  // 중복으로 연속된 동일 브랜드명 정리 (예: "LG LG 제습기" -> "LG 제습기", "위닉스 위닉스 제습기" -> "위닉스 제습기")
  Object.keys(BRAND_SYNONYMS).forEach((brand) => {
    const doublePattern = new RegExp(`(${brand}\\s*)+`, 'g');
    result = result.replace(doublePattern, `${brand} `);
  });

  // 연속 공백 정리
  return result.replace(/\s+/g, ' ').trim();
}
