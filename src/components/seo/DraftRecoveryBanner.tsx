import React from 'react';
import { Sparkles, RotateCcw, Trash2, X, Clock, CheckCircle2, FileText, Layers, ImageIcon } from 'lucide-react';
import { AiDraftSession, DraftLastStep } from '../../types';

interface DraftRecoveryBannerProps {
  session: AiDraftSession;
  onRestore: () => void;
  onDiscard: () => void;
  onDismiss: () => void;
}

const STEP_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  keyword_input: { label: '키워드 및 설정 입력', icon: <FileText className="w-3.5 h-3.5" />, color: 'bg-slate-100 text-slate-700' },
  keyword: { label: '키워드 분석', icon: <FileText className="w-3.5 h-3.5" />, color: 'bg-slate-100 text-slate-700' },
  golden_keyword: { label: 'SEO 기획안 완료', icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: 'bg-blue-100 text-blue-800' },
  seo_plan: { label: 'SEO 기획안 완료', icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: 'bg-blue-100 text-blue-800' },
  draft_text: { label: 'AI 초안 본문 완료', icon: <Sparkles className="w-3.5 h-3.5" />, color: 'bg-emerald-100 text-emerald-800' },
  draft: { label: 'AI 초안 본문 완료', icon: <Sparkles className="w-3.5 h-3.5" />, color: 'bg-emerald-100 text-emerald-800' },
  images: { label: '맞춤 이미지 포함', icon: <ImageIcon className="w-3.5 h-3.5" />, color: 'bg-indigo-100 text-indigo-800' },
  image_search: { label: '이미지 탐색 완료', icon: <ImageIcon className="w-3.5 h-3.5" />, color: 'bg-indigo-100 text-indigo-800' },
  ai_image_generation: { label: 'AI 이미지 생성 완료', icon: <ImageIcon className="w-3.5 h-3.5" />, color: 'bg-indigo-100 text-indigo-800' },
  card_news: { label: '카드뉴스 제작 완료', icon: <Layers className="w-3.5 h-3.5" />, color: 'bg-purple-100 text-purple-800' },
  final_review: { label: '최종 검토 완료', icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: 'bg-teal-100 text-teal-800' },
  completed: { label: '초안 작업 완료', icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: 'bg-emerald-100 text-emerald-800' },
};

export const DraftRecoveryBanner: React.FC<DraftRecoveryBannerProps> = ({
  session,
  onRestore,
  onDiscard,
  onDismiss,
}) => {
  const stepInfo = STEP_LABELS[session.lastStep || 'keyword_input'] || STEP_LABELS.keyword_input;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return '방금 전';
      if (diffMins < 60) return `${diffMins}분 전`;
      if (diffHours < 24) return `${diffHours}시간 전`;
      return `${diffDays}일 전 (${d.toLocaleDateString('ko-KR')})`;
    } catch {
      return dateStr;
    }
  };

  const mainKeyword = session.keyword || (session.keywords && session.keywords[0]) || (session.batchItems && session.batchItems[0]?.keyword) || '작성 중인 키워드';
  const itemCount = session.batchItems?.length || (session.keywords?.length || 1);

  return (
    <div
      id="ai-draft-recovery-banner"
      className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50/80 border-2 border-emerald-300 rounded-2xl p-4 sm:p-5 text-slate-900 shadow-sm relative overflow-hidden animate-fadeIn mb-6"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5 flex-1">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
            <RotateCcw className="w-5 h-5" />
          </div>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-extrabold text-sm sm:text-base text-emerald-950 flex items-center gap-1.5">
                <span>이전에 작업 중이던 AI 초안이 있습니다</span>
              </span>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${stepInfo.color}`}>
                {stepInfo.icon}
                <span>{stepInfo.label}</span>
              </span>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed">
              키워드: <strong className="text-emerald-900 font-bold">"{mainKeyword}"</strong>
              {itemCount > 1 && <span className="text-slate-500 font-medium"> 외 {itemCount - 1}개</span>}
              <span className="mx-2 text-slate-300">|</span>
              <span className="inline-flex items-center gap-1 text-slate-500 font-medium">
                <Clock className="w-3 h-3 text-slate-400" />
                <span>마지막 저장: {formatDate(session.updatedAt || session.createdAt)}</span>
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
          <button
            id="btn-discard-draft"
            onClick={onDiscard}
            className="px-3 py-2 rounded-xl bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 hover:border-rose-200 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="이전 작업을 삭제하고 새 작업 시작"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>새로 시작</span>
          </button>

          <button
            id="btn-restore-draft"
            onClick={onRestore}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
          >
            <Sparkles className="w-4 h-4 text-emerald-100" />
            <span>이어서 계속 작성</span>
          </button>

          <button
            id="btn-dismiss-draft-banner"
            onClick={onDismiss}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
            title="배너 닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
