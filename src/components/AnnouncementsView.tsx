import React, { useState, useMemo, useEffect } from 'react';
import {
  Announcement,
  ChallengeResource,
  ChallengeGroup,
  Participant,
  NaverUser,
  FAQItem,
  QnAItem,
} from '../types';
import { toValidUuid, DEFAULT_FAQ_CATEGORIES } from '../lib/supabase';
import {
  Megaphone,
  BookOpen,
  HelpCircle,
  MessageSquare,
  Plus,
  Trash2,
  Edit3,
  Calendar,
  User,
  X,
  CheckCircle2,
  Pin,
  Search,
  ChevronRight,
  ChevronDown,
  Lock,
  FileText,
  ExternalLink,
  Download,
  Video,
  Layers,
  Sparkles,
  AlertCircle,
  Eye,
  EyeOff,
  Check,
  Image as ImageIcon,
  Clock,
  Send,
  ArrowUp,
  ArrowDown,
  ShieldCheck,
  CornerDownRight,
  Filter,
} from 'lucide-react';
import { ResourcesView } from './ResourcesView';
import { RichTextEditor } from './RichTextEditor';
import { stripHtmlToPlainText, extractThumbnailFromHtml } from '../utils/htmlUtils';

interface AnnouncementsViewProps {
  announcements?: Announcement[];
  faqs?: FAQItem[];
  qnaPosts?: QnAItem[];
  resources?: ChallengeResource[];
  groups?: ChallengeGroup[];
  participants?: Participant[];
  currentUser: NaverUser | null;
  isAdminLoggedIn: boolean;
  onAddAnnouncement: (announcement: Announcement) => void;
  onDeleteAnnouncement: (id: string) => void;
  onUpdateAnnouncement: (announcement: Announcement) => void;
  onAddFaq?: (faq: FAQItem) => void;
  onUpdateFaq?: (faq: FAQItem) => void;
  onDeleteFaq?: (id: string) => void;
  onReorderFaqs?: (items: { id: string; orderIndex: number }[]) => void;
  onAddQna?: (qna: QnAItem) => void;
  onUpdateQna?: (qna: QnAItem) => void;
  onDeleteQna?: (id: string) => void;
  onAnswerQna?: (id: string, answerContent: string, answeredBy?: string) => void;
  onAddResource: (resource: ChallengeResource) => void;
  onDeleteResource: (id: string) => void;
  onUpdateResource: (resource: ChallengeResource) => void;
  initialSubTab?: 'announcements' | 'notice' | 'faq' | 'qna' | 'resources';
  initialSelectedAnnouncement?: Announcement | null;
  onNavigate?: (path: string) => void;
}

