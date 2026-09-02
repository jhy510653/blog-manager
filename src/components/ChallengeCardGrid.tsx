import React from 'react';
import { ChallengeGroup, Participant, NaverUser } from '../types';
import { getChallengeGroupStats } from '../utils/challengeStatsUtils';
import { Users, FileText, ArrowRight, Calendar, MessageSquare, Award, Sparkles, Rocket, CheckCircle2 } from 'lucide-react';

interface ChallengeCardGridProps {
  groups: ChallengeGroup[];
  participants: Participant[];
  currentUser: NaverUser | null;
  onSelectGroup: (group: ChallengeGroup) => void;
  onViewLeaderboard?: (group: ChallengeGroup) => void;
  onJoinChallenge: (group: ChallengeGroup) => void;
}

export const ChallengeCardGrid: React.FC<ChallengeCardGridProps> = ({
  groups,
  participants,
  currentUser,
  onSelectGroup,
  onViewLeaderboard,
  onJoinChallenge,
}) => {
  return (
    <section className="mb-6 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base sm:text-lg font-extrabold text-[#3A2A1F] tracking-tight flex items-center gap-2">
            <span>📌 진행 중인 챌린지 목록</span>
            <span className="text-xs font-bold text-[#6F4E37] bg-[#F3E9E0] px-2.5 py-0.5 rounded-full border border-[#E8DACD]">
              {groups.length}개 그룹
            </span>
          </h2>
          <p className="text-xs text-[#8C7A6B] mt-0.5">
            1클릭 참가하기 버튼으로 즉시 챌린지에 도전하고 자동 집계 모니터링을 경험해 보세요!
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {groups.map((group) => {
          // Calculate statistics for this specific group strictly within the challenge period
          const groupStats = getChallengeGroupStats(group, participants);
          const totalParticipants = groupStats.totalParticipants;
          const groupParticipants = groupStats.participants;

          // Check if current user is enrolled in this group
          const isUserJoined = currentUser
            ? groupParticipants.some((p) => {
                const matchBlog = p.blogId && currentUser.naverId && p.blogId.toLowerCase() === currentUser.naverId.toLowerCase();
                const matchName = p.participantName.toLowerCase() === currentUser.name.toLowerCase();
                const matchTwitter = currentUser.twitterId && p.twitterId && p.twitterId.toLowerCase() === currentUser.twitterId.toLowerCase();
                return matchBlog || matchName || matchTwitter;
              })
            : false;

          const totalBlogPosts = groupStats.totalBlogPosts;
          const totalVisitors = groupParticipants.reduce((sum, p) => sum + (p.dailyVisitorCount || 0), 0);
          const totalTweets = groupStats.totalTweets + groupStats.totalReplies;
          const totalActivityCount = groupStats.totalAll;

          // Category Badge Styling
          const categoryBadge =
            group.category === 'blog' ? (
              <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-[#F3E9E0] text-[#6F4E37] border border-[#E8DACD]">
                블로그 전용
              </span>
            ) : group.category === 'twitter' ? (
              <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-[#F3E9E0] text-[#8B5E3C] border border-[#E8DACD]">
                X (트위터) 전용
              </span>
            ) : (
              <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-[#F3E9E0] text-[#3A2A1F] border border-[#E8DACD]">
                통합 (블로그+X)
              </span>
            );

          return (
            <div
              key={group.id}
              className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-indigo-200 transition-all flex flex-col justify-between overflow-hidden group relative"
            >
              <div
                onClick={() => onSelectGroup(group)}
                className="p-3 sm:p-5 space-y-2.5 sm:space-y-3 flex-1 cursor-pointer"
              >
                {/* Header info */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {categoryBadge}
                      <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-indigo-600" />
                        {group.startDate} ~ {group.endDate}
                      </span>
                    </div>
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1 tracking-tight">
                      {group.name}
                    </h3>
                  </div>
                </div>

                {/* Description */}
                {group.description && (
                  <p className="text-[11px] sm:text-xs text-slate-600 line-clamp-2 leading-snug bg-slate-50 p-2 sm:p-2.5 rounded-lg sm:rounded-xl border border-slate-100 font-medium">
                    {group.description}
                  </p>
                )}

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-1.5 sm:gap-2 pt-0.5">
                  <div className="p-2 sm:p-2.5 bg-slate-50/80 rounded-lg sm:rounded-xl border border-slate-100 flex items-center space-x-2">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center shrink-0">
                      <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                    <div className="truncate">
                      <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-tight block truncate">
                        참가자 수
                      </span>
                      <span className="text-xs sm:text-sm font-extrabold text-slate-900">
                        {totalParticipants.toLocaleString()}
                        <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 ml-0.5">명</span>
                      </span>
                    </div>
                  </div>

                  <div className="p-2 sm:p-2.5 bg-slate-50/80 rounded-lg sm:rounded-xl border border-slate-100 flex items-center space-x-2">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center shrink-0">
                      <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                    <div className="truncate">
                      <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-tight block truncate">
                        총 작성 수
                      </span>
                      <span className="text-xs sm:text-sm font-extrabold text-slate-900">
                        {totalActivityCount.toLocaleString()}
                        <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 ml-0.5">개</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sub details */}
                <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-500 px-1 pt-1 border-t border-slate-100">
                  <span className="flex items-center gap-1 font-semibold text-slate-700">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    블로그: <strong className="text-slate-900">{totalBlogPosts}</strong>개
                  </span>
                  <span className="flex items-center gap-1 font-semibold text-slate-700">
                    <MessageSquare className="w-3 h-3 text-sky-500" />
                    트윗: <strong className="text-slate-900">{totalTweets}</strong>개
                  </span>
                </div>
              </div>

              {/* 1-Click Join Button & Leaderboard Footer - Horizontal on Mobile */}
              <div className="p-2 sm:p-3 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between gap-2">
                {/* 1-Click Join Button */}
                {isUserJoined ? (
                  <div className="px-2.5 py-1.5 sm:px-3 rounded-lg sm:rounded-xl bg-emerald-100/90 text-emerald-800 border border-emerald-300/80 text-[11px] sm:text-xs font-black flex items-center justify-center gap-1 shadow-2xs shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>참가 중</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onJoinChallenge(group);
                    }}
                    className="px-2.5 py-1.5 sm:px-3.5 rounded-lg sm:rounded-xl bg-[#03C75A] hover:bg-[#02b351] text-white text-[11px] sm:text-xs font-black flex items-center justify-center gap-1 shadow-2xs transition-all cursor-pointer active:scale-95 shrink-0 min-h-[36px]"
                  >
                    <Rocket className="w-3.5 h-3.5" />
                    <span>참가하기</span>
                  </button>
                )}

                {/* Leaderboard view link */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onViewLeaderboard) {
                      onViewLeaderboard(group);
                    } else {
                      onSelectGroup(group);
                    }
                  }}
                  className="px-2.5 py-1.5 text-[11px] sm:text-xs font-extrabold text-indigo-700 hover:text-indigo-900 hover:bg-indigo-50 rounded-lg sm:rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 shrink-0 min-h-[36px]"
                >
                  <span>리더보드</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

