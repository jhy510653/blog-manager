export type PlatformType = 'blog' | 'twitter' | 'both';
export type MissionDay = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
export type GoalUnit = 'daily' | 'weekly';

export interface DailyActivity {
  date: string;
  blogPosts: number;
  blogVisitors: number;
  tweets: number;
  replies: number;
}

export interface BlogPost {
  id: string;
  blogId: string;
  postId?: string;
  title: string;
  link: string;
  pubDate?: string;
  publishedDate: string; // YYYY-MM-DD
  userId?: string | null;
  participantId?: string | null;
  createdAt?: string;
}

export interface Participant {
  id: string;
  groupName: string; // e.g. "1기 블로그 챌린지" 또는 다중 챌린지 쉼표 조합
  groupNames?: string[]; // 다중 챌린지 참가 목록 e.g. ["1기 블로그 챌린지", "2기 트위터 챌린지"]
  participantName: string;
  platformType: PlatformType;
  blogId: string | null;
  dailyPostCount: number; // Avg or latest daily posts
  dailyVisitorCount: number; // Avg or latest daily visitors
  twitterId: string | null;
  tweetCount: number;
  replyCount: number;
  startDate: string; // YYYY-MM-DD
  history?: DailyActivity[];
  notes?: string;
  targetPostCount?: number; // 목표 포스팅 수 (기본값: 10개 - 레거시 지원)
  targetBlogPostCount?: number; // 블로그 목표 수
  targetTweetCount?: number;    // 트윗 게시글 목표 수
  targetReplyCount?: number;    // 트윗 답글(Reply) 목표 수
  missionDays?: MissionDay[];   // 선택 미션 요일 (월~일)
  goalUnit?: GoalUnit;          // 'daily' | 'weekly'
  lastActivityAt?: string;  // YYYY-MM-DD HH:mm
  isInactive24h?: boolean;   // 24시간 동안 비활동 여부
  streakDays?: number;      // 연속 작성 달성 일수 (🔥 스트릭)
  rankChange?: number | 'NEW'; // 지난 집계 대비 순위 변동 (양수: 상승, 음수: 하강, 0: 유지, 'NEW': 신규)
}

export type RefundConditionType = 'NONE' | 'ATTENDANCE_RATE' | 'POST_COUNT' | 'MISSION_COMPLETE' | 'CUSTOM';

export interface ChallengeGroup {
  id: string;
  name: string;
  description: string;
  category: 'blog' | 'twitter' | 'both';
  recruitingStartDate?: string; // 모집 시작일 (YYYY-MM-DD)
  recruitingEndDate?: string;   // 모집 마감일 (YYYY-MM-DD)
  startDate: string;            // 운영 시작일 (YYYY-MM-DD)
  endDate: string;              // 운영 종료일 (YYYY-MM-DD)
  missionDays?: MissionDay[];   // 선택 미션 요일 (월~일)
  goalUnit?: GoalUnit;          // 'daily' | 'weekly'
  targetBlogPostCount?: number; // 블로그 포스팅 목표 수 (기본 1개)
  targetTweetCount?: number;    // 트윗 게시글 목표 수 (기본 1개)
  targetReplyCount?: number;    // 트윗 답글 목표 수 (기본 3개)
  
  // 참가비 및 환급 설정 (정수 원 단위)
  fee?: number;                 // 참가비 (원) - 0원 허용
  participationFee?: number;    // 참가비 별칭 (원)
  refundEnabled?: boolean;      // 환급 시스템 활성화 여부
  refundFee?: number;           // 최대 환급액 (원)
  refundType?: 'full' | 'fixed'; // 환급 방식 ('full': 참가비 전액 환급, 'fixed': 정액 환급)
  refundAmount?: number;        // 환급 금액 (원)
  refundConditionType?: RefundConditionType; // 환급 조건 방식 ('NONE' | 'ATTENDANCE_RATE' | 'POST_COUNT' | 'MISSION_COMPLETE' | 'CUSTOM')
  refundConditionValue?: number; // 환급 조건 기준값 (예: 출석률 100, 포스팅 수 10 등)
  refundThreshold?: number;     // 환급 달성률 기준 (%, 기본 80%)
  refundCondition?: string;     // 환급 조건 텍스트 안내문
  refundFormUrl?: string;       // 외부 환급 신청폼 URL (Google Forms 등 일회성 계좌 접수 링크)
  
  // 입금 계좌 안내 정보 (관리자 설정)
  bankName?: string;            // 은행명 (e.g. "국민은행", "신한은행")
  accountNumber?: string;       // 계좌번호 (e.g. "123456-78-123456")
  accountHolder?: string;       // 예금주 (e.g. "참새", "챌린지 운영진")
  bankAccount?: string;         // 레거시 계좌정보 문자열
  bankOwner?: string;           // 레거시 예금주
  depositDeadline?: string;     // 입금 마감일시 (e.g. "2026-08-20 23:59")
  depositNotice?: string;       // 입금 시 유의사항 안내문
  
  rules?: string;               // 참가 규칙
  status?: 'recruiting' | 'in_progress' | 'ended'; // 상태 (선택)

  // 챌린지 참가 연동 등급 자동 부여 설정
  autoTierEnabled?: boolean;          // 챌린지 참가 승인 시 등급 자동 부여 여부 (기본: true)
  grantMembershipTier?: string;       // 부여할 멤버십 등급 ID (기본: 'pro')
  membershipDurationDays?: number;    // 등급 유지 기간 (일수, 0 또는 null은 챌린지 종료일까지/무기한)
}

export type PaymentStatus =
  | 'NOT_REQUIRED'      // 참가비 없음 (0원 챌린지)
  | 'PENDING_PAYMENT'   // 입금 대기
  | 'PAYMENT_REPORTED'  // 입금 확인 요청 접수 (참가자가 "입금 완료했어요" 클릭)
  | 'PAYMENT_CONFIRMED' // 관리자 입금 확인 및 참가 승인 완료
  | 'PAYMENT_REJECTED'  // 관리자 입금 거절
  | 'REFUND_PENDING'    // 환급 검토/대기
  | 'REFUND_ELIGIBLE'   // 환급 대상자
  | 'REFUND_REQUESTED'  // 환급 신청 접수
  | 'REFUND_COMPLETED'  // 관리자 환급(송금) 완료
  | 'REFUND_NOT_ELIGIBLE' // 환급 미대상
  // 레거시 호환 문자열
  | 'pending'
  | 'submitted'
  | 'approved'
  | 'rejected';

