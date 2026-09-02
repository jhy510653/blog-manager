import React, { useState, useEffect } from 'react';
import {
  Search,
  Sparkles,
  RefreshCw,
  TrendingUp,
  Target,
  FileEdit,
  Copy,
  Check,
  Star,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  ArrowRight,
  Lightbulb,
  ListOrdered,
  BookOpen,
  ExternalLink,
} from 'lucide-react';
import { TrendKeyword } from '../../types';

export interface KeywordAnalysisData {
  keyword: string;
  category: string;
  pcSearchVolume: number;
  mobileSearchVolume: number;
  totalSearchVolume: number;
  documentCount: number;
  searchToDocumentRatio: number;
  blogCompetitionLevel: string;
  competitionIndex: string;
  adCompetitionIndex: string;
  dataSource?: string;
  evaluation: {
    isPostingUsable: boolean;
    usabilityScore: number;
    intentCategory: string;
    intentDescription: string;
    combinationType: string;
    timingTag: 'now' | 'prepare' | 'steady';
    timingTagLabel: string;
    recommendReason: string;
    contentStyle: string;
    postingTitleHint?: string;
    suggestedTitles: string[];
    suggestedOutlines: string[];
    reason?: string;
    specificityScore?: number;
    blogTopicScore?: number;
    recentBlogActivity?: number;
    seasonalityScore?: number;
    genericPenalty?: number;
    finalScore?: number;
    classification?: 'immediate_post' | 'expandable_topic' | 'trend_reference';
    classificationLabel?: string;
    excludedReason?: string;
  };
  relatedKeywords: {
    keyword: string;
    pcSearchVolume: number;
    mobileSearchVolume: number;
    totalSearchVolume: number;
    documentCount: number;
    searchToDocumentRatio: number;
    blogCompetitionLevel: string;
    competitionIndex: string;
    isPostingUsable?: boolean;
    postingUsabilityScore?: number;
    searchIntentCategory?: string;
    timingTag?: 'now' | 'prepare' | 'steady';
    timingTagLabel?: string;
    recommendReason?: string;
    contentStyle?: string;
    specificityScore?: number;
    blogTopicScore?: number;
    recentBlogActivity?: number;
    seasonalityScore?: number;
    genericPenalty?: number;
    finalScore?: number;
    classification?: 'immediate_post' | 'expandable_topic' | 'trend_reference';
    classificationLabel?: string;
    excludedReason?: string;
  }[];
  analyzedAt: string;
}

interface KeywordAnalysisSectionProps {
  initialKeyword?: string;
  onSelectKeywordForDraft: (keyword: string) => void;
  onShowToast: (msg: string) => void;
}

const SAMPLE_KEYWORDS = [
  '거제도 1박2일 코스',
  '강릉 당일치기 뚜벅이',
  '신생아 수면교육 꿀팁',
  '원룸 청소 노하우',
  '아이폰 16 프로 자급제 비교',
  '직장인 주말 부업 추천',
  '여름 휴가지 추천 국내',
  '에어컨 필터 청소방법',
];

