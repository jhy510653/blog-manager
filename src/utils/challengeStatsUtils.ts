import { Participant, ChallengeGroup, DailyActivity } from '../types';

export interface ParticipantPeriodStats {
  blogPosts: number;
  tweets: number;
  replies: number;
  totalPosts: number; // blogPosts + tweets
  totalAll: number;   // blogPosts + tweets + replies
  visitors: number;
  startDate?: string;
  endDate?: string;
}

export interface GroupPeriodStats {
  totalParticipants: number;
  participants: Participant[];
  totalBlogPosts: number;
  totalTweets: number;
  totalReplies: number;
  totalPosts: number;
  totalAll: number;
  totalVisitors: number;
  avgPostsPerUser: number;
  avgGoalRate: number;
  completedCount: number;
  completionRate: number;
  top3: Array<{ participant: Participant; stats: ParticipantPeriodStats }>;
}

/**
 * Checks if a target date string falls strictly within the [startDate, endDate] range.
 * If targetDateStr is missing or invalid, returns false.
 */
export function filterByDate(
  targetDateStr: string,
  startDate?: string,
  endDate?: string
): boolean {
  if (!targetDateStr) return false;
  const target = targetDateStr.trim().split('T')[0];

  if (startDate && startDate.trim()) {
    const start = startDate.trim().split('T')[0];
    if (target < start) {
      return false;
    }
  }

  if (endDate && endDate.trim()) {
    const end = endDate.trim().split('T')[0];
    if (target > end) {
      return false;
    }
  }

  return true;
}

/**
 * Resolves the effective start and end dates for a participant in a given context.
 */
export function resolvePeriodDates(
  participant: Participant,
  options?: {
    group?: ChallengeGroup;
    allGroups?: ChallengeGroup[];
    startDate?: string;
    endDate?: string;
  }
): { startDate?: string; endDate?: string } {
  // Direct override
  if (options?.startDate || options?.endDate) {
    return {
      startDate: options.startDate || participant.startDate,
      endDate: options.endDate,
    };
  }

  // Specific challenge group provided
  if (options?.group) {
    return {
      startDate: options.group.startDate || participant.startDate,
      endDate: options.group.endDate,
    };
  }

  // Find enrolled groups if allGroups provided
  if (options?.allGroups && options.allGroups.length > 0) {
    const enrolledNames = new Set<string>();
    if (participant.groupNames && participant.groupNames.length > 0) {
      participant.groupNames.forEach((name) => enrolledNames.add(name.trim()));
    } else if (participant.groupName) {
      participant.groupName.split(',').forEach((name) => enrolledNames.add(name.trim()));
    }

    const matchedGroups = options.allGroups.filter((g) => enrolledNames.has(g.name));
    if (matchedGroups.length > 0) {
      const startDates = matchedGroups
        .map((g) => g.startDate)
        .filter((d): d is string => Boolean(d && d.trim()))
        .sort();
      const endDates = matchedGroups
        .map((g) => g.endDate)
        .filter((d): d is string => Boolean(d && d.trim()))
        .sort();

      const minStart = startDates.length > 0 ? startDates[0] : participant.startDate;
      // If any group has no end date, the combined period is open-ended
      const hasOpenEnded = matchedGroups.some((g) => !g.endDate || !g.endDate.trim());
      const maxEnd = hasOpenEnded || endDates.length === 0 ? undefined : endDates[endDates.length - 1];

      return {
        startDate: minStart,
        endDate: maxEnd,
      };
    }
  }

  return {
    startDate: participant.startDate,
    endDate: undefined,
  };
}

/**
 * Calculates a participant's statistics (blog posts, tweets, replies, visitors)
 * strictly within the designated challenge period (startDate ~ endDate).
 * Activity outside this period is strictly excluded.
 */