export interface PaymentStatusHistory {
  id: string;
  paymentId: string;
  oldStatus: string;
  newStatus: string;
  changedBy: string;
  reason?: string;
  createdAt: string;
}

export interface ChallengePayment {
  id: string;
  challengeId: string;
  challengeName?: string;
  participantId?: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  userNaverId?: string;
  userTwitterId?: string;
  amount: number;               // 참가비 (정수 원 단위)
  participationFee?: number;    // 참가비 (원)
  depositorName: string;        // 입금자명
  depositedAt: string;          // YYYY-MM-DD
  status: PaymentStatus;        // 입금 및 참가 승인 상태
  paymentStatus?: PaymentStatus;
  submittedAt: string;          // YYYY-MM-DD HH:mm
  reportedAt?: string;          // 입금 확인 요청 일시
  confirmedAt?: string | null;  // 입금 확인 및 승인 일시
  confirmedBy?: string | null;  // 승인 처리 관리자
  approvedAt?: string | null;   // 레거시 승인일시
  approvedBy?: string | null;   // 레거시 승인자
  rejectedAt?: string | null;   // 거절 일시
  rejectionReason?: string | null; // 거절 사유
  rejectedReason?: string | null;
  refundStatus?: 'none' | 'requested' | 'applied' | 'refunded' | 'eligible' | 'completed' | 'ineligible' | null;
  refundAmount?: number | null;
  refundedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export type DraftSessionStatus = 'drafting' | 'temporary' | 'completed' | 'saved' | 'expired';

export type DraftLastStep =
  | 'keyword_input'
  | 'keyword'
  | 'seo_plan'
  | 'golden_keyword'
  | 'draft_text'
  | 'draft'
  | 'images'
  | 'image_search'
  | 'ai_image_generation'
  | 'card_news'
  | 'final_review'
  | 'completed';

export interface DraftImageItem {
  id: string;
  type: 'content_image' | 'card_news' | 'ai_graphic';
  url: string;
  alt: string;
  order: number;
  source?: string;
  width?: number;
  height?: number;
}

export interface StyleProfile {
  tone?: string;
  sentenceStyle?: string;
  paragraphStyle?: string;
  openingStyle?: string;
  faqStyle?: string;
  endingStyle?: string;
  emphasisStyle?: string;
  expressionStyle?: string;
  imagePlacementStyle?: string;
  ctaStyle?: string;
  preferredPatterns?: string[];
  avoidPatterns?: string[];
  analyzedAt?: string;
}

export type BlogFontFamily =
  | 'default_font'           // 기본서체
  | 'nanum_gothic'           // 나눔고딕
  | 'nanum_myeongjo'         // 나눔명조
  | 'nanum_barun_gothic'     // 나눔바른고딕
  | 'nanum_square'           // 나눔스퀘어
  | 'maru_buri'              // 마루부리
  | 'start_again'            // 다시시작해 (나눔손글씨 다시시작해)
  | 'bareun_hippie'          // 바른히피 (나눔손글씨 바른히피)
  | 'daughter_handwriting'   // 우리딸손글씨 (나눔손글씨 우리딸손글씨)
  // 이전 버전 하위 호환
  | 'noto_sans'
  | 'noto_sans_kr'
  | 'malgun_gothic'
  | 'pretendard'
  | 'ridi_batang'
  | 'chosun_myeongjo'
  | 'system_sans';

export type BlogTextAlign = 'center' | 'left' | 'justify';
export type BlogLineHeight = '1.6' | '1.8' | '2.0' | '2.2';
export type BlogParagraphSpacing = '10px' | '12px' | '14px' | '18px' | '22px' | '24px' | '30px';
export type BlogFontSize = string;

export type SubheadingStyle = 'standard';
export type BlogH2Style = SubheadingStyle;

export type EmphasisStyle =
  | 'bold'              // 굵은 글씨만 (기본)
  | 'bold_color'        // 볼드 + 포인트 컬러
  | 'highlight_bg'      // 형광펜 배경색 효과
  | 'color_only'        // 포인트 컬러만
  | string;

export type BlogEmphasisStyle = EmphasisStyle;

export interface UserBlogStyle {
  id?: string;
  userId?: string;
  fontFamily?: BlogFontFamily;  // 하위 호환성 유지
  fontSize?: BlogFontSize;      // 하위 호환성 유지
  textColor?: string;           // 기본 텍스트 색상 (기본: '#000000')
  backgroundColor?: string;     // 배경 색상
  textAlign: BlogTextAlign;    // default: 'center' (네이버 블로그 기본)
  lineHeight: BlogLineHeight;  // default: '1.8'
  paragraphSpacing: BlogParagraphSpacing; // default: '18px'

  // 소제목 (H2) 서식 설정 (표준 소제목 단일화)
  h2Style?: SubheadingStyle;   // 'standard'
  h2Color?: string;
  h2FontSize?: string;
  h2AutoNumbering: boolean;   // default: false (소제목 번호 1. 2. 3. 자동 추가 여부)

  // 강조 (Strong) 서식 설정
  emphasisStyle: EmphasisStyle; // default: 'bold'
  emphasisColor: string;       // default: '#ff9300'

