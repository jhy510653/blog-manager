import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Badge,
  UserBadge,
  BadgeConditionType,
  RevenueCertification,
  Participant,
} from '../../types';
import {
  Trophy,
  PlusCircle,
  Edit3,
  Trash2,
  CheckCircle2,
  XCircle,
  Search,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  Award,
  Layers,
  Eye,
  Sliders,
  DollarSign,
  TrendingUp,
  Save,
  X,
  UserCheck,
  UserPlus,
  Users,
  ShieldCheck,
  Calendar,
  Check,
} from 'lucide-react';
import { DEFAULT_INITIAL_BADGES } from '../../utils/badgeEvaluator';
import {
  fetchBadgesFromSupabase,
  fetchUserBadgesFromSupabase,
  saveBadgeToSupabase,
  updateBadgeInSupabase,
  deleteBadgeFromSupabase,
  fetchRevenueCertificationsFromSupabase,
  fetchParticipantsFromSupabase,
  batchEvaluateAllBadgesFromSupabase,
  awardUserBadgeInSupabase,
  revokeUserBadgeInSupabase,
} from '../../lib/supabase';

interface AdminBadgeManagementTabProps {
  badges?: Badge[];
  userBadges?: UserBadge[];
  revenueCertifications?: RevenueCertification[];
  participants?: Participant[];
  onSaveBadge?: (badge: Badge) => Promise<boolean> | void;
  onUpdateBadge?: (id: string, updates: Partial<Badge>) => Promise<boolean> | void;
  onDeleteBadge?: (id: string, hardDelete?: boolean) => Promise<boolean> | void;
  onBatchEvaluateBadges?: () => Promise<void> | void;
  onShowToast?: (msg: string) => void;
  onDataUpdated?: () => void;
}

const PRESET_ICONS = ['🌱', '⚡', '🔥', '👑', '💰', '💎', '🏆', '🚀', '🎖️', '🎯', '🌟', '🛡️', '📈', '🎪', '🦄', '⭐'];
const PRESET_COLORS = [
  '#10B981', // Emerald
  '#3B82F6', // Blue
  '#F97316', // Orange
  '#8B5CF6', // Purple
  '#F59E0B', // Amber
  '#06B6D4', // Cyan
  '#EC4899', // Pink
  '#6366F1', // Indigo
  '#F43F5E', // Rose
  '#475569', // Slate
];

