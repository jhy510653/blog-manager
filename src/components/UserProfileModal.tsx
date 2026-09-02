import React, { useState, useEffect } from 'react';
import { X, User, Sparkles, CheckCircle, ExternalLink, Award, Twitter, Globe, Save, Trash2, Calendar, TrendingUp, Trophy, CreditCard, Building, ShieldCheck, AlertCircle, ArrowRight } from 'lucide-react';
import { NaverUser, Participant, ChallengeGroup, RevenueCertification, UserBadge, ChallengePayment, ChallengeRefund } from '../types';
import { extractNaverBlogId } from '../utils/blogUtils';
import { BadgeCollectionModal } from './badges/BadgeCollectionModal';
import { fetchUserBadgesFromSupabase } from '../lib/supabase';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: NaverUser | null;
  participants: Participant[];
  groups: ChallengeGroup[];
  revenueCertifications?: RevenueCertification[];
  userPayments?: ChallengePayment[];
  userRefunds?: ChallengeRefund[];
  onUpdateProfile: (updatedUser: NaverUser) => Promise<boolean> | void;
  onShowToast: (msg: string) => void;
  onLeaveChallenge?: (participantId: string, challengeName: string) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  participants,
  groups,
  revenueCertifications = [],
  userPayments = [],
  userRefunds = [],
  onUpdateProfile,
  onShowToast,
  onLeaveChallenge,
}) => {
  const [naverId, setNaverId] = useState('');
  const [name, setName] = useState('');
  const [twitterId, setTwitterId] = useState('');
  const [email, setEmail] = useState('');
  
  const [activeMainTab, setActiveMainTab] = useState<'profile' | 'payments' | 'badges'>('profile');
  const [confirmingLeaveKey, setConfirmingLeaveKey] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isBadgeModalOpen, setIsBadgeModalOpen] = useState(false);
  const [userBadges, setUserBadges] = useState<UserBadge[]>([]);
  const [challengeTab, setChallengeTab] = useState<'in_progress' | 'recruiting' | 'ended'>('in_progress');

  useEffect(() => {
    if (currentUser) {
      const rawNav = (currentUser.naverId || '').trim().toLowerCase();
      setNaverId(rawNav === 'user' || rawNav === 'user@gmail.com' ? '' : currentUser.naverId || '');
      setName(currentUser.name || '');
      setTwitterId(currentUser.twitterId || '');
      setEmail(currentUser.email || '');

      // Load user earned badges
      fetchUserBadgesFromSupabase(currentUser.id || currentUser.email).then((badges) => {
        setUserBadges(badges);
      });
    }
  }, [currentUser]);

  if (!isOpen || !currentUser) return null;

  // Clean naverId using extractNaverBlogId
  const cleanNaverId = extractNaverBlogId(naverId);
  const generatedRssUrl = cleanNaverId ? `https://rss.blog.naver.com/${cleanNaverId}.xml` : '';

  // Filter payments related to this user
  const myPayments = userPayments.filter(
    (p) => p.userId === currentUser.id || p.userId === currentUser.email || p.userEmail === currentUser.email || (currentUser.naverId && p.userNaverId === currentUser.naverId)
  );

  // Filter refunds related to this user
  const myRefunds = userRefunds.filter(
    (r) => r.userId === currentUser.id || r.userEmail === currentUser.email || (currentUser.name && r.participantName === currentUser.name)
  );

  // Filter challenges user is currently enrolled in
  const myParticipants = (participants || []).filter((p) => {
    if (!currentUser) return false;
    const cleanNav = (cleanNaverId || currentUser.naverId || '').trim().toLowerCase();
    const isNavValid = cleanNav && cleanNav !== 'user' && cleanNav !== 'user@gmail.com';
    const matchBlog = isNavValid && p.blogId && p.blogId.toLowerCase() === cleanNav;
    const matchName = currentUser.name && p.participantName && p.participantName.toLowerCase() === currentUser.name.toLowerCase();
    const matchTwitter = currentUser.twitterId && p.twitterId && p.twitterId.toLowerCase() === currentUser.twitterId.toLowerCase();
    const matchEmail = currentUser.email && p.participantName && currentUser.email.split('@')[0].toLowerCase() === p.participantName.toLowerCase();
    return Boolean(matchBlog || matchName || matchTwitter || matchEmail);
  });

  const todayStr = new Date().toISOString().split('T')[0];

  const enrolledChallengeItems: Array<{
    participantId: string;
    groupName: string;
    streakDays: number;
    dailyPostCount: number;
    targetPosts: number;
    blogId?: string | null;
    twitterId?: string | null;
    status: 'in_progress' | 'recruiting' | 'ended';
    startDate?: string;
    endDate?: string;
  }> = [];

  myParticipants.forEach((p) => {
    const groupList = (p.groupNames && p.groupNames.length > 0)
      ? p.groupNames
      : (p.groupName ? p.groupName.split(',').map((s) => s.trim()).filter(Boolean) : []);

    groupList.forEach((gName) => {
      if (!enrolledChallengeItems.some((item) => item.participantId === p.id && item.groupName === gName)) {
        const matchedGroup = groups.find((g) => g.name === gName || g.id === gName);
        const startDate = matchedGroup?.startDate || p.startDate || '2026-07-01';
        const endDate = matchedGroup?.endDate;

        let status: 'in_progress' | 'recruiting' | 'ended' = 'in_progress';
        if (matchedGroup?.status === 'ended' || (endDate && todayStr > endDate)) {
          status = 'ended';
        } else if (matchedGroup?.status === 'recruiting' || (startDate && todayStr < startDate)) {
          status = 'recruiting';
        } else {
          status = 'in_progress';
        }

        let challengePosts = p.dailyPostCount || 0;
        if (p.history && p.history.length > 0 && startDate) {
          const validHistory = p.history.filter((h) => {
            if (h.date < startDate) return false;
            if (endDate && h.date > endDate) return false;
            return true;
          });
          if (validHistory.length > 0) {
            challengePosts = Math.max(...validHistory.map((h) => h.blogPosts || 0));
          }
        }

        enrolledChallengeItems.push({
          participantId: p.id,
          groupName: gName,
          streakDays: p.streakDays || 1,
          dailyPostCount: challengePosts,
          targetPosts: matchedGroup?.targetPostCount || p.targetBlogPostCount || p.targetPostCount || 10,
          blogId: p.blogId,
          twitterId: p.twitterId,
          status,
          startDate,
          endDate,
        });
      }
    });
  });

  const inProgressChallenges = enrolledChallengeItems.filter((item) => item.status === 'in_progress');
  const recruitingChallenges = enrolledChallengeItems.filter((item) => item.status === 'recruiting');
  const endedChallenges = enrolledChallengeItems.filter((item) => item.status === 'ended');

  const displayedChallenges =
    challengeTab === 'in_progress'
      ? inProgressChallenges
      : challengeTab === 'recruiting'
      ? recruitingChallenges
      : endedChallenges;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('프로필 닉네임을 입력해주세요.');
      return;
    }

    setIsSaving(true);
    const cleanTwitter = twitterId.trim().replace(/^@/, '');

    const updatedUser: NaverUser = {
      ...currentUser,
      naverId: cleanNaverId,
      name: name.trim() || cleanNaverId || currentUser.email.split('@')[0],
      email: email.trim() || currentUser.email,
      twitterId: cleanTwitter || undefined,
      blogRssUrl: generatedRssUrl,
    };

    try {
      await onUpdateProfile(updatedUser);
      onShowToast('🎉 프로필 설정이 성공적으로 저장되었습니다.');
      onClose();
    } catch (err) {
      console.error('Error in profile update sync:', err);
      onShowToast('⚠️ 프로필 저장 중 문제가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#FFFAF5] rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden border border-[#F3E9E0] max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-[#6F4E37] to-[#8B5E3C] p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center font-black text-white text-lg">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black flex items-center gap-2">
                <span>👤 내 정보 & 마이페이지</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-amber-950 text-[10px] font-black">
                  MY PAGE
                </span>
              </h2>
              <p className="text-xs text-[#E8DACD]">
                블로그 ID, 트위터 연동 및 참가비/환급 내역을 확인하세요.
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

        {/* Main Tab Navigation */}
        <div className="flex items-center border-b border-[#E8DACD] bg-white px-5 pt-2 shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setActiveMainTab('profile')}
            className={`pb-2.5 px-3 text-xs font-black transition-colors cursor-pointer border-b-2 flex items-center gap-1.5 ${
              activeMainTab === 'profile'
                ? 'border-[#6F4E37] text-[#6F4E37]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <User className="w-4 h-4" />
            <span>기본 프로필</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMainTab('payments')}
            className={`pb-2.5 px-3 text-xs font-black transition-colors cursor-pointer border-b-2 flex items-center gap-1.5 ${
              activeMainTab === 'payments'
                ? 'border-[#6F4E37] text-[#6F4E37]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>내 참가비 & 환급 내역</span>
            {(myPayments.length > 0 || myRefunds.length > 0) && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 text-[10px]">
                {myPayments.length}
              </span>
            )}
          </button>
        </div>

        {/* Modal Content Scrollable */}
        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1">
          
          {activeMainTab === 'profile' && (
            <>
              <form onSubmit={handleSave} className="space-y-5">
                {/* Section 1: Naver & Basic Profile */}
                <div className="bg-white p-4.5 rounded-2xl border border-[#F3E9E0] space-y-4 shadow-xs">
                  <h3 className="text-xs font-black text-[#6F4E37] flex items-center gap-1.5 uppercase tracking-wide">
                    <Globe className="w-4 h-4 text-[#8B5E3C]" />
                    <span>네이버 블로그 및 기본 계정 설정</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Nickname / Display Name */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-[#5A3E31] block">
                        프로필 닉네임 / 성함 <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="예: 홍길동"
                        className="w-full px-3.5 py-2.5 bg-[#FFFAF5] border border-[#E8DACD] rounded-xl text-xs font-bold text-[#3A2A1F] focus:ring-2 focus:ring-[#6F4E37] outline-hidden"
                      />
                    </div>

                    {/* Naver ID */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-[#5A3E31] block">
                        네이버 아이디 (블로그 ID) <span className="text-slate-400 font-normal">(블로그 챌린지 시 필요)</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={naverId}
                          onChange={(e) => setNaverId(e.target.value)}
                          placeholder="예: naver_blog_id"
                          className="w-full px-3.5 py-2.5 bg-[#FFFAF5] border border-[#E8DACD] rounded-xl text-xs font-bold text-[#3A2A1F] focus:ring-2 focus:ring-[#6F4E37] outline-hidden"
                        />
                        <span className="absolute right-3 top-2.5 text-[10px] text-emerald-600 font-bold">
                          Naver
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2: Twitter Connection */}
                <div className="bg-white p-4.5 rounded-2xl border border-[#F3E9E0] space-y-3 shadow-xs">
                  <h3 className="text-xs font-black text-[#6F4E37] flex items-center gap-1.5 uppercase tracking-wide">
                    <Twitter className="w-4 h-4 text-sky-500" />
                    <span>트윗 (X) 아이디 연동 설정</span>
                  </h3>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-[#5A3E31] block">
                      트위터 / X 아이디 (@핸들)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-2.5 text-xs font-bold text-slate-400">@</span>
                      <input
                        type="text"
                        value={twitterId}
                        onChange={(e) => setTwitterId(e.target.value)}
                        placeholder="my_twitter_handle"
                        className="w-full pl-8 pr-3.5 py-2.5 bg-[#FFFAF5] border border-[#E8DACD] rounded-xl text-xs font-bold text-[#3A2A1F] focus:ring-2 focus:ring-[#6F4E37] outline-hidden"
                      />
                    </div>
                  </div>
                </div>

                {/* Save Button */}
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full py-3 bg-[#6F4E37] hover:bg-[#5A3E31] disabled:opacity-60 text-white font-extrabold rounded-2xl text-xs transition-all shadow-md flex items-center justify-center space-x-2 cursor-pointer active:scale-98"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? '저장 중...' : '프로필 저장하기'}</span>
                </button>
              </form>

              {/* Section 4: Joined Challenges Status with 3-tab classification */}
              <div className="bg-white p-4.5 rounded-2xl border border-[#F3E9E0] space-y-3.5 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h3 className="text-xs font-black text-[#6F4E37] flex items-center gap-1.5 uppercase tracking-wide">
                    <Award className="w-4 h-4 text-[#D97724]" />
                    <span>참여 챌린지 현황 ({enrolledChallengeItems.length}개)</span>
                  </h3>

                  <div className="flex items-center bg-[#F3E9E0] p-1 rounded-xl gap-1 text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setChallengeTab('in_progress')}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                        challengeTab === 'in_progress'
                          ? 'bg-[#6F4E37] text-white shadow-2xs font-black'
                          : 'text-[#8B5E3C] hover:text-[#5A3E31]'
                      }`}
                    >
                      <span>🔥 진행 중</span>
                      <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-white/20">
                        {inProgressChallenges.length}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setChallengeTab('recruiting')}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                        challengeTab === 'recruiting'
                          ? 'bg-[#6F4E37] text-white shadow-2xs font-black'
                          : 'text-[#8B5E3C] hover:text-[#5A3E31]'
                      }`}
                    >
                      <span>📢 모집 중</span>
                      <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-white/20">
                        {recruitingChallenges.length}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setChallengeTab('ended')}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                        challengeTab === 'ended'
                          ? 'bg-[#6F4E37] text-white shadow-2xs font-black'
                          : 'text-[#8B5E3C] hover:text-[#5A3E31]'
                      }`}
                    >
                      <span>🏁 종료</span>
                      <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-white/20">
                        {endedChallenges.length}
                      </span>
                    </button>
                  </div>
                </div>

                {displayedChallenges.length === 0 ? (
                  <div className="bg-[#FFFAF5] p-5 rounded-2xl border border-dashed border-[#E8DACD] text-center space-y-1.5">
                    <p className="text-xs font-bold text-[#8C7A6B]">
                      {challengeTab === 'in_progress' && '현재 진행 중인 챌린지가 없습니다.'}
                      {challengeTab === 'recruiting' && '현재 참가 신청한 모집 중 챌린지가 없습니다.'}
                      {challengeTab === 'ended' && '종료된 챌린지 기록이 없습니다.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {displayedChallenges.map((item, idx) => {
                      const targetPosts = item.targetPosts || 10;
                      const currentPosts = item.dailyPostCount || 0;
                      const progressPercent = Math.min(100, Math.round((currentPosts / targetPosts) * 100));
                      const isCompleted = currentPosts >= targetPosts;

                      return (
                        <div
                          key={`${item.participantId}_${item.groupName}_${idx}`}
                          className={`p-3.5 rounded-2xl border space-y-2.5 shadow-2xs transition-all ${
                            item.status === 'ended'
                              ? 'bg-slate-50 border-slate-200 text-slate-700'
                              : 'bg-[#FFFAF5] border-[#F3E9E0]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-bold text-[#8B5E3C] bg-[#F3E9E0] px-2 py-0.5 rounded-full border border-[#E8DACD]">
                                  {item.groupName}
                                </span>
                                {item.status === 'in_progress' && (
                                  <span className="text-[10px] font-black text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                                    진행 중
                                  </span>
                                )}
                                {item.status === 'recruiting' && (
                                  <span className="text-[10px] font-black text-blue-800 bg-blue-100 px-2 py-0.5 rounded-full border border-blue-300">
                                    모집 중 ({item.startDate ? `${item.startDate} 시작` : '시작 예정'})
                                  </span>
                                )}
                                {item.status === 'ended' && (
                                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                                    isCompleted
                                      ? 'text-emerald-800 bg-emerald-100 border-emerald-300'
                                      : 'text-slate-600 bg-slate-200 border-slate-300'
                                  }`}>
                                    {isCompleted ? '🎉 완주 달성' : '🏁 기간 종료'}
                                  </span>
                                )}
                              </div>

                              <div className="text-xs font-extrabold text-[#3A2A1F] mt-1 flex items-center gap-2 flex-wrap">
                                {item.status !== 'ended' && (
                                  <span>🔥 연속 작성 {item.streakDays || 1}일째</span>
                                )}
                                {item.blogId && (
                                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                    블로그: {item.blogId}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Leave Button */}
                            {onLeaveChallenge && item.status !== 'ended' && (
                              <div>
                                {confirmingLeaveKey === `${item.participantId}_${item.groupName}` ? (
                                  <div className="flex items-center gap-1.5 bg-rose-50 p-1 rounded-lg border border-rose-200 animate-in fade-in duration-150">
                                    <span className="text-[10px] font-extrabold text-rose-700 ml-1">탈퇴?</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        onLeaveChallenge(item.participantId, item.groupName);
                                        setConfirmingLeaveKey(null);
                                      }}
                                      className="text-[10px] font-extrabold text-white bg-rose-600 hover:bg-rose-700 px-2 py-0.5 rounded transition-colors cursor-pointer shadow-xs"
                                    >
                                      확인
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmingLeaveKey(null)}
                                      className="text-[10px] font-bold text-slate-600 hover:bg-slate-200 px-1.5 py-0.5 rounded transition-colors cursor-pointer"
                                    >
                                      취소
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmingLeaveKey(`${item.participantId}_${item.groupName}`)}
                                    className="text-[10px] font-bold text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 border border-rose-200 bg-white shadow-2xs"
                                  >
                                    <Trash2 className="w-3 h-3 text-rose-500" />
                                    <span>참가취소</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Progress Bar */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px] font-bold text-[#5A3E31]">
                              <span>
                                {item.status === 'ended' ? '최종 달성' : '달성률'} ({currentPosts} / {targetPosts}개 완료)
                              </span>
                              <span className={item.status === 'ended' && isCompleted ? 'text-emerald-700 font-extrabold' : 'text-[#6F4E37]'}>
                                {progressPercent}%
                              </span>
                            </div>
                            <div className="w-full h-2 bg-[#E8DACD] rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  item.status === 'ended'
                                    ? isCompleted
                                      ? 'bg-gradient-to-r from-emerald-500 to-teal-600'
                                      : 'bg-slate-400'
                                    : 'bg-gradient-to-r from-[#8B5E3C] to-[#6F4E37]'
                                }`}
                                style={{ width: `${progressPercent}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Payments & Refunds History Tab */}
          {activeMainTab === 'payments' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="bg-white p-4.5 rounded-2xl border border-[#F3E9E0] space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-[#6F4E37] flex items-center gap-1.5 uppercase tracking-wide">
                    <CreditCard className="w-4 h-4 text-indigo-600" />
                    <span>내 챌린지 참가비 입금 및 환급 이력</span>
                  </h3>
                </div>

                {myPayments.length === 0 && myRefunds.length === 0 ? (
                  <div className="bg-[#FFFAF5] p-6 rounded-2xl border border-dashed border-[#E8DACD] text-center space-y-1.5">
                    <p className="text-xs font-bold text-slate-700">
                      참가비 입금 또는 환급 내역이 없습니다.
                    </p>
                    <p className="text-[11px] text-slate-500">
                      유료 챌린지에 신청하고 입금 확인 요청을 진행하면 이곳에 안전하게 기록됩니다.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {myPayments.map((p, idx) => {
                      const matchedRefund = myRefunds.find((r) => r.challengeId === p.challengeId || r.paymentId === p.id);
                      return (
                        <div
                          key={`upm_pay_${p.id}_${idx}`}
                          className="bg-[#FFFAF5] p-4 rounded-2xl border border-[#F3E9E0] space-y-2.5 shadow-2xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-slate-900">
                              {p.challengeName || '챌린지'}
                            </span>
                            <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                              p.status === 'PAYMENT_CONFIRMED' || p.status === 'approved'
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : p.status === 'PAYMENT_REJECTED' || p.status === 'rejected'
                                ? 'bg-rose-100 text-rose-800 border-rose-300'
                                : 'bg-amber-100 text-amber-800 border-amber-300'
                            }`}>
                              {p.status === 'PAYMENT_CONFIRMED' || p.status === 'approved'
                                ? '✓ 입금 확인 완료'
                                : p.status === 'PAYMENT_REJECTED' || p.status === 'rejected'
                                ? '❌ 입금 거절'
                                : '⏳ 입금 확인 대기'}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] bg-white p-2.5 rounded-xl border border-[#E8DACD]">
                            <div>
                              <span className="text-slate-400 block text-[10px]">참가비</span>
                              <span className="font-extrabold text-slate-900">{(p.amount ?? 0).toLocaleString()}원</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px]">입금자명</span>
                              <span className="font-extrabold text-slate-900">{p.depositorName || '-'}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px]">신청일자</span>
                              <span className="font-bold text-slate-700">{p.submittedAt || p.depositedAt || '-'}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px]">환급 상태</span>
                              <span className="font-bold text-indigo-700">
                                {matchedRefund?.refundStatus === 'completed'
                                  ? `환급 완료 (${((matchedRefund.eligibleAmount ?? (matchedRefund as any).calculatedRefundAmount) ?? 0).toLocaleString()}원)`
                                  : matchedRefund?.refundStatus === 'applied'
                                  ? '신청 접수됨 (외부폼 제출)'
                                  : matchedRefund?.refundStatus === 'eligible'
                                  ? '환급 대상 (신청 가능)'
                                  : matchedRefund?.refundStatus === 'ineligible'
                                  ? '환급 대상 아님'
                                  : '진행 중'}
                              </span>
                            </div>
                          </div>

                          {p.rejectionReason && (
                            <div className="text-[11px] bg-rose-50 text-rose-900 p-2 rounded-xl border border-rose-200 font-bold">
                              거절 사유: {p.rejectionReason}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#F3E9E0] border-t border-[#E8DACD] flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-[#6F4E37] hover:bg-[#5A3E31] text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
          >
            닫기
          </button>
        </div>

      </div>

      {/* Badge Collection Modal */}
      <BadgeCollectionModal
        isOpen={isBadgeModalOpen}
        onClose={() => {
          setIsBadgeModalOpen(false);
          if (currentUser) {
            fetchUserBadgesFromSupabase(currentUser.id || currentUser.email).then((badges) => {
              setUserBadges(badges);
            });
          }
        }}
        currentUser={currentUser}
        participants={participants}
        revenueCertifications={revenueCertifications}
      />
    </div>
  );
};