export function getParticipantPeriodStats(
  participant: Participant,
  options?: {
    group?: ChallengeGroup;
    allGroups?: ChallengeGroup[];
    startDate?: string;
    endDate?: string;
  }
): ParticipantPeriodStats {
  const { startDate, endDate } = resolvePeriodDates(participant, options);
  const todayStr = new Date().toISOString().split('T')[0];

  const hasBlog = participant.platformType === 'blog' || participant.platformType === 'both' || !participant.platformType;
  const hasTwitter = participant.platformType === 'twitter' || participant.platformType === 'both';

  let blogPosts = 0;
  let tweets = 0;
  let replies = 0;
  let visitors = 0;

  if (participant.history && participant.history.length > 0) {
    // 1. Filter daily history items strictly within the challenge period [startDate, endDate]
    const validHistory = participant.history.filter((h) =>
      filterByDate(h.date, startDate, endDate)
    );

    // 2. Identify history items strictly prior to the challenge start date
    const priorHistory = participant.history.filter(
      (h) => startDate && h.date && h.date < startDate
    );

    if (validHistory.length > 0) {
      // Find baseline activity before start date (if cumulative)
      const baseBlog = priorHistory.length > 0 ? Math.max(0, ...priorHistory.map((h) => h.blogPosts || 0)) : 0;
      const baseTweets = priorHistory.length > 0 ? Math.max(0, ...priorHistory.map((h) => h.tweets || 0)) : 0;
      const baseReplies = priorHistory.length > 0 ? Math.max(0, ...priorHistory.map((h) => h.replies || 0)) : 0;
      const baseVisitors = priorHistory.length > 0 ? Math.max(0, ...priorHistory.map((h) => h.blogVisitors || 0)) : 0;

      // Find max activity within the valid period
      const maxBlog = Math.max(0, ...validHistory.map((h) => h.blogPosts || 0));
      const maxTweets = Math.max(0, ...validHistory.map((h) => h.tweets || 0));
      const maxReplies = Math.max(0, ...validHistory.map((h) => h.replies || 0));
      const maxVisitors = Math.max(0, ...validHistory.map((h) => h.blogVisitors || 0));

      // Net activity generated strictly during the challenge period
      blogPosts = Math.max(0, maxBlog - baseBlog);
      tweets = Math.max(0, maxTweets - baseTweets);
      replies = Math.max(0, maxReplies - baseReplies);
      visitors = Math.max(0, maxVisitors - baseVisitors);

      // If participant history stores non-cumulative single-day values (or maxBlog was 0 and sum is used)
      if (blogPosts === 0 && maxBlog === 0 && validHistory.some((h) => (h.blogPosts || 0) > 0)) {
        blogPosts = validHistory.reduce((sum, h) => sum + (h.blogPosts || 0), 0);
      }
      if (tweets === 0 && maxTweets === 0 && validHistory.some((h) => (h.tweets || 0) > 0)) {
        tweets = validHistory.reduce((sum, h) => sum + (h.tweets || 0), 0);
      }
      if (replies === 0 && maxReplies === 0 && validHistory.some((h) => (h.replies || 0) > 0)) {
        replies = validHistory.reduce((sum, h) => sum + (h.replies || 0), 0);
      }
    } else {
      // If history exists but no entries fall within the challenge period,
      // all activity was either before startDate or after endDate => counts are strictly 0
      blogPosts = 0;
      tweets = 0;
      replies = 0;
      visitors = 0;
    }
  } else {
    // Participant does NOT have history entries:
    // Verify whether the current time or participant's start date is valid for this challenge
    const isBeforeStart = startDate && todayStr < startDate;
    const isAfterEnd = endDate && (todayStr > endDate || (participant.startDate && participant.startDate > endDate));

    if (isBeforeStart || isAfterEnd) {
      blogPosts = 0;
      tweets = 0;
      replies = 0;
      visitors = 0;
    } else {
      blogPosts = participant.dailyPostCount || 0;
      tweets = participant.tweetCount || 0;
      replies = participant.replyCount || 0;
      visitors = participant.dailyVisitorCount || 0;
    }
  }

  // Platform type constraints
  if (!hasBlog) {
    blogPosts = 0;
    visitors = 0;
  }
  if (!hasTwitter) {
    tweets = 0;
    replies = 0;
  }

  return {
    blogPosts,
    tweets,
    replies,
    totalPosts: blogPosts + tweets,
    totalAll: blogPosts + tweets + replies,
    visitors,
    startDate,
    endDate,
  };
}

/**
 * Calculates aggregate period statistics for a specific challenge group.
 */
