import { Participant, ChallengeGroup, MissionDay, GoalUnit } from '../types';
import { getParticipantPeriodStats } from './challengeStatsUtils';

export const ALL_MISSION_DAYS: { code: MissionDay; label: string }[] = [
  { code: 'Mon', label: '월' },
  { code: 'Tue', label: '화' },
  { code: 'Wed', label: '수' },
  { code: 'Thu', label: '목' },
  { code: 'Fri', label: '금' },
  { code: 'Sat', label: '토' },
  { code: 'Sun', label: '일' },
];

export interface ParticipantGoalSummary {
  missionDays: MissionDay[];
  goalUnit: GoalUnit;
  
  // Targets
  targetBlogPosts: number;
  targetTweets: number;
  targetReplies: number;
  
  totalTargetPosts: number;
  totalTargetReplies: number;
  totalTargetAll: number;

  // Actuals
  actualBlogPosts: number;
  actualTweets: number;
  actualReplies: number;
  
  actualTotalPosts: number;
  actualTotalReplies: number;
  actualTotalAll: number;

  // Completion Rates (%)
  blogPostRate: number;
  tweetPostRate: number;
  replyRate: number;
  overallRate: number;
  
  // Text representation for Tooltip/Tags
  summaryTagText: string;
}

/**
 * Calculates target counts and completion rates for a participant based on mission days, goal unit, and challenge group.
 */