export const AdminBadgeManagementTab: React.FC<AdminBadgeManagementTabProps> = ({
  badges: initialBadges,
  userBadges: initialUserBadges,
  revenueCertifications: initialCerts,
  participants: initialParticipants,
  onSaveBadge,
  onUpdateBadge,
  onDeleteBadge,
  onBatchEvaluateBadges,
  onShowToast,
  onDataUpdated,
}) => {
  const [internalBadges, setInternalBadges] = useState<Badge[]>(initialBadges || []);
  const [internalUserBadges, setInternalUserBadges] = useState<UserBadge[]>(initialUserBadges || []);
  const [internalCerts, setInternalCerts] = useState<RevenueCertification[]>(initialCerts || []);
  const [internalParticipants, setInternalParticipants] = useState<Participant[]>(initialParticipants || []);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Edit / Create Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBadgeId, setEditingBadgeId] = useState<string | null>(null);

  // Form states
  const [badgeName, setBadgeName] = useState('');
  const [badgeDescription, setBadgeDescription] = useState('');
  const [badgeIcon, setBadgeIcon] = useState('🌱');
  const [badgeColor, setBadgeColor] = useState('#10B981');
  const [badgeCategory, setBadgeCategory] = useState<string>('수익');
  const [conditionType, setConditionType] = useState<BadgeConditionType>('profit_verification_count');
  const [conditionValue, setConditionValue] = useState<number>(1);
  const [sortOrder, setSortOrder] = useState<number>(1);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState(false);

  // Delete modal state
  const [deletingBadge, setDeletingBadge] = useState<Badge | null>(null);
  const [isBatchEvaluating, setIsBatchEvaluating] = useState(false);

  // Viewing Earned Users Modal
  const [viewingBadgeUsers, setViewingBadgeUsers] = useState<Badge | null>(null);
  const [grantUserModalOpen, setGrantUserModalOpen] = useState(false);
  const [selectedUserToGrant, setSelectedUserToGrant] = useState<string>('');
  const [grantUserSearch, setGrantUserSearch] = useState<string>('');
  const [isGranting, setIsGranting] = useState(false);

  const showToast = useCallback((msg: string) => {
    if (onShowToast) {
      onShowToast(msg);
    } else {
      console.log('[Badge Toast]:', msg);
    }
  }, [onShowToast]);

  // Load from Supabase
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [bList, ubList, certList, pList] = await Promise.all([
        fetchBadgesFromSupabase(),
        fetchUserBadgesFromSupabase(),
        fetchRevenueCertificationsFromSupabase(),
        fetchParticipantsFromSupabase(),
      ]);

      setInternalBadges(bList.length > 0 ? bList : DEFAULT_INITIAL_BADGES);
      setInternalUserBadges(ubList);
      setInternalCerts(certList);
      setInternalParticipants(pList);
    } catch (e) {
      console.error('Failed to load badges from Supabase:', e);
      showToast('⚠️ 뱃지 데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Sync with prop updates if provided
  useEffect(() => {
    if (initialBadges && initialBadges.length > 0) {
      setInternalBadges(initialBadges);
    }
  }, [initialBadges]);

  useEffect(() => {
    if (initialUserBadges && initialUserBadges.length > 0) {
      setInternalUserBadges(initialUserBadges);
    }
  }, [initialUserBadges]);

  const badges = internalBadges;
  const userBadges = internalUserBadges;

  // Map of badgeId -> count of earned users
  const earnedUserCountMap = useMemo(() => {
    const map = new Map<string, number>();
    userBadges.forEach((ub) => {
      map.set(ub.badgeId, (map.get(ub.badgeId) || 0) + 1);
    });
    return map;
  }, [userBadges]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>(['수익', '챌린지', '활동', '기타']);
    badges.forEach((b) => {
      if (b.category) set.add(b.category);
    });
    return Array.from(set);
  }, [badges]);

  // Filtered badges list
  const filteredBadges = useMemo(() => {
    return [...badges]
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
      .filter((b) => {
        if (selectedCategory !== 'all' && b.category !== selectedCategory) return false;
        if (statusFilter === 'active' && !b.isActive) return false;
        if (statusFilter === 'inactive' && b.isActive) return false;
        if (searchTerm.trim()) {
          const query = searchTerm.toLowerCase();
          return (
            b.name.toLowerCase().includes(query) ||
            (b.description && b.description.toLowerCase().includes(query)) ||
            (b.category && b.category.toLowerCase().includes(query))
          );
        }
        return true;
      });
  }, [badges, selectedCategory, statusFilter, searchTerm]);

  const handleOpenCreate = () => {
    setEditingBadgeId(null);
    setBadgeName('');
    setBadgeDescription('');
    setBadgeIcon('🌱');
    setBadgeColor('#10B981');
    setBadgeCategory('수익');
    setConditionType('profit_verification_count');
    setConditionValue(1);
    setSortOrder(badges.length + 1);
    setIsActive(true);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (badge: Badge) => {
    setEditingBadgeId(badge.id);
    setBadgeName(badge.name);
    setBadgeDescription(badge.description || '');
    setBadgeIcon(badge.icon || '🌱');
    setBadgeColor(badge.color || '#10B981');
    setBadgeCategory(badge.category || '수익');
    setConditionType(badge.conditionType || 'profit_verification_count');
    setConditionValue(Number(badge.conditionValue) || 1);
    setSortOrder(Number(badge.sortOrder) || 0);
    setIsActive(badge.isActive !== false);
    setIsModalOpen(true);
  };

  const handleSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!badgeName.trim()) {
      alert('뱃지 이름을 입력해주세요.');
      return;
    }
    if (conditionValue <= 0) {
      alert('기준 달성 수치는 1 이상이어야 합니다.');
      return;
    }

    setIsSaving(true);
    try {
      const badgeId = editingBadgeId || `badge_${Date.now()}`;
      const payload: Badge = {
        id: badgeId,
        name: badgeName.trim(),
        description: badgeDescription.trim(),
        icon: badgeIcon.trim() || '🌱',
        color: badgeColor,
        category: badgeCategory,
        conditionType,
        conditionValue: Number(conditionValue),
        isActive,
        sortOrder: Number(sortOrder) || 0,
        createdAt: editingBadgeId
          ? badges.find((b) => b.id === editingBadgeId)?.createdAt || new Date().toISOString()
          : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Save directly to Supabase
      const ok = await saveBadgeToSupabase(payload);
      if (onSaveBadge) {
        await onSaveBadge(payload);
      }

      // Update internal state immediately
      setInternalBadges((prev) => {
        const idx = prev.findIndex((b) => b.id === payload.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = payload;
          return next;
        }
        return [...prev, payload];
      });

      showToast(`🎉 뱃지 [${payload.name}] 이(가) 성공적으로 저장되었습니다.`);
      setIsModalOpen(false);
      onDataUpdated?.();
      await loadData();
    } catch (err) {
      console.error('Badge save error:', err);
      showToast('⚠️ 뱃지 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (badge: Badge) => {
    const nextState = !badge.isActive;
    try {
      await updateBadgeInSupabase(badge.id, { isActive: nextState });
      if (onUpdateBadge) {
        await onUpdateBadge(badge.id, { isActive: nextState });
      }

      setInternalBadges((prev) =>
        prev.map((b) => (b.id === badge.id ? { ...b, isActive: nextState } : b))
      );

      showToast(
        nextState
          ? `✅ 뱃지 [${badge.name}] 이(가) 활성화되었습니다.`
          : `⏸️ 뱃지 [${badge.name}] 이(가) 비활성화되었습니다.`
      );
      onDataUpdated?.();
    } catch (e) {
      showToast('⚠️ 뱃지 상태 변경 중 오류가 발생했습니다.');
    }
  };

  const handleConfirmDelete = async (hardDelete: boolean) => {
    if (!deletingBadge) return;
    try {
      await deleteBadgeFromSupabase(deletingBadge.id, hardDelete);
      if (onDeleteBadge) {
        await onDeleteBadge(deletingBadge.id, hardDelete);
      }

      if (hardDelete) {
        setInternalBadges((prev) => prev.filter((b) => b.id !== deletingBadge.id));
        setInternalUserBadges((prev) => prev.filter((ub) => ub.badgeId !== deletingBadge.id));
      } else {
        setInternalBadges((prev) =>
          prev.map((b) => (b.id === deletingBadge.id ? { ...b, isActive: false } : b))
        );
      }

      showToast(
        hardDelete
          ? `🗑️ 뱃지 [${deletingBadge.name}] 이(가) 영구 삭제되었습니다.`
          : `📦 뱃지 [${deletingBadge.name}] 이(가) 비활성화(보관) 처리되었습니다.`
      );
      setDeletingBadge(null);
      onDataUpdated?.();
    } catch (e) {
      showToast('⚠️ 뱃지 삭제 중 오류가 발생했습니다.');
    }
  };

  const handleRunBatchEvaluation = async () => {
    setIsBatchEvaluating(true);
    try {
      if (onBatchEvaluateBadges) {
        await onBatchEvaluateBadges();
      } else {
        const res = await batchEvaluateAllBadgesFromSupabase();
        showToast(`🎉 전체 ${res.totalEvaluatedUsers}명 평가 완료! ${res.totalNewBadgesAwarded}건의 뱃지가 신규 지급되었습니다.`);
      }
      await loadData();
      onDataUpdated?.();
    } catch (e) {
      console.error('Batch evaluate error:', e);
      showToast('⚠️ 뱃지 일괄 평가 중 오류가 발생했습니다.');
    } finally {
      setIsBatchEvaluating(false);
    }
  };

  // Handle manual grant badge to user
  const handleGrantBadgeToUser = async () => {
    if (!viewingBadgeUsers || !selectedUserToGrant.trim()) {
      alert('뱃지를 지급할 회원을 선택해주세요.');
      return;
    }

    setIsGranting(true);
    try {
      const targetUser = internalParticipants.find(
        (p) => (p.blogId || p.participantName || p.id) === selectedUserToGrant
      );

      const userBadgeObj: UserBadge = {
        id: `ub_${selectedUserToGrant}_${viewingBadgeUsers.id}_${Date.now()}`,
        userId: selectedUserToGrant,
        badgeId: viewingBadgeUsers.id,
        earnedAt: new Date().toISOString(),
        metadata: {
          grantSource: 'admin_manual',
          grantedBy: '관리자 수동 지급',
          targetName: targetUser?.participantName || selectedUserToGrant,
        },
      };

      await awardUserBadgeInSupabase(userBadgeObj);
      showToast(`🎉 [${targetUser?.participantName || selectedUserToGrant}] 님에게 [${viewingBadgeUsers.name}] 뱃지를 지급했습니다.`);
      setGrantUserModalOpen(false);
      setSelectedUserToGrant('');
      await loadData();
      onDataUpdated?.();
    } catch (err) {
      console.error('Grant user badge error:', err);
      showToast('⚠️ 뱃지 수동 지급 중 오류가 발생했습니다.');
    } finally {
      setIsGranting(false);
    }
  };

  // Handle revoke user badge
  const handleRevokeUserBadge = async (userBadgeId: string, userName: string) => {
    if (!confirm(`정말로 [${userName}] 님의 뱃지 수여를 회수(취소)하시겠습니까?`)) return;

    try {
      await revokeUserBadgeInSupabase(userBadgeId);
      setInternalUserBadges((prev) => prev.filter((ub) => ub.id !== userBadgeId));
      showToast(`🗑️ 뱃지 수여가 회수되었습니다.`);
      onDataUpdated?.();
    } catch (err) {
      console.error('Revoke user badge error:', err);
      showToast('⚠️ 뱃지 회수 중 오류가 발생했습니다.');
    }
  };

  const formatConditionText = (b: Badge) => {
    switch (b.conditionType) {
      case 'profit_verification_count':
        return `수익 인증 ${b.conditionValue}회`;
      case 'total_profit':
        return `누적 수익 ${Number(b.conditionValue).toLocaleString()}원`;
      case 'challenge_complete':
        return `챌린지 참가/완주 ${b.conditionValue}회`;
      case 'streak_days':
        return `연속 포스팅 ${b.conditionValue}일`;
      default:
        return `${b.conditionType}: ${b.conditionValue}`;
    }
  };

  // Users who earned the currently viewed badge
  const earnedUsersForModal = useMemo(() => {
    if (!viewingBadgeUsers) return [];
    return userBadges
      .filter((ub) => ub.badgeId === viewingBadgeUsers.id)
      .map((ub) => {
        const matchedParticipant = internalParticipants.find(
          (p) =>
            p.id === ub.userId ||
            (p.blogId && p.blogId.toLowerCase() === ub.userId.toLowerCase()) ||
            (p.participantName && p.participantName.toLowerCase() === ub.userId.toLowerCase())
        );
        return {
          userBadgeId: ub.id,
          userId: ub.userId,
          name: matchedParticipant?.participantName || ub.userId,
          blogId: matchedParticipant?.blogId || '-',
          groupName: matchedParticipant?.groupName || '-',
          earnedAt: ub.earnedAt,
          metadata: ub.metadata,
        };
      });
  }, [viewingBadgeUsers, userBadges, internalParticipants]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Action Controls */}
      <div className="bg-gradient-to-r from-amber-900 via-amber-800 to-orange-900 rounded-3xl p-5 sm:p-6 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-amber-950 font-black text-[10px] tracking-wider uppercase">
              ACHIEVEMENT & BADGE ENGINE
            </span>
            <h2 className="text-lg font-black flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-300" />
              <span>Supabase 성과 뱃지 시스템 관리</span>
            </h2>
          </div>
          <p className="text-xs text-amber-100/90 leading-relaxed max-w-xl">
            수익 인증 횟수, 누적 인증 금액, 챌린지 참가 등 조건 기반의 성과 뱃지를 Supabase DB에서 동적으로 추가·수정·삭제하고 회원들에게 수여합니다.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white font-extrabold rounded-2xl text-xs backdrop-blur-xs transition-all border border-white/20 flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Supabase 최신 데이터 불러오기"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>새로고침</span>
          </button>

          <button
            type="button"
            disabled={isBatchEvaluating}
            onClick={handleRunBatchEvaluation}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-amber-950 font-extrabold rounded-2xl text-xs backdrop-blur-xs transition-all border border-amber-300/40 flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isBatchEvaluating ? 'animate-spin text-amber-900' : ''}`} />
            <span>{isBatchEvaluating ? '전체 평가 중...' : '전체 회원 뱃지 일괄 재평가'}</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="px-4 py-2.5 bg-white hover:bg-amber-100 text-amber-950 font-black rounded-2xl text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-md hover:scale-102 active:scale-98"
          >
            <PlusCircle className="w-4 h-4 text-amber-600" />
            <span>새 뱃지 만들기</span>
          </button>
        </div>
      </div>

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] font-bold text-slate-500">등록된 뱃지</p>
          <p className="text-xl font-black text-slate-900 mt-1">{badges.length}개</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] font-bold text-emerald-600">활성 뱃지</p>
          <p className="text-xl font-black text-emerald-700 mt-1">
            {badges.filter((b) => b.isActive).length}개
          </p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] font-bold text-amber-600">수여된 총 뱃지 수</p>
          <p className="text-xl font-black text-amber-700 mt-1">{userBadges.length}건</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] font-bold text-indigo-600">뱃지 보유 회원 수</p>
          <p className="text-xl font-black text-indigo-700 mt-1">
            {new Set(userBadges.map((ub) => ub.userId)).size}명
          </p>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-white p-4 rounded-2xl border border-slate-200">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            전체 카테고리
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-amber-500 outline-hidden"
          >
            <option value="all">전체 상태</option>
            <option value="active">활성화만</option>
            <option value="inactive">비활성화만</option>
          </select>

          <div className="relative flex-1 sm:w-52">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="뱃지명, 조건 검색..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-amber-500 outline-hidden"
            />
          </div>
        </div>
      </div>

      {/* Badges List / Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading && badges.length === 0 ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin text-amber-600" />
            <p className="text-xs font-bold">Supabase 뱃지 목록을 불러오는 중...</p>
          </div>
        ) : filteredBadges.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Trophy className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-600">등록된 뱃지가 없습니다.</p>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-colors"
            >
              + 첫 뱃지 생성하기
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-black text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4">정렬</th>
                  <th className="py-3 px-4">뱃지 정보</th>
                  <th className="py-3 px-4">카테고리</th>
                  <th className="py-3 px-4">획득 기준 조건</th>
                  <th className="py-3 px-4 text-center">획득자 수</th>
                  <th className="py-3 px-4 text-center">상태</th>
                  <th className="py-3 px-4 text-right">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {filteredBadges.map((badge) => {
                  const earnedCount = earnedUserCountMap.get(badge.id) || 0;

                  return (
                    <tr
                      key={badge.id}
                      className={`hover:bg-amber-50/30 transition-colors ${
                        !badge.isActive ? 'opacity-60 bg-slate-50/50' : ''
                      }`}
                    >
                      {/* Sort Order */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-400">
                        #{badge.sortOrder || 0}
                      </td>

                      {/* Badge Icon & Name */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-3">
                          <div
                            className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl shadow-xs border shrink-0"
                            style={{
                              backgroundColor: `${badge.color}15`,
                              borderColor: `${badge.color}40`,
                            }}
                          >
                            {badge.icon}
                          </div>
                          <div>
                            <div className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                              <span>{badge.name}</span>
                              {!badge.isActive && (
                                <span className="px-1.5 py-0.2 rounded bg-slate-200 text-slate-600 text-[9px] font-bold">
                                  비활성
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 line-clamp-1 max-w-xs mt-0.5">
                              {badge.description}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4">
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-extrabold"
                          style={{
                            backgroundColor: `${badge.color}15`,
                            color: badge.color,
                          }}
                        >
                          {badge.category}
                        </span>
                      </td>

                      {/* Condition */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <span className="font-bold text-slate-800">
                            {formatConditionText(badge)}
                          </span>
                          <p className="text-[10px] text-slate-400 font-mono">
                            Type: {badge.conditionType}
                          </p>
                        </div>
                      </td>

                      {/* Earned Users Count with Click to View Modal */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => setViewingBadgeUsers(badge)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-black cursor-pointer transition-all hover:scale-105 border ${
                            earnedCount > 0
                              ? 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
                              : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                          }`}
                          title="획득 회원 명단 보기 및 수동 지급/회수"
                        >
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {earnedCount}명
                          </span>
                        </button>
                      </td>

                      {/* Active Status Switch */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(badge)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold cursor-pointer transition-colors ${
                            badge.isActive
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                          }`}
                        >
                          {badge.isActive ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              활성
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 text-slate-500" />
                              비활성
                            </>
                          )}
                        </button>
                      </td>

                      {/* Action buttons */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center space-x-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(badge)}
                            className="p-1.5 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 border border-indigo-200 rounded-xl transition-colors cursor-pointer"
                            title="뱃지 수정"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingBadge(badge)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-xl transition-colors cursor-pointer"
                            title="뱃지 삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Earned Users Modal */}
      {viewingBadgeUsers && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-200 max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-amber-800 to-orange-800 p-4 sm:p-5 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center text-2xl shadow-md border shrink-0 bg-white"
                  style={{ borderColor: `${viewingBadgeUsers.color}40` }}
                >
                  {viewingBadgeUsers.icon}
                </div>
                <div>
                  <h3 className="text-base font-black flex items-center gap-2">
                    <span>{viewingBadgeUsers.name}</span>
                    <span className="text-xs font-normal text-amber-200">획득 회원 명단 ({earnedUsersForModal.length}명)</span>
                  </h3>
                  <p className="text-[11px] text-amber-100/80">
                    {formatConditionText(viewingBadgeUsers)} · {viewingBadgeUsers.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setGrantUserModalOpen(true)}
                  className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-amber-950 font-black rounded-xl text-xs transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>수동 뱃지 부여</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingBadgeUsers(null)}
                  className="p-1.5 rounded-full hover:bg-white/20 text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3">
              {earnedUsersForModal.length === 0 ? (
                <div className="p-8 text-center text-slate-500 space-y-2">
                  <Award className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold">아직 이 뱃지를 획득한 회원이 없습니다.</p>
                  <p className="text-[11px] text-slate-400">
                    [수동 뱃지 부여] 버튼을 눌러 특정 회원에게 직접 수여하거나, [전체 일괄 재평가]를 실행하세요.
                  </p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
                  {earnedUsersForModal.map((eu, idx) => (
                    <div key={eu.userBadgeId || idx} className="p-3 bg-white flex items-center justify-between hover:bg-slate-50">
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-2">
                          <span className="font-extrabold text-slate-900 text-xs">{eu.name}</span>
                          <span className="px-2 py-0.2 rounded text-[10px] bg-slate-100 text-slate-600 font-mono">
                            {eu.blogId !== '-' ? `@${eu.blogId}` : eu.userId}
                          </span>
                          {eu.groupName !== '-' && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] bg-indigo-50 text-indigo-700 font-semibold">
                              {eu.groupName}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400">
                          획득일: {eu.earnedAt ? new Date(eu.earnedAt).toLocaleString('ko-KR') : '기록 없음'}
                          {eu.metadata?.grantSource === 'admin_manual' && ' (관리자 수동 지급)'}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRevokeUserBadge(eu.userBadgeId, eu.name)}
                        className="px-2.5 py-1 text-xs text-rose-600 hover:text-rose-800 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors font-bold cursor-pointer"
                        title="뱃지 회수"
                      >
                        회수
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Manual Grant Modal */}
      {grantUserModalOpen && viewingBadgeUsers && (
        <div className="fixed inset-0 z-70 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl p-5 border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-600" />
                <span>[{viewingBadgeUsers.name}] 뱃지 수동 지급</span>
              </h4>
              <button
                type="button"
                onClick={() => setGrantUserModalOpen(false)}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">회원 검색 및 선택</label>
                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={grantUserSearch}
                    onChange={(e) => setGrantUserSearch(e.target.value)}
                    placeholder="이름 또는 블로그ID 검색..."
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-amber-500 outline-hidden"
                  />
                </div>

                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                  {internalParticipants
                    .filter((p) => {
                      if (!grantUserSearch.trim()) return true;
                      const q = grantUserSearch.toLowerCase();
                      return (
                        p.participantName.toLowerCase().includes(q) ||
                        (p.blogId && p.blogId.toLowerCase().includes(q)) ||
                        (p.groupName && p.groupName.toLowerCase().includes(q))
                      );
                    })
                    .slice(0, 30)
                    .map((p) => {
                      const userKey = p.blogId || p.participantName || p.id;
                      const isSelected = selectedUserToGrant === userKey;
                      const isAlreadyEarned = earnedUsersForModal.some(
                        (eu) => eu.userId === userKey || eu.name === p.participantName || (p.blogId && eu.blogId === p.blogId)
                      );

                      return (
                        <div
                          key={p.id}
                          onClick={() => !isAlreadyEarned && setSelectedUserToGrant(userKey)}
                          className={`p-2.5 flex items-center justify-between text-xs cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-amber-50 border-l-4 border-amber-600 font-bold'
                              : isAlreadyEarned
                              ? 'opacity-50 bg-slate-50 cursor-not-allowed'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <div>
                            <span className="font-bold text-slate-900">{p.participantName}</span>
                            <span className="text-slate-400 text-[10px] ml-1.5 font-mono">
                              {p.blogId ? `@${p.blogId}` : ''}
                            </span>
                          </div>
                          {isAlreadyEarned ? (
                            <span className="text-[10px] text-emerald-600 font-bold">이미 보유</span>
                          ) : isSelected ? (
                            <Check className="w-4 h-4 text-amber-600 font-black" />
                          ) : null}
                        </div>
                      );
                    })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setGrantUserModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="button"
                  disabled={!selectedUserToGrant || isGranting}
                  onClick={handleGrantBadgeToUser}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-extrabold rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Award className="w-3.5 h-3.5" />
                  <span>{isGranting ? '지급 중...' : '선택 회원에게 뱃지 지급'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden border border-slate-200 max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-amber-700 to-orange-700 p-5 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center font-black text-white text-lg">
                  <Trophy className="w-5 h-5 text-amber-200" />
                </div>
                <div>
                  <h3 className="text-base font-black">
                    {editingBadgeId ? '뱃지 수정하기' : '새 성과 뱃지 만들기'}
                  </h3>
                  <p className="text-xs text-amber-100/90">
                    뱃지 이름, 아이콘, 획득 조건 수치를 설정하세요. 수정 시 Supabase DB에 즉시 저장됩니다.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-full hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveSubmit} className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
              {/* Live Preview Card */}
              <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200/80 flex items-center gap-4">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-md border shrink-0 bg-white"
                  style={{
                    boxShadow: `0 8px 16px -2px ${badgeColor}40`,
                    borderColor: `${badgeColor}30`,
                  }}
                >
                  {badgeIcon || '🌱'}
                </div>
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="px-2 py-0.2 text-[9px] font-extrabold rounded"
                      style={{ backgroundColor: `${badgeColor}20`, color: badgeColor }}
                    >
                      {badgeCategory || '수익'}
                    </span>
                    <h4 className="text-xs font-black text-slate-900 truncate">
                      {badgeName || '새 뱃지 이름'}
                    </h4>
                  </div>
                  <p className="text-[11px] text-slate-600 line-clamp-1">
                    {badgeDescription || '뱃지 획득 시 표시될 설명 문구입니다.'}
                  </p>
                  <p className="text-[10px] text-amber-900 font-bold">
                    조건: {conditionType} ({conditionValue.toLocaleString()})
                  </p>
                </div>
              </div>

              {/* 1. Name & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    뱃지 이름 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={badgeName}
                    onChange={(e) => setBadgeName(e.target.value)}
                    placeholder="예: 첫 수익 인증"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 outline-hidden"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 block">카테고리</label>
                  <input
                    type="text"
                    value={badgeCategory}
                    onChange={(e) => setBadgeCategory(e.target.value)}
                    placeholder="수익 / 챌린지 / 활동 / 기타"
                    list="category-suggestions"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 outline-hidden"
                  />
                  <datalist id="category-suggestions">
                    <option value="수익" />
                    <option value="챌린지" />
                    <option value="활동" />
                    <option value="기타" />
                  </datalist>
                </div>
              </div>

              {/* 2. Description */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 block">뱃지 설명 문구</label>
                <textarea
                  rows={2}
                  value={badgeDescription}
                  onChange={(e) => setBadgeDescription(e.target.value)}
                  placeholder="예: 첫 번째 수익 인증을 완료하고 성장의 첫걸음을 내디뎠습니다."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-amber-500 outline-hidden resize-none"
                />
              </div>

              {/* 3. Icon & Color Picker */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                {/* Icon selection */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-700 block">아이콘 (이모지)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={badgeIcon}
                      onChange={(e) => setBadgeIcon(e.target.value)}
                      className="w-12 h-10 text-center text-xl bg-white border border-slate-200 rounded-xl font-bold"
                    />
                    <div className="flex flex-wrap gap-1 flex-1">
                      {PRESET_ICONS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => setBadgeIcon(emoji)}
                          className="w-7 h-7 rounded-lg hover:bg-white text-base flex items-center justify-center transition-colors cursor-pointer border border-transparent hover:border-slate-200"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Color selection */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-700 block">테마 색상</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={badgeColor}
                      onChange={(e) => setBadgeColor(e.target.value)}
                      className="w-10 h-10 rounded-xl border border-slate-200 cursor-pointer p-0.5 bg-white"
                    />
                    <div className="flex flex-wrap gap-1.5 flex-1">
                      {PRESET_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setBadgeColor(c)}
                          className="w-6 h-6 rounded-full transition-transform hover:scale-115 border border-white shadow-2xs cursor-pointer"
                          style={{
                            backgroundColor: c,
                            outline: badgeColor === c ? '2px solid #0f172a' : undefined,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. Condition Settings */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-amber-600" />
                  <span>뱃지 자동 획득 조건 설정</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 block">조건 유형</label>
                    <select
                      value={conditionType}
                      onChange={(e) => setConditionType(e.target.value as any)}
                      className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 outline-hidden"
                    >
                      <option value="profit_verification_count">수익 인증 횟수 (회)</option>
                      <option value="total_profit">누적 인증 수익 금액 (원)</option>
                      <option value="challenge_complete">챌린지 참가 / 완주 (회)</option>
                      <option value="streak_days">연속 포스팅 스트릭 (일)</option>
                      <option value="profit_platform">플랫폼별 수익 인증 (cpa/shopping 등)</option>
                      <option value="custom">기타 수동 / 커스텀</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 block">
                      목표 기준치 (숫자)
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={conditionValue}
                      onChange={(e) => setConditionValue(Number(e.target.value))}
                      className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 outline-hidden"
                    />
                    <p className="text-[10px] text-slate-500">
                      {conditionType === 'total_profit'
                        ? `금액: ${conditionValue.toLocaleString()}원`
                        : `${conditionValue}회 달성 시 자동 수여`}
                    </p>
                  </div>
                </div>
              </div>

              {/* 5. Sort Order & Active */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-center">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 block">정렬 순서</label>
                  <input
                    type="number"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(Number(e.target.value))}
                    placeholder="0"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 outline-hidden"
                  />
                </div>

                <div className="flex items-center space-x-2 pt-5">
                  <input
                    type="checkbox"
                    id="badge-active-toggle"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 text-amber-600 rounded-md focus:ring-amber-500 cursor-pointer"
                  />
                  <label
                    htmlFor="badge-active-toggle"
                    className="text-xs font-bold text-slate-800 cursor-pointer"
                  >
                    뱃지 활성화 (체크 해제 시 유저 화면에 미노출)
                  </label>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-extrabold rounded-xl text-xs transition-colors shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? '저장 중...' : '뱃지 저장하기 (즉시 적용)'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (Soft vs Hard Delete) */}
      {deletingBadge && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl p-6 border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-extrabold text-slate-900">
                뱃지 [{deletingBadge.name}] 삭제 확인
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                현재 이 뱃지를 획득한 회원은{' '}
                <strong className="text-amber-700">
                  {earnedUserCountMap.get(deletingBadge.id) || 0}명
                </strong>
                입니다.
              </p>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs text-slate-600 space-y-1">
              <p>
                • <strong>비활성화 (보관)</strong>: 유저의 기존 획득 기록을 보존하면서 새로운 획득을 중단합니다.
              </p>
              <p className="text-rose-600">
                • <strong>영구 삭제</strong>: 해당 뱃지 및 회원들의 획득 내역까지 Supabase DB에서 완전 삭제됩니다.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleConfirmDelete(false)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                비활성화 (보관)
              </button>
              <button
                type="button"
                onClick={() => handleConfirmDelete(true)}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                영구 삭제
              </button>
            </div>

            <button
              type="button"
              onClick={() => setDeletingBadge(null)}
              className="w-full py-2 text-slate-500 hover:text-slate-800 text-xs font-semibold cursor-pointer"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
