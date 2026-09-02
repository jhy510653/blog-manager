import React, { useState, useEffect } from 'react';
import {
  Participant,
  PlatformType,
  ChallengeGroup,
  MissionDay,
  GoalUnit,
  ChallengePayment,
  PaymentStatus,
  ChallengeRefund,
  RefundStatus,
  AdminDecision,
  PostReviewItem,
  RevenueCertification,
  RevenueCertificationStatus,
  Announcement,
  FAQItem,
  QnAItem,
} from '../types';
import { ALL_MISSION_DAYS } from '../utils/goalCalculator';
import { runBatchDataCollector, verifyAndSyncParticipantData, syncBulkToSupabase } from '../services/rssCollector';
import { extractNaverBlogId } from '../utils/blogUtils';
import { exportRefundsToCsv, calculateBatchRefundSnapshots } from '../utils/refundCalculator';
import { AdminBadgeManagementTab } from './badges/AdminBadgeManagementTab';
import { DEFAULT_TREND_CATEGORIES, TrendCategoryItem } from '../config/categories';
import {
  X,
  Settings,
  PlusCircle,
  FolderPlus,
  Users,
  Trash2,
  BookOpen,
  Twitter,
  Sparkles,
  Search,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Zap,
  Edit3,
  KeyRound,
  Lock,
  Target,
  Calendar,
  Clock,
  Coins,
  Info,
  Layers,
  CreditCard,
  Building,
  UserCheck,
  UserX,
  Check,
  AlertCircle,
  FileText,
  FileCheck,
  DollarSign,
  Download,
  Eye,
  ShieldCheck,
  CheckSquare,
  XCircle,
  Award,
  Maximize2,
  Trophy,
  TrendingUp,
  LayoutList,
  Sliders,
  RotateCcw,
  Save,
  Monitor,
  Smartphone,
  Megaphone,
  ExternalLink,
} from 'lucide-react';
import { NavigationTabItem, DEFAULT_NAVIGATION_TABS, getStoredNavigationTabs, saveStoredNavigationTabs } from '../config/navigation';
import { saveNavigationTabsToSupabase } from '../lib/supabase';
import { MainTabType } from './Header';
import { AdminNavigationTab } from './admin/AdminNavigationTab';
import { AdminMembershipManagementTab } from './admin/AdminMembershipManagementTab';
import { AdminBoardManagementTab } from './admin/AdminBoardManagementTab';

interface AdminManagementModalProps {
  groups: ChallengeGroup[];
  participants: Participant[];
  payments?: ChallengePayment[];
  refunds?: ChallengeRefund[];
  revenueCertifications?: RevenueCertification[];
  announcements?: Announcement[];
  faqs?: FAQItem[];
  qnaPosts?: QnAItem[];
  onAddGroup: (newGroup: ChallengeGroup) => void;
  onDeleteGroup: (groupId: string) => void;
  onUpdateGroup?: (updatedGroup: ChallengeGroup) => void;
  onAddParticipant: (newParticipant: Participant) => void;
  onDeleteParticipant: (participantId: string) => void;
  onUpdateParticipant?: (updatedParticipant: Participant) => void;
  onApprovePayment?: (paymentId: string) => void;
  onRejectPayment?: (paymentId: string, reason: string) => void;
  onSaveRefund?: (refund: ChallengeRefund) => void;
  onUpdateRefundStatus?: (refundId: string, status: RefundStatus, adminDecision?: AdminDecision, reason?: string, operatorName?: string, memo?: string) => void;
  onBatchCalculateRefunds?: (challengeId: string) => void;
  onUpdateRevenueCertStatus?: (
    id: string,
    status: RevenueCertificationStatus,
    options?: { rejectionReason?: string; isFeatured?: boolean; revenueAmount?: number }
  ) => void;
  onDeleteRevenueCert?: (id: string) => void;
  onAddAnnouncement?: (announcement: Announcement) => void;
  onUpdateAnnouncement?: (announcement: Announcement) => void;
  onDeleteAnnouncement?: (id: string) => void;
  onAddFaq?: (faq: FAQItem) => void;
  onUpdateFaq?: (faq: FAQItem) => void;
  onDeleteFaq?: (id: string) => void;
  onReorderFaqs?: (items: { id: string; orderIndex: number }[]) => void;
  onAddQna?: (qna: QnAItem) => void;
  onUpdateQna?: (qna: QnAItem) => void;
  onDeleteQna?: (id: string) => void;
  onAnswerQna?: (id: string, answerContent: string, answeredBy?: string) => void;
  onDataUpdated?: (updatedList: Participant[]) => void;
  onManualSync?: () => Promise<void>;
  isSyncing?: boolean;
  syncProgressMsg?: string;
  navigationTabs?: Record<MainTabType, NavigationTabItem>;
  onUpdateNavigationTabs?: (updatedTabs: Record<MainTabType, NavigationTabItem>) => void;
}

