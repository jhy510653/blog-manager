import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  ChallengeGroup,
  Participant,
  NaverUser,
  Announcement,
  FAQItem,
  QnAItem,
  ChallengeResource,
  SiteVisitorStats,
  ChallengePayment,
  PaymentStatus,
  PaymentStatusHistory,
  ChallengeRefund,
  RefundStatus,
  AdminDecision,
  AiDraftSession,
  DraftSessionStatus,
  DraftImageItem,
  AiBatchItem,
  RevenueCertification,
  RevenueCertificationStatus,
  Badge,
  UserBadge,
  BlogPost,
  UserBlogStyle,
  TrendKeyword,
  MembershipTier,
  FeatureItem,
  TierFeature,
  UserMembership,
  MembershipSourceType,
  Product,
  Purchase,
  UsageLog,
  UsagePeriod,
} from '../types';
import { extractNaverBlogId, extractNaverPostId, getCanonicalNaverPostUrl, generateBlogPostKey } from '../utils/blogUtils';
import { DEFAULT_INITIAL_BADGES, findNewlyQualifiedBadges, calculateUserMetrics } from '../utils/badgeEvaluator';
import { TrendCategoryItem, DEFAULT_TREND_CATEGORIES, MIN_GOLDEN_SEARCH_VOLUME } from '../config/categories';
import { NavigationTabItem, DEFAULT_NAVIGATION_TABS, getStoredNavigationTabs, saveStoredNavigationTabs } from '../config/navigation';
import {
  DEFAULT_MEMBERSHIP_TIERS,
  DEFAULT_FEATURES,
  DEFAULT_TIER_FEATURES,
  DEFAULT_PRODUCTS,
} from '../config/membershipDefaults';
import {
  getCachedTiers,
  setCachedTiers,
  getCachedFeatures,
  setCachedFeatures,
  getCachedTierFeatures,
  setCachedTierFeatures,
  getCachedUserMemberships,
  setCachedUserMemberships,
  getCachedProducts,
  setCachedProducts,
  getCachedPurchases,
  setCachedPurchases,
  addCachedUsageLog,
  getKstPeriodStartDate,
} from '../services/membershipService';
import { MainTabType } from '../components/Header';

const LOCAL_STORAGE_URL_KEY = 'supabase_config_url';
const LOCAL_STORAGE_ANON_KEY = 'supabase_config_anon_key';

export const getStoredSupabaseConfig = () => {
  const metaEnv = (typeof import.meta !== 'undefined' && (import.meta as any).env) || {};
  const procEnv = (typeof process !== 'undefined' && process.env) || {};

  const envUrl = metaEnv.VITE_SUPABASE_URL || procEnv.VITE_SUPABASE_URL || procEnv.SUPABASE_URL || '';
  const envKey =
    metaEnv.VITE_SUPABASE_ANON_KEY ||
    procEnv.SUPABASE_SERVICE_ROLE_KEY ||
    procEnv.VITE_SUPABASE_ANON_KEY ||
    procEnv.SUPABASE_ANON_KEY ||
    '';

  let localUrl = '';
  let localKey = '';
  if (typeof localStorage !== 'undefined') {
    try {
      localUrl = localStorage.getItem(LOCAL_STORAGE_URL_KEY) || '';
      localKey = localStorage.getItem(LOCAL_STORAGE_ANON_KEY) || '';
    } catch {
      // ignore
    }
  }

  const url = (envUrl && envUrl.trim()) ? envUrl.trim() : (localUrl && localUrl.trim()) ? localUrl.trim() : '';
  const key = (envKey && envKey.trim()) ? envKey.trim() : (localKey && localKey.trim()) ? localKey.trim() : '';

  return { url, key, isEnvConfigured: Boolean(envUrl && envKey) };
};

export const saveStoredSupabaseConfig = (url: string, key: string) => {
  if (typeof localStorage === 'undefined') return;
  try {
    if (url.trim()) {
      localStorage.setItem(LOCAL_STORAGE_URL_KEY, url.trim());
    } else {
      localStorage.removeItem(LOCAL_STORAGE_URL_KEY);
    }

    if (key.trim()) {
      localStorage.setItem(LOCAL_STORAGE_ANON_KEY, key.trim());
    } else {
      localStorage.removeItem(LOCAL_STORAGE_ANON_KEY);
    }
  } catch {
    // ignore
  }
};

let cachedClient: SupabaseClient | null = null;
let cachedConfigKey = '';

export const getSupabaseClient = (): SupabaseClient | null => {
  const { url, key } = getStoredSupabaseConfig();
  if (!url || !key) return null;

  const currentKey = `${url}::${key}`;
  if (cachedClient && cachedConfigKey === currentKey) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, key);
    cachedConfigKey = currentKey;
    return cachedClient;
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    return null;
  }
};

// SQL Schema Definition for reference and copy-paste in UI
export const SUPABASE_SQL_SCHEMA = `-- =========================================================
-- 챌린지 모니터링 대시보드 Supabase 테이블 생성 SQL 쿼리
-- Supabase 대시보드 > SQL Editor 에서 아래 쿼리를 복사하여 실행하세요.
-- =========================================================

-- 1. 챌린지 그룹 테이블 (challenges)
CREATE TABLE IF NOT EXISTS public.challenges (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT DEFAULT 'both',
  recruiting_start_date DATE,
  recruiting_end_date DATE,
  start_date DATE,
  end_date DATE,
  mission_days JSONB DEFAULT '["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]'::jsonb,
  goal_unit TEXT DEFAULT 'daily',
  target_blog_post_count INT DEFAULT 1,
  target_tweet_count INT DEFAULT 1,
  target_reply_count INT DEFAULT 3,
  
  -- 참가비 및 환급 설정 (정수 원 단위)
  participation_fee INT DEFAULT 0,
  fee INT DEFAULT 0,
  refund_enabled BOOLEAN DEFAULT false,
  refund_fee INT DEFAULT 0,
  refund_amount INT DEFAULT 0,
  refund_type TEXT DEFAULT 'full',
  refund_condition_type TEXT DEFAULT 'NONE', -- 'NONE', 'ATTENDANCE_RATE', 'POST_COUNT', 'MISSION_COMPLETE', 'CUSTOM'
  refund_condition_value INT DEFAULT 0,
  refund_threshold INT DEFAULT 80,
  refund_condition TEXT,
  
  -- 입금 계좌 안내 정보
  bank_name TEXT,
  account_number TEXT,
  account_holder TEXT,
  bank_account TEXT,
  bank_owner TEXT,
  deposit_deadline TIMESTAMPTZ,
  deposit_notice TEXT,
  
  rules TEXT,
  status TEXT DEFAULT 'recruiting',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 참가자 계정 테이블 (participants)
CREATE TABLE IF NOT EXISTS public.participants (
  id TEXT PRIMARY KEY,
  group_name TEXT NOT NULL,
  participant_name TEXT NOT NULL,
  platform_type TEXT NOT NULL, -- 'blog', 'twitter', 'both'
  blog_id TEXT,
  daily_post_count INT DEFAULT 0,
  daily_visitor_count INT DEFAULT 0,
  twitter_id TEXT,
  tweet_count INT DEFAULT 0,
  reply_count INT DEFAULT 0,
  start_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 일별 통계 데이터 테이블 (daily_stats)
CREATE TABLE IF NOT EXISTS public.daily_stats (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  participant_id TEXT REFERENCES public.participants(id) ON DELETE CASCADE,
  record_date DATE NOT NULL,
  blog_posts INT DEFAULT 0,
  blog_visitors INT DEFAULT 0,
  tweets INT DEFAULT 0,
  replies INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 프로필 정보 테이블 (profiles)
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  naver_id TEXT,
  twitter_id TEXT,
  blog_rss_url TEXT,
  role TEXT DEFAULT 'user',
  subscription_plan TEXT DEFAULT 'free',
  monthly_text_generation_count INT DEFAULT 0,
  monthly_card_generation_count INT DEFAULT 0,
  
  -- 환급 계좌 정보
  refund_bank_name TEXT,
  refund_account_number TEXT,
  refund_account_holder TEXT,
  
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4-1. 사용자 환급 계좌 별도 테이블 (user_refund_accounts - 선택)
CREATE TABLE IF NOT EXISTS public.user_refund_accounts (
  user_id TEXT PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_holder TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 공지사항 테이블 (announcements)
CREATE TABLE IF NOT EXISTS public.announcements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_important BOOLEAN DEFAULT false,
  is_published BOOLEAN DEFAULT true,
  target_challenge_id TEXT,
  external_link_url TEXT,
  external_link_label TEXT,
  author_name TEXT DEFAULT '운영자',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 기존 announcements 테이블 컬럼 추가 마이그레이션 (이미 생성된 경우)
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS is_important BOOLEAN DEFAULT false;
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT true;
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS target_challenge_id TEXT;
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS external_link_url TEXT;
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS external_link_label TEXT;
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS author_name TEXT DEFAULT '운영자';
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'notice';
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 5-1. 자주 묻는 질문 FAQ 테이블 (faqs)
CREATE TABLE IF NOT EXISTS public.faqs (
  id TEXT PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category TEXT DEFAULT '일반',
  is_published BOOLEAN DEFAULT true,
  order_index INT DEFAULT 0,
  author_name TEXT DEFAULT '운영자',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5-2. 회원 질문 & 관리자 답변 게시판 테이블 (qna_posts)
CREATE TABLE IF NOT EXISTS public.qna_posts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  user_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_email TEXT,
  is_secret BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending',
  answer_content TEXT,
  answered_at TIMESTAMPTZ,
  answered_by TEXT DEFAULT '운영자',
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. 챌린지 자료실 테이블 (resources)
CREATE TABLE IF NOT EXISTS public.resources (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  resource_type TEXT DEFAULT 'pdf',
  file_url TEXT,
  link_url TEXT,
  content TEXT,
  visibility TEXT DEFAULT 'all',
  target_group TEXT DEFAULT 'all',
  target_group_ids JSONB DEFAULT '[]'::jsonb,
  target_group_names JSONB DEFAULT '[]'::jsonb,
  week_number INT DEFAULT 1,
  order_index INT DEFAULT 1,
  is_required BOOLEAN DEFAULT false,
  is_published BOOLEAN DEFAULT true,
  download_count INT DEFAULT 0,
  created_by TEXT DEFAULT '운영자',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. 사이트 방문자 로그 테이블 (site_visits)
CREATE TABLE IF NOT EXISTS public.site_visits (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  user_id TEXT,               -- 로그인 회원 식별자
  visitor_id TEXT NOT NULL,   -- 익명 식별자 (localStorage random UUID)
  session_id TEXT,            -- 세션 식별자 (sessionStorage)
  visited_at TIMESTAMPTZ DEFAULT NOW(),
  visited_date DATE DEFAULT CURRENT_DATE,
  page_path TEXT DEFAULT '/'
);

-- 8. 챌린지 결제 및 입금 확인 테이블 (challenge_payments)
CREATE TABLE IF NOT EXISTS public.challenge_payments (
  id TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  participant_id TEXT,
  user_id TEXT NOT NULL,
  user_name TEXT,
  user_email TEXT,
  user_naver_id TEXT,
  user_twitter_id TEXT,
  amount INT NOT NULL DEFAULT 0,
  depositor_name TEXT NOT NULL,
  deposited_at DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted', -- 'pending', 'submitted', 'approved', 'rejected'
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  rejection_reason TEXT,
  refund_status TEXT DEFAULT 'none',
  refund_amount INT DEFAULT 0,
  refunded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. 챌린지 참가비 환급 관리 테이블 (challenge_refunds)
CREATE TABLE IF NOT EXISTS public.challenge_refunds (
  id TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  participant_id TEXT NOT NULL,
  participant_name TEXT NOT NULL,
  user_id TEXT,
  user_email TEXT,
  payment_id TEXT,

  target_amount INT NOT NULL DEFAULT 0,
  eligible_amount INT NOT NULL DEFAULT 0,
  achievement_rate INT NOT NULL DEFAULT 0,
  refund_threshold INT NOT NULL DEFAULT 80,
  target_goal_count INT NOT NULL DEFAULT 0,
  actual_goal_count INT NOT NULL DEFAULT 0,

  bank_name TEXT,
  bank_account TEXT,
  bank_owner TEXT,

  eligibility_status TEXT NOT NULL DEFAULT 'eligible', -- 'eligible', 'ineligible', 'review_required'
  refund_status TEXT NOT NULL DEFAULT 'pending_review', -- 'pending_review', 'eligible', 'approved', 'completed', 'rejected'
  content_review_status TEXT NOT NULL DEFAULT 'not_checked', -- 'valid', 'suspicious', 'insufficient_data', 'not_checked'

  reviewed_posts_count INT DEFAULT 0,
  valid_posts_count INT DEFAULT 0,
  invalid_posts_count INT DEFAULT 0,
  post_items JSONB DEFAULT '[]'::jsonb,

  admin_decision TEXT DEFAULT 'pending',
  admin_decision_reason TEXT,
  memo TEXT,

  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  completed_by TEXT,
  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. 수익 인증 명예의 전당 테이블 (revenue_certifications)
CREATE TABLE IF NOT EXISTS public.revenue_certifications (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  user_email TEXT,
  user_name TEXT,
  naver_blog_id TEXT,
  challenge_id TEXT,
  challenge_name TEXT,
  revenue_amount NUMERIC NOT NULL DEFAULT 0,
  proof_image_url TEXT,
  proof_image_urls JSONB DEFAULT '[]'::jsonb,
  certification_date DATE DEFAULT CURRENT_DATE,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'submitted', -- 'submitted', 'approved', 'rejected'
  rejection_reason TEXT,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  is_featured BOOLEAN DEFAULT false,
  likes_count INT DEFAULT 0,
  liked_user_ids JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. 성과 뱃지 정의 테이블 (badges)
CREATE TABLE IF NOT EXISTS public.badges (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '🌱',
  color TEXT DEFAULT '#10B981',
  category TEXT DEFAULT '수익',
  condition_type TEXT NOT NULL, -- 'blog_post_count', 'consecutive_days', 'profit_verification_count', 'accumulated_profit_amount', etc.
  condition_value NUMERIC NOT NULL DEFAULT 1,
  condition_metadata JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. 사용자 획득 뱃지 테이블 (user_badges)
CREATE TABLE IF NOT EXISTS public.user_badges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  badge_id TEXT NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT user_badge_unique_earned UNIQUE (user_id, badge_id)
);

-- 13. AI 초안 생성 작업 세션 테이블 (ai_draft_sessions)
CREATE TABLE IF NOT EXISTS public.ai_draft_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_email TEXT,
  user_name TEXT,
  title TEXT,
  keyword TEXT NOT NULL,
  keywords JSONB DEFAULT '[]'::jsonb,
  style TEXT DEFAULT 'review',
  status TEXT NOT NULL DEFAULT 'drafting', -- 'drafting', 'temporary', 'completed', 'saved', 'expired'
  last_step TEXT DEFAULT 'keyword', -- 'keyword', 'golden_keyword', 'draft', 'image_search', 'ai_image_generation', 'card_news', 'completed'
  writing_context JSONB DEFAULT '{}'::jsonb,
  options JSONB DEFAULT '{}'::jsonb,
  batch_items JSONB DEFAULT '[]'::jsonb,
  seo_plan JSONB,
  draft_content TEXT,
  final_html TEXT,
  images JSONB DEFAULT '[]'::jsonb,
  card_news JSONB,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

-- 14. AI 수익화 툴킷 시스템 프롬프트 관리 테이블 (ai_toolkit_prompts)
CREATE TABLE IF NOT EXISTS public.ai_toolkit_prompts (
  id TEXT PRIMARY KEY DEFAULT ('prompt_' || gen_random_uuid()::text),
  prompt_key TEXT UNIQUE NOT NULL,
  prompt_name TEXT NOT NULL,
  prompt_content TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general',
  is_active BOOLEAN DEFAULT true,
  version INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT DEFAULT 'admin'
);

-- 15. AI 수익화 툴킷 프롬프트 버전 히스토리 테이블 (ai_toolkit_prompt_versions)
CREATE TABLE IF NOT EXISTS public.ai_toolkit_prompt_versions (
  id TEXT PRIMARY KEY DEFAULT ('ver_' || gen_random_uuid()::text),
  prompt_key TEXT NOT NULL,
  prompt_id TEXT,
  version INT NOT NULL,
  prompt_content TEXT NOT NULL,
  change_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT DEFAULT 'admin'
);

-- 16. 네이버 블로그 포스팅 독립 원장 테이블 (blog_posts)
-- 포스팅 자체와 챌린지 참여를 분리하여 동일 포스팅 중복 집계를 원천 차단
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id TEXT PRIMARY KEY,               -- 'post_' || blog_id || '_' || post_id
  blog_id TEXT NOT NULL,             -- 네이버 블로그 아이디 (소문자 정규화)
  post_id TEXT,                      -- 포스팅 번호(logNo)
  post_url TEXT NOT NULL,            -- 표준(Canonical) 포스팅 URL
  title TEXT NOT NULL,               -- 글 제목
  published_at TIMESTAMPTZ,          -- 발행 일시
  published_date DATE NOT NULL,      -- 발행 일자 (YYYY-MM-DD)
  user_id TEXT,                      -- 작성자 회원 ID (선택)
  participant_id TEXT,               -- 참가자 ID (선택)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT blog_post_unique_canonical UNIQUE (blog_id, post_url)
);

-- 17. 사용자 블로그 출력 서식 설정 테이블 (user_blog_styles)
CREATE TABLE IF NOT EXISTS public.user_blog_styles (
  id TEXT PRIMARY KEY DEFAULT ('style_' || gen_random_uuid()::text),
  user_id TEXT UNIQUE NOT NULL,
  font_family TEXT DEFAULT 'nanum_gothic',
  font_size TEXT DEFAULT '15pt',
  text_color TEXT DEFAULT '#000000',
  background_color TEXT DEFAULT 'transparent',
  text_align TEXT DEFAULT 'center',
  line_height TEXT DEFAULT '1.8',
  paragraph_spacing TEXT DEFAULT '18px',
  h2_style TEXT DEFAULT 'quote2',
  h2_color TEXT DEFAULT '#03c75a',
  h2_font_size TEXT DEFAULT '19pt',
  h2_auto_numbering BOOLEAN DEFAULT false,
  emphasis_style TEXT DEFAULT 'bold',
  emphasis_color TEXT DEFAULT '#ff9300',
  wrap_long_sentences BOOLEAN DEFAULT true,
  separate_paragraphs BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 18. 네이버 데이터랩 및 검색광고 트렌드/황금 키워드 테이블 (trend_keywords)
CREATE TABLE IF NOT EXISTS public.trend_keywords (
  id TEXT PRIMARY KEY DEFAULT ('tk_' || gen_random_uuid()::text),
  category TEXT NOT NULL,                         -- 카테고리 (여행, 맛집, 뷰티, 생활/편의 등)
  keyword TEXT NOT NULL,                          -- 검색 키워드
  pc_search_volume INTEGER DEFAULT 0,            -- 월간 PC 검색량
  mobile_search_volume INTEGER DEFAULT 0,        -- 월간 모바일 검색량
  competition_index TEXT DEFAULT '보통',          -- 경쟁 정도 ('낮음', '중간', '높음' 등)
  collected_at TIMESTAMPTZ DEFAULT NOW(),        -- 수집 일시
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT trend_keywords_cat_kw_unique UNIQUE (category, keyword)
);

-- 19. 일자별 트렌드 키워드 집계 이력 테이블 (trend_keyword_daily)
CREATE TABLE IF NOT EXISTS public.trend_keyword_daily (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  category TEXT NOT NULL,
  keyword TEXT NOT NULL,
  collected_date DATE NOT NULL DEFAULT CURRENT_DATE,
  pc_search_volume INTEGER DEFAULT 0,
  mobile_search_volume INTEGER DEFAULT 0,
  total_volume INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT trend_keyword_daily_unique UNIQUE (category, keyword, collected_date)
);

-- 20. 사이트 네비게이션 및 메뉴 탭 전역 설정 테이블 (app_settings)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT DEFAULT 'admin'
);

-- 21. 구매/이용 등급 테이블 (membership_tiers)
CREATE TABLE IF NOT EXISTS public.membership_tiers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 22. 기능 목록 정의 테이블 (features)
CREATE TABLE IF NOT EXISTS public.features (
  id TEXT PRIMARY KEY,
  feature_key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'ai_draft',
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 23. 등급별 기능 권한 및 사용량 제한 테이블 (tier_features)
CREATE TABLE IF NOT EXISTS public.tier_features (
  id TEXT PRIMARY KEY DEFAULT ('tf_' || gen_random_uuid()::text),
  tier_id TEXT NOT NULL REFERENCES public.membership_tiers(id) ON DELETE CASCADE,
  feature_id TEXT NOT NULL REFERENCES public.features(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT true,
  usage_limit INT, -- NULL = 제한 없음
  usage_period TEXT DEFAULT 'none', -- 'none', 'daily', 'weekly', 'monthly'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT tier_features_tier_feature_unique UNIQUE (tier_id, feature_id)
);

-- 24. 사용자별 구매/부여 등급 연결 테이블 (user_memberships)
CREATE TABLE IF NOT EXISTS public.user_memberships (
  id TEXT PRIMARY KEY DEFAULT ('um_' || gen_random_uuid()::text),
  user_id TEXT NOT NULL, -- email, profile id, or normalized key
  tier_id TEXT NOT NULL REFERENCES public.membership_tiers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'expired', 'cancelled'
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  source_type TEXT DEFAULT 'manual', -- 'manual', 'challenge', 'product_purchase', 'admin', 'subscription'
  source_id TEXT, -- challenge_id, purchase_id 등
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT user_memberships_user_unique UNIQUE (user_id)
);

-- 25. 상품 정의 테이블 (products)
CREATE TABLE IF NOT EXISTS public.products (
  id TEXT PRIMARY KEY, -- e.g. 'prod_basic_1m', 'prod_pro_1m'
  name TEXT NOT NULL,
  description TEXT,
  product_type TEXT NOT NULL DEFAULT 'membership', -- 'membership', 'ai_usage', 'challenge', 'general'
  price INTEGER NOT NULL DEFAULT 0,
  original_price INTEGER,
  membership_tier TEXT REFERENCES public.membership_tiers(id) ON DELETE SET NULL,
  duration_days INTEGER, -- 일수 (30, 90 등, NULL=무제한)
  ai_usage_add_count INTEGER,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  features JSONB DEFAULT '[]'::jsonb,
  badge TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 26. 결제 및 구매 내역 테이블 (purchases)
CREATE TABLE IF NOT EXISTS public.purchases (
  id TEXT PRIMARY KEY DEFAULT ('pur_' || gen_random_uuid()::text),
  user_id TEXT NOT NULL,
  user_name TEXT,
  user_email TEXT,
  product_id TEXT REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  product_type TEXT NOT NULL DEFAULT 'membership',
  amount INTEGER NOT NULL DEFAULT 0,
  payment_method TEXT DEFAULT 'bank_transfer', -- 'bank_transfer', 'credit_card', 'challenge_included', 'admin_grant'
  status TEXT NOT NULL DEFAULT 'completed', -- 'pending', 'completed', 'cancelled', 'refunded'
  source_type TEXT DEFAULT 'product_purchase', -- 'manual', 'challenge', 'product_purchase', 'admin'
  source_id TEXT, -- challenge_id, pg_tid 등
  notes TEXT,
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 27. 기능별 사용량 기록 테이블 (usage_logs)
CREATE TABLE IF NOT EXISTS public.usage_logs (
  id TEXT PRIMARY KEY DEFAULT ('ul_' || gen_random_uuid()::text),
  user_id TEXT NOT NULL,
  feature_id TEXT,
  feature_key TEXT NOT NULL,
  used_at TIMESTAMPTZ DEFAULT NOW(),
  request_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_site_visits_visited_at ON public.site_visits(visited_at);
CREATE INDEX IF NOT EXISTS idx_site_visits_visited_date ON public.site_visits(visited_date);
CREATE INDEX IF NOT EXISTS idx_challenge_payments_user_id ON public.challenge_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_challenge_payments_challenge_id ON public.challenge_payments(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_refunds_challenge_id ON public.challenge_refunds(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_refunds_participant_id ON public.challenge_refunds(participant_id);
CREATE INDEX IF NOT EXISTS idx_challenge_refunds_refund_status ON public.challenge_refunds(refund_status);
CREATE INDEX IF NOT EXISTS idx_revenue_cert_user ON public.revenue_certifications(user_id, status);
CREATE INDEX IF NOT EXISTS idx_badges_sort ON public.badges(sort_order, is_active);
CREATE INDEX IF NOT EXISTS idx_user_badges_lookup ON public.user_badges(user_id, badge_id);
CREATE INDEX IF NOT EXISTS idx_ai_draft_user_status ON public.ai_draft_sessions(user_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_draft_expires ON public.ai_draft_sessions(expires_at) WHERE status IN ('drafting', 'temporary');
CREATE INDEX IF NOT EXISTS idx_ai_toolkit_prompts_key ON public.ai_toolkit_prompts(prompt_key);
CREATE INDEX IF NOT EXISTS idx_ai_toolkit_prompt_versions_key ON public.ai_toolkit_prompt_versions(prompt_key, version DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_blog_date ON public.blog_posts(blog_id, published_date);
CREATE INDEX IF NOT EXISTS idx_blog_posts_url ON public.blog_posts(post_url);
CREATE INDEX IF NOT EXISTS idx_user_blog_styles_user ON public.user_blog_styles(user_id);
CREATE INDEX IF NOT EXISTS idx_trend_keywords_cat ON public.trend_keywords(category);
CREATE INDEX IF NOT EXISTS idx_trend_keywords_vol ON public.trend_keywords((pc_search_volume + mobile_search_volume) DESC);
CREATE INDEX IF NOT EXISTS idx_trend_kw_daily_date ON public.trend_keyword_daily(collected_date DESC);
CREATE INDEX IF NOT EXISTS idx_trend_kw_daily_cat_date ON public.trend_keyword_daily(category, collected_date DESC);
CREATE INDEX IF NOT EXISTS idx_trend_kw_daily_vol ON public.trend_keyword_daily(total_volume DESC);
CREATE INDEX IF NOT EXISTS idx_membership_tiers_sort ON public.membership_tiers(sort_order, is_active);
CREATE INDEX IF NOT EXISTS idx_features_key ON public.features(feature_key);
CREATE INDEX IF NOT EXISTS idx_tier_features_lookup ON public.tier_features(tier_id, feature_id);
CREATE INDEX IF NOT EXISTS idx_user_memberships_user ON public.user_memberships(user_id, status);
CREATE INDEX IF NOT EXISTS idx_products_type_sort ON public.products(product_type, sort_order, is_active);
CREATE INDEX IF NOT EXISTS idx_purchases_user_id ON public.purchases(user_id, status);
CREATE INDEX IF NOT EXISTS idx_purchases_purchased_at ON public.purchases(purchased_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_feat_date ON public.usage_logs(user_id, feature_key, used_at DESC);

-- Row Level Security (RLS) 활성화 및 정책
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_refund_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenue_certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_draft_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_toolkit_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_toolkit_prompt_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_blog_styles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trend_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trend_keyword_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tier_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read/write on membership_tiers" ON public.membership_tiers;
CREATE POLICY "Allow public read/write on membership_tiers" ON public.membership_tiers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write on features" ON public.features;
CREATE POLICY "Allow public read/write on features" ON public.features FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write on tier_features" ON public.tier_features;
CREATE POLICY "Allow public read/write on tier_features" ON public.tier_features FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write on user_memberships" ON public.user_memberships;
CREATE POLICY "Allow public read/write on user_memberships" ON public.user_memberships FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write on products" ON public.products;
CREATE POLICY "Allow public read/write on products" ON public.products FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write on purchases" ON public.purchases;
CREATE POLICY "Allow public read/write on purchases" ON public.purchases FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write on usage_logs" ON public.usage_logs;
CREATE POLICY "Allow public read/write on usage_logs" ON public.usage_logs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write on challenges" ON public.challenges;
CREATE POLICY "Allow public read/write on challenges" ON public.challenges FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write on participants" ON public.participants;
CREATE POLICY "Allow public read/write on participants" ON public.participants FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write on daily_stats" ON public.daily_stats;
CREATE POLICY "Allow public read/write on daily_stats" ON public.daily_stats FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write on profiles" ON public.profiles;
CREATE POLICY "Allow public read/write on profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write on user_refund_accounts" ON public.user_refund_accounts;
CREATE POLICY "Allow public read/write on user_refund_accounts" ON public.user_refund_accounts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write on announcements" ON public.announcements;
CREATE POLICY "Allow public read/write on announcements" ON public.announcements FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write on faqs" ON public.faqs;
CREATE POLICY "Allow public read/write on faqs" ON public.faqs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write on qna_posts" ON public.qna_posts;
CREATE POLICY "Allow public read/write on qna_posts" ON public.qna_posts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write on resources" ON public.resources;
CREATE POLICY "Allow public read/write on resources" ON public.resources FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public insert on site_visits" ON public.site_visits;
CREATE POLICY "Allow public insert on site_visits" ON public.site_visits FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public select on site_visits" ON public.site_visits;
CREATE POLICY "Allow public select on site_visits" ON public.site_visits FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read/write on challenge_payments" ON public.challenge_payments;
CREATE POLICY "Allow public read/write on challenge_payments" ON public.challenge_payments FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write on challenge_refunds" ON public.challenge_refunds;
CREATE POLICY "Allow public read/write on challenge_refunds" ON public.challenge_refunds FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write on revenue_certifications" ON public.revenue_certifications;
CREATE POLICY "Allow public read/write on revenue_certifications" ON public.revenue_certifications FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write on badges" ON public.badges;
CREATE POLICY "Allow public read/write on badges" ON public.badges FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write on user_badges" ON public.user_badges;
CREATE POLICY "Allow public read/write on user_badges" ON public.user_badges FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow users read/write on ai_draft_sessions" ON public.ai_draft_sessions;
CREATE POLICY "Allow users read/write on ai_draft_sessions" ON public.ai_draft_sessions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow users read/write on ai_toolkit_prompts" ON public.ai_toolkit_prompts;
CREATE POLICY "Allow users read/write on ai_toolkit_prompts" ON public.ai_toolkit_prompts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow users read/write on ai_toolkit_prompt_versions" ON public.ai_toolkit_prompt_versions;
CREATE POLICY "Allow users read/write on ai_toolkit_prompt_versions" ON public.ai_toolkit_prompt_versions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write on blog_posts" ON public.blog_posts;
CREATE POLICY "Allow public read/write on blog_posts" ON public.blog_posts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write on user_blog_styles" ON public.user_blog_styles;
CREATE POLICY "Allow public read/write on user_blog_styles" ON public.user_blog_styles FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write on trend_keywords" ON public.trend_keywords;
CREATE POLICY "Allow public read/write on trend_keywords" ON public.trend_keywords FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write on trend_keyword_daily" ON public.trend_keyword_daily;
CREATE POLICY "Allow public read/write on trend_keyword_daily" ON public.trend_keyword_daily FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write on app_settings" ON public.app_settings;
CREATE POLICY "Allow public read/write on app_settings" ON public.app_settings FOR ALL USING (true) WITH CHECK (true);


-- 16. 사이트 방문자 및 회원 수 실시간 집계 RPC 함수
CREATE OR REPLACE FUNCTION public.get_site_visitor_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  daily_count INT;
  weekly_count INT;
  total_count INT;
  member_count INT;
BEGIN
  -- 일간 Unique Visitor (KST/UTC 당일)
  SELECT COUNT(DISTINCT COALESCE(user_id, visitor_id))
  INTO daily_count
  FROM public.site_visits
  WHERE visited_at >= CURRENT_DATE;

  -- 주간 Unique Visitor (최근 7일)
  SELECT COUNT(DISTINCT COALESCE(user_id, visitor_id))
  INTO weekly_count
  FROM public.site_visits
  WHERE visited_at >= (CURRENT_DATE - INTERVAL '6 days');

  -- 누적 전체 Unique Visitor
  SELECT COUNT(DISTINCT COALESCE(user_id, visitor_id))
  INTO total_count
  FROM public.site_visits;

  -- 총 가입 회원 수 (profiles 우선, 없으면 participants unique name)
  SELECT COUNT(*) INTO member_count FROM public.profiles;
  IF member_count = 0 OR member_count IS NULL THEN
    SELECT COUNT(DISTINCT participant_name) INTO member_count FROM public.participants;
  END IF;

  RETURN json_build_object(
    'dailyVisitors', COALESCE(daily_count, 0),
    'weeklyVisitors', COALESCE(weekly_count, 0),
    'totalVisitors', COALESCE(total_count, 0),
    'totalMembers', COALESCE(member_count, 0)
  );
END;
$$;
`;

