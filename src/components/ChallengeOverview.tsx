import React, { useState, useMemo } from 'react';
import { ChallengeGroup, Participant, NaverUser } from '../types';
import { calculateParticipantGoal } from '../utils/goalCalculator';
import { getParticipantsTotalPeriodStats, getChallengeGroupStats } from '../utils/challengeStatsUtils';
import {
  Users,
  FileText,
  Calendar,
  Sparkles,
  Clock,
  TrendingUp,
  ArrowRight,
  Layers,
} from 'lucide-react';

interface ChallengeOverviewProps {
  groups: ChallengeGroup[];
  participants: Participant[];
  currentUser: NaverUser | null;
  onSelectGroup: (group: ChallengeGroup) => void;
  onJoinChallenge: (group: ChallengeGroup) => void;
}

type StatusFilterType = 'all' | 'recruiting' | 'in_progress' | 'ended';

export const ChallengeOverview: React.FC<ChallengeOverviewProps> = ({
  groups,
  participants,
  currentUser,
  onSelectGroup,
  onJoinChallenge,
}) => {
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>('recruiting');

  const todayStr = new Date().toISOString().split('T')[0];

  // Helper function to get challenge status
  const getGroupStatus = (group: ChallengeGroup): 'recruiting' | 'in_progress' | 'ended' => {
    if (group.startDate && todayStr < group.startDate) {
      return 'recruiting';
    }
    if (group.endDate && todayStr > group.endDate) {
      return 'ended';
    }
    return group.status || 'in_progress';
  };

  // Group status counts
  const recruitingCount = groups.filter((g) => getGroupStatus(g) === 'recruiting').length;
  const inProgressCount = groups.filter((g) => getGroupStatus(g) === 'in_progress').length;
  const endedCount = groups.filter((g) => getGroupStatus(g) === 'ended').length;

  // Overall Statistics (strictly within challenge period)
  const totalParticipantsCount = participants.length;
  const periodStats = useMemo(() => {
    return getParticipantsTotalPeriodStats(participants, groups);
  }, [participants, groups]);

  const totalPostsSum = periodStats.totalPosts;

  const allGoalRates = participants.map((p) => calculateParticipantGoal(p, undefined, groups).overallRate);
  const avgOverallGoalRate = allGoalRates.length > 0
    ? Math.round(allGoalRates.reduce((a, b) => a + b, 0) / allGoalRates.length)
    : 0;

  const statusPriority: Record<string, number> = {
    recruiting: 1,
    in_progress: 2,
    ended: 3,
  };

  // Filter groups according to status tab
  const filteredGroups = groups
    .filter((group) => {
      if (statusFilter === 'all') return true;
      return getGroupStatus(group) === statusFilter;
    })
    .sort((a, b) => {
      const pA = statusPriority[getGroupStatus(a)] || 99;
      const pB = statusPriority[getGroupStatus(b)] || 99;
      return pA - pB;
    });

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* 1. Toss-Style Top Big Number KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* KPI 1: 전체 챌린지 수 */}
        <div className="bg-white p-5 rounded-2xl sm:rounded-3xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-2">
          <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            <span>전체 챌린지</span>
          </span>
          <div className="flex items-baseline">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {groups.length.toLocaleString()}
            </span>
            <span className="text-xs font-bold text-slate-400 ml-1">개</span>
          </div>
        </div>

        {/* KPI 2: 모집 중 챌린지 */}
        <div className="bg-white p-5 rounded-2xl sm:rounded-3xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-2">
          <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>모집 중</span>
          </span>
          <div className="flex items-baseline">
            <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600 tracking-tight">
              {recruitingCount.toLocaleString()}
            </span>
            <span className="text-xs font-bold text-slate-400 ml-1">개</span>
          </div>
        </div>

        {/* KPI 3: 진행 중 챌린지 */}
        <div className="bg-white p-5 rounded-2xl sm:rounded-3xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-2">
          <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            <span>진행 중</span>
          </span>
          <div className="flex items-baseline">
            <span className="text-2xl sm:text-3xl font-extrabold text-blue-600 tracking-tight">
              {inProgressCount.toLocaleString()}
            </span>
            <span className="text-xs font-bold text-slate-400 ml-1">개</span>
          </div>
        </div>

        {/* KPI 4: 전체 참가자 수 */}
        <div className="bg-white p-5 rounded-2xl sm:rounded-3xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-2">
          <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-amber-500" />
            <span>전체 참가자</span>
          </span>
          <div className="flex items-baseline">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {totalParticipantsCount.toLocaleString()}
            </span>
            <span className="text-xs font-bold text-slate-400 ml-1">명</span>
          </div>
        </div>

        {/* KPI 5: 전체 포스팅 수 */}
        <div className="bg-white p-5 rounded-2xl sm:rounded-3xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-2">
          <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-sky-600" />
            <span>전체 포스팅</span>
          </span>
          <div className="flex items-baseline">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {totalPostsSum.toLocaleString()}
            </span>
            <span className="text-xs font-bold text-slate-400 ml-1">개</span>
          </div>
        </div>

        {/* KPI 6: 평균 목표 달성률 */}
        <div className="bg-white p-5 rounded-2xl sm:rounded-3xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-2">
          <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-rose-500" />
            <span>평균 달성률</span>
          </span>
          <div className="flex items-baseline">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {avgOverallGoalRate}
            </span>
            <span className="text-xs font-bold text-slate-400 ml-1">%</span>
          </div>
        </div>
      </div>

      {/* 2. Status Filter & Header */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <span>챌린지 운영 현황</span>
              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full">
                {filteredGroups.length}개
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              상태별 챌린지를 확인하고 클릭하여 상세 정보 및 리더보드를 살펴보세요.
            </p>
          </div>

          {/* Status Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setStatusFilter('recruiting')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                statusFilter === 'recruiting'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-gray-100 text-slate-600 hover:bg-gray-200'
              }`}
            >
              모집 중 ({recruitingCount})
            </button>
            <button
              onClick={() => setStatusFilter('in_progress')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                statusFilter === 'in_progress'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-gray-100 text-slate-600 hover:bg-gray-200'
              }`}
            >
              진행 중 ({inProgressCount})
            </button>
            <button
              onClick={() => setStatusFilter('ended')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                statusFilter === 'ended'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-gray-100 text-slate-600 hover:bg-gray-200'
              }`}
            >
              종료 ({endedCount})
            </button>
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                statusFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-gray-100 text-slate-600 hover:bg-gray-200'
              }`}
            >
              전체 ({groups.length})
            </button>
          </div>
        </div>

        {/* Challenge Cards Grid */}
        {filteredGroups.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400 space-y-2">
            <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-600">해당 상태의 챌린지가 없습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
            {filteredGroups.map((group) => {
              const status = getGroupStatus(group);
              const groupParticipants = participants.filter((p) => {
                if (p.groupName === group.name) return true;
                if (p.groupNames && p.groupNames.includes(group.name)) return true;
                if (p.groupName && p.groupName.split(',').map((s) => s.trim()).includes(group.name)) return true;
                return false;
              });

              const isUserJoined = currentUser
                ? groupParticipants.some((p) => {
                    const matchBlog = p.blogId && currentUser.naverId && p.blogId.toLowerCase() === currentUser.naverId.toLowerCase();
                    const matchName = p.participantName.toLowerCase() === currentUser.name.toLowerCase();
                    const matchTwitter = currentUser.twitterId && p.twitterId && p.twitterId.toLowerCase() === currentUser.twitterId.toLowerCase();
                    return matchBlog || matchName || matchTwitter;
                  })
                : false;

              const badge =
                status === 'recruiting' ? (
                  <span className="px-2.5 py-0.5 text-[11px] font-extrabold rounded-full bg-emerald-50 text-emerald-700">
                    모집 중
                  </span>
                ) : status === 'in_progress' ? (
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
                    <div className="flex items-center gap-3 text-slate-500">
                      <span className="font-bold flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-blue-600" />
                        <span>{groupParticipants.length}명</span>
                      </span>
                      <span className="font-bold flex items-center gap-1 text-slate-700">
                        <FileText className="w-3.5 h-3.5 text-emerald-600" />
                        <span>포스팅 {getChallengeGroupStats(group, participants).totalPosts}건</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {status === 'recruiting' && !isUserJoined && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onJoinChallenge(group);
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
                        className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <span>상세보기</span>
                        <ArrowRight className="w-3 h-3" />
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