  // 가독성 및 문단 배치 옵션
  wrapLongSentences?: boolean;
  separateParagraphs: boolean; // 3~5줄 단위 문단 분리 및 자연스러운 여백 유지
  createdAt?: string;
  updatedAt?: string;
}

export const DEFAULT_USER_BLOG_STYLE: UserBlogStyle = {
  userId: 'default',
  fontFamily: 'default_font',
  fontSize: '15pt',
  textColor: '#000000',
  backgroundColor: 'transparent',
  textAlign: 'center',
  lineHeight: '1.8',
  paragraphSpacing: '18px',
  h2Style: 'standard',
  h2Color: '#03c75a',
  h2FontSize: '19pt',
  h2AutoNumbering: false,
  emphasisStyle: 'bold',
  emphasisColor: '#ff9300',
  wrapLongSentences: false,
  separateParagraphs: true,
};

export interface AiDraftSession {
  id: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  title?: string;
  keyword: string;
  keywords?: string[];
  style?: string;
  writingStyleKey?: string;
  status: DraftSessionStatus;
  lastStep: DraftLastStep;
  writingContext?: any;
  styleProfile?: StyleProfile;
  options?: {
    imageMode?: string;
    imageAspectRatio?: string;
    aiGraphicStyle?: string;
    createCardNews?: boolean;
    targetWordCount?: string;
    bodyAiModel?: string;
    imageAiModel?: string;
    outputFormat?: string;
    maxImageCount?: number;
    subTab?: string;
  };
  targetWordCount?: string;
  bodyAiModel?: string;
  outputFormat?: string;
  imageAspectRatio?: string;
  aiGraphicStyle?: string;
  aiAnalysis?: AiContentAnalysisResult;
  batchItems: AiBatchItem[];
  seoPlan?: GoldenKeywordResult;
  draftContent?: string;
  finalHtml?: string;
  imageResult?: any;
  cardNewsResult?: CardNewsResult;
  images?: DraftImageItem[];
  cardNews?: any;
  metadata?: Record<string, any>;
  createdAt?: string;
  updatedAt: string;
  expiresAt?: string;
}

export type BoardCategory = 'notice' | 'faq' | 'qna';

export interface Announcement {
  id: string;
  title: string;
  content: string;
  summary?: string;           // 2~3줄 요약 문구
  thumbnailUrl?: string;      // 대표 썸네일 이미지 URL
  isImportant?: boolean;
  isPublished?: boolean;       // 공개/비공개 상태 (기본 true)
  targetChallengeId?: string;  // 특정 챌린지 연동 (선택)
  externalLinkUrl?: string;    // 외부 바로가기 링크 URL (선택)
  externalLinkLabel?: string;  // 바로가기 버튼 텍스트 (예: '가이드 바로가기', '노션 페이지 열기' 등)
  createdAt: string;
  updatedAt?: string;
  authorName?: string;
  category?: 'notice' | 'faq' | 'qna';
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;           // 카테고리 (e.g. '회원/계정', '챌린지', 'AI 기능', '상품/결제', '환급', '기타')
  isPublished?: boolean;      // 공개 여부 (기본 true)
  orderIndex: number;         // 정렬 순서 (낮을수록 상단)
  createdAt: string;
  updatedAt?: string;
  authorName?: string;
}

export interface QnAItem {
  id: string;
  title: string;
  content: string;
  category?: string;          // 카테고리 (e.g. '회원/계정', '챌린지', 'AI 기능', '상품/결제', '환급', '기타')
  userId: string;             // 작성자 사용자 ID
  authorName: string;         // 작성자 이름 / 닉네임
  authorEmail?: string;       // 작성자 이메일
  isSecret?: boolean;         // 비공개 질문 여부 (작성자 + 관리자만 조회)
  status: 'pending' | 'answered'; // 'pending' (답변대기) | 'answered' (답변완료)
  answerContent?: string;     // 관리자 답변 내용
  answeredAt?: string;        // 답변 완료 일시
  answeredBy?: string;        // 답변자 (기본: '운영자')
  isPublished?: boolean;      // 게시 여부 (기본 true)
  createdAt: string;
  updatedAt?: string;
}

export type ResourceType = 'pdf' | 'excel' | 'word' | 'link' | 'text' | 'video' | 'image' | 'zip';
export type ResourceVisibility = 'all' | 'specific_challenges';

export interface ChallengeResource {
  id: string;
  title: string;
  description: string;
  category?: string;                // 카테고리 (e.g. '공정위 가이드', '키워드 리서치', '커리큘럼 자료', '수익화 템플릿')
  resourceType?: ResourceType;      // 'pdf' | 'excel' | 'word' | 'link' | 'text' | 'video' | 'image' | 'zip'
  thumbnailUrl?: string;            // 썸네일 이미지 URL (PDF 첫 페이지 또는 대표 이미지)
  fileUrl?: string;                 // PDF 또는 첨부파일 링크
  fileName?: string;                // 첨부 파일명
  fileSize?: string;                // 파일 크기 (e.g. '2.4 MB')
  linkUrl?: string;                 // 외부 링크 또는 영상 URL
  content?: string;                 // 텍스트/가이드 상세 내용
  visibility?: ResourceVisibility;  // 'all' (전체 회원) | 'specific_challenges' (특정 챌린지)
  targetGroup?: string;             // 레거시 단일 챌린지명 또는 'all'
  targetGroupIds?: string[];        // 복수 챌린지 ID 목록
  targetGroupNames?: string[];      // 복수 챌린지 이름 목록
  weekNumber?: number;              // 주차 (기본: 1주차)
  orderIndex?: number;              // 순서 (기본: 1)
  isRequired?: boolean;             // 필수 자료 여부 (true: 필수, false: 선택)
  isPublished?: boolean;            // 공개 여부 (true: 공개, false: 비공개)
  createdBy?: string;               // 작성자
  createdAt: string;
  updatedAt?: string;
}

export interface ResourceCategoryItem {
  id: string;
  name: string;
  orderIndex: number;
  isDefault?: boolean;
}

export interface ExtractedLinkData {
  sourceUrl: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  siteName?: string;
  price?: string;
  address?: string;
  brand?: string;
  features?: string[];
  extractedAt?: string;
}

export interface FilterState {
  groupName: string; // 'all' or specific group name
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  searchTerm: string;
  platformFilter: 'all' | 'blog' | 'twitter' | 'both';
}

export interface SummaryStats {
  totalParticipants: number;
  totalPosts: number;
  totalVisitors: number;
  totalTweets: number;
  totalReplies: number;
  activeBloggersCount: number;
  activeTweetersCount: number;
  averageAchievementRate?: number;
}

export interface SiteVisitorStats {
  totalMembers: number;
  totalVisitors: number;
  weeklyVisitors: number;
  dailyVisitors: number;
}

export type UserRole = 'user' | 'admin';
export type SubscriptionPlan = 'free' | 'basic' | 'pro';

export type CardImageSource = 'user_photo' | 'free_image' | 'infographic' | 'ai_graphic' | 'none';

export type CardNewsStyle = 
  | 'info'          // 정보형
  | 'comparison'    // 비교형
  | 'review'        // 리뷰/후기형
  | 'travel'        // 여행/맛집형
  | 'list'          // 리스트형
  | 'photo'         // 사진 중심형
  | 'graphic_info'; // 그래픽 정보형

export type CardLayout = 
  | 'cover'
  | 'content'
  | 'comparison'
  | 'checklist'
  | 'timeline'
  | 'step_process'
  | 'metric'
  | 'summary'
  | 'cta';

export type GraphicElementType = 
  | 'table'
  | 'checklist'
  | 'timeline'
  | 'steps'
  | 'metric_grid'
  | 'vs_badge'
  | 'key_callout'
  | 'chart_bars';

export interface GraphicElementsData {
  type: GraphicElementType;
  data: {
    headers?: string[];
    rows?: string[][];
    items?: Array<{ label: string; sublabel?: string; value?: string; checked?: boolean }>;
    metrics?: Array<{ number: string; label: string; change?: string }>;
    steps?: Array<{ stepNumber: number; title: string; description: string }>;
    vs?: { optionA: { name: string; pros: string }; optionB: { name: string; pros: string } };
    calloutText?: string;
  };
}

export interface ImagePlanItem {
  id: string;
  insertAfterSection: string;
  subject: string;
  visualDescription: string;
  searchQueries: string[];
  preferredSource?: 'unsplash' | 'user_photo' | 'ai_graphic' | string;
  reason?: string;
}

export interface CardNewsItem {
  cardNumber: number;
  cardRole?: 'cover' | 'key_point' | 'step' | 'comparison' | 'tip' | 'warning' | 'summary' | 'cta' | string;
  title: string;
  subtitle?: string;
  body?: string;
  contentPoints?: string[];
  imageSource: CardImageSource;
  imageId?: string;
  imageUrl?: string;
  imagePrompt?: string; // generated if imageSource === 'ai_graphic'
  searchQueries?: string[];
  subject?: string;
  reason?: string;
  preferredSource?: string;
  layout: CardLayout;
  emphasis?: string[];
  graphicElements?: GraphicElementsData;
  cta?: string;
  style?: string;
  visualStyle?: string;
  imageMode?: string;
}

export interface CardNewsEngineResult {
  keyword: string;
  title: string;
  style: CardNewsStyle;
  globalStyle?: string;
  imageMode?: string;
  totalCards: number;
  cards: CardNewsItem[];
  userPhotosUsed?: string[];
}

export interface CardNewsSlide {
  slideNumber: number;
  type: 'cover' | 'core_content' | 'key_info' | 'summary' | 'cta';
  title: string;
  subtitle?: string;
  contentPoints: string[];
  highlightText?: string;
}

export interface CardNewsResult {
  keyword: string;
  title: string;
  slides: CardNewsSlide[];
  aiGraphicStyle?: string;
  engineResult?: CardNewsEngineResult;
}

export interface CardNewsGenerationOptions {
  cardCount: number; // 5, 6, 7, 8
  style: CardNewsStyle;
  imageMode: 'auto' | 'user_photo_first' | 'free_image_first' | 'graphic_first' | 'ai_graphic_first';
  userPhotos: string[];
}

export interface OutlineSection {
  id: string;
  heading: string;
  coreContent?: string;
  keyKeywords?: string[];
}

export interface AiBatchItem {
  id: string;
  keyword: string;
  writingStyle?: SeoWritingStyleKey;
  experienceType?: string;
  userExperience?: string;
  currentPipelineStageText?: string;
  seoPlanStatus: 'pending' | 'processing' | 'completed' | 'failed';
  outlineStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  draftStatus: 'pending' | 'processing' | 'completed' | 'failed';
  imageStatus: 'not_requested' | 'processing' | 'completed' | 'failed';
  cardNewsStatus: 'not_requested' | 'processing' | 'completed' | 'failed';
  
