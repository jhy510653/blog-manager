import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Participant, FilterState, SummaryStats, ChallengeGroup, NaverUser, Announcement, ChallengeResource, SiteVisitorStats, ChallengePayment, ChallengeRefund, RefundStatus, AdminDecision, RevenueCertification, RevenueCertificationStatus, AppNotification, FAQItem, QnAItem } from './types';
import { exportToCSV } from './utils/csvExport';
import { exportToExcel } from './utils/excelExport';
import { Header, MainTabType } from './components/Header';
import { SummaryCards } from './components/SummaryCards';
import { ChallengeCardGrid } from './components/ChallengeCardGrid';
import { ChallengeCalendar } from './components/ChallengeCalendar';
import { ParticipantTable } from './components/ParticipantTable';
import { ParticipantDetailModal } from './components/ParticipantDetailModal';
import { AnalyticsCharts } from './components/AnalyticsCharts';
import { TrendAnalyticsChart } from './components/TrendAnalyticsChart';
import { AdminLoginModal } from './components/AdminLoginModal';
import { AdminManagementModal } from './components/AdminManagementModal';
import { SupabaseModal } from './components/SupabaseModal';
import { RssCollectorModal } from './components/RssCollectorModal';
import { AiToolkitTab } from './components/AiToolkitTab';
import { ContentVisualTab } from './components/visual/ContentVisualTab';
import { AIToolkitAccessRestricted } from './components/AIToolkitAccessRestricted';
import { checkAIToolkitAccess } from './utils/aiToolkitPermissions';
import { GoogleAuthModal } from './components/GoogleAuthModal';
import { DesktopSidebar } from './components/DesktopSidebar';
import { UserProfileModal } from './components/UserProfileModal';
import { ProfileRequiredModal } from './components/ProfileRequiredModal';
import { BottomNav } from './components/BottomNav';
import { MobileMenuDrawer } from './components/MobileMenuDrawer';
import { HomeDashboardView } from './components/HomeDashboardView';
import { AnnouncementsView } from './components/AnnouncementsView';
import { ResourcesView } from './components/ResourcesView';
import { RevenueCertificationView } from './components/revenue/RevenueCertificationView';
import { TrendKeywordsView } from './components/TrendKeywordsView';
import { ChallengeDetailModal } from './components/ChallengeDetailModal';
import { ChallengeDetailPage } from './components/ChallengeDetailPage';
import { ChallengeOverview } from './components/ChallengeOverview';
import { ChallengeStats } from './components/ChallengeStats';
import { ApplyChallengeModal } from './components/ApplyChallengeModal';
import { AnnouncementDetailView } from './components/AnnouncementDetailModal';
import { ResourceDetailPage } from './components/ResourceDetailPage';
import { MembersListView } from './components/MembersListView';
import { MemberDetailView } from './components/MemberDetailView';
import { SiteSubscriptionView } from './components/subscription/SiteSubscriptionView';
import { runBatchDataCollector, verifyAndSyncParticipantData, syncBulkToSupabase } from './services/rssCollector';
import {
  getSupabaseClient,
  fetchGroupsFromSupabase,
  fetchParticipantsFromSupabase,
  saveGroupToSupabase,
  updateGroupInSupabase,
  deleteGroupFromSupabase,
  saveParticipantToSupabase,
  updateParticipantInSupabase,
  deleteParticipantFromSupabase,
  deleteDummyParticipantsFromSupabase,
  upsertProfileInSupabase,
  fetchProfileByEmail,
  fetchAnnouncementsFromSupabase,
  saveAnnouncementToSupabase,
  deleteAnnouncementFromSupabase,
  fetchResourcesFromSupabase,
  saveResourceToSupabase,
  deleteResourceFromSupabase,
  fetchFaqsFromSupabase,
  saveFaqToSupabase,
  deleteFaqFromSupabase,
  reorderFaqsInSupabase,
  DEFAULT_FAQS,
  fetchQnaPostsFromSupabase,
  saveQnaPostToSupabase,
  answerQnaPostInSupabase,
  deleteQnaPostFromSupabase,
  DEFAULT_QNAS,
  recordSiteVisit,
  fetchSiteVisitorStats,
  fetchChallengePaymentsFromSupabase,
  saveChallengePaymentToSupabase,
  updateChallengePaymentStatusInSupabase,
  fetchChallengeRefundsFromSupabase,
  saveChallengeRefundToSupabase,
  updateChallengeRefundStatusInSupabase,
  saveBatchChallengeRefundsToSupabase,
  fetchRevenueCertificationsFromSupabase,
  saveRevenueCertificationToSupabase,
  updateRevenueCertificationStatusInSupabase,
  deleteRevenueCertificationFromSupabase,
  toggleLikeRevenueCertificationInSupabase,
  fetchBadgesFromSupabase,
  fetchUserBadgesFromSupabase,
  evaluateAndAwardUserBadges,
  fetchNavigationTabsFromSupabase,
  autoGrantTierFromChallengeApprovalInSupabase,
} from './lib/supabase';
import { NavigationTabItem, DEFAULT_NAVIGATION_TABS, getStoredNavigationTabs } from './config/navigation';
import { BadgeNotificationToast } from './components/badges/BadgeNotificationToast';
import { calculateParticipantGoal } from './utils/goalCalculator';
import { calculateBatchRefundSnapshots } from './utils/refundCalculator';
import { getParticipantPeriodStats } from './utils/challengeStatsUtils';
import { CheckCircle2, Settings, ArrowLeft, Calendar, Sparkles, Award, Users, TrendingUp, BarChart3, ListFilter, LayoutDashboard, RefreshCw, Trophy, Palette, ImageIcon, FileText } from 'lucide-react';
import { UserBadge } from './types';