// SQL Purge Query for cleaning up legacy dummy/test records in Supabase SQL Editor
export const SUPABASE_PURGE_DUMMY_SQL = `-- =========================================================
-- 더미/테스트 데이터 완전 삭제 SQL (Supabase SQL Editor 실행용)
-- =========================================================
-- 1. 임의 생성된 더미 ID 레코드 (p1, p2, p3, p4, p5, test, sample 등) 일별 통계 삭제
DELETE FROM public.daily_stats 
WHERE participant_id IN ('p1', 'p2', 'p3', 'p4', 'p5', 'test', 'sample', 'demo')
   OR participant_id NOT LIKE 'p_user_%';

-- 2. 임의 생성된 더미 참가자 레코드 완전 삭제
DELETE FROM public.participants 
WHERE id IN ('p1', 'p2', 'p3', 'p4', 'p5', 'test', 'sample', 'demo')
   OR id NOT LIKE 'p_user_%';
`;

// SQL Deduplication & Schema Update for Supabase SQL Editor
export const SUPABASE_BLOG_POSTS_DEDUPLICATION_SQL = `-- =========================================================
-- [1. 네이버 블로그 포스팅 독립 원장 테이블 생성 및 중복 방지 인덱스]
-- =========================================================
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id TEXT PRIMARY KEY,               -- 'post_' || blog_id || '_' || post_id
  blog_id TEXT NOT NULL,             -- 네이버 블로그 아이디 (소문자 정규화)
  post_id TEXT,                      -- 포스팅 번호(logNo)
  post_url TEXT NOT NULL,            -- 표준(Canonical) 포스팅 URL
  title TEXT NOT NULL,               -- 글 제목
  published_at TIMESTAMPTZ,          -- 발행 일시
  published_date DATE NOT NULL,      -- 발행 일자 (YYYY-MM-DD)
  user_id TEXT,                      -- 작성자 회원 ID (선택)
  participant_id TEXT,               -- 참가자 ID (선택)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT blog_post_unique_canonical UNIQUE (blog_id, post_url)
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_blog_date ON public.blog_posts(blog_id, published_date);
CREATE INDEX IF NOT EXISTS idx_blog_posts_url ON public.blog_posts(post_url);

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read/write on blog_posts" ON public.blog_posts;
CREATE POLICY "Allow public read/write on blog_posts" ON public.blog_posts FOR ALL USING (true) WITH CHECK (true);

-- =========================================================
-- [2. 기존 중복 등록된 통계/데이터 정리 및 고유 포스팅 원장 마이그레이션]
-- =========================================================
-- 동일 블로그의 동일 날짜에 대한 daily_stats 중복 레코드가 있을 경우 최신 레코드만 유지
DELETE FROM public.daily_stats a USING public.daily_stats b
WHERE a.id < b.id 
  AND a.participant_id = b.participant_id 
  AND a.record_date = b.record_date;
`;


// Fetch Challenges from Supabase
export async function fetchGroupsFromSupabase(): Promise<ChallengeGroup[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('challenges')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Supabase fetch groups error:', error);
      return null;
    }

    if (!data) return [];

    return data.map((row: any) => {
      const cat = row.category || 'both';
      return {
        id: row.id,
        name: row.name,
        description: row.description || '',
        category: cat,
        startDate: row.start_date || '',
        endDate: row.end_date || '',
        missionDays: row.mission_days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        goalUnit: row.goal_unit || 'daily',
        targetBlogPostCount: row.target_blog_post_count !== undefined && row.target_blog_post_count !== null
          ? Number(row.target_blog_post_count)
          : (cat === 'twitter' ? 0 : 10),
        targetTweetCount: row.target_tweet_count !== undefined && row.target_tweet_count !== null
          ? Number(row.target_tweet_count)
          : (cat === 'blog' ? 0 : 10),
        targetReplyCount: row.target_reply_count !== undefined && row.target_reply_count !== null
          ? Number(row.target_reply_count)
          : (cat === 'blog' ? 0 : 20),
        fee: row.fee !== undefined && row.fee !== null ? Number(row.fee) : 0,
        refundFee: row.refund_fee !== undefined && row.refund_fee !== null ? Number(row.refund_fee) : 0,
        bankAccount: row.bank_account || '',
        bankOwner: row.bank_owner || '',
        rules: row.rules || '',
        refundCondition: row.refund_condition || '',
        recruitingStartDate: row.recruiting_start_date || '',
        recruitingEndDate: row.recruiting_end_date || '',
        status: row.status || undefined,
      };
    });
  } catch (err) {
    console.error('Supabase fetch groups exception:', err);
    return null;
  }
}

// Add / Upsert Challenge to Supabase
export async function saveGroupToSupabase(group: ChallengeGroup): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  const fullPayload: any = {
    id: group.id,
    name: group.name,
    description: group.description,
    category: group.category,
    start_date: group.startDate,
    end_date: group.endDate,
    recruiting_start_date: group.recruitingStartDate,
    recruiting_end_date: group.recruitingEndDate,
    mission_days: group.missionDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    goal_unit: group.goalUnit || 'daily',
    target_blog_post_count: group.targetBlogPostCount ?? 1,
    target_tweet_count: group.targetTweetCount ?? 1,
    target_reply_count: group.targetReplyCount ?? 3,
    fee: group.fee ?? 0,
    refund_fee: group.refundFee ?? 0,
    bank_account: group.bankAccount || '',
    bank_owner: group.bankOwner || '',
    rules: group.rules || '',
    refund_condition: group.refundCondition || '',
    status: group.status || 'recruiting',
  };

  try {
    const { error } = await client.from('challenges').upsert(fullPayload);

    if (error) {
      console.warn('Supabase save full group error (trying base payload):', error);
      const basePayload = {
        id: group.id,
        name: group.name,
        description: group.description,
        category: group.category,
        start_date: group.startDate,
        end_date: group.endDate,
      };
      const { error: baseError } = await client.from('challenges').upsert(basePayload);
      if (baseError) {
        console.error('Supabase save base group error:', baseError);
        return false;
      }
    }
    return true;
  } catch (err) {
    console.error('Supabase save group exception:', err);
    return false;
  }
}

// Delete Challenge from Supabase
export async function deleteGroupFromSupabase(id: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client.from('challenges').delete().eq('id', id);
    if (error) {
      console.error('Supabase delete group error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Supabase delete group exception:', err);
    return false;
  }
}

// Update Challenge in Supabase
export async function updateGroupInSupabase(group: ChallengeGroup): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  const fullPayload: any = {
    name: group.name,
    description: group.description,
    category: group.category,
    start_date: group.startDate,
    end_date: group.endDate,
    recruiting_start_date: group.recruitingStartDate,
    recruiting_end_date: group.recruitingEndDate,
    mission_days: group.missionDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    goal_unit: group.goalUnit || 'daily',
    target_blog_post_count: group.targetBlogPostCount ?? 1,
    target_tweet_count: group.targetTweetCount ?? 1,
    target_reply_count: group.targetReplyCount ?? 3,
    fee: group.fee ?? 0,
    refund_fee: group.refundFee ?? 0,
    bank_account: group.bankAccount || '',
    bank_owner: group.bankOwner || '',
    rules: group.rules || '',
    refund_condition: group.refundCondition || '',
    status: group.status || 'recruiting',
  };

  try {
    const { error } = await client
      .from('challenges')
      .update(fullPayload)
      .eq('id', group.id);

    if (error) {
      console.warn('Supabase update full group error (trying base payload):', error);
      const basePayload = {
        name: group.name,
        description: group.description,
        category: group.category,
        start_date: group.startDate,
        end_date: group.endDate,
      };
      const { error: baseError } = await client
        .from('challenges')
        .update(basePayload)
        .eq('id', group.id);

      if (baseError) {
        console.error('Supabase update base group error:', baseError);
        return await saveGroupToSupabase(group);
      }
    }
    return true;
  } catch (err) {
    console.error('Supabase update group exception:', err);
    return false;
  }
}

// Fetch Daily Stats Map from Supabase (daily_stats table)
export async function fetchDailyStatsFromSupabase(): Promise<Record<string, { latestVisitors: number; latestPosts: number; latestTweets: number; latestReplies: number; history: any[] }> | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('daily_stats')
      .select('*')
      .order('record_date', { ascending: true });

    if (error || !data) return null;

    const statsMap: Record<string, { latestVisitors: number; latestPosts: number; latestTweets: number; latestReplies: number; history: any[] }> = {};

    data.forEach((row: any) => {
      const pid = row.participant_id;
      if (!statsMap[pid]) {
        statsMap[pid] = {
          latestVisitors: 0,
          latestPosts: 0,
          latestTweets: 0,
          latestReplies: 0,
          history: [],
        };
      }

      const recDate = row.record_date || new Date().toISOString().split('T')[0];
      const blogVis = Number(row.blog_visitors) || 0;
      const blogPosts = Number(row.blog_posts) || 0;
      const tweets = Number(row.tweets) || 0;
      const replies = Number(row.replies) || 0;

      statsMap[pid].history.push({
        date: recDate,
        blogPosts,
        blogVisitors: blogVis,
        tweets,
        replies,
      });

      // Update latest values (order by ascending date means last item is most recent)
      statsMap[pid].latestVisitors = blogVis > 0 ? blogVis : statsMap[pid].latestVisitors;
      statsMap[pid].latestPosts = blogPosts;
      statsMap[pid].latestTweets = tweets;
      statsMap[pid].latestReplies = replies;
    });

    return statsMap;
  } catch (err) {
    console.warn('Fetch daily stats exception:', err);
    return null;
  }
}

// Fetch Participants from Supabase with daily_stats linked
export async function fetchParticipantsFromSupabase(): Promise<Participant[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('participants')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase fetch participants error:', error);
      return null;
    }

    if (!data) return [];

    // Optionally fetch profiles to link missing blog_id/twitter_id
    let profileMap: Record<string, { naverId?: string; twitterId?: string }> = {};
    try {
      const { data: profs } = await client.from('profiles').select('name, email, naver_id, twitter_id');
      if (profs && Array.isArray(profs)) {
        profs.forEach((p: any) => {
          if (p.name) profileMap[p.name.trim().toLowerCase()] = { naverId: p.naver_id, twitterId: p.twitter_id };
          if (p.email) profileMap[p.email.trim().toLowerCase()] = { naverId: p.naver_id, twitterId: p.twitter_id };
        });
      }
    } catch {
      // Ignore profile lookup error
    }

    const dailyStatsMap = await fetchDailyStatsFromSupabase();

    const LEGACY_DUMMY_IDS = new Set(['p1', 'p2', 'p3', 'p4', 'p5', 'test', 'sample', 'demo', 'dummy', 'participant-1', 'participant-2']);

    const seenIds = new Set<string>();
    const validRows = data.filter((row: any) => {
      const pid = row.id;
      if (!pid) return false;
      if (LEGACY_DUMMY_IDS.has(pid)) return false;
      // Filter out records that are explicit dummy patterns and not user created
      if (!pid.startsWith('p_user_') && LEGACY_DUMMY_IDS.has(pid.toLowerCase())) return false;
      if (seenIds.has(pid)) return false;
      seenIds.add(pid);
      return true;
    });

    return validRows.map((row: any) => {
      const gName = row.group_name || '';
      const gNames = gName.split(',').map((s: string) => s.trim()).filter(Boolean);
      const pid = row.id;
      const stat = dailyStatsMap ? dailyStatsMap[pid] : null;

      const pNameKey = row.participant_name ? row.participant_name.trim().toLowerCase() : '';
      const pEmailKey = row.email ? row.email.trim().toLowerCase() : '';
      const linkedProfile = profileMap[pNameKey] || profileMap[pEmailKey] || {};

      const rawBlogId = row.blog_id || linkedProfile.naverId || '';
      const rawTwitterId = row.twitter_id || linkedProfile.twitterId || null;

      const dbVisitorCount = Number(row.daily_visitor_count) || 0;
      const dbPostCount = Number(row.daily_post_count) || 0;
      const dbTweetCount = Number(row.tweet_count) || 0;
      const dbReplyCount = Number(row.reply_count) || 0;

      const finalVisitorCount = stat && stat.latestVisitors > 0 ? Math.max(dbVisitorCount, stat.latestVisitors) : dbVisitorCount;
      const finalPostCount = stat && stat.latestPosts > 0 ? Math.max(dbPostCount, stat.latestPosts) : dbPostCount;
      const finalTweetCount = stat && stat.latestTweets > 0 ? Math.max(dbTweetCount, stat.latestTweets) : dbTweetCount;
      const finalReplyCount = stat && stat.latestReplies > 0 ? Math.max(dbReplyCount, stat.latestReplies) : dbReplyCount;

      return {
        id: pid,
        groupName: gName,
        groupNames: gNames,
        participantName: row.participant_name,
        platformType: row.platform_type || 'both',
        blogId: rawBlogId ? extractNaverBlogId(rawBlogId) || null : null,
        dailyPostCount: finalPostCount,
        dailyVisitorCount: finalVisitorCount,
        twitterId: rawTwitterId,
        tweetCount: finalTweetCount,
        replyCount: finalReplyCount,
        startDate: row.start_date || new Date().toISOString().split('T')[0],
        notes: row.notes || undefined,
        history: stat && stat.history.length > 0 ? stat.history : undefined,
      };
    });
  } catch (err) {
    console.error('Supabase fetch participants exception:', err);
    return null;
  }
}

// Add / Upsert Participant to Supabase
export async function saveParticipantToSupabase(participant: Participant): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client.from('participants').upsert({
      id: participant.id,
      group_name: participant.groupName,
      participant_name: participant.participantName,
      platform_type: participant.platformType,
      blog_id: participant.blogId,
      daily_post_count: participant.dailyPostCount,
      daily_visitor_count: participant.dailyVisitorCount,
      twitter_id: participant.twitterId,
      tweet_count: participant.tweetCount,
      reply_count: participant.replyCount,
      start_date: participant.startDate,
      notes: participant.notes || null,
    });

    if (error) {
      console.error('Supabase save participant error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Supabase save participant exception:', err);
    return false;
  }
}

// Update Participant in Supabase
export async function updateParticipantInSupabase(participant: Participant): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client
      .from('participants')
      .update({
        group_name: participant.groupName,
        participant_name: participant.participantName,
        platform_type: participant.platformType,
        blog_id: participant.blogId,
        daily_post_count: participant.dailyPostCount,
        daily_visitor_count: participant.dailyVisitorCount,
        twitter_id: participant.twitterId,
        tweet_count: participant.tweetCount,
        reply_count: participant.replyCount,
        start_date: participant.startDate,
        notes: participant.notes || null,
      })
      .eq('id', participant.id);

    if (error) {
      console.error('Supabase update participant error:', error);
      return await saveParticipantToSupabase(participant);
    }
    return true;
  } catch (err) {
    console.error('Supabase update participant exception:', err);
    return false;
  }
}

// Delete Participant from Supabase
export async function deleteParticipantFromSupabase(id: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    // Delete related daily_stats records first (in case foreign key cascade is missing)
    await client.from('daily_stats').delete().eq('participant_id', id);

    const { error } = await client.from('participants').delete().eq('id', id);
    if (error) {
      console.error('Supabase delete participant error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Supabase delete participant exception:', err);
    return false;
  }
}

// Permanently purge legacy dummy & test records from Supabase DB
export async function deleteDummyParticipantsFromSupabase(): Promise<{ deletedCount: number; message: string }> {
  const client = getSupabaseClient();
  if (!client) return { deletedCount: 0, message: 'Supabase가 연결되어 있지 않습니다.' };

  try {
    const dummyIds = ['p1', 'p2', 'p3', 'p4', 'p5', 'test', 'sample', 'demo', 'dummy', 'participant-1', 'participant-2'];

    // 1. Delete matching daily_stats records
    await client.from('daily_stats').delete().in('participant_id', dummyIds);

    // 2. Delete matching participants
    const { data: matchedData, error } = await client
      .from('participants')
      .delete()
      .in('id', dummyIds)
      .select('id');

    if (error) {
      console.warn('Supabase delete dummy participants warning:', error.message);
      return { deletedCount: 0, message: `삭제 수행 중 오류: ${error.message}` };
    }

    const count = matchedData ? matchedData.length : 0;
    return { deletedCount: count, message: `성공적으로 ${count}개의 더미 레코드가 Supabase DB에서 영구 삭제되었습니다.` };
  } catch (err: any) {
    console.error('deleteDummyParticipantsFromSupabase exception:', err);
    return { deletedCount: 0, message: `예외 발생: ${err.message || '네트워크 오류'}` };
  }
}

// Save / Upsert Daily Stat row to daily_stats table in Supabase
export async function saveDailyStatToSupabase(stat: {
  participantId: string;
  recordDate: string;
  blogPosts: number;
  blogVisitors: number;
  tweets: number;
  replies: number;
}): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    // Check if a record already exists for this participant and recordDate
    const { data: existing } = await client
      .from('daily_stats')
      .select('id')
      .eq('participant_id', stat.participantId)
      .eq('record_date', stat.recordDate)
      .limit(1)
      .maybeSingle();

    if (existing && existing.id) {
      // Update existing record for today
      const { error } = await client
        .from('daily_stats')
        .update({
          blog_posts: stat.blogPosts,
          blog_visitors: stat.blogVisitors,
          tweets: stat.tweets,
          replies: stat.replies,
        })
        .eq('id', existing.id);

      if (error) {
        console.warn('Supabase daily_stats update error:', error.message);
        return false;
      }
      return true;
    } else {
      // Insert new record
      const { error } = await client.from('daily_stats').insert({
        participant_id: stat.participantId,
        record_date: stat.recordDate,
        blog_posts: stat.blogPosts,
        blog_visitors: stat.blogVisitors,
        tweets: stat.tweets,
        replies: stat.replies,
      });

      if (error) {
        console.warn('Supabase daily_stats insert error:', error.message);
        return false;
      }
      return true;
    }
  } catch (err) {
    console.warn('Supabase daily_stats exception:', err);
    return false;
  }
}

// Upsert User Profile in Supabase (profiles table)
export async function upsertProfileInSupabase(user: NaverUser): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) {
    return false;
  }

  try {
    const cleanEmail = (user.email || '').trim().toLowerCase();
    const targetId = user.id || (cleanEmail ? `usr_${cleanEmail.replace(/[^a-z0-9]/g, '_')}` : `usr_${Date.now()}`);

    let profileIdToUse = targetId;

    if (cleanEmail) {
      try {
        const { data: existingProfiles } = await client
          .from('profiles')
          .select('id')
          .ilike('email', cleanEmail)
          .limit(1);

        if (existingProfiles && existingProfiles.length > 0) {
          profileIdToUse = existingProfiles[0].id;
        }
      } catch {
        // Safe fallback
      }
    }

    // Base safe payload with columns guaranteed in default profiles schema
    const basePayload: Record<string, any> = {
      id: profileIdToUse,
      name: user.name || '사용자',
      email: cleanEmail || null,
    };

    // Extended payload with optional columns if available in custom DB setup
    const extendedPayload: Record<string, any> = {
      ...basePayload,
      ...(user.naverId ? { naver_id: user.naverId } : {}),
      ...(user.twitterId ? { twitter_id: user.twitterId } : {}),
      ...(user.blogRssUrl || user.naverId ? { blog_rss_url: user.blogRssUrl || `https://rss.blog.naver.com/${user.naverId}.xml` } : {}),
    };

    const tryWritePayload = async (payload: Record<string, any>): Promise<boolean> => {
      const { error: upsertErr } = await client.from('profiles').upsert(payload, { onConflict: 'id' });
      if (!upsertErr) return true;

      const { error: updateErr } = await client.from('profiles').update(payload).eq('id', profileIdToUse);
      if (!updateErr) return true;

      const { error: insertErr } = await client.from('profiles').insert(payload);
      if (!insertErr) return true;

      return false;
    };

    // 1. Try extended payload
    let success = await tryWritePayload(extendedPayload);

    // 2. Fallback to base safe payload if extended payload fails (e.g. column doesn't exist)
    if (!success) {
      success = await tryWritePayload(basePayload);
    }

    if (success) {
      console.log('✅ Supabase profile synced successfully');

      // Auto-sync naver_id and twitter_id into participants table
      if (user.naverId || user.twitterId) {
        try {
          const participantUpdates: any = {};
          if (user.naverId) participantUpdates.blog_id = user.naverId;
          if (user.twitterId) participantUpdates.twitter_id = user.twitterId;

          if (user.name) {
            await client.from('participants').update(participantUpdates).eq('participant_name', user.name);
          }
          if (cleanEmail) {
            await client.from('participants').update(participantUpdates).eq('email', cleanEmail);
          }
        } catch {
          // Ignore participant update error
        }
      }

      return true;
    } else {
      console.warn('Supabase profile remote sync notice: saved to local session');
      return false;
    }
  } catch (err) {
    console.warn('Supabase profile sync exception:', err);
    return false;
  }
}