  seoPlan?: GoldenKeywordResult;
  selectedTitle?: string;
  outlineSections?: OutlineSection[];
  isOutlineConfirmed?: boolean;
  draftContent?: string;
  outputFormat?: 'naver_paste' | 'html';
  imageResult?: UnsplashImageResult;
  cardNewsResult?: CardNewsResult;
  cardNewsEngineResult?: CardNewsEngineResult;
  topPosts?: TopPostItem[];
  relatedKeywords?: string[];
  benchmarkPrompt?: string;
  costBreakdown?: {
    textCost: number;
    imageCost: number;
    cardNewsCost: number;
    totalCost: number;
    isActualTokens?: boolean;
  };
  errorMessage?: string;
}

export interface UserUsageLimits {
  role: UserRole;
  subscriptionPlan: SubscriptionPlan;
  maxBatchSize: number; // 1 for user, 10 for admin
  textGenerationCount: number;
  dailyTextGenerationLimit?: number;
  monthlyTextGenerationLimit: number;
  cardGenerationCount: number;
  dailyCardGenerationLimit?: number;
  monthlyCardGenerationLimit: number;
  aiGraphicGenerationCount: number;
  dailyAiGraphicGenerationLimit?: number;
  monthlyAiGraphicGenerationLimit: number;
}

export type AiToolType = 'golden_keyword' | 'draft' | 'seo_feedback' | 'image_ai' | 'analyze_style' | 'card_news';

export interface StyleProfile {
  id: string;
  profileName: string;
  isAiAnalyzed?: boolean; // true if AI analyzed, false if quick config preset
  tone?: string;              // ① 말투
  sentenceStyle?: string;     // ② 문장 스타일
  paragraphStyle?: string;    // ③ 문단 스타일
  openingStyle?: string;      // ④ 도입부 스타일
  faqStyle?: string;          // ⑤ 본문 전개 방식
  endingStyle?: string;       // ⑥ 결론 스타일
  emphasisStyle?: string;     // ⑦ 강조 스타일
  expressionStyle?: string;   // ⑧ 표현 패턴
  imagePlacementStyle?: string; // ⑨ 이미지 배치 스타일
  ctaStyle?: string;          // ⑩ CTA 스타일
  preferredPatterns?: string[];
  avoidPatterns?: string[];
  // Snapshot for quick config presets
  configSnapshot?: {
    contentStyle: string;
    outputFormat?: 'plain' | 'html';
    imageGuide?: boolean;
    userInput?: Record<string, string>;
  };
  createdAt: string;
  updatedAt?: string;
}
export type DraftType = 
  | 'experience_draft'
  | 'info_draft' 
  | 'purchase_draft' 
  | 'comparison_draft' 
  | 'homepan_draft' 
  | 'travel_draft' 
  | 'review_draft' 
  | 'cpa_draft' 
  | 'story_draft';
export type TargetLengthOption = 'about_1000' | 'about_2000';

export interface UnsplashPhotoItem {
  id: string;
  urls: {
    raw: string;
    full: string;
    regular: string;
    small: string;
    thumb: string;
  };
  alt_description: string | null;
  description: string | null;
  user: {
    name: string;
    username: string;
    links?: {
      html: string;
    };
  };
  links?: {
    html: string;
    download_location: string;
  };
}

export interface UnsplashImageResult {
  intentAnalysis?: string;
  mainEnglishKeyword?: string;
  relatedEnglishKeywords?: string[];
  apiUrl?: string;
  directLink?: string;
  usageTip?: string;
  requirement?: string;
  searchQuery?: string;
  concepts?: string[];
  captions?: string[];
  photos?: UnsplashPhotoItem[];
}

export interface TopPostItem {
  title: string;
  link: string;
  description: string;
  bloggername?: string;
}

export interface RealtimeDraftResult {
  topRankSummary: string;
  topPosts: TopPostItem[];
  draftContent: string;
}

export interface AiPrompts {
  golden_keyword: string;
  review_draft: string;
  info_draft: string;
  cpa_draft: string;
  seo_feedback: string;
  target_1000_rule?: string;
  target_2000_rule?: string;
  emphasis_rule?: string;
}

export interface AiToolkitPrompt {
  id: string;
  prompt_key: string;
  prompt_name: string;
  prompt_content: string;
  description?: string;
  category?: 'seo_plan' | 'draft' | 'media' | 'analytics';
  is_active: boolean;
  version: number;
  created_at?: string;
  updated_at?: string;
  updated_by?: string;
}

export interface AiToolkitPromptVersion {
  id: string;
  prompt_id?: string;
  prompt_key: string;
  version: number;
  prompt_content: string;
  change_summary?: string;
  created_at: string;
  created_by?: string;
}

export interface NaverUser {
  id: string;
  naverId: string;
  name: string;
  email: string;
  avatarUrl?: string;
  blogRssUrl: string;
  twitterId?: string;
  role?: 'admin' | 'user';
}

export interface KeywordClusterItem {
  keyword: string;
  usage: string;
}

export interface KeywordClusters {
  core?: KeywordClusterItem[];
  longTail?: KeywordClusterItem[];
  comparison?: KeywordClusterItem[];
  transaction?: KeywordClusterItem[];
  faq?: KeywordClusterItem[];
}

export interface SearchIntent {
  stage: string; // '정보탐색' | '비교검토' | '구매직전'
  userGoal: string;
  targetAudience: string;
  possibleQuestions: string[];
}

export interface TitleCandidate {
  title: string;
  combinationType?: string;
  category?: string;
  intent?: string;
  keywordsUsed?: string[];
  evaluationNote?: string;
}

export interface RecommendedTitlesGroup {
  click: string[];
  information: string[];
  review: string[];
  comparison: string[];
  purchase?: string[];
}

export interface RecommendedOutline {
  h1: string;
  h2: string[];
  sections?: OutlineSection[];
}

export interface CtaStrategy {
  primaryCTA: string;
  secondaryCTA: string;
  benefitFocus: string;
  recommendedPlacement: string[];
}

export interface GoldenKeywordItem {
  keyword: string;
  competition: string;
  strategy: string;
}

export interface WritingTone {
  style: string;
  length: string;
  trustSignals: string[];
}

export interface RecommendedHtmlOptions {
  includeFaq?: boolean;
  includeTable?: boolean;
  includeChecklist?: boolean;
  includeImageRec?: boolean;
  includeQuote?: boolean;
}

export interface ContentStrategy {
  recommendedStyle?: string;
  styleReason?: string;
  targetStructure?: string;
}

export interface MonetizationStrategy {
  primaryGoal?: string;
  conversionTrigger?: string;
  linkGuide?: string;
}

export interface EvidencePolicy {
  mustInclude?: string;
  trustSignals?: string[];
  prohibitedClaims?: string[];
}

export interface ImageStrategy {
  recommendedCount?: number;
  visualConcept?: string;
  primaryVisualTypes?: string[];
}

export type SearchIntentType = 
  | 'informational'
  | 'comparison'
  | 'commercial'
  | 'transactional'
  | 'navigational'
  | 'informational_commercial';

export type ContentClassificationType = 
  | 'experience_review'
  | 'informational_guide'
  | 'purchase_recommendation'
  | 'comparison_analysis'
  | 'trend_story';

export type ConversionGoalType = 
  | 'information'
  | 'trust_building'
  | 'purchase_consideration'
  | 'click_conversion'
  | 'engagement';

export type ExperienceSubType = 
  | 'travel'
  | 'restaurant'
  | 'cafe'
  | 'product'
  | 'accommodation'
  | 'exhibition'
  | 'service'
  | 'education'
  | 'app'
  | 'space'
  | 'activity'
  | 'mixed'
  | 'general';

export type SeoWritingStyleKey = 'experience' | 'info' | 'purchase' | 'comparison' | 'homepan' | 'travel' | 'review' | 'story';

export interface ContentBoundary {
  coreIntent: string;           // 핵심 검색 목적 (예: "국내 가을 시즌 여행지 후보 및 테마별 선택 기준 제공")
  targetAudience: string;       // 타깃 독자 (예: "가을 시즌 국내 여행을 계획 중인 가족/연인/나홀로 여행객")
  mustCover: string[];          // 반드시 다뤄야 할 필수 범위/후보 (예: ["가을 명소 후보 3~5곳", "단풍/억새/축제 등 테마별 특징", "방문 적기 및 동선 팁", "상황별 추천 대상"])
  optionalCover?: string[];     // 선택적으로 다룰 수 있는 보조 범위 (예: ["주변 맛집/카페", "주차 및 편의시설", "예산 가이드"])
  mustAvoid: string[];          // 절대 포함하지 말아야 할 범위/금지 사항 (예: ["해외여행지 비교", "일반적인 여행 철학론", "검색 키워드 지역 범위를 벗어나는 장소"])
  geographicScope?: string;     // 명시적 지리/지역 범위 (예: "대한민국 국내 전역", "서울 및 수도권 근교", "부산 광역시")
  contentTypeCategory?: 'recommendation_curation' | 'specific_guide' | 'review' | 'comparison' | 'general';
}

export interface AiContentAnalysisResult {
  searchIntent: SearchIntentType | string;
  searchIntentSummary?: string; // e.g. "방문 전 정보 탐색 + 실제 경험 확인"
  contentType: ContentClassificationType | string;
  contentTypeSummary?: string;  // e.g. "맛집 경험 리뷰"
  conversionGoal: ConversionGoalType | string;
  writingStyle: 'experience' | 'info' | 'purchase' | 'comparison' | 'homepan' | SeoWritingStyleKey;
  writingStyleLabel?: string;   // e.g. "경험 리뷰형"
  experienceType?: ExperienceSubType | string;
  experienceTypeLabel?: string; // e.g. "맛집"
  targetAudience?: string;
  recommendedStructure?: string;
  reason?: string;
  reasoning?: string;
  contentBoundary?: ContentBoundary;
}

export interface GoldenKeywordResult {
  mainKeyword: string;
  writing_style?: string; // '[정보 탐색형]' | '[비교 분석형]' | '[구매 추천형]' | '[경험 리뷰형]' | '[홈판 화제형]'
  searchIntent?: SearchIntent;
  keywordClusters?: KeywordClusters;
  titleCandidates?: TitleCandidate[] | string[];
  recommendedTitles?: RecommendedTitlesGroup | string[]; // support legacy array fallback
  recommendedOutline?: RecommendedOutline;
  ctaStrategy?: CtaStrategy;
  recommendedHtml?: RecommendedHtmlOptions;
  contentStrategy?: ContentStrategy;
  monetizationStrategy?: MonetizationStrategy;
  evidencePolicy?: EvidencePolicy;
  imageStrategy?: ImageStrategy;
  contentBoundary?: ContentBoundary;
  aiAnalysis?: AiContentAnalysisResult;
  seoChecklist?: string[];
  internalLinkIdeas?: string[];
  imageIdeas?: string[];
  writingTone?: WritingTone;
  notes?: string;
  // Live Naver Search benchmark verification fields
  topPosts?: TopPostItem[];
  relatedKeywordsList?: string[];
  rawBenchmarkPrompt?: string;
  benchmarkReceivedAt?: string;
  // Legacy backward compatibility fields
  relatedKeywords?: GoldenKeywordItem[];
  seoTip?: string;
}

export interface SeoFeedbackResult {
  readabilityScore: number;
  keywordDensity: string;
  ctaScore: string;
  improvementTips: string[];
  overallEvaluation: string;
}

export type RefundEligibilityStatus = 'eligible' | 'ineligible' | 'review_required';
export type RefundStatus =
  | 'pending_review'  // 환급 검토 대기
  | 'eligible'        // 환급 대상 (자동 계산상 기준 충족, 외부폼 제출 대기)
  | 'applied'         // 참가자 외부 환급폼 신청 완료
  | 'ineligible'      // 환급 미대상 (자동 계산상 기준 미달)
  | 'approved'        // 운영자 환급 승인 (송금 대기)
  | 'processing'      // 운영자 환급 처리 중
  | 'completed'       // 운영자 계좌 송금 및 환급 완료
  | 'rejected';       // 운영자 환급 거절

export type ContentReviewStatus = 'valid' | 'suspicious' | 'insufficient_data' | 'not_checked';
export type AdminDecision = 'approved' | 'rejected' | 'pending';

export interface PostReviewItem {
  id: string;
  title: string;
  date: string;
  url?: string;
  platform: 'blog' | 'twitter_post' | 'twitter_reply';
  contentSnippet?: string;
  contentLength?: number;
  status: 'valid' | 'invalid' | 'review_required';
  reviewReason?: string;
}

export interface ChallengeRefund {
  id: string;
  challengeId: string;
  challengeName?: string;
  challengeGroupCode?: string;
  participantId: string;
  participantName: string;
  userName?: string;
  blogId?: string;
  twitterId?: string;
  userId?: string;
  userEmail?: string;
  paymentId?: string;

