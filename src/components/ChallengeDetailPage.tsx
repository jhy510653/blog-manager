import React, { useState } from 'react';
import { ChallengeGroup, Participant, NaverUser, ChallengeResource } from '../types';
import { calculateParticipantGoal } from '../utils/goalCalculator';
import { getParticipantPeriodStats, getChallengeGroupStats } from '../utils/challengeStatsUtils';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Target,
  Users,
  Award,
  BookOpen,
  FileText,
  Sparkles,
  Rocket,
  CheckCircle2,
  TrendingUp,
  Info,
  ExternalLink,
  Download,
  ShieldAlert,
  BarChart3,
  X,
  Globe,
  Flame,
} from 'lucide-react';

interface ChallengeDetailPageProps {
  group: ChallengeGroup;
  initialTab?: 'info' | 'leaderboard' | 'resources' | 'my_status';
  participants: Participant[];
  currentUser: NaverUser | null;
  resources: ChallengeResource[];
  onNavigate: (path: string) => void;
  onOpenApplyModal: (group: ChallengeGroup) => void;
  onJoinChallenge: (group: ChallengeGroup) => void;
  onBack: () => void;
}

export const ChallengeDetailPage: React.FC<ChallengeDetailPageProps> = ({
  group,
  initialTab = 'info',
  participants,
  currentUser,
  resources,
  onNavigate,
  onOpenApplyModal,
  onJoinChallenge,
  onBack,
}) => {
  const [activeTab, setActiveTab] = useState<'info' | 'leaderboard' | 'resources' | 'my_status'>(initialTab);
  const [selectedParticipantDetail, setSelectedParticipantDetail] = useState<Participant | null>(null);

  // Sync tab state if initialTab prop changes from route
  React.useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Compute challenge status based on dates
  const todayStr = new Date().toISOString().split('T')[0];
  let calculatedStatus: 'recruiting' | 'in_progress' | 'ended' = group.status || 'in_progress';

  if (group.startDate && todayStr < group.startDate) {
    calculatedStatus = 'recruiting';
  } else if (group.endDate && todayStr > group.endDate) {
    calculatedStatus = 'ended';
  } else if (!group.status) {
    calculatedStatus = 'in_progress';
  }

  // Filter participants for this challenge group
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
        return Boolean(matchBlog || matchName || matchTwitter);
      })
    : false;

  // Find user's own participant record if enrolled
  const myParticipant = currentUser
    ? groupParticipants.find((p) => {
        const matchBlog = p.blogId && currentUser.naverId && p.blogId.toLowerCase() === currentUser.naverId.toLowerCase();
        const matchName = p.participantName.toLowerCase() === currentUser.name.toLowerCase();
        const matchTwitter = currentUser.twitterId && p.twitterId && p.twitterId.toLowerCase() === currentUser.twitterId.toLowerCase();
        return Boolean(matchBlog || matchName || matchTwitter);
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
  const myTotalPosts = myPeriodStats ? myPeriodStats.totalAll : 0;

  // Filter resources for this challenge
  const groupResources = resources.filter((r) => {
    if (r.isPublished === false) return false;
    if (r.visibility === 'all' || r.targetGroup === 'all') return true;
    if (r.targetGroupNames && r.targetGroupNames.includes(group.name)) return true;
    if (r.targetGroupIds && r.targetGroupIds.includes(group.id)) return true;
    if (r.targetGroup === group.name) return true;
    return false;
  });

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

  const dailyGoalText = group.goalUnit === 'daily' || !group.goalUnit
    ? `일간 ${group.targetBlogPostCount || 1}개`
    : '-';

  const weeklyGoalText = group.goalUnit === 'weekly'
    ? `주간 ${group.targetBlogPostCount || 3}회`
    : '-';

  return (
    <div className="space-y-4 animate-in fade-in duration-150 max-w-5xl mx-auto pb-12">
      {/* Top Breadcrumb / Back Button */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-all cursor-pointer shadow-2xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>챌린지 목록으로 돌아가기</span>
        </button>

        <span className="text-xs font-semibold text-slate-400">
          ID: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-mono">{group.id}</code>
        </span>
      </div>

      {/* Challenge Header Card */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-5 sm:p-7 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {statusBadge}
              <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
                {group.category === 'blog' ? '블로그 전용' : group.category === 'twitter' ? 'X(트위터) 전용' : '통합 (블로그+X)'}
              </span>
              <span className="text-xs font-extrabold text-slate-500 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                {group.startDate} ~ {group.endDate}
              </span>
            </div>
            <h1 className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {group.name}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-3xl">
              {group.description || '네이버 블로그 및 트위터 포스팅 자동 집계 챌린지입니다.'}
            </p>
          </div>

          {/* Action CTA depending on participant status */}
          <div className="shrink-0 flex items-center gap-2">
            {isParticipant ? (
              <div className="px-4 py-2 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-black flex items-center gap-1.5 shadow-2xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>참가 중인 챌린지</span>
              </div>
            ) : (
              calculatedStatus !== 'ended' && (
                <button
                  onClick={() => onOpenApplyModal(group)}
                  className="px-5 py-2.5 rounded-2xl bg-[#03C75A] hover:bg-[#02b351] text-white font-black text-xs sm:text-sm transition-all cursor-pointer shadow-md flex items-center gap-1.5 active:scale-95"
                >
                  <Rocket className="w-4 h-4" />
                  <span>참가 신청하기</span>
                </button>
              )
            )}
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1">
          <button
            onClick={() => {
              setActiveTab('info');
              onNavigate(`/challenges/${group.id}`);
            }}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'info'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Info className="w-4 h-4" />
            <span>챌린지 상세</span>
          </button>

          {isParticipant ? (
            <>
              <button
                onClick={() => {
                  setActiveTab('my_status');
                }}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'my_status'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span>내 진행 현황</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('leaderboard');
                  onNavigate(`/challenges/${group.id}/leaderboard`);
                }}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'leaderboard'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Award className="w-4 h-4 text-amber-400" />
                <span>리더보드</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('resources');
                }}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'resources'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <BookOpen className="w-4 h-4 text-indigo-400" />
                <span>자료실 ({groupResources.length})</span>
              </button>
            </>
          ) : (
            calculatedStatus !== 'ended' && (
              <button
                onClick={() => onOpenApplyModal(group)}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
              >
                <Rocket className="w-4 h-4 text-emerald-600" />
                <span>참가 신청</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* TAB 1: 챌린지 상세 정보 */}
      {activeTab === 'info' && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-7 space-y-5 shadow-2xs">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Info className="w-4 h-4 text-indigo-600" />
              <span>챌린지 기본 정보 및 상세 목표</span>
            </h3>

            {/* Grid of details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs sm:text-sm">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                <span className="text-xs font-black text-slate-400 uppercase tracking-wider block">
                  📌 목표 및 조건
                </span>
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/50">
                    <span className="text-slate-500 font-medium">챌린지명</span>
                    <span className="font-extrabold text-slate-900">{group.name}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/50">
                    <span className="text-slate-500 font-medium">상태</span>
                    <span className="font-extrabold">{statusBadge}</span>
                  </div>
                  {group.recruitingStartDate && group.recruitingEndDate && (
                    <div className="flex justify-between items-center py-1 border-b border-slate-200/50">
                      <span className="text-slate-500 font-medium">모집 기간</span>
                      <span className="font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                        {group.recruitingStartDate} ~ {group.recruitingEndDate}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/50">
                    <span className="text-slate-500 font-medium">운영 기간</span>
                    <span className="font-extrabold text-slate-900">{group.startDate} ~ {group.endDate}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-500 font-medium">참여 요일</span>
                    <span className="font-extrabold text-slate-900">{missionDaysText}</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                <span className="text-xs font-black text-slate-400 uppercase tracking-wider block">
                  💰 금액 및 미션
                </span>
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/50">
                    <span className="text-slate-500 font-medium">일간 목표</span>
                    <span className="font-extrabold text-slate-900">{dailyGoalText}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/50">
                    <span className="text-slate-500 font-medium">주간 목표</span>
                    <span className="font-extrabold text-slate-900">{weeklyGoalText}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/50">
                    <span className="text-slate-500 font-medium">현재 참가자 수</span>
                    <span className="font-extrabold text-indigo-600">{groupParticipants.length}명</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/50">
                    <span className="text-slate-500 font-medium">참가비</span>
                    <span className="font-extrabold text-slate-900">
                      {group.fee ? `${group.fee.toLocaleString()}원` : '무료'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-500 font-medium">환급 금액</span>
                    <span className="font-extrabold text-emerald-700">
                      {group.refundFee ? `최대 ${group.refundFee.toLocaleString()}원` : '없음'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Verification Rules Box */}
            <div className="bg-indigo-50/70 p-4 sm:p-5 rounded-2xl border border-indigo-100 space-y-2.5">
              <h4 className="font-black text-indigo-950 text-xs sm:text-sm flex items-center gap-2">
                <Target className="w-4 h-4 text-indigo-600" />
                <span>인증 규칙 & 운영 가이드</span>
              </h4>
              <ul className="list-disc list-inside text-indigo-900 text-xs sm:text-sm space-y-1.5 leading-relaxed">
                <li>매일 자정 네이버 블로그 RSS 및 X(트위터) 작성물이 자동 집계됩니다.</li>
                <li>설정한 참여 요일에 게시글 작성 시 달성율이 자동으로 반영됩니다.</li>
                <li>네이버 블로그 RSS 아이디와 X(트위터) 아이디를 올바르게 등록해야 모니터링이 가동됩니다.</li>
                <li>챌린지 참가자에게는 전용 자료실 가이드 및 모니터링 리더보드가 제공됩니다.</li>
              </ul>
            </div>

            {/* Non-participant CTA Box */}
            {!isParticipant && (
              <div className="bg-slate-900 text-white p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md">
                <div className="space-y-1 text-center sm:text-left">
                  <p className="font-black text-sm sm:text-base">
                    {calculatedStatus === 'recruiting'
                      ? '🚀 지금 챌린지에 도전해보세요!'
                      : calculatedStatus === 'in_progress'
                      ? '🔥 진행 중인 챌린지입니다.'
                      : '챌린지가 종료되었습니다.'}
                  </p>
                  <p className="text-xs text-slate-300">
                    {calculatedStatus !== 'ended'
                      ? '1클릭 참가 신청으로 수익화 블로그 습관을 시작하세요.'
                      : '종료된 챌린지는 기본 정보만 열람이 가능합니다.'}
                  </p>
                </div>

                {calculatedStatus !== 'ended' && (
                  <button
                    onClick={() => onOpenApplyModal(group)}
                    className="px-6 py-3 rounded-xl bg-[#03C75A] hover:bg-[#02b351] text-white font-black text-xs sm:text-sm transition-all cursor-pointer shadow-lg flex items-center gap-2 shrink-0 active:scale-95"
                  >
                    <Rocket className="w-4 h-4" />
                    <span>참가 신청하기</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: 내 진행 현황 (My Status) */}
      {activeTab === 'my_status' && isParticipant && myParticipant && (
        <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-7 space-y-5 shadow-2xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <span>내 진행 현황 요약</span>
            </h3>
            <span className="text-xs font-black bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full">
              참가자: {myParticipant.participantName}님
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-center space-y-1">
              <span className="text-xs text-slate-500 font-bold block">내 순위</span>
              <span className="text-2xl font-black text-indigo-600">
                {myRank ? `${myRank}위` : '-'}
              </span>
              <span className="text-[10px] text-slate-400 block">전체 {rankedParticipants.length}명 중</span>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-center space-y-1">
              <span className="text-xs text-slate-500 font-bold block">블로그 포스팅</span>
              <span className="text-2xl font-black text-emerald-600">
                {myParticipant.dailyPostCount}개
              </span>
              <span className="text-[10px] text-slate-400 block">누적 작성</span>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-center space-y-1">
              <span className="text-xs text-slate-500 font-bold block">트윗 작성</span>
              <span className="text-2xl font-black text-sky-600">
                {myParticipant.tweetCount}개
              </span>
              <span className="text-[10px] text-slate-400 block">트윗+답글</span>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-center space-y-1">
              <span className="text-xs text-slate-500 font-bold block">연속 스트릭</span>
              <span className="text-2xl font-black text-amber-500">
                🔥 {myParticipant.streakDays || 1}일
              </span>
              <span className="text-[10px] text-slate-400 block">연속 도전 달성</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: 리더보드 (Leaderboard View) */}
      {activeTab === 'leaderboard' && (() => {
        // Compute Leaderboard KPIs based on actual challenge period stats
        const gStats = getChallengeGroupStats(group, participants);
        const totalParticipantsCount = gStats.totalParticipants;
        const totalPostsSum = gStats.totalAll;
        const avgAchievementRate = gStats.avgGoalRate;
        const completedCount = gStats.completedCount;

        return (
          <div className="space-y-4">
            
            {/* Top Leaderboard KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5">
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-1">
                <div className="flex items-center space-x-1.5 text-slate-500 text-xs font-bold">
                  <Users className="w-4 h-4 text-indigo-600" />
                  <span>참가자</span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-slate-900">
                  {totalParticipantsCount.toLocaleString()}<span className="text-xs text-slate-500 font-bold ml-0.5">명</span>
                </div>
              </div>

              <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-1">
                <div className="flex items-center space-x-1.5 text-slate-500 text-xs font-bold">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <span>총 포스팅</span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-slate-900">
                  {totalPostsSum.toLocaleString()}<span className="text-xs text-slate-500 font-bold ml-0.5">개</span>
                </div>
              </div>

              <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-1">
                <div className="flex items-center space-x-1.5 text-slate-500 text-xs font-bold">
                  <TrendingUp className="w-4 h-4 text-sky-600" />
                  <span>평균 달성률</span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-slate-900">
                  {avgAchievementRate}%
                </div>
              </div>

              <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-1">
                <div className="flex items-center space-x-1.5 text-slate-500 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4 text-amber-500" />
                  <span>목표 달성자</span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-amber-600">
                  {completedCount}<span className="text-xs text-slate-500 font-bold ml-0.5">명</span>
                </div>
              </div>
            </div>

            {/* Requirement 6: 내 순위 Card (Displayed ONLY for logged-in participants) */}
            {isParticipant && myParticipant && (
              <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white p-4 sm:p-5 rounded-3xl shadow-md border border-indigo-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center space-x-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-amber-400/20 text-amber-300 border border-amber-400/40 flex items-center justify-center shrink-0">
                    <Award className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-indigo-300 block">내 순위</span>
                    <div className="flex items-baseline space-x-2">
                      <span className="text-2xl sm:text-3xl font-black text-amber-300">
                        {myRank ? `${myRank}위` : '-'}
                      </span>
                      <span className="text-xs text-slate-300">
                        / 전체 {rankedParticipants.length}명
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-white/10 px-4 py-2.5 rounded-2xl border border-white/10 text-xs sm:text-sm font-bold">
                  <span>내 챌린지 실적:</span>
                  <span className="text-emerald-300 font-black text-base">{myTotalPosts}개</span>
                  <span className="text-slate-300 text-xs">
                    (블로그 {myPeriodStats?.blogPosts || 0}개 / 트윗 {myPeriodStats?.tweets || 0}개 / 답글 {myPeriodStats?.replies || 0}개)
                  </span>
                </div>
              </div>
            )}

            {/* Leaderboard Table with 8 Columns */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Award className="w-5 h-5 text-amber-500" />
                  <h3 className="font-extrabold text-slate-900 text-base">
                    {group.name} 실시간 리더보드
                  </h3>
                </div>
                <span className="text-xs font-extrabold text-slate-500">
                  총 {rankedParticipants.length}명 참가 중
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-50 text-slate-500 font-extrabold uppercase text-[11px] border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-3 text-center w-12">순위</th>
                      <th className="py-3 px-3">참가자명</th>
                      <th className="py-3 px-3">네이버 블로그 ID</th>
                      <th className="py-3 px-3 text-right">포스팅 수</th>
                      <th className="py-3 px-3 text-center">목표</th>
                      <th className="py-3 px-3 text-right">달성률</th>
                      <th className="py-3 px-3 text-center">최근 활동일</th>
                      <th className="py-3 px-3 text-center">참여 상태</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rankedParticipants.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400 font-bold">
                          아직 등록된 참가자가 없습니다.
                        </td>
                      </tr>
                    ) : (
                      rankedParticipants.map((p, idx) => {
                        const isMe = myParticipant && p.id === myParticipant.id;
                        const pPeriodStats = getParticipantPeriodStats(p, { group });
                        const totalCount = pPeriodStats.totalAll;
                        const goalSum = calculateParticipantGoal(p, group);
                        const rate = goalSum.overallRate;

                        // Last activity date
                        const lastActive = p.lastPostDate || p.updatedAt || '오늘';
                        const statusText = p.status === 'paused' ? '중단' : '정상';

                        return (
                          <tr
                            key={`cdp_part_${p.id}_${idx}`}
                            onClick={() => onNavigate(`/members/${p.id}`)}
                            className={`cursor-pointer transition-colors hover:bg-slate-50/80 ${
                              isMe ? 'bg-amber-50/70 font-bold' : ''
                            }`}
                          >
                            {/* 1. 순위 */}
                            <td className="py-3.5 px-3 text-center font-black">
                              {idx === 0 ? '🥇 1위' : idx === 1 ? '🥈 2위' : idx === 2 ? '🥉 3위' : `${idx + 1}위`}
                            </td>

                            {/* 2. 참가자명 */}
                            <td className="py-3.5 px-3">
                              <div className="flex items-center space-x-1.5">
                                <span className="font-extrabold text-slate-900">{p.participantName}</span>
                                {isMe && (
                                  <span className="text-[10px] bg-slate-900 text-white px-2 py-0.5 rounded-full font-black">
                                    나
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* 3. 네이버 블로그 ID */}
                            <td className="py-3.5 px-3 text-slate-600 font-mono text-xs">
                              {p.blogId ? `@${p.blogId}` : '-'}
                            </td>

                            {/* 4. 포스팅 수 */}
                            <td className="py-3.5 px-3 text-right font-black text-indigo-700">
                              {totalCount}개
                            </td>

                            {/* 5. 목표 */}
                            <td className="py-3.5 px-3 text-center text-xs font-medium text-slate-600">
                              {goalSum.summaryTagText || '기본'}
                            </td>

                            {/* 6. 목표 달성률 */}
                            <td className="py-3.5 px-3 text-right font-black">
                              <span className={rate >= 100 ? 'text-emerald-600' : rate >= 50 ? 'text-indigo-600' : 'text-slate-700'}>
                                {rate}%
                              </span>
                            </td>

                            {/* 7. 최근 활동일 */}
                            <td className="py-3.5 px-3 text-center text-xs text-slate-500 font-medium">
                              {lastActive}
                            </td>

                            {/* 8. 참여 상태 */}
                            <td className="py-3.5 px-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                statusText === '정상'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}>
                                {statusText}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* TAB 4: 자료실 (Resources View) */}
      {activeTab === 'resources' && isParticipant && (
        <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-7 space-y-4 shadow-2xs">
          <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <BookOpen className="w-4 h-4 text-indigo-600" />
            <span>챌린지 수강 및 미션 수행 자료실</span>
          </h3>

          {groupResources.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-400 space-y-1">
              <BookOpen className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-bold text-slate-600">등록된 챌린지 자료가 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {groupResources.map((r) => (
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
                        className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-800 flex items-center gap-1 shadow-2xs"
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
                        className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1 shadow-2xs"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>다운로드</span>
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Participant Detail Modal */}
      {selectedParticipantDetail && (() => {
        const p = selectedParticipantDetail;
        const pPeriodStats = getParticipantPeriodStats(p, { group });
        const totalCount = pPeriodStats.totalAll;
        const goalSum = calculateParticipantGoal(p, group);
        const rate = goalSum.overallRate;
        const blogUrl = p.blogId ? `https://blog.naver.com/${p.blogId.replace('@', '')}` : null;

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden space-y-0">
              {/* Header */}
              <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 flex items-center justify-center font-extrabold text-base">
                    {p.participantName.slice(0, 1)}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base">{p.participantName}</h3>
                    <p className="text-xs text-indigo-200 font-mono">
                      {p.blogId ? `@${p.blogId}` : '블로그 ID 미등록'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedParticipantDetail(null)}
                  className="p-1.5 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                    <span className="text-[11px] font-bold text-slate-400 block">현재 포스팅 작성</span>
                    <span className="text-xl font-black text-slate-900">{totalCount}개</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                    <span className="text-[11px] font-bold text-slate-400 block">목표 달성률</span>
                    <span className={`text-xl font-black ${rate >= 100 ? 'text-emerald-600' : 'text-indigo-600'}`}>
                      {rate}%
                    </span>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <span className="font-bold text-slate-500">참여 챌린지</span>
                    <span className="font-extrabold text-slate-900">{group.name}</span>
                  </div>

                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <span className="font-bold text-slate-500">참여 목표</span>
                    <span className="font-bold text-slate-800">{goalSum.summaryTagText || '주간 목표'}</span>
                  </div>

                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <span className="font-bold text-slate-500">최근 활동일</span>
                    <span className="font-bold text-slate-800">{p.lastPostDate || p.updatedAt || '오늘'}</span>
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <span className="font-bold text-slate-500">참여 상태</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800">
                      {p.status === 'paused' ? '중단' : '정상 참여 중'}
                    </span>
                  </div>
                </div>

                {blogUrl && (
                  <a
                    href={blogUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-2.5 px-4 rounded-2xl bg-[#03C75A] hover:bg-[#02b351] text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-2xs transition-colors cursor-pointer"
                  >
                    <Globe className="w-4 h-4" />
                    <span>네이버 블로그 방문하기</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
