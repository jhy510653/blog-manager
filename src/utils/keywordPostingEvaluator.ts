import { TrendKeyword } from '../types';

export interface KeywordEvaluation {
  isPostingUsable: boolean;      // 포스팅 활용 가능 여부 (usabilityScore >= 3 && genericPenalty <= 40)
  usabilityScore: number;         // 1 ~ 5 (포스팅 활용도 별점)
  intentCategory: string;         // e.g., '경험/후기 탐색', '정보/가이드', '비교/선택', '여행/일정 기획'
  intentDescription: string;      // 구체적인 검색 의도 설명
  combinationType: string;        // e.g., '[지역] + [맛집/명소]', '[제품] + [추천/비교]', '[정보] + [방법/해결]'
  timingTag: 'now' | 'prepare' | 'steady'; // 🔥지금쓰기 / 🌱미리준비 / 📌스테디
  timingTagLabel: string;         // '🔥 지금 쓰기' | '🌱 미리 준비' | '📌 스테디'
  recommendReason: string;        // 포스팅 추천 이유 코멘트
  contentStyle: string;           // '경험/후기형' | '정보/가이드형' | '비교/큐레이션형'
  postingTitleHint?: string;      // 블로그 제목화 예시/소재 방향
  suggestedTitles: string[];      // 실전 블로그 추천 제목 예시 3종
  suggestedOutlines: string[];    // 블로그 추천 목차 (H2) 가이드 4종
  reason?: string;

  // 세부 정밀 평가 지표 (0 ~ 100)
  specificityScore: number;       // 구체성 점수 (0 ~ 100)
  blogTopicScore: number;        // 블로그 포스팅 소재 적합성 점수 (0 ~ 100)
  recentBlogActivity: number;     // 최근 블로그 활용 활성도 점수 (0 ~ 100)
  seasonalityScore: number;       // 시즌성 점수 (0 ~ 100)
  genericPenalty: number;         // 범용 키워드 감점 (0 ~ 100)
  classification: 'immediate_post' | 'expandable_topic' | 'trend_reference'; // 3단계 분류
  classificationLabel: string;   // '즉시 포스팅 추천' | '확장형 소재' | '참고용 트렌드'
  excludedReason?: string;        // 감점/제외 사유 (관리자 디버그용)
}

// 1. 단독 또는 지나치게 광범위한 범용 검색어 (단독 출현 또는 단순 '내근처' 결합 시 강한 감점)
export const STANDALONE_GENERIC_WORDS = new Set([
  '맛집', '카페', '여행', '음식', '쇼핑', '숙소', '호텔', '추천', '메뉴',
  '여행지', '가볼만한곳', '근처', '내근처', '정보', '후기', '코디', '일상',
  '내근처맛집', '근처가볼만한곳', '브런치카페', '저녁메뉴추천', '점심메뉴추천',
  '오늘의메뉴', '인기메뉴', '놀거리', '볼거리', '데이트코스', '가볼만한곳추천',
  '국내여행', '해외여행', '호캉스', '펜션', '스킨케어', '선크림', '쿠션', '틴트',
  '청소', '자취', '다이소', '가계부', '신용카드', '컴퓨터', '노트북', '스마트폰',
  '재테크', '주식', '비트코인', '부업', '날씨', '지도', '지하철', '버스', '기차',
  '영화', '음악', '드라마', '유튜브', '넷플릭스', '게임', '웹툰', '소설', '책', '뉴스',
]);

// 2. 구체적인 특정 지역 / 명소 / 핫플레이스 사전
export const SPECIFIC_REGIONS_PLACES = [
  // 서울/수도권 핫스팟
  '강남역', '강남', '홍대', '성수', '성수동', '용산', '용산아이파크몰', '잠실', '잠실롯데월드몰',
  '더현대', '여의도', '종로', '을지로', '명동', '익선동', '문래', '망원', '연남동', '압구정',
  '신사', '가로수길', '이태원', '한남동', '동대문', '건대', '신촌', '혜화', '대학로', '사당',
  '영등포', '코엑스', '삼성역', '인사동', '북촌', '서촌', '송파', '송리단길', '노원', '판교',
  '수원', '행궁동', '광교', '일산', '분당', '인천', '송도', '부평', '구월동', '가평', '양평',
  '남양주', '포천', '안산', '부천', '안양', '평택', '화성', '동탄', '김포', '파주',
  // 전국 주요 여행지 및 명소
  '속초', '속초중앙시장', '강릉', '안목해변', '경포대', '정동진', '양양', '춘천', '평창', '동해',
  '삼척', '부산', '해운대', '광안리', '서면', '남포동', '영도', '기장', '제주', '제주도',
  '서귀포', '애월', '협재', '함덕', '성산', '우도', '중문', '대구', '동성로', '수성못',
  '대전', '성심당', '유성', '전주', '한옥마을', '경주', '황리단길', '보문단지', '포항', '영일대',
  '여수', '돌산', '오동도', '순천', '순천만', '통영', '거제', '거제도', '바람의언덕', '남해',
  '울산', '단양', '태안', '안면도', '보령', '대천', '군산', '목포', '안동', '담양',
  // 해외 인기 여행지
  '도쿄', '오사카', '후쿠오카', '교토', '삿포로', '오키나와', '유후인', '다낭', '나트랑', '푸꾸옥',
  '하노이', '호치민', '방콕', '치앙마이', '파타야', '발리', '싱가포르', '대만', '타이베이', '가오슝',
  '홍콩', '마카오', '세부', '보라카이', '보홀', '괌', '사이판', '하와이', '파리', '런던',
  '로마', '바르셀로나', '마드리드', '인터라켄', '스위스', '프라하', '비엔나', '부다페스트', '뉴욕',
  '로스앤젤레스', '샌프란시스코', '시드니', '멜버른',
];