  // Snapshot metrics calculated at completion/snapshot time
  targetAmount: number;          // 당초 참가비 (원)
  eligibleAmount: number;        // 환급 대상 금액 (원)
  calculatedRefundAmount?: number; // 호환용 환급액
  finalRefundAmount?: number;    // 최종 확정 환급액
  achievementRate: number;       // 당시 목표 달성률 (%)
  refundThreshold: number;       // 당시 환급 기준 (%)
  targetGoalCount: number;       // 당초 목표 수량
  actualGoalCount: number;       // 실제 이행 수량

  // 외부 환급 신청폼 접수 상태 (Google Forms 등)
  isFormSubmitted?: boolean;     // 외부 신청폼 제출 여부
  formSubmittedAt?: string;      // 신청 제출 일시

  eligibilityStatus: RefundEligibilityStatus;
  refundStatus: RefundStatus;
  contentReviewStatus: ContentReviewStatus;
  contentReviewNotes?: string;

  reviewedPostsCount?: number;
  validPostsCount?: number;
  invalidPostsCount?: number;
  postItems?: PostReviewItem[];
  postsReviewed?: any[];

  bankName?: string;
  bankAccount?: string;
  bankAccountNumber?: string;
  bankOwner?: string;
  bankAccountHolder?: string;

  adminDecision?: AdminDecision;
  adminDecisionReason?: string | null;
  memo?: string | null;