// Fetch Profile from Supabase by User ID
export async function fetchProfileFromSupabase(userId: string): Promise<NaverUser | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      name: data.name,
      email: data.email || '',
      naverId: data.naver_id || '',
      twitterId: data.twitter_id || undefined,
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.email ? data.email.split('@')[0] : data.name}`,
      blogRssUrl: data.blog_rss_url || (data.naver_id ? `https://rss.blog.naver.com/${data.naver_id}.xml` : ''),
    };
  } catch (err) {
    console.warn('Supabase fetch profile exception:', err);
    return null;
  }
}

// Fetch Profile from Supabase by Email
export async function fetchProfileByEmail(email: string): Promise<NaverUser | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return null;

    const { data, error } = await client
      .from('profiles')
      .select('*')
      .ilike('email', cleanEmail)
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      name: data.name || '구글 사용자',
      email: data.email || cleanEmail,
      naverId: data.naver_id || '',
      twitterId: data.twitter_id || undefined,
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${cleanEmail.split('@')[0]}`,
      blogRssUrl: data.blog_rss_url || (data.naver_id ? `https://rss.blog.naver.com/${data.naver_id}.xml` : ''),
    };
  } catch (err) {
    console.warn('Supabase fetch profile by email exception:', err);
    return null;
  }
}

export function isValidUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

export function toValidUuid(str: string): string {
  if (!str) {
    return '00000000-0000-4000-8000-000000000000';
  }
  if (isValidUuid(str)) {
    return str.toLowerCase();
  }
  // Deterministic 128-bit hash to UUID format
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  let h3 = 0x9e3779b9;
  let h4 = 0x85ebca6b;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = (Math.imul(h1 ^ ch, 2654435761) >>> 0);
    h2 = (Math.imul(h2 ^ ch, 1597334677) >>> 0);
    h3 = (Math.imul(h3 ^ ch, 3812015801) >>> 0);
    h4 = (Math.imul(h4 ^ ch, 2246822507) >>> 0);
  }
  const s1 = h1.toString(16).padStart(8, '0');
  const s2 = (h2 & 0xffff).toString(16).padStart(4, '0');
  const s3 = ('4' + ((h3 & 0x0fff).toString(16).padStart(3, '0')));
  const s4 = (((h4 & 0x3fff) | 0x8000).toString(16).padStart(4, '0'));
  const s5 = (h4.toString(16).padStart(8, '0') + h3.toString(16).padStart(8, '0')).slice(-12);
  return `${s1}-${s2}-${s3}-${s4}-${s5}`.toLowerCase();
}

// Fetch Announcements from Supabase
export async function fetchAnnouncementsFromSupabase(): Promise<Announcement[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) return null;

    return data.map((item: any) => ({
      id: item.id,
      title: item.title,
      content: item.content,
      isImportant: Boolean(item.is_important),
      isPublished: item.is_published !== undefined ? Boolean(item.is_published) : true,
      targetChallengeId: item.target_challenge_id || undefined,
      externalLinkUrl: item.external_link_url || undefined,
      externalLinkLabel: item.external_link_label || undefined,
      createdAt: item.created_at ? new Date(item.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      authorName: item.author_name || '운영자',
    }));
  } catch (err) {
    console.warn('Supabase fetch announcements exception:', err);
    return null;
  }
}

// Save/Upsert Announcement to Supabase
export async function saveAnnouncementToSupabase(announcement: Announcement): Promise<{ success: boolean; errorMsg?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, errorMsg: 'Supabase 클라이언트가 초기화되지 않았습니다.' };

  const tryUpsert = async (targetId: string): Promise<{ success: boolean; errorMsg?: string }> => {
    const extendedPayload = {
      id: targetId,
      title: announcement.title,
      content: announcement.content,
      is_important: announcement.isImportant || false,
      is_published: announcement.isPublished !== undefined ? announcement.isPublished : true,
      target_challenge_id: announcement.targetChallengeId || null,
      external_link_url: announcement.externalLinkUrl || null,
      external_link_label: announcement.externalLinkLabel || null,
      author_name: announcement.authorName || '운영자',
    };

    let { error } = await client.from('announcements').upsert(extendedPayload);
    if (!error) return { success: true };

    // If UUID syntax error and we haven't converted to valid UUID yet, retry with converted UUID
    if (error.message?.includes('type uuid') && targetId !== toValidUuid(targetId)) {
      return tryUpsert(toValidUuid(targetId));
    }

    console.warn('Supabase save announcement (extended) error, attempting core payload:', error.message);

    // Fallback 1: Core columns (id, title, content, is_important)
    const corePayload = {
      id: targetId,
      title: announcement.title,
      content: announcement.content,
      is_important: announcement.isImportant || false,
    };
    const { error: coreError } = await client.from('announcements').upsert(corePayload);
    if (!coreError) return { success: true };

    if (coreError.message?.includes('type uuid') && targetId !== toValidUuid(targetId)) {
      return tryUpsert(toValidUuid(targetId));
    }

    console.warn('Supabase save announcement (core) error, attempting minimal payload:', coreError.message);

    // Fallback 2: Minimal columns (id, title, content)
    const minPayload = {
      id: targetId,
      title: announcement.title,
      content: announcement.content,
    };
    const { error: minError } = await client.from('announcements').upsert(minPayload);
    if (!minError) return { success: true };

    if (minError.message?.includes('type uuid') && targetId !== toValidUuid(targetId)) {
      return tryUpsert(toValidUuid(targetId));
    }

    console.error('Supabase save announcement error:', minError.message);
    return { success: false, errorMsg: minError.message };
  };

  try {
    return await tryUpsert(announcement.id);
  } catch (err: any) {
    console.warn('Supabase save announcement exception:', err);
    return { success: false, errorMsg: err?.message || '공지사항 저장 중 오류가 발생했습니다.' };
  }
}

// Delete Announcement from Supabase
export async function deleteAnnouncementFromSupabase(id: string): Promise<{ success: boolean; errorMsg?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, errorMsg: 'Supabase 클라이언트가 초기화되지 않았습니다.' };

  try {
    let { error } = await client.from('announcements').delete().eq('id', id);
    if (error && error.message?.includes('type uuid') && id !== toValidUuid(id)) {
      const retry = await client.from('announcements').delete().eq('id', toValidUuid(id));
      error = retry.error;
    }
    if (error) {
      console.warn('Supabase delete announcement error:', error.message);
      return { success: false, errorMsg: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.warn('Supabase delete announcement exception:', err);
    return { success: false, errorMsg: err?.message || '공지사항 삭제 중 오류가 발생했습니다.' };
  }
}

// ----------------------------------------------------------------------
// FAQ (자주 묻는 질문) & Q&A (회원 문의) SUPABASE CRUD & DEFAULTS
// ----------------------------------------------------------------------

export const DEFAULT_FAQ_CATEGORIES = ['전체', '회원/계정', '챌린지', 'AI 기능', '상품/결제', '환급', '기타'] as const;

export const DEFAULT_FAQS: FAQItem[] = [
  {
    id: 'faq_1',
    category: '회원/계정',
    question: '네이버 블로그 ID 또는 닉네임을 변경할 수 있나요?',
    answer: '네, 마이페이지 프로필 또는 계정 설정에서 네이버 블로그 아이디를 언제든지 수정하실 수 있습니다. 블로그 ID를 변경하시면 기존 인증 기록 및 포스팅 연동이 새 ID 기준으로 연결되어 정상적으로 집계됩니다.',
    isPublished: true,
    orderIndex: 1,
    createdAt: '2026-08-01',
    authorName: '운영자',
  },
  {
    id: 'faq_2',
    category: '회원/계정',
    question: '로그인 정보나 개인정보는 어떻게 보호되나요?',
    answer: '본 사이트는 최신 암호화 보안 프로토콜 및 세션 관리 기술을 적용하여 회원 정보를 안전하게 보호합니다. 금융 정보나 불필요한 개인정보는 일체 저장하지 않으므로 안심하고 이용하실 수 있습니다.',
    isPublished: true,
    orderIndex: 2,
    createdAt: '2026-08-01',
    authorName: '운영자',
  },
  {
    id: 'faq_3',
    category: '챌린지',
    question: '1일 1포스팅 챌린지 미션 인증은 어떻게 진행되나요?',
    answer: '별도의 번거로운 일일 수동 링크 제출란 없이 완전히 자동으로 진행됩니다! 참가 신청 시 등록하신 회원님의 네이버 블로그 ID 및 트위터(X) 계정을 기반으로, 시스템이 매일 발행된 포스팅을 자동 수집(RSS 및 자동 집계)하여 일일 포스팅 수와 미션 달성 여부를 실시간으로 자동 체크합니다.',
    isPublished: true,
    orderIndex: 3,
    createdAt: '2026-08-01',
    authorName: '운영자',
  },
  {
    id: 'faq_4',
    category: '챌린지',
    question: '블로그 포스팅 및 트위터 게시물 집계는 언제 반영되나요?',
    answer: '시스템이 정기적으로 참가자의 블로그 RSS 피드와 트위터 활동을 자동 수집하여 대시보드에 즉시 반영합니다. 만약 포스팅 직후 즉시 반영을 원하실 경우, 챌린지 현황 화면의 [실시간 데이터 동기화] 버튼을 누르면 즉시 최신 발행 내역이 수집되어 업데이트됩니다.',
    isPublished: true,
    orderIndex: 4,
    createdAt: '2026-08-01',
    authorName: '운영자',
  },
  {
    id: 'faq_5',
    category: 'AI 기능',
    question: 'AI 초안 생성기(AI Toolkit)는 하루에 몇 번까지 생성할 수 있나요?',
    answer: '회원님의 멤버십 등급(Standard, Pro, VIP 등)에 따라 일일/월간 생성 횟수가 차등 부여됩니다. 현재 잔여 생성 크레딧은 AI 초안 생성기 상단 상태 카드에서 실시간으로 확인하실 수 있습니다.',
    isPublished: true,
    orderIndex: 5,
    createdAt: '2026-08-01',
    authorName: '운영자',
  },
  {
    id: 'faq_6',
    category: 'AI 기능',
    question: 'AI가 작성해 준 블로그 글을 그대로 발행해도 검색 누락이나 저품질 위험이 없나요?',
    answer: '본 AI 툴킷은 네이버 C-Rank 및 DIA+ 검색 알고리즘 기준에 맞추어 단순 복사형 문장이 아닌 자연스러운 1인칭 경험담 서사, 문맥 기반 소제목, 필수 공정위 문구를 체계적으로 구성하여 생성하므로 안전하게 활용하실 수 있습니다.',
    isPublished: true,
    orderIndex: 6,
    createdAt: '2026-08-01',
    authorName: '운영자',
  },
  {
    id: 'faq_7',
    category: '상품/결제',
    question: '챌린지 참가비 결제 및 등급 승인은 얼마나 걸리나요?',
    answer: '무통장 입금 신청 후 운영진이 입금 내역을 확인하여 승인 처리합니다. 통상 평일 기준 10분~1시간 이내에 신속하게 승인되며, 승인 즉시 챌린지 참여 권한과 AI 생성 크레딧이 활성화됩니다.',
    isPublished: true,
    orderIndex: 7,
    createdAt: '2026-08-01',
    authorName: '운영자',
  },
  {
    id: 'faq_8',
    category: '환급',
    question: '챌린지 100% 완주 환급 신청은 언제 어떻게 하나요?',
    answer: '챌린지 정규 일정이 종료된 후 100% 완주 조건을 달성하신 회원님께는 외부 안전 환급 신청폼 링크가 안내됩니다. 안내된 링크를 통해 환급받으실 정보를 제출하시면 정해진 일정에 일괄 송금 처리됩니다.',
    isPublished: true,
    orderIndex: 8,
    createdAt: '2026-08-01',
    authorName: '운영자',
  },
  {
    id: 'faq_9',
    category: '기타',
    question: '1:1 추가 문의나 건의사항은 어디서 작성하나요?',
    answer: '[공지사항 & 소식] 메뉴의 [Q&A] 탭에서 질문을 자유롭게 등록하실 수 있습니다. 비공개 질문 기능을 체크하시면 작성자 본인과 운영자만 열람할 수 있도록 안전하게 보호됩니다.',
    isPublished: true,
    orderIndex: 9,
    createdAt: '2026-08-01',
    authorName: '운영자',
  },
];

export const DEFAULT_QNAS: QnAItem[] = [
  {
    id: 'qna_sample_1',
    title: '챌린지 시작 전 필수 가이드와 자료는 어디서 확인하나요?',
    content: '안녕하세요! 이번 기수 챌린지에 처음 참여하게 되었습니다. 시작 전에 꼭 읽어봐야 할 가이드나 템플릿은 어디에서 다운로드받을 수 있는지 궁금합니다.',
    userId: 'sample_member_01',
    authorName: '열정보더',
    authorEmail: 'member1@example.com',
    isSecret: false,
    status: 'answered',
    answerContent: '안녕하세요 열정보더님, 챌린지 참여를 진심으로 환영합니다! 상단 메뉴 [공지사항 & 자료실]의 [자료실] 탭에 가시면 필수 공정위 문구 가이드, 키워드 리서치 시트, 챌린지 템플릿 PDF를 바로 확인 및 다운로드하실 수 있습니다. 추가 문의사항이 있으시면 언제든 편하게 남겨주세요!',
    answeredAt: '2026-08-25',
    answeredBy: '운영자',
    isPublished: true,
    createdAt: '2026-08-24',
  },
];

// Fetch FAQs from Supabase
export async function fetchFaqsFromSupabase(): Promise<FAQItem[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('faqs')
      .select('*')
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) return null;

    return data.map((item: any) => ({
      id: item.id,
      question: item.question,
      answer: item.answer,
      category: item.category || '일반',
      isPublished: item.is_published !== undefined ? Boolean(item.is_published) : true,
      orderIndex: item.order_index !== undefined ? Number(item.order_index) : 0,
      authorName: item.author_name || '운영자',
      createdAt: item.created_at ? new Date(item.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      updatedAt: item.updated_at,
    }));
  } catch (err) {
    console.warn('Supabase fetch faqs exception:', err);
    return null;
  }
}

// Save/Upsert FAQ to Supabase
export async function saveFaqToSupabase(faq: FAQItem): Promise<{ success: boolean; errorMsg?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, errorMsg: 'Supabase 클라이언트가 초기화되지 않았습니다.' };

  const tryUpsert = async (targetId: string): Promise<{ success: boolean; errorMsg?: string }> => {
    const payload = {
      id: targetId,
      question: faq.question,
      answer: faq.answer,
      category: faq.category || '일반',
      is_published: faq.isPublished !== undefined ? faq.isPublished : true,
      order_index: faq.orderIndex !== undefined ? Number(faq.orderIndex) : 0,
      author_name: faq.authorName || '운영자',
      updated_at: new Date().toISOString(),
    };

    const { error } = await client.from('faqs').upsert(payload);
    if (!error) return { success: true };

    if (error.message?.includes('type uuid') && targetId !== toValidUuid(targetId)) {
      return tryUpsert(toValidUuid(targetId));
    }

    console.warn('Supabase save faq error:', error.message);
    return { success: false, errorMsg: error.message };
  };

  try {
    return await tryUpsert(faq.id);
  } catch (err: any) {
    console.warn('Supabase save faq exception:', err);
    return { success: false, errorMsg: err?.message || 'FAQ 저장 중 오류가 발생했습니다.' };
  }
}

