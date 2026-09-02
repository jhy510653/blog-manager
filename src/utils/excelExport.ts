import * as XLSX from 'xlsx';
import { Participant, ChallengeGroup } from '../types';
import { getParticipantPeriodStats } from './challengeStatsUtils';

export function exportToExcel(participants: Participant[], groupNameFilter: string, groups?: ChallengeGroup[]) {
  const headers = [
    '그룹명',
    '참가자 이름',
    '등록 방식',
    '네이버 블로그 ID',
    '챌린지 기간 포스팅 수',
    '방문자 수',
    '트위터 ID',
    '챌린지 기간 게시글 수',
    '챌린지 기간 답글 수',
    '참가 시작일',
    '특이사항',
  ];

  const dataRows = participants.map((p) => {
    const hasBlog = p.platformType === 'blog' || p.platformType === 'both';
    const hasTwitter = p.platformType === 'twitter' || p.platformType === 'both';
    const stats = getParticipantPeriodStats(p, { allGroups: groups });

    const typeLabel =
      p.platformType === 'blog'
        ? '블로그 전용'
        : p.platformType === 'twitter'
        ? '트위터 전용'
        : '블로그+트위터';

    return [
      p.groupName,
      p.participantName,
      typeLabel,
      hasBlog && p.blogId ? p.blogId : '-',
      hasBlog ? stats.blogPosts : '-',
      hasBlog ? (stats.visitors || p.dailyVisitorCount || '-') : '-',
      hasTwitter && p.twitterId ? p.twitterId : '-',
      hasTwitter ? stats.tweets : '-',
      hasTwitter ? stats.replies : '-',
      p.startDate,
      p.notes || '-',
    ];
  });

  const worksheetData = [headers, ...dataRows];
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 18 }, // 그룹명
    { wch: 14 }, // 이름
    { wch: 12 }, // 등록방식
    { wch: 18 }, // 블로그ID
    { wch: 12 }, // 포스팅수
    { wch: 14 }, // 방문자수
    { wch: 16 }, // 트위터ID
    { wch: 12 }, // 게시글수
    { wch: 10 }, // 답글수
    { wch: 12 }, // 시작일
    { wch: 20 }, // 특이사항
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '챌린지 통계');

  const todayStr = new Date().toISOString().split('T')[0];
  const sanitizeGroup = groupNameFilter === 'all' ? '전체' : groupNameFilter.replace(/\s+/g, '_');
  const fileName = `챌린지_모니터링_통계_${sanitizeGroup}_${todayStr}.xlsx`;

  XLSX.writeFile(workbook, fileName);
}
