import React, { useState } from 'react';
import { ChallengeGroup, Participant, NaverUser, ChallengeResource } from '../types';
import { getParticipantPeriodStats } from '../utils/challengeStatsUtils';
import {
  X,
  Calendar,
  Clock,
  Target,
  Users,
  Award,
  BookOpen,
  FileText,
  ShieldAlert,
  Sparkles,
  Rocket,
  CheckCircle2,
  TrendingUp,
  Info,
  ExternalLink,
  Download,
  Lock,
} from 'lucide-react';

interface ChallengeDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: ChallengeGroup | null;
  participants: Participant[];
  currentUser: NaverUser | null;
  resources: ChallengeResource[];
  onOpenApplyModal: (group: ChallengeGroup) => void;
}

export const ChallengeDetailModal: React.FC<ChallengeDetailModalProps> = ({
  isOpen,
  onClose,
  group,
  participants,
  currentUser,
  resources,
  onOpenApplyModal,
}) => {
  if (!isOpen || !group) return null;

  const [activeTab, setActiveTab] = useState<'info' | 'leaderboard' | 'resources'>('info');

  // Compute challenge status based on dates
  const todayStr = new Date().toISOString().split('T')[0];
  let calculatedStatus: 'recruiting' | 'in_progress' | 'ended' = 'in_progress';

  if (group.startDate && todayStr < group.startDate) {
    calculatedStatus = 'recruiting';
  } else if (group.endDate && todayStr > group.endDate) {
    calculatedStatus = 'ended';
  } else {
    calculatedStatus = 'in_progress';
  }

  // Filter participants for this challenge
  const groupParticipants = participants.filter((p) => {
    if (p.groupName === group.name) return true;
    if (p.groupNames && p.groupNames.includes(group.name)) return true;
    if (p.groupName && p.groupName.split(',').map((s) => s.trim()).includes(group.name)) return true;
    return false;
  });

  // Check if current user is enrolled as participant
  const isParticipant = currentUser
    ? groupParticipants.some((p) => {
        const matchBlog = p.blogId && currentUser.naverId && p.blogId.toLowerCase() === currentUser.naverId.toLowerCase();
        const matchName = p.participantName.toLowerCase() === currentUser.name.toLowerCase();
        const matchTwitter = currentUser.twitterId && p.twitterId && p.twitterId.toLowerCase() === currentUser.twitterId.toLowerCase();
        return matchBlog || matchName || matchTwitter;
      })
    : false;

  // Find user's own participant record if enrolled
  const myParticipant = currentUser
    ? groupParticipants.find((p) => {
        const matchBlog = p.blogId && currentUser.naverId && p.blogId.toLowerCase() === currentUser.naverId.toLowerCase();
        const matchName = p.participantName.toLowerCase() === currentUser.name.toLowerCase();
        const matchTwitter = currentUser.twitterId && p.twitterId && p.twitterId.toLowerCase() === currentUser.twitterId.toLowerCase();
        return matchBlog || matchName || matchTwitter;
      })
    : null;

  // Leaderboard ranking calculation strictly using challenge period posting data
  const rankedParticipants = [...groupParticipants].sort((a, b) => {
    const totalA = getParticipantPeriodStats(a, { group }).totalAll;
    const totalB = getParticipantPeriodStats(b, { group }).totalAll;
    if (totalB !== totalA) return totalB - totalA;
    return (b.streakDays || 0) - (a.streakDays || 0);
  });

  const myRankIndex = myParticipant
    ? rankedParticipants.findIndex((p) => p.id === myParticipant.id)
    : -1;

  const myRank = myRankIndex !== -1 ? myRankIndex + 1 : null;
  const myPeriodStats = myParticipant ? getParticipantPeriodStats(myParticipant, { group }) : null;

  // Filter resources for this challenge
  const groupResources = resources.filter(
    (r) => r.targetGroup === 'all' || r.targetGroup === group.name
  );

  const statusBadge =
    calculatedStatus === 'recruiting' ? (
      <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
        모집 중
      </span>
    ) : calculatedStatus === 'in_progress' ? (
      <span className="px-3 py-1 rounded-full text-xs font-black bg-indigo-100 text-indigo-800 border border-indigo-300 flex items-center gap-1">
        <Clock className="w-3.5 h-3.5 text-indigo-600" />
        진행 중
      </span>
    ) : (
      <span className="px-3 py-1 rounded-full text-xs font-black bg-slate-100 text-slate-600 border border-slate-300 flex items-center gap-1">
        종료
      </span>
    );

  const missionDaysText = group.missionDays && group.missionDays.length > 0
    ? group.missionDays.join(', ')
    : '월 ~ 일 (매일)';

  const goalText = group.goalUnit === 'weekly'
    ? `주간 ${group.targetBlogPostCount || 3}회`
    : `일간 ${group.targetBlogPostCount || 1}개`;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-stone-200 shadow-2xl max-w-3xl w-full p-5 sm:p-6 space-y-5 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b border-stone-100 pb-4">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2">
              {statusBadge}
              <div className="flex items-center gap-2 flex-wrap">
                {group.recruitingStartDate && group.recruitingEndDate && (
                  <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-100 text-[11px] font-bold">
                    모집: {group.recruitingStartDate} ~ {group.recruitingEndDate}
                  </span>
                )}
                <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                  운영: {group.startDate} ~ {group.endDate}
                </span>
              </div>
            </div>
            <h2 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight">
              {group.name}
            </h2>
            <p className="text-xs text-slate-600 leading-snug">
              {group.description || '네이버 블로그 수익화를 위한 미션 및 자동 집계 챌린지입니다.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs (Info / Leaderboard / Resources) */}
        <div className="flex items-center gap-1.5 border-b border-slate-200/80 pb-2">
          <button
            onClick={() => setActiveTab('info')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'info'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span>챌린지 상세 정보</span>
          </button>

          {isParticipant && (
            <>
              <button
                onClick={() => setActiveTab('leaderboard')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'leaderboard'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Award className="w-3.5 h-3.5 text-amber-400" />
                <span>참가자 현황 & 리더보드</span>
              </button>

              <button
                onClick={() => setActiveTab('resources')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'resources'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                <span>챌린지 자료실 ({groupResources.length})</span>
              </button>
            </>
          )}
        </div>

        {/* Tab 1: Info View */}
        {activeTab === 'info' && (
          <div className="space-y-4 text-xs text-slate-800">
            
            {/* Rules & Metadata Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-tight block">
                  운영 핵심 정보
                </span>
                <div className="space-y-1.5 font-medium">
                  <div className="flex justify-between">
                    <span className="text-slate-500">참여 요일:</span>
                    <span className="font-bold text-slate-900">{missionDaysText}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">목표 기준:</span>
                    <span className="font-bold text-slate-900">{goalText}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">참가비 / 환급금:</span>
                    <span className="font-bold text-slate-900">
                      {group.fee ? `${group.fee.toLocaleString()}원` : '무료'} 
                      {group.refundFee ? ` (환급 최대 ${group.refundFee.toLocaleString()}원)` : ''}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-tight block">
                  참가 및 인증 현황
                </span>
                <div className="space-y-1.5 font-medium">
                  <div className="flex justify-between">
                    <span className="text-slate-500">현재 참가자 수:</span>
                    <span className="font-bold text-slate-900">{groupParticipants.length}명</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">인증 방식:</span>
                    <span className="font-bold text-emerald-700">RSS / 트위터 자동 집계</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">내 참가 상태:</span>
                    <span className="font-bold text-slate-900">
                      {isParticipant ? '✅ 참가 중' : '미참가'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Rules Box */}
            <div className="bg-indigo-50/70 p-4 rounded-2xl border border-indigo-100 space-y-2">
              <h4 className="font-extrabold text-indigo-950 text-xs flex items-center gap-1.5">
                <Target className="w-4 h-4 text-indigo-600" />
                <span>인증 규칙 & 운영 가이드</span>
              </h4>
              <ul className="list-disc list-inside text-indigo-900 text-xs space-y-1 leading-relaxed">
                <li>매일 자정 네이버 블로그 RSS 및 X(트위터) 작성물이 자동 집계됩니다.</li>
                <li>설정한 참여 요일에 게시글 작성 시 달성율이 자동으로 상승합니다.</li>
                <li>챌린지 참가자에게는 전용 자료실 가이드 및 모니터링 리더보드가 제공됩니다.</li>
              </ul>
            </div>

            {/* Non-participant CTA area */}
            {!isParticipant && (
              <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="space-y-0.5 text-center sm:text-left">
                  <p className="font-extrabold text-slate-900">
                    {calculatedStatus === 'recruiting'
                      ? '지금 챌린지에 도전해보세요!'
                      : '비참가자 열람 모드입니다.'}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {calculatedStatus === 'recruiting'
                      ? '1클릭 참가 신청으로 수익화 블로그 습관을 시작하세요.'
                      : '진행 중 또는 종료된 챌린지는 기본 규칙만 열람 가능합니다.'}
                  </p>
                </div>

                {calculatedStatus === 'recruiting' && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenApplyModal(group);
                    }}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs transition-all cursor-pointer shadow-md flex items-center gap-1.5 shrink-0 active:scale-95"
                  >
                    <Rocket className="w-4 h-4" />
                    <span>참가 신청하기</span>
                  </button>
                )}
              </div>
            )}

            {/* Participant Personal Summary Card */}
            {isParticipant && myParticipant && (
              <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-4 rounded-2xl space-y-2.5 shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-indigo-300">
                    🔥 나의 챌린지 달성 상태
                  </span>
                  <span className="text-xs font-black bg-indigo-600 px-2.5 py-0.5 rounded-full">
                    순위: {myRank ? `${myRank}위` : '-'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center pt-1">
                  <div className="bg-white/10 p-2 rounded-xl">
                    <span className="text-[10px] text-slate-300 block">블로그 포스팅</span>
                    <span className="text-sm font-black text-emerald-400">{myPeriodStats?.blogPosts || 0}개</span>
                  </div>
                  <div className="bg-white/10 p-2 rounded-xl">
                    <span className="text-[10px] text-slate-300 block">트윗 작성</span>
                    <span className="text-sm font-black text-sky-400">{myPeriodStats?.tweets || 0}개</span>
                  </div>
                  <div className="bg-white/10 p-2 rounded-xl">
                    <span className="text-[10px] text-slate-300 block">연속 스트릭</span>
                    <span className="text-sm font-black text-amber-400">🔥 {myParticipant.streakDays || 1}일</span>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

        {/* Tab 2: Leaderboard */}
        {activeTab === 'leaderboard' && isParticipant && (
          <div className="space-y-3.5">
            
            {/* My Rank Highlight Banner */}
            {myRank && myParticipant && (
              <div className="bg-amber-50 border border-amber-200/80 p-3.5 rounded-2xl flex items-center justify-between text-xs text-amber-900">
                <div className="flex items-center space-x-2">
                  <Award className="w-5 h-5 text-amber-600 shrink-0" />
                  <div>
                    <p className="font-extrabold text-sm">
                      현재 내 순위: <strong className="text-amber-700">{myRank}위</strong> / {rankedParticipants.length}명
                    </p>
                    <p className="text-[11px] text-amber-800">
                      챌린지 실적: 블로그 {myPeriodStats?.blogPosts || 0}개 | 트윗 {myPeriodStats?.tweets || 0}개
                    </p>
                  </div>
                </div>
                <span className="text-xs font-black bg-amber-200 text-amber-900 px-3 py-1 rounded-full">
                  참가 중
                </span>
              </div>
            )}

            {/* Leaderboard Table */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
              <div className="bg-slate-50 px-4 py-2 text-[11px] font-bold text-slate-500 grid grid-cols-12 gap-2">
                <span className="col-span-2 text-center">순위</span>
                <span className="col-span-5">참가자명</span>
                <span className="col-span-5 text-right">포스팅 실적</span>
              </div>

              {rankedParticipants.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  아직 참가자가 없습니다.
                </div>
              ) : (
                rankedParticipants.map((p, idx) => {
                  const isMe = myParticipant && p.id === myParticipant.id;
                  const pPeriodStats = getParticipantPeriodStats(p, { group });
                  const totalCount = pPeriodStats.totalAll;

                  return (
                    <div
                      key={p.id}
                      className={`px-4 py-3 text-xs grid grid-cols-12 gap-2 items-center transition-colors ${
                        isMe ? 'bg-amber-50/60 font-bold' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="col-span-2 text-center font-black">
                        {idx === 0 ? '🥇 1위' : idx === 1 ? '🥈 2위' : idx === 2 ? '🥉 3위' : `${idx + 1}위`}
                      </div>
                      <div className="col-span-5 truncate flex items-center space-x-1.5">
                        <span className="text-slate-900 font-extrabold">{p.participantName}</span>
                        {isMe && (
                          <span className="text-[9px] bg-slate-900 text-white px-1.5 py-0.2 rounded font-bold">
                            나
                          </span>
                        )}
                      </div>
                      <div className="col-span-5 text-right font-extrabold text-indigo-700">
                        총 {totalCount}개 작성
                        <span className="text-[10px] text-slate-400 font-medium block">
                          (블로그 {pPeriodStats.blogPosts}개 / 트윗 {pPeriodStats.tweets}개)
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>
        )}

        {/* Tab 3: Resources View */}
        {activeTab === 'resources' && isParticipant && (
          <div className="space-y-3">
            {groupResources.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 space-y-1">
                <BookOpen className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="font-bold text-slate-600">등록된 챌린지 자료가 없습니다.</p>
              </div>
            ) : (
              groupResources.map((r) => (
                <div
                  key={r.id}
                  className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 flex-1">
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                      {r.targetGroup === 'all' ? '전체 공통' : r.targetGroup}
                    </span>
                    <h4 className="text-sm font-extrabold text-slate-900">
                      {r.title}
                    </h4>
                    {r.description && (
                      <p className="text-xs text-slate-600 line-clamp-2">
                        {r.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {r.linkUrl && (
                      <a
                        href={r.linkUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-800 flex items-center gap-1"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>열기</span>
                      </a>
                    )}
                    {r.fileUrl && (
                      <a
                        href={r.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>다운로드</span>
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

      </div>
    </div>
  );
};
