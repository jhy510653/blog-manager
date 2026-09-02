import React, { useState } from 'react';
import { SummaryStats } from '../types';
import { Users, FileText, TrendingUp, MessageSquare, ChevronUp, ChevronDown } from 'lucide-react';

interface SummaryCardsProps {
  stats: SummaryStats;
  activeGroupName: string;
  category?: 'blog' | 'twitter' | 'both' | 'all';
  defaultCollapsed?: boolean;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({
  stats,
  activeGroupName,
  category = 'all',
  defaultCollapsed = false,
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(defaultCollapsed);

  const displayGroupName =
    activeGroupName === 'all' ? '전체 챌린지' : `${activeGroupName}`;

  const showBlog = category !== 'twitter';
  const showTwitter = category !== 'blog';

  const achievementRate = stats.averageAchievementRate ?? 85;

  return (
    <section className="mb-4 space-y-3">
      {/* Header Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <span>{displayGroupName} 핵심 지표</span>
            <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
              실시간
            </span>
          </h2>
        </div>

        {/* Toggle Button */}
        <button
          type="button"
          onClick={() => setIsCollapsed((prev) => !prev)}
          className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-900 bg-white hover:bg-gray-50 border border-gray-100 transition-all cursor-pointer select-none"
        >
          {isCollapsed ? (
            <>
              <span>지표 펼치기</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </>
          ) : (
            <>
              <span>접기</span>
              <ChevronUp className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>

      {/* Collapsed State */}
      {isCollapsed ? (
        <div className="bg-white rounded-2xl px-5 py-3.5 border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-wrap items-center justify-around gap-4 text-xs font-medium text-slate-700 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" />
            <span>참가자: <strong className="text-slate-900 font-extrabold">{stats.totalParticipants.toLocaleString('ko-KR')}명</strong></span>
          </div>
          {showBlog && (
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-600" />
              <span>블로그 포스팅: <strong className="text-slate-900 font-extrabold">{stats.totalPosts.toLocaleString('ko-KR')}개</strong></span>
            </div>
          )}
          {showTwitter && (
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-sky-600" />
              <span>트윗/답글: <strong className="text-slate-900 font-extrabold">{(stats.totalTweets + stats.totalReplies).toLocaleString('ko-KR')}개</strong></span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-500" />
            <span>평균 달성률: <strong className="text-slate-900 font-extrabold">{achievementRate}%</strong></span>
          </div>
        </div>
      ) : (
        /* Toss-style Big Number KPI Cards */
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 animate-in fade-in duration-200">
          
          {/* Card 1: 총 참가자 */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-6 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-semibold text-slate-500">
                  총 참가자
                </span>
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline">
                <span className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight">
                  {stats.totalParticipants.toLocaleString('ko-KR')}
                </span>
                <span className="text-sm font-bold text-slate-400 ml-1">명</span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100/80 text-[11px] text-slate-400 flex items-center gap-1.5 truncate">
              <span className="text-blue-600 font-bold">블로그 {stats.activeBloggersCount}</span>
              <span>•</span>
              <span className="text-sky-600 font-bold">트위터 {stats.activeTweetersCount}</span>
            </div>
          </div>

          {/* Card 2: 블로그 포스팅 */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-6 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-semibold text-slate-500">
                  블로그 포스팅
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline">
                <span className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight">
                  {stats.totalPosts.toLocaleString('ko-KR')}
                </span>
                <span className="text-sm font-bold text-slate-400 ml-1">개</span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100/80 text-[11px] text-slate-400 flex items-center justify-between">
              <span className="truncate">공식 RSS 실시간 집계</span>
            </div>
          </div>

          {/* Card 3: 트윗 / 답글 */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-6 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-semibold text-slate-500">
                  트윗 / 답글
                </span>
                <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                  <MessageSquare className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline">
                <span className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight">
                  {(stats.totalTweets + stats.totalReplies).toLocaleString('ko-KR')}
                </span>
                <span className="text-sm font-bold text-slate-400 ml-1">개</span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100/80 text-[11px] text-slate-400 flex items-center gap-1.5">
              <span>게시글 <strong className="text-slate-700 font-bold">{stats.totalTweets}</strong></span>
              <span>•</span>
              <span>답글 <strong className="text-slate-700 font-bold">{stats.totalReplies}</strong></span>
            </div>
          </div>

          {/* Card 4: 평균 달성률 */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-6 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-semibold text-slate-500">
                  평균 달성률
                </span>
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline">
                <span className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight">
                  {achievementRate}
                </span>
                <span className="text-sm font-bold text-slate-400 ml-1">%</span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100/80 text-[11px] text-slate-400 flex items-center justify-between">
              <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-full">
                목표 달성 기준
              </span>
            </div>
          </div>

        </div>
      )}
    </section>
  );
};
