import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  FileEdit,
  Eye,
  Copy,
  Check,
  X,
  ExternalLink,
  ChevronRight,
  ListOrdered,
  Layers,
  ArrowRight,
  AlertCircle,
  FileText,
  Sliders,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { NaverUser } from '../../types';

export interface BatchDraftItem {
  id: string;
  keyword: string;
  category: string;
  totalSearchVolume?: number;
  searchIntentCategory?: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  currentStep?: string;
  generatedTitle?: string;
  generatedOutline?: string[];
  generatedDraftHtml?: string;
  generatedDraftPlain?: string;
  writingStyle?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

interface TrendBatchDraftModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedKeywords: {
    keyword: string;
    category: string;
    totalSearchVolume?: number;
    searchIntentCategory?: string;
  }[];
  currentUser: NaverUser | null;
  isAdmin: boolean;
  onSelectKeywordForDraft: (keyword: string) => void;
  onShowToast: (msg: string) => void;
}

export const TrendBatchDraftModal: React.FC<TrendBatchDraftModalProps> = ({
  isOpen,
  onClose,
  selectedKeywords,
  currentUser,
  isAdmin,
  onSelectKeywordForDraft,
  onShowToast,
}) => {
  const [items, setItems] = useState<BatchDraftItem[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const isPausedRef = useRef<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Configuration options for batch generation
  const [writingStyle, setWritingStyle] = useState<string>('auto'); // auto, experience, info, purchase, comparison, homepan
  const [targetWordCount, setTargetWordCount] = useState<string>('2000');
  const [outputFormat, setOutputFormat] = useState<'html' | 'plain'>('html');

  // Preview modal for a single completed draft
  const [previewItem, setPreviewItem] = useState<BatchDraftItem | null>(null);
  const [previewTab, setPreviewTab] = useState<'formatted' | 'raw'>('formatted');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Initialize batch items when selectedKeywords change or modal opens
  useEffect(() => {
    if (isOpen && selectedKeywords.length > 0) {
      // Check if we should preserve existing processed items or init new
      setItems((prev) => {
        const prevMap = new Map(prev.map((it) => [it.keyword, it]));
        return selectedKeywords.map((kw, idx) => {
          if (prevMap.has(kw.keyword)) {
            return prevMap.get(kw.keyword)!;
          }
          return {
            id: `batch_${Date.now()}_${idx}_${kw.keyword}`,
            keyword: kw.keyword,
            category: kw.category || '기타',
            totalSearchVolume: kw.totalSearchVolume,
            searchIntentCategory: kw.searchIntentCategory,
            status: 'pending',
          };
        });
      });
    }
  }, [isOpen, selectedKeywords]);

  // Statistics
  const totalCount = items.length;
  const completedCount = items.filter((it) => it.status === 'completed').length;
  const failedCount = items.filter((it) => it.status === 'failed').length;
  const generatingCount = items.filter((it) => it.status === 'generating').length;
  const pendingCount = items.filter((it) => it.status === 'pending').length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Single Item Sequential Processor
  const processItem = async (
    item: BatchDraftItem,
    signal: AbortSignal
  ): Promise<{
    success: boolean;
    generatedTitle?: string;
    generatedOutline?: string[];
    generatedDraftHtml?: string;
    generatedDraftPlain?: string;
    error?: string;
  }> => {
    try {
      // 1. Determine writing style
      let chosenStyle = writingStyle;
      if (chosenStyle === 'auto') {
        // Simple heuristics based on search intent category or keyword
        if (
          item.searchIntentCategory === '정보탐색' ||
          item.keyword.includes('방법') ||
          item.keyword.includes('신청') ||
          item.keyword.includes('조건') ||
          item.keyword.includes('비용') ||
          item.keyword.includes('기준')
        ) {
          chosenStyle = 'info';
        } else if (
          item.searchIntentCategory === '비교추천' ||
          item.keyword.includes('추천') ||
          item.keyword.includes('순위') ||
          item.keyword.includes('베스트')
        ) {
          chosenStyle = 'purchase';
        } else if (
          item.keyword.includes('비교') ||
          item.keyword.includes('차이') ||
          item.keyword.includes('장단점')
        ) {
          chosenStyle = 'comparison';
        } else {
          chosenStyle = 'experience';
        }
      }

      // Step 1: SEO Plan and title candidates
      updateItemStatus(item.id, 'generating', '1/2단계: SEO 기획안 및 추천 소제목 분석 중...');

      const effectiveUserId = currentUser?.id || currentUser?.naverId || 'anonymous_user';
      const effectiveUserEmail = currentUser?.email || undefined;
      const effectiveUserName = currentUser?.name || currentUser?.nickname || undefined;

      const seoRes = await fetch('/api/gemini/toolkit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
          type: 'golden_keyword',
          promptInput: item.keyword,
          writingStyle: chosenStyle,
          userId: effectiveUserId,
          userEmail: effectiveUserEmail,
          userName: effectiveUserName,
          isAdmin: isAdmin,
          isChallengeParticipant: true,
        }),
      });

      const seoRawText = await seoRes.text().catch(() => '');
      let seoData: any = null;
      try {
        seoData = JSON.parse(seoRawText);
      } catch {
        seoData = null;
      }

      if (!seoRes.ok) {
        let errorMsg = `SEO 기획 분석 서버 응답 오류 (HTTP ${seoRes.status})`;
        if (seoData && (seoData.message || seoData.error)) {
          errorMsg = seoData.message || seoData.error;
        } else if (seoRawText && !seoRawText.trim().startsWith('<')) {
          errorMsg = seoRawText.slice(0, 200);
        }
        throw new Error(errorMsg);
      }

      if (seoData && seoData.success === false) {
        throw new Error(seoData.message || seoData.error || 'SEO 기획 생성에 실패했습니다.');
      }

      if (seoData?.debugInfo) {
        console.log('[SEO Plan Debug Info (Trend Batch)]:', seoData.debugInfo);
      }

      let parsedPlan: any = {};
      try {
        if (seoData && typeof seoData.result === 'string') {
          const cleaned = seoData.result.replace(/```json\s*|\s*```/g, '').trim();
          parsedPlan = JSON.parse(cleaned);
        } else if (seoData && typeof seoData.result === 'object' && seoData.result !== null) {
          parsedPlan = seoData.result;
        } else if (seoData && typeof seoData === 'object') {
          parsedPlan = seoData;
        } else if (seoRawText) {
          const cleaned = seoRawText.replace(/```json\s*|\s*```/g, '').trim();
          parsedPlan = JSON.parse(cleaned);
        }
      } catch {
        parsedPlan = {};
      }

      const titleCandidates =
        parsedPlan.titleCandidates ||
        parsedPlan.recommendedTitles ||
        parsedPlan.titles ||
        [];

      let selectedTitle = '';
      if (Array.isArray(titleCandidates) && titleCandidates.length > 0) {
        const first = titleCandidates[0];
        selectedTitle = typeof first === 'string' ? first : first?.title || first?.h1 || '';
      }
      if (!selectedTitle) {
        selectedTitle =
          parsedPlan.recommendedOutline?.h1 ||
          parsedPlan.selectedTitle ||
          `${item.keyword} 핵심 정보 및 실전 팁`;
      }

      const rawSections =
        parsedPlan.recommendedOutline?.sections ||
        parsedPlan.recommendedOutline?.h2 ||
        parsedPlan.outlineSections ||
        parsedPlan.sections ||
        [];

      const sections =
        Array.isArray(rawSections) && rawSections.length > 0
          ? rawSections.map((sec: any, idx: number) => {
              if (typeof sec === 'string') {
                return { id: `sec_${idx + 1}`, heading: sec };
              }
              return {
                id: sec.id || `sec_${idx + 1}`,
                heading: sec.heading || sec.title || `${item.keyword} 관련 정보 ${idx + 1}`,
                coreContent: sec.coreContent || '',
                keyKeywords: sec.keyKeywords || [],
              };
            })
          : [
              { id: 'sec_1', heading: `${item.keyword} 핵심 포인트 및 개요` },
              { id: 'sec_2', heading: `${item.keyword} 실전 활용 가이드 및 꿀팁` },
              { id: 'sec_3', heading: `${item.keyword} 주의사항 및 최종 총평` },
            ];

      const outlineList = sections.map((s: any) => (typeof s === 'string' ? s : s.heading));

      // Step 2: Generate Full Draft Body
      updateItemStatus(item.id, 'generating', '2/2단계: 네이버 블로그 맞춤형 고품질 본문 작성 중...');

      const draftRes = await fetch('/api/gemini/toolkit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
          type: 'draft',
          promptInput: item.keyword,
          selectedTitle,
          outlineSections: sections,
          writingStyle: chosenStyle,
          targetLength: `${targetWordCount}자 내외`,
          outputFormat: outputFormat === 'plain' ? 'plain' : 'html',
          imageGuide: true,
          includeFaq: true,
          includeTable: true,
          includeChecklist: true,
          seoPlan: {
            recommendedOutline: {
              h1: selectedTitle,
              h2: outlineList,
              sections: sections,
            },
          },
          userId: effectiveUserId,
          userEmail: effectiveUserEmail,
          userName: effectiveUserName,
          isAdmin: isAdmin,
          isChallengeParticipant: true,
        }),
      });

      const draftRawText = await draftRes.text().catch(() => '');
      let draftData: any = null;
      try {
        draftData = JSON.parse(draftRawText);
      } catch {
        draftData = null;
      }

      if (!draftRes.ok) {
        let errorMsg = `본문 초안 생성 서버 응답 오류 (HTTP ${draftRes.status})`;
        if (draftData && (draftData.message || draftData.error)) {
          errorMsg = draftData.message || draftData.error;
        } else if (draftRawText && !draftRawText.trim().startsWith('<')) {
          errorMsg = draftRawText.slice(0, 200);
        }
        throw new Error(errorMsg);
      }

      if (draftData && draftData.success === false) {
        throw new Error(draftData.message || draftData.error || '초안 생성에 실패했습니다.');
      }

      const rawDraft =
        draftData?.result ||
        draftData?.draftHtml ||
        draftData?.content ||
        draftData?.draftText ||
        draftRawText ||
        '';

      if (!rawDraft || typeof rawDraft !== 'string' || rawDraft.trim().length === 0) {
        throw new Error('AI 모델로부터 빈 본문이 반환되었습니다. 다시 시도해주세요.');
      }

      return {
        success: true,
        generatedTitle: selectedTitle,
        generatedOutline: outlineList,
        generatedDraftHtml: rawDraft,
        generatedDraftPlain: rawDraft.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim(),
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw err;
      }
      return {
        success: false,
        error: err.message || '초안 생성 중 예기치 않은 오류가 발생했습니다.',
      };
    }
  };

  const updateItemStatus = (
    id: string,
    status: BatchDraftItem['status'],
    stepMsg?: string,
    resultData?: Partial<BatchDraftItem>
  ) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id === id) {
          return {
            ...it,
            status,
            currentStep: stepMsg ?? it.currentStep,
            ...resultData,
          };
        }
        return it;
      })
    );
  };

  // Main Batch Sequential Loop
  const startBatchGeneration = async (retryOnlyFailed = false) => {
    if (isProcessing) return;

    setIsProcessing(true);
    isPausedRef.current = false;
    abortControllerRef.current = new AbortController();

    const targetList = items.filter((it) =>
      retryOnlyFailed ? it.status === 'failed' : it.status === 'pending' || it.status === 'failed'
    );

    if (targetList.length === 0) {
      onShowToast('처리할 대기 항목이 없습니다.');
      setIsProcessing(false);
      return;
    }

    onShowToast(`🚀 총 ${targetList.length}개 키워드의 순차 초안 생성을 시작합니다.`);

    for (const item of targetList) {
      // Check pause or abort
      if (isPausedRef.current || abortControllerRef.current?.signal.aborted) {
        break;
      }

      updateItemStatus(item.id, 'generating', '준비 중...', {
        startedAt: new Date().toLocaleTimeString('ko-KR'),
      });

      try {
        const result = await processItem(item, abortControllerRef.current!.signal);

        if (result.success) {
          updateItemStatus(item.id, 'completed', '생성 완료', {
            generatedTitle: result.generatedTitle,
            generatedOutline: result.generatedOutline,
            generatedDraftHtml: result.generatedDraftHtml,
            generatedDraftPlain: result.generatedDraftPlain,
            completedAt: new Date().toLocaleTimeString('ko-KR'),
          });
        } else {
          updateItemStatus(item.id, 'failed', '생성 실패', {
            error: result.error || '생성 실패',
          });
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          updateItemStatus(item.id, 'pending', '중단됨');
          break;
        }
        updateItemStatus(item.id, 'failed', '오류 발생', {
          error: err.message || '요청 중단',
        });
      }

      // Safe small delay between requests to avoid server strain
      await new Promise((r) => setTimeout(r, 400));
    }

    setIsProcessing(false);
    onShowToast('✅ 일괄 초안 생성 작업이 완료되었습니다.');
  };

  const handlePause = () => {
    isPausedRef.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsProcessing(false);
    onShowToast('⏸️ 일괄 생성이 일시 정지되었습니다.');
  };

  const handleResetAll = () => {
    if (isProcessing) {
      handlePause();
    }
    setItems((prev) =>
      prev.map((it) => ({
        ...it,
        status: 'pending',
        currentStep: undefined,
        error: undefined,
        generatedTitle: undefined,
        generatedDraftHtml: undefined,
        generatedDraftPlain: undefined,
      }))
    );
    onShowToast('🔄 모든 대기열 항목이 초기화되었습니다.');
  };

  const handleRetrySingle = async (item: BatchDraftItem) => {
    if (isProcessing) {
      onShowToast('현재 일괄 작업이 진행 중입니다. 잠시 후 시도해주세요.');
      return;
    }
    updateItemStatus(item.id, 'generating', '재시도 준비 중...');
    const controller = new AbortController();
    try {
      const result = await processItem(item, controller.signal);
      if (result.success) {
        updateItemStatus(item.id, 'completed', '생성 완료', {
          generatedTitle: result.generatedTitle,
          generatedOutline: result.generatedOutline,
          generatedDraftHtml: result.generatedDraftHtml,
          generatedDraftPlain: result.generatedDraftPlain,
          completedAt: new Date().toLocaleTimeString('ko-KR'),
        });
        onShowToast(`✅ '${item.keyword}' 초안 생성이 완료되었습니다.`);
      } else {
        updateItemStatus(item.id, 'failed', '생성 실패', {
          error: result.error || '생성 실패',
        });
        onShowToast(`❌ '${item.keyword}' 초안 생성 실패: ${result.error}`);
      }
    } catch (err: any) {
      updateItemStatus(item.id, 'failed', '오류 발생', {
        error: err.message || '요청 중단',
      });
    }
  };

  const handleCopyDraft = (item: BatchDraftItem, format: 'html' | 'text') => {
    const textToCopy = format === 'html' ? item.generatedDraftHtml : item.generatedDraftPlain;
    if (!textToCopy) {
      onShowToast('복사할 초안 내용이 없습니다.');
      return;
    }

    navigator.clipboard.writeText(textToCopy).then(
      () => {
        setCopiedId(`${item.id}_${format}`);
        onShowToast(`📋 '${item.keyword}' 초안(${format === 'html' ? 'HTML' : '텍스트'})이 복사되었습니다.`);
        setTimeout(() => setCopiedId(null), 2000);
      },
      () => {
        onShowToast('클립보드 복사에 실패했습니다.');
      }
    );
  };

  const handleOpenInToolkit = (item: BatchDraftItem) => {
    onSelectKeywordForDraft(item.keyword);
    onClose();
    onShowToast(`🚀 '${item.keyword}' 초안 생성기로 이동합니다.`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* 1. Modal Header */}
        <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold text-white">
                  AI 일괄 초안 생성 대기열
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-bold border border-blue-500/30">
                  관리자 전용 배치 모드
                </span>
              </div>
              <p className="text-xs text-slate-300">
                선택한 <strong>{totalCount}개</strong> 키워드의 블로그 초안을 순차적으로 자동 생성합니다.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 2. Config Toolbar */}
        <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-slate-500" />
              <span className="font-bold text-slate-700">작성 스타일:</span>
              <select
                value={writingStyle}
                onChange={(e) => setWritingStyle(e.target.value)}
                disabled={isProcessing}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 cursor-pointer disabled:opacity-60"
              >
                <option value="auto">✨ 키워드별 자동 최적화</option>
                <option value="experience">생생 경험 리뷰형</option>
                <option value="info">정보 탐색/가이드형</option>
                <option value="purchase">구매/추천 가이드형</option>
                <option value="comparison">비교 분석형</option>
                <option value="homepan">홈판 화제형</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-700">목표 분량:</span>
              <select
                value={targetWordCount}
                onChange={(e) => setTargetWordCount(e.target.value)}
                disabled={isProcessing}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 cursor-pointer disabled:opacity-60"
              >
                <option value="1500">1,500자 (간결형)</option>
                <option value="2000">2,000자 (권장 표준)</option>
                <option value="2500">2,500자 (심층 가이드)</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-700">출력 서식:</span>
              <select
                value={outputFormat}
                onChange={(e) => setOutputFormat(e.target.value as any)}
                disabled={isProcessing}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 cursor-pointer disabled:opacity-60"
              >
                <option value="html">네이버 블로그 서식(HTML)</option>
                <option value="plain">일반 텍스트</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isProcessing ? (
              <button
                type="button"
                onClick={() => startBatchGeneration(false)}
                disabled={pendingCount === 0 && failedCount === 0}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-40 active:scale-95"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>{completedCount > 0 ? '이어서 생성 시작' : '일괄 생성 시작'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePause}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-md transition-all cursor-pointer active:scale-95"
              >
                <Pause className="w-3.5 h-3.5 fill-white" />
                <span>일시 정지</span>
              </button>
            )}

            {failedCount > 0 && !isProcessing && (
              <button
                type="button"
                onClick={() => startBatchGeneration(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>실패 ({failedCount}) 재시도</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleResetAll}
              disabled={isProcessing}
              title="대기열 상태 초기화"
              className="p-2 rounded-xl bg-slate-200/80 hover:bg-slate-300 text-slate-700 transition-colors cursor-pointer disabled:opacity-40"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 3. Progress Status Banner */}
        <div className="px-6 py-3 bg-white border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center justify-between font-bold text-slate-700">
              <span>
                진행 상황: {completedCount}/{totalCount}개 완료 ({progressPercent}%)
              </span>
              <span className="text-blue-600">
                {isProcessing ? '🔄 순차 생성 중...' : completedCount === totalCount && totalCount > 0 ? '🎉 모든 초안 생성 완료' : '대기 상태'}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-300 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 font-semibold">
              대기 <strong>{pendingCount}</strong>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-100 font-semibold">
              생성 중 <strong>{generatingCount}</strong>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 font-semibold">
              완료 <strong>{completedCount}</strong>
            </span>
            {failedCount > 0 && (
              <span className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-100 font-semibold">
                실패 <strong>{failedCount}</strong>
              </span>
            )}
          </div>
        </div>

        {/* 4. Queue List View */}
        <div className="flex-1 overflow-y-auto p-6 divide-y divide-slate-100 space-y-3">
          {items.map((item, idx) => {
            const isCompleted = item.status === 'completed';
            const isGenerating = item.status === 'generating';
            const isFailed = item.status === 'failed';
            const isPending = item.status === 'pending';

            return (
              <div
                key={item.id}
                className={`pt-3 first:pt-0 p-3.5 rounded-2xl border transition-all ${
                  isGenerating
                    ? 'bg-blue-50/60 border-blue-300 ring-2 ring-blue-500/20 shadow-xs'
                    : isCompleted
                    ? 'bg-emerald-50/30 border-emerald-200 hover:border-emerald-300'
                    : isFailed
                    ? 'bg-rose-50/30 border-rose-200'
                    : 'bg-white border-slate-200/80 hover:border-slate-300'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Left: Index, Category, Keyword, Title */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>

                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-semibold">
                          {item.category}
                        </span>
                        <span className="font-extrabold text-slate-900 text-sm">
                          {item.keyword}
                        </span>
                        {item.totalSearchVolume && (
                          <span className="text-[11px] text-slate-500">
                            검색량 {item.totalSearchVolume.toLocaleString()}회
                          </span>
                        )}
                        {item.searchIntentCategory && (
                          <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-bold">
                            {item.searchIntentCategory}
                          </span>
                        )}
                      </div>

                      {/* Status and Generated Title */}
                      {isCompleted && item.generatedTitle && (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-800 font-bold truncate">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="truncate">제목: {item.generatedTitle}</span>
                        </div>
                      )}

                      {isGenerating && (
                        <div className="flex items-center gap-1.5 text-xs text-blue-700 font-semibold animate-pulse">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600 shrink-0" />
                          <span>{item.currentStep || '초안 생성 작업 진행 중...'}</span>
                        </div>
                      )}

                      {isFailed && (
                        <div className="flex items-center gap-1.5 text-xs text-rose-700 font-medium">
                          <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          <span>실패 원인: {item.error || '생성 중 오류'}</span>
                        </div>
                      )}

                      {isPending && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          <span>대기 중</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {isCompleted && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewItem(item);
                            setPreviewTab('formatted');
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>초안 확인</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCopyDraft(item, 'html')}
                          title="HTML 복사"
                          className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                        >
                          {copiedId === `${item.id}_html` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenInToolkit(item)}
                          title="AI 초안 생성기 탭에서 편집하기"
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-xs transition-colors cursor-pointer"
                        >
                          <FileEdit className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">툴킷에서 열기</span>
                        </button>
                      </>
                    )}

                    {isFailed && !isProcessing && (
                      <button
                        type="button"
                        onClick={() => handleRetrySingle(item)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>재시도</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 5. Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              네이버 상위 노출 기준에 맞춰 목차 구성 ➔ 본문 작성이 순차적으로 안전하게 처리됩니다.
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold transition-colors cursor-pointer"
          >
            닫기
          </button>
        </div>
      </div>

      {/* Single Draft Preview Modal */}
      {previewItem && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
            {/* Preview Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                    생성 완료
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    키워드: <strong>{previewItem.keyword}</strong>
                  </span>
                </div>
                <h3 className="text-sm sm:text-base font-extrabold text-white truncate max-w-xl">
                  {previewItem.generatedTitle}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Preview Toolbar */}
            <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewTab('formatted')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    previewTab === 'formatted'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  블로그 서식 미리보기
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('raw')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    previewTab === 'raw'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  순수 텍스트(메모장)
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyDraft(previewItem, previewTab === 'formatted' ? 'html' : 'text')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors cursor-pointer shadow-xs"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{previewTab === 'formatted' ? 'HTML 서식 복사' : '텍스트 복사'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenInToolkit(previewItem)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-colors cursor-pointer shadow-xs"
                >
                  <FileEdit className="w-3.5 h-3.5" />
                  <span>AI 초안 생성기에서 열기</span>
                </button>
              </div>
            </div>

            {/* Preview Body */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
              {previewTab === 'formatted' ? (
                <div
                  className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 text-slate-900 text-sm leading-relaxed space-y-4 shadow-2xs font-sans prose prose-slate max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: previewItem.generatedDraftHtml || '<p class="text-slate-400">내용이 없습니다.</p>',
                  }}
                />
              ) : (
                <textarea
                  readOnly
                  value={previewItem.generatedDraftPlain || ''}
                  className="w-full h-full min-h-[350px] p-4 bg-white border border-slate-200 rounded-2xl text-xs text-slate-800 font-mono leading-relaxed resize-none focus:outline-none"
                />
              )}
            </div>

            {/* Preview Footer */}
            <div className="px-6 py-3 bg-white border-t border-slate-200 flex items-center justify-end text-xs shrink-0">
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold transition-colors cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
