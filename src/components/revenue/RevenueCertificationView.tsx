import React, { useState, useMemo } from 'react';
import {
  Trophy,
  Coins,
  Sparkles,
  Search,
  Filter,
  PlusCircle,
  Heart,
  Eye,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Award,
  TrendingUp,
  ArrowUpDown,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import {
  RevenueCertification,
  ChallengeGroup,
  NaverUser,
  RevenueCertificationStatus,
} from '../../types';
import { RevenueSubmitModal } from './RevenueSubmitModal';
import { RevenueDetailModal } from './RevenueDetailModal';

interface RevenueCertificationViewProps {
  certifications: RevenueCertification[];
  groups: ChallengeGroup[];
  currentUser: NaverUser | null;
  isAdminLoggedIn: boolean;
  onSaveCert: (cert: RevenueCertification) => Promise<void> | void;
  onDeleteCert: (id: string) => Promise<void> | void;
  onUpdateCertStatus: (
    id: string,
    status: RevenueCertificationStatus,
    options?: { rejectionReason?: string; isFeatured?: boolean; revenueAmount?: number }
  ) => Promise<void> | void;
  onToggleLike: (id: string) => void;
  onOpenGoogleAuth: () => void;
  onSelectChallenge?: (challengeId: string) => void;
}

export const RevenueCertificationView: React.FC<RevenueCertificationViewProps> = ({
  certifications = [],
  groups = [],
  currentUser,
  isAdminLoggedIn,
  onSaveCert,
  onDeleteCert,
  onUpdateCertStatus,
  onToggleLike,
  onOpenGoogleAuth,
  onSelectChallenge,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'featured' | 'my'>('all');
  const [selectedChallengeId, setSelectedChallengeId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'latest' | 'revenue_desc' | 'likes_desc'>('latest');

  // Modal States
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [editingCert, setEditingCert] = useState<RevenueCertification | null>(null);
  const [selectedCertDetail, setSelectedCertDetail] = useState<RevenueCertification | null>(null);

  // Calculate high-level stats based on approved submissions
  const stats = useMemo(() => {
    const approved = certifications.filter((c) => c.status === 'approved');
    const totalRevenue = approved.reduce((sum, c) => sum + (c.revenueAmount || 0), 0);
    const count = approved.length;
    const avgRevenue = count > 0 ? Math.round(totalRevenue / count) : 0;
    const maxItem = approved.length > 0
      ? [...approved].sort((a, b) => (b.revenueAmount || 0) - (a.revenueAmount || 0))[0]
      : null;

    return {
      totalRevenue,
      approvedCount: count,
      avgRevenue,
      topEarner: maxItem,
      totalLikes: certifications.reduce((sum, c) => sum + (c.likesCount || 0), 0),
    };
  }, [certifications]);

  // Filter and sort list
  const filteredList = useMemo(() => {
    let list = [...certifications];

    // 1. Tab filter
    if (activeTab === 'featured') {
      list = list.filter((c) => c.isFeatured && c.status === 'approved');
    } else if (activeTab === 'my') {
      if (!currentUser) return [];
      list = list.filter((c) => c.userId === currentUser.id);
    } else {
      // 'all' tab shows approved items to general users, or all if admin
      if (!isAdminLoggedIn) {
        list = list.filter((c) => c.status === 'approved' || (currentUser && c.userId === currentUser.id));
      }
    }

    // 2. Challenge filter
    if (selectedChallengeId !== 'all') {
      list = list.filter((c) => c.challengeId === selectedChallengeId);
    }

    // 3. Search filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.userName.toLowerCase().includes(q) ||
          c.content.toLowerCase().includes(q) ||
          (c.challengeName && c.challengeName.toLowerCase().includes(q))
      );
    }

    // 4. Sorting
    if (sortBy === 'revenue_desc') {
      list.sort((a, b) => (b.revenueAmount || 0) - (a.revenueAmount || 0));
    } else if (sortBy === 'likes_desc') {
      list.sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0));
    } else {
      // latest
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return list;
  }, [certifications, activeTab, selectedChallengeId, searchTerm, sortBy, currentUser, isAdminLoggedIn]);

  const handleOpenSubmit = () => {
    if (!currentUser) {
      onOpenGoogleAuth();
      return;
    }
    setEditingCert(null);
    setIsSubmitModalOpen(true);
  };

  const handleOpenEdit = (cert: RevenueCertification) => {
    setEditingCert(cert);
    setIsSubmitModalOpen(true);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-200">
      
      {/* 1. Header Banner & Stats Summary */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          
          {/* Main Title & Description */}
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200/80 rounded-full text-xs font-bold">
              <Trophy className="w-3.5 h-3.5 text-amber-600" />
              <span>챌린저 실전 수익 인증 갤러리</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              실제 챌린지로 달성한 <span className="text-blue-600">수익과 성과</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
              블로그 애드포스트, 원고료, 제휴 마케팅까지 1일 1포스팅 챌린지를 통해 거둔 진솔한 수익 인증과 실전 노하우를 공유합니다.
            </p>
          </div>

          {/* Action Callout Button */}
          <div className="shrink-0">
            <button
              onClick={handleOpenSubmit}
              className="w-full sm:w-auto px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-2xl text-xs sm:text-sm shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95"
            >
              <PlusCircle className="w-4 h-4 stroke-[2.5px]" />
              <span>내 수익 인증 등록하기</span>
            </button>
          </div>
        </div>

        {/* Numeric Highlights Strip - Toss Big Number Style */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 pt-2">
          
          <div className="bg-slate-50/80 p-4 sm:p-5 rounded-2xl border border-slate-100/90 transition-all hover:bg-slate-50">
            <div className="flex items-center justify-between text-slate-500 mb-1.5">
              <span className="text-xs font-bold">누적 인증 수익</span>
              <div className="w-7 h-7 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
                <Coins className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              ₩{stats.totalRevenue.toLocaleString('ko-KR')}
            </div>
            <span className="text-[11px] text-slate-400 font-medium">검증 승인된 총 인증액</span>
          </div>

          <div className="bg-slate-50/80 p-4 sm:p-5 rounded-2xl border border-slate-100/90 transition-all hover:bg-slate-50">
            <div className="flex items-center justify-between text-slate-500 mb-1.5">
              <span className="text-xs font-bold">공식 인증 건수</span>
              <div className="w-7 h-7 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              {stats.approvedCount.toLocaleString('ko-KR')}건
            </div>
            <span className="text-[11px] text-slate-400 font-medium">관리자 심사 완료 건수</span>
          </div>

          <div className="bg-slate-50/80 p-4 sm:p-5 rounded-2xl border border-slate-100/90 transition-all hover:bg-slate-50">
            <div className="flex items-center justify-between text-slate-500 mb-1.5">
              <span className="text-xs font-bold">평균 달성 수익</span>
              <div className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              ₩{stats.avgRevenue.toLocaleString('ko-KR')}
            </div>
            <span className="text-[11px] text-slate-400 font-medium">인증 1건당 평균 수익</span>
          </div>

          <div className="bg-slate-50/80 p-4 sm:p-5 rounded-2xl border border-slate-100/90 transition-all hover:bg-slate-50">
            <div className="flex items-center justify-between text-slate-500 mb-1.5">
              <span className="text-xs font-bold">최고 인증 수익</span>
              <div className="w-7 h-7 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
                <Award className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight truncate">
              {stats.topEarner ? `₩${stats.topEarner.revenueAmount.toLocaleString('ko-KR')}` : '-'}
            </div>
            <span className="text-[11px] text-slate-400 font-medium truncate block">
              {stats.topEarner ? `${stats.topEarner.userName} 챌린저` : '인증 대기 중'}
            </span>
          </div>

        </div>
      </div>

      {/* 2. Filter & SubTabs Control Bar */}
      <div className="bg-white p-3 sm:p-4 rounded-3xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-3.5">
        
        {/* Top Filter Row: Tabs & Search */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Main 3 View Tabs */}
          <div className="grid grid-cols-3 gap-1 bg-slate-100/80 p-1 rounded-2xl">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 sm:px-4 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              전체 인증 ({certifications.filter(c => c.status === 'approved' || (currentUser && c.userId === currentUser.id)).length})
            </button>
            <button
              onClick={() => setActiveTab('featured')}
              className={`px-3 sm:px-4 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 ${
                activeTab === 'featured'
                  ? 'bg-amber-500 text-white shadow-2xs'
                  : 'text-amber-800 hover:text-amber-950'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>명예의 전당</span>
            </button>
            <button
              onClick={() => {
                if (!currentUser) {
                  onOpenGoogleAuth();
                } else {
                  setActiveTab('my');
                }
              }}
              className={`px-3 sm:px-4 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer ${
                activeTab === 'my'
                  ? 'bg-white text-blue-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              내 인증 내역
            </button>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 md:max-w-xs">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="제목, 챌린저, 팁 검색..."
              className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200/90 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* Secondary Filter Row: Challenge Selection & Sorting */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-100 text-xs">
          
          {/* Challenge Selector */}
          <div className="flex items-center space-x-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedChallengeId}
              onChange={(e) => setSelectedChallengeId(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200/90 rounded-xl text-xs font-bold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="all">모든 챌린지 전체</option>
              {groups.map((grp) => (
                <option key={grp.id} value={grp.id}>
                  {grp.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Buttons */}
          <div className="flex items-center space-x-1">
            <span className="text-[11px] font-bold text-slate-400 mr-1 flex items-center gap-0.5">
              <ArrowUpDown className="w-3 h-3" />
              정렬:
            </span>
            {[
              { key: 'latest', label: '최신순' },
              { key: 'revenue_desc', label: '최고수익순' },
              { key: 'likes_desc', label: '응원순' },
            ].map((s) => (
              <button
                key={s.key}
                onClick={() => setSortBy(s.key as any)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  sortBy === s.key
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* 3. Cards Grid */}
      {filteredList.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center space-y-4 max-w-lg mx-auto shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto border border-blue-100">
            <Coins className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-extrabold text-slate-900">
              {activeTab === 'my'
                ? '아직 등록하신 수익 인증이 없습니다.'
                : '조건에 맞는 수익 인증이 없습니다.'}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              {activeTab === 'my'
                ? '챌린지 참여 후 첫 애드포스트나 원고료 수익이 발생했다면 첫 인증을 남겨보세요!'
                : '새로운 챌린저의 첫 수익 인증을 등록해 보세요.'}
            </p>
          </div>
          <button
            onClick={handleOpenSubmit}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl text-xs shadow-xs transition-all cursor-pointer"
          >
            수익 인증 등록하기
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredList.map((cert) => {
            const isLiked = currentUser ? cert.likedUserIds?.includes(currentUser.id) : false;
            return (
              <div
                key={cert.id}
                onClick={() => setSelectedCertDetail(cert)}
                className="group relative bg-white rounded-3xl border border-gray-100 hover:border-slate-300 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-lg transition-all duration-200 overflow-hidden flex flex-col cursor-pointer"
              >
                {/* Proof Image Box */}
                <div className="relative aspect-16/10 bg-slate-900 overflow-hidden">
                  <img
                    src={cert.proofImageUrl}
                    alt={cert.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  
                  {/* Revenue Floating Tag */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1.5 bg-slate-900/90 backdrop-blur-xs text-amber-300 border border-slate-800 rounded-2xl shadow-sm">
                    <Coins className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="text-xs sm:text-sm font-extrabold tracking-tight">
                      ₩{cert.revenueAmount.toLocaleString('ko-KR')}
                    </span>
                  </div>

                  {/* Badges: Featured or Status */}
                  <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
                    {cert.isFeatured && (
                      <span className="flex items-center gap-1 px-2.5 py-1 bg-amber-500 text-white rounded-xl text-[10px] font-extrabold shadow-sm">
                        <Award className="w-3 h-3" />
                        명예의 전당
                      </span>
                    )}

                    {cert.status === 'pending' && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-500 text-white rounded-lg text-[10px] font-bold shadow-sm">
                        <Clock className="w-2.5 h-2.5" />
                        심사대기
                      </span>
                    )}

                    {cert.status === 'rejected' && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-rose-600 text-white rounded-lg text-[10px] font-bold shadow-sm">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        반려
                      </span>
                    )}
                  </div>

                  {/* Bottom Challenge Pill */}
                  {cert.challengeName && (
                    <div className="absolute bottom-2.5 left-3">
                      <span className="px-2.5 py-1 bg-black/60 backdrop-blur-xs text-slate-200 text-[10px] font-bold rounded-lg truncate max-w-[200px] inline-block">
                        {cert.challengeName}
                      </span>
                    </div>
                  )}
                </div>

                {/* Card Content Area */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                  
                  <div className="space-y-2">
                    {/* Title */}
                    <h3 className="text-sm font-extrabold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-2 leading-snug">
                      {cert.title}
                    </h3>

                    {/* Content Snippet */}
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {cert.content}
                    </p>
                  </div>

                  {/* Card Bottom Meta */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    
                    {/* User Info */}
                    <div className="flex items-center space-x-2">
                      <img
                        src={cert.userAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${cert.userName}`}
                        alt={cert.userName}
                        className="w-6 h-6 rounded-full border border-slate-200 object-cover"
                      />
                      <span className="font-bold text-slate-800 text-[11px] truncate max-w-[100px]">
                        {cert.userName}
                      </span>
                    </div>

                    {/* Interactions */}
                    <div className="flex items-center space-x-3 text-slate-400 font-bold text-[11px]">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleLike(cert.id);
                        }}
                        className={`flex items-center gap-1 transition-colors cursor-pointer ${
                          isLiked ? 'text-rose-500' : 'hover:text-rose-500'
                        }`}
                      >
                        <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
                        <span>{cert.likesCount || 0}</span>
                      </button>

                      <div className="flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5" />
                        <span>{cert.viewsCount || 0}</span>
                      </div>
                    </div>

                  </div>

                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <RevenueSubmitModal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        currentUser={currentUser}
        groups={groups}
        onSubmit={async (newCert) => {
          await onSaveCert(newCert);
          setIsSubmitModalOpen(false);
        }}
        editingCert={editingCert}
        onOpenGoogleAuth={onOpenGoogleAuth}
      />

      <RevenueDetailModal
        isOpen={Boolean(selectedCertDetail)}
        onClose={() => setSelectedCertDetail(null)}
        cert={selectedCertDetail}
        currentUser={currentUser}
        isAdminLoggedIn={isAdminLoggedIn}
        onToggleLike={onToggleLike}
        onEditCert={(c) => {
          setSelectedCertDetail(null);
          handleOpenEdit(c);
        }}
        onDeleteCert={onDeleteCert}
        onUpdateStatus={onUpdateCertStatus}
      />

    </div>
  );
};
