import { SupabaseClient } from '@supabase/supabase-js';
import {
  MembershipTier,
  FeatureItem,
  TierFeature,
  UserMembership,
  FeatureUsageStatus,
  UserMembershipSummary,
  UsagePeriod,
  NaverUser,
  Product,
  Purchase,
} from '../types';
import {
  DEFAULT_MEMBERSHIP_TIERS,
  DEFAULT_FEATURES,
  DEFAULT_TIER_FEATURES,
  DEFAULT_PRODUCTS,
} from '../config/membershipDefaults';

const LOCAL_STORAGE_TIERS_KEY = 'blog_platform_membership_tiers';
const LOCAL_STORAGE_FEATURES_KEY = 'blog_platform_features';
const LOCAL_STORAGE_TIER_FEATURES_KEY = 'blog_platform_tier_features';
const LOCAL_STORAGE_USER_MEMBERSHIPS_KEY = 'blog_platform_user_memberships';
const LOCAL_STORAGE_USAGE_LOGS_KEY = 'blog_platform_usage_logs';
const LOCAL_STORAGE_PRODUCTS_KEY = 'blog_platform_products';
const LOCAL_STORAGE_PURCHASES_KEY = 'blog_platform_purchases';
const LOCAL_STORAGE_PARTICIPANT_TIER_KEY = 'blog_platform_participant_tier_id';

export const DEFAULT_PARTICIPANT_TIER_ID = 'pro';

/**
 * Gets the configured default membership tier ID for challenge participants
 */
export function getParticipantDefaultTierId(): string {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(LOCAL_STORAGE_PARTICIPANT_TIER_KEY);
      if (stored && stored.trim()) return stored.trim();
    }
  } catch (e) {
    console.warn('Failed to read participant tier id from localStorage:', e);
  }
  return DEFAULT_PARTICIPANT_TIER_ID;
}

/**
 * Sets the configured default membership tier ID for challenge participants
 */
export function setParticipantDefaultTierId(tierId: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_PARTICIPANT_TIER_KEY, tierId.trim());
    }
  } catch (e) {
    // ignore
  }
}

/**
 * Returns KST (Korea Standard Time, UTC+9) start date string for given usage period
 */
export function getKstPeriodStartDate(period: UsagePeriod, now: Date = new Date()): Date {
  // Convert current time to KST
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const kstOffset = 9 * 60 * 60000;
  const kstDate = new Date(utc + kstOffset);

  const year = kstDate.getFullYear();
  const month = kstDate.getMonth();
  const date = kstDate.getDate();
  const day = kstDate.getDay(); // 0 is Sunday, 1 is Monday

  let startKst: Date;

  if (period === 'daily') {
    startKst = new Date(year, month, date, 0, 0, 0, 0);
  } else if (period === 'weekly') {
    // Monday is start of week
    const diffToMonday = (day + 6) % 7;
    startKst = new Date(year, month, date - diffToMonday, 0, 0, 0, 0);
  } else if (period === 'monthly') {
    startKst = new Date(year, month, 1, 0, 0, 0, 0);
  } else {
    // 'none' -> unlimited past
    startKst = new Date(0);
  }

  // Convert back to UTC date for DB querying
  const startUtc = new Date(startKst.getTime() - kstOffset);
  return startUtc;
}

// ----------------------------------------------------
// Local Storage Cache Helpers (Offline / Instant Fallback)
// ----------------------------------------------------

export function getCachedProducts(): Product[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(LOCAL_STORAGE_PRODUCTS_KEY);
      if (raw) return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Failed to parse cached products:', e);
  }
  return DEFAULT_PRODUCTS;
}

export function setCachedProducts(products: Product[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_PRODUCTS_KEY, JSON.stringify(products));
    }
  } catch (e) {
    // ignore
  }
}

export function getCachedPurchases(): Purchase[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(LOCAL_STORAGE_PURCHASES_KEY);
      if (raw) return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Failed to parse cached purchases:', e);
  }
  return [];
}

export function setCachedPurchases(purchases: Purchase[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_PURCHASES_KEY, JSON.stringify(purchases));
    }
  } catch (e) {
    // ignore
  }
}

export function getCachedTiers(): MembershipTier[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(LOCAL_STORAGE_TIERS_KEY);
      if (raw) return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Failed to parse cached tiers:', e);
  }
  return DEFAULT_MEMBERSHIP_TIERS;
}

export function setCachedTiers(tiers: MembershipTier[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_TIERS_KEY, JSON.stringify(tiers));
    }
  } catch (e) {
    // ignore
  }
}

export function getCachedFeatures(): FeatureItem[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(LOCAL_STORAGE_FEATURES_KEY);
      if (raw) return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Failed to parse cached features:', e);
  }
  return DEFAULT_FEATURES;
}

export function setCachedFeatures(features: FeatureItem[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_FEATURES_KEY, JSON.stringify(features));
    }
  } catch (e) {
    // ignore
  }
}

