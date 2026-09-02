import { Participant, ChallengeGroup } from '../types';
import { calculateParticipantGoal } from './goalCalculator';

export interface MemberProfileSummary {
  userId: string;
  name: string;
  naverId: string | null;
  twitterId: string | null;
  primaryParticipant: Participant;
  activeChallengeNames: string[];
  totalCurrentPosts: number;
  avgCurrentAchievementRate: number;
}

export interface MemberChallengeDetail {
  groupId: string;
  groupName: string;
  term: string;
  startDate: string;
  endDate: string;
  postCount: number;
  targetPostCount: number;
  achievementRate: number;
  status: 'recruiting' | 'in_progress' | 'ended';
  isCurrent: boolean;
  isCompleted: boolean;
}

/**
 * Helper to extract Cohort/Term (기수) string from challenge group name or details.
 * e.g., "CPA 집중반 3기" -> "3기", "블로그 입문반 1기" -> "1기", "8월 CPA 챌린지" -> "8월"
 */
export function extractGroupTerm(groupName: string): string {
  if (!groupName) return '';
  const termMatch = groupName.match(/\d+기/);
  if (termMatch) return termMatch[0];
  const monthMatch = groupName.match(/\d+월/);
  if (monthMatch) return monthMatch[0];
  return '';
}

/**
 * Aggregates unique members from participants list.
 */
export function getUniqueMembers(
  participants: Participant[],
  groups: ChallengeGroup[]
): MemberProfileSummary[] {
  if (!participants || participants.length === 0) return [];

  const todayStr = new Date().toISOString().split('T')[0];
  const memberMap = new Map<string, Participant[]>();

  // Group participants by unique identity key (blogId || twitterId || participantName)
  participants.forEach((p) => {
    const nameKey = p.participantName ? p.participantName.trim().toLowerCase() : '';
    const blogKey = p.blogId ? p.blogId.trim().toLowerCase() : '';
    const twitterKey = p.twitterId ? p.twitterId.trim().toLowerCase() : '';
    const uniqueKey = blogKey || twitterKey || nameKey || p.id;

    if (!memberMap.has(uniqueKey)) {
      memberMap.set(uniqueKey, []);
    }
    memberMap.get(uniqueKey)!.push(p);
  });

  const memberSummaries: MemberProfileSummary[] = [];

  memberMap.forEach((pList, key) => {
    const primaryP = pList[0];
    
    // Find all enrolled challenge group names across pList
    const enrolledGroupNamesSet = new Set<string>();
    pList.forEach((p) => {
      if (p.groupNames && p.groupNames.length > 0) {
        p.groupNames.forEach((gn) => enrolledGroupNamesSet.add(gn));
      } else if (p.groupName) {
        p.groupName.split(',').forEach((gn) => {
          const trimmed = gn.trim();
          if (trimmed) enrolledGroupNamesSet.add(trimmed);
        });
      }
    });

    // Determine active challenges vs totals
    const activeNames: string[] = [];
    let sumCurrentPosts = 0;
    let sumRate = 0;
    let rateCount = 0;

    enrolledGroupNamesSet.forEach((gName) => {
      const g = groups.find((item) => item.name === gName);
      if (g) {
        const isEnded = (g.endDate && todayStr > g.endDate) || g.status === 'ended';
        const goal = calculateParticipantGoal(primaryP, g, groups);

        if (!isEnded) {
          activeNames.push(g.name);
          sumCurrentPosts += goal.actualTotalPosts;
          sumRate += goal.overallRate;
          rateCount++;
        }
      } else {
        // Fallback for group not found in groups array
        activeNames.push(gName);
        sumCurrentPosts += primaryP.dailyPostCount;
      }
    });

    const avgRate = rateCount > 0 ? Math.round(sumRate / rateCount) : 0;

    memberSummaries.push({
      userId: primaryP.id,
      name: primaryP.participantName || '무명 회원',
      naverId: primaryP.blogId || null,
      twitterId: primaryP.twitterId || null,
      primaryParticipant: primaryP,
      activeChallengeNames: activeNames,
      totalCurrentPosts: sumCurrentPosts,
      avgCurrentAchievementRate: avgRate,
    });
  });

  return memberSummaries;
}

