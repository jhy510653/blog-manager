import React, { useState, useEffect } from 'react';
import {
  FileText,
  ClipboardPaste,
  Sparkles,
  RefreshCw,
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  FileCheck,
  Search,
  ExternalLink,
} from 'lucide-react';
import { VisualDocumentSource, InputSourceType } from './visualTypes';
import { fetchAllDraftSessions, UserAuthMeta } from '../../services/aiDraftSessionService';
import { AiDraftSession } from '../../types';

interface VisualInputSourceSelectorProps {
  currentDocument: VisualDocumentSource | null;
  onSelectDocument: (doc: VisualDocumentSource) => void;
  currentUser: any;
  isAdmin?: boolean;
  onShowToast: (msg: string) => void;
}

export const VisualInputSourceSelector: React.FC<VisualInputSourceSelectorProps> = ({
  currentDocument,
  onSelectDocument,
  currentUser,
  isAdmin,
  onShowToast,
}) => {
  const [activeMode, setActiveMode] = useState<InputSourceType>(
    currentDocument ? currentDocument.sourceType : 'ai_draft'
  );

  // Direct input states
  const [directTitle, setDirectTitle] = useState('');
  const [directContent, setDirectContent] = useState('');
  const [directKeyword, setDirectKeyword] = useState('');

  // AI draft session picker states
  const [draftSessions, setDraftSessions] = useState<AiDraftSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isSessionPickerOpen, setIsSessionPickerOpen] = useState(false);
  const [sessionSearchQuery, setSessionSearchQuery] = useState('');
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);

  // Load existing AI draft sessions
  const loadSessions = async () => {
    if (!currentUser) return;
    setIsLoadingSessions(true);
    try {
      const userMeta: UserAuthMeta = {
        id: currentUser.id || currentUser.naverId || '',
        email: currentUser.email,
        name: currentUser.name,
        isAdmin,
        isChallengeParticipant: true,
      };
      const sessions = await fetchAllDraftSessions(userMeta);
      // Filter sessions that have at least one completed draft
      const completedSessions = sessions.filter(
        (s) =>
          s.draftContent ||
          (s.batchItems && s.batchItems.some((b) => b.draftContent && b.draftStatus === 'completed'))
      );
      setDraftSessions(completedSessions);

      // If no document is selected yet, auto-select the latest one
      if (!currentDocument && completedSessions.length > 0) {
        const latest = completedSessions[0];
        const draftText =
          latest.draftContent ||
          latest.batchItems?.find((b) => b.draftContent)?.draftContent ||
          '';
        const title =
          latest.keyword ||
          latest.batchItems?.[0]?.seoPlan?.recommendedTitles?.[0] ||
          'AI 블로그 초안';

        const plainText = draftText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        onSelectDocument({
          id: latest.id,
          title,
          content: draftText,
          plainText,
          sourceType: 'ai_draft',
          sourceSessionId: latest.id,
          keyword: latest.keyword,
          loadedAt: new Date(),
          wordCount: plainText.length,
        });
      }
    } catch (err) {
      console.warn('Failed to load sessions for Visual tab:', err);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, [currentUser]);

  // Handle selecting a specific AI draft session
  const handleSelectSession = (session: AiDraftSession) => {
    const draftText =
      session.draftContent ||
      session.batchItems?.find((b) => b.draftContent)?.draftContent ||
      '';

    if (!draftText) {
      onShowToast('⚠️ 해당 작업 세션에 생성된 본문이 없습니다.');
      return;
    }

    const title =
      session.keyword ||
      session.batchItems?.[0]?.seoPlan?.recommendedTitles?.[0] ||
      'AI 블로그 초안';

    const plainText = draftText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    onSelectDocument({
      id: session.id,
      title,
      content: draftText,
      plainText,
      sourceType: 'ai_draft',
      sourceSessionId: session.id,
      keyword: session.keyword,
      loadedAt: new Date(),
      wordCount: plainText.length,
    });

    setIsSessionPickerOpen(false);
    onShowToast(`✓ AI 초안 '${title}' 본문을 비주얼 작업 공간으로 불러왔습니다.`);
  };

  // Handle applying direct custom text
  const handleApplyDirectInput = () => {
    if (!directContent.trim()) {
      onShowToast('⚠️ 분석할 본문 내용을 입력하거나 붙여넣어 주세요.');
      return;
    }

    const title = directTitle.trim() || directKeyword.trim() || '직접 입력한 블로그 글';
    const plainText = directContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    onSelectDocument({
      id: `custom_${Date.now()}`,
      title,
      content: directContent,
      plainText,
      sourceType: 'direct_input',
      keyword: directKeyword.trim() || undefined,
      loadedAt: new Date(),
      wordCount: plainText.length,
    });

    onShowToast('✓ 직접 입력한 본문이 비주얼 분석 대상으로 설정되었습니다.');
  };

  const filteredSessions = draftSessions.filter(
    (s) =>
      !sessionSearchQuery ||
      s.keyword?.toLowerCase().includes(sessionSearchQuery.toLowerCase()) ||
      s.batchItems?.some((b) => b.keyword?.toLowerCase().includes(sessionSearchQuery.toLowerCase()))
  );

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
      {/* Header Mode Switcher */}
      <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
            1
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <span>시각화할 블로그 본문 선택</span>
              <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                원문 안전 보존
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              AI가 작성한 초안을 불러오거나, 외부에서 작성한 글을 붙여넣어 이미지와 카드뉴스를 제작합니다.
            </p>
          </div>
        </div>

        {/* Tab switcher: AI 초안 vs 직접 붙여넣기 */}
        <div className="flex items-center bg-slate-200/80 p-1 rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => setActiveMode('ai_draft')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeMode === 'ai_draft'
                ? 'bg-white text-indigo-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI 초안 불러오기</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('direct_input')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeMode === 'direct_input'
                ? 'bg-white text-indigo-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
            <span>직접 본문 붙여넣기</span>
          </button>
        </div>
      </div>

      {/* Mode Body */}
      <div className="p-4 sm:p-5">
        {activeMode === 'ai_draft' ? (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-indigo-50/60 border border-indigo-100 rounded-xl p-3.5 text-xs">
              <div className="flex items-start gap-2.5">
                <FileCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-indigo-950">AI 초안 연동 모드:</span>
                  <span className="text-indigo-900/80 ml-1">
                    기존 초안 생성기에서 저장된 글 목록에서 원하는 글을 즉시 불러와 이미지 매칭 및 카드뉴스로 변환합니다.
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsSessionPickerOpen(true);
                  loadSessions();
                }}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shrink-0 transition-all shadow-2xs"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>저장된 초안 목록에서 선택 ({draftSessions.length}건)</span>
              </button>
            </div>

            {/* Quick Session Modal / Dropdown */}
            {isSessionPickerOpen && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center justify-between gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={sessionSearchQuery}
                      onChange={(e) => setSessionSearchQuery(e.target.value)}
                      placeholder="초안 키워드 검색..."
                      className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsSessionPickerOpen(false)}
                    className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-800 font-semibold"
                  >
                    닫기
                  </button>
                </div>

                {isLoadingSessions ? (
                  <div className="py-6 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                    <span>초안 목록 불러오는 중...</span>
                  </div>
                ) : filteredSessions.length === 0 ? (
                  <div className="py-6 text-center text-slate-500 text-xs bg-white border border-slate-200 rounded-lg">
                    저장된 AI 초안이 없습니다. AI 블로그 초안 생성기에서 먼저 글을 작성해 보세요.
                  </div>
                ) : (
                  <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                    {filteredSessions.map((session) => {
                      const isSelected = currentDocument?.id === session.id;
                      const text =
                        session.draftContent ||
                        session.batchItems?.find((b) => b.draftContent)?.draftContent ||
                        '';
                      const wordLen = text.replace(/<[^>]+>/g, '').length;

                      return (
                        <div
                          key={session.id}
                          onClick={() => handleSelectSession(session)}
                          className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between gap-3 ${
                            isSelected
                              ? 'bg-indigo-50/80 border-indigo-300 text-indigo-950 font-bold'
                              : 'bg-white border-slate-200 hover:border-indigo-200 text-slate-800 hover:bg-slate-50'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold truncate">
                                📌 {session.keyword || 'AI 블로그 초안'}
                              </span>
                              {session.status === 'saved' && (
                                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-bold shrink-0">
                                  영구보관
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">
                              {text.replace(/<[^>]+>/g, ' ').substring(0, 80)}...
                            </p>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-[11px] text-indigo-600 font-bold block">
                              약 {wordLen.toLocaleString()}자
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(session.updatedAt || session.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Direct Input Mode */
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">글 제목 (선택)</label>
                <input
                  type="text"
                  value={directTitle}
                  onChange={(e) => setDirectTitle(e.target.value)}
                  placeholder="예: 2026 성수동 핫플 카페 BEST 5 후기"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">핵심 키워드 (선택)</label>
                <input
                  type="text"
                  value={directKeyword}
                  onChange={(e) => setDirectKeyword(e.target.value)}
                  placeholder="예: 성수동 카페, 성수 핫플"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>블로그 본문 붙여넣기</span>
                <span className="text-[11px] font-normal text-slate-500">HTML 또는 일반 텍스트 모두 지원</span>
              </label>
              <textarea
                value={directContent}
                onChange={(e) => setDirectContent(e.target.value)}
                placeholder="여기에 작성해 둔 블로그 글이나 본문을 붙여넣어 주세요. AI가 문맥을 분석하여 최적의 이미지 배치와 카드뉴스 핵심 문구를 추천합니다."
                rows={5}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 font-sans"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleApplyDirectInput}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>본문 분석 대상으로 적용</span>
              </button>
            </div>
          </div>
        )}

        {/* Selected Document Summary Card */}
        {currentDocument && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-extrabold text-slate-900 truncate">
                        {currentDocument.title}
                      </h3>
                      <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-bold shrink-0">
                        {currentDocument.sourceType === 'ai_draft' ? 'AI 초안 연동' : '직접 입력'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      공백 포함 약 {currentDocument.wordCount.toLocaleString()}자 · {currentDocument.keyword ? `키워드: ${currentDocument.keyword}` : '주제 분석 완료'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsPreviewExpanded(!isPreviewExpanded)}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-100 flex items-center gap-1 cursor-pointer"
                  >
                    <span>{isPreviewExpanded ? '접기' : '본문 미리보기'}</span>
                    {isPreviewExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              {/* Collapsible preview */}
              {isPreviewExpanded && (
                <div className="mt-3 pt-3 border-t border-slate-200 text-xs text-slate-700 max-h-48 overflow-y-auto bg-white p-3 rounded-lg border border-slate-100 leading-relaxed font-sans">
                  {currentDocument.content.includes('<') ? (
                    <div
                      className="prose prose-xs max-w-none"
                      dangerouslySetInnerHTML={{ __html: currentDocument.content }}
                    />
                  ) : (
                    <p className="whitespace-pre-wrap">{currentDocument.content}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