export function getCachedTierFeatures(): Record<string, Record<string, { enabled: boolean; usageLimit: number | null; usagePeriod: UsagePeriod }>> {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(LOCAL_STORAGE_TIER_FEATURES_KEY);
      if (raw) return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Failed to parse cached tier features:', e);
  }
  return DEFAULT_TIER_FEATURES;
}

export function setCachedTierFeatures(tierFeatures: Record<string, Record<string, { enabled: boolean; usageLimit: number | null; usagePeriod: UsagePeriod }>>): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_TIER_FEATURES_KEY, JSON.stringify(tierFeatures));
    }
  } catch (e) {
    // ignore
  }
}

export function getCachedUserMemberships(): Record<string, UserMembership> {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(LOCAL_STORAGE_USER_MEMBERSHIPS_KEY);
      if (raw) return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Failed to parse cached user memberships:', e);
  }
  return {};
}

export function setCachedUserMemberships(map: Record<string, UserMembership>): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_USER_MEMBERSHIPS_KEY, JSON.stringify(map));
    }
  } catch (e) {
    // ignore
  }
}

export function getCachedUsageLogs(): Array<{ userId: string; featureKey: string; usedAt: string }> {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(LOCAL_STORAGE_USAGE_LOGS_KEY);
      if (raw) return JSON.parse(raw);
    }
  } catch (e) {
    // ignore
  }
  return [];
}

export function addCachedUsageLog(userId: string, featureKey: string, usedAt: string = new Date().toISOString()): void {
  try {
    if (typeof localStorage !== 'undefined') {
      const logs = getCachedUsageLogs();
      logs.push({ userId: userId.toLowerCase().trim(), featureKey, usedAt });
      // Keep recent 1000 logs in local storage
      const trimmed = logs.slice(-1000);
      localStorage.setItem(LOCAL_STORAGE_USAGE_LOGS_KEY, JSON.stringify(trimmed));
    }
  } catch (e) {
    // ignore
  }
}

// ----------------------------------------------------
// Core Calculation & Validation Functions
// ----------------------------------------------------

/**
 * Normalizes user identifier into a clean consistent key
 */
export function normalizeUserKey(user?: NaverUser | { email?: string; id?: string; naverId?: string; name?: string } | string | null): string {
  if (!user) return 'anonymous';
  if (typeof user === 'string') return user.trim().toLowerCase();
  if (user.email && user.email.trim()) return user.email.trim().toLowerCase();
  if (user.naverId && user.naverId.trim()) return user.naverId.trim().toLowerCase();
  if (user.id && user.id.trim()) return user.id.trim().toLowerCase();
  if (user.name && user.name.trim()) return user.name.trim().toLowerCase();
  return 'anonymous';
}

/**
 * Resolve user's active membership tier based on explicit membership, admin status, or challenge participation
 */
export function resolveUserTier(
  user: NaverUser | null,
  isAdmin: boolean,
  isChallengeParticipant: boolean,
  customMembership?: UserMembership | null,
  allTiers: MembershipTier[] = getCachedTiers()
): MembershipTier {
  // 1. If user has active explicit membership
  if (customMembership && customMembership.status === 'active') {
    if (!customMembership.expiresAt || new Date(customMembership.expiresAt) > new Date()) {
      const found = allTiers.find((t) => t.id === customMembership.tierId && t.isActive);
      if (found) return found;
    }
  }

  // 2. If Admin
  if (isAdmin || user?.role === 'admin') {
    const adminTier = allTiers.find((t) => t.id === 'admin') || {
      id: 'admin',
      name: '관리자',
      description: '시스템 최고 관리자 (무제한 권한)',
      isActive: true,
      sortOrder: 99,
    };
    return adminTier;
  }

  // 3. If Challenge Participant -> Configured tier (default: 'pro')
  if (isChallengeParticipant) {
    const participantTierId = getParticipantDefaultTierId();
    const resolvedTier = allTiers.find((t) => t.id === participantTierId) || allTiers.find((t) => t.id === 'pro') || {
      id: 'pro',
      name: 'PRO',
      description: '블로그 수익화 최적화 및 프리미엄 AI 패키지',
      isActive: true,
      sortOrder: 3,
    };
    return resolvedTier;
  }

  // 4. Default -> Free tier
  const freeTier = allTiers.find((t) => t.id === 'free') || {
    id: 'free',
    name: '무료 회원',
    description: '기본 무료 체험 혜택',
    isActive: true,
    sortOrder: 1,
  };
  return freeTier;
}

/**
 * Calculate used count for a feature in a specific time window
 */
