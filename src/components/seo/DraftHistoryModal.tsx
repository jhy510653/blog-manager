import React, { useEffect, useState } from 'react';
import { X, Clock, FileText, CheckCircle2, Sparkles, Layers, ImageIcon, Trash2, Search } from 'lucide-react';
import { AiDraftSession, DraftLastStep } from '../../types';
import { fetchAllDraftSessions, deleteDraftSession } from '../../services/aiDraftSessionService';

interface DraftHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestore: (session: AiDraftSession) => void;
  currentUser: any;
  isAdmin: boolean;
  onShowToast?: (msg: string) => void;
}

const STEP_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  keyword_input: { label: '설정 입력', icon: <FileText className="w-3.5 h-3.5" />, color: 'bg-slate-100 text-slate-700' },
  keyword: { label: '키워드', icon: <FileText className="w-3.5 h-3.5" />, color: 'bg-slate-100 text-slate-700' },
  golden_keyword: { label: 'SEO 기획', icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: 'bg-blue-100 text-blue-800' },
  seo_plan: { label: 'SEO 기획', icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: 'bg-blue-100 text-blue-800' },
  draft_text: { label: 'AI 본문', icon: <Sparkles className="w-3.5 h-3.5" />, color: 'bg-emerald-100 text-emerald-800' },
  draft: { label: 'AI 본문', icon: <Sparkles className="w-3.5 h-3.5" />, color: 'bg-emerald-100 text-emerald-800' },
  images: { label: '이미지 포함', icon: <ImageIcon className="w-3.5 h-3.5" />, color: 'bg-indigo-100 text-indigo-800' },
  image_search: { label: '이미지 탐색', icon: <ImageIcon className="w-3.5 h-3.5" />, color: 'bg-indigo-100 text-indigo-800' },
  ai_image_generation: { label: 'AI 이미지', icon: <ImageIcon className="w-3.5 h-3.5" />, color: 'bg-indigo-100 text-indigo-800' },
  card_news: { label: '카드뉴스', icon: <Layers className="w-3.5 h-3.5" />, color: 'bg-purple-100 text-purple-800' },
  final_review: { label: '검토 완료', icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: 'bg-teal-100 text-teal-800' },
  completed: { label: '작업 완료', icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: 'bg-emerald-100 text-emerald-800' },
};

export const DraftHistoryModal: React.FC<DraftHistoryModalProps> = ({
  isOpen,
  onClose,
  onRestore,
  currentUser,
  isAdmin,
  onShowToast,
}) => {
  const [sessions, setSessions] = useState<AiDraftSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isOpen && currentUser) {
      loadSessions();
    }
  }, [isOpen, currentUser]);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const data = await fetchAllDraftSessions({
        id: currentUser.id || currentUser.naverId,
        email: currentUser.email,
        name: currentUser.name,
        isAdmin,
        isChallengeParticipant: true,
      });
      setSessions(data);
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    // 즉각적인 UI 반영을 위해 로컬 상태에서 바로 필터링 삭제
    setSessions(prev => prev.filter(s => s.id !== id));
    if (onShowToast) {
      onShowToast('🗑️ 보관 내역이 삭제되었습니다.');
    }
    
    try {
      await deleteDraftSession(id, currentUser?.id || currentUser?.naverId, {
        isAdmin,
        isChallengeParticipant: true,
      });
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('ko-KR', { 
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  if (!isOpen) return null;

  const filteredSessions = sessions.filter(s => {
    const keyword = s.keyword || '';
    const keywordsStr = s.keywords?.join(' ') || '';
    const title = s.title || '';
    return keyword.includes(searchTerm) || keywordsStr.includes(searchTerm) || title.includes(searchTerm);
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-fadeIn"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-bold text-slate-800">작업 보관함 및 임시저장 내역</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="키워드 또는 제목으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mb-4" />
              <p className="text-sm font-medium">임시저장 내역을 불러오는 중...</p>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-slate-500 font-medium">저장된 작업 내역이 없습니다.</p>
              {searchTerm && <p className="text-sm text-slate-400 mt-1">다른 검색어를 입력해보세요.</p>}
            </div>
          ) : (
            filteredSessions.map((session) => {
              const stepInfo = STEP_LABELS[session.lastStep || 'keyword_input'] || STEP_LABELS.keyword_input;
              const mainKeyword = session.title || session.keyword || (session.keywords && session.keywords[0]) || '제목 없음';
              const isSaved = session.status === 'saved';

              return (
                <div 
                  key={session.id}
                  onClick={() => onRestore(session)}
                  className="group relative flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30 hover:shadow-md cursor-pointer transition-all gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <h3 className="font-bold text-slate-800 text-base truncate">
                        {mainKeyword}
                      </h3>
                      {isSaved ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                          보관됨
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                          임시저장
                        </span>
                      )}
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${stepInfo.color} shrink-0`}>
                        {stepInfo.icon}
                        <span>{stepInfo.label}</span>
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(session.updatedAt)}
                      </span>
                      {(session.keywords && session.keywords.length > 1) && (
                        <span>포함 키워드: {session.keywords.length}개</span>
                      )}
                      {session.style && (
                        <span>스타일: {session.style}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 mt-2 sm:mt-0">
                    <button
                      onClick={(e) => handleDelete(e, session.id)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg shadow-sm group-hover:bg-emerald-500 transition-colors w-full sm:w-auto text-center">
                      불러오기
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
