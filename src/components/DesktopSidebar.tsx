import React from 'react';
import {
  LayoutDashboard,
  Home,
  Trophy,
  Users,
  Megaphone,
  Sparkles,
  Award,
  ShieldCheck,
  RefreshCw,
  User,
  LogOut,
  ChevronRight,
  Lock,
  ExternalLink,
  BookOpen,
  Compass,
  CreditCard,
} from 'lucide-react';
import { NaverUser, ChallengeGroup, Participant } from '../types';
import { MainTabType } from './Header';
import { checkAIToolkitAccess } from '../utils/aiToolkitPermissions';
import { NavigationTabItem, DEFAULT_NAVIGATION_TABS } from '../config/navigation';

interface DesktopSidebarProps {
  mainTab: MainTabType;
  onSelectMainTab: (tab: MainTabType) => void;
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

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  mainTab,
  onSelectMainTab,
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

  const todayStr = new Date().toISOString().split('T')[0];
  const activeChallengesCount = groups.filter((g) => {
    if (g.startDate && todayStr < g.startDate) return false;
    if (g.endDate && todayStr > g.endDate) return false;
    return true;
  }).length;

  const navItems = [
    {
      id: 'dashboard' as MainTabType,
      label: currentTabs.dashboard?.label || '홈 대시보드',
      icon: Home,
      badge: currentTabs.dashboard?.badge || null,
      badgeColor: currentTabs.dashboard?.badgeColor || 'bg-blue-50 text-blue-600',
    },
    {
      id: 'challenges' as MainTabType,
      label: currentTabs.challenges?.label || '챌린지 현황',
      icon: Trophy,
      badge: currentTabs.challenges?.badge || (activeChallengesCount > 0 ? `${activeChallengesCount}개 진행중` : null),
      badgeColor: currentTabs.challenges?.badgeColor || 'bg-blue-50 text-blue-600',
    },
    {
      id: 'members' as MainTabType,
      label: currentTabs.members?.label || '가입 멤버',
      icon: Users,
      badge: currentTabs.members?.badge || (participants.length > 0 ? `${participants.length}명` : null),
      badgeColor: currentTabs.members?.badgeColor || 'bg-gray-100 text-gray-600',
    },
    {
      id: 'announcements' as MainTabType,
      label: currentTabs.announcements?.label || '공지사항 & 자료실',
      icon: Megaphone,
      badge: currentTabs.announcements?.badge || null,
      badgeColor: currentTabs.announcements?.badgeColor || '',
    },
    {
      id: 'trends' as MainTabType,
      label: currentTabs.trends?.label || '트렌드 키워드 수집',
      icon: Compass,
      badge: currentTabs.trends?.badge !== undefined && currentTabs.trends?.badge !== '' ? currentTabs.trends.badge : 'HOT',
      badgeColor: currentTabs.trends?.badgeColor || 'bg-rose-50 text-rose-600 font-bold',
    },
    {
      id: 'toolkit' as MainTabType,
      label: (currentTabs.toolkit?.label && currentTabs.toolkit.label !== 'AI 수익화 툴킷') ? currentTabs.toolkit.label : 'AI 초안 생성기',
      icon: Sparkles,
      badge: currentTabs.toolkit?.badge !== undefined && currentTabs.toolkit?.badge !== '' ? currentTabs.toolkit.badge : (hasToolkitAccess ? 'AI' : '🔒 전용'),
      badgeColor: currentTabs.toolkit?.badgeColor || (hasToolkitAccess ? 'bg-indigo-50 text-indigo-600 font-black' : 'bg-amber-50 text-amber-700'),
    },
    {
      id: 'revenue' as MainTabType,
      label: currentTabs.revenue?.label || '수익 인증 명예의 전당',
      icon: Award,
      badge: currentTabs.revenue?.badge !== undefined && currentTabs.revenue?.badge !== '' ? currentTabs.revenue.badge : 'TOP',
      badgeColor: currentTabs.revenue?.badgeColor || 'bg-amber-50 text-amber-700 font-extrabold',
    },
    {
      id: 'subscription' as MainTabType,
      label: currentTabs.subscription?.label || '사이트 구독',
      icon: CreditCard,
      badge: currentTabs.subscription?.badge !== undefined && currentTabs.subscription?.badge !== '' ? currentTabs.subscription.badge : 'PRO',
      badgeColor: currentTabs.subscription?.badgeColor || 'bg-emerald-50 text-emerald-700 font-bold',
    },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-64 xl:w-72 shrink-0 h-screen sticky top-0 bg-white border-r border-gray-100 z-30 select-none">
      {/* 1. Header / Brand Logo */}
      <div className="p-6 pb-4 border-b border-gray-100/80">
        <div
          onClick={() => onSelectMainTab('dashboard')}
          className="flex items-center space-x-3 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-[0_4px_12px_rgba(37,99,235,0.25)] group-hover:scale-105 transition-transform shrink-0">
            <LayoutDashboard className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-base font-extrabold text-slate-900 tracking-tight">
                챌린지 모니터링
              </h1>
            </div>
            <p className="text-[11px] font-medium text-slate-400">
              네이버 블로그 수익화 포털
            </p>
          </div>
        </div>

        {/* Admin Badge if logged in */}
        {isAdminLoggedIn && (
          <div className="mt-3 flex items-center justify-between px-3 py-1.5 bg-blue-50/60 rounded-xl border border-blue-100 text-xs text-blue-700 font-bold">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>운영자 모드 활성</span>
            </div>
            <button
              onClick={onOpenAdminManagementModal}
              className="text-[11px] font-extrabold text-blue-600 hover:underline cursor-pointer"
            >
              관리
            </button>
          </div>
        )}
      </div>

      {/* 2. Navigation Menu List */}
      <div className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          메뉴
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            mainTab === item.id ||
            (item.id === 'announcements' && mainTab === 'resources');

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectMainTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-sm font-semibold transition-all cursor-pointer group ${
                isActive
                  ? 'bg-blue-50 text-blue-600 font-extrabold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center space-x-3 truncate">
                <Icon
                  className={`w-5 h-5 transition-colors shrink-0 ${
                    isActive
                      ? 'text-blue-600 stroke-[2.5px]'
                      : 'text-slate-400 group-hover:text-slate-600'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </div>

              {item.badge && (
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full font-bold shrink-0 ml-1.5 ${
                    item.badgeColor || 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 3. Realtime Sync Widget */}
      {onManualSync && (
        <div className="px-4 py-3 mx-4 mb-3 bg-gray-50/80 rounded-2xl border border-gray-100">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                <RefreshCw
                  className={`w-3 h-3 text-slate-400 ${
                    isSyncing ? 'animate-spin text-blue-600' : ''
                  }`}
                />
                <span>실시간 데이터</span>
              </span>
              <p className="text-[10px] text-slate-400">
                {lastSyncTime ? `마지막: ${lastSyncTime}` : '최신 동기화됨'}
              </p>
            </div>
            <button
              type="button"
              onClick={onManualSync}
              disabled={isSyncing}
              className="px-2.5 py-1 text-xs font-bold text-blue-600 hover:text-blue-700 bg-white hover:bg-blue-50 border border-gray-200/80 rounded-xl transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
            >
              {isSyncing ? '동기화...' : '새로고침'}
            </button>
          </div>
        </div>
      )}

      {/* 4. Bottom User Profile & Admin Section */}
      <div className="p-4 border-t border-gray-100 bg-white">
        {currentUser ? (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div
                onClick={onOpenProfileModal}
                className="flex items-center space-x-2.5 cursor-pointer group flex-1 min-w-0"
              >
                {currentUser.avatarUrl ? (
                  <img
                    src={currentUser.avatarUrl}
                    alt="avatar"
                    className="w-9 h-9 rounded-full border border-gray-200 object-cover shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-slate-900 text-white font-extrabold flex items-center justify-center text-xs shrink-0">
                    {currentUser.name?.[0] || 'G'}
                  </div>
                )}
                <div className="truncate">
                  <p className="text-xs font-extrabold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                    {currentUser.name}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">
                    {currentUser.email}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onLogoutGoogle}
                title="로그아웃"
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-1.5 pt-1">
              <button
                type="button"
                onClick={onOpenProfileModal}
                className="flex-1 py-1.5 px-2 bg-gray-50 hover:bg-gray-100 text-slate-700 text-[11px] font-bold rounded-xl border border-gray-100 transition-colors cursor-pointer text-center"
              >
                내 프로필 설정
              </button>
              {isAdminLoggedIn ? (
                <button
                  type="button"
                  onClick={onOpenAdminManagementModal}
                  className="py-1.5 px-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold rounded-xl border border-blue-100 transition-colors cursor-pointer text-center"
                >
                  관리자
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onOpenAdminLoginModal}
                  className="py-1.5 px-2 bg-gray-50 hover:bg-gray-100 text-slate-500 text-[11px] font-bold rounded-xl border border-gray-100 transition-colors cursor-pointer text-center"
                >
                  운영자
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <button
              type="button"
              onClick={onOpenGoogleAuth}
              className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-[0_2px_8px_rgba(37,99,235,0.2)]"
            >
              <User className="w-4 h-4" />
              <span>구글 로그인</span>
            </button>
            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 pt-1">
              <span>챌린지 참여 및 프로필 연동</span>
              <button
                type="button"
                onClick={isAdminLoggedIn ? onOpenAdminManagementModal : onOpenAdminLoginModal}
                className="text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
              >
                {isAdminLoggedIn ? '관리자' : '운영자'}
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