export function calculateLocalUsageCount(
  userId: string,
  featureKey: string,
  period: UsagePeriod,
  logs: Array<{ userId: string; featureKey: string; usedAt: string }> = getCachedUsageLogs()
): number {
  if (period === 'none') return 0;
  const startDate = getKstPeriodStartDate(period);
  const normalized = userId.trim().toLowerCase();

  return logs.filter((log) => {
    if (log.featureKey !== featureKey) return false;
    if (log.userId !== normalized) return false;
    const logDate = new Date(log.usedAt);
    return logDate >= startDate;
  }).length;
}

/**
 * Evaluates feature usage permission and status for a single feature
 */
export function evaluateFeatureStatus(
  feature: FeatureItem,
  tier: MembershipTier,
  tierConfig: { enabled: boolean; usageLimit: number | null; usagePeriod: UsagePeriod } | undefined,
  usedCount: number
): FeatureUsageStatus {
  // Admin bypass
  if (tier.id === 'admin') {
    return {
      featureKey: feature.featureKey,
      featureName: feature.name,
      category: feature.category,
      enabled: true,
      usageLimit: null,
      usagePeriod: 'none',
      usedCount,
      remainingUses: 'unlimited',
      isUnlimited: true,
      canUse: true,
      tierId: tier.id,
      tierName: tier.name,
    };
  }

  const enabled = tierConfig ? tierConfig.enabled : false;
  const limit = tierConfig ? tierConfig.usageLimit : null;
  const period = tierConfig ? tierConfig.usagePeriod : 'none';
  const isUnlimited = limit === null || period === 'none';

  let canUse = enabled;
  let remainingUses: number | 'unlimited' = 'unlimited';
  let reason: string | undefined;

  if (!enabled) {
    canUse = false;
    reason = `'${tier.name}' 등급에서는 지원되지 않는 기능입니다. 상위 등급으로 업그레이드 후 이용해 주세요.`;
  } else if (!isUnlimited && limit !== null) {
    const remaining = Math.max(0, limit - usedCount);
    remainingUses = remaining;
    if (usedCount >= limit) {
      canUse = false;
      const periodLabel = period === 'daily' ? '오늘' : period === 'weekly' ? '이번 주' : '이번 달';
      reason = `${periodLabel} 이용 한도(${limit}회)를 모두 사용했습니다.`;
    }
  }

  return {
    featureKey: feature.featureKey,
    featureName: feature.name,
    category: feature.category,
    enabled,
    usageLimit: limit,
    usagePeriod: period,
    usedCount,
    remainingUses,
    isUnlimited,
    canUse,
    tierId: tier.id,
    tierName: tier.name,
    reason,
  };
}

/**
 * Generate full feature access summary for a user
 */
export function generateUserMembershipSummary(
  user: NaverUser | null,
  isAdmin: boolean,
  isChallengeParticipant: boolean,
  customMembership?: UserMembership | null,
  usageCountsMap: Record<string, number> = {}
): UserMembershipSummary {
  const userKey = normalizeUserKey(user);
  const allTiers = getCachedTiers();
  const allFeatures = getCachedFeatures();
  const allTierFeatures = getCachedTierFeatures();

  const tier = resolveUserTier(user, isAdmin, isChallengeParticipant, customMembership, allTiers);
  const tierSettings = allTierFeatures[tier.id] || DEFAULT_TIER_FEATURES[tier.id] || DEFAULT_TIER_FEATURES['free'];

  const featureAccess: Record<string, FeatureUsageStatus> = {};

  for (const feat of allFeatures) {
    const featConfig = tierSettings[feat.featureKey];
    const usedCount = usageCountsMap[feat.featureKey] ?? calculateLocalUsageCount(userKey, feat.featureKey, featConfig?.usagePeriod || 'monthly');
    featureAccess[feat.featureKey] = evaluateFeatureStatus(feat, tier, featConfig, usedCount);
  }

  return {
    userKey,
    tier,
    membership: customMembership || null,
    isAdmin,
    isChallengeParticipant,
    featureAccess,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Quick checker for whether a user can use a specific feature right now
 */
export function canUseFeature(
  featureKey: string,
  user: NaverUser | null,
  isAdmin: boolean,
  isChallengeParticipant: boolean,
  customMembership?: UserMembership | null
): { allowed: boolean; reason?: string; remainingUses?: number | 'unlimited'; featureName?: string } {
  const summary = generateUserMembershipSummary(user, isAdmin, isChallengeParticipant, customMembership);
  const status = summary.featureAccess[featureKey];
  if (!status) {
    return { allowed: true, remainingUses: 'unlimited' };
  }
  return {
    allowed: status.canUse,
    reason: status.reason,
    remainingUses: status.remainingUses,
    featureName: status.featureName,
  };
}

/**
 * Calculate expiry ISO string based on duration days
 */
export function calculateMembershipExpiryDate(durationDays?: number | null, startDate: Date = new Date()): string | null {
  if (!durationDays || durationDays <= 0) return null;
  const expiry = new Date(startDate);
  expiry.setDate(expiry.getDate() + durationDays);
  return expiry.toISOString();
}

