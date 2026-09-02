import React from 'react';
import { Home, Trophy, Sparkles, TrendingUp, Compass } from 'lucide-react';
import { NaverUser } from '../types';
import { MainTabType } from './Header';
import { NavigationTabItem, DEFAULT_NAVIGATION_TABS } from '../config/navigation';

interface BottomNavProps {
  mainTab: MainTabType;
  onSelectMainTab: (tab: MainTabType) => void;
  currentUser: NaverUser | null;
  onOpenGoogleAuth: () => void;
  onOpenProfileModal: () => void;
  onOpenMenuDrawer?: () => void;
  onScrollToTop: () => void;
  onScrollToChallenges: () => void;
  navigationTabs?: Record<MainTabType, NavigationTabItem>;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  mainTab,
  onSelectMainTab,
  currentUser,
  onOpenGoogleAuth,
  onOpenProfileModal,
  onOpenMenuDrawer,
  onScrollToTop,
  onScrollToChallenges,
  navigationTabs,
}) => {
  const currentTabs = navigationTabs || DEFAULT_NAVIGATION_TABS;

  const handleHomeClick = () => {
    onSelectMainTab('dashboard');
    onScrollToTop();
  };

  const handleChallengeClick = () => {
    onSelectMainTab('challenges');
    onScrollToTop();
  };

  const handleTrendsClick = () => {
    onSelectMainTab('trends');
    onScrollToTop();
  };

  const handleToolkitClick = () => {
    onSelectMainTab('toolkit');
    onScrollToTop();
  };

  const handleRevenueClick = () => {
    onSelectMainTab('revenue');
    onScrollToTop();
  };

  const isHomeActive = mainTab === 'dashboard';
  const isChallengeActive = mainTab === 'challenges';
  const isTrendsActive = mainTab === 'trends';
  const isToolkitActive = mainTab === 'toolkit';
  const isRevenueActive = mainTab === 'revenue';

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-100 shadow-[0_-2px_12px_rgba(0,0,0,0.04)] lg:hidden pb-safe select-none">
      <div className="grid grid-cols-5 h-15 max-w-lg mx-auto items-center px-1 sm:px-3">
        {/* 1. 홈 */}
        <button
          type="button"
          onClick={handleHomeClick}
          className={`flex flex-col items-center justify-center py-1.5 transition-all cursor-pointer active:scale-95 ${
            isHomeActive
              ? 'text-blue-600 font-extrabold'
              : 'text-slate-500 font-medium hover:text-slate-900'
          }`}
        >
          <Home
            className={`w-5 h-5 transition-transform ${
              isHomeActive ? 'stroke-[2.5px] scale-105 text-blue-600' : 'stroke-2 text-slate-400'
            }`}
          />
          <span className="text-[10px] sm:text-[11px] mt-1 tracking-tight truncate max-w-[56px]">
            {currentTabs.dashboard?.shortLabel || currentTabs.dashboard?.label || '홈'}
          </span>
        </button>

        {/* 2. 챌린지 */}
        <button
          type="button"
          onClick={handleChallengeClick}
          className={`flex flex-col items-center justify-center py-1.5 transition-all cursor-pointer active:scale-95 ${
            isChallengeActive
              ? 'text-blue-600 font-extrabold'
              : 'text-slate-500 font-medium hover:text-slate-900'
          }`}
        >
          <Trophy
            className={`w-5 h-5 transition-transform ${
              isChallengeActive ? 'stroke-[2.5px] scale-105 text-blue-600' : 'stroke-2 text-slate-400'
            }`}
          />
          <span className="text-[10px] sm:text-[11px] mt-1 tracking-tight truncate max-w-[56px]">
            {currentTabs.challenges?.shortLabel || currentTabs.challenges?.label || '챌린지'}
          </span>
        </button>

        {/* 3. 소재 추천 (트렌드 키워드) */}
        <button
          type="button"
          onClick={handleTrendsClick}
          className={`flex flex-col items-center justify-center py-1.5 transition-all cursor-pointer active:scale-95 relative ${
            isTrendsActive
              ? 'text-rose-600 font-extrabold'
              : 'text-slate-500 font-medium hover:text-slate-900'
          }`}
        >
          <Compass
            className={`w-5 h-5 transition-transform ${
              isTrendsActive ? 'stroke-[2.5px] scale-105 text-rose-600' : 'stroke-2 text-slate-400'
            }`}
          />
          <span className="text-[10px] sm:text-[11px] mt-1 tracking-tight truncate max-w-[56px]">
            {currentTabs.trends?.shortLabel || currentTabs.trends?.label || '소재추천'}
          </span>
        </button>

        {/* 4. AI 툴킷 */}
        <button
          type="button"
          onClick={handleToolkitClick}
          className={`flex flex-col items-center justify-center py-1.5 transition-all cursor-pointer active:scale-95 relative ${
            isToolkitActive
              ? 'text-indigo-600 font-extrabold'
              : 'text-slate-500 font-medium hover:text-slate-900'
          }`}
        >
          <div className="relative">
            <Sparkles
              className={`w-5 h-5 transition-transform ${
                isToolkitActive ? 'stroke-[2.5px] scale-105 text-indigo-600' : 'stroke-2 text-slate-400'
              }`}
            />
            <span className="absolute -top-1 -right-2 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600"></span>
            </span>
          </div>
          <span className="text-[10px] sm:text-[11px] mt-1 tracking-tight truncate max-w-[56px]">
            {currentTabs.toolkit?.shortLabel || currentTabs.toolkit?.label || '초안 생성기'}
          </span>
        </button>

        {/* 5. 수익 인증 */}
        <button
          type="button"
          onClick={handleRevenueClick}
          className={`flex flex-col items-center justify-center py-1.5 transition-all cursor-pointer active:scale-95 relative ${
            isRevenueActive
              ? 'text-amber-600 font-extrabold'
              : 'text-slate-500 font-medium hover:text-slate-900'
          }`}
        >
          <TrendingUp
            className={`w-5 h-5 transition-transform ${
              isRevenueActive ? 'stroke-[2.5px] scale-105 text-amber-600' : 'stroke-2 text-slate-400'
            }`}
          />
          <span className="text-[10px] sm:text-[11px] mt-1 tracking-tight truncate max-w-[56px]">
            {currentTabs.revenue?.shortLabel || currentTabs.revenue?.label || '수익 인증'}
          </span>
        </button>
      </div>
    </nav>
  );
};

