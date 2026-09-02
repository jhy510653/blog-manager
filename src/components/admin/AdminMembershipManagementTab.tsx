import React, { useState, useEffect, useMemo } from 'react';
import {
  MembershipTier,
  FeatureItem,
  TierFeature,
  UserMembership,
  UsageLog,
  Product,
  Purchase,
  MembershipSourceType,
} from '../../types';
import {
  DEFAULT_MEMBERSHIP_TIERS,
  DEFAULT_FEATURES,
  DEFAULT_TIER_FEATURES,
  DEFAULT_PRODUCTS,
} from '../../config/membershipDefaults';
import {
  getParticipantDefaultTierId,
  setParticipantDefaultTierId,
} from '../../services/membershipService';
import {
  fetchMembershipTiers,
  fetchFeatures,
  fetchTierFeatures,
  upsertMembershipTier,
  deleteMembershipTier,
  upsertTierFeatures,
  upsertUserMembership,
  fetchUserMemberships,
  fetchUsageLogs,
  resetUsageLogs,
  fetchProductsFromSupabase,
  saveProductToSupabase,
  deleteProductFromSupabase,
  fetchPurchasesFromSupabase,
  createPurchaseAndGrantTierInSupabase,
  fetchAllProfilesAndMembershipsFromSupabase,
  deleteUserSafelyFromSupabase,
} from '../../lib/supabase';
import {
  Layers,
  ShieldCheck,
  Users,
  Plus,
  Trash2,
  Copy,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Clock,
  Infinity as InfinityIcon,
  Activity,
  Search,
  Sliders,
  Edit2,
  Sparkles,
  Lock,
  ChevronRight,
  Filter,
  BarChart3,
  RotateCcw,
  ShoppingBag,
  CreditCard,
  Tag,
  Check,
  X,
  ExternalLink,
  Award,
  UserCheck,
  Merge,
  ArrowRight,
  HelpCircle,
  FileText,
} from 'lucide-react';

interface MemberItem {
  userId: string;
  name: string;
  email: string;
  naverId?: string;
  role?: string;
  tierId: string;
  tierName: string;
  membershipStatus: string;
  expiresAt: string | null;
  sourceType?: string;
  sourceId?: string;
  notes?: string;
  createdAt: string;
}

const getAdminToken = (): string => {
  if (typeof sessionStorage !== 'undefined') {
    const sTok = sessionStorage.getItem('admin_token') || sessionStorage.getItem('admin_auth_token');
    if (sTok) return sTok;
  }
  if (typeof localStorage !== 'undefined') {
    const lTok = localStorage.getItem('admin_token') || localStorage.getItem('admin_auth_token');
    if (lTok) return lTok;
  }
  return 'CHAMSAE1_blog';
};