  approvedBy?: string | null;
  approvedAt?: string | null;
  completedBy?: string | null;
  completedAt?: string | null;

  createdAt: string;
  updatedAt?: string;
}

export type RevenueCertificationStatus = 'pending' | 'approved' | 'rejected';

export interface RevenueCertification {
  id: string;
  userId: string;
  userName: string;
  userEmail?: string;
  userAvatar?: string;
  naverBlogId?: string;
  challengeId?: string;
  challengeName?: string;
  title: string;
  content: string;
  revenueAmount: number; // 원화 금액 (e.g. 500000)
  proofImageUrl: string;
  status: RevenueCertificationStatus;
  rejectionReason?: string;
  isFeatured?: boolean; // 명예의 전당 / 베스트 후기
  likesCount?: number;
  viewsCount?: number;
  likedUserIds?: string[]; // 좋아요 누른 유저 ID 목록
  approvedAt?: string;
  approvedBy?: string;
  createdAt: string;
  updatedAt?: string;
}

// ----------------------------------------------------
// 뱃지 시스템 (Badge & Achievement System)
// ----------------------------------------------------

export type BadgeCategory = '수익' | '챌린지' | '활동' | '기타' | string;

export type BadgeConditionType =
  | 'profit_verification_count'    // 수익 인증 횟수
  | 'total_profit'                 // 누적 인증 수익 금액 (원)
  | 'profit_platform'              // 플랫폼별 수익 인증 (cpa, shopping_connect 등)
  | 'profit_verification_monthly'  // 월간 수익 인증
  | 'challenge_complete'           // 챌린지 완주 / 참가
  | 'streak_days'                  // 연속 작성 일수
  | 'custom'                       // 기타
  | string;

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;                    // Emoji (e.g. 🌱, 🔥, 💰) or Lucide Icon Name
  color: string;                   // Hex (e.g. #4CAF50, #FF7043, #F59E0B)
  category: BadgeCategory;         // '수익' | '챌린지' | '활동' | '기타'
  conditionType: BadgeConditionType;
  conditionValue: number;          // Target number (e.g. 1, 5, 100000)
  conditionMetadata?: Record<string, any>;
  isActive: boolean;               // 활성화 / 비활성화 (소프트 삭제)
  sortOrder: number;               // 정렬 순서 (낮은 번호 우선)
  createdAt: string;
  updatedAt?: string;
}