export const AdminManagementModal: React.FC<AdminManagementModalProps> = ({
  groups,
  participants,
  payments = [],
  refunds = [],
  revenueCertifications = [],
  announcements = [],
  faqs = [],
  qnaPosts = [],
  onAddGroup,
  onDeleteGroup,
  onUpdateGroup,
  onAddParticipant,
  onDeleteParticipant,
  onUpdateParticipant,
  onApprovePayment,
  onRejectPayment,
  onSaveRefund,
  onUpdateRefundStatus,
  onBatchCalculateRefunds,
  onUpdateRevenueCertStatus,
  onDeleteRevenueCert,
  onAddAnnouncement,
  onUpdateAnnouncement,
  onDeleteAnnouncement,
  onAddFaq,
  onUpdateFaq,
  onDeleteFaq,
  onReorderFaqs,
  onAddQna,
  onUpdateQna,
  onDeleteQna,
  onAnswerQna,
  onDataUpdated,
  onManualSync,
  isSyncing = false,
  syncProgressMsg = '',
  navigationTabs,
  onUpdateNavigationTabs,
}) => {
  const [activeTab, setActiveTab] = useState<
    'participantAdd' | 'groupManage' | 'participantList' | 'paymentsManage' | 'refundsManage' | 'revenueManage' | 'badgeManage' | 'membershipManage' | 'boardManage' | 'trendManage' | 'navManage' | 'passwordChange'
  >('participantAdd');

  // Trend Keywords Instant Collection States
  const [isCollectingTrends, setIsCollectingTrends] = useState<boolean>(false);
  const [trendCollectResult, setTrendCollectResult] = useState<{
    count: number;
    savedCount: number;
    dailySavedCount: number;
    realApiCount?: number;
    fallbackCount?: number;
    timestamp: string;
    categoryStats: Record<string, { collected: number; saved: number; goldenRate?: string; realApiCount?: number; fallbackCount?: number }>;
  } | null>(null);

  // Keyword Raw Debug States
  const [debugKeywordInput, setDebugKeywordInput] = useState<string>('강릉가볼만한곳');
  const [isDebuggingKeyword, setIsDebuggingKeyword] = useState<boolean>(false);
  const [debugResult, setDebugResult] = useState<any | null>(null);

  // Blog Search Raw Debug States
  const [debugBlogKeywordInput, setDebugBlogKeywordInput] = useState<string>('테스트');
  const [debugCustomClientId, setDebugCustomClientId] = useState<string>('');
  const [debugCustomClientSecret, setDebugCustomClientSecret] = useState<string>('');
  const [showCustomKeyInputs, setShowCustomKeyInputs] = useState<boolean>(false);
  const [isDebuggingBlog, setIsDebuggingBlog] = useState<boolean>(false);
  const [debugBlogResult, setDebugBlogResult] = useState<any | null>(null);
  const [selectedBlogAttemptId, setSelectedBlogAttemptId] = useState<string | null>(null);

  // DataLab Search Trend Raw Debug States
  const [debugTrendKeywordInput, setDebugTrendKeywordInput] = useState<string>('테스트');
  const [isDebuggingTrend, setIsDebuggingTrend] = useState<boolean>(false);
  const [debugTrendResult, setDebugTrendResult] = useState<any | null>(null);
  const [selectedTrendAttemptId, setSelectedTrendAttemptId] = useState<string | null>(null);
  const [copiedTraceId, setCopiedTraceId] = useState<string | null>(null);

  // Naver Realtime Keyword Filter Policy & Test States
  const [filterPolicy, setFilterPolicy] = useState<{
    minKeywordLength: number;
    hideLowUsabilityKeywords: boolean;
    manualExcludedKeywords: string[];
    exclusionPatterns: string[];
  }>({
    minKeywordLength: 2,
    hideLowUsabilityKeywords: true,
    manualExcludedKeywords: [],
    exclusionPatterns: [],
  });
  const [isLoadingFilterPolicy, setIsLoadingFilterPolicy] = useState<boolean>(false);
  const [isSavingFilterPolicy, setIsSavingFilterPolicy] = useState<boolean>(false);
  const [newExcludedKeywordInput, setNewExcludedKeywordInput] = useState<string>('');
  const [exclusionPatternsTextInput, setExclusionPatternsTextInput] = useState<string>('');

  // Naver Realtime Collection Test States
  const [testCollectionResult, setTestCollectionResult] = useState<any | null>(null);
  const [isTestingCollection, setIsTestingCollection] = useState<boolean>(false);

  // Naver 4-API Health Monitoring States
  const [apiHealthData, setApiHealthData] = useState<any | null>(null);
  const [isLoadingApiHealth, setIsLoadingApiHealth] = useState<boolean>(false);

  // Revenue Certification management states
  const [revenueStatusFilter, setRevenueStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [revenueSearchTerm, setRevenueSearchTerm] = useState('');
  const [inspectingRevenueCert, setInspectingRevenueCert] = useState<RevenueCertification | null>(null);
  const [rejectingRevenueCertId, setRejectingRevenueCertId] = useState<string | null>(null);
  const [revenueRejectionReasonInput, setRevenueRejectionReasonInput] = useState('');

  // Payment management states
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'all' | 'submitted' | 'approved' | 'rejected'>('submitted');
  const [paymentSearchTerm, setPaymentSearchTerm] = useState('');
  const [rejectingPaymentId, setRejectingPaymentId] = useState<string | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');

  // Refund management states
  const [refundGroupFilter, setRefundGroupFilter] = useState<string>('all');
  const [refundStatusFilter, setRefundStatusFilter] = useState<string>('all');
  const [refundSearchTerm, setRefundSearchTerm] = useState<string>('');

  // Refund Action Modals
  const [inspectingRefund, setInspectingRefund] = useState<ChallengeRefund | null>(null);
  const [approvingRefund, setApprovingRefund] = useState<ChallengeRefund | null>(null);
  const [approvalMemoInput, setApprovalMemoInput] = useState<string>('');
  const [rejectingRefund, setRejectingRefund] = useState<ChallengeRefund | null>(null);
  const [refundRejectionReasonInput, setRefundRejectionReasonInput] = useState<string>('');
  const [completingRefund, setCompletingRefund] = useState<ChallengeRefund | null>(null);
  const [operatorNameInput, setOperatorNameInput] = useState<string>('운영진');
  const [completionMemoInput, setCompletionMemoInput] = useState<string>('');

  // Password change states
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');

  // Edit participant state
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);

  // Edit group state
  const [editingGroup, setEditingGroup] = useState<ChallengeGroup | null>(null);

  // Instant collector state
  const [isCollecting, setIsCollecting] = useState<boolean>(false);
  const [collectorStatus, setCollectorStatus] = useState<string>('');

  // Group creation states
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupCategory, setNewGroupCategory] = useState<'blog' | 'twitter' | 'both'>('both');
  const [newGroupRecruitingStartDate, setNewGroupRecruitingStartDate] = useState('2026-07-20');
  const [newGroupRecruitingEndDate, setNewGroupRecruitingEndDate] = useState('2026-07-31');
  const [newGroupStartDate, setNewGroupStartDate] = useState('2026-08-01');
  const [newGroupEndDate, setNewGroupEndDate] = useState('2026-08-31');
  const [newGroupMissionDays, setNewGroupMissionDays] = useState<MissionDay[]>([
    'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun',
  ]);
  const [newGroupGoalUnit, setNewGroupGoalUnit] = useState<GoalUnit>('daily');
  const [newGroupTargetBlogPostCount, setNewGroupTargetBlogPostCount] = useState<number>(1);
  const [newGroupTargetTweetCount, setNewGroupTargetTweetCount] = useState<number>(1);
  const [newGroupTargetReplyCount, setNewGroupTargetReplyCount] = useState<number>(3);
  const [newGroupFee, setNewGroupFee] = useState<number>(0);
  const [newGroupRefundFee, setNewGroupRefundFee] = useState<number>(0);

  // New Group Refund Configuration
  const [newGroupRefundEnabled, setNewGroupRefundEnabled] = useState<boolean>(true);
  const [newGroupRefundType, setNewGroupRefundType] = useState<'full' | 'fixed'>('full');
  const [newGroupRefundAmount, setNewGroupRefundAmount] = useState<number>(0);
  const [newGroupRefundThreshold, setNewGroupRefundThreshold] = useState<number>(80);
  const [newGroupRefundFormUrl, setNewGroupRefundFormUrl] = useState<string>('');

  // New Group Deposit Bank Info Configuration
  const [newGroupBankName, setNewGroupBankName] = useState<string>('국민은행');
  const [newGroupAccountNumber, setNewGroupAccountNumber] = useState<string>('');
  const [newGroupAccountHolder, setNewGroupAccountHolder] = useState<string>('참새(운영진)');
  const [newGroupDepositDeadline, setNewGroupDepositDeadline] = useState<string>('모집 마감일 23:59까지');
  const [newGroupDepositNotice, setNewGroupDepositNotice] = useState<string>(
    '입금자명은 반드시 신청자 본인 이름과 동일하게 입력해주세요. 타인 명의 입금 시 입금 확인이 지연될 수 있습니다.'
  );

  // Participant creation states
  const [selectedAddGroupNames, setSelectedAddGroupNames] = useState<string[]>([groups[0]?.name || '1기 블로그 챌린지']);
  const [participantName, setParticipantName] = useState<string>('');
  const [platformType, setPlatformType] = useState<PlatformType>('both');
  const [blogId, setBlogId] = useState<string>('');
  const [twitterId, setTwitterId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Participant search state
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Form validation/notification messages state
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Navigation tab management states
  const [navTabsConfig, setNavTabsConfig] = useState<Record<MainTabType, NavigationTabItem>>(() => {
    return navigationTabs || getStoredNavigationTabs();
  });
  const [isSavingNavTabs, setIsSavingNavTabs] = useState<boolean>(false);
  const [navSaveFeedback, setNavSaveFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Sync when props change or modal opens
  useEffect(() => {
    if (navigationTabs) {
      setNavTabsConfig(navigationTabs);
    }
  }, [navigationTabs]);

  const handleNavTabFieldChange = (tabId: MainTabType, field: keyof NavigationTabItem, value: string) => {
    setNavTabsConfig((prev) => ({
      ...prev,
      [tabId]: {
        ...prev[tabId],
        [field]: value,
      },
    }));
    setNavSaveFeedback(null);
  };

  const handleResetNavTabs = () => {
    if (window.confirm('모든 메뉴 탭 이름을 시스템 기본값으로 초기화하시겠습니까?')) {
      setNavTabsConfig({ ...DEFAULT_NAVIGATION_TABS });
      setNavSaveFeedback({
        type: 'success',
        message: '기본값으로 초기화되었습니다. [설정 저장] 버튼을 누르면 완전히 반영됩니다.',
      });
    }
  };

  const handleSaveNavTabs = async () => {
    setIsSavingNavTabs(true);
    setNavSaveFeedback(null);
    try {
      const result = await saveNavigationTabsToSupabase(navTabsConfig);
      if (onUpdateNavigationTabs) {
        onUpdateNavigationTabs(navTabsConfig);
      }
      if (result.error) {
        setNavSaveFeedback({
          type: 'success',
          message: `설정이 저장되었습니다. (Supabase: ${result.error})`,
        });
      } else {
        setNavSaveFeedback({
          type: 'success',
          message: '메뉴 탭 이름 설정이 성공적으로 저장 및 전역 반영되었습니다!',
        });
      }
    } catch (err: any) {
      setNavSaveFeedback({
        type: 'error',
        message: err.message || '저장 중 오류가 발생했습니다.',
      });
    } finally {
      setIsSavingNavTabs(false);
    }
  };

  // Trend Categories & Seeds Management States
  const [adminCategories, setAdminCategories] = useState<TrendCategoryItem[]>(DEFAULT_TREND_CATEGORIES);
  const [isLoadingCategories, setIsLoadingCategories] = useState<boolean>(false);
  const [editingCategory, setEditingCategory] = useState<TrendCategoryItem | null>(null);
  const [editingSeedsText, setEditingSeedsText] = useState<string>('');
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [newCategorySeeds, setNewCategorySeeds] = useState<string>('');

  // Handle Add Group
  const handleCreateGroupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!newGroupName.trim()) {
      setFormError('챌린지 그룹 이름을 입력해 주세요.');
      return;
    }

    if (newGroupRefundFormUrl.trim()) {
      const url = newGroupRefundFormUrl.trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        setFormError('환급 신청폼 URL은 http:// 또는 https:// 로 시작하는 올바른 링크 주소여야 합니다.');
        return;
      }
    }

    const createdGroup: ChallengeGroup = {
      id: `g_${Date.now()}`,
      name: newGroupName.trim(),
      description: newGroupDesc.trim() || '운영자 생성 챌린지 그룹',
      category: newGroupCategory,
      recruitingStartDate: newGroupRecruitingStartDate,
      recruitingEndDate: newGroupRecruitingEndDate,
      startDate: newGroupStartDate,
      endDate: newGroupEndDate,
      missionDays: newGroupMissionDays,
      goalUnit: newGroupGoalUnit,
      targetBlogPostCount: newGroupTargetBlogPostCount,
      targetTweetCount: newGroupTargetTweetCount,
      targetReplyCount: newGroupTargetReplyCount,
      fee: newGroupFee,
      refundFee: newGroupRefundFee,
      refundEnabled: newGroupRefundEnabled,
      refundType: newGroupRefundType,
      refundAmount: newGroupRefundAmount,
      refundThreshold: newGroupRefundThreshold,
      refundFormUrl: newGroupRefundFormUrl.trim() || undefined,
      bankName: newGroupBankName.trim() || '국민은행',
      accountNumber: newGroupAccountNumber.trim() || '123456-78-123456',
      accountHolder: newGroupAccountHolder.trim() || '참새(운영진)',
      bankAccount: `${newGroupBankName.trim() || '국민은행'} ${newGroupAccountNumber.trim() || '123456-78-123456'}`,
      bankOwner: newGroupAccountHolder.trim() || '참새(운영진)',
      depositDeadline: newGroupDepositDeadline.trim() || '모집 마감일 23:59까지',
      depositNotice: newGroupDepositNotice.trim() || '입금자명은 반드시 본인 이름과 동일하게 입력해주세요.',
    };

    onAddGroup(createdGroup);
    setNewGroupName('');
    setNewGroupDesc('');
    setNewGroupRefundFormUrl('');
    setFormSuccess(`챌린지 그룹 "${createdGroup.name}"이(가) 추가 요청되었습니다.`);
  };

  // Handle Add Participant
  const handleCreateParticipantSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!participantName.trim()) {
      setFormError('참가자 이름을 입력해 주세요.');
      return;
    }

    if ((platformType === 'blog' || platformType === 'both') && !blogId.trim()) {
      setFormError('네이버 블로그 ID를 입력해 주세요.');
      return;
    }

    if ((platformType === 'twitter' || platformType === 'both') && !twitterId.trim()) {
      setFormError('트위터 ID를 입력해 주세요.');
      return;
    }

    const formattedTwitterId = twitterId.trim()
      ? twitterId.trim().startsWith('@')
        ? twitterId.trim()
        : `@${twitterId.trim()}`
      : null;

    const finalAddGroups = selectedAddGroupNames.length > 0
      ? selectedAddGroupNames
      : [groups[0]?.name || '챌린지'];

    const cleanBlogId = platformType === 'twitter' ? null : extractNaverBlogId(blogId) || null;

    const newParticipant: Participant = {
      id: `p_${Date.now()}`,
      groupName: finalAddGroups.join(', '),
      groupNames: finalAddGroups,
      participantName: participantName.trim(),
      platformType,
      blogId: cleanBlogId,
      dailyPostCount: 0,
      dailyVisitorCount: 0,
      twitterId: platformType === 'blog' ? null : formattedTwitterId,
      tweetCount: 0,
      replyCount: 0,
      startDate: new Date().toISOString().split('T')[0],
      notes: notes.trim() || undefined,
    };

    onAddParticipant(newParticipant);

    // Reset fields
    setParticipantName('');
    setBlogId('');
    setTwitterId('');
    setNotes('');
    setFormSuccess(`참가자 "${newParticipant.participantName}" 님이 정상 등록 처리되었습니다.`);
  };

  const filteredParticipantList = participants.filter((p) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      p.participantName.toLowerCase().includes(term) ||
      p.groupName.toLowerCase().includes(term) ||
      (p.blogId && p.blogId.toLowerCase().includes(term)) ||
      (p.twitterId && p.twitterId.toLowerCase().includes(term))
    );
  });

  // Unified Manual Refresh & Sync Handler (3-Step Execution: Collect -> Audit -> DB Sync)
  const handleUnifiedSync = async () => {
    setFormError(null);
    setFormSuccess(null);

    if (onManualSync) {
      try {
        await onManualSync();
        setFormSuccess('🎉 [수동 새로고침/동기화 완료] 데이터 수집, 정합성 검증 및 DB 반영이 모두 완료되었습니다.');
      } catch (err: any) {
        setFormError(`수동 동기화 중 오류가 발생했습니다: ${err.message || '알 수 없는 오류'}`);
      }
      return;
    }

    if (participants.length === 0) {
      setFormError('동기화할 참가자 데이터가 없습니다.');
      return;
    }

    setIsCollecting(true);
    try {
      // 1단계: 수집
      setCollectorStatus('1/3단계: 모든 계정의 최신 블로그 RSS 및 트위터 데이터 수집 중...');
      const { updatedParticipants, uniqueBlogPosts } = await runBatchDataCollector(
        participants,
        (current, total, name) => {
          setCollectorStatus(`1/3단계 수집 진행 중 (${current}/${total}): ${name}`);
        }
      );

      // 2단계: 정합성 검사
      setCollectorStatus('2/3단계: 데이터 정합성 검사 및 통계 검증 진행 중...');
      const { verifiedParticipants } = await verifyAndSyncParticipantData(
        updatedParticipants.length > 0 ? updatedParticipants : participants,
        (current, total, name) => {
          setCollectorStatus(`2/3단계 정합성 검사 중 (${current}/${total}): ${name}`);
        }
      );

      // 3단계: 상태 갱신
      setCollectorStatus('3/3단계: 검증된 데이터 DB 일괄 저장 중...');
      await syncBulkToSupabase(verifiedParticipants, uniqueBlogPosts || [], (current, total, name) => {
        setCollectorStatus(`3/3단계 DB 저장 중 (${current}/${total}): ${name}`);
      });
      if (onDataUpdated) {
        onDataUpdated(verifiedParticipants);
      }

      setFormSuccess(
        `🎉 [수동 새로고침/동기화 완료] 데이터 수집, 정합성 검증 및 DB/상태 동기화 완료! (총 ${verifiedParticipants.length}명 반영)`
      );
    } catch (err: any) {
      console.error('Unified manual sync error:', err);
      setFormError(`수동 동기화 중 오류가 발생했습니다: ${err.message || '알 수 없는 오류'}`);
    } finally {
      setIsCollecting(false);
      setCollectorStatus('');
    }
  };

  // Handle password change
  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (newPasswordInput.trim().length < 4) {
      setFormError('새 비밀번호는 최소 4자 이상 입력해 주세요.');
      return;
    }

    if (newPasswordInput.trim() !== confirmPasswordInput.trim()) {
      setFormError('새 비밀번호와 비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    const token =
      (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('admin_token')) ||
      (typeof localStorage !== 'undefined' && localStorage.getItem('admin_token')) ||
      '';

    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          currentPassword: currentPasswordInput.trim(),
          newPassword: newPasswordInput.trim(),
          adminToken: token,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (data.token) {
          if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('admin_token', data.token);
          if (typeof localStorage !== 'undefined') localStorage.setItem('admin_token', data.token);
        }
        setCurrentPasswordInput('');
        setNewPasswordInput('');
        setConfirmPasswordInput('');
        setFormSuccess(data.message || '운영자 비밀번호가 성공적으로 변경되었습니다.');
      } else {
        setFormError(data.message || '비밀번호 변경에 실패했습니다.');
      }
    } catch (err: any) {
      setFormError('서버와 통신 중 오류가 발생했습니다.');
    }
  };

  // Handle instant trend keywords collection
  const handleTriggerTrendsCollect = async () => {
    setFormError(null);
    setFormSuccess(null);
    setIsCollectingTrends(true);

    const token =
      (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('admin_token')) ||
      (typeof localStorage !== 'undefined' && localStorage.getItem('admin_token')) ||
      '';

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        headers['x-admin-token'] = token;
      }

      const res = await fetch('/api/trends/collect', {
        method: 'POST',
        headers,
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTrendCollectResult({
          count: data.count || 0,
          savedCount: data.savedCount || 0,
          dailySavedCount: data.dailySavedCount || 0,
          realApiCount: data.realApiCount ?? 0,
          fallbackCount: data.fallbackCount ?? 0,
          timestamp: data.timestamp || new Date().toISOString(),
          categoryStats: data.categoryStats || {},
        });
        setFormSuccess(data.message || '네이버 트렌드 및 황금 키워드 수집이 완료되었습니다.');
      } else if (res.status === 401) {
        setFormError('운영자 인증 세션이 만료되었습니다. 관리자 창을 닫은 후 다시 운영자 비밀번호로 로그인해 주세요.');
      } else {
        setFormError(data.message || data.error || '트렌드 키워드 수집에 실패했습니다.');
      }
    } catch (err: any) {
      console.error('Trigger trends collect error:', err);
      setFormError(`키워드 수집 중 통신 오류가 발생했습니다: ${err.message || '알 수 없는 오류'}`);
    } finally {
      setIsCollectingTrends(false);
    }
  };

  const handleDebugKeywordRaw = async () => {
    const kw = debugKeywordInput.trim();
    if (!kw) {
      setFormError('테스트할 키워드를 입력해 주세요.');
      return;
    }

    setFormError(null);
    setIsDebuggingKeyword(true);
    setDebugResult(null);

    const token =
      (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('admin_token')) ||
      (typeof localStorage !== 'undefined' && localStorage.getItem('admin_token')) ||
      '';

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        headers['x-admin-token'] = token;
      }

      const res = await fetch(`/api/admin/debug/keyword-raw?keyword=${encodeURIComponent(kw)}`, {
        method: 'GET',
        headers,
      });

      const data = await res.json();
      setDebugResult(data);
      if (!res.ok || !data.success) {
        setFormError(data.message || data.error || '검색광고 API 호출 테스트 실패');
      } else {
        setFormSuccess(`'${kw}' 키워드에 대한 네이버 검색광고 원본 조회가 성공했습니다.`);
      }
    } catch (err: any) {
      console.error('Debug keyword raw error:', err);
      setFormError(`API 디버그 호출 중 통신 오류: ${err?.message || '알 수 없는 오류'}`);
    } finally {
      setIsDebuggingKeyword(false);
    }
  };

  const handleDebugBlogRaw = async () => {
    const kw = debugBlogKeywordInput.trim();
    if (!kw) {
      setFormError('테스트할 키워드를 입력해 주세요.');
      return;
    }

    setFormError(null);
    setIsDebuggingBlog(true);
    setDebugBlogResult(null);

    const token =
      (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('admin_token')) ||
      (typeof localStorage !== 'undefined' && localStorage.getItem('admin_token')) ||
      '';

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        headers['x-admin-token'] = token;
      }

      let url = `/api/admin/debug/blog-search-test?query=${encodeURIComponent(kw)}`;
      if (debugCustomClientId.trim()) {
        url += `&clientId=${encodeURIComponent(debugCustomClientId.trim())}`;
      }
      if (debugCustomClientSecret.trim()) {
        url += `&clientSecret=${encodeURIComponent(debugCustomClientSecret.trim())}`;
      }

      const res = await fetch(url, {
        method: 'GET',
        headers,
      });

      const data = await res.json();
      setDebugBlogResult(data);
      if (!res.ok || !data.success) {
        setFormError(data.message || data.error || '블로그 검색 API 호출 테스트 실패 (401 인증 오류 등)');
      } else {
        setFormSuccess(`'${kw}' 키워드에 대한 네이버 블로그 검색 API 조회가 성공했습니다.`);
      }
    } catch (err: any) {
      console.error('Debug blog search error:', err);
      setFormError(`API 디버그 호출 중 통신 오류: ${err?.message || '알 수 없는 오류'}`);
    } finally {
      setIsDebuggingBlog(false);
    }
  };

  const handleDebugTrendRaw = async () => {
    const kw = debugTrendKeywordInput.trim();
    if (!kw) {
      setFormError('테스트할 검색어(키워드)를 입력해 주세요.');
      return;
    }

    setFormError(null);
    setIsDebuggingTrend(true);
    setDebugTrendResult(null);

    const token =
      (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('admin_token')) ||
      (typeof localStorage !== 'undefined' && localStorage.getItem('admin_token')) ||
      '';

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        headers['x-admin-token'] = token;
      }

      let url = `/api/admin/debug/datalab-trend-test?query=${encodeURIComponent(kw)}`;
      if (debugCustomClientId.trim()) {
        url += `&clientId=${encodeURIComponent(debugCustomClientId.trim())}`;
      }
      if (debugCustomClientSecret.trim()) {
        url += `&clientSecret=${encodeURIComponent(debugCustomClientSecret.trim())}`;
      }

      const res = await fetch(url, {
        method: 'GET',
        headers,
      });

      const data = await res.json();
      setDebugTrendResult(data);
      if (!res.ok || !data.success) {
        setFormError(data.message || data.error || '검색어트렌드(DataLab) API 호출 테스트 실패');
      } else {
        setFormSuccess(`'${kw}' 키워드에 대한 네이버 검색어트렌드(DataLab) API 조회가 성공했습니다.`);
      }
    } catch (err: any) {
      console.error('Debug datalab trend error:', err);
      setFormError(`API 디버그 호출 중 통신 오류: ${err?.message || '알 수 없는 오류'}`);
    } finally {
      setIsDebuggingTrend(false);
    }
  };

  const handleDebugAllNaverApis = async () => {
    setFormError(null);
    setFormSuccess(null);
    await Promise.all([handleDebugBlogRaw(), handleDebugTrendRaw()]);
  };

  // Category Configuration Handlers
  const fetchAdminCategories = async () => {
    setIsLoadingCategories(true);
    try {
      const res = await fetch('/api/admin/categories');
      const data = await res.json();
      if (data.success && Array.isArray(data.categories)) {
        setAdminCategories(data.categories);
      }
    } catch (err) {
      console.warn('Failed to load categories:', err);
    } finally {
      setIsLoadingCategories(false);
    }
  };

  const handleSaveCategoryConfig = async (cat: TrendCategoryItem, seeds: string[]) => {
    try {
      const updatedCat: TrendCategoryItem = {
        ...cat,
        seeds: seeds.filter(Boolean),
      };
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: updatedCat }),
      });
      const data = await res.json();
      if (data.success && data.categories) {
        setAdminCategories(data.categories);
        setEditingCategory(null);
        setFormSuccess(`카테고리 "${cat.name}"의 시드 키워드(${seeds.length}개)가 성공적으로 저장되었습니다.`);
      } else {
        setFormError(data.message || '카테고리 저장 실패');
      }
    } catch (err: any) {
      setFormError(`카테고리 저장 중 오류: ${err?.message || '알 수 없는 오류'}`);
    }
  };

  const handleResetCategoriesToDefault = async () => {
    if (!window.confirm('기본 14개 트렌드 카테고리 및 시드 설정으로 초기화하시겠습니까?')) {
      return;
    }
    try {
      const res = await fetch('/api/admin/categories/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success && data.categories) {
        setAdminCategories(data.categories);
        setEditingCategory(null);
        setFormSuccess('기본 14개 트렌드 카테고리 및 시드 키워드로 성공적으로 초기화되었습니다.');
      }
    } catch (err: any) {
      setFormError(`카테고리 초기화 오류: ${err?.message || '알 수 없는 오류'}`);
    }
  };

  // Naver Filter Policy Handlers
  const loadFilterPolicy = async () => {
    setIsLoadingFilterPolicy(true);
    try {
      const res = await fetch('/api/admin/naver/filter-policy');
      const data = await res.json();
      if (data.success && data.policy) {
        setFilterPolicy(data.policy);
        setExclusionPatternsTextInput((data.policy.exclusionPatterns || []).join('\n'));
      }
    } catch (err) {
      console.warn('Failed to load filter policy:', err);
    } finally {
      setIsLoadingFilterPolicy(false);
    }
  };

  const handleSaveFilterPolicy = async () => {
    setIsSavingFilterPolicy(true);
    setFormError(null);
    setFormSuccess(null);
    try {
      const parsedPatterns = exclusionPatternsTextInput
        .split(/[\n,]+/)
        .map((p) => p.trim())
        .filter(Boolean);

      const policyToSave = {
        ...filterPolicy,
        exclusionPatterns: parsedPatterns,
      };

      const res = await fetch('/api/admin/naver/filter-policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policyToSave),
      });
      const data = await res.json();
      if (data.success) {
        setFilterPolicy(data.policy);
        setFormSuccess('키워드 수집 및 정제 필터 정책이 성공적으로 저장되었습니다.');
      } else {
        setFormError(data.error || '필터 정책 저장에 실패했습니다.');
      }
    } catch (err: any) {
      setFormError(`필터 정책 저장 오류: ${err?.message || '알 수 없는 오류'}`);
    } finally {
      setIsSavingFilterPolicy(false);
    }
  };

  const handleAddExcludedKeyword = () => {
    const kw = newExcludedKeywordInput.trim();
    if (!kw) return;
    if (filterPolicy.manualExcludedKeywords.includes(kw)) {
      setFormError(`'${kw}' 키워드는 이미 제외 목록에 등록되어 있습니다.`);
      return;
    }
    setFilterPolicy((prev) => ({
      ...prev,
      manualExcludedKeywords: [...prev.manualExcludedKeywords, kw],
    }));
    setNewExcludedKeywordInput('');
  };

  const handleRemoveExcludedKeyword = (kw: string) => {
    setFilterPolicy((prev) => ({
      ...prev,
      manualExcludedKeywords: prev.manualExcludedKeywords.filter((k) => k !== kw),
    }));
  };

  // Naver API Health Check Handler
  const loadApiHealth = async () => {
    setIsLoadingApiHealth(true);
    try {
      const res = await fetch('/api/naver/health');
      const data = await res.json();
      setApiHealthData(data);
    } catch (err) {
      console.warn('Failed to load API health:', err);
    } finally {
      setIsLoadingApiHealth(false);
    }
  };

  // Naver Collection Test Handler
  const handleRunCollectionTest = async () => {
    setIsTestingCollection(true);
    setFormError(null);
    setFormSuccess(null);
    try {
      const res = await fetch('/api/admin/naver/test-collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success && data.testResult) {
        setTestCollectionResult(data.testResult);
        setFormSuccess(`실시간 급상승 키워드 수집 테스트 완료! (수집: ${data.testResult.rawCollectedCount}개, 정제 후: ${data.testResult.finalKeywordsCount}개)`);
      } else {
        setFormError(data.error || '수집 테스트 실행 중 오류가 발생했습니다.');
      }
    } catch (err: any) {
      setFormError(`수집 테스트 실행 오류: ${err?.message || '알 수 없는 오류'}`);
    } finally {
      setIsTestingCollection(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'trendManage') {
      fetchAdminCategories();
      loadFilterPolicy();
      loadApiHealth();
    }
  }, [activeTab]);

  return (
    <div className="animate-in fade-in duration-150 max-w-5xl mx-auto">
      <div className="bg-white rounded-3xl w-full shadow-2xs overflow-hidden border border-slate-200/90 flex flex-col">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2 mb-0.5">
                <h2 className="text-xl sm:text-2xl font-black tracking-tight">참가자 및 챌린지 그룹 관리</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  운영자 모드
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium">
                챌린지 그룹 생성/삭제, 참가자 등록 및 관리
              </p>
            </div>
          </div>
        </div>

        {formSuccess && (
          <div className="bg-emerald-50 px-5 py-2.5 text-xs font-bold text-emerald-800 border-b border-emerald-200 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{formSuccess}</span>
            </div>
            <button
              onClick={() => setFormSuccess(null)}
              className="text-emerald-600 hover:text-emerald-900 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {formError && (
          <div className="bg-rose-50 px-5 py-2.5 text-xs font-bold text-rose-800 border-b border-rose-200 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{formError}</span>
            </div>
            <button
              onClick={() => setFormError(null)}
              className="text-rose-600 hover:text-rose-900 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Modal Nav Tabs */}
        <div className="bg-slate-100 p-2 border-b border-slate-200 flex items-center space-x-1 overflow-x-auto text-xs font-semibold">
          <button
            onClick={() => setActiveTab('participantAdd')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'participantAdd'
                ? 'bg-white text-blue-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <PlusCircle className="w-4 h-4 text-blue-600" />
            <span>참가자 등록/수정</span>
          </button>

          <button
            onClick={() => setActiveTab('groupManage')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'groupManage'
                ? 'bg-white text-indigo-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <FolderPlus className="w-4 h-4 text-indigo-600" />
            <span>챌린지 그룹 생성 ({groups.length}개)</span>
          </button>

          <button
            onClick={() => setActiveTab('participantList')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'participantList'
                ? 'bg-white text-emerald-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Users className="w-4 h-4 text-emerald-600" />
            <span>참가자 목록/삭제 ({participants.length}명)</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('paymentsManage');
              setFormError(null);
              setFormSuccess(null);
            }}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer whitespace-nowrap relative ${
              activeTab === 'paymentsManage'
                ? 'bg-white text-amber-800 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <CreditCard className="w-4 h-4 text-amber-600" />
            <span>참가비 / 입금 관리</span>
            {payments.filter((p) => p.status === 'submitted' || p.status === 'pending').length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse">
                {payments.filter((p) => p.status === 'submitted' || p.status === 'pending').length}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab('refundsManage');
              setFormError(null);
              setFormSuccess(null);
            }}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer whitespace-nowrap relative ${
              activeTab === 'refundsManage'
                ? 'bg-white text-emerald-800 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Coins className="w-4 h-4 text-emerald-600" />
            <span>환급 관리</span>
            {refunds.filter((r) => r.refundStatus === 'calculated' || r.contentReviewStatus === 'flagged').length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-emerald-600 text-white animate-pulse">
                {refunds.filter((r) => r.refundStatus === 'calculated' || r.contentReviewStatus === 'flagged').length}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab('revenueManage');
              setFormError(null);
              setFormSuccess(null);
            }}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer whitespace-nowrap relative ${
              activeTab === 'revenueManage'
                ? 'bg-white text-amber-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Award className="w-4 h-4 text-amber-600" />
            <span>수익 인증 심사</span>
            {revenueCertifications.filter((c) => c.status === 'pending').length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-500 text-white animate-pulse">
                {revenueCertifications.filter((c) => c.status === 'pending').length}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab('badgeManage');
              setFormError(null);
              setFormSuccess(null);
            }}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer whitespace-nowrap relative ${
              activeTab === 'badgeManage'
                ? 'bg-white text-amber-600 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Trophy className="w-4 h-4 text-amber-500" />
            <span>성과 뱃지 관리</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('membershipManage');
              setFormError(null);
              setFormSuccess(null);
            }}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer whitespace-nowrap relative ${
              activeTab === 'membershipManage'
                ? 'bg-white text-emerald-800 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>구매 등급 및 AI 사용량</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('boardManage');
              setFormError(null);
              setFormSuccess(null);
            }}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer whitespace-nowrap relative ${
              activeTab === 'boardManage'
                ? 'bg-white text-indigo-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Megaphone className="w-4 h-4 text-indigo-600" />
            <span>공지 & 게시판 관리</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('trendManage');
              setFormError(null);
              setFormSuccess(null);
            }}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer whitespace-nowrap relative ${
              activeTab === 'trendManage'
                ? 'bg-white text-indigo-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <TrendingUp className="w-4 h-4 text-indigo-600" />
            <span>트렌드 키워드 수집</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('navManage');
              setFormError(null);
              setFormSuccess(null);
            }}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer whitespace-nowrap relative ${
              activeTab === 'navManage'
                ? 'bg-white text-emerald-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <LayoutList className="w-4 h-4 text-emerald-600" />
            <span>메뉴 탭 이름 설정</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('passwordChange');
              setFormError(null);
              setFormSuccess(null);
            }}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'passwordChange'
                ? 'bg-white text-purple-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <KeyRound className="w-4 h-4 text-purple-600" />
            <span>비밀번호 변경</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 max-h-[70vh] overflow-y-auto">
          
          {/* TAB 1: 참가자 등록 / 수정 */}
          {activeTab === 'participantAdd' && (
            <form onSubmit={handleCreateParticipantSubmit} className="space-y-4">
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p>
                  참가자 기본 정보(그룹, 이름, 블로그/트위터 ID)만 신규 등록하면, 일별 수치(포스팅 수, 방문자 수, 트윗 수)는 매일 자동 배치(Cron/RSS 파싱)를 통해 <strong>0부터 자동 집계 및 누적</strong>됩니다.
                </p>
              </div>

              {/* Group Select (Multi-Challenge) */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  참가 챌린지 그룹 선택 (다중 선택 가능) *
                </label>
                <div className="space-y-1.5 max-h-36 overflow-y-auto p-2.5 bg-slate-50 border border-slate-300 rounded-lg">
                  {groups.map((g) => {
                    const isChecked = selectedAddGroupNames.includes(g.name);
                    return (
                      <label key={g.id} className="flex items-center space-x-2 text-xs cursor-pointer hover:bg-slate-100 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedAddGroupNames([...selectedAddGroupNames, g.name]);
                            } else {
                              if (selectedAddGroupNames.length > 1) {
                                setSelectedAddGroupNames(selectedAddGroupNames.filter((n) => n !== g.name));
                              } else {
                                alert('최소 1개 이상의 챌린지 그룹을 선택해야 합니다.');
                              }
                            }
                          }}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <span className="font-bold text-slate-800">{g.name}</span>
                        <span className="text-[10px] text-slate-500">
                          ({g.category === 'blog' ? '블로그' : g.category === 'twitter' ? '트위터' : '통합'})
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Participant Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">참가자 이름 *</label>
                <input
                  type="text"
                  placeholder="예: 홍길동"
                  value={participantName}
                  onChange={(e) => setParticipantName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Registration Type Select */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">등록 방식 선택 *</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPlatformType('both')}
                    className={`py-2 px-3 text-xs font-bold rounded-lg border flex items-center justify-center gap-1 cursor-pointer transition-all ${
                      platformType === 'both'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>① 블로그+트위터 둘 다</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPlatformType('blog')}
                    className={`py-2 px-3 text-xs font-bold rounded-lg border flex items-center justify-center gap-1 cursor-pointer transition-all ${
                      platformType === 'blog'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>② 블로그만</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPlatformType('twitter')}
                    className={`py-2 px-3 text-xs font-bold rounded-lg border flex items-center justify-center gap-1 cursor-pointer transition-all ${
                      platformType === 'twitter'
                        ? 'bg-sky-500 text-white border-sky-500 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Twitter className="w-3.5 h-3.5" />
                    <span>③ 트위터만</span>
                  </button>
                </div>
              </div>

              {/* Blog Details */}
              {(platformType === 'blog' || platformType === 'both') && (
                <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2">
                  <span className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                    네이버 블로그 ID 설정
                  </span>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      네이버 블로그 ID * (RSS: https://rss.blog.naver.com/아이디.xml)
                    </label>
                    <input
                      type="text"
                      placeholder="예: naver_id_123"
                      value={blogId}
                      onChange={(e) => setBlogId(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-md text-xs font-mono text-slate-800 focus:ring-2 focus:ring-emerald-500"
                      required={platformType === 'blog' || platformType === 'both'}
                    />
                  </div>
                </div>
              )}

              {/* Twitter Details */}
              {(platformType === 'twitter' || platformType === 'both') && (
                <div className="p-3.5 bg-sky-50/70 border border-sky-200 rounded-xl space-y-2">
                  <span className="text-xs font-bold text-sky-800 flex items-center gap-1">
                    <Twitter className="w-3.5 h-3.5 text-sky-500" />
                    트위터 ID 설정
                  </span>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      트위터 ID * (@핸들 형식)
                    </label>
                    <input
                      type="text"
                      placeholder="예: @twitter_handle"
                      value={twitterId}
                      onChange={(e) => setTwitterId(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-sky-300 rounded-md text-xs font-mono text-slate-800 focus:ring-2 focus:ring-sky-500"
                      required={platformType === 'twitter' || platformType === 'both'}
                    />
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors cursor-pointer"
                >
                  참가자 신규 등록 완료
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: 챌린지 그룹 생성 / 삭제 */}
          {activeTab === 'groupManage' && (
            <div className="space-y-6">
              {/* Form to create group */}
              <form onSubmit={handleCreateGroupSubmit} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 border-b border-slate-200 pb-2">
                  <FolderPlus className="w-4 h-4 text-indigo-600" />
                  <span>새 챌린지 그룹 추가</span>
                </h4>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">
                    챌린지 그룹 이름 * (예: '8월 글쓰기 챌린지')
                  </label>
                  <input
                    type="text"
                    placeholder="예: 8월 글쓰기 챌린지"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-medium"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">그룹 설명</label>
                  <input
                    type="text"
                    placeholder="예: 매일 1포스팅 실천 그룹"
                    value={newGroupDesc}
                    onChange={(e) => setNewGroupDesc(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800"
                  />
                </div>

                {/* Group Category Selector Tabs */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    그룹 카테고리 설정
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setNewGroupCategory('both')}
                      className={`py-1.5 px-2 text-[11px] font-bold rounded-md transition-all cursor-pointer flex items-center justify-center gap-1 ${
                        newGroupCategory === 'both'
                          ? 'bg-white text-indigo-700 shadow-xs border border-indigo-200'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                      }`}
                    >
                      <span>통합 (블로그+X)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewGroupCategory('blog')}
                      className={`py-1.5 px-2 text-[11px] font-bold rounded-md transition-all cursor-pointer flex items-center justify-center gap-1 ${
                        newGroupCategory === 'blog'
                          ? 'bg-white text-emerald-700 shadow-xs border border-emerald-200'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                      }`}
                    >
                      <span>블로그 전용</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewGroupCategory('twitter')}
                      className={`py-1.5 px-2 text-[11px] font-bold rounded-md transition-all cursor-pointer flex items-center justify-center gap-1 ${
                        newGroupCategory === 'twitter'
                          ? 'bg-white text-sky-700 shadow-xs border border-sky-200'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                      }`}
                    >
                      <span>X (트위터) 전용</span>
                    </button>
                  </div>
                </div>

                {/* 📅 기간 설정 (모집 기간 & 운영 기간) */}
                <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-indigo-600" />
                      <span>기간 설정 (모집 및 운영 기간)</span>
                    </span>
                  </div>

                  {/* 1) 모집 기간 */}
                  <div className="bg-white p-2.5 rounded-lg border border-indigo-100 space-y-1.5">
                    <span className="text-[11px] font-bold text-indigo-900 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-indigo-500" />
                      모집 기간 설정
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">모집 시작일</label>
                        <input
                          type="date"
                          value={newGroupRecruitingStartDate}
                          onChange={(e) => setNewGroupRecruitingStartDate(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs font-medium text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">모집 마감일</label>
                        <input
                          type="date"
                          value={newGroupRecruitingEndDate}
                          onChange={(e) => setNewGroupRecruitingEndDate(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs font-medium text-slate-800"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 2) 운영 기간 */}
                  <div className="bg-white p-2.5 rounded-lg border border-indigo-100 space-y-1.5">
                    <span className="text-[11px] font-bold text-indigo-900 flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-indigo-500" />
                      운영 기간 설정 (챌린지 진행 기간)
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">운영 시작일 (챌린지 시작)</label>
                        <input
                          type="date"
                          value={newGroupStartDate}
                          onChange={(e) => setNewGroupStartDate(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs font-medium text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">운영 종료일 (챌린지 종료)</label>
                        <input
                          type="date"
                          value={newGroupEndDate}
                          onChange={(e) => setNewGroupEndDate(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs font-medium text-slate-800"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 🎯 목표 수집 기준 설정 (트윗/블로그 분리) */}
                <div className="p-3 bg-amber-50/80 border border-amber-200/90 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <Target className="w-4 h-4 text-amber-700" />
                      <span>목표 및 수집 기준 설정</span>
                    </span>
                  </div>

                  {/* 1) 미션 요일 선택 */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <label className="font-bold text-slate-700">미션 요일 선택 (다중 선택)</label>
                      <div className="flex items-center gap-1 text-[10px]">
                        <button
                          type="button"
                          onClick={() => setNewGroupMissionDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])}
                          className="px-1.5 py-0.5 bg-white border border-slate-300 rounded hover:bg-slate-100 font-semibold text-slate-700 cursor-pointer"
                        >
                          매일
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewGroupMissionDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])}
                          className="px-1.5 py-0.5 bg-white border border-slate-300 rounded hover:bg-slate-100 font-semibold text-slate-700 cursor-pointer"
                        >
                          평일
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewGroupMissionDays(['Sat', 'Sun'])}
                          className="px-1.5 py-0.5 bg-white border border-slate-300 rounded hover:bg-slate-100 font-semibold text-slate-700 cursor-pointer"
                        >
                          주말
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 overflow-x-auto pb-1">
                      {ALL_MISSION_DAYS.map((d) => {
                        const isSelected = newGroupMissionDays.includes(d.code);
                        return (
                          <button
                            key={d.code}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                if (newGroupMissionDays.length > 1) {
                                  setNewGroupMissionDays(newGroupMissionDays.filter((m) => m !== d.code));
                                }
                              } else {
                                setNewGroupMissionDays([...newGroupMissionDays, d.code]);
                              }
                            }}
                            className={`flex-1 min-w-[32px] py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {d.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2) 목표 기준 선택: Daily vs Weekly */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 block">목표 기준 선택</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setNewGroupGoalUnit('daily')}
                        className={`py-1.5 px-2 text-xs font-bold rounded-lg border flex items-center justify-center gap-1 cursor-pointer transition-all ${
                          newGroupGoalUnit === 'daily'
                            ? 'bg-amber-700 text-white border-amber-700 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span>일 단위 (Daily)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewGroupGoalUnit('weekly')}
                        className={`py-1.5 px-2 text-xs font-bold rounded-lg border flex items-center justify-center gap-1 cursor-pointer transition-all ${
                          newGroupGoalUnit === 'weekly'
                            ? 'bg-amber-700 text-white border-amber-700 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span>주 단위 (Weekly)</span>
                      </button>
                    </div>
                  </div>

                  {/* 3) 상세 목표 수 설정 */}
                  <div className="space-y-2 pt-1">
                    <span className="text-[11px] font-bold text-slate-800 block">
                      상세 목표 수 설정 ({newGroupGoalUnit === 'daily' ? '1일 기준' : '1주 기준'})
                    </span>
                    
                    {(newGroupCategory === 'twitter' || newGroupCategory === 'both') && (
                      <div className="grid grid-cols-2 gap-2 bg-white p-2.5 rounded-lg border border-amber-200/80">
                        <div>
                          <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                            트윗 게시글 목표 수 *
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={newGroupTargetTweetCount}
                            onChange={(e) => setNewGroupTargetTweetCount(Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs font-bold text-slate-900"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                            트윗 답글(Reply) 목표 수 *
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={newGroupTargetReplyCount}
                            onChange={(e) => setNewGroupTargetReplyCount(Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs font-bold text-slate-900"
                          />
                        </div>
                      </div>
                    )}

                    {(newGroupCategory === 'blog' || newGroupCategory === 'both') && (
                      <div className="bg-white p-2.5 rounded-lg border border-amber-200/80">
                        <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                          블로그 포스팅 목표 수 *
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={newGroupTargetBlogPostCount}
                          onChange={(e) => setNewGroupTargetBlogPostCount(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs font-bold text-slate-900"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* 💰 금액 및 보상 설정 */}
                <div className="p-3 bg-emerald-50/70 border border-emerald-200/90 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                      <Coins className="w-4 h-4 text-emerald-600" />
                      <span>금액 및 보상 설정</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="bg-white p-2.5 rounded-lg border border-emerald-200/80 space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 block">
                        참가비 (원)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min={0}
                          step={1000}
                          placeholder="0 (무료)"
                          value={newGroupFee === 0 ? '' : newGroupFee}
                          onChange={(e) => setNewGroupFee(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs font-bold text-slate-900 pr-8"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">원</span>
                      </div>
                      <p className="text-[10px] text-slate-500">0원 입력 시 '무료'로 안내됩니다.</p>
                    </div>

                    <div className="bg-white p-2.5 rounded-lg border border-emerald-200/80 space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 block">
                        환급 금액 (원)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min={0}
                          step={1000}
                          placeholder="0 (환급 없음)"
                          value={newGroupRefundFee === 0 ? '' : newGroupRefundFee}
                          onChange={(e) => setNewGroupRefundFee(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs font-bold text-slate-900 pr-8"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">원</span>
                      </div>
                      <p className="text-[10px] text-slate-500">목표 달성 시 지급할 환급 금액</p>
                    </div>
                  </div>

                  {/* Detailed Refund Settings */}
                  <div className="pt-2 border-t border-emerald-200/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newGroupRefundEnabled}
                          onChange={(e) => setNewGroupRefundEnabled(e.target.checked)}
                          className="rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                        <span>환급 관리 시스템 활성화</span>
                      </label>
                      <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-100 px-2 py-0.5 rounded-full">
                        {newGroupRefundEnabled ? '환급 정책 적용' : '비활성'}
                      </span>
                    </div>

                    {newGroupRefundEnabled && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                        <div>
                          <label className="text-[10px] font-bold text-slate-600 block mb-1">환급 방식</label>
                          <select
                            value={newGroupRefundType}
                            onChange={(e) => setNewGroupRefundType(e.target.value as 'full' | 'fixed')}
                            className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-bold text-slate-800"
                          >
                            <option value="full">전액 환급 (참가비 100%)</option>
                            <option value="fixed">정액 환급 (지정 금액)</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-600 block mb-1">환급 기준 달성률 (%)</label>
                          <div className="relative">
                            <input
                              type="number"
                              min={1}
                              max={100}
                              value={newGroupRefundThreshold}
                              onChange={(e) => setNewGroupRefundThreshold(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                              className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-bold text-slate-800 pr-6"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-600 block mb-1">환급 설정 금액 (원)</label>
                          <input
                            type="number"
                            min={0}
                            step={1000}
                            disabled={newGroupRefundType === 'full'}
                            value={newGroupRefundType === 'full' ? newGroupFee : newGroupRefundAmount}
                            onChange={(e) => setNewGroupRefundAmount(parseInt(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-bold text-slate-800 disabled:bg-slate-100 disabled:text-slate-400"
                          />
                        </div>
                      </div>
                    )}

                    {newGroupRefundEnabled && (
                      <div className="bg-white p-2.5 rounded-lg border border-emerald-200/80 space-y-1 mt-2">
                        <label className="text-[11px] font-bold text-emerald-950 flex items-center justify-between">
                          <span>외부 환급 신청폼 URL (Google Forms 등)</span>
                          <span className="text-[10px] text-emerald-600 font-normal">보안: 계좌 미저장 방식</span>
                        </label>
                        <input
                          type="url"
                          placeholder="예: https://forms.google.com/e/1FAIpQLSc..."
                          value={newGroupRefundFormUrl}
                          onChange={(e) => setNewGroupRefundFormUrl(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs font-medium text-slate-900"
                        />
                        <p className="text-[10px] text-slate-500">
                          환급 기준을 달성한 참가자에게 알림 및 링크가 발송되어 일회성으로 계좌를 제출받습니다.
                        </p>
                        {newGroupRefundFormUrl.trim() && !newGroupRefundFormUrl.startsWith('http://') && !newGroupRefundFormUrl.startsWith('https://') && (
                          <p className="text-[10px] text-rose-500 font-bold">
                            ⚠️ 올바른 웹 링크 주소 형식(http:// 또는 https://)으로 입력해주세요.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* 🏦 입금 계좌 및 안내문 설정 */}
                <div className="p-3 bg-blue-50/70 border border-blue-200/90 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                      <Building className="w-4 h-4 text-blue-600" />
                      <span>입금 계좌 및 참가자 안내문 설정</span>
                    </span>
                    <span className="text-[10px] text-blue-700 bg-blue-100 font-semibold px-2 py-0.5 rounded-full">
                      참가 신청 시 노출
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="bg-white p-2.5 rounded-lg border border-blue-200/80 space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 block">
                        입금 은행명 <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="예: 국민은행, 카카오뱅크, 토스뱅크"
                        value={newGroupBankName}
                        onChange={(e) => setNewGroupBankName(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs font-bold text-slate-900"
                      />
                    </div>

                    <div className="bg-white p-2.5 rounded-lg border border-blue-200/80 space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 block">
                        계좌번호 <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="예: 3333-01-1234567"
                        value={newGroupAccountNumber}
                        onChange={(e) => setNewGroupAccountNumber(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs font-bold text-slate-900"
                      />
                    </div>

                    <div className="bg-white p-2.5 rounded-lg border border-blue-200/80 space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 block">
                        예금주 <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="예: 홍길동(운영자)"
                        value={newGroupAccountHolder}
                        onChange={(e) => setNewGroupAccountHolder(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs font-bold text-slate-900"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5">
                    <div className="bg-white p-2.5 rounded-lg border border-blue-200/80 space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 block">
                        입금 마감 일시 안내문
                      </label>
                      <input
                        type="text"
                        placeholder="예: 모집 마감일 23:59까지 입금"
                        value={newGroupDepositDeadline}
                        onChange={(e) => setNewGroupDepositDeadline(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs font-medium text-slate-900"
                      />
                    </div>

                    <div className="bg-white p-2.5 rounded-lg border border-blue-200/80 space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 block">
                        입금 및 유의사항 안내문
                      </label>
                      <textarea
                        rows={2}
                        placeholder="참가자에게 안내할 입금 안내문 및 유의사항을 입력하세요."
                        value={newGroupDepositNotice}
                        onChange={(e) => setNewGroupDepositNotice(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs font-medium text-slate-900 resize-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                  >
                    <FolderPlus className="w-4 h-4" />
                    <span>챌린지 그룹 생성</span>
                  </button>
                </div>
              </form>

              {/* Group List & Edit / Delete */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-700">현재 등록된 챌린지 그룹 ({groups.length}개)</h4>
                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden text-xs">
                  {groups.map((g) => (
                    <div key={g.id} className="p-3 bg-white flex items-center justify-between hover:bg-slate-50">
                      <div>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <strong className="text-slate-900 font-bold">{g.name}</strong>
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                              g.category === 'blog'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : g.category === 'twitter'
                                ? 'bg-sky-50 text-sky-700 border border-sky-200'
                                : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            }`}
                          >
                            {g.category === 'blog'
                              ? '블로그 전용'
                              : g.category === 'twitter'
                              ? 'X(트위터) 전용'
                              : '통합 (블로그+X)'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {g.description} ({g.startDate} ~ {g.endDate})
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setEditingGroup(g)}
                          className="px-2.5 py-1 text-xs text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 border border-indigo-200 rounded-md transition-colors cursor-pointer flex items-center gap-1 font-semibold"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>수정</span>
                        </button>
                        <button
                          onClick={() => {
                            onDeleteGroup(g.id);
                          }}
                          className="px-2.5 py-1 text-xs text-rose-600 hover:text-rose-800 hover:bg-rose-50 border border-rose-200 rounded-md transition-colors cursor-pointer flex items-center gap-1 font-semibold"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>그룹 삭제</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: 챌린지 참가비 환급 관리 */}
          {activeTab === 'refundsManage' && (
            <div className="space-y-4">
              {/* Informational Banner */}
              <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs text-emerald-950 flex items-start gap-2.5 shadow-2xs">
                <Coins className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-emerald-900 text-sm">챌린지 참가비 환급 관리 시스템</span>
                    <span className="px-2 py-0.5 bg-emerald-200/70 text-emerald-800 font-bold text-[10px] rounded-full">
                      수동 송금 & 기록 방식
                    </span>
                  </div>
                  <p className="text-emerald-800 leading-relaxed text-[11px]">
                    자동 집계된 <strong>달성률 스냅샷</strong>과 <strong>콘텐츠 검토 결과</strong>를 바탕으로 환급 대상을 확인합니다.
                    실제 환급금은 운영자가 외부 계좌이체를 통해 송금한 후, <strong>'환급 완료'</strong> 버튼을 눌러 승인 기록을 저장해 주세요.
                  </p>
                </div>
              </div>

              {/* KPI Summary Cards */}
              {(() => {
                const totalCalculated = refunds.length;
                const eligibleCount = refunds.filter((r) => r.eligibilityStatus === 'eligible').length;
                const flaggedCount = refunds.filter((r) => r.contentReviewStatus === 'flagged').length;
                const approvedCount = refunds.filter((r) => r.refundStatus === 'approved').length;
                const approvedTotalAmount = refunds
                  .filter((r) => r.refundStatus === 'approved')
                  .reduce((sum, r) => sum + (r.eligibleAmount ?? r.calculatedRefundAmount ?? 0), 0);
                const appliedCount = refunds.filter((r) => r.refundStatus === 'applied').length;
                const completedCount = refunds.filter((r) => r.refundStatus === 'completed').length;
                const completedTotalAmount = refunds
                  .filter((r) => r.refundStatus === 'completed')
                  .reduce((sum, r) => sum + (r.eligibleAmount ?? r.calculatedRefundAmount ?? 0), 0);

                return (
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                    <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-center">
                      <span className="text-[10px] font-bold text-slate-500 block">전체 스냅샷 건수</span>
                      <span className="text-base font-black text-slate-900">{totalCalculated}건</span>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl text-center">
                      <span className="text-[10px] font-bold text-amber-700 block">검토 필요 (이상 감지)</span>
                      <span className="text-base font-black text-amber-800">{flaggedCount}건</span>
                    </div>
                    <div className="bg-purple-50 border border-purple-200 p-2.5 rounded-xl text-center">
                      <span className="text-[10px] font-bold text-purple-700 block">외부폼 접수됨</span>
                      <span className="text-base font-black text-purple-900">{appliedCount}건</span>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 p-2.5 rounded-xl text-center">
                      <span className="text-[10px] font-bold text-blue-700 block">승인 대기 (송금 대기)</span>
                      <span className="text-base font-black text-blue-900">{approvedCount}건</span>
                      <span className="text-[10px] font-bold text-blue-700 block mt-0.5">{(approvedTotalAmount || 0).toLocaleString()}원</span>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl text-center">
                      <span className="text-[10px] font-bold text-emerald-700 block">환급 완료 (송금 완료)</span>
                      <span className="text-base font-black text-emerald-900">{completedCount}건</span>
                      <span className="text-[10px] font-bold text-emerald-700 block mt-0.5">{(completedTotalAmount || 0).toLocaleString()}원</span>
                    </div>
                    <div className="bg-indigo-50 border border-indigo-200 p-2.5 rounded-xl text-center col-span-2 sm:col-span-1">
                      <span className="text-[10px] font-bold text-indigo-700 block">환급 기준 달성자</span>
                      <span className="text-base font-black text-indigo-900">{eligibleCount}명</span>
                    </div>
                  </div>
                );
              })()}

              {/* Action Toolbar & Filters */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
                {/* Challenge & Status Filters */}
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={refundGroupFilter}
                    onChange={(e) => setRefundGroupFilter(e.target.value)}
                    className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-bold text-xs text-slate-800"
                  >
                    <option value="all">전체 챌린지 그룹</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center space-x-1 overflow-x-auto">
                    {[
                      { key: 'all', label: '전체' },
                      { key: 'calculated', label: '계산됨' },
                      { key: 'applied', label: '외부폼 접수됨' },
                      { key: 'approved', label: '승인됨 (송금 대기)' },
                      { key: 'completed', label: '완료됨 (송금 완료)' },
                      { key: 'rejected', label: '거절됨' },
                      { key: 'flagged', label: '⚠️ 검토 필요' },
                    ].map((st) => (
                      <button
                        key={st.key}
                        type="button"
                        onClick={() => setRefundStatusFilter(st.key)}
                        className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors cursor-pointer whitespace-nowrap ${
                          refundStatusFilter === st.key
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'bg-white text-slate-600 hover:bg-slate-200/80 border border-slate-200'
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Right Side Buttons: Calculate Snapshot & Export CSV */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (onBatchCalculateRefunds) {
                        onBatchCalculateRefunds(refundGroupFilter);
                      } else {
                        const targetGroups = refundGroupFilter === 'all' ? groups : groups.filter((g) => g.id === refundGroupFilter);
                        let calculatedList: ChallengeRefund[] = [];
                        targetGroups.forEach((g) => {
                          const res = calculateBatchRefundSnapshots(participants, g, groups, payments, refunds);
                          calculatedList = [...calculatedList, ...res];
                        });
                        if (onSaveRefund && calculatedList.length > 0) {
                          calculatedList.forEach((r) => onSaveRefund(r));
                        }
                        setFormSuccess(`🎉 총 ${calculatedList.length}건의 환급 스냅샷이 자동 계산되었습니다.`);
                      }
                    }}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition-all shadow-2xs flex items-center gap-1 cursor-pointer active:scale-95"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>스냅샷 계산</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const selectedGroupObj = groups.find((g) => g.id === refundGroupFilter);
                      exportRefundsToCsv(refunds, selectedGroupObj ? selectedGroupObj.name : '전체 챌린지');
                      setFormSuccess('📊 환급 관리 CSV 파일 다운로드가 시작되었습니다.');
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-all shadow-2xs flex items-center gap-1 cursor-pointer active:scale-95"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>CSV 다운로드</span>
                  </button>
                </div>
              </div>

              {/* Search input */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={refundSearchTerm}
                  onChange={(e) => setRefundSearchTerm(e.target.value)}
                  placeholder="참가자 이름 / 블로그 ID / 환급 계좌주 검색"
                  className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
                />
              </div>

              {/* Refunds Table */}
              {(() => {
                let list = refunds;
                if (refundGroupFilter !== 'all') {
                  list = list.filter((r) => r.challengeGroupCode === refundGroupFilter || r.challengeName.includes(refundGroupFilter));
                }
                if (refundStatusFilter === 'flagged') {
                  list = list.filter((r) => r.contentReviewStatus === 'flagged');
                } else if (refundStatusFilter !== 'all') {
                  list = list.filter((r) => r.refundStatus === refundStatusFilter);
                }
                if (refundSearchTerm.trim()) {
                  const term = refundSearchTerm.toLowerCase();
                  list = list.filter(
                    (r) =>
                      (r.participantName || r.userName || '').toLowerCase().includes(term) ||
                      (r.blogId && r.blogId.toLowerCase().includes(term)) ||
                      (r.bankAccountHolder && r.bankAccountHolder.toLowerCase().includes(term)) ||
                      (r.challengeName && r.challengeName.toLowerCase().includes(term))
                  );
                }

                if (list.length === 0) {
                  return (
                    <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <Coins className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="text-xs font-bold text-slate-600">조건에 일치하는 환급 스냅샷 데이터가 없습니다.</p>
                      <p className="text-[11px] text-slate-400">
                        상단의 <strong>'스냅샷 계산'</strong> 버튼을 눌러 달성률 기반 환급 목록을 생성해 주세요.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    <div className="max-h-[420px] overflow-y-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10">
                          <tr>
                            <th className="p-2.5">참가자 / 플랫폼</th>
                            <th className="p-2.5">챌린지 명</th>
                            <th className="p-2.5 text-center">달성률</th>
                            <th className="p-2.5 text-center">자격 상태</th>
                            <th className="p-2.5 text-center">콘텐츠 검토</th>
                            <th className="p-2.5 text-right">환급 산정액</th>
                            <th className="p-2.5 text-center">환급 진행 상태</th>
                            <th className="p-2.5 text-center">환급 처리 (송금 기록)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-800">
                          {list.map((r) => (
                            <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="p-2.5">
                                <div className="font-extrabold text-slate-900">{r.participantName || r.userName || '참가자'}</div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  {r.blogId ? `블로그: ${r.blogId}` : r.twitterId ? `X: ${r.twitterId}` : r.userEmail || '-'}
                                </div>
                              </td>
                              <td className="p-2.5 font-bold text-slate-800">{r.challengeName || '-'}</td>
                              <td className="p-2.5 text-center whitespace-nowrap">
                                <div className="font-black text-indigo-900">{r.achievementRate}%</div>
                                <div className="w-16 bg-slate-200 h-1.5 rounded-full mx-auto mt-0.5 overflow-hidden">
                                  <div
                                    className={`h-full ${
                                      r.achievementRate >= 100
                                        ? 'bg-emerald-500'
                                        : r.achievementRate >= 80
                                        ? 'bg-indigo-500'
                                        : 'bg-rose-500'
                                    }`}
                                    style={{ width: `${Math.min(100, r.achievementRate)}%` }}
                                  />
                                </div>
                              </td>
                              <td className="p-2.5 text-center whitespace-nowrap">
                                {r.eligibilityStatus === 'eligible' ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    환급 가능
                                  </span>
                                ) : r.eligibilityStatus === 'review_required' ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                                    검토 필요
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                                    <X className="w-3 h-3 text-rose-600" />
                                    기준 미달
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 text-center whitespace-nowrap">
                                {r.contentReviewStatus === 'passed' || r.contentReviewStatus === 'valid' ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                    정상 (통과)
                                  </span>
                                ) : r.contentReviewStatus === 'flagged' || r.contentReviewStatus === 'suspicious' ? (
                                  <button
                                    type="button"
                                    onClick={() => setInspectingRefund(r)}
                                    className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200 hover:bg-rose-200 cursor-pointer"
                                  >
                                    <AlertCircle className="w-3 h-3 text-rose-600" />
                                    ⚠️ 이상 감지
                                  </button>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                    수동 확인
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 text-right font-black text-slate-900 whitespace-nowrap">
                                {((r.eligibleAmount ?? r.calculatedRefundAmount) ?? 0).toLocaleString()}원
                              </td>
                              <td className="p-2.5 text-center whitespace-nowrap">
                                {r.refundStatus === 'completed' ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    환급 완료 (송금함)
                                  </span>
                                ) : r.refundStatus === 'approved' ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-300">
                                    <Clock className="w-3 h-3 text-blue-600" />
                                    승인됨 (송금 대기)
                                  </span>
                                ) : r.refundStatus === 'applied' ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-300">
                                    <FileCheck className="w-3 h-3 text-purple-600" />
                                    외부폼 접수됨
                                  </span>
                                ) : r.refundStatus === 'rejected' ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                                    <X className="w-3 h-3 text-rose-600" />
                                    거절됨
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                                    계산됨
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 text-center whitespace-nowrap">
                                <div className="flex items-center justify-center gap-1">
                                  {/* Review Modal Button */}
                                  <button
                                    type="button"
                                    onClick={() => setInspectingRefund(r)}
                                    title="작성 포스팅 및 검토 내역 상세보기"
                                    className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-all cursor-pointer border border-slate-200"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Approve Button */}
                                  {r.refundStatus !== 'completed' && r.refundStatus !== 'approved' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setApprovingRefund(r);
                                        setApprovalMemoInput('목표 달성 조건 충족 환급 승인');
                                      }}
                                      className="px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] transition-all cursor-pointer shadow-2xs flex items-center gap-0.5"
                                    >
                                      <CheckSquare className="w-3 h-3" />
                                      <span>승인</span>
                                    </button>
                                  )}

                                  {/* Mark Complete (Bank Transfer Done) Button */}
                                  {r.refundStatus !== 'completed' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCompletingRefund(r);
                                        setOperatorNameInput('운영진');
                                        setCompletionMemoInput('계좌 이체 송금 완료');
                                      }}
                                      className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] transition-all cursor-pointer shadow-2xs flex items-center gap-0.5"
                                    >
                                      <Coins className="w-3 h-3" />
                                      <span>송금완료</span>
                                    </button>
                                  )}

                                  {/* Reject Button */}
                                  {r.refundStatus !== 'rejected' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRejectingRefund(r);
                                        setRefundRejectionReasonInput('환급 기준 미달 또는 필수 포스팅 부족');
                                      }}
                                      className="px-2 py-1 rounded-lg bg-slate-200 hover:bg-rose-100 text-slate-700 hover:text-rose-800 font-bold text-[10px] transition-all cursor-pointer border border-slate-300"
                                    >
                                      <XCircle className="w-3 h-3" />
                                      <span>거절</span>
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {/* 1) Inspect Content Review Detail Modal */}
              {inspectingRefund && (
                <div className="fixed inset-0 z-70 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 max-h-[80vh] overflow-y-auto">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                          <Eye className="w-4 h-4 text-indigo-600" />
                          <span>콘텐츠 검토 상세 내역 - {inspectingRefund.participantName || inspectingRefund.userName || '참가자'}</span>
                        </h4>
                        <p className="text-[11px] text-slate-500">{inspectingRefund.challengeName || '-'}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setInspectingRefund(null)}
                        className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-semibold">달성률:</span>
                        <span className="font-black text-indigo-900">{inspectingRefund.achievementRate}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-semibold">검토 상태:</span>
                        <span className="font-bold text-slate-800">{inspectingRefund.contentReviewStatus}</span>
                      </div>
                      {inspectingRefund.contentReviewNotes && (
                        <div className="pt-1 border-t border-slate-200 text-slate-700">
                          <strong>검토 메모:</strong> {inspectingRefund.contentReviewNotes}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <h5 className="text-xs font-bold text-slate-800">
                        게시물 개별 파싱 목록 ({(inspectingRefund.postItems || inspectingRefund.postsReviewed)?.length || 0}건)
                      </h5>
                      {((inspectingRefund.postItems || inspectingRefund.postsReviewed) && (inspectingRefund.postItems || inspectingRefund.postsReviewed)!.length > 0) ? (
                        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs">
                          {(inspectingRefund.postItems || inspectingRefund.postsReviewed)!.map((post: any, idx: number) => (
                            <div key={idx} className="p-3 bg-white space-y-1">
                              <div className="flex items-center justify-between">
                                <a
                                  href={post.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-bold text-blue-600 hover:underline line-clamp-1"
                                >
                                  {post.title || '게시물'}
                                </a>
                                <span className="text-[10px] text-slate-400 font-mono">{post.postedAt || post.date || '-'}</span>
                              </div>
                              <div className="flex items-center justify-between text-[11px] text-slate-500">
                                <span>{post.contentLength ? `글자수: ${post.contentLength}자` : post.platform || ''}</span>
                                {post.isFlagged || post.status === 'invalid' ? (
                                  <span className="text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded">⚠️ {post.flagReason || post.reviewReason || '이상 감지'}</span>
                                ) : (
                                  <span className="text-emerald-600 font-bold">✅ 검토 통과</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg text-center">
                          수집된 세부 포스팅 항목이 없거나 기본 파싱이 완료되었습니다.
                        </p>
                      )}
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="button"
                        onClick={() => setInspectingRefund(null)}
                        className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900"
                      >
                        닫기
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 2) Approval Modal Overlay */}
              {approvingRefund && (
                <div className="fixed inset-0 z-70 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-3 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                        <CheckSquare className="w-4 h-4 text-indigo-600" />
                        <span>환급 자격 승인 처리</span>
                      </h4>
                      <button
                        type="button"
                        onClick={() => setApprovingRefund(null)}
                        className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      <strong>{approvingRefund.participantName || approvingRefund.userName}</strong> 님의 환급 신청을 <strong>[승인]</strong> 처리합니다.
                    </p>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 block">승인 메모</label>
                      <input
                        type="text"
                        value={approvalMemoInput}
                        onChange={(e) => setApprovalMemoInput(e.target.value)}
                        placeholder="예: 달성률 확인 후 환급 승인"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold"
                      />
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setApprovingRefund(null)}
                        className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100"
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (onUpdateRefundStatus) {
                            onUpdateRefundStatus(approvingRefund.id, 'approved', 'approved', approvalMemoInput, '운영진');
                          } else if (onSaveRefund) {
                            onSaveRefund({
                              ...approvingRefund,
                              refundStatus: 'approved',
                              adminDecision: 'approved',
                              adminDecisionReason: approvalMemoInput,
                              approvedAt: new Date().toISOString(),
                              approvedBy: '운영진',
                            });
                          }
                          setFormSuccess(`"${approvingRefund.participantName || approvingRefund.userName}" 님의 환급 신청이 승인되었습니다.`);
                          setApprovingRefund(null);
                        }}
                        className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs"
                      >
                        승인 완료
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 3) Off-site Transfer Completion Modal Overlay */}
              {completingRefund && (
                <div className="fixed inset-0 z-70 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-3 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                        <Coins className="w-4 h-4 text-emerald-600" />
                        <span>계좌 이체 환급 완료 처리</span>
                      </h4>
                      <button
                        type="button"
                        onClick={() => setCompletingRefund(null)}
                        className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="bg-emerald-50 p-3 rounded-xl space-y-1 text-xs border border-emerald-200">
                      <div className="flex justify-between font-bold text-emerald-950">
                        <span>환급 대상자:</span>
                        <span>{completingRefund.participantName || completingRefund.userName} ({completingRefund.bankAccountHolder || completingRefund.bankOwner || '계좌주 미입력'})</span>
                      </div>
                      <div className="flex justify-between text-emerald-900">
                        <span>이체 계좌:</span>
                        <span className="font-mono font-bold">{completingRefund.bankName || '은행'} {completingRefund.bankAccountNumber || completingRefund.bankAccount || '계좌번호 미등록'}</span>
                      </div>
                      <div className="flex justify-between text-emerald-900 font-black pt-1 border-t border-emerald-200">
                        <span>실제 송금할 금액:</span>
                        <span className="text-sm text-emerald-900">{((completingRefund.eligibleAmount ?? completingRefund.calculatedRefundAmount) ?? 0).toLocaleString()}원</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">송금 담당자 이름 *</label>
                        <input
                          type="text"
                          value={operatorNameInput}
                          onChange={(e) => setOperatorNameInput(e.target.value)}
                          placeholder="운영자 성명"
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">송금 메모 / 이체 참조번호</label>
                        <input
                          type="text"
                          value={completionMemoInput}
                          onChange={(e) => setCompletionMemoInput(e.target.value)}
                          placeholder="예: 카카오뱅크 이체 완료, 거래번호 12345"
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setCompletingRefund(null)}
                        className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100"
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (onUpdateRefundStatus) {
                            onUpdateRefundStatus(
                              completingRefund.id,
                              'completed',
                              'approved',
                              undefined,
                              operatorNameInput.trim() || '운영진',
                              completionMemoInput.trim() || '계좌 이체 완료'
                            );
                          } else if (onSaveRefund) {
                            onSaveRefund({
                              ...completingRefund,
                              refundStatus: 'completed',
                              adminDecision: 'approved',
                              completedAt: new Date().toISOString(),
                              completedBy: operatorNameInput.trim() || '운영진',
                              memo: completionMemoInput.trim(),
                            });
                          }
                          setFormSuccess(`💸 "${completingRefund.participantName || completingRefund.userName}" 님의 환급금이 송금 완료 기록 처리되었습니다.`);
                          setCompletingRefund(null);
                        }}
                        className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs flex items-center gap-1"
                      >
                        <Coins className="w-3.5 h-3.5" />
                        <span>환급 완료 기록 저장</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 4) Refund Rejection Modal Overlay */}
              {rejectingRefund && (
                <div className="fixed inset-0 z-70 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-3 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                        <XCircle className="w-4 h-4 text-rose-600" />
                        <span>환급 거절 사유 입력</span>
                      </h4>
                      <button
                        type="button"
                        onClick={() => setRejectingRefund(null)}
                        className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      <strong>{rejectingRefund.userName}</strong> 님의 환급 거절 사유를 입력합니다.
                    </p>
                    <input
                      type="text"
                      value={refundRejectionReasonInput}
                      onChange={(e) => setRefundRejectionReasonInput(e.target.value)}
                      placeholder="예: 필수 미션 미달성, 무성의 포스팅 등"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold"
                      autoFocus
                    />
                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setRejectingRefund(null)}
                        className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100"
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (onUpdateRefundStatus) {
                            onUpdateRefundStatus(
                              rejectingRefund.id,
                              'rejected',
                              'rejected',
                              refundRejectionReasonInput.trim() || '환급 조건 미달'
                            );
                          } else if (onSaveRefund) {
                            onSaveRefund({
                              ...rejectingRefund,
                              refundStatus: 'rejected',
                              adminDecision: 'rejected',
                              adminDecisionReason: refundRejectionReasonInput.trim() || '환급 조건 미달',
                            });
                          }
                          setFormSuccess(`"${rejectingRefund.userName}" 님의 환급 거절 처리가 완료되었습니다.`);
                          setRejectingRefund(null);
                        }}
                        className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs"
                      >
                        거절 처리
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: 참가자 목록 관리 및 삭제 */}

          {/* TAB 3: 참가자 목록 관리 및 삭제 */}
          {activeTab === 'participantList' && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="참가자 이름 또는 계정 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 text-xs rounded-lg text-slate-800"
                />
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
                {filteredParticipantList.length === 0 ? (
                  <p className="p-6 text-center text-slate-400">등록된 참가자가 없습니다.</p>
                ) : (
                  filteredParticipantList.map((p, idx) => (
                    <div key={`modal_part_${p.id}_${idx}`} className="p-3 bg-white flex items-center justify-between hover:bg-slate-50">
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-900">{p.participantName}</span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-100 text-slate-700 font-semibold">
                            {p.groupName}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-mono">
                          블로그: {p.blogId ? `@${p.blogId}` : '-'} | 트위터: {p.twitterId || '-'}
                        </p>
                      </div>

                      <div className="flex items-center space-x-1.5">
                        <button
                          onClick={() => setEditingParticipant({ ...p })}
                          className="px-2.5 py-1 text-xs text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 border border-indigo-200 rounded-md transition-colors cursor-pointer flex items-center gap-1 font-semibold"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>수정</span>
                        </button>
                        <button
                          onClick={() => {
                            onDeleteParticipant(p.id);
                          }}
                          className="px-2.5 py-1 text-xs text-rose-600 hover:text-rose-800 hover:bg-rose-50 border border-rose-200 rounded-md transition-colors cursor-pointer flex items-center gap-1 font-semibold"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>삭제</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB: 성과 뱃지 관리 */}
          {activeTab === 'badgeManage' && (
            <AdminBadgeManagementTab
              participants={participants}
              revenueCertifications={revenueCertifications}
              onShowToast={(msg) => setFormSuccess(msg)}
            />
          )}

          {/* TAB: 구매 등급별 기능 접근 권한 및 AI 사용량 관리 */}
          {activeTab === 'membershipManage' && (
            <AdminMembershipManagementTab />
          )}

          {/* TAB: 공지사항, FAQ, Q&A 통합 관리 */}
          {activeTab === 'boardManage' && (
            <AdminBoardManagementTab
              announcements={announcements}
              faqs={faqs}
              qnaPosts={qnaPosts}
              groups={groups}
              participants={participants}
              onAddAnnouncement={onAddAnnouncement || (() => {})}
              onUpdateAnnouncement={onUpdateAnnouncement || (() => {})}
              onDeleteAnnouncement={onDeleteAnnouncement || (() => {})}
              onAddFaq={onAddFaq || (() => {})}
              onUpdateFaq={onUpdateFaq || (() => {})}
              onDeleteFaq={onDeleteFaq || (() => {})}
              onReorderFaqs={onReorderFaqs || (() => {})}
              onAddQna={onAddQna || (() => {})}
              onUpdateQna={onUpdateQna || (() => {})}
              onDeleteQna={onDeleteQna || (() => {})}
              onAnswerQna={onAnswerQna || (() => {})}
              onShowToast={(msg) => setFormSuccess(msg)}
            />
          )}

          {/* TAB: 메뉴 탭 이름 및 뱃지 설정 */}
          {activeTab === 'navManage' && (
            <AdminNavigationTab
              navTabsConfig={navTabsConfig}
              onNavTabFieldChange={handleNavTabFieldChange}
              onResetNavTabs={handleResetNavTabs}
              onSaveNavTabs={handleSaveNavTabs}
              isSaving={isSavingNavTabs}
              feedback={navSaveFeedback}
            />
          )}

          {/* TAB 4: 운영자 비밀번호 변경 */}
          {activeTab === 'passwordChange' && (
            <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
              <div className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-xl text-xs text-purple-900 flex items-start gap-2">
                <KeyRound className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">운영자 접속 비밀번호 설정</p>
                  <p className="text-purple-700 text-[11px] mt-0.5">
                    새 비밀번호로 변경 시 브라우저 보안 저장소(LocalStorage)에 저장되어 다음 로그인부터 즉시 적용됩니다.
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  <span>현재 운영자 비밀번호 *</span>
                </label>
                <input
                  type="password"
                  placeholder="현재 사용 중인 비밀번호 입력"
                  value={currentPasswordInput}
                  onChange={(e) => setCurrentPasswordInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 font-mono focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                  <span>변경할 새 비밀번호 *</span>
                </label>
                <input
                  type="password"
                  placeholder="새 비밀번호 입력 (4자 이상)"
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 font-mono focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />
                  <span>새 비밀번호 확인 *</span>
                </label>
                <input
                  type="password"
                  placeholder="새 비밀번호 재입력"
                  value={confirmPasswordInput}
                  onChange={(e) => setConfirmPasswordInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 font-mono focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 active:scale-98 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>비밀번호 변경하기</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 4: 참가비 / 입금 확인 관리 */}
          {activeTab === 'paymentsManage' && (
            <div className="space-y-4">
              {/* KPI Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-center">
                  <span className="text-[10px] font-bold text-slate-500 block">전체 신청</span>
                  <span className="text-base font-black text-slate-900">{payments.length}건</span>
                </div>
                <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl text-center">
                  <span className="text-[10px] font-bold text-amber-700 block">입금 확인 대기</span>
                  <span className="text-base font-black text-amber-800">
                    {payments.filter((p) => p.status === 'submitted' || p.status === 'pending').length}건
                  </span>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl text-center">
                  <span className="text-[10px] font-bold text-emerald-700 block">승인 완료</span>
                  <span className="text-base font-black text-emerald-800">
                    {payments.filter((p) => p.status === 'approved').length}건
                  </span>
                </div>
                <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-xl text-center">
                  <span className="text-[10px] font-bold text-rose-700 block">거절됨</span>
                  <span className="text-base font-black text-rose-800">
                    {payments.filter((p) => p.status === 'rejected').length}건
                  </span>
                </div>
                <div className="bg-indigo-50 border border-indigo-200 p-2.5 rounded-xl text-center col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-bold text-indigo-700 block">총 승인 금액</span>
                  <span className="text-base font-black text-indigo-900">
                    {payments
                      .filter((p) => p.status === 'approved')
                      .reduce((sum, p) => sum + (p.amount || 0), 0)
                      .toLocaleString()}원
                  </span>
                </div>
              </div>

              {/* Filter Tabs & Search Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200 text-xs">
                <div className="flex items-center space-x-1 overflow-x-auto">
                  {(['submitted', 'all', 'approved', 'rejected'] as const).map((st) => {
                    const label =
                      st === 'submitted'
                        ? `확인 대기 (${payments.filter((p) => p.status === 'submitted' || p.status === 'pending').length})`
                        : st === 'all'
                        ? `전체 (${payments.length})`
                        : st === 'approved'
                        ? `승인 완료 (${payments.filter((p) => p.status === 'approved').length})`
                        : `거절 (${payments.filter((p) => p.status === 'rejected').length})`;
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setPaymentStatusFilter(st as any)}
                        className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors cursor-pointer whitespace-nowrap ${
                          paymentStatusFilter === st
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'bg-white text-slate-600 hover:bg-slate-200/80 border border-slate-200'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                <div className="relative min-w-[180px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={paymentSearchTerm}
                    onChange={(e) => setPaymentSearchTerm(e.target.value)}
                    placeholder="입금자명 / 신청자 / 챌린지명 검색"
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-medium"
                  />
                </div>
              </div>

              {/* Payment List Table */}
              {(() => {
                const filtered = payments.filter((p) => {
                  if (paymentStatusFilter === 'submitted') {
                    if (p.status !== 'submitted' && p.status !== 'pending') return false;
                  } else if (paymentStatusFilter !== 'all') {
                    if (p.status !== paymentStatusFilter) return false;
                  }

                  if (paymentSearchTerm.trim()) {
                    const term = paymentSearchTerm.toLowerCase();
                    const matchName = p.depositorName?.toLowerCase().includes(term);
                    const matchUser = p.userName?.toLowerCase().includes(term) || p.userEmail?.toLowerCase().includes(term);
                    const matchChallenge = p.challengeName?.toLowerCase().includes(term);
                    return matchName || matchUser || matchChallenge;
                  }
                  return true;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                      <CreditCard className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="text-xs font-bold text-slate-600">신청 내역이 없습니다.</p>
                      <p className="text-[11px] text-slate-400">
                        {paymentStatusFilter === 'submitted'
                          ? '현재 확인 대기 중인 입금 확인 신청이 없습니다.'
                          : '선택한 조건에 해당하는 참가비 신청 데이터가 존재하지 않습니다.'}
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs bg-white">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                            <th className="p-3">신청일시</th>
                            <th className="p-3">챌린지명</th>
                            <th className="p-3">신청 회원</th>
                            <th className="p-3">입금자명 / 입금일</th>
                            <th className="p-3 text-right">금액</th>
                            <th className="p-3 text-center">상태</th>
                            <th className="p-3 text-center">관리 승인/거절</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-800">
                          {filtered.map((p, idx) => (
                            <tr key={`pay_${p.id}_${idx}`} className="hover:bg-slate-50/80 transition-colors">
                              <td className="p-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                                {p.submittedAt ? p.submittedAt.split('T')[0] : '-'}
                              </td>
                              <td className="p-3 font-bold text-slate-900 whitespace-nowrap">
                                {p.challengeName || p.challengeId}
                              </td>
                              <td className="p-3">
                                <div className="font-bold text-slate-900">{p.userName || '미입력'}</div>
                                <div className="text-[11px] text-slate-400 font-mono">{p.userEmail || p.userId}</div>
                              </td>
                              <td className="p-3">
                                <div className="font-extrabold text-indigo-900">{p.depositorName}</div>
                                <div className="text-[11px] text-slate-500 font-medium">입금일: {p.depositedAt}</div>
                              </td>
                              <td className="p-3 text-right font-black text-slate-900 whitespace-nowrap">
                                {p.amount.toLocaleString()}원
                              </td>
                              <td className="p-3 text-center whitespace-nowrap">
                                {p.status === 'submitted' || p.status === 'pending' ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                                    <Clock className="w-3 h-3 text-amber-600" />
                                    확인 대기
                                  </span>
                                ) : p.status === 'approved' ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    승인 완료
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200" title={p.rejectionReason}>
                                    <X className="w-3 h-3 text-rose-600" />
                                    거절됨
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-center whitespace-nowrap">
                                <div className="flex items-center justify-center gap-1.5">
                                  {p.status !== 'approved' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (onApprovePayment) {
                                          onApprovePayment(p.id);
                                          setFormSuccess(`"${p.depositorName}" 님의 입금 확인 및 참가 승인이 완료되었습니다.`);
                                        }
                                      }}
                                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-all cursor-pointer shadow-2xs flex items-center gap-1 active:scale-95"
                                    >
                                      <UserCheck className="w-3.5 h-3.5" />
                                      <span>승인</span>
                                    </button>
                                  )}

                                  {p.status !== 'rejected' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRejectingPaymentId(p.id);
                                        setRejectionReasonInput('입금자명/입금 내역 미확인');
                                      }}
                                      className="px-2.5 py-1 rounded-lg bg-slate-200 hover:bg-rose-100 text-slate-700 hover:text-rose-800 font-bold text-[11px] transition-all cursor-pointer border border-slate-300 hover:border-rose-300 flex items-center gap-1 active:scale-95"
                                    >
                                      <UserX className="w-3.5 h-3.5" />
                                      <span>거절</span>
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {/* Rejection Modal Overlay */}
              {rejectingPaymentId && (
                <div className="fixed inset-0 z-70 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-3 shadow-2xl border border-stone-200 animate-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                      <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                        <UserX className="w-4 h-4 text-rose-600" />
                        <span>입금 거절 사유 입력</span>
                      </h4>
                      <button
                        type="button"
                        onClick={() => setRejectingPaymentId(null)}
                        className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      신청자에게 전달될 입금 확인 거절 사유를 입력해 주세요.
                    </p>
                    <input
                      type="text"
                      value={rejectionReasonInput}
                      onChange={(e) => setRejectionReasonInput(e.target.value)}
                      placeholder="예: 입금자명 불일치, 입금액 부족 등"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold"
                      autoFocus
                    />
                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setRejectingPaymentId(null)}
                        className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100"
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (onRejectPayment && rejectingPaymentId) {
                            onRejectPayment(rejectingPaymentId, rejectionReasonInput.trim() || '입금 내역 미확인');
                            setFormSuccess('입금 확인 신청 거절 처리가 완료되었습니다.');
                          }
                          setRejectingPaymentId(null);
                        }}
                        className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs"
                      >
                        거절 처리
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: 수익 인증 심사 및 관리 */}
          {activeTab === 'revenueManage' && (
            <div className="space-y-4">
              {/* KPI Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-center">
                  <span className="text-[10px] font-bold text-slate-500 block">전체 인증글</span>
                  <span className="text-base font-black text-slate-900">{revenueCertifications.length}건</span>
                </div>
                <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl text-center">
                  <span className="text-[10px] font-bold text-amber-700 block">심사 대기</span>
                  <span className="text-base font-black text-amber-800">
                    {revenueCertifications.filter((c) => c.status === 'pending').length}건
                  </span>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl text-center">
                  <span className="text-[10px] font-bold text-emerald-700 block">승인 완료</span>
                  <span className="text-base font-black text-emerald-800">
                    {revenueCertifications.filter((c) => c.status === 'approved').length}건
                  </span>
                </div>
                <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-xl text-center">
                  <span className="text-[10px] font-bold text-rose-700 block">반려됨</span>
                  <span className="text-base font-black text-rose-800">
                    {revenueCertifications.filter((c) => c.status === 'rejected').length}건
                  </span>
                </div>
              </div>

              {/* Filters & Search */}
              <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
                <div className="flex items-center gap-1 w-full sm:w-auto overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setRevenueStatusFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      revenueStatusFilter === 'all'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    전체 ({revenueCertifications.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRevenueStatusFilter('pending')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      revenueStatusFilter === 'pending'
                        ? 'bg-amber-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    심사 대기 ({revenueCertifications.filter((c) => c.status === 'pending').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRevenueStatusFilter('approved')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      revenueStatusFilter === 'approved'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    승인 ({revenueCertifications.filter((c) => c.status === 'approved').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRevenueStatusFilter('rejected')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      revenueStatusFilter === 'rejected'
                        ? 'bg-rose-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    반려 ({revenueCertifications.filter((c) => c.status === 'rejected').length})
                  </button>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={revenueSearchTerm}
                    onChange={(e) => setRevenueSearchTerm(e.target.value)}
                    placeholder="작성자 / 블로그ID / 제목 검색"
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-amber-500 font-medium"
                  />
                </div>
              </div>

              {/* Revenue Certification Table */}
              {(() => {
                const filtered = revenueCertifications.filter((cert) => {
                  if (revenueStatusFilter !== 'all' && cert.status !== revenueStatusFilter) {
                    return false;
                  }
                  if (revenueSearchTerm.trim()) {
                    const term = revenueSearchTerm.toLowerCase();
                    const matchUser = cert.userName?.toLowerCase().includes(term) || cert.userEmail?.toLowerCase().includes(term);
                    const matchBlog = cert.naverBlogId?.toLowerCase().includes(term);
                    const matchTitle = cert.title?.toLowerCase().includes(term);
                    return matchUser || matchBlog || matchTitle;
                  }
                  return true;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                      <Award className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="text-xs font-bold text-slate-600">수익 인증글이 없습니다.</p>
                      <p className="text-[11px] text-slate-400">
                        {revenueStatusFilter === 'pending'
                          ? '현재 심사 대기 중인 수익 인증글이 없습니다.'
                          : '조건에 해당하는 수익 인증 내역이 존재하지 않습니다.'}
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs bg-white">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                            <th className="p-3">신청일시</th>
                            <th className="p-3">챌린저</th>
                            <th className="p-3">제목 / 내용 요약</th>
                            <th className="p-3 text-right">인증 금액</th>
                            <th className="p-3 text-center">증빙 이미지</th>
                            <th className="p-3 text-center">상태</th>
                            <th className="p-3 text-center">심사 처리</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-800">
                          {filtered.map((cert) => (
                            <tr key={cert.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="p-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                                {cert.createdAt ? cert.createdAt.split('T')[0] : '-'}
                              </td>
                              <td className="p-3 whitespace-nowrap">
                                <div className="font-bold text-slate-900">{cert.userName || '미입력'}</div>
                                <div className="text-[11px] text-slate-400 font-mono">
                                  {cert.naverBlogId ? `@${cert.naverBlogId}` : cert.userEmail || '-'}
                                </div>
                              </td>
                              <td className="p-3 max-w-xs">
                                <div className="flex items-center gap-1.5">
                                  {cert.isFeatured && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-500 text-white shrink-0">
                                      명예
                                    </span>
                                  )}
                                  <span className="font-bold text-slate-900 line-clamp-1">{cert.title}</span>
                                </div>
                                <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{cert.content}</p>
                              </td>
                              <td className="p-3 text-right font-black text-amber-600 whitespace-nowrap text-sm">
                                {cert.revenueAmount ? `${cert.revenueAmount.toLocaleString()}원` : '비공개'}
                              </td>
                              <td className="p-3 text-center whitespace-nowrap">
                                {cert.proofImageUrl ? (
                                  <button
                                    type="button"
                                    onClick={() => setInspectingRevenueCert(cert)}
                                    className="relative inline-block w-10 h-10 rounded-lg overflow-hidden border border-slate-200 hover:border-amber-400 hover:shadow-xs group cursor-pointer"
                                  >
                                    <img
                                      src={cert.proofImageUrl}
                                      alt="증빙"
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                      referrerPolicy="no-referrer"
                                    />
                                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Maximize2 className="w-3.5 h-3.5 text-white drop-shadow-sm" />
                                    </div>
                                  </button>
                                ) : (
                                  <span className="text-[11px] text-slate-400">없음</span>
                                )}
                              </td>
                              <td className="p-3 text-center whitespace-nowrap">
                                {cert.status === 'pending' ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                                    <Clock className="w-3 h-3 text-amber-600" />
                                    심사 대기
                                  </span>
                                ) : cert.status === 'approved' ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    승인 완료
                                  </span>
                                ) : (
                                  <span
                                    className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200 cursor-help"
                                    title={cert.rejectionReason}
                                  >
                                    <X className="w-3 h-3 text-rose-600" />
                                    반려됨
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-center whitespace-nowrap">
                                <div className="flex items-center justify-center gap-1">
                                  {cert.status !== 'approved' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (onUpdateRevenueCertStatus) {
                                          onUpdateRevenueCertStatus(cert.id, 'approved');
                                          setFormSuccess(`"${cert.userName}" 님의 수익 인증글이 승인되었습니다.`);
                                        }
                                      }}
                                      className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-all cursor-pointer shadow-2xs flex items-center gap-0.5 active:scale-95"
                                    >
                                      <Check className="w-3 h-3" />
                                      <span>승인</span>
                                    </button>
                                  )}

                                  {/* Toggle featured */}
                                  {cert.status === 'approved' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (onUpdateRevenueCertStatus) {
                                          onUpdateRevenueCertStatus(cert.id, 'approved', {
                                            isFeatured: !cert.isFeatured,
                                          });
                                          setFormSuccess(
                                            cert.isFeatured
                                              ? '명예의 전당 추천이 해제되었습니다.'
                                              : '명예의 전당 추천으로 등록되었습니다!'
                                          );
                                        }
                                      }}
                                      className={`px-2 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer border flex items-center gap-0.5 active:scale-95 ${
                                        cert.isFeatured
                                          ? 'bg-amber-50 text-amber-700 border-amber-300'
                                          : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-amber-50 hover:text-amber-700'
                                      }`}
                                      title="명예의 전당 추천 토글"
                                    >
                                      <Trophy className="w-3 h-3" />
                                      <span>{cert.isFeatured ? '추천해제' : '명예추천'}</span>
                                    </button>
                                  )}

                                  {cert.status !== 'rejected' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRejectingRevenueCertId(cert.id);
                                        setRevenueRejectionReasonInput('증빙 이미지 확인 불가 또는 불명확');
                                      }}
                                      className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 font-bold text-[11px] transition-all cursor-pointer border border-slate-300 hover:border-rose-300 flex items-center gap-0.5 active:scale-95"
                                    >
                                      <X className="w-3 h-3" />
                                      <span>반려</span>
                                    </button>
                                  )}

                                  {onDeleteRevenueCert && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (confirm(`"${cert.title}" 인증글을 정말 삭제하시겠습니까?`)) {
                                          onDeleteRevenueCert(cert.id);
                                          setFormSuccess('수익 인증글이 삭제되었습니다.');
                                        }
                                      }}
                                      className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                      title="삭제"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {/* Revenue Certification Rejection Modal Overlay */}
              {rejectingRevenueCertId && (
                <div className="fixed inset-0 z-70 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-3 shadow-2xl border border-stone-200 animate-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                      <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                        <XCircle className="w-4 h-4 text-rose-600" />
                        <span>수익 인증 반려 사유 입력</span>
                      </h4>
                      <button
                        type="button"
                        onClick={() => setRejectingRevenueCertId(null)}
                        className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      신청자에게 표시될 반려 사유를 입력해 주세요.
                    </p>
                    <input
                      type="text"
                      value={revenueRejectionReasonInput}
                      onChange={(e) => setRevenueRejectionReasonInput(e.target.value)}
                      placeholder="예: 캡처 화질 불량, 수익 내역 식별 불가 등"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold"
                      autoFocus
                    />
                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setRejectingRevenueCertId(null)}
                        className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100"
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (onUpdateRevenueCertStatus && rejectingRevenueCertId) {
                            onUpdateRevenueCertStatus(rejectingRevenueCertId, 'rejected', {
                              rejectionReason: revenueRejectionReasonInput.trim() || '증빙 자료 확인 불가',
                            });
                            setFormSuccess('수익 인증 반려 처리가 완료되었습니다.');
                          }
                          setRejectingRevenueCertId(null);
                        }}
                        className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs"
                      >
                        반려 처리
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Inspect Image Overlay Modal */}
              {inspectingRevenueCert && (
                <div className="fixed inset-0 z-70 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="bg-white rounded-2xl max-w-2xl w-full p-4 space-y-3 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <Award className="w-5 h-5 text-amber-500" />
                        <div>
                          <h4 className="font-extrabold text-sm text-slate-900">{inspectingRevenueCert.title}</h4>
                          <p className="text-[11px] text-slate-500">
                            {inspectingRevenueCert.userName} · {inspectingRevenueCert.revenueAmount?.toLocaleString()}원
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setInspectingRevenueCert(null)}
                        className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {inspectingRevenueCert.proofImageUrl && (
                      <div className="rounded-xl overflow-hidden bg-slate-950 flex items-center justify-center max-h-[50vh]">
                        <img
                          src={inspectingRevenueCert.proofImageUrl}
                          alt="증빙 원본"
                          className="max-h-[50vh] w-auto object-contain"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    )}

                    <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                      {inspectingRevenueCert.content}
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setInspectingRevenueCert(null)}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold"
                      >
                        닫기
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}


          {/* TAB: 트렌드 키워드 수집 관리 */}
          {activeTab === 'trendManage' && (
            <div id="admin-trend-manage-tab" className="space-y-5">
              <div className="p-4 bg-indigo-50/80 border border-indigo-200 rounded-xl text-xs text-indigo-900 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div className="space-y-1">
                  <div className="font-bold text-sm text-indigo-950">네이버 실시간 트렌드 키워드 & 필터 정책 관리</div>
                  <p className="text-slate-600 leading-relaxed">
                    네이버 실시간 검색/뉴스/쇼핑 공식 데이터를 바탕으로 신뢰성 높은 검색어를 수집하고, 블로그 활용성 점수 기준 및 수동 제외 필터 정책을 관리합니다.
                  </p>
                </div>
              </div>

              {/* 1. 네이버 4대 공식 API 연동 상태 모니터링 */}
              <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold text-slate-800">네이버 공식 API 연동 상태 모니터링 (4개 채널)</span>
                  </div>
                  <button
                    type="button"
                    onClick={loadApiHealth}
                    disabled={isLoadingApiHealth}
                    className="text-[11px] font-bold text-slate-600 hover:text-emerald-600 bg-slate-50 hover:bg-emerald-50 border border-slate-200 px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingApiHealth ? 'animate-spin' : ''}`} />
                    <span>상태 새로고침</span>
                  </button>
                </div>

                {apiHealthData?.services ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {Object.entries(apiHealthData.services).map(([key, svc]: [string, any]) => {
                      const isOk = svc.status === 'ok';
                      return (
                        <div
                          key={key}
                          className={`p-3 rounded-xl border text-xs ${
                            isOk
                              ? 'bg-emerald-50/50 border-emerald-200'
                              : 'bg-rose-50/50 border-rose-200'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-slate-800">{svc.name}</span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                isOk ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {isOk ? '정상 (200)' : '점검 필요'}
                            </span>
                          </div>
                          <div className="text-[10.5px] text-slate-500 flex items-center justify-between">
                            <span>지연 시간</span>
                            <span className="font-mono font-semibold text-slate-700">{svc.latencyMs}ms</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 text-center text-xs text-slate-500 bg-slate-50 rounded-lg">
                    {isLoadingApiHealth ? 'API 연결 상태를 확인하고 있습니다...' : 'API 상태 정보를 불러오지 못했습니다.'}
                  </div>
                )}
              </div>

              {/* 2. 실시간 트렌드 키워드 수집 및 정제 정책 관리 (Filter Policy) */}
              <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-bold text-slate-800">키워드 수집 및 정제 필터 정책 설정</span>
                  </div>
                  <button
                    type="button"
                    id="btn-save-filter-policy"
                    onClick={handleSaveFilterPolicy}
                    disabled={isSavingFilterPolicy || isLoadingFilterPolicy}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSavingFilterPolicy ? '저장 중...' : '필터 정책 저장'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left Column: Basic Filter Rules */}
                  <div className="space-y-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                    <h5 className="text-xs font-extrabold text-slate-800 flex items-center gap-1">
                      <span>기본 정제 기준</span>
                    </h5>

                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold text-slate-700 block">
                        최소 키워드 글자 수 (최소 길이 미만 자동 제외)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          id="input-min-keyword-length"
                          type="number"
                          min={1}
                          max={10}
                          value={filterPolicy.minKeywordLength}
                          onChange={(e) =>
                            setFilterPolicy((prev) => ({
                              ...prev,
                              minKeywordLength: Math.max(1, parseInt(e.target.value) || 1),
                            }))
                          }
                          className="w-20 px-2.5 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-lg text-center"
                        />
                        <span className="text-xs text-slate-500">글자 이상 (기본값: 2글자)</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200">
                      <label className="flex items-start gap-2 cursor-pointer select-none">
                        <input
                          id="checkbox-hide-low"
                          type="checkbox"
                          checked={filterPolicy.hideLowUsabilityKeywords}
                          onChange={(e) =>
                            setFilterPolicy((prev) => ({
                              ...prev,
                              hideLowUsabilityKeywords: e.target.checked,
                            }))
                          }
                          className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                        />
                        <div>
                          <span className="text-xs font-bold text-slate-800 block">
                            포괄적/광범위 키워드(LOW) 기본 비표시
                          </span>
                          <span className="text-[11px] text-slate-500 leading-relaxed block mt-0.5">
                            검색의도가 불명확하거나 너무 넓은 포괄 키워드(55점 미만)를 기본 목록에서 숨기고 사용자 옵션으로만 제공합니다.
                          </span>
                        </div>
                      </label>
                    </div>

                    <div className="pt-2 border-t border-slate-200 space-y-1.5">
                      <label className="text-[11px] font-semibold text-slate-700 block">
                        제외 키워드 정규식/패턴 (줄바꿈 또는 쉼표 구분)
                      </label>
                      <textarea
                        id="textarea-exclusion-patterns"
                        rows={3}
                        value={exclusionPatternsTextInput}
                        onChange={(e) => setExclusionPatternsTextInput(e.target.value)}
                        placeholder="예: ^[0-9]+$, 날씨$, ^[a-zA-Z]{1,2}$"
                        className="w-full p-2 text-xs border border-slate-300 rounded-lg bg-white font-mono"
                      />
                      <p className="text-[10px] text-slate-500">
                        * 해당 패턴에 매칭되는 키워드는 실시간 목록에서 자동 배제됩니다.
                      </p>
                    </div>
                  </div>

                  {/* Right Column: Manual Excluded Keywords List */}
                  <div className="space-y-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="text-xs font-extrabold text-slate-800 flex items-center gap-1">
                          <span>수동 제외 키워드 목록 ({filterPolicy.manualExcludedKeywords?.length || 0}개)</span>
                        </h5>
                      </div>

                      {/* Add new excluded keyword */}
                      <div className="flex gap-1.5 mb-2.5">
                        <input
                          id="input-new-excluded-keyword"
                          type="text"
                          value={newExcludedKeywordInput}
                          onChange={(e) => setNewExcludedKeywordInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddExcludedKeyword();
                            }
                          }}
                          placeholder="제외할 키워드 입력 후 엔터"
                          className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                        />
                        <button
                          type="button"
                          id="btn-add-excluded-keyword"
                          onClick={handleAddExcludedKeyword}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold cursor-pointer"
                        >
                          추가
                        </button>
                      </div>

                      {/* Excluded Keywords Tag Cloud */}
                      <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-2 bg-white rounded-lg border border-slate-200 min-h-[100px]">
                        {filterPolicy.manualExcludedKeywords?.length === 0 ? (
                          <span className="text-xs text-slate-400 m-auto">등록된 수동 제외 키워드가 없습니다.</span>
                        ) : (
                          filterPolicy.manualExcludedKeywords?.map((kw) => (
                            <span
                              key={kw}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-rose-50 text-rose-800 border border-rose-200"
                            >
                              <span className="font-semibold">{kw}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveExcludedKeyword(kw)}
                                className="text-rose-400 hover:text-rose-700 ml-0.5"
                                title="제외 해제"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))
                        )}
                      </div>
                    </div>

                    <p className="text-[10px] text-slate-500 mt-2">
                      * 이 목록에 등록된 단어는 트렌드 키워드 수집 시 영구 필터링됩니다.
                    </p>
                  </div>
                </div>
              </div>

              {/* 3. 실시간 급상승 키워드 수집 테스트 (Collection Test) */}
              <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-100 pb-2.5">
                  <div>
                    <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-amber-500" />
                      <span>실시간 급상승 키워드 수집 & 정제 테스트</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      현재 설정된 필터 정책 및 블로그 활용도 알고리즘을 적용하여 실시간 수집을 즉시 시뮬레이션합니다.
                    </p>
                  </div>

                  <button
                    type="button"
                    id="btn-run-collection-test"
                    onClick={handleRunCollectionTest}
                    disabled={isTestingCollection}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTestingCollection ? 'animate-spin' : ''}`} />
                    <span>{isTestingCollection ? '수집 테스트 실행 중...' : '실시간 수집 테스트 실행'}</span>
                  </button>
                </div>

                {testCollectionResult && (
                  <div className="space-y-3 pt-2">
                    {/* Metrics Summary */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                        <div className="text-[10px] text-slate-500">원본 수집 (Raw)</div>
                        <div className="text-base font-black text-slate-900 mt-0.5">
                          {testCollectionResult.rawCollectedCount}개
                        </div>
                      </div>
                      <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                        <div className="text-[10px] text-emerald-700 font-bold">정제 후 표시</div>
                        <div className="text-base font-black text-emerald-900 mt-0.5">
                          {testCollectionResult.finalKeywordsCount}개
                        </div>
                      </div>
                      <div className="p-2.5 bg-emerald-50/60 border border-emerald-100 rounded-xl">
                        <div className="text-[10px] text-emerald-700">HIGH (80점+)</div>
                        <div className="text-base font-black text-emerald-800 mt-0.5">
                          {testCollectionResult.highUsabilityCount}개
                        </div>
                      </div>
                      <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-xl">
                        <div className="text-[10px] text-indigo-700">MEDIUM (55~79점)</div>
                        <div className="text-base font-black text-indigo-900 mt-0.5">
                          {testCollectionResult.mediumUsabilityCount}개
                        </div>
                      </div>
                      <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-xl">
                        <div className="text-[10px] text-rose-700">필터링 제외</div>
                        <div className="text-base font-black text-rose-900 mt-0.5">
                          {testCollectionResult.filteredOutCount}개
                        </div>
                      </div>
                    </div>

                    {/* Result Keywords Table */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                      <div className="bg-slate-100 px-3.5 py-2 border-b border-slate-200 text-xs font-bold text-slate-700 flex items-center justify-between">
                        <span>테스트 수집 키워드 목록 (상위 15건)</span>
                        <span className="text-[11px] font-normal text-slate-500">
                          실행 소요시간: {testCollectionResult.executionTimeMs}ms
                        </span>
                      </div>

                      <div className="overflow-x-auto max-h-72 overflow-y-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold sticky top-0">
                            <tr>
                              <th className="py-2 px-3 text-center w-12">순위</th>
                              <th className="py-2 px-3">키워드</th>
                              <th className="py-2 px-3 text-center w-28">블로그 활용성</th>
                              <th className="py-2 px-3 text-center w-28">상태</th>
                              <th className="py-2 px-3 text-center w-20">관리</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {testCollectionResult.keywords?.slice(0, 15).map((item: any) => (
                              <tr key={item.rank} className="hover:bg-slate-50">
                                <td className="py-2 px-3 text-center font-bold text-slate-700">
                                  {item.rank}
                                </td>
                                <td className="py-2 px-3 font-extrabold text-slate-900">
                                  <a
                                    href={`https://search.naver.com/search.naver?query=${encodeURIComponent(item.keyword)}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="hover:text-emerald-600 hover:underline flex items-center gap-1"
                                  >
                                    <span>{item.keyword}</span>
                                    <ExternalLink className="w-3 h-3 opacity-40" />
                                  </a>
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <span className="font-bold text-slate-800 font-mono">
                                    {item.blogUsabilityScore}점
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      item.status === 'HIGH'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : item.status === 'MEDIUM'
                                        ? 'bg-indigo-100 text-indigo-800'
                                        : 'bg-slate-100 text-slate-700'
                                    }`}
                                  >
                                    {item.status}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!filterPolicy.manualExcludedKeywords.includes(item.keyword)) {
                                        setFilterPolicy((prev) => ({
                                          ...prev,
                                          manualExcludedKeywords: [...prev.manualExcludedKeywords, item.keyword],
                                        }));
                                        setFormSuccess(`'${item.keyword}' 키워드를 제외 목록에 임시 추가했습니다. [필터 정책 저장]을 눌러 반영하세요.`);
                                      }
                                    }}
                                    className="px-2 py-0.5 text-[10px] font-semibold text-rose-600 hover:bg-rose-50 rounded border border-rose-200"
                                  >
                                    제외
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 4. 기존 황금 키워드 수집 관리 (보존) */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <div className="text-xs font-bold text-slate-800">카테고리별 황금 키워드 전체 수집</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    전체 14개 카테고리에 대한 키워드를 즉시 수집하고 결과를 확인합니다.
                  </div>
                </div>

                <button
                  type="button"
                  id="btn-collect-trends-now"
                  onClick={handleTriggerTrendsCollect}
                  disabled={isCollectingTrends}
                  className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 cursor-pointer transition-all shadow-xs shrink-0 ${
                    isCollectingTrends
                      ? 'bg-indigo-400 text-white cursor-not-allowed opacity-80'
                      : 'bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white'
                  }`}
                >
                  <RefreshCw className={`w-4 h-4 ${isCollectingTrends ? 'animate-spin' : ''}`} />
                  <span>{isCollectingTrends ? '키워드 수집 중...' : '키워드 지금 수집하기'}</span>
                </button>
              </div>

              {/* Trend Categories & Seeds Management Section */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                  <div className="flex items-center gap-2">
                    <FolderPlus className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-bold text-slate-800">
                      트렌드 카테고리 및 시드(Seeds) 키워드 관리 ({adminCategories.length}개)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetCategoriesToDefault}
                    className="text-[10px] font-bold text-slate-500 hover:text-indigo-600 bg-white hover:bg-indigo-50 border border-slate-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    기본 14개 카테고리로 초기화
                  </button>
                </div>

                <p className="text-[11px] text-slate-600 leading-relaxed">
                  각 카테고리별로 네이버 데이터랩 및 연관검색어를 탐색할 <strong>시드 키워드(Seed Keywords)</strong>를 관리합니다. 시드가 풍부할수록 더 다양한 황금 키워드가 발굴됩니다.
                </p>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {adminCategories.map((cat) => {
                    const isEditing = editingCategory?.id === cat.id;

                    return (
                      <div
                        key={cat.id}
                        className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 text-xs hover:border-indigo-200 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-900">{cat.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">({cat.id})</span>
                            <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold text-[10px]">
                              시드 {cat.seeds?.length || 0}개
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                if (isEditing) {
                                  setEditingCategory(null);
                                } else {
                                  setEditingCategory(cat);
                                  setEditingSeedsText((cat.seeds || []).join(', '));
                                }
                              }}
                              className="px-2 py-1 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50 rounded transition-colors cursor-pointer"
                            >
                              {isEditing ? '취소' : '시드 편집'}
                            </button>
                          </div>
                        </div>

                        {isEditing ? (
                          <div className="space-y-2 pt-1 border-t border-slate-100 animate-in fade-in">
                            <label className="text-[10px] font-bold text-slate-600 block">
                              시드 키워드 목록 (쉼표 , 로 구분하여 입력)
                            </label>
                            <textarea
                              value={editingSeedsText}
                              onChange={(e) => setEditingSeedsText(e.target.value)}
                              rows={2}
                              className="w-full p-2 text-xs border border-indigo-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-indigo-50/20"
                              placeholder="예: 국내여행, 제주도 여행, 강릉 가볼만한곳, 호캉스"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingCategory(null)}
                                className="px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded cursor-pointer"
                              >
                                닫기
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const parsed = editingSeedsText
                                    .split(/[,;\n]+/)
                                    .map((s) => s.trim())
                                    .filter(Boolean);
                                  handleSaveCategoryConfig(cat, parsed);
                                }}
                                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold cursor-pointer"
                              >
                                저장하기
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {(cat.seeds || []).slice(0, 10).map((seed, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10.5px] font-medium"
                              >
                                {seed}
                              </span>
                            ))}
                            {(cat.seeds?.length || 0) > 10 && (
                              <span className="text-[10px] text-slate-400 self-center">
                                +{(cat.seeds?.length || 0) - 10}개 더보기
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Status or Results Display */}
              {isCollectingTrends && (
                <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-center gap-3 text-indigo-900 text-xs font-semibold animate-pulse">
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                  <span>네이버 데이터랩 및 검색광고 API를 통해 카테고리별 후보 키워드와 검색량을 수집하고 있습니다. 잠시만 기다려 주세요...</span>
                </div>
              )}

              {trendCollectResult && !isCollectingTrends && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>수집 결과 요약</span>
                    </h4>
                    <span className="text-[11px] text-slate-400">
                      수집 시각: {new Date(trendCollectResult.timestamp).toLocaleString('ko-KR')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                      <div className="text-[11px] text-slate-500 font-medium">분석된 키워드</div>
                      <div className="text-lg font-black text-indigo-600 mt-0.5">
                        {trendCollectResult.count.toLocaleString()}
                        <span className="text-xs font-normal text-slate-600 ml-0.5">개</span>
                      </div>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                      <div className="text-[11px] text-slate-500 font-medium">황금 키워드 선별</div>
                      <div className="text-lg font-black text-emerald-600 mt-0.5">
                        {trendCollectResult.savedCount.toLocaleString()}
                        <span className="text-xs font-normal text-slate-600 ml-0.5">건</span>
                      </div>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                      <div className="text-[11px] text-slate-500 font-medium">일간 이력(Daily) 적재</div>
                      <div className="text-lg font-black text-blue-600 mt-0.5">
                        {trendCollectResult.dailySavedCount.toLocaleString()}
                        <span className="text-xs font-normal text-slate-600 ml-0.5">건</span>
                      </div>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                      <div className="text-[11px] text-slate-500 font-medium">데이터 출처 신뢰도</div>
                      <div className="text-xs font-bold mt-1 space-y-0.5">
                        <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px]">
                          공식 API: {trendCollectResult.realApiCount ?? 0}건
                        </span>
                        <span className="inline-block px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] ml-1">
                          추정치: {trendCollectResult.fallbackCount ?? 0}건
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Category Stats Table */}
                  {Object.keys(trendCollectResult.categoryStats || {}).length > 0 && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                      <div className="bg-slate-100 px-3.5 py-2 border-b border-slate-200 text-xs font-bold text-slate-700 flex items-center justify-between">
                        <span>카테고리별 수집 & 저장 현황</span>
                        <span className="text-[11px] font-normal text-slate-500">
                          총 {Object.keys(trendCollectResult.categoryStats).length}개 카테고리
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left text-slate-600">
                          <thead className="bg-slate-50 text-[11px] text-slate-500 uppercase border-b border-slate-200 font-bold">
                            <tr>
                              <th className="px-3.5 py-2.5">카테고리</th>
                              <th className="px-3.5 py-2.5 text-center">수집된 후보 키워드 수</th>
                              <th className="px-3.5 py-2.5 text-center">황금 선별 (상위 20%)</th>
                              <th className="px-3.5 py-2.5 text-center">데이터 출처 (실제 API / 추정치)</th>
                              <th className="px-3.5 py-2.5 text-center">상태</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {Object.entries(trendCollectResult.categoryStats).map(([cat, stat]: [string, any]) => (
                              <tr key={cat} className="hover:bg-slate-50/80 transition-colors">
                                <td className="px-3.5 py-2.5 font-bold text-slate-800">
                                  {cat}
                                </td>
                                <td className="px-3.5 py-2.5 text-center font-medium text-slate-700">
                                  {(stat?.collected || 0).toLocaleString()}개
                                </td>
                                <td className="px-3.5 py-2.5 text-center font-bold text-indigo-600">
                                  {(stat?.saved || 0).toLocaleString()}개 {stat?.goldenRate ? `(${stat.goldenRate})` : ''}
                                </td>
                                <td className="px-3.5 py-2.5 text-center font-medium">
                                  <span className="text-emerald-700 font-semibold">{stat?.realApiCount ?? 0}건</span>
                                  <span className="text-slate-400 mx-1">/</span>
                                  <span className="text-amber-700 font-semibold">{stat?.fallbackCount ?? 0}건</span>
                                </td>
                                <td className="px-3.5 py-2.5 text-center">
                                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800">
                                    수집 완료
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Clustered Groups Verification Section (단어 희소성 가중치 + 2단계 지역/패턴 클러스터링 검증) */}
                  {Array.isArray(trendCollectResult.clusteredGroups) && trendCollectResult.clusteredGroups.length > 0 && (
                    <div className="border border-indigo-200 bg-white rounded-xl overflow-hidden shadow-xs space-y-3 p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <Layers className="w-4 h-4 text-indigo-600" />
                          <h5 className="font-extrabold text-xs text-slate-800">
                            2단계 지역·패턴 & 브랜드 정규화 클러스터링 결과 ({trendCollectResult.clusteredGroups.length}개 그룹)
                          </h5>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] flex-wrap">
                          {trendCollectResult.totalRegionalGroupCount !== undefined && (
                            <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-bold">
                              지역 그룹 {trendCollectResult.totalRegionalGroupCount}개
                            </span>
                          )}
                          {trendCollectResult.totalPatternGroupCount !== undefined && (
                            <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200 font-bold">
                              동일 패턴 묶음 {trendCollectResult.totalPatternGroupCount}개
                            </span>
                          )}
                          <span className="text-[11px] text-slate-500">
                            250+ 지역 사전 / 브랜드 사전 / IDF 안전장치 적용됨
                          </span>
                        </div>
                      </div>

                      {/* 카테고리별 클러스터링 통계 요약 */}
                      {trendCollectResult.clusteringStats && Object.keys(trendCollectResult.clusteringStats).length > 0 && (
                        <div className="flex flex-wrap gap-1.5 py-1">
                          {Object.entries(trendCollectResult.clusteringStats).map(([catName, stat]: [string, any]) => (
                            <div key={catName} className="text-[10.5px] px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 flex items-center gap-1.5">
                              <strong className="text-slate-900">{catName}:</strong>
                              <span>총 {stat.totalGroups}그룹</span>
                              <span className="text-amber-700 font-semibold">(지역 {stat.regionalGroups} / 패턴 {stat.patternGroups})</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        1단계에서 <em>"가볼만한곳"</em> 등 완전히 동일한 패턴을 공유하는 지역 변형 키워드를 먼저 묶고, 2단계에서 같은 지역 내 표현을 단어 희소성 가중 자카드 유사도로 정밀 병합합니다. 또한 브랜드 표기 변형(LG/엘지/휘센)이 자동 정규화됩니다.
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-96 overflow-y-auto pr-1">
                        {trendCollectResult.clusteredGroups.map((group: any, idx: number) => {
                          const hasRelated = Array.isArray(group.relatedKeywords) && group.relatedKeywords.length > 0;
                          return (
                            <div
                              key={idx}
                              className={`p-3 rounded-xl border text-xs transition-colors ${
                                hasRelated
                                  ? group.isPatternGroup
                                    ? 'bg-purple-50/40 border-purple-200 hover:border-purple-300'
                                    : 'bg-indigo-50/40 border-indigo-200 hover:border-indigo-300'
                                  : 'bg-slate-50/60 border-slate-200'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="px-1.5 py-0.5 bg-slate-200 text-slate-700 text-[10px] font-bold rounded">
                                      {group.category}
                                    </span>
                                    <span className="font-extrabold text-slate-900 text-xs">
                                      {group.representative}
                                    </span>
                                    {group.isPatternGroup && (
                                      <span className="px-1.5 py-0.2 rounded bg-purple-100 text-purple-800 text-[9.5px] font-bold">
                                        패턴 묶음: {group.pattern}
                                      </span>
                                    )}
                                    {group.isRegionalGroup && !group.isPatternGroup && (
                                      <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[9.5px] font-bold">
                                        지역: {group.region || '지역'}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10.5px] text-slate-500">
                                    그룹 총검색량: <strong className="text-indigo-600">{group.totalSearchVolume?.toLocaleString()}</strong>회
                                    <span className="mx-1">·</span>
                                    포함 키워드: <strong>{group.variantCount || (group.relatedKeywords?.length || 0) + 1}개</strong>
                                  </div>
                                </div>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                                  group.classification === 'immediate_post'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}>
                                  {group.classificationLabel || '포스팅 가능'}
                                </span>
                              </div>

                              {hasRelated && (
                                <div className="mt-2 pt-2 border-t border-indigo-100 space-y-1">
                                  <div className="text-[10px] font-bold text-indigo-900 flex items-center gap-1">
                                    <span>묶인 연관 변형 키워드 ({group.relatedKeywords.length}개):</span>
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {group.relatedKeywords.map((relKw: string, rIdx: number) => (
                                      <span
                                        key={rIdx}
                                        className="px-1.5 py-0.5 bg-white border border-indigo-200 text-indigo-800 rounded text-[10px] font-medium"
                                      >
                                        {relKw}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Real-time Naver SearchAd API Raw Diagnostics & Testing */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Search className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-bold text-slate-800">네이버 검색광고 API 실시간 연동 테스트 & 원본(Raw) 데이터 검증</span>
                  </div>
                  <span className="text-[10px] text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200 font-medium">
                    API Raw Debugging
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  키워드를 직접 입력하여 네이버 공식 검색광고 API(<code className="bg-slate-200 px-1 py-0.5 rounded text-[10px]">/keywordstool</code>)를 실시간 호출하고, 검색량(<code className="text-indigo-600 font-bold">monthlyPcQcCnt</code>, <code className="text-blue-600 font-bold">monthlyMobileQcCnt</code>)과 클릭수 지표가 올바르게 반환되는지 확인합니다.
                </p>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={debugKeywordInput}
                    onChange={(e) => setDebugKeywordInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleDebugKeywordRaw();
                      }
                    }}
                    placeholder="테스트할 키워드 입력 (예: 강릉가볼만한곳, 제주도맛집)"
                    className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleDebugKeywordRaw}
                    disabled={isDebuggingKeyword}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg text-xs font-bold shrink-0 flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    {isDebuggingKeyword ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>조회 중...</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-3.5 h-3.5" />
                        <span>API 호출 테스트</span>
                      </>
                    )}
                  </button>
                </div>

                {debugResult && (
                  <div className="mt-3 p-3.5 bg-white border border-slate-200 rounded-xl space-y-2.5 text-xs">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          debugResult.success ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {debugResult.success ? '✓ 네이버 API 호출 성공 (200 OK)' : '✕ API 호출 실패'}
                        </span>
                        <span className="font-bold text-slate-800 text-xs">'{debugResult.keyword}'</span>
                      </div>
                      {debugResult.totalKeywords !== undefined && (
                        <span className="text-[11px] font-bold text-blue-600">
                          총 {debugResult.totalKeywords}개 연관 키워드 수신
                        </span>
                      )}
                    </div>

                    {debugResult.keyMetricsDistinction && debugResult.keyMetricsDistinction.length > 0 ? (
                      <div className="space-y-2">
                        <div className="text-[11px] font-bold text-slate-700">주요 지표 추출 결과 (상위 5건)</div>
                        <div className="overflow-x-auto border border-slate-200 rounded-lg">
                          <table className="w-full text-[11px] text-left">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                              <tr>
                                <th className="px-2.5 py-1.5">키워드</th>
                                <th className="px-2.5 py-1.5 text-right text-indigo-700">PC 검색수</th>
                                <th className="px-2.5 py-1.5 text-right text-blue-700">모바일 검색수</th>
                                <th className="px-2.5 py-1.5 text-right text-slate-600">PC 클릭수</th>
                                <th className="px-2.5 py-1.5 text-right text-slate-600">모바일 클릭수</th>
                                <th className="px-2.5 py-1.5 text-center">경쟁도</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {debugResult.keyMetricsDistinction.slice(0, 5).map((item: any, i: number) => (
                                <tr key={i} className="hover:bg-slate-50">
                                  <td className="px-2.5 py-1.5 font-bold text-slate-800">{item.relKeyword}</td>
                                  <td className="px-2.5 py-1.5 text-right font-semibold text-indigo-700">{item.monthlyPcQcCnt}</td>
                                  <td className="px-2.5 py-1.5 text-right font-semibold text-blue-700">{item.monthlyMobileQcCnt}</td>
                                  <td className="px-2.5 py-1.5 text-right text-slate-500">{item.monthlyAvePcClkCnt}</td>
                                  <td className="px-2.5 py-1.5 text-right text-slate-500">{item.monthlyAveMobileClkCnt}</td>
                                  <td className="px-2.5 py-1.5 text-center">
                                    <span className="px-1.5 py-0.5 rounded text-[9px] bg-slate-100 text-slate-700 font-medium">
                                      {item.compIdx}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
                        {debugResult.message || debugResult.error || '검색광고 API 응답이 없거나 키워드 목록이 비어 있습니다.'}
                      </div>
                    )}

                    {/* Raw JSON Toggle */}
                    <details className="mt-2 text-[10px] text-slate-500">
                      <summary className="cursor-pointer font-semibold hover:text-slate-700 select-none">
                        네이버 API 원본 응답(JSON Raw) 보기
                      </summary>
                      <pre className="mt-1 p-2 bg-slate-900 text-emerald-400 rounded-lg overflow-x-auto max-h-48 text-[10px]">
                        {JSON.stringify(debugResult, null, 2)}
                      </pre>
                    </details>
                  </div>
                )}
              </div>

              {/* Real-time Naver Blog Search API Raw Diagnostics & Testing */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Search className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold text-slate-800">네이버 블로그 검색 API (문서수 조회) 실시간 연동 테스트</span>
                  </div>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-semibold">
                    Blog Search API
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  키워드를 입력하여 네이버 블로그 검색 Open API 및 NCP API Hub를 호출하고 총 문서수(<code className="text-emerald-700 font-bold">total</code>)와 401 인증 상태를 즉시 진단합니다.
                </p>

                {/* Keyword Input & Action Button */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={debugBlogKeywordInput}
                    onChange={(e) => setDebugBlogKeywordInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleDebugBlogRaw();
                      }
                    }}
                    placeholder="테스트할 키워드 입력 (예: 강릉가볼만한곳, 국내여행)"
                    className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleDebugBlogRaw}
                    disabled={isDebuggingBlog}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white rounded-lg text-xs font-bold shrink-0 flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    {isDebuggingBlog ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>진단 중...</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-3.5 h-3.5" />
                        <span>블로그 API 진단</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Optional Custom Key Test Direct Input */}
                <div className="pt-0.5">
                  <button
                    type="button"
                    onClick={() => setShowCustomKeyInputs(!showCustomKeyInputs)}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <span>{showCustomKeyInputs ? '▼ 직접 키 입력창 접기' : '▶ 테스트할 Client ID / Secret 직접 입력하여 즉시 검증 (Settings 미반영 의심 시)'}</span>
                  </button>

                  {showCustomKeyInputs && (
                    <div className="mt-2 p-3 bg-indigo-50/60 border border-indigo-200/80 rounded-lg space-y-2 text-xs">
                      <div className="text-[11px] font-bold text-indigo-950">
                        임의 키 직접 입력 테스트 (Settings 환경변수와 별도로 즉시 테스트)
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-semibold text-slate-700 block mb-0.5">
                            Client ID (또는 Access Key ID)
                          </label>
                          <input
                            type="text"
                            value={debugCustomClientId}
                            onChange={(e) => setDebugCustomClientId(e.target.value)}
                            placeholder="NAVER API HUB Client ID"
                            className="w-full px-2.5 py-1.5 text-[11px] border border-slate-300 rounded bg-white font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-slate-700 block mb-0.5">
                            Client Secret (또는 Secret Key)
                          </label>
                          <input
                            type="password"
                            value={debugCustomClientSecret}
                            onChange={(e) => setDebugCustomClientSecret(e.target.value)}
                            placeholder="NAVER API HUB Client Secret"
                            className="w-full px-2.5 py-1.5 text-[11px] border border-slate-300 rounded bg-white font-mono"
                          />
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-600">
                        * 입력 후 상단 <strong>[블로그 API 진단]</strong> 버튼을 누르면 이 키로 4가지 인증 방식을 즉시 호출합니다.
                      </div>
                    </div>
                  )}
                </div>

                {debugBlogResult && (
                  <div className="mt-3 p-3.5 bg-white border border-slate-200 rounded-xl space-y-3 text-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-2.5 gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${
                          debugBlogResult.success
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-rose-100 text-rose-800 border border-rose-300'
                        }`}>
                          {debugBlogResult.success ? '✓ 블로그 API 실시간 연동 성공' : '⚠️ API 인증 실패 (스마트 추정치 적용 중)'}
                        </span>
                        <span className="font-bold text-slate-800 text-xs">
                          검색어: <code className="text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded font-mono">'{debugBlogResult.query || debugBlogResult.keyword}'</code>
                        </span>
                      </div>
                      {debugBlogResult.config && (
                        <div className="text-[10px] text-slate-600 flex flex-wrap items-center gap-2 font-mono bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
                          <span className="flex items-center gap-1">
                            <span className="text-slate-400">요청 Client ID:</span>
                            <strong className="text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                              {debugBlogResult.config.clientIdMasked || '미설정'}
                            </strong>
                          </span>
                          <span>|</span>
                          <span className="flex items-center gap-1">
                            <span className="text-slate-400">Secret:</span>
                            <strong className="text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                              {debugBlogResult.config.clientSecretMasked || '미설정'}
                            </strong>
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Results Table (1-A, 1-B, 1-C, 1-D) */}
                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                      <table className="w-full text-left text-[11px] border-collapse">
                        <thead>
                          <tr className="bg-slate-100/80 text-slate-700 border-b border-slate-200">
                            <th className="py-2 px-3 font-semibold text-center w-12">구분</th>
                            <th className="py-2 px-3 font-semibold">호출 API 및 엔드포인트</th>
                            <th className="py-2 px-3 font-semibold">인증 헤더 규격</th>
                            <th className="py-2 px-3 font-semibold text-center w-24">상태 코드</th>
                            <th className="py-2 px-3 font-semibold text-center w-16">결과</th>
                            <th className="py-2 px-3 font-semibold text-right w-24">문서수</th>
                            <th className="py-2 px-3 font-semibold min-w-[240px]">네이버 원문 에러 / 응답 상세 및 Trace ID</th>
                            <th className="py-2 px-3 font-semibold text-center w-16">JSON</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                          {((debugBlogResult.attempts && debugBlogResult.attempts.length > 0)
                            ? debugBlogResult.attempts
                            : [
                                {
                                  id: '1-B',
                                  name: 'NCP NAVER API HUB (공식 X-NCP 헤더)',
                                  endpoint: 'https://naverapihub.apigw.ntruss.com/search/v1/blog',
                                  headerType: 'X-NCP-APIGW-API-KEY-ID / X-NCP-APIGW-API-KEY',
                                  success: !!debugBlogResult.results?.apiHubNcpHeaders?.ok,
                                  statusCode: debugBlogResult.results?.apiHubNcpHeaders?.status || null,
                                  total: debugBlogResult.results?.apiHubNcpHeaders?.total,
                                  errorMessage: debugBlogResult.results?.apiHubNcpHeaders?.response?.error?.message || (debugBlogResult.results?.apiHubNcpHeaders?.ok ? null : '호출 실패'),
                                  responseBody: debugBlogResult.results?.apiHubNcpHeaders?.response,
                                },
                              ]
                          ).map((attempt: any) => {
                            const isSelected = selectedBlogAttemptId === attempt.id;
                            const isOk = attempt.success;
                            return (
                              <React.Fragment key={attempt.id}>
                                <tr className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-indigo-50/40' : ''}`}>
                                  <td className="py-2.5 px-3 text-center">
                                    <span className="px-1.5 py-0.5 rounded font-mono font-bold text-[10px] bg-slate-200 text-slate-800">
                                      {attempt.id}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <div className="font-semibold text-slate-900">{attempt.name}</div>
                                    <div className="text-[10px] text-slate-500 font-mono truncate max-w-xs">{attempt.endpoint}</div>
                                    <div className="text-[9.5px] text-slate-500 font-mono mt-0.5 flex flex-col gap-0.5">
                                      <div className="flex items-center gap-1">
                                        <span className="text-slate-400">요청 Client ID:</span>
                                        <strong className="text-indigo-700 bg-indigo-50/70 px-1 rounded">{attempt.clientIdMasked || attempt.usedClientIdMasked || debugBlogResult.config?.clientIdMasked || '미설정'}</strong>
                                      </div>
                                      {(attempt.requestTimestampKst || attempt.requestTimestampUtc) && (
                                        <div className="flex items-center gap-1 text-[9px] text-slate-400">
                                          <span>요청시각:</span>
                                          <span className="font-mono text-slate-600">{attempt.requestTimestampKst || attempt.requestTimestampUtc}</span>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3 font-mono text-[10px] text-slate-600">
                                    {attempt.headerType}
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    {attempt.statusCode ? (
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                                        attempt.statusCode >= 200 && attempt.statusCode < 300
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : attempt.statusCode === 401
                                          ? 'bg-rose-100 text-rose-800 font-bold border border-rose-300'
                                          : 'bg-amber-100 text-amber-900 border border-amber-300'
                                      }`}>
                                        HTTP {attempt.statusCode}
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-500 font-mono">
                                        연결 실패
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      isOk ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                    }`}>
                                      {isOk ? '성공' : '실패'}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono">
                                    {typeof attempt.total === 'number' ? (
                                      <strong className="text-emerald-700 font-bold">
                                        {attempt.total.toLocaleString()}건
                                      </strong>
                                    ) : (
                                      <span className="text-slate-400">-</span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <div className="space-y-1.5">
                                      {attempt.traceId && (
                                        <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-300 px-2 py-1 rounded text-[10px] font-mono text-amber-900">
                                          <span className="font-bold text-amber-950 shrink-0">x-ncp-trace-id:</span>
                                          <span className="font-semibold text-amber-800 truncate select-all">{attempt.traceId}</span>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (navigator.clipboard) {
                                                navigator.clipboard.writeText(attempt.traceId);
                                              }
                                              setCopiedTraceId(attempt.traceId);
                                              setTimeout(() => setCopiedTraceId(null), 2500);
                                            }}
                                            className={`ml-auto px-2 py-0.5 rounded text-[9px] font-bold shrink-0 cursor-pointer transition-colors ${
                                              copiedTraceId === attempt.traceId
                                                ? 'bg-emerald-600 text-white'
                                                : 'bg-amber-200 hover:bg-amber-300 text-amber-900'
                                            }`}
                                            title="Trace ID 복사"
                                          >
                                            {copiedTraceId === attempt.traceId ? '✓ 복사됨' : '복사'}
                                          </button>
                                        </div>
                                      )}
                                      {attempt.errorMessage ? (
                                        <div className="space-y-1">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            {attempt.rawErrorCode && (
                                              <span className="px-1.5 py-0.5 rounded font-mono font-bold text-[9px] bg-rose-200 text-rose-900 border border-rose-300">
                                                에러코드: {attempt.rawErrorCode}
                                              </span>
                                            )}
                                            <span className="text-rose-900 font-bold text-[11px]">
                                              {attempt.rawErrorMessage || attempt.errorMessage}
                                            </span>
                                          </div>
                                          {attempt.rawErrorDetails && (
                                            <div className="text-[10px] text-rose-800 bg-rose-50/80 px-2 py-1 rounded border border-rose-200 font-mono">
                                              <span className="font-semibold text-rose-900">원문 상세:</span> {attempt.rawErrorDetails}
                                            </div>
                                          )}
                                          {!attempt.rawErrorCode && !attempt.rawErrorDetails && (
                                            <div className="text-rose-700 font-medium text-[10px] break-all font-mono">
                                              {attempt.errorMessage}
                                            </div>
                                          )}
                                        </div>
                                      ) : isOk ? (
                                        <div className="text-emerald-700 font-semibold text-[10px]">
                                          ✓ 정상 수신 ({attempt.itemsCount || 0}개 항목)
                                        </div>
                                      ) : (
                                        <div className="text-slate-400 text-[10px]">-</div>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    <button
                                      type="button"
                                      onClick={() => setSelectedBlogAttemptId(isSelected ? null : attempt.id)}
                                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold rounded cursor-pointer transition-colors"
                                    >
                                      {isSelected ? '닫기' : '보기'}
                                    </button>
                                  </td>
                                </tr>
                                {isSelected && (
                                  <tr className="bg-slate-900 text-emerald-400">
                                    <td colSpan={8} className="p-3 font-mono text-[10px] overflow-x-auto">
                                      <div className="flex items-center justify-between text-slate-300 pb-1.5 mb-1.5 border-b border-slate-800">
                                        <span className="font-bold text-white">[{attempt.id}] {attempt.name} 네이버 원본 응답 본문</span>
                                        <span>Status: {attempt.statusCode || 'N/A'}{attempt.traceId ? ` | Trace ID: ${attempt.traceId}` : ''}</span>
                                      </div>
                                      {(attempt.requestTimestampUtc || attempt.requestTimestampKst) && (
                                        <div className="text-[9.5px] text-slate-400 mb-2 font-mono flex gap-3">
                                          <span>UTC: {attempt.requestTimestampUtc || 'N/A'}</span>
                                          <span>KST: {attempt.requestTimestampKst || 'N/A'}</span>
                                        </div>
                                      )}
                                      <pre className="overflow-x-auto max-h-60 whitespace-pre-wrap">
                                        {JSON.stringify(attempt.responseBody || attempt, null, 2)}
                                      </pre>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Troubleshooting Guide */}
                    {(debugBlogResult.guide || debugBlogResult.results?.guide) && (
                      <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-lg text-[11px] text-blue-900 space-y-1.5">
                        <div className="font-bold flex items-center gap-1.5 text-blue-950">
                          <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                          <span>네이버 클라우드 플랫폼(NCP) NAVER API HUB 401 오류 해결 가이드</span>
                        </div>
                        <ul className="list-disc list-inside space-y-1 text-blue-900 leading-relaxed pl-1">
                          <li><strong>전자서명(Signature V2)이란?</strong> 사용자가 발급받는 키가 아니며, 서버가 Secret Key와 시간을 조합해 자동으로 생성하는 보안 검증값입니다.</li>
                          <li><strong>정확한 Client ID/Secret 확인 위치</strong>: 네이버 클라우드 플랫폼 콘솔(console.ncloud.com) &gt; <code>Services</code> &gt; <code>NAVER API HUB</code> &gt; <code>Application</code> &gt; 등록한 앱 이름 클릭 &gt; <strong>[인증 정보]</strong> 확인 (※ 마이페이지의 Access Key가 아닙니다).</li>
                          <li><strong>API 권한 체크</strong>: <code>NAVER API HUB</code> &gt; <code>Application</code>의 <strong>[수정]</strong> 버튼을 눌러 <strong>[NAVER 검색 (블로그)]</strong> 항목에 체크가 되어 있는지 확인하세요.</li>
                          <li><strong>Web 서비스 URL</strong>: Application 설정의 서비스 환경에 <code>http://localhost</code> 또는 본 사이트 URL이 등록되어 있어야 합니다.</li>
                        </ul>
                      </div>
                    )}

                    {/* Raw Entire JSON Toggle */}
                    <details className="mt-2 text-[10px] text-slate-500">
                      <summary className="cursor-pointer font-semibold hover:text-slate-700 select-none">
                        전체 API 진단 응답 JSON 보기 (/api/admin/debug/blog-search-test)
                      </summary>
                      <pre className="mt-1 p-2 bg-slate-900 text-emerald-400 rounded-lg overflow-x-auto max-h-48 text-[10px]">
                        {JSON.stringify(debugBlogResult, null, 2)}
                      </pre>
                    </details>
                  </div>
                )}
              </div>

              {/* Real-time Naver DataLab Search Trend API Raw Diagnostics & Testing */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-violet-600" />
                    <span className="text-xs font-bold text-slate-800">네이버 검색어트렌드 (DataLab) API 실시간 연동 테스트</span>
                  </div>
                  <span className="text-[10px] text-violet-700 bg-violet-50 px-2 py-0.5 rounded border border-violet-200 font-semibold">
                    DataLab Search Trend API
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  검색어를 입력하여 네이버 검색어트렌드(DataLab) Open API 및 NCP NAVER API HUB(<code className="text-violet-700 font-bold">1-B: /search-trend/v1/search</code>)를 호출하고 응답 데이터와 401 인증 상태를 정밀 진단합니다.
                </p>

                {/* Keyword Input & Action Button */}
                <div className="flex flex-wrap sm:flex-nowrap gap-2">
                  <input
                    type="text"
                    value={debugTrendKeywordInput}
                    onChange={(e) => setDebugTrendKeywordInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleDebugTrendRaw();
                      }
                    }}
                    placeholder="테스트할 검색어 입력 (예: 테스트, 여행, 맛집)"
                    className="flex-1 min-w-[200px] px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleDebugTrendRaw}
                    disabled={isDebuggingTrend}
                    className="px-3.5 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white rounded-lg text-xs font-bold shrink-0 flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    {isDebuggingTrend ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>진단 중...</span>
                      </>
                    ) : (
                      <>
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>검색어트렌드 API 진단</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleDebugAllNaverApis}
                    disabled={isDebuggingBlog || isDebuggingTrend}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-400 text-white rounded-lg text-xs font-bold shrink-0 flex items-center gap-1.5 cursor-pointer transition-colors"
                    title="블로그 검색과 검색어트렌드 API(NCP NAVER API HUB)의 실시간 상태를 확인합니다."
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isDebuggingBlog || isDebuggingTrend ? 'animate-spin' : ''}`} />
                    <span>네이버 API 상태 확인</span>
                  </button>
                </div>

                {debugTrendResult && (
                  <div className="mt-3 p-3.5 bg-white border border-slate-200 rounded-xl space-y-3 text-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-2.5 gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${
                          debugTrendResult.success
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-rose-100 text-rose-800 border border-rose-300'
                        }`}>
                          {debugTrendResult.success ? '✓ 검색어트렌드 API 실시간 연동 성공' : '⚠️ API 인증 실패 (스마트 추정치 적용 중)'}
                        </span>
                        <span className="font-bold text-slate-800 text-xs">
                          검색어: <code className="text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded font-mono">'{debugTrendResult.query || debugTrendResult.keyword}'</code>
                        </span>
                      </div>
                      {debugTrendResult.config && (
                        <div className="text-[10px] text-slate-600 flex flex-wrap items-center gap-2 font-mono bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
                          <span className="flex items-center gap-1">
                            <span className="text-slate-400">요청 Client ID:</span>
                            <strong className="text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded border border-violet-200">
                              {debugTrendResult.config.clientIdMasked || '미설정'}
                            </strong>
                          </span>
                          <span>|</span>
                          <span className="flex items-center gap-1">
                            <span className="text-slate-400">Secret:</span>
                            <strong className="text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                              {debugTrendResult.config.clientSecretMasked || '미설정'}
                            </strong>
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Results Table (1-A, 1-B, 1-C, 1-D) */}
                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                      <table className="w-full text-left text-[11px] border-collapse">
                        <thead>
                          <tr className="bg-slate-100/80 text-slate-700 border-b border-slate-200">
                            <th className="py-2 px-3 font-semibold text-center w-12">구분</th>
                            <th className="py-2 px-3 font-semibold">호출 API 및 엔드포인트</th>
                            <th className="py-2 px-3 font-semibold">인증 헤더 규격</th>
                            <th className="py-2 px-3 font-semibold text-center w-24">상태 코드</th>
                            <th className="py-2 px-3 font-semibold text-center w-20">결과</th>
                            <th className="py-2 px-3 font-semibold text-right w-24">데이터 수</th>
                            <th className="py-2 px-3 font-semibold">네이버 원문 에러 / 응답 상세 및 Trace ID</th>
                            <th className="py-2 px-3 font-semibold text-center w-16">JSON</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {(debugTrendResult.attempts || []).map((attempt: any) => {
                            const isOk = attempt.success;
                            const isSelected = selectedTrendAttemptId === attempt.id;
                            const is1B = attempt.id === '1-B';

                            return (
                              <React.Fragment key={attempt.id}>
                                <tr className={`hover:bg-slate-50 transition-colors ${
                                  isSelected ? 'bg-violet-50/60' : (is1B ? 'bg-amber-50/30' : '')
                                }`}>
                                  <td className="py-2.5 px-3 text-center font-bold">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                                      is1B ? 'bg-violet-100 text-violet-800 border border-violet-300 font-extrabold' : 'bg-slate-100 text-slate-800'
                                    }`}>
                                      {attempt.id}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <div className="font-semibold text-slate-800 flex items-center gap-1">
                                      <span>{attempt.name}</span>
                                      {is1B && (
                                        <span className="text-[9px] bg-violet-600 text-white px-1.5 py-0.2 rounded font-bold">
                                          공식 HUB 규격
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-slate-500 font-mono break-all mt-0.5">
                                      {attempt.endpoint || attempt.url}
                                    </div>
                                    {(attempt.requestTimestampKst || attempt.requestTimestampUtc) && (
                                      <div className="text-[9px] text-slate-400 font-mono mt-0.5 flex items-center gap-1">
                                        <span>요청시각:</span>
                                        <span className="text-slate-600">{attempt.requestTimestampKst || attempt.requestTimestampUtc}</span>
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 font-mono text-[10px] text-slate-600">
                                    {attempt.headerType}
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-mono">
                                    {attempt.statusCode ? (
                                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                        attempt.statusCode === 200
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : attempt.statusCode === 401
                                          ? 'bg-rose-100 text-rose-800 font-extrabold'
                                          : 'bg-amber-100 text-amber-800'
                                      }`}>
                                        HTTP {attempt.statusCode}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 text-[10px]">연결 실패</span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      isOk
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-rose-100 text-rose-800'
                                    }`}>
                                      {isOk ? '성공' : '실패'}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700">
                                    {isOk ? `${attempt.itemsCount || 0}개` : '-'}
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <div className="space-y-1.5">
                                      {attempt.traceId && (
                                        <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-300 px-2 py-1 rounded text-[10px] font-mono text-amber-900">
                                          <span className="font-bold text-amber-950 shrink-0">x-ncp-trace-id:</span>
                                          <span className="font-semibold text-amber-800 truncate select-all">{attempt.traceId}</span>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (navigator.clipboard) {
                                                navigator.clipboard.writeText(attempt.traceId);
                                              }
                                              setCopiedTraceId(attempt.traceId);
                                              setTimeout(() => setCopiedTraceId(null), 2500);
                                            }}
                                            className={`ml-auto px-2 py-0.5 rounded text-[9px] font-bold shrink-0 cursor-pointer transition-colors ${
                                              copiedTraceId === attempt.traceId
                                                ? 'bg-emerald-600 text-white'
                                                : 'bg-amber-200 hover:bg-amber-300 text-amber-900'
                                            }`}
                                            title="Trace ID 복사"
                                          >
                                            {copiedTraceId === attempt.traceId ? '✓ 복사됨' : '복사'}
                                          </button>
                                        </div>
                                      )}
                                      {!isOk && attempt.errorMessage ? (
                                        <div className="space-y-1">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            {attempt.rawErrorCode && (
                                              <span className="px-1.5 py-0.5 bg-rose-100 text-rose-900 rounded font-mono font-bold text-[10px] border border-rose-300">
                                                코드: {attempt.rawErrorCode}
                                              </span>
                                            )}
                                            <span className="text-rose-900 font-bold text-[11px]">
                                              {attempt.rawErrorMessage || attempt.errorMessage}
                                            </span>
                                          </div>
                                          {attempt.rawErrorDetails && (
                                            <div className="text-[10px] text-rose-800 bg-rose-50/80 px-2 py-1 rounded border border-rose-200 font-mono">
                                              <span className="font-semibold text-rose-900">원문 상세:</span> {attempt.rawErrorDetails}
                                            </div>
                                          )}
                                          {!attempt.rawErrorCode && !attempt.rawErrorDetails && (
                                            <div className="text-rose-700 font-medium text-[10px] break-all font-mono">
                                              {attempt.errorMessage}
                                            </div>
                                          )}
                                        </div>
                                      ) : isOk ? (
                                        <div className="text-emerald-700 font-semibold text-[10px]">
                                          ✓ 정상 수신 (트렌드 데이터 {attempt.itemsCount || 0}개 포인트)
                                        </div>
                                      ) : (
                                        <div className="text-slate-400 text-[10px]">-</div>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    <button
                                      type="button"
                                      onClick={() => setSelectedTrendAttemptId(isSelected ? null : attempt.id)}
                                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold rounded cursor-pointer transition-colors"
                                    >
                                      {isSelected ? '닫기' : '보기'}
                                    </button>
                                  </td>
                                </tr>
                                {isSelected && (
                                  <tr className="bg-slate-900 text-violet-300">
                                    <td colSpan={8} className="p-3 font-mono text-[10px] overflow-x-auto">
                                      <div className="flex items-center justify-between text-slate-300 pb-1.5 mb-1.5 border-b border-slate-800">
                                        <span className="font-bold text-white">[{attempt.id}] {attempt.name} DataLab 원본 응답 본문</span>
                                        <span>Status: {attempt.statusCode || 'N/A'}{attempt.traceId ? ` | Trace ID: ${attempt.traceId}` : ''}</span>
                                      </div>
                                      {(attempt.requestTimestampUtc || attempt.requestTimestampKst) && (
                                        <div className="text-[9.5px] text-slate-400 mb-2 font-mono flex gap-3">
                                          <span>UTC: {attempt.requestTimestampUtc || 'N/A'}</span>
                                          <span>KST: {attempt.requestTimestampKst || 'N/A'}</span>
                                        </div>
                                      )}
                                      <pre className="overflow-x-auto max-h-60 whitespace-pre-wrap">
                                        {JSON.stringify(attempt.responseBody || attempt, null, 2)}
                                      </pre>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Troubleshooting Guide for DataLab */}
                    {(debugTrendResult.guide || debugTrendResult.results?.guide) && (
                      <div className="p-3 bg-violet-50/80 border border-violet-200 rounded-lg text-[11px] text-violet-900 space-y-1.5">
                        <div className="font-bold flex items-center gap-1.5 text-violet-950">
                          <CheckCircle2 className="w-4 h-4 text-violet-600 shrink-0" />
                          <span>네이버 클라우드 플랫폼(NCP) NAVER API HUB DataLab 검색어트렌드 권한 확인 가이드</span>
                        </div>
                        <ul className="list-disc list-inside space-y-1 text-violet-900 leading-relaxed pl-1">
                          <li><strong>DataLab API 권한 체크</strong>: 네이버 클라우드 플랫폼 콘솔(console.ncloud.com) &gt; <code>Services</code> &gt; <code>NAVER API HUB</code> &gt; <code>Application</code>의 <strong>[수정]</strong> 버튼을 눌러 <strong>[Data Lab 검색어트렌드]</strong> 항목에 체크가 되어 있는지 확인하세요.</li>
                          <li><strong>블로그 vs DataLab 키 일치 여부</strong>: <code>NAVER API HUB</code>에서 단일 애플리케이션 생성 시 [블로그 검색]과 [DataLab 검색어트렌드]를 함께 체크했다면 두 API 모두 동일한 Client ID / Client Secret을 공유합니다.</li>
                          <li><strong>결제수단 활성화</strong>: 네이버 클라우드 플랫폼 [마이페이지 &gt; 과금 및 납부 관리 &gt; 결제수단 관리]에 결제수단이 정상 등록되어 있어야 401 오류 없이 데이터 조회가 가능합니다.</li>
                        </ul>
                      </div>
                    )}

                    {/* Raw Entire JSON Toggle */}
                    <details className="mt-2 text-[10px] text-slate-500">
                      <summary className="cursor-pointer font-semibold hover:text-slate-700 select-none">
                        전체 API 진단 응답 JSON 보기 (/api/admin/debug/datalab-trend-test)
                      </summary>
                      <pre className="mt-1 p-2 bg-slate-900 text-violet-300 rounded-lg overflow-x-auto max-h-48 text-[10px]">
                        {JSON.stringify(debugTrendResult, null, 2)}
                      </pre>
                    </details>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Edit Participant Form Modal Overlay */}
        {editingParticipant && (
          <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200">
              <div className="bg-indigo-900 text-white p-4 flex items-center justify-between">
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-indigo-300" />
                  <span>참가자 정보 수정 ({editingParticipant.participantName})</span>
                </h3>
                <button
                  onClick={() => setEditingParticipant(null)}
                  className="p-1 rounded-full hover:bg-white/20 text-white/80 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!editingParticipant.participantName.trim()) {
                    setFormError('참가자 이름을 입력해주세요.');
                    return;
                  }
                  const formattedTwitter = editingParticipant.twitterId?.trim()
                    ? editingParticipant.twitterId.trim().startsWith('@')
                      ? editingParticipant.twitterId.trim()
                      : `@${editingParticipant.twitterId.trim()}`
                    : null;

                  const cleanBlog = editingParticipant.platformType === 'twitter'
                    ? null
                    : extractNaverBlogId(editingParticipant.blogId) || null;

                  const updated: Participant = {
                    ...editingParticipant,
                    participantName: editingParticipant.participantName.trim(),
                    blogId: cleanBlog,
                    twitterId: editingParticipant.platformType === 'blog' ? null : formattedTwitter,
                  };

                  if (onUpdateParticipant) {
                    onUpdateParticipant(updated);
                  }
                  setEditingParticipant(null);
                  setFormSuccess(`"${updated.participantName}" 님의 정보 수정이 요청되었습니다.`);
                }}
                className="p-5 space-y-3 text-xs"
              >
                <div>
                  <label className="font-bold text-slate-700 block mb-1">참가자 이름 *</label>
                  <input
                    type="text"
                    value={editingParticipant.participantName}
                    onChange={(e) =>
                      setEditingParticipant({ ...editingParticipant, participantName: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    참가 챌린지 그룹 (다중 참가 선택 가능) *
                  </label>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto p-2.5 bg-slate-50 border border-slate-300 rounded-lg">
                    {groups.map((g) => {
                      const currentGroups = editingParticipant.groupNames && editingParticipant.groupNames.length > 0
                        ? editingParticipant.groupNames
                        : editingParticipant.groupName.split(',').map((s) => s.trim());
                      const isChecked = currentGroups.includes(g.name);
                      return (
                        <label key={g.id} className="flex items-center space-x-2 text-xs cursor-pointer hover:bg-slate-100 p-1 rounded">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              let nextGroups: string[];
                              if (e.target.checked) {
                                nextGroups = Array.from(new Set([...currentGroups, g.name]));
                              } else {
                                if (currentGroups.length > 1) {
                                  nextGroups = currentGroups.filter((n) => n !== g.name);
                                } else {
                                  alert('최소 1개 이상의 챌린지 그룹을 선택해야 합니다.');
                                  return;
                                }
                              }
                              setEditingParticipant({
                                ...editingParticipant,
                                groupName: nextGroups.join(', '),
                                groupNames: nextGroups,
                              });
                            }}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                          <span className="font-bold text-slate-800">{g.name}</span>
                          <span className="text-[10px] text-slate-500">
                            ({g.category === 'blog' ? '블로그' : g.category === 'twitter' ? '트위터' : '통합'})
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">등록 플랫폼 유형 *</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setEditingParticipant({ ...editingParticipant, platformType: 'both' })
                      }
                      className={`py-1.5 px-2 rounded-lg font-bold border transition-colors cursor-pointer ${
                        editingParticipant.platformType === 'both'
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      ✨ 둘 다 등록
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingParticipant({ ...editingParticipant, platformType: 'blog' })
                      }
                      className={`py-1.5 px-2 rounded-lg font-bold border transition-colors cursor-pointer ${
                        editingParticipant.platformType === 'blog'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      🟢 블로그만
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingParticipant({ ...editingParticipant, platformType: 'twitter' })
                      }
                      className={`py-1.5 px-2 rounded-lg font-bold border transition-colors cursor-pointer ${
                        editingParticipant.platformType === 'twitter'
                          ? 'bg-sky-600 text-white border-sky-600'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      🐦 트위터만
                    </button>
                  </div>
                </div>

                {(editingParticipant.platformType === 'blog' || editingParticipant.platformType === 'both') && (
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">네이버 블로그 ID</label>
                    <input
                      type="text"
                      value={editingParticipant.blogId || ''}
                      onChange={(e) =>
                        setEditingParticipant({ ...editingParticipant, blogId: e.target.value })
                      }
                      placeholder="예: naver_id"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                    />
                  </div>
                )}

                {(editingParticipant.platformType === 'twitter' || editingParticipant.platformType === 'both') && (
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">트위터 ID (@핸들)</label>
                    <input
                      type="text"
                      value={editingParticipant.twitterId || ''}
                      onChange={(e) =>
                        setEditingParticipant({ ...editingParticipant, twitterId: e.target.value })
                      }
                      placeholder="예: @twitter_handle"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                    />
                  </div>
                )}

                <div>
                  <label className="font-bold text-slate-700 block mb-1">특이사항 / 메모</label>
                  <input
                    type="text"
                    value={editingParticipant.notes || ''}
                    onChange={(e) =>
                      setEditingParticipant({ ...editingParticipant, notes: e.target.value })
                    }
                    placeholder="참가자 관련 메모..."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div className="pt-3 flex items-center justify-end space-x-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setEditingParticipant(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    수정 내용 저장
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Challenge Group Modal Overlay */}
        {editingGroup && (
          <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200 my-auto max-h-[90vh] flex flex-col">
              <div className="bg-indigo-900 text-white p-4 flex items-center justify-between shrink-0">
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-indigo-300" />
                  <span>챌린지 그룹 정보 및 목표 수정 ({editingGroup.name})</span>
                </h3>
                <button
                  onClick={() => setEditingGroup(null)}
                  className="p-1 rounded-full hover:bg-white/20 text-white/80 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!editingGroup.name.trim()) {
                    setFormError('챌린지 그룹 이름을 입력해주세요.');
                    return;
                  }
                  if (onUpdateGroup) {
                    onUpdateGroup(editingGroup);
                  }
                  setEditingGroup(null);
                  setFormSuccess(`"${editingGroup.name}" 챌린지 그룹 정보가 수정되었습니다.`);
                }}
                className="p-5 space-y-3.5 text-xs overflow-y-auto"
              >
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    챌린지 그룹 이름 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editingGroup.name}
                    onChange={(e) =>
                      setEditingGroup({ ...editingGroup, name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    수집 플랫폼 기준 (카테고리)
                  </label>
                  <select
                    value={editingGroup.category}
                    onChange={(e) =>
                      setEditingGroup({
                        ...editingGroup,
                        category: e.target.value as 'blog' | 'twitter' | 'both',
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-medium text-slate-800"
                  >
                    <option value="both">통합 (네이버 블로그 + X/트위터 수집)</option>
                    <option value="blog">네이버 블로그 전용 수집</option>
                    <option value="twitter">X (트위터) 전용 수집</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    그룹 설명
                  </label>
                  <input
                    type="text"
                    value={editingGroup.description}
                    onChange={(e) =>
                      setEditingGroup({ ...editingGroup, description: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                {/* 📅 기간 설정 (모집 기간 & 운영 기간) */}
                <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-indigo-600" />
                      <span>기간 설정 (모집 및 운영 기간)</span>
                    </span>
                  </div>

                  {/* 1) 모집 기간 */}
                  <div className="bg-white p-2.5 rounded-lg border border-indigo-100 space-y-1.5">
                    <span className="text-[11px] font-bold text-indigo-900 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-indigo-500" />
                      모집 기간 설정
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">모집 시작일</label>
                        <input
                          type="date"
                          value={editingGroup.recruitingStartDate || editingGroup.startDate}
                          onChange={(e) =>
                            setEditingGroup({ ...editingGroup, recruitingStartDate: e.target.value })
                          }
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs font-medium text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">모집 마감일</label>
                        <input
                          type="date"
                          value={editingGroup.recruitingEndDate || editingGroup.startDate}
                          onChange={(e) =>
                            setEditingGroup({ ...editingGroup, recruitingEndDate: e.target.value })
                          }
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs font-medium text-slate-800"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 2) 운영 기간 */}
                  <div className="bg-white p-2.5 rounded-lg border border-indigo-100 space-y-1.5">
                    <span className="text-[11px] font-bold text-indigo-900 flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-indigo-500" />
                      운영 기간 설정 (챌린지 진행 기간)
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">운영 시작일 (챌린지 시작)</label>
                        <input
                          type="date"
                          value={editingGroup.startDate}
                          onChange={(e) =>
                            setEditingGroup({ ...editingGroup, startDate: e.target.value })
                          }
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs font-medium text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">운영 종료일 (챌린지 종료)</label>
                        <input
                          type="date"
                          value={editingGroup.endDate}
                          onChange={(e) =>
                            setEditingGroup({ ...editingGroup, endDate: e.target.value })
                          }
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs font-medium text-slate-800"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 🎯 챌린지 목표 및 수집 기준 설정 */}
                <div className="p-3 bg-amber-50/80 border border-amber-200/90 rounded-xl space-y-3 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <Target className="w-4 h-4 text-amber-700" />
                      <span>챌린지 목표 및 수집 기준</span>
                    </span>
                  </div>

                  {/* 1) 미션 요일 선택 */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <label className="font-bold text-slate-700">미션 요일 선택 (다중 선택)</label>
                      <div className="flex items-center gap-1 text-[10px]">
                        <button
                          type="button"
                          onClick={() => setEditingGroup({ ...editingGroup, missionDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] })}
                          className="px-1.5 py-0.5 bg-white border border-slate-300 rounded hover:bg-slate-100 font-semibold text-slate-700 cursor-pointer"
                        >
                          매일
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingGroup({ ...editingGroup, missionDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] })}
                          className="px-1.5 py-0.5 bg-white border border-slate-300 rounded hover:bg-slate-100 font-semibold text-slate-700 cursor-pointer"
                        >
                          평일
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingGroup({ ...editingGroup, missionDays: ['Sat', 'Sun'] })}
                          className="px-1.5 py-0.5 bg-white border border-slate-300 rounded hover:bg-slate-100 font-semibold text-slate-700 cursor-pointer"
                        >
                          주말
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 overflow-x-auto pb-1">
                      {ALL_MISSION_DAYS.map((d) => {
                        const currentMissionDays = editingGroup.missionDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                        const isSelected = currentMissionDays.includes(d.code);
                        return (
                          <button
                            key={d.code}
                            type="button"
                            onClick={() => {
                              let nextDays: MissionDay[];
                              if (isSelected) {
                                nextDays = currentMissionDays.length > 1 ? currentMissionDays.filter((m) => m !== d.code) : currentMissionDays;
                              } else {
                                nextDays = [...currentMissionDays, d.code];
                              }
                              setEditingGroup({ ...editingGroup, missionDays: nextDays });
                            }}
                            className={`flex-1 min-w-[32px] py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {d.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2) 목표 기준 선택: Daily vs Weekly */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 block">목표 집계 주기</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingGroup({ ...editingGroup, goalUnit: 'daily' })}
                        className={`py-1.5 px-2 text-xs font-bold rounded-lg border flex items-center justify-center gap-1 cursor-pointer transition-all ${
                          (editingGroup.goalUnit || 'daily') === 'daily'
                            ? 'bg-amber-700 text-white border-amber-700 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span>일 단위 (Daily)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingGroup({ ...editingGroup, goalUnit: 'weekly' })}
                        className={`py-1.5 px-2 text-xs font-bold rounded-lg border flex items-center justify-center gap-1 cursor-pointer transition-all ${
                          editingGroup.goalUnit === 'weekly'
                            ? 'bg-amber-700 text-white border-amber-700 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span>주 단위 (Weekly)</span>
                      </button>
                    </div>
                  </div>

                  {/* 3) 상세 수집 목표 수 설정 */}
                  <div className="space-y-2 pt-1">
                    <span className="text-[11px] font-bold text-slate-800 block">
                      상세 수집 목표 수 ({(editingGroup.goalUnit || 'daily') === 'daily' ? '1일 기준' : '1주 기준'})
                    </span>

                    {(editingGroup.category === 'twitter' || editingGroup.category === 'both') && (
                      <div className="grid grid-cols-2 gap-2 bg-white p-2.5 rounded-lg border border-amber-200/80">
                        <div>
                          <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                            트윗 게시글 목표 수 *
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={editingGroup.targetTweetCount ?? 1}
                            onChange={(e) =>
                              setEditingGroup({
                                ...editingGroup,
                                targetTweetCount: Math.max(0, parseInt(e.target.value) || 0),
                              })
                            }
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs font-bold text-slate-900"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                            트윗 답글(Reply) 목표 수 *
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={editingGroup.targetReplyCount ?? 3}
                            onChange={(e) =>
                              setEditingGroup({
                                ...editingGroup,
                                targetReplyCount: Math.max(0, parseInt(e.target.value) || 0),
                              })
                            }
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs font-bold text-slate-900"
                          />
                        </div>
                      </div>
                    )}

                    {(editingGroup.category === 'blog' || editingGroup.category === 'both') && (
                      <div className="bg-white p-2.5 rounded-lg border border-amber-200/80">
                        <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                          블로그 포스팅 목표 수 *
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={editingGroup.targetBlogPostCount ?? 1}
                          onChange={(e) =>
                            setEditingGroup({
                              ...editingGroup,
                              targetBlogPostCount: Math.max(0, parseInt(e.target.value) || 0),
                            })
                          }
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs font-bold text-slate-900"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* 💰 금액 및 보상 설정 */}
                <div className="p-3 bg-emerald-50/70 border border-emerald-200/90 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                      <Coins className="w-4 h-4 text-emerald-600" />
                      <span>금액 및 보상 설정</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="bg-white p-2.5 rounded-lg border border-emerald-200/80 space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 block">
                        참가비 (원)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min={0}
                          step={1000}
                          placeholder="0 (무료)"
                          value={editingGroup.fee === undefined || editingGroup.fee === 0 ? '' : editingGroup.fee}
                          onChange={(e) =>
                            setEditingGroup({
                              ...editingGroup,
                              fee: Math.max(0, parseInt(e.target.value) || 0),
                            })
                          }
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs font-bold text-slate-900 pr-8"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">원</span>
                      </div>
                      <p className="text-[10px] text-slate-500">0원 입력 시 '무료'로 안내됩니다.</p>
                    </div>

                    <div className="bg-white p-2.5 rounded-lg border border-emerald-200/80 space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 block">
                        환급 금액 (원)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min={0}
                          step={1000}
                          placeholder="0 (환급 없음)"
                          value={editingGroup.refundFee === undefined || editingGroup.refundFee === 0 ? '' : editingGroup.refundFee}
                          onChange={(e) =>
                            setEditingGroup({
                              ...editingGroup,
                              refundFee: Math.max(0, parseInt(e.target.value) || 0),
                            })
                          }
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs font-bold text-slate-900 pr-8"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">원</span>
                      </div>
                      <p className="text-[10px] text-slate-500">목표 달성 시 지급할 환급 금액</p>
                    </div>
                  </div>

                  {/* Detailed Refund Settings (Edit Mode) */}
                  <div className="pt-2 border-t border-emerald-200/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingGroup.refundEnabled !== false}
                          onChange={(e) => setEditingGroup({ ...editingGroup, refundEnabled: e.target.checked })}
                          className="rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                        <span>환급 관리 시스템 활성화</span>
                      </label>
                      <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-100 px-2 py-0.5 rounded-full">
                        {editingGroup.refundEnabled !== false ? '환급 정책 적용' : '비활성'}
                      </span>
                    </div>

                    {editingGroup.refundEnabled !== false && (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                          <div>
                            <label className="text-[10px] font-bold text-slate-600 block mb-1">환급 방식</label>
                            <select
                              value={editingGroup.refundType || 'full'}
                              onChange={(e) => setEditingGroup({ ...editingGroup, refundType: e.target.value as 'full' | 'fixed' })}
                              className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-bold text-slate-800"
                            >
                              <option value="full">전액 환급 (참가비 100%)</option>
                              <option value="fixed">정액 환급 (지정 금액)</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-slate-600 block mb-1">환급 기준 달성률 (%)</label>
                            <div className="relative">
                              <input
                                type="number"
                                min={1}
                                max={100}
                                value={editingGroup.refundThreshold ?? 80}
                                onChange={(e) => setEditingGroup({ ...editingGroup, refundThreshold: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) })}
                                className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-bold text-slate-800 pr-6"
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-slate-600 block mb-1">환급 설정 금액 (원)</label>
                            <input
                              type="number"
                              min={0}
                              step={1000}
                              disabled={(editingGroup.refundType || 'full') === 'full'}
                              value={(editingGroup.refundType || 'full') === 'full' ? (editingGroup.fee ?? 0) : (editingGroup.refundAmount ?? 0)}
                              onChange={(e) => setEditingGroup({ ...editingGroup, refundAmount: parseInt(e.target.value) || 0 })}
                              className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-bold text-slate-800 disabled:bg-slate-100 disabled:text-slate-400"
                            />
                          </div>
                        </div>

                        <div className="bg-white p-2.5 rounded-lg border border-emerald-200/80 space-y-1 mt-2">
                          <label className="text-[11px] font-bold text-emerald-950 flex items-center justify-between">
                            <span>외부 환급 신청폼 URL (Google Forms 등)</span>
                            <span className="text-[10px] text-emerald-600 font-normal">보안: 계좌 미저장 방식</span>
                          </label>
                          <input
                            type="url"
                            placeholder="예: https://forms.google.com/e/1FAIpQLSc..."
                            value={editingGroup.refundFormUrl || ''}
                            onChange={(e) => setEditingGroup({ ...editingGroup, refundFormUrl: e.target.value })}
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs font-medium text-slate-900"
                          />
                          <p className="text-[10px] text-slate-500">
                            환급 기준 달성자에게 알림 및 링크가 발송되어 일회성으로 계좌를 제출받습니다.
                          </p>
                          {editingGroup.refundFormUrl?.trim() && !editingGroup.refundFormUrl.startsWith('http://') && !editingGroup.refundFormUrl.startsWith('https://') && (
                            <p className="text-[10px] text-rose-500 font-bold">
                              ⚠️ 올바른 웹 링크 주소 형식(http:// 또는 https://)으로 입력해주세요.
                            </p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* 🏦 입금 계좌 및 안내문 설정 (수정 모드) */}
                <div className="p-3 bg-blue-50/70 border border-blue-200/90 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                      <Building className="w-4 h-4 text-blue-600" />
                      <span>입금 계좌 및 참가자 안내문 설정</span>
                    </span>
                    <span className="text-[10px] text-blue-700 bg-blue-100 font-semibold px-2 py-0.5 rounded-full">
                      참가 신청 시 노출
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="bg-white p-2.5 rounded-lg border border-blue-200/80 space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 block">
                        입금 은행명
                      </label>
                      <input
                        type="text"
                        placeholder="예: 국민은행, 카카오뱅크, 토스뱅크"
                        value={editingGroup.bankName || ''}
                        onChange={(e) =>
                          setEditingGroup({ ...editingGroup, bankName: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs font-bold text-slate-900"
                      />
                    </div>

                    <div className="bg-white p-2.5 rounded-lg border border-blue-200/80 space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 block">
                        계좌번호
                      </label>
                      <input
                        type="text"
                        placeholder="예: 3333-01-1234567"
                        value={editingGroup.accountNumber || ''}
                        onChange={(e) =>
                          setEditingGroup({ ...editingGroup, accountNumber: e.target.value, bankAccount: `${editingGroup.bankName || ''} ${e.target.value}`.trim() })
                        }
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs font-bold text-slate-900"
                      />
                    </div>

                    <div className="bg-white p-2.5 rounded-lg border border-blue-200/80 space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 block">
                        예금주
                      </label>
                      <input
                        type="text"
                        placeholder="예: 홍길동(운영자)"
                        value={editingGroup.accountHolder || editingGroup.bankOwner || ''}
                        onChange={(e) =>
                          setEditingGroup({ ...editingGroup, accountHolder: e.target.value, bankOwner: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs font-bold text-slate-900"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5">
                    <div className="bg-white p-2.5 rounded-lg border border-blue-200/80 space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 block">
                        입금 마감 일시 안내문
                      </label>
                      <input
                        type="text"
                        placeholder="예: 모집 마감일 23:59까지 입금"
                        value={editingGroup.depositDeadline || ''}
                        onChange={(e) =>
                          setEditingGroup({ ...editingGroup, depositDeadline: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs font-medium text-slate-900"
                      />
                    </div>

                    <div className="bg-white p-2.5 rounded-lg border border-blue-200/80 space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 block">
                        입금 및 유의사항 안내문
                      </label>
                      <textarea
                        rows={2}
                        placeholder="참가자에게 안내할 입금 안내문 및 유의사항을 입력하세요."
                        value={editingGroup.depositNotice || ''}
                        onChange={(e) =>
                          setEditingGroup({ ...editingGroup, depositNotice: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs font-medium text-slate-900 resize-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-3 flex items-center justify-end space-x-2 border-t border-slate-100 shrink-0">
                  <button
                    type="button"
                    onClick={() => setEditingGroup(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    수정 내용 저장
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="bg-slate-50 p-6 border-t border-slate-200 flex justify-end">
        </div>

      </div>
    </div>
  );
};
