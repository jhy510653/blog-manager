import { NaverUser, ChallengeGroup, Participant } from '../types';

export interface AIToolkitAccessResult {
  canAccess: boolean;
  reason: 'not_logged_in' | 'no_active_challenge' | 'authorized';
  activeChallengeCount: number;
  userEnrolledActiveGroups: ChallengeGroup[];
  userEnrolledEndedGroups: ChallengeGroup[];
}

/**
 * AI Toolkit 접근 권한 판정 공통 함수
 * 
 * 권한 조건 (Requirement 1, 2, 3, 7, 8, 10):
 * 1. 관리자 (isAdminLoggedIn, user.role === 'admin', user.is_admin === true)
 * 2. 현재 진행 중인 챌린지 참가자 (로그인됨 + 현재 날짜가 챌린지 기간 내이거나 status가 in_progress/active인 챌린지에 참가자로 등록됨)
 * 3. (향후 유료 구독 확장용: hasActiveAISubscription)
 */
export function checkAIToolkitAccess(params: {
  currentUser: NaverUser | null;
  isAdmin?: boolean;
  groups?: ChallengeGroup[];
  participants?: Participant[];
  hasActiveAISubscription?: boolean;
}): AIToolkitAccessResult {
  const {
    currentUser,
    isAdmin = false,
    groups = [],
    participants = [],
    hasActiveAISubscription = false,
  } = params;

  // 1. 관리자 여부 확인 (최우선 접근 허용)
  const isUserAdmin =
    Boolean(isAdmin) ||
    (currentUser as any)?.role === 'admin' ||
    (currentUser as any)?.membershipTier === 'admin' ||
    Boolean((currentUser as any)?.is_admin);

  if (isUserAdmin) {
    return {
      canAccess: true,
      reason: 'authorized',
      activeChallengeCount: 99,
      userEnrolledActiveGroups: [],
      userEnrolledEndedGroups: [],
    };
  }

  // 2. 비로그인 사용자
  if (!currentUser) {
    return {
      canAccess: false,
      reason: 'not_logged_in',
      activeChallengeCount: 0,
      userEnrolledActiveGroups: [],
      userEnrolledEndedGroups: [],
    };
  }

  // 3. 유료 구독 및 멤버십 등급(PRO, VIP 등) 확인
  const userTier = (currentUser as any)?.membershipTier || (currentUser as any)?.tierId || (currentUser as any)?.tier || '';
  const isPaidTier = ['pro', 'vip', 'premium', 'basic'].includes(String(userTier).toLowerCase());

  if (hasActiveAISubscription || isPaidTier) {
    return {
      canAccess: true,
      reason: 'authorized',
      activeChallengeCount: 1,
      userEnrolledActiveGroups: [],
      userEnrolledEndedGroups: [],
    };
  }

  // 4. 사용자가 참가 신청하여 등록된 챌린지 및 현재 진행 중(Active) 여부 판정
  const todayStr = new Date().toISOString().split('T')[0];

  // A) 사용자와 매칭되는 참가자(participants) 레코드 조회
  const userEnrolledNames = new Set<string>();

  (participants || []).forEach((p) => {
    const matchBlog = Boolean(
      p.blogId && currentUser.naverId && p.blogId.toLowerCase() === currentUser.naverId.toLowerCase()
    );
    const matchName = Boolean(
      p.participantName && currentUser.name && p.participantName.trim().toLowerCase() === currentUser.name.trim().toLowerCase()
    );
    const matchTwitter = Boolean(
      currentUser.twitterId && p.twitterId && p.twitterId.toLowerCase() === currentUser.twitterId.toLowerCase()
    );
    const matchEmail = Boolean(
      currentUser.email &&
        ((p as any).email && (p as any).email.toLowerCase() === currentUser.email.toLowerCase())
    );

    if (matchBlog || matchName || matchTwitter || matchEmail) {
      if (p.groupNames && p.groupNames.length > 0) {
        p.groupNames.forEach((gName) => {
          if (gName) userEnrolledNames.add(gName.trim());
        });
      } else if (p.groupName) {
        p.groupName.split(',').forEach((gName) => {
          if (gName) userEnrolledNames.add(gName.trim());
        });
      }
    }
  });

  // B) 사용자가 속한 챌린지 그룹 중 "현재 진행 중"인 챌린지 필터링
  const userEnrolledGroups = (groups || []).filter(
    (g) => userEnrolledNames.has(g.name) || userEnrolledNames.has(g.id)
  );

  const activeGroups: ChallengeGroup[] = [];
  const endedGroups: ChallengeGroup[] = [];

  userEnrolledGroups.forEach((g) => {
    let isActive = false;

    // 1) 시작/종료 날짜 기준
    if (g.startDate && g.endDate) {
      if (todayStr >= g.startDate && todayStr <= g.endDate) {
        isActive = true;
      }
    } else if (g.status === 'in_progress') {
      isActive = true;
    } else if (!g.startDate && !g.endDate && g.status !== 'ended') {
      isActive = true;
    }

    // 2) 종료 처리 오버라이드
    if (g.status === 'ended' || (g.endDate && todayStr > g.endDate)) {
      isActive = false;
      endedGroups.push(g);
    } else if (isActive) {
      activeGroups.push(g);
    }
  });

  const activeCount = activeGroups.length;

  if (activeCount >= 1) {
    return {
      canAccess: true,
      reason: 'authorized',
      activeChallengeCount: activeCount,
      userEnrolledActiveGroups: activeGroups,
      userEnrolledEndedGroups: endedGroups,
    };
  }

  return {
    canAccess: false,
    reason: 'no_active_challenge',
    activeChallengeCount: 0,
    userEnrolledActiveGroups: [],
    userEnrolledEndedGroups: endedGroups,
  };
}