// 3. 구체적인 브랜드 / 프랜차이즈 / 플랫폼
export const SPECIFIC_BRANDS_STORES = [
  // F&B / 카페 / 베이커리
  '맥도날드', '스타벅스', '스벅', '아웃백', '버거킹', '맘스터치', '써브웨이', '서브웨이',
  'KFC', '롯데리아', '도미노피자', '피자헛', '파파존스', '교촌치킨', 'BHC', 'BBQ', '굽네',
  '컴포즈커피', '메가커피', '빽다방', '투썸플레이스', '투썸', '이디야', '할리스', '폴바셋',
  '배스킨라빈스', '베스킨', '던킨', '크리스피크림', '노티드', '런던베이글뮤지엄', '런던베이글',
  '성심당', '삼진어묵', '이성당', '삼송빵집', '쉑쉑', '파이브가이즈', '에그슬럿', '하이디라오',
  '애슐리', '애슐리퀸즈', '빕스', '자연별곡', '쿠우쿠우', '명륜진사갈비',
  // 테크 / 가전 / 모바일
  '아이폰', '아이폰16', '아이폰15', '아이폰14', '갤럭시', '갤럭시s25', '갤럭시s24', '갤럭시z플립',
  '갤럭시z폴드', '아이패드', '애플워치', '에어팟', '맥북', '갤럭시탭', '갤럭시버즈', '다이슨',
  '플스5', '닌텐도', '스팀덱', 'LG그램', '삼성전자', '애플',
  // 패션 / 뷰티 / 쇼핑
  '올리브영', '올영', '무신사', '에이블리', '지그재그', '자라', 'ZARA', '유니클로', '스파오',
  '탑텐', '코스', 'COS', '아르켓', '나이키', '아디다스', '뉴발란스', '아식스', '살로몬',
  '젠틀몬스터', '탬버린즈', '조말론', '이솝', '바이레도', '롬앤', '클리오', '페리페라',
  '헤라', '설화수', '라네즈', '이니스프리', '토리든', '아누아', '조선미녀', '넘버즈인',
  '라운드랩', '달바', '메디힐', '아비브', '스킨푸드',
  // 생활 / 금융 / 유통
  '다이소', '코스트코', '트레이더스', '이마트', '홈플러스', '롯데마트', '쿠팡', '네이버페이',
  '카카오페이', '토스', '토스뱅크', '케이뱅크', '카카오뱅크', '국민은행', '신한은행', '우리은행',
  '하나은행', '현대카드', '신한카드', '삼성카드',
];

// 4. 구체적인 상품 / 메뉴 / 대상 / 상황 수식어
export const SPECIFIC_PRODUCTS_MODIFIERS = [
  '감튀 홀더', '감튀홀더', '시루', '망고시루', '딸기시루', '런치메뉴', '신메뉴', '시즌메뉴',
  '블랙글레이즈드라떼', '글레이즈드라떼', '슈크림라떼', '자허블', '허니콤보', '레드콤보',
  '뿌링클', '황금올리브', '투움바', '토마호크', '1박2일', '2박3일', '3박4일', '당일치기',
  '뚜벅이', '아이와', '아이랑', '부모님과', '커플', '혼자', '자취생', '신생아', '사회초년생', '직장인',
  '2026', '2025', '자급제', '사전예약', '웨이팅', '오픈런', '주차장', '할인쿠폰', '면세점',
  '수면교육', '이유식', '돌잔치', '환갑', '상견례', '청첩장', '체크리스트', '준비물',
  '김치찌개', '된장찌개', '제육볶음', '미역국', '닭볶음탕', '오징어볶음', '김치볶음밥', '계란찜',
  '오이무침', '감자조림', '진미채볶음', '두부조림', '어묵볶음', '떡볶이', '파스타', '카레',
  '비타민', '유산균', '마그네슘', '오메가3', '밀크씨슬', '루테인', '글루타치온', '코엔자임', '아르기닌',
  '혈당', '혈압', '콜레스테롤', '역류성식도염', '거북목', '허리통증', '불면증', '대상포진', '지방간',
  '슬랙스', '와이드팬츠', '트렌치코트', '원피스', '스니커즈', '하객룩', '출근룩', '데일리룩', '꾸안꾸',
  '스킨케어', '선크림', '수분앰플', '수분크림', '클렌징폼', '세럼', '레티놀', '쿠션팩트', '립틴트',
  '로봇청소기', '공기청정기', '식기세척기', '음식물처리기', '커피머신', '제습기', '스팀다리미', '빔프로젝터',
  '거실', '침실', '베란다', '욕실', '원룸', '아파트', '홈카페', '플랜테리어', '모듈가구', '암막커튼',
  '강아지', '고양이', '반려견', '반려묘', '관절', '슬개골', '배변패드', '스크래쳐', '사료', '간식',
];

