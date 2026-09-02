import React, { useState, useMemo } from 'react';
import {
  Announcement,
  FAQItem,
  QnAItem,
  ChallengeGroup,
  Participant,
} from '../../types';
import {
  Megaphone,
  HelpCircle,
  MessageSquare,
  Plus,
  Trash2,
  Edit3,
  Search,
  CheckCircle2,
  Clock,
  Lock,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Pin,
  Send,
  AlertCircle,
  X,
  Filter,
} from 'lucide-react';
import { RichTextEditor } from '../RichTextEditor';
import { DEFAULT_FAQ_CATEGORIES } from '../../lib/supabase';

interface AdminBoardManagementTabProps {
  announcements: Announcement[];
  faqs: FAQItem[];
  qnaPosts: QnAItem[];
  groups: ChallengeGroup[];
  participants: Participant[];
  onAddAnnouncement: (announcement: Announcement) => void;
  onUpdateAnnouncement: (announcement: Announcement) => void;
  onDeleteAnnouncement: (id: string) => void;
  onAddFaq: (faq: FAQItem) => void;
  onUpdateFaq: (faq: FAQItem) => void;
  onDeleteFaq: (id: string) => void;
  onReorderFaqs: (items: { id: string; orderIndex: number }[]) => void;
  onAddQna: (qna: QnAItem) => void;
  onUpdateQna: (qna: QnAItem) => void;
  onDeleteQna: (id: string) => void;
  onAnswerQna: (id: string, answerContent: string, answeredBy?: string) => void;
  onShowToast?: (msg: string) => void;
}