export const AnnouncementsView: React.FC<AnnouncementsViewProps> = ({
  announcements = [],
  faqs = [],
  qnaPosts = [],
  resources = [],
  groups = [],
  participants = [],
  currentUser,
  isAdminLoggedIn,
  onAddAnnouncement,
  onDeleteAnnouncement,
  onUpdateAnnouncement,
  onAddFaq,
  onUpdateFaq,
  onDeleteFaq,
  onReorderFaqs,
  onAddQna,
  onUpdateQna,
  onDeleteQna,
  onAnswerQna,
  onAddResource,
  onDeleteResource,
  onUpdateResource,
  initialSubTab = 'notice',
  initialSelectedAnnouncement = null,
  onNavigate,
}) => {
  // Normalize tab key ('announcements' mapped to 'notice')
  const normalizeTab = (tab: string): 'notice' | 'faq' | 'qna' | 'resources' => {
    if (tab === 'announcements') return 'notice';
    if (tab === 'faq' || tab === 'qna' || tab === 'resources') return tab;
    return 'notice';
  };

  const [activeSubTab, setActiveSubTab] = useState<'notice' | 'faq' | 'qna' | 'resources'>(() =>
    normalizeTab(initialSubTab)
  );

  useEffect(() => {
    setActiveSubTab(normalizeTab(initialSubTab));
  }, [initialSubTab]);

  const [searchTerm, setSearchTerm] = useState('');

  // ----------------------------------------------------
  // 1. ANNOUNCEMENTS (NOTICE) STATE & HANDLERS
  // ----------------------------------------------------
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(
    initialSelectedAnnouncement
  );
  const [isNoticeFormOpen, setIsNoticeFormOpen] = useState(false);
  const [editingNoticeId, setEditingNoticeId] = useState<string | null>(null);
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeContent, setNoticeContent] = useState('');
  const [noticeThumbnailUrl, setNoticeThumbnailUrl] = useState('');
  const [noticeIsImportant, setNoticeIsImportant] = useState(false);
  const [noticeIsPublished, setNoticeIsPublished] = useState(true);
  const [noticeTargetChallengeId, setNoticeTargetChallengeId] = useState('');
  const [noticeExternalLinkUrl, setNoticeExternalLinkUrl] = useState('');
  const [noticeExternalLinkLabel, setNoticeExternalLinkLabel] = useState('');

  // Confirmation popup state for deleting announcement
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{
    type: 'notice' | 'faq' | 'qna';
    id: string;
    title: string;
  } | null>(null);

  // Helper to extract first image from HTML content if no explicit thumbnailUrl
  const extractThumbnail = (html: string, explicitUrl?: string): string => {
    return extractThumbnailFromHtml(html, explicitUrl);
  };

  // Helper to strip HTML tags for card summary text
  const stripHtml = (html: string): string => {
    return stripHtmlToPlainText(html);
  };

  const filteredAnnouncements = useMemo(() => {
    return (announcements || [])
      .filter((a) => {
        if (!isAdminLoggedIn && a.isPublished === false) return false;
        const q = searchTerm.toLowerCase();
        const matchesSearch =
          a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q);
        return matchesSearch;
      })
      .sort((a, b) => {
        if (a.isImportant && !b.isImportant) return -1;
        if (!a.isImportant && b.isImportant) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [announcements, searchTerm, isAdminLoggedIn]);

  const handleOpenNoticeAddForm = () => {
    setEditingNoticeId(null);
    setNoticeTitle('');
    setNoticeContent('');
    setNoticeThumbnailUrl('');
    setNoticeIsImportant(false);
    setNoticeIsPublished(true);
    setNoticeTargetChallengeId('');
    setNoticeExternalLinkUrl('');
    setNoticeExternalLinkLabel('');
    setIsNoticeFormOpen(true);
  };

  const handleOpenNoticeEditForm = (a: Announcement, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingNoticeId(a.id);
    setNoticeTitle(a.title);
    setNoticeContent(a.content);
    setNoticeThumbnailUrl(a.thumbnailUrl || '');
    setNoticeIsImportant(Boolean(a.isImportant));
    setNoticeIsPublished(a.isPublished !== undefined ? a.isPublished : true);
    setNoticeTargetChallengeId(a.targetChallengeId || '');
    setNoticeExternalLinkUrl(a.externalLinkUrl || '');
    setNoticeExternalLinkLabel(a.externalLinkLabel || '');
    setIsNoticeFormOpen(true);
  };

  const handleNoticeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noticeTitle.trim() || !noticeContent.trim()) return;

    const existingAnn = editingNoticeId ? announcements.find((a) => a.id === editingNoticeId) : null;
    const today = new Date().toISOString().split('T')[0];
    const generatedId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : toValidUuid(`ann_${Date.now()}_${Math.random()}`);

    const extractedThumb = extractThumbnail(noticeContent, noticeThumbnailUrl);

    const newNotice: Announcement = {
      id: editingNoticeId || generatedId,
      title: noticeTitle.trim(),
      content: noticeContent.trim(),
      thumbnailUrl: extractedThumb || undefined,
      isImportant: noticeIsImportant,
      isPublished: noticeIsPublished,
      targetChallengeId: noticeTargetChallengeId || undefined,
      externalLinkUrl: noticeExternalLinkUrl.trim() || undefined,
      externalLinkLabel: noticeExternalLinkLabel.trim() || undefined,
      createdAt: existingAnn ? existingAnn.createdAt : today,
      authorName: existingAnn ? existingAnn.authorName || '운영자' : '운영자',
    };

    if (editingNoticeId) {
      onUpdateAnnouncement(newNotice);
      if (selectedAnnouncement?.id === editingNoticeId) {
        setSelectedAnnouncement(newNotice);
      }
    } else {
      onAddAnnouncement(newNotice);
      setSelectedAnnouncement(newNotice);
    }

    setIsNoticeFormOpen(false);
  };

  // ----------------------------------------------------
  // 2. FAQ STATE & HANDLERS
  // ----------------------------------------------------
  const [selectedFaqCategory, setSelectedFaqCategory] = useState<string>('전체');
  const [expandedFaqIds, setExpandedFaqIds] = useState<Record<string, boolean>>({});
  const [isFaqFormOpen, setIsFaqFormOpen] = useState(false);
  const [editingFaqId, setEditingFaqId] = useState<string | null>(null);
  const [faqQuestion, setFaqQuestion] = useState('');
  const [faqAnswer, setFaqAnswer] = useState('');
  const [faqCategory, setFaqCategory] = useState('회원/계정');
  const [faqIsPublished, setFaqIsPublished] = useState(true);

  const toggleFaqExpand = (id: string) => {
    setExpandedFaqIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const filteredFaqs = useMemo(() => {
    return (faqs || [])
      .filter((f) => {
        if (!isAdminLoggedIn && f.isPublished === false) return false;
        if (selectedFaqCategory !== '전체' && f.category !== selectedFaqCategory) return false;
        const q = searchTerm.toLowerCase();
        return (
          f.question.toLowerCase().includes(q) ||
          f.answer.toLowerCase().includes(q) ||
          (f.category && f.category.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
  }, [faqs, selectedFaqCategory, searchTerm, isAdminLoggedIn]);

  const handleOpenFaqAdd = () => {
    setEditingFaqId(null);
    setFaqQuestion('');
    setFaqAnswer('');
    setFaqCategory(selectedFaqCategory !== '전체' ? selectedFaqCategory : '회원/계정');
    setFaqIsPublished(true);
    setIsFaqFormOpen(true);
  };

  const handleOpenFaqEdit = (f: FAQItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingFaqId(f.id);
    setFaqQuestion(f.question);
    setFaqAnswer(f.answer);
    setFaqCategory(f.category || '회원/계정');
    setFaqIsPublished(f.isPublished !== undefined ? f.isPublished : true);
    setIsFaqFormOpen(true);
  };

  const handleFaqSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!faqQuestion.trim() || !faqAnswer.trim()) return;

    const existingFaq = editingFaqId ? faqs.find((f) => f.id === editingFaqId) : null;
    const nextOrder = existingFaq ? existingFaq.orderIndex : faqs.length + 1;

    const item: FAQItem = {
      id: editingFaqId || `faq_${Date.now()}`,
      question: faqQuestion.trim(),
      answer: faqAnswer.trim(),
      category: faqCategory,
      isPublished: faqIsPublished,
      orderIndex: nextOrder,
      createdAt: existingFaq?.createdAt || new Date().toISOString().split('T')[0],
      authorName: '운영자',
    };

    if (editingFaqId) {
      onUpdateFaq?.(item);
    } else {
      onAddFaq?.(item);
      setExpandedFaqIds((prev) => ({ ...prev, [item.id]: true }));
    }
    setIsFaqFormOpen(false);
  };

  const handleMoveFaq = (index: number, direction: 'up' | 'down', e: React.MouseEvent) => {
    e.stopPropagation();
    const list = [...filteredFaqs];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;

    const itemA = list[index];
    const itemB = list[targetIdx];

    const tempOrder = itemA.orderIndex;
    itemA.orderIndex = itemB.orderIndex;
    itemB.orderIndex = tempOrder;

    const reorderedPayload = list.map((f, idx) => ({ id: f.id, orderIndex: idx + 1 }));
    onReorderFaqs?.(reorderedPayload);
  };

  // ----------------------------------------------------
  // 3. Q&A STATE & HANDLERS
  // ----------------------------------------------------
  const [qnaFilter, setQnaFilter] = useState<'all' | 'pending' | 'answered' | 'my'>('all');
  const [expandedQnaIds, setExpandedQnaIds] = useState<Record<string, boolean>>({});
  const [isQnaQuestionModalOpen, setIsQnaQuestionModalOpen] = useState(false);
  const [editingQnaId, setEditingQnaId] = useState<string | null>(null);
  const [qnaTitle, setQnaTitle] = useState('');
  const [qnaContent, setQnaContent] = useState('');
  const [qnaIsSecret, setQnaIsSecret] = useState(false);

  // Admin Answer Modal
  const [answeringQnaTarget, setAnsweringQnaTarget] = useState<QnAItem | null>(null);
  const [adminAnswerText, setAdminAnswerText] = useState('');

  const currentUserId = currentUser?.id || currentUser?.naverId || '';

  const toggleQnaExpand = (id: string) => {
    setExpandedQnaIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const filteredQnas = useMemo(() => {
    return (qnaPosts || [])
      .filter((q) => {
        if (!isAdminLoggedIn && q.isPublished === false) return false;
        if (qnaFilter === 'pending' && q.status !== 'pending') return false;
        if (qnaFilter === 'answered' && q.status !== 'answered') return false;
        if (qnaFilter === 'my') {
          if (!currentUserId) return false;
          if (q.userId !== currentUserId) return false;
        }
        const query = searchTerm.toLowerCase();
        return (
          q.title.toLowerCase().includes(query) ||
          q.content.toLowerCase().includes(query) ||
          q.authorName.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [qnaPosts, qnaFilter, searchTerm, currentUserId, isAdminLoggedIn]);

  const handleOpenQnaCreate = () => {
    if (!currentUser && !isAdminLoggedIn) {
      alert('질문을 등록하시려면 먼저 네이버 아이디로 로그인해주세요.');
      return;
    }
    setEditingQnaId(null);
    setQnaTitle('');
    setQnaContent('');
    setQnaIsSecret(false);
    setIsQnaQuestionModalOpen(true);
  };

  const handleOpenQnaEdit = (q: QnAItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingQnaId(q.id);
    setQnaTitle(q.title);
    setQnaContent(q.content);
    setQnaIsSecret(Boolean(q.isSecret));
    setIsQnaQuestionModalOpen(true);
  };

  const handleQnaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!qnaTitle.trim() || !qnaContent.trim()) return;

    const existingQna = editingQnaId ? qnaPosts.find((q) => q.id === editingQnaId) : null;
    const authorName = currentUser?.name || currentUser?.nickname || '회원';
    const authorEmail = currentUser?.email || undefined;
    const userId = currentUserId || (isAdminLoggedIn ? 'admin' : `user_${Date.now()}`);

    const item: QnAItem = {
      id: editingQnaId || `qna_${Date.now()}`,
      title: qnaTitle.trim(),
      content: qnaContent.trim(),
      userId: existingQna?.userId || userId,
      authorName: existingQna?.authorName || authorName,
      authorEmail: existingQna?.authorEmail || authorEmail,
      isSecret: qnaIsSecret,
      status: existingQna?.status || 'pending',
      answerContent: existingQna?.answerContent,
      answeredAt: existingQna?.answeredAt,
      answeredBy: existingQna?.answeredBy,
      isPublished: true,
      createdAt: existingQna?.createdAt || new Date().toISOString().split('T')[0],
    };

    if (editingQnaId) {
      onUpdateQna?.(item);
    } else {
      onAddQna?.(item);
      setExpandedQnaIds((prev) => ({ ...prev, [item.id]: true }));
    }
    setIsQnaQuestionModalOpen(false);
  };

  const handleOpenAnswerModal = (q: QnAItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setAnsweringQnaTarget(q);
    setAdminAnswerText(q.answerContent || '');
  };

  const handleAnswerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!answeringQnaTarget || !adminAnswerText.trim()) return;

    onAnswerQna?.(answeringQnaTarget.id, adminAnswerText.trim(), '운영자');
    setExpandedQnaIds((prev) => ({ ...prev, [answeringQnaTarget.id]: true }));
    setAnsweringQnaTarget(null);
  };

  // ----------------------------------------------------
  // 4. CONFIRM DELETE HANDLER
  // ----------------------------------------------------
  const handleConfirmDelete = () => {
    if (!deleteConfirmTarget) return;
    if (deleteConfirmTarget.type === 'notice') {
      onDeleteAnnouncement(deleteConfirmTarget.id);
      if (selectedAnnouncement?.id === deleteConfirmTarget.id) {
        setSelectedAnnouncement(null);
      }
    } else if (deleteConfirmTarget.type === 'faq') {
      onDeleteFaq?.(deleteConfirmTarget.id);
    } else if (deleteConfirmTarget.type === 'qna') {
      onDeleteQna?.(deleteConfirmTarget.id);
    }
    setDeleteConfirmTarget(null);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* 1. TOP HEADER & UNIFIED CATEGORY TABS */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-black shadow-xs">
              {activeSubTab === 'notice' && <Megaphone className="w-5 h-5" />}
              {activeSubTab === 'faq' && <HelpCircle className="w-5 h-5 text-indigo-600" />}
              {activeSubTab === 'qna' && <MessageSquare className="w-5 h-5 text-emerald-600" />}
              {activeSubTab === 'resources' && <BookOpen className="w-5 h-5 text-amber-600" />}
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>
                  {activeSubTab === 'notice' && '공지사항 & 소식'}
                  {activeSubTab === 'faq' && '자주 묻는 질문 (FAQ)'}
                  {activeSubTab === 'qna' && '회원 1:1 Q&A 질문답변'}
                  {activeSubTab === 'resources' && '커리큘럼 자료실 (자료 & 템플릿)'}
                </span>
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {activeSubTab === 'notice' && '챌린지 주요 일정, 수강 안내, 필독 공지사항을 확인하세요.'}
                {activeSubTab === 'faq' && '회원님들이 자주 문의하시는 핵심 질문과 가이드를 확인하세요.'}
                {activeSubTab === 'qna' && '궁금하신 점을 질문하시면 운영진이 신속하고 정확하게 답변드립니다.'}
                {activeSubTab === 'resources' && '공정위 문구 가이드, 키워드 모음, 챌린지 템플릿을 한눈에 확인하세요.'}
              </p>
            </div>
          </div>
        </div>

        {/* 4 Category Tabs Switcher: [공지] [FAQ] [Q&A] [자료실] */}
        <div className="flex items-center p-1 bg-slate-100/90 rounded-2xl border border-slate-200/80 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => {
              setActiveSubTab('notice');
              setSearchTerm('');
              if (onNavigate) onNavigate('/notices');
            }}
            className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeSubTab === 'notice'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Megaphone className="w-3.5 h-3.5 text-indigo-400" />
            <span>공지</span>
            {announcements.length > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-indigo-500 text-white font-black">
                {announcements.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveSubTab('faq');
              setSearchTerm('');
            }}
            className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeSubTab === 'faq'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
            <span>FAQ</span>
            {faqs.length > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-indigo-600 text-white font-black">
                {faqs.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveSubTab('qna');
              setSearchTerm('');
            }}
            className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeSubTab === 'qna'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
            <span>Q&A</span>
            {qnaPosts.length > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-emerald-600 text-white font-black">
                {qnaPosts.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveSubTab('resources');
              setSearchTerm('');
              if (onNavigate) onNavigate('/resources');
            }}
            className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeSubTab === 'resources'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span>자료실</span>
            {resources.length > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-amber-500 text-white font-black">
                {resources.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------ */}
      {/* TAB 1: [공지] NOTICES CONTENT                                */}
      {/* ------------------------------------------------------------ */}
      {activeSubTab === 'notice' && (
        <div className="space-y-4">
          {/* Action Bar (Search & Admin Write Button) */}
          <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="공지사항 제목, 내용 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none w-full"
              />
            </div>

            {isAdminLoggedIn && (
              <button
                type="button"
                onClick={handleOpenNoticeAddForm}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4 text-indigo-400" />
                <span>공지사항 작성</span>
              </button>
            )}
          </div>

          {/* Card Grid */}
          {filteredAnnouncements.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200/90 p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                <Megaphone className="w-6 h-6" />
              </div>
              <p className="text-sm font-extrabold text-slate-700">등록된 공지사항이 없습니다.</p>
              <p className="text-xs text-slate-400">새로운 공지사항이 등록되면 여기에 표시됩니다.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {filteredAnnouncements.map((a) => {
                const thumb = extractThumbnail(a.content, a.thumbnailUrl);
                const summary = a.summary || stripHtml(a.content);
                const targetGroupName = groups.find((g) => g.id === a.targetChallengeId)?.name;

                return (
                  <div
                    key={a.id}
                    onClick={() => {
                      if (onNavigate) {
                        onNavigate(`/notices/${a.id}`);
                      } else {
                        setSelectedAnnouncement(a);
                      }
                    }}
                    className="group bg-white rounded-3xl border border-slate-200/90 shadow-2xs hover:shadow-xl hover:border-indigo-300 hover:-translate-y-1 transition-all duration-200 flex flex-col overflow-hidden cursor-pointer"
                  >
                    {/* Thumbnail */}
                    <div className="relative w-full h-44 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center overflow-hidden">
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={a.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center p-4 text-center space-y-2 text-white/90">
                          <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-xs flex items-center justify-center border border-white/20">
                            <Megaphone className="w-6 h-6 text-indigo-300" />
                          </div>
                          <span className="text-[11px] font-black tracking-wider text-indigo-200/90 uppercase">
                            공지사항
                          </span>
                        </div>
                      )}

                      {/* Important Pin / Target Challenge Badge */}
                      <div className="absolute top-3 left-3 flex items-center gap-1.5">
                        {a.isImportant && (
                          <span className="px-2.5 py-1 rounded-xl text-[10px] font-black bg-rose-600 text-white shadow-xs flex items-center gap-1">
                            <Pin className="w-3 h-3 fill-current" />
                            <span>중요 공지</span>
                          </span>
                        )}
                        {targetGroupName && (
                          <span className="px-2.5 py-1 rounded-xl text-[10px] font-black bg-indigo-600/90 text-white backdrop-blur-xs shadow-xs">
                            {targetGroupName}
                          </span>
                        )}
                      </div>

                      {/* Admin Published Status */}
                      {isAdminLoggedIn && a.isPublished === false && (
                        <div className="absolute top-3 right-3 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-500 text-white shadow-xs flex items-center gap-1">
                          <EyeOff className="w-3 h-3" />
                          <span>비공개</span>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[11px] text-slate-400 font-bold">
                          <span className="flex items-center gap-1 text-slate-500">
                            <User className="w-3 h-3 text-slate-400" />
                            <span>{a.authorName || '운영자'}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span>{a.createdAt}</span>
                          </span>
                        </div>

                        <h3 className="text-base font-black text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-2 tracking-tight">
                          {a.title}
                        </h3>

                        <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">{summary}</p>
                      </div>

                      {/* Footer */}
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                        {a.externalLinkUrl ? (
                          <a
                            href={a.externalLinkUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-xs font-black text-indigo-600 hover:text-indigo-800"
                          >
                            <span>{a.externalLinkLabel || '바로가기'}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-xs font-extrabold text-slate-400 group-hover:text-indigo-600 flex items-center gap-0.5">
                            <span>자세히 보기</span>
                            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                          </span>
                        )}

                        {isAdminLoggedIn && (
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={(e) => handleOpenNoticeEditForm(a, e)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                              title="공지 수정"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteConfirmTarget({ type: 'notice', id: a.id, title: a.title })
                              }
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="공지 삭제"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------ */}
      {/* TAB 2: [FAQ] ACCORDION UI                                    */}
      {/* ------------------------------------------------------------ */}
      {activeSubTab === 'faq' && (
        <div className="space-y-4">
          {/* Top Category Chips & Search Bar */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200/90 shadow-2xs space-y-3">
            {/* Category Filter Chips */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {DEFAULT_FAQ_CATEGORIES.map((cat) => {
                const count =
                  cat === '전체'
                    ? (faqs || []).filter((f) => isAdminLoggedIn || f.isPublished !== false).length
                    : (faqs || []).filter(
                        (f) => f.category === cat && (isAdminLoggedIn || f.isPublished !== false)
                      ).length;

                const isSelected = selectedFaqCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedFaqCategory(cat)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
                    }`}
                  >
                    <span>{cat}</span>
                    <span
                      className={`px-1.5 py-0.2 text-[10px] rounded-full font-bold ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Search and Admin Add Button */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
              <div className="relative flex-1 min-w-[220px] max-w-md">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="자주 묻는 질문 검색 (예: 환급, 과제 제출, 템플릿)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none w-full"
                />
              </div>

              {isAdminLoggedIn && (
                <button
                  type="button"
                  onClick={handleOpenFaqAdd}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>FAQ 추가하기</span>
                </button>
              )}
            </div>
          </div>

          {/* Accordion List */}
          {filteredFaqs.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200/90 p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                <HelpCircle className="w-6 h-6" />
              </div>
              <p className="text-sm font-extrabold text-slate-700">해당 카테고리에 등록된 질문이 없습니다.</p>
              <p className="text-xs text-slate-400">다른 카테고리를 선택하시거나 검색어를 변경해보세요.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredFaqs.map((faq, idx) => {
                const isExpanded = Boolean(expandedFaqIds[faq.id]);
                return (
                  <div
                    key={faq.id}
                    className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-2xs ${
                      isExpanded
                        ? 'border-indigo-300 ring-2 ring-indigo-50/80 shadow-md'
                        : 'border-slate-200/90 hover:border-slate-300'
                    }`}
                  >
                    {/* Question Row */}
                    <div
                      onClick={() => toggleFaqExpand(faq.id)}
                      className="p-4 sm:p-5 flex items-center justify-between gap-3 cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Q Badge */}
                        <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-black text-xs shrink-0">
                          Q
                        </div>

                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
                              {faq.category}
                            </span>
                            {isAdminLoggedIn && faq.isPublished === false && (
                              <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-0.5">
                                <EyeOff className="w-2.5 h-2.5" />
                                <span>비공개</span>
                              </span>
                            )}
                          </div>
                          <h3 className="text-sm font-black text-slate-900 leading-snug">
                            {faq.question}
                          </h3>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Admin Action Controls */}
                        {isAdminLoggedIn && (
                          <div
                            className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={(e) => handleMoveFaq(idx, 'up', e)}
                              className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded hover:bg-slate-200 transition-colors"
                              title="위로 이동"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === filteredFaqs.length - 1}
                              onClick={(e) => handleMoveFaq(idx, 'down', e)}
                              className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded hover:bg-slate-200 transition-colors"
                              title="아래로 이동"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleOpenFaqEdit(faq, e)}
                              className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                              title="FAQ 수정"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmTarget({
                                  type: 'faq',
                                  id: faq.id,
                                  title: faq.question,
                                });
                              }}
                              className="p-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                              title="FAQ 삭제"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}

                        <div
                          className={`w-7 h-7 rounded-xl flex items-center justify-center transition-transform duration-200 ${
                            isExpanded ? 'rotate-180 bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          <ChevronDown className="w-4 h-4" />
                        </div>
                      </div>
                    </div>

                    {/* Answer Accordion Body */}
                    {isExpanded && (
                      <div className="px-4 pb-5 pt-1 sm:px-5 sm:pb-6 border-t border-slate-100 bg-slate-50/50">
                        <div className="flex items-start gap-3 mt-3">
                          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-black text-xs shrink-0 mt-0.5">
                            A
                          </div>
                          <div className="flex-1 space-y-2 text-xs sm:text-sm text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">
                            {faq.answer}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------ */}
      {/* TAB 3: [Q&A] USER QUESTIONS & ADMIN ANSWERS                   */}
      {/* ------------------------------------------------------------ */}
      {activeSubTab === 'qna' && (
        <div className="space-y-4">
          {/* Top Status Filters & Question Write Button */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Filter Pills */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 overflow-x-auto">
              <button
                type="button"
                onClick={() => setQnaFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  qnaFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                전체 질문 ({qnaPosts.length})
              </button>

              <button
                type="button"
                onClick={() => setQnaFilter('pending')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${
                  qnaFilter === 'pending'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-amber-700 hover:bg-amber-50'
                }`}
              >
                <Clock className="w-3 h-3" />
                <span>답변대기</span>
                <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-amber-100 text-amber-800 font-bold">
                  {qnaPosts.filter((q) => q.status === 'pending').length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setQnaFilter('answered')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${
                  qnaFilter === 'answered'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                <CheckCircle2 className="w-3 h-3" />
                <span>답변완료</span>
                <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-emerald-100 text-emerald-800 font-bold">
                  {qnaPosts.filter((q) => q.status === 'answered').length}
                </span>
              </button>

              {currentUser && (
                <button
                  type="button"
                  onClick={() => setQnaFilter('my')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${
                    qnaFilter === 'my'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-indigo-700 hover:bg-indigo-50'
                  }`}
                >
                  <User className="w-3 h-3" />
                  <span>내 질문</span>
                  <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-indigo-100 text-indigo-800 font-bold">
                    {qnaPosts.filter((q) => q.userId === currentUserId).length}
                  </span>
                </button>
              )}
            </div>

            {/* Write Question Button */}
            <button
              type="button"
              onClick={handleOpenQnaCreate}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1.5 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>1:1 질문 작성하기</span>
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Q&A 질문 제목, 내용, 작성자 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200/90 rounded-2xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 outline-none shadow-2xs"
            />
          </div>

          {/* Q&A List */}
          {filteredQnas.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200/90 p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <MessageSquare className="w-6 h-6" />
              </div>
              <p className="text-sm font-extrabold text-slate-700">등록된 질문이 없습니다.</p>
              <p className="text-xs text-slate-400">
                궁금한 점이 있으시다면 언제든지 1:1 질문을 등록해주세요!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredQnas.map((q) => {
                const isExpanded = Boolean(expandedQnaIds[q.id]);
                const isAuthor = currentUserId && q.userId === currentUserId;
                const canViewSecret = !q.isSecret || isAuthor || isAdminLoggedIn;

                return (
                  <div
                    key={q.id}
                    className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-2xs ${
                      isExpanded
                        ? 'border-emerald-300 ring-2 ring-emerald-50/80 shadow-md'
                        : 'border-slate-200/90 hover:border-slate-300'
                    }`}
                  >
                    {/* Header Row */}
                    <div
                      onClick={() => toggleQnaExpand(q.id)}
                      className="p-4 sm:p-5 flex items-center justify-between gap-3 cursor-pointer select-none"
                    >
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap text-[11px]">
                          {q.status === 'answered' ? (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-0.5">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              <span>답변완료</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" />
                              <span>답변대기</span>
                            </span>
                          )}

                          {q.isSecret && (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-0.5">
                              <Lock className="w-2.5 h-2.5 text-slate-500" />
                              <span>비공개</span>
                            </span>
                          )}

                          <span className="font-bold text-slate-600">
                            {q.isSecret && !canViewSecret
                              ? `${q.authorName.slice(0, 1)}**`
                              : q.authorName}
                          </span>

                          <span className="text-slate-400">{q.createdAt}</span>
                        </div>

                        <h3 className="text-sm font-black text-slate-900 leading-snug flex items-center gap-1.5">
                          {q.isSecret && !canViewSecret ? (
                            <span className="text-slate-400 font-bold flex items-center gap-1">
                              <Lock className="w-3.5 h-3.5" />
                              <span>비공개 질문입니다. (작성자와 관리자만 확인 가능)</span>
                            </span>
                          ) : (
                            <span>{q.title}</span>
                          )}
                        </h3>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Action buttons */}
                        <div
                          className="flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Admin Answer Button */}
                          {isAdminLoggedIn && (
                            <button
                              type="button"
                              onClick={(e) => handleOpenAnswerModal(q, e)}
                              className="px-2.5 py-1 text-xs bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                            >
                              <Send className="w-3 h-3 text-indigo-400" />
                              <span>{q.status === 'answered' ? '답변 수정' : '답변 작성'}</span>
                            </button>
                          )}

                          {/* Author Edit Button */}
                          {isAuthor && q.status === 'pending' && (
                            <button
                              type="button"
                              onClick={(e) => handleOpenQnaEdit(q, e)}
                              className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100"
                              title="질문 수정"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Delete Button (Author or Admin) */}
                          {(isAuthor || isAdminLoggedIn) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmTarget({
                                  type: 'qna',
                                  id: q.id,
                                  title: q.title,
                                });
                              }}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50"
                              title="질문 삭제"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div
                          className={`w-7 h-7 rounded-xl flex items-center justify-center transition-transform duration-200 ${
                            isExpanded
                              ? 'rotate-180 bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          <ChevronDown className="w-4 h-4" />
                        </div>
                      </div>
                    </div>

                    {/* Question Content & Official Answer Body */}
                    {isExpanded && (
                      <div className="px-4 pb-5 pt-2 sm:px-5 sm:pb-6 border-t border-slate-100 bg-slate-50/50 space-y-4">
                        {/* Question Content */}
                        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 space-y-2">
                          <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                            <User className="w-3 h-3" />
                            <span>질문 내용</span>
                          </div>
                          {canViewSecret ? (
                            <p className="text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                              {q.content}
                            </p>
                          ) : (
                            <p className="text-xs text-slate-400 italic flex items-center gap-1.5 py-2">
                              <Lock className="w-3.5 h-3.5" />
                              <span>비공개 질문입니다. 작성자와 관리자만 열람할 수 있습니다.</span>
                            </p>
                          )}
                        </div>

                        {/* Admin Answer Box if answered */}
                        {q.status === 'answered' && q.answerContent && canViewSecret && (
                          <div className="bg-emerald-50/80 rounded-2xl border border-emerald-200/80 p-4 sm:p-5 space-y-2">
                            <div className="flex items-center justify-between text-xs font-black text-emerald-950">
                              <div className="flex items-center gap-1.5">
                                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                <span>운영자 공식 답변</span>
                              </div>
                              <span className="text-[11px] text-emerald-700/80 font-medium">
                                {q.answeredAt} ({q.answeredBy || '운영자'})
                              </span>
                            </div>
                            <p className="text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-wrap pt-1">
                              {q.answerContent}
                            </p>
                          </div>
                        )}

                        {q.status === 'pending' && canViewSecret && (
                          <div className="bg-amber-50/60 rounded-2xl border border-amber-200/60 p-3.5 flex items-center gap-2 text-xs text-amber-800 font-medium">
                            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>운영진이 질문을 확인 중입니다. 빠른 시일 내에 답변드리겠습니다.</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------ */}
      {/* TAB 4: [자료실] RESOURCES GALLERY VIEW                       */}
      {/* ------------------------------------------------------------ */}
      {activeSubTab === 'resources' && (
        <ResourcesView
          resources={resources}
          groups={groups}
          participants={participants}
          currentUser={currentUser}
          isAdminLoggedIn={isAdminLoggedIn}
          onAddResource={onAddResource}
          onDeleteResource={onDeleteResource}
          onUpdateResource={onUpdateResource}
          onNavigate={onNavigate}
        />
      )}

      {/* ------------------------------------------------------------ */}
      {/* MODALS & DIALOGS                                             */}
      {/* ------------------------------------------------------------ */}

      {/* 1. Announcement Detail Modal */}
      {selectedAnnouncement && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden my-8 animate-in fade-in zoom-in-95">
            {extractThumbnail(selectedAnnouncement.content, selectedAnnouncement.thumbnailUrl) && (
              <div className="relative w-full h-64 bg-slate-900 flex items-center justify-center overflow-hidden">
                <img
                  src={extractThumbnail(selectedAnnouncement.content, selectedAnnouncement.thumbnailUrl)}
                  alt={selectedAnnouncement.title}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => setSelectedAnnouncement(null)}
                  className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/80 backdrop-blur-xs transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}

            <div className="p-6 sm:p-8 space-y-6">
              {!extractThumbnail(selectedAnnouncement.content, selectedAnnouncement.thumbnailUrl) && (
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    {selectedAnnouncement.isImportant && (
                      <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-rose-600 text-white shadow-xs flex items-center gap-1">
                        <Pin className="w-3 h-3 fill-current" />
                        <span>필독 공지</span>
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedAnnouncement(null)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-bold">
                  <span className="flex items-center gap-1 text-slate-700">
                    <User className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{selectedAnnouncement.authorName || '운영자'}</span>
                  </span>
                  <span className="flex items-center gap-1 text-slate-400">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{selectedAnnouncement.createdAt}</span>
                  </span>
                </div>

                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-snug">
                  {selectedAnnouncement.title}
                </h2>
              </div>

              <div
                className="text-sm text-slate-800 leading-relaxed space-y-4 prose prose-slate max-w-none border-t border-slate-100 pt-5"
                dangerouslySetInnerHTML={{ __html: selectedAnnouncement.content }}
              />

              {selectedAnnouncement.externalLinkUrl && (
                <div className="p-4 rounded-2xl bg-indigo-50/80 border border-indigo-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <p className="text-xs font-extrabold text-indigo-950">관련 바로가기 안내</p>
                    <p className="text-[11px] text-indigo-700/80">안내된 외부 페이지 또는 자료로 이동합니다.</p>
                  </div>
                  <a
                    href={selectedAnnouncement.externalLinkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-xs transition-all flex items-center gap-1.5"
                  >
                    <span>{selectedAnnouncement.externalLinkLabel || '바로가기 열기'}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedAnnouncement(null)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Admin Notice Add / Edit Modal */}
      {isNoticeFormOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl p-6 sm:p-8 space-y-5 my-8 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                  {editingNoticeId ? <Edit3 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {editingNoticeId ? '공지사항 수정' : '새 공지사항 작성'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    리치텍스트 에디터로 서식과 이미지를 자유롭게 첨부하여 작성하세요.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNoticeFormOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleNoticeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">
                  공지 제목 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="예: [안내] 2기 챌린지 1주차 미션 안내 및 공정위 가이드 배포"
                  value={noticeTitle}
                  onChange={(e) => setNoticeTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-bold border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">
                  본문 내용 (WYSIWYG 에디터) <span className="text-rose-500">*</span>
                </label>
                <RichTextEditor
                  value={noticeContent}
                  onChange={setNoticeContent}
                  placeholder="공지사항 본문을 작성하세요. 툴바에서 굵게, 제목, 링크, 이미지 첨부 등을 사용할 수 있습니다."
                  minHeight="280px"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">
                    외부 바로가기 링크 URL (선택)
                  </label>
                  <input
                    type="url"
                    placeholder="https://notion.so/..."
                    value={noticeExternalLinkUrl}
                    onChange={(e) => setNoticeExternalLinkUrl(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">버튼 라벨 (선택)</label>
                  <input
                    type="text"
                    placeholder="예: 노션 안내문 열기"
                    value={noticeExternalLinkLabel}
                    onChange={(e) => setNoticeExternalLinkLabel(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={noticeIsImportant}
                    onChange={(e) => setNoticeIsImportant(e.target.checked)}
                    className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
                  />
                  <span className="text-xs font-black text-rose-700">📌 중요 공지로 상단 고정</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={noticeIsPublished}
                    onChange={(e) => setNoticeIsPublished(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-xs font-bold text-slate-700">즉시 전체 공개</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNoticeFormOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={!noticeTitle.trim() || !noticeContent.trim()}
                  className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer"
                >
                  {editingNoticeId ? '수정 완료' : '공지사항 게시'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. FAQ Add / Edit Modal */}
      {isFaqFormOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 space-y-4 my-8 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-base font-black text-slate-900">
                {editingFaqId ? 'FAQ 수정' : '새 FAQ 등록'}
              </h4>
              <button
                type="button"
                onClick={() => setIsFaqFormOpen(false)}
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
                <label className="block text-xs font-bold text-slate-700 mb-1">질문 제목 *</label>
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
                <label className="block text-xs font-bold text-slate-700 mb-1">답변 내용 *</label>
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
                  <span>사용자 화면에 공개</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFaqFormOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={!faqQuestion.trim() || !faqAnswer.trim()}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  {editingFaqId ? '수정 완료' : '등록하기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. User Q&A Question Composer Modal */}
      {isQnaQuestionModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 space-y-4 my-8 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <h4 className="text-base font-black text-slate-900">
                  {editingQnaId ? '질문 수정하기' : '1:1 질문 작성하기'}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsQnaQuestionModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleQnaSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  질문 제목 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={qnaTitle}
                  onChange={(e) => setQnaTitle(e.target.value)}
                  placeholder="질문 제목을 입력하세요 (예: 1주차 과제 네이버 블로그 링크 등록 문의)"
                  className="w-full px-3.5 py-2 text-xs font-bold border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  질문 내용 <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={5}
                  required
                  value={qnaContent}
                  onChange={(e) => setQnaContent(e.target.value)}
                  placeholder="궁금하신 내용을 구체적으로 작성해 주시면 운영진이 빠르게 확인 후 답변드립니다..."
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 leading-relaxed"
                />
              </div>

              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={qnaIsSecret}
                    onChange={(e) => setQnaIsSecret(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="flex items-center gap-1 text-slate-800">
                    <Lock className="w-3.5 h-3.5 text-slate-600" />
                    <span>비공개 질문으로 등록</span>
                  </span>
                </label>
                <p className="text-[11px] text-slate-500 pl-6 leading-tight">
                  비공개 선택 시 질문 작성자와 관리자만 질문 및 답변 내용을 확인할 수 있습니다.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsQnaQuestionModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={!qnaTitle.trim() || !qnaContent.trim()}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{editingQnaId ? '수정 완료' : '질문 등록'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Admin Answer Q&A Modal */}
      {answeringQnaTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl p-6 space-y-4 my-8 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-base font-black text-slate-900">Q&A 관리자 공식 답변 작성</h4>
              <button
                type="button"
                onClick={() => setAnsweringQnaTarget(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-500 font-bold">
                <span>작성자: {answeringQnaTarget.authorName}</span>
                <span>{answeringQnaTarget.createdAt}</span>
              </div>
              <p className="text-xs font-black text-slate-900">{answeringQnaTarget.title}</p>
              <p className="text-xs text-slate-600 whitespace-pre-wrap">{answeringQnaTarget.content}</p>
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
                  className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAnsweringQnaTarget(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={!adminAnswerText.trim()}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5 text-emerald-400" />
                  <span>답변 등록 및 완료</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Delete Confirm Modal */}
      {deleteConfirmTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-sm p-6 space-y-4 text-center animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-black text-slate-900">
                {deleteConfirmTarget.type === 'notice' && '공지사항 삭제'}
                {deleteConfirmTarget.type === 'faq' && 'FAQ 항목 삭제'}
                {deleteConfirmTarget.type === 'qna' && 'Q&A 질문 삭제'}
              </h4>
              <p className="text-xs text-slate-600">
                정말 <span className="font-bold text-rose-600">"{deleteConfirmTarget.title}"</span> 항목을
                삭제하시겠습니까?
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmTarget(null)}
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