/**
 * Gets active and past challenge details for a specific member.
 */
export function getMemberChallengeHistory(
  userId: string,
  participants: Participant[],
  groups: ChallengeGroup[]
): {
  currentChallenges: MemberChallengeDetail[];
  pastChallenges: MemberChallengeDetail[];
  primaryParticipant: Participant | null;
} {
  const todayStr = new Date().toISOString().split('T')[0];

  // Find matching participant or group of participant records
  const targetP = participants.find((p) => p.id === userId);

  let pList: Participant[] = [];
  if (targetP) {
    const nameKey = targetP.participantName ? targetP.participantName.trim().toLowerCase() : '';
    const blogKey = targetP.blogId ? targetP.blogId.trim().toLowerCase() : '';
    pList = participants.filter((p) => {
      if (p.id === userId) return true;
      if (blogKey && p.blogId && p.blogId.trim().toLowerCase() === blogKey) return true;
      if (nameKey && p.participantName && p.participantName.trim().toLowerCase() === nameKey) return true;
      return false;
    });
  }

  if (pList.length === 0) {
    return { currentChallenges: [], pastChallenges: [], primaryParticipant: null };
  }

  const primaryP = pList[0];

  // Find all enrolled group names
  const enrolledGroupNamesSet = new Set<string>();
  pList.forEach((p) => {
    if (p.groupNames && p.groupNames.length > 0) {
      p.groupNames.forEach((gn) => enrolledGroupNamesSet.add(gn));
    } else if (p.groupName) {
      p.groupName.split(',').forEach((gn) => {
        const trimmed = gn.trim();
        if (trimmed) enrolledGroupNamesSet.add(trimmed);
      });
    }
  });

  const currentChallenges: MemberChallengeDetail[] = [];
  const pastChallenges: MemberChallengeDetail[] = [];

  enrolledGroupNamesSet.forEach((gName) => {
    const g = groups.find((item) => item.name === gName);
    
    let isEnded = false;
    let startDate = primaryP.startDate || '';
    let endDate = '';
    let term = extractGroupTerm(gName);
    let groupId = g ? g.id : `g_${gName}`;
    let computedStatus: 'recruiting' | 'in_progress' | 'ended' = 'in_progress';

    if (g) {
      startDate = g.startDate || startDate;
      endDate = g.endDate || '';
      
      if (g.startDate && todayStr < g.startDate) {
        computedStatus = 'recruiting';
      } else if (g.endDate && todayStr > g.endDate) {
        computedStatus = 'ended';
        isEnded = true;
      } else {
        computedStatus = 'in_progress';
      }
      if (g.status === 'ended') isEnded = true;
    }

    const goal = calculateParticipantGoal(primaryP, g, groups);
    const postCount = goal.actualTotalPosts;
    const targetPostCount = goal.totalTargetPosts;
    const achievementRate = goal.overallRate;
    const isCompleted = achievementRate >= 100 || (targetPostCount > 0 && postCount >= targetPostCount);

    const detail: MemberChallengeDetail = {
      groupId,
      groupName: gName,
      term,
      startDate,
      endDate,
      postCount,
      targetPostCount,
      achievementRate,
      status: computedStatus,
      isCurrent: !isEnded,
      isCompleted,
    };

    if (!isEnded) {
      currentChallenges.push(detail);
    } else {
      pastChallenges.push(detail);
    }
  });

  // Sort past challenges in reverse chronological order (latest startDate/endDate first)
  pastChallenges.sort((a, b) => {
    const dateA = a.startDate || a.endDate || '';
    const dateB = b.startDate || b.endDate || '';
    return dateB.localeCompare(dateA);
  });

  return {
    currentChallenges,
    pastChallenges,
    primaryParticipant: primaryP,
  };
}
