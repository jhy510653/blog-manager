import React, { useState, useEffect } from 'react';
import { extractAndParseJson } from '../utils/jsonUtils';
import { SEOPlanSummary } from './seo/SEOPlanSummary';
import { OutlineEditor } from './seo/OutlineEditor';
import {
  cleanAndNormalizeTitle,
  deduplicateTitleCandidates,
  normalizeOutlineSections
} from '../utils/titleUtils';
import {
  Sparkles,
  Search,
  FileText,
  BarChart3,
  Copy,
  Check,
  Zap,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  Award,
  Layers,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  ListOrdered,
  Tag,
  ExternalLink,
  Target,
  Edit3,
  Code2,
  Eye,
  FileCode,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Users,
  MessageSquareText,
  Wrench,
  Image as ImageIcon,
  Plus,
  Trash2,
  Play,
  RotateCcw,
  BookOpen,
  ShoppingBag,
  MapPin,
  MessageSquare,
  Info,
  Download,
  Sliders,
  Camera,
  LayoutGrid,
  CheckSquare,
  FileCheck,
  Calculator,
  Save,
  BookmarkCheck,
  HardDrive,
  Clock,
  History,
  Settings,
  Star,
  Loader2,
  Utensils,
  Coffee,
  Compass,
  Hotel,
  Package,
  Palette,
  ShieldCheck,
} from 'lucide-react';
import {
  NaverUser,
  GoldenKeywordResult,
  DraftType,
  AiBatchItem,
  UserUsageLimits,
  AiDraftSession,
  DraftLastStep,
  DraftSessionStatus,
  AiContentAnalysisResult,
  SeoWritingStyleKey,
  StyleProfile,
  UserBlogStyle,
  DEFAULT_USER_BLOG_STYLE,
  OutlineSection,
  TitleCandidate,
  ExtractedLinkData,
} from '../types';
import { DraftRecoveryBanner } from './seo/DraftRecoveryBanner';
import { DraftHistoryModal } from './seo/DraftHistoryModal';
import { BlogStyleAnalyzer } from './seo/BlogStyleAnalyzer';
import { UserBlogStyleSettingsModal } from './UserBlogStyleSettingsModal';
import { BlogImageAdditionSection } from './visual/BlogImageAdditionSection';
import { loadUserBlogStyle, persistUserBlogStyle, resetUserBlogStyle } from '../services/userBlogStyleService';
import { applyUserBlogStyle, getSubheadingStyleLabel } from '../utils/blogFormatter';
import {
  generateDraftSessionId,
  getCurrentDraftSession,
  saveDraftSession,
  updateDraftSession,
  deleteDraftSession,
  triggerExpiredDraftsCleanup
} from '../services/aiDraftSessionService';
import { calculateAiCost } from '../config/pricing';
import { prepareNaverBlogHtml, preparePlainTextFromHtml } from '../utils/cardNewsImageGenerator';
import { stripInternalImageGuides } from '../utils/imagePipeline';
import {
  classifyKeywordInstant,
  analyzeKeywordWithAi,
  STYLE_KEY_TO_LABEL,
  EXPERIENCE_TYPE_LABELS
} from '../utils/aiContentAnalyzer';

export interface WritingContextData {
  experience: {
    category?: string;
    target?: string;
    purpose?: string;
    experience?: string;
    pros?: string;
    cons?: string;
    tips?: string;
    recommendedFor?: string;
    prosAndCons?: string;
    tipsAndCourse?: string;
  };
  review: {
    subject?: string;
    experience?: string;
    pros?: string;
    cons?: string;
    recommendedFor?: string;
  };
  info: {
    mainQuestion?: string;
    targetAudience?: string;
    requiredInfo?: string;
    readerQuestions?: string;
    conditions?: string;
    tipsAndFaq?: string;
  };
  purchase: {
    targets?: string;
    criteria?: string;
    budget?: string;
    strengths?: string;
    usageEnv?: string;
    recommendedFor?: string;
    ctaDirection?: string;
  };
  comparison: {
    targetA?: string;
    targetB?: string;
    reason?: string;
    criteria?: string;
    informationA?: string;
    informationB?: string;
    personalVerdict?: string;
  };
  story: {
    situation?: string;
    experience?: string;
    feelings?: string;
    message?: string;
    conclusion?: string;
  };
  homepan: {
    situation?: string;
    experience?: string;
    feelings?: string;
    message?: string;
    conclusion?: string;
  };
  travel: {
    purpose?: string;
    target?: string;
    experience?: string;
    pros?: string;
    courseInfo?: string;
    recommendedFor?: string;
  };
  common: {
    experience?: string;
  };
}

const INITIAL_WRITING_CONTEXT: WritingContextData = {
  experience: { category: '', target: '', purpose: '', experience: '', pros: '', cons: '', tips: '', recommendedFor: '', prosAndCons: '', tipsAndCourse: '' },
  review: { subject: '', experience: '', pros: '', cons: '', recommendedFor: '' },
  info: { mainQuestion: '', targetAudience: '', requiredInfo: '', readerQuestions: '', conditions: '', tipsAndFaq: '' },
  purchase: { targets: '', criteria: '', budget: '', strengths: '', usageEnv: '', recommendedFor: '', ctaDirection: '' },
  comparison: { targetA: '', targetB: '', reason: '', criteria: '', informationA: '', informationB: '', personalVerdict: '' },
  story: { situation: '', experience: '', feelings: '', message: '', conclusion: '' },
  homepan: { situation: '', experience: '', feelings: '', message: '', conclusion: '' },
  travel: { purpose: '', target: '', experience: '', pros: '', courseInfo: '', recommendedFor: '' },
  common: { experience: '' },
};

function mapStyleKeyToDraftType(styleKey: SeoWritingStyleKey): DraftType {
  switch (styleKey) {
    case 'experience':
    case 'travel':
    case 'review':
      return 'experience_draft';
    case 'info':
      return 'info_draft';
    case 'purchase':
      return 'purchase_draft';
    case 'comparison':
      return 'comparison_draft';
    case 'homepan':
    case 'story':
      return 'homepan_draft';
    default:
      return 'experience_draft';
  }
}

function buildActiveUserExperience(
  styleKey: SeoWritingStyleKey,
  ctx: WritingContextData,
  experienceSubtype?: string
): string {
  const parts: string[] = [];

  if (ctx.common?.experience?.trim()) {
    parts.push(`[공통 실사용 강조/경험]: ${ctx.common.experience.trim()}`);
  }

  switch (styleKey) {
    case 'experience':
    case 'travel':
    case 'review': {
      const exp = ctx.experience || (ctx as any).review || (ctx as any).travel || {};
      const sub = experienceSubtype || 'general';

      if (exp.category?.trim()) parts.push(`- 경험 대상 분류: ${exp.category.trim()}`);
      if (exp.purpose?.trim()) parts.push(`- 방문/구매/이용 계기: ${exp.purpose.trim()}`);
      if (exp.target?.trim() || exp.subject?.trim()) {
        parts.push(`- 경험 대상 명칭: ${(exp.target || exp.subject || '').trim()}`);
      }
      if (exp.experience?.trim()) {
        const expLabel =
          sub === 'restaurant' || sub === 'cafe'
            ? '주문 메뉴 및 솔직 맛 후기'
            : sub === 'product'
            ? '실사용 솔직 후기 (성능, 편의성)'
            : sub === 'travel' || sub === 'accommodation'
            ? '실제 코스 및 이용 경험'
            : '실제 사용/방문/체험 솔직 경험';
        parts.push(`- ${expLabel}: ${exp.experience.trim()}`);
      }
      if (exp.pros?.trim()) parts.push(`- 실제로 좋았던 점: ${exp.pros.trim()}`);
      if (exp.cons?.trim()) parts.push(`- 아쉬웠던 점: ${exp.cons.trim()}`);
      if (exp.prosAndCons?.trim() && !exp.pros?.trim() && !exp.cons?.trim()) {
        parts.push(`- 장단점 및 솔직 체감: ${exp.prosAndCons.trim()}`);
      }
      if (exp.tips?.trim()) {
        const tipLabel =
          sub === 'restaurant' || sub === 'cafe'
            ? '방문 꿀팁 / 주차 / 웨이팅'
            : sub === 'travel' || sub === 'accommodation'
            ? '여행 꿀팁 / 준비물'
            : '활용 팁 / 주의사항';
        parts.push(`- ${tipLabel}: ${exp.tips.trim()}`);
      }
      if (exp.tipsAndCourse?.trim() && !exp.tips?.trim()) {
        parts.push(`- 활용 팁 / 코스 정보: ${exp.tipsAndCourse.trim()}`);
      }
      if (exp.recommendedFor?.trim()) parts.push(`- 추천하고 싶은 사람/대상: ${exp.recommendedFor.trim()}`);
      break;
    }
    case 'info': {
      const i = ctx.info || {};
      if (i.mainQuestion?.trim()) parts.push(`- 독자가 가장 궁금해할 핵심 질문: ${i.mainQuestion.trim()}`);
      if (i.targetAudience?.trim()) parts.push(`- 대상 독자/타깃: ${i.targetAudience.trim()}`);
      if (i.requiredInfo?.trim()) parts.push(`- 필수 단계/신청 절차/핵심 내용: ${i.requiredInfo.trim()}`);
      if (i.conditions?.trim()) parts.push(`- 특별히 주의하거나 강조할 조건: ${i.conditions.trim()}`);
      if (i.tipsAndFaq?.trim()) parts.push(`- 추가 꿀팁 및 FAQ: ${i.tipsAndFaq.trim()}`);
      if (i.readerQuestions?.trim() && !i.tipsAndFaq?.trim()) {
        parts.push(`- 독자 궁금증 포인트: ${i.readerQuestions.trim()}`);
      }
      break;
    }
    case 'purchase': {
      const p = ctx.purchase || {};
      if (p.targets?.trim()) parts.push(`- 추천/비교 대상 목록: ${p.targets.trim()}`);
      if (p.budget?.trim()) parts.push(`- 예산대 및 타깃 사용자: ${p.budget.trim()}`);
      if (p.criteria?.trim()) parts.push(`- 중요하게 보는 선택 기준: ${p.criteria.trim()}`);
      if (p.strengths?.trim()) parts.push(`- 핵심 추천 이유 및 실사용 강점: ${p.strengths.trim()}`);
      if (p.usageEnv?.trim()) parts.push(`- 사용 환경 및 조건: ${p.usageEnv.trim()}`);
      if (p.recommendedFor?.trim()) parts.push(`- 추천 대상: ${p.recommendedFor.trim()}`);
      if (p.ctaDirection?.trim()) parts.push(`- 구매 시 주의사항 / CTA 방향: ${p.ctaDirection.trim()}`);
      break;
    }
    case 'comparison': {
      const c = ctx.comparison || {};
      if (c.targetA?.trim() || c.targetB?.trim()) {
        parts.push(`- 비교 대상: [A] ${c.targetA?.trim() || '미지정'} VS [B] ${c.targetB?.trim() || '미지정'}`);
      }
      if (c.reason?.trim()) parts.push(`- 비교 이유 및 사용 목적: ${c.reason.trim()}`);
      if (c.criteria?.trim()) parts.push(`- 중요하게 보는 비교 기준: ${c.criteria.trim()}`);
      if (c.informationA?.trim()) parts.push(`- A의 세부 특징 및 체감: ${c.informationA.trim()}`);
      if (c.informationB?.trim()) parts.push(`- B의 세부 특징 및 체감: ${c.informationB.trim()}`);
      if (c.personalVerdict?.trim()) parts.push(`- 개인적 총평 / 추천 선택 기준: ${c.personalVerdict.trim()}`);
      break;
    }
    case 'homepan':
    case 'story': {
      const s = ctx.homepan || (ctx as any).story || {};
      if (s.situation?.trim()) parts.push(`- 화제성 이슈/작성 계기/고민: ${s.situation.trim()}`);
      if (s.experience?.trim()) parts.push(`- 실제 겪은 생생한 사건/에피소드: ${s.experience.trim()}`);
      if (s.feelings?.trim()) parts.push(`- 극적인 반전/느낀 점/해결 과정: ${s.feelings.trim()}`);
      if (s.message?.trim()) parts.push(`- 전달하고 싶은 메시지/교훈/소통 질문: ${s.message.trim()}`);
      break;
    }
  }

  return parts.join('\n');
}

async function safeParseApiResponse(res: Response, fallbackErrorMsg = 'AI 요청 처리 중 오류가 발생했습니다.'): Promise<{ ok: boolean; data: any; rawText: string; error?: string }> {
  let rawText = '';
  try {
    rawText = await res.text();
  } catch (readErr: any) {
    return { ok: false, data: null, rawText: '', error: `응답을 읽을 수 없습니다: ${readErr?.message || '네트워크 오류'}` };
  }

  let parsedJson: any = null;
  if (rawText) {
    parsedJson = extractAndParseJson(rawText);
  }

  if (!res.ok) {
    let errorMsg = fallbackErrorMsg;
    if (parsedJson && (parsedJson.message || parsedJson.error)) {
      errorMsg = parsedJson.message || parsedJson.error;
    } else if (rawText && !rawText.trim().startsWith('<')) {
      errorMsg = rawText.slice(0, 200);
    } else if (res.status === 504 || res.status === 502 || res.status === 503) {
      errorMsg = 'AI 서버 응답 시간이 초과되었거나 서버가 혼잡합니다. 잠시 후 다시 시도해 주세요.';
    }
    return { ok: false, data: parsedJson, rawText, error: errorMsg };
  }

  return { ok: true, data: parsedJson || { result: rawText }, rawText };
}

function parseGoldenKeywordResult(raw: any, inputKeyword: string): GoldenKeywordResult {
  const fallback: GoldenKeywordResult = {
    mainKeyword: inputKeyword,
    writing_style: '[경험 리뷰형]',
    recommendedHtml: { includeFaq: true, includeTable: true, includeChecklist: false, includeImageRec: true, includeQuote: false },
    searchIntent: { stage: '정보탐색', userGoal: `${inputKeyword} 정보 확인`, targetAudience: '2040 실사용자', possibleQuestions: [`${inputKeyword} 주요 정보는?`] },
    keywordClusters: { core: [{ keyword: inputKeyword, usage: '제목' }], longTail: [], comparison: [], transaction: [], faq: [] },
    recommendedTitles: { click: [`${inputKeyword} 주요 정보 및 실전 팁`], information: [`${inputKeyword} 핵심 정보 및 선택 기준`], review: [], comparison: [] },
    recommendedOutline: { h1: `${inputKeyword} 핵심 정보 및 실전 팁`, h2: ['주요 특징 및 핵심 정보', '추천 대상 및 선택 기준', '실전 이용 팁'] },
    ctaStrategy: { primaryCTA: '상세 정보 확인', secondaryCTA: '댓글 문의', benefitFocus: '가이드 제공', recommendedPlacement: ['결론'] },
    seoChecklist: ['키워드 포함'],
    internalLinkIdeas: [],
    imageIdeas: [],
    writingTone: { style: '[경험 리뷰형]', length: '2,000자', trustSignals: [] },
    notes: ''
  };

  if (!raw) return fallback;

  let obj = typeof raw === 'string' ? extractAndParseJson(raw) : raw;
  if (!obj && typeof raw === 'object') {
    obj = raw;
  }

  if (typeof obj === 'object' && obj !== null) {
    return {
      mainKeyword: obj.mainKeyword || inputKeyword,
      writing_style: obj.writing_style || obj.writingStyle || fallback.writing_style,
      recommendedHtml: obj.recommendedHtml || fallback.recommendedHtml,
      contentBoundary: obj.contentBoundary,
      searchIntent: obj.searchIntent || fallback.searchIntent,
      keywordClusters: obj.keywordClusters || fallback.keywordClusters,
      titleCandidates: Array.isArray(obj.titleCandidates) ? obj.titleCandidates : undefined,
      recommendedTitles: obj.recommendedTitles || fallback.recommendedTitles,
      recommendedOutline: obj.recommendedOutline || fallback.recommendedOutline,
      ctaStrategy: obj.ctaStrategy || fallback.ctaStrategy,
      seoChecklist: Array.isArray(obj.seoChecklist) ? obj.seoChecklist : fallback.seoChecklist,
      internalLinkIdeas: Array.isArray(obj.internalLinkIdeas) ? obj.internalLinkIdeas : fallback.internalLinkIdeas,
      imageIdeas: Array.isArray(obj.imageIdeas) ? obj.imageIdeas : fallback.imageIdeas,
      writingTone: obj.writingTone || fallback.writingTone,
      notes: obj.notes || '',
      topPosts: Array.isArray(obj.topPosts) ? obj.topPosts : undefined,
      relatedKeywordsList: Array.isArray(obj.relatedKeywordsList)
        ? obj.relatedKeywordsList
        : Array.isArray(obj.relatedKeywords)
        ? obj.relatedKeywords
        : undefined,
      rawBenchmarkPrompt: obj.rawBenchmarkPrompt || obj.benchmarkPrompt || undefined,
      benchmarkReceivedAt: obj.benchmarkReceivedAt || (obj.topPosts ? new Date().toLocaleTimeString('ko-KR') : undefined),
    };
  }

  return fallback;
}