// 5. 블로그 포스팅 의도 및 목적어 패턴
export const INTENT_PURPOSE_WORDS = [
  '추천', '비교', '후기', '방법', '꿀팁', '팁', '코스', '일정', '준비물', '가격', '비용',
  '순위', '장단점', '사용법', '하는법', '정리', '가이드', '주의점', '차이점', '조건', '신청방법',
  '혜택', '예약', '할인', '리뷰', '내돈내산', '솔직후기', '총정리', '선택기준', '베스트',
  'BEST', '시간표', '위치', '주차', '메뉴', '분위기', '가볼만한곳', '데이트코스',
  '체크리스트', '체험', '후기모음', '솔직리뷰', '레시피', '만드는법', '만들기', '끓이는법',
  '황금레시피', '요리법', '맛있게', '식단표', '밑반찬', '효능', '부작용', '복용법',
  '복용시간', '고르는법', '증상', '스트레칭', '운동', '교정', '낮추는방법', '낮추는법', '극복',
  '완화', '초기증상', '코디', '코디추천', '스타일링', '루틴', '관리', '진정케어',
  '피부장벽', '청소법', '정리정돈', '셀프시공', '리모델링', '인테리어', '꾸미기', '노하우', '제거', '부업',
  '수익', '절세', '금리비교', '모으기', '풍차돌리기', '환전팁', '영양제', '용품', '예방', '늘리기',
];

// 6. 시즌/계절별 키워드 사전
export const SUMMER_WORDS = ['여름', '휴가', '물놀이', '계곡', '해수욕장', '수영장', '워터파크', '선크림', '에어컨', '선풍기', '냉면', '삼계탕', '빙수', '다이어트', '장마', '태풍', '모기'];
export const AUTUMN_WORDS = ['가을', '단풍', '추석', '명절', '환절기', '트렌치코트', '자켓', '니트', '개강', '신학기', '캠핑', '글램핑', '등산', '억새', '코스모스'];
export const WINTER_WORDS = ['겨울', '스키', '스노우보드', '패딩', '코트', '목도리', '방한', '난로', '보일러', '김장', '크리스마스', '연말', '해돋이', '새해', '눈꽃', '붕어빵', '호빵'];
export const SPRING_WORDS = ['봄', '벚꽃', '개화', '입학', '화이트데이', '발렌타인', '꽃놀이', '피크닉', '자전거', '황사', '미세먼지', '봄꽃', '진달래', '튤립'];

/**
 * 키워드 텍스트 정규화 (공백/특수문자 제거 소문자)
 */
