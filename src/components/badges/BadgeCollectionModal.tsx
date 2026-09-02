import React, { useState, useMemo } from 'react';
import { X, Trophy, Award, CheckCircle2, Lock, Sparkles, Filter, Search } from 'lucide-react';
import { Badge, UserBadge, UserBadgeProgress, NaverUser, RevenueCertification, Participant } from '../../types';
import { calculateUserMetrics, findNewlyQualifiedBadges } from '../../utils/badgeEvaluator';
import { BadgeDetailModal } from './BadgeDetailModal';

interface BadgeCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: NaverUser | null;
  badges: Badge[];
  userBadges: UserBadge[];
  certifications?: RevenueCertification[];
  participants?: Participant[];
}

export const BadgeCollectionModal: React.FC<BadgeCollectionModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  badges = [],
  userBadges = [],
  certifications = [],
  participants = [],
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'earned' | 'unearned'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [inspectingBadgeProgress, setInspectingBadgeProgress] = useState<UserBadgeProgress | null>(null);

  // Compute all badge progresses for current user
  const { allProgress, earnedCount, totalCount } = useMemo(() => {
    if (!currentUser) {
      return { allProgress: [], earnedCount: 0, totalCount: 0 };
    }

    const metrics = calculateUserMetrics(
      currentUser.id,
      currentUser.email,
      currentUser.name,
      currentUser.naverId,
      certifications,
      participants
    );

    const filteredUserBadges = userBadges.filter(
      (ub) => ub.userId === metrics.userId || (currentUser.email && ub.userId === currentUser.email)
    );

    const { allProgress } = findNewlyQualifiedBadges(badges, filteredUserBadges, metrics);
    const earned = allProgress.filter((p) => p.isEarned).length;

    return {
      allProgress,
      earnedCount: earned,
      totalCount: allProgress.length,
    };
  }, [currentUser, badges, userBadges, certifications, participants]);

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    badges.forEach((b) => {
      if (b.category) set.add(b.category);
    });
    return Array.from(set);
  }, [badges]);

  // Filtered badges
  const filteredBadges = useMemo(() => {
    return allProgress.filter((p) => {
      // Category filter
      if (selectedCategory !== 'all' && p.badge.category !== selectedCategory) {
        return false;
      }
      // Status filter
      if (selectedStatus === 'earned' && !p.isEarned) return false;
      if (selectedStatus === 'unearned' && p.isEarned) return false;

      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchName = p.badge.name.toLowerCase().includes(query);
        const matchDesc = p.badge.description.toLowerCase().includes(query);
        const matchCat = p.badge.category.toLowerCase().includes(query);
        return matchName || matchDesc || matchCat;
      }

      return true;
    });
  }, [allProgress, selectedCategory, selectedStatus, searchTerm]);

  if (!isOpen) return null;

  const totalPercent = totalCount > 0 ? Math.round((earnedCount / totalCount) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-[#FAF8F5] rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden border border-[#EDE8E1] max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-orange-700 p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center font-black text-white text-lg shadow-inner">
              <Trophy className="w-5 h-5 text-amber-200" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black flex items-center gap-2">
                <span>🏆 뱃지 컬렉션 (Badge Collection)</span>
              </h2>
              <p className="text-xs text-amber-100/90 font-medium">
                챌린지 완주와 수익 인증을 달성하고 특별한 성과 뱃지를 획득하세요!
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Overall Collection Progress Card */}
        <div className="bg-white border-b border-[#EDE8E1] p-4 sm:p-5 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-amber-50 to-orange-50 p-4 rounded-2xl border border-amber-200/80">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-black text-xl shadow-md">
                {totalPercent === 100 ? '👑' : '🎖️'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-extrabold text-slate-900">
                    {currentUser?.name || '회원'} 님의 뱃지 달성 현황
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900 text-[10px] font-black">
                    {earnedCount} / {totalCount} 달성
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  총 {totalCount}개의 뱃지 중 {earnedCount}개를 획득하셨습니다.
                </p>
              </div>
            </div>

            <div className="w-full sm:w-48 space-y-1">
              <div className="flex justify-between text-[11px] font-extrabold">
                <span className="text-amber-900">컬렉션 달성률</span>
                <span className="text-amber-950 font-black">{totalPercent}%</span>
              </div>
              <div className="w-full h-2.5 bg-amber-200/70 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-500"
                  style={{ width: `${totalPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Filters and Search Bar */}
          <div className="mt-4 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
            {/* Category Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                  selectedCategory === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                전체
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Status & Search */}
            <div className="flex items-center gap-2">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as any)}
                className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-amber-500 outline-hidden"
              >
                <option value="all">전체 보기</option>
                <option value="earned">획득 완료 ({earnedCount})</option>
                <option value="unearned">미획득 ({totalCount - earnedCount})</option>
              </select>

              <div className="relative flex-1 sm:w-44">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="뱃지 검색..."
                  className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-amber-500 outline-hidden"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Badge Grid */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {filteredBadges.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center space-y-2">
              <p className="text-xs font-bold text-slate-600">조건에 일치하는 뱃지가 없습니다.</p>
              <p className="text-[11px] text-slate-400">다른 필터나 검색어를 선택해보세요.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
              {filteredBadges.map((progress) => {
                const { badge, isEarned, earnedAt, currentValue, targetValue, progressPercent } = progress;

                return (
                  <div
                    key={badge.id}
                    onClick={() => setInspectingBadgeProgress(progress)}
                    className={`rounded-2xl p-4 border transition-all duration-200 flex flex-col justify-between space-y-3 cursor-pointer group hover:scale-[1.02] shadow-2xs ${
                      isEarned
                        ? 'bg-white border-amber-200/90 hover:border-amber-300 hover:shadow-md'
                        : 'bg-slate-50/70 border-slate-200 hover:border-slate-300 opacity-80'
                    }`}
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        {/* Icon */}
                        <div
                          className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-xs border transition-transform ${
                            isEarned
                              ? 'bg-white border-slate-100 group-hover:scale-110'
                              : 'bg-slate-200 border-slate-300 grayscale opacity-60'
                          }`}
                          style={{
                            boxShadow: isEarned ? `0 4px 12px ${badge.color}33` : undefined,
                          }}
                        >
                          {badge.icon}
                        </div>

                        {/* Status chip */}
                        {isEarned ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-extrabold flex items-center gap-1 border border-emerald-200/60">
                            <CheckCircle2 className="w-3 h-3" />
                            획득
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-600 text-[10px] font-extrabold flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            미획득
                          </span>
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className="px-1.5 py-0.2 text-[9px] font-bold rounded"
                            style={{
                              backgroundColor: `${badge.color}15`,
                              color: badge.color,
                            }}
                          >
                            {badge.category}
                          </span>
                          <h4 className="text-xs font-black text-slate-900 line-clamp-1 group-hover:text-amber-700 transition-colors">
                            {badge.name}
                          </h4>
                        </div>
                        <p className="text-[11px] text-slate-500 line-clamp-2 mt-1 leading-snug">
                          {badge.description}
                        </p>
                      </div>
                    </div>

                    {/* Progress or Earned Date */}
                    <div className="pt-2 border-t border-slate-100">
                      {isEarned ? (
                        <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500">
                          <span>달성 완료</span>
                          <span className="text-emerald-700 font-bold">100%</span>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                            <span>진행률</span>
                            <span className="text-slate-800">
                              {badge.conditionType === 'total_profit'
                                ? `${(currentValue / 10000).toFixed(0)}만 / ${(targetValue / 10000).toFixed(0)}만 (${progressPercent}%)`
                                : `${currentValue} / ${targetValue} (${progressPercent}%)`}
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-500 rounded-full transition-all duration-300"
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-white border-t border-[#EDE8E1] p-4 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-xs"
          >
            닫기
          </button>
        </div>

      </div>

      {/* Badge Detail Inspection Modal */}
      {inspectingBadgeProgress && (
        <BadgeDetailModal
          progress={inspectingBadgeProgress}
          onClose={() => setInspectingBadgeProgress(null)}
        />
      )}
    </div>
  );
};