export function calculateParticipantGoal(
  participant: Participant,
  group?: ChallengeGroup,
  allGroups?: ChallengeGroup[]
): ParticipantGoalSummary {
  const pGroups = (participant.groupNames && participant.groupNames.length > 0)
    ? participant.groupNames
    : participant.groupName
    ? participant.groupName.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  // Check if a specific single group is requested and matches one of the participant's groups
  const isSingleGroupSpecified = group && group.name !== 'all' && pGroups.includes(group.name);

  // Multi-challenge summation mode: when viewing integrated view (or no specific group) AND user belongs to 2+ challenges
  if (!isSingleGroupSpecified && pGroups.length >= 2 && allGroups && allGroups.length > 0) {
    let sumTargetBlog = 0;
    let sumTargetTweet = 0;
    let sumTargetReply = 0;

    pGroups.forEach((gName) => {
      const g = allGroups.find((item) => item.name === gName);
      if (g) {
        const subResult = calculateParticipantGoal(participant, g);
        sumTargetBlog += subResult.targetBlogPosts;
        sumTargetTweet += subResult.targetTweets;
        sumTargetReply += subResult.targetReplies;
      } else {
        sumTargetBlog += participant.targetBlogPostCount ?? 5;
        sumTargetTweet += participant.targetTweetCount ?? 5;
        sumTargetReply += participant.targetReplyCount ?? 15;
      }
    });

    const periodStats = getParticipantPeriodStats(participant, { allGroups });
    const actualBlogPosts = periodStats.blogPosts;
    const actualTweets = periodStats.tweets;
    const actualReplies = periodStats.replies;

    const platform = participant.platformType;
    let totalTargetPosts = 0;
    let totalTargetReplies = 0;
    let totalTargetAll = 0;

    let actualTotalPosts = 0;
    let actualTotalReplies = 0;
    let actualTotalAll = 0;

    if (platform === 'blog') {
      totalTargetPosts = sumTargetBlog;
      totalTargetReplies = 0;
      totalTargetAll = sumTargetBlog;

      actualTotalPosts = actualBlogPosts;
      actualTotalReplies = 0;
      actualTotalAll = actualBlogPosts;
    } else if (platform === 'twitter') {
      totalTargetPosts = sumTargetTweet;
      totalTargetReplies = sumTargetReply;
      totalTargetAll = sumTargetTweet + sumTargetReply;

      actualTotalPosts = actualTweets;
      actualTotalReplies = actualReplies;
      actualTotalAll = actualTweets + actualReplies;
    } else {
      totalTargetPosts = sumTargetBlog + sumTargetTweet;
      totalTargetReplies = sumTargetReply;
      totalTargetAll = totalTargetPosts + totalTargetReplies;

      actualTotalPosts = actualBlogPosts + actualTweets;
      actualTotalReplies = actualReplies;
      actualTotalAll = actualTotalPosts + actualTotalReplies;
    }

    const blogPostRate = sumTargetBlog > 0 ? Math.round((actualBlogPosts / sumTargetBlog) * 100) : 0;
    const tweetPostRate = sumTargetTweet > 0 ? Math.round((actualTweets / sumTargetTweet) * 100) : 0;
    const replyRate = sumTargetReply > 0 ? Math.round((actualReplies / sumTargetReply) * 100) : 0;
    const overallRate = totalTargetAll > 0 ? Math.round((actualTotalAll / totalTargetAll) * 100) : 0;

    let summaryTagText = '';
    if (platform === 'twitter') {
      summaryTagText = `게시글 ${actualTweets}/${sumTargetTweet}개 | 답글 ${actualReplies}/${sumTargetReply}개`;
    } else if (platform === 'blog') {
      summaryTagText = `블로그 ${actualBlogPosts}/${sumTargetBlog}개`;
    } else {
      summaryTagText = `블로그 ${actualBlogPosts}/${sumTargetBlog}개 | 트윗 ${actualTweets}/${sumTargetTweet}개 | 답글 ${actualReplies}/${sumTargetReply}개`;
    }

    return {
      missionDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      goalUnit: 'daily',
      targetBlogPosts: sumTargetBlog,
      targetTweets: sumTargetTweet,
      targetReplies: sumTargetReply,
      totalTargetPosts,
      totalTargetReplies,
      totalTargetAll,
      actualBlogPosts,
      actualTweets,
      actualReplies,
      actualTotalPosts,
      actualTotalReplies,
      actualTotalAll,
      blogPostRate,
      tweetPostRate,
      replyRate,
      overallRate,
      summaryTagText,
    };
  }

  // 1. Mission Days & Goal Unit
  const missionDays: MissionDay[] =
    participant.missionDays && participant.missionDays.length > 0
      ? participant.missionDays
      : group?.missionDays && group.missionDays.length > 0
      ? group.missionDays
      : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const goalUnit: GoalUnit =
    participant.goalUnit || group?.goalUnit || 'daily';

  // 2. Base per-unit target counts (prioritize group target over default 1)
  const baseTargetBlogPost =
    group?.targetBlogPostCount ??
    participant.targetBlogPostCount ??
    participant.targetPostCount ??
    5;

  const baseTargetTweet =
    group?.targetTweetCount ?? participant.targetTweetCount ?? 5;

  const baseTargetReply =
    group?.targetReplyCount ?? participant.targetReplyCount ?? 15;

  // 3. Calculate total challenge duration (default 30 days or based on group dates)
  let startDate = new Date(group?.startDate || participant.startDate || '2026-07-01');
  let endDate = new Date(group?.endDate || '2026-07-31');

  if (isNaN(startDate.getTime())) startDate = new Date('2026-07-01');
  if (isNaN(endDate.getTime())) endDate = new Date('2026-07-31');

  const diffMs = Math.max(1000 * 60 * 60 * 24, endDate.getTime() - startDate.getTime());
  const totalDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

  let targetBlogPosts = 0;
  let targetTweets = 0;
  let targetReplies = 0;

  if (goalUnit === 'weekly') {
    const totalWeeks = Math.max(1, Math.ceil(totalDays / 7));
    targetBlogPosts = baseTargetBlogPost * totalWeeks;
    targetTweets = baseTargetTweet * totalWeeks;
    targetReplies = baseTargetReply * totalWeeks;
  } else {
    // Daily unit: Count matching mission days in range
    const dayMap: Record<number, MissionDay> = {
      0: 'Sun',
      1: 'Mon',
      2: 'Tue',
      3: 'Wed',
      4: 'Thu',
      5: 'Fri',
      6: 'Sat',
    };

    let missionDaysCount = 0;
    const curDate = new Date(startDate);
    while (curDate <= endDate) {
      const dayCode = dayMap[curDate.getDay()];
      if (missionDays.includes(dayCode)) {
        missionDaysCount++;
      }
      curDate.setDate(curDate.getDate() + 1);
    }

    if (missionDaysCount === 0) missionDaysCount = totalDays;

    targetBlogPosts = baseTargetBlogPost * missionDaysCount;
    targetTweets = baseTargetTweet * missionDaysCount;
    targetReplies = baseTargetReply * missionDaysCount;
  }

  // 4. Actual counts strictly within the challenge period
  const periodStats = getParticipantPeriodStats(participant, {
    group,
    allGroups,
    startDate: group?.startDate || participant.startDate,
    endDate: group?.endDate,
  });
  const actualBlogPosts = periodStats.blogPosts;
  const actualTweets = periodStats.tweets;
  const actualReplies = periodStats.replies;

  // 5. Relevant totals based on platformType
  const platform = participant.platformType;
  let totalTargetPosts = 0;
  let totalTargetReplies = 0;
  let totalTargetAll = 0;

  let actualTotalPosts = 0;
  let actualTotalReplies = 0;
  let actualTotalAll = 0;

  if (platform === 'blog') {
    totalTargetPosts = targetBlogPosts;
    totalTargetReplies = 0;
    totalTargetAll = targetBlogPosts;

    actualTotalPosts = actualBlogPosts;
    actualTotalReplies = 0;
    actualTotalAll = actualBlogPosts;
  } else if (platform === 'twitter') {
    totalTargetPosts = targetTweets;
    totalTargetReplies = targetReplies;
    totalTargetAll = targetTweets + targetReplies;

    actualTotalPosts = actualTweets;
    actualTotalReplies = actualReplies;
    actualTotalAll = actualTweets + actualReplies;
  } else {
    // 'both'
    totalTargetPosts = targetBlogPosts + targetTweets;
    totalTargetReplies = targetReplies;
    totalTargetAll = totalTargetPosts + totalTargetReplies;

    actualTotalPosts = actualBlogPosts + actualTweets;
    actualTotalReplies = actualReplies;
    actualTotalAll = actualTotalPosts + actualTotalReplies;
  }

  // 6. Completion Rates (%)
  const blogPostRate =
    targetBlogPosts > 0
      ? Math.round((actualBlogPosts / targetBlogPosts) * 100)
      : 0;

  const tweetPostRate =
    targetTweets > 0 ? Math.round((actualTweets / targetTweets) * 100) : 0;

  const replyRate =
    targetReplies > 0 ? Math.round((actualReplies / targetReplies) * 100) : 0;

  const overallRate =
    totalTargetAll > 0
      ? Math.round((actualTotalAll / totalTargetAll) * 100)
      : 0;

  // 7. Summary Tag Text
  let summaryTagText = '';
  if (platform === 'twitter') {
    summaryTagText = `게시글 ${actualTweets}/${targetTweets}개 | 답글 ${actualReplies}/${targetReplies}개`;
  } else if (platform === 'blog') {
    summaryTagText = `블로그 ${actualBlogPosts}/${targetBlogPosts}개`;
  } else {
    summaryTagText = `블로그 ${actualBlogPosts}/${targetBlogPosts}개 | 트윗 ${actualTweets}/${targetTweets}개 | 답글 ${actualReplies}/${targetReplies}개`;
  }

  return {
    missionDays,
    goalUnit,
    targetBlogPosts,
    targetTweets,
    targetReplies,
    totalTargetPosts,
    totalTargetReplies,
    totalTargetAll,
    actualBlogPosts,
    actualTweets,
    actualReplies,
    actualTotalPosts,
    actualTotalReplies,
    actualTotalAll,
    blogPostRate,
    tweetPostRate,
    replyRate,
    overallRate,
    summaryTagText,
  };
}
