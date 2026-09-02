import { Badge, UserBadge, UserBadgeProgress, RevenueCertification, Participant } from '../types';

export const DEFAULT_INITIAL_BADGES: Badge[] = [
  {
    id: 'badge_profit_first',
    name: '첫 수익 인증',
    description: '첫 번째 수익 인증을 완료하고 성장의 첫걸음을 내디뎠습니다.',
    icon: '🌱',
    color: '#10B981',
    category: '수익',
    conditionType: 'profit_verification_count',
    conditionValue: 1,
    isActive: true,
    sortOrder: 1,
    createdAt: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 'badge_profit_3',
    name: '수익 인증 3회',
    description: '수익 인증을 3회 달성하며 지속적인 성과를 만들고 있습니다.',
    icon: '⚡',
    color: '#3B82F6',
    category: '수익',
    conditionType: 'profit_verification_count',
    conditionValue: 3,
    isActive: true,
    sortOrder: 2,
    createdAt: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 'badge_profit_5',
    name: '수익 인증 5회',
    description: '수익 인증을 5회 돌파하며 탄탄한 실전 파이프라인을 구축했습니다.',
    icon: '🔥',
    color: '#F97316',
    category: '수익',
    conditionType: 'profit_verification_count',
    conditionValue: 5,
    isActive: true,
    sortOrder: 3,
    createdAt: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 'badge_profit_10',
    name: '수익 인증 10회 (마스터)',
    description: '수익 인증 10회 달성! 꾸준함으로 증명한 최고의 수익화 리더입니다.',
    icon: '👑',
    color: '#8B5CF6',
    category: '수익',
    conditionType: 'profit_verification_count',
    conditionValue: 10,
    isActive: true,
    sortOrder: 4,
    createdAt: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 'badge_profit_100k',
    name: '누적 수익 10만원',
    description: '누적 인증 수익 100,000원을 돌파했습니다.',
    icon: '💰',
    color: '#F59E0B',
    category: '수익',
    conditionType: 'total_profit',
    conditionValue: 100000,
    isActive: true,
    sortOrder: 5,
    createdAt: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 'badge_profit_500k',
    name: '누적 수익 50만원',
    description: '누적 인증 수익 500,000원을 돌파하며 고수익 구간에 진입했습니다.',
    icon: '💎',
    color: '#06B6D4',
    category: '수익',
    conditionType: 'total_profit',
    conditionValue: 500000,
    isActive: true,
    sortOrder: 6,
    createdAt: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 'badge_profit_1m',
    name: '누적 수익 100만원 (골드)',
    description: '누적 인증 수익 1,000,000원 돌파! 명예의 전당 레전드 달성자입니다.',
    icon: '🏆',
    color: '#EC4899',
    category: '수익',
    conditionType: 'total_profit',
    conditionValue: 1000000,
    isActive: true,
    sortOrder: 7,
    createdAt: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 'badge_challenge_first',
    name: '첫 챌린지 참여',
    description: '성장을 향한 첫걸음, 챌린지에 성공적으로 등록하고 시작했습니다.',
    icon: '🚀',
    color: '#6366F1',
    category: '챌린지',
    conditionType: 'challenge_complete',
    conditionValue: 1,
    isActive: true,
    sortOrder: 8,
    createdAt: '2026-08-01T00:00:00.000Z',
  },
];

export interface UserEvaluationMetrics {
  userId: string;
  userName?: string;
  naverBlogId?: string;
  email?: string;
  profitVerificationCount: number;
  totalProfit: number;
  joinedChallengeCount: number;
  streakDays?: number;
  certifications?: RevenueCertification[];
}

/**
 * Calculates user metrics based on certifications and participant enrollment data
 */