export interface UserBadge {
  id: string;
  userId: string;
  badgeId: string;
  earnedAt: string;
  metadata?: {
    profitVerificationCount?: number;
    totalProfit?: number;
    triggerReason?: string;
    [key: string]: any;
  };
  badge?: Badge;                   // Populated badge object
}

export interface UserBadgeProgress {
  badge: Badge;
  isEarned: boolean;
  earnedAt?: string;
  currentValue: number;
  targetValue: number;
  progressPercent: number;         // 0 ~ 100
  metadata?: Record<string, any>;
}

// ----------------------------------------------------
// 사이트 알림 시스템 (In-App Notifications)
// ----------------------------------------------------

export type NotificationType =
  | 'payment_pending'    // 참가비 입금 확인 요청 접수
  | 'payment_approved'   // 참가비 입금 확인 및 참가 승인 완료
  | 'payment_confirmed'  // 참가비 입금 확인 및 참가 승인 완료
  | 'payment_rejected'   // 참가비 입금 거절
  | 'refund_eligible'    // 환급 기준 달성 안내 (외부 신청폼 안내)
  | 'refund_pending'     // 환급 검토/대기
  | 'refund_approved'    // 환급 심사 승인
  | 'refund_completed'   // 환급 송금 완료
  | 'refund_rejected'    // 환급 심사 반려
  | 'revenue_submitted'  // 수익 인증 신청 접수
  | 'revenue_approved'   // 수익 인증 심사 승인 (명예의 전당 등록)
  | 'revenue_rejected'   // 수익 인증 심사 반려
  | 'announcement'       // 공지사항 등록
  | 'qna_new'            // 새 Q&A 질문 등록
  | 'qna_answered'       // Q&A 답변 완료
  | 'mission_alert'      // 미션 알림
  | 'challenge_start'    // 챌린지 시작 안내
  | 'system';            // 시스템 안내

export interface AppNotification {
  id: string;
  userId?: string;       // 특정 유저 대상 ('all' 또는 null일 경우 전체 회원)
  userEmail?: string;
  type: NotificationType;
  title: string;
  message: string;
  linkTab?: 'dashboard' | 'challenges' | 'toolkit' | 'revenue' | 'announcements' | 'profile';
  linkId?: string;       // 챌린지 ID, 수익인증 ID 등
  actionUrl?: string;    // 외부 링크 (예: Google Form 환급신청 링크)
  actionLabel?: string;  // 버튼 문구 (예: '환급 신청하기')
  isRead: boolean;
  createdAt: string;
}

// ----------------------------------------------------
// 네이버 데이터랩 및 검색광고 기반 황금 트렌드 키워드 (Trend Keyword)
// ----------------------------------------------------

export interface TrendKeyword {
  id?: string;
  category: string; // e.g. '국내여행' | '해외여행' | '맛집' | '뷰티' | '생활/편의' | 'IT/테크' | '패션' | '재테크'
  keyword: string;
  pcSearchVolume: number;
  mobileSearchVolume: number;
  totalSearchVolume?: number;
  competitionIndex: '낮음' | '중간' | '높음' | string; // 기존 호환용 (광고 경쟁도)
  adCompetitionIndex?: '낮음' | '중간' | '높음' | string; // 검색광고 입찰 경쟁도 (compIdx)
  documentCount?: number; // 네이버 블로그 검색 총 문서수 (total)
  searchToDocumentRatio?: number; // 블로그 SEO 황금지표 (totalSearchVolume / documentCount)
  blogCompetitionLevel?: '황금 (최상)' | '유리 (상)' | '보통' | '과열' | string; // 블로그 SEO 경쟁도 판정
  dayOverDayChange?: number | null; // 전일 대비 검색량 증감율 (%)
  isNew?: boolean; // 이틀치 미만 신규 키워드 여부
  dataSource?: 'real_api' | 'fallback_estimate'; // 실제 검색광고 API vs 추정 Fallback 여부
  
