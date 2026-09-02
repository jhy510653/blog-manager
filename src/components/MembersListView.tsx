import React from 'react';
import { Participant, ChallengeGroup } from '../types';
import { getUniqueMembers } from '../utils/memberUtils';
import { Users, ExternalLink, ChevronRight, BookOpen, Twitter, ArrowLeft } from 'lucide-react';

interface MembersListViewProps {
  participants: Participant[];
  groups: ChallengeGroup[];
  onSelectMember: (userId: string) => void;
  onBackToHome: () => void;
}

export const MembersListView: React.FC<MembersListViewProps> = ({
  participants,
  groups,
  onSelectMember,
  onBackToHome,
}) => {
  const members = getUniqueMembers(participants, groups);

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      
      {/* Top Banner & Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-600">
                <Users className="w-3.5 h-3.5 mr-1" />
                가입 멤버
              </span>
              <span className="text-xs text-slate-400 font-semibold">
                총 {members.length}명
              </span>
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              가입 멤버 현황
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed max-w-2xl">
              챌린지에 참가 중인 전체 멤버 목록과 네이버 블로그/트위터 계정 및 활동 달성 현황입니다.
            </p>
          </div>

          <button
            type="button"
            onClick={onBackToHome}
            className="self-start sm:self-auto px-4 py-2 bg-gray-50 hover:bg-gray-100 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer border border-gray-100 flex items-center gap-1.5 shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>홈으로 이동</span>
          </button>
        </div>
      </div>

      {/* Members Grid / List */}
      {members.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-gray-50 text-slate-400 flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <p className="text-base font-bold text-slate-700">등록된 가입 멤버가 없습니다.</p>
          <p className="text-xs text-slate-400">챌린지에 참가 신청이 완료되면 여기에 멤버 현황이 표시됩니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {members.map((member) => {
            const hasActiveChallenge = member.activeChallengeNames.length > 0;
            const naverBlogUrl = member.naverId
              ? `https://blog.naver.com/${member.naverId}`
              : null;

            return (
              <div
                key={member.userId}
                onClick={() => onSelectMember(member.userId)}
                className="bg-white rounded-2xl sm:rounded-3xl p-6 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] hover:border-gray-200 transition-all cursor-pointer space-y-4 group flex flex-col justify-between"
              >
                {/* Header: Name & Active Status */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center space-x-3">
                      <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 font-extrabold text-sm flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        {member.name.substring(0, 1)}
                      </div>
                      <div>
                        <h3 className="text-base font-extrabold text-slate-900 group-hover:text-blue-600 transition-colors flex items-center gap-1.5">
                          <span>{member.name}</span>
                          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                        </h3>
                        <span className="text-[11px] font-semibold text-slate-400 block">
                          프로필 등록 멤버
                        </span>
                      </div>
                    </div>

                    {hasActiveChallenge ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 shrink-0">
                        참여 중
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-500 shrink-0">
                        미참여
                      </span>
                    )}
                  </div>

                  {/* Social Accounts Details */}
                  <div className="bg-gray-50/80 rounded-2xl p-3.5 border border-gray-100/80 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-semibold flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>네이버 ID</span>
                      </span>
                      {member.naverId ? (
                        <a
                          href={naverBlogUrl || '#'}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="font-mono text-blue-600 font-bold hover:underline inline-flex items-center gap-1 truncate max-w-[140px]"
                        >
                          <span>@{member.naverId}</span>
                          <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
                        </a>
                      ) : (
                        <span className="text-slate-400 font-medium">미등록</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-semibold flex items-center gap-1.5">
                        <Twitter className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                        <span>트위터 ID</span>
                      </span>
                      {member.twitterId ? (
                        <span className="font-mono text-slate-800 font-bold truncate max-w-[140px]">
                          @{member.twitterId.replace(/^@/, '')}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-medium">미등록</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Challenge Stats Summary Section */}
                <div className="pt-3 border-t border-gray-100 space-y-2.5">
                  <div className="text-xs">
                    <span className="text-slate-400 font-semibold block mb-1">현재 참여 챌린지</span>
                    {hasActiveChallenge ? (
                      <p className="text-xs font-extrabold text-slate-900 truncate">
                        {member.activeChallengeNames.join(', ')}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400">현재 참여 중인 챌린지가 없습니다.</p>
                    )}
                  </div>

                  {hasActiveChallenge && (
                    <div className="grid grid-cols-2 gap-2 bg-blue-50/50 p-3 rounded-2xl border border-blue-100/60 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block">포스팅 수</span>
                        <span className="text-sm font-extrabold text-blue-700">
                          {member.totalCurrentPosts}개
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block">목표 달성률</span>
                        <span className="text-sm font-extrabold text-emerald-600">
                          {member.avgCurrentAchievementRate}%
                        </span>
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
  );
};