export const AdminMembershipManagementTab: React.FC = () => {
  const [mainSection, setMainSection] = useState<'members' | 'products' | 'purchases' | 'permissions'>('members');
  const [permSubTab, setPermSubTab] = useState<'matrix' | 'tiers' | 'logs'>('matrix');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Data states
  const [tiers, setTiers] = useState<MembershipTier[]>(DEFAULT_MEMBERSHIP_TIERS);
  const [features, setFeatures] = useState<FeatureItem[]>(DEFAULT_FEATURES);
  const [tierFeatures, setTierFeatures] = useState<TierFeature[]>([]);
  const [userMemberships, setUserMemberships] = useState<UserMembership[]>([]);
  const [membersList, setMembersList] = useState<MemberItem[]>([]);
  const [products, setProducts] = useState<Product[]>(DEFAULT_PRODUCTS);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [usageLogs, setUsageLogs] = useState<UsageLog[]>([]);

  // Selected tier for matrix configuration
  const [selectedTierId, setSelectedTierId] = useState<string>('free');

  // Challenge Participant Default Tier State
  const [participantDefaultTier, setParticipantDefaultTier] = useState<string>(() => getParticipantDefaultTierId());

  // Matrix edits in progress: tierId -> featureId -> { enabled, usageLimit, usagePeriod }
  const [matrixEdits, setMatrixEdits] = useState<Record<string, Record<string, { enabled: boolean; usageLimit: number | null; usagePeriod: 'daily' | 'weekly' | 'monthly' | 'none' }>>>({});

  // Tier modal / new tier form state
  const [isAddingTier, setIsAddingTier] = useState<boolean>(false);
  const [newTierForm, setNewTierForm] = useState<{ id: string; name: string; description: string; isActive: boolean; sortOrder: number }>({
    id: '',
    name: '',
    description: '',
    isActive: true,
    sortOrder: 5,
  });
  const [editingTier, setEditingTier] = useState<MembershipTier | null>(null);

  // User tier assignment form state with Member Picker
  const [isAssigningUser, setIsAssigningUser] = useState<boolean>(false);
  const [memberPickerSearch, setMemberPickerSearch] = useState<string>('');
  const [userAssignForm, setUserAssignForm] = useState<{
    userId: string;
    userName?: string;
    userEmail?: string;
    tierId: string;
    status: 'active' | 'expired' | 'suspended';
    durationDays: string;
    expiresAt: string;
    notes: string;
  }>({
    userId: '',
    userName: '',
    userEmail: '',
    tierId: 'pro',
    status: 'active',
    durationDays: '30',
    expiresAt: '',
    notes: '',
  });
  const [userSearchQuery, setUserSearchQuery] = useState<string>('');
  const [userTierFilter, setUserTierFilter] = useState<string>('all');

  // Duplicate User Merger State
  const [isMergeModalOpen, setIsMergeModalOpen] = useState<boolean>(false);
  const [mergePrimaryUserId, setMergePrimaryUserId] = useState<string>('');
  const [mergeSelectedDuplicates, setMergeSelectedDuplicates] = useState<string[]>([]);
  const [mergeTargetTier, setMergeTargetTier] = useState<string>('pro');

  // Product modal form state
  const [isAddingProduct, setIsAddingProduct] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState<{
    id: string;
    name: string;
    description: string;
    productType: 'membership' | 'ai_usage' | 'challenge' | 'general';
    price: number;
    originalPrice?: number;
    membershipTier: string;
    durationDays: string;
    aiUsageAddCount: string;
    badge: string;
    isActive: boolean;
    sortOrder: number;
  }>({
    id: '',
    name: '',
    description: '',
    productType: 'membership',
    price: 39000,
    originalPrice: 49000,
    membershipTier: 'pro',
    durationDays: '30',
    aiUsageAddCount: '',
    badge: '인기',
    isActive: true,
    sortOrder: 1,
  });

  // Manual purchase modal state
  const [isAddingPurchase, setIsAddingPurchase] = useState<boolean>(false);
  const [purchaseMemberPickerSearch, setPurchaseMemberPickerSearch] = useState<string>('');
  const [purchaseForm, setPurchaseForm] = useState<{
    userId: string;
    userName: string;
    userEmail: string;
    productId: string;
    amount: number;
    paymentMethod: string;
    durationDays: string;
    notes: string;
  }>({
    userId: '',
    userName: '',
    userEmail: '',
    productId: '',
    amount: 0,
    paymentMethod: 'admin_grant',
    durationDays: '30',
    notes: '관리자 수동 지급',
  });

  // Purchases Filter
  const [purchaseSearchQuery, setPurchaseSearchQuery] = useState<string>('');
  const [purchaseStatusFilter, setPurchaseStatusFilter] = useState<string>('all');

  // Products Filter
  const [productSearchQuery, setProductSearchQuery] = useState<string>('');
  const [productStatusFilter, setProductStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Logs filter
  const [logFilterUser, setLogFilterUser] = useState<string>('');
  const [logFilterFeature, setLogFilterFeature] = useState<string>('all');

  const showNotification = (msg: string, isErr = false) => {
    if (isErr) {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(''), 4000);
    } else {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(''), 3000);
    }
  };

  // Load all data
  const loadAllData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [dbTiers, dbFeatures, dbTf, dbUm, dbLogs, dbProds, dbPurchases, dbMembers] = await Promise.all([
        fetchMembershipTiers(),
        fetchFeatures(),
        fetchTierFeatures(),
        fetchUserMemberships(),
        fetchUsageLogs(undefined, 150),
        fetchProductsFromSupabase(),
        fetchPurchasesFromSupabase(),
        fetchAllProfilesAndMembershipsFromSupabase(),
      ]);

      const effectiveTiers = dbTiers.length > 0 ? dbTiers : DEFAULT_MEMBERSHIP_TIERS;
      const effectiveFeatures = dbFeatures.length > 0 ? dbFeatures : DEFAULT_FEATURES;
      const effectiveProducts = dbProds.length > 0 ? dbProds : DEFAULT_PRODUCTS;

      setTiers(effectiveTiers);
      setFeatures(effectiveFeatures);
      setUserMemberships(dbUm);
      setUsageLogs(dbLogs);
      setTierFeatures(dbTf);
      setProducts(effectiveProducts);
      setPurchases(dbPurchases);
      setMembersList(dbMembers);

      // Build matrix edits state
      const initialMatrix: Record<string, Record<string, any>> = {};
      for (const t of effectiveTiers) {
        initialMatrix[t.id] = {};
        for (const f of effectiveFeatures) {
          const matchedTf = dbTf.find((tf) => tf.tierId === t.id && (tf.featureId === f.id || tf.featureId === `feat_${f.featureKey}`));
          if (matchedTf) {
            initialMatrix[t.id][f.id] = {
              enabled: matchedTf.enabled,
              usageLimit: matchedTf.usageLimit,
              usagePeriod: matchedTf.usagePeriod || 'none',
            };
          } else {
            const defaultConf = DEFAULT_TIER_FEATURES[t.id]?.[f.featureKey] || { enabled: true, usageLimit: 3, usagePeriod: 'daily' };
            initialMatrix[t.id][f.id] = {
              enabled: defaultConf.enabled,
              usageLimit: defaultConf.usageLimit,
              usagePeriod: defaultConf.usagePeriod,
            };
          }
        }
      }
      setMatrixEdits(initialMatrix);
    } catch (err: any) {
      console.error('Failed to load membership data:', err);
      showNotification('데이터를 불러오는 중 오류가 발생했습니다: ' + (err?.message || ''), true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Handle matrix value changes
  const handleMatrixChange = (
    tierId: string,
    featureId: string,
    field: 'enabled' | 'usageLimit' | 'usagePeriod',
    value: any
  ) => {
    setMatrixEdits((prev) => {
      const tierMap = { ...(prev[tierId] || {}) };
      const currentSetting = tierMap[featureId] || { enabled: true, usageLimit: 3, usagePeriod: 'daily' };
      tierMap[featureId] = {
        ...currentSetting,
        [field]: value,
      };
      return {
        ...prev,
        [tierId]: tierMap,
      };
    });
  };

  // Save matrix for current tier
  const handleSaveTierMatrix = async (tierId: string) => {
    setSaving(true);
    try {
      const tierSettings = matrixEdits[tierId] || {};
      const tfObjects: TierFeature[] = [];

      for (const f of features) {
        const conf = tierSettings[f.id] || { enabled: true, usageLimit: null, usagePeriod: 'none' };
        tfObjects.push({
          id: `tf_${tierId}_${f.id}`,
          tierId,
          featureId: f.id,
          enabled: conf.enabled,
          usageLimit: conf.usageLimit,
          usagePeriod: conf.usagePeriod,
        });
      }

      await upsertTierFeatures(tfObjects);
      showNotification(`'${tiers.find((t) => t.id === tierId)?.name || tierId}' 등급의 기능 권한 및 사용량 제한이 저장되었습니다.`);
      await loadAllData();
    } catch (err: any) {
      showNotification('저장 중 오류가 발생했습니다: ' + (err?.message || ''), true);
    } finally {
      setSaving(false);
    }
  };

  // Change and persist challenge participant default tier
  const handleSaveParticipantDefaultTier = (newTier: string) => {
    setParticipantDefaultTier(newTier);
    setParticipantDefaultTierId(newTier);
    const tierObj = tiers.find((t) => t.id === newTier);
    showNotification(`챌린지 참가자의 기본 권한 등급이 '${tierObj?.name || newTier}'(으)로 설정되었습니다. 별도 유료 구독이 없는 모든 챌린지 참가자에게 즉시 적용됩니다.`);
  };

  // Save new or edited tier
  const handleSaveTier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTierForm.id || !newTierForm.name) {
      showNotification('등급 ID와 등급 이름을 입력해 주세요.', true);
      return;
    }

    setSaving(true);
    try {
      const cleanId = newTierForm.id.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
      const tierObj: MembershipTier = {
        id: cleanId,
        name: newTierForm.name.trim(),
        description: newTierForm.description.trim(),
        isActive: newTierForm.isActive,
        sortOrder: Number(newTierForm.sortOrder) || 5,
      };

      await upsertMembershipTier(tierObj);
      showNotification(`'${tierObj.name}' 등급이 저장되었습니다.`);
      setIsAddingTier(false);
      setEditingTier(null);
      setNewTierForm({ id: '', name: '', description: '', isActive: true, sortOrder: 5 });
      await loadAllData();
    } catch (err: any) {
      showNotification('등급 저장 실패: ' + (err?.message || ''), true);
    } finally {
      setSaving(false);
    }
  };

  // Delete tier
  const handleDeleteTier = async (tierId: string, tierName: string) => {
    if (['free', 'basic', 'pro', 'vip', 'admin'].includes(tierId)) {
      showNotification('기본 시스템 등급은 삭제할 수 없습니다.', true);
      return;
    }
    if (!window.confirm(`정말로 '${tierName}' 등급을 삭제하시겠습니까? 관련 설정이 모두 제거됩니다.`)) {
      return;
    }

    setSaving(true);
    try {
      await deleteMembershipTier(tierId);
      showNotification(`'${tierName}' 등급이 삭제되었습니다.`);
      if (selectedTierId === tierId) setSelectedTierId('free');
      await loadAllData();
    } catch (err: any) {
      showNotification('등급 삭제 실패: ' + (err?.message || ''), true);
    } finally {
      setSaving(false);
    }
  };

  // Quick Change Member Tier
  const handleQuickChangeMemberTier = async (userId: string, newTierId: string, durationDays: number = 30) => {
    const targetTier = tiers.find((t) => t.id === newTierId);
    const tierName = targetTier?.name || newTierId;
    const member = membersList.find((m) => m.userId === userId);

    // Optimistically update local state immediately
    setMembersList((prev) =>
      prev.map((m) =>
        m.userId === userId
          ? {
              ...m,
              tierId: newTierId,
              tierName,
              membershipStatus: 'active',
            }
          : m
      )
    );

    setSaving(true);
    try {
      const now = new Date();
      let expiresAt: string | null = null;
      if (durationDays > 0) {
        const exp = new Date(now);
        exp.setDate(exp.getDate() + durationDays);
        expiresAt = exp.toISOString();
      }

      const adminToken = getAdminToken();

      // 1. Call server-side admin API
      const res = await fetch('/api/admin/membership/user-tier', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken ? { Authorization: `Bearer ${adminToken}`, 'x-admin-token': adminToken } : {}),
        },
        body: JSON.stringify({
          userId: userId.toLowerCase().trim(),
          userEmail: member?.email,
          userName: member?.name,
          tierId: newTierId,
          status: 'active',
          durationDays,
          expiresAt,
          notes: `관리자 ${durationDays}일 부여`,
          adminToken,
        }),
      });

      // 2. Also update client Supabase for cache coherence
      const supabaseResult = await upsertUserMembership({
        id: `um_${userId.toLowerCase().trim()}`,
        userId: userId.toLowerCase().trim(),
        userEmail: member?.email,
        userName: member?.name,
        tierId: newTierId,
        status: 'active',
        startsAt: now.toISOString(),
        expiresAt,
        sourceType: 'admin',
        sourceId: 'admin_quick_change',
        notes: `관리자 ${durationDays}일 부여`,
      });

      if (!supabaseResult.success && supabaseResult.error) {
        throw new Error('Supabase 저장 실패: ' + supabaseResult.error);
      }

      const data = await res.json().catch(() => ({ success: false, message: '서버 응답 파싱 실패' }));
      if (!res.ok || !data.success) {
        throw new Error(data.message || '서버 등급 변경 요청 실패');
      }

      showNotification(`회원 '${member?.name || userId}'의 등급이 '${tierName}'(으)로 즉시 변경 저장되었습니다.`);
      await loadAllData();
    } catch (err: any) {
      showNotification('등급 변경 실패: ' + (err?.message || ''), true);
      await loadAllData();
    } finally {
      setSaving(false);
    }
  };

  // Save User Tier Assignment Detailed Form
  const handleSaveUserAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userAssignForm.userId || !userAssignForm.tierId) {
      showNotification('회원을 선택하고 등급을 지정해 주세요.', true);
      return;
    }

    setSaving(true);
    try {
      const cleanUserId = userAssignForm.userId.trim().toLowerCase();
      const now = new Date();
      let expiresAt: string | null = null;

      if (userAssignForm.expiresAt) {
        expiresAt = new Date(userAssignForm.expiresAt).toISOString();
      } else if (userAssignForm.durationDays && Number(userAssignForm.durationDays) > 0) {
        const exp = new Date(now);
        exp.setDate(exp.getDate() + Number(userAssignForm.durationDays));
        expiresAt = exp.toISOString();
      }

      const adminToken = getAdminToken();

      // 1. Call server-side admin API
      const res = await fetch('/api/admin/membership/user-tier', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken ? { Authorization: `Bearer ${adminToken}`, 'x-admin-token': adminToken } : {}),
        },
        body: JSON.stringify({
          userId: cleanUserId,
          userEmail: userAssignForm.userEmail,
          userName: userAssignForm.userName,
          tierId: userAssignForm.tierId,
          status: userAssignForm.status,
          durationDays: userAssignForm.durationDays,
          expiresAt,
          notes: userAssignForm.notes || '관리자 수동 지정',
          adminToken,
        }),
      });

      // 2. Also update client Supabase
      const supabaseResult = await upsertUserMembership({
        id: `um_${cleanUserId}`,
        userId: cleanUserId,
        userEmail: userAssignForm.userEmail,
        userName: userAssignForm.userName,
        tierId: userAssignForm.tierId,
        status: userAssignForm.status,
        startsAt: now.toISOString(),
        expiresAt,
        sourceType: 'admin',
        sourceId: 'admin_manual',
        notes: userAssignForm.notes || '관리자 수동 지정',
      });

      if (!supabaseResult.success && supabaseResult.error) {
        throw new Error('Supabase 저장 실패: ' + supabaseResult.error);
      }

      const data = await res.json().catch(() => ({ success: false, message: '서버 응답 파싱 실패' }));
      if (!res.ok || !data.success) {
        throw new Error(data.message || '서버 등급 저장 요청 실패');
      }

      showNotification(`회원 '${userAssignForm.userName || userAssignForm.userId}'에게 '${tiers.find((t) => t.id === userAssignForm.tierId)?.name}' 등급이 부여되었습니다.`);
      setIsAssigningUser(false);
      setUserAssignForm({
        userId: '',
        userName: '',
        userEmail: '',
        tierId: 'pro',
        status: 'active',
        durationDays: '30',
        expiresAt: '',
        notes: '',
      });
      await loadAllData();
    } catch (err: any) {
      showNotification('회원 등급 부여 실패: ' + (err?.message || ''), true);
    } finally {
      setSaving(false);
    }
  };

  // Toggle Product Active/Inactive
  const handleToggleProductActive = async (product: Product) => {
    const nextActive = !product.isActive;
    const updatedProd: Product = { ...product, isActive: nextActive };

    // Optimistic local update
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? updatedProd : p))
    );

    try {
      await saveProductToSupabase(updatedProd);
      showNotification(`상품 '${product.name}'이(가) ${nextActive ? '활성화' : '비활성화'}되었습니다.`);
    } catch (err: any) {
      showNotification('상품 상태 변경 실패: ' + (err?.message || ''), true);
      await loadAllData();
    }
  };

  // Save Product
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name || !productForm.price) {
      showNotification('상품명과 가격을 입력해 주세요.', true);
      return;
    }

    setSaving(true);
    try {
      const cleanId = productForm.id.trim() || `prod_${Date.now()}`;
      const productPayload: Product = {
        id: cleanId,
        name: productForm.name.trim(),
        description: productForm.description.trim(),
        productType: productForm.productType,
        price: Number(productForm.price) || 0,
        originalPrice: productForm.originalPrice ? Number(productForm.originalPrice) : undefined,
        membershipTier: productForm.productType === 'membership' ? productForm.membershipTier : undefined,
        durationDays: productForm.durationDays ? Number(productForm.durationDays) : null,
        aiUsageAddCount: productForm.aiUsageAddCount ? Number(productForm.aiUsageAddCount) : null,
        badge: productForm.badge.trim() || undefined,
        isActive: productForm.isActive,
        sortOrder: Number(productForm.sortOrder) || 1,
        features: editingProduct?.features || [],
      };

      // Optimistic update
      setProducts((prev) => {
        const idx = prev.findIndex((p) => p.id === productPayload.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = productPayload;
          return next;
        }
        return [...prev, productPayload];
      });

      await saveProductToSupabase(productPayload);
      showNotification(`🎉 상품 '${productPayload.name}'이(가) 즉시 저장되었습니다.`);
      setIsAddingProduct(false);
      setEditingProduct(null);
      await loadAllData();
    } catch (err: any) {
      showNotification('상품 저장 실패: ' + (err?.message || ''), true);
    } finally {
      setSaving(false);
    }
  };

  // Delete Product with Linked Purchase History Check & Force Option
  const handleDeleteProduct = async (product: { id: string; name: string }, force = false) => {
    const linkedPurchasesCount = purchases.filter((pu) => pu.productId === product.id).length;

    if (force) {
      const confirmMsg = linkedPurchasesCount > 0
        ? `[영구 완전 삭제]\n\n'${product.name}' 상품을 영구 삭제하시겠습니까?\n\n※ 과거 구매 내역(${linkedPurchasesCount}건)과의 연결을 해제하고 데이터베이스에서 영구히 삭제됩니다.`
        : `'${product.name}' 상품을 영구 삭제하시겠습니까?`;

      if (!window.confirm(confirmMsg)) return;
    } else {
      if (linkedPurchasesCount > 0) {
        const confirmMsg = `'${product.name}' 상품을 판매 중지(삭제)하시겠습니까?\n\n※ 이 상품은 과거 구매 내역(${linkedPurchasesCount}건)이 존재합니다.\n- [확인]: 과거 구매 데이터 보존을 위해 [판매 중지(비활성화)] 상태로 안전하게 전환됩니다.\n(영구 삭제를 원하시면 비활성화 후 [영구 삭제] 버튼을 이용해 주세요.)`;
        if (!window.confirm(confirmMsg)) return;
      } else {
        if (!window.confirm(`'${product.name}' 상품을 삭제하시겠습니까?`)) return;
      }
    }

    setSaving(true);
    try {
      // Optimistic UI state update
      if (force || linkedPurchasesCount === 0) {
        setProducts((prev) => prev.filter((p) => p.id !== product.id));
      } else {
        setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, isActive: false } : p)));
      }

      const result = await deleteProductFromSupabase(product.id, force);
      if (result.success) {
        showNotification(result.message || `상품 처리 완료: ${product.name}`);
      } else {
        showNotification('상품 삭제 실패: ' + (result.error || ''), true);
      }
      await loadAllData();
    } catch (err: any) {
      showNotification('상품 삭제 실패: ' + (err?.message || ''), true);
      await loadAllData();
    } finally {
      setSaving(false);
    }
  };

  // Safe Member Delete Handler (Integrity Check)
  const handleDeleteMember = async (member: any) => {
    const nameStr = member.name || member.email || member.userId;
    const hasHistory = Boolean(member.hasChallengeParticipation || member.hasPurchaseHistory || (member.challengeCount > 0) || (member.purchaseCount > 0));

    if (hasHistory) {
      const details = [];
      if (member.challengeCount > 0 || member.hasChallengeParticipation) details.push(`챌린지 참여 ${member.challengeCount || 1}건`);
      if (member.purchaseCount > 0 || member.hasPurchaseHistory) details.push(`구매/결제 내역 ${member.purchaseCount || 1}건`);

      if (!window.confirm(`[주의] 회원 '${nameStr}'님은 연결된 데이터(${details.join(', ')})가 존재합니다.\n\n정합성 보호를 위해 임의 삭제가 제한됩니다. 강제로 삭제하시겠습니까?`)) {
        return;
      }
    } else {
      if (!window.confirm(`정말로 회원 '${nameStr}' 데이터를 삭제하시겠습니까?`)) {
        return;
      }
    }

    setSaving(true);
    try {
      const res = await deleteUserSafelyFromSupabase(member.userId, hasHistory);
      if (res.success) {
        showNotification(res.message || '회원 데이터가 삭제되었습니다.');
      } else {
        showNotification(res.message || res.error || '회원 삭제가 차단되었습니다.', true);
      }
      await loadAllData();
    } catch (err: any) {
      showNotification('회원 삭제 중 오류가 발생했습니다: ' + (err?.message || ''), true);
    } finally {
      setSaving(false);
    }
  };

  // Approve Purchase Order
  const handleApprovePurchase = async (purchase: Purchase) => {
    if (!window.confirm(`주문 (${purchase.id})의 입금을 확인하고 회원에게 등급을 승인하시겠습니까?`)) return;
    setSaving(true);
    try {
      const adminToken = getAdminToken();
      const res = await fetch(`/api/admin/purchases/${purchase.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken ? { Authorization: `Bearer ${adminToken}`, 'x-admin-token': adminToken } : {}),
        },
        body: JSON.stringify({ adminToken }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showNotification(data.message || '입금 확인 및 등급 승인이 완료되었습니다.');
        await loadAllData();
      } else {
        showNotification('승인 처리 실패: ' + (data.message || ''), true);
      }
    } catch (err: any) {
      showNotification('승인 요청 오류: ' + (err?.message || ''), true);
    } finally {
      setSaving(false);
    }
  };

  // Reject / Cancel Purchase Order
  const handleRejectPurchase = async (purchase: Purchase) => {
    const reason = window.prompt('신청을 거절/취소하는 사유를 입력해 주세요:', '미입금 또는 사용자 요청');
    if (reason === null) return;

    setSaving(true);
    try {
      const adminToken = getAdminToken();
      const res = await fetch(`/api/admin/purchases/${purchase.id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken ? { Authorization: `Bearer ${adminToken}`, 'x-admin-token': adminToken } : {}),
        },
        body: JSON.stringify({ reason, adminToken }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showNotification('구매 신청이 취소되었습니다.');
        await loadAllData();
      } else {
        showNotification('취소 처리 실패: ' + (data.message || ''), true);
      }
    } catch (err: any) {
      showNotification('취소 요청 오류: ' + (err?.message || ''), true);
    } finally {
      setSaving(false);
    }
  };

  // Manual Purchase Creation (Admin Grant)
  const handleCreateManualPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchaseForm.userId || !purchaseForm.productId) {
      showNotification('회원과 상품을 선택해 주세요.', true);
      return;
    }

    setSaving(true);
    try {
      const selectedProd = products.find((p) => p.id === purchaseForm.productId);
      const res = await createPurchaseAndGrantTierInSupabase({
        userId: purchaseForm.userId,
        userName: purchaseForm.userName,
        userEmail: purchaseForm.userEmail,
        productId: purchaseForm.productId,
        productName: selectedProd?.name || '관리자 수동 지급 상품',
        productType: selectedProd?.productType || 'membership',
        amount: Number(purchaseForm.amount) || 0,
        paymentMethod: purchaseForm.paymentMethod,
        targetTierId: selectedProd?.membershipTier || 'pro',
        durationDays: purchaseForm.durationDays ? Number(purchaseForm.durationDays) : 30,
        sourceType: 'admin',
        notes: purchaseForm.notes,
      });

      if (res.success) {
        showNotification(`'${purchaseForm.userName || purchaseForm.userId}' 회원에게 상품이 지급되고 등급이 연동되었습니다.`);
        setIsAddingPurchase(false);
        setPurchaseForm({
          userId: '',
          userName: '',
          userEmail: '',
          productId: '',
          amount: 0,
          paymentMethod: 'admin_grant',
          durationDays: '30',
          notes: '관리자 수동 지급',
        });
        await loadAllData();
      } else {
        showNotification('구매 지급 실패: ' + (res.error || ''), true);
      }
    } catch (err: any) {
      showNotification('구매 지급 오류: ' + (err?.message || ''), true);
    } finally {
      setSaving(false);
    }
  };

  // Duplicate User Merge Execution
  const handleExecuteUserMerge = async () => {
    if (!mergePrimaryUserId || mergeSelectedDuplicates.length === 0) {
      showNotification('기준(메인) 계정과 병합할 중복 계정들을 선택해 주세요.', true);
      return;
    }

    if (
      !window.confirm(
        `기준 계정(${mergePrimaryUserId})으로 ${mergeSelectedDuplicates.length}개의 중복 데이터를 안전하게 병합하시겠습니까?`
      )
    ) {
      return;
    }

    setSaving(true);
    try {
      const adminToken = getAdminToken();
      const res = await fetch('/api/admin/users/merge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken ? { Authorization: `Bearer ${adminToken}`, 'x-admin-token': adminToken } : {}),
        },
        body: JSON.stringify({
          primaryUserId: mergePrimaryUserId,
          duplicateUserIds: mergeSelectedDuplicates,
          targetTierId: mergeTargetTier,
          adminToken,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showNotification(data.message || '중복 계정이 성공적으로 병합되었습니다.');
        setIsMergeModalOpen(false);
        setMergePrimaryUserId('');
        setMergeSelectedDuplicates([]);
        await loadAllData();
      } else {
        showNotification('병합 실패: ' + (data.message || ''), true);
      }
    } catch (err: any) {
      showNotification('병합 요청 오류: ' + (err?.message || ''), true);
    } finally {
      setSaving(false);
    }
  };

  // Filtered members list
  const filteredMembers = useMemo(() => {
    return membersList.filter((m) => {
      const matchesSearch =
        userSearchQuery.trim() === '' ||
        m.userId.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
        m.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
        m.email.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
        (m.naverId && m.naverId.toLowerCase().includes(userSearchQuery.toLowerCase()));

      const matchesTier = userTierFilter === 'all' || m.tierId === userTierFilter;
      return matchesSearch && matchesTier;
    });
  }, [membersList, userSearchQuery, userTierFilter]);

  // Detected duplicate user groups
  const duplicateGroups = useMemo(() => {
    const emailMap: Record<string, MemberItem[]> = {};
    const naverIdMap: Record<string, MemberItem[]> = {};

    membersList.forEach((m) => {
      if (m.email && m.email.trim()) {
        const cleanEmail = m.email.trim().toLowerCase();
        emailMap[cleanEmail] = emailMap[cleanEmail] || [];
        emailMap[cleanEmail].push(m);
      }
      if (m.naverId && m.naverId.trim()) {
        const cleanNaver = m.naverId.trim().toLowerCase();
        naverIdMap[cleanNaver] = naverIdMap[cleanNaver] || [];
        naverIdMap[cleanNaver].push(m);
      }
    });

    const groups: { key: string; type: string; members: MemberItem[] }[] = [];
    Object.entries(emailMap).forEach(([email, list]) => {
      if (list.length > 1) {
        groups.push({ key: email, type: '동일 이메일', members: list });
      }
    });
    Object.entries(naverIdMap).forEach(([nid, list]) => {
      if (list.length > 1 && !groups.some((g) => g.key === nid)) {
        groups.push({ key: nid, type: '동일 네이버ID', members: list });
      }
    });

    return groups;
  }, [membersList]);

  // Filtered purchases list
  const filteredPurchases = useMemo(() => {
    return purchases.filter((p) => {
      const matchesSearch =
        purchaseSearchQuery.trim() === '' ||
        p.id.toLowerCase().includes(purchaseSearchQuery.toLowerCase()) ||
        (p.userName && p.userName.toLowerCase().includes(purchaseSearchQuery.toLowerCase())) ||
        (p.userEmail && p.userEmail.toLowerCase().includes(purchaseSearchQuery.toLowerCase())) ||
        p.userId.toLowerCase().includes(purchaseSearchQuery.toLowerCase()) ||
        (p.notes && p.notes.toLowerCase().includes(purchaseSearchQuery.toLowerCase()));

      const matchesStatus = purchaseStatusFilter === 'all' || p.status === purchaseStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [purchases, purchaseSearchQuery, purchaseStatusFilter]);

  // Filtered usage logs
  const filteredLogs = useMemo(() => {
    return usageLogs.filter((log) => {
      const matchesUser = logFilterUser.trim() === '' || log.userId.toLowerCase().includes(logFilterUser.toLowerCase());
      const matchesFeat = logFilterFeature === 'all' || log.featureKey === logFilterFeature;
      return matchesUser && matchesFeat;
    });
  }, [usageLogs, logFilterUser, logFilterFeature]);

  return (
    <div id="admin_membership_root" className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Header & Main Section Navigation */}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-100 pb-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl shadow-xs">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-stone-800 flex items-center gap-2">
                회원 · 상품 · 결제 · 권한 통합 관리 시스템
                <span className="px-2.5 py-0.5 text-xs font-black rounded-full bg-emerald-100 text-emerald-800">
                  v3.0 PRO
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-stone-500 mt-0.5 font-medium">
                가입 회원 등급 부여, 상품 판매 및 무통장 입금 승인, 중복 회원 병합, 유료 기능 권한 매트릭스를 통합 관리합니다.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              id="admin_refresh_membership_btn"
              onClick={loadAllData}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-stone-700 bg-stone-50 hover:bg-stone-100 rounded-xl border border-stone-200 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              새로고침
            </button>
          </div>
        </div>

        {/* Notifications */}
        {successMsg && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Top 4 Main Admin Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-5">
          <button
            id="tab_admin_members"
            onClick={() => setMainSection('members')}
            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
              mainSection === 'members'
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            <Users className="w-4 h-4 text-emerald-400" />
            <span>[1. 회원 관리] ({membersList.length})</span>
          </button>

          <button
            id="tab_admin_products"
            onClick={() => setMainSection('products')}
            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
              mainSection === 'products'
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            <ShoppingBag className="w-4 h-4 text-amber-400" />
            <span>[2. 상품 관리] ({products.length})</span>
          </button>

          <button
            id="tab_admin_purchases"
            onClick={() => setMainSection('purchases')}
            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
              mainSection === 'purchases'
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            <CreditCard className="w-4 h-4 text-blue-400" />
            <span>[3. 결제 · 구매 관리] ({purchases.length})</span>
          </button>

          <button
            id="tab_admin_permissions"
            onClick={() => setMainSection('permissions')}
            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
              mainSection === 'permissions'
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            <Sliders className="w-4 h-4 text-purple-400" />
            <span>[4. 등급 & 권한 매트릭스]</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. [회원 관리] SECTION */}
      {/* ========================================================================= */}
      {mainSection === 'members' && (
        <div className="space-y-6">
          {/* Duplicate User Warning Banner if detected */}
          {duplicateGroups.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <h4 className="text-xs font-black text-amber-900">
                    중복 가입 의심 회원 {duplicateGroups.length}그룹 감지됨
                  </h4>
                  <p className="text-xs text-amber-800">
                    동일한 이메일 또는 네이버ID를 가진 복수의 프로필을 안전하게 하나로 병합할 수 있습니다.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMergeModalOpen(true)}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs shrink-0"
              >
                <Merge className="w-3.5 h-3.5" />
                <span>중복 회원 분석 및 정리</span>
              </button>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-stone-900">가입 회원 및 등급 현황</h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  회원별 현재 등급, 잔여 만료일, 획득 경로(챌린지/구매/관리자)를 확인하고 검색하여 등급을 부여합니다.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsMergeModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  <Merge className="w-3.5 h-3.5 text-stone-500" />
                  <span>중복 정리</span>
                </button>
                <button
                  id="btn_open_assign_user"
                  type="button"
                  onClick={() => {
                    setMemberPickerSearch('');
                    setUserAssignForm({
                      userId: '',
                      userName: '',
                      userEmail: '',
                      tierId: 'pro',
                      status: 'active',
                      durationDays: '30',
                      expiresAt: '',
                      notes: '관리자 수동 지정',
                    });
                    setIsAssigningUser(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition-colors cursor-pointer shadow-xs"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>특정 회원 등급 직접 부여</span>
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3 mb-5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  id="input_search_members"
                  type="text"
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  placeholder="회원 이름, 이메일, 네이버ID, ID 검색..."
                  className="w-full pl-9 pr-4 py-2.5 text-xs border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-stone-400" />
                <select
                  id="select_filter_member_tier"
                  value={userTierFilter}
                  onChange={(e) => setUserTierFilter(e.target.value)}
                  className="px-3 py-2 text-xs font-semibold border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="all">전체 등급 보기</option>
                  {tiers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.id})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Members Table */}
            <div className="overflow-x-auto border border-stone-200 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 text-stone-700 font-extrabold border-b border-stone-200">
                  <tr>
                    <th className="py-3.5 px-4">회원 정보</th>
                    <th className="py-3.5 px-4">현재 등급</th>
                    <th className="py-3.5 px-4">상태 및 획득 경로</th>
                    <th className="py-3.5 px-4">만료 예정일</th>
                    <th className="py-3.5 px-4 text-right">간편 등급 변경</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-stone-800">
                  {filteredMembers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-stone-500">
                        검색 조건에 해당하는 회원이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    filteredMembers.map((m, idx) => {
                      const isExpired = m.expiresAt && new Date(m.expiresAt).getTime() < Date.now();
                      const tierColor =
                        m.tierId === 'vip'
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : m.tierId === 'pro'
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : m.tierId === 'basic'
                          ? 'bg-sky-100 text-sky-800 border-sky-300'
                          : m.tierId === 'admin'
                          ? 'bg-purple-100 text-purple-800 border-purple-300'
                          : 'bg-stone-100 text-stone-700 border-stone-300';

                      return (
                        <tr key={`mem_${m.userId}_${idx}`} className="hover:bg-stone-50/70 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <div className="font-bold text-stone-900">{m.name}</div>
                              {m.hasChallengeParticipation && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                  챌린지 {m.challengeCount || 1}건
                                </span>
                              )}
                              {m.hasPurchaseHistory && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                  구매 {m.purchaseCount || 1}건
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-stone-500 font-mono mt-0.5">{m.email || m.userId}</div>
                            {m.naverId && <div className="text-[11px] text-emerald-600 font-semibold">네이버: {m.naverId}</div>}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-black border ${tierColor}`}>
                              {m.tierName}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`inline-block w-2 h-2 rounded-full ${
                                  isExpired ? 'bg-rose-500' : m.membershipStatus === 'active' ? 'bg-emerald-500' : 'bg-stone-400'
                                }`}
                              />
                              <span className="text-xs font-bold">
                                {isExpired ? '만료됨' : m.membershipStatus === 'active' ? '활성' : m.membershipStatus}
                              </span>
                            </div>
                            <div className="text-[11px] text-stone-400 mt-0.5">
                              경로: {m.sourceType === 'challenge' ? '챌린지 승인' : m.sourceType === 'product_purchase' ? '상품 결제' : m.sourceType === 'admin' ? '관리자 지정' : '기본/수동'}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            {m.expiresAt ? (
                              <div className={`text-xs ${isExpired ? 'text-rose-600 font-bold' : 'text-stone-600 font-medium'}`}>
                                {new Date(m.expiresAt).toLocaleDateString('ko-KR')} 까지
                              </div>
                            ) : (
                              <span className="text-xs text-stone-400">무제한 (상시)</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <select
                                id={`select_member_tier_${m.userId}`}
                                value={m.tierId}
                                onChange={(e) => handleQuickChangeMemberTier(m.userId, e.target.value, 30)}
                                className="px-2.5 py-1 text-xs border border-stone-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              >
                                {tiers.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.name} (30일)
                                  </option>
                                ))}
                              </select>
                              <button
                                onClick={() => {
                                  setUserAssignForm({
                                    userId: m.userId,
                                    userName: m.name,
                                    userEmail: m.email,
                                    tierId: m.tierId,
                                    status: 'active',
                                    durationDays: '30',
                                    expiresAt: m.expiresAt ? m.expiresAt.split('T')[0] : '',
                                    notes: m.notes || '',
                                  });
                                  setIsAssigningUser(true);
                                }}
                                className="px-2.5 py-1 text-xs font-bold text-stone-600 hover:text-emerald-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors cursor-pointer"
                              >
                                상세설정
                              </button>
                              <button
                                onClick={() => handleDeleteMember(m)}
                                title="회원 삭제"
                                className="px-2 py-1 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                              >
                                삭제
                              </button>
                            </div>
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
      )}

      {/* ========================================================================= */}
      {/* 2. [상품 관리] SECTION */}
      {/* ========================================================================= */}
      {mainSection === 'products' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-stone-900">멤버십 및 유료 상품 관리</h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  사용자가 '사이트 구독' 페이지에서 결제하여 등급을 취득하거나 충전할 수 있는 상품을 등록/수정/삭제합니다.
                </p>
              </div>
              <button
                id="btn_add_product"
                type="button"
                onClick={() => {
                  setEditingProduct(null);
                  setProductForm({
                    id: `prod_${Date.now()}`,
                    name: '',
                    description: '',
                    productType: 'membership',
                    price: 39000,
                    originalPrice: 49000,
                    membershipTier: 'pro',
                    durationDays: '30',
                    aiUsageAddCount: '',
                    badge: '추천',
                    isActive: true,
                    sortOrder: products.length + 1,
                  });
                  setIsAddingProduct(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>새 상품 등록</span>
              </button>
            </div>

            {/* Filter Tabs & Search Bar */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 mb-6 pb-4 border-b border-stone-100">
              <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setProductStatusFilter('all')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    productStatusFilter === 'all'
                      ? 'bg-white text-stone-900 shadow-xs'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  전체 <span className="text-[11px] opacity-75">({products.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setProductStatusFilter('active')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    productStatusFilter === 'active'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  판매중 <span className="text-[11px] opacity-75">({products.filter((p) => p.isActive).length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setProductStatusFilter('inactive')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    productStatusFilter === 'inactive'
                      ? 'bg-stone-800 text-white shadow-xs'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  판매중지·비활성 <span className="text-[11px] opacity-75">({products.filter((p) => !p.isActive).length})</span>
                </button>
              </div>

              <div className="relative max-w-xs w-full">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  placeholder="상품명, 유형 검색..."
                  value={productSearchQuery}
                  onChange={(e) => setProductSearchQuery(e.target.value)}
                  className="w-full pl-8.5 pr-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:outline-hidden focus:border-emerald-500 focus:bg-white transition-colors"
                />
              </div>
            </div>

            {/* Products Grid */}
            {(() => {
              const filteredProducts = products.filter((p) => {
                if (productStatusFilter === 'active' && !p.isActive) return false;
                if (productStatusFilter === 'inactive' && p.isActive) return false;
                if (productSearchQuery.trim()) {
                  const q = productSearchQuery.toLowerCase();
                  const matchName = p.name.toLowerCase().includes(q);
                  const matchDesc = (p.description || '').toLowerCase().includes(q);
                  const matchType = (p.productType || '').toLowerCase().includes(q);
                  if (!matchName && !matchDesc && !matchType) return false;
                }
                return true;
              });

              if (filteredProducts.length === 0) {
                return (
                  <div className="text-center py-16 px-4 bg-stone-50/50 rounded-2xl border border-dashed border-stone-200">
                    <p className="text-sm font-bold text-stone-700">해당 조건의 등록된 상품이 없습니다.</p>
                    <p className="text-xs text-stone-400 mt-1">새 상품을 등록하거나 필터 검색 조건을 변경해 보세요.</p>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredProducts.map((p) => {
                    const isMembership = p.productType === 'membership';
                    const linkedPurchasesCount = purchases.filter((pu) => pu.productId === p.id).length;

                    return (
                      <div
                        key={p.id}
                        className={`rounded-2xl border p-5 flex flex-col justify-between transition-all ${
                          p.isActive
                            ? 'bg-white border-stone-200 shadow-sm hover:border-emerald-200'
                            : 'bg-stone-50/90 border-stone-200 opacity-85'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 font-mono">
                                {p.productType}
                              </span>
                              {p.badge && (
                                <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                  {p.badge}
                                </span>
                              )}
                              {!p.isActive && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-100">
                                  판매중지 {linkedPurchasesCount > 0 && `(${linkedPurchasesCount}건 결제보존)`}
                                </span>
                              )}
                            </div>

                            {/* Instant Active/Inactive Toggle */}
                            <button
                              type="button"
                              onClick={() => handleToggleProductActive(p)}
                              title="클릭하여 판매 활성/비활성 즉시 전환"
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black transition-all cursor-pointer border ${
                                p.isActive
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                  : 'bg-stone-200 text-stone-600 border-stone-300 hover:bg-stone-300'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${p.isActive ? 'bg-emerald-500' : 'bg-stone-500'}`} />
                              <span>{p.isActive ? '판매중' : '비활성'}</span>
                            </button>
                          </div>

                          <h4 className="text-base font-extrabold text-stone-900">{p.name}</h4>
                          <p className="text-xs text-stone-500 mt-1 min-h-[32px]">{p.description}</p>

                          <div className="mt-4 pt-3 border-t border-stone-100 flex items-baseline gap-2">
                            <span className="text-xl font-black text-stone-900">
                              {p.price.toLocaleString()}원
                            </span>
                            {p.originalPrice && (
                              <span className="text-xs text-stone-400 line-through">
                                {p.originalPrice.toLocaleString()}원
                              </span>
                            )}
                          </div>

                          <div className="mt-3 space-y-1.5 text-xs text-stone-600 bg-stone-50 p-3 rounded-xl border border-stone-100">
                            {isMembership && (
                              <div className="flex justify-between">
                                <span className="text-stone-400">부여 등급:</span>
                                <span className="font-bold text-emerald-700">
                                  {tiers.find((t) => t.id === p.membershipTier)?.name || p.membershipTier}
                                </span>
                              </div>
                            )}
                            {p.durationDays && (
                              <div className="flex justify-between">
                                <span className="text-stone-400">이용 기간:</span>
                                <span className="font-bold text-stone-800">{p.durationDays}일</span>
                              </div>
                            )}
                            {p.aiUsageAddCount && (
                              <div className="flex justify-between">
                                <span className="text-stone-400">AI 추가 사용량:</span>
                                <span className="font-bold text-stone-800">+{p.aiUsageAddCount}회</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mt-5 pt-3 border-t border-stone-100 flex items-center justify-between gap-2">
                          <div className="text-[11px] text-stone-400">
                            {linkedPurchasesCount > 0 ? (
                              <span>구매내역 {linkedPurchasesCount}건</span>
                            ) : (
                              <span>구매내역 없음</span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingProduct(p);
                                setProductForm({
                                  id: p.id,
                                  name: p.name,
                                  description: p.description || '',
                                  productType: p.productType,
                                  price: p.price,
                                  originalPrice: p.originalPrice,
                                  membershipTier: p.membershipTier || 'pro',
                                  durationDays: p.durationDays ? String(p.durationDays) : '',
                                  aiUsageAddCount: p.aiUsageAddCount ? String(p.aiUsageAddCount) : '',
                                  badge: p.badge || '',
                                  isActive: p.isActive,
                                  sortOrder: p.sortOrder,
                                });
                                setIsAddingProduct(true);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-stone-700 bg-stone-100 hover:bg-emerald-50 hover:text-emerald-700 rounded-xl border border-stone-200 transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span>수정</span>
                            </button>

                            {p.isActive ? (
                              <button
                                type="button"
                                onClick={() => handleDeleteProduct(p, false)}
                                title="판매 중지(비활성화) 처리합니다"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-stone-600 bg-stone-100 hover:bg-amber-50 hover:text-amber-700 rounded-xl border border-stone-200 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>{linkedPurchasesCount > 0 ? '판매 중지' : '삭제'}</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleDeleteProduct(p, true)}
                                title="과거 내역과 분리하여 데이터베이스에서 완전히 삭제합니다"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-200 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>영구 삭제</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. [결제 · 구매 관리] SECTION */}
      {/* ========================================================================= */}
      {mainSection === 'purchases' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-stone-900">결제 및 구매 신청 관리</h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  무통장 입금 신청 내역을 대조하여 [입금 확인 및 등급 승인]을 처리하거나 수동으로 등급 상품을 지급합니다.
                </p>
              </div>
              <button
                id="btn_add_manual_purchase"
                type="button"
                onClick={() => {
                  setPurchaseMemberPickerSearch('');
                  setPurchaseForm({
                    userId: '',
                    userName: '',
                    userEmail: '',
                    productId: products[0]?.id || '',
                    amount: products[0]?.price || 0,
                    paymentMethod: 'admin_grant',
                    durationDays: '30',
                    notes: '관리자 수동 지급',
                  });
                  setIsAddingPurchase(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>수동 구매/등급 지급</span>
              </button>
            </div>

            {/* Purchases Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3 mb-5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  value={purchaseSearchQuery}
                  onChange={(e) => setPurchaseSearchQuery(e.target.value)}
                  placeholder="주문번호, 입금자명, 구매자 이름/이메일, 메모 검색..."
                  className="w-full pl-9 pr-4 py-2.5 text-xs border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
                />
              </div>
              <select
                value={purchaseStatusFilter}
                onChange={(e) => setPurchaseStatusFilter(e.target.value)}
                className="px-3 py-2 text-xs font-semibold border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                <option value="all">전체 주문 상태</option>
                <option value="pending_payment">입금 대기 (승인 대기)</option>
                <option value="completed">결제 완료</option>
                <option value="cancelled">취소/거절됨</option>
              </select>
            </div>

            {/* Purchases Table */}
            <div className="overflow-x-auto border border-stone-200 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 text-stone-700 font-extrabold border-b border-stone-200">
                  <tr>
                    <th className="py-3.5 px-4">주문 번호 / 일시</th>
                    <th className="py-3.5 px-4">구매 회원 (입금 정보)</th>
                    <th className="py-3.5 px-4">신청 상품</th>
                    <th className="py-3.5 px-4">결제 금액</th>
                    <th className="py-3.5 px-4">결제 상태</th>
                    <th className="py-3.5 px-4 text-right">관리자 승인 처리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-stone-800">
                  {filteredPurchases.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-stone-500">
                        구매/결제 신청 내역이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    filteredPurchases.map((pur) => {
                      const isPending = pur.status === 'pending_payment' || pur.status === 'pending';
                      const isCompleted = pur.status === 'completed';

                      return (
                        <tr key={pur.id} className="hover:bg-stone-50/70 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-mono text-xs font-bold text-stone-900">{pur.id}</div>
                            <div className="text-[11px] text-stone-400 mt-0.5">
                              {new Date(pur.purchasedAt).toLocaleString('ko-KR')}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-stone-900">{pur.userName || pur.userId}</div>
                            <div className="text-[11px] text-stone-500 font-mono">{pur.userEmail || pur.userId}</div>
                            {pur.notes && (
                              <div className="text-[11px] text-emerald-700 font-medium mt-0.5 bg-emerald-50/60 px-1.5 py-0.5 rounded inline-block">
                                {pur.notes}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-stone-900">{pur.productName}</div>
                            <div className="text-[11px] text-stone-400 font-mono">{pur.productType}</div>
                          </td>
                          <td className="py-3.5 px-4 font-black text-stone-900 text-sm">
                            ₩{pur.amount.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-black ${
                                isCompleted
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : isPending
                                  ? 'bg-amber-100 text-amber-800 animate-pulse'
                                  : 'bg-stone-100 text-stone-600'
                              }`}
                            >
                              {isCompleted ? '결제 및 등급 승인 완료' : isPending ? '입금 확인 대기' : pur.status}
                            </span>
                            <div className="text-[11px] text-stone-400 mt-0.5">{pur.paymentMethod}</div>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {isPending ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleApprovePurchase(pur)}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                                >
                                  입금확인 & 등급승인
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRejectPurchase(pur)}
                                  className="px-2.5 py-1.5 bg-stone-100 hover:bg-rose-100 text-stone-600 hover:text-rose-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                                >
                                  거절
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-stone-400 font-medium">처리 완료</span>
                            )}
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
      )}

      {/* ========================================================================= */}
      {/* 4. [등급 & 권한 매트릭스] SECTION */}
      {/* ========================================================================= */}
      {mainSection === 'permissions' && (
        <div className="space-y-6">
          {/* Sub Navigation inside Permissions */}
          <div className="flex gap-2 border-b border-stone-200 pb-3">
            <button
              type="button"
              onClick={() => setPermSubTab('matrix')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                permSubTab === 'matrix' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              등급별 기능 권한 & 사용량 설정
            </button>
            <button
              type="button"
              onClick={() => setPermSubTab('tiers')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                permSubTab === 'tiers' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              등급 정의 ({tiers.length}개)
            </button>
            <button
              type="button"
              onClick={() => setPermSubTab('logs')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                permSubTab === 'logs' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              AI 기능 사용 로그
            </button>
          </div>

          {/* Challenge Participant Default Permission & Tier Setting Card */}
          <div className="bg-gradient-to-r from-stone-900 via-stone-850 to-emerald-950 rounded-2xl p-5 text-white border border-emerald-800/40 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="space-y-1.5 max-w-xl">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 inline-flex items-center gap-1">
                  <Award className="w-3 h-3 text-emerald-400" />
                  챌린지 참가자 기본 권한 설정
                </span>
                <span className="text-xs text-stone-300 font-medium">
                  현재 자동 부여 등급: <strong className="text-emerald-400 font-extrabold">{tiers.find((t) => t.id === participantDefaultTier)?.name || participantDefaultTier}</strong>
                </span>
              </div>
              <h4 className="text-sm sm:text-base font-extrabold text-white">
                챌린지 참가자에게 자동 적용할 사이트 등급
              </h4>
              <p className="text-xs text-stone-300 leading-relaxed">
                별도의 개별 유료 구독이 없는 챌린지 참가자가 로그인 시 사이트 기능 및 AI 사용 한도를 어느 등급으로 적용받을지 선택합니다. (설정 즉시 실시간 반영)
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
              <div className="flex items-center gap-1.5 bg-stone-800/90 p-1 rounded-xl border border-stone-700 flex-wrap">
                {tiers
                  .filter((t) => t.id !== 'admin')
                  .map((tier) => (
                    <button
                      key={tier.id}
                      id={`btn_set_participant_tier_${tier.id}`}
                      type="button"
                      onClick={() => handleSaveParticipantDefaultTier(tier.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        participantDefaultTier === tier.id
                          ? 'bg-emerald-500 text-stone-950 font-black shadow-xs'
                          : 'text-stone-300 hover:text-white hover:bg-stone-700/50'
                      }`}
                    >
                      {tier.name}
                    </button>
                  ))}
              </div>

              <button
                type="button"
                onClick={() => {
                  setPermSubTab('matrix');
                  setSelectedTierId(participantDefaultTier);
                }}
                className="px-3.5 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-600 rounded-xl text-xs font-bold transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                <span>해당 등급 세부 권한 매트릭스 수정</span>
              </button>
            </div>
          </div>

          {permSubTab === 'matrix' && (
            <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold text-stone-900">
                    등급별 기능 잠금 및 사용량 제한 매트릭스
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    각 등급별로 AI 글 생성, 키워드 분석, 툴킷 등의 사용 가능 여부와 기간별 이용 한도를 설정합니다.
                  </p>
                </div>
                <button
                  id="btn_save_tier_matrix"
                  type="button"
                  onClick={() => handleSaveTierMatrix(selectedTierId)}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {saving ? '저장 중...' : `'${tiers.find((t) => t.id === selectedTierId)?.name}' 설정 저장`}
                </button>
              </div>

              {/* Tier Selector Tabs */}
              <div className="flex items-center gap-2 border-b border-stone-200 pb-3 overflow-x-auto">
                {tiers.map((tier) => (
                  <button
                    key={tier.id}
                    id={`btn_select_matrix_tier_${tier.id}`}
                    type="button"
                    onClick={() => setSelectedTierId(tier.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                      selectedTierId === tier.id
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    {tier.name} ({tier.id})
                  </button>
                ))}
              </div>

              {/* Matrix Table */}
              <div className="overflow-x-auto border border-stone-200 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 text-stone-700 font-extrabold border-b border-stone-200">
                    <tr>
                      <th className="py-3.5 px-4 w-1/4">기능명</th>
                      <th className="py-3.5 px-4 w-1/6 text-center">기능 활성화 (ON/OFF)</th>
                      <th className="py-3.5 px-4 w-1/4">이용 주기</th>
                      <th className="py-3.5 px-4 w-1/4">이용 한도 (횟수)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 text-stone-800">
                    {features.map((feat) => {
                      const currentSetting = matrixEdits[selectedTierId]?.[feat.id] || {
                        enabled: true,
                        usageLimit: null,
                        usagePeriod: 'none',
                      };

                      return (
                        <tr key={feat.id} className="hover:bg-stone-50/70 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-stone-900 flex items-center gap-2">
                              {feat.name}
                              {feat.category && (
                                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 bg-stone-100 text-stone-600 rounded">
                                  {feat.category}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-stone-500 mt-0.5">{feat.description}</div>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              id={`toggle_feat_${feat.id}`}
                              onClick={() =>
                                handleMatrixChange(selectedTierId, feat.id, 'enabled', !currentSetting.enabled)
                              }
                              className={`px-3 py-1.5 rounded-full text-xs font-black transition-colors cursor-pointer ${
                                currentSetting.enabled
                                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                  : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                              }`}
                            >
                              {currentSetting.enabled ? '이용 가능' : '잠금 (차단)'}
                            </button>
                          </td>
                          <td className="py-3.5 px-4">
                            <select
                              id={`select_period_${feat.id}`}
                              disabled={!currentSetting.enabled}
                              value={currentSetting.usagePeriod}
                              onChange={(e) =>
                                handleMatrixChange(selectedTierId, feat.id, 'usagePeriod', e.target.value as any)
                              }
                              className="w-full px-3 py-1.5 text-xs border border-stone-200 rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-stone-100 disabled:opacity-50 font-medium"
                            >
                              <option value="none">제한 없음 (전체 누적)</option>
                              <option value="daily">일일 (매일 00:00 초기화)</option>
                              <option value="weekly">주간 (매주 월요일 초기화)</option>
                              <option value="monthly">월간 (매월 1일 초기화)</option>
                            </select>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <input
                                id={`input_limit_${feat.id}`}
                                type="number"
                                disabled={!currentSetting.enabled || currentSetting.usagePeriod === 'none'}
                                value={currentSetting.usageLimit === null ? '' : currentSetting.usageLimit}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? null : Math.max(0, parseInt(e.target.value, 10));
                                  handleMatrixChange(selectedTierId, feat.id, 'usageLimit', val);
                                }}
                                placeholder="무제한"
                                className="w-24 px-3 py-1.5 text-xs border border-stone-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-stone-100 disabled:opacity-50 font-mono"
                              />
                              <span className="text-xs text-stone-500">
                                {currentSetting.usageLimit === null || currentSetting.usagePeriod === 'none' ? '회 (무제한)' : '회'}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {permSubTab === 'tiers' && (
            <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold text-stone-900">시스템 등급 정의</h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    서비스에서 사용하는 등급의 이름, 설명, 정렬 순서를 관리합니다.
                  </p>
                </div>
                <button
                  id="btn_add_tier"
                  type="button"
                  onClick={() => {
                    setEditingTier(null);
                    setNewTierForm({ id: '', name: '', description: '', isActive: true, sortOrder: tiers.length + 1 });
                    setIsAddingTier(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition-colors cursor-pointer shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>새 등급 추가</span>
                </button>
              </div>

              {/* Tiers List */}
              <div className="divide-y divide-stone-100 border border-stone-200 rounded-2xl overflow-hidden">
                {tiers.map((tier) => (
                  <div key={tier.id} className="p-4 flex items-center justify-between hover:bg-stone-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-9 h-9 rounded-xl bg-stone-100 flex items-center justify-center font-bold text-stone-700 text-xs font-mono">
                        #{tier.sortOrder}
                      </div>
                      <div>
                        <div className="font-bold text-stone-900 flex items-center gap-2 text-xs">
                          {tier.name}
                          <span className="text-[11px] font-mono px-2 py-0.5 bg-stone-100 text-stone-600 rounded">
                            {tier.id}
                          </span>
                          {['free', 'basic', 'pro', 'vip', 'admin'].includes(tier.id) && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-sky-50 text-sky-700 rounded">
                              시스템 기본
                            </span>
                          )}
                          {tier.id === participantDefaultTier && (
                            <span className="text-[10px] font-black px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full inline-flex items-center gap-1">
                              <Award className="w-2.5 h-2.5 text-emerald-600" />
                              챌린지 참가자 기본 적용
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-stone-500 mt-0.5">{tier.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTier(tier);
                          setNewTierForm({
                            id: tier.id,
                            name: tier.name,
                            description: tier.description || '',
                            isActive: tier.isActive,
                            sortOrder: tier.sortOrder,
                          });
                          setIsAddingTier(true);
                        }}
                        className="p-2 text-stone-500 hover:text-emerald-600 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {!['free', 'basic', 'pro', 'vip', 'admin'].includes(tier.id) && (
                        <button
                          type="button"
                          onClick={() => handleDeleteTier(tier.id, tier.name)}
                          className="p-2 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {permSubTab === 'logs' && (
            <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 space-y-5">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-stone-900">최근 기능 사용량 기록</h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  회원들의 AI 초안 작성, 키워드 검색 등 기능 호출 이력을 실시간으로 모니터링합니다.
                </p>
              </div>

              {/* Filter Bar */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type="text"
                    value={logFilterUser}
                    onChange={(e) => setLogFilterUser(e.target.value)}
                    placeholder="회원 ID로 로그 검색..."
                    className="w-full pl-9 pr-4 py-2.5 text-xs border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <select
                  value={logFilterFeature}
                  onChange={(e) => setLogFilterFeature(e.target.value)}
                  className="px-3 py-2 text-xs font-semibold border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="all">전체 기능 보기</option>
                  {features.map((f) => (
                    <option key={f.id} value={f.featureKey}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Logs Table */}
              <div className="overflow-x-auto border border-stone-200 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 text-stone-700 font-extrabold border-b border-stone-200">
                    <tr>
                      <th className="py-3.5 px-4">사용 일시 (KST)</th>
                      <th className="py-3.5 px-4">회원 ID</th>
                      <th className="py-3.5 px-4">호출 기능</th>
                      <th className="py-3.5 px-4">요청 메타데이터</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 text-stone-800">
                    {filteredLogs.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-stone-500">
                          기록된 기능 사용 로그가 없습니다.
                        </td>
                      </tr>
                    ) : (
                      filteredLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-stone-50/70 transition-colors">
                          <td className="py-3.5 px-4 text-xs font-mono text-stone-500">
                            {new Date(log.usedAt).toLocaleString('ko-KR')}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-stone-900">{log.userId}</td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-800 font-mono">
                              {log.featureKey}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-[11px] text-stone-400 font-mono">
                            {log.metadata ? JSON.stringify(log.metadata) : '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: 특정 회원 등급 직접 부여/수정 (With Searchable Profile Picker) */}
      {/* ========================================================================= */}
      {isAssigningUser && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-stone-200 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-stone-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-stone-900">회원 등급 부여 및 수정</h3>
                  <p className="text-xs text-stone-500">가입 회원 검색 및 등급 직접 지정</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAssigningUser(false)}
                className="w-8 h-8 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center transition-colors cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveUserAssignment} className="space-y-4">
              {/* Member Picker */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-stone-700">
                  대상 회원 선택 <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type="text"
                    value={memberPickerSearch}
                    onChange={(e) => setMemberPickerSearch(e.target.value)}
                    placeholder="회원 이름, 이메일, 네이버ID로 검색..."
                    className="w-full pl-9 pr-3 py-2 text-xs border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
                  />
                </div>

                {/* Profile List Dropdown Box */}
                <div className="max-h-36 overflow-y-auto border border-stone-200 rounded-xl divide-y divide-stone-100 bg-stone-50/50 p-1">
                  {membersList
                    .filter((m) => {
                      if (!memberPickerSearch.trim()) return true;
                      const q = memberPickerSearch.toLowerCase();
                      return (
                        m.name.toLowerCase().includes(q) ||
                        m.email.toLowerCase().includes(q) ||
                        m.userId.toLowerCase().includes(q) ||
                        (m.naverId && m.naverId.toLowerCase().includes(q))
                      );
                    })
                    .slice(0, 15)
                    .map((m, idx) => {
                      const isSelected = userAssignForm.userId === m.userId;
                      return (
                        <div
                          key={`assign_user_${m.userId}_${idx}`}
                          onClick={() => {
                            setUserAssignForm((prev) => ({
                              ...prev,
                              userId: m.userId,
                              userName: m.name,
                              userEmail: m.email,
                            }));
                          }}
                          className={`p-2 rounded-lg text-xs cursor-pointer flex items-center justify-between transition-colors ${
                            isSelected
                              ? 'bg-emerald-600 text-white font-bold'
                              : 'hover:bg-stone-100 text-stone-800'
                          }`}
                        >
                          <div>
                            <span className="font-extrabold">{m.name}</span>
                            <span className={`text-[10px] ml-1.5 ${isSelected ? 'text-emerald-100' : 'text-stone-400 font-mono'}`}>
                              {m.email || m.userId}
                            </span>
                          </div>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-stone-200 text-stone-700'
                          }`}>
                            {m.tierName}
                          </span>
                        </div>
                      );
                    })}
                </div>

                {userAssignForm.userId && (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs flex items-center justify-between text-emerald-900">
                    <span className="font-bold">선택됨: {userAssignForm.userName} ({userAssignForm.userId})</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </div>
                )}
              </div>

              {/* Tier Selection */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">부여할 등급 *</label>
                <select
                  value={userAssignForm.tierId}
                  onChange={(e) => setUserAssignForm({ ...userAssignForm, tierId: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-bold border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  {tiers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.id.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              {/* Duration Selection */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">이용 기간</label>
                <select
                  value={userAssignForm.durationDays}
                  onChange={(e) => setUserAssignForm({ ...userAssignForm, durationDays: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-semibold border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="30">30일 (1개월)</option>
                  <option value="60">60일 (2개월)</option>
                  <option value="90">90일 (3개월)</option>
                  <option value="180">180일 (6개월)</option>
                  <option value="365">365일 (1년)</option>
                  <option value="0">무제한 (상시 활성)</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">부여 사유 / 메모</label>
                <input
                  type="text"
                  value={userAssignForm.notes}
                  onChange={(e) => setUserAssignForm({ ...userAssignForm, notes: e.target.value })}
                  placeholder="예: 챌린지 수동 승인, 우수 회원 특별 지급"
                  className="w-full px-3 py-2 text-xs border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-3 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsAssigningUser(false)}
                  className="px-4 py-2 text-xs font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={saving || !userAssignForm.userId}
                  className="px-5 py-2 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {saving ? '적용 중...' : '등급 적용'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: 중복 회원 분석 및 안전 병합 (Duplicate User Merger) */}
      {/* ========================================================================= */}
      {isMergeModalOpen && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl border border-stone-200 space-y-5 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                  <Merge className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-stone-900">중복 회원 데이터 안전 병합</h3>
                  <p className="text-xs text-stone-500">동일인 다중 계정의 결제·참가·멤버십 데이터 통합</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMergeModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center transition-colors cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {duplicateGroups.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                <h4 className="text-sm font-extrabold text-stone-800">감지된 중복 프로필이 없습니다.</h4>
                <p className="text-xs text-stone-500">모든 회원 데이터가 고유하게 정리되어 있습니다.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-xs text-stone-600 bg-stone-50 p-3 rounded-xl border border-stone-200/80 leading-relaxed">
                  💡 <strong>병합 원칙:</strong> 기준이 될 메인 계정을 1개 선택하고 병합 대상들을 체크한 후 병합을 실행하면, 챌린지 참가 기록 및 결제 내역이 메인 계정으로 안전하게 귀속됩니다.
                </div>

                <div className="space-y-3">
                  {duplicateGroups.map((grp, idx) => (
                    <div key={idx} className="border border-stone-200 rounded-2xl p-4 bg-white space-y-3">
                      <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                        <span className="text-xs font-black text-stone-800 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          {grp.type}: <span className="font-mono text-emerald-700">{grp.key}</span>
                        </span>
                        <span className="text-[11px] font-bold text-stone-400">{grp.members.length}개 프로필</span>
                      </div>

                      <div className="space-y-2">
                        {grp.members.map((m, mIdx) => {
                          const isPrimary = mergePrimaryUserId === m.userId;
                          const isChecked = mergeSelectedDuplicates.includes(m.userId);

                          return (
                            <div
                              key={`merge_mem_${m.userId}_${mIdx}`}
                              className={`p-3 rounded-xl border text-xs flex items-center justify-between transition-colors ${
                                isPrimary
                                  ? 'bg-emerald-50 border-emerald-300'
                                  : isChecked
                                  ? 'bg-amber-50/70 border-amber-300'
                                  : 'bg-stone-50 border-stone-200'
                              }`}
                            >
                              <div className="space-y-0.5">
                                <div className="font-black text-stone-900 flex items-center gap-2">
                                  <span>{m.name}</span>
                                  <span className="text-[10px] px-1.5 py-0.2 bg-stone-200 text-stone-700 rounded font-bold">
                                    {m.tierName}
                                  </span>
                                  {isPrimary && (
                                    <span className="text-[10px] px-2 py-0.2 bg-emerald-600 text-white rounded font-black">
                                      기준(메인) 계정
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-stone-500 font-mono">
                                  ID: {m.userId} | 이메일: {m.email || '-'}
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMergePrimaryUserId(m.userId);
                                    setMergeSelectedDuplicates(
                                      grp.members.filter((gm) => gm.userId !== m.userId).map((gm) => gm.userId)
                                    );
                                  }}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                                    isPrimary
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-stone-200 hover:bg-stone-300 text-stone-700'
                                  }`}
                                >
                                  메인으로 지정
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {mergePrimaryUserId && (
                  <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200 space-y-2 text-xs">
                    <div className="font-black text-emerald-900 flex items-center justify-between">
                      <span>선택된 메인 계정: {mergePrimaryUserId}</span>
                      <span>병합 대상: {mergeSelectedDuplicates.length}개</span>
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t border-emerald-200">
                      <span className="font-bold text-emerald-800">병합 후 부여할 등급:</span>
                      <select
                        value={mergeTargetTier}
                        onChange={(e) => setMergeTargetTier(e.target.value)}
                        className="px-2.5 py-1 text-xs font-bold border border-emerald-300 rounded-lg bg-white"
                      >
                        {tiers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsMergeModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors cursor-pointer"
                  >
                    닫기
                  </button>
                  <button
                    type="button"
                    disabled={!mergePrimaryUserId || mergeSelectedDuplicates.length === 0 || saving}
                    onClick={handleExecuteUserMerge}
                    className="px-5 py-2 text-xs font-black text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {saving ? '병합 중...' : '데이터 병합 실행'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: 수동 구매 지급 (With Searchable Profile Picker) */}
      {/* ========================================================================= */}
      {isAddingPurchase && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-stone-200 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-stone-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-stone-900">수동 구매 및 등급 지급</h3>
                  <p className="text-xs text-stone-500">회원 검색 및 상품/등급 즉시 지급</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddingPurchase(false)}
                className="w-8 h-8 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center transition-colors cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateManualPurchase} className="space-y-4">
              {/* Member Picker */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-stone-700">
                  지급 대상 회원 *
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type="text"
                    value={purchaseMemberPickerSearch}
                    onChange={(e) => setPurchaseMemberPickerSearch(e.target.value)}
                    placeholder="회원 이름, 이메일, 네이버ID로 검색..."
                    className="w-full pl-9 pr-3 py-2 text-xs border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
                  />
                </div>

                <div className="max-h-32 overflow-y-auto border border-stone-200 rounded-xl divide-y divide-stone-100 bg-stone-50/50 p-1">
                  {membersList
                    .filter((m) => {
                      if (!purchaseMemberPickerSearch.trim()) return true;
                      const q = purchaseMemberPickerSearch.toLowerCase();
                      return (
                        m.name.toLowerCase().includes(q) ||
                        m.email.toLowerCase().includes(q) ||
                        m.userId.toLowerCase().includes(q)
                      );
                    })
                    .slice(0, 10)
                    .map((m, mIdx) => {
                      const isSelected = purchaseForm.userId === m.userId;
                      return (
                        <div
                          key={`pur_pick_${m.userId}_${mIdx}`}
                          onClick={() => {
                            setPurchaseForm((prev) => ({
                              ...prev,
                              userId: m.userId,
                              userName: m.name,
                              userEmail: m.email,
                            }));
                          }}
                          className={`p-2 rounded-lg text-xs cursor-pointer flex items-center justify-between transition-colors ${
                            isSelected
                              ? 'bg-emerald-600 text-white font-bold'
                              : 'hover:bg-stone-100 text-stone-800'
                          }`}
                        >
                          <span className="font-bold">{m.name} ({m.email || m.userId})</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-stone-200 text-stone-700'
                          }`}>
                            {m.tierName}
                          </span>
                        </div>
                      );
                    })}
                </div>

                {purchaseForm.userId && (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-900 flex justify-between">
                    <span>선택된 회원: {purchaseForm.userName} ({purchaseForm.userId})</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </div>
                )}
              </div>

              {/* Product Selection */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">지급할 상품 선택 *</label>
                <select
                  required
                  value={purchaseForm.productId}
                  onChange={(e) => {
                    const selP = products.find((p) => p.id === e.target.value);
                    setPurchaseForm({
                      ...purchaseForm,
                      productId: e.target.value,
                      amount: selP?.price || 0,
                      durationDays: selP?.durationDays ? String(selP.durationDays) : '30',
                    });
                  }}
                  className="w-full px-3 py-2 text-xs font-bold border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="">상품을 선택하세요</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (₩{p.price.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">비고</label>
                <input
                  type="text"
                  value={purchaseForm.notes}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, notes: e.target.value })}
                  placeholder="관리자 수동 지급 사유"
                  className="w-full px-3 py-2 text-xs border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-3 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsAddingPurchase(false)}
                  className="px-4 py-2 text-xs font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={saving || !purchaseForm.userId || !purchaseForm.productId}
                  className="px-5 py-2 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {saving ? '처리 중...' : '지급 완료'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: 상품 추가/수정 */}
      {/* ========================================================================= */}
      {isAddingProduct && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-stone-200 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-stone-100 pb-4">
              <h3 className="text-base font-black text-stone-900">
                {editingProduct ? '상품 수정' : '새 상품 등록'}
              </h3>
              <button
                type="button"
                onClick={() => setIsAddingProduct(false)}
                className="w-8 h-8 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center transition-colors cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">상품명 *</label>
                <input
                  type="text"
                  required
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  placeholder="예: PRO 멤버십 30일 이용권"
                  className="w-full px-3 py-2 text-xs border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">상품 구분 *</label>
                <select
                  value={productForm.productType}
                  onChange={(e) => setProductForm({ ...productForm, productType: e.target.value as any })}
                  className="w-full px-3 py-2 text-xs font-semibold border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="membership">멤버십 등급 이용권</option>
                  <option value="ai_usage">AI 사용량 충전권</option>
                  <option value="challenge">챌린지 참가 상품</option>
                  <option value="general">일반 상품</option>
                </select>
              </div>

              {productForm.productType === 'membership' && (
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">부여할 등급 *</label>
                  <select
                    value={productForm.membershipTier}
                    onChange={(e) => setProductForm({ ...productForm, membershipTier: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-bold border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    {tiers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.id.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">판매 가격 (원) *</label>
                  <input
                    type="number"
                    required
                    value={productForm.price}
                    onChange={(e) => setProductForm({ ...productForm, price: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">원래 정가 (할인 전, 선택)</label>
                  <input
                    type="number"
                    value={productForm.originalPrice || ''}
                    onChange={(e) => setProductForm({ ...productForm, originalPrice: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="예: 49000"
                    className="w-full px-3 py-2 text-xs border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">이용 일수 (일)</label>
                  <input
                    type="number"
                    value={productForm.durationDays}
                    onChange={(e) => setProductForm({ ...productForm, durationDays: e.target.value })}
                    placeholder="30"
                    className="w-full px-3 py-2 text-xs border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">AI 추가 사용량 (회)</label>
                  <input
                    type="number"
                    value={productForm.aiUsageAddCount}
                    onChange={(e) => setProductForm({ ...productForm, aiUsageAddCount: e.target.value })}
                    placeholder="예: 100"
                    className="w-full px-3 py-2 text-xs border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">강조 뱃지 (선택)</label>
                  <input
                    type="text"
                    value={productForm.badge}
                    onChange={(e) => setProductForm({ ...productForm, badge: e.target.value })}
                    placeholder="예: 추천, 인기, 베스트"
                    className="w-full px-3 py-2 text-xs border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">정렬 순서</label>
                  <input
                    type="number"
                    value={productForm.sortOrder}
                    onChange={(e) => setProductForm({ ...productForm, sortOrder: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">상품 설명</label>
                <input
                  type="text"
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  placeholder="예: 30일간 PRO 모든 기능 무제한 이용"
                  className="w-full px-3 py-2 text-xs border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  id="chk_product_active"
                  type="checkbox"
                  checked={productForm.isActive}
                  onChange={(e) => setProductForm({ ...productForm, isActive: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 border-stone-300"
                />
                <label htmlFor="chk_product_active" className="text-xs font-bold text-stone-700 cursor-pointer">
                  판매 활성화 (체크 해제 시 사용자에게 미표시)
                </label>
              </div>

              <div className="pt-3 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsAddingProduct(false)}
                  className="px-4 py-2 text-xs font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {saving ? '저장 중...' : '상품 저장'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: 새 등급 추가/수정 */}
      {/* ========================================================================= */}
      {isAddingTier && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-stone-200 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-stone-100 pb-4">
              <h3 className="text-base font-black text-stone-900">
                {editingTier ? '등급 수정' : '새 등급 추가'}
              </h3>
              <button
                type="button"
                onClick={() => setIsAddingTier(false)}
                className="w-8 h-8 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center transition-colors cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTier} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">등급 ID (영문/숫자) *</label>
                <input
                  type="text"
                  required
                  disabled={!!editingTier}
                  value={newTierForm.id}
                  onChange={(e) => setNewTierForm({ ...newTierForm, id: e.target.value })}
                  placeholder="예: premium_plus"
                  className="w-full px-3 py-2 text-xs border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 disabled:bg-stone-100 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">등급명 *</label>
                <input
                  type="text"
                  required
                  value={newTierForm.name}
                  onChange={(e) => setNewTierForm({ ...newTierForm, name: e.target.value })}
                  placeholder="예: 프리미엄 플러스"
                  className="w-full px-3 py-2 text-xs border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">등급 설명</label>
                <textarea
                  value={newTierForm.description}
                  onChange={(e) => setNewTierForm({ ...newTierForm, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 text-xs border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>

              <div className="pt-3 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsAddingTier(false)}
                  className="px-4 py-2 text-xs font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {saving ? '저장 중...' : '저장'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
