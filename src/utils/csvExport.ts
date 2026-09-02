import { Participant, ChallengeGroup } from '../types';
import { getParticipantPeriodStats } from './challengeStatsUtils';

export function exportToCSV(participants: Participant[], groupNameFilter: string, groups?: ChallengeGroup[]) {
  const headers = [
    '그룹명',
    '이름(참가자명)',
    '등록 유형',
    '네이버 블로그 ID',
    '챌린지 기간 포스팅 수',
    '방문자 수',
    '트위터 ID',
    '챌린지 기간 게시글 수',
    '챌린지 기간 답글 수',
    '참가 시작일'
  ];

  const rows = participants.map((p) => {
    const stats = getParticipantPeriodStats(p, { allGroups: groups });

    // Format blog fields
    const hasBlog = p.platformType === 'blog' || p.platformType === 'both';
    const blogId = hasBlog && p.blogId ? p.blogId : '-';
    const dailyPosts = hasBlog ? String(stats.blogPosts) : '-';
    const dailyVisitors = hasBlog ? (stats.visitors || p.dailyVisitorCount).toLocaleString('ko-KR') : '-';

    // Format twitter fields
    const hasTwitter = p.platformType === 'twitter' || p.platformType === 'both';
    const twitterId = hasTwitter && p.twitterId ? p.twitterId : '-';
    const tweetCount = hasTwitter ? String(stats.tweets) : '-';
    const replyCount = hasTwitter ? String(stats.replies) : '-';

    const typeLabel =
      p.platformType === 'blog'
        ? '블로그 전용'
        : p.platformType === 'twitter'
        ? '트위터 전용'
        : '블로그+트위터';

    return [
      escapeCsvCell(p.groupName),
      escapeCsvCell(p.participantName),
      escapeCsvCell(typeLabel),
      escapeCsvCell(blogId),
      escapeCsvCell(dailyPosts),
      escapeCsvCell(dailyVisitors),
      escapeCsvCell(twitterId),
      escapeCsvCell(tweetCount),
      escapeCsvCell(replyCount),
      escapeCsvCell(p.startDate),
    ];
  });

  // Combine headers and rows
  const csvContent =
    '\uFEFF' + // UTF-8 BOM for Microsoft Excel Korean rendering
    [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  const todayStr = new Date().toISOString().split('T')[0];
  const sanitizeGroup = groupNameFilter === 'all' ? '전체_통계' : groupNameFilter.replace(/\s+/g, '_');
  
  link.setAttribute('href', url);
  link.setAttribute('download', `챌린지_모니터링_통계_${sanitizeGroup}_${todayStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeCsvCell(cellValue: string): string {
  if (cellValue.includes(',') || cellValue.includes('"') || cellValue.includes('\n')) {
    return `"${cellValue.replace(/"/g, '""')}"`;
  }
  return cellValue;
}