export default function App() {
  const [groups, setGroups] = useState<ChallengeGroup[]>(() => {
    try {
      const saved = localStorage.getItem('challenge_groups');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse saved groups:', e);
    }
    return [];
  });

  const [participants, setParticipants] = useState<Participant[]>(() => {
    try {
      const saved = localStorage.getItem('challenge_participants');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const dummyIds = new Set(['p1', 'p2', 'p3', 'p4', 'p5', 'test', 'sample', 'demo', 'dummy', 'participant-1', 'participant-2']);
          const clean = parsed.filter((p: any) => p && p.id && !dummyIds.has(p.id) && (p.id.startsWith('p_user_') || !dummyIds.has(p.id.toLowerCase())));
          
          // Deduplicate by ID
          const seen = new Set<string>();
          const deduped: Participant[] = [];
          clean.forEach((p: Participant) => {
            const key = String(p.id).trim();
            if (!seen.has(key)) {
              seen.add(key);
              deduped.push(p);
            }
          });

          // Update localStorage immediately if duplicates or dummies were stripped
          if (deduped.length !== parsed.length) {
            localStorage.setItem('challenge_participants', JSON.stringify(deduped));
          }
          return deduped;
        }
      }
    } catch (e) {
      console.error('Failed to parse saved participants:', e);
    }
    return [];
  });

  const [payments, setPayments] = useState<ChallengePayment[]>(() => {
    try {
      const saved = localStorage.getItem('challenge_payments');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse saved payments:', e);
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem('challenge_payments', JSON.stringify(payments));
    } catch (e) {
      console.error('Failed to save payments to localStorage:', e);
    }
  }, [payments]);

  const [refunds, setRefunds] = useState<ChallengeRefund[]>(() => {
    try {
      const saved = localStorage.getItem('challenge_refunds');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse saved refunds:', e);
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem('challenge_refunds', JSON.stringify(refunds));
    } catch (e) {
      console.error('Failed to save refunds to localStorage:', e);
    }
  }, [refunds]);

  const [revenueCertifications, setRevenueCertifications] = useState<RevenueCertification[]>(() => {
    try {
      const saved = localStorage.getItem('cpa_revenue_certifications');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse saved revenue certifications:', e);
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem('cpa_revenue_certifications', JSON.stringify(revenueCertifications));
    } catch (e) {
      console.error('Failed to save revenue certifications to localStorage:', e);
    }
  }, [revenueCertifications]);

  const [isSupabaseConnected, setIsSupabaseConnected] = useState<boolean>(false);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState<boolean>(false);
  const [isRssCollectorModalOpen, setIsRssCollectorModalOpen] = useState<boolean>(false);

  // Admin auth state
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(() => {
    try {
      return localStorage.getItem('is_admin_logged_in') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('is_admin_logged_in', isAdminLoggedIn ? 'true' : 'false');
    } catch (e) {
      console.error('Failed to save admin login state to localStorage:', e);
    }
  }, [isAdminLoggedIn]);

  // In-App Notification Center State
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      const saved = localStorage.getItem('cpa_app_notifications');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Filter out legacy refund account / refund form notices if present
          return parsed.filter(
            (n) =>
              !n.title?.includes('환급계좌') &&
              !n.message?.includes('환급계좌') &&
              n.id !== 'notif_guide'
          );
        }
      }
    } catch (e) {
      console.warn('Failed to parse saved notifications:', e);
    }
    return [
      {
        id: 'notif_welcome',
        userId: 'all',
        type: 'announcement',
        title: '🎉 챌린지 자동 모니터링 시스템에 오신 것을 환영합니다!',
        message: '참가비 입금 확인, 1:1 Q&A 질문 답변, 공지사항, 수익 인증 명예의 전당 소식을 실시간 알림으로 받아보실 수 있습니다.',
        isRead: false,
        linkTab: 'challenges',
        createdAt: '방금 전',
      },
      {
        id: 'notif_qna_board',
        userId: 'all',
        type: 'qna_new',
        title: '💬 1:1 Q&A 및 실시간 질문답변 센터 안내',
        message: '챌린지 진행 중 궁금하신 사항은 [공지사항 & 소식 > Q&A]에서 언제든지 자유롭게 질문하실 수 있습니다.',
        isRead: false,
        linkTab: 'announcements',
        createdAt: '오늘',
      },
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem('cpa_app_notifications', JSON.stringify(notifications));
    } catch (e) {
      console.error('Failed to save notifications to localStorage:', e);
    }
  }, [notifications]);

  const addAppNotification = useCallback(
    (notif: Omit<AppNotification, 'id' | 'createdAt' | 'isRead'>) => {
      const newNotif: AppNotification = {
        ...notif,
        id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        isRead: false,
        createdAt: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      };
      setNotifications((prev) => [newNotif, ...prev]);
    },
    []
  );

  const handleMarkNotificationAsRead = useCallback((notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
    );
  }, []);

  const handleMarkAllNotificationsAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }, []);

  const handleDeleteNotification = useCallback((notificationId: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
  }, []);

  const handleClearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const [isAdminLoginModalOpen, setIsAdminLoginModalOpen] = useState<boolean>(false);

  // App Toast Notification State
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  }, []);

  // App Main Navigation & Social Auth
  const [appMainTab, setAppMainTab] = useState<MainTabType>('dashboard');
  const [navigationTabs, setNavigationTabs] = useState<Record<MainTabType, NavigationTabItem>>(() => {
    return getStoredNavigationTabs();
  });
  const [toolkitSubTab, setToolkitSubTab] = useState<'keyword' | 'draft' | 'image'>('keyword');
  const [draftTargetKeyword, setDraftTargetKeyword] = useState<string>('');

  // Stage 1 Platforms: Announcements & Resources
  const [announcements, setAnnouncements] = useState<Announcement[]>(() => {
    try {
      const saved = localStorage.getItem('cpa_announcements');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed reading cpa_announcements from localStorage:', e);
    }
    return [
      {
        id: 'ann_1',
        title: '네이버 블로그 수익화 챌린지 1단계 플랫폼 개편 안내',
        content: '안녕하세요, 챌린지 운영진입니다.\n\n블로그 수익화 챌린지의 원활한 모니터링과 유용한 운영 자료 제공을 위하여 대시보드 UI/UX가 개편되었습니다.\n\n주요 개편 사항:\n1. 대시보드 홈 화면 리뉴얼 (챌린지 현황, 공지사항, 사이트 통계)\n2. 공지사항 및 챌린지 자료실 신설\n3. 챌린지 상세 및 리더보드 모달 제공\n\n궁금하신 점은 문의 부탁드립니다.',
        isImportant: true,
        createdAt: '2026-08-10',
        authorName: '운영진',
      },
      {
        id: 'ann_2',
        title: 'CPA 블로그 포스팅 모니터링 자동 집계 시스템 정상 가동 중',
        content: '매일 자정에 수행되는 네이버 블로그 RSS 및 트위터 API 자동 수집 로직이 정상 가동 중입니다.\n\n네이버 아이디가 올바르게 등록되어 있는지 [내 프로필 설정]에서 꼭 확인해주시기 바랍니다.',
        isImportant: false,
        createdAt: '2026-08-08',
        authorName: '운영진',
      },
    ];
  });

  const [resources, setResources] = useState<ChallengeResource[]>(() => {
    try {
      const saved = localStorage.getItem('cpa_resources');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed reading cpa_resources from localStorage:', e);
    }
    return [
      {
        id: 'res_1',
        title: 'CPA 수익화 블로그 키워드 발굴 가이드',
        description: '검색량이 풍부하고 전환율이 높은 CPA 고수익 키워드를 검색하고 본문에 자연스럽게 녹이는 실전 노하우 가이드북입니다.',
        targetGroup: 'all',
        linkUrl: 'https://blog.naver.com',
        createdAt: '2026-08-05',
      },
      {
        id: 'res_2',
        title: '8월 CPA 챌린지 1주차 작성 템플릿',
        description: '제목 작성법 및 본문 구조화(서론-본론-CPA링크-결론)가 완료된 네이버 스마트에디터 가이드 템플릿입니다.',
        targetGroup: '8월 CPA 챌린지',
        linkUrl: 'https://blog.naver.com',
        createdAt: '2026-08-07',
      },
    ];
  });

  const [faqs, setFaqs] = useState<FAQItem[]>(() => {
    try {
      const saved = localStorage.getItem('cpa_faqs');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed reading cpa_faqs from localStorage:', e);
    }
    return DEFAULT_FAQS;
  });

  const [qnaPosts, setQnaPosts] = useState<QnAItem[]>(() => {
    try {
      const saved = localStorage.getItem('cpa_qnas');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed reading cpa_qnas from localStorage:', e);
    }
    return DEFAULT_QNAS;
  });

  // Stage 1 Modals
  const [selectedDetailGroup, setSelectedDetailGroup] = useState<ChallengeGroup | null>(null);
  const [applyGroup, setApplyGroup] = useState<ChallengeGroup | null>(null);
  const [isGoogleAuthModalOpen, setIsGoogleAuthModalOpen] = useState<boolean>(false);
  const [isMobileMenuDrawerOpen, setIsMobileMenuDrawerOpen] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>(() => {
    return new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  });

  // Site Visitor Statistics System State
  const [visitorStats, setVisitorStats] = useState<SiteVisitorStats | null>(null);
  const [isLoadingVisitorStats, setIsLoadingVisitorStats] = useState<boolean>(true);

  // URL Routing State (/challenges/{id} & /challenges/{id}/leaderboard & /members)
  const parseRouteFromLocation = useCallback(() => {
    if (typeof window === 'undefined') return null;
    const path = window.location.pathname;
    const hash = window.location.hash.replace(/^#/, '');

    const rawPath = path !== '/' && path !== '' ? path : hash;

    // Match /members/:userId
    const memberDetailMatch = rawPath.match(/^\/members\/([^\/]+)\/?$/);
    if (memberDetailMatch) {
      return {
        type: 'member-detail' as const,
        userId: decodeURIComponent(memberDetailMatch[1]),
      };
    }

    // Match /members
    if (rawPath === '/members' || rawPath === '/members/') {
      return {
        type: 'members-list' as const,
      };
    }

    // Match /admin
    if (rawPath === '/admin' || rawPath === '/admin/') {
      return { type: 'admin' as const };
    }

    // Match /notices/:id
    const noticeDetailMatch = rawPath.match(/^\/notices\/([^\/]+)\/?$/);
    if (noticeDetailMatch) {
      return {
        type: 'notice-detail' as const,
        noticeId: decodeURIComponent(noticeDetailMatch[1]),
      };
    }

    // Match /notices
    if (rawPath === '/notices' || rawPath === '/notices/') {
      return { type: 'notices-list' as const };
    }

    // Match /faq
    if (rawPath === '/faq' || rawPath === '/faq/') {
      return { type: 'faq-list' as const };
    }

    // Match /qna
    if (rawPath === '/qna' || rawPath === '/qna/') {
      return { type: 'qna-list' as const };
    }

    // Match /resources/:id
    const resourceDetailMatch = rawPath.match(/^\/resources\/([^\/]+)\/?$/);
    if (resourceDetailMatch) {
      return {
        type: 'resource-detail' as const,
        resourceId: decodeURIComponent(resourceDetailMatch[1]),
      };
    }

    // Match /resources
    if (rawPath === '/resources' || rawPath === '/resources/') {
      return { type: 'resources-list' as const };
    }

    // Match /challenges/:id/leaderboard
    const leaderboardMatch = rawPath.match(/^\/challenges\/([^\/]+)\/leaderboard\/?$/);
    if (leaderboardMatch) {
      return {
        type: 'challenge-detail' as const,
        challengeId: decodeURIComponent(leaderboardMatch[1]),
        tab: 'leaderboard' as const,
      };
    }

    // Match /challenges/:id
    const detailMatch = rawPath.match(/^\/challenges\/([^\/]+)\/?$/);
    if (detailMatch) {
      return {
        type: 'challenge-detail' as const,
        challengeId: decodeURIComponent(detailMatch[1]),
        tab: 'info' as const,
      };
    }

    return null;
  }, []);

  const [routeState, setRouteState] = useState(() => parseRouteFromLocation());

  useEffect(() => {
    const handleLocationChange = () => {
      setRouteState(parseRouteFromLocation());
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, [parseRouteFromLocation]);

  const navigateToPath = useCallback((newPath: string) => {
    try {
      window.history.pushState({}, '', newPath);
    } catch (e) {
      window.location.hash = newPath;
    }
    setRouteState(parseRouteFromLocation());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [parseRouteFromLocation]);

  const handleScrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleScrollToChallenges = useCallback(() => {
    setAppMainTab('dashboard');
    setMainTab('overview');
    setTimeout(() => {
      const el = document.getElementById('challenge-card-grid-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 280, behavior: 'smooth' });
      }
    }, 80);
  }, []);

  // Unified Manual Refresh & Sync State
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncProgressMsg, setSyncProgressMsg] = useState<string>('');
  const [isUserProfileModalOpen, setIsUserProfileModalOpen] = useState<boolean>(false);
  const [profileRequiredState, setProfileRequiredState] = useState<{
    isOpen: boolean;
    requiredType: 'blog' | 'twitter' | 'both';
    challengeName: string;
  }>({
    isOpen: false,
    requiredType: 'blog',
    challengeName: '',
  });

  const [currentUser, setCurrentUser] = useState<NaverUser | null>(() => {
    try {
      const saved = localStorage.getItem('naver_user_session');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse saved Google user session:', e);
    }
    return null;
  });

  const [newEarnedBadges, setNewEarnedBadges] = useState<UserBadge[]>([]);

  // Automatically check & award eligible badges when user session or activities change
  useEffect(() => {
    if (currentUser) {
      const runBadgeCheck = async () => {
        try {
          const badges = await fetchBadgesFromSupabase();
          const existing = await fetchUserBadgesFromSupabase(currentUser.id || currentUser.email);
          const { newlyEarned } = await evaluateAndAwardUserBadges(
            currentUser.id || currentUser.email,
            currentUser.email,
            currentUser.name,
            currentUser.naverId,
            badges,
            revenueCertifications,
            participants,
            existing
          );
          if (newlyEarned && newlyEarned.length > 0) {
            setNewEarnedBadges((prev) => {
              const existingIds = new Set(prev.map((b) => b.badgeId));
              const fresh = newlyEarned.filter((b) => !existingIds.has(b.badgeId));
              return fresh.length > 0 ? [...prev, ...fresh] : prev;
            });
          }
        } catch (err) {
          console.warn('Badge evaluation effect note:', err);
        }
      };
      runBadgeCheck();
    }
  }, [currentUser?.email, currentUser?.id, revenueCertifications.length, participants.length]);

  const handleUpdateProfile = async (updatedUser: NaverUser): Promise<boolean> => {
    const oldNaverId = currentUser?.naverId;
    const oldName = currentUser?.name;
    const oldEmail = currentUser?.email || updatedUser.email;

    let finalUser = { ...updatedUser };
    let isDbSynced = false;

    try {
      // 1. Supabase profile upsert
      const upsertResult = await upsertProfileInSupabase(updatedUser);
      if (upsertResult && updatedUser.email) {
        // 2. Fetch recent saved profile from Supabase to verify consistency
        const dbProfile = await fetchProfileByEmail(updatedUser.email);
        if (dbProfile) {
          finalUser = {
            ...finalUser,
            ...dbProfile,
            avatarUrl: finalUser.avatarUrl || dbProfile.avatarUrl,
          };
          isDbSynced = true;
        }
      }
    } catch (err) {
      console.warn('Supabase profile async update sync warning:', err);
    }

    // 3. Update local user state and persistent local session
    setCurrentUser(finalUser);
    try {
      localStorage.setItem('naver_user_session', JSON.stringify(finalUser));
    } catch (e) {
      console.error('Failed to update local user session:', e);
    }

    // 4. Update participant list state and propagate changes to Supabase participant table
    setParticipants((prev) =>
      prev.map((p) => {
        const matchBlog = oldNaverId && p.blogId && p.blogId.toLowerCase() === oldNaverId.toLowerCase();
        const matchName = oldName && p.participantName.toLowerCase() === oldName.toLowerCase();
        const matchEmail = oldEmail && p.participantName.toLowerCase() === oldEmail.split('@')[0].toLowerCase();

        if (matchBlog || matchName || matchEmail) {
          const updatedP: Participant = {
            ...p,
            participantName: finalUser.name,
            blogId: finalUser.naverId,
            twitterId: finalUser.twitterId || p.twitterId,
          };
          updateParticipantInSupabase(updatedP).catch(() => {});
          return updatedP;
        }
        return p;
      })
    );

    return isDbSynced;
  };

  const handleJoinChallenge = (group: ChallengeGroup) => {
    if (!currentUser) {
      showToast('Google 로그인 후 바로 참가할 수 있습니다.');
      setIsGoogleAuthModalOpen(true);
      return;
    }

    // Check challenge category requirement
    const isBlogCategory = group.category === 'blog' || group.name.includes('블로그') || group.name.includes('네이버');
    const isTwitterCategory = group.category === 'twitter' || group.name.includes('트위터') || group.name.includes('X');
    const isBothCategory = group.category === 'both' || (isBlogCategory && isTwitterCategory);

    const rawNaverId = currentUser.naverId ? currentUser.naverId.trim().toLowerCase() : '';
    const hasNaverId = Boolean(rawNaverId && rawNaverId !== 'user' && rawNaverId !== 'user@gmail.com');
    const hasTwitterId = Boolean(currentUser.twitterId && currentUser.twitterId.trim());

    if (isBothCategory) {
      if (!hasNaverId || !hasTwitterId) {
        let reqType: 'blog' | 'twitter' | 'both' = 'both';
        if (!hasNaverId && hasTwitterId) reqType = 'blog';
        if (hasNaverId && !hasTwitterId) reqType = 'twitter';
        setProfileRequiredState({
          isOpen: true,
          requiredType: reqType,
          challengeName: group.name,
        });
        return;
      }
    } else if (isBlogCategory && !hasNaverId) {
      setProfileRequiredState({
        isOpen: true,
        requiredType: 'blog',
        challengeName: group.name,
      });
      return;
    } else if (isTwitterCategory && !hasTwitterId) {
      setProfileRequiredState({
        isOpen: true,
        requiredType: 'twitter',
        challengeName: group.name,
      });
      return;
    }

    // Check if user is already enrolled in this group
    const existingParticipant = participants.find((p) => {
      const matchBlog = p.blogId && currentUser.naverId && p.blogId.toLowerCase() === currentUser.naverId.toLowerCase();
      const matchName = p.participantName.toLowerCase() === currentUser.name.toLowerCase();
      const matchTwitter = currentUser.twitterId && p.twitterId && p.twitterId.toLowerCase() === currentUser.twitterId.toLowerCase();
      return matchBlog || matchName || matchTwitter;
    });

    if (existingParticipant) {
      const currentGroups = existingParticipant.groupNames || [existingParticipant.groupName];
      if (currentGroups.includes(group.name) || existingParticipant.groupName === group.name) {
        showToast(`이미 '${group.name}' 챌린지에 참가 중입니다!`);
        return;
      }

      const updatedGroupNames = Array.from(new Set([...currentGroups, group.name]));
      const updatedPart: Participant = {
        ...existingParticipant,
        groupName: updatedGroupNames.join(', '),
        groupNames: updatedGroupNames,
      };

      setParticipants((prev) =>
        prev.map((p) => (p.id === existingParticipant.id ? updatedPart : p))
      );

      if (isSupabaseConnected) {
        saveParticipantToSupabase(updatedPart).catch(() => {});
      }

      showToast(`'${group.name}' 참가가 완료되었습니다. 매일 1회(자정) 활동이 자동 집계됩니다.`);
      setFilters((f) => ({ ...f, groupName: group.name }));
      setMainTab('participants');
      return;
    }

    // Create new participant record
    const today = new Date().toISOString().split('T')[0];
    const newPart: Participant = {
      id: `p_user_${Date.now()}`,
      participantName: currentUser.name,
      groupName: group.name,
      groupNames: [group.name],
      platformType: group.category,
      blogId: currentUser.naverId || null,
      dailyPostCount: 0,
      dailyVisitorCount: 0,
      twitterId: currentUser.twitterId || null,
      tweetCount: 0,
      replyCount: 0,
      startDate: today,
      targetBlogPostCount: group.targetBlogPostCount || 10,
      targetTweetCount: group.targetTweetCount || 10,
      targetReplyCount: group.targetReplyCount || 20,
      streakDays: 1,
    };

    setParticipants((prev) => [newPart, ...prev]);
    if (isSupabaseConnected) {
      saveParticipantToSupabase(newPart).catch(() => {});
      upsertProfileInSupabase(currentUser).catch(() => {});
    }

    showToast(`'${group.name}' 참가가 완료되었습니다. 매일 1회(자정) 블로그/트윗 활동이 자동 집계됩니다.`);
    setFilters((f) => ({ ...f, groupName: group.name }));
    setMainTab('participants');
  };

  const handleSubmitPayment = async (paymentData: {
    challengeId: string;
    challengeName: string;
    amount: number;
    depositorName: string;
    depositedAt: string;
  }) => {
    if (!currentUser) return;

    const newPayment: ChallengePayment = {
      id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      challengeId: paymentData.challengeId,
      challengeName: paymentData.challengeName,
      userId: currentUser.email || currentUser.naverId || currentUser.name,
      userName: currentUser.name,
      userEmail: currentUser.email || '',
      depositorName: paymentData.depositorName,
      depositedAt: paymentData.depositedAt,
      amount: paymentData.amount,
      status: 'submitted',
      submittedAt: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
    };

    setPayments((prev) => [newPayment, ...prev]);

    if (isSupabaseConnected) {
      await saveChallengePaymentToSupabase(newPayment).catch((err) => {
        console.warn('Failed saving payment application to Supabase:', err);
      });
    }

    // Trigger in-app notification
    addAppNotification({
      type: 'payment_pending',
      title: '참가비 입금 확인 접수',
      message: `'${paymentData.challengeName}' 참가비(${paymentData.amount.toLocaleString()}원) 입금 확인 신청이 접수되었습니다. 운영자 확인 후 승인됩니다.`,
      linkTab: 'challenges',
      linkId: paymentData.challengeId,
    });

    showToast(`'${paymentData.challengeName}' 참가비 입금 확인 신청이 접수되었습니다. 운영자 승인 후 참가가 확정됩니다.`);
  };

  const handleApprovePayment = async (paymentId: string) => {
    const targetPayment = payments.find((p) => p.id === paymentId);
    if (!targetPayment) return;

    const todayStr = new Date().toISOString().split('T')[0];

    setPayments((prev) =>
      prev.map((p) =>
        p.id === paymentId
          ? { ...p, status: 'approved', approvedAt: todayStr, approvedBy: '운영자' }
          : p
      )
    );

    const targetGroup = groups.find(
      (g) => g.id === targetPayment.challengeId || g.name === targetPayment.challengeName
    );

    if (isSupabaseConnected) {
      await updateChallengePaymentStatusInSupabase(paymentId, 'approved', '운영자').catch(() => {});
      // Auto-grant challenge buyer membership tier in Supabase
      if (targetGroup && (targetPayment.userEmail || targetPayment.userId)) {
        await autoGrantTierFromChallengeApprovalInSupabase(targetGroup, {
          id: targetPayment.userId,
          email: targetPayment.userEmail,
          name: targetPayment.userName,
          naverId: targetPayment.depositorName,
        }).catch((err) => {
          console.warn('Challenge buyer tier auto-grant warning:', err);
        });
      }
    }

    // Grant user challenge access by adding them to participants
    if (targetGroup) {
      const existingPart = participants.find((pt) => {
        const matchEmail =
          targetPayment.userEmail &&
          pt.participantName &&
          targetPayment.userEmail.split('@')[0].toLowerCase() === pt.participantName.toLowerCase();
        const matchName = pt.participantName.toLowerCase() === targetPayment.userName.toLowerCase();
        const matchBlog =
          pt.blogId && targetPayment.userId && pt.blogId.toLowerCase() === targetPayment.userId.toLowerCase();
        return matchEmail || matchName || matchBlog;
      });

      if (existingPart) {
        const currentGroups = existingPart.groupNames || [existingPart.groupName];
        if (!currentGroups.includes(targetGroup.name)) {
          const updatedGroups = Array.from(new Set([...currentGroups, targetGroup.name]));
          const updatedPart: Participant = {
            ...existingPart,
            groupName: updatedGroups.join(', '),
            groupNames: updatedGroups,
          };
          setParticipants((prev) => prev.map((p) => (p.id === existingPart.id ? updatedPart : p)));
          if (isSupabaseConnected) {
            saveParticipantToSupabase(updatedPart).catch(() => {});
          }
        }
      } else {
        const newPart: Participant = {
          id: `p_user_${Date.now()}`,
          participantName: targetPayment.userName || targetPayment.depositorName,
          groupName: targetGroup.name,
          groupNames: [targetGroup.name],
          platformType: targetGroup.category,
          blogId: null,
          dailyPostCount: 0,
          dailyVisitorCount: 0,
          twitterId: null,
          tweetCount: 0,
          replyCount: 0,
          startDate: todayStr,
          targetBlogPostCount: targetGroup.targetBlogPostCount || 10,
          targetTweetCount: targetGroup.targetTweetCount || 10,
          targetReplyCount: targetGroup.targetReplyCount || 20,
          streakDays: 1,
        };
        setParticipants((prev) => [newPart, ...prev]);
        if (isSupabaseConnected) {
          saveParticipantToSupabase(newPart).catch(() => {});
        }
      }
    }

    // Trigger notification
    addAppNotification({
      type: 'payment_approved',
      title: '🎉 참가비 입금 확인 완료',
      message: `'${targetPayment.challengeName}' 참가비 입금이 확인되어 참가가 최종 승인되었습니다!`,
      linkTab: 'challenges',
      linkId: targetPayment.challengeId,
    });

    showToast(`"${targetPayment.depositorName}" 님의 입금이 확인되었으며 참가가 승인되었습니다.`);
  };

  const handleRejectPayment = async (paymentId: string, reason: string) => {
    const targetPayment = payments.find((p) => p.id === paymentId);
    setPayments((prev) =>
      prev.map((p) =>
        p.id === paymentId
          ? { ...p, status: 'rejected', rejectionReason: reason }
          : p
      )
    );

    if (isSupabaseConnected) {
      await updateChallengePaymentStatusInSupabase(paymentId, 'rejected', undefined, reason).catch(() => {});
    }

    if (targetPayment) {
      addAppNotification({
        type: 'payment_rejected',
        title: '참가비 입금 확인 반려',
        message: `'${targetPayment.challengeName}' 입금 확인 신청이 반려되었습니다. 사유: ${reason || '입금 내역 불일치'}`,
        linkTab: 'challenges',
        linkId: targetPayment.challengeId,
      });
    }

    showToast('입금 확인 신청 거절 처리가 완료되었습니다.');
  };

  const handleSaveRefund = async (refund: ChallengeRefund) => {
    setRefunds((prev) => {
      const idx = prev.findIndex((r) => r.id === refund.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = refund;
        return copy;
      }
      return [refund, ...prev];
    });

    if (isSupabaseConnected) {
      await saveChallengeRefundToSupabase(refund).catch(() => {});
    }
  };

  const handleUpdateRefundStatus = async (
    refundId: string,
    status: RefundStatus,
    adminDecision?: AdminDecision,
    reason?: string,
    operatorName?: string,
    memo?: string
  ) => {
    const targetRefund = refunds.find((r) => r.id === refundId);
    const now = new Date().toISOString();
    setRefunds((prev) =>
      prev.map((r) => {
        if (r.id === refundId) {
          const updated: ChallengeRefund = {
            ...r,
            refundStatus: status,
            adminDecision: adminDecision || (status === 'approved' || status === 'completed' ? 'approved' : status === 'rejected' ? 'rejected' : r.adminDecision),
            adminDecisionReason: reason !== undefined ? reason : r.adminDecisionReason,
            memo: memo !== undefined ? memo : r.memo,
            updatedAt: now,
          };
          if (status === 'approved') {
            updated.approvedAt = now;
            updated.approvedBy = operatorName || '운영진';
          } else if (status === 'completed') {
            updated.completedAt = now;
            updated.completedBy = operatorName || '운영진';
          }
          return updated;
        }
        return r;
      })
    );

    if (isSupabaseConnected) {
      await updateChallengeRefundStatusInSupabase(refundId, status, adminDecision, reason, operatorName, memo).catch(() => {});
    }

    if (status === 'completed') {
      const refundAmountVal = targetRefund?.eligibleAmount || targetRefund?.finalRefundAmount || targetRefund?.calculatedRefundAmount || 0;
      addAppNotification({
        type: 'refund_completed',
        title: '💸 환급금 송금 완료',
        message: `'${targetRefund?.challengeName || '챌린지'}' 목표 달성 환급금 ${(refundAmountVal).toLocaleString()}원이 송금 완료 처리되었습니다.`,
        linkTab: 'challenges',
      });
      showToast('💸 환급금이 송금 완료 처리되었습니다.');
    } else if (status === 'approved') {
      addAppNotification({
        type: 'refund_approved',
        title: '✅ 환급 자격 승인 완료',
        message: `'${targetRefund?.challengeName || '챌린지'}' 미션 달성으로 환급 자격이 승인되었습니다. 정기 송금일에 지급됩니다.`,
        linkTab: 'challenges',
      });
      showToast('✅ 환급 자격 승인이 완료되었습니다.');
    } else if (status === 'rejected') {
      addAppNotification({
        type: 'refund_pending',
        title: '환급 미승인 안내',
        message: `'${targetRefund?.challengeName || '챌린지'}' 환급 심사 결과: ${reason || '목표 달성 기준 미달'}`,
        linkTab: 'challenges',
      });
      showToast('❌ 환급 신청 거절 처리가 완료되었습니다.');
    }
  };

  const handleBatchCalculateRefunds = async (targetGroupCode: string) => {
    const targetGroups = targetGroupCode === 'all' ? groups : groups.filter((g) => g.id === targetGroupCode);
    let newCalculatedList: ChallengeRefund[] = [];

    targetGroups.forEach((g) => {
      const res = calculateBatchRefundSnapshots(participants, g, groups, payments, refunds);
      newCalculatedList = [...newCalculatedList, ...res];
    });

    if (newCalculatedList.length > 0) {
      setRefunds((prev) => {
        const mergedMap = new Map<string, ChallengeRefund>();
        prev.forEach((r) => mergedMap.set(r.id, r));
        newCalculatedList.forEach((r) => mergedMap.set(r.id, r));
        return Array.from(mergedMap.values());
      });

      if (isSupabaseConnected) {
        await saveBatchChallengeRefundsToSupabase(newCalculatedList).catch(() => {});
      }
      showToast(`🎉 총 ${newCalculatedList.length}건의 환급 스냅샷이 자동 계산되었습니다.`);
    } else {
      showToast('계산 대상 참가자가 없습니다.');
    }
  };

  // Revenue Certification Handlers
  const handleSubmitRevenueCert = async (
    itemData: Omit<RevenueCertification, 'id' | 'createdAt' | 'status' | 'likesCount' | 'viewsCount' | 'isFeatured' | 'likedUserIds'>
  ): Promise<RevenueCertification> => {
    const newCert: RevenueCertification = {
      ...itemData,
      id: `rev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      status: 'pending',
      likesCount: 0,
      viewsCount: 0,
      isFeatured: false,
      likedUserIds: [],
      createdAt: new Date().toISOString(),
    };

    setRevenueCertifications((prev) => [newCert, ...prev]);

    if (isSupabaseConnected) {
      await saveRevenueCertificationToSupabase(newCert);
    }

    addAppNotification({
      type: 'revenue_submitted',
      title: '수익 인증 심사 접수',
      message: `'${itemData.title}' 수익 인증이 접수되었습니다. 운영자 심사 후 명예의 전당에 등록됩니다.`,
      linkTab: 'revenue',
    });

    showToast('수익 인증 신청이 성공적으로 접수되었습니다. 운영자 심사 후 명예의 전당에 공개됩니다.');
    return newCert;
  };

  const handleUpdateRevenueCertStatus = async (
    id: string,
    status: RevenueCertificationStatus,
    rejectionReason?: string,
    isFeatured?: boolean
  ) => {
    const targetCert = revenueCertifications.find((c) => c.id === id);
    const updatedBy = '운영자';
    setRevenueCertifications((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              status,
              rejectionReason: rejectionReason !== undefined ? rejectionReason : c.rejectionReason,
              approvedBy: status === 'approved' ? updatedBy : c.approvedBy,
              approvedAt: status === 'approved' ? (c.approvedAt || new Date().toISOString()) : c.approvedAt,
              isFeatured: isFeatured !== undefined ? isFeatured : c.isFeatured,
              updatedAt: new Date().toISOString(),
            }
          : c
      )
    );

    if (isSupabaseConnected) {
      await updateRevenueCertificationStatusInSupabase(id, status, {
        rejectionReason,
        approvedBy: updatedBy,
        isFeatured,
      });
    }

    if (status === 'approved') {
      addAppNotification({
        type: 'revenue_approved',
        title: '🏆 수익 인증 심사 승인',
        message: `'${targetCert?.title || '수익 인증'}' 건이 심사 승인되어 [수익 인증 명예의 전당]에 등록되었습니다!`,
        linkTab: 'revenue',
      });
      showToast('수익 인증 신청이 승인되어 명예의 전당에 게시되었습니다.');
    } else if (status === 'rejected') {
      addAppNotification({
        type: 'revenue_rejected',
        title: '수익 인증 심사 반려',
        message: `'${targetCert?.title || '수익 인증'}' 건이 반려되었습니다. 사유: ${rejectionReason || '인증 자료 불충분'}`,
        linkTab: 'revenue',
      });
      showToast('수익 인증 신청이 반려 처리되었습니다.');
    } else {
      showToast('수익 인증 정보가 업데이트되었습니다.');
    }
  };

  const handleDeleteRevenueCert = async (id: string) => {
    setRevenueCertifications((prev) => prev.filter((c) => c.id !== id));
    if (isSupabaseConnected) {
      await deleteRevenueCertificationFromSupabase(id);
    }
    showToast('수익 인증 내역이 삭제되었습니다.');
  };

  const handleToggleLikeRevenueCert = async (id: string, userId: string) => {
    const { likesCount, isLiked } = await toggleLikeRevenueCertificationInSupabase(id, userId);
    setRevenueCertifications((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const currentLiked = c.likedUserIds || [];
          const nextLiked = isLiked
            ? Array.from(new Set([...currentLiked, userId]))
            : currentLiked.filter((uid) => uid !== userId);
          return {
            ...c,
            likesCount: nextLiked.length,
            likedUserIds: nextLiked,
          };
        }
        return c;
      })
    );
  };

  const handleLeaveChallenge = (participantId: string, challengeName: string) => {
    let idsToDeleteFromDb: string[] = [];

    setParticipants((prev) =>
      prev
        .map((p) => {
          const isTargetId = p.id === participantId;

          const currentGroups = (p.groupNames && p.groupNames.length > 0)
            ? p.groupNames
            : p.groupName ? p.groupName.split(',').map((s) => s.trim()).filter(Boolean) : [];

          const isGroupMatch = currentGroups.includes(challengeName) || p.groupName === challengeName;

          const isUserMatch = Boolean(
            currentUser && (
              (p.participantName && p.participantName.toLowerCase() === currentUser.name.toLowerCase()) ||
              (currentUser.naverId && currentUser.naverId !== 'user' && p.blogId && p.blogId.toLowerCase() === currentUser.naverId.toLowerCase()) ||
              (currentUser.twitterId && p.twitterId && p.twitterId.toLowerCase() === currentUser.twitterId.toLowerCase()) ||
              (currentUser.email && p.participantName && currentUser.email.split('@')[0].toLowerCase() === p.participantName.toLowerCase())
            )
          );

          if (!isTargetId && !(isUserMatch && isGroupMatch)) {
            return p;
          }

          const updatedGroups = currentGroups.filter((g) => g !== challengeName);

          if (updatedGroups.length === 0) {
            idsToDeleteFromDb.push(p.id);
            return null;
          }

          const updatedPart: Participant = {
            ...p,
            groupName: updatedGroups.join(', '),
            groupNames: updatedGroups,
          };

          if (isSupabaseConnected) {
            updateParticipantInSupabase(updatedPart).catch(() => {});
          }
          return updatedPart;
        })
        .filter((p): p is Participant => p !== null)
    );

    if (isSupabaseConnected && idsToDeleteFromDb.length > 0) {
      idsToDeleteFromDb.forEach((id) => {
        deleteParticipantFromSupabase(id).catch(() => {});
      });
    }

    showToast(`'${challengeName}' 챌린지 참가가 취소되었습니다.`);
  };

  const handleGoogleLoginSuccess = async (user: NaverUser) => {
    let finalUser = { ...user };

    if (user.email) {
      try {
        const existingDbProfile = await fetchProfileByEmail(user.email);
        if (existingDbProfile) {
          finalUser = {
            ...existingDbProfile,
            name: user.name || existingDbProfile.name,
            email: user.email,
            avatarUrl: user.avatarUrl || existingDbProfile.avatarUrl,
          };
        }
      } catch (err) {
        console.warn('Google login Supabase sync check failed:', err);
      }
    }

    // Always upsert to Supabase profiles table
    await upsertProfileInSupabase(finalUser).catch((err) => {
      console.warn('Supabase profile login save warning:', err);
    });

    setCurrentUser(finalUser);
    try {
      localStorage.setItem('naver_user_session', JSON.stringify(finalUser));
    } catch (e) {
      console.error('Failed to save Google Auth session:', e);
    }

    showToast(`Google 로그인 완료! 계정(${finalUser.email}) 프로필이 연동되었습니다.`);
  };

  const handleLogoutGoogle = () => {
    setCurrentUser(null);
    localStorage.removeItem('naver_user_session');
    setAppMainTab('dashboard');
    showToast('Google 계정에서 로그아웃되었습니다.');
  };

  const handleSelectMainTab = (tab: MainTabType) => {
    if ((tab === 'toolkit' || tab === 'trends') && !currentUser && !isAdminLoggedIn) {
      showToast(tab === 'trends' ? '트렌드 키워드 수집 조회를 위해 로그인이 필요합니다.' : 'AI 툴킷 이용을 위해 Google 로그인이 필요합니다.');
      setIsGoogleAuthModalOpen(true);
      return;
    }
    
    setAppMainTab(tab);

    if (tab === 'announcements') {
      navigateToPath('/notices');
      return;
    }
    if (tab === 'resources') {
      navigateToPath('/resources');
      return;
    }
    if (tab === 'challenges') {
      navigateToPath('/challenges');
    } else if (tab === 'members') {
      navigateToPath('/members');
    } else {
      if (routeState) navigateToPath('/');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSelectKeywordForDraft = useCallback((keyword: string) => {
    if (!currentUser && !isAdminLoggedIn) {
      showToast('AI 툴킷 초안 생성을 위해 Google 로그인이 필요합니다.');
      setIsGoogleAuthModalOpen(true);
      return;
    }
    setDraftTargetKeyword(keyword);
    setAppMainTab('toolkit');
    setToolkitSubTab('draft');
    if (routeState) {
      navigateToPath('/');
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    showToast(`"${keyword}" 키워드로 AI 블로그 초안 작성 화면으로 이동했습니다.`);
  }, [currentUser, isAdminLoggedIn, routeState, navigateToPath, showToast]);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('challenge_groups', JSON.stringify(groups));
    } catch (e) {
      console.error('Failed to save groups to localStorage:', e);
    }
  }, [groups]);

  useEffect(() => {
    try {
      localStorage.setItem('challenge_participants', JSON.stringify(participants));
    } catch (e) {
      console.error('Failed to save participants to localStorage:', e);
    }
  }, [participants]);

  // Filters state
  const [filters, setFilters] = useState<FilterState>({
    groupName: 'all',
    startDate: '',
    endDate: '',
    searchTerm: '',
    platformFilter: 'all',
  });

  // Main Tab for Challenge Detail View ('table' | 'trends')
  const [activeDetailTab, setActiveDetailTab] = useState<'table' | 'trends'>('table');

  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);

  const isAutoSyncingRef = useRef<boolean>(false);
  const participantsRef = useRef<Participant[]>(participants);
  const groupsRef = useRef<ChallengeGroup[]>(groups);

  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  useEffect(() => {
    groupsRef.current = groups;
  }, [groups]);

  // Check and execute 24-hour (1 day) auto data sync
  const checkAndRunAutoSync = useCallback(async (listToUse?: Participant[]) => {
    if (isAutoSyncingRef.current) return;

    const list = listToUse || participantsRef.current;
    if (!list || list.length === 0) return;

    const AUTO_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours (1 day)
    const now = Date.now();
    const lastSyncStr = typeof localStorage !== 'undefined' ? localStorage.getItem('last_auto_sync_timestamp') : null;
    const lastSyncMs = lastSyncStr ? parseInt(lastSyncStr, 10) : 0;

    if (!lastSyncMs || (now - lastSyncMs) >= AUTO_SYNC_INTERVAL_MS) {
      isAutoSyncingRef.current = true;
      console.log('⚡ [1일 1회 자동 동기화] 데이터 수집 시작...');

      try {
        const { updatedParticipants } = await runBatchDataCollector(list, undefined, true, groupsRef.current);
        if (updatedParticipants && updatedParticipants.length > 0) {
          setParticipants(updatedParticipants);
          const formattedTime = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
          setLastSyncTime(formattedTime);
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('last_auto_sync_timestamp', Date.now().toString());
          }
          showToast(`⚡ [1일 1회 자동 동기화] 챌린지 기간 기준 RSS/방문자 데이터가 자동 업데이트되었습니다. (${formattedTime})`);
        }
      } catch (err) {
        console.warn('Auto sync execution exception:', err);
      } finally {
        isAutoSyncingRef.current = false;
      }
    }
  }, []);

  // Load Visitor Stats
  const loadVisitorStats = useCallback(async () => {
    setIsLoadingVisitorStats(true);
    try {
      const stats = await fetchSiteVisitorStats(participantsRef.current.length);
      setVisitorStats(stats);
    } catch (err) {
      console.warn('Failed loading visitor stats:', err);
    } finally {
      setIsLoadingVisitorStats(false);
    }
  }, []);

  // Load Data from Supabase if configured
  const loadSupabaseData = useCallback(async () => {
    const client = getSupabaseClient();
    if (!client) {
      setIsSupabaseConnected(false);
      loadVisitorStats();
      return;
    }

    try {
      // Background purge of residual legacy dummy IDs (p1, p2, p4, etc.) in Supabase DB
      deleteDummyParticipantsFromSupabase().catch(() => {});

      const remoteGroups = await fetchGroupsFromSupabase();
      const remoteParticipants = await fetchParticipantsFromSupabase();

      if (remoteGroups !== null && remoteParticipants !== null) {
        setIsSupabaseConnected(true);
        setGroups(remoteGroups);
        setParticipants(remoteParticipants);
        setLastSyncTime(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));

        const remoteAnnouncements = await fetchAnnouncementsFromSupabase();
        if (remoteAnnouncements !== null) {
          setAnnouncements(remoteAnnouncements);
          try {
            localStorage.setItem('cpa_announcements', JSON.stringify(remoteAnnouncements));
          } catch (e) {}
        }

        const remoteResources = await fetchResourcesFromSupabase();
        if (remoteResources !== null) {
          setResources(remoteResources);
          try {
            localStorage.setItem('cpa_resources', JSON.stringify(remoteResources));
          } catch (e) {}
        }

        const remoteFaqs = await fetchFaqsFromSupabase();
        if (remoteFaqs && remoteFaqs.length > 0) {
          setFaqs(remoteFaqs);
          try {
            localStorage.setItem('cpa_faqs', JSON.stringify(remoteFaqs));
          } catch (e) {}
        }

        const remoteQnas = await fetchQnaPostsFromSupabase();
        if (remoteQnas && remoteQnas.length > 0) {
          setQnaPosts(remoteQnas);
          try {
            localStorage.setItem('cpa_qnas', JSON.stringify(remoteQnas));
          } catch (e) {}
        }

        const remotePayments = await fetchChallengePaymentsFromSupabase();
        if (remotePayments && remotePayments.length > 0) {
          setPayments(remotePayments);
        }

        const remoteRefunds = await fetchChallengeRefundsFromSupabase();
        if (remoteRefunds && remoteRefunds.length > 0) {
          setRefunds(remoteRefunds);
        }

        const remoteRevenue = await fetchRevenueCertificationsFromSupabase();
        if (remoteRevenue && remoteRevenue.length > 0) {
          setRevenueCertifications(remoteRevenue);
        }

        const remoteNavTabs = await fetchNavigationTabsFromSupabase();
        if (remoteNavTabs) {
          setNavigationTabs(remoteNavTabs);
        }

        // Check auto sync immediately on data load
        checkAndRunAutoSync(remoteParticipants);
      } else {
        setIsSupabaseConnected(false);
      }
    } catch (err) {
      console.error('Failed loading Supabase data:', err);
      setIsSupabaseConnected(false);
    } finally {
      loadVisitorStats();
    }
  }, [checkAndRunAutoSync, loadVisitorStats]);

  useEffect(() => {
    loadSupabaseData();
  }, [loadSupabaseData]);

  // Supabase Realtime Channel Subscription for Instant Announcements & Resources Sync
  useEffect(() => {
    const client = getSupabaseClient();
    if (!client || !isSupabaseConnected) return;

    const channel = client
      .channel('public_announcements_resources_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'announcements' },
        async () => {
          const remoteAnn = await fetchAnnouncementsFromSupabase();
          if (remoteAnn !== null) {
            setAnnouncements(remoteAnn);
            try {
              localStorage.setItem('cpa_announcements', JSON.stringify(remoteAnn));
            } catch (e) {}
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'resources' },
        async () => {
          const remoteRes = await fetchResourcesFromSupabase();
          if (remoteRes !== null) {
            setResources(remoteRes);
            try {
              localStorage.setItem('cpa_resources', JSON.stringify(remoteRes));
            } catch (e) {}
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'revenue_certifications' },
        async () => {
          const remoteRevenue = await fetchRevenueCertificationsFromSupabase();
          if (remoteRevenue !== null) {
            setRevenueCertifications(remoteRevenue);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'faqs' },
        async () => {
          const remoteFaqs = await fetchFaqsFromSupabase();
          if (remoteFaqs !== null) {
            setFaqs(remoteFaqs);
            try {
              localStorage.setItem('cpa_faqs', JSON.stringify(remoteFaqs));
            } catch (e) {}
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'qna_posts' },
        async (payload: any) => {
          const remoteQnas = await fetchQnaPostsFromSupabase();
          if (remoteQnas !== null) {
            setQnaPosts(remoteQnas);
            try {
              localStorage.setItem('cpa_qnas', JSON.stringify(remoteQnas));
            } catch (e) {}

            // Handle real-time push notification from server/other clients
            if (payload?.eventType === 'INSERT' && payload?.new) {
              const newTitle = payload.new.title || '새 질문';
              const newCategory = payload.new.category || '질문';
              addAppNotification({
                type: 'qna_new',
                title: '💬 새 Q&A 질문이 등록되었습니다',
                message: `[${newCategory}] "${newTitle}" 질문이 등록되었습니다.`,
                linkTab: 'announcements',
                linkId: payload.new.id,
              });
            } else if (
              payload?.eventType === 'UPDATE' &&
              payload?.new &&
              payload?.new.answer_content &&
              (!payload.old || !payload.old.answer_content)
            ) {
              addAppNotification({
                type: 'qna_answered',
                title: '✨ Q&A 질문에 답변이 등록되었습니다',
                message: `'${payload.new.title || '질문'}'에 운영진 답변이 등록되었습니다.`,
                linkTab: 'announcements',
                linkId: payload.new.id,
                userId: payload.new.author_id || 'all',
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [isSupabaseConnected]);

  // Record site visit & update stats whenever main tab or route or user changes
  useEffect(() => {
    const currentPath = routeState ? `/challenges/${routeState.challengeId}` : `/${appMainTab}`;
    recordSiteVisit(currentUser, currentPath).then(() => {
      loadVisitorStats();
    });
  }, [routeState, appMainTab, currentUser, loadVisitorStats]);

  // Unified Manual Refresh & Sync Handler (1. RSS/Twitter Collect -> 2. Audit/Verify -> 3. Supabase DB & State Sync)
  const handleUnifiedManualSync = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncProgressMsg('1/3단계: 외부 데이터(네이버 블로그 RSS & 트위터) 수집 시작...');

    try {
      // 1단계: 외부 최신 데이터 수집
      const currentList = participantsRef.current || [];
      let step1List = currentList;
      let collectedPosts: any[] = [];
      if (currentList.length > 0) {
        const { updatedParticipants, uniqueBlogPosts } = await runBatchDataCollector(
          currentList,
          (current, total, name) => {
            setSyncProgressMsg(`1/3단계 최신 데이터 수집 중 (${current}/${total}): ${name}`);
          },
          true,
          groupsRef.current
        );
        if (updatedParticipants && updatedParticipants.length > 0) {
          step1List = updatedParticipants;
          setParticipants(updatedParticipants);
        }
        if (uniqueBlogPosts) {
          collectedPosts = uniqueBlogPosts;
        }
      }

      // 2단계: 수집 데이터 정합성 검사 및 통계 교정
      setSyncProgressMsg('2/3단계: 수집 데이터 정합성 검사 및 통계 검증 진행 중...');
      let step2List = step1List;
      if (step1List.length > 0) {
        const { verifiedParticipants } = await verifyAndSyncParticipantData(
          step1List,
          (current, total, name) => {
            setSyncProgressMsg(`2/3단계 정합성 검사 중 (${current}/${total}): ${name}`);
          }
        );
        if (verifiedParticipants && verifiedParticipants.length > 0) {
          step2List = verifiedParticipants;
          setParticipants(verifiedParticipants);
        }
      }

      // 3단계: Supabase DB 최신 데이터 동기화 및 최신 화면 상태 갱신
      setSyncProgressMsg('3/3단계: Supabase DB에 최종 검증된 데이터 일괄 저장 중...');
      if (step2List.length > 0) {
        await syncBulkToSupabase(step2List, collectedPosts, (current, total, name) => {
          setSyncProgressMsg(`3/3단계 DB 저장 중 (${current}/${total}): ${name}`);
        });
      }

      const client = getSupabaseClient();
      if (client) {
        setSyncProgressMsg('최신 화면 상태 갱신 중...');
        const remoteGroups = await fetchGroupsFromSupabase();
        const remoteParticipants = await fetchParticipantsFromSupabase();
        if (remoteGroups !== null) setGroups(remoteGroups);
        if (remoteParticipants !== null) {
          setParticipants(remoteParticipants);
        }
      }

      const formattedTime = new Date().toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setLastSyncTime(formattedTime);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('last_auto_sync_timestamp', Date.now().toString());
      }

      showToast(`🎉 [수동 새로고침/동기화 완료] 데이터 수집, 정합성 검증 및 DB/화면 갱신이 완료되었습니다. (${formattedTime})`);
    } catch (err: any) {
      console.error('Unified manual sync error:', err);
      showToast(`수동 동기화 중 오류가 발생했습니다: ${err.message || err}`);
    } finally {
      setIsSyncing(false);
      setSyncProgressMsg('');
    }
  }, [isSyncing, showToast]);

  // Periodic 30-minute auto sync timer & visibility listener
  useEffect(() => {
    if (participants.length > 0) {
      checkAndRunAutoSync();
    }

    // Check every 1 minute if 30 minutes have elapsed since last sync
    const intervalId = setInterval(() => {
      checkAndRunAutoSync();
    }, 60 * 1000);

    // Also trigger on tab refocus / visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkAndRunAutoSync();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkAndRunAutoSync]);

  // Reset filters
  const handleResetFilters = () => {
    setFilters({
      groupName: 'all',
      startDate: '',
      endDate: '',
      searchTerm: '',
      platformFilter: 'all',
    });
    showToast('필터 조건이 초기화되었습니다.');
  };

  // Announcement & Resource Handlers
  const handleAddAnnouncement = async (newAnn: Announcement) => {
    setAnnouncements((prev) => {
      const nextList = [newAnn, ...prev.filter((a) => a.id !== newAnn.id)];
      try {
        localStorage.setItem('cpa_announcements', JSON.stringify(nextList));
      } catch (e) {}
      return nextList;
    });
    showToast('새 공지사항이 성공적으로 등록되었습니다.');
    if (isSupabaseConnected) {
      const res = await saveAnnouncementToSupabase(newAnn);
      if (!res.success) {
        console.warn('Failed saving announcement to Supabase:', res.errorMsg);
      }
    }
  };

  const handleUpdateAnnouncement = async (updatedAnn: Announcement) => {
    setAnnouncements((prev) => {
      const nextList = prev.map((a) => (a.id === updatedAnn.id ? updatedAnn : a));
      try {
        localStorage.setItem('cpa_announcements', JSON.stringify(nextList));
      } catch (e) {}
      return nextList;
    });
    showToast('공지사항이 성공적으로 수정되었습니다.');
    if (isSupabaseConnected) {
      const res = await saveAnnouncementToSupabase(updatedAnn);
      if (!res.success) {
        console.warn('Failed updating announcement in Supabase:', res.errorMsg);
      }
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    setAnnouncements((prev) => {
      const nextList = prev.filter((a) => a.id !== id);
      try {
        localStorage.setItem('cpa_announcements', JSON.stringify(nextList));
      } catch (e) {}
      return nextList;
    });
    showToast('공지사항이 정상적으로 삭제되었습니다.');
    if (isSupabaseConnected) {
      const res = await deleteAnnouncementFromSupabase(id);
      if (!res.success) {
        console.warn('Failed deleting announcement in Supabase:', res.errorMsg);
      }
    }
  };

  const handleAddResource = async (newRes: ChallengeResource) => {
    if (isSupabaseConnected) {
      const res = await saveResourceToSupabase(newRes);
      if (!res.success) {
        console.error('Failed saving resource to Supabase:', res.errorMsg);
        showToast(`❌ DB 저장 실패: ${res.errorMsg || 'Supabase 권한(RLS) 및 테이블 구조를 확인하세요.'}`);
        return;
      }
    }
    setResources((prev) => {
      const nextList = [newRes, ...prev.filter((r) => r.id !== newRes.id)];
      try {
        localStorage.setItem('cpa_resources', JSON.stringify(nextList));
      } catch (e) {}
      return nextList;
    });
    showToast('새 자료가 성공적으로 등록 및 저장되었습니다.');
  };

  const handleUpdateResource = async (updatedRes: ChallengeResource) => {
    if (isSupabaseConnected) {
      const res = await saveResourceToSupabase(updatedRes);
      if (!res.success) {
        console.error('Failed updating resource in Supabase:', res.errorMsg);
        showToast(`❌ DB 수정 실패: ${res.errorMsg || 'Supabase 권한(RLS) 및 테이블 구조를 확인하세요.'}`);
        return;
      }
    }
    setResources((prev) => {
      const nextList = prev.map((r) => (r.id === updatedRes.id ? updatedRes : r));
      try {
        localStorage.setItem('cpa_resources', JSON.stringify(nextList));
      } catch (e) {}
      return nextList;
    });
    showToast('자료 정보가 성공적으로 수정 및 저장되었습니다.');
  };

  const handleDeleteResource = async (id: string) => {
    if (isSupabaseConnected) {
      const res = await deleteResourceFromSupabase(id);
      if (!res.success) {
        console.error('Failed deleting resource in Supabase:', res.errorMsg);
        showToast(`❌ DB 삭제 실패: ${res.errorMsg || 'Supabase 권한(RLS) 및 테이블 구조를 확인하세요.'}`);
        return;
      }
    }
    setResources((prev) => {
      const nextList = prev.filter((r) => r.id !== id);
      try {
        localStorage.setItem('cpa_resources', JSON.stringify(nextList));
      } catch (e) {}
      return nextList;
    });
    showToast('자료가 성공적으로 삭제되었습니다.');
  };

  // FAQ & QnA Handlers
  const handleAddFaq = async (newFaq: FAQItem) => {
    setFaqs((prev) => {
      const nextList = [newFaq, ...prev.filter((f) => f.id !== newFaq.id)];
      try {
        localStorage.setItem('cpa_faqs', JSON.stringify(nextList));
      } catch (e) {}
      return nextList;
    });
    showToast('새 FAQ 항목이 등록되었습니다.');
    if (isSupabaseConnected) {
      const res = await saveFaqToSupabase(newFaq);
      if (!res.success) {
        console.warn('Failed saving FAQ to Supabase:', res.errorMsg);
      }
    }
  };

  const handleUpdateFaq = async (updatedFaq: FAQItem) => {
    setFaqs((prev) => {
      const nextList = prev.map((f) => (f.id === updatedFaq.id ? updatedFaq : f));
      try {
        localStorage.setItem('cpa_faqs', JSON.stringify(nextList));
      } catch (e) {}
      return nextList;
    });
    showToast('FAQ 항목이 수정되었습니다.');
    if (isSupabaseConnected) {
      const res = await saveFaqToSupabase(updatedFaq);
      if (!res.success) {
        console.warn('Failed updating FAQ in Supabase:', res.errorMsg);
      }
    }
  };

  const handleDeleteFaq = async (id: string) => {
    setFaqs((prev) => {
      const nextList = prev.filter((f) => f.id !== id);
      try {
        localStorage.setItem('cpa_faqs', JSON.stringify(nextList));
      } catch (e) {}
      return nextList;
    });
    showToast('FAQ 항목이 삭제되었습니다.');
    if (isSupabaseConnected) {
      const res = await deleteFaqFromSupabase(id);
      if (!res.success) {
        console.warn('Failed deleting FAQ in Supabase:', res.errorMsg);
      }
    }
  };

  const handleReorderFaqs = async (items: { id: string; orderIndex: number }[]) => {
    setFaqs((prev) => {
      const orderMap = new Map(items.map((i) => [i.id, i.orderIndex]));
      const nextList = [...prev].map((f) => ({
        ...f,
        orderIndex: orderMap.has(f.id) ? orderMap.get(f.id)! : f.orderIndex,
      })).sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
      try {
        localStorage.setItem('cpa_faqs', JSON.stringify(nextList));
      } catch (e) {}
      return nextList;
    });
    if (isSupabaseConnected) {
      await reorderFaqsInSupabase(items);
    }
  };

  const handleAddQna = async (newQna: QnAItem) => {
    setQnaPosts((prev) => {
      const nextList = [newQna, ...prev.filter((q) => q.id !== newQna.id)];
      try {
        localStorage.setItem('cpa_qnas', JSON.stringify(nextList));
      } catch (e) {}
      return nextList;
    });

    // Trigger in-app notification for new question
    addAppNotification({
      type: 'qna_new',
      title: '💬 새 Q&A 질문이 등록되었습니다',
      message: `[${newQna.category || '질문'}] "${newQna.title}" 질문이 등록되었습니다.`,
      linkTab: 'announcements',
      linkId: newQna.id,
    });

    showToast('새 Q&A 질문이 성공적으로 등록되었습니다.');
    if (isSupabaseConnected) {
      const res = await saveQnaPostToSupabase(newQna);
      if (!res.success) {
        console.warn('Failed saving Q&A post to Supabase:', res.errorMsg);
      }
    }
  };

  const handleUpdateQna = async (updatedQna: QnAItem) => {
    setQnaPosts((prev) => {
      const nextList = prev.map((q) => (q.id === updatedQna.id ? updatedQna : q));
      try {
        localStorage.setItem('cpa_qnas', JSON.stringify(nextList));
      } catch (e) {}
      return nextList;
    });
    showToast('Q&A 질문이 수정되었습니다.');
    if (isSupabaseConnected) {
      const res = await saveQnaPostToSupabase(updatedQna);
      if (!res.success) {
        console.warn('Failed updating Q&A post in Supabase:', res.errorMsg);
      }
    }
  };

  const handleDeleteQna = async (id: string) => {
    setQnaPosts((prev) => {
      const nextList = prev.filter((q) => q.id !== id);
      try {
        localStorage.setItem('cpa_qnas', JSON.stringify(nextList));
      } catch (e) {}
      return nextList;
    });
    showToast('Q&A 게시글이 삭제되었습니다.');
    if (isSupabaseConnected) {
      const res = await deleteQnaPostFromSupabase(id);
      if (!res.success) {
        console.warn('Failed deleting Q&A post in Supabase:', res.errorMsg);
      }
    }
  };

  const handleAnswerQna = async (id: string, answerContent: string, answeredBy?: string) => {
    const nowIso = new Date().toISOString().split('T')[0];
    const targetQna = qnaPosts.find((q) => q.id === id);

    setQnaPosts((prev) => {
      const nextList = prev.map((q) =>
        q.id === id
          ? {
              ...q,
              answerContent,
              answeredAt: nowIso,
              answeredBy: answeredBy || (isAdminLoggedIn ? '운영자' : '관리자'),
              status: 'answered' as const,
            }
          : q
      );
      try {
        localStorage.setItem('cpa_qnas', JSON.stringify(nextList));
      } catch (e) {}
      return nextList;
    });

    // Trigger in-app notification for answered question
    addAppNotification({
      type: 'qna_answered',
      title: '✨ Q&A 질문에 답변이 등록되었습니다',
      message: `'${targetQna?.title || '질문'}'에 운영진 답변이 등록되었습니다: "${answerContent.length > 35 ? answerContent.substring(0, 35) + '...' : answerContent}"`,
      linkTab: 'announcements',
      linkId: id,
      userId: targetQna?.userId || 'all',
    });

    showToast('답변이 성공적으로 등록되었습니다.');
    if (isSupabaseConnected) {
      const res = await answerQnaPostInSupabase(id, answerContent, answeredBy || (isAdminLoggedIn ? '운영자' : '관리자'));
      if (!res.success) {
        console.warn('Failed answering Q&A in Supabase:', res.errorMsg);
      }
    }
  };

  // Reset data back to initial mock dataset
  const handleResetData = () => {
    try {
      localStorage.removeItem('challenge_groups');
      localStorage.removeItem('challenge_participants');
    } catch (e) {
      console.error(e);
    }
    setGroups([]);
    setParticipants([]);
    handleResetFilters();
    showToast('데이터가 초기화되었습니다.');
  };

  // Admin login success
  const handleAdminLoginSuccess = () => {
    setIsAdminLoggedIn(true);
    setIsAdminLoginModalOpen(false);
    navigateToPath("/admin");
    showToast('운영자로 성공적으로 로그인되었습니다.');
  };

  // Admin logout
  const handleAdminLogout = () => {
    setIsAdminLoggedIn(false);
    showToast('운영자 권한에서 로그아웃되었습니다.');
  };

  // Update challenge group (Admin only)
  const handleUpdateGroup = async (updatedGroup: ChallengeGroup) => {
    if (!isAdminLoggedIn) {
      showToast('관리자 권한이 필요합니다. 로그인 후 이용해주세요.');
      return;
    }

    setGroups((prev) =>
      prev.map((g) => (g.id === updatedGroup.id ? updatedGroup : g))
    );

    const client = getSupabaseClient();
    if (client) {
      try {
        const success = await updateGroupInSupabase(updatedGroup);
        if (success) {
          showToast(`챌린지 그룹 "${updatedGroup.name}" 목표 및 정보가 수정되었습니다.`);
          const freshGroups = await fetchGroupsFromSupabase();
          if (freshGroups) {
            setGroups(freshGroups);
          }
        } else {
          showToast(`챌린지 그룹 "${updatedGroup.name}" 정보 수정 중 오류가 발생했습니다.`);
        }
      } catch (err: any) {
        console.error('챌린지 그룹 수정 처리 중 예외 발생:', err);
        showToast(`수정 처리 중 예외가 발생했습니다: ${err.message || err}`);
      }
    } else {
      showToast(`챌린지 그룹 "${updatedGroup.name}" 정보 및 목표가 수정되었습니다.`);
    }
  };

  // Add new group (Admin only)
  const handleAddGroup = async (newGroup: ChallengeGroup) => {
    setGroups((prev) => [...prev, newGroup]);

    const client = getSupabaseClient();
    if (client) {
      const success = await saveGroupToSupabase(newGroup);
      if (success) {
        showToast(`[Supabase DB] 챌린지 그룹 "${newGroup.name}" 추가 완료!`);
      } else {
        showToast(`챌린지 그룹 "${newGroup.name}"이(가) 로컬에 추가되었습니다.`);
      }
    } else {
      showToast(`새 챌린지 그룹 "${newGroup.name}"이(가) 추가되었습니다.`);
    }
  };

  // Delete group (Admin only)
  const handleDeleteGroup = async (groupId: string) => {
    // 1. Check Admin Permission
    if (!isAdminLoggedIn) {
      showToast('관리자 권한이 필요합니다. 로그인 후 이용해주세요.');
      return;
    }

    const targetGroup = groups.find((g) => g.id === groupId);

    const client = getSupabaseClient();
    if (client) {
      try {
        // Direct Supabase DELETE API query
        const { error } = await client.from('challenges').delete().eq('id', groupId);

        if (error) {
          console.error('Supabase 챌린지 그룹 삭제 에러:', error);
          showToast(`챌린지 그룹 삭제 중 오류가 발생했습니다: ${error.message}`);
          return;
        }

        // Success notification
        showToast('정상적으로 삭제되었습니다.');

        // Re-fetch fresh data from Supabase to update UI state
        const freshGroups = await fetchGroupsFromSupabase();
        if (freshGroups) {
          setGroups(freshGroups);
        } else {
          setGroups((prev) => prev.filter((g) => g.id !== groupId));
        }

        if (targetGroup && filters.groupName === targetGroup.name) {
          setFilters((prev) => ({ ...prev, groupName: 'all' }));
        }
      } catch (err: any) {
        console.error('챌린지 그룹 삭제 처리 중 예외 발생:', err);
        showToast(`삭제 처리 중 예외가 발생했습니다: ${err.message || err}`);
      }
    } else {
      // Local fallback mode
      setGroups((prev) => prev.filter((g) => g.id !== groupId));
      if (targetGroup && filters.groupName === targetGroup.name) {
        setFilters((prev) => ({ ...prev, groupName: 'all' }));
      }
      showToast(`챌린지 그룹 "${targetGroup?.name || ''}"이(가) 삭제되었습니다.`);
    }
  };

  // Add new participant (Admin only)
  const handleAddParticipant = async (newParticipant: Participant) => {
    setParticipants((prev) => [newParticipant, ...prev]);

    const client = getSupabaseClient();
    if (client) {
      const success = await saveParticipantToSupabase(newParticipant);
      if (success) {
        showToast(`[Supabase DB] 참가자 "${newParticipant.participantName}" 등록 완료!`);
      } else {
        showToast(`신규 참가자 "${newParticipant.participantName}" 님이 등록되었습니다.`);
      }
    } else {
      showToast(`신규 참가자 "${newParticipant.participantName}" 님이 등록되었습니다.`);
    }
  };

  // Update participant (Admin only)
  const handleUpdateParticipant = async (updatedParticipant: Participant) => {
    // 1. Check Admin Permission
    if (!isAdminLoggedIn) {
      showToast('관리자 권한이 필요합니다. 로그인 후 이용해주세요.');
      return;
    }

    const client = getSupabaseClient();
    if (client) {
      try {
        // Direct Supabase UPDATE API query
        const { error } = await client
          .from('participants')
          .update({
            group_name: updatedParticipant.groupName,
            participant_name: updatedParticipant.participantName,
            platform_type: updatedParticipant.platformType,
            blog_id: updatedParticipant.blogId,
            daily_post_count: updatedParticipant.dailyPostCount,
            daily_visitor_count: updatedParticipant.dailyVisitorCount,
            twitter_id: updatedParticipant.twitterId,
            tweet_count: updatedParticipant.tweetCount,
            reply_count: updatedParticipant.replyCount,
            start_date: updatedParticipant.startDate,
            notes: updatedParticipant.notes || null,
          })
          .eq('id', updatedParticipant.id);

        if (error) {
          console.error('Supabase 참가자 수정 에러:', error);
          showToast(`참가자 수정 중 오류가 발생했습니다: ${error.message}`);
          return;
        }

        // Success notification
        showToast('성공적으로 수정되었습니다.');

        // Re-fetch fresh data from Supabase to update UI state
        const freshParticipants = await fetchParticipantsFromSupabase();
        if (freshParticipants) {
          setParticipants(freshParticipants);
        } else {
          setParticipants((prev) =>
            prev.map((p) => (p.id === updatedParticipant.id ? updatedParticipant : p))
          );
        }

        if (selectedParticipant && selectedParticipant.id === updatedParticipant.id) {
          setSelectedParticipant(updatedParticipant);
        }
      } catch (err: any) {
        console.error('참가자 수정 처리 중 예외 발생:', err);
        showToast(`수정 처리 중 예외가 발생했습니다: ${err.message || err}`);
      }
    } else {
      setParticipants((prev) =>
        prev.map((p) => (p.id === updatedParticipant.id ? updatedParticipant : p))
      );
      if (selectedParticipant && selectedParticipant.id === updatedParticipant.id) {
        setSelectedParticipant(updatedParticipant);
      }
      showToast(`참가자 "${updatedParticipant.participantName}" 님의 정보가 수정되었습니다.`);
    }
  };

  // Delete participant (Admin only)
  const handleDeleteParticipant = async (participantId: string) => {
    // 1. Check Admin Permission
    if (!isAdminLoggedIn) {
      showToast('관리자 권한이 필요합니다. 로그인 후 이용해주세요.');
      return;
    }

    const targetParticipant = participants.find((p) => p.id === participantId);

    const client = getSupabaseClient();
    if (client) {
      try {
        // Delete related records in daily_stats if any
        await client.from('daily_stats').delete().eq('participant_id', participantId);

        // Direct Supabase DELETE API query
        const { error } = await client.from('participants').delete().eq('id', participantId);

        if (error) {
          console.error('Supabase 참가자 삭제 에러:', error);
          showToast(`참가자 삭제 중 오류가 발생했습니다: ${error.message}`);
          return;
        }

        // Success notification
        showToast('정상적으로 삭제되었습니다.');

        // Re-fetch fresh data from Supabase to update UI state
        const freshParticipants = await fetchParticipantsFromSupabase();
        if (freshParticipants) {
          setParticipants(freshParticipants);
        } else {
          setParticipants((prev) => prev.filter((p) => p.id !== participantId));
        }

        if (selectedParticipant && selectedParticipant.id === participantId) {
          setSelectedParticipant(null);
        }
      } catch (err: any) {
        console.error('참가자 삭제 처리 중 예외 발생:', err);
        showToast(`삭제 처리 중 예외가 발생했습니다: ${err.message || err}`);
      }
    } else {
      // Local fallback mode
      setParticipants((prev) => prev.filter((p) => p.id !== participantId));
      if (selectedParticipant && selectedParticipant.id === participantId) {
        setSelectedParticipant(null);
      }
      showToast(`참가자 "${targetParticipant?.participantName || ''}" 님이 삭제되었습니다.`);
    }
  };

  // Filtered Participants Logic
  const filteredParticipants = useMemo(() => {
    return participants.filter((p) => {
      // 1. Group filter (handles multi-group array or comma-separated string)
      if (filters.groupName !== 'all') {
        const pGroupList = (p.groupNames && p.groupNames.length > 0)
          ? p.groupNames
          : p.groupName ? p.groupName.split(',').map((s) => s.trim()).filter(Boolean) : [];

        if (!pGroupList.includes(filters.groupName) && p.groupName !== filters.groupName) {
          return false;
        }
      }

      // 2. Date range filter
      if (filters.startDate && p.startDate < filters.startDate) {
        return false;
      }
      if (filters.endDate && p.startDate > filters.endDate) {
        return false;
      }

      // 3. Platform filter
      if (filters.platformFilter !== 'all' && p.platformType !== filters.platformFilter) {
        return false;
      }

      // 4. Search term (Name, Blog ID, Twitter ID)
      if (filters.searchTerm.trim()) {
        const term = filters.searchTerm.toLowerCase().trim();
        const matchName = p.participantName.toLowerCase().includes(term);
        const matchBlog = p.blogId ? p.blogId.toLowerCase().includes(term) : false;
        const matchTwitter = p.twitterId ? p.twitterId.toLowerCase().includes(term) : false;
        const matchGroup = p.groupName.toLowerCase().includes(term);

        if (!matchName && !matchBlog && !matchTwitter && !matchGroup) {
          return false;
        }
      }

      return true;
    });
  }, [participants, filters]);

  // Calculate Summary Stats based on filteredParticipants
  const summaryStats: SummaryStats = useMemo(() => {
    let totalPosts = 0;
    let totalVisitors = 0;
    let totalTweets = 0;
    let totalReplies = 0;
    let activeBloggersCount = 0;
    let activeTweetersCount = 0;
    let totalRateSum = 0;

    const selectedGroupObj = filters.groupName !== 'all' ? groups.find((g) => g.name === filters.groupName) : undefined;

    filteredParticipants.forEach((p) => {
      const hasBlog = p.platformType === 'blog' || p.platformType === 'both';
      const hasTwitter = p.platformType === 'twitter' || p.platformType === 'both';

      const pGroup = selectedGroupObj || groups.find((g) => g.name === p.groupName);
      const pPeriodStats = getParticipantPeriodStats(p, { group: pGroup, allGroups: groups });

      if (hasBlog) {
        activeBloggersCount++;
        totalPosts += pPeriodStats.blogPosts;
        totalVisitors += pPeriodStats.visitors || p.dailyVisitorCount || 0;
      }

      if (hasTwitter) {
        activeTweetersCount++;
        totalTweets += pPeriodStats.tweets;
        totalReplies += pPeriodStats.replies;
      }

      const goal = calculateParticipantGoal(p, pGroup, groups);
      totalRateSum += goal.overallRate;
    });

    const averageAchievementRate = filteredParticipants.length > 0
      ? Math.round(totalRateSum / filteredParticipants.length)
      : 0;

    return {
      totalParticipants: filteredParticipants.length,
      totalPosts,
      totalVisitors,
      totalTweets,
      totalReplies,
      activeBloggersCount,
      activeTweetersCount,
      averageAchievementRate,
    };
  }, [filteredParticipants, groups, filters.groupName]);

  // Selected Group metadata
  const selectedGroupInfo = useMemo(() => {
    if (filters.groupName === 'all') return null;
    return groups.find((g) => g.name === filters.groupName) || null;
  }, [groups, filters.groupName]);

  // Export CSV handler
  const handleExportCSV = () => {
    if (filteredParticipants.length === 0) {
      alert('다운로드할 데이터가 없습니다.');
      return;
    }
    exportToCSV(filteredParticipants, filters.groupName, groups);
    showToast('CSV 파일 다운로드가 시작되었습니다.');
  };

  // Export Excel handler
  const handleExportExcel = () => {
    if (filteredParticipants.length === 0) {
      alert('다운로드할 데이터가 없습니다.');
      return;
    }
    exportToExcel(filteredParticipants, filters.groupName, groups);
    showToast('엑셀(.xlsx) 파일 다운로드가 완료되었습니다.');
  };

  const currentCategory = selectedGroupInfo
    ? selectedGroupInfo.category
    : filters.platformFilter === 'blog'
    ? 'blog'
    : filters.platformFilter === 'twitter'
    ? 'twitter'
    : 'both';

  const [mainTab, setMainTab] = useState<'overview' | 'participants' | 'analytics'>('overview');

  const aiToolkitAccessResult = useMemo(() => {
    return checkAIToolkitAccess({
      currentUser,
      isAdmin: isAdminLoggedIn,
      groups,
      participants,
    });
  }, [currentUser, isAdminLoggedIn, groups, participants]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans flex flex-col lg:flex-row antialiased">
      
      {/* Desktop Fixed Left Sidebar */}
      <DesktopSidebar
        mainTab={appMainTab}
        onSelectMainTab={handleSelectMainTab}
        currentUser={currentUser}
        isAdminLoggedIn={isAdminLoggedIn}
        onOpenGoogleAuth={() => setIsGoogleAuthModalOpen(true)}
        onLogoutGoogle={handleLogoutGoogle}
        onOpenProfileModal={() => setIsUserProfileModalOpen(true)}
        onOpenAdminLoginModal={() => setIsAdminLoginModalOpen(true)}
        onOpenAdminManagementModal={() => navigateToPath("/admin")}
        onManualSync={handleUnifiedManualSync}
        isSyncing={isSyncing}
        lastSyncTime={lastSyncTime}
        groups={groups}
        participants={participants}
        canAccessAIToolkit={aiToolkitAccessResult.canAccess}
        navigationTabs={navigationTabs}
      />

      {/* Main Content Area (Right Column on Desktop) */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <Header
          isAdminLoggedIn={isAdminLoggedIn}
          filteredCount={filteredParticipants.length}
          totalCount={participants.length}
          mainTab={appMainTab}
          onSelectMainTab={handleSelectMainTab}
          currentUser={currentUser}
          onOpenGoogleAuth={() => setIsGoogleAuthModalOpen(true)}
          onLogoutGoogle={handleLogoutGoogle}
          onOpenProfileModal={() => setIsUserProfileModalOpen(true)}
          onOpenMenuDrawer={() => setIsMobileMenuDrawerOpen(true)}
          lastSyncTime={lastSyncTime}
          onManualSync={handleUnifiedManualSync}
          isSyncing={isSyncing}
          groups={groups}
          participants={participants}
          canAccessAIToolkit={aiToolkitAccessResult.canAccess}
          notifications={notifications}
          onMarkAsRead={handleMarkNotificationAsRead}
          onMarkAllAsRead={handleMarkAllNotificationsAsRead}
          onDeleteNotification={handleDeleteNotification}
          onClearAllNotifications={handleClearAllNotifications}
          navigationTabs={navigationTabs}
        />

        {/* Main Container */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-12 space-y-6">
          {/* Sync Progress Banner */}
          {isSyncing && (
            <div className="bg-blue-600 text-white px-5 py-3.5 rounded-2xl shadow-lg border border-blue-500/30 flex items-center justify-between gap-3 animate-pulse">
              <div className="flex items-center space-x-3">
                <RefreshCw className="w-5 h-5 animate-spin text-blue-200 shrink-0" />
                <div>
                  <p className="text-xs sm:text-sm font-extrabold tracking-tight">{syncProgressMsg || '실시간 동기화 진행 중...'}</p>
                  <p className="text-[11px] text-blue-100">1단계: 최신 데이터 수집 → 2단계: 정합성 검증 → 3단계: DB 및 화면 갱신</p>
                </div>
              </div>
              <span className="text-xs font-bold bg-white/20 px-3 py-1 rounded-full shrink-0">
                동기화 중
              </span>
            </div>
          )}

        {/* Route View 0: Specific Member Detail or Members List or Challenge Detail */}
        {routeState?.type === 'member-detail' ? (
          <MemberDetailView
            userId={routeState.userId}
            participants={participants}
            groups={groups}
            onBack={() => navigateToPath('/members')}
            onSelectChallenge={(groupId) => navigateToPath(`/challenges/${groupId}`)}
          />
        ) : routeState?.type === 'members-list' ? (
          <MembersListView
            participants={participants}
            groups={groups}
            onSelectMember={(userId) => navigateToPath(`/members/${userId}`)}
            onBackToHome={() => navigateToPath('/')}
          />
        ) : routeState?.type === 'challenge-detail' ? (
          (() => {
            const targetGroup = groups.find((g) => g.id === routeState.challengeId);
            if (!targetGroup) {
              return (
                <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center space-y-4 max-w-lg mx-auto my-12">
                  <p className="text-base font-extrabold text-slate-800">
                    요청하신 챌린지 ID (<code className="text-indigo-600">{routeState.challengeId}</code>)를 찾을 수 없습니다.
                  </p>
                  <p className="text-xs text-slate-500">
                    해당 챌린지가 삭제되었거나 잘못된 접근 주소일 수 있습니다.
                  </p>
                  <button
                    onClick={() => navigateToPath('/challenges')}
                    className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all cursor-pointer"
                  >
                    챌린지 목록으로 이동
                  </button>
                </div>
              );
            }
            return (
              <ChallengeDetailPage
                group={targetGroup}
                initialTab={routeState.tab}
                participants={participants}
                currentUser={currentUser}
                resources={resources}
                onNavigate={navigateToPath}
                onOpenApplyModal={(group) => setApplyGroup(group)}
                onJoinChallenge={handleJoinChallenge}
                onBack={() => navigateToPath('/challenges')}
              />
            );
          })()
        ) : routeState?.type === 'admin' ? (
          isAdminLoggedIn ? (
            <AdminManagementModal
              groups={groups}
              participants={participants}
              payments={payments}
              refunds={refunds}
              revenueCertifications={revenueCertifications}
              announcements={announcements}
              faqs={faqs}
              qnaPosts={qnaPosts}
              onAddGroup={handleAddGroup}
              onDeleteGroup={handleDeleteGroup}
              onUpdateGroup={handleUpdateGroup}
              onAddParticipant={handleAddParticipant}
              onDeleteParticipant={handleDeleteParticipant}
              onUpdateParticipant={handleUpdateParticipant}
              onApprovePayment={handleApprovePayment}
              onRejectPayment={handleRejectPayment}
              onSaveRefund={handleSaveRefund}
              onUpdateRefundStatus={handleUpdateRefundStatus}
              onBatchCalculateRefunds={handleBatchCalculateRefunds}
              onUpdateRevenueCertStatus={handleUpdateRevenueCertStatus}
              onDeleteRevenueCert={handleDeleteRevenueCert}
              onAddAnnouncement={handleAddAnnouncement}
              onUpdateAnnouncement={handleUpdateAnnouncement}
              onDeleteAnnouncement={handleDeleteAnnouncement}
              onAddFaq={handleAddFaq}
              onUpdateFaq={handleUpdateFaq}
              onDeleteFaq={handleDeleteFaq}
              onReorderFaqs={handleReorderFaqs}
              onAddQna={handleAddQna}
              onUpdateQna={handleUpdateQna}
              onDeleteQna={handleDeleteQna}
              onAnswerQna={handleAnswerQna}
              onDataUpdated={(newList) => {
                setParticipants(newList);
                showToast('모든 참가자의 최신 데이터가 수집되어 반영되었습니다.');
              }}
              onManualSync={handleUnifiedManualSync}
              isSyncing={isSyncing}
              syncProgressMsg={syncProgressMsg}
              navigationTabs={navigationTabs}
            />
          ) : (
            <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center max-w-lg mx-auto my-12">
              <p className="text-base font-extrabold text-slate-800">관리자 권한이 필요합니다.</p>
              <button onClick={() => navigateToPath('/')} className="mt-4 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all cursor-pointer">홈으로 돌아가기</button>
            </div>
          )
        ) : (routeState?.type === 'notices-list' || routeState?.type === 'faq-list' || routeState?.type === 'qna-list') ? (
          <AnnouncementsView
            key={`notices-list-view-${routeState.type}`}
            announcements={announcements}
            faqs={faqs}
            qnaPosts={qnaPosts}
            resources={resources}
            groups={groups}
            participants={participants}
            currentUser={currentUser}
            isAdminLoggedIn={isAdminLoggedIn}
            onAddAnnouncement={handleAddAnnouncement}
            onDeleteAnnouncement={handleDeleteAnnouncement}
            onUpdateAnnouncement={handleUpdateAnnouncement}
            onAddFaq={handleAddFaq}
            onUpdateFaq={handleUpdateFaq}
            onDeleteFaq={handleDeleteFaq}
            onReorderFaqs={handleReorderFaqs}
            onAddQna={handleAddQna}
            onUpdateQna={handleUpdateQna}
            onDeleteQna={handleDeleteQna}
            onAnswerQna={handleAnswerQna}
            onAddResource={handleAddResource}
            onDeleteResource={handleDeleteResource}
            onUpdateResource={handleUpdateResource}
            initialSubTab={routeState.type === 'faq-list' ? 'faq' : routeState.type === 'qna-list' ? 'qna' : 'notices'}
            onNavigate={navigateToPath}
          />
        ) : routeState?.type === 'notice-detail' ? (
          (() => {
            const targetNotice = announcements.find((a) => a.id === routeState.noticeId);
            if (!targetNotice) {
              return (
                <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center max-w-lg mx-auto my-12">
                  <p className="text-base font-extrabold text-slate-800">게시글을 찾을 수 없습니다.</p>
                  <button onClick={() => navigateToPath('/notices')} className="mt-4 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all cursor-pointer">공지사항으로 돌아가기</button>
                </div>
              );
            }
            return (
              <AnnouncementDetailView
                announcement={targetNotice}
                onBack={() => navigateToPath('/notices')}
              />
            );
          })()
        ) : routeState?.type === 'resources-list' ? (
          <AnnouncementsView
            key="resources-list-view"
            announcements={announcements}
            faqs={faqs}
            qnaPosts={qnaPosts}
            resources={resources}
            groups={groups}
            participants={participants}
            currentUser={currentUser}
            isAdminLoggedIn={isAdminLoggedIn}
            onAddAnnouncement={handleAddAnnouncement}
            onDeleteAnnouncement={handleDeleteAnnouncement}
            onUpdateAnnouncement={handleUpdateAnnouncement}
            onAddFaq={handleAddFaq}
            onUpdateFaq={handleUpdateFaq}
            onDeleteFaq={handleDeleteFaq}
            onReorderFaqs={handleReorderFaqs}
            onAddQna={handleAddQna}
            onUpdateQna={handleUpdateQna}
            onDeleteQna={handleDeleteQna}
            onAnswerQna={handleAnswerQna}
            onAddResource={handleAddResource}
            onDeleteResource={handleDeleteResource}
            onUpdateResource={handleUpdateResource}
            initialSubTab="resources"
            onNavigate={navigateToPath}
          />
        ) : routeState?.type === 'resource-detail' ? (
          (() => {
            const targetResource = resources.find((r) => r.id === routeState.resourceId);
            if (!targetResource) {
              return (
                <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center max-w-lg mx-auto my-12">
                  <p className="text-base font-extrabold text-slate-800">자료를 찾을 수 없습니다.</p>
                  <button onClick={() => navigateToPath('/resources')} className="mt-4 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all cursor-pointer">자료실로 돌아가기</button>
                </div>
              );
            }
            return (
              <ResourceDetailPage
                resource={targetResource}
                onBack={() => navigateToPath('/resources')}
              />
            );
          })()
        ) : (
          <>
            {/* Tab Route 1: Home Dashboard */}
            {appMainTab === 'dashboard' && (
              <HomeDashboardView
                groups={groups}
                participants={participants}
                announcements={announcements}
                resources={resources}
                currentUser={currentUser}
                isAdminLoggedIn={isAdminLoggedIn}
                visitorStats={visitorStats}
                isLoadingVisitorStats={isLoadingVisitorStats}
                onSelectGroup={(group) => navigateToPath(`/challenges/${group.id}`)}
                onJoinGroup={(group) => handleJoinChallenge(group)}
                onViewAnnouncements={() => navigateToPath('/notices')}
                onViewResources={() => navigateToPath('/resources')}
                onViewAllChallenges={() => setAppMainTab('challenges')}
                onViewMembers={() => navigateToPath('/members')}
                onOpenAnnouncementDetail={(ann) => navigateToPath("/notices/" + ann.id)}
              />
            )}

            {/* Tab Route 1.5: Members List */}
            {appMainTab === 'members' && (
              <MembersListView
                participants={participants}
                groups={groups}
                onSelectMember={(userId) => navigateToPath(`/members/${userId}`)}
                onBackToHome={() => navigateToPath('/')}
              />
            )}

            {/* Tab Route 2: Challenge Overview & Challenge Stats */}
            {appMainTab === 'challenges' && (
              <>
                {/* 2nd Row: Simplified 2-Sub-Tabs Bar */}
                <div className="bg-white p-1.5 sm:p-2.5 rounded-2xl border border-slate-200/80 shadow-2xs">
                  <div className="flex items-center justify-between gap-2">
                    
                    {/* 2 Sub Tabs: 챌린지 오버뷰 & 챌린지 통계 */}
                    <div className="grid grid-cols-2 gap-1.5 sm:gap-2.5 w-full md:w-auto">
                      <button
                        onClick={() => setMainTab('overview')}
                        className={`flex items-center justify-center gap-1.5 px-3 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-extrabold rounded-xl transition-all cursor-pointer border ${
                          mainTab === 'overview' || mainTab === 'participants'
                            ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                            : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
                        }`}
                      >
                        <LayoutDashboard className="w-4 h-4 shrink-0" />
                        <span className="truncate">챌린지 오버뷰</span>
                      </button>

                      <button
                        onClick={() => setMainTab('stats')}
                        className={`flex items-center justify-center gap-1.5 px-3 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-extrabold rounded-xl transition-all cursor-pointer border ${
                          mainTab === 'stats' || mainTab === 'analytics'
                            ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                            : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
                        }`}
                      >
                        <BarChart3 className="w-4 h-4 shrink-0" />
                        <span className="truncate">챌린지 통계</span>
                      </button>
                    </div>

                  </div>
                </div>

                {/* SubTab 1: [📌 챌린지 오버뷰] */}
                {(mainTab === 'overview' || mainTab === 'participants') && (
                  <div className="space-y-3.5 animate-in fade-in duration-150">
                    <ChallengeOverview
                      groups={groups}
                      participants={participants}
                      currentUser={currentUser}
                      onSelectGroup={(group) => navigateToPath(`/challenges/${group.id}`)}
                      onJoinChallenge={handleJoinChallenge}
                    />
                  </div>
                )}

                {/* SubTab 2: [📊 챌린지 통계] */}
                {(mainTab === 'stats' || mainTab === 'analytics') && (
                  <div className="space-y-3.5 animate-in fade-in duration-150">
                    <ChallengeStats
                      groups={groups}
                      participants={participants}
                      onSelectGroup={(group) => navigateToPath(`/challenges/${group.id}`)}
                    />
                  </div>
                )}
              </>
            )}

            {/* Tab Route 3 & 4: Announcements & Resources Unified Board */}
            {(appMainTab === 'announcements' || appMainTab === 'resources') && (
              <AnnouncementsView
                key={`main-tab-${appMainTab}`}
                announcements={announcements}
                faqs={faqs}
                qnaPosts={qnaPosts}
                resources={resources}
                groups={groups}
                participants={participants}
                currentUser={currentUser}
                isAdminLoggedIn={isAdminLoggedIn}
                onAddAnnouncement={handleAddAnnouncement}
                onUpdateAnnouncement={handleUpdateAnnouncement}
                onDeleteAnnouncement={handleDeleteAnnouncement}
                onAddFaq={handleAddFaq}
                onUpdateFaq={handleUpdateFaq}
                onDeleteFaq={handleDeleteFaq}
                onReorderFaqs={handleReorderFaqs}
                onAddQna={handleAddQna}
                onUpdateQna={handleUpdateQna}
                onDeleteQna={handleDeleteQna}
                onAnswerQna={handleAnswerQna}
                onAddResource={handleAddResource}
                onUpdateResource={handleUpdateResource}
                onDeleteResource={handleDeleteResource}
                initialSubTab={appMainTab === 'resources' ? 'resources' : 'announcements'}
                onNavigate={navigateToPath}
              />
            )}

            {/* Tab Route 5: AI Toolkit */}
            {appMainTab === 'toolkit' && (
              aiToolkitAccessResult.canAccess ? (
                <div className="space-y-4">
                  {/* AI Toolkit Top Sub-Navigation Bar */}
                  <div className="max-w-7xl mx-auto px-4 pt-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200/90 rounded-2xl p-2 sm:p-2.5 shadow-xs">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <button
                          type="button"
                          onClick={() => setToolkitSubTab('draft')}
                          className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer ${
                            toolkitSubTab === 'draft' || toolkitSubTab === 'keyword'
                              ? 'bg-indigo-600 text-white shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                          }`}
                        >
                          <Sparkles className="w-4 h-4" />
                          <span>AI 블로그 초안 생성기</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setToolkitSubTab('image')}
                          className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer ${
                            toolkitSubTab === 'image'
                              ? 'bg-purple-600 text-white shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                          }`}
                        >
                          <Palette className="w-4 h-4" />
                          <span>콘텐츠 비주얼 (이미지 & 카드뉴스)</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                            toolkitSubTab === 'image' ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-800'
                          }`}>
                            신규
                          </span>
                        </button>
                      </div>

                      <div className="hidden md:flex items-center gap-2 text-[11px] text-slate-500 font-medium pr-2">
                        <span>💡 본문 초안 작성 후 비주얼 스튜디오에서 이미지와 카드뉴스를 제작하세요.</span>
                      </div>
                    </div>
                  </div>

                  {/* Render Tab Content */}
                  {toolkitSubTab === 'image' ? (
                    <ContentVisualTab
                      currentUser={currentUser}
                      isAdminLoggedIn={isAdminLoggedIn}
                      onShowToast={showToast}
                      onShowLoginModal={() => setIsGoogleAuthModalOpen(true)}
                    />
                  ) : (
                    <AiToolkitTab
                      currentUser={currentUser}
                      isAdminLoggedIn={isAdminLoggedIn}
                      onShowLoginModal={() => setIsGoogleAuthModalOpen(true)}
                      onShowToast={showToast}
                      activeSubTab={toolkitSubTab}
                      onSelectSubTab={setToolkitSubTab}
                      initialKeyword={draftTargetKeyword}
                      onClearInitialKeyword={() => setDraftTargetKeyword('')}
                    />
                  )}
                </div>
              ) : (
                <AIToolkitAccessRestricted
                  accessResult={aiToolkitAccessResult}
                  onOpenGoogleAuth={() => setIsGoogleAuthModalOpen(true)}
                  onViewChallenges={() => handleSelectMainTab('challenges')}
                  onViewSubscription={() => setAppMainTab('subscription')}
                />
              )
            )}

            {/* Tab Route 6: Trend Keywords / Recommended Posting Topics */}
            {appMainTab === 'trends' && (
              <TrendKeywordsView
                currentUser={currentUser}
                isAdminLoggedIn={isAdminLoggedIn}
                onOpenGoogleAuth={() => setIsGoogleAuthModalOpen(true)}
                onSelectKeywordForDraft={handleSelectKeywordForDraft}
                onShowToast={showToast}
              />
            )}

            {/* Tab Route 7: Revenue Certification (수익 인증 명예의 전당) */}
            {appMainTab === 'revenue' && (
              <RevenueCertificationView
                certifications={revenueCertifications}
                currentUser={currentUser}
                isAdmin={isAdminLoggedIn}
                onSubmitNew={handleSubmitRevenueCert}
                onToggleLike={handleToggleLikeRevenueCert}
                onUpdateStatus={handleUpdateRevenueCertStatus}
                onDelete={handleDeleteRevenueCert}
                onRequireLogin={() => setIsGoogleAuthModalOpen(true)}
              />
            )}

            {/* Tab Route 8: Site Subscription (사이트 구독 & 멤버십) */}
            {appMainTab === 'subscription' && (
              <SiteSubscriptionView
                currentUser={currentUser}
                onRequireLogin={() => setIsGoogleAuthModalOpen(true)}
                onShowToast={showToast}
              />
            )}
          </>
        )}

      </main>

      {/* Google Auth Modal */}
      <GoogleAuthModal
        isOpen={isGoogleAuthModalOpen}
        onClose={() => setIsGoogleAuthModalOpen(false)}
        onLoginSuccess={handleGoogleLoginSuccess}
      />

      {/* Profile Required Modal for Join Challenge */}
      <ProfileRequiredModal
        isOpen={profileRequiredState.isOpen}
        onClose={() => setProfileRequiredState((prev) => ({ ...prev, isOpen: false }))}
        onOpenProfileModal={() => setIsUserProfileModalOpen(true)}
        requiredType={profileRequiredState.requiredType}
        challengeName={profileRequiredState.challengeName}
      />

      {/* User Profile & Challenge Management Modal */}
      <UserProfileModal
        isOpen={isUserProfileModalOpen}
        onClose={() => setIsUserProfileModalOpen(false)}
        currentUser={currentUser}
        groups={groups}
        participants={participants}
        revenueCertifications={revenueCertifications}
        onUpdateProfile={handleUpdateProfile}
        onJoinChallenge={handleJoinChallenge}
        onLeaveChallenge={handleLeaveChallenge}
        onShowToast={showToast}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center space-x-2 text-xs font-semibold animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Badge Notification Toast */}
      <BadgeNotificationToast
        newBadges={newEarnedBadges}
        onDismiss={(badgeId) => setNewEarnedBadges((prev) => prev.filter((b) => b.badgeId !== badgeId))}
        onOpenCollection={() => setIsUserProfileModalOpen(true)}
      />

      {/* Detail Modal */}
      <ParticipantDetailModal
        participant={selectedParticipant}
        onClose={() => setSelectedParticipant(null)}
        isAdminLoggedIn={isAdminLoggedIn}
        onDeleteParticipant={handleDeleteParticipant}
        onUpdateParticipant={handleUpdateParticipant}
        groups={groups}
      />

      {/* Admin Login Modal */}
      <AdminLoginModal
        isOpen={isAdminLoginModalOpen}
        onClose={() => setIsAdminLoginModalOpen(false)}
        onLoginSuccess={handleAdminLoginSuccess}
      />

      {/* Supabase Guide & Configuration Modal */}
      <SupabaseModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
        onConfigUpdated={loadSupabaseData}
      />

      {/* RSS Auto Collector & Vercel Cron Modal */}
      <RssCollectorModal
        isOpen={isRssCollectorModalOpen}
        onClose={() => setIsRssCollectorModalOpen(false)}
        participants={participants}
        onDataUpdated={(newList) => {
          setParticipants(newList);
          showToast('모든 참가자의 최신 RSS 데이터가 업데이트되었습니다.');
        }}
      />

      {/* Stage 1: Challenge Detail Modal */}
      {selectedDetailGroup && (
        <ChallengeDetailModal
          group={selectedDetailGroup}
          onClose={() => setSelectedDetailGroup(null)}
          participants={participants}
          resources={resources}
          currentUser={currentUser}
          onJoinChallenge={handleJoinChallenge}
          onLeaveChallenge={handleLeaveChallenge}
        />
      )}

      {/* Stage 1: Apply Challenge Modal */}
      {applyGroup && (
        <ApplyChallengeModal
          group={applyGroup}
          currentUser={currentUser}
          userPayments={payments}
          onClose={() => setApplyGroup(null)}
          onJoinChallenge={handleJoinChallenge}
          onSubmitPayment={handleSubmitPayment}
          onOpenGoogleAuth={() => setIsGoogleAuthModalOpen(true)}
          onOpenProfileModal={() => setIsUserProfileModalOpen(true)}
        />
      )}

      {/* Stage 1: Announcement Detail Modal from Home Dashboard */}

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-12 py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-700">챌린지 모니터링 대시보드</span>
            <span>•</span>
            <span>네이버 블로그 & 트위터 자동 집계</span>
          </div>
          <div className="flex items-center space-x-3 text-slate-400">
            <p className="text-center sm:text-right">
              실시간 포스팅 모니터링
            </p>
            <span>•</span>
            {isAdminLoggedIn ? (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => navigateToPath("/admin")}
                  className="inline-flex items-center space-x-1 text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
                  title="참가자 및 챌린지 관리"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span className="font-semibold text-[11px]">관리자 메뉴</span>
                </button>
                <span>•</span>
                <button
                  onClick={handleAdminLogout}
                  className="text-slate-400 hover:text-slate-600 text-[11px] cursor-pointer"
                  title="로그아웃"
                >
                  로그아웃
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsAdminLoginModalOpen(true)}
                className="inline-flex items-center space-x-1 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer opacity-70 hover:opacity-100"
                title="운영자 로그인"
              >
                <Settings className="w-3.5 h-3.5" />
                <span className="text-[11px]">운영자</span>
              </button>
            )}
          </div>
        </div>
      </footer>
      </div>

      {/* Mobile Bottom Navigation Bar (2030 App-like UX) */}
      <BottomNav
        mainTab={appMainTab}
        onSelectMainTab={setAppMainTab}
        currentUser={currentUser}
        onOpenGoogleAuth={() => setIsGoogleAuthModalOpen(true)}
        onOpenProfileModal={() => setIsUserProfileModalOpen(true)}
        onOpenMenuDrawer={() => setIsMobileMenuDrawerOpen(true)}
        onScrollToTop={handleScrollToTop}
        onScrollToChallenges={handleScrollToChallenges}
        navigationTabs={navigationTabs}
      />

      {/* Mobile All Menu Drawer Sheet */}
      <MobileMenuDrawer
        isOpen={isMobileMenuDrawerOpen}
        onClose={() => setIsMobileMenuDrawerOpen(false)}
        mainTab={appMainTab}
        onSelectMainTab={setAppMainTab}
        dashboardSubTab={mainTab}
        onSelectDashboardSubTab={setMainTab}
        toolkitSubTab={toolkitSubTab}
        onSelectToolkitSubTab={setToolkitSubTab}
        currentUser={currentUser}
        isAdminLoggedIn={isAdminLoggedIn}
        onOpenGoogleAuth={() => setIsGoogleAuthModalOpen(true)}
        onLogoutGoogle={handleLogoutGoogle}
        onOpenProfileModal={() => setIsUserProfileModalOpen(true)}
        onOpenAdminLoginModal={() => setIsAdminLoginModalOpen(true)}
        onOpenAdminManagementModal={() => navigateToPath("/admin")}
        onManualSync={handleUnifiedManualSync}
        isSyncing={isSyncing}
        lastSyncTime={lastSyncTime}
        groups={groups}
        participants={participants}
        canAccessAIToolkit={aiToolkitAccessResult.canAccess}
        navigationTabs={navigationTabs}
      />

    </div>
  );
}

