import React from 'react';
import { Participant, ChallengeGroup } from '../types';
import { getMemberChallengeHistory } from '../utils/memberUtils';
import {
  User,
  BookOpen,
  Twitter,
  ExternalLink,
  Trophy,
  Calendar,
  Clock,
  Target,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Award,
  Sparkles,
  Flame,
} from 'lucide-react';

interface MemberDetailViewProps {
  userId: string;
  participants: Participant[];
  groups: ChallengeGroup[];
  onBack: () => void;
  onSelectChallenge?: (groupId: string) => void;
}

export const MemberDetailView: React.FC<MemberDetailViewProps> = ({
  userId,
  participants,
  groups,
  onBack,
  onSelectChallenge,
}) => {
  const { currentChallenges, pastChallenges, primaryParticipant } =
    getMemberChallengeHistory(userId, participants, groups);

  if (!primaryParticipant) {
    return (
      <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center space-y-4 max-w-md mx-auto my-12 shadow-2xs">
        <p className="text-base font-extrabold text-slate-800">
          요청하신 멤버 프로필 정보를 찾을 수 없습니다.
        </p>
        <p className="text-xs text-slate-500">
          삭제되었거나 잘못된 접근 주소일 수 있습니다.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all cursor-pointer"
        >
          ← 멤버 목록으로 돌아가기
        </button>
      </div>
    );
  }

  const name = primaryParticipant.participantName || '무명 회원';
  const naverId = primaryParticipant.blogId || null;
  const twitterId = primaryParticipant.twitterId || null;
  const naverBlogUrl = naverId ? `https://blog.naver.com/${naverId}` : null;
  const twitterUrl = twitterId ? `https://twitter.com/${twitterId.replace(/^@/, '')}` : null;

  return (
    <div className="space-y-4 animate-in fade-in duration-150 max-w-4xl mx-auto">
      
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between pb-1">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 text-xs font-extrabold rounded-2xl border border-slate-200/90 shadow-2xs transition-all cursor-pointer active:scale-98"
        >
          <ArrowLeft className="w-4 h-4 text-slate-500" />
          <span>멤버 목록으로 돌아가기</span>
        </button>
      </div>

      {/* 1. 기본 프로필 (Basic Profile) */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-slate-900 text-white font-black text-xl flex items-center justify-center shrink-0 shadow-sm">
              {name.substring(0, 1)}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  {name}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  챌린지 멤버
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                등록된 네이버 블로그 및 트위터 소셜 계정 정보입니다.
              </p>
            </div>
          </div>
        </div>

        {/* Profile Attributes Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          
          {/* Nickname / Name */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60 space-y-1">
            <span className="text-slate-500 font-bold block text-[11px]">성함 / 닉네임</span>
            <span className="text-sm font-black text-slate-900">{name}</span>
          </div>

          {/* Naver ID */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60 space-y-1">
            <span className="text-slate-500 font-bold block text-[11px]">네이버 아이디</span>
            {naverId ? (
              <span className="text-sm font-mono font-black text-slate-900">@{naverId}</span>
            ) : (
              <span className="text-sm font-medium text-slate-400">미등록</span>
            )}
          </div>

          {/* Naver Blog Link */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60 space-y-1">
            <span className="text-slate-500 font-bold block text-[11px]">네이버 블로그</span>
            {naverBlogUrl ? (
              <a
                href={naverBlogUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-bold text-indigo-600 hover:underline inline-flex items-center gap-1 truncate max-w-full"
              >
                <span>블로그 바로가기</span>
                <ExternalLink className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              </a>
            ) : (
              <span className="text-sm font-medium text-slate-400">미등록</span>
            )}
          </div>

          {/* Twitter ID */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60 space-y-1">
            <span className="text-slate-500 font-bold block text-[11px]">트위터 아이디</span>
            {twitterId ? (
              <a
                href={twitterUrl || '#'}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-bold text-sky-600 hover:underline inline-flex items-center gap-1 truncate max-w-full"
              >
                <span>@{twitterId.replace(/^@/, '')}</span>
                <ExternalLink className="w-3.5 h-3.5 text-sky-500 shrink-0" />
              </a>
            ) : (
              <span className="text-sm font-medium text-slate-400">미등록</span>
            )}
          </div>

        </div>
      </div>

      {/* 2. 현재 참여 중인 챌린지 (Currently Participating Challenge) */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <Trophy className="w-4 h-4" />
            </div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
              현재 참여 중인 챌린지
            </h2>
          </div>
          <span className="text-xs font-bold bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full border border-emerald-200">
            {currentChallenges.length}개 진행 중
          </span>
        </div>

        {currentChallenges.length === 0 ? (
          <div className="bg-slate-50/70 rounded-2xl p-6 text-center border border-slate-200/60 space-y-1">
            <p className="text-sm font-bold text-slate-700">현재 참여 중인 챌린지가 없습니다.</p>
            <p className="text-xs text-slate-500">새로운 챌린지가 개설되면 언제든지 도전해보세요!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {currentChallenges.map((item) => (
              <div
                key={item.groupId}
                onClick={() => onSelectChallenge?.(item.groupId)}
                className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-4 sm:p-5 border border-indigo-500/30 shadow-md space-y-3 cursor-pointer hover:border-indigo-400 transition-all group"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      {item.term && (
                        <span className="bg-indigo-500/30 text-indigo-200 text-[10px] font-extrabold px-2 py-0.5 rounded-md border border-indigo-400/30">
                          {item.term}
                        </span>
                      )}
                      <h3 className="text-base font-extrabold text-white group-hover:text-amber-300 transition-colors">
                        {item.groupName}
                      </h3>
                    </div>
                    {item.startDate && item.endDate && (
                      <p className="text-xs text-slate-300 font-medium flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-indigo-300 shrink-0" />
                        <span>진행 기간: {item.startDate} ~ {item.endDate}</span>
                      </p>
                    )}
                  </div>

                  <span className="self-start sm:self-auto bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full text-xs font-black border border-emerald-400/30 shrink-0">
                    진행 중
                  </span>
                </div>

                {/* Performance Progress Grid */}
                <div className="grid grid-cols-3 gap-2 text-center pt-1">
                  <div className="bg-white/10 p-2.5 rounded-xl border border-white/10">
                    <span className="text-[10px] font-bold text-slate-300 block">작성 포스팅 수</span>
                    <span className="text-base sm:text-lg font-black text-amber-300">
                      {item.postCount}개
                    </span>
                  </div>

                  <div className="bg-white/10 p-2.5 rounded-xl border border-white/10">
                    <span className="text-[10px] font-bold text-slate-300 block">목표 포스팅</span>
                    <span className="text-base sm:text-lg font-black text-white">
                      {item.targetPostCount > 0 ? `${item.targetPostCount}개` : '자율'}
                    </span>
                  </div>

                  <div className="bg-white/10 p-2.5 rounded-xl border border-white/10">
                    <span className="text-[10px] font-bold text-slate-300 block">목표 달성률</span>
                    <span className="text-base sm:text-lg font-black text-emerald-300">
                      {item.achievementRate}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. 챌린지 참여 이력 (Challenge History) */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold">
              <Award className="w-4 h-4" />
            </div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
              챌린지 참여 이력
            </h2>
          </div>
          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
            총 {pastChallenges.length}건
          </span>
        </div>

        {pastChallenges.length === 0 ? (
          <div className="bg-slate-50/70 rounded-2xl p-6 text-center border border-slate-200/60 space-y-1">
            <p className="text-sm font-bold text-slate-700">참여한 챌린지 이력이 없습니다.</p>
            <p className="text-xs text-slate-500">종료된 과거 챌린지 참가 기록이 여기에 순서대로 기록됩니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pastChallenges.map((item) => (
              <div
                key={item.groupId}
                className="bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-200/80 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-3">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      {item.term && (
                        <span className="bg-slate-200 text-slate-700 text-[10px] font-extrabold px-2 py-0.5 rounded-md border border-slate-300/80">
                          {item.term}
                        </span>
                      )}
                      <h3 className="text-base font-extrabold text-slate-900">
                        {item.groupName}
                      </h3>
                    </div>
                    {item.startDate && item.endDate && (
                      <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>참여 기간: {item.startDate} ~ {item.endDate}</span>
                      </p>
                    )}
                  </div>

                  {item.isCompleted ? (
                    <span className="self-start sm:self-auto inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-black border border-emerald-200 shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>완주</span>
                    </span>
                  ) : (
                    <span className="self-start sm:self-auto inline-flex items-center gap-1 bg-slate-200/80 text-slate-600 px-3 py-1 rounded-full text-xs font-bold border border-slate-300 shrink-0">
                      <XCircle className="w-3.5 h-3.5 text-slate-500" />
                      <span>미완주</span>
                    </span>
                  )}
                </div>

                {/* History Metrics */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1">
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200/70">
                    <span className="text-[10px] text-slate-500 font-bold block">포스팅 수</span>
                    <span className="text-sm font-black text-slate-900">
                      {item.postCount}개
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-slate-200/70">
                    <span className="text-[10px] text-slate-500 font-bold block">목표 포스팅 수</span>
                    <span className="text-sm font-black text-slate-600">
                      {item.targetPostCount > 0 ? `${item.targetPostCount}개` : '자율'}
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-slate-200/70">
                    <span className="text-[10px] text-slate-500 font-bold block">달성률</span>
                    <span className={`text-sm font-black ${item.isCompleted ? 'text-emerald-600' : 'text-slate-700'}`}>
                      {item.achievementRate}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
