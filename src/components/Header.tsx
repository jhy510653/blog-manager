import React, { useState } from 'react';
import {
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  Menu,
  ChevronDown,
  User,
  LogOut,
  Trophy,
  Users,
  Megaphone,
  Award,
} from 'lucide-react';
import { NaverUser, ChallengeGroup, Participant, AppNotification } from '../types';
import { checkAIToolkitAccess } from '../utils/aiToolkitPermissions';
import { NotificationDropdown } from './NotificationDropdown';
import { NavigationTabItem, DEFAULT_NAVIGATION_TABS } from '../config/navigation';

export type MainTabType = 'dashboard' | 'challenges' | 'members' | 'announcements' | 'resources' | 'toolkit' | 'revenue' | 'trends' | 'subscription';

interface HeaderProps {
  isAdminLoggedIn: boolean;
  filteredCount: number;
  totalCount: number;
  mainTab: MainTabType;
  onSelectMainTab: (tab: MainTabType) => void;
  currentUser: NaverUser | null;
  onOpenGoogleAuth: () => void;
  onLogoutGoogle: () => void;
  onOpenProfileModal: () => void;
  onOpenMenuDrawer: () => void;
  lastSyncTime?: string;
  onManualSync?: () => void;
  isSyncing?: boolean;
  groups?: ChallengeGroup[];
  participants?: Participant[];
  canAccessAIToolkit?: boolean;
  notifications?: AppNotification[];
  onMarkAsRead?: (notificationId: string) => void;
  onMarkAllAsRead?: () => void;
  onDeleteNotification?: (notificationId: string) => void;
  onClearAllNotifications?: () => void;
  navigationTabs?: Record<MainTabType, NavigationTabItem>;
}

export const Header: React.FC<HeaderProps> = ({
  isAdminLoggedIn,
  filteredCount,
  totalCount,
  mainTab,
  onSelectMainTab,
  currentUser,
  onOpenGoogleAuth,
  onLogoutGoogle,
  onOpenProfileModal,
  onOpenMenuDrawer,
  lastSyncTime,
  onManualSync,
  isSyncing = false,
  groups = [],
  participants = [],
  canAccessAIToolkit,
  notifications = [],
  onMarkAsRead = () => {},
  onMarkAllAsRead = () => {},
  onDeleteNotification = () => {},
  onClearAllNotifications = () => {},
  navigationTabs,
}) => {
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const currentTabs = navigationTabs || DEFAULT_NAVIGATION_TABS;

  const getPageTitle = () => {
    if (currentTabs[mainTab]?.label) {
      return currentTabs[mainTab].label;
    }
    switch (mainTab) {
      case 'dashboard':
        return '홈 대시보드';
      case 'challenges':
        return '챌린지 현황';
      case 'members':
        return '가입 멤버 현황';
      case 'announcements':
      case 'resources':
        return '공지사항 & 자료실';
      case 'trends':
        return '트렌드 키워드 수집';
      case 'toolkit':
        return 'AI 초안 생성기';
      case 'revenue':
        return '수익 인증 명예의 전당';
      default:
        return '챌린지 모니터링';
    }
  };

  return (
    <header className="bg-white/90 backdrop-blur-md border-b border-gray-100 sticky top-0 z-20 select-none">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between gap-3">
          
          {/* Mobile View: Logo + Title */}
          <div className="flex items-center space-x-2.5 lg:hidden">
            <div
              onClick={() => onSelectMainTab('dashboard')}
              className="flex items-center space-x-2 cursor-pointer"
            >
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <LayoutDashboard className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-sm font-extrabold text-slate-900 tracking-tight flex items-center gap-1">
                  <span>챌린지 모니터링</span>
                  {isAdminLoggedIn && (
                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded-full">
                      운영자
                    </span>
                  )}
                </h1>
              </div>
            </div>
          </div>

          {/* Desktop View: Page Title & Breadcrumb */}
          <div className="hidden lg:flex items-center space-x-3">
            <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
              {getPageTitle()}
            </h2>
            <span className="text-xs text-slate-400 font-medium">
              | 네이버 블로그 자동 집계 시스템
            </span>
          </div>

          {/* Right: Quick Actions (Sync, Profile / Login, Mobile Menu Trigger) */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Quick Sync Button */}
            {onManualSync && (
              <button
                type="button"
                onClick={onManualSync}
                disabled={isSyncing}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-blue-600 bg-gray-50 hover:bg-blue-50/50 border border-gray-100 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                title="데이터 실시간 동기화"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${
                    isSyncing ? 'animate-spin text-blue-600' : 'text-slate-400'
                  }`}
                />
                <span className="hidden md:inline">{isSyncing ? '동기화 중...' : '동기화'}</span>
              </button>
            )}

            {/* Notification Bell (Desktop & Mobile) */}
            <NotificationDropdown
              notifications={notifications}
              onMarkAsRead={onMarkAsRead}
              onMarkAllAsRead={onMarkAllAsRead}
              onDeleteNotification={onDeleteNotification}
              onClearAllNotifications={onClearAllNotifications}
              onSelectMainTab={onSelectMainTab}
              isOpen={showNotifications}
              onClose={() => setShowNotifications(false)}
              onToggle={() => setShowNotifications(!showNotifications)}
            />

            {/* Desktop User Account Trigger */}
            <div className="hidden sm:block relative">
              {currentUser ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowUserDropdown(!showUserDropdown)}
                    className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-white text-slate-800 border border-gray-100 hover:bg-gray-50 transition-all cursor-pointer shadow-2xs"
                  >
                    {currentUser.avatarUrl ? (
                      <img
                        src={currentUser.avatarUrl}
                        alt="avatar"
                        className="w-5 h-5 rounded-full border border-gray-200 shrink-0 object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-black shrink-0">
                        {currentUser.name?.[0] || 'G'}
                      </span>
                    )}
                    <span className="text-xs font-bold text-slate-800 truncate max-w-[100px]">
                      {currentUser.name || currentUser.email}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </button>

                  {/* Dropdown Menu */}
                  {showUserDropdown && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                      <div className="p-2.5 border-b border-gray-100 space-y-0.5">
                        <p className="text-xs font-extrabold text-slate-900 truncate">
                          {currentUser.name}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {currentUser.email}
                        </p>
                      </div>
                      <div className="p-1 space-y-1">
                        <button
                          type="button"
                          onClick={() => {
                            setShowUserDropdown(false);
                            onOpenProfileModal();
                          }}
                          className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 hover:bg-gray-50 rounded-xl flex items-center space-x-2 transition-colors cursor-pointer"
                        >
                          <User className="w-3.5 h-3.5 text-blue-600" />
                          <span>내 프로필 & 참가 현황</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowUserDropdown(false);
                            onLogoutGoogle();
                          }}
                          className="w-full text-left px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl flex items-center space-x-2 transition-colors cursor-pointer"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>로그아웃</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onOpenGoogleAuth}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all cursor-pointer shadow-[0_2px_8px_rgba(37,99,235,0.2)]"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>로그인</span>
                </button>
              )}
            </div>

            {/* Mobile All Menu Drawer Button */}
            <button
              type="button"
              onClick={onOpenMenuDrawer}
              className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-gray-100 border border-gray-100 transition-colors cursor-pointer"
              title="전체 메뉴"
            >
              <Menu className="w-5 h-5" />
            </button>

          </div>

        </div>
      </div>
    </header>
  );
};