// Delete FAQ from Supabase
export async function deleteFaqFromSupabase(id: string): Promise<{ success: boolean; errorMsg?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, errorMsg: 'Supabase 클라이언트가 초기화되지 않았습니다.' };

  try {
    let { error } = await client.from('faqs').delete().eq('id', id);
    if (error && error.message?.includes('type uuid') && id !== toValidUuid(id)) {
      const retry = await client.from('faqs').delete().eq('id', toValidUuid(id));
      error = retry.error;
    }
    if (error) {
      console.warn('Supabase delete faq error:', error.message);
      return { success: false, errorMsg: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.warn('Supabase delete faq exception:', err);
    return { success: false, errorMsg: err?.message || 'FAQ 삭제 중 오류가 발생했습니다.' };
  }
}

// Reorder FAQs in Supabase
export async function reorderFaqsInSupabase(items: { id: string; orderIndex: number }[]): Promise<{ success: boolean }> {
  const client = getSupabaseClient();
  if (!client) return { success: true };

  try {
    for (const item of items) {
      await client.from('faqs').update({ order_index: item.orderIndex, updated_at: new Date().toISOString() }).eq('id', item.id);
    }
    return { success: true };
  } catch (err) {
    console.warn('reorderFaqsInSupabase error:', err);
    return { success: false };
  }
}

// Fetch Q&A Posts from Supabase
export async function fetchQnaPostsFromSupabase(): Promise<QnAItem[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('qna_posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) return null;

    return data.map((item: any) => ({
      id: item.id,
      title: item.title,
      content: item.content,
      userId: item.user_id,
      authorName: item.author_name,
      authorEmail: item.author_email || undefined,
      isSecret: Boolean(item.is_secret),
      status: (item.status === 'answered' ? 'answered' : 'pending') as 'pending' | 'answered',
      answerContent: item.answer_content || undefined,
      answeredAt: item.answered_at ? new Date(item.answered_at).toISOString().split('T')[0] : undefined,
      answeredBy: item.answered_by || '운영자',
      isPublished: item.is_published !== undefined ? Boolean(item.is_published) : true,
      createdAt: item.created_at ? new Date(item.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      updatedAt: item.updated_at,
    }));
  } catch (err) {
    console.warn('Supabase fetch qna posts exception:', err);
    return null;
  }
}

// Save/Upsert Q&A Post to Supabase
export async function saveQnaPostToSupabase(qna: QnAItem): Promise<{ success: boolean; errorMsg?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, errorMsg: 'Supabase 클라이언트가 초기화되지 않았습니다.' };

  const tryUpsert = async (targetId: string): Promise<{ success: boolean; errorMsg?: string }> => {
    const payload = {
      id: targetId,
      title: qna.title,
      content: qna.content,
      user_id: qna.userId,
      author_name: qna.authorName,
      author_email: qna.authorEmail || null,
      is_secret: Boolean(qna.isSecret),
      status: qna.status || 'pending',
      answer_content: qna.answerContent || null,
      answered_at: qna.answeredAt ? new Date(qna.answeredAt).toISOString() : null,
      answered_by: qna.answeredBy || '운영자',
      is_published: qna.isPublished !== undefined ? qna.isPublished : true,
      updated_at: new Date().toISOString(),
    };

    const { error } = await client.from('qna_posts').upsert(payload);
    if (!error) return { success: true };

    if (error.message?.includes('type uuid') && targetId !== toValidUuid(targetId)) {
      return tryUpsert(toValidUuid(targetId));
    }

    console.warn('Supabase save qna error:', error.message);
    return { success: false, errorMsg: error.message };
  };

  try {
    return await tryUpsert(qna.id);
  } catch (err: any) {
    console.warn('Supabase save qna exception:', err);
    return { success: false, errorMsg: err?.message || 'Q&A 저장 중 오류가 발생했습니다.' };
  }
}

// Answer Q&A Post in Supabase (Admin)
export async function answerQnaPostInSupabase(
  id: string,
  answerContent: string,
  answeredBy: string = '운영자'
): Promise<{ success: boolean; errorMsg?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, errorMsg: 'Supabase 클라이언트가 초기화되지 않았습니다.' };

  try {
    const nowIso = new Date().toISOString();
    const payload = {
      answer_content: answerContent,
      answered_at: nowIso,
      answered_by: answeredBy,
      status: 'answered',
      updated_at: nowIso,
    };

    const { error } = await client.from('qna_posts').update(payload).eq('id', id);
    if (error) {
      console.warn('Supabase answer qna error:', error.message);
      return { success: false, errorMsg: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.warn('Supabase answer qna exception:', err);
    return { success: false, errorMsg: err?.message || '답변 저장 중 오류가 발생했습니다.' };
  }
}

// Delete Q&A Post from Supabase
export async function deleteQnaPostFromSupabase(id: string): Promise<{ success: boolean; errorMsg?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, errorMsg: 'Supabase 클라이언트가 초기화되지 않았습니다.' };

  try {
    let { error } = await client.from('qna_posts').delete().eq('id', id);
    if (error && error.message?.includes('type uuid') && id !== toValidUuid(id)) {
      const retry = await client.from('qna_posts').delete().eq('id', toValidUuid(id));
      error = retry.error;
    }
    if (error) {
      console.warn('Supabase delete qna error:', error.message);
      return { success: false, errorMsg: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.warn('Supabase delete qna exception:', err);
    return { success: false, errorMsg: err?.message || 'Q&A 삭제 중 오류가 발생했습니다.' };
  }
}

// Fetch Resources from Supabase
export async function fetchResourcesFromSupabase(): Promise<ChallengeResource[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('resources')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) return null;

    return data.map((item: any) => ({
      id: item.id,
      title: item.title,
      description: item.description || '',
      resourceType: (item.resource_type as any) || 'pdf',
      fileUrl: item.file_url || '',
      linkUrl: item.link_url || '',
      content: item.content || '',
      visibility: item.visibility || (item.target_group === 'all' ? 'all' : 'specific_challenges'),
      targetGroup: item.target_group || 'all',
      targetGroupIds: Array.isArray(item.target_group_ids) ? item.target_group_ids : [],
      targetGroupNames: Array.isArray(item.target_group_names)
        ? item.target_group_names
        : item.target_group && item.target_group !== 'all'
        ? [item.target_group]
        : [],
      weekNumber: item.week_number ? Number(item.week_number) : 1,
      orderIndex: item.order_index ? Number(item.order_index) : 1,
      isRequired: item.is_required !== undefined ? Boolean(item.is_required) : false,
      isPublished: item.is_published !== undefined ? Boolean(item.is_published) : true,
      createdBy: item.created_by || '운영자',
      createdAt: item.created_at ? new Date(item.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    }));
  } catch (err) {
    console.warn('Supabase fetch resources exception:', err);
    return null;
  }
}

// Save/Upsert Resource to Supabase
export async function saveResourceToSupabase(resource: ChallengeResource): Promise<{ success: boolean; errorMsg?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, errorMsg: 'Supabase 클라이언트가 초기화되지 않았습니다.' };

  try {
    const extendedPayload = {
      id: resource.id,
      title: resource.title,
      description: resource.description,
      resource_type: resource.resourceType || 'pdf',
      file_url: resource.fileUrl || '',
      link_url: resource.linkUrl || '',
      content: resource.content || '',
      visibility: resource.visibility || 'all',
      target_group: resource.targetGroup || (resource.targetGroupNames?.[0] || 'all'),
      target_group_ids: resource.targetGroupIds || [],
      target_group_names: resource.targetGroupNames || [],
      week_number: resource.weekNumber || 1,
      order_index: resource.orderIndex || 1,
      is_required: resource.isRequired || false,
      is_published: resource.isPublished !== undefined ? resource.isPublished : true,
      created_by: resource.createdBy || '운영자',
    };

    const { error } = await client.from('resources').upsert(extendedPayload);

    if (error) {
      console.warn('Supabase save resource (extended) error:', error.message, error.details);
      // Fallback if extended columns are not present in legacy schema
      const basePayload = {
        id: resource.id,
        title: resource.title,
        description: resource.description,
        target_group: resource.targetGroup || (resource.targetGroupNames?.[0] || 'all'),
        file_url: resource.fileUrl || '',
        link_url: resource.linkUrl || '',
      };
      const { error: baseError } = await client.from('resources').upsert(basePayload);
      if (baseError) {
        console.error('Supabase save resource base error:', baseError.message, baseError.details);
        return { success: false, errorMsg: baseError.message || 'Supabase DB 저장 중 오류가 발생했습니다.' };
      }
    }

    // Sync junction table resource_challenges if targetGroupIds or names exist
    if (resource.targetGroupIds && resource.targetGroupIds.length > 0) {
      try {
        await client.from('resource_challenges').delete().eq('resource_id', resource.id);
        const junctionRows = resource.targetGroupIds.map((cId) => ({
          resource_id: resource.id,
          challenge_id: cId,
        }));
        await client.from('resource_challenges').insert(junctionRows);
      } catch {
        // Ignore junction table error if table doesn't exist
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error('Supabase save resource exception:', err);
    return { success: false, errorMsg: err?.message || '자료 저장 중 예외가 발생했습니다.' };
  }
}

// Delete Resource from Supabase
export async function deleteResourceFromSupabase(id: string): Promise<{ success: boolean; errorMsg?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, errorMsg: 'Supabase 클라이언트가 초기화되지 않았습니다.' };

  try {
    const { error } = await client.from('resources').delete().eq('id', id);
    if (error) {
      console.error('Supabase delete resource error:', error.message, error.details);
      return { success: false, errorMsg: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.error('Supabase delete resource exception:', err);
    return { success: false, errorMsg: err?.message || '자료 삭제 중 예외가 발생했습니다.' };
  }
}

// =========================================================
// 사이트 방문자 수집 및 집계 시스템 (Visitor Tracking & Stats)
// =========================================================

export function getOrCreateVisitorId(): string {
  if (typeof window === 'undefined') return 'v_server';
  try {
    let visitorId = localStorage.getItem('site_anonymous_visitor_id');
    if (!visitorId) {
      visitorId = `v_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem('site_anonymous_visitor_id', visitorId);
    }
    return visitorId;
  } catch {
    return `v_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

export function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return 's_server';
  try {
    let sessionId = sessionStorage.getItem('site_session_id');
    if (!sessionId) {
      sessionId = `s_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      sessionStorage.setItem('site_session_id', sessionId);
    }
    return sessionId;
  } catch {
    return `s_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

/**
 * Record a site visit in Supabase.
 * Applies session debouncing (10-minute window) to avoid flooding visit logs on rapid navigation/re-renders.
 */
export async function recordSiteVisit(currentUser?: NaverUser | null, pagePath: string = '/'): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  const visitorId = getOrCreateVisitorId();
  const sessionId = getOrCreateSessionId();
  const userId = currentUser ? (currentUser.id || currentUser.naverId || currentUser.email || null) : null;

  // Session debounce check using sessionStorage
  const debounceKey = `visit_logged_${pagePath}_${userId || visitorId}`;
  try {
    const lastLogged = sessionStorage.getItem(debounceKey);
    const now = Date.now();
    if (lastLogged && now - Number(lastLogged) < 10 * 60 * 1000) {
      return true;
    }
    sessionStorage.setItem(debounceKey, String(now));
  } catch {
    // Ignore storage restrictions
  }

  try {
    const payload = {
      user_id: userId,
      visitor_id: visitorId,
      session_id: sessionId,
      page_path: pagePath,
      visited_date: new Date().toISOString().split('T')[0],
    };

    const { error } = await client.from('site_visits').insert(payload);
    if (error) {
      console.warn('Supabase site_visits insert note:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase recordSiteVisit exception:', err);
    return false;
  }
}

/**
 * Fetch visitor statistics (Daily Unique Visitors, Weekly Unique Visitors, Total Unique Visitors, Total Registered Members).
 * Primary: Supabase RPC 'get_site_visitor_stats'
 * Secondary: Fallback SQL queries / distinct calculation
 */
export async function fetchSiteVisitorStats(fallbackParticipantsCount: number = 0): Promise<SiteVisitorStats> {
  const defaultStats: SiteVisitorStats = {
    totalMembers: fallbackParticipantsCount,
    totalVisitors: 0,
    weeklyVisitors: 0,
    dailyVisitors: 0,
  };

  const client = getSupabaseClient();
  if (!client) return defaultStats;

  // 1. Primary: Attempt RPC function get_site_visitor_stats
  try {
    const { data, error } = await client.rpc('get_site_visitor_stats');
    if (!error && data && typeof data === 'object') {
      const stats: SiteVisitorStats = {
        dailyVisitors: Number(data.dailyVisitors ?? data.daily_visitors ?? 0),
        weeklyVisitors: Number(data.weeklyVisitors ?? data.weekly_visitors ?? 0),
        totalVisitors: Number(data.totalVisitors ?? data.total_visitors ?? 0),
        totalMembers: Math.max(
          Number(data.totalMembers ?? data.total_members ?? 0),
          fallbackParticipantsCount
        ),
      };
      return stats;
    }
  } catch {
    // RPC failed or function not created yet on server, continue to fallback
  }

  // 2. Secondary: Fallback via direct query on site_visits & profiles/participants
  try {
    let totalMembers = fallbackParticipantsCount;
    const { count: profileCount, error: profileErr } = await client
      .from('profiles')
      .select('id', { count: 'exact', head: true });
    
    if (!profileErr && profileCount !== null && profileCount > 0) {
      totalMembers = Math.max(profileCount, fallbackParticipantsCount);
    } else {
      const { count: partCount, error: partErr } = await client
        .from('participants')
        .select('id', { count: 'exact', head: true });
      if (!partErr && partCount !== null && partCount > 0) {
        totalMembers = Math.max(partCount, fallbackParticipantsCount);
      }
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const sevenDaysAgoDate = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data: visitsData, error: visitsErr } = await client
      .from('site_visits')
      .select('user_id, visitor_id, visited_at, visited_date');

    if (visitsErr || !visitsData) {
      return { ...defaultStats, totalMembers };
    }

    const totalVisitorKeys = new Set<string>();
    const weeklyVisitorKeys = new Set<string>();
    const dailyVisitorKeys = new Set<string>();

    visitsData.forEach((row: any) => {
      const key = row.user_id ? `u:${row.user_id}` : `v:${row.visitor_id}`;
      if (!key || key === 'v:null' || key === 'v:undefined') return;

      totalVisitorKeys.add(key);

      const vDate = row.visited_date || (row.visited_at ? new Date(row.visited_at).toISOString().split('T')[0] : '');
      if (vDate && vDate >= sevenDaysAgoDate) {
        weeklyVisitorKeys.add(key);
      }

      if (vDate === todayStr) {
        dailyVisitorKeys.add(key);
      }
    });

    return {
      totalMembers,
      totalVisitors: totalVisitorKeys.size,
      weeklyVisitors: weeklyVisitorKeys.size,
      dailyVisitors: dailyVisitorKeys.size,
    };
  } catch (err) {
    console.warn('Supabase fetchSiteVisitorStats direct fallback error:', err);
    return defaultStats;
  }
}

// ----------------------------------------------------
// Challenge Payment Database Functions
// ----------------------------------------------------

export async function fetchChallengePaymentsFromSupabase(): Promise<ChallengePayment[] | null> {
  const client = getSupabaseClient();

  // Check localStorage fallback first if Supabase is offline or not configured
  let localPayments: ChallengePayment[] = [];
  try {
    const saved = localStorage.getItem('challenge_payments');
    if (saved) localPayments = JSON.parse(saved);
  } catch (e) {
    console.warn('Failed to parse local challenge_payments:', e);
  }

  if (!client) return localPayments;

  try {
    const { data, error } = await client
      .from('challenge_payments')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase fetch challenge payments error, falling back to local:', error);
      return localPayments;
    }

    if (!data) return localPayments;

    const dbPayments: ChallengePayment[] = data.map((row: any) => ({
      id: row.id,
      challengeId: row.challenge_id,
      challengeName: row.challenge_name || '',
      participantId: row.participant_id || undefined,
      userId: row.user_id,
      userName: row.user_name || '',
      userEmail: row.user_email || '',
      userNaverId: row.user_naver_id || '',
      userTwitterId: row.user_twitter_id || '',
      amount: Number(row.amount || 0),
      depositorName: row.depositor_name,
      depositedAt: row.deposited_at,
      status: (row.status || 'submitted') as PaymentStatus,
      submittedAt: row.submitted_at ? new Date(row.submitted_at).toISOString().replace('T', ' ').substring(0, 16) : new Date().toISOString().substring(0, 10),
      approvedAt: row.approved_at || null,
      approvedBy: row.approved_by || null,
      rejectionReason: row.rejection_reason || null,
      refundStatus: row.refund_status || 'none',
      refundAmount: row.refund_amount ? Number(row.refund_amount) : 0,
      refundedAt: row.refunded_at || null,
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || undefined,
    }));

    // Merge local and db items avoiding duplicates
    const dbIds = new Set(dbPayments.map((p) => p.id));
    const merged = [...dbPayments, ...localPayments.filter((lp) => !dbIds.has(lp.id))];

    // Sync localStorage
    try {
      localStorage.setItem('challenge_payments', JSON.stringify(merged));
    } catch (e) {
      // ignore
    }

    return merged;
  } catch (err) {
    console.error('Supabase fetch challenge payments exception:', err);
    return localPayments;
  }
}

export async function saveChallengePaymentToSupabase(payment: ChallengePayment): Promise<boolean> {
  // Always update localStorage first for robust UX
  try {
    const saved = localStorage.getItem('challenge_payments');
    let list: ChallengePayment[] = saved ? JSON.parse(saved) : [];
    const idx = list.findIndex((p) => p.id === payment.id);
    if (idx >= 0) {
      list[idx] = payment;
    } else {
      list.unshift(payment);
    }
    localStorage.setItem('challenge_payments', JSON.stringify(list));
  } catch (e) {
    console.error('Failed to update local challenge_payments:', e);
  }

  const client = getSupabaseClient();
  if (!client) return true;

  const payload: any = {
    id: payment.id,
    challenge_id: payment.challengeId,
    participant_id: payment.participantId || null,
    user_id: payment.userId,
    user_name: payment.userName || '',
    user_email: payment.userEmail || '',
    user_naver_id: payment.userNaverId || '',
    user_twitter_id: payment.userTwitterId || '',
    amount: payment.amount,
    depositor_name: payment.depositorName,
    deposited_at: payment.depositedAt,
    status: payment.status,
    submitted_at: payment.submittedAt ? new Date(payment.submittedAt).toISOString() : new Date().toISOString(),
    approved_at: payment.approvedAt || null,
    approved_by: payment.approvedBy || null,
    rejection_reason: payment.rejectionReason || null,
    refund_status: payment.refundStatus || 'none',
    refund_amount: payment.refundAmount || 0,
    refunded_at: payment.refundedAt || null,
    updated_at: new Date().toISOString(),
  };

  try {
    const { error } = await client.from('challenge_payments').upsert(payload);
    if (error) {
      console.warn('Supabase save challenge payment warning:', error);
      return true; // saved locally
    }
    return true;
  } catch (err) {
    console.error('Supabase save challenge payment exception:', err);
    return true; // saved locally
  }
}

export async function updateChallengePaymentStatusInSupabase(
  paymentId: string,
  status: PaymentStatus,
  approvedBy?: string,
  rejectionReason?: string
): Promise<boolean> {
  const now = new Date().toISOString();

  // Update local storage first
  try {
    const saved = localStorage.getItem('challenge_payments');
    if (saved) {
      let list: ChallengePayment[] = JSON.parse(saved);
      list = list.map((p) => {
        if (p.id === paymentId) {
          return {
            ...p,
            status,
            approvedAt: status === 'approved' ? now : p.approvedAt,
            approvedBy: status === 'approved' ? (approvedBy || '운영진') : p.approvedBy,
            rejectionReason: status === 'rejected' ? (rejectionReason || '입금 내역이 확인되지 않았습니다.') : null,
            updatedAt: now,
          };
        }
        return p;
      });
      localStorage.setItem('challenge_payments', JSON.stringify(list));
    }
  } catch (e) {
    console.error('Failed to update payment status in local storage:', e);
  }

  const client = getSupabaseClient();
  if (!client) return true;

  const updatePayload: any = {
    status,
    updated_at: now,
  };

  if (status === 'approved') {
    updatePayload.approved_at = now;
    updatePayload.approved_by = approvedBy || '운영진';
    updatePayload.rejection_reason = null;
  } else if (status === 'rejected') {
    updatePayload.rejection_reason = rejectionReason || '입금 내역 확인 불가';
  }

  try {
    const { error } = await client
      .from('challenge_payments')
      .update(updatePayload)
      .eq('id', paymentId);

    if (error) {
      console.warn('Supabase update payment status error:', error);
    }
    return true;
  } catch (err) {
    console.error('Supabase update payment status exception:', err);
    return true;
  }
}

// =========================================================
// 챌린지 참가비 환급 관리 (challenge_refunds) 함수
// =========================================================

export async function fetchChallengeRefundsFromSupabase(challengeId?: string): Promise<ChallengeRefund[]> {
  let localList: ChallengeRefund[] = [];
  try {
    const saved = localStorage.getItem('challenge_refunds');
    if (saved) {
      localList = JSON.parse(saved);
      if (challengeId && challengeId !== 'all') {
        localList = localList.filter((r) => r.challengeId === challengeId);
      }
    }
  } catch (e) {
    console.error('Failed to parse challenge_refunds from local storage:', e);
  }

  const client = getSupabaseClient();
  if (!client) return localList;

  try {
    let query = client.from('challenge_refunds').select('*').order('created_at', { ascending: false });
    if (challengeId && challengeId !== 'all') {
      query = query.eq('challenge_id', challengeId);
    }

    const { data, error } = await query;
    if (error || !data) {
      console.warn('Supabase fetch challenge refunds warning:', error);
      return localList;
    }

    const mapped: ChallengeRefund[] = data.map((item) => ({
      id: item.id,
      challengeId: item.challenge_id,
      challengeName: item.challenge_name || '',
      participantId: item.participant_id,
      participantName: item.participant_name,
      userId: item.user_id || undefined,
      userEmail: item.user_email || undefined,
      paymentId: item.payment_id || undefined,

      targetAmount: item.target_amount || 0,
      eligibleAmount: item.eligible_amount || 0,
      achievementRate: item.achievement_rate || 0,
      refundThreshold: item.refund_threshold || 80,
      targetGoalCount: item.target_goal_count || 0,
      actualGoalCount: item.actual_goal_count || 0,

      bankName: item.bank_name || undefined,
      bankAccount: item.bank_account || undefined,
      bankOwner: item.bank_owner || undefined,

      eligibilityStatus: item.eligibility_status || 'eligible',
      refundStatus: item.refund_status || 'pending_review',
      contentReviewStatus: item.content_review_status || 'not_checked',

      reviewedPostsCount: item.reviewed_posts_count || 0,
      validPostsCount: item.valid_posts_count || 0,
      invalidPostsCount: item.invalid_posts_count || 0,
      postItems: item.post_items || [],

      adminDecision: item.admin_decision || 'pending',
      adminDecisionReason: item.admin_decision_reason || null,
      memo: item.memo || null,

      approvedBy: item.approved_by || null,
      approvedAt: item.approved_at || null,
      completedBy: item.completed_by || null,
      completedAt: item.completed_at || null,

      createdAt: item.created_at || new Date().toISOString(),
      updatedAt: item.updated_at || undefined,
    }));

    // Save fetched to local storage cache
    try {
      const allSaved = localStorage.getItem('challenge_refunds');
      let existingAll: ChallengeRefund[] = allSaved ? JSON.parse(allSaved) : [];
      mapped.forEach((m) => {
        const idx = existingAll.findIndex((e) => e.id === m.id);
        if (idx >= 0) existingAll[idx] = m;
        else existingAll.push(m);
      });
      localStorage.setItem('challenge_refunds', JSON.stringify(existingAll));
    } catch (e) {
      console.error('Failed to sync refunds to local storage:', e);
    }

    return mapped.length > 0 ? mapped : localList;
  } catch (err) {
    console.error('Supabase fetch challenge refunds exception:', err);
    return localList;
  }
}

export async function saveChallengeRefundToSupabase(refund: ChallengeRefund): Promise<boolean> {
  const now = new Date().toISOString();
  // 1. Save to local storage first
  try {
    const saved = localStorage.getItem('challenge_refunds');
    let list: ChallengeRefund[] = saved ? JSON.parse(saved) : [];
    const index = list.findIndex((r) => r.id === refund.id);
    if (index >= 0) {
      list[index] = { ...refund, updatedAt: now };
    } else {
      list.push({ ...refund, createdAt: refund.createdAt || now, updatedAt: now });
    }
    localStorage.setItem('challenge_refunds', JSON.stringify(list));
  } catch (e) {
    console.error('Failed to save refund to local storage:', e);
  }

  const client = getSupabaseClient();
  if (!client) return true;

  const payload: any = {
    id: refund.id,
    challenge_id: refund.challengeId,
    participant_id: refund.participantId,
    participant_name: refund.participantName,
    user_id: refund.userId || null,
    user_email: refund.userEmail || null,
    payment_id: refund.paymentId || null,

    target_amount: refund.targetAmount,
    eligible_amount: refund.eligibleAmount,
    achievement_rate: refund.achievementRate,
    refund_threshold: refund.refundThreshold,
    target_goal_count: refund.targetGoalCount,
    actual_goal_count: refund.actualGoalCount,

    bank_name: refund.bankName || null,
    bank_account: refund.bankAccount || null,
    bank_owner: refund.bankOwner || null,

    eligibility_status: refund.eligibilityStatus,
    refund_status: refund.refundStatus,
    content_review_status: refund.contentReviewStatus,

    reviewed_posts_count: refund.reviewedPostsCount || 0,
    valid_posts_count: refund.validPostsCount || 0,
    invalid_posts_count: refund.invalidPostsCount || 0,
    post_items: refund.postItems || [],

    admin_decision: refund.adminDecision || 'pending',
    admin_decision_reason: refund.adminDecisionReason || null,
    memo: refund.memo || null,

    approved_by: refund.approvedBy || null,
    approved_at: refund.approvedAt || null,
    completed_by: refund.completedBy || null,
    completed_at: refund.completedAt || null,

    updated_at: now,
  };

  try {
    const { error } = await client.from('challenge_refunds').upsert(payload);
    if (error) {
      console.warn('Supabase save challenge refund warning:', error);
    }
    return true;
  } catch (err) {
    console.error('Supabase save challenge refund exception:', err);
    return true;
  }
}

export async function saveBatchChallengeRefundsToSupabase(refunds: ChallengeRefund[]): Promise<boolean> {
  for (const refund of refunds) {
    await saveChallengeRefundToSupabase(refund);
  }
  return true;
}

export async function updateChallengeRefundStatusInSupabase(
  refundId: string,
  status: RefundStatus,
  adminDecision?: AdminDecision,
  reason?: string,
  operatorName?: string,
  memo?: string
): Promise<boolean> {
  const now = new Date().toISOString();

  // Update local storage
  try {
    const saved = localStorage.getItem('challenge_refunds');
    if (saved) {
      let list: ChallengeRefund[] = JSON.parse(saved);
      list = list.map((r) => {
        if (r.id === refundId) {
          const updated: ChallengeRefund = {
            ...r,
            refundStatus: status,
            adminDecision: adminDecision || (status === 'approved' || status === 'completed' ? 'approved' : status === 'rejected' ? 'rejected' : r.adminDecision),
            adminDecisionReason: reason !== undefined ? reason : r.adminDecisionReason,
            memo: memo !== undefined ? memo : r.memo,
            updatedAt: now,
          };
          if (status === 'approved') {
            updated.approvedAt = now;
            updated.approvedBy = operatorName || '운영진';
          } else if (status === 'completed') {
            updated.completedAt = now;
            updated.completedBy = operatorName || '운영진';
          }
          return updated;
        }
        return r;
      });
      localStorage.setItem('challenge_refunds', JSON.stringify(list));
    }
  } catch (e) {
    console.error('Failed to update refund status in local storage:', e);
  }

  const client = getSupabaseClient();
  if (!client) return true;

  const updatePayload: any = {
    refund_status: status,
    updated_at: now,
  };

  if (adminDecision) {
    updatePayload.admin_decision = adminDecision;
  }
  if (reason !== undefined) {
    updatePayload.admin_decision_reason = reason;
  }
  if (memo !== undefined) {
    updatePayload.memo = memo;
  }

  if (status === 'approved') {
    updatePayload.approved_at = now;
    updatePayload.approved_by = operatorName || '운영진';
  } else if (status === 'completed') {
    updatePayload.completed_at = now;
    updatePayload.completed_by = operatorName || '운영진';
  }

  try {
    const { error } = await client
      .from('challenge_refunds')
      .update(updatePayload)
      .eq('id', refundId);

    if (error) {
      console.warn('Supabase update refund status warning:', error);
    }
    return true;
  } catch (err) {
    console.error('Supabase update refund status exception:', err);
    return true;
  }
}

export async function batchUpdateChallengePaymentStatusInSupabase(
  paymentIds: string[],
  status: PaymentStatus,
  approvedBy?: string
): Promise<boolean> {
  for (const pid of paymentIds) {
    await updateChallengePaymentStatusInSupabase(pid, status, approvedBy);
  }
  return true;
}

export async function batchUpdateChallengeRefundStatusInSupabase(
  refundIds: string[],
  status: RefundStatus,
  adminDecision?: AdminDecision,
  operatorName?: string,
  memo?: string
): Promise<boolean> {
  for (const rid of refundIds) {
    await updateChallengeRefundStatusInSupabase(rid, status, adminDecision, undefined, operatorName, memo);
  }
  return true;
}

export async function updateUserRefundAccountInSupabase(
  _userId: string,
  _refundBankName: string,
  _refundAccountNumber: string,
  _refundAccountHolder: string
): Promise<boolean> {
  // [환급 정책 변경] 애플리케이션에서 더 이상 환급계좌를 저장하지 않음 (외부 환급폼 링크 안내 방식 사용)
  return true;
}

export async function savePaymentStatusHistoryInSupabase(
  history: PaymentStatusHistory
): Promise<boolean> {
  try {
    const raw = localStorage.getItem('payment_status_history');
    let list: PaymentStatusHistory[] = raw ? JSON.parse(raw) : [];
    list.unshift(history);
    localStorage.setItem('payment_status_history', JSON.stringify(list.slice(0, 500)));
  } catch (e) {
    console.warn('Local payment history save error:', e);
  }

  const client = getSupabaseClient();
  if (!client) return true;

  try {
    await client.from('payment_status_history').insert({
      id: history.id,
      payment_id: history.paymentId,
      old_status: history.oldStatus,
      new_status: history.newStatus,
      changed_by: history.changedBy,
      reason: history.reason || null,
      created_at: history.createdAt || new Date().toISOString(),
    });
    return true;
  } catch (err) {
    console.warn('Supabase savePaymentStatusHistory exception:', err);
    return true;
  }
}

export async function fetchPaymentStatusHistoryFromSupabase(
  paymentId?: string
): Promise<PaymentStatusHistory[]> {
  let localList: PaymentStatusHistory[] = [];
  try {
    const raw = localStorage.getItem('payment_status_history');
    if (raw) {
      localList = JSON.parse(raw);
      if (paymentId) localList = localList.filter((h) => h.paymentId === paymentId);
    }
  } catch {
    // ignore
  }

  const client = getSupabaseClient();
  if (!client) return localList;

  try {
    let query = client.from('payment_status_history').select('*').order('created_at', { ascending: false });
    if (paymentId) query = query.eq('payment_id', paymentId);
    const { data, error } = await query;
    if (error || !data) return localList;
    return data.map((d: any) => ({
      id: d.id,
      paymentId: d.payment_id,
      oldStatus: d.old_status,
      newStatus: d.new_status,
      changedBy: d.changed_by,
      reason: d.reason || undefined,
      createdAt: d.created_at,
    }));
  } catch (err) {
    console.warn('Supabase fetchPaymentStatusHistory exception:', err);
    return localList;
  }
}

// ----------------------------------------------------
// AI Draft Sessions Database & Storage Helper Functions
// ----------------------------------------------------

const LOCAL_DRAFT_KEY_PREFIX = 'ai_draft_session_';
const LOCAL_CURRENT_DRAFT_KEY_PREFIX = 'ai_draft_current_';

export async function fetchAllDraftSessionsFromSupabase(userId: string): Promise<AiDraftSession[]> {
  if (!userId) return [];

  const client = getSupabaseClient();
  if (!client) {
    // Fallback to local storage if no Supabase
    const sessions: AiDraftSession[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(LOCAL_DRAFT_KEY_PREFIX)) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && parsed.userId === userId) {
              sessions.push(parsed);
            }
          }
        }
      }
      return sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    } catch (e) {
      console.warn('Failed to parse local draft sessions:', e);
      return [];
    }
  }

  try {
    const { data, error } = await client
      .from('ai_draft_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.warn('Supabase fetch all draft sessions warning:', error);
      return [];
    }

    if (!data) return [];

    return data.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      userEmail: row.user_email || undefined,
      userName: row.user_name || undefined,
      title: row.title || undefined,
      keyword: row.keyword,
      keywords: Array.isArray(row.keywords) ? row.keywords : [],
      style: row.style || 'review',
      status: (row.status || 'drafting') as DraftSessionStatus,
      lastStep: row.last_step || 'keyword',
      writingContext: row.writing_context || {},
      options: row.options || {},
      batchItems: Array.isArray(row.batch_items) ? row.batch_items : [],
      seoPlan: row.seo_plan || undefined,
      draftContent: row.draft_content || undefined,
      finalHtml: row.final_html || undefined,
      images: Array.isArray(row.images) ? row.images : [],
      cardNews: row.card_news || undefined,
      metadata: row.metadata || {},
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString(),
      expiresAt: row.expires_at || undefined,
    }));
  } catch (err) {
    console.error('Supabase fetch all draft sessions exception:', err);
    return [];
  }
}

