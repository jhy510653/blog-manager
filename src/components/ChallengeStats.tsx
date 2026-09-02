import React, { useState, useMemo } from 'react';
import { ChallengeGroup, Participant } from '../types';
import { calculateParticipantGoal } from '../utils/goalCalculator';
import {
  getParticipantPeriodStats,
  getChallengeGroupStats,
  getParticipantsTotalPeriodStats,
} from '../utils/challengeStatsUtils';
import { TrendAnalyticsChart } from './TrendAnalyticsChart';
import {
  BarChart3,
  Users,
  FileText,
  TrendingUp,
  Award,
  Layers,
  CheckCircle2,
  Filter,
  ChevronRight,
} from 'lucide-react';

interface ChallengeStatsProps {
  groups: ChallengeGroup[];
  participants: Participant[];
  onSelectGroup: (group: ChallengeGroup) => void;
}

export const ChallengeStats: React.FC<ChallengeStatsProps> = ({
  groups,
  participants,
  onSelectGroup,
}) => {
  // Sub Tab State: 'overview' | 'rankings' | 'trends'
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'rankings' | 'trends'>('overview');

  // Filter States
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('all');
  const [selectedCohortFilter, setSelectedCohortFilter] = useState<string>('all');
  const [selectedPeriodFilter, setSelectedPeriodFilter] = useState<string>('all');

  // Available Cohorts List
  const availableCohorts = useMemo(() => {
    const cohortsSet = new Set<string>();
    groups.forEach((g) => {
      if (g.cohort) cohortsSet.add(g.cohort);
    });
    return Array.from(cohortsSet);
  }, [groups]);

  // Filtered Groups
  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
      if (selectedGroupFilter !== 'all' && g.id !== selectedGroupFilter && g.name !== selectedGroupFilter) {
        return false;
      }
      if (selectedCohortFilter !== 'all' && g.cohort !== selectedCohortFilter) {
        return false;
      }
      return true;
    });
  }, [groups, selectedGroupFilter, selectedCohortFilter]);

  // Filtered Participants based on selected groups and period
  const filteredParticipants = useMemo(() => {
    const filteredGroupNames = new Set(filteredGroups.map((g) => g.name));

    return participants.filter((p) => {
      // Group matching
      if (selectedGroupFilter !== 'all' || selectedCohortFilter !== 'all') {
        const pGroupNames = p.groupNames || (p.groupName ? p.groupName.split(',').map((s) => s.trim()) : []);
        const matchesGroup = pGroupNames.some((gn) => filteredGroupNames.has(gn));
        if (!matchesGroup) return false;
      }

      // Period filtering based on last activity or updated date if needed
      if (selectedPeriodFilter === '7d') {
        if (p.updatedAt) {
          const diffDays = (Date.now() - new Date(p.updatedAt).getTime()) / (1000 * 3600 * 24);
          if (diffDays > 7) return false;
        }
      } else if (selectedPeriodFilter === '30d') {
        if (p.updatedAt) {
          const diffDays = (Date.now() - new Date(p.updatedAt).getTime()) / (1000 * 3600 * 24);
          if (diffDays > 30) return false;
        }
      }

      return true;
    });
  }, [participants, filteredGroups, selectedGroupFilter, selectedCohortFilter, selectedPeriodFilter]);

  // Calculated Stats strictly within challenge periods
  const totalParticipantsCount = filteredParticipants.length;
  const totalOperatingChallenges = filteredGroups.length;
  
  const totalPeriodStats = useMemo(() => {
    return getParticipantsTotalPeriodStats(filteredParticipants, filteredGroups);
  }, [filteredParticipants, filteredGroups]);

  const totalPostsSum = totalPeriodStats.totalAll;
  const avgPostsPerUser = totalParticipantsCount > 0
    ? (totalPostsSum / totalParticipantsCount).toFixed(1)
    : '0';

  const goalSummaries = useMemo(() => {
    return filteredParticipants.map((p) => calculateParticipantGoal(p, undefined, filteredGroups));
  }, [filteredParticipants, filteredGroups]);

  const avgGoalRate = goalSummaries.length > 0
    ? Math.round(goalSummaries.reduce((sum, g) => sum + g.overallRate, 0) / goalSummaries.length)
    : 0;

  const completedCount = goalSummaries.filter((g) => g.overallRate >= 100).length;
  const overallCompletionRate = totalParticipantsCount > 0
    ? Math.round((completedCount / totalParticipantsCount) * 100)
    : 0;

  // Cohort Performance Summaries strictly within each challenge group's period
  const cohortStatsList = useMemo(() => {
    return filteredGroups.map((group) => {
      const gStats = getChallengeGroupStats(group, participants);
      return {
        group,
        partCount: gStats.totalParticipants,
        postsCount: gStats.totalAll,
        avgRate: gStats.avgGoalRate,
        compCount: gStats.completedCount,
        compRate: gStats.completionRate,
        top3: gStats.top3.map((item) => ({
          ...item.participant,
          periodStats: item.stats,
        })),
      };
    });
  }, [filteredGroups, participants]);

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* 1. Header & Description */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full mb-2">
              <BarChart3 className="w-3.5 h-3.5" />
              통계 및 분석
            </span>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              챌린지 통계
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed font-medium">
              성과 종합, 기수별 순위 및 일자별 성과 추이를 한눈에 확인해보세요.
            </p>
          </div>

          {/* Filters Bar */}
          <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-2xl border border-gray-100 overflow-x-auto max-w-full">
            {/* Filter 1: Group */}
            <div className="flex items-center gap-1 text-xs font-bold text-slate-700 shrink-0">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={selectedGroupFilter}
                onChange={(e) => setSelectedGroupFilter(e.target.value)}
                className="bg-white border border-gray-200 text-slate-800 text-xs font-bold rounded-xl px-2.5 py-1.5 focus:ring-2 focus:ring-blue-600 outline-none cursor-pointer shadow-2xs"
              >
                <option value="all">전체 챌린지</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter 2: Cohort */}
            <div className="flex items-center gap-1 text-xs font-bold text-slate-700 shrink-0">
              <select
                value={selectedCohortFilter}
                onChange={(e) => setSelectedCohortFilter(e.target.value)}
                className="bg-white border border-gray-200 text-slate-800 text-xs font-bold rounded-xl px-2.5 py-1.5 focus:ring-2 focus:ring-blue-600 outline-none cursor-pointer shadow-2xs"
              >
                <option value="all">전체 기수</option>
                {availableCohorts.map((cohort) => (
                  <option key={cohort} value={cohort}>
                    {cohort}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter 3: Period */}
            <div className="flex items-center gap-1 text-xs font-bold text-slate-700 shrink-0">
              <select
                value={selectedPeriodFilter}
                onChange={(e) => setSelectedPeriodFilter(e.target.value)}
                className="bg-white border border-gray-200 text-slate-800 text-xs font-bold rounded-xl px-2.5 py-1.5 focus:ring-2 focus:ring-blue-600 outline-none cursor-pointer shadow-2xs"
              >
                <option value="all">전체 기간</option>
                <option value="30d">최근 30일</option>
                <option value="7d">최근 7일</option>
              </select>
            </div>
          </div>
        </div>

        {/* 2. Sub Navigation Horizontal Tabs Bar */}
        <div className="pt-3 border-t border-gray-100 flex items-center justify-start gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveSubTab('overview')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeSubTab === 'overview'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-gray-100 text-slate-600 hover:bg-gray-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>성과 종합</span>
          </button>

          <button
            onClick={() => setActiveSubTab('rankings')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeSubTab === 'rankings'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-gray-100 text-slate-600 hover:bg-gray-200'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>기수별 순위 & 완주율</span>
          </button>

          <button
            onClick={() => setActiveSubTab('trends')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeSubTab === 'trends'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-gray-100 text-slate-600 hover:bg-gray-200'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>성과 추이 그래프</span>
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: 성과 종합 (Overview KPIs + Cohort Table) */}
      {activeSubTab === 'overview' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Performance Big Number KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            <div className="bg-white p-5 rounded-2xl sm:rounded-3xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-2">
              <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-600" />
                <span>전체 참가자</span>
              </span>
              <div className="flex items-baseline">
                <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  {totalParticipantsCount.toLocaleString()}
                </span>
                <span className="text-xs font-bold text-slate-400 ml-1">명</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl sm:rounded-3xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-2">
              <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-600" />
                <span>운영 챌린지</span>
              </span>
              <div className="flex items-baseline">
                <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  {totalOperatingChallenges.toLocaleString()}
                </span>
                <span className="text-xs font-bold text-slate-400 ml-1">개</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl sm:rounded-3xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-2">
              <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-sky-600" />
                <span>총 포스팅</span>
              </span>
              <div className="flex items-baseline">
                <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  {totalPostsSum.toLocaleString()}
                </span>
                <span className="text-xs font-bold text-slate-400 ml-1">개</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl sm:rounded-3xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-2">
              <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
                <span>1인당 평균</span>
              </span>
              <div className="flex items-baseline">
                <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  {avgPostsPerUser}
                </span>
                <span className="text-xs font-bold text-slate-400 ml-1">개</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl sm:rounded-3xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-2">
              <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                <span>평균 달성률</span>
              </span>
              <div className="flex items-baseline">
                <span className="text-2xl font-extrabold text-blue-600 tracking-tight">
                  {avgGoalRate}
                </span>
                <span className="text-xs font-bold text-slate-400 ml-1">%</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl sm:rounded-3xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-2">
              <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>전체 완주율</span>
              </span>
              <div className="flex items-baseline">
                <span className="text-2xl font-extrabold text-emerald-600 tracking-tight">
                  {overallCompletionRate}
                </span>
                <span className="text-xs font-bold text-slate-400 ml-1">%</span>
              </div>
            </div>
          </div>

          {/* 기수별 통계 Table */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] overflow-hidden space-y-0">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Layers className="w-5 h-5 text-blue-600" />
                <h3 className="font-extrabold text-slate-900 text-base">기수별 성과 종합</h3>
              </div>
              <span className="text-xs text-slate-400 font-bold">총 {cohortStatsList.length}개 그룹</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-gray-50 text-slate-400 font-bold uppercase text-[11px] border-b border-gray-100">
                  <tr>
                    <th className="py-3 px-4">기수 / 챌린지명</th>
                    <th className="py-3 px-4 text-center">참가자</th>
                    <th className="py-3 px-4 text-right">총 포스팅</th>
                    <th className="py-3 px-4 text-right">평균 달성률</th>
                    <th className="py-3 px-4 text-right">완주율</th>
                    <th className="py-3 px-4 text-center w-20">상세</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {cohortStatsList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-400 font-bold">
                        선택된 조건에 해당하는 기수 통계가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    cohortStatsList.map(({ group, partCount, postsCount, avgRate, compRate }) => (
                      <tr
                        key={group.id}
                        onClick={() => onSelectGroup(group)}
                        className="hover:bg-gray-50/80 cursor-pointer transition-colors"
                      >
                        <td className="py-4 px-4">
                          <div className="font-extrabold text-slate-900">{group.name}</div>
                          {group.cohort && (
                            <span className="text-[11px] text-slate-400 font-medium">
                              {group.cohort}
                            </span>
                          )}
                        </td>

                        <td className="py-4 px-4 text-center font-bold text-slate-700">
                          {partCount}명
                        </td>

                        <td className="py-4 px-4 text-right font-extrabold text-blue-600">
                          {postsCount}개
                        </td>

                        <td className="py-4 px-4 text-right font-extrabold text-slate-900">
                          {avgRate}%
                        </td>

                        <td className="py-4 px-4 text-right font-extrabold text-emerald-600">
                          {compRate}%
                        </td>

                        <td className="py-4 px-4 text-center">
                          <button className="p-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-slate-700 transition-colors">
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: 기수별 순위 & 완주율 */}
      {activeSubTab === 'rankings' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-150">
          {/* 기수별 성과 TOP 3 Cards */}
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4">
            <div className="flex items-center space-x-2">
              <Award className="w-5 h-5 text-amber-500" />
              <h3 className="font-extrabold text-slate-900 text-base">기수별 포스팅 성과 TOP 3</h3>
            </div>

            <div className="space-y-3">
              {cohortStatsList.length === 0 ? (
                <p className="text-xs text-slate-400 font-bold">표시할 기수 데이터가 없습니다.</p>
              ) : (
                cohortStatsList.map(({ group, top3 }) => (
                  <div key={group.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-extrabold text-slate-900">{group.name}</span>
                      {group.cohort && (
                        <span className="text-[11px] text-slate-400 font-semibold">{group.cohort}</span>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs">
                      {top3.map((p, idx) => {
                        const totalCount = (p as any).periodStats ? (p as any).periodStats.totalAll : getParticipantPeriodStats(p, { group }).totalAll;
                        const badge = idx === 0 ? '1위' : idx === 1 ? '2위' : '3위';

                        return (
                          <div key={`stat_top3_${p.id}_${idx}`} className="p-2.5 bg-white rounded-xl border border-gray-100 text-center space-y-0.5 shadow-2xs">
                            <span className="text-[10px] font-bold text-amber-600 block">{badge}</span>
                            <span className="text-xs font-bold text-slate-800 block truncate">{p.participantName}</span>
                            <span className="font-extrabold text-blue-600 text-xs block">{totalCount}개</span>
                          </div>
                        );
                      })}
                      {top3.length === 0 && (
                        <div className="col-span-3 text-center text-xs text-slate-400 font-medium py-1">
                          참가자 기록 없음
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 기수별 완주율 비교 Bar Visualizer */}
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <h3 className="font-extrabold text-slate-900 text-base">기수별 완주율 비교</h3>
            </div>

            <div className="space-y-4">
              {cohortStatsList.length === 0 ? (
                <p className="text-xs text-slate-400 font-bold">표시할 완주율 데이터가 없습니다.</p>
              ) : (
                cohortStatsList.map(({ group, partCount, compCount, compRate }) => (
                  <div key={group.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                      <span>{group.name}</span>
                      <span className="text-emerald-600 font-extrabold">
                        {compRate}% ({compCount} / {partCount}명 완주)
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(0, compRate))}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: 성과 추이 그래프 */}
      {activeSubTab === 'trends' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <h3 className="font-extrabold text-slate-900 text-base">날짜별 성과 추이 그래프</h3>
            </div>

            <TrendAnalyticsChart participants={filteredParticipants} />
          </div>
        </div>
      )}
    </div>
  );
};
