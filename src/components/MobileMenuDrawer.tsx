import React from 'react';
import {
  X,
  Users,
  Megaphone,
  Award,
  ShieldCheck,
  RefreshCw,
  ChevronRight,
  Sparkles,
  Search,
  FileText,
  Palette,
  Home,
  Trophy,
  User,
  LogOut,
  ExternalLink,
  BookOpen,
  Compass,
  CreditCard,
} from 'lucide-react';
import { NaverUser, ChallengeGroup, Participant } from '../types';
import { MainTabType } from './Header';
import { checkAIToolkitAccess } from '../utils/aiToolkitPermissions';
import { NavigationTabItem, DEFAULT_NAVIGATION_TABS } from '../config/navigation';

interface MobileMenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  mainTab: MainTabType;
  onSelectMainTab: (tab: MainTabType) => void;
  dashboardSubTab: 'overview' | 'participants' | 'analytics';
  onSelectDashboardSubTab: (subTab: 'overview' | 'participants' | 'analytics') => void;
  toolkitSubTab: 'keyword' | 'draft' | 'image';
  onSelectToolkitSubTab: (subTab: 'keyword' | 'draft' | 'image') => void;
  currentUser: NaverUser | null;
  isAdminLoggedIn: boolean;
  onOpenGoogleAuth: () => void;
  onLogoutGoogle: () => void;
  onOpenProfileModal: () => void;
  onOpenAdminLoginModal: () => void;
  onOpenAdminManagementModal: () => void;
  onManualSync?: () => void;
  isSyncing?: boolean;
  lastSyncTime?: string;
  groups?: ChallengeGroup[];
  participants?: Participant[];
  canAccessAIToolkit?: boolean;
  navigationTabs?: Record<MainTabType, NavigationTabItem>;
}