export async function fetchCurrentDraftSessionFromSupabase(userId: string): Promise<AiDraftSession | null> {
  if (!userId) return null;

  // 1. Check local storage cache first for instant UX
  let localSession: AiDraftSession | null = null;
  try {
    const raw = localStorage.getItem(`${LOCAL_CURRENT_DRAFT_KEY_PREFIX}${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.status === 'drafting' || parsed.status === 'temporary')) {
        localSession = parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to parse local draft session cache:', e);
  }

  const client = getSupabaseClient();
  if (!client) return localSession;

  try {
    const { data, error } = await client
      .from('ai_draft_sessions')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['drafting', 'temporary'])
      .order('updated_at', { ascending: false })
      .limit(1);

    if (error) {
      console.warn('Supabase fetch draft session warning:', error);
      return localSession;
    }

    if (!data || data.length === 0) {
      return localSession;
    }

    const row = data[0];
    const dbSession: AiDraftSession = {
      id: row.id,
      userId: row.user_id,
      userEmail: row.user_email || undefined,
      userName: row.user_name || undefined,
      title: row.title || undefined,
      keyword: row.keyword,
      keywords: Array.isArray(row.keywords) ? row.keywords : [],
      style: row.style || 'review',
      status: (row.status || 'drafting') as DraftSessionStatus,
      lastStep: row.last_step || 'keyword',
      writingContext: row.writing_context || {},
      options: row.options || {},
      batchItems: Array.isArray(row.batch_items) ? row.batch_items : [],
      seoPlan: row.seo_plan || undefined,
      draftContent: row.draft_content || undefined,
      finalHtml: row.final_html || undefined,
      images: Array.isArray(row.images) ? row.images : [],
      cardNews: row.card_news || undefined,
      metadata: row.metadata || {},
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString(),
      expiresAt: row.expires_at || undefined,
    };

    // If local session is newer, prefer local
    if (localSession && new Date(localSession.updatedAt).getTime() > new Date(dbSession.updatedAt).getTime()) {
      return localSession;
    }

    // Cache to localStorage
    try {
      localStorage.setItem(`${LOCAL_CURRENT_DRAFT_KEY_PREFIX}${userId}`, JSON.stringify(dbSession));
    } catch (_) {}

    return dbSession;
  } catch (err) {
    console.error('Supabase fetch draft session exception:', err);
    return localSession;
  }
}

export async function saveDraftSessionToSupabase(session: AiDraftSession): Promise<boolean> {
  if (!session || !session.userId) return false;

  const now = new Date().toISOString();
  const sessionWithTime = {
    ...session,
    updatedAt: now,
  };

  // 1. Instant local persistence (ensures zero data loss on network glitches)
  try {
    localStorage.setItem(`${LOCAL_CURRENT_DRAFT_KEY_PREFIX}${session.userId}`, JSON.stringify(sessionWithTime));
    localStorage.setItem(`${LOCAL_DRAFT_KEY_PREFIX}${session.id}`, JSON.stringify(sessionWithTime));
  } catch (e) {
    console.warn('Local draft session cache warning:', e);
  }

  const client = getSupabaseClient();
  if (!client) return true; // Saved locally

  const expiresAt = session.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const payload = {
    id: session.id,
    user_id: session.userId,
    user_email: session.userEmail || null,
    user_name: session.userName || null,
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

  try {
    const { error } = await client.from('ai_draft_sessions').upsert(payload);
    if (error) {
      console.warn('Supabase save draft session warning:', error);
      return true; // Still considered saved in local cache
    }
    return true;
  } catch (err) {
    console.error('Supabase save draft session exception:', err);
    return true;
  }
}

export async function updateDraftSessionInSupabase(
  id: string,
  updates: Partial<AiDraftSession>,
  userId?: string
): Promise<boolean> {
  if (!id) return false;

  const now = new Date().toISOString();

  // Update local storage first
  if (userId) {
    try {
      const raw = localStorage.getItem(`${LOCAL_CURRENT_DRAFT_KEY_PREFIX}${userId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.id === id) {
          const updated = { ...parsed, ...updates, updatedAt: now };
          localStorage.setItem(`${LOCAL_CURRENT_DRAFT_KEY_PREFIX}${userId}`, JSON.stringify(updated));
        }
      }
    } catch (_) {}
  }

  const client = getSupabaseClient();
  if (!client) return true;

  const payload: any = {
    updated_at: now,
  };

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

  try {
    let query = client.from('ai_draft_sessions').update(payload).eq('id', id);
    if (userId) {
      query = query.eq('user_id', userId);
    }
    const { error } = await query;
    if (error) {
      console.warn('Supabase update draft session warning:', error);
    }
    return true;
  } catch (err) {
    console.error('Supabase update draft session exception:', err);
    return true;
  }
}

export async function deleteDraftSessionFromSupabase(id: string, userId?: string): Promise<boolean> {
  if (!id) return false;

  // Clear local storage
  if (userId) {
    try {
      localStorage.removeItem(`${LOCAL_CURRENT_DRAFT_KEY_PREFIX}${userId}`);
      localStorage.removeItem(`${LOCAL_DRAFT_KEY_PREFIX}${id}`);
    } catch (_) {}
  }

  const client = getSupabaseClient();
  if (!client) return true;

  try {
    let query = client.from('ai_draft_sessions').delete().eq('id', id);
    if (userId) {
      query = query.eq('user_id', userId);
    }
    const { error } = await query;
    if (error) {
      console.warn('Supabase delete draft session warning:', error);
    }

    // Try cleaning up storage files under ${userId}/${id}/
    if (userId) {
      try {
        const folderPath = `${userId}/${id}`;
        const { data: fileList } = await client.storage.from('ai-drafts').list(folderPath);
        if (fileList && fileList.length > 0) {
          const filesToDelete = fileList.map((f) => `${folderPath}/${f.name}`);
          await client.storage.from('ai-drafts').remove(filesToDelete);
        }
      } catch (storageErr) {
        console.warn('Supabase storage cleanup warning:', storageErr);
      }
    }

    return true;
  } catch (err) {
    console.error('Supabase delete draft session exception:', err);
    return true;
  }
}

/**
 * Uploads a card news or AI generated image to Supabase Storage 'ai-drafts' bucket
 * and returns the publicly accessible URL. Falls back to null/dataUrl if storage is unconfigured.
 */
export async function uploadDraftImageToSupabaseStorage(
  userId: string,
  draftId: string,
  folder: 'card-news' | 'images',
  fileName: string,
  fileBlob: Blob | string
): Promise<string | null> {
  const client = getSupabaseClient();
  if (!client || !userId || !draftId) return null;

  try {
    let blob: Blob;
    if (typeof fileBlob === 'string') {
      if (fileBlob.startsWith('data:')) {
        const parts = fileBlob.split(',');
        const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
        const bstr = atob(parts[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        blob = new Blob([u8arr], { type: mime });
      } else {
        return fileBlob;
      }
    } else {
      blob = fileBlob;
    }

    const filePath = `${userId}/${draftId}/${folder}/${fileName}`;
    const { error: uploadError } = await client.storage
      .from('ai-drafts')
      .upload(filePath, blob, {
        upsert: true,
        contentType: blob.type || 'image/png',
      });

    if (uploadError && uploadError.message.includes('Bucket not found')) {
       console.warn('[Supabase Client] ai-drafts bucket not found. Creating it server-side...');
       return null; // Fallback to server upload
    }

    if (uploadError) {
      console.warn('Supabase storage upload error:', uploadError);
      return null;
    }

    const { data: publicData } = client.storage.from('ai-drafts').getPublicUrl(filePath);
    return publicData?.publicUrl || null;
  } catch (err) {
    console.warn('Supabase storage upload exception:', err);
    return null;
  }
}

/**
 * Cleans up expired temporary draft sessions and their corresponding storage assets
 */
export async function cleanupExpiredDraftsFromSupabase(userId?: string): Promise<{ deletedCount: number }> {
  const client = getSupabaseClient();
  if (!client) return { deletedCount: 0 };

  try {
    const now = new Date().toISOString();
    let query = client
      .from('ai_draft_sessions')
      .select('id, user_id')
      .in('status', ['drafting', 'temporary'])
      .lt('expires_at', now);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data: expiredSessions, error: selectErr } = await query;
    if (selectErr || !expiredSessions || expiredSessions.length === 0) {
      return { deletedCount: 0 };
    }

    let deletedCount = 0;
    for (const sess of expiredSessions) {
      await deleteDraftSessionFromSupabase(sess.id, sess.user_id);
      deletedCount++;
    }

    return { deletedCount };
  } catch (err) {
    console.error('Expired drafts cleanup exception:', err);
    return { deletedCount: 0 };
  }
}

// =========================================================
// 8. 수익 인증 (Revenue Certifications) CRUD & Storage
// =========================================================
const LOCAL_STORAGE_REVENUE_KEY = 'challenge_revenue_certifications';

export function getLocalRevenueCertifications(): RevenueCertification[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_REVENUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('Failed to parse local revenue certifications:', e);
    return [];
  }
}

export function saveLocalRevenueCertifications(list: RevenueCertification[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_REVENUE_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('Failed to save local revenue certifications:', e);
  }
}

export async function uploadRevenueProofImage(file: File, userId: string): Promise<string> {
  const client = getSupabaseClient();
  const fileExt = file.name.split('.').pop() || 'jpg';
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
  const filePath = `${userId || 'guest'}/${fileName}`;

  // 1. Try Supabase Storage
  if (client) {
    try {
      // Check/create bucket if not exist
      const { data: buckets } = await client.storage.listBuckets();
      const hasBucket = buckets?.some(b => b.name === 'revenue-proofs');
      if (!hasBucket) {
        await client.storage.createBucket('revenue-proofs', { public: true });
      }

      const { data, error } = await client.storage
        .from('revenue-proofs')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type || 'image/jpeg',
        });

      if (!error && data) {
        const { data: publicData } = client.storage.from('revenue-proofs').getPublicUrl(filePath);
        if (publicData?.publicUrl) {
          return publicData.publicUrl;
        }
      } else if (error) {
        console.warn('Supabase storage upload error, falling back to Server API / Base64:', error.message);
      }
    } catch (err) {
      console.warn('Supabase storage upload exception:', err);
    }
  }

  // 2. Try Server API upload
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', userId);
    const res = await fetch('/api/revenue-proofs/upload', {
      method: 'POST',
      body: formData,
    });
    if (res.ok) {
      const json = await res.json();
      if (json.url) return json.url;
    }
  } catch (e) {
    console.warn('Server API upload failed, falling back to DataURL:', e);
  }

  // 3. Fallback to Data URL for instant offline preview & local demo
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

export async function fetchRevenueCertificationsFromSupabase(): Promise<RevenueCertification[]> {
  const localList = getLocalRevenueCertifications();
  const client = getSupabaseClient();
  if (!client) return localList;

  try {
    const { data, error } = await client
      .from('revenue_certifications')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Failed to fetch revenue certifications from Supabase:', error.message);
      return localList;
    }

    if (data && Array.isArray(data)) {
      const mapped: RevenueCertification[] = data.map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        userName: row.user_name || '익명',
        userEmail: row.user_email || '',
        userAvatar: row.user_avatar || '',
        naverBlogId: row.naver_blog_id || '',
        challengeId: row.challenge_id || '',
        challengeName: row.challenge_name || '',
        title: row.title || '',
        content: row.content || '',
        revenueAmount: Number(row.revenue_amount) || 0,
        proofImageUrl: row.proof_image_url || '',
        status: (row.status as RevenueCertificationStatus) || 'pending',
        rejectionReason: row.rejection_reason || undefined,
        isFeatured: Boolean(row.is_featured),
        likesCount: Number(row.likes_count) || 0,
        viewsCount: Number(row.views_count) || 0,
        likedUserIds: Array.isArray(row.liked_user_ids) ? row.liked_user_ids : [],
        approvedAt: row.approved_at || undefined,
        approvedBy: row.approved_by || undefined,
        createdAt: row.created_at || new Date().toISOString(),
        updatedAt: row.updated_at || undefined,
      }));

      // Cache locally
      saveLocalRevenueCertifications(mapped);
      return mapped;
    }
  } catch (err) {
    console.warn('fetchRevenueCertificationsFromSupabase exception:', err);
  }

  return localList;
}

export async function saveRevenueCertificationToSupabase(item: RevenueCertification): Promise<boolean> {
  // Update local storage first for snappy UI
  const localList = getLocalRevenueCertifications();
  const existingIdx = localList.findIndex(c => c.id === item.id);
  let updatedList: RevenueCertification[];
  if (existingIdx >= 0) {
    updatedList = [...localList];
    updatedList[existingIdx] = item;
  } else {
    updatedList = [item, ...localList];
  }
  saveLocalRevenueCertifications(updatedList);

  const client = getSupabaseClient();
  if (!client) return true;

  try {
    const payload = {
      id: item.id,
      user_id: item.userId,
      user_name: item.userName,
      user_email: item.userEmail || null,
      user_avatar: item.userAvatar || null,
      naver_blog_id: item.naverBlogId || null,
      challenge_id: item.challengeId || null,
      challenge_name: item.challengeName || null,
      title: item.title,
      content: item.content,
      revenue_amount: item.revenueAmount,
      proof_image_url: item.proofImageUrl,
      status: item.status,
      rejection_reason: item.rejectionReason || null,
      is_featured: Boolean(item.isFeatured),
      likes_count: item.likesCount || 0,
      views_count: item.viewsCount || 0,
      liked_user_ids: item.likedUserIds || [],
      approved_at: item.approvedAt || null,
      approved_by: item.approvedBy || null,
      created_at: item.createdAt,
      updated_at: item.updatedAt || new Date().toISOString(),
    };

    const { error } = await client
      .from('revenue_certifications')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.warn('saveRevenueCertificationToSupabase upsert error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('saveRevenueCertificationToSupabase exception:', err);
    return false;
  }
}

export async function updateRevenueCertificationStatusInSupabase(
  id: string,
  status: RevenueCertificationStatus,
  options?: {
    rejectionReason?: string;
    approvedBy?: string;
    isFeatured?: boolean;
    revenueAmount?: number;
  }
): Promise<boolean> {
  const localList = getLocalRevenueCertifications();
  const updatedList = localList.map(item => {
    if (item.id === id) {
      return {
        ...item,
        status,
        rejectionReason: options?.rejectionReason !== undefined ? options.rejectionReason : item.rejectionReason,
        approvedBy: options?.approvedBy !== undefined ? options.approvedBy : item.approvedBy,
        approvedAt: status === 'approved' ? (item.approvedAt || new Date().toISOString()) : item.approvedAt,
        isFeatured: options?.isFeatured !== undefined ? options.isFeatured : item.isFeatured,
        revenueAmount: options?.revenueAmount !== undefined ? options.revenueAmount : item.revenueAmount,
        updatedAt: new Date().toISOString(),
      };
    }
    return item;
  });
  saveLocalRevenueCertifications(updatedList);

  const client = getSupabaseClient();
  if (!client) return true;

  try {
    const updatePayload: Record<string, any> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (options?.rejectionReason !== undefined) updatePayload.rejection_reason = options.rejectionReason;
    if (options?.approvedBy !== undefined) updatePayload.approved_by = options.approvedBy;
    if (status === 'approved') updatePayload.approved_at = new Date().toISOString();
    if (options?.isFeatured !== undefined) updatePayload.is_featured = options.isFeatured;
    if (options?.revenueAmount !== undefined) updatePayload.revenue_amount = options.revenueAmount;

    const { error } = await client
      .from('revenue_certifications')
      .update(updatePayload)
      .eq('id', id);

    if (error) {
      console.warn('updateRevenueCertificationStatusInSupabase error:', error.message);
      return false;
    }

    // When a revenue certification is approved, automatically evaluate & award user badges
    if (status === 'approved') {
      const targetCert = updatedList.find((c) => c.id === id);
      if (targetCert && (targetCert.userId || targetCert.userEmail)) {
        setTimeout(async () => {
          try {
            const badges = await fetchBadgesFromSupabase();
            const existingUserBadges = await fetchUserBadgesFromSupabase(targetCert.userId || targetCert.userEmail);
            await evaluateAndAwardUserBadges(
              targetCert.userId || targetCert.userEmail,
              targetCert.userEmail,
              targetCert.userName,
              targetCert.naverBlogId,
              badges,
              updatedList,
              [],
              existingUserBadges
            );
          } catch (evalErr) {
            console.warn('Auto badge evaluation on revenue approval note:', evalErr);
          }
        }, 100);
      }
    }

    return true;
  } catch (err) {
    console.warn('updateRevenueCertificationStatusInSupabase exception:', err);
    return false;
  }
}

export async function deleteRevenueCertificationFromSupabase(id: string): Promise<boolean> {
  const localList = getLocalRevenueCertifications();
  saveLocalRevenueCertifications(localList.filter(item => item.id !== id));

  const client = getSupabaseClient();
  if (!client) return true;

  try {
    const { error } = await client
      .from('revenue_certifications')
      .delete()
      .eq('id', id);

    if (error) {
      console.warn('deleteRevenueCertificationFromSupabase error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('deleteRevenueCertificationFromSupabase exception:', err);
    return false;
  }
}

export async function toggleLikeRevenueCertificationInSupabase(
  id: string,
  userId: string
): Promise<{ likesCount: number; isLiked: boolean }> {
  const localList = getLocalRevenueCertifications();
  let result = { likesCount: 0, isLiked: false };

  const updatedList = localList.map(item => {
    if (item.id === id) {
      const likedIds = item.likedUserIds || [];
      const alreadyLiked = likedIds.includes(userId);
      const nextLikedIds = alreadyLiked
        ? likedIds.filter(uid => uid !== userId)
        : [...likedIds, userId];
      const nextLikesCount = nextLikedIds.length;
      result = { likesCount: nextLikesCount, isLiked: !alreadyLiked };
      return {
        ...item,
        likesCount: nextLikesCount,
        likedUserIds: nextLikedIds,
      };
    }
    return item;
  });
  saveLocalRevenueCertifications(updatedList);

  const client = getSupabaseClient();
  if (client) {
    try {
      const target = updatedList.find(i => i.id === id);
      if (target) {
        await client
          .from('revenue_certifications')
          .update({
            likes_count: target.likesCount,
            liked_user_ids: target.likedUserIds,
          })
          .eq('id', id);
      }
    } catch (e) {
      console.warn('toggleLike error on supabase:', e);
    }
  }

  return result;
}

// ----------------------------------------------------
// 뱃지 시스템 (Badge & Achievement System) Supabase 연동
// ----------------------------------------------------

const LOCAL_STORAGE_BADGES_KEY = 'cpa_badges';
const LOCAL_STORAGE_USER_BADGES_KEY = 'cpa_user_badges';

export function getLocalBadges(): Badge[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_BADGES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('getLocalBadges parse error:', e);
  }
  return DEFAULT_INITIAL_BADGES;
}

export function saveLocalBadges(badges: Badge[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_BADGES_KEY, JSON.stringify(badges));
  } catch (e) {
    console.warn('saveLocalBadges error:', e);
  }
}

export function getLocalUserBadges(): UserBadge[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_USER_BADGES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('getLocalUserBadges parse error:', e);
  }
  return [];
}

export function saveLocalUserBadges(userBadges: UserBadge[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_USER_BADGES_KEY, JSON.stringify(userBadges));
  } catch (e) {
    console.warn('saveLocalUserBadges error:', e);
  }
}

/**
 * Supabase DB에서 모든 뱃지 정의 목록 조회 (비활성 뱃지도 관리자 조회를 위해 포함)
 */
export async function fetchBadgesFromSupabase(): Promise<Badge[]> {
  const client = getSupabaseClient();
  if (!client) {
    return getLocalBadges();
  }

  try {
    const { data, error } = await client
      .from('badges')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      console.warn('fetchBadgesFromSupabase warning (using local):', error.message);
      return getLocalBadges();
    }

    if (data && data.length > 0) {
      const mappedBadges: Badge[] = data.map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.description || '',
        icon: row.icon || '🌱',
        color: row.color || '#10B981',
        category: row.category || '수익',
        conditionType: row.condition_type || 'profit_verification_count',
        conditionValue: Number(row.condition_value) || 1,
        conditionMetadata: row.condition_metadata || {},
        isActive: row.is_active !== false,
        sortOrder: Number(row.sort_order) || 0,
        createdAt: row.created_at || new Date().toISOString(),
        updatedAt: row.updated_at,
      }));

      saveLocalBadges(mappedBadges);
      return mappedBadges;
    }

    // If Supabase table exists but is empty, auto-seed default initial badges
    const initial = getLocalBadges();
    for (const b of initial) {
      saveBadgeToSupabase(b).catch(() => {});
    }
    return initial;
  } catch (err) {
    console.warn('fetchBadgesFromSupabase exception:', err);
    return getLocalBadges();
  }
}

/**
 * 뱃지 생성 또는 수정 (Supabase + LocalStorage)
 */
