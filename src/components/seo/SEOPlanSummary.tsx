import React, { useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Target,
  Users,
  FileText,
  ListOrdered,
  Tag,
  MessageSquareText,
  Sparkles,
  HelpCircle,
  ExternalLink,
  Compass,
  Check,
  Copy,
  Layers,
  ArrowRight,
  BookmarkCheck,
  Lightbulb,
  Search,
  ShieldCheck,
  MapPin,
  Ban
} from 'lucide-react';
import { GoldenKeywordResult } from '../../types';
import { cleanAndNormalizeTitle, deduplicateTitleCandidates } from '../../utils/titleUtils';

interface SEOPlanSummaryProps {
  seoPlan: GoldenKeywordResult | null;
  onClearPlan?: () => void;
  onNavigateToPlanner?: () => void;
  onCreatePlanForKeyword?: (keyword: string) => void;
  isLoadingPlan?: boolean;
  onApplyStyle?: (styleKey: string) => void;
  onSelectTitle?: (selectedTitle: string) => void;
}

interface TitleCandidateDisplay {
  id: number;
  title: string;
  combinationType: string;
  badgeColor: string;
  keywordsUsed?: string[];
}

export const SEOPlanSummary: React.FC<SEOPlanSummaryProps> = ({
  seoPlan,
  onClearPlan,
  onNavigateToPlanner,
  onCreatePlanForKeyword,
  isLoadingPlan = false,
  onApplyStyle,
  onSelectTitle
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const [quickKeyword, setQuickKeyword] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [selectedH1Override, setSelectedH1Override] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 2000);
  };

  if (!seoPlan) {
    return (
      <div id="seo-plan-empty" className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-4 sm:p-5 text-center space-y-3">
        <div className="w-10 h-10 mx-auto rounded-full bg-blue-100 text-blue-700 flex items-center justify-center">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-extrabold text-slate-900">적용된 SEO 기획안이 없습니다</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            [SEO 기획안 생성기]에서 키워드를 분석하시거나, 아래에 메인 키워드를 입력해 SEO 기획안을 즉시 생성 후 연동하세요.
          </p>
        </div>

        <div className="pt-2 max-w-md mx-auto flex gap-2">
          <input
            id="seo-quick-keyword-input"
            type="text"
            placeholder="예: 로봇청소기 추천, 도쿄 겨울 여행"
            value={quickKeyword}
            onChange={(e) => setQuickKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && quickKeyword.trim() && onCreatePlanForKeyword) {
                onCreatePlanForKeyword(quickKeyword.trim());
              }
            }}
            className="flex-1 px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 outline-hidden focus:ring-2 focus:ring-blue-500"
          />
          <button
            id="seo-quick-keyword-submit-btn"
            type="button"
            disabled={!quickKeyword.trim() || isLoadingPlan}
            onClick={() => {
              if (quickKeyword.trim() && onCreatePlanForKeyword) {
                onCreatePlanForKeyword(quickKeyword.trim());
              }
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl text-xs transition-colors shrink-0 disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shadow-xs"
          >
            {isLoadingPlan ? (
              <span>분석 중...</span>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>SEO 연동</span>
              </>
            )}
          </button>
        </div>

        {onNavigateToPlanner && (
          <div className="pt-1">
            <button
              id="seo-navigate-planner-btn"
              type="button"
              onClick={onNavigateToPlanner}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 underline inline-flex items-center gap-1 cursor-pointer"
            >
              <span>1단계 [SEO 콘텐츠 기획안 생성기] 바로가기</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    );
  }

  // 1. Primary Title calculation
  let defaultH1 = seoPlan.recommendedOutline?.h1 || '';
  if (!defaultH1) {
    if (Array.isArray(seoPlan.recommendedTitles) && seoPlan.recommendedTitles.length > 0) {
      const first = seoPlan.recommendedTitles[0];
      defaultH1 = typeof first === 'string' ? first : (first as any)?.title || seoPlan.mainKeyword;
    } else if (typeof seoPlan.recommendedTitles === 'object' && seoPlan.recommendedTitles !== null) {
      defaultH1 =
        (seoPlan.recommendedTitles as any).click?.[0] ||
        (seoPlan.recommendedTitles as any).information?.[0] ||
        (seoPlan.recommendedTitles as any).review?.[0] ||
        seoPlan.mainKeyword;
    } else {
      defaultH1 = seoPlan.mainKeyword;
    }
  }

  const primaryTitle = selectedH1Override || defaultH1;

  // 2. Extract 5 Title Candidates with Combination Angles
  const defaultTypes = [
    { type: '코스/일정/방법 조합', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { type: '시기/조건/비교 조합', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { type: '실제 체감/후기 조합', color: 'bg-amber-50 text-amber-700 border-amber-200' },
    { type: '핵심 해결/준비물 조합', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    { type: '비용/꿀팁/기준 조합', color: 'bg-rose-50 text-rose-700 border-rose-200' }
  ];

  const titleCandidates: TitleCandidateDisplay[] = [];

  // Check titleCandidates array
  if (Array.isArray(seoPlan.titleCandidates) && seoPlan.titleCandidates.length > 0) {
    seoPlan.titleCandidates.slice(0, 5).forEach((item: any, idx) => {
      const def = defaultTypes[idx % defaultTypes.length];
      if (typeof item === 'string') {
        const cleaned = cleanAndNormalizeTitle(item);
        if (cleaned) {
          titleCandidates.push({
            id: idx + 1,
            title: cleaned,
            combinationType: def.type,
            badgeColor: def.color
          });
        }
      } else if (item && typeof item === 'object') {
        const cleaned = cleanAndNormalizeTitle(item.title || item.name || '');
        if (cleaned) {
          titleCandidates.push({
            id: idx + 1,
            title: cleaned,
            combinationType: item.combinationType || item.type || def.type,
            badgeColor: def.color,
            keywordsUsed: Array.isArray(item.keywordsUsed) ? item.keywordsUsed : undefined
          });
        }
      }
    });
  } else if (seoPlan.recommendedTitles) {
    if (Array.isArray(seoPlan.recommendedTitles)) {
      seoPlan.recommendedTitles.slice(0, 5).forEach((item: any, idx) => {
        const def = defaultTypes[idx % defaultTypes.length];
        const titleStr = typeof item === 'string' ? item : item?.title || '';
        const cleaned = cleanAndNormalizeTitle(titleStr);
        if (cleaned) {
          titleCandidates.push({
            id: idx + 1,
            title: cleaned,
            combinationType: item?.combinationType || def.type,
            badgeColor: def.color,
            keywordsUsed: Array.isArray(item?.keywordsUsed) ? item.keywordsUsed : undefined
          });
        }
      });
    } else if (typeof seoPlan.recommendedTitles === 'object') {
      const rec = seoPlan.recommendedTitles as any;
      const groups = [
        { key: 'information', type: '코스/일정/방법 조합', color: 'bg-blue-50 text-blue-700 border-blue-200' },
        { key: 'comparison', type: '시기/조건/비교 조합', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
        { key: 'review', type: '실제 체감/후기 조합', color: 'bg-amber-50 text-amber-700 border-amber-200' },
        { key: 'click', type: '핵심 해결/주의사항 조합', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
        { key: 'purchase', type: '비용/꿀팁/기준 조합', color: 'bg-rose-50 text-rose-700 border-rose-200' }
      ];

      groups.forEach((g, idx) => {
        const list = rec[g.key];
        const t = Array.isArray(list) && list.length > 0 ? list[0] : '';
        const cleaned = cleanAndNormalizeTitle(t);
        if (cleaned) {
          titleCandidates.push({
            id: idx + 1,
            title: cleaned,
            combinationType: g.type,
            badgeColor: g.color
          });
        }
      });
    }
  }

  // If no candidates were extracted at all, fallback to primary title
  if (titleCandidates.length === 0 && defaultH1) {
    const def = defaultTypes[0];
    titleCandidates.push({
      id: 1,
      title: cleanAndNormalizeTitle(defaultH1),
      combinationType: def.type,
      badgeColor: def.color
    });
  }

  // 3. Outline H2 List
  const h2List = seoPlan.recommendedOutline?.h2 || [];
  const fullOutlineText = h2List.map((h, i) => `${i + 1}. ${h}`).join('\n');

  // 4. Keyword Clusters (4-Tier)
  const coreKeywords = seoPlan.keywordClusters?.core?.map((k) => k.keyword) || [seoPlan.mainKeyword];
  const longTailKeywords = seoPlan.keywordClusters?.longTail?.map((k) => k.keyword) || [];
  const comparisonKeywords = seoPlan.keywordClusters?.comparison?.map((k) => k.keyword) || [];
  const transactionKeywords = seoPlan.keywordClusters?.transaction?.map((k) => k.keyword) || [];
  const faqKeywords = seoPlan.keywordClusters?.faq?.map((k) => k.keyword) || [];

  // 5. Recommended style resolution
  const recStyle = seoPlan.contentStrategy?.recommendedStyle || seoPlan.writing_style || '[정보 탐색형]';
  const recStyleKey = recStyle.includes('경험') || recStyle.includes('리뷰') || recStyle.includes('travel') || recStyle.includes('review')
    ? 'experience'
    : recStyle.includes('구매') || recStyle.includes('추천') || recStyle.includes('purchase')
    ? 'purchase'
    : recStyle.includes('비교') || recStyle.includes('comparison')
    ? 'comparison'
    : recStyle.includes('홈판') || recStyle.includes('화제') || recStyle.includes('story') || recStyle.includes('homepan')
    ? 'homepan'
    : 'info';

  const handleSelectCandidateTitle = (candTitle: string) => {
    setSelectedH1Override(candTitle);
    if (onSelectTitle) {
      onSelectTitle(candTitle);
    }
  };

  return (
    <div id="seo-plan-summary-container" className="bg-white text-slate-900 rounded-2xl sm:rounded-3xl border border-gray-100 overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.03)] transition-all">
      {/* Top Badge Notification Bar */}
      <div className="bg-slate-50/80 px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80 text-[11px] font-extrabold">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>SEO 기획안 최적화 완료</span>
          </span>
          <span className="text-xs font-extrabold text-slate-800 truncate max-w-[200px] sm:max-w-xs">
            키워드: {seoPlan.mainKeyword}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onClearPlan && (
            <button
              id="seo-plan-clear-btn"
              type="button"
              onClick={onClearPlan}
              className="text-[11px] text-slate-400 hover:text-rose-600 font-bold px-2 py-1 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
            >
              해제
            </button>
          )}
          <button
            id="seo-plan-toggle-collapse-btn"
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="p-1 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
          >
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 7 Core SEO Strategy Outputs */}
      {isOpen && (
        <div className="p-4 sm:p-5 space-y-4 text-xs">
          
          {/* ========================================================================= */}
          {/* 1. SEO 추천 H1 포스팅 제목 (복사 버튼 포함) */}
          {/* ========================================================================= */}
          <div id="seo-section-1-h1" className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                <span>1. SEO 추천 H1 포스팅 제목</span>
                <span className="text-[10px] text-blue-500 font-normal">(검색 노출 최적화)</span>
              </span>

              <button
                id="seo-copy-h1-btn"
                type="button"
                onClick={() => handleCopy(primaryTitle, 'h1')}
                className="px-2.5 py-1 rounded-lg bg-white hover:bg-blue-100/70 text-blue-700 border border-blue-200 text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                title="H1 제목 복사"
              >
                {copiedKey === 'h1' ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span className="text-emerald-700">복사됨</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 text-blue-600" />
                    <span>제목 복사</span>
                  </>
                )}
              </button>
            </div>

            <p className="text-sm sm:text-base font-extrabold text-slate-900 leading-snug break-keep">
              {primaryTitle}
            </p>
          </div>

          {/* ========================================================================= */}
          {/* 2. 검색 의도 & 타겟 (단계, 검색자 목적, 타깃 독자층) */}
          {/* ========================================================================= */}
          <div id="seo-section-2-intent" className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100 space-y-2">
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-emerald-600" />
              <span>2. 검색 의도 & 타겟 분석</span>
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-0.5">
              <div className="bg-white p-2.5 rounded-xl border border-slate-200/70 space-y-0.5">
                <span className="text-[10px] font-semibold text-slate-400">탐색 단계</span>
                <p className="font-extrabold text-xs text-slate-900">
                  {seoPlan.searchIntent?.stage || '정보탐색 / 문제해결'}
                </p>
              </div>

              <div className="bg-white p-2.5 rounded-xl border border-slate-200/70 space-y-0.5 sm:col-span-2">
                <span className="text-[10px] font-semibold text-slate-400">검색자 핵심 목적</span>
                <p className="font-bold text-xs text-slate-900 line-clamp-2">
                  {seoPlan.searchIntent?.userGoal || `${seoPlan.mainKeyword} 관련 구체적인 조건 및 핵심 정보 파악`}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-600">
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span><strong>타깃 독자층:</strong> {seoPlan.searchIntent?.targetAudience || '해당 주제를 검색하는 2040 실독자'}</span>
              </div>
              {seoPlan.searchIntent?.possibleQuestions && seoPlan.searchIntent.possibleQuestions.length > 0 && (
                <div className="text-[10px] text-slate-500 italic">
                  💡 핵심 궁금증: "{seoPlan.searchIntent.possibleQuestions[0]}"
                </div>
              )}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 2.1 콘텐츠 범위 & 검색의도 가드 (Content Boundary) */}
          {/* ========================================================================= */}
          {seoPlan.contentBoundary && (
            <div id="seo-section-content-boundary" className="bg-indigo-50/70 p-3.5 rounded-2xl border border-indigo-100/90 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                  <span>콘텐츠 범위 가드 (검색의도 일치성 보호)</span>
                </span>
                {seoPlan.contentBoundary.geographicScope && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-100/80 text-indigo-800 text-[10px] font-bold">
                    <MapPin className="w-3 h-3 text-indigo-600" />
                    <span>지역: {seoPlan.contentBoundary.geographicScope}</span>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                {seoPlan.contentBoundary.mustCover && seoPlan.contentBoundary.mustCover.length > 0 && (
                  <div className="bg-white/90 p-2.5 rounded-xl border border-indigo-100 space-y-1">
                    <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>필수 포함 사항 (Must Cover)</span>
                    </span>
                    <ul className="space-y-0.5 text-[11px] text-slate-700 list-disc list-inside">
                      {seoPlan.contentBoundary.mustCover.map((item, idx) => (
                        <li key={idx} className="leading-snug">{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {seoPlan.contentBoundary.mustAvoid && seoPlan.contentBoundary.mustAvoid.length > 0 && (
                  <div className="bg-white/90 p-2.5 rounded-xl border border-rose-100 space-y-1">
                    <span className="text-[10px] font-bold text-rose-700 flex items-center gap-1">
                      <Ban className="w-3 h-3 text-rose-600" />
                      <span>절대 제외/금지 사항 (Must Avoid)</span>
                    </span>
                    <ul className="space-y-0.5 text-[11px] text-slate-700 list-disc list-inside">
                      {seoPlan.contentBoundary.mustAvoid.map((item, idx) => (
                        <li key={idx} className="leading-snug">{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 3. 콘텐츠 기획 전략 & 추천 스타일 (선정 사유, 권장 전개 흐름) */}
          {/* ========================================================================= */}
          <div id="seo-section-3-strategy" className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1">
                  <Compass className="w-3.5 h-3.5 text-amber-600" />
                  <span>3. 콘텐츠 기획 전략 & 추천 스타일</span>
                </span>
                <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-extrabold text-[11px] border border-blue-100">
                  {recStyle}
                </span>
              </div>

              <p className="text-[11px] text-slate-700 leading-relaxed">
                {seoPlan.contentStrategy?.styleReason || '해당 키워드의 검색 의도에 가장 최적화된 콘텐츠 작성 형태입니다.'}
              </p>

              {seoPlan.contentStrategy?.targetStructure && (
                <p className="text-[10px] text-slate-500">
                  <strong className="text-slate-700">권장 전개 흐름:</strong> {seoPlan.contentStrategy.targetStructure}
                </p>
              )}
            </div>

            {onApplyStyle && (
              <button
                id="seo-apply-style-btn"
                type="button"
                onClick={() => onApplyStyle(recStyleKey)}
                className="self-start sm:self-center px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer shadow-xs"
                title="기획안이 추천하는 글 작성 스타일을 본문 입력창에 즉시 적용합니다."
              >
                <Check className="w-3.5 h-3.5" />
                <span>추천 스타일 적용</span>
              </button>
            )}
          </div>

          {/* ========================================================================= */}
          {/* 4. 제목 후보 5개 (서로 다른 키워드 조합 태그 및 선택/복사 가능) */}
          {/* ========================================================================= */}
          <div id="seo-section-4-title-candidates" className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>4. 제목 후보 5종 (다양한 키워드 조합 각도)</span>
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                원하는 제목을 클릭해 H1으로 선택하거나 복사하세요
              </span>
            </div>

            <div className="space-y-1.5">
              {titleCandidates.map((cand) => {
                const isCurrentH1 = primaryTitle === cand.title;
                return (
                  <div
                    key={cand.id}
                    className={`group p-2.5 rounded-xl border transition-all flex items-start sm:items-center justify-between gap-2.5 ${
                      isCurrentH1
                        ? 'bg-blue-50/80 border-blue-300 shadow-2xs'
                        : 'bg-white border-slate-200/80 hover:border-blue-200 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-start sm:items-center gap-2 flex-1 min-w-0">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border shrink-0 ${cand.badgeColor}`}>
                        후보 {cand.id} · {cand.combinationType}
                      </span>
                      <span className="text-xs font-bold text-slate-800 leading-snug break-keep">
                        {cand.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 pt-1 sm:pt-0">
                      <button
                        type="button"
                        onClick={() => handleSelectCandidateTitle(cand.title)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                          isCurrentH1
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-700'
                        }`}
                        title="이 제목을 포스팅 대표 제목으로 선택합니다"
                      >
                        {isCurrentH1 ? '선택됨 ✓' : '선택'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopy(cand.title, `cand_${cand.id}`)}
                        className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                        title="제목 복사"
                      >
                        {copiedKey === `cand_${cand.id}` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 5. H2 세부 소제목 뼈대 (개수 및 목차 목록, 복사 기능) */}
          {/* ========================================================================= */}
          <div id="seo-section-5-outline" className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <ListOrdered className="w-3.5 h-3.5 text-blue-600" />
                <span>5. H2 세부 소제목 뼈대 ({h2List.length}개)</span>
              </span>

              {h2List.length > 0 && (
                <button
                  id="seo-copy-outline-btn"
                  type="button"
                  onClick={() => handleCopy(fullOutlineText, 'outline')}
                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                >
                  {copiedKey === 'outline' ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span className="text-emerald-700">목차 복사됨</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>목차 전체 복사</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {h2List.length > 0 ? (
              <div className="bg-white rounded-xl p-3 border border-slate-200/80 space-y-2">
                <ol className="space-y-1.5 text-xs text-slate-800 font-medium">
                  {h2List.map((h2, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-extrabold flex items-center justify-center shrink-0 border border-blue-100 mt-0.5">
                        {idx + 1}
                      </span>
                      <span className="leading-snug pt-0.5 font-bold text-slate-900">{h2}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : (
              <p className="text-slate-400 italic">기본 단락 구조로 구성됩니다.</p>
            )}
          </div>

          {/* ========================================================================= */}
          {/* 6. 추천 CTA (주요 CTA, 보조 전환 트리거) */}
          {/* ========================================================================= */}
          <div id="seo-section-6-cta" className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100 space-y-2">
            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
              <MessageSquareText className="w-3.5 h-3.5 text-amber-600" />
              <span>6. 추천 CTA (콜투액션 & 전환 트리거)</span>
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="bg-white p-3 rounded-xl border border-slate-200/80 space-y-1">
                <span className="text-[10px] font-semibold text-slate-400">주요 CTA (권장 행동)</span>
                <p className="text-xs font-extrabold text-slate-900">
                  {seoPlan.ctaStrategy?.primaryCTA || '자연스러운 댓글 소통 및 유용한 정보 공유'}
                </p>
                {seoPlan.ctaStrategy?.benefitFocus && (
                  <p className="text-[10px] text-slate-500 pt-0.5">
                    💡 독자 이점: {seoPlan.ctaStrategy.benefitFocus}
                  </p>
                )}
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200/80 space-y-1">
                <span className="text-[10px] font-semibold text-slate-400">보조 전환 트리거</span>
                <p className="text-xs font-bold text-slate-800">
                  {seoPlan.monetizationStrategy?.conversionTrigger || seoPlan.ctaStrategy?.secondaryCTA || '관련 포스팅 링크 안내 및 추가 문의 유도'}
                </p>
                {seoPlan.ctaStrategy?.recommendedPlacement && (
                  <p className="text-[10px] text-slate-500 pt-0.5">
                    📍 권장 위치: {seoPlan.ctaStrategy.recommendedPlacement.join(', ')}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 7. 배치 핵심 키워드 클러스터 (핵심, 연관/롱테일, 세부의도, FAQ) */}
          {/* ========================================================================= */}
          <div id="seo-section-7-clusters" className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-blue-600" />
                <span>7. 배치 핵심 키워드 클러스터 (4단계 계층)</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              {/* Tier A & Core */}
              <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 space-y-1.5">
                <span className="text-[10px] font-extrabold text-blue-700 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                  <span>[A] 메인 핵심 키워드</span>
                </span>
                <div className="flex flex-wrap gap-1">
                  {coreKeywords.map((kw, idx) => (
                    <span key={idx} className="px-2 py-0.5 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-extrabold">
                      #{kw}
                    </span>
                  ))}
                </div>
              </div>

              {/* Tier B & LongTail */}
              <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 space-y-1.5">
                <span className="text-[10px] font-extrabold text-emerald-700 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                  <span>[B] 핵심 연관 & 롱테일 키워드</span>
                </span>
                <div className="flex flex-wrap gap-1">
                  {longTailKeywords.length > 0 ? (
                    longTailKeywords.slice(0, 6).map((kw, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-medium">
                        #{kw}
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] text-slate-400">자동 연관 키워드 반영</span>
                  )}
                </div>
              </div>

              {/* Tier C & Intent / Comparison */}
              <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 space-y-1.5">
                <span className="text-[10px] font-extrabold text-amber-700 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                  <span>[C] 세부 검색의도 & 비교 기준</span>
                </span>
                <div className="flex flex-wrap gap-1">
                  {comparisonKeywords.concat(transactionKeywords).length > 0 ? (
                    comparisonKeywords.concat(transactionKeywords).slice(0, 6).map((kw, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-medium">
                        #{kw}
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] text-slate-400">선택 기준 및 조건 키워드</span>
                  )}
                </div>
              </div>

              {/* Tier D & FAQ / Subtopics */}
              <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 space-y-1.5">
                <span className="text-[10px] font-extrabold text-indigo-700 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
                  <span>[D] 하위 주제 & FAQ 질문</span>
                </span>
                <div className="flex flex-wrap gap-1">
                  {faqKeywords.length > 0 ? (
                    faqKeywords.slice(0, 6).map((kw, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-200 text-[10px] font-medium">
                        #{kw}
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] text-slate-400">실전 꿀팁 및 Q&A 키워드</span>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};