export function calculateUserMetrics(
  userId: string,
  userEmail?: string,
  userName?: string,
  userNaverId?: string,
  certifications: RevenueCertification[] = [],
  participants: Participant[] = []
): UserEvaluationMetrics {
  const cleanId = (userId || '').trim();
  const cleanEmail = (userEmail || '').trim().toLowerCase();
  const cleanName = (userName || '').trim().toLowerCase();
  const cleanBlog = (userNaverId || '').trim().toLowerCase();

  // Filter user's certifications (including approved and submitted)
  const userCerts = (certifications || []).filter((c) => {
    if (c.userId && cleanId && c.userId === cleanId) return true;
    if (c.userEmail && cleanEmail && c.userEmail.toLowerCase() === cleanEmail) return true;
    if (c.naverBlogId && cleanBlog && c.naverBlogId.toLowerCase() === cleanBlog) return true;
    if (c.userName && cleanName && c.userName.toLowerCase() === cleanName) return true;
    return false;
  });

  // Calculate count & amount (count all or approved)
  // For badge qualification, we consider all approved or valid submitted certifications
  const validCerts = userCerts.filter((c) => c.status !== 'rejected');
  const count = validCerts.length;
  const totalAmount = validCerts.reduce((sum, c) => sum + (Number(c.revenueAmount) || 0), 0);

  // Count joined challenges
  const userParts = (participants || []).filter((p) => {
    const matchBlog = cleanBlog && cleanBlog !== 'user' && p.blogId && p.blogId.toLowerCase() === cleanBlog;
    const matchName = cleanName && p.participantName && p.participantName.toLowerCase() === cleanName;
    const matchEmail = cleanEmail && p.participantName && cleanEmail.split('@')[0] === p.participantName.toLowerCase();
    return Boolean(matchBlog || matchName || matchEmail);
  });

  let challengeCount = 0;
  let maxStreak = 0;

  userParts.forEach((p) => {
    const gNames = (p.groupNames && p.groupNames.length > 0)
      ? p.groupNames
      : (p.groupName ? p.groupName.split(',').map((s) => s.trim()).filter(Boolean) : []);
    challengeCount += gNames.length || 1;
    if ((p.streakDays || 0) > maxStreak) {
      maxStreak = p.streakDays || 0;
    }
  });

  return {
    userId: cleanId || `user_${cleanEmail || cleanName || 'unknown'}`,
    userName: userName || cleanName,
    naverBlogId: userNaverId || cleanBlog,
    email: userEmail || cleanEmail,
    profitVerificationCount: count,
    totalProfit: totalAmount,
    joinedChallengeCount: Math.max(challengeCount, userParts.length),
    streakDays: maxStreak,
    certifications: userCerts,
  };
}

/**
 * Evaluates whether a badge is earned and calculates exact progress
 */
export function evaluateSingleBadge(
  badge: Badge,
  metrics: UserEvaluationMetrics,
  earnedUserBadge?: UserBadge
): UserBadgeProgress {
  const isEarned = Boolean(earnedUserBadge);
  const target = Number(badge.conditionValue) || 1;
  let current = 0;

  switch (badge.conditionType) {
    case 'profit_verification_count':
      current = metrics.profitVerificationCount;
      break;

    case 'total_profit':
      current = metrics.totalProfit;
      break;

    case 'challenge_complete':
      current = metrics.joinedChallengeCount;
      break;

    case 'streak_days':
      current = metrics.streakDays || 0;
      break;

    case 'profit_platform':
      // Check if user has certification with matching platform
      const targetPlatform = badge.conditionMetadata?.platform?.toLowerCase();
      current = (metrics.certifications || []).filter((c) => {
        if (!targetPlatform) return true;
        const text = `${c.title} ${c.content}`.toLowerCase();
        return text.includes(targetPlatform);
      }).length;
      break;

    default:
      current = isEarned ? target : 0;
      break;
  }

  const qualifiedByCondition = current >= target;
  const finalEarned = isEarned || qualifiedByCondition;

  const percent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 100;

  return {
    badge,
    isEarned: finalEarned,
    earnedAt: earnedUserBadge?.earnedAt,
    currentValue: current,
    targetValue: target,
    progressPercent: finalEarned ? 100 : percent,
    metadata: earnedUserBadge?.metadata,
  };
}

/**
 * Checks all active badges for a user and returns newly qualified badges that need to be awarded
 */
export function findNewlyQualifiedBadges(
  badges: Badge[],
  existingUserBadges: UserBadge[],
  metrics: UserEvaluationMetrics
): { newBadgesToAward: UserBadge[]; allProgress: UserBadgeProgress[] } {
  const activeBadges = badges.filter((b) => b.isActive !== false);
  const earnedBadgeIdSet = new Set(existingUserBadges.map((ub) => ub.badgeId));
  const newBadgesToAward: UserBadge[] = [];
  const allProgress: UserBadgeProgress[] = [];

  // Sort active badges by sortOrder
  const sortedBadges = [...activeBadges].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  sortedBadges.forEach((badge) => {
    const existingEarned = existingUserBadges.find((ub) => ub.badgeId === badge.id);
    const progress = evaluateSingleBadge(badge, metrics, existingEarned);
    allProgress.push(progress);

    // If qualified and not already in user_badges, create new award
    if (progress.isEarned && !earnedBadgeIdSet.has(badge.id)) {
      newBadgesToAward.push({
        id: `ub_${metrics.userId}_${badge.id}_${Date.now()}`,
        userId: metrics.userId,
        badgeId: badge.id,
        earnedAt: new Date().toISOString(),
        metadata: {
          profitVerificationCount: metrics.profitVerificationCount,
          totalProfit: metrics.totalProfit,
          joinedChallengeCount: metrics.joinedChallengeCount,
          triggerReason: `Qualified for condition ${badge.conditionType} with value ${progress.currentValue} >= ${badge.conditionValue}`,
        },
        badge,
      });
      earnedBadgeIdSet.add(badge.id);
    }
  });

  return { newBadgesToAward, allProgress };
}