function cleanDraftOutput(text: string) {
  if (!text) return '';
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:html|xml|markdown)?\s*/i, '');
  cleaned = cleaned.replace(/\s*```$/i, '');
  cleaned = cleaned.replace(/<!DOCTYPE[^>]*>/gi, '');
  cleaned = cleaned.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '');
  cleaned = cleaned.replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '');
  cleaned = cleaned.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  cleaned = cleaned.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  cleaned = cleaned.replace(/<\/?(?:html|meta|link|body)[^>]*>/gi, '');
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');
  cleaned = cleaned.replace(/<!--[\s\S]*?(?=<[a-zA-Z\/]|-->|$)/g, '');
  cleaned = cleaned.replace(/<!--/g, '');
  cleaned = cleaned.replace(/-->/g, '');
  return stripInternalImageGuides(cleaned.trim());
}

function countWords(str: string): number {
  if (!str) return 0;
  const plainText = str.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  return plainText.length;
}

interface AiToolkitTabProps {
  currentUser: NaverUser | null;
  isAdminLoggedIn?: boolean;
  onShowLoginModal: () => void;
  onShowToast: (msg: string) => void;
  activeSubTab?: 'keyword' | 'draft' | 'image';
  onSelectSubTab?: (tab: 'keyword' | 'draft' | 'image') => void;
  initialKeyword?: string;
  onClearInitialKeyword?: () => void;
}

export const AiToolkitTab: React.FC<AiToolkitTabProps> = ({
  currentUser,
  isAdminLoggedIn = false,
  onShowLoginModal,
  onShowToast,
  initialKeyword,
  onClearInitialKeyword,
}) => {
  const isAdmin = Boolean(isAdminLoggedIn) || currentUser?.role === 'admin' || Boolean((currentUser as any)?.is_admin);

  const usageStorageKey = `ai_toolkit_usage_${currentUser?.id || currentUser?.naverId || 'guest'}`;

  const [limits, setLimits] = useState<UserUsageLimits>({
    role: isAdmin ? 'admin' : 'user',
    subscriptionPlan: 'free',
    maxBatchSize: isAdmin ? 10 : 1,
    textGenerationCount: 0,
    dailyTextGenerationLimit: isAdmin ? 9999 : 10,
    monthlyTextGenerationLimit: isAdmin ? 9999 : 50,
    cardGenerationCount: 0,
    dailyCardGenerationLimit: isAdmin ? 9999 : 10,
    monthlyCardGenerationLimit: isAdmin ? 9999 : 10,
    aiGraphicGenerationCount: 0,
    dailyAiGraphicGenerationLimit: isAdmin ? 9999 : 15,
    monthlyAiGraphicGenerationLimit: isAdmin ? 9999 : 15,
  });

  useEffect(() => {
    try {
      const todayStr = new Date().toLocaleDateString('sv');
      const stored = localStorage.getItem(usageStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        const isDifferentDay = parsed.lastUsageDate && parsed.lastUsageDate !== todayStr;
        const textCount = isDifferentDay ? 0 : (typeof parsed.textGenerationCount === 'number' ? parsed.textGenerationCount : 0);
        const cardCount = isDifferentDay ? 0 : (typeof parsed.cardGenerationCount === 'number' ? parsed.cardGenerationCount : 0);
        const graphicCount = isDifferentDay ? 0 : (typeof parsed.aiGraphicGenerationCount === 'number' ? parsed.aiGraphicGenerationCount : 0);

        setLimits((prev) => ({
          ...prev,
          role: isAdmin ? 'admin' : 'user',
          maxBatchSize: isAdmin ? 10 : 1,
          dailyTextGenerationLimit: isAdmin ? 9999 : 10,
          monthlyTextGenerationLimit: isAdmin ? 9999 : 50,
          dailyCardGenerationLimit: isAdmin ? 9999 : 10,
          monthlyCardGenerationLimit: isAdmin ? 9999 : 10,
          dailyAiGraphicGenerationLimit: isAdmin ? 9999 : 15,
          monthlyAiGraphicGenerationLimit: isAdmin ? 9999 : 15,
          textGenerationCount: textCount,
          cardGenerationCount: cardCount,
          aiGraphicGenerationCount: graphicCount,
        }));
      } else {
        setLimits((prev) => ({
          ...prev,
          role: isAdmin ? 'admin' : 'user',
          maxBatchSize: isAdmin ? 10 : 1,
          dailyTextGenerationLimit: isAdmin ? 9999 : 10,
          monthlyTextGenerationLimit: isAdmin ? 9999 : 50,
          dailyCardGenerationLimit: isAdmin ? 9999 : 10,
          monthlyCardGenerationLimit: isAdmin ? 9999 : 10,
          dailyAiGraphicGenerationLimit: isAdmin ? 9999 : 15,
          monthlyAiGraphicGenerationLimit: isAdmin ? 9999 : 15,
        }));
      }
    } catch (e) {
      console.error('Failed to load usage limits:', e);
    }
  }, [usageStorageKey, isAdmin]);

  useEffect(() => {
    try {
      const todayStr = new Date().toLocaleDateString('sv');
      localStorage.setItem(
        usageStorageKey,
        JSON.stringify({
          lastUsageDate: todayStr,
          textGenerationCount: limits.textGenerationCount,
          cardGenerationCount: limits.cardGenerationCount,
          aiGraphicGenerationCount: limits.aiGraphicGenerationCount,
        })
      );
    } catch (e) {
      console.error('Failed to save usage limits:', e);
    }
  }, [limits.textGenerationCount, limits.cardGenerationCount, limits.aiGraphicGenerationCount, usageStorageKey]);

  const handleResetUsage = () => {
    if (confirm('현재 기록된 AI 툴킷 사용량을 0회로 초기화하시겠습니까?')) {
      setLimits((prev) => ({
        ...prev,
        textGenerationCount: 0,
        cardGenerationCount: 0,
        aiGraphicGenerationCount: 0,
      }));
      localStorage.removeItem(usageStorageKey);
      onShowToast('🔄 사용량이 성공적으로 초기화되었습니다.');
    }
  };

  const [keywords, setKeywords] = useState<string[]>(['']);
  const [keywordStyles, setKeywordStyles] = useState<Record<number, SeoWritingStyleKey>>({});
  const [keywordExperienceTypes, setKeywordExperienceTypes] = useState<Record<number, string>>({});
  const stopQueueRef = React.useRef<boolean>(false);
  const [isBulkPasteOpen, setIsBulkPasteOpen] = useState<boolean>(false);
  const [bulkInputText, setBulkInputText] = useState<string>('');

  // Helper: Get writing style for specific keyword index
  const getKeywordStyle = (index: number, kwText?: string): SeoWritingStyleKey => {
    if (keywordStyles[index]) return keywordStyles[index];
    if (index === 0 && selectedStyleKey) return selectedStyleKey;
    if (kwText && kwText.trim()) {
      return classifyKeywordInstant(kwText.trim()).writingStyle || 'experience';
    }
    return 'experience';
  };

  // Helper: Set writing style for specific keyword index
  const setKeywordStyle = (index: number, style: SeoWritingStyleKey) => {
    setKeywordStyles((prev) => ({ ...prev, [index]: style }));
    if (index === 0) {
      setSelectedStyleKey(style);
      setUserHasManuallyChangedStyle(true);
    }
  };

  // Helper: Get experience sub-type for specific keyword index
  const getKeywordExperienceType = (index: number, kwText?: string): string => {
    if (keywordExperienceTypes[index]) return keywordExperienceTypes[index];
    if (index === 0 && activeExperienceType) return activeExperienceType;
    if (kwText && kwText.trim()) {
      return classifyKeywordInstant(kwText.trim()).experienceType || 'restaurant';
    }
    return 'restaurant';
  };

  // Helper: Set experience sub-type for specific keyword index
  const setKeywordExperienceType = (index: number, expType: string) => {
    setKeywordExperienceTypes((prev) => ({ ...prev, [index]: expType }));
    if (index === 0) {
      setActiveExperienceType(expType);
    }
  };

  // Auto-fill and react to initial keyword from Trend Keywords / External Navigation
  useEffect(() => {
    if (initialKeyword && initialKeyword.trim()) {
      const cleanKw = initialKeyword.trim();
      setKeywords([cleanKw]);
      if (onClearInitialKeyword) {
        onClearInitialKeyword();
      }
    }
  }, [initialKeyword, onClearInitialKeyword]);

  const [selectedStyleKey, setSelectedStyleKey] = useState<SeoWritingStyleKey>('experience');
  const [writingContext, setWritingContext] = useState<WritingContextData>(INITIAL_WRITING_CONTEXT);
  const [aiAnalysis, setAiAnalysis] = useState<AiContentAnalysisResult | null>(null);
  const [isAnalyzingKeyword, setIsAnalyzingKeyword] = useState<boolean>(false);
  const [isStyleSelectorOpen, setIsStyleSelectorOpen] = useState<boolean>(false);
  const [userHasManuallyChangedStyle, setUserHasManuallyChangedStyle] = useState<boolean>(false);
  const [activeExperienceType, setActiveExperienceType] = useState<string>('restaurant');

  // AI Keyword Content Auto-Analysis (Intent, Content Type, Conversion Goal, Writing Style Recommendation)
  useEffect(() => {
    if (isRestoringRef.current) return;
    const mainKw = (keywords[0] || '').trim();
    if (!mainKw) {
      setAiAnalysis(null);
      setIsAnalyzingKeyword(false);
      return;
    }

    // 1. Instant heuristic analysis for zero-latency UI adaptation
    const instant = classifyKeywordInstant(mainKw);
    setAiAnalysis(instant);
    if (!userHasManuallyChangedStyle) {
      setSelectedStyleKey(instant.writingStyle);
      if (instant.experienceType) {
        setActiveExperienceType(instant.experienceType);
      }
    }

    // 2. Debounced deep semantic analysis via Gemini API
    const timer = setTimeout(async () => {
      if (mainKw.length < 2) return;
      setIsAnalyzingKeyword(true);
      try {
        const deepAnalysis = await analyzeKeywordWithAi(mainKw, currentUser);
        if (deepAnalysis) {
          setAiAnalysis(deepAnalysis);
          if (!userHasManuallyChangedStyle) {
            setSelectedStyleKey(deepAnalysis.writingStyle);
            if (deepAnalysis.experienceType) {
              setActiveExperienceType(deepAnalysis.experienceType);
            }
          }
        }
      } catch (e) {
        console.warn('[AiToolkit] Deep intent analysis fallback to heuristic:', e);
      } finally {
        setIsAnalyzingKeyword(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [keywords[0], userHasManuallyChangedStyle, currentUser?.id, currentUser?.naverId]);

  const [isAdvancedOpen, setIsAdvancedOpen] = useState<boolean>(false);
  const [targetWordCount, setTargetWordCount] = useState<string>('1500');
  const [bodyAiModel, setBodyAiModel] = useState<string>('gemini-3.7-flash');
  const [outputFormat, setOutputFormat] = useState<'naver_paste' | 'html'>('naver_paste');

  const [batchItems, setBatchItems] = useState<AiBatchItem[]>([]);
  const [isQueueRunning, setIsQueueRunning] = useState<boolean>(false);
  const [currentQueueIndex, setCurrentQueueIndex] = useState<number>(0);
  const [currentPipelineStageText, setCurrentPipelineStageText] = useState<string>('준비 중');

  const [activeItemForModal, setActiveItemForModal] = useState<AiBatchItem | null>(null);
  const [viewingDraftContent, setViewingDraftContent] = useState<string>('');
  const [modalSeoPlan, setModalSeoPlan] = useState<GoldenKeywordResult | null>(null);

  const [isContextFormOpen, setIsContextFormOpen] = useState<boolean>(true);
  const [showRawHtmlItemIds, setShowRawHtmlItemIds] = useState<Record<string, boolean>>({});
  const [expandedSeoPlanItemIds, setExpandedSeoPlanItemIds] = useState<Record<string, boolean>>({});

  // === AI Draft Session Auto-Save & Recovery System State ===
  const [draftSessionId, setDraftSessionId] = useState<string>(() => generateDraftSessionId());
  const [draftSessionStatus, setDraftSessionStatus] = useState<DraftSessionStatus>('drafting');
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<Date | null>(null);
  const [recoveredSession, setRecoveredSession] = useState<AiDraftSession | null>(null);
  const [isBannerDismissed, setIsBannerDismissed] = useState<boolean>(false);
  const isRestoringRef = React.useRef<boolean>(false);
  const [styleProfile, setStyleProfile] = useState<StyleProfile | null>(null);

  // Load saved style profile from localStorage
  useEffect(() => {
    try {
      const storageKey = `ai_blog_style_profile_${currentUser?.id || currentUser?.naverId || currentUser?.email || 'guest'}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setStyleProfile(JSON.parse(saved));
      }
    } catch (e) {
      console.warn('[AiToolkit] Failed to load saved style profile:', e);
    }
  }, [currentUser?.id, currentUser?.naverId, currentUser?.email]);

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);

  // === AI 초안 출력 서식 커스텀 시스템 State ===
  const [userBlogStyle, setUserBlogStyle] = useState<UserBlogStyle>(() => ({
    ...DEFAULT_USER_BLOG_STYLE,
    userId: currentUser?.id || currentUser?.naverId || 'default',
  }));
  const [isStyleSettingsModalOpen, setIsStyleSettingsModalOpen] = useState<boolean>(false);
  const [isSavingBlogStyle, setIsSavingBlogStyle] = useState<boolean>(false);

  // Load user blog formatting style from remote/local storage on user change
  useEffect(() => {
    let isMounted = true;
    const fetchStyle = async () => {
      const uid = currentUser?.id || currentUser?.naverId || 'default';
      const loaded = await loadUserBlogStyle(uid);
      if (isMounted) {
        setUserBlogStyle(loaded);
      }
    };
    fetchStyle();
    return () => {
      isMounted = false;
    };
  }, [currentUser?.id, currentUser?.naverId]);

  const handleSaveUserBlogStyle = async (newStyle: UserBlogStyle) => {
    setIsSavingBlogStyle(true);
    try {
      const uid = currentUser?.id || currentUser?.naverId || 'default';
      const styleWithUser = { ...newStyle, userId: uid };
      setUserBlogStyle(styleWithUser);
      await persistUserBlogStyle(styleWithUser);
      onShowToast('🎨 블로그 출력 서식이 안전하게 저장되었습니다! 이후 생성/복사되는 모든 초안에 자동 적용됩니다.');
    } catch (e) {
      console.warn('Failed to save user blog style:', e);
      onShowToast('⚠️ 블로그 출력 서식 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSavingBlogStyle(false);
    }
  };

  // === Grounding Data (상품/장소 링크 붙여넣기 및 OG/JSON-LD 정보 추출) State ===
  const [linkUrlInput, setLinkUrlInput] = useState<string>('');
  const [isExtractingLink, setIsExtractingLink] = useState<boolean>(false);
  const [extractedLinkData, setExtractedLinkData] = useState<ExtractedLinkData | null>(null);
  const [linkExtractionError, setLinkExtractionError] = useState<string | null>(null);
  const [showManualGroundingForm, setShowManualGroundingForm] = useState<boolean>(false);
  const [manualGroundingData, setManualGroundingData] = useState<{
    title: string;
    brand: string;
    price: string;
    address: string;
    description: string;
    userNotes: string;
  }>({
    title: '',
    brand: '',
    price: '',
    address: '',
    description: '',
    userNotes: '',
  });

  const handleExtractLink = async () => {
    if (!linkUrlInput.trim()) {
      onShowToast('🔗 분석할 상품 또는 장소의 웹 URL을 입력해주세요.');
      return;
    }

    setIsExtractingLink(true);
    setLinkExtractionError(null);
    try {
      const resp = await fetch('/api/extract-og-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: linkUrlInput.trim() }),
      });

      const resData = await resp.json();
      if (resData.success && resData.data) {
        setExtractedLinkData(resData.data);
        setShowManualGroundingForm(false);
        setLinkExtractionError(null);

        // Pre-fill manual data fields if needed
        setManualGroundingData((prev) => ({
          ...prev,
          title: resData.data.title || prev.title,
          brand: resData.data.brand || prev.brand,
          price: resData.data.price || prev.price,
          address: resData.data.address || prev.address,
          description: resData.data.description || prev.description,
        }));

        onShowToast(`✓ "${resData.data.title || '링크'}"의 정보가 성공적으로 추출되어 근거 데이터로 연동되었습니다!`);
      } else {
        const errorMsg =
          resData.message ||
          '이 사이트는 자동 추출이 지원되지 않습니다. 직접 입력해주세요.';
        setLinkExtractionError(errorMsg);
        setExtractedLinkData(null);
        setShowManualGroundingForm(true);
      }
    } catch (err: any) {
      console.error('Link extraction error:', err);
      const errorMsg = '이 사이트는 자동 추출이 지원되지 않습니다. 직접 입력해주세요.';
      setLinkExtractionError(errorMsg);
      setExtractedLinkData(null);
      setShowManualGroundingForm(true);
    } finally {
      setIsExtractingLink(false);
    }
  };

  const handleClearLinkData = () => {
    setLinkUrlInput('');
    setExtractedLinkData(null);
    setLinkExtractionError(null);
    setShowManualGroundingForm(false);
    setManualGroundingData({
      title: '',
      brand: '',
      price: '',
      address: '',
      description: '',
      userNotes: '',
    });
    onShowToast('연동된 링크 및 근거 데이터가 제거되었습니다.');
  };

  const handleResetUserBlogStyle = async () => {
    const uid = currentUser?.id || currentUser?.naverId || 'default';
    const resetStyle = await resetUserBlogStyle(uid);
    setUserBlogStyle(resetStyle);
    onShowToast('🔄 기본 블로그 출력 서식(나눔고딕 15pt, 인용구 2)으로 초기화되었습니다.');
  };

  // Load existing unexpired draft session on mount or user login
  useEffect(() => {
    if (!currentUser) return;

    let isMounted = true;
    const checkSession = async () => {
      try {
        const session = await getCurrentDraftSession({
          id: currentUser.id || currentUser.naverId,
          email: currentUser.email,
          name: currentUser.name,
          isAdmin,
          isChallengeParticipant: true,
        });

        if (!isMounted) return;

        if (session && (session.keyword || (session.keywords && session.keywords.length > 0) || (session.batchItems && session.batchItems.length > 0))) {
          setRecoveredSession(session);
          setIsBannerDismissed(false);
        }
      } catch (err) {
        console.warn('[DraftSystem] Failed to check existing draft session:', err);
      }

      try {
        triggerExpiredDraftsCleanup(currentUser.id || currentUser.naverId);
      } catch (_) {}
    };

    checkSession();

    return () => {
      isMounted = false;
    };
  }, [currentUser?.id, currentUser?.naverId, isAdmin]);

  // Helper to save current draft session state
  const saveCurrentDraft = async (
    overrides: Partial<AiDraftSession> = {},
    options: { isExplicit?: boolean; markSaved?: boolean } = {}
  ) => {
    if (!currentUser) return;

    const cleanKeywords = keywords.map((k) => k.trim()).filter(Boolean);
    const currentBatch = overrides.batchItems || batchItems;

    // Avoid saving if completely blank
    if (cleanKeywords.length === 0 && currentBatch.length === 0 && !writingContext.common.experience.trim()) {
      return;
    }

    setAutoSaveStatus('saving');

    const firstBatch = currentBatch[0];
    const status: DraftSessionStatus = options.markSaved
      ? 'saved'
      : (overrides.status || draftSessionStatus || 'drafting');

    let lastStep: DraftLastStep = 'keyword_input';
    if (firstBatch?.draftContent || firstBatch?.draftStatus === 'completed') {
      lastStep = 'draft_text';
    } else if (firstBatch?.seoPlan || firstBatch?.seoPlanStatus === 'completed') {
      lastStep = 'seo_plan';
    }

    const sessionObj: AiDraftSession = {
      id: draftSessionId,
      userId: currentUser.id || currentUser.naverId,
      userEmail: currentUser.email,
      userName: currentUser.name,
      keyword: cleanKeywords[0] || firstBatch?.keyword || '',
      keywords: cleanKeywords.length > 0 ? cleanKeywords : (firstBatch?.keyword ? [firstBatch.keyword] : []),
      status,
      lastStep: overrides.lastStep || lastStep,
      writingStyleKey: selectedStyleKey,
      writingContext,
      aiAnalysis: overrides.aiAnalysis || aiAnalysis || undefined,
      targetWordCount,
      bodyAiModel,
      outputFormat,
      batchItems: currentBatch,
      seoPlan: overrides.seoPlan || firstBatch?.seoPlan,
      draftContent: overrides.draftContent || firstBatch?.draftContent,
      styleProfile: overrides.styleProfile || styleProfile || undefined,
      updatedAt: new Date().toISOString(),
      ...overrides,
    };

    try {
      await saveDraftSession(sessionObj, { isAdmin, isChallengeParticipant: true });
      setAutoSaveStatus('saved');
      setLastAutoSavedAt(new Date());

      if (options.isExplicit) {
        if (options.markSaved) {
          setDraftSessionStatus('saved');
          onShowToast('💾 초안 작업이 보관함에 영구 저장되었습니다! (7일 후 만료되지 않음)');
        } else {
          onShowToast('💾 현재 작업 상태가 임시저장되었습니다.');
        }
      }
    } catch (e) {
      console.warn('[DraftSystem] Auto save error:', e);
      setAutoSaveStatus('error');
    }
  };

  // Debounce auto-save for user form typing
  useEffect(() => {
    if (!currentUser || isRestoringRef.current || isQueueRunning) return;
    const cleanKeywords = keywords.map((k) => k.trim()).filter(Boolean);
    if (cleanKeywords.length === 0 && batchItems.length === 0) return;

    const timer = setTimeout(() => {
      saveCurrentDraft();
    }, 1500);

    return () => clearTimeout(timer);
  }, [keywords, selectedStyleKey, writingContext, targetWordCount, bodyAiModel, outputFormat, styleProfile]);

  // Restore draft from recovery banner
  const handleRestoreDraft = () => {
    if (!recoveredSession) return;
    isRestoringRef.current = true;

    setDraftSessionId(recoveredSession.id);
    setDraftSessionStatus(recoveredSession.status || 'drafting');

    if (recoveredSession.keywords && recoveredSession.keywords.length > 0) {
      setKeywords(recoveredSession.keywords);
    } else if (recoveredSession.keyword) {
      setKeywords([recoveredSession.keyword]);
    }

    if (recoveredSession.writingStyleKey) {
      setSelectedStyleKey(recoveredSession.writingStyleKey as SeoWritingStyleKey);
    }

    if (recoveredSession.writingContext) {
      setWritingContext(recoveredSession.writingContext);
    }

    if (recoveredSession.targetWordCount) {
      setTargetWordCount(recoveredSession.targetWordCount);
    }

    if (recoveredSession.bodyAiModel) {
      setBodyAiModel(recoveredSession.bodyAiModel);
    }

    if (recoveredSession.outputFormat) {
      setOutputFormat(recoveredSession.outputFormat as any);
    }

    if (recoveredSession.batchItems && recoveredSession.batchItems.length > 0) {
      setBatchItems(recoveredSession.batchItems);
    } else if (recoveredSession.keyword && (recoveredSession.seoPlan || recoveredSession.draftContent)) {
      setBatchItems([{
        id: `recovered_${recoveredSession.id}`,
        keyword: recoveredSession.keyword,
        seoPlanStatus: recoveredSession.seoPlan ? 'completed' : 'pending',
        draftStatus: recoveredSession.draftContent ? 'completed' : 'pending',
        imageStatus: 'not_requested',
        cardNewsStatus: 'not_requested',
        seoPlan: recoveredSession.seoPlan,
        draftContent: recoveredSession.draftContent,
        outputFormat: (recoveredSession.outputFormat as any) || 'naver_paste',
      }]);
    }

    if (recoveredSession.aiAnalysis) {
      setAiAnalysis(recoveredSession.aiAnalysis);
      if (recoveredSession.aiAnalysis.experienceType) {
        setActiveExperienceType(recoveredSession.aiAnalysis.experienceType);
      }
    }

    if (recoveredSession.styleProfile) {
      setStyleProfile(recoveredSession.styleProfile);
    }

    setRecoveredSession(null);
    setIsBannerDismissed(true);
    setLastAutoSavedAt(new Date());
    setAutoSaveStatus('saved');
    onShowToast('✓ 이전 작업 상태가 성공적으로 복구되었습니다.');

    setTimeout(() => {
      isRestoringRef.current = false;
    }, 1000);
  };

  const handleRestoreDraftFromHistory = (session: AiDraftSession) => {
    isRestoringRef.current = true;

    setDraftSessionId(session.id);
    setDraftSessionStatus(session.status || 'drafting');

    if (session.keywords && session.keywords.length > 0) {
      setKeywords(session.keywords);
    } else if (session.keyword) {
      setKeywords([session.keyword]);
    }

    if (session.writingStyleKey) {
      setSelectedStyleKey(session.writingStyleKey as SeoWritingStyleKey);
    }

    if (session.writingContext) {
      setWritingContext(session.writingContext);
    }

    if (session.aiAnalysis) {
      setAiAnalysis(session.aiAnalysis);
      if (session.aiAnalysis.experienceType) {
        setActiveExperienceType(session.aiAnalysis.experienceType);
      }
    }

    if (session.targetWordCount) {
      setTargetWordCount(session.targetWordCount);
    }

    if (session.bodyAiModel) {
      setBodyAiModel(session.bodyAiModel);
    }

    if (session.outputFormat) {
      setOutputFormat(session.outputFormat as any);
    }

    if (session.batchItems && session.batchItems.length > 0) {
      setBatchItems(session.batchItems);
    } else if (session.keyword && (session.seoPlan || session.draftContent)) {
      setBatchItems([{
        id: `history_${session.id}`,
        keyword: session.keyword,
        seoPlanStatus: session.seoPlan ? 'completed' : 'pending',
        draftStatus: session.draftContent ? 'completed' : 'pending',
        imageStatus: 'not_requested',
        cardNewsStatus: 'not_requested',
        seoPlan: session.seoPlan,
        draftContent: session.draftContent,
        outputFormat: (session.outputFormat as any) || 'naver_paste',
      }]);
    } else {
      setBatchItems([]);
    }

    if (session.styleProfile) {
      setStyleProfile(session.styleProfile);
    }

    setIsHistoryModalOpen(false);
    setLastAutoSavedAt(new Date());
    setAutoSaveStatus('saved');
    onShowToast(`✓ '${session.title || session.keyword}' 작업 내역을 불러왔습니다.`);

    setTimeout(() => {
      isRestoringRef.current = false;
    }, 1000);
  };

  // Discard draft and start clean
  const handleDiscardDraft = async () => {
    if (recoveredSession) {
      await deleteDraftSession(recoveredSession.id, currentUser?.id || currentUser?.naverId, {
        isAdmin,
        isChallengeParticipant: true,
      });
    }
    setRecoveredSession(null);
    setIsBannerDismissed(true);
    setDraftSessionId(generateDraftSessionId());
    setDraftSessionStatus('drafting');
    onShowToast('🗑️ 이전 임시저장이 삭제되고 새로 시작합니다.');
  };

  // Explicit new draft
  const handleStartNewDraft = () => {
    if (batchItems.length > 0 && !confirm('새로운 작업을 시작하시겠습니까? (현재 화면의 작업 내용이 초기화됩니다)')) {
      return;
    }
    setDraftSessionId(generateDraftSessionId());
    setDraftSessionStatus('drafting');
    setKeywords(['']);
    setWritingContext(INITIAL_WRITING_CONTEXT);
    setAiAnalysis(null);
    setUserHasManuallyChangedStyle(false);
    setIsStyleSelectorOpen(false);
    setBatchItems([]);
    setAutoSaveStatus('idle');
    setLastAutoSavedAt(null);
    onShowToast('✨ 새로운 작업 공간이 준비되었습니다.');
  };

  const toggleShowRawHtml = (itemId: string) => {
    setShowRawHtmlItemIds((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const toggleExpandedSeoPlan = (itemId: string) => {
    setExpandedSeoPlanItemIds((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  // ==========================================
  // [독립 Job 파이프라인 엔진] - 키워드별 완전 격리 실행
  // ==========================================

  // 1단계: 단일 Job SEO 기획안 및 추천 제목 생성 (1회 호출)
  const executeSingleJobSeoPlan = async (item: AiBatchItem): Promise<AiBatchItem> => {
    const itemStyle = item.writingStyle || 'experience';
    const itemExpType = item.experienceType || 'restaurant';
    const activeExperienceText = item.userExperience || buildActiveUserExperience(itemStyle, writingContext, itemExpType);

    const seoRes = await fetch('/api/gemini/toolkit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'golden_keyword',
        promptInput: item.keyword,
        writingStyle: itemStyle,
        experienceType: itemExpType,
        groundingData: extractedLinkData
          ? {
              ...extractedLinkData,
              userNotes: manualGroundingData.userNotes || extractedLinkData.userNotes,
            }
          : manualGroundingData.title.trim()
          ? {
              sourceUrl: linkUrlInput.trim() || undefined,
              title: manualGroundingData.title.trim(),
              brand: manualGroundingData.brand.trim() || undefined,
              price: manualGroundingData.price.trim() || undefined,
              address: manualGroundingData.address.trim() || undefined,
              description: manualGroundingData.description.trim() || undefined,
              userNotes: manualGroundingData.userNotes.trim() || undefined,
            }
          : undefined,
        targetAudience: aiAnalysis?.targetAudience || writingContext.info?.targetAudience || writingContext.experience?.recommendedFor,
        intentSummary: aiAnalysis?.searchIntentSummary,
        userExperience: activeExperienceText,
        targetName: writingContext.experience?.target || writingContext.comparison?.targetA,
        relatedKeywords: item.relatedKeywords || item.seoPlan?.relatedKeywordsList,
        topPosts: item.topPosts || item.seoPlan?.topPosts,
        userId: currentUser?.id || currentUser?.naverId,
        userEmail: currentUser?.email,
        userName: currentUser?.name,
        isAdmin,
        isChallengeParticipant: true,
      }),
    });

    const parsedSeoRes = await safeParseApiResponse(seoRes, 'SEO 기획안 생성 중 오류 발생');
    if (!parsedSeoRes.ok) {
      throw new Error(parsedSeoRes.error || 'SEO 기획안 생성 중 오류 발생');
    }
    const seoData = parsedSeoRes.data;
    const parsedPlan = parseGoldenKeywordResult(seoData?.result || seoData || parsedSeoRes.rawText, item.keyword);

    if (seoData?.debugInfo) {
      console.log('[SEO Plan Debug Info]:', seoData.debugInfo);
    }

    if (seoData?.topPosts && !parsedPlan.topPosts) {
      parsedPlan.topPosts = seoData.topPosts;
    }
    if (seoData?.relatedKeywords && !parsedPlan.relatedKeywordsList) {
      parsedPlan.relatedKeywordsList = seoData.relatedKeywords;
    }
    if (seoData?.benchmarkPrompt && !parsedPlan.rawBenchmarkPrompt) {
      parsedPlan.rawBenchmarkPrompt = seoData.benchmarkPrompt;
    }
    if (!parsedPlan.benchmarkReceivedAt && (parsedPlan.topPosts || parsedPlan.relatedKeywordsList)) {
      parsedPlan.benchmarkReceivedAt = new Date().toLocaleTimeString('ko-KR');
    }

    const isRecKeyword = /추천|가볼만한곳|맛집|코스|선물|명소|핫플/i.test(item.keyword);
    const hasUserExp = !!(item.userExperience?.trim());
    // Deduplicate & normalize title candidates
    const deduplicatedCandidates = deduplicateTitleCandidates(
      parsedPlan.titleCandidates || parsedPlan.recommendedTitles,
      { hasUserExperience: hasUserExp, isRecommendationKeyword: isRecKeyword }
    );
    parsedPlan.titleCandidates = deduplicatedCandidates;

    const defaultTitle = deduplicatedCandidates[0]?.title ||
      cleanAndNormalizeTitle(parsedPlan.recommendedOutline?.h1 || parsedPlan.mainKeyword || item.keyword);

    // Normalize initial outline sections
    const initialSections = normalizeOutlineSections(
      parsedPlan.recommendedOutline?.sections || parsedPlan.recommendedOutline?.h2 || []
    );

    return {
      ...item,
      seoPlanStatus: 'completed',
      outlineStatus: initialSections.length > 0 ? 'completed' : 'pending',
      seoPlan: parsedPlan,
      selectedTitle: defaultTitle,
      outlineSections: initialSections,
      isOutlineConfirmed: false,
      topPosts: parsedPlan.topPosts,
      relatedKeywords: parsedPlan.relatedKeywordsList,
      benchmarkPrompt: parsedPlan.rawBenchmarkPrompt,
      errorMessage: undefined,
    };
  };

  // 2단계: 단일 Job 최종 초안 생성 (1회 호출 - 경량화 전송으로 속도 극대화)
  const executeSingleJobDraft = async (item: AiBatchItem): Promise<AiBatchItem> => {
    const itemStyle = item.writingStyle || 'experience';
    const itemExpType = item.experienceType || 'restaurant';
    const activeExperienceText = item.userExperience || buildActiveUserExperience(itemStyle, writingContext, itemExpType);
    const mappedDraftType = mapStyleKeyToDraftType(itemStyle);

    const firstCandidate = Array.isArray(item.seoPlan?.titleCandidates) && item.seoPlan.titleCandidates.length > 0
      ? (typeof item.seoPlan.titleCandidates[0] === 'string' ? item.seoPlan.titleCandidates[0] : item.seoPlan.titleCandidates[0].title)
      : undefined;

    const titleToUse = item.selectedTitle ||
      item.seoPlan?.recommendedOutline?.h1 ||
      firstCandidate ||
      `${item.keyword} 가이드`;

    const sectionsToUse = item.outlineSections && item.outlineSections.length > 0
      ? item.outlineSections
      : (item.seoPlan?.recommendedOutline?.sections ||
         (item.seoPlan?.recommendedOutline?.h2 || []).map((h, i) => ({
           id: `sec_${i + 1}`,
           heading: h,
           keyPoints: [],
           intent: 'information',
         })));

    const draftRes = await fetch('/api/gemini/toolkit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'draft',
        promptInput: item.keyword,
        selectedTitle: titleToUse,
        outlineSections: sectionsToUse,
        draftType: mappedDraftType,
        writingStyle: itemStyle,
        userExperience: activeExperienceText,
        targetLength: `${targetWordCount}자 내외`,
        outputFormat: outputFormat === 'naver_paste' ? 'plain' : 'html',
        imageGuide: true,
        groundingData: extractedLinkData
          ? {
              ...extractedLinkData,
              userNotes: manualGroundingData.userNotes || extractedLinkData.userNotes,
            }
          : manualGroundingData.title.trim()
          ? {
              sourceUrl: linkUrlInput.trim() || undefined,
              title: manualGroundingData.title.trim(),
              brand: manualGroundingData.brand.trim() || undefined,
              price: manualGroundingData.price.trim() || undefined,
              address: manualGroundingData.address.trim() || undefined,
              description: manualGroundingData.description.trim() || undefined,
              userNotes: manualGroundingData.userNotes.trim() || undefined,
            }
          : undefined,
        // 경량화: 초안 작성에 꼭 필요한 필드만 전송 (중복 JSON 및 거대한 스니펫 제거)
        contentBoundary: item.seoPlan?.contentBoundary || aiAnalysis?.contentBoundary,
        seoPlan: {
          targetAudience: item.seoPlan?.searchIntent?.targetAudience,
          intentSummary: item.seoPlan?.searchIntent?.userGoal,
          coreTopic: (item.seoPlan as any)?.coreTopic,
          keyEmphasisPoints: (item.seoPlan as any)?.keyEmphasisPoints,
          contentBoundary: item.seoPlan?.contentBoundary || aiAnalysis?.contentBoundary,
          recommendedOutline: {
            h1: titleToUse,
            h2: sectionsToUse.map((s) => s.heading),
            sections: sectionsToUse,
          },
        },
        styleProfile: styleProfile || undefined,
        model: bodyAiModel,
        userId: currentUser?.id || currentUser?.naverId,
        userEmail: currentUser?.email,
        userName: currentUser?.name,
        isAdmin,
        isChallengeParticipant: true,
      }),
    });

    const parsedDraftRes = await safeParseApiResponse(draftRes, 'AI 초안 생성 중 오류가 발생했습니다.');
    if (!parsedDraftRes.ok) {
      throw new Error(parsedDraftRes.error || 'AI 초안 생성 중 오류가 발생했습니다.');
    }

    let generatedDraft = '';
    let draftTokenUsage: { promptTokens: number; completionTokens: number } | undefined = undefined;
    if (parsedDraftRes.data && typeof parsedDraftRes.data === 'object' && (parsedDraftRes.data.result || parsedDraftRes.data.draftHtml)) {
      generatedDraft = parsedDraftRes.data.result || parsedDraftRes.data.draftHtml || '';
      if (parsedDraftRes.data.tokenUsage) {
        draftTokenUsage = parsedDraftRes.data.tokenUsage;
      }
    } else {
      generatedDraft = parsedDraftRes.rawText || '';
    }
    const currentDraftContent = cleanDraftOutput(generatedDraft);

    const itemCost = calculateAiCost({
      imageMode: 'user_photo',
      createCardNews: false,
      actualPromptTokens: draftTokenUsage?.promptTokens,
      actualCompletionTokens: draftTokenUsage?.completionTokens,
    });

    return {
      ...item,
      draftStatus: 'completed',
      draftContent: currentDraftContent,
      costBreakdown: itemCost,
      errorMessage: undefined,
    };
  };

  // 단일 Job 전체 파이프라인 실행 (기획안 -> 제목/소제목 확정 -> 초안 생성)
  const executeSingleJobFullPipeline = async (item: AiBatchItem): Promise<AiBatchItem> => {
    let currentItem = { ...item };

    // 1단계: 기획안 생성 (필요 시)
    if (currentItem.seoPlanStatus !== 'completed') {
      currentItem.seoPlanStatus = 'processing';
      currentItem.currentPipelineStageText = 'SEO 기획안 및 추천 제목 분석 중...';
      setBatchItems((prev) => prev.map((b) => (b.id === currentItem.id ? currentItem : b)));

      currentItem = await executeSingleJobSeoPlan(currentItem);
      setBatchItems((prev) => prev.map((b) => (b.id === currentItem.id ? currentItem : b)));
    }

    // 2단계 & 3단계: 제목 및 소제목 확정
    if (!currentItem.selectedTitle && currentItem.seoPlan?.titleCandidates && currentItem.seoPlan.titleCandidates.length > 0) {
      const topCand = currentItem.seoPlan.titleCandidates[0];
      currentItem.selectedTitle = typeof topCand === 'string' ? topCand : topCand.title;
    }
    if (!currentItem.outlineSections || currentItem.outlineSections.length === 0) {
      if (currentItem.seoPlan?.recommendedOutline) {
        const rec = currentItem.seoPlan.recommendedOutline;
        currentItem.outlineSections = rec.sections || (rec.h2 || []).map((h, i) => ({
          id: `sec_${i + 1}`,
          heading: h,
          keyPoints: [],
          intent: 'information',
        }));
        currentItem.outlineStatus = 'completed';
      }
    }

    // 4단계: 최종 초안 생성
    currentItem.draftStatus = 'processing';
    currentItem.currentPipelineStageText = '본문 초안 작성 중...';
    setBatchItems((prev) => prev.map((b) => (b.id === currentItem.id ? currentItem : b)));

    currentItem = await executeSingleJobDraft(currentItem);
    currentItem.currentPipelineStageText = '초안 완성';
    return currentItem;
  };

  // 병렬 큐 실행기 (Concurrency = 2 워커 풀)
  const runConcurrentQueue = async (
    itemsToRun: AiBatchItem[],
    isFullPipeline: boolean,
    concurrency = 2
  ) => {
    stopQueueRef.current = false;
    setIsQueueRunning(true);

    let nextIndex = 0;
    const totalJobs = itemsToRun.length;

    const worker = async (workerId: number) => {
      while (nextIndex < totalJobs && !stopQueueRef.current) {
        const jobIndex = nextIndex++;
        const targetItem = itemsToRun[jobIndex];
        if (!targetItem) continue;

        setCurrentQueueIndex(jobIndex);
        setCurrentPipelineStageText(
          isFullPipeline
            ? `[${jobIndex + 1}/${totalJobs}] '${targetItem.keyword}' 전체 파이프라인 자동 생성 중...`
            : `[${jobIndex + 1}/${totalJobs}] '${targetItem.keyword}' SEO 기획안 생성 중...`
        );

        try {
          let updatedItem: AiBatchItem;
          if (isFullPipeline) {
            updatedItem = await executeSingleJobFullPipeline(targetItem);
          } else {
            setBatchItems((prev) =>
              prev.map((b) => (b.id === targetItem.id ? { ...b, seoPlanStatus: 'processing', errorMessage: undefined } : b))
            );
            updatedItem = await executeSingleJobSeoPlan(targetItem);
          }

          setBatchItems((prev) =>
            prev.map((b) => (b.id === targetItem.id ? updatedItem : b))
          );
        } catch (err: any) {
          let errMsg = err?.message || '생성 중 오류가 발생했습니다.';
          if (errMsg.includes('<!doctype') || errMsg.includes('<html') || errMsg.includes('Unexpected token')) {
            errMsg = 'AI 서버 연결 또는 일시적인 응답 처리 오류가 발생했습니다. 잠시 후 재시도해 주세요.';
          }

          setBatchItems((prev) =>
            prev.map((b) =>
              b.id === targetItem.id
                ? {
                    ...b,
                    seoPlanStatus: b.seoPlanStatus === 'processing' ? 'failed' : b.seoPlanStatus,
                    draftStatus: b.draftStatus === 'processing' ? 'failed' : b.draftStatus,
                    errorMessage: errMsg,
                    currentPipelineStageText: '⚠️ 오류 발생',
                  }
                : b
            )
          );
        }
      }
    };

    const workerCount = Math.min(concurrency, totalJobs);
    const workers = Array.from({ length: workerCount }, (_, i) => worker(i));
    await Promise.all(workers);

    setIsQueueRunning(false);
    setCurrentPipelineStageText(
      stopQueueRef.current ? '일괄 생성이 사용자에 의해 중단되었습니다.' : '전체 작업 완료'
    );
  };

  // STEP 1-ONLY: 관리자/사용자 SEO 기획안만 일괄 생성
  const handleRunSeoPlanOnly = async () => {
    if (!currentUser) {
      onShowLoginModal();
      return;
    }

    const cleanKeywords = keywords.map((k) => k.trim()).filter(Boolean);
    if (cleanKeywords.length === 0) {
      alert('최소 1개 이상의 키워드를 입력해 주세요.');
      return;
    }

    if (!isAdmin && cleanKeywords.length > limits.maxBatchSize) {
      alert(`일반 회원은 한 번에 1개의 키워드만 생성 가능합니다.`);
      return;
    }

    const initialItems: AiBatchItem[] = cleanKeywords.map((kw, idx) => {
      const assignedStyle = getKeywordStyle(idx, kw);
      const assignedExpType = getKeywordExperienceType(idx, kw);
      return {
        id: `batch_${Date.now()}_${idx}`,
        keyword: kw,
        writingStyle: assignedStyle,
        experienceType: assignedExpType,
        userExperience: buildActiveUserExperience(assignedStyle, writingContext, assignedExpType),
        seoPlanStatus: 'pending',
        outlineStatus: 'pending',
        draftStatus: 'pending',
        imageStatus: 'not_requested',
        cardNewsStatus: 'not_requested',
        outputFormat,
      };
    });

    setBatchItems(initialItems);
    await runConcurrentQueue(initialItems, false, 2);
    onShowToast(`✓ ${initialItems.length}개 키워드의 SEO 기획안 생성이 완료되었습니다.`);
  };

  // FULL PIPELINE: 관리자 일괄 생성 (기획안 + 제목 + 소제목 + 초안 연속 자동 생성)
  const handleRunFullPipeline = async () => {
    if (!currentUser) {
      onShowLoginModal();
      return;
    }

    const cleanKeywords = keywords.map((k) => k.trim()).filter(Boolean);
    if (cleanKeywords.length === 0) {
      alert('최소 1개 이상의 키워드를 입력해 주세요.');
      return;
    }

    const initialItems: AiBatchItem[] = cleanKeywords.map((kw, idx) => {
      const assignedStyle = getKeywordStyle(idx, kw);
      const assignedExpType = getKeywordExperienceType(idx, kw);
      return {
        id: `batch_${Date.now()}_${idx}`,
        keyword: kw,
        writingStyle: assignedStyle,
        experienceType: assignedExpType,
        userExperience: buildActiveUserExperience(assignedStyle, writingContext, assignedExpType),
        seoPlanStatus: 'pending',
        outlineStatus: 'pending',
        draftStatus: 'pending',
        imageStatus: 'not_requested',
        cardNewsStatus: 'not_requested',
        outputFormat,
      };
    });

    setBatchItems(initialItems);
    await runConcurrentQueue(initialItems, true, 2);
    onShowToast(`🎉 ${initialItems.length}개 키워드의 블로그 전체 초안 생성이 완료되었습니다!`);
  };

  // 일괄 생성 중단 핸들러
  const handleStopQueue = () => {
    stopQueueRef.current = true;
    setIsQueueRunning(false);
    onShowToast('⏹️ 일괄 생성이 중단되었습니다.');
  };

  // 실패 항목 전체 재시도 핸들러
  const handleRetryAllFailed = async () => {
    const failedItems = batchItems.filter((b) => b.seoPlanStatus === 'failed' || b.draftStatus === 'failed');
    if (failedItems.length === 0) {
      onShowToast('재시도할 실패 항목이 없습니다.');
      return;
    }
    await runConcurrentQueue(failedItems, true, 2);
  };

  // STEP 2: 사용자 제목 선택 & 수정 핸들러
  const handleSelectTitle = (itemId: string, newTitle: string) => {
    const cleaned = cleanAndNormalizeTitle(newTitle);
    setBatchItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              selectedTitle: cleaned,
              isOutlineConfirmed: false,
              seoPlan: item.seoPlan
                ? {
                    ...item.seoPlan,
                    recommendedOutline: {
                      ...item.seoPlan.recommendedOutline,
                      h1: cleaned,
                      h2: item.seoPlan.recommendedOutline?.h2 || [],
                    },
                  }
                : undefined,
            }
          : item
      )
    );
    onShowToast(`✓ 대표 제목이 '${cleaned}'(으)로 선택되었습니다.`);
  };

  // STEP 3: 선택 제목 기반 H2 소제목 생성 핸들러
  const handleGenerateOutline = async (itemId: string) => {
    const targetItem = batchItems.find((b) => b.id === itemId);
    if (!targetItem || !currentUser) return;

    const titleToUse = targetItem.selectedTitle ||
      targetItem.seoPlan?.recommendedOutline?.h1 ||
      (Array.isArray(targetItem.seoPlan?.titleCandidates) && targetItem.seoPlan.titleCandidates[0]?.title) ||
      `${targetItem.keyword} 가이드`;

    setBatchItems((prev) =>
      prev.map((b) =>
        b.id === itemId
          ? {
              ...b,
              outlineStatus: 'processing',
              errorMessage: undefined,
            }
          : b
      )
    );

    const itemStyle = targetItem.writingStyle || selectedStyleKey;
    const activeExperienceText = targetItem.userExperience || buildActiveUserExperience(itemStyle, writingContext, targetItem.experienceType || activeExperienceType);

    try {
      const res = await fetch('/api/gemini/toolkit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'generate_outline',
          selectedTitle: titleToUse,
          mainKeyword: targetItem.keyword,
          writingStyle: itemStyle,
          targetAudience: targetItem.seoPlan?.searchIntent?.targetAudience || aiAnalysis?.targetAudience || writingContext.info?.targetAudience,
          intentSummary: targetItem.seoPlan?.searchIntent?.userGoal || aiAnalysis?.searchIntentSummary,
          contentBoundary: targetItem.seoPlan?.contentBoundary || aiAnalysis?.contentBoundary,
          userExperience: activeExperienceText,
          relatedKeywords: targetItem.relatedKeywords || targetItem.seoPlan?.relatedKeywordsList,
          topPosts: targetItem.topPosts || targetItem.seoPlan?.topPosts,
          userId: currentUser?.id || currentUser?.naverId,
          userEmail: currentUser?.email,
          userName: currentUser?.name,
          isAdmin,
          isChallengeParticipant: true,
        }),
      });

      const parsedRes = await safeParseApiResponse(res, '소제목 생성 중 오류 발생');
      if (!parsedRes.ok) {
        throw new Error(parsedRes.error || '소제목 생성 중 오류 발생');
      }

      const rawOutlineData = parsedRes.data?.outline || parsedRes.data?.result?.outline || parsedRes.data?.result || parsedRes.data;
      const normalizedSections = normalizeOutlineSections(rawOutlineData);

      const updatedBatch = batchItems.map((b) =>
        b.id === itemId
          ? {
              ...b,
              outlineStatus: 'completed' as const,
              outlineSections: normalizedSections,
              isOutlineConfirmed: false,
              seoPlan: b.seoPlan
                ? {
                    ...b.seoPlan,
                    recommendedOutline: {
                      ...b.seoPlan.recommendedOutline,
                      h1: titleToUse,
                      h2: normalizedSections.map((s) => s.heading),
                      sections: normalizedSections,
                    },
                  }
                : undefined,
            }
          : b
      );

      setBatchItems(updatedBatch);
      saveCurrentDraft({
        batchItems: updatedBatch,
        lastStep: 'seo_plan',
      });
      onShowToast(`✓ 선택한 제목에 최적화된 H2 소제목 ${normalizedSections.length}개가 생성되었습니다.`);
    } catch (err: any) {
      let errMsg = err?.message || '소제목 생성 실패';
      if (errMsg.includes('<!doctype') || errMsg.includes('<html') || errMsg.includes('Unexpected token')) {
        errMsg = 'AI 서버 연결 또는 응답 처리 중 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
      }
      setBatchItems((prev) =>
        prev.map((b) =>
          b.id === itemId
            ? {
                ...b,
                outlineStatus: 'failed',
                errorMessage: errMsg,
              }
            : b
        )
      );
    }
  };

  // STEP 4: 소제목 순서 변경 / 수정 / 추가 / 삭제 핸들러
  const handleUpdateOutlineSections = (itemId: string, sections: OutlineSection[]) => {
    setBatchItems((prev) =>
      prev.map((b) =>
        b.id === itemId
          ? {
              ...b,
              outlineSections: sections,
              seoPlan: b.seoPlan
                ? {
                    ...b.seoPlan,
                    recommendedOutline: {
                      ...b.seoPlan.recommendedOutline,
                      h1: b.selectedTitle || b.seoPlan.recommendedOutline?.h1 || '',
                      h2: sections.map((s) => s.heading),
                      sections,
                    },
                  }
                : undefined,
            }
          : b
      )
    );
  };

  // STEP 4: 소제목 확정 핸들러
  const handleConfirmOutline = (itemId: string) => {
    const targetItem = batchItems.find((b) => b.id === itemId);
    if (!targetItem) return;

    const sections = targetItem.outlineSections || [];
    if (sections.length === 0) {
      alert('최소 1개 이상의 소제목이 필요합니다.');
      return;
    }

    setBatchItems((prev) =>
      prev.map((b) =>
        b.id === itemId
          ? {
              ...b,
              isOutlineConfirmed: true,
              outlineStatus: 'completed',
              seoPlan: b.seoPlan
                ? {
                    ...b.seoPlan,
                    recommendedOutline: {
                      ...b.seoPlan.recommendedOutline,
                      h1: b.selectedTitle || b.seoPlan.recommendedOutline?.h1 || '',
                      h2: sections.map((s) => s.heading),
                      sections,
                    },
                  }
                : undefined,
            }
          : b
      )
    );

    saveCurrentDraft({
      batchItems,
      lastStep: 'seo_plan',
    });

    onShowToast('✓ 소제목 구성이 확정되었습니다! 아래 [최종 초안 생성]을 진행하세요.');
  };

  // STEP 5: 확정된 제목 & 소제목 기반 최종 블로그 초안 생성 (단일 아이템)
  const handleGenerateFinalDraft = async (itemId: string) => {
    const targetItem = batchItems.find((b) => b.id === itemId);
    if (!targetItem || !currentUser) return;

    const dailyLimit = limits.dailyTextGenerationLimit || 10;
    if (!isAdmin && limits.textGenerationCount >= dailyLimit) {
      alert(`일반 회원은 AI 글 생성을 1일 최대 ${dailyLimit}회까지만 이용하실 수 있습니다. (오늘 사용량: ${limits.textGenerationCount}/${dailyLimit}회)\n매일 자정에 사용량이 자동 초기화됩니다.`);
      return;
    }

    setBatchItems((prev) =>
      prev.map((b) =>
        b.id === itemId
          ? {
              ...b,
              draftStatus: 'processing',
              errorMessage: undefined,
            }
          : b
      )
    );

    try {
      const updatedItem = await executeSingleJobDraft(targetItem);
      const updatedBatch = batchItems.map((b) => (b.id === itemId ? updatedItem : b));

      setBatchItems(updatedBatch);
      saveCurrentDraft({
        batchItems: updatedBatch,
        draftContent: updatedItem.draftContent,
        lastStep: 'draft_text',
      });

      setLimits((prev) => ({
        ...prev,
        textGenerationCount: prev.textGenerationCount + 1,
      }));

      onShowToast(`🎉 '${updatedItem.selectedTitle || targetItem.keyword}' AI 블로그 초안 생성이 완료되었습니다!`);
    } catch (err: any) {
      let errMsg = err?.message || '초안 생성 실패';
      if (errMsg.includes('<!doctype') || errMsg.includes('<html') || errMsg.includes('Unexpected token')) {
        errMsg = 'AI 서버 연결 또는 응답 처리 중 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
      }
      setBatchItems((prev) =>
        prev.map((b) =>
          b.id === itemId
            ? {
                ...b,
                draftStatus: 'failed',
                errorMessage: errMsg,
              }
            : b
        )
      );
    }
  };

  // 단일 아이템 실패 단계별 재시도 핸들러
  const handleRetrySingleItem = async (itemId: string) => {
    const targetItem = batchItems.find((b) => b.id === itemId);
    if (!targetItem) return;

    try {
      if (targetItem.seoPlanStatus !== 'completed') {
        setBatchItems((prev) =>
          prev.map((b) => (b.id === itemId ? { ...b, seoPlanStatus: 'processing', errorMessage: undefined } : b))
        );
        const updated = await executeSingleJobSeoPlan(targetItem);
        setBatchItems((prev) => prev.map((b) => (b.id === itemId ? updated : b)));
        onShowToast(`✓ '${targetItem.keyword}' SEO 기획안이 다시 생성되었습니다.`);
      } else if (targetItem.draftStatus === 'failed' || targetItem.draftStatus === 'pending') {
        await handleGenerateFinalDraft(itemId);
      }
    } catch (err: any) {
      setBatchItems((prev) =>
        prev.map((b) =>
          b.id === itemId
            ? {
                ...b,
                errorMessage: err?.message || '재시도 실패',
              }
            : b
        )
      );
    }
  };

  const updateContextField = (category: keyof WritingContextData, field: string, value: string) => {
    setWritingContext((prev) => ({
      ...prev,
      [category]: {
        ...(prev[category] as any),
        [field]: value,
      },
    }));
  };

  const handleAddKeywordField = () => {
    if (keywords.length >= limits.maxBatchSize) {
      onShowToast(`⚠️ 현재 권한에서는 한 번에 최대 ${limits.maxBatchSize}개 키워드까지 생성할 수 있습니다.`);
      return;
    }
    const newIdx = keywords.length;
    setKeywords((prev) => [...prev, '']);
    setKeywordStyles((prev) => ({ ...prev, [newIdx]: 'experience' }));
    setKeywordExperienceTypes((prev) => ({ ...prev, [newIdx]: 'restaurant' }));
  };

  const handleKeywordChange = (index: number, val: string) => {
    setKeywords((prev) => {
      const next = [...prev];
      next[index] = val;
      return next;
    });

    // Automatically detect and preset style if not explicitly set by user
    if (val.trim()) {
      const instant = classifyKeywordInstant(val.trim());
      if (instant) {
        setKeywordStyles((prev) => {
          if (!prev[index]) {
            return { ...prev, [index]: instant.writingStyle || 'experience' };
          }
          return prev;
        });
        if (instant.experienceType) {
          setKeywordExperienceTypes((prev) => {
            if (!prev[index]) {
              return { ...prev, [index]: instant.experienceType || 'restaurant' };
            }
            return prev;
          });
        }
      }
    }
  };

  const handleRemoveKeywordField = (index: number) => {
    if (keywords.length <= 1) return;
    setKeywords((prev) => prev.filter((_, i) => i !== index));
    setKeywordStyles((prev) => {
      const updated: Record<number, SeoWritingStyleKey> = {};
      const keys = Object.keys(prev).map(Number).sort((a, b) => a - b);
      let newIdx = 0;
      for (const k of keys) {
        if (k !== index) {
          updated[newIdx] = prev[k];
          newIdx++;
        }
      }
      return updated;
    });
    setKeywordExperienceTypes((prev) => {
      const updated: Record<number, string> = {};
      const keys = Object.keys(prev).map(Number).sort((a, b) => a - b);
      let newIdx = 0;
      for (const k of keys) {
        if (k !== index) {
          updated[newIdx] = prev[k];
          newIdx++;
        }
      }
      return updated;
    });
  };

  const handleApplyBulkKeywords = () => {
    if (!bulkInputText.trim()) return;

    const parsed = bulkInputText
      .split(/[\n,;]+/)
      .map((k) => k.trim())
      .filter(Boolean);

    if (parsed.length === 0) return;

    const maxAllowed = limits.maxBatchSize;
    const truncated = parsed.slice(0, maxAllowed);

    // Auto classify each keyword's writing style
    const initialStyles: Record<number, SeoWritingStyleKey> = {};
    const initialExpTypes: Record<number, string> = {};
    truncated.forEach((kw, idx) => {
      const instant = classifyKeywordInstant(kw);
      initialStyles[idx] = instant.writingStyle || 'experience';
      if (instant.experienceType) {
        initialExpTypes[idx] = instant.experienceType;
      }
    });

    setKeywords(truncated);
    setKeywordStyles(initialStyles);
    setKeywordExperienceTypes(initialExpTypes);
    setIsBulkPasteOpen(false);
    setBulkInputText('');
    onShowToast(`📋 ${truncated.length}개 키워드가 개별 추천 글 스타일과 함께 일괄 적용되었습니다. (최대 ${maxAllowed}개)`);
  };

  const handleCopyText = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    onShowToast(`📋 ${label}가 클립보드에 복사되었습니다!`);
  };

  const handleCopyFormattedBody = async (htmlContent: string, item?: AiBatchItem) => {
    const rawHtml = htmlContent || item?.draftContent || '';
    if (!rawHtml.trim()) {
      onShowToast('⚠️ 복사할 본문 내용이 없습니다.');
      return;
    }

    try {
      // Format into clean Naver Blog SmartEditor friendly HTML with User Style Applied
      const naverHtml = prepareNaverBlogHtml(rawHtml, userBlogStyle);
      const plainText = preparePlainTextFromHtml(naverHtml);

      const blobHtml = new Blob([naverHtml], { type: 'text/html' });
      const blobText = new Blob([plainText], { type: 'text/plain' });
      const data = [new ClipboardItem({ 'text/html': blobHtml, 'text/plain': blobText })];
      await navigator.clipboard.write(data);
      onShowToast('📋 서식 포함 본문이 클립보드에 복사되었습니다! 네이버 블로그에 Ctrl+V로 붙여넣으세요.');
    } catch (err) {
      console.warn('ClipboardItem copy failed, attempting DOM fallback:', err);
      try {
        const naverHtml = prepareNaverBlogHtml(rawHtml, userBlogStyle);
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.left = '-9999px';
        container.style.top = '-9999px';
        container.style.opacity = '0';
        container.innerHTML = naverHtml;
        document.body.appendChild(container);

        const range = document.createRange();
        range.selectNodeContents(container);
        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(range);
          document.execCommand('copy');
          selection.removeAllRanges();
        }
        document.body.removeChild(container);
        onShowToast('📋 서식 포함 본문이 복사되었습니다! 네이버 블로그에 Ctrl+V로 붙여넣으세요.');
      } catch (e) {
        navigator.clipboard.writeText(rawHtml.replace(/<[^>]+>/g, ''));
        onShowToast('📋 본문 텍스트가 클립보드에 복사되었습니다.');
      }
    }
  };

  const handleCopyRawHtml = (htmlContent: string) => {
    if (!htmlContent) return;
    navigator.clipboard.writeText(htmlContent);
    onShowToast('📋 HTML 소스 코드가 클립보드에 복사되었습니다!');
  };

  const handleInsertImageIntoDraft = (itemId: string, imageHtml: string) => {
    setBatchItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const prevContent = item.draftContent || '';
          const newContent = prevContent.trim()
            ? `${prevContent}\n\n${imageHtml}`
            : imageHtml;
          return {
            ...item,
            draftContent: newContent,
          };
        }
        return item;
      })
    );
    onShowToast('🖼️ 이미지가 블로그 본문에 성공적으로 추가되었습니다!');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* AI Draft Session Recovery Banner */}
      {recoveredSession && !isBannerDismissed && (
        <DraftRecoveryBanner
          session={recoveredSession}
          onRestore={handleRestoreDraft}
          onDiscard={handleDiscardDraft}
          onDismiss={() => setIsBannerDismissed(true)}
        />
      )}

      {/* Auto-Save & Workspace Status Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200/90 rounded-2xl px-5 py-3 text-xs text-slate-700 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-bold text-slate-800">자동 임시저장</span>
          </div>

          <span className="text-slate-300">|</span>

          <div className="flex items-center gap-1.5 text-slate-600">
            {autoSaveStatus === 'saving' && (
              <span className="text-emerald-600 font-medium flex items-center gap-1">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>저장 중...</span>
              </span>
            )}
            {autoSaveStatus === 'saved' && (
              <span className="text-slate-600 font-medium flex items-center gap-1">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  {lastAutoSavedAt
                    ? `${lastAutoSavedAt.toLocaleTimeString()} 자동 저장됨`
                    : '안전하게 저장됨'}
                </span>
                {draftSessionStatus === 'saved' && (
                  <span className="ml-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                    보관함 영구저장
                  </span>
                )}
              </span>
            )}
            {autoSaveStatus === 'error' && (
              <span className="text-rose-600 font-medium flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>임시저장 실패 (재시도 중)</span>
              </span>
            )}
            {autoSaveStatus === 'idle' && (
              <span className="text-slate-500">
                {lastAutoSavedAt
                  ? `마지막 저장: ${lastAutoSavedAt.toLocaleTimeString()}`
                  : '작업 내용이 실시간 자동 저장됩니다 (7일 보관)'}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsStyleSettingsModalOpen(true)}
            className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
            title="나눔고딕 15pt, 소제목 인용구 2, 정렬 등 블로그 출력 서식을 맞춤 설정합니다."
          >
            <Palette className="w-3.5 h-3.5 text-emerald-600" />
            <span>블로그 서식 설정</span>
            <span className="text-[10px] font-normal px-1.5 py-0.5 bg-white text-emerald-800 rounded-md border border-emerald-200">
              {userBlogStyle.fontFamily === 'nanum_gothic' ? '나눔고딕' : userBlogStyle.fontFamily === 'malgun_gothic' ? '맑은고딕' : '커스텀'} {userBlogStyle.fontSize}
            </span>
          </button>

          <button
            type="button"
            onClick={() => saveCurrentDraft({}, { isExplicit: true })}
            disabled={autoSaveStatus === 'saving'}
            className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors border border-slate-200"
            title="현재 작성 중인 키워드, 가이드, 초안을 즉시 임시저장합니다."
          >
            <Save className="w-3.5 h-3.5 text-slate-600" />
            <span>수동 임시저장</span>
          </button>

          <button
            type="button"
            onClick={() => saveCurrentDraft({}, { isExplicit: true, markSaved: true })}
            className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
            title="현재 작업을 완료 보관함에 영구 저장합니다. (7일 자동 만료 해제)"
          >
            <BookmarkCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>보관함 영구저장</span>
          </button>

          <button
            type="button"
            onClick={() => setIsHistoryModalOpen(true)}
            className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
            title="저장된 임시저장 내역 및 보관함 목록을 엽니다."
          >
            <History className="w-3.5 h-3.5 text-indigo-600" />
            <span>저장 내역 불러오기</span>
          </button>

          <button
            type="button"
            onClick={handleStartNewDraft}
            className="px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-700 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors border border-slate-200"
            title="현재 작업을 비우고 새로운 초안 생성을 시작합니다."
          >
            <Plus className="w-3.5 h-3.5" />
            <span>새 작업</span>
          </button>
        </div>
      </div>

      <DraftHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        onRestore={handleRestoreDraftFromHistory}
        currentUser={currentUser}
        isAdmin={isAdmin}
        onShowToast={onShowToast}
      />

      <div className="bg-white border border-gray-100 rounded-3xl p-6 sm:p-8 text-slate-900 shadow-[0_2px_12px_rgba(0,0,0,0.03)] relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2.5">
              <span>AI 블로그 초안 생성기</span>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 text-xs font-bold shrink-0">
                스마트 에디터 연동
              </span>
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              주제 키워드 입력부터 검색 의도 분석, SEO 기획안 수립, 맞춤형 AI 블로그 본문 초안 작성을 원클릭으로 완성하세요.
            </p>

            {/* 2단계 간편 이용 가이드 */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-slate-50/80 border border-slate-100 rounded-2xl p-3 text-xs text-slate-600">
              <div className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-extrabold text-[11px] shrink-0">1</span>
                <div>
                  <span className="font-extrabold text-slate-900">키워드 & 글 스타일 설정</span>
                  <p className="text-[11px] text-slate-500">주제 키워드와 원하시는 글 유형 및 문체를 선택합니다.</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-extrabold text-[11px] shrink-0">2</span>
                <div>
                  <span className="font-extrabold text-slate-900">AI 초안 원클릭 생성</span>
                  <p className="text-[11px] text-slate-500">SEO 기획안과 스마트에디터 최적화 본문 초안이 즉시 작성됩니다.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-4 bg-slate-50/80 p-3.5 sm:p-4 rounded-2xl border border-slate-100 shrink-0">
            <div className="text-center px-3 sm:px-4">
              <div className="text-xs text-slate-500 flex items-center gap-1 justify-center font-medium">
                <span>오늘 AI 초안 생성</span>
              </div>
              <div className="text-base sm:text-lg font-extrabold text-blue-600 mt-0.5">
                {isAdmin ? `무제한 (${limits.textGenerationCount}회 완료)` : `${limits.textGenerationCount} / ${limits.dailyTextGenerationLimit || 10}회 (1일)`}
              </div>
            </div>

            <button
              onClick={handleResetUsage}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/80 rounded-xl transition-colors border border-slate-200 cursor-pointer"
              title="사용량 기록 초기화"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-gray-100 rounded-3xl p-6 text-slate-900 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-700 text-xs flex items-center justify-center font-extrabold border border-blue-100">
                  1
                </span>
                <span>키워드 입력</span>
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">
                  {isAdmin ? `운영자 다중 모드 (${keywords.length}/${limits.maxBatchSize}개)` : '단일 키워드 모드'}
                </span>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setIsBulkPasteOpen(!isBulkPasteOpen)}
                    className="px-2 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Layers className="w-3 h-3" />
                    <span>일괄 붙여넣기</span>
                  </button>
                )}
              </div>
            </div>

            {isAdmin && isBulkPasteOpen && (
              <div className="bg-slate-50 border border-blue-200 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-700 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    운영자 다중 키워드 일괄 붙여넣기 (최대 10개)
                  </span>
                  <span className="text-[10px] text-slate-500">줄바꿈 또는 쉼표(,) 구분</span>
                </div>
                <textarea
                  rows={3}
                  value={bulkInputText}
                  onChange={(e) => setBulkInputText(e.target.value)}
                  placeholder="제주도 여행 코스&#10;성수동 맛집 추천&#10;스마트스토어 시작 가이드&#10;..."
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsBulkPasteOpen(false)}
                    className="px-2.5 py-1 rounded-lg text-slate-500 hover:text-slate-800 text-xs cursor-pointer"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyBulkKeywords}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                  >
                    키워드 적용
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {keywords.map((kw, idx) => {
                const currentItemStyle = getKeywordStyle(idx, kw);
                const currentItemExpType = getKeywordExperienceType(idx, kw);

                return (
                  <div
                    key={idx}
                    className={`rounded-2xl p-3 space-y-2 border transition-all ${
                      isAdmin && keywords.length > 1
                        ? 'bg-slate-50/90 border-slate-200'
                        : 'bg-transparent border-transparent p-0'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isAdmin && keywords.length > 1 && (
                        <span className="w-6 h-6 rounded-lg bg-blue-600 text-white font-extrabold text-xs flex items-center justify-center shrink-0">
                          #{idx + 1}
                        </span>
                      )}
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={kw}
                          onChange={(e) => handleKeywordChange(idx, e.target.value)}
                          placeholder={idx === 0 ? "예: 제주도 3박4일 여행코스 추천" : `추가 키워드 #${idx + 1}`}
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors"
                        />
                      </div>
                      {isAdmin && keywords.length > 1 && (
                        <button
                          onClick={() => handleRemoveKeywordField(idx)}
                          className="p-2.5 rounded-xl bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors border border-slate-200 cursor-pointer shrink-0"
                          title="키워드 삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Admin Multi-Mode: Per-Keyword Independent Style Selection */}
                    {isAdmin && keywords.length > 1 && (
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/60 text-xs">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-bold text-slate-500">글 스타일:</span>
                          <select
                            value={currentItemStyle}
                            onChange={(e) => setKeywordStyle(idx, e.target.value as SeoWritingStyleKey)}
                            className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-600 cursor-pointer shadow-2xs"
                          >
                            <option value="experience">1. 경험 리뷰형</option>
                            <option value="info">2. 정보 탐색형</option>
                            <option value="purchase">3. 구매 추천형</option>
                            <option value="comparison">4. 비교 분석형</option>
                            <option value="homepan">5. 홈판 화제형</option>
                          </select>

                          {currentItemStyle === 'experience' && (
                            <select
                              value={currentItemExpType}
                              onChange={(e) => setKeywordExperienceType(idx, e.target.value)}
                              className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-700 focus:outline-none focus:border-blue-600 cursor-pointer shadow-2xs"
                            >
                              <option value="restaurant">맛집</option>
                              <option value="cafe">카페</option>
                              <option value="travel">여행/코스</option>
                              <option value="accommodation">숙소/호텔</option>
                              <option value="product">제품/상품</option>
                              <option value="service">서비스/일반</option>
                            </select>
                          )}
                        </div>

                        <span className="text-[11px] text-blue-600 font-medium bg-blue-50/80 px-2 py-0.5 rounded-md border border-blue-100/60">
                          독립 Job
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}

              {isAdmin && keywords.length < limits.maxBatchSize && (
                <button
                  onClick={handleAddKeywordField}
                  className="w-full py-2.5 rounded-xl border border-dashed border-blue-300 hover:border-blue-500 text-blue-700 hover:bg-blue-50 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>운영자 키워드 추가 ({keywords.length}/{limits.maxBatchSize}개)</span>
                </button>
              )}
            </div>
          </div>

          {/* NEW: Grounding Data - Link Paste & Structured Data Card */}
          <div className="bg-white border border-gray-100 rounded-3xl p-6 text-slate-900 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-700 text-xs flex items-center justify-center font-extrabold border border-emerald-100">
                  <ExternalLink className="w-3.5 h-3.5" />
                </span>
                <span>상품 / 장소 링크 붙여넣기 (선택)</span>
              </h3>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                <span>사실 기반 그라운딩</span>
              </span>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              작성할 상품(스마트스토어, 쿠팡 등)이나 장소(네이버 플레이스, 카카오맵 등)의 웹 링크를 붙여넣으시면, 
              가격·위치·핵심 스펙을 자동 추출하여 글 작성 시 실제 사실 데이터로 반영합니다.
            </p>

            {/* URL Input & Extract Button */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="url"
                  value={linkUrlInput}
                  onChange={(e) => {
                    setLinkUrlInput(e.target.value);
                    if (linkExtractionError) setLinkExtractionError(null);
                  }}
                  placeholder="https://smartstore.naver.com/... 또는 https://map.naver.com/..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-4 pr-3 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-colors font-medium"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleExtractLink();
                    }
                  }}
                />
              </div>

              <button
                type="button"
                onClick={handleExtractLink}
                disabled={isExtractingLink || !linkUrlInput.trim()}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs flex items-center gap-1.5 shrink-0"
              >
                {isExtractingLink ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>추출 중...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>정보 추출</span>
                  </>
                )}
              </button>
            </div>

            {/* Extraction Error Notice with Manual Form Fallback */}
            {linkExtractionError && (
              <div className="bg-amber-50/90 border border-amber-200/90 rounded-2xl p-4 space-y-3 animate-in fade-in">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-xs font-black text-amber-900">
                      {linkExtractionError}
                    </p>
                    <p className="text-[11px] text-amber-700 leading-relaxed">
                      웹사이트 보안 정책이나 비공개 링크로 인해 자동 수집이 차단된 경우, 아래 수동 입력 폼에 상품명/장소명과 가격, 특징을 입력해주시면 AI가 동일하게 사실 기반으로 글을 완성합니다.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Extracted Data Card (Success) */}
            {extractedLinkData && (
              <div className="bg-emerald-50/50 border border-emerald-200/80 rounded-2xl p-4 space-y-3.5 animate-in fade-in">
                <div className="flex items-center justify-between border-b border-emerald-100 pb-2.5">
                  <span className="text-xs font-extrabold text-emerald-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>추출된 실제 근거 데이터</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleClearLinkData}
                    className="text-[11px] font-bold text-slate-400 hover:text-rose-600 transition-colors flex items-center gap-0.5 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>제거</span>
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row gap-3.5">
                  {extractedLinkData.imageUrl && (
                    <div className="w-full sm:w-24 h-24 rounded-xl overflow-hidden bg-slate-200 shrink-0 border border-emerald-200/60">
                      <img
                        src={extractedLinkData.imageUrl}
                        alt={extractedLinkData.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <div className="flex-1 space-y-1.5 text-xs">
                    <h4 className="font-black text-slate-900 line-clamp-2">
                      {extractedLinkData.title}
                    </h4>

                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      {extractedLinkData.siteName && (
                        <span className="px-2 py-0.5 rounded-md bg-white border border-emerald-200 text-emerald-800 font-bold">
                          {extractedLinkData.siteName}
                        </span>
                      )}
                      {extractedLinkData.price && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-black">
                          {extractedLinkData.price}
                        </span>
                      )}
                      {extractedLinkData.brand && (
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold">
                          {extractedLinkData.brand}
                        </span>
                      )}
                    </div>

                    {extractedLinkData.address && (
                      <p className="text-[11px] text-slate-600 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span className="truncate">{extractedLinkData.address}</span>
                      </p>
                    )}

                    {extractedLinkData.description && (
                      <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                        {extractedLinkData.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Additional user note input */}
                <div>
                  <label className="block text-[11px] font-bold text-emerald-950 mb-1">
                    추가 체감 포인트 / 강조 메모 (선택)
                  </label>
                  <input
                    type="text"
                    placeholder="예: 3일간 써보니 소음이 전혀 없었음, 사장님이 친절하고 주차 2시간 무료"
                    value={manualGroundingData.userNotes}
                    onChange={(e) =>
                      setManualGroundingData({ ...manualGroundingData, userNotes: e.target.value })
                    }
                    className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>
            )}

            {/* Manual Form (When requested or extraction failed) */}
            {(showManualGroundingForm || (!extractedLinkData && !linkExtractionError)) && (
              <div className="space-y-3 pt-1">
                {!showManualGroundingForm && !extractedLinkData && (
                  <button
                    type="button"
                    onClick={() => setShowManualGroundingForm(true)}
                    className="text-xs font-bold text-slate-500 hover:text-emerald-700 flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>링크 없이 상품/장소 정보 직접 입력하기</span>
                  </button>
                )}

                {showManualGroundingForm && (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 animate-in fade-in">
                    <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                      <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                        <Edit3 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>상품 / 장소 핵심 정보 직접 입력</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowManualGroundingForm(false)}
                        className="text-[11px] text-slate-400 hover:text-slate-700"
                      >
                        닫기
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          상품명 / 장소명 <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="예: 다이슨 에어랩 코안다, 성수 어니언 카페"
                          value={manualGroundingData.title}
                          onChange={(e) =>
                            setManualGroundingData({ ...manualGroundingData, title: e.target.value })
                          }
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-emerald-600"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          가격 / 비용 (선택)
                        </label>
                        <input
                          type="text"
                          placeholder="예: 599,000원, 아메리카노 5,500원"
                          value={manualGroundingData.price}
                          onChange={(e) =>
                            setManualGroundingData({ ...manualGroundingData, price: e.target.value })
                          }
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-emerald-600"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          위치 / 주소 / 방문지 (선택)
                        </label>
                        <input
                          type="text"
                          placeholder="예: 서울 성동구 아차산로9길 8 (성수역 2번 출구)"
                          value={manualGroundingData.address}
                          onChange={(e) =>
                            setManualGroundingData({ ...manualGroundingData, address: e.target.value })
                          }
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-emerald-600"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          브랜드 / 상호 (선택)
                        </label>
                        <input
                          type="text"
                          placeholder="예: 다이슨, 카페 어니언"
                          value={manualGroundingData.brand}
                          onChange={(e) =>
                            setManualGroundingData({ ...manualGroundingData, brand: e.target.value })
                          }
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-emerald-600"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        핵심 특징 / 솔직 체감 메모 (선택)
                      </label>
                      <textarea
                        rows={2}
                        placeholder="예: 바람이 부드럽고 컬이 오래 유지됨. 다만 무게감이 있어 처음엔 손목 적응 필요."
                        value={manualGroundingData.description || manualGroundingData.userNotes}
                        onChange={(e) =>
                          setManualGroundingData({
                            ...manualGroundingData,
                            description: e.target.value,
                            userNotes: e.target.value,
                          })
                        }
                        className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 outline-none focus:border-emerald-600 resize-y"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-100 rounded-3xl p-6 text-slate-900 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-700 text-xs flex items-center justify-center font-extrabold border border-blue-100">
                  2
                </span>
                <span>AI 콘텐츠 분석 및 맞춤 정보</span>
              </h3>
              {keywords[0]?.trim() && (
                <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>스타일 자동 감지됨</span>
                </span>
              )}
            </div>

            {/* AI Recommendation & Intent Analysis Banner */}
            {keywords[0]?.trim() ? (
              <div className="bg-slate-50/80 border border-slate-100 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                      {isAnalyzingKeyword ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-xs text-slate-900">맞춤 콘텐츠 분석</span>
                        {isAnalyzingKeyword ? (
                          <span className="text-[10px] text-blue-600 animate-pulse font-semibold">키워드 분석 중...</span>
                        ) : (
                          <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full font-bold">분석 완료</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        입력하신 키워드 <span className="font-extrabold text-slate-900">"{keywords[0].trim()}"</span>의 검색 의도에 맞게 최적의 스타일을 추천했습니다.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {userHasManuallyChangedStyle && aiAnalysis && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStyleKey(aiAnalysis.writingStyle);
                          if (aiAnalysis.experienceType) {
                            setActiveExperienceType(aiAnalysis.experienceType);
                          }
                          setUserHasManuallyChangedStyle(false);
                          setIsStyleSelectorOpen(false);
                          onShowToast(`🔄 AI 추천 스타일(${STYLE_KEY_TO_LABEL[aiAnalysis.writingStyle] || '추천'})로 되돌렸습니다.`);
                        }}
                        className="text-[11px] font-bold text-blue-700 hover:text-blue-900 bg-white hover:bg-blue-50 px-2.5 py-1.5 rounded-xl border border-blue-200 shadow-2xs transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3 text-blue-600" />
                        <span>AI 추천으로 복귀</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsStyleSelectorOpen(!isStyleSelectorOpen)}
                      className={`text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                        isStyleSelectorOpen
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 border-slate-200'
                      }`}
                    >
                      <SlidersHorizontal className="w-3 h-3 text-slate-500" />
                      <span>{isStyleSelectorOpen ? '스타일 닫기' : '스타일 직접 변경'}</span>
                    </button>
                  </div>
                </div>

                {/* Analysis Breakdown Badges */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  <div className="bg-white border border-slate-100 rounded-xl p-2.5">
                    <span className="text-[10px] font-semibold text-slate-400 block mb-0.5">추천 글 작성 스타일</span>
                    <div className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span className="truncate">{STYLE_KEY_TO_LABEL[selectedStyleKey] || '1. 경험 리뷰형'}</span>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-100 rounded-xl p-2.5">
                    <span className="text-[10px] font-semibold text-slate-400 block mb-0.5">자동 감지 검색 의도</span>
                    <div className="font-extrabold text-xs text-slate-900 truncate">
                      {aiAnalysis?.searchIntent || '방문/이용 전 실제 솔직 경험 탐색'}
                    </div>
                  </div>

                  <div className="bg-white border border-slate-100 rounded-xl p-2.5">
                    <span className="text-[10px] font-semibold text-slate-400 block mb-0.5">콘텐츠 분류 유형</span>
                    <div className="font-extrabold text-xs text-slate-900 truncate">
                      {aiAnalysis?.contentType || '경험 리뷰'}
                      {aiAnalysis?.experienceType && EXPERIENCE_TYPE_LABELS[aiAnalysis.experienceType] && (
                        <span className="ml-1.5 text-[10px] font-normal text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-md border border-blue-100">
                          {EXPERIENCE_TYPE_LABELS[aiAnalysis.experienceType]}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {aiAnalysis?.reasoning && (
                  <div className="text-[11px] text-slate-600 bg-white border border-slate-100 rounded-xl px-3 py-1.5 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>{aiAnalysis.reasoning}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-slate-50/80 border border-dashed border-slate-200 rounded-2xl p-4 text-center">
                <p className="text-xs text-slate-500 flex items-center justify-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>메인 키워드를 입력하시면 AI가 검색 의도와 최적의 작성 스타일을 자동 추천합니다.</span>
                </p>
              </div>
            )}

            {/* Manual Style Selection Grid (Expandable) */}
            {isStyleSelectorOpen && (
              <div className="space-y-2 p-4 bg-slate-50/80 border border-slate-200/80 rounded-2xl animate-fadeIn">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
                    <span>글 작성 스타일 직접 선택 (5가지)</span>
                  </label>
                  <span className="text-[10px] text-slate-500 font-medium">원하는 스타일을 클릭하시면 입력 폼이 즉시 변경됩니다</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                  {[
                    { id: 'experience', label: '1. 경험 리뷰형', desc: '장소·상품·서비스 솔직 후기', icon: Star },
                    { id: 'info', label: '2. 정보 탐색형', desc: '개념 및 절차 핵심 가이드', icon: BookOpen },
                    { id: 'purchase', label: '3. 구매 추천형', desc: '비교 및 구매 전환 유도', icon: ShoppingBag },
                    { id: 'comparison', label: '4. 비교 분석형', desc: '1:1 스펙 & 대안 분석', icon: Layers },
                    { id: 'homepan', label: '5. 홈판 화제형', desc: '트렌드·스토리·공감', icon: Sparkles },
                  ].map((st) => {
                    const IconComp = st.icon;
                    const isSelected =
                      selectedStyleKey === st.id ||
                      (st.id === 'experience' && (selectedStyleKey === 'travel' || selectedStyleKey === 'review')) ||
                      (st.id === 'homepan' && selectedStyleKey === 'story');
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => {
                          setSelectedStyleKey(st.id as SeoWritingStyleKey);
                          setUserHasManuallyChangedStyle(true);
                          onShowToast(`✓ '${st.label}' 스타일로 변경되었습니다.`);
                        }}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative ${
                          isSelected
                            ? 'bg-blue-50/90 border-blue-600 text-blue-950 shadow-2xs ring-1 ring-blue-600/30'
                            : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`p-1 rounded-lg ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                            <IconComp className="w-3.5 h-3.5" />
                          </span>
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                        </div>
                        <div className="font-extrabold text-xs text-slate-900">{st.label}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{st.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Dynamic Form per Writing Style */}
            <div className="bg-slate-50/80 border border-slate-100 rounded-2xl p-4 space-y-3.5 transition-all">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                  {(selectedStyleKey === 'experience' || selectedStyleKey === 'travel' || selectedStyleKey === 'review') && '1. 경험 리뷰형 맞춤 정보 입력 (선택)'}
                  {selectedStyleKey === 'info' && '2. 정보 탐색형 맞춤 정보 입력 (선택)'}
                  {selectedStyleKey === 'purchase' && '3. 구매 추천형 맞춤 정보 입력 (선택)'}
                  {selectedStyleKey === 'comparison' && '4. 비교 분석형 맞춤 정보 입력 (선택)'}
                  {(selectedStyleKey === 'homepan' || selectedStyleKey === 'story') && '5. 홈판 화제형 맞춤 정보 입력 (선택)'}
                </span>
                <button
                  type="button"
                  onClick={() => setIsContextFormOpen(!isContextFormOpen)}
                  className="text-[11px] font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer bg-white px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 transition-all"
                >
                  <span>{isContextFormOpen ? '접기' : '펼치기'}</span>
                  {isContextFormOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              {isContextFormOpen && (
                <div className="space-y-3.5 animate-fadeIn">
                  {/* STYLE 1: EXPERIENCE / REVIEW */}
                  {(selectedStyleKey === 'experience' || selectedStyleKey === 'travel' || selectedStyleKey === 'review') && (
                    <div className="space-y-3">
                      {/* Subtype quick toggle selector */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-bold text-slate-600 mr-1">분야 선택:</span>
                        {[
                          { key: 'restaurant', label: '맛집', icon: Utensils },
                          { key: 'cafe', label: '카페·디저트', icon: Coffee },
                          { key: 'travel', label: '여행·코스', icon: Compass },
                          { key: 'accommodation', label: '숙소·호텔', icon: Hotel },
                          { key: 'product', label: '제품·상품', icon: Package },
                          { key: 'service', label: '서비스·일반', icon: Star },
                        ].map((sub) => {
                          const IconComp = sub.icon;
                          const isActive = activeExperienceType === sub.key;
                          return (
                            <button
                              key={sub.key}
                              type="button"
                              onClick={() => {
                                setActiveExperienceType(sub.key);
                                updateContextField('experience', 'category', sub.label);
                              }}
                              className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border flex items-center gap-1 transition-all cursor-pointer ${
                                isActive
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs font-extrabold'
                                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                              }`}
                            >
                              <IconComp className="w-3 h-3" />
                              <span>{sub.label}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Specialized fields depending on experience subtype */}
                      {(activeExperienceType === 'restaurant' || activeExperienceType === 'cafe') ? (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <label className="text-[11px] font-semibold text-slate-700">방문 계기 및 동행자</label>
                              <input
                                type="text"
                                value={writingContext.experience?.purpose || ''}
                                onChange={(e) => updateContextField('experience', 'purpose', e.target.value)}
                                placeholder="예: 주말 데이트, 친구 모임, 부모님 생신 식사"
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[11px] font-semibold text-slate-700">상호명 및 위치 / 지역</label>
                              <input
                                type="text"
                                value={writingContext.experience?.target || ''}
                                onChange={(e) => updateContextField('experience', 'target', e.target.value)}
                                placeholder="예: 성수동 카페 어니언, 강남역 땀땀 본점"
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-slate-700">주문 메뉴 및 솔직 맛 후기</label>
                            <textarea
                              rows={2}
                              value={writingContext.experience?.experience || ''}
                              onChange={(e) => updateContextField('experience', 'experience', e.target.value)}
                              placeholder="주문한 대표 메뉴명, 양, 비주얼, 식감, 국물의 진한 정도, 디저트의 달콤함 등 솔직한 맛 느낌"
                              className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <label className="text-[11px] font-semibold text-slate-700">실제로 좋았던 점</label>
                              <input
                                type="text"
                                value={writingContext.experience?.pros || ''}
                                onChange={(e) => updateContextField('experience', 'pros', e.target.value)}
                                placeholder="예: 감성적인 채광 인테리어, 푸짐한 양, 친절한 응대"
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[11px] font-semibold text-slate-700">아쉬웠던 점 (선택)</label>
                              <input
                                type="text"
                                value={writingContext.experience?.cons || ''}
                                onChange={(e) => updateContextField('experience', 'cons', e.target.value)}
                                placeholder="예: 주말 피크타임 웨이팅 30분, 주차 공간 협소"
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <label className="text-[11px] font-semibold text-slate-700">방문 꿀팁 / 주차 / 예약</label>
                              <input
                                type="text"
                                value={writingContext.experience?.tips || ''}
                                onChange={(e) => updateContextField('experience', 'tips', e.target.value)}
                                placeholder="예: 캐치테이블 원격 줄서기 가능, 인근 공영주차장 이용"
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[11px] font-semibold text-slate-700">추천하고 싶은 대상</label>
                              <input
                                type="text"
                                value={writingContext.experience?.recommendedFor || ''}
                                onChange={(e) => updateContextField('experience', 'recommendedFor', e.target.value)}
                                placeholder="예: 조용한 분위기 선호하는 커플, 인생샷 남기고픈 분들"
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                              />
                            </div>
                          </div>
                        </>
                      ) : (activeExperienceType === 'travel' || activeExperienceType === 'accommodation') ? (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <label className="text-[11px] font-semibold text-slate-700">여행/숙박 목적 및 일정</label>
                              <input
                                type="text"
                                value={writingContext.experience?.purpose || ''}
                                onChange={(e) => updateContextField('experience', 'purpose', e.target.value)}
                                placeholder="예: 2박 3일 제주 힐링 여행, 주말 1박 호캉스"
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[11px] font-semibold text-slate-700">장소/숙소 명칭</label>
                              <input
                                type="text"
                                value={writingContext.experience?.target || ''}
                                onChange={(e) => updateContextField('experience', 'target', e.target.value)}
                                placeholder="예: 제주 신라호텔, 강릉 안목해변 및 중앙시장"
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-slate-700">실제 코스 및 이용 경험</label>
                            <textarea
                              rows={2}
                              value={writingContext.experience?.experience || ''}
                              onChange={(e) => updateContextField('experience', 'experience', e.target.value)}
                              placeholder="체크인 후 온수풀 수영 -> 룸서비스 저녁 -> 아침 조식 뷔페 및 오션뷰 산책로 등 실제 동선과 느낌"
                              className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <label className="text-[11px] font-semibold text-slate-700">실제로 좋았던 점</label>
                              <input
                                type="text"
                                value={writingContext.experience?.pros || ''}
                                onChange={(e) => updateContextField('experience', 'pros', e.target.value)}
                                placeholder="예: 탁 트인 오션뷰와 푹신한 침구류, 쾌적한 부대시설"
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[11px] font-semibold text-slate-700">아쉬웠던 점 (선택)</label>
                              <input
                                type="text"
                                value={writingContext.experience?.cons || ''}
                                onChange={(e) => updateContextField('experience', 'cons', e.target.value)}
                                placeholder="예: 성수기 가격 부담, 부대시설 조기 마감"
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <label className="text-[11px] font-semibold text-slate-700">여행 꿀팁 / 준비물</label>
                              <input
                                type="text"
                                value={writingContext.experience?.tips || ''}
                                onChange={(e) => updateContextField('experience', 'tips', e.target.value)}
                                placeholder="예: 셔틀버스 시간표 미리 확인, 수영복과 방수팩 필수"
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[11px] font-semibold text-slate-700">추천 대상</label>
                              <input
                                type="text"
                                value={writingContext.experience?.recommendedFor || ''}
                                onChange={(e) => updateContextField('experience', 'recommendedFor', e.target.value)}
                                placeholder="예: 부모님 동반 가족 여행객, 휴식이 필요한 직장인"
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                              />
                            </div>
                          </div>
                        </>
                      ) : activeExperienceType === 'product' ? (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <label className="text-[11px] font-semibold text-slate-700">구매 계기 및 사용 기간</label>
                              <input
                                type="text"
                                value={writingContext.experience?.purpose || ''}
                                onChange={(e) => updateContextField('experience', 'purpose', e.target.value)}
                                placeholder="예: 기존 제품 고장으로 교체, 실사용 1개월차"
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[11px] font-semibold text-slate-700">제품명 및 브랜드</label>
                              <input
                                type="text"
                                value={writingContext.experience?.target || ''}
                                onChange={(e) => updateContextField('experience', 'target', e.target.value)}
                                placeholder="예: 다이슨 V12 무선청소기"
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-slate-700">실사용 솔직 후기 (성능, 편의성)</label>
                            <textarea
                              rows={2}
                              value={writingContext.experience?.experience || ''}
                              onChange={(e) => updateContextField('experience', 'experience', e.target.value)}
                              placeholder="가벼운 무게감, 버튼식 스위치의 편리함, 흡입력 세기 및 먼지통 비우기 간편함 등 실체감"
                              className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <label className="text-[11px] font-semibold text-slate-700">실제로 좋았던 점</label>
                              <input
                                type="text"
                                value={writingContext.experience?.pros || ''}
                                onChange={(e) => updateContextField('experience', 'pros', e.target.value)}
                                placeholder="예: 손목 부담 없는 무게와 레이저 불빛 먼지 탐지"
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[11px] font-semibold text-slate-700">아쉬웠던 점 (선택)</label>
                              <input
                                type="text"
                                value={writingContext.experience?.cons || ''}
                                onChange={(e) => updateContextField('experience', 'cons', e.target.value)}
                                placeholder="예: 배터리 연속 사용 시간 약 35분, 높은 정가"
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <label className="text-[11px] font-semibold text-slate-700">활용 꿀팁 / 주의사항</label>
                              <input
                                type="text"
                                value={writingContext.experience?.tips || ''}
                                onChange={(e) => updateContextField('experience', 'tips', e.target.value)}
                                placeholder="예: 필터 물세척 후 24시간 완전 건조 필수"
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[11px] font-semibold text-slate-700">추천 대상</label>
                              <input
                                type="text"
                                value={writingContext.experience?.recommendedFor || ''}
                                onChange={(e) => updateContextField('experience', 'recommendedFor', e.target.value)}
                                placeholder="예: 1~2인 가구 및 손목 관절 약하신 부모님 선물"
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                              />
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <label className="text-[11px] font-semibold text-slate-700">경험 대상 분류</label>
                              <input
                                type="text"
                                value={writingContext.experience?.category || ''}
                                onChange={(e) => updateContextField('experience', 'category', e.target.value)}
                                placeholder="예: 서비스, 원데이 클래스, 헬스장, 미용실 등"
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[11px] font-semibold text-slate-700">대상 명칭 / 브랜드</label>
                              <input
                                type="text"
                                value={writingContext.experience?.target || ''}
                                onChange={(e) => updateContextField('experience', 'target', e.target.value)}
                                placeholder="예: 역삼동 필라테스 본점"
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-slate-700">실제 사용/방문/체험 솔직 경험</label>
                            <textarea
                              rows={2}
                              value={writingContext.experience?.experience || ''}
                              onChange={(e) => updateContextField('experience', 'experience', e.target.value)}
                              placeholder="분위기, 이용 과정, 주요 특징, 실제 경험하며 느낀 솔직한 인상 등"
                              className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <label className="text-[11px] font-semibold text-slate-700">장단점 및 솔직 체감</label>
                              <input
                                type="text"
                                value={writingContext.experience?.prosAndCons || ''}
                                onChange={(e) => updateContextField('experience', 'prosAndCons', e.target.value)}
                                placeholder="예: 뛰어난 맞춤 코칭, 다만 수강권 가격이 다소 있는 편"
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[11px] font-semibold text-slate-700">활용 꿀팁 / 추천 대상</label>
                              <input
                                type="text"
                                value={writingContext.experience?.tipsAndCourse || ''}
                                onChange={(e) => updateContextField('experience', 'tipsAndCourse', e.target.value)}
                                placeholder="예: 첫 체험 할인 혜택 이용 추천, 체형 교정 원하는 분"
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                              />
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* STYLE 2: INFO (정보 탐색형) */}
                  {selectedStyleKey === 'info' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-700">독자가 가장 궁금해할 핵심 질문</label>
                          <input
                            type="text"
                            value={writingContext.info.mainQuestion || ''}
                            onChange={(e) => updateContextField('info', 'mainQuestion', e.target.value)}
                            placeholder="예: 2026 청년 월세 지원금 신청 자격 및 지급일"
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-700">대상 독자 / 타깃</label>
                          <input
                            type="text"
                            value={writingContext.info.targetAudience || ''}
                            onChange={(e) => updateContextField('info', 'targetAudience', e.target.value)}
                            placeholder="예: 만 19~34세 독립 무주택 청년, 자취생"
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-700">필수 단계 / 신청 절차 / 핵심 내용</label>
                        <textarea
                          rows={2}
                          value={writingContext.info.requiredInfo || ''}
                          onChange={(e) => updateContextField('info', 'requiredInfo', e.target.value)}
                          placeholder="예: 복지로 온라인 신청 -> 본인인증 -> 임대차계약서 및 확정일자 서류 첨부 -> 심사 3주 소요 후 매월 25일 입금"
                          className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-700">특별히 주의하거나 강조할 조건</label>
                          <input
                            type="text"
                            value={writingContext.info.conditions || ''}
                            onChange={(e) => updateContextField('info', 'conditions', e.target.value)}
                            placeholder="예: 보증금 5천만원 이하 및 월세 70만원 이하 건물 한정"
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-700">추가 꿀팁 및 FAQ</label>
                          <input
                            type="text"
                            value={writingContext.info.tipsAndFaq || ''}
                            onChange={(e) => updateContextField('info', 'tipsAndFaq', e.target.value)}
                            placeholder="예: 주민센터 방문 신청도 가능, 청년희망적금과 중복 수령 가능 여부"
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* STYLE 3: PURCHASE (구매 추천형) */}
                  {selectedStyleKey === 'purchase' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-700">추천/비교 대상 목록</label>
                          <input
                            type="text"
                            value={writingContext.purchase.targets || ''}
                            onChange={(e) => updateContextField('purchase', 'targets', e.target.value)}
                            placeholder="예: 10만원 이하 가성비 무선 이어폰 베스트 3"
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-700">예산대 및 타깃 사용자</label>
                          <input
                            type="text"
                            value={writingContext.purchase.budget || ''}
                            onChange={(e) => updateContextField('purchase', 'budget', e.target.value)}
                            placeholder="예: 5만원~10만원대, 출퇴근 직장인 & 학생"
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-700">중요하게 보는 선택 기준</label>
                        <input
                          type="text"
                          value={writingContext.purchase.criteria || ''}
                          onChange={(e) => updateContextField('purchase', 'criteria', e.target.value)}
                          placeholder="예: 액티브 노이즈 캔슬링(ANC) 차음 성능, 착용감, 통화 음질"
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-700">핵심 추천 이유 및 실사용 강점</label>
                        <textarea
                          rows={2}
                          value={writingContext.purchase.strengths || ''}
                          onChange={(e) => updateContextField('purchase', 'strengths', e.target.value)}
                          placeholder="예: 동급 최강의 저음역대 차음 성능, 전용 앱을 통한 EQ 커스텀 지원, 무선 충전 케이스"
                          className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-700">사용 환경 및 조건</label>
                          <input
                            type="text"
                            value={writingContext.purchase.usageEnv || ''}
                            onChange={(e) => updateContextField('purchase', 'usageEnv', e.target.value)}
                            placeholder="예: 지하철 통근, 헬스장 운동 시 땀 방지"
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-700">구매 시 주의사항 / CTA 방향</label>
                          <input
                            type="text"
                            value={writingContext.purchase.ctaDirection || ''}
                            onChange={(e) => updateContextField('purchase', 'ctaDirection', e.target.value)}
                            placeholder="예: 공식 수입 정품 인증 마크 확인 필수, 할인 프로모션 링크"
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* STYLE 4: COMPARISON (비교 분석형) */}
                  {selectedStyleKey === 'comparison' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-700">비교 대상 A</label>
                          <input
                            type="text"
                            value={writingContext.comparison.targetA || ''}
                            onChange={(e) => updateContextField('comparison', 'targetA', e.target.value)}
                            placeholder="예: 아이폰 17 프로"
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-700">비교 대상 B</label>
                          <input
                            type="text"
                            value={writingContext.comparison.targetB || ''}
                            onChange={(e) => updateContextField('comparison', 'targetB', e.target.value)}
                            placeholder="예: 갤럭시 S26 울트라"
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-700">비교 계기 및 사용 목적</label>
                          <input
                            type="text"
                            value={writingContext.comparison.reason || ''}
                            onChange={(e) => updateContextField('comparison', 'reason', e.target.value)}
                            placeholder="예: 2년 약정 만료 후 교체 고민, 사진 촬영 및 업무용"
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-700">중요하게 보는 비교 기준</label>
                          <input
                            type="text"
                            value={writingContext.comparison.criteria || ''}
                            onChange={(e) => updateContextField('comparison', 'criteria', e.target.value)}
                            placeholder="예: 카메라 화질, 배터리 지속시간, 휴대성, 출고가"
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-700">A의 세부 특징 및 체감</label>
                          <textarea
                            rows={2}
                            value={writingContext.comparison.informationA || ''}
                            onChange={(e) => updateContextField('comparison', 'informationA', e.target.value)}
                            placeholder="예: 동영상 색감과 손떨방 우수, iOS 생태계 연동 매끄러움"
                            className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-700">B의 세부 특징 및 체감</label>
                          <textarea
                            rows={2}
                            value={writingContext.comparison.informationB || ''}
                            onChange={(e) => updateContextField('comparison', 'informationB', e.target.value)}
                            placeholder="예: 100배 줌 카메라, 통화녹음 및 삼성페이의 독보적 편의성"
                            className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-700">개인적 총평 / 추천 선택 기준</label>
                        <input
                          type="text"
                          value={writingContext.comparison.personalVerdict || ''}
                          onChange={(e) => updateContextField('comparison', 'personalVerdict', e.target.value)}
                          placeholder="예: 영상 크리에이터는 A, 일상 실용성과 통화 편의는 B 추천"
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  )}

                  {/* STYLE 5: HOMEPAN / STORY (홈판 화제형) */}
                  {(selectedStyleKey === 'homepan' || selectedStyleKey === 'story') && (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-700">글을 쓰게 된 상황 / 고민 / 화제성 이슈</label>
                        <input
                          type="text"
                          value={writingContext.homepan?.situation || writingContext.story?.situation || ''}
                          onChange={(e) => {
                            updateContextField('homepan', 'situation', e.target.value);
                            updateContextField('story', 'situation', e.target.value);
                          }}
                          placeholder="예: 30대 직장인의 주 4일 근무 실험과 라이프스타일 변화"
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-700">실제 겪은 생생한 사건 / 전개 에피소드</label>
                        <textarea
                          rows={2}
                          value={writingContext.homepan?.experience || writingContext.story?.experience || ''}
                          onChange={(e) => {
                            updateContextField('homepan', 'experience', e.target.value);
                            updateContextField('story', 'experience', e.target.value);
                          }}
                          placeholder="예: 초반 1달간 겪은 업무 일정 압박과 이를 해결하기 위해 시도했던 시간 관리 루틴"
                          className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-700">극적인 반전 / 느낀 점 / 해결 결과</label>
                          <input
                            type="text"
                            value={writingContext.homepan?.feelings || writingContext.story?.feelings || ''}
                            onChange={(e) => {
                              updateContextField('homepan', 'feelings', e.target.value);
                              updateContextField('story', 'feelings', e.target.value);
                            }}
                            placeholder="예: 번아웃 극복 후 오히려 개인 프로젝트와 업무 집중도 대폭 상승"
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-700">전달하고 싶은 메시지 / 소통 질문</label>
                          <input
                            type="text"
                            value={writingContext.homepan?.message || writingContext.story?.message || ''}
                            onChange={(e) => {
                              updateContextField('homepan', 'message', e.target.value);
                              updateContextField('story', 'message', e.target.value);
                            }}
                            placeholder="예: 일과 삶의 균형이 주는 긍정적 변화, 여러분의 생각은?"
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Personalized Blog Writing Style Analyzer */}
          <BlogStyleAnalyzer
            styleProfile={styleProfile}
            onStyleProfileChange={setStyleProfile}
            onShowToast={onShowToast}
            currentUser={currentUser}
            isAdmin={isAdmin}
          />

          <div className="bg-white border border-gray-100 rounded-3xl p-5 text-slate-900 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4">
            <button
              type="button"
              onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
              className="w-full flex items-center justify-between text-xs font-extrabold text-slate-800 hover:text-slate-900 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-blue-600" />
                <span>고급 설정 (목표 글자 수 / AI 모델)</span>
              </span>
              {isAdvancedOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>

            {isAdvancedOpen && (
              <div className="space-y-4 pt-3 border-t border-slate-100 animate-fadeIn">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">목표 글자 수</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { val: '1000', label: '1,000자' },
                      { val: '1500', label: '1,500자 (권장)' },
                      { val: '2000', label: '2,000자' },
                      { val: '2500', label: '2,500자' },
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => setTargetWordCount(opt.val)}
                        className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          targetWordCount === opt.val
                            ? 'bg-blue-600 text-white border-blue-600 shadow-2xs font-extrabold'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700">본문 AI 모델</label>
                  <select
                    value={bodyAiModel}
                    onChange={(e) => setBodyAiModel(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-600 cursor-pointer"
                  >
                    <option value="gemini-3.7-flash">Gemini 3.7 Flash (추천 · 빠르고 정확함)</option>
                    <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (초경량 · 고속)</option>
                    <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (고품질 · 정밀 추론)</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2.5">
            {isAdmin && keywords.filter((k) => k.trim()).length > 1 ? (
              <div className="space-y-2">
                {/* Admin Multi-Mode Action Buttons */}
                {!isQueueRunning ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleRunFullPipeline}
                      className="py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs sm:text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                    >
                      <Sparkles className="w-4 h-4 text-white" />
                      <span>원클릭 일괄 초안 생성 ({keywords.filter((k) => k.trim()).length}개)</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleRunSeoPlanOnly}
                      className="py-3.5 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs sm:text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                    >
                      <Layers className="w-4 h-4 text-white" />
                      <span>기획안만 일괄 분석</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      type="button"
                      disabled
                      className="w-full py-3.5 rounded-2xl bg-blue-600/90 text-white font-extrabold text-sm shadow-sm transition-all flex items-center justify-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>{currentPipelineStageText} ({currentQueueIndex + 1}/{keywords.filter(Boolean).length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleStopQueue}
                      className="w-full py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                      <span>일괄 생성 중단 (진행 중인 작업까지만 완료)</span>
                    </button>
                  </div>
                )}

                {batchItems.some((b) => b.seoPlanStatus === 'failed' || b.draftStatus === 'failed') && !isQueueRunning && (
                  <button
                    type="button"
                    onClick={handleRetryAllFailed}
                    className="w-full py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <RefreshCw className="w-4 h-4 text-amber-600" />
                    <span>실패한 {batchItems.filter((b) => b.seoPlanStatus === 'failed' || b.draftStatus === 'failed').length}개 키워드 일괄 재시도</span>
                  </button>
                )}

                <p className="text-[11px] text-center text-slate-500 font-medium">
                  각 키워드는 지정된 독립 글 스타일에 맞춰 2개씩 병렬로 안전하게 생성됩니다.
                </p>
              </div>
            ) : (
              /* Single Keyword Mode */
              <>
                <button
                  type="button"
                  onClick={handleRunSeoPlanOnly}
                  disabled={isQueueRunning}
                  className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm sm:text-base shadow-sm disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                >
                  {isQueueRunning ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin text-white" />
                      <span>{currentPipelineStageText}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 text-white" />
                      <span>1단계: SEO 기획안 & 추천 제목 분석 생성</span>
                    </>
                  )}
                </button>
                <p className="text-[11px] text-center text-slate-500 font-medium">
                  키워드를 분석하여 검색의도, 추천 제목 5종, H2 소제목 구조를 1단계로 생성합니다.
                </p>
              </>
            )}
          </div>
        </div>

        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white border border-gray-100 rounded-3xl p-6 text-slate-900 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-6 min-h-[600px] flex flex-col justify-between">
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-700 text-xs flex items-center justify-center font-extrabold border border-blue-100">
                    3
                  </span>
                  <span>단계별 AI 블로그 제작 워크플로우</span>
                </h3>
                <span className="text-xs text-slate-500 font-medium">
                  {batchItems.length}개 키워드 작업 중
                </span>
              </div>

              {/* 사용자 블로그 출력 서식 상태 안내 바 */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50/80 border border-slate-200/80 rounded-2xl text-xs">
                <div className="flex items-center gap-2 text-slate-800">
                  <Palette className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="text-slate-600">
                    적용 중인 출력 서식: <strong className="text-slate-900 font-extrabold">{userBlogStyle.fontFamily === 'nanum_gothic' ? '나눔고딕' : userBlogStyle.fontFamily === 'default_font' ? '기본서체' : userBlogStyle.fontFamily} {userBlogStyle.fontSize} ({userBlogStyle.textAlign === 'center' ? '가운데 정렬' : '좌측 정렬'})</strong> · 소제목: <strong className="text-slate-900 font-extrabold">{getSubheadingStyleLabel(userBlogStyle.h2Style)}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsStyleSettingsModalOpen(true)}
                  className="px-2.5 py-1 rounded-xl bg-white hover:bg-slate-100 text-blue-700 font-bold border border-slate-200 transition-colors text-[11px] cursor-pointer shadow-2xs"
                >
                  서식 변경
                </button>
              </div>

              {isQueueRunning && (
                <div className="bg-blue-50/80 border border-blue-100 rounded-2xl p-4 space-y-2.5 animate-fadeIn">
                  <div className="flex justify-between items-center text-xs text-slate-700">
                    <span className="font-bold text-blue-900 flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                      <span>{currentPipelineStageText}</span>
                    </span>
                    <span className="font-mono font-extrabold text-blue-700">
                      {Math.round(((currentQueueIndex + 1) / batchItems.length) * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-blue-200/60 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-blue-600 h-2 transition-all duration-300 rounded-full"
                      style={{ width: `${((currentQueueIndex + 1) / batchItems.length) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {batchItems.length > 0 ? (
                <div className="space-y-6">
                  {batchItems.map((item, idx) => {
                    const wordCount = item.draftContent ? countWords(item.draftContent) : 0;
                    const isRecKeyword = /추천|가볼만한곳|맛집|코스|선물|명소|핫플/i.test(item.keyword);
                    const hasUserExp = !!(item.userExperience?.trim());
                    const titleCandidates = item.seoPlan
                      ? deduplicateTitleCandidates(item.seoPlan.titleCandidates || item.seoPlan.recommendedTitles, {
                          hasUserExperience: hasUserExp,
                          isRecommendationKeyword: isRecKeyword,
                        })
                      : [];
                    const currentTitle = item.selectedTitle ||
                      item.seoPlan?.recommendedOutline?.h1 ||
                      (titleCandidates.length > 0 ? titleCandidates[0].title : `${item.keyword} 핵심 정보 및 실전 팁`);

                    return (
                      <div
                        key={item.id}
                        className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-5 space-y-5 hover:border-blue-300 transition-all shadow-2xs"
                      >
                        {/* Header with Pipeline Step Indicators */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 pb-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-0.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-100 font-extrabold text-xs">
                              #{idx + 1}
                            </span>
                            <h4 className="font-extrabold text-base text-slate-900">{item.keyword}</h4>
                            <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-extrabold">
                              {item.writingStyle === 'experience'
                                ? '경험 리뷰형'
                                : item.writingStyle === 'info'
                                ? '정보 탐색형'
                                : item.writingStyle === 'purchase'
                                ? '구매 추천형'
                                : item.writingStyle === 'comparison'
                                ? '비교 분석형'
                                : '홈판 화제형'}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                            {item.seoPlanStatus === 'completed' ? (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold flex items-center gap-1">
                                <Check className="w-3 h-3" /> 1. 기획안 완료
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
                                1. 기획안 대기
                              </span>
                            )}

                            {item.selectedTitle ? (
                              <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-bold flex items-center gap-1">
                                <Check className="w-3 h-3" /> 2. 제목 선택됨
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
                                2. 제목 선택 대기
                              </span>
                            )}

                            {item.isOutlineConfirmed ? (
                              <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 font-bold flex items-center gap-1">
                                <Check className="w-3 h-3" /> 3. 소제목 확정
                              </span>
                            ) : item.outlineSections && item.outlineSections.length > 0 ? (
                              <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 font-bold">
                                3. 소제목 검토 중
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
                                3. 소제목 대기
                              </span>
                            )}

                            {item.draftStatus === 'completed' ? (
                              <span className="px-2.5 py-0.5 rounded-md bg-emerald-600 text-white font-extrabold flex items-center gap-1 shadow-2xs">
                                <CheckCircle2 className="w-3 h-3" /> {wordCount}자 초안 완성
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
                                4. 초안 대기
                              </span>
                            )}
                          </div>
                        </div>

                        {item.errorMessage && (
                          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 flex items-center justify-between">
                            <span>⚠️ {item.errorMessage}</span>
                            <button
                              onClick={() => handleRetrySingleItem(item.id)}
                              className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>다시 시도</span>
                            </button>
                          </div>
                        )}

                        {/* STEP 1: SEO 기획안 결과 (Collapsible) */}
                        {item.seoPlan && (
                          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 space-y-3 shadow-2xs">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-md bg-blue-50 text-blue-700 text-xs font-bold flex items-center justify-center border border-blue-200">
                                  1
                                </span>
                                <h5 className="font-extrabold text-sm text-slate-900">
                                  SEO 콘텐츠 기획안 & 키워드 분석
                                </h5>
                              </div>
                              <button
                                type="button"
                                onClick={() => toggleExpandedSeoPlan(item.id)}
                                className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                                  expandedSeoPlanItemIds[item.id]
                                    ? 'bg-blue-600 text-white shadow-2xs'
                                    : 'bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100'
                                }`}
                              >
                                <FileCheck className="w-3.5 h-3.5" />
                                <span>{expandedSeoPlanItemIds[item.id] ? '기획안 접기 ▲' : '기획안 상세 보기 ▼'}</span>
                              </button>
                            </div>

                            {expandedSeoPlanItemIds[item.id] && (
                              <div className="pt-2 border-t border-slate-100">
                                <SEOPlanSummary
                                  seoPlan={item.seoPlan}
                                  onApplyStyle={(styleKey) => {
                                    setSelectedStyleKey(styleKey as SeoWritingStyleKey);
                                    onShowToast(`✓ SEO 기획안의 추천 작성 스타일이 본문 설정에 적용되었습니다.`);
                                  }}
                                  onSelectTitle={(selectedTitle) => handleSelectTitle(item.id, selectedTitle)}
                                />
                              </div>
                            )}
                          </div>
                        )}

                        {/* STEP 2: 추천 제목 5종 선택 & 직접 수정 */}
                        {item.seoPlanStatus === 'completed' && (
                          <div className="bg-white border border-slate-200/90 rounded-2xl p-4.5 space-y-3.5 shadow-2xs">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-md bg-blue-50 text-blue-700 text-xs font-bold flex items-center justify-center border border-blue-200">
                                  2
                                </span>
                                <h5 className="font-extrabold text-sm text-slate-900">
                                  추천 제목 선택 & 직접 수정
                                </h5>
                              </div>
                              <span className="text-[11px] text-slate-500 font-medium">
                                네이버 검색 상위노출 최적화 5종 후보
                              </span>
                            </div>

                            {/* 5 Title Candidates List */}
                            <div className="space-y-2">
                              {titleCandidates.map((cand, candIdx) => {
                                const isSelected = currentTitle === cand.title;
                                return (
                                  <div
                                    key={candIdx}
                                    onClick={() => handleSelectTitle(item.id, cand.title)}
                                    className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-start justify-between gap-3 ${
                                      isSelected
                                        ? 'bg-blue-50/90 border-blue-500 ring-2 ring-blue-400/30 text-blue-950 font-bold shadow-2xs'
                                        : 'bg-slate-50/70 border-slate-200/90 hover:bg-slate-100/90 text-slate-800'
                                    }`}
                                  >
                                    <div className="space-y-1 flex-1">
                                      <div className="flex items-center gap-2">
                                        <span
                                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                            isSelected
                                              ? 'bg-blue-600 text-white'
                                              : 'bg-slate-200 text-slate-700'
                                          }`}
                                        >
                                          후보 {candIdx + 1} · {cand.combinationType || cand.category || '추천 조합'}
                                        </span>
                                        {cand.intent && (
                                          <span className="text-[10px] text-slate-500">
                                            {cand.intent}
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-xs sm:text-sm font-semibold leading-snug">
                                        {cand.title}
                                      </p>
                                    </div>
                                    <div className="pt-1">
                                      <div
                                        className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                                          isSelected
                                            ? 'border-blue-600 bg-blue-600 text-white'
                                            : 'border-slate-300 bg-white'
                                        }`}
                                      >
                                        {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Direct Title Edit Field */}
                            <div className="space-y-1.5 pt-2 border-t border-slate-100">
                              <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                                <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                                <span>선택된 대표 제목 (직접 수정 가능)</span>
                              </label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={item.selectedTitle || currentTitle}
                                  onChange={(e) => handleSelectTitle(item.id, e.target.value)}
                                  placeholder="블로그 포스팅 대표 제목을 입력하세요"
                                  className="flex-1 bg-white border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-bold text-slate-900 placeholder-slate-400 outline-none transition-all"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* STEP 3 & 4: 선택 제목 기반 H2 소제목 생성 & 확정 (OutlineEditor) */}
                        {item.seoPlanStatus === 'completed' && (
                          <div className="bg-white border border-slate-200/90 rounded-2xl p-4.5 space-y-3.5 shadow-2xs">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-md bg-purple-50 text-purple-700 text-xs font-bold flex items-center justify-center border border-purple-200">
                                  3~4
                                </span>
                                <h5 className="font-extrabold text-sm text-slate-900">
                                  H2 소제목 구성 & 확정
                                </h5>
                              </div>
                              {item.isOutlineConfirmed && (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[11px] flex items-center gap-1">
                                  <Check className="w-3 h-3" /> 소제목 확정됨
                                </span>
                              )}
                            </div>

                            {(!item.outlineSections || item.outlineSections.length === 0) && (
                              <div className="bg-purple-50/70 border border-purple-100 rounded-xl p-4 text-center space-y-3">
                                <p className="text-xs text-purple-900 font-medium">
                                  선택하신 제목 <strong>"{currentTitle}"</strong>에 맞추어 최적의 H2 소제목 구조를 생성합니다.
                                </p>
                                <button
                                  type="button"
                                  onClick={() => handleGenerateOutline(item.id)}
                                  disabled={item.outlineStatus === 'processing'}
                                  className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs shadow-sm transition-all flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
                                >
                                  {item.outlineStatus === 'processing' ? (
                                    <>
                                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                      <span>소제목 생성 중...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Layers className="w-3.5 h-3.5" />
                                      <span>선택 제목 기반 H2 소제목 생성</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            )}

                            {item.outlineSections && item.outlineSections.length > 0 && (
                              <OutlineEditor
                                selectedTitle={currentTitle}
                                sections={item.outlineSections}
                                onChangeSections={(sections) => handleUpdateOutlineSections(item.id, sections)}
                                onUpdateSections={(sections) => handleUpdateOutlineSections(item.id, sections)}
                                onConfirmOutline={() => handleConfirmOutline(item.id)}
                                onGenerateOutline={() => handleGenerateOutline(item.id)}
                                isConfirmed={item.isOutlineConfirmed}
                                isGeneratingOutline={item.outlineStatus === 'processing'}
                                onShowToast={onShowToast}
                              />
                            )}
                          </div>
                        )}

                        {/* STEP 5: 최종 AI 블로그 초안 생성 & 서식 렌더링 */}
                        {item.seoPlanStatus === 'completed' && (
                          <div className="bg-white border border-slate-200/90 rounded-2xl p-4.5 space-y-4 shadow-2xs">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-md bg-emerald-50 text-emerald-700 text-xs font-bold flex items-center justify-center border border-emerald-200">
                                  5
                                </span>
                                <h5 className="font-extrabold text-sm text-slate-900">
                                  최종 AI 블로그 초안 생성
                                </h5>
                              </div>
                              {item.draftStatus === 'completed' && (
                                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[11px] flex items-center gap-1">
                                  <Check className="w-3 h-3" /> 초안 완성
                                </span>
                              )}
                            </div>

                            {item.draftStatus !== 'completed' && (
                              <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-4 space-y-3">
                                <div className="text-xs text-emerald-950 space-y-1">
                                  <p className="font-bold flex items-center gap-1.5">
                                    <Sparkles className="w-4 h-4 text-emerald-600" />
                                    <span>확정된 제목 및 소제목으로 블로그 초안을 작성합니다.</span>
                                  </p>
                                  <p className="text-[11px] text-emerald-800">
                                    • 확정 제목: <strong>{currentTitle}</strong>
                                    <br />
                                    • 소제목 수: <strong>{item.outlineSections?.length || 0}개</strong>
                                    {item.isOutlineConfirmed ? ' (사용자 확정 완료 ✓)' : ' (검토 중)'}
                                  </p>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleGenerateFinalDraft(item.id)}
                                  disabled={item.draftStatus === 'processing'}
                                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-all shadow-sm active:scale-[0.99]"
                                >
                                  {item.draftStatus === 'processing' ? (
                                    <>
                                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                                      <span>AI 본문 초안 작성 중... ({bodyAiModel})</span>
                                    </>
                                  ) : (
                                    <>
                                      <Sparkles className="w-4 h-4 text-white" />
                                      <span>확정된 제목 & 소제목으로 최종 초안 생성</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            )}

                            {/* Draft Content Display */}
                            {item.draftContent && (
                              <div className="space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-xs">
                                  <div className="flex flex-wrap items-center gap-3 text-slate-700">
                                    <span className="flex items-center gap-1 font-medium">
                                      <span className="text-slate-400">글자 수:</span>
                                      <strong className="text-blue-700 font-extrabold">
                                        {wordCount.toLocaleString()} / {targetWordCount}자
                                      </strong>
                                    </span>
                                    <span className="flex items-center gap-1 font-medium">
                                      <span className="text-slate-400">예상 AI 원가:</span>
                                      <strong className="text-slate-900 font-extrabold">
                                        ₩{item.costBreakdown ? item.costBreakdown.totalCost : calculateAiCost().totalCost}
                                      </strong>
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleGenerateFinalDraft(item.id)}
                                      disabled={item.draftStatus === 'processing'}
                                      className="text-[11px] font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                                    >
                                      <RotateCcw className="w-3 h-3 text-slate-500" />
                                      <span>본문 다시 생성</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => toggleShowRawHtml(item.id)}
                                      className="text-[11px] font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                                    >
                                      <Code2 className="w-3 h-3 text-slate-500" />
                                      <span>{showRawHtmlItemIds[item.id] ? '렌더링 화면으로 보기' : 'HTML 소스 코드 보기'}</span>
                                    </button>
                                  </div>
                                </div>

                                {showRawHtmlItemIds[item.id] ? (
                                  <div className="bg-slate-900 text-slate-100 p-4 rounded-xl text-[11px] font-mono leading-relaxed max-h-96 overflow-y-auto whitespace-pre-wrap select-all border border-slate-800">
                                    {prepareNaverBlogHtml(item.draftContent, userBlogStyle)}
                                  </div>
                                ) : (
                                  <div className="bg-white p-5 rounded-xl border border-slate-200/90 max-h-96 overflow-y-auto shadow-xs text-slate-950">
                                    <div
                                      className="prose prose-slate max-w-none text-slate-950"
                                      dangerouslySetInnerHTML={{ __html: applyUserBlogStyle(item.draftContent, userBlogStyle) }}
                                    />
                                  </div>
                                )}

                                {/* Copy Actions */}
                                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => handleCopyFormattedBody(item.draftContent || '', item)}
                                      className="py-2 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
                                    >
                                      <Copy className="w-3.5 h-3.5" />
                                      <span>서식 포함 본문 복사</span>
                                    </button>

                                    <button
                                      onClick={() => handleCopyRawHtml(prepareNaverBlogHtml(item.draftContent || '', userBlogStyle))}
                                      className="py-2 px-3.5 rounded-xl bg-white hover:bg-slate-100 text-xs font-bold text-slate-700 border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer"
                                    >
                                      <Code2 className="w-3.5 h-3.5 text-slate-600" />
                                      <span>HTML 복사</span>
                                    </button>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => setIsStyleSettingsModalOpen(true)}
                                    className="text-[11px] text-blue-700 hover:text-blue-900 font-semibold flex items-center gap-1 cursor-pointer"
                                  >
                                    <Palette className="w-3 h-3 text-blue-600" />
                                    <span>서식 맞춤설정 ({userBlogStyle.fontFamily === 'nanum_gothic' ? '나눔고딕' : '커스텀'} {userBlogStyle.fontSize})</span>
                                  </button>
                                </div>

                                {/* Independent Image Addition Section (4 Modes) */}
                                <div className="pt-2">
                                  <BlogImageAdditionSection
                                    itemId={item.id}
                                    keyword={item.keyword || item.topic || ''}
                                    title={currentTitle}
                                    contentType={item.contentType || item.draftType || selectedStyleKey}
                                    writingStyle={selectedStyleKey}
                                    draftContent={item.draftContent || ''}
                                    onInsertImageIntoDraft={handleInsertImageIntoDraft}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-20 text-slate-400 space-y-3">
                  <Sparkles className="w-10 h-10 mx-auto opacity-30 text-slate-400" />
                  <p className="text-sm font-medium text-slate-500">
                    좌측에 키워드를 입력하고 <strong className="text-slate-800">"1단계: SEO 기획안 & 추천 제목 분석 생성"</strong> 버튼을 눌러주세요.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 사용자 블로그 출력 서식 커스텀 모달 */}
      <UserBlogStyleSettingsModal
        isOpen={isStyleSettingsModalOpen}
        onClose={() => setIsStyleSettingsModalOpen(false)}
        currentStyle={userBlogStyle}
        onSave={handleSaveUserBlogStyle}
        onReset={handleResetUserBlogStyle}
        isSaving={isSavingBlogStyle}
      />
    </div>
  );
};