export const KeywordAnalysisSection: React.FC<KeywordAnalysisSectionProps> = ({
  initialKeyword,
  onSelectKeywordForDraft,
  onShowToast,
}) => {
  const [keywordInput, setKeywordInput] = useState<string>(initialKeyword || '');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [data, setData] = useState<KeywordAnalysisData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedKeyword, setCopiedKeyword] = useState<string | null>(null);

  const handleAnalyze = async (targetKeyword?: string) => {
    const kw = (targetKeyword || keywordInput).trim();
    if (!kw) {
      onShowToast('분석할 키워드를 입력해 주세요.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    if (targetKeyword) {
      setKeywordInput(targetKeyword);
    }

    try {
      const resp = await fetch(`/api/keywords/analyze?keyword=${encodeURIComponent(kw)}`);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: 키워드 분석 요청 실패`);
      }
      const resJson = await resp.json();
      if (resJson.success && resJson.data) {
        setData(resJson.data);
      } else {
        throw new Error(resJson.message || '키워드 분석 데이터를 가져올 수 없습니다.');
      }
    } catch (err: any) {
      console.error('[KeywordAnalysisSection] error:', err);
      setErrorMsg(err?.message || '키워드 분석 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialKeyword && initialKeyword.trim()) {
      handleAnalyze(initialKeyword.trim());
    } else if (!data) {
      // Default sample analysis
      handleAnalyze('거제도 1박2일 코스');
    }
  }, [initialKeyword]);

  const handleCopyText = (text: string, label = '내용') => {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopiedKeyword(text);
        onShowToast(`📋 ${label}이(가) 복사되었습니다.`);
        setTimeout(() => setCopiedKeyword(null), 2000);
      },
      () => {
        onShowToast('복사에 실패했습니다.');
      }
    );
  };

  const handleStartDraftWithTitle = (title: string) => {
    onSelectKeywordForDraft(title);
    onShowToast(`🚀 "${title}" 제목으로 AI 초안 생성을 시작합니다.`);
  };

  const handleOpenNaverSearch = (e: React.MouseEvent, kw: string) => {
    e.stopPropagation();
    const url = `https://search.naver.com/search.naver?query=${encodeURIComponent(kw)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleOpenNaverBlogSearch = (e: React.MouseEvent, kw: string) => {
    e.stopPropagation();
    const url = `https://search.naver.com/search.naver?where=blog&query=${encodeURIComponent(kw)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const renderBlogCompetitionBadge = (level?: string, ratio?: number) => {
    const formattedRatio = typeof ratio === 'number' && !isNaN(ratio) ? ratio.toFixed(2) : '-';
    if (level === '황금 (최상)' || (typeof ratio === 'number' && ratio >= 1.0)) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span>황금 (최상) · 비율 {formattedRatio}</span>
        </span>
      );
    }
    if (level === '유리 (상)' || (typeof ratio === 'number' && ratio >= 0.3)) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          <span>유리 (상) · 비율 {formattedRatio}</span>
        </span>
      );
    }
    if (level === '보통') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
          <span>보통 · 비율 {formattedRatio}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
        <span>과열 · 비율 {formattedRatio}</span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* 1. Keyword Input & Search Bar */}
      <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200 shadow-xs space-y-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-100/80">
            <Search className="w-3.5 h-3.5 text-blue-600" />
            <span>키워드 정밀 분석 & 포스팅 기획</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            분석하고 싶은 키워드를 입력해 보세요
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            검색량, 블로그 발행 문서수, 황금비율, 포스팅 적합도, 추천 제목 3종 및 H2 목차를 정밀 산출합니다.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAnalyze();
          }}
          className="flex flex-col sm:flex-row items-center gap-2.5 pt-1"
        >
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              placeholder="예: 거제도 1박2일 코스, 신생아 수면교육 꿀팁, 아이폰16 자급제"
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !keywordInput.trim()}
            className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-300' : ''}`} />
            <span>{isLoading ? '분석 중...' : '키워드 분석'}</span>
          </button>
        </form>

        {/* Quick Suggestion Pills */}
        <div className="pt-1 flex items-center gap-1.5 flex-wrap text-xs text-slate-500">
          <span className="font-semibold text-slate-400">추천 키워드:</span>
          {SAMPLE_KEYWORDS.map((sample) => (
            <button
              key={sample}
              type="button"
              onClick={() => handleAnalyze(sample)}
              className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer text-xs"
            >
              {sample}
            </button>
          ))}
        </div>
      </div>

      {/* Error View */}
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3 text-rose-800 text-xs">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold">키워드 분석 실패</p>
            <p className="text-rose-700">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* 2. Analysis Results Container */}
      {data && (
        <div className="space-y-6">
          {/* Main Key Metrics Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-xs space-y-1.5">
              <span className="text-xs text-slate-500 font-medium block">총 월간 검색량</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-slate-900">
                  {data.totalSearchVolume.toLocaleString()}
                </span>
                <span className="text-xs text-slate-400">회</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-1.5 border-t border-slate-100">
                <span>PC: {data.pcSearchVolume.toLocaleString()}</span>
                <span>·</span>
                <span className="text-blue-700 font-medium">모바일: {data.mobileSearchVolume.toLocaleString()}</span>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-xs space-y-1.5">
              <span className="text-xs text-slate-500 font-medium block">블로그 발행 문서수</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-slate-900">
                  {data.documentCount.toLocaleString()}
                </span>
                <span className="text-xs text-slate-400">건</span>
              </div>
              <div className="text-[11px] text-slate-500 pt-1.5 border-t border-slate-100 truncate">
                네이버 블로그 전체 발행량
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-xs space-y-1.5">
              <span className="text-xs text-slate-500 font-medium block">SEO 황금 비율 & 경쟁도</span>
              <div>{renderBlogCompetitionBadge(data.blogCompetitionLevel, data.searchToDocumentRatio)}</div>
              <div className="text-[11px] text-slate-500 pt-1.5 border-t border-slate-100">
                검색량 대비 문서수 지수
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-xs space-y-1.5">
              <span className="text-xs text-slate-500 font-medium block">광고 입찰 경쟁도</span>
              <div className="flex items-center gap-1.5">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold ${
                    data.competitionIndex === '낮음'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : data.competitionIndex === '중간'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  {data.competitionIndex}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 pt-1.5 border-t border-slate-100">
                카테고리: {data.category}
              </div>
            </div>
          </div>

          {/* 3. 포스팅 적합도 및 블로그 글감 코칭 카드 */}
          <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {data.evaluation.classification && (
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold ${
                        data.evaluation.classification === 'immediate_post'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : data.evaluation.classification === 'expandable_topic'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>{data.evaluation.classificationLabel || '포스팅 소재'}</span>
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200/70">
                    {data.evaluation.timingTagLabel}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200/70">
                    {data.evaluation.contentStyle} 추천
                  </span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-50 text-slate-600 border border-slate-200/60">
                    {data.evaluation.combinationType}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 pt-0.5">
                  '{data.keyword}' 포스팅 기획 가이드
                </h3>
              </div>

              {/* 별점 & 최종 점수 */}
              <div className="flex flex-col items-start sm:items-end gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-medium">포스팅 적합도</span>
                  {typeof data.evaluation.finalScore === 'number' && (
                    <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold text-xs border border-blue-100">
                      종합 {data.evaluation.finalScore}점
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`w-3.5 h-3.5 ${
                        i < data.evaluation.usabilityScore
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-slate-200'
                      }`}
                    />
                  ))}
                  <span className="text-xs font-bold text-slate-800 ml-1">
                    {data.evaluation.usabilityScore} / 5점
                  </span>
                </div>
              </div>
            </div>

            {/* 정밀 다단계 스코어링 세부 지표 (구체성, 글감 적합도, 발행 활동성, 시즌성, 범용 감점) */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-xs">
              <div className="space-y-0.5">
                <span className="text-[11px] text-slate-500 block">구체성 지수</span>
                <span className="font-bold text-slate-800">{data.evaluation.specificityScore ?? '-'}점</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[11px] text-slate-500 block">블로그 글감 적합도</span>
                <span className="font-bold text-slate-800">{data.evaluation.blogTopicScore ?? '-'}점</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[11px] text-slate-500 block">최근 발행 활동도</span>
                <span className="font-bold text-slate-800">{data.evaluation.recentBlogActivity ?? '-'}점</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[11px] text-slate-500 block">시즌성 지수</span>
                <span className="font-bold text-slate-800">{data.evaluation.seasonalityScore ?? '-'}점</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[11px] text-slate-500 block">범용 단어 감점</span>
                <span className={`font-bold ${(data.evaluation.genericPenalty || 0) > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                  {data.evaluation.genericPenalty ? `-${data.evaluation.genericPenalty}점` : '0점 (양호)'}
                </span>
              </div>
            </div>

            {/* 추천 이유 & 검색 의도 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/70 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700">
                  <Lightbulb className="w-3.5 h-3.5" />
                  <span>추천 이유</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed font-normal">
                  {data.evaluation.recommendReason}
                </p>
              </div>

              <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/70 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                  <Target className="w-3.5 h-3.5" />
                  <span>검색 의도 & 성격</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed font-normal">
                  {data.evaluation.intentDescription} ({data.evaluation.intentCategory})
                </p>
              </div>
            </div>

            {/* 추천 제목 예시 3종 */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                  <span>실전 블로그 추천 제목 예시 3종</span>
                </h4>
                <span className="text-[11px] text-slate-400">클릭하여 즉시 초안 작성</span>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {data.evaluation.suggestedTitles.map((title, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-white border border-slate-200 hover:border-blue-400 transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-5 h-5 rounded-md bg-blue-50 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">
                        {idx + 1}
                      </span>
                      <span className="text-xs sm:text-sm font-semibold text-slate-800 truncate group-hover:text-blue-700 transition-colors">
                        {title}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopyText(title, '추천 제목')}
                        className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        <span>복사</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStartDraftWithTitle(title)}
                        className="px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer flex items-center gap-1 active:scale-95"
                      >
                        <FileEdit className="w-3 h-3" />
                        <span>이 제목으로 초안 작성</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 추천 목차 (H2) 가이드 */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <ListOrdered className="w-3.5 h-3.5 text-emerald-600" />
                  <span>블로그 본문 추천 목차 (H2) 가이드</span>
                </h4>
                <button
                  type="button"
                  onClick={() => handleCopyText(data.evaluation.suggestedOutlines.join('\n'), '전체 목차')}
                  className="text-xs text-slate-500 hover:text-slate-900 underline cursor-pointer"
                >
                  전체 목차 복사
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {data.evaluation.suggestedOutlines.map((outline, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/70 text-xs text-slate-700 font-medium flex items-center gap-2"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span className="truncate">{outline}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Primary Action Button */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                제목과 목차를 바탕으로 AI 초안 생성기에서 즉시 완성도 높은 글을 작성할 수 있습니다.
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                <button
                  type="button"
                  onClick={(e) => handleOpenNaverSearch(e, data.keyword)}
                  title="네이버 통합검색 (새 탭)"
                  className="flex-1 sm:flex-initial px-3 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold border border-emerald-200 transition-colors cursor-pointer inline-flex items-center justify-center gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
                  <span>네이버 검색</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => handleOpenNaverBlogSearch(e, data.keyword)}
                  title="네이버 블로그 검색 (새 탭)"
                  className="flex-1 sm:flex-initial px-3 py-2 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-semibold border border-teal-200 transition-colors cursor-pointer inline-flex items-center justify-center gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-teal-600" />
                  <span>블로그 검색</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCopyText(data.keyword, '키워드')}
                  className="flex-1 sm:flex-initial px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium border border-slate-200 transition-colors cursor-pointer"
                >
                  키워드 복사
                </button>
                <button
                  type="button"
                  onClick={() => onSelectKeywordForDraft(data.keyword)}
                  className="flex-1 sm:flex-initial px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <FileEdit className="w-3.5 h-3.5" />
                  <span>AI 초안 생성기에서 작성</span>
                </button>
              </div>
            </div>
          </div>

          {/* 4. 연관 검색어 & 롱테일 확장 키워드 테이블 */}
          {data.relatedKeywords && data.relatedKeywords.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-blue-600" />
                    <span>'{data.keyword}' 연관 및 롱테일 키워드 ({data.relatedKeywords.length}개)</span>
                  </h4>
                  <p className="text-xs text-slate-500">
                    연관 키워드를 즉시 재분석하거나 블로그 초안을 작성할 수 있습니다.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-semibold">
                      <th className="py-2.5 px-3">연관 키워드</th>
                      <th className="py-2.5 px-3 text-center">발행 시기</th>
                      <th className="py-2.5 px-3 text-right">PC 검색량</th>
                      <th className="py-2.5 px-3 text-right">모바일 검색량</th>
                      <th className="py-2.5 px-3 text-right">총 검색량</th>
                      <th className="py-2.5 px-3 text-right">블로그 문서수</th>
                      <th className="py-2.5 px-3 text-center">경쟁도</th>
                      <th className="py-2.5 px-3 text-center min-w-[210px]">액션</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.relatedKeywords.map((rk, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          {rk.keyword}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                            {rk.timingTagLabel?.replace(/[🔥🌱📌]\s*/g, '') || '스테디'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-600">
                          {rk.pcSearchVolume.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right text-blue-700 font-medium">
                          {rk.mobileSearchVolume.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                          {rk.totalSearchVolume.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-700 font-medium">
                          {rk.documentCount.toLocaleString()}건
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {renderBlogCompetitionBadge(rk.blogCompetitionLevel, rk.searchToDocumentRatio)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1 flex-wrap">
                            <button
                              type="button"
                              onClick={(e) => handleOpenNaverSearch(e, rk.keyword)}
                              title="네이버 통합검색 (새 탭)"
                              className="px-1.5 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold text-[11px] border border-emerald-200 transition-colors cursor-pointer inline-flex items-center gap-0.5"
                            >
                              <ExternalLink className="w-2.5 h-2.5 text-emerald-600" />
                              <span>네이버</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleOpenNaverBlogSearch(e, rk.keyword)}
                              title="네이버 블로그 검색 (새 탭)"
                              className="px-1.5 py-1 rounded-md bg-teal-50 hover:bg-teal-100 text-teal-800 font-semibold text-[11px] border border-teal-200 transition-colors cursor-pointer inline-flex items-center gap-0.5"
                            >
                              <ExternalLink className="w-2.5 h-2.5 text-teal-600" />
                              <span>블로그</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAnalyze(rk.keyword)}
                              className="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[11px] transition-colors cursor-pointer"
                            >
                              분석
                            </button>
                            <button
                              type="button"
                              onClick={() => onSelectKeywordForDraft(rk.keyword)}
                              className="px-2 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[11px] transition-colors cursor-pointer"
                            >
                              초안작성
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