  // 포스팅 활용형 키워드 판별 및 의도 지표
  isPostingUsable?: boolean;
  postingUsabilityScore?: number; // 1 ~ 5 (포스팅 활용도 별점)
  searchIntentCategory?: string; // e.g. '맛집 탐색', '여행/일정 기획', '구매/추천'
  searchIntentDescription?: string; // e.g. "구체적인 목적형 검색어"
  keywordCombinationType?: string; // e.g. "[지역] + [맛집/메뉴]", "[제품] + [추천/비교]"
  suggestedTitleHint?: string; // e.g. "포스팅 소재/제목 방향 제안"
  timingTag?: 'now' | 'prepare' | 'steady'; // 🔥지금쓰기 / 🌱미리준비 / 📌스테디
  timingTagLabel?: string; // '🔥 지금 쓰기' | '🌱 미리 준비' | '📌 스테디'
  recommendReason?: string; // 포스팅 추천 이유 코멘트
  contentStyle?: string; // '경험/후기형' | '정보/가이드형' | '비교/큐레이션형'
  suggestedTitles?: string[]; // 추천 제목 예시 3종
  suggestedOutlines?: string[]; // 추천 목차 (H2) 가이드

  // 정밀 스코어링 및 소재 분류 (0 ~ 100)
  specificityScore?: number; // 구체성 점수 (0~100)
  blogTopicScore?: number; // 블로그 소재 적합성 점수 (0~100)
  recentBlogActivity?: number; // 최근 블로그 활용 활성도 (0~100)
  seasonalityScore?: number; // 시즌성 점수 (0~100)
  genericPenalty?: number; // 범용 키워드 감점 (0~100)
  trendScore?: number; // 트렌드/상승 점수 (0~100)
  finalScore?: number; // 최종 산출 점수 (0~100)
  classification?: 'immediate_post' | 'expandable_topic' | 'trend_reference'; // 3단계 분류
  classificationLabel?: string; // '즉시 포스팅 추천' | '확장형 소재' | '참고용 트렌드'
  excludedReason?: string; // 필터링 또는 감점 사유 (관리자 디버그용)

  collectedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ----------------------------------------------------
// 구매 등급별 기능 접근 권한 및 사용량 제한 시스템 (Membership & Feature Permissions)
// ----------------------------------------------------

export type UsagePeriod = 'none' | 'daily' | 'weekly' | 'monthly';

export type MembershipStatus = 'active' | 'expired' | 'cancelled';

export interface MembershipTier {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export type FeatureCategory = 'ai_draft' | 'analytics' | 'challenge' | 'revenue' | 'general' | string;

export interface FeatureItem {
  id: string;
  featureKey: string;
  name: string;
  description?: string;
  category: FeatureCategory;
  isActive: boolean;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface TierFeature {
  id?: string;
  tierId: string;
  featureId: string;
  featureKey?: string;
  enabled: boolean;
  usageLimit: number | null; // null = 무제한
  usagePeriod: UsagePeriod;  // 'none' | 'daily' | 'weekly' | 'monthly'
  createdAt?: string;
  updatedAt?: string;
}

export type MembershipSourceType = 'manual' | 'challenge' | 'product_purchase' | 'admin' | 'subscription';

export interface UserMembership {
  id: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  tierId: string;
  status: MembershipStatus;
  startedAt?: string;
  startsAt?: string;
  expiresAt?: string | null;
  sourceType?: MembershipSourceType;
  sourceId?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
  tier?: MembershipTier;
}

// ----------------------------------------------------
// 상품 및 결제/구매 시스템 (Products & Purchases System)
// ----------------------------------------------------

export type ProductType = 'membership' | 'ai_usage' | 'challenge' | 'general';

export interface Product {
  id: string;
  name: string;
  description?: string;
  productType: ProductType;
  price: number;
  originalPrice?: number;
  membershipTier?: string | null;     // 연결될 멤버십 등급 ID (e.g. 'pro', 'vip')
  durationDays?: number | null;       // 멤버십 유지 일수 (e.g. 30, 90, 365, null=무제한)
  aiUsageAddCount?: number | null;    // 충전할 AI 사용량 (ai_usage 상품일 경우)
  isActive: boolean;
  sortOrder: number;
  features?: string[];                // 혜택 요약 목록
  badge?: string;                     // 뱃지 라벨 (e.g. 'BEST', '추천', '특가')
  createdAt?: string;
  updatedAt?: string;
}

export type PurchaseStatus = 'pending' | 'completed' | 'cancelled' | 'refunded';
export type PurchasePaymentMethod = 'bank_transfer' | 'credit_card' | 'free_grant' | 'challenge_included' | 'admin_grant' | string;

export interface Purchase {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  productId: string;
  productName: string;
  productType: ProductType;
  amount: number;
  paymentMethod: PurchasePaymentMethod;
  status: PurchaseStatus;
  sourceType: MembershipSourceType;
  sourceId?: string | null;           // 챌린지 ID, PG 거래 ID 등
  notes?: string | null;
  purchasedAt: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UsageLog {
  id: string;
  userId: string;
  featureId?: string;
  featureKey: string;
  usedAt: string;
  requestId?: string;
  metadata?: Record<string, any>;
}

export interface FeatureUsageStatus {
  featureKey: string;
  featureName: string;
  category: FeatureCategory;
  enabled: boolean;
  usageLimit: number | null;
  usagePeriod: UsagePeriod;
  usedCount: number;
  remainingUses: number | 'unlimited';
  isUnlimited: boolean;
  canUse: boolean;
  tierId: string;
  tierName: string;
  reason?: string;
}

export interface UserMembershipSummary {
  userKey: string;
  tier: MembershipTier;
  membership?: UserMembership | null;
  isAdmin: boolean;
  isChallengeParticipant: boolean;
  featureAccess: Record<string, FeatureUsageStatus>;
  updatedAt: string;
}