export function normalizeKeywordForComparison(keyword: string): string {
  if (!keyword) return '';
  return keyword.toLowerCase().replace(/[\s\-_.,/·~!@#$%^&*()]+/g, '').trim();
}

/**
 * 1. 범용 키워드 감점 점수 계산 (0 ~ 100)
 * - '맛집', '카페', '내근처맛집', '근처가볼만한곳' 등은 높은 감점 (70~95점)
 * - 단, 특정 장소나 브랜드와 결합된 경우('강남역맛집', '아웃백 런치메뉴', '도쿄 겨울 여행지')는 감점 0점!
 * - 목적어/의도 접미사 결합 키워드('김치찌개맛있게끓이는법', '종합비타민추천', '데일리룩코디')는 감점 0~10점
 */
export function calculateGenericPenalty(keyword: string): { penalty: number; reason?: string } {
  if (!keyword || typeof keyword !== 'string') {
    return { penalty: 100, reason: '키워드가 비어있음' };
  }

  const clean = keyword.trim();
  const normalized = normalizeKeywordForComparison(clean);
  const tokens = clean.split(/\s+/).filter(Boolean);

  // 1-1. 완전 일치 단독 범용어 검사
  if (STANDALONE_GENERIC_WORDS.has(clean) || STANDALONE_GENERIC_WORDS.has(normalized)) {
    return { penalty: 95, reason: `단독 범용 키워드 ('${clean}')` };
  }

  // 1-2. '내근처' / '근처' 접두어 단독 결합 (구체적 지명 없음)
  if (
    normalized.startsWith('내근처') ||
    normalized.startsWith('근처') ||
    normalized === '저녁메뉴추천' ||
    normalized === '점심메뉴추천' ||
    normalized === '오늘의메뉴' ||
    normalized === '브런치카페'
  ) {
    // 특정 지명/브랜드가 포함되어 있는지 확인
    const hasSpecificEntity =
      SPECIFIC_REGIONS_PLACES.some((r) => clean.includes(r) || normalized.includes(normalizeKeywordForComparison(r))) ||
      SPECIFIC_BRANDS_STORES.some((b) => clean.includes(b) || normalized.includes(normalizeKeywordForComparison(b)));

    if (!hasSpecificEntity) {
      return { penalty: 85, reason: `위치/대상 불명확한 범용 탐색어 ('${clean}')` };
    }
  }

  // 1-3. 단 1개 토큰이며 길이가 2 이하인 단어
  if (tokens.length === 1 && clean.length <= 2) {
    return { penalty: 90, reason: `2글자 이하 단독 단어 ('${clean}')` };
  }

  // 1-4. 특정 장소나 브랜드 또는 구체적 제품/메뉴가 포함되어 있다면 감점 0
  const hasSpecificRegion = SPECIFIC_REGIONS_PLACES.some(
    (r) => clean.includes(r) || normalized.includes(normalizeKeywordForComparison(r))
  );
  const hasSpecificBrand = SPECIFIC_BRANDS_STORES.some(
    (b) => clean.includes(b) || normalized.includes(normalizeKeywordForComparison(b))
  );
  const hasSpecificProduct = SPECIFIC_PRODUCTS_MODIFIERS.some(
    (p) => clean.includes(p) || normalized.includes(normalizeKeywordForComparison(p))
  );

  if (hasSpecificRegion || hasSpecificBrand || hasSpecificProduct) {
    return { penalty: 0 };
  }

  // 1-5. 목적어/의도 패턴이 포함되어 있는 실전 검색어 (예: '김치찌개맛있게끓이는법', '종합비타민추천')
  const hasPurpose = INTENT_PURPOSE_WORDS.some((p) => clean.includes(p));
  const hasSeason = [...SUMMER_WORDS, ...AUTUMN_WORDS, ...WINTER_WORDS, ...SPRING_WORDS].some((w) => clean.includes(w));

  if (hasPurpose) {
    if (clean.length >= 5 || tokens.length >= 2) {
      return { penalty: 0 };
    }
    return { penalty: 10, reason: '목적 결합형 키워드' };
  }

  if (tokens.length >= 2 && hasSeason) {
    return { penalty: 10, reason: '시즌 확장형 소재' };
  }

  if (tokens.length >= 2 && clean.length >= 5) {
    return { penalty: 15, reason: '다단어 확장형 소재' };
  }

  if (clean.length >= 7) {
    return { penalty: 20, reason: '구체적 긴 단어' };
  }

  // 그 외 일반 모호 단어
  return { penalty: 50, reason: '구체적 대상 불명확' };
}

/**
 * 2. 키워드 구체성 점수 계산 (specificityScore: 0 ~ 100)
 * - 특정 지역/장소, 특정 브랜드/매장, 특정 상품/메뉴/모델, 특정 타겟/시즌 등을 종합 판정
 */
export function calculateSpecificityScore(keyword: string, category?: string): number {
  if (!keyword) return 0;
  const clean = keyword.trim();
  const normalized = normalizeKeywordForComparison(clean);
  const tokens = clean.split(/\s+/).filter(Boolean);

  let score = 20;

  // 2-1. 특정 지역/장소 포함 여부
  const matchedRegion = SPECIFIC_REGIONS_PLACES.find(
    (r) => clean.includes(r) || normalized.includes(normalizeKeywordForComparison(r))
  );
  if (matchedRegion) {
    score += matchedRegion.length >= 4 ? 40 : 30;
  }

  // 2-2. 특정 브랜드/프랜차이즈 포함 여부
  const matchedBrand = SPECIFIC_BRANDS_STORES.find(
    (b) => clean.includes(b) || normalized.includes(normalizeKeywordForComparison(b))
  );
  if (matchedBrand) {
    score += 35;
  }

  // 2-3. 특정 상품/메뉴/세부 모델/수식어 포함 여부
  const matchedProduct = SPECIFIC_PRODUCTS_MODIFIERS.find(
    (p) => clean.includes(p) || normalized.includes(normalizeKeywordForComparison(p))
  );
  if (matchedProduct) {
    score += 30;
  }

  // 2-3.5 목적어/의도 패턴 포함 여부
  const matchedPurpose = INTENT_PURPOSE_WORDS.find(
    (p) => clean.includes(p) || normalized.includes(normalizeKeywordForComparison(p))
  );
  if (matchedPurpose) {
    score += 25;
  }

  // 2-4. 토큰 구조 및 길이 보너스
  if (tokens.length >= 3) {
    score += 15;
  } else if (tokens.length === 2) {
    score += 10;
  }

  if (clean.length >= 6) {
    score += 10;
  }

  // 2-5. 단독 범용어 감점
  if (STANDALONE_GENERIC_WORDS.has(clean) || (tokens.length === 1 && clean.length <= 2)) {
    score = Math.min(score, 15);
  }

  return Math.min(100, Math.max(5, score));
}

/**
 * 3. 블로그 포스팅 소재 적합성 점수 계산 (blogTopicScore: 0 ~ 100)
 * - 제목 확장성, 독립적 글 주제 가능성, 후기/정보/비교/가이드 확장성 평가
 */
export function calculateBlogTopicScore(
  keyword: string,
  category?: string,
  specificityScore: number = 50
): number {
  if (!keyword) return 0;
  const clean = keyword.trim();
  const tokens = clean.split(/\s+/).filter(Boolean);

  let score = 30;

  // 3-1. 목적어/의도 접미사 존재 여부
  let matchedPurposes = 0;
  for (const pw of INTENT_PURPOSE_WORDS) {
    if (clean.includes(pw)) {
      matchedPurposes++;
    }
  }

  if (matchedPurposes >= 2) {
    score += 35;
  } else if (matchedPurposes === 1) {
    score += 25;
  }

  // 3-2. 구체성 점수 연동 가산
  score += Math.round(specificityScore * 0.35);

  // 3-3. 다단어 및 문맥 구조
  if (tokens.length >= 2) {
    score += 15;
  }

  // 3-4. 단독 광범위 단어 패널티
  if (STANDALONE_GENERIC_WORDS.has(clean)) {
    score = Math.min(score, 20);
  }

  return Math.min(100, Math.max(10, score));
}

/**
 * 4. 시즌성 점수 계산 (seasonalityScore: 0 ~ 100)
 * - 현재 월(1~12) 및 다가오는 시즌과의 연관도를 동적 평가
 */
export function calculateSeasonalityScore(keyword: string, customMonth?: number): number {
  if (!keyword) return 50;
  const clean = keyword.trim();
  const month = customMonth || new Date().getMonth() + 1;

  const matchesSummer = SUMMER_WORDS.some((w) => clean.includes(w));
  const matchesAutumn = AUTUMN_WORDS.some((w) => clean.includes(w));
  const matchesWinter = WINTER_WORDS.some((w) => clean.includes(w));
  const matchesSpring = SPRING_WORDS.some((w) => clean.includes(w));

  // 봄 (3, 4, 5월)
  if (month >= 3 && month <= 5) {
    if (matchesSpring) return 95;
    if (matchesSummer) return 75; // 여름 미리 준비
    if (matchesWinter) return 20; // 지난 시즌
    if (matchesAutumn) return 30;
  }
  // 여름 (6, 7, 8월)
  else if (month >= 6 && month <= 8) {
    if (matchesSummer) return 95;
    if (matchesAutumn) return 75; // 가을/추석 미리 준비
    if (matchesSpring) return 30;
    if (matchesWinter) return 15;
  }
  // 가을 (9, 10, 11월)
  else if (month >= 9 && month <= 11) {
    if (matchesAutumn) return 95;
    if (matchesWinter) return 80; // 겨울/연말 미리 준비
    if (matchesSummer) return 25;
    if (matchesSpring) return 20;
  }
  // 겨울 (12, 1, 2월)
  else {
    if (matchesWinter) return 95;
    if (matchesSpring) return 75; // 봄/신학기 미리 준비
    if (matchesSummer) return 15;
    if (matchesAutumn) return 25;
  }

  // 상시 스테디 정보성 키워드
  return 60;
}

/**
 * 5. 최근 블로그 활용 활성도 점수 계산 (recentBlogActivity: 0 ~ 100)
 */
export function calculateRecentBlogActivity(
  keyword: string,
  documentCount?: number,
  searchVolume?: number
): number {
  if (!keyword) return 0;
  const clean = keyword.trim();

  // 만약 실제 네이버 블로그 검색 문서수와 검색량이 있는 경우
  if (typeof documentCount === 'number' && documentCount > 0) {
    // 문서수가 적정 범위(500 ~ 300,000건)이고 검색량이 존재하면 블로그 소재로 매우 활발히 소비됨
    if (documentCount >= 100 && documentCount <= 500000) {
      return 85;
    }
    if (documentCount > 500000) {
      return 70; // 대형 경쟁 키워드
    }
    return 60; // 극소수 문서
  }

  // 결정론적 휴리스틱 (문서수 데이터가 없을 때)
  const tokens = clean.split(/\s+/).filter(Boolean);
  if (tokens.length >= 2 || clean.length >= 5) {
    return 75;
  }
  return 50;
}

/**
 * 6. 키워드 3단계 분류 판정
 * ① immediate_post: 즉시 포스팅 추천 (구체성 높음, 블로그 적합도 높음, 감점 낮음)
 * ② expandable_topic: 확장형 소재 (다소 범용적이지만 제목으로 확장 가능)
 * ③ trend_reference: 참고용 트렌드 (다소 추상적이거나 포스팅 소재로 부족)
 */
export function classifyKeyword(
  specificityScore: number,
  blogTopicScore: number,
  genericPenalty: number
): {
  classification: 'immediate_post' | 'expandable_topic' | 'trend_reference';
  label: string;
} {
  if (genericPenalty >= 70 || specificityScore < 30 || blogTopicScore < 35) {
    return {
      classification: 'trend_reference',
      label: '참고용 트렌드',
    };
  }

  if (specificityScore >= 60 && blogTopicScore >= 55 && genericPenalty <= 20) {
    return {
      classification: 'immediate_post',
      label: '즉시 포스팅 추천',
    };
  }

  if (blogTopicScore >= 45 && genericPenalty <= 45) {
    return {
      classification: 'expandable_topic',
      label: '확장형 소재',
    };
  }

  return {
    classification: 'trend_reference',
    label: '참고용 트렌드',
  };
}

/**
 * 키워드의 발행 타이밍(🔥지금쓰기 / 🌱미리준비 / 📌스테디)을 판정합니다.
 */
function determineTimingTag(
  clean: string,
  category?: string
): { tag: 'now' | 'prepare' | 'steady'; label: string } {
  const currentMonth = new Date().getMonth() + 1; // 1 ~ 12

  // 여름철 (6, 7, 8월)
  if (currentMonth >= 6 && currentMonth <= 8) {
    if (SUMMER_WORDS.some((w) => clean.includes(w)) || clean.includes('휴가') || clean.includes('주말')) {
      return { tag: 'now', label: '🔥 지금 쓰기' };
    }
    if (AUTUMN_WORDS.some((w) => clean.includes(w)) || clean.includes('추석') || clean.includes('가을')) {
      return { tag: 'prepare', label: '🌱 미리 준비' };
    }
  }

  // 가을철 (9, 10, 11월)
  if (currentMonth >= 9 && currentMonth <= 11) {
    if (AUTUMN_WORDS.some((w) => clean.includes(w))) {
      return { tag: 'now', label: '🔥 지금 쓰기' };
    }
    if (WINTER_WORDS.some((w) => clean.includes(w)) || clean.includes('크리스마스') || clean.includes('연말')) {
      return { tag: 'prepare', label: '🌱 미리 준비' };
    }
  }

  // 겨울철 (12, 1, 2월)
  if (currentMonth === 12 || currentMonth <= 2) {
    if (WINTER_WORDS.some((w) => clean.includes(w)) || clean.includes('새해')) {
      return { tag: 'now', label: '🔥 지금 쓰기' };
    }
    if (SPRING_WORDS.some((w) => clean.includes(w)) || clean.includes('입학') || clean.includes('봄')) {
      return { tag: 'prepare', label: '🌱 미리 준비' };
    }
  }

  // 봄철 (3, 4, 5월)
  if (currentMonth >= 3 && currentMonth <= 5) {
    if (SPRING_WORDS.some((w) => clean.includes(w))) {
      return { tag: 'now', label: '🔥 지금 쓰기' };
    }
    if (SUMMER_WORDS.some((w) => clean.includes(w)) || clean.includes('휴가') || clean.includes('다이어트')) {
      return { tag: 'prepare', label: '🌱 미리 준비' };
    }
  }

  if (clean.includes('신청') || clean.includes('방법') || clean.includes('사용법') || clean.includes('비용') || clean.includes('가격') || clean.includes('자격') || clean.includes('서류') || clean.includes('정리') || clean.includes('레시피')) {
    return { tag: 'steady', label: '📌 스테디' };
  }

  if (clean.includes('주말') || clean.includes('당일치기') || clean.includes('데이트') || clean.includes('신작') || clean.includes('오픈') || clean.includes('할인')) {
    return { tag: 'now', label: '🔥 지금 쓰기' };
  }

  return { tag: 'steady', label: '📌 스테디' };
}

/**
 * 키워드가 '포스팅 활용형'인지 정밀 판별하고 품질 점수 및 검색 의도를 평가합니다.
 */
export function evaluatePostingKeyword(
  rawKeyword: string,
  category?: string,
  options?: {
    documentCount?: number;
    searchVolume?: number;
    customMonth?: number;
  }
): KeywordEvaluation {
  if (!rawKeyword || typeof rawKeyword !== 'string') {
    return {
      isPostingUsable: false,
      usabilityScore: 1,
      intentCategory: '모호/단순검색',
      intentDescription: '검색 의도가 불명확합니다.',
      combinationType: '단독어',
      timingTag: 'steady',
      timingTagLabel: '📌 스테디',
      recommendReason: '키워드가 비어있습니다.',
      contentStyle: '정보/가이드형',
      postingTitleHint: '포스팅 제목을 입력하세요.',
      suggestedTitles: [],
      suggestedOutlines: [],
      reason: '키워드가 비어있습니다.',
      specificityScore: 0,
      blogTopicScore: 0,
      recentBlogActivity: 0,
      seasonalityScore: 50,
      genericPenalty: 100,
      classification: 'trend_reference',
      classificationLabel: '참고용 트렌드',
      excludedReason: '키워드가 비어있음',
    };
  }

  const clean = rawKeyword.trim();
  const tokens = clean.split(/\s+/).filter(Boolean);

  // 1. 범용 키워드 감점 계산
  const { penalty: genericPenalty, reason: penaltyReason } = calculateGenericPenalty(clean);

  // 2. 구체성 점수 계산 (0 ~ 100)
  const specificityScore = calculateSpecificityScore(clean, category);

  // 3. 블로그 포스팅 소재 적합성 점수 계산 (0 ~ 100)
  const blogTopicScore = calculateBlogTopicScore(clean, category, specificityScore);

  // 4. 시즌성 점수 계산 (0 ~ 100)
  const seasonalityScore = calculateSeasonalityScore(clean, options?.customMonth);

  // 5. 최근 블로그 활용 활성도 (0 ~ 100)
  const recentBlogActivity = calculateRecentBlogActivity(clean, options?.documentCount, options?.searchVolume);

  // 6. 키워드 3단계 분류
  const { classification, label: classificationLabel } = classifyKeyword(
    specificityScore,
    blogTopicScore,
    genericPenalty
  );

  // 7. 검색 의도 및 카테고리별 세부 튜닝
  let intentCat = '정보/가이드형 탐색';
  let comboType = '[주제] + [정보/가이드]';
  let contentStyle = '정보/가이드형';
  let recommendReason = '검색자의 실질적인 궁금증을 해결해주는 정보성 소재입니다.';

  const isMultiToken = tokens.length >= 2;
  const hasSpecificRegion = SPECIFIC_REGIONS_PLACES.some((r) => clean.includes(r));
  const hasSpecificBrand = SPECIFIC_BRANDS_STORES.some((b) => clean.includes(b));
  const hasPurpose = INTENT_PURPOSE_WORDS.some((p) => clean.includes(p));

  if (category === '맛집' || clean.includes('맛집') || clean.includes('카페') || clean.includes('식당') || clean.includes('메뉴')) {
    intentCat = '맛집/미식 탐색';
    comboType = hasSpecificRegion || hasSpecificBrand ? '[지역/브랜드] + [맛집/메뉴]' : '[메뉴/식당] + [후기/추천]';
    contentStyle = '경험/후기형';
    recommendReason = '실제 방문 사진과 메뉴 후기로 체류시간과 네이버 플레이스 연동 클릭률이 높은 소재입니다.';
  } else if (category === '국내여행' || category === '해외여행' || clean.includes('여행') || clean.includes('코스') || clean.includes('숙소') || clean.includes('호텔')) {
    intentCat = '여행/일정 기획';
    comboType = hasSpecificRegion ? '[지역/명소] + [여행/일정/코스]' : '[테마] + [여행/숙소]';
    contentStyle = '경험/후기형';
    recommendReason = '방문 일정과 이동 동선, 추천 스팟이 명확하여 여행을 계획 중인 독자 유입이 활발합니다.';
  } else if (category === '뷰티' || clean.includes('피부') || clean.includes('화장품') || clean.includes('추천템')) {
    intentCat = '뷰티/케어 추천';
    comboType = hasSpecificBrand ? '[브랜드/제품] + [비교/사용법]' : '[피부타입] + [제품/추천]';
    contentStyle = '비교/큐레이션형';
    recommendReason = '실제 사용 전후 비포/애프터와 성분 비교로 구매 전환율과 공감도가 높습니다.';
  } else if (category === 'IT/테크' || clean.includes('기능') || clean.includes('설정') || clean.includes('사용법')) {
    intentCat = 'IT/활용 꿀팁';
    comboType = hasSpecificBrand ? '[기기/브랜드] + [활용법/설정]' : '[기기/앱] + [꿀팁]';
    contentStyle = '정보/가이드형';
    recommendReason = '단계별 캡처 이미지와 설정 가이드로 이탈률이 낮고 북마크/스크랩에 유리한 꿀팁 소재입니다.';
  } else if (category === '생활/편의' || clean.includes('청소') || clean.includes('살림') || clean.includes('자취')) {
    intentCat = '생활/살림 노하우';
    comboType = '[문제상황] + [해결법/추천템]';
    contentStyle = '정보/가이드형';
    recommendReason = '일상 속 불편함을 즉시 해결해주는 실생활 노하우로 공유와 체류시간이 우수합니다.';
  } else if (category === '재테크' || clean.includes('부업') || clean.includes('금리') || clean.includes('절세')) {
    intentCat = '재테크/수익화';
    comboType = '[금융/부업] + [조건/비교/방법]';
    contentStyle = '비교/큐레이션형';
    recommendReason = '실제 수익 및 절세 수치, 자격 조건을 명확히 전달하여 신뢰도와 체류시간이 높은 고단가 소재입니다.';
  } else if (category === '패션' || clean.includes('코디') || clean.includes('룩')) {
    intentCat = '패션/스타일링';
    comboType = '[상황/계절] + [아이템/코디]';
    contentStyle = '비교/큐레이션형';
    recommendReason = '체형별, 계절별 착용 사진과 스타일링 팁으로 2030 독자의 반응이 뜨거운 소재입니다.';
  }

  // 8. 기존 호환용 usabilityScore (1 ~ 5점)
  let usabilityScore = 2;
  if (genericPenalty >= 70) {
    usabilityScore = 1;
  } else if (classification === 'immediate_post') {
    usabilityScore = specificityScore >= 80 ? 5 : 4;
  } else if (classification === 'expandable_topic') {
    usabilityScore = 3;
  } else {
    usabilityScore = 2;
  }

  const isPostingUsable = classification === 'immediate_post' || classification === 'expandable_topic';
  const timing = determineTimingTag(clean, category);

  // 키워드 도메인 판별 (교통/예매/할인 vs 여행 vs 쇼핑/제품 vs 맛집 vs IT/테크 vs 정보/절차 vs 패션)
  const isTransportDiscountDomain =
    /ktx|srt|코레일|기차|열차|항공권|비행기|고속버스|승차권|예매|티켓|패스|할인|환불|취소수수료|동반석|청춘|특가/i.test(clean);
  const isTravelDomain = category === '국내여행' || category === '해외여행' ||
    /여행|가볼만한곳|코스|숙소|호텔|펜션|글램핑|캠핑|드라이브|명소|나들이|투어|단풍|억새|휴가지/i.test(clean);
  const isShoppingDomain = category === '생활/편의' || category === '뷰티' ||
    /다이소|올리브영|이케아|코스트코|쿠팡|추천템|꿀템|살림템|자취템|가성비템|아이템|생활용품|주방용품|화장품|선물/i.test(clean);
  const isFoodDomain = category === '맛집' ||
    /맛집|카페|식당|베이커리|디저트|고기집|삼겹살|파스타|오마카세|메뉴|술집|브런치/i.test(clean);
  const isTechDomain = category === 'IT/테크' ||
    /스마트폰|갤럭시|아이폰|노트북|모니터|태블릿|이어폰|워치|충전기|가전|청소기|스펙|기능|설정/i.test(clean);
  const isInfoDomain = category === '재테크' ||
    /지원금|신청|자격|서류|일정|환급|세금|청약|적금|대출|연말정산|취소|환불|규정|방법|절차/i.test(clean);
  const isFashionDomain = category === '패션' ||
    /코디|룩|패션|착장|데일리룩|원피스|셔츠|신발|운동화/i.test(clean);

  // 실전 블로그 추천 제목 예시 생성 (도메인 맞춤형 명사 조합, 고정 템플릿 배제)
  let suggestedTitles: string[] = [];
  let suggestedOutlines: string[] = [];

  if (isTransportDiscountDomain) {
    suggestedTitles = [
      `${clean} 대상별 할인 혜택 조건 및 예매 방법`,
      `${clean} 청년·청소년·동반석 할인율과 시간대별 팁`,
      `${clean} 코레일톡 예약 시 주의사항과 실전 절차`,
    ];
    suggestedOutlines = [
      `1. ${clean} 주요 할인 대상 및 자격 조건`,
      `2. 시간대별 할인율 및 혜택 비교`,
      `3. 코레일 앱 단계별 예매 방법`,
      `4. 취소 수수료 및 예매 시 주의사항`,
    ];
  } else if (isTravelDomain) {
    const isAutumn = /가을|10월|11월|단풍|억새/i.test(clean);
    suggestedTitles = [
      isAutumn ? `${clean} 10월 단풍 명소부터 드라이브 코스까지` : `${clean} 당일치기 코스 및 필수 방문 명소`,
      `${clean} 1박2일 가족 나들이 가볼만한곳 및 일정 팁`,
      `${clean} 사진 찍기 좋은 스팟과 주차·방문 안내`,
    ];
    suggestedOutlines = [
      `1. ${clean} 시즌 핵심 포인트 및 방문 시기`,
      `2. 주요 추천 명소 및 필수 코스 3곳`,
      `3. 상황별(가족·연인) 맞춤 동선`,
      `4. 주차 및 방문 시 주의사항`,
    ];
  } else if (isShoppingDomain) {
    suggestedTitles = [
      `${clean} 가성비 인기 제품 및 구매 전 체크할 점`,
      `${clean} 카테고리별 추천 상품과 가격대별 비교`,
      `${clean} 실속형 인기 아이템 특징 및 선택 기준`,
    ];
    suggestedOutlines = [
      `1. ${clean} 주요 선택 기준 및 가격대`,
      `2. 실사용 만족도 높은 인기 아이템 3~5종`,
      `3. 카테고리별 특징 및 장단점 비교`,
      `4. 구매 전 확인해야 할 체크포인트`,
    ];
  } else if (isFoodDomain) {
    suggestedTitles = [
      `${clean} 대표 시그니처 메뉴와 솔직 맛 평가`,
      `${clean} 웨이팅 팁 및 분위기 좋은 모임 장소`,
      `${clean} 가성비 세트 메뉴 구성과 주차 정보`,
    ];
    suggestedOutlines = [
      `1. ${clean} 매장 위치 및 기본 정보`,
      `2. 대표 시그니처 메뉴 분석`,
      `3. 실제 맛과 가성비 장단점`,
      `4. 웨이팅 꿀팁 및 추천 방문 시간`,
    ];
  } else if (isTechDomain) {
    suggestedTitles = [
      `${clean} 주요 스펙 및 실사용 장단점 비교`,
      `${clean} 가성비 모델 선택 기준과 필수 기능`,
      `${clean} 실사용자가 체감한 핵심 포인트 요약`,
    ];
    suggestedOutlines = [
      `1. ${clean} 핵심 스펙 및 주요 사양`,
      `2. 주요 기능 및 실사용 장점`,
      `3. 아쉬운 점과 모델별 비교`,
      `4. 예산별 맞춤 추천 대상`,
    ];
  } else if (isInfoDomain) {
    suggestedTitles = [
      `${clean} 신청 자격 및 필수 제출 서류 목록`,
      `${clean} 단계별 신청 방법과 지급 일정 안내`,
      `${clean} 주의해야 할 예외 조건 및 실전 확인 팁`,
    ];
    suggestedOutlines = [
      `1. ${clean} 지원 대상 및 자격 조건`,
      `2. 신청 기간 및 세부 절차`,
      `3. 필수 구비 서류 및 주의사항`,
      `4. 자주 묻는 질문 및 실전 확인 팁`,
    ];
  } else if (isFashionDomain) {
    suggestedTitles = [
      `${clean} 계절별 인기 아이템 및 스타일링 코디`,
      `${clean} 체형별 어울리는 핏과 가성비 브랜드 비교`,
      `${clean} 데일리룩 연출 팁과 활용법`,
    ];
    suggestedOutlines = [
      `1. ${clean} 트렌드 및 스타일링 포인트`,
      `2. 추천 아이템 및 카테고리별 매치`,
      `3. 체형 및 상황별 코디 가이드`,
      `4. 구매 시 고려할 팁`,
    ];
  } else {
    suggestedTitles = [
      `${clean} 필수 확인 조건 및 단계별 진행 방법`,
      `${clean} 선택 시 고려할 핵심 기준과 주의사항`,
      `${clean} 상황별 맞춤 비교와 실전 활용법`,
    ];
    suggestedOutlines = [
      `1. ${clean} 핵심 정의 및 주요 배경`,
      `2. 상세 조건 및 단계별 진행 절차`,
      `3. 상황별 맞춤 비교 및 선택 기준`,
      `4. 주의해야 할 사항 및 실전 팁`,
    ];
  }

  return {
    isPostingUsable,
    usabilityScore,
    intentCategory: intentCat,
    intentDescription: hasPurpose
      ? `'${clean}'에 대한 목적형 검색 의도`
      : `${intentCat}을 위한 실질적 검색 의도`,
    combinationType: comboType,
    timingTag: timing.tag,
    timingTagLabel: timing.label,
    recommendReason,
    contentStyle,
    postingTitleHint: `${clean} 핵심 정보 및 실전 팁`,
    suggestedTitles,
    suggestedOutlines,
    reason: penaltyReason,
    specificityScore,
    blogTopicScore,
    recentBlogActivity,
    seasonalityScore,
    genericPenalty,
    classification,
    classificationLabel,
    excludedReason: genericPenalty >= 70 ? (penaltyReason || '범용 키워드 감점') : undefined,
  };
}