export function getChallengeGroupStats(
  group: ChallengeGroup,
  participants: Participant[]
): GroupPeriodStats {
  const groupParticipants = participants.filter((p) => {
    if (p.groupName === group.name) return true;
    if (p.groupNames && p.groupNames.includes(group.name)) return true;
    if (p.groupName && p.groupName.split(',').map((s) => s.trim()).includes(group.name)) return true;
    return false;
  });

  const totalParticipants = groupParticipants.length;

  let totalBlogPosts = 0;
  let totalTweets = 0;
  let totalReplies = 0;
  let totalVisitors = 0;

  const participantWithStats = groupParticipants.map((p) => {
    const stats = getParticipantPeriodStats(p, { group });
    totalBlogPosts += stats.blogPosts;
    totalTweets += stats.tweets;
    totalReplies += stats.replies;
    totalVisitors += stats.visitors;
    return { participant: p, stats };
  });

  const totalPosts = totalBlogPosts + totalTweets;
  const totalAll = totalBlogPosts + totalTweets + totalReplies;

  const avgPostsPerUser =
    totalParticipants > 0 ? Number((totalAll / totalParticipants).toFixed(1)) : 0;

  // Compute goal rates per participant
  const targetPerUser =
    group.category === 'blog'
      ? (group.targetBlogPostCount || 10)
      : group.category === 'twitter'
      ? ((group.targetTweetCount || 10) + (group.targetReplyCount || 0))
      : ((group.targetBlogPostCount || 10) + (group.targetTweetCount || 10) + (group.targetReplyCount || 0));
  let completedCount = 0;
  let sumRates = 0;

  participantWithStats.forEach(({ stats }) => {
    const count =
      group.category === 'blog'
        ? stats.blogPosts
        : group.category === 'twitter'
        ? stats.tweets + stats.replies
        : stats.totalAll;

    const rate = targetPerUser > 0 ? Math.round((count / targetPerUser) * 100) : 0;
    sumRates += rate;
    if (rate >= 100) {
      completedCount++;
    }
  });

  const avgGoalRate =
    totalParticipants > 0 ? Math.round(sumRates / totalParticipants) : 0;
  const completionRate =
    totalParticipants > 0 ? Math.round((completedCount / totalParticipants) * 100) : 0;

  // Sort top 3 performers
  const sorted = [...participantWithStats].sort((a, b) => b.stats.totalAll - a.stats.totalAll);
  const top3 = sorted.slice(0, 3);

  return {
    totalParticipants,
    participants: groupParticipants,
    totalBlogPosts,
    totalTweets,
    totalReplies,
    totalPosts,
    totalAll,
    totalVisitors,
    avgPostsPerUser,
    avgGoalRate,
    completedCount,
    completionRate,
    top3,
  };
}

/**
 * Calculates sum of period statistics across all participants considering their enrolled challenge periods.
 */
export function getParticipantsTotalPeriodStats(
  participants: Participant[],
  allGroups?: ChallengeGroup[]
): {
  totalBlogPosts: number;
  totalTweets: number;
  totalReplies: number;
  totalPosts: number;
  totalAll: number;
  totalVisitors: number;
} {
  let totalBlogPosts = 0;
  let totalTweets = 0;
  let totalReplies = 0;
  let totalVisitors = 0;

  participants.forEach((p) => {
    const stats = getParticipantPeriodStats(p, { allGroups });
    totalBlogPosts += stats.blogPosts;
    totalTweets += stats.tweets;
    totalReplies += stats.replies;
    totalVisitors += stats.visitors;
  });

  return {
    totalBlogPosts,
    totalTweets,
    totalReplies,
    totalPosts: totalBlogPosts + totalTweets,
    totalAll: totalBlogPosts + totalTweets + totalReplies,
    totalVisitors,
  };
}

/**
 * 챌린지 ID 또는 이름을 기준으로 해당 챌린지 기간(start_date ~ end_date) 내
 * 등록된 참가자들의 유효 누적 포스팅 수(블로그 + 트윗)를 정확히 계산하는 공통 함수.
 */
export function getChallengePostCount(
  challengeIdOrName: string,
  participants: Participant[],
  groups: ChallengeGroup[]
): {
  blogPosts: number;
  tweets: number;
  replies: number;
  totalPosts: number;
  totalAll: number;
  totalVisitors: number;
  participantCount: number;
} {
  const group = groups.find((g) => g.id === challengeIdOrName || g.name === challengeIdOrName);
  if (!group) {
    return {
      blogPosts: 0,
      tweets: 0,
      replies: 0,
      totalPosts: 0,
      totalAll: 0,
      totalVisitors: 0,
      participantCount: 0,
    };
  }
  const groupStats = getChallengeGroupStats(group, participants);
  return {
    blogPosts: groupStats.totalBlogPosts,
    tweets: groupStats.totalTweets,
    replies: groupStats.totalReplies,
    totalPosts: groupStats.totalPosts,
    totalAll: groupStats.totalAll,
    totalVisitors: groupStats.totalVisitors,
    participantCount: groupStats.totalParticipants,
  };
}