export const MobileMenuDrawer: React.FC<MobileMenuDrawerProps> = ({
  isOpen,
  onClose,
  mainTab,
  onSelectMainTab,
  toolkitSubTab,
  onSelectToolkitSubTab,
  currentUser,
  isAdminLoggedIn,
  onOpenGoogleAuth,
  onLogoutGoogle,
  onOpenProfileModal,
  onOpenAdminLoginModal,
  onOpenAdminManagementModal,
  onManualSync,
  isSyncing = false,
  lastSyncTime,
  groups = [],
  participants = [],
  canAccessAIToolkit,
  navigationTabs,
}) => {
  const currentTabs = navigationTabs || DEFAULT_NAVIGATION_TABS;
  const hasToolkitAccess = canAccessAIToolkit !== undefined
    ? canAccessAIToolkit
    : checkAIToolkitAccess({ currentUser, isAdmin: isAdminLoggedIn, groups, participants }).canAccess;

  if (!isOpen) return null;

  const handleNavigate = (tab: MainTabType, subTab?: 'keyword' | 'draft' | 'image') => {
    onSelectMainTab(tab);
    if (subTab && onSelectToolkitSubTab) {
      onSelectToolkitSubTab(subTab);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200 select-none">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Slide-over Drawer Panel from Right */}
      <div className="relative bg-white w-[88vw] max-w-sm sm:max-w-md h-full shadow-2xl flex flex-col border-l border-gray-100 z-10 animate-in slide-in-from-right duration-250">
        
        {/* 1. Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              M
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">전체 메뉴</h3>
              <p className="text-[11px] text-slate-400">챌린지 모니터링 포털</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-gray-50 text-slate-400 hover:text-slate-900 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* 2. User Account Card */}
          <div className="bg-gray-50/90 rounded-2xl p-4 border border-gray-100">
            {currentUser ? (
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  {currentUser.avatarUrl ? (
                    <img
                      src={currentUser.avatarUrl}
                      alt="Avatar"
                      className="w-11 h-11 rounded-full border border-blue-200 object-cover shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-blue-600 text-white font-extrabold flex items-center justify-center text-sm shrink-0">
                      {currentUser.name?.[0] || 'G'}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-extrabold text-slate-900 truncate">
                        {currentUser.name}
                      </span>
                      <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full shrink-0">
                        인증됨
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 truncate">
                      {currentUser.email}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-200/60">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenProfileModal();
                    }}
                    className="py-2 px-2.5 bg-white hover:bg-gray-100 text-slate-800 border border-gray-200/80 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                  >
                    <User className="w-3.5 h-3.5 text-blue-600" />
                    <span>프로필 설정</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onLogoutGoogle();
                    }}
                    className="py-2 px-2.5 bg-white hover:bg-rose-50 text-rose-600 border border-rose-100 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>로그아웃</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5 text-center sm:text-left">
                <div>
                  <h4 className="text-xs font-extrabold text-slate-900">
                    구글 계정으로 로그인
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    프로필 및 참가 챌린지 기록을 연동하세요.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenGoogleAuth();
                  }}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-[0_2px_8px_rgba(37,99,235,0.2)]"
                >
                  로그인하기
                </button>
              </div>
            )}
          </div>

          {/* 3. Realtime Sync Action */}
          {onManualSync && (
            <div className="flex items-center justify-between p-3.5 bg-blue-50/50 border border-blue-100/80 rounded-2xl">
              <div>
                <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                  <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>실시간 데이터 수집</span>
                </span>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {lastSyncTime ? `마지막: ${lastSyncTime}` : '최신 데이터 반영됨'}
                </p>
              </div>
              <button
                type="button"
                onClick={onManualSync}
                disabled={isSyncing}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50 shrink-0"
              >
                {isSyncing ? '동기화 중' : '즉시 동기화'}
              </button>
            </div>
          )}

          {/* 4. Core Navigation List (수납 리스트 형태) */}
          <div className="space-y-1.5">
            <div className="px-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              핵심 메뉴
            </div>

            {/* 홈 */}
            <button
              type="button"
              onClick={() => handleNavigate('dashboard')}
              className={`w-full p-3.5 rounded-2xl text-xs font-bold flex items-center justify-between border transition-all cursor-pointer ${
                mainTab === 'dashboard'
                  ? 'bg-blue-50 text-blue-700 border-blue-100 shadow-2xs font-extrabold'
                  : 'bg-white text-slate-700 border-gray-100 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Home className="w-4 h-4 text-blue-600" />
                <span>{currentTabs.dashboard?.label || '홈 대시보드'}</span>
              </div>
              {currentTabs.dashboard?.badge ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-extrabold">
                    {currentTabs.dashboard.badge}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {/* 챌린지 */}
            <button
              type="button"
              onClick={() => handleNavigate('challenges')}
              className={`w-full p-3.5 rounded-2xl text-xs font-bold flex items-center justify-between border transition-all cursor-pointer ${
                mainTab === 'challenges'
                  ? 'bg-blue-50 text-blue-700 border-blue-100 shadow-2xs font-extrabold'
                  : 'bg-white text-slate-700 border-gray-100 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Trophy className="w-4 h-4 text-blue-600" />
                <span>{currentTabs.challenges?.label || '챌린지 현황'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {currentTabs.challenges?.badge && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-extrabold">
                    {currentTabs.challenges.badge}
                  </span>
                )}
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>
            </button>

            {/* 트렌드 키워드 수집 */}
            <button
              type="button"
              onClick={() => handleNavigate('trends')}
              className={`w-full p-3.5 rounded-2xl text-xs font-bold flex items-center justify-between border transition-all cursor-pointer ${
                mainTab === 'trends'
                  ? 'bg-rose-50 text-rose-700 border-rose-100 shadow-2xs font-extrabold'
                  : 'bg-white text-slate-700 border-gray-100 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Compass className="w-4 h-4 text-rose-500" />
                <span>{currentTabs.trends?.label || '트렌드 키워드 수집'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-extrabold">
                  {currentTabs.trends?.badge || 'HOT'}
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>
            </button>

            {/* 멤버 현황 (Requested in Drawer) */}
            <button
              type="button"
              onClick={() => handleNavigate('members')}
              className={`w-full p-3.5 rounded-2xl text-xs font-bold flex items-center justify-between border transition-all cursor-pointer ${
                mainTab === 'members'
                  ? 'bg-blue-50 text-blue-700 border-blue-100 shadow-2xs font-extrabold'
                  : 'bg-white text-slate-700 border-gray-100 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Users className="w-4 h-4 text-blue-600" />
                <span>{currentTabs.members?.label || '가입 멤버'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-semibold">
                  {currentTabs.members?.badge || `${participants.length}명`}
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>
            </button>

            {/* 공지사항 / 자료실 (Requested in Drawer) */}
            <button
              type="button"
              onClick={() => handleNavigate('announcements')}
              className={`w-full p-3.5 rounded-2xl text-xs font-bold flex items-center justify-between border transition-all cursor-pointer ${
                mainTab === 'announcements' || mainTab === 'resources'
                  ? 'bg-blue-50 text-blue-700 border-blue-100 shadow-2xs font-extrabold'
                  : 'bg-white text-slate-700 border-gray-100 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Megaphone className="w-4 h-4 text-blue-600" />
                <span>{currentTabs.announcements?.label || '공지사항 & 자료실'}</span>
              </div>
              {currentTabs.announcements?.badge ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-extrabold">
                    {currentTabs.announcements.badge}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {/* 수익 인증 (Requested in Drawer) */}
            <button
              type="button"
              onClick={() => handleNavigate('revenue')}
              className={`w-full p-3.5 rounded-2xl text-xs font-bold flex items-center justify-between border transition-all cursor-pointer ${
                mainTab === 'revenue'
                  ? 'bg-amber-50 text-amber-800 border-amber-200 shadow-2xs font-extrabold'
                  : 'bg-white text-slate-700 border-gray-100 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Award className="w-4 h-4 text-amber-500" />
                <span>{currentTabs.revenue?.label || '수익 인증 명예의 전당'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                  {currentTabs.revenue?.badge || 'TOP'}
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>
            </button>

            {/* 사이트 구독 */}
            <button
              type="button"
              onClick={() => handleNavigate('subscription')}
              className={`w-full p-3.5 rounded-2xl text-xs font-bold flex items-center justify-between border transition-all cursor-pointer ${
                mainTab === 'subscription'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 shadow-2xs font-extrabold'
                  : 'bg-white text-slate-700 border-gray-100 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center space-x-3">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                <span>{currentTabs.subscription?.label || '사이트 구독'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                  {currentTabs.subscription?.badge || 'PRO'}
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>
            </button>
          </div>

          {/* 5. AI 초안 생성기 서브 항목 */}
          <div className="space-y-1.5 pt-2">
            <div className="px-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>{(currentTabs.toolkit?.label && currentTabs.toolkit.label !== 'AI 수익화 툴킷') ? currentTabs.toolkit.label : 'AI 초안 생성기'}</span>
              {hasToolkitAccess ? (
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-700 font-extrabold">
                  활성화됨
                </span>
              ) : (
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-gray-100 text-gray-500 font-medium">
                  챌린지 전용
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => handleNavigate('toolkit', 'draft')}
              className="w-full p-3 rounded-2xl bg-white hover:bg-gray-50 text-slate-700 border border-gray-100 text-xs font-bold flex items-center justify-between cursor-pointer transition-colors"
            >
              <div className="flex items-center space-x-2.5">
                <FileText className="w-4 h-4 text-blue-600" />
                <span>AI 블로그 초안 생성기</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>

            <button
              type="button"
              onClick={() => handleNavigate('toolkit', 'image')}
              className="w-full p-3 rounded-2xl bg-white hover:bg-gray-50 text-slate-700 border border-gray-100 text-xs font-bold flex items-center justify-between cursor-pointer transition-colors"
            >
              <div className="flex items-center space-x-2.5">
                <Palette className="w-4 h-4 text-purple-600" />
                <span>콘텐츠 비주얼 스튜디오</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-purple-50 text-purple-700 font-bold">
                  카드뉴스
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>
            </button>
          </div>

          {/* 6. 운영자 관리 메뉴 (Requested in Drawer) */}
          <div className="space-y-1.5 pt-2 border-t border-gray-100">
            <div className="px-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              운영 관리
            </div>

            {isAdminLoggedIn ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAdminManagementModal();
                }}
                className="w-full p-3.5 rounded-2xl bg-blue-50/80 text-blue-900 border border-blue-100 text-xs font-extrabold flex items-center justify-between cursor-pointer transition-colors"
              >
                <div className="flex items-center space-x-2.5">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <span>운영자 관리자 메뉴</span>
                </div>
                <span className="text-[10px] font-extrabold bg-blue-200 text-blue-900 px-2 py-0.5 rounded-full">
                  접속중
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAdminLoginModal();
                }}
                className="w-full p-3.5 rounded-2xl bg-white text-slate-700 border border-gray-100 text-xs font-bold flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <div className="flex items-center space-x-2.5">
                  <ShieldCheck className="w-4 h-4 text-slate-400" />
                  <span>운영자 로그인</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 text-center text-[11px] text-slate-400">
          <span>챌린지 모니터링 시스템 v3.0</span>
        </div>

      </div>
    </div>
  );
};
