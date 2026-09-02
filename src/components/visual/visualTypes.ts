import { CardAspectRatio } from '../seo/CardNewsCardRenderer';

export type VisualSubTab = 'image_match' | 'card_news';

export type InputSourceType = 'ai_draft' | 'direct_input';

export interface VisualDocumentSource {
  id: string;
  title: string;
  content: string; // HTML or rich text
  plainText: string;
  sourceType: InputSourceType;
  sourceSessionId?: string;
  keyword?: string;
  loadedAt: Date;
  wordCount: number;
}

// ----------------------------------------------------
// 1. 본문 이미지 매칭 관련 타입
// ----------------------------------------------------
export type ImageStylePreset = 'auto' | 'photoreal' | 'minimal_illustration' | 'infographic' | 'editorial';

export interface ImageMatchCandidate {
  id: string;
  url: string;
  originalUrl?: string;
  thumbUrl: string;
  alt: string;
  photographer: string;
  photographerUrl?: string;
  unsplashUrl?: string;
  searchQuery?: string;
  source: 'unsplash' | 'ai' | 'custom';
  tags?: string[];
  width?: number;
  height?: number;
  modifications?: {
    cropRatio?: string;
    cropPercent?: number;
    rotationAngle?: string;
    rotationDegrees?: number;
    brightness?: string;
    saturation?: string;
    contrast?: string;
    outputFormat?: string;
    processedAt?: string;
  };
  isAntiDuplicateTransformed?: boolean;
  storageProvider?: 'supabase' | 'server_cache' | 'data_url';
}

export interface InsertedBlogImageInfo {
  imageUrl: string;
  originalUrl?: string;
  thumbnailUrl: string;
  photographer: string;
  unsplashUrl: string;
  searchQuery: string;
  insertionPoint: string;
  relatedParagraph: string;
  slotId: string;
  modifications?: any;
  isAntiDuplicateTransformed?: boolean;
}

export interface ImageSlot {
  id: string;
  positionIndex: number;
  insertionPoint: string;
  relatedParagraph: string;
  subject: string;
  visualDescription: string;
  searchQueries: string[];
  selectedQuery: string;
  reason?: string;
  status: 'pending' | 'searching' | 'ready' | 'selected' | 'no_result';
  candidates: ImageMatchCandidate[];
  selectedImage?: ImageMatchCandidate;
  isInserted?: boolean;
  isTransforming?: boolean;
}

export interface ImageMatchingOptions {
  targetCount: number; // 3, 4, 5, 6, 7
  imageStyle: ImageStylePreset;
  autoRecommend: boolean;
  aspectRatio: '16:9' | '4:3' | '1:1';
}

// ----------------------------------------------------
// 2. 카드뉴스 제작 관련 타입 (콘텐츠 구성 및 편집 & 디자인 템플릿)
// ----------------------------------------------------
export type CardRoleType =
  | 'cover'
  | 'key_point'
  | 'info'
  | 'step'
  | 'comparison'
  | 'tip'
  | 'warning'
  | 'summary'
  | 'cta';

export type CardLayoutVariant =
  | 'cover'
  | 'text_focus'
  | 'image_focus'
  | 'split'
  | 'number_focus'
  | 'comparison'
  | 'quote'
  | 'tip'
  | 'ending';

export type ImproveInstructionType = 'shorter' | 'clearer' | 'highlight' | 'informative' | 'emotional';

export type CardNewsTemplateId = 'editorial' | 'minimal' | 'mood' | 'information' | 'photo_story' | 'cute_pastel';

export type CardNewsCardImageSource = 'none' | 'user_upload' | 'unsplash' | 'ai' | 'no_image';

export type CardNewsImageSourceMode = 'user_upload' | 'unsplash' | 'no_image' | 'ai';

export interface CardNewsContentCard {
  id: string;
  cardNumber: number;
  cardRole: CardRoleType;
  layoutVariant?: CardLayoutVariant;
  title: string;
  subtitle: string;
  body: string;
  emphasis: string[];
  sourceContext: string;
  // Image & contextual attributes
  imageSource?: CardNewsCardImageSource;
  imageUrl?: string;
  imageThumbUrl?: string;
  imageAlt?: string;
  imageCredit?: string;
  searchQuery?: string;
  searchQueries?: string[];
  imagePrompt?: string;
  userUploadedImage?: string;
  isUserEdited?: boolean;
}