export const AdminBoardManagementTab: React.FC<AdminBoardManagementTabProps> = ({
  announcements = [],
  faqs = [],
  qnaPosts = [],
  groups = [],
  onAddAnnouncement,
  onUpdateAnnouncement,
  onDeleteAnnouncement,
  onAddFaq,
  onUpdateFaq,
  onDeleteFaq,
  onReorderFaqs,
  onDeleteQna,
  onAnswerQna,
  onShowToast,
}) => {
  const [boardSection, setBoardSection] = useState<'notice' | 'faq' | 'qna'>('notice');

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFaqCategory, setSelectedFaqCategory] = useState<string>('전체');
  const [qnaStatusFilter, setQnaStatusFilter] = useState<'all' | 'pending' | 'answered'>('all');

  // Notice Form State
  const [isNoticeModalOpen, setIsNoticeModalOpen] = useState(false);
  const [editingNoticeId, setEditingNoticeId] = useState<string | null>(null);
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeContent, setNoticeContent] = useState('');
  const [noticeIsImportant, setNoticeIsImportant] = useState(false);
  const [noticeIsPublished, setNoticeIsPublished] = useState(true);
  const [noticeTargetChallengeId, setNoticeTargetChallengeId] = useState('');
  const [noticeExternalLinkUrl, setNoticeExternalLinkUrl] = useState('');
  const [noticeExternalLinkLabel, setNoticeExternalLinkLabel] = useState('');

  // FAQ Form State
  const [isFaqModalOpen, setIsFaqModalOpen] = useState(false);
  const [editingFaqId, setEditingFaqId] = useState<string | null>(null);
  const [faqQuestion, setFaqQuestion] = useState('');
  const [faqAnswer, setFaqAnswer] = useState('');
  const [faqCategory, setFaqCategory] = useState('회원/계정');
  const [faqIsPublished, setFaqIsPublished] = useState(true);

  // Q&A Answer Modal State
  const [answeringQna, setAnsweringQna] = useState<QnAItem | null>(null);
  const [adminAnswerText, setAdminAnswerText] = useState('');

  // Delete Target Confirm State
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'notice' | 'faq' | 'qna';
    id: string;
    title: string;
  } | null>(null);

  // Filtered Notices
  const filteredNotices = useMemo(() => {
    return (announcements || [])
      .filter((n) => {
        const q = searchTerm.toLowerCase();
        return n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        if (a.isImportant && !b.isImportant) return -1;
        if (!a.isImportant && b.isImportant) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [announcements, searchTerm]);

  // Filtered FAQs
  const filteredFaqs = useMemo(() => {
    return (faqs || [])
      .filter((f) => {
        if (selectedFaqCategory !== '전체' && f.category !== selectedFaqCategory) return false;
        const q = searchTerm.toLowerCase();
        return f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q);
      })
      .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
  }, [faqs, selectedFaqCategory, searchTerm]);

  // Filtered Q&A
  const filteredQnas = useMemo(() => {
    return (qnaPosts || [])
      .filter((q) => {
        if (qnaStatusFilter === 'pending' && q.status !== 'pending') return false;
        if (qnaStatusFilter === 'answered' && q.status !== 'answered') return false;
        const query = searchTerm.toLowerCase();
        return (
          q.title.toLowerCase().includes(query) ||
          q.content.toLowerCase().includes(query) ||
          q.authorName.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [qnaPosts, qnaStatusFilter, searchTerm]);

  const pendingQnaCount = useMemo(() => {
    return (qnaPosts || []).filter((q) => q.status === 'pending').length;
  }, [qnaPosts]);

  // Handle Notice
  const handleOpenNoticeAdd = () => {
    setEditingNoticeId(null);
    setNoticeTitle('');
    setNoticeContent('');
    setNoticeIsImportant(false);
    setNoticeIsPublished(true);
    setNoticeTargetChallengeId('');
    setNoticeExternalLinkUrl('');
    setNoticeExternalLinkLabel('');
    setIsNoticeModalOpen(true);
  };

  const handleOpenNoticeEdit = (n: Announcement) => {
    setEditingNoticeId(n.id);
    setNoticeTitle(n.title);
    setNoticeContent(n.content);
    setNoticeIsImportant(Boolean(n.isImportant));
    setNoticeIsPublished(n.isPublished !== undefined ? n.isPublished : true);
    setNoticeTargetChallengeId(n.targetChallengeId || '');
    setNoticeExternalLinkUrl(n.externalLinkUrl || '');
    setNoticeExternalLinkLabel(n.externalLinkLabel || '');
    setIsNoticeModalOpen(true);
  };

  const handleNoticeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noticeTitle.trim() || !noticeContent.trim()) return;

    const today = new Date().toISOString().split('T')[0];
    const item: Announcement = {
      id: editingNoticeId || `ann_${Date.now()}`,
      title: noticeTitle.trim(),
      content: noticeContent.trim(),
      isImportant: noticeIsImportant,
      isPublished: noticeIsPublished,
      targetChallengeId: noticeTargetChallengeId || undefined,
      externalLinkUrl: noticeExternalLinkUrl.trim() || undefined,
      externalLinkLabel: noticeExternalLinkLabel.trim() || undefined,
      createdAt: today,
      authorName: '운영자',
    };

    if (editingNoticeId) {
      onUpdateAnnouncement(item);
      onShowToast?.('공지사항이 수정되었습니다.');
    } else {
      onAddAnnouncement(item);
      onShowToast?.('새 공지사항이 등록되었습니다.');
    }
    setIsNoticeModalOpen(false);
  };

  // Handle FAQ
  const handleOpenFaqAdd = () => {
    setEditingFaqId(null);
    setFaqQuestion('');
    setFaqAnswer('');
    setFaqCategory(selectedFaqCategory !== '전체' ? selectedFaqCategory : '회원/계정');
    setFaqIsPublished(true);
    setIsFaqModalOpen(true);
  };

  const handleOpenFaqEdit = (f: FAQItem) => {
    setEditingFaqId(f.id);
    setFaqQuestion(f.question);
    setFaqAnswer(f.answer);
    setFaqCategory(f.category || '회원/계정');
    setFaqIsPublished(f.isPublished !== undefined ? f.isPublished : true);
    setIsFaqModalOpen(true);
  };

  const handleFaqSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!faqQuestion.trim() || !faqAnswer.trim()) return;

    const nextOrder = editingFaqId
      ? faqs.find((f) => f.id === editingFaqId)?.orderIndex ?? 1
      : faqs.length + 1;

    const item: FAQItem = {
      id: editingFaqId || `faq_${Date.now()}`,
      question: faqQuestion.trim(),
      answer: faqAnswer.trim(),
      category: faqCategory,
      isPublished: faqIsPublished,
      orderIndex: nextOrder,
      createdAt: new Date().toISOString().split('T')[0],
      authorName: '운영자',
    };

    if (editingFaqId) {
      onUpdateFaq(item);
      onShowToast?.('FAQ가 수정되었습니다.');
    } else {
      onAddFaq(item);
      onShowToast?.('새 FAQ가 등록되었습니다.');
    }
    setIsFaqModalOpen(false);
  };

  // Handle Move FAQ
  const handleMoveFaq = (index: number, direction: 'up' | 'down') => {
    const list = [...filteredFaqs];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;

    const itemA = list[index];
    const itemB = list[targetIdx];

    const tempOrder = itemA.orderIndex;
    itemA.orderIndex = itemB.orderIndex;
    itemB.orderIndex = tempOrder;

    const reorderedPayload = list.map((f, idx) => ({ id: f.id, orderIndex: idx + 1 }));
    onReorderFaqs(reorderedPayload);
    onShowToast?.('FAQ 노출 순서가 변경되었습니다.');
  };

  // Handle Q&A Answer
  const handleOpenAnswerModal = (qna: QnAItem) => {
    setAnsweringQna(qna);
    setAdminAnswerText(qna.answerContent || '');
  };

  const handleAnswerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!answeringQna || !adminAnswerText.trim()) return;

    onAnswerQna(answeringQna.id, adminAnswerText.trim(), '운영자');
    onShowToast?.('Q&A 답변이 등록되었습니다.');
    setAnsweringQna(null);
  };

  // Handle Delete Confirmation
  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'notice') {
      onDeleteAnnouncement(deleteTarget.id);
      onShowToast?.('공지사항이 삭제되었습니다.');
    } else if (deleteTarget.type === 'faq') {
      onDeleteFaq(deleteTarget.id);
      onShowToast?.('FAQ 항목이 삭제되었습니다.');
    } else if (deleteTarget.type === 'qna') {
      onDeleteQna(deleteTarget.id);
      onShowToast?.('Q&A 질문이 삭제되었습니다.');
    }
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Sub-tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-indigo-600" />
            <span>공지사항 & 게시판 통합 관리</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            [공지사항], [자주 묻는 질문(FAQ)], [회원 Q&A 질문답변]을 한곳에서 체계적으로 관리합니다.
          </p>
        </div>

        {/* Sub-tab Pills */}
        <div className="flex items-center p-1 bg-slate-100 rounded-2xl border border-slate-200 shrink-0">
          <button
            type="button"
            onClick={() => {
              setBoardSection('notice');
              setSearchTerm('');
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              boardSection === 'notice'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Megaphone className="w-3.5 h-3.5" />
            <span>공지 관리</span>
            <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-slate-700 text-white">
              {announcements.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setBoardSection('faq');
              setSearchTerm('');
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              boardSection === 'faq'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>FAQ 관리</span>
            <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-slate-700 text-white">
              {faqs.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setBoardSection('qna');
              setSearchTerm('');
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              boardSection === 'qna'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Q&A 관리</span>
            {pendingQnaCount > 0 ? (
              <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-rose-500 text-white font-black animate-pulse">
                {pendingQnaCount} 대기
              </span>
            ) : (
              <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-slate-700 text-white">
                {qnaPosts.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 2. Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={
              boardSection === 'notice'
                ? '공지 제목/내용 검색...'
                : boardSection === 'faq'
                ? 'FAQ 질문/답변 검색...'
                : 'Q&A 제목/작성자 검색...'
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none w-full"
          />
        </div>

        {/* Section Specific Filters / Buttons */}
        <div className="flex items-center gap-2">
          {boardSection === 'faq' && (
            <div className="flex items-center gap-1">
              <select
                value={selectedFaqCategory}
                onChange={(e) => setSelectedFaqCategory(e.target.value)}
                className="px-3 py-1.5 text-xs font-bold bg-white border border-slate-200 rounded-xl outline-none"
              >
                {DEFAULT_FAQ_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleOpenFaqAdd}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>FAQ 등록</span>
              </button>
            </div>
          )}

          {boardSection === 'notice' && (
            <button
              type="button"
              onClick={handleOpenNoticeAdd}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-indigo-400" />
              <span>새 공지 작성</span>
            </button>
          )}

          {boardSection === 'qna' && (
            <div className="flex items-center gap-1 bg-white p-0.5 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setQnaStatusFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  qnaStatusFilter === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                전체
              </button>
              <button
                type="button"
                onClick={() => setQnaStatusFilter('pending')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  qnaStatusFilter === 'pending'
                    ? 'bg-amber-600 text-white'
                    : 'text-amber-700 hover:bg-amber-50'
                }`}
              >
                <Clock className="w-3 h-3" />
                <span>답변대기</span>
              </button>
              <button
                type="button"
                onClick={() => setQnaStatusFilter('answered')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  qnaStatusFilter === 'answered'
                    ? 'bg-emerald-600 text-white'
                    : 'text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                <CheckCircle2 className="w-3 h-3" />
                <span>답변완료</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3. Section Content */}
      {/* SECTION 1: NOTICES */}
      {boardSection === 'notice' && (
        <div className="space-y-3">
          {filteredNotices.length === 0 ? (
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500">
              등록된 공지사항이 없습니다.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
              {filteredNotices.map((n) => (
                <div key={n.id} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {n.isImportant && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-0.5">
                          <Pin className="w-2.5 h-2.5" />
                          <span>중요</span>
                        </span>
                      )}
                      {n.isPublished === false && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-0.5">
                          <EyeOff className="w-2.5 h-2.5" />
                          <span>비공개</span>
                        </span>
                      )}
                      <span className="text-[11px] text-slate-400 font-bold">{n.createdAt}</span>
                    </div>
                    <p className="text-xs font-black text-slate-900 truncate">{n.title}</p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenNoticeEdit(n)}
                      className="p-1.5 text-xs text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">수정</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget({ type: 'notice', id: n.id, title: n.title })}
                      className="p-1.5 text-xs text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">삭제</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: FAQs */}
      {boardSection === 'faq' && (
        <div className="space-y-3">
          {filteredFaqs.length === 0 ? (
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500">
              등록된 FAQ가 없습니다. 상단의 'FAQ 등록' 버튼으로 추가하세요.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
              {filteredFaqs.map((f, idx) => (
                <div key={f.id} className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Order buttons */}
                    <div className="flex flex-col items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMoveFaq(idx, 'up')}
                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded hover:bg-slate-100 transition-colors"
                        title="위로 이동"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === filteredFaqs.length - 1}
                        onClick={() => handleMoveFaq(idx, 'down')}
                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded hover:bg-slate-100 transition-colors"
                        title="아래로 이동"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {f.category}
                        </span>
                        {f.isPublished === false && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-0.5">
                            <EyeOff className="w-2.5 h-2.5" />
                            <span>비공개</span>
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400">순서: {f.orderIndex}</span>
                      </div>
                      <p className="text-xs font-black text-slate-900 truncate">Q. {f.question}</p>
                      <p className="text-[11px] text-slate-500 line-clamp-1">A. {f.answer}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenFaqEdit(f)}
                      className="p-1.5 text-xs text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">수정</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget({ type: 'faq', id: f.id, title: f.question })}
                      className="p-1.5 text-xs text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">삭제</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SECTION 3: Q&A */}
      {boardSection === 'qna' && (
        <div className="space-y-3">
          {filteredQnas.length === 0 ? (
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500">
              해당 조건의 Q&A 질문이 없습니다.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
              {filteredQnas.map((q) => (
                <div key={q.id} className="p-4 space-y-2 hover:bg-slate-50/80 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap text-[11px]">
                        {q.status === 'answered' ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-0.5">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            <span>답변완료</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-0.5 animate-pulse">
                            <Clock className="w-2.5 h-2.5" />
                            <span>답변대기</span>
                          </span>
                        )}

                        {q.isSecret && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-0.5">
                            <Lock className="w-2.5 h-2.5" />
                            <span>비공개</span>
                          </span>
                        )}

                        <span className="font-bold text-slate-600">{q.authorName}</span>
                        <span className="text-slate-400">{q.createdAt}</span>
                      </div>

                      <h4 className="text-xs font-black text-slate-900">{q.title}</h4>
                      <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        {q.content}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenAnswerModal(q)}
                        className="px-2.5 py-1.5 text-xs bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Send className="w-3 h-3 text-indigo-400" />
                        <span>{q.status === 'answered' ? '답변 수정' : '답변 작성'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget({ type: 'qna', id: q.id, title: q.title })}
                        className="p-1.5 text-xs text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors"
                        title="질문 삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Existing Answer Preview */}
                  {q.answerContent && (
                    <div className="mt-2 pl-4 border-l-2 border-indigo-400 bg-indigo-50/50 p-2.5 rounded-r-xl space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-indigo-900 font-bold">
                        <span>🛡️ 운영자 공식 답변 ({q.answeredBy || '운영자'})</span>
                        <span className="text-[10px] text-indigo-500">{q.answeredAt}</span>
                      </div>
                      <p className="text-xs text-slate-700 whitespace-pre-wrap">{q.answerContent}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Notice Add / Edit Modal */}
      {isNoticeModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-base font-black text-slate-900">
                {editingNoticeId ? '공지사항 수정' : '새 공지사항 작성'}
              </h4>
              <button
                type="button"
                onClick={() => setIsNoticeModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleNoticeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">공지 제목 *</label>
                <input
                  type="text"
                  required
                  value={noticeTitle}
                  onChange={(e) => setNoticeTitle(e.target.value)}
                  placeholder="공지사항 제목을 입력하세요"
                  className="w-full px-3.5 py-2 text-xs font-bold border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">본문 내용 *</label>
                <RichTextEditor
                  value={noticeContent}
                  onChange={setNoticeContent}
                  placeholder="공지 내용을 작성하세요..."
                  minHeight="220px"
                />
              </div>

              <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <label className="flex items-center gap-2 text-xs font-bold text-rose-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={noticeIsImportant}
                    onChange={(e) => setNoticeIsImportant(e.target.checked)}
                    className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
                  />
                  <span>📌 중요 공지로 고정</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={noticeIsPublished}
                    onChange={(e) => setNoticeIsPublished(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>즉시 공개</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNoticeModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={!noticeTitle.trim() || !noticeContent.trim()}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  {editingNoticeId ? '수정 완료' : '등록하기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FAQ Add / Edit Modal */}
      {isFaqModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-base font-black text-slate-900">
                {editingFaqId ? 'FAQ 수정' : '새 FAQ 등록'}
              </h4>
              <button
                type="button"
                onClick={() => setIsFaqModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFaqSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">카테고리 *</label>
                <select
                  value={faqCategory}
                  onChange={(e) => setFaqCategory(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs font-bold border border-slate-200 rounded-xl outline-none"
                >
                  {DEFAULT_FAQ_CATEGORIES.filter((c) => c !== '전체').map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">질문 제목 (Question) *</label>
                <input
                  type="text"
                  required
                  value={faqQuestion}
                  onChange={(e) => setFaqQuestion(e.target.value)}
                  placeholder="예: 챌린지 100% 완주 환급 신청은 언제 어떻게 하나요?"
                  className="w-full px-3.5 py-2 text-xs font-bold border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">답변 내용 (Answer) *</label>
                <textarea
                  rows={5}
                  required
                  value={faqAnswer}
                  onChange={(e) => setFaqAnswer(e.target.value)}
                  placeholder="회원님들에게 안내할 명확하고 친절한 답변을 작성하세요..."
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={faqIsPublished}
                    onChange={(e) => setFaqIsPublished(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>사용자 화면에 노출 (공개)</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFaqModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={!faqQuestion.trim() || !faqAnswer.trim()}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  {editingFaqId ? '수정 완료' : '등록하기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Answer Q&A Modal */}
      {answeringQna && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-base font-black text-slate-900">Q&A 관리자 공식 답변 작성</h4>
              <button
                type="button"
                onClick={() => setAnsweringQna(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Question Brief */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-500 font-bold">
                <span>작성자: {answeringQna.authorName}</span>
                <span>{answeringQna.createdAt}</span>
              </div>
              <p className="text-xs font-black text-slate-900">{answeringQna.title}</p>
              <p className="text-xs text-slate-600 whitespace-pre-wrap">{answeringQna.content}</p>
            </div>

            <form onSubmit={handleAnswerSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  운영자 답변 내용 <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={6}
                  required
                  value={adminAnswerText}
                  onChange={(e) => setAdminAnswerText(e.target.value)}
                  placeholder="회원 질문에 대한 성실하고 명확한 답변을 작성하세요..."
                  className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAnsweringQna(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={!adminAnswerText.trim()}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>답변 등록 및 완료</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Target Confirm Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-sm p-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-black text-slate-900">항목 삭제 확인</h4>
              <p className="text-xs text-slate-600">
                정말 <span className="font-bold text-rose-600">"{deleteTarget.title}"</span> 항목을 삭제하시겠습니까?
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-xs cursor-pointer"
              >
                삭제하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