export async function saveBadgeToSupabase(badge: Badge): Promise<boolean> {
  const localList = getLocalBadges();
  const existingIdx = localList.findIndex((b) => b.id === badge.id);
  let updatedList: Badge[];
  if (existingIdx >= 0) {
    updatedList = [...localList];
    updatedList[existingIdx] = { ...badge, updatedAt: new Date().toISOString() };
  } else {
    updatedList = [...localList, badge];
  }
  saveLocalBadges(updatedList);

  const client = getSupabaseClient();
  if (!client) return true;

  try {
    const payload = {
      id: badge.id,
      name: badge.name,
      description: badge.description,
      icon: badge.icon,
      color: badge.color,
      category: badge.category,
      condition_type: badge.conditionType,
      condition_value: badge.conditionValue,
      condition_metadata: badge.conditionMetadata || {},
      is_active: badge.isActive,
      sort_order: badge.sortOrder,
      updated_at: new Date().toISOString(),
    };

    const { error } = await client
      .from('badges')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.warn('saveBadgeToSupabase error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('saveBadgeToSupabase exception:', err);
    return false;
  }
}

/**
 * 뱃지 정보 수정
 */
export async function updateBadgeInSupabase(id: string, updates: Partial<Badge>): Promise<boolean> {
  const localList = getLocalBadges();
  const updatedList = localList.map((b) => (b.id === id ? { ...b, ...updates, updatedAt: new Date().toISOString() } : b));
  saveLocalBadges(updatedList);

  const client = getSupabaseClient();
  if (!client) return true;

  try {
    const dbPayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (updates.name !== undefined) dbPayload.name = updates.name;
    if (updates.description !== undefined) dbPayload.description = updates.description;
    if (updates.icon !== undefined) dbPayload.icon = updates.icon;
    if (updates.color !== undefined) dbPayload.color = updates.color;
    if (updates.category !== undefined) dbPayload.category = updates.category;
    if (updates.conditionType !== undefined) dbPayload.condition_type = updates.conditionType;
    if (updates.conditionValue !== undefined) dbPayload.condition_value = updates.conditionValue;
    if (updates.conditionMetadata !== undefined) dbPayload.condition_metadata = updates.conditionMetadata;
    if (updates.isActive !== undefined) dbPayload.is_active = updates.isActive;
    if (updates.sortOrder !== undefined) dbPayload.sort_order = updates.sortOrder;

    const { error } = await client.from('badges').update(dbPayload).eq('id', id);
    if (error) {
      console.warn('updateBadgeInSupabase error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('updateBadgeInSupabase exception:', err);
    return false;
  }
}

/**
 * 뱃지 삭제 (기본: 소프트 삭제 is_active = false, 영구 삭제 시 hardDelete = true)
 */
export async function deleteBadgeFromSupabase(id: string, hardDelete = false): Promise<boolean> {
  if (hardDelete) {
    const localList = getLocalBadges().filter((b) => b.id !== id);
    saveLocalBadges(localList);

    const client = getSupabaseClient();
    if (!client) return true;

    try {
      // Delete associated user_badges first
      await client.from('user_badges').delete().eq('badge_id', id);
      const { error } = await client.from('badges').delete().eq('id', id);
      if (error) {
        console.warn('deleteBadgeFromSupabase (hard) error:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('deleteBadgeFromSupabase exception:', err);
      return false;
    }
  } else {
    // Soft delete
    return updateBadgeInSupabase(id, { isActive: false });
  }
}

/**
 * 특정 사용자 또는 전체 사용자가 획득한 뱃지(user_badges) 조회
 */
export async function fetchUserBadgesFromSupabase(userId?: string): Promise<UserBadge[]> {
  const localList = getLocalUserBadges();
  const allBadges = getLocalBadges();
  const badgeMap = new Map(allBadges.map((b) => [b.id, b]));

  const client = getSupabaseClient();
  if (!client) {
    const filtered = userId ? localList.filter((ub) => ub.userId === userId) : localList;
    return filtered.map((ub) => ({
      ...ub,
      badge: badgeMap.get(ub.badgeId) || ub.badge,
    }));
  }

  try {
    let query = client.from('user_badges').select('*');
    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('fetchUserBadgesFromSupabase warning:', error.message);
      const filtered = userId ? localList.filter((ub) => ub.userId === userId) : localList;
      return filtered.map((ub) => ({
        ...ub,
        badge: badgeMap.get(ub.badgeId) || ub.badge,
      }));
    }

    if (data) {
      const mapped: UserBadge[] = data.map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        badgeId: row.badge_id,
        earnedAt: row.earned_at || new Date().toISOString(),
        metadata: row.metadata || {},
        badge: badgeMap.get(row.badge_id),
      }));

      // Merge into local cache
      const mergedLocal = [...localList];
      mapped.forEach((item) => {
        const idx = mergedLocal.findIndex((l) => l.userId === item.userId && l.badgeId === item.badgeId);
        if (idx >= 0) {
          mergedLocal[idx] = item;
        } else {
          mergedLocal.push(item);
        }
      });
      saveLocalUserBadges(mergedLocal);

      return mapped;
    }
    return [];
  } catch (err) {
    console.warn('fetchUserBadgesFromSupabase exception:', err);
    return [];
  }
}

/**
 * 단일 사용자 뱃지 수여 및 DB 저장 (중복 UNIQUE 처리)
 */
export async function awardUserBadgeInSupabase(userBadge: UserBadge): Promise<boolean> {
  const localList = getLocalUserBadges();
  const alreadyEarned = localList.some(
    (ub) => ub.userId === userBadge.userId && ub.badgeId === userBadge.badgeId
  );
  if (!alreadyEarned) {
    saveLocalUserBadges([userBadge, ...localList]);
  }

  const client = getSupabaseClient();
  if (!client) return true;

  try {
    const payload = {
      id: userBadge.id,
      user_id: userBadge.userId,
      badge_id: userBadge.badgeId,
      earned_at: userBadge.earnedAt || new Date().toISOString(),
      metadata: userBadge.metadata || {},
    };

    const { error } = await client
      .from('user_badges')
      .upsert(payload, { onConflict: 'user_id, badge_id' });

    if (error) {
      console.warn('awardUserBadgeInSupabase error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('awardUserBadgeInSupabase exception:', err);
    return false;
  }
}

/**
 * 사용자의 활동/수익 데이터를 종합 평가하여 미획득 뱃지 자동 지급
 */
export async function evaluateAndAwardUserBadges(
  userId: string,
  userEmail?: string,
  userName?: string,
  userNaverId?: string,
  allBadges: Badge[] = [],
  allCertifications: RevenueCertification[] = [],
  allParticipants: Participant[] = [],
  existingUserBadges: UserBadge[] = []
): Promise<{ newlyEarned: UserBadge[]; allUserBadges: UserBadge[] }> {
  if (!userId) return { newlyEarned: [], allUserBadges: existingUserBadges };

  const badges = allBadges.length > 0 ? allBadges : getLocalBadges();
  const metrics = calculateUserMetrics(
    userId,
    userEmail,
    userName,
    userNaverId,
    allCertifications,
    allParticipants
  );

  const userBadges = existingUserBadges.filter((ub) => ub.userId === metrics.userId || (userEmail && ub.userId === userEmail));
  const { newBadgesToAward } = findNewlyQualifiedBadges(badges, userBadges, metrics);

  for (const newUb of newBadgesToAward) {
    await awardUserBadgeInSupabase(newUb);
  }

  const updatedUserBadges = [...newBadgesToAward, ...userBadges];
  return {
    newlyEarned: newBadgesToAward,
    allUserBadges: updatedUserBadges,
  };
}

/**
 * 특정 회원의 뱃지 수여 취소/회수
 */
export async function revokeUserBadgeInSupabase(userBadgeId: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client.from('user_badges').delete().eq('id', userBadgeId);
    if (error) {
      console.warn('revokeUserBadgeInSupabase error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('revokeUserBadgeInSupabase exception:', err);
    return false;
  }
}

/**
 * 전체 회원 대상 뱃지 일괄 재평가 및 자동 수여
 */
export async function batchEvaluateAllBadgesFromSupabase(): Promise<{
  totalEvaluatedUsers: number;
  totalNewBadgesAwarded: number;
}> {
  try {
    const [allBadges, allUserBadges, allCertifications, allParticipants] = await Promise.all([
      fetchBadgesFromSupabase(),
      fetchUserBadgesFromSupabase(),
      fetchRevenueCertificationsFromSupabase(),
      fetchParticipantsFromSupabase(),
    ]);

    // Collect distinct users from participants and certifications
    const distinctUserMap = new Map<string, { userId: string; userEmail?: string; userName?: string; userNaverId?: string }>();

    allParticipants.forEach((p) => {
      const key = (p.blogId || p.participantName || p.id).toLowerCase().trim();
      if (!distinctUserMap.has(key)) {
        distinctUserMap.set(key, {
          userId: p.id || key,
          userName: p.participantName,
          userNaverId: p.blogId || undefined,
        });
      }
    });

    allCertifications.forEach((c) => {
      const key = (c.userId || c.userEmail || c.userName || c.id).toLowerCase().trim();
      if (!distinctUserMap.has(key)) {
        distinctUserMap.set(key, {
          userId: c.userId || key,
          userEmail: c.userEmail,
          userName: c.userName,
          userNaverId: c.naverBlogId,
        });
      }
    });

    let totalNew = 0;
    for (const user of distinctUserMap.values()) {
      const result = await evaluateAndAwardUserBadges(
        user.userId,
        user.userEmail,
        user.userName,
        user.userNaverId,
        allBadges,
        allCertifications,
        allParticipants,
        allUserBadges
      );
      totalNew += result.newlyEarned.length;
    }

    return {
      totalEvaluatedUsers: distinctUserMap.size,
      totalNewBadgesAwarded: totalNew,
    };
  } catch (err) {
    console.error('batchEvaluateAllBadgesFromSupabase failed:', err);
    return {
      totalEvaluatedUsers: 0,
      totalNewBadgesAwarded: 0,
    };
  }
}

/**
 * =========================================================
 * [네이버 블로그 독립 원장 (blog_posts) 관련 Supabase API]
 * =========================================================
 */

/**
 * Supabase에서 수집된 고유 블로그 포스팅 목록 조회
 */
export async function fetchBlogPostsFromSupabase(blogId?: string): Promise<BlogPost[]> {
  const client = getSupabaseClient();
  if (!client) return [];

  try {
    let query = client
      .from('blog_posts')
      .select('*')
      .order('published_date', { ascending: false });

    if (blogId) {
      const cleanId = extractNaverBlogId(blogId);
      if (cleanId) {
        query = query.eq('blog_id', cleanId.toLowerCase());
      }
    }

    const { data, error } = await query;
    if (error) {
      console.warn('fetchBlogPostsFromSupabase error:', error.message);
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      blogId: row.blog_id,
      postId: row.post_id,
      title: row.title,
      link: row.post_url,
      pubDate: row.published_at,
      publishedDate: row.published_date,
      userId: row.user_id,
      participantId: row.participant_id,
      createdAt: row.created_at,
    }));
  } catch (err) {
    console.warn('fetchBlogPostsFromSupabase exception:', err);
    return [];
  }
}

/**
 * 고유 블로그 포스팅 배치 저장 (중복 방지 upsert)
 */
export async function saveBlogPostsToSupabase(posts: BlogPost[]): Promise<{ count: number; success: boolean }> {
  if (!posts || posts.length === 0) return { count: 0, success: true };
  const client = getSupabaseClient();
  if (!client) return { count: 0, success: false };

  try {
    const payload = posts.map((p) => {
      const cleanBlogId = (extractNaverBlogId(p.blogId) || p.blogId || '').toLowerCase();
      const canonicalUrl = getCanonicalNaverPostUrl(cleanBlogId, p.link);
      const id = p.id || generateBlogPostKey(cleanBlogId, canonicalUrl);
      const postId = p.postId || extractNaverPostId(p.link);

      return {
        id,
        blog_id: cleanBlogId,
        post_id: postId || null,
        post_url: canonicalUrl,
        title: p.title || '제목 없음',
        published_at: p.pubDate ? new Date(p.pubDate).toISOString() : new Date().toISOString(),
        published_date: p.publishedDate || new Date().toISOString().split('T')[0],
        user_id: p.userId || null,
        participant_id: p.participantId || null,
      };
    });

    const { error } = await client
      .from('blog_posts')
      .upsert(payload, { onConflict: 'blog_id, post_url', ignoreDuplicates: false });

    if (error) {
      console.warn('saveBlogPostsToSupabase upsert error:', error.message);
      return { count: 0, success: false };
    }

    return { count: payload.length, success: true };
  } catch (err) {
    console.warn('saveBlogPostsToSupabase exception:', err);
    return { count: 0, success: false };
  }
}

/**
 * 전체 또는 특정 블로그의 고유 포스팅 개수 조회 (Deduplicated Count)
 */
export async function fetchDistinctBlogPostsCount(blogId?: string): Promise<number> {
  const client = getSupabaseClient();
  if (!client) return 0;

  try {
    let query = client.from('blog_posts').select('id', { count: 'exact', head: true });
    if (blogId) {
      const cleanId = extractNaverBlogId(blogId);
      if (cleanId) {
        query = query.eq('blog_id', cleanId.toLowerCase());
      }
    }

    const { count, error } = await query;
    if (error) {
      console.warn('fetchDistinctBlogPostsCount error:', error.message);
      return 0;
    }

    return count || 0;
  } catch (err) {
    console.warn('fetchDistinctBlogPostsCount exception:', err);
    return 0;
  }
}

/**
 * =========================================================
 * [사용자 블로그 출력 서식 설정 (user_blog_styles) 관련 Supabase API]
 * =========================================================
 */

/**
 * Supabase에서 사용자 고유 블로그 출력 서식 설정 조회
 */
export async function fetchUserBlogStyleFromSupabase(userId: string): Promise<UserBlogStyle | null> {
  if (!userId) return null;
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('user_blog_styles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.warn('fetchUserBlogStyleFromSupabase query error:', error.message);
      return null;
    }

    if (!data) return null;

    return {
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
  } catch (err) {
    console.warn('fetchUserBlogStyleFromSupabase exception:', err);
    return null;
  }
}

/**
 * Supabase에 사용자 고유 블로그 출력 서식 설정 저장 (Upsert)
 */
export async function saveUserBlogStyleToSupabase(style: UserBlogStyle): Promise<boolean> {
  if (!style || !style.userId) return false;
  const client = getSupabaseClient();
  if (!client) return false;

  try {
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

    const { error } = await client
      .from('user_blog_styles')
      .upsert(payload, { onConflict: 'user_id' });

    if (error) {
      console.warn('saveUserBlogStyleToSupabase upsert error:', error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.warn('saveUserBlogStyleToSupabase exception:', err);
    return false;
  }
}

/**
 * Supabase에서 카테고리별/전체 황금 트렌드 키워드 목록 조회
 */
export async function fetchTrendKeywordsFromSupabase(category?: string): Promise<TrendKeyword[]> {
  const client = getSupabaseClient();
  if (!client) return [];

  try {
    let allRows: any[] = [];

    if (category && category !== '전체') {
      const { data, error } = await client
        .from('trend_keywords')
        .select('*')
        .eq('category', category)
        .order('collected_at', { ascending: false })
        .limit(1000);

      if (error) {
        console.warn(`fetchTrendKeywordsFromSupabase error for category "${category}":`, error.message);
        return [];
      }
      allRows = data || [];
    } else {
      // 전체 카테고리 조회 시: 단일 쿼리 시 Supabase 기본 1,000건 제한으로 최신 수집된 특정 카테고리만 반환되는 현상 방지
      // 모든 카테고리별로 병렬 쿼리하여 각 카테고리의 최신 키워드를 고르게 수집 (카테고리당 최대 300건)
      const allCategoryIds = DEFAULT_TREND_CATEGORIES.map((c) => c.id);
      
      const fetchCategoryPromises = allCategoryIds.map(async (catId) => {
        const { data, error } = await client
          .from('trend_keywords')
          .select('*')
          .eq('category', catId)
          .order('collected_at', { ascending: false })
          .limit(300);

        if (error) {
          console.warn(`fetchTrendKeywordsFromSupabase error for category "${catId}":`, error.message);
          return [];
        }
        return data || [];
      });

      const results = await Promise.all(fetchCategoryPromises);
      for (const catRows of results) {
        if (catRows && catRows.length > 0) {
          allRows.push(...catRows);
        }
      }
    }

    if (!allRows || !Array.isArray(allRows)) return [];

    const mappedKeywords: TrendKeyword[] = [];

    for (const row of allRows) {
      const pc = Number(row.pc_search_volume) || 0;
      const mobile = Number(row.mobile_search_volume) || 0;
      const total = pc + mobile;

      // 최소 검색량(MIN_GOLDEN_SEARCH_VOLUME: 300) 미달 키워드 엄격 배제
      if (total < MIN_GOLDEN_SEARCH_VOLUME) {
        continue;
      }

      const comp = row.competition_index || '보통';
      const docCount = typeof row.document_count === 'number' && row.document_count > 0
        ? row.document_count
        : Math.max(1, Math.round(total * (comp === '낮음' ? 0.7 : comp === '중간' ? 1.5 : 3.5)));
      const ratio = typeof row.search_to_document_ratio === 'number'
        ? row.search_to_document_ratio
        : Number((total / docCount).toFixed(4));

      let blogLevel: '황금 (최상)' | '유리 (상)' | '보통' | '과열' = '보통';
      if (ratio >= 1.0) blogLevel = '황금 (최상)';
      else if (ratio >= 0.3) blogLevel = '유리 (상)';
      else if (ratio >= 0.05) blogLevel = '보통';
      else blogLevel = '과열';

      mappedKeywords.push({
        id: row.id,
        category: row.category,
        keyword: row.keyword,
        pcSearchVolume: pc,
        mobileSearchVolume: mobile,
        totalSearchVolume: total,
        competitionIndex: comp,
        adCompetitionIndex: comp,
        documentCount: docCount,
        searchToDocumentRatio: ratio,
        blogCompetitionLevel: blogLevel,
        dataSource: row.data_source || 'real_api',
        collectedAt: row.collected_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    }

    return mappedKeywords;
  } catch (err) {
    console.warn('fetchTrendKeywordsFromSupabase exception:', err);
    return [];
  }
}

/**
 * Supabase에서 동적 트렌드 카테고리 설정 조회 (없으면 기본 14개 설정 반환)
 */
export async function fetchTrendCategoryConfigsFromSupabase(): Promise<TrendCategoryItem[]> {
  const client = getSupabaseClient();
  if (!client) return DEFAULT_TREND_CATEGORIES;

  try {
    const { data, error } = await client
      .from('trend_category_configs')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error || !data || data.length === 0) {
      return DEFAULT_TREND_CATEGORIES;
    }

    return data.map((row: any) => ({
      id: row.id,
      name: row.name || row.id,
      iconName: row.icon_name || 'Compass',
      description: row.description || '',
      seeds: Array.isArray(row.seeds) ? row.seeds : (typeof row.seeds === 'string' ? JSON.parse(row.seeds || '[]') : []),
      isDefault: Boolean(row.is_default),
      enabled: row.enabled !== false,
      order: row.sort_order ?? 0,
    }));
  } catch (err) {
    console.warn('fetchTrendCategoryConfigsFromSupabase exception, falling back to defaults:', err);
    return DEFAULT_TREND_CATEGORIES;
  }
}

/**
 * Supabase에 트렌드 카테고리 설정 저장 / Upsert
 */
export async function saveTrendCategoryConfigToSupabase(category: TrendCategoryItem): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase client not initialized' };

  try {
    const row = {
      id: category.id,
      name: category.name,
      icon_name: category.iconName || 'Compass',
      description: category.description || '',
      seeds: category.seeds || [],
      is_default: Boolean(category.isDefault),
      enabled: category.enabled !== false,
      sort_order: category.order ?? 0,
      updated_at: new Date().toISOString(),
    };

    const { error } = await client
      .from('trend_category_configs')
      .upsert(row, { onConflict: 'id' });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to save category config' };
  }
}

/**
 * Supabase에서 트렌드 카테고리 삭제
 */
export async function deleteTrendCategoryConfigFromSupabase(id: string): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase client not initialized' };

  try {
    const { error } = await client
      .from('trend_category_configs')
      .delete()
      .eq('id', id);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to delete category config' };
  }
}

/**
 * Supabase에 황금 트렌드 키워드 일괄 Upsert
 */
export async function saveTrendKeywordsToSupabase(keywords: TrendKeyword[]): Promise<{ count: number; error?: string }> {
  if (!keywords || keywords.length === 0) return { count: 0 };
  const client = getSupabaseClient();
  if (!client) return { count: 0, error: 'Supabase client not initialized' };

  try {
    // 최소 검색량(MIN_GOLDEN_SEARCH_VOLUME: 300) 이상인 키워드만 DB에 저장
    const qualifiedKeywords = keywords.filter((k) => {
      const pc = Number(k.pcSearchVolume) || 0;
      const mo = Number(k.mobileSearchVolume) || 0;
      const total = k.totalSearchVolume ?? (pc + mo);
      return total >= MIN_GOLDEN_SEARCH_VOLUME;
    });

    if (qualifiedKeywords.length === 0) {
      return { count: 0 };
    }

    const fullRows = qualifiedKeywords.map((k) => ({
      category: k.category,
      keyword: k.keyword,
      pc_search_volume: Number(k.pcSearchVolume) || 0,
      mobile_search_volume: Number(k.mobileSearchVolume) || 0,
      competition_index: k.competitionIndex || '보통',
      document_count: typeof k.documentCount === 'number' ? k.documentCount : null,
      search_to_document_ratio: typeof k.searchToDocumentRatio === 'number' ? k.searchToDocumentRatio : null,
      data_source: k.dataSource || 'real_api',
      collected_at: k.collectedAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    // 1. Try Upsert with document_count & search_to_document_ratio & data_source
    const { data, error } = await client
      .from('trend_keywords')
      .upsert(fullRows, { onConflict: 'category,keyword' })
      .select();

    if (!error) {
      return { count: data ? data.length : fullRows.length };
    }

    // 2. If table schema differs, retry with base columns
    console.warn('saveTrendKeywordsToSupabase full upsert warning, retrying basic schema:', error.message);
    const basicRows = qualifiedKeywords.map((k) => ({
      category: k.category,
      keyword: k.keyword,
      pc_search_volume: Number(k.pcSearchVolume) || 0,
      mobile_search_volume: Number(k.mobileSearchVolume) || 0,
      competition_index: k.competitionIndex || '보통',
      collected_at: k.collectedAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const basicRes = await client
      .from('trend_keywords')
      .upsert(basicRows, { onConflict: 'category,keyword' })
      .select();

    if (basicRes.error) {
      console.warn('saveTrendKeywordsToSupabase basic upsert error:', basicRes.error.message);
      return { count: 0, error: basicRes.error.message };
    }

    return { count: basicRes.data ? basicRes.data.length : basicRows.length };
  } catch (err: any) {
    console.warn('saveTrendKeywordsToSupabase exception:', err);
    return { count: 0, error: err?.message || 'Database error' };
  }
}

/**
 * =========================================================
 * [일간/월간 트렌드 키워드 히스토리 (trend_keyword_daily) Supabase API]
 * =========================================================
 */

/**
 * Supabase에 날짜별 트렌드 키워드 이력 저장 (trend_keyword_daily)
 */
export async function saveDailyTrendKeywordsToSupabase(
  keywords: TrendKeyword[],
  dateStr?: string
): Promise<{ count: number; error?: string }> {
  if (!keywords || keywords.length === 0) return { count: 0 };
  const client = getSupabaseClient();
  if (!client) return { count: 0, error: 'Supabase client not initialized' };

  const targetDate = dateStr || new Date().toISOString().split('T')[0];

  try {
    const rows = keywords.map((k) => {
      const pc = Number(k.pcSearchVolume) || 0;
      const mobile = Number(k.mobileSearchVolume) || 0;
      return {
        category: k.category,
        keyword: k.keyword,
        collected_date: targetDate,
        pc_search_volume: pc,
        mobile_search_volume: mobile,
        total_volume: pc + mobile,
        data_source: k.dataSource || 'real_api',
      };
    });

    // 1. Try Upsert with onConflict on (category, keyword, collected_date)
    let { data, error } = await client
      .from('trend_keyword_daily')
      .upsert(rows, { onConflict: 'category,keyword,collected_date' })
      .select();

    if (error) {
      // If table exists but constraint differs, try delete existing for the day + insert
      try {
        await client
          .from('trend_keyword_daily')
          .delete()
          .eq('collected_date', targetDate);

        const insertRes = await client.from('trend_keyword_daily').insert(rows).select();
        if (!insertRes.error) {
          return { count: insertRes.data ? insertRes.data.length : rows.length };
        }
      } catch {
        // Continue
      }
      console.warn('saveDailyTrendKeywordsToSupabase warning:', error.message);
      return { count: 0, error: error.message };
    }

    return { count: data ? data.length : rows.length };
  } catch (err: any) {
    console.warn('saveDailyTrendKeywordsToSupabase exception:', err);
    return { count: 0, error: err?.message || 'Database error' };
  }
}

export interface TrendRankingResponse {
  keywords: TrendKeyword[];
  uniqueDateCount: number;
  isSufficientHistory: boolean;
  targetDate?: string;
}

/**
 * 일간 / 월간 검색량 랭킹 조회 (순수 검색량 순위)
 */
/**
 * 일간/월간 트렌드 키워드 랭킹 조회
 * - daily: 가장 최근 수집일(latest collected_date)의 데이터를 기준으로 순위 산출.
 *          직전 수집일(prev collected_date)의 동일 키워드 검색량과 비교하여 전일 대비 증감율(dayOverDayChange) 산출.
 *          이틀치 미만 데이터는 isNew: true 설정 및 2일 미만 시 안내문 지원.
 * - monthly: 네이버 검색광고 API가 제공하는 최근 30일 평균 검색량(total_volume)을 기준으로 순위 산출.
 */
export async function fetchDailyTrendKeywordsRankingFromSupabase(
  period: 'daily' | 'monthly',
  category?: string
): Promise<TrendRankingResponse> {
  const client = getSupabaseClient();
  if (!client) {
    return { keywords: [], uniqueDateCount: 0, isSufficientHistory: false };
  }

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  try {
    if (period === 'daily') {
      // 1. 일간: 가장 최근 2개의 고유 수집 일자(collected_date) 확인
      let distinctDatesQuery = client
        .from('trend_keyword_daily')
        .select('collected_date')
        .order('collected_date', { ascending: false });

      if (category && category !== '전체') {
        distinctDatesQuery = distinctDatesQuery.eq('category', category);
      }

      const { data: dateRows } = await distinctDatesQuery.limit(200);
      const uniqueDateSet = new Set<string>();
      (dateRows || []).forEach((r: any) => {
        if (r.collected_date) uniqueDateSet.add(r.collected_date);
      });
      const sortedUniqueDates = Array.from(uniqueDateSet).sort().reverse();
      const uniqueDateCount = sortedUniqueDates.length;
      const isSufficientHistory = uniqueDateCount >= 2;

      const latestDate = sortedUniqueDates[0] || todayStr;
      const prevDate = sortedUniqueDates.length >= 2 ? sortedUniqueDates[1] : null;

      // 최신일 데이터 조회
      let query = client
        .from('trend_keyword_daily')
        .select('*')
        .eq('collected_date', latestDate)
        .order('total_volume', { ascending: false });

      if (category && category !== '전체') {
        query = query.eq('category', category);
      }

      const { data: latestData, error } = await query;
      if (error || !latestData || latestData.length === 0) {
        // Fallback: trend_keywords 테이블에서 가져오기
        const latestTrends = await fetchTrendKeywordsFromSupabase(category);
        const sorted = latestTrends.sort((a, b) => (b.totalSearchVolume || 0) - (a.totalSearchVolume || 0));
        return {
          keywords: sorted.map((k) => ({ ...k, isNew: true, dayOverDayChange: null })),
          uniqueDateCount: 1,
          isSufficientHistory: false,
          targetDate: todayStr,
        };
      }

      // 이전일 데이터가 있으면 키워드별 검색량 Map 구성
      const prevVolumeMap = new Map<string, number>();
      if (prevDate) {
        let prevQuery = client
          .from('trend_keyword_daily')
          .select('keyword, category, total_volume, pc_search_volume, mobile_search_volume')
          .eq('collected_date', prevDate);

        if (category && category !== '전체') {
          prevQuery = prevQuery.eq('category', category);
        }

        const { data: prevData } = await prevQuery;
        if (prevData && prevData.length > 0) {
          prevData.forEach((row: any) => {
            const vol = Number(row.total_volume) || ((Number(row.pc_search_volume) || 0) + (Number(row.mobile_search_volume) || 0));
            prevVolumeMap.set(`${row.category}_${row.keyword}`, vol);
          });
        }
      }

      const mapped: TrendKeyword[] = latestData.map((row: any) => {
        const pc = Number(row.pc_search_volume) || 0;
        const mobile = Number(row.mobile_search_volume) || 0;
        const total = Number(row.total_volume) || (pc + mobile);
        const key = `${row.category}_${row.keyword}`;

        let dayOverDayChange: number | null = null;
        let isNew = false;

        if (prevDate && prevVolumeMap.has(key)) {
          const prevVol = prevVolumeMap.get(key)!;
          if (prevVol > 0) {
            // 전일 대비 증감율 (%) 계산: ((당일 - 전일) / 전일) * 100
            dayOverDayChange = Number((((total - prevVol) / prevVol) * 100).toFixed(1));
          } else {
            dayOverDayChange = total > 0 ? 100 : 0;
          }
        } else {
          // 직전 데이터가 없거나 2일치 미만인 경우 NEW
          isNew = true;
        }

        return {
          id: row.id,
          category: row.category,
          keyword: row.keyword,
          pcSearchVolume: pc,
          mobileSearchVolume: mobile,
          totalSearchVolume: total,
          competitionIndex: '보통',
          dayOverDayChange,
          isNew,
          dataSource: row.data_source || 'real_api',
          collectedAt: row.collected_date,
        };
      });

      return {
        keywords: mapped,
        uniqueDateCount,
        isSufficientHistory,
        targetDate: latestDate,
      };
    } else {
      // 2. 월간: 검색광고 API가 제공하는 최근 30일 평균 검색량(월간 기준)으로 랭킹 산출
      // trend_keyword_daily의 최신 수집일 또는 trend_keywords의 30일 기준 수치 활용
      let query = client
        .from('trend_keyword_daily')
        .select('collected_date')
        .order('collected_date', { ascending: false })
        .limit(1);

      if (category && category !== '전체') {
        query = query.eq('category', category);
      }

      const { data: latestDateData } = await query;
      const targetDate = latestDateData && latestDateData[0]?.collected_date
        ? latestDateData[0].collected_date
        : todayStr;

      let monthlyQuery = client
        .from('trend_keyword_daily')
        .select('*')
        .eq('collected_date', targetDate)
        .order('total_volume', { ascending: false });

      if (category && category !== '전체') {
        monthlyQuery = monthlyQuery.eq('category', category);
      }

      const { data, error } = await monthlyQuery;

      if (error || !data || data.length === 0) {
        // Fallback: trend_keywords 테이블에서 가져오기
        const latestTrends = await fetchTrendKeywordsFromSupabase(category);
        const sorted = latestTrends.sort((a, b) => (b.totalSearchVolume || 0) - (a.totalSearchVolume || 0));
        return {
          keywords: sorted,
          uniqueDateCount: 1,
          isSufficientHistory: true,
          targetDate,
        };
      }

      const mapped: TrendKeyword[] = data.map((row: any, idx: number) => {
        const pc = Number(row.pc_search_volume) || 0;
        const mobile = Number(row.mobile_search_volume) || 0;
        const total = Number(row.total_volume) || (pc + mobile);
        return {
          id: row.id || `m_rank_${idx + 1}`,
          category: row.category,
          keyword: row.keyword,
          pcSearchVolume: pc,
          mobileSearchVolume: mobile,
          totalSearchVolume: total,
          competitionIndex: '보통',
          dataSource: row.data_source || 'real_api',
          collectedAt: row.collected_date,
        };
      });

      // totalSearchVolume(최근 30일 월간 검색량) 내림차순 정렬
      mapped.sort((a, b) => (b.totalSearchVolume || 0) - (a.totalSearchVolume || 0));

      return {
        keywords: mapped,
        uniqueDateCount: 1,
        isSufficientHistory: true,
        targetDate,
      };
    }
  } catch (err) {
    console.warn('fetchDailyTrendKeywordsRankingFromSupabase exception:', err);
    const latestTrends = await fetchTrendKeywordsFromSupabase(category);
    const sorted = latestTrends.sort((a, b) => (b.totalSearchVolume || 0) - (a.totalSearchVolume || 0));
    return {
      keywords: sorted,
      uniqueDateCount: 0,
      isSufficientHistory: false,
    };
  }
}

/**
 * Supabase DB에서 사이트 메뉴 탭 설정 조회
 */
export async function fetchNavigationTabsFromSupabase(): Promise<Record<MainTabType, NavigationTabItem>> {
  const client = getSupabaseClient();
  if (!client) {
    return getStoredNavigationTabs();
  }

  try {
    const { data, error } = await client
      .from('app_settings')
      .select('value')
      .eq('key', 'navigation_tabs')
      .single();

    if (error || !data || !data.value) {
      return getStoredNavigationTabs();
    }

    const merged = {
      ...DEFAULT_NAVIGATION_TABS,
      ...(data.value as Record<string, any>),
    };
    if (merged.toolkit?.label === 'AI 수익화 툴킷' || merged.toolkit?.label === 'AI 수익화 툴킷(Beta)') {
      merged.toolkit = {
        ...merged.toolkit,
        label: 'AI 초안 생성기',
        shortLabel: '초안 생성기',
      };
    }
    saveStoredNavigationTabs(merged);
    return merged;
  } catch (err) {
    console.warn('fetchNavigationTabsFromSupabase exception:', err);
    return getStoredNavigationTabs();
  }
}

/**
 * Supabase DB 및 localStorage에 사이트 메뉴 탭 설정 저장
 */
export async function saveNavigationTabsToSupabase(
  tabs: Record<MainTabType, NavigationTabItem>
): Promise<{ success: boolean; error?: string }> {
  // 1. LocalStorage 우선 즉시 동기화
  saveStoredNavigationTabs(tabs);

  const client = getSupabaseClient();
  if (!client) {
    return { success: true };
  }

  try {
    const { error } = await client
      .from('app_settings')
      .upsert(
        {
          key: 'navigation_tabs',
          value: tabs,
          description: '사이트 메인 네비게이션 및 메뉴 탭 이름 설정',
          updated_at: new Date().toISOString(),
          updated_by: 'admin',
        },
        { onConflict: 'key' }
      );

    if (error) {
      console.warn('saveNavigationTabsToSupabase upsert warning:', error.message);
      return { success: true, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.warn('saveNavigationTabsToSupabase exception:', err);
    return { success: true, error: err.message };
  }
}

// ====================================================
// 구매 등급 및 기능 권한 / 사용량 제한 관리 함수들
// ====================================================

/**
 * 등급 목록 조회 (DB 우선, 없을 시 기본값 반환 및 로컬 캐시 갱신)
 */
export async function fetchMembershipTiersFromSupabase(): Promise<MembershipTier[]> {
  const client = getSupabaseClient();
  if (!client) {
    return getCachedTiers();
  }

  try {
    const { data, error } = await client
      .from('membership_tiers')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error || !data || data.length === 0) {
      // Seed default tiers to DB if empty
      if (data && data.length === 0) {
        await seedDefaultMembershipsToSupabase();
      }
      return getCachedTiers();
    }

    const mapped: MembershipTier[] = data.map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description || '',
      isActive: row.is_active ?? true,
      sortOrder: Number(row.sort_order) || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    setCachedTiers(mapped);
    return mapped;
  } catch (err) {
    console.warn('fetchMembershipTiersFromSupabase error:', err);
    return getCachedTiers();
  }
}

/**
 * 등급 저장/수정
 */
export async function saveMembershipTierToSupabase(
  tier: Partial<MembershipTier> & { id: string; name: string }
): Promise<{ success: boolean; data?: MembershipTier; error?: string }> {
  const tiers = getCachedTiers();
  const existingIdx = tiers.findIndex((t) => t.id === tier.id);
  const updatedTier: MembershipTier = {
    id: tier.id,
    name: tier.name,
    description: tier.description || '',
    isActive: tier.isActive ?? true,
    sortOrder: tier.sortOrder ?? (existingIdx >= 0 ? tiers[existingIdx].sortOrder : tiers.length + 1),
    updatedAt: new Date().toISOString(),
    createdAt: tier.createdAt || (existingIdx >= 0 ? tiers[existingIdx].createdAt : new Date().toISOString()),
  };

  const newTiers = existingIdx >= 0
    ? tiers.map((t) => (t.id === tier.id ? updatedTier : t))
    : [...tiers, updatedTier];
  
  setCachedTiers(newTiers);

  const client = getSupabaseClient();
  if (!client) return { success: true, data: updatedTier };

  try {
    const payload = {
      id: updatedTier.id,
      name: updatedTier.name,
      description: updatedTier.description,
      is_active: updatedTier.isActive,
      sort_order: updatedTier.sortOrder,
      updated_at: updatedTier.updatedAt,
      created_at: updatedTier.createdAt,
    };

    const { error } = await client.from('membership_tiers').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.warn('saveMembershipTierToSupabase DB error:', error.message);
    }
    return { success: true, data: updatedTier };
  } catch (err: any) {
    return { success: true, data: updatedTier, error: err?.message };
  }
}

/**
 * 등급 삭제 (기본 free/admin 등급은 삭제 불가 보호)
 */
export async function deleteMembershipTierFromSupabase(tierId: string): Promise<{ success: boolean; error?: string }> {
  if (tierId === 'free' || tierId === 'admin') {
    return { success: false, error: '기본 등급(무료/관리자)은 시스템 기본 등급으로 삭제할 수 없습니다.' };
  }

  const tiers = getCachedTiers().filter((t) => t.id !== tierId);
  setCachedTiers(tiers);

  const client = getSupabaseClient();
  if (!client) return { success: true };

  try {
    const { error } = await client.from('membership_tiers').delete().eq('id', tierId);
    if (error) console.warn('deleteMembershipTierFromSupabase error:', error.message);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

/**
 * 기능 목록 조회
 */
export async function fetchFeaturesFromSupabase(): Promise<FeatureItem[]> {
  const client = getSupabaseClient();
  if (!client) return getCachedFeatures();

  try {
    const { data, error } = await client
      .from('features')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error || !data || data.length === 0) {
      return getCachedFeatures();
    }

    const mapped: FeatureItem[] = data.map((row: any) => ({
      id: row.id,
      featureKey: row.feature_key,
      name: row.name,
      description: row.description || '',
      category: row.category || 'general',
      isActive: row.is_active ?? true,
      sortOrder: Number(row.sort_order) || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    setCachedFeatures(mapped);
    return mapped;
  } catch (err) {
    console.warn('fetchFeaturesFromSupabase error:', err);
    return getCachedFeatures();
  }
}

/**
 * 기능 항목 저장/수정
 */
export async function saveFeatureToSupabase(
  feature: Partial<FeatureItem> & { featureKey: string; name: string }
): Promise<{ success: boolean; data?: FeatureItem; error?: string }> {
  const features = getCachedFeatures();
  const existingIdx = features.findIndex((f) => f.featureKey === feature.featureKey);
  const updatedFeat: FeatureItem = {
    id: feature.id || (existingIdx >= 0 ? features[existingIdx].id : `feat_${feature.featureKey}`),
    featureKey: feature.featureKey,
    name: feature.name,
    description: feature.description || '',
    category: feature.category || (existingIdx >= 0 ? features[existingIdx].category : 'ai_draft'),
    isActive: feature.isActive ?? true,
    sortOrder: feature.sortOrder ?? (existingIdx >= 0 ? features[existingIdx].sortOrder : features.length + 1),
    updatedAt: new Date().toISOString(),
    createdAt: feature.createdAt || (existingIdx >= 0 ? features[existingIdx].createdAt : new Date().toISOString()),
  };

  const newFeatures = existingIdx >= 0
    ? features.map((f) => (f.featureKey === feature.featureKey ? updatedFeat : f))
    : [...features, updatedFeat];
  setCachedFeatures(newFeatures);

  const client = getSupabaseClient();
  if (!client) return { success: true, data: updatedFeat };

  try {
    const payload = {
      id: updatedFeat.id,
      feature_key: updatedFeat.featureKey,
      name: updatedFeat.name,
      description: updatedFeat.description,
      category: updatedFeat.category,
      is_active: updatedFeat.isActive,
      sort_order: updatedFeat.sortOrder,
      updated_at: updatedFeat.updatedAt,
      created_at: updatedFeat.createdAt,
    };
    const { error } = await client.from('features').upsert(payload, { onConflict: 'feature_key' });
    if (error) console.warn('saveFeatureToSupabase DB error:', error.message);
    return { success: true, data: updatedFeat };
  } catch (err: any) {
    return { success: true, data: updatedFeat, error: err?.message };
  }
}

/**
 * 등급별 기능 권한 설정 매트릭스 조회
 */
export async function fetchTierFeaturesFromSupabase(): Promise<Record<string, Record<string, { enabled: boolean; usageLimit: number | null; usagePeriod: UsagePeriod }>>> {
  const client = getSupabaseClient();
  if (!client) return getCachedTierFeatures();

  try {
    const { data, error } = await client
      .from('tier_features')
      .select('tier_id, feature_id, enabled, usage_limit, usage_period, features(feature_key)');

    if (error || !data || data.length === 0) {
      return getCachedTierFeatures();
    }

    const matrix: Record<string, Record<string, { enabled: boolean; usageLimit: number | null; usagePeriod: UsagePeriod }>> = {};

    for (const row of data) {
      const tierId = row.tier_id;
      const featKey = (row.features as any)?.feature_key;
      if (!tierId || !featKey) continue;

      if (!matrix[tierId]) matrix[tierId] = {};
      matrix[tierId][featKey] = {
        enabled: Boolean(row.enabled),
        usageLimit: row.usage_limit === null || row.usage_limit === undefined ? null : Number(row.usage_limit),
        usagePeriod: (row.usage_period || 'none') as UsagePeriod,
      };
    }

    // Merge with defaults for missing combinations
    const merged = {
      ...DEFAULT_TIER_FEATURES,
      ...matrix,
    };

    setCachedTierFeatures(merged);
    return merged;
  } catch (err) {
    console.warn('fetchTierFeaturesFromSupabase error:', err);
    return getCachedTierFeatures();
  }
}

/**
 * 특정 등급의 기능 권한 및 사용량 설정 저장
 */
export async function saveTierFeaturesToSupabase(
  tierId: string,
  featureSettings: Record<string, { enabled: boolean; usageLimit: number | null; usagePeriod: UsagePeriod }>
): Promise<{ success: boolean; error?: string }> {
  // 1. Local Cache Update
  const cached = getCachedTierFeatures();
  cached[tierId] = {
    ...(cached[tierId] || {}),
    ...featureSettings,
  };
  setCachedTierFeatures(cached);

  const client = getSupabaseClient();
  if (!client) return { success: true };

  try {
    // Lookup feature ids
    const { data: featuresData } = await client.from('features').select('id, feature_key');
    const featMap: Record<string, string> = {};
    if (featuresData) {
      for (const f of featuresData) {
        featMap[f.feature_key] = f.id;
      }
    }

    const upsertRows = [];
    for (const [featKey, setting] of Object.entries(featureSettings)) {
      const featId = featMap[featKey] || `feat_${featKey}`;
      upsertRows.push({
        id: `tf_${tierId}_${featKey}`,
        tier_id: tierId,
        feature_id: featId,
        enabled: setting.enabled,
        usage_limit: setting.usageLimit,
        usage_period: setting.usagePeriod,
        updated_at: new Date().toISOString(),
      });
    }

    if (upsertRows.length > 0) {
      const { error } = await client.from('tier_features').upsert(upsertRows, { onConflict: 'tier_id, feature_id' });
      if (error) console.warn('saveTierFeaturesToSupabase error:', error.message);
    }

    return { success: true };
  } catch (err: any) {
    return { success: true, error: err?.message };
  }
}

/**
 * 등급 복제 (기존 등급의 기능 권한 및 사용량 설정을 그대로 복사하여 새 등급 생성)
 */
export async function cloneMembershipTierInSupabase(
  sourceTierId: string,
  newTierId: string,
  newTierName: string,
  newDescription?: string
): Promise<{ success: boolean; data?: MembershipTier; error?: string }> {
  const tiers = getCachedTiers();
  const sourceTier = tiers.find((t) => t.id === sourceTierId);
  if (!sourceTier) {
    return { success: false, error: '복제할 원본 등급을 찾을 수 없습니다.' };
  }

  const newTier: MembershipTier = {
    id: newTierId.trim().toLowerCase(),
    name: newTierName.trim(),
    description: newDescription || `${sourceTier.name} 복제 등급`,
    isActive: true,
    sortOrder: tiers.length + 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // 1. Save Tier
  await saveMembershipTierToSupabase(newTier);

  // 2. Clone Tier Features
  const tierFeatures = getCachedTierFeatures();
  const sourceFeatures = tierFeatures[sourceTierId] || DEFAULT_TIER_FEATURES[sourceTierId] || {};
  await saveTierFeaturesToSupabase(newTier.id, sourceFeatures);

  return { success: true, data: newTier };
}

/**
 * 사용자별 등급 목록 조회
 */
export async function fetchAllUserMembershipsFromSupabase(): Promise<UserMembership[]> {
  const client = getSupabaseClient();
  if (!client) {
    const cachedMap = getCachedUserMemberships();
    return Object.values(cachedMap);
  }

  try {
    const { data, error } = await client
      .from('user_memberships')
      .select('*, membership_tiers(*)');

    if (error || !data) {
      const cachedMap = getCachedUserMemberships();
      return Object.values(cachedMap);
    }

    const mapped: UserMembership[] = data.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      userEmail: row.user_email,
      userName: row.user_name,
      tierId: row.tier_id,
      status: row.status as any,
      startedAt: row.started_at,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      tier: row.membership_tiers ? {
        id: row.membership_tiers.id,
        name: row.membership_tiers.name,
        description: row.membership_tiers.description,
        isActive: row.membership_tiers.is_active,
        sortOrder: row.membership_tiers.sort_order,
      } : undefined,
    }));

    const map: Record<string, UserMembership> = {};
    mapped.forEach((m) => {
      map[m.userId] = m;
    });
    setCachedUserMemberships(map);
    return mapped;
  } catch (err) {
    console.warn('fetchAllUserMembershipsFromSupabase error:', err);
    return Object.values(getCachedUserMemberships());
  }
}

/**
 * 사용자에게 등급 부여/수정
 */
export async function saveUserMembershipToSupabase(
  membership: { userId: string; userEmail?: string; userName?: string; tierId: string; status?: string; expiresAt?: string | null }
): Promise<{ success: boolean; error?: string }> {
  const normalizedUser = membership.userId.trim().toLowerCase();
  const payload: UserMembership = {
    id: `um_${normalizedUser}`,
    userId: normalizedUser,
    userEmail: membership.userEmail,
    userName: membership.userName,
    tierId: membership.tierId,
    status: (membership.status as any) || 'active',
    startedAt: new Date().toISOString(),
    expiresAt: membership.expiresAt ?? null,
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  const cached = getCachedUserMemberships();
  cached[normalizedUser] = payload;
  setCachedUserMemberships(cached);

  const client = getSupabaseClient();
  if (!client) return { success: true };

  try {
    const dbPayload = {
      id: payload.id,
      user_id: payload.userId,
      tier_id: payload.tierId,
      status: payload.status,
      started_at: payload.startedAt,
      expires_at: payload.expiresAt,
      updated_at: payload.updatedAt,
      created_at: payload.createdAt,
    };
    const { error } = await client.from('user_memberships').upsert(dbPayload, { onConflict: 'user_id' });
    if (error) {
      console.warn('saveUserMembershipToSupabase DB error:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

/**
 * 기능 사용량 로그 기록 (AI API 성공 후 호출)
 */
export async function logFeatureUsageInSupabase(
  userId: string,
  featureKey: string,
  metadata: Record<string, any> = {}
): Promise<{ success: boolean }> {
  const normalizedUser = userId.trim().toLowerCase();
  const usedAt = new Date().toISOString();
  
  // Local cache add
  addCachedUsageLog(normalizedUser, featureKey, usedAt);

  const client = getSupabaseClient();
  if (!client) return { success: true };

  try {
    const payload = {
      id: `ul_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      user_id: normalizedUser,
      feature_key: featureKey,
      used_at: usedAt,
      metadata,
    };
    await client.from('usage_logs').insert(payload);
    return { success: true };
  } catch (err) {
    console.warn('logFeatureUsageInSupabase error:', err);
    return { success: true };
  }
}

/**
 * 기본 등급 및 기능 DB 시딩
 */
async function seedDefaultMembershipsToSupabase(): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;

  try {
    // 1. Tiers
    const tierRows = DEFAULT_MEMBERSHIP_TIERS.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      is_active: t.isActive,
      sort_order: t.sortOrder,
      created_at: t.createdAt,
      updated_at: t.updatedAt,
    }));
    await client.from('membership_tiers').upsert(tierRows, { onConflict: 'id' });

    // 2. Features
    const featRows = DEFAULT_FEATURES.map((f) => ({
      id: f.id,
      feature_key: f.featureKey,
      name: f.name,
      description: f.description,
      category: f.category,
      is_active: f.isActive,
      sort_order: f.sortOrder,
      created_at: f.createdAt,
      updated_at: f.updatedAt,
    }));
    await client.from('features').upsert(featRows, { onConflict: 'feature_key' });

    // 3. Tier Features
    const tfRows: any[] = [];
    for (const [tierId, map] of Object.entries(DEFAULT_TIER_FEATURES)) {
      for (const [featKey, setting] of Object.entries(map)) {
        tfRows.push({
          id: `tf_${tierId}_${featKey}`,
          tier_id: tierId,
          feature_id: `feat_${featKey}`,
          enabled: setting.enabled,
          usage_limit: setting.usageLimit,
          usage_period: setting.usagePeriod,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    }
    await client.from('tier_features').upsert(tfRows, { onConflict: 'tier_id, feature_id' });
  } catch (err) {
    console.warn('seedDefaultMembershipsToSupabase warning:', err);
  }
}

// ----------------------------------------------------
// Membership & Tier Usage Helper Functions
// ----------------------------------------------------

export async function fetchMembershipTiers(): Promise<MembershipTier[]> {
  const client = getSupabaseClient();
  if (!client) return DEFAULT_MEMBERSHIP_TIERS;
  try {
    const { data, error } = await client.from('membership_tiers').select('*').order('sort_order', { ascending: true });
    if (error || !data || data.length === 0) return DEFAULT_MEMBERSHIP_TIERS;
    return data.map((d: any) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      isActive: d.is_active,
      sortOrder: d.sort_order,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    }));
  } catch (err) {
    console.warn('fetchMembershipTiers error:', err);
    return DEFAULT_MEMBERSHIP_TIERS;
  }
}

export async function fetchFeatures(): Promise<FeatureItem[]> {
  const client = getSupabaseClient();
  if (!client) return DEFAULT_FEATURES;
  try {
    const { data, error } = await client.from('features').select('*').order('sort_order', { ascending: true });
    if (error || !data || data.length === 0) return DEFAULT_FEATURES;
    return data.map((d: any) => ({
      id: d.id,
      featureKey: d.feature_key,
      name: d.name,
      description: d.description,
      category: d.category,
      isActive: d.is_active,
      sortOrder: d.sort_order,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    }));
  } catch (err) {
    console.warn('fetchFeatures error:', err);
    return DEFAULT_FEATURES;
  }
}

export async function fetchTierFeatures(): Promise<TierFeature[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  try {
    const { data, error } = await client.from('tier_features').select('*');
    if (error || !data) return [];
    return data.map((d: any) => ({
      id: d.id,
      tierId: d.tier_id,
      featureId: d.feature_id,
      enabled: d.enabled,
      usageLimit: d.usage_limit,
      usagePeriod: d.usage_period,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    }));
  } catch (err) {
    console.warn('fetchTierFeatures error:', err);
    return [];
  }
}

export async function upsertMembershipTier(tier: MembershipTier): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  try {
    await client.from('membership_tiers').upsert({
      id: tier.id,
      name: tier.name,
      description: tier.description,
      is_active: tier.isActive,
      sort_order: tier.sortOrder,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('upsertMembershipTier error:', err);
  }
}

export async function deleteMembershipTier(id: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  try {
    await client.from('tier_features').delete().eq('tier_id', id);
    await client.from('membership_tiers').delete().eq('id', id);
  } catch (err) {
    console.warn('deleteMembershipTier error:', err);
  }
}

export async function upsertTierFeatures(items: TierFeature[]): Promise<void> {
  const client = getSupabaseClient();
  if (!client || items.length === 0) return;
  try {
    const rows = items.map((it) => ({
      id: it.id,
      tier_id: it.tierId,
      feature_id: it.featureId,
      enabled: it.enabled,
      usage_limit: it.usageLimit,
      usage_period: it.usagePeriod,
      updated_at: new Date().toISOString(),
    }));
    await client.from('tier_features').upsert(rows);
  } catch (err) {
    console.warn('upsertTierFeatures error:', err);
  }
}

export async function upsertUserMembership(um: UserMembership): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: true };
  try {
    const payload: any = {
      id: um.id || `um_${String(um.userId).toLowerCase().trim()}`,
      user_id: String(um.userId).toLowerCase().trim(),
      tier_id: um.tierId,
      status: um.status || 'active',
      started_at: um.startsAt || new Date().toISOString(),
      expires_at: um.expiresAt || null,
      source_type: um.sourceType || 'admin',
      source_id: um.sourceId || null,
      notes: um.notes || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await client.from('user_memberships').upsert(payload, { onConflict: 'user_id' });
    if (error) {
      console.warn('upsertUserMembership error:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.warn('upsertUserMembership error:', err);
    return { success: false, error: err?.message || 'DB error' };
  }
}

export async function fetchUserMemberships(userId?: string): Promise<UserMembership[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  try {
    let query = client.from('user_memberships').select('*').order('created_at', { ascending: false });
    if (userId) {
      query = query.eq('user_id', userId.toLowerCase().trim());
    }
    const { data, error } = await query;
    if (error || !data) return [];
    return data.map((d: any) => ({
      id: d.id,
      userId: d.user_id,
      tierId: d.tier_id,
      status: d.status,
      startsAt: d.started_at || d.starts_at || d.created_at,
      expiresAt: d.expires_at,
      sourceType: d.source_type,
      sourceId: d.source_id,
      notes: d.notes,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    }));
  } catch (err) {
    console.warn('fetchUserMemberships error:', err);
    return [];
  }
}

export async function fetchUsageLogs(userId?: string, limit = 100): Promise<UsageLog[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  try {
    let query = client.from('usage_logs').select('*').order('used_at', { ascending: false }).limit(limit);
    if (userId) {
      query = query.eq('user_id', userId.toLowerCase().trim());
    }
    const { data, error } = await query;
    if (error || !data) return [];
    return data.map((d: any) => ({
      id: d.id,
      userId: d.user_id,
      featureKey: d.feature_key,
      usedAt: d.used_at,
      metadata: d.metadata,
    }));
  } catch (err) {
    console.warn('fetchUsageLogs error:', err);
    return [];
  }
}

export async function resetUsageLogs(userId?: string, featureKey?: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  try {
    let query = client.from('usage_logs').delete();
    if (userId) query = query.eq('user_id', userId.toLowerCase().trim());
    if (featureKey) query = query.eq('feature_key', featureKey);
    await query;
  } catch (err) {
    console.warn('resetUsageLogs error:', err);
  }
}

// ----------------------------------------------------
// 상품 (Products) 관리 함수들
// ----------------------------------------------------

export async function fetchProductsFromSupabase(): Promise<Product[]> {
  const client = getSupabaseClient();
  if (!client) return getCachedProducts();

  try {
    const { data, error } = await client
      .from('products')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      console.warn('fetchProductsFromSupabase error:', error.message);
      return getCachedProducts();
    }

    if (!data) return [];

    // Only seed once if table is brand new and has never been seeded before
    if (data.length === 0) {
      const isAlreadyInitialized = typeof localStorage !== 'undefined' && localStorage.getItem('products_initialized_flag') === 'true';
      if (!isAlreadyInitialized) {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('products_initialized_flag', 'true');
        }
        await seedDefaultProductsToSupabase();
        return getCachedProducts();
      } else {
        setCachedProducts([]);
        return [];
      }
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('products_initialized_flag', 'true');
    }

    const mapped: Product[] = data.map((d: any) => ({
      id: d.id,
      name: d.name,
      description: d.description || '',
      productType: d.product_type || 'membership',
      price: Number(d.price) || 0,
      originalPrice: d.original_price ? Number(d.original_price) : undefined,
      membershipTier: d.membership_tier || null,
      durationDays: d.duration_days !== null && d.duration_days !== undefined ? Number(d.duration_days) : null,
      aiUsageAddCount: d.ai_usage_add_count !== null && d.ai_usage_add_count !== undefined ? Number(d.ai_usage_add_count) : null,
      isActive: d.is_active ?? true,
      sortOrder: Number(d.sort_order) || 0,
      features: Array.isArray(d.features) ? d.features : typeof d.features === 'string' ? JSON.parse(d.features) : [],
      badge: d.badge || undefined,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    }));

    setCachedProducts(mapped);
    return mapped;
  } catch (err) {
    console.warn('fetchProductsFromSupabase error:', err);
    return getCachedProducts();
  }
}

export async function saveProductToSupabase(
  prod: Partial<Product> & { id: string; name: string; price: number; productType: any }
): Promise<{ success: boolean; data?: Product; error?: string }> {
  const products = getCachedProducts();
  const existingIdx = products.findIndex((p) => p.id === prod.id);
  const updatedProd: Product = {
    id: prod.id,
    name: prod.name,
    description: prod.description || '',
    productType: prod.productType || 'membership',
    price: Math.max(0, Math.round(Number(prod.price) || 0)),
    originalPrice: prod.originalPrice !== undefined && prod.originalPrice !== null ? Math.round(Number(prod.originalPrice)) : undefined,
    membershipTier: prod.membershipTier || null,
    durationDays: prod.durationDays !== undefined ? prod.durationDays : null,
    aiUsageAddCount: prod.aiUsageAddCount !== undefined ? prod.aiUsageAddCount : null,
    isActive: prod.isActive ?? true,
    sortOrder: prod.sortOrder ?? (existingIdx >= 0 ? products[existingIdx].sortOrder : products.length + 1),
    features: prod.features || [],
    badge: prod.badge || undefined,
    updatedAt: new Date().toISOString(),
    createdAt: prod.createdAt || (existingIdx >= 0 ? products[existingIdx].createdAt : new Date().toISOString()),
  };

  const newProds = existingIdx >= 0
    ? products.map((p) => (p.id === prod.id ? updatedProd : p))
    : [...products, updatedProd];
  setCachedProducts(newProds);

  const client = getSupabaseClient();
  if (!client) return { success: true, data: updatedProd };

  try {
    const payload = {
      id: updatedProd.id,
      name: updatedProd.name,
      description: updatedProd.description,
      product_type: updatedProd.productType,
      price: updatedProd.price,
      original_price: updatedProd.originalPrice,
      membership_tier: updatedProd.membershipTier,
      duration_days: updatedProd.durationDays,
      ai_usage_add_count: updatedProd.aiUsageAddCount,
      is_active: updatedProd.isActive,
      sort_order: updatedProd.sortOrder,
      features: updatedProd.features,
      badge: updatedProd.badge,
      updated_at: updatedProd.updatedAt,
      created_at: updatedProd.createdAt,
    };

    const { error } = await client.from('products').upsert(payload, { onConflict: 'id' });
    if (error) console.warn('saveProductToSupabase error:', error.message);
    return { success: true, data: updatedProd };
  } catch (err: any) {
    return { success: true, data: updatedProd, error: err?.message };
  }
}

export async function deleteProductFromSupabase(
  productId: string,
  force = false
): Promise<{ success: boolean; softDeleted?: boolean; forceDeleted?: boolean; purchaseCount?: number; message?: string; error?: string }> {
  const adminToken = getAdminAuthToken();

  // Try Server Admin API endpoint first (with service role & safe foreign key unlinking)
  try {
    const res = await fetch(`/api/admin/products/${encodeURIComponent(productId)}${force ? '?force=true' : ''}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
        'x-admin-token': adminToken,
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        if (data.softDeleted) {
          const prods = getCachedProducts().map((p) => (p.id === productId ? { ...p, isActive: false } : p));
          setCachedProducts(prods);
        } else {
          const prods = getCachedProducts().filter((p) => p.id !== productId);
          setCachedProducts(prods);
        }
        return data;
      }
    }
  } catch (apiErr) {
    console.warn('API product delete fallback:', apiErr);
  }

  // Direct Supabase Client Fallback
  const client = getSupabaseClient();
  if (!client) {
    const prods = getCachedProducts().filter((p) => p.id !== productId);
    setCachedProducts(prods);
    return { success: true, message: '로컬 캐시에서 상품이 삭제되었습니다.' };
  }

  try {
    // 1. Check if purchase history exists for this product
    const { count: purchaseCount } = await client
      .from('purchases')
      .select('*', { count: 'exact', head: true })
      .eq('product_id', productId);

    if (purchaseCount && purchaseCount > 0) {
      if (force) {
        // Unlink foreign keys
        await client.from('purchases').update({ product_id: null }).eq('product_id', productId);
        const { error: delErr } = await client.from('products').delete().eq('id', productId);
        if (delErr) return { success: false, error: delErr.message };

        const prods = getCachedProducts().filter((p) => p.id !== productId);
        setCachedProducts(prods);
        return {
          success: true,
          forceDeleted: true,
          purchaseCount,
          message: `과거 구매 내역(${purchaseCount}건) 연결 해제 후 상품이 영구 삭제되었습니다.`,
        };
      }

      // Soft delete: keep historical records, mark as inactive
      const { error: updateErr } = await client
        .from('products')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', productId);

      if (updateErr) {
        return { success: false, error: updateErr.message };
      }

      // Update local cache
      const prods = getCachedProducts().map((p) => (p.id === productId ? { ...p, isActive: false } : p));
      setCachedProducts(prods);

      return {
        success: true,
        softDeleted: true,
        purchaseCount,
        message: `구매 내역(${purchaseCount}건)이 존재하는 상품이므로 [판매 중지(비활성화)] 처리되었습니다.`,
      };
    }

    // 2. Physical delete if no purchase history
    const { error: delErr } = await client.from('products').delete().eq('id', productId);
    if (delErr) {
      return { success: false, error: delErr.message };
    }

    const prods = getCachedProducts().filter((p) => p.id !== productId);
    setCachedProducts(prods);
    return { success: true, softDeleted: false, message: '상품이 성공적으로 삭제되었습니다.' };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

function getAdminAuthToken(): string {
  if (typeof sessionStorage !== 'undefined') {
    const sTok = sessionStorage.getItem('admin_token') || sessionStorage.getItem('admin_auth_token');
    if (sTok) return sTok;
  }
  if (typeof localStorage !== 'undefined') {
    const lTok = localStorage.getItem('admin_token') || localStorage.getItem('admin_auth_token');
    if (lTok) return lTok;
  }
  return 'CHAMSAE1_blog';
}

export async function deleteUserSafelyFromSupabase(userId: string, force = false): Promise<{
  success: boolean;
  blocked?: boolean;
  message?: string;
  totalLinked?: number;
  error?: string;
}> {
  const client = getSupabaseClient();
  const cleanId = String(userId).trim().toLowerCase();
  const adminToken = getAdminAuthToken();

  try {
    const res = await fetch(`/api/admin/users/${encodeURIComponent(cleanId)}${force ? '?force=true' : ''}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
        'x-admin-token': adminToken,
      },
    });

    const data = await res.json();
    if (!res.ok) {
      return {
        success: false,
        blocked: Boolean(data.blocked),
        totalLinked: data.totalLinked,
        message: data.message || '회원 삭제에 실패했습니다.',
        error: data.message,
      };
    }
    return { success: true, message: data.message };
  } catch (apiErr) {
    // Client-side fallback if server api isn't used
    if (!client) return { success: true, message: '로컬에서 삭제되었습니다.' };

    try {
      const [{ count: partCount }, { count: purCount }] = await Promise.all([
        client.from('participants').select('*', { count: 'exact', head: true }).or(`user_id.eq.${cleanId},email.ilike.${cleanId}`),
        client.from('purchases').select('*', { count: 'exact', head: true }).or(`user_id.eq.${cleanId},user_email.ilike.${cleanId}`),
      ]);

      const totalLinked = (partCount || 0) + (purCount || 0);
      if (totalLinked > 0 && !force) {
        return {
          success: false,
          blocked: true,
          totalLinked,
          message: `해당 회원은 연결된 데이터(참가 ${partCount || 0}건, 구매 ${purCount || 0}건)가 존재하여 데이터 무결성 보호를 위해 삭제가 차단되었습니다.`,
        };
      }

      await Promise.all([
        client.from('user_memberships').delete().or(`user_id.eq.${cleanId},user_id.ilike.${cleanId}`),
        client.from('profiles').delete().or(`id.eq.${cleanId},email.ilike.${cleanId}`),
      ]);
      return { success: true, message: '회원 데이터가 삭제되었습니다.' };
    } catch (err: any) {
      return { success: false, error: err?.message };
    }
  }
}

export async function seedDefaultProductsToSupabase(): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  try {
    const rows = DEFAULT_PRODUCTS.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      product_type: p.productType,
      price: p.price,
      original_price: p.originalPrice,
      membership_tier: p.membershipTier,
      duration_days: p.durationDays,
      ai_usage_add_count: p.aiUsageAddCount,
      is_active: p.isActive,
      sort_order: p.sortOrder,
      features: p.features,
      badge: p.badge,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    await client.from('products').upsert(rows, { onConflict: 'id' });
  } catch (err) {
    console.warn('seedDefaultProductsToSupabase error:', err);
  }
}

// ----------------------------------------------------
// 구매 (Purchases) 관리 및 등급 자동 연동 함수들
// ----------------------------------------------------

export async function fetchPurchasesFromSupabase(userId?: string): Promise<Purchase[]> {
  const client = getSupabaseClient();
  if (!client) return getCachedPurchases();

  try {
    let query = client.from('purchases').select('*').order('purchased_at', { ascending: false });
    if (userId) {
      query = query.eq('user_id', userId.toLowerCase().trim());
    }
    const { data, error } = await query;
    if (error || !data) return getCachedPurchases();

    const mapped: Purchase[] = data.map((d: any) => ({
      id: d.id,
      userId: d.user_id,
      userName: d.user_name || undefined,
      userEmail: d.user_email || undefined,
      productId: d.product_id || '',
      productName: d.product_name,
      productType: d.product_type || 'membership',
      amount: Number(d.amount) || 0,
      paymentMethod: d.payment_method || 'bank_transfer',
      status: d.status || 'completed',
      sourceType: d.source_type || 'product_purchase',
      sourceId: d.source_id || undefined,
      notes: d.notes || undefined,
      purchasedAt: d.purchased_at || d.created_at,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    }));

    if (!userId) {
      setCachedPurchases(mapped);
    }
    return mapped;
  } catch (err) {
    console.warn('fetchPurchasesFromSupabase error:', err);
    return getCachedPurchases();
  }
}

/**
 * 결제/구매 완료 처리 및 이에 따른 등급 자동 연장/부여
 */
export async function createPurchaseAndGrantTierInSupabase(
  purchaseData: {
    userId: string;
    userName?: string;
    userEmail?: string;
    productId: string;
    productName: string;
    productType: 'membership' | 'ai_usage' | 'challenge' | 'general';
    amount: number;
    paymentMethod?: string;
    sourceType?: MembershipSourceType;
    sourceId?: string;
    targetTierId?: string;
    durationDays?: number | null;
    notes?: string;
  }
): Promise<{ success: boolean; purchase?: Purchase; error?: string }> {
  const cleanUserId = purchaseData.userId.trim().toLowerCase();
  const cleanEmail = purchaseData.userEmail ? purchaseData.userEmail.trim().toLowerCase() : undefined;
  const now = new Date();

  // 1. Calculate Expiry
  let expiresAt: string | null = null;
  if (purchaseData.durationDays && purchaseData.durationDays > 0) {
    const exp = new Date(now);
    exp.setDate(exp.getDate() + purchaseData.durationDays);
    expiresAt = exp.toISOString();
  }

  const purchase: Purchase = {
    id: `pur_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    userId: cleanUserId,
    userName: purchaseData.userName,
    userEmail: cleanEmail,
    productId: purchaseData.productId,
    productName: purchaseData.productName,
    productType: purchaseData.productType,
    amount: Math.max(0, Math.round(purchaseData.amount)),
    paymentMethod: purchaseData.paymentMethod || 'bank_transfer',
    status: 'completed',
    sourceType: purchaseData.sourceType || 'product_purchase',
    sourceId: purchaseData.sourceId,
    notes: purchaseData.notes,
    purchasedAt: now.toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  // Local Cache Purchase
  const purchases = getCachedPurchases();
  setCachedPurchases([purchase, ...purchases]);

  // 2. Grant Tier if product is membership
  const targetTier = purchaseData.targetTierId || 'pro';
  if (purchaseData.productType === 'membership' || targetTier) {
    const userMembership: UserMembership = {
      id: `um_${cleanUserId}`,
      userId: cleanUserId,
      userEmail: cleanEmail,
      userName: purchaseData.userName,
      tierId: targetTier,
      status: 'active',
      startedAt: now.toISOString(),
      startsAt: now.toISOString(),
      expiresAt: expiresAt,
      sourceType: purchaseData.sourceType || 'product_purchase',
      sourceId: purchase.id,
      notes: purchaseData.notes || `[구매 지급] ${purchaseData.productName}`,
      updatedAt: now.toISOString(),
      createdAt: now.toISOString(),
    };
    const memberships = getCachedUserMemberships();
    memberships[cleanUserId] = userMembership;
    setCachedUserMemberships(memberships);
  }

  const client = getSupabaseClient();
  if (!client) return { success: true, purchase };

  try {
    // 1. Insert Purchase
    const purchasePayload = {
      id: purchase.id,
      user_id: purchase.userId,
      user_name: purchase.userName,
      user_email: purchase.userEmail,
      product_id: purchase.productId,
      product_name: purchase.productName,
      product_type: purchase.productType,
      amount: purchase.amount,
      payment_method: purchase.paymentMethod,
      status: purchase.status,
      source_type: purchase.sourceType,
      source_id: purchase.sourceId,
      notes: purchase.notes,
      purchased_at: purchase.purchasedAt,
      created_at: purchase.createdAt,
      updated_at: purchase.updatedAt,
    };
    const { error: pErr } = await client.from('purchases').insert(purchasePayload);
    if (pErr) {
      console.warn('createPurchaseAndGrantTierInSupabase purchase insert error:', pErr.message);
      return { success: false, error: pErr.message };
    }

    // 2. Upsert User Membership
    if (purchaseData.productType === 'membership' || targetTier) {
      const membershipPayload = {
        id: `um_${cleanUserId}`,
        user_id: cleanUserId,
        tier_id: targetTier,
        status: 'active',
        started_at: now.toISOString(),
        expires_at: expiresAt,
        source_type: purchaseData.sourceType || 'product_purchase',
        source_id: purchase.id,
        notes: purchaseData.notes || `[구매 지급] ${purchaseData.productName}`,
        updated_at: now.toISOString(),
      };
      const { error: umErr } = await client.from('user_memberships').upsert(membershipPayload, { onConflict: 'user_id' });
      if (umErr) {
        console.warn('createPurchaseAndGrantTierInSupabase user_memberships upsert error:', umErr.message);
        return { success: false, error: umErr.message };
      }
    }

    return { success: true, purchase };
  } catch (err: any) {
    console.warn('createPurchaseAndGrantTierInSupabase error:', err);
    return { success: false, error: err?.message || 'Database error' };
  }
}

/**
 * 챌린지 참가비 입금 승인 시 챌린지 설정에 따른 멤버십 등급 자동 부여
 */
export async function autoGrantTierFromChallengeApprovalInSupabase(
  challenge: ChallengeGroup,
  user: { id?: string; email?: string; name?: string; naverId?: string }
): Promise<{ success: boolean; tierId?: string; expiresAt?: string | null }> {
  if (challenge.autoTierEnabled === false) {
    return { success: false };
  }

  const targetTierId = challenge.grantMembershipTier || 'pro';
  const cleanUserId = (user.id || user.email || user.naverId || user.name || '').trim().toLowerCase();
  if (!cleanUserId) return { success: false };

  const now = new Date();
  let expiresAt: string | null = null;

  if (challenge.membershipDurationDays && challenge.membershipDurationDays > 0) {
    const exp = new Date(now);
    exp.setDate(exp.getDate() + challenge.membershipDurationDays);
    expiresAt = exp.toISOString();
  } else if (challenge.endDate) {
    // Default: expires 7 days after challenge end date
    const chalEnd = new Date(challenge.endDate);
    if (!isNaN(chalEnd.getTime())) {
      chalEnd.setDate(chalEnd.getDate() + 7);
      expiresAt = chalEnd.toISOString();
    }
  }

  const payload: UserMembership = {
    id: `um_${cleanUserId}`,
    userId: cleanUserId,
    userEmail: user.email,
    userName: user.name,
    tierId: targetTierId,
    status: 'active',
    startedAt: now.toISOString(),
    startsAt: now.toISOString(),
    expiresAt,
    sourceType: 'challenge',
    sourceId: challenge.id,
    notes: `[챌린지 자동 등급] ${challenge.name}`,
    updatedAt: now.toISOString(),
    createdAt: now.toISOString(),
  };

  const cached = getCachedUserMemberships();
  cached[cleanUserId] = payload;
  setCachedUserMemberships(cached);

  const client = getSupabaseClient();
  if (!client) return { success: true, tierId: targetTierId, expiresAt };

  try {
    const dbPayload = {
      id: payload.id,
      user_id: payload.userId,
      tier_id: payload.tierId,
      status: payload.status,
      started_at: payload.startedAt,
      expires_at: payload.expiresAt,
      source_type: payload.sourceType,
      source_id: payload.sourceId,
      notes: payload.notes,
      updated_at: payload.updatedAt,
      created_at: payload.createdAt,
    };
    const { error: upsertErr } = await client.from('user_memberships').upsert(dbPayload, { onConflict: 'user_id' });
    if (upsertErr) {
      console.warn('autoGrantTierFromChallengeApprovalInSupabase error:', upsertErr.message);
      return { success: false };
    }
    return { success: true, tierId: targetTierId, expiresAt };
  } catch (err) {
    console.warn('autoGrantTierFromChallengeApprovalInSupabase error:', err);
    return { success: false };
  }
}

/**
 * 관리자용: 전체 등록 회원 목록 및 현재 등급/사용량 요약 일괄 조회
 */
export async function fetchAllProfilesAndMembershipsFromSupabase(): Promise<Array<{
  userId: string;
  name: string;
  email: string;
  naverId?: string;
  tierId: string;
  tierName: string;
  membershipStatus: string;
  expiresAt: string | null;
  sourceType?: string;
  sourceId?: string;
  notes?: string;
  recentUsageCount: number;
  createdAt: string;
  hasChallengeParticipation?: boolean;
  hasPurchaseHistory?: boolean;
  challengeCount?: number;
  purchaseCount?: number;
}>> {
  const client = getSupabaseClient();
  const tiers = await fetchMembershipTiersFromSupabase();
  const tierMap: Record<string, string> = {};
  tiers.forEach((t) => {
    tierMap[t.id] = t.name;
  });

  if (!client) {
    const cachedMemberships = getCachedUserMemberships();
    return Object.values(cachedMemberships).map((m) => ({
      userId: m.userId,
      name: m.userName || m.userId,
      email: m.userEmail || m.userId,
      tierId: m.tierId,
      tierName: tierMap[m.tierId] || m.tierId,
      membershipStatus: m.status,
      expiresAt: m.expiresAt || null,
      sourceType: m.sourceType || 'manual',
      sourceId: m.sourceId || undefined,
      notes: m.notes || undefined,
      recentUsageCount: 0,
      createdAt: m.createdAt || new Date().toISOString(),
      hasChallengeParticipation: false,
      hasPurchaseHistory: false,
      challengeCount: 0,
      purchaseCount: 0,
    }));
  }

  try {
    // 1. Fetch Profiles, Memberships, Participants, and Purchases in parallel
    const [
      { data: profiles },
      { data: memberships },
      { data: participants },
      { data: purchases },
    ] = await Promise.all([
      client.from('profiles').select('*').order('created_at', { ascending: false }),
      client.from('user_memberships').select('*'),
      client.from('participants').select('*'),
      client.from('purchases').select('*'),
    ]);

    // Index purchases and participants by userId/email/name
    const purchaseCountMap = new Map<string, number>();
    (purchases || []).forEach((pur: any) => {
      const uId = pur.user_id ? String(pur.user_id).toLowerCase().trim() : '';
      const email = pur.user_email ? String(pur.user_email).toLowerCase().trim() : '';
      if (uId) purchaseCountMap.set(uId, (purchaseCountMap.get(uId) || 0) + 1);
      if (email && email !== uId) purchaseCountMap.set(email, (purchaseCountMap.get(email) || 0) + 1);
    });

    const participantCountMap = new Map<string, number>();
    (participants || []).forEach((part: any) => {
      const uId = part.user_id ? String(part.user_id).toLowerCase().trim() : '';
      const email = part.email ? String(part.email).toLowerCase().trim() : '';
      const blog = part.blog_id ? String(part.blog_id).toLowerCase().trim() : '';
      if (uId) participantCountMap.set(uId, (participantCountMap.get(uId) || 0) + 1);
      if (email && email !== uId) participantCountMap.set(email, (participantCountMap.get(email) || 0) + 1);
      if (blog && blog !== uId) participantCountMap.set(blog, (participantCountMap.get(blog) || 0) + 1);
    });

    const memberMap = new Map<string, any>();
    (memberships || []).forEach((m: any) => {
      if (m.user_id) memberMap.set(String(m.user_id).toLowerCase().trim(), m);
      if (m.user_email) memberMap.set(String(m.user_email).toLowerCase().trim(), m);
    });

    const userMap = new Map<string, any>();

    // 1. Put profiles
    (profiles || []).forEach((p: any) => {
      const idKey = p.id ? String(p.id).toLowerCase().trim() : '';
      const emailKey = p.email ? String(p.email).toLowerCase().trim() : '';
      const naverKey = p.naver_id ? String(p.naver_id).toLowerCase().trim() : '';
      const nameKey = p.name ? String(p.name).toLowerCase().trim() : '';

      const m =
        (idKey ? memberMap.get(idKey) : undefined) ||
        (emailKey ? memberMap.get(emailKey) : undefined) ||
        (naverKey ? memberMap.get(naverKey) : undefined) ||
        (nameKey ? memberMap.get(nameKey) : undefined);

      const pCount = (idKey ? purchaseCountMap.get(idKey) : 0) || (emailKey ? purchaseCountMap.get(emailKey) : 0) || 0;
      const cCount = (idKey ? participantCountMap.get(idKey) : 0) || (emailKey ? participantCountMap.get(emailKey) : 0) || (naverKey ? participantCountMap.get(naverKey) : 0) || 0;

      const canonicalUserId = idKey || emailKey || naverKey || nameKey;
      const record = {
        userId: p.id || canonicalUserId,
        name: p.name || '회원',
        email: p.email || '',
        naverId: p.naver_id || '',
        tierId: m?.tier_id || (p.role === 'admin' ? 'admin' : 'free'),
        tierName: tierMap[m?.tier_id || (p.role === 'admin' ? 'admin' : 'free')] || (p.role === 'admin' ? '관리자' : '무료 회원'),
        membershipStatus: m?.status || 'active',
        expiresAt: m?.expires_at || null,
        sourceType: m?.source_type || 'manual',
        sourceId: m?.source_id || null,
        notes: m?.notes || null,
        recentUsageCount: 0,
        createdAt: p.created_at || new Date().toISOString(),
        hasChallengeParticipation: cCount > 0,
        hasPurchaseHistory: pCount > 0,
        challengeCount: cCount,
        purchaseCount: pCount,
      };

      if (idKey) userMap.set(idKey, record);
      if (emailKey && !userMap.has(emailKey)) userMap.set(emailKey, record);
      if (naverKey && !userMap.has(naverKey)) userMap.set(naverKey, record);
    });

    // 2. Merge participants if not present
    (participants || []).forEach((part: any) => {
      const idKey = part.user_id ? String(part.user_id).toLowerCase().trim() : (part.id ? String(part.id).toLowerCase().trim() : '');
      const emailKey = part.email ? String(part.email).toLowerCase().trim() : '';
      const blogKey = part.blog_id ? String(part.blog_id).toLowerCase().trim() : '';
      const nameKey = part.participant_name ? String(part.participant_name).toLowerCase().trim() : '';

      const alreadyExists = (idKey && userMap.has(idKey)) || (emailKey && userMap.has(emailKey)) || (blogKey && userMap.has(blogKey));
      if (!alreadyExists) {
        const m =
          (idKey ? memberMap.get(idKey) : undefined) ||
          (emailKey ? memberMap.get(emailKey) : undefined) ||
          (blogKey ? memberMap.get(blogKey) : undefined) ||
          (nameKey ? memberMap.get(nameKey) : undefined);

        const pCount = (idKey ? purchaseCountMap.get(idKey) : 0) || (emailKey ? purchaseCountMap.get(emailKey) : 0) || 0;
        const cCount = (idKey ? participantCountMap.get(idKey) : 0) || (emailKey ? participantCountMap.get(emailKey) : 0) || (blogKey ? participantCountMap.get(blogKey) : 0) || 1;

        const canonicalUserId = part.user_id || part.id || emailKey || blogKey || idKey;
        const record = {
          userId: canonicalUserId,
          name: part.participant_name || '참가자',
          email: part.email || '',
          naverId: part.blog_id || '',
          tierId: m?.tier_id || 'pro',
          tierName: tierMap[m?.tier_id || 'pro'] || 'PRO',
          membershipStatus: m?.status || 'active',
          expiresAt: m?.expires_at || null,
          sourceType: m?.source_type || 'challenge',
          sourceId: m?.source_id || null,
          notes: m?.notes || null,
          recentUsageCount: 0,
          createdAt: part.created_at || new Date().toISOString(),
          hasChallengeParticipation: true,
          hasPurchaseHistory: pCount > 0,
          challengeCount: cCount,
          purchaseCount: pCount,
        };

        if (idKey) userMap.set(idKey, record);
        if (emailKey && !userMap.has(emailKey)) userMap.set(emailKey, record);
        if (blogKey && !userMap.has(blogKey)) userMap.set(blogKey, record);
      }
    });

    // 3. Merge direct memberships if any orphan
    (memberships || []).forEach((m: any) => {
      const uKey = String(m.user_id).toLowerCase().trim();
      const emailKey = m.user_email ? String(m.user_email).toLowerCase().trim() : '';
      if (!userMap.has(uKey) && (!emailKey || !userMap.has(emailKey))) {
        const pCount = purchaseCountMap.get(uKey) || (emailKey ? purchaseCountMap.get(emailKey) : 0) || 0;
        const cCount = participantCountMap.get(uKey) || (emailKey ? participantCountMap.get(emailKey) : 0) || 0;

        const record = {
          userId: m.user_id,
          name: m.user_name || m.user_id,
          email: m.user_email || '',
          naverId: '',
          tierId: m.tier_id,
          tierName: tierMap[m.tier_id] || m.tier_id,
          membershipStatus: m.status,
          expiresAt: m.expires_at || null,
          sourceType: m.source_type || 'manual',
          sourceId: m.source_id || null,
          notes: m.notes || null,
          recentUsageCount: 0,
          createdAt: m.created_at || new Date().toISOString(),
          hasChallengeParticipation: cCount > 0,
          hasPurchaseHistory: pCount > 0,
          challengeCount: cCount,
          purchaseCount: pCount,
        };

        userMap.set(uKey, record);
        if (emailKey && !userMap.has(emailKey)) userMap.set(emailKey, record);
      }
    });

    // Strict deduplication by unique userId
    const uniqueUserIdMap = new Map<string, any>();
    Array.from(userMap.values()).forEach((item: any) => {
      const uid = String(item.userId).toLowerCase().trim();
      if (!uniqueUserIdMap.has(uid)) {
        uniqueUserIdMap.set(uid, item);
      }
    });

    return Array.from(uniqueUserIdMap.values());
  } catch (err) {
    console.warn('fetchAllProfilesAndMembershipsFromSupabase error:', err);
    return [];
  }
}