export interface CardNewsProjectData {
  id: string;
  sourceType: 'ai_draft' | 'manual';
  sourceContent: string;
  sourceTitle?: string;
  cardCount: number;
  contentType?: string;
  coreTopic?: string;
  selectedTemplate: CardNewsTemplateId;
  imageSourceMode: CardNewsImageSourceMode;
  status: 'draft' | 'content_configured' | 'generated' | 'completed';
  cards: CardNewsContentCard[];
  isConfirmed: boolean;
  createdAt: string;
  confirmedAt?: string;
}

export interface CardNewsTemplateTheme {
  id: CardNewsTemplateId;
  name: string;
  englishName: string;
  tagline: string;
  description: string;
  categoryBadge: string;
  designPhilosophy: string;
  accentColor: string;
  canvasBg: string;
  cardBg: string;
  cardBorder: string;
  titleColor: string;
  textColor: string;
  subTextColor: string;
  chipBg: string;
  chipText: string;
  chipBorder: string;
  badgeBg: string;
  badgeText: string;
  tipBg: string;
  tipText: string;
  tipBorder: string;
  fontFamily: string;
  fontHeading: string;
  cornerStyle: string;
  dividerStyle: string;
  imageTreatment: 'asymmetric_frame' | 'floating_whitespace' | 'full_bleed_overlay' | 'data_split_frame' | 'hero_photo_canvas';
  decorStyle: 'magazine_folio' | 'hairline_dot' | 'frosted_glow' | 'metric_card' | 'cinema_stamp';
  sampleHeadline: string;
  sampleSubtitle: string;
  sampleHighlight: string;
}

