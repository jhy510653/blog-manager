import React, { useState } from 'react';
import { ChallengeGroup, Participant, NaverUser, Announcement, SiteVisitorStats } from '../types';
import { getParticipantPeriodStats, getParticipantsTotalPeriodStats } from '../utils/challengeStatsUtils';
import {
  Users,
  Megaphone,
  ArrowRight,
  Calendar,
  Sparkles,
  Target,
  Trophy,
  ChevronRight,
  TrendingUp,
  ExternalLink,
} from 'lucide-react';
import { stripHtmlToPlainText } from '../utils/htmlUtils';

interface HomeDashboardViewProps {
  groups: ChallengeGroup[];
  participants: Participant[];
  announcements: Announcement[];
  resources?: any[];
  currentUser: NaverUser | null;
  isAdminLoggedIn?: boolean;
  visitorStats?: SiteVisitorStats | null;
  isLoadingVisitorStats?: boolean;
  onSelectGroup: (group: ChallengeGroup) => void;
  onJoinGroup: (group: ChallengeGroup) => void;
  onViewAnnouncements: () => void;
  onViewResources: () => void;
  onViewAllChallenges: () => void;
  onViewMembers?: () => void;
  onOpenAnnouncementDetail: (announcement: Announcement) => void;
}

export const HomeDashboardView: React.FC<HomeDashboardViewProps> = ({
  groups = [],
  participants = [],
  currentUser,
  announcements = [],
  onSelectGroup,
  onJoinGroup,
  onViewAnnouncements,
  onViewResources,
  onViewAllChallenges,
  onOpenAnnouncementDetail,
}) => {
  const [selectedStatusTab, setSelectedStatusTab] = useState<'recruiting' | 'in_progress' | 'ended' | 'all'>('recruiting');

  const todayStr = new Date().toISOString().split('T')[0];

  // Calculate status for each challenge group
  const groupWithStatus = (groups || []).map((g) => {
    let status: 'recruiting' | 'in_progress' | 'ended' = 'in_progress';
    if (g.startDate && todayStr < g.startDate) {
      status = 'recruiting';
    } else if (g.endDate && todayStr > g.endDate) {
      status = 'ended';
    } else {
      status = 'in_progress';
    }
    return { ...g, computedStatus: status };
  });

  const recruitingCount = groupWithStatus.filter((g) => g.computedStatus === 'recruiting').length;
  const inProgressCount = groupWithStatus.filter((g) => g.computedStatus === 'in_progress').length;
  const endedCount = groupWithStatus.filter((g) => g.computedStatus === 'ended').length;

  const statusPriority: Record<string, number> = {
    recruiting: 1,
    in_progress: 2,
    ended: 3,
  };

  const filteredGroups = groupWithStatus
    .filter((g) => {
      if (selectedStatusTab === 'all') return true;
      return g.computedStatus === selectedStatusTab;
    })
    .sort((a, b) => {
      const pA = statusPriority[a.computedStatus] || 99;
      const pB = statusPriority[b.computedStatus] || 99;
      return pA - pB;
    });

  // Calculate user's active challenge (only currently in_progress challenges)
  const userEnrolledGroups = React.useMemo(() => {
    if (!currentUser) return [];
    const enrolledNames = new Set<string>();
    (participants || []).forEach((p) => {
      const matchBlog = Boolean(p.blogId && currentUser.naverId && p.blogId.toLowerCase() === currentUser.naverId.toLowerCase());
      const matchName = Boolean(p.participantName && currentUser.name && p.participantName.toLowerCase() === currentUser.name.toLowerCase());
      const matchTwitter = Boolean(currentUser.twitterId && p.twitterId && p.twitterId.toLowerCase() === currentUser.twitterId.toLowerCase());

      if (matchBlog || matchName || matchTwitter) {
        if (p.groupNames && p.groupNames.length > 0) {
          p.groupNames.forEach((name) => enrolledNames.add(name));
        } else if (p.groupName) {
          p.groupName.split(',').forEach((name) => enrolledNames.add(name.trim()));
        }
      }
    });

    return groupWithStatus.filter((g) => enrolledNames.has(g.name));
  }, [currentUser, participants, groupWithStatus]);

  const activeUserChallenge = userEnrolledGroups.find((g) => g.computedStatus === 'in_progress');

  const activeChallengeProgress = React.useMemo(() => {
    if (!activeUserChallenge || !currentUser || !participants) return { current: 0, target: 10, percent: 0 };
    const p = participants.find((part) => {
      const matchBlog = Boolean(part.blogId && currentUser.naverId && part.blogId.toLowerCase() === currentUser.naverId.toLowerCase());
      const matchName = Boolean(part.participantName && currentUser.name && part.participantName.toLowerCase() === currentUser.name.toLowerCase());
      const matchTwitter = Boolean(currentUser.twitterId && part.twitterId && part.twitterId.toLowerCase() === currentUser.twitterId.toLowerCase());
      const inGroup = (part.groupNames && part.groupNames.includes(activeUserChallenge.name)) || (part.groupName && part.groupName.includes(activeUserChallenge.name));
      return (matchBlog || matchName || matchTwitter) && inGroup;
    });

    if (!p) return { current: 0, target: 10, percent: 0 };
    const pStats = getParticipantPeriodStats(p, { group: activeUserChallenge, allGroups: groups });
    const target = activeUserChallenge.targetPostCount || p.targetBlogPostCount || p.targetPostCount || 10;
    const current = pStats.totalAll;
    const percent = Math.min(100, Math.round((current / target) * 100));
    return { current, target, percent };
  }, [activeUserChallenge, currentUser, participants, groups]);

  // High-level Portal Big Number Stats for Top Section (strictly within designated periods)
  const totalParticipantsCount = participants.length;
  const totalPeriodStats = React.useMemo(() => {
    return getParticipantsTotalPeriodStats(participants, groups);
  }, [participants, groups]);
  const totalPostsSum = totalPeriodStats.totalAll;

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      
      {/* 1. Toss Style Hero Greeting & Overview Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
              <Sparkles className="w-3.5 h-3.5" />
              네이버 블로그 수익화 포털
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {currentUser ? `안녕하세요, ${currentUser.name}님 👋` : '매일 포스팅으로 완성하는 블로그 수익화 👋'}
            </h2>
            <p className="text-sm text-slate-500 leading-relaxed font-medium max-w-xl">
              실시간 자동 집계 대시보드에서 포스팅 달성률을 확인하고 챌린지에 도전하세요.
            </p>
          </div>

          {/* Active Challenge Progress Card (Toss Card) */}
          <div className="bg-gray-50/80 rounded-2xl p-5 border border-gray-100 min-w-[280px] sm:min-w-[340px] space-y-3">
            {activeUserChallenge ? (
              <>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-semibold">참여 중인 챌린지</span>
                  <span className="bg-blue-50 text-blue-600 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold">
                    진행 중
                  </span>
                </div>

                <h3 className="text-sm font-extrabold text-slate-900 truncate">
                  {activeUserChallenge.name}
                </h3>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-slate-500 font-medium">
                    <span>진행 현황 ({activeChallengeProgress.current}/{activeChallengeProgress.target}개)</span>
                    <span className="font-extrabold text-blue-600">{activeChallengeProgress.percent}%</span>
                  </div>
                  <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${activeChallengeProgress.percent}%` }}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onSelectGroup(activeUserChallenge)}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-[0_2px_8px_rgba(37,99,235,0.2)]"
                >
                  <span>내 챌린지 기록 보기</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <div className="text-center py-2 space-y-2">
                <p className="text-xs font-bold text-slate-700">
                  현재 참여 중인 챌린지가 없습니다.
                </p>
                <p className="text-[11px] text-slate-400">
                  지금 모집 중인 챌린지에 참가해보세요!
                </p>
                <button
                  type="button"
                  onClick={onViewAllChallenges}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer inline-flex items-center gap-1 shadow-[0_2px_8px_rgba(37,99,235,0.2)]"
                >
                  <span>모집 중인 챌린지 보기</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Toss Big Numbers Metric Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t border-gray-100">
          <div className="p-4 rounded-2xl bg-gray-50/60 border border-gray-100/80">
            <span className="text-xs font-semibold text-slate-400">전체 참가 멤버</span>
            <div className="mt-1 flex items-baseline">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {totalParticipantsCount.toLocaleString()}
              </span>
              <span className="text-xs font-bold text-slate-400 ml-1">명</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-gray-50/60 border border-gray-100/80">
            <span className="text-xs font-semibold text-slate-400">누적 포스팅</span>
            <div className="mt-1 flex items-baseline">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {totalPostsSum.toLocaleString()}
              </span>
              <span className="text-xs font-bold text-slate-400 ml-1">개</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-gray-50/60 border border-gray-100/80">
            <span className="text-xs font-semibold text-slate-400">진행 중인 챌린지</span>
            <div className="mt-1 flex items-baseline">
              <span className="text-2xl sm:text-3xl font-extrabold text-blue-600 tracking-tight">
                {inProgressCount}
              </span>
              <span className="text-xs font-bold text-slate-400 ml-1">개</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-gray-50/60 border border-gray-100/80">
            <span className="text-xs font-semibold text-slate-400">모집 중인 챌린지</span>
            <div className="mt-1 flex items-baseline">
              <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600 tracking-tight">
                {recruitingCount}
              </span>
              <span className="text-xs font-bold text-slate-400 ml-1">개</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Announcements Banner Card */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2 tracking-tight">
            <Megaphone className="w-4 h-4 text-blue-600" />
            <span>공지사항</span>
          </h3>
          <button
            type="button"
            onClick={onViewAnnouncements}
            className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer transition-colors"
          >
            <span>전체보기</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {announcements.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            등록된 공지사항이 없습니다.
          </div>
        ) : (
          <div className="space-y-2">
            {announcements.slice(0, 3).map((a) => {
              const previewText = a.summary || stripHtmlToPlainText(a.content);

              return (
                <button
                  key={a.id}
                  id={`home-announcement-item-${a.id}`}
                  type="button"
                  onClick={() => onOpenAnnouncementDetail(a)}
                  className="w-full text-left p-3.5 rounded-2xl bg-slate-50/60 hover:bg-blue-50/60 border border-slate-100 hover:border-blue-200 transition-all cursor-pointer flex items-center justify-between gap-3 group text-xs shadow-2xs"
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center space-x-2.5 min-w-0">
                      {a.isImportant && (
                        <span className="px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200/60 text-rose-600 text-[10px] font-extrabold shrink-0 flex items-center gap-0.5">
                          중요
                        </span>
                      )}
                      <span className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors truncate">
                        {a.title}
                      </span>
                      {a.externalLinkUrl && (
                        <span className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-indigo-50 border border-indigo-100/60 text-indigo-600 text-[10px] font-bold shrink-0">
                          <ExternalLink className="w-2.5 h-2.5" />
                          <span>{a.externalLinkLabel || '링크'}</span>
                        </span>
                      )}
                    </div>
                    {previewText && (
                      <p className="text-[11px] text-slate-500 font-normal line-clamp-1 truncate">
                        {previewText}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[11px] text-slate-400 font-medium">
                      {a.createdAt}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Challenge List Section with Clean Pills */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-5">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-0.5">
            <h3 className="text-lg font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <Trophy className="w-5 h-5 text-blue-600" />
              <span>챌린지 둘러보기</span>
            </h3>
            <p className="text-xs text-slate-400 font-medium">
              모집 중인 그룹에 참가 신청하거나 진행 상황을 확인하세요.
            </p>
          </div>

          {/* Status Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setSelectedStatusTab('recruiting')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                selectedStatusTab === 'recruiting'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-gray-100 text-slate-600 hover:bg-gray-200'
              }`}
            >
              모집 중 ({recruitingCount})
            </button>
            <button
              onClick={() => setSelectedStatusTab('in_progress')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                selectedStatusTab === 'in_progress'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-gray-100 text-slate-600 hover:bg-gray-200'
              }`}
            >
              진행 중 ({inProgressCount})
            </button>
            <button
              onClick={() => setSelectedStatusTab('ended')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                selectedStatusTab === 'ended'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-gray-100 text-slate-600 hover:bg-gray-200'
              }`}
            >
              종료 ({endedCount})
            </button>
            <button
              onClick={() => setSelectedStatusTab('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                selectedStatusTab === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-gray-100 text-slate-600 hover:bg-gray-200'
              }`}
            >
              전체 ({groupWithStatus.length})
            </button>
          </div>
        </div>

        {/* Filtered Challenge Cards */}
        {filteredGroups.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400 space-y-2">
            <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-600">해당 상태의 챌린지가 없습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
            {filteredGroups.map((group) => {
              const groupParts = participants.filter((p) => {
                if (p.groupName === group.name) return true;
                if (p.groupNames && p.groupNames.includes(group.name)) return true;
                if (p.groupName && p.groupName.split(',').map((s) => s.trim()).includes(group.name)) return true;
                return false;
              });

              const isUserJoined = currentUser
                ? groupParts.some((p) => {
                    const matchBlog = p.blogId && currentUser.naverId && p.blogId.toLowerCase() === currentUser.naverId.toLowerCase();
                    const matchName = p.participantName.toLowerCase() === currentUser.name.toLowerCase();
                    const matchTwitter = currentUser.twitterId && p.twitterId && p.twitterId.toLowerCase() === currentUser.twitterId.toLowerCase();
                    return matchBlog || matchName || matchTwitter;
                  })
                : false;

              const badge =
                group.computedStatus === 'recruiting' ? (
                  <span className="px-2.5 py-0.5 text-[11px] font-extrabold rounded-full bg-emerald-50 text-emerald-700">
                    모집 중
                  </span>
                ) : group.computedStatus === 'in_progress' ? (
                  <span className="px-2.5 py-0.5 text-[11px] font-extrabold rounded-full bg-blue-50 text-blue-700">
                    진행 중
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 text-[11px] font-extrabold rounded-full bg-gray-100 text-gray-500">
                    종료
                  </span>
                );

              return (
                <div
                  key={group.id}
                  onClick={() => onSelectGroup(group)}
                  className="bg-white rounded-2xl border border-gray-100 p-5 hover:border-gray-200 hover:shadow-[0_4px_16px_rgba(0,0,0,0.04)] transition-all flex flex-col justify-between space-y-4 cursor-pointer group"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      {badge}
                      <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {group.startDate} ~ {group.endDate}
                      </span>
                    </div>

                    <h4 className="text-base font-extrabold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                      {group.name}
                    </h4>

                    {group.description && (
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed bg-gray-50 p-3 rounded-xl border border-gray-100/60">
                        {group.description}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-500 flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-blue-600" />
                      참가자 {groupParts.length}명
                    </span>

                    <div className="flex items-center gap-2">
                      {group.computedStatus === 'recruiting' && !isUserJoined && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onJoinGroup(group);
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
                        >
                          참가 신청
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectGroup(group);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                      >
                        상세보기
                      </button>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}

      </div>

    </div>
  );
};