export const CARD_NEWS_TEMPLATES: Record<CardNewsTemplateId, CardNewsTemplateTheme> = {
  editorial: {
    id: 'editorial',
    name: '에디토리얼',
    englishName: 'EDITORIAL',
    tagline: '하이엔드 매거진 그리드 & 비대칭 타이포그래피',
    description: '강한 대형 세리프 헤드라인, 비대칭 이미지 분할(40:60), 얇은 구분선과 정밀한 페이지 번호로 완성하는 고급 잡지 지면 스타일',
    categoryBadge: 'MAGAZINE · ISSUE',
    designPhilosophy: '비대칭 레이아웃과 볼드한 타이포그래피로 신뢰감과 권위를 주는 매거진 지면 구성',
    accentColor: '#0f172a',
    canvasBg: 'bg-slate-100',
    cardBg: '#ffffff',
    cardBorder: 'border-slate-400',
    titleColor: '#090d16',
    textColor: '#1e293b',
    subTextColor: '#64748b',
    chipBg: '#0f172a',
    chipText: '#ffffff',
    chipBorder: 'border-slate-900',
    badgeBg: '#f8fafc',
    badgeText: '#0f172a',
    tipBg: '#f1f5f9',
    tipText: '#0f172a',
    tipBorder: 'border-slate-300',
    fontFamily: 'font-sans',
    fontHeading: 'font-serif',
    cornerStyle: 'rounded-none',
    dividerStyle: 'border-slate-300',
    imageTreatment: 'asymmetric_frame',
    decorStyle: 'magazine_folio',
    sampleHeadline: '도쿄 미식 투어: 3일간의 시크릿 다이닝 가이드',
    sampleSubtitle: '현지 셰프가 추천하는 긴자 골목 숨은 노포 5선',
    sampleHighlight: 'ISSUE NO. 24 · SPECIAL FEATURE',
  },
  minimal: {
    id: 'minimal',
    name: '미니멀',
    englishName: 'MINIMAL',
    tagline: '극단적 여백의 미학 & 현대적 산세리프',
    description: '60% 이상의 넓은 네거티브 스페이스, 군더더기 없는 절제된 타이포그래피 계층과 섬세한 포인트 컬러로 전달하는 명료한 현대적 스타일',
    categoryBadge: 'MINIMAL · 01',
    designPhilosophy: '극단적으로 절제된 요소와 여백을 통해 본질적인 텍스트 메시지에 온전히 집중시키는 스위스 모더니즘',
    accentColor: '#0284c7',
    canvasBg: 'bg-slate-50',
    cardBg: '#fafafa',
    cardBorder: 'border-slate-200',
    titleColor: '#0f172a',
    textColor: '#334155',
    subTextColor: '#94a3b8',
    chipBg: '#f0f9ff',
    chipText: '#0284c7',
    chipBorder: 'border-sky-200',
    badgeBg: '#f8fafc',
    badgeText: '#475569',
    tipBg: '#ffffff',
    tipText: '#334155',
    tipBorder: 'border-slate-200',
    fontFamily: 'font-sans',
    fontHeading: 'font-sans',
    cornerStyle: 'rounded-xl',
    dividerStyle: 'border-slate-100',
    imageTreatment: 'floating_whitespace',
    decorStyle: 'hairline_dot',
    sampleHeadline: '여행용 액체류 100ml 반입 규정의 모든 것',
    sampleSubtitle: '기내 수하물 팩킹 시 필수 체크 3가지',
    sampleHighlight: '01  ESSENTIALS',
  },
  mood: {
    id: 'mood',
    name: '무드 (감성)',
    englishName: 'MOOD',
    tagline: '따뜻한 감성 톤 & 인스타그램 오버레이',
    description: '부드러운 웜톤 배색(오트밀/테라코타), 사진 위 반투명 블러 카드(Frosted Glass), 둥근 형태감으로 머무르고 싶은 감성 SNS 스타일',
    categoryBadge: 'LIFESTYLE · MOOD',
    designPhilosophy: '따뜻한 자연광과 블러 글래스모피즘 오버레이로 감성적인 공감대와 편안한 시각적 쉼을 제공',
    accentColor: '#9a3412',
    canvasBg: 'bg-amber-50/50',
    cardBg: '#fffdf9',
    cardBorder: 'border-amber-200/80',
    titleColor: '#292524',
    textColor: '#44403c',
    subTextColor: '#78716c',
    chipBg: '#fef3c7',
    chipText: '#92400e',
    chipBorder: 'border-amber-300',
    badgeBg: '#fdf8f0',
    badgeText: '#9a3412',
    tipBg: '#fffbeb',
    tipText: '#451a03',
    tipBorder: 'border-amber-200',
    fontFamily: 'font-sans',
    fontHeading: 'font-serif',
    cornerStyle: 'rounded-3xl',
    dividerStyle: 'border-amber-100',
    imageTreatment: 'full_bleed_overlay',
    decorStyle: 'frosted_glow',
    sampleHeadline: '조용한 쉼이 머무는 가을 북카페 5선',
    sampleSubtitle: '따뜻한 커피 향과 햇살이 머무는 도심 속 아지트',
    sampleHighlight: 'AUTUMN VIBES · 01',
  },
  information: {
    id: 'information',
    name: '인포메이션',
    englishName: 'INFORMATION',
    tagline: '데이터 중심 인포그래픽 & 명확한 가이드',
    description: '대형 넘버링, 데이터 수치 박스, 단계별 스텝 배지와 장단점 비교 구조로 핵심 정보를 직관적으로 전달하는 실용 가이드 스타일',
    categoryBadge: 'INFO GUIDE · 01',
    designPhilosophy: '구조화된 정보 블록과 수치 중심의 시각화로 한눈에 핵심을 파악할 수 있는 인포그래픽 구조',
    accentColor: '#2563eb',
    canvasBg: 'bg-blue-50/40',
    cardBg: '#ffffff',
    cardBorder: 'border-blue-200',
    titleColor: '#0f172a',
    textColor: '#1e293b',
    subTextColor: '#64748b',
    chipBg: '#eff6ff',
    chipText: '#1d4ed8',
    chipBorder: 'border-blue-300',
    badgeBg: '#1e293b',
    badgeText: '#ffffff',
    tipBg: '#f0fdf4',
    tipText: '#166534',
    tipBorder: 'border-emerald-300',
    fontFamily: 'font-sans',
    fontHeading: 'font-sans',
    cornerStyle: 'rounded-2xl',
    dividerStyle: 'border-slate-200',
    imageTreatment: 'data_split_frame',
    decorStyle: 'metric_card',
    sampleHeadline: '2026 연말정산 핵심 체크리스트 7가지',
    sampleSubtitle: '환급액을 30만원 더 늘리는 세액공제 항목별 기준',
    sampleHighlight: 'STEP 01 · 100ml 이하 기준',
  },
  photo_story: {
    id: 'photo_story',
    name: '포토 스토리',
    englishName: 'PHOTO STORY',
    tagline: '시네마틱 대형 사진 & 몰입형 비주얼',
    description: '카드의 70~100%를 차지하는 풀블리드 사진과 시네마틱 오버레이, 하단 스토리 캡션으로 공간/여행/맛집의 생생함을 극대화하는 스타일',
    categoryBadge: 'PHOTO STORY · VISUAL',
    designPhilosophy: '사진 자체가 스토리텔링의 주인공이 되어 시각적 몰입감을 극대화하는 시네마틱 레이아웃',
    accentColor: '#f59e0b',
    canvasBg: 'bg-slate-900',
    cardBg: '#090d16',
    cardBorder: 'border-slate-800',
    titleColor: '#ffffff',
    textColor: '#f1f5f9',
    subTextColor: '#cbd5e1',
    chipBg: 'rgba(0,0,0,0.6)',
    chipText: '#ffffff',
    chipBorder: 'border-white/20',
    badgeBg: 'rgba(255,255,255,0.15)',
    badgeText: '#ffffff',
    tipBg: 'rgba(15,23,42,0.85)',
    tipText: '#f8fafc',
    tipBorder: 'border-amber-400/40',
    fontFamily: 'font-sans',
    fontHeading: 'font-sans',
    cornerStyle: 'rounded-2xl',
    dividerStyle: 'border-white/10',
    imageTreatment: 'hero_photo_canvas',
    decorStyle: 'cinema_stamp',
    sampleHeadline: '제주 서쪽 노을이 가장 아름다운 해변 4선',
    sampleSubtitle: '황금빛 윤슬과 파도 소리가 가득한 해질녘 스팟',
    sampleHighlight: '📍 JEJU ISLAND · SCENE 01',
  },
  cute_pastel: {
    id: 'cute_pastel',
    name: '큐트/파스텔',
    englishName: 'CUTE PASTEL',
    tagline: '사랑스러운 파스텔 톤 & 둥근 말풍선 디자인',
    description: '파스텔 핑크/민트/라벤더/크림 컬러와 둥근 blob, 점선 패턴, 말풍선 및 손그림 하이라이트로 완성하는 귀엽고 친근한 SNS 스타일',
    categoryBadge: 'PASTEL · CUTE',
    designPhilosophy: '말랑한 곡선과 사랑스러운 파스텔 컬러, 귀여운 아이콘 레이아웃으로 높은 친밀감과 가독성을 전달',
    accentColor: '#ec4899',
    canvasBg: 'bg-pink-50/60',
    cardBg: '#fffafb',
    cardBorder: 'border-pink-200/80',
    titleColor: '#831843',
    textColor: '#4c0519',
    subTextColor: '#9d174d',
    chipBg: '#fce7f3',
    chipText: '#db2777',
    chipBorder: 'border-pink-300',
    badgeBg: '#e0f2fe',
    badgeText: '#0284c7',
    tipBg: '#fef3c7',
    tipText: '#92400e',
    tipBorder: 'border-amber-300',
    fontFamily: 'font-sans',
    fontHeading: 'font-sans',
    cornerStyle: 'rounded-3xl',
    dividerStyle: 'border-pink-200',
    imageTreatment: 'floating_whitespace',
    decorStyle: 'frosted_glow',
    sampleHeadline: '놓치면 아쉬운 꿀팁 모음 5가지',
    sampleSubtitle: '초보자도 1분 만에 따라하는 알짜 정보',
    sampleHighlight: 'CUTE TIP · 01',
  },
};

// Legacy alias compatibility
export type CardNewsMoodId = CardNewsTemplateId;
export type CardNewsMoodTheme = CardNewsTemplateTheme;
export const CARD_NEWS_MOOD_TEMPLATES = CARD_NEWS_TEMPLATES as any;

export interface CardNewsSlideData {
  id: string;
  slideNumber: number;
  cardType: 'cover' | 'body' | 'highlight' | 'closing';
  title: string;
  subtitle?: string;
  bodyPoints: string[];
  ctaText?: string;
  highlightWord?: string;
  imageUrl?: string;
  imageAlt?: string;
  imageCredit?: string;
  imageSource?: CardNewsImageSourceMode;
}
