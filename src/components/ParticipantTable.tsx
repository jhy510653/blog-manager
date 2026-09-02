import React, { useState } from 'react';
import { Participant, ChallengeGroup } from '../types';
import { calculateParticipantGoal } from '../utils/goalCalculator';
import { getParticipantPeriodStats } from '../utils/challengeStatsUtils';
import {
  ArrowUpDown,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  FileSpreadsheet,
  Info,
  Globe,
  Twitter,
  BookOpen,
  Edit3,
  Trash2,
  Flame,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

interface ParticipantTableProps {
  participants: Participant[];
  groups?: ChallengeGroup[];
  onSelectParticipant: (participant: Participant) => void;
  onExportCSV: () => void;
  onExportExcel: () => void;
  isAdminLoggedIn?: boolean;
  onDeleteParticipant?: (participantId: string) => void;
  onEditParticipant?: (participant: Participant) => void;
  challengeCategory?: 'blog' | 'twitter' | 'both' | 'all';
}

type SortField =
  | 'participantName'
  | 'groupName'
  | 'dailyPostCount'
  | 'dailyVisitorCount'
  | 'tweetCount'
  | 'replyCount'
  | 'streakDays';

export const ParticipantTable: React.FC<ParticipantTableProps> = ({
  participants,
  groups = [],
  onSelectParticipant,
  onExportCSV,
  onExportExcel,
  isAdminLoggedIn = false,
  onDeleteParticipant,
  onEditParticipant,
  challengeCategory = 'all',
}) => {
  const [sortField, setSortField] = useState<SortField>('participantName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  const showBlog = challengeCategory !== 'twitter';
  const showTwitter = challengeCategory !== 'blog';
  const colSpanCount = 4 + (showBlog ? 2 : 0) + (showTwitter ? 3 : 0) + (isAdminLoggedIn ? 1 : 0);

  const renderRankChangeBadge = (rankChange?: number | 'NEW') => {
    if (rankChange === undefined || rankChange === 0) {
      return <span className="text-slate-300 font-mono text-[11px] select-none">-</span>;
    }
    if (rankChange === 'NEW') {
      return (
        <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-purple-100 text-purple-700 border border-purple-200">
          NEW
        </span>
      );
    }
    if (typeof rankChange === 'number' && rankChange > 0) {
      return (
        <span className="inline-flex items-center text-[11px] font-extrabold text-emerald-600 bg-emerald-50 px-1 py-0.2 rounded">
          ▲{rankChange}
        </span>
      );
    }
    if (typeof rankChange === 'number' && rankChange < 0) {
      return (
        <span className="inline-flex items-center text-[11px] font-extrabold text-rose-600 bg-rose-50 px-1 py-0.2 rounded">
          ▼{Math.abs(rankChange)}
        </span>
      );
    }
    return null;
  };

  const renderStreakBadge = (streakDays?: number) => {
    const days = streakDays ?? 0;
    if (days <= 0) {
      return <span className="text-slate-400 font-medium text-xs">-</span>;
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200/90 shadow-2xs">
        <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500 animate-pulse shrink-0" />
        <span>{days}일 연속</span>
      </span>
    );
  };

  // Sorting handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc'); // Default to high-to-low for metrics
    }
  };

  const sortedParticipants = [...participants].sort((a, b) => {
    let aVal: any = a[sortField];
    let bVal: any = b[sortField];

    if (sortField === 'dailyPostCount') {
      const aStats = getParticipantPeriodStats(a, { allGroups: groups });
      const bStats = getParticipantPeriodStats(b, { allGroups: groups });
      aVal = aStats.blogPosts;
      bVal = bStats.blogPosts;
    } else if (sortField === 'tweetCount') {
      const aStats = getParticipantPeriodStats(a, { allGroups: groups });
      const bStats = getParticipantPeriodStats(b, { allGroups: groups });
      aVal = aStats.tweets;
      bVal = bStats.tweets;
    } else if (sortField === 'replyCount') {
      const aStats = getParticipantPeriodStats(a, { allGroups: groups });
      const bStats = getParticipantPeriodStats(b, { allGroups: groups });
      aVal = aStats.replies;
      bVal = bStats.replies;
    } else if (sortField === 'dailyVisitorCount') {
      const aStats = getParticipantPeriodStats(a, { allGroups: groups });
      const bStats = getParticipantPeriodStats(b, { allGroups: groups });
      aVal = aStats.visitors || a.dailyVisitorCount || 0;
      bVal = bStats.visitors || b.dailyVisitorCount || 0;
    }

    if (aVal === null || aVal === undefined) aVal = -1;
    if (bVal === null || bVal === undefined) bVal = -1;

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDirection === 'asc'
        ? aVal.localeCompare(bVal, 'ko-KR')
        : bVal.localeCompare(aVal, 'ko-KR');
    }

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    }

    return 0;
  });

  // Pagination calculation
  const totalItems = sortedParticipants.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginatedParticipants = sortedParticipants.slice(startIndex, startIndex + pageSize);

  return (
    <div className="bg-[#FFFDF9] rounded-2xl border border-[#F3E9E0] shadow-xs overflow-hidden">
      
      {/* Table Header Bar */}
      <div className="px-3 py-2.5 sm:px-5 sm:py-3 border-b border-[#F3E9E0] bg-[#FFFAF5] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
        <div>
          <h3 className="text-xs sm:text-sm font-extrabold text-[#3A2A1F] flex items-center gap-1.5 sm:gap-2">
            <span>📊 참가자 현황 및 리더보드</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-[#F3E9E0] text-[#6F4E37] border border-[#E8DACD]">
              총 {totalItems}명
            </span>
          </h3>
          <p className="text-[11px] text-[#8C7A6B] mt-0.5 hidden sm:block">
            행을 클릭하면 개별 상세 활동 내역과 스위칭 기록을 확인할 수 있습니다.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end text-xs">
          <div className="flex items-center space-x-1 text-[11px] font-bold text-[#5A3E31]">
            <span className="shrink-0">표시:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white border border-[#E8DACD] rounded-lg px-1.5 py-1 text-[11px] font-bold text-[#3A2A1F] cursor-pointer focus:ring-1 focus:ring-[#6F4E37]"
            >
              <option value={5}>5개</option>
              <option value={10}>10개</option>
              <option value={20}>20개</option>
              <option value={50}>50개</option>
            </select>
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              onClick={onExportExcel}
              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-[#FFFAF5] bg-[#6F4E37] hover:bg-[#5A3E31] transition-colors shadow-2xs cursor-pointer border border-[#5A3E31]"
              title="현재 필터링된 참가자 목록을 엑셀(.xlsx) 파일로 다운로드합니다"
            >
              <FileSpreadsheet className="w-3 h-3 text-[#E8DACD]" />
              <span>.XLSX</span>
            </button>
            <button
              onClick={onExportCSV}
              className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg text-[11px] font-bold text-[#6F4E37] bg-[#F3E9E0] hover:bg-[#E8DACD] border border-[#E8DACD] transition-colors shadow-2xs cursor-pointer"
              title="CSV 파일로 다운로드합니다"
            >
              <span>.CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Desktop & Tablet Table View */}
      <div className="hidden md:block overflow-x-auto max-h-[420px] overflow-y-auto border-b border-[#F3E9E0] relative">
        <table className="w-full text-left text-xs sm:text-sm border-collapse min-w-[850px]">
          <thead className="sticky top-0 z-10 bg-[#F3E9E0] backdrop-blur-xs border-b border-[#E8DACD] shadow-xs">
            <tr className="text-[#3A2A1F] font-extrabold select-none">
              <th
                onClick={() => handleSort('groupName')}
                className="py-3 px-3 sm:px-4 cursor-pointer hover:bg-[#EAE1D6] transition-colors"
              >
                <div className="flex items-center space-x-1">
                  <span>그룹명</span>
                  <ArrowUpDown className="w-3 h-3 text-[#8C7A6B]" />
                </div>
              </th>

              <th
                onClick={() => handleSort('participantName')}
                className="py-3 px-3 sm:px-4 cursor-pointer hover:bg-[#EAE1D6] transition-colors"
              >
                <div className="flex items-center space-x-1.5">
                  <span>이름(참가자명)</span>
                  <ArrowUpDown className="w-3 h-3 text-[#8C7A6B]" />
                </div>
              </th>

              {/* 연속 달성 Streak Header */}
              <th
                onClick={() => handleSort('streakDays')}
                className="py-3 px-3 sm:px-4 cursor-pointer hover:bg-[#EAE1D6] transition-colors text-center"
              >
                <div className="flex items-center justify-center space-x-1">
                  <span>연속 달성</span>
                  <ArrowUpDown className="w-3 h-3 text-[#8C7A6B]" />
                </div>
              </th>

              {/* Progress Bar Column Header */}
              <th className="py-3 px-3 sm:px-4 text-center">
                <span>목표 달성률</span>
              </th>

              {showBlog && (
                <>
                  <th className="py-3 px-3 sm:px-4">
                    <span>네이버 블로그 ID</span>
                  </th>

                  <th
                    onClick={() => handleSort('dailyPostCount')}
                    className="py-3 px-3 sm:px-4 cursor-pointer hover:bg-[#EAE1D6] transition-colors text-right"
                    title="참가자 챌린지 시작일 기준 수집된 네이버 블로그 포스팅 수"
                  >
                    <div className="flex items-center justify-end space-x-1">
                      <span>포스팅 수</span>
                      <span className="text-[10px] font-normal text-[#8C7A6B] bg-[#F3E9E0] px-1.5 py-0.2 rounded border border-[#E8DACD]">시작일기준</span>
                      <ArrowUpDown className="w-3 h-3 text-[#8C7A6B]" />
                    </div>
                  </th>
                </>
              )}

              {showTwitter && (
                <>
                  <th className="py-3 px-3 sm:px-4">
                    <span>트위터 ID</span>
                  </th>

                  <th
                    onClick={() => handleSort('tweetCount')}
                    className="py-3 px-3 sm:px-4 cursor-pointer hover:bg-slate-200/60 transition-colors text-right"
                  >
                    <div className="flex items-center justify-end space-x-1">
                      <span>게시글 수</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>

                  <th
                    onClick={() => handleSort('replyCount')}
                    className="py-3 px-3 sm:px-4 cursor-pointer hover:bg-slate-200/60 transition-colors text-right"
                  >
                    <div className="flex items-center justify-end space-x-1">
                      <span>답글 수</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                </>
              )}

              {isAdminLoggedIn && (
                <th className="py-3 px-3 sm:px-4 text-center text-indigo-900 font-bold bg-indigo-50/80">
                  <span>관리</span>
                </th>
              )}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {paginatedParticipants.length === 0 ? (
              <tr>
                <td colSpan={colSpanCount} className="py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <Info className="w-8 h-8 text-slate-300" />
                    <p className="text-sm font-medium">검색 결과가 없습니다.</p>
                    <p className="text-xs text-slate-400">
                      필터 조건이나 기간 검색어를 조정해 보세요.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedParticipants.map((p, idx) => {
                const hasBlog = p.platformType === 'blog' || p.platformType === 'both';
                const hasTwitter = p.platformType === 'twitter' || p.platformType === 'both';

                // Calculate Goal Progress Rate and period-scoped activity counts
                const matchedGroup = groups.find((g) => g.name === p.groupName);
                const goalInfo = calculateParticipantGoal(p, matchedGroup, groups);
                const progressPercent = goalInfo.overallRate;
                const pPeriodStats = getParticipantPeriodStats(p, { group: matchedGroup, allGroups: groups });

                // Check 24h inactivity warning
                const isInactive =
                  p.isInactive24h === true ||
                  pPeriodStats.totalAll === 0;

                return (
                  <tr
                    key={`p_row_${p.id}_${idx}`}
                    onClick={() => onSelectParticipant(p)}
                    className={`transition-colors cursor-pointer group ${
                      isInactive
                        ? 'bg-[#FDF2F0] hover:bg-[#FBE5E1] border-l-4 border-l-[#B84A39]'
                        : 'hover:bg-[#F2ECE4]/80'
                    }`}
                  >
                    {/* 1. 그룹명 */}
                    <td className="py-3 px-3 sm:px-4 font-bold text-[#3D281D]">
                      <div className="flex flex-wrap gap-1">
                        {(p.groupNames && p.groupNames.length > 0
                          ? p.groupNames
                          : p.groupName.split(',').map((s) => s.trim())
                        ).map((gName, idx) => (
                          <span
                            key={idx}
                            className="inline-block px-2.5 py-0.5 rounded-xl text-xs bg-[#F2ECE4] text-[#4A3228] font-extrabold border border-[#D7C4B7]"
                          >
                            {gName}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* 2. 이름 / 참가자명 + 순위 변동 + 24h 경고 태그 */}
                    <td className="py-3 px-3 sm:px-4 font-bold text-[#3D281D] group-hover:text-[#5A3E31] transition-colors">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {renderRankChangeBadge(p.rankChange)}
                        <span className="font-extrabold text-[#3D281D]">{p.participantName}</span>
                        {p.platformType === 'both' && (
                          <span className="px-1.5 py-0.2 rounded-lg text-[10px] font-extrabold bg-[#F2ECE4] text-[#4A3228] border border-[#D7C4B7]">
                            통합형
                          </span>
                        )}
                        {isInactive && (
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-700 border border-rose-300 animate-pulse flex items-center gap-1 shrink-0">
                            <span>⚠️ 24시간 미작성</span>
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 3. 연속 달성 (Streak) */}
                    <td className="py-3 px-3 sm:px-4 text-center">
                      {renderStreakBadge(p.streakDays)}
                    </td>

                    {/* 4. 목표 달성률 (Progress Bar + Hover Tag) */}
                    <td className="py-3 px-3 sm:px-4 text-center">
                      <div
                        className="w-32 sm:w-36 mx-auto space-y-1 group/progress relative cursor-help"
                        title={`${goalInfo.summaryTagText} (통합 달성률 ${progressPercent}%)`}
                      >
                        <div className="flex items-center justify-between text-[11px] font-bold">
                          <span
                            className={
                              progressPercent >= 100
                                ? 'text-emerald-700'
                                : progressPercent >= 50
                                ? 'text-indigo-700'
                                : 'text-amber-700'
                            }
                          >
                            {progressPercent}%
                          </span>
                          <span className="text-slate-500 text-[10px]">
                            ({goalInfo.actualTotalAll}/{goalInfo.totalTargetAll}개)
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              progressPercent >= 100
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                                : progressPercent >= 50
                                ? 'bg-gradient-to-r from-indigo-500 to-blue-400'
                                : 'bg-gradient-to-r from-amber-500 to-yellow-400'
                            }`}
                            style={{ width: `${Math.min(100, progressPercent)}%` }}
                          />
                        </div>
                        <div className="text-[10px] font-medium text-[#6F4E37] bg-[#F3E9E0]/80 px-1.5 py-0.5 rounded border border-[#E8DACD]/80 truncate">
                          {goalInfo.summaryTagText}
                        </div>
                      </div>
                    </td>

                    {/* Blog Columns */}
                    {showBlog && (
                      <>
                        <td className="py-3 px-3 sm:px-4 font-mono text-slate-700">
                          {hasBlog && p.blogId ? (
                            <a
                              href={`https://blog.naver.com/${p.blogId}`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center text-emerald-700 hover:underline gap-1 group/link"
                            >
                              <BookOpen className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>{p.blogId}</span>
                              <ExternalLink className="w-3 h-3 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                            </a>
                          ) : (
                            <span className="text-slate-400 font-bold px-2 text-center">-</span>
                          )}
                        </td>

                        <td className="py-3 px-3 sm:px-4 text-right font-semibold text-slate-800">
                          {hasBlog ? (
                            <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded font-mono text-xs">
                              {pPeriodStats.blogPosts}개
                            </span>
                          ) : (
                            <span className="text-slate-400 font-bold px-2">-</span>
                          )}
                        </td>
                      </>
                    )}

                    {/* Twitter Columns */}
                    {showTwitter && (
                      <>
                        <td className="py-3 px-3 sm:px-4 font-mono text-slate-700">
                          {hasTwitter && p.twitterId ? (
                            <a
                              href={`https://x.com/${p.twitterId.replace('@', '')}`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center text-sky-600 hover:underline gap-1 group/link"
                            >
                              <Twitter className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                              <span>{p.twitterId}</span>
                              <ExternalLink className="w-3 h-3 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                            </a>
                          ) : (
                            <span className="text-slate-400 font-bold px-2 text-center">-</span>
                          )}
                        </td>

                        <td className="py-3 px-3 sm:px-4 text-right font-semibold text-slate-800">
                          {hasTwitter ? (
                            <span className="bg-sky-50 text-sky-800 px-2 py-0.5 rounded font-mono text-xs">
                              {pPeriodStats.tweets}개
                            </span>
                          ) : (
                            <span className="text-slate-400 font-bold px-2">-</span>
                          )}
                        </td>

                        <td className="py-3 px-3 sm:px-4 text-right font-semibold text-slate-800">
                          {hasTwitter ? (
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono text-xs">
                              {pPeriodStats.replies}개
                            </span>
                          ) : (
                            <span className="text-slate-400 font-bold px-2">-</span>
                          )}
                        </td>
                      </>
                    )}

                    {/* 9. 관리 버튼 (운영자 전용) */}
                    {isAdminLoggedIn && (
                      <td className="py-3 px-3 sm:px-4 text-center">
                        <div
                          className="flex items-center justify-center space-x-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {onEditParticipant && (
                            <button
                              onClick={() => onEditParticipant(p)}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors cursor-pointer"
                              title="참가자 정보 수정"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {onDeleteParticipant && (
                            <button
                              onClick={() => {
                                if (confirm(`${p.participantName} 참가자를 삭제하시겠습니까?`)) {
                                  onDeleteParticipant(p.id);
                                }
                              }}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                              title="참가자 삭제"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile / Narrow Screen Dedicated Responsive Card View */}
      <div className="block md:hidden max-h-[420px] overflow-y-auto divide-y divide-slate-100 p-3 bg-slate-50/50">
        {paginatedParticipants.length === 0 ? (
          <div className="py-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
            <Info className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-medium">검색 결과가 없습니다.</p>
          </div>
        ) : (
          paginatedParticipants.map((p, idx) => {
            const hasBlog = p.platformType === 'blog' || p.platformType === 'both';
            const hasTwitter = p.platformType === 'twitter' || p.platformType === 'both';

            const matchedGroup = groups.find((g) => g.name === p.groupName);
            const goalInfo = calculateParticipantGoal(p, matchedGroup, groups);
            const pPeriodStats = getParticipantPeriodStats(p, { group: matchedGroup, allGroups: groups });
            const targetCount = goalInfo.totalTargetAll;
            const currentVal = goalInfo.actualTotalAll;
            const progressPercent = goalInfo.overallRate;

            const isInactive =
              p.isInactive24h === true ||
              pPeriodStats.totalAll === 0;

            return (
              <div
                key={`p_card_${p.id}_${idx}`}
                onClick={() => onSelectParticipant(p)}
                className={`bg-white rounded-xl p-4 my-2 border shadow-2xs transition-all cursor-pointer active:scale-[0.99] ${
                  isInactive
                    ? 'border-rose-300 bg-rose-50/30'
                    : 'border-slate-200/90 hover:border-blue-300'
                }`}
              >
                {/* Mobile Card Header */}
                <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {(p.groupNames && p.groupNames.length > 0
                      ? p.groupNames
                      : p.groupName.split(',').map((s) => s.trim())
                    ).map((gName, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded text-[11px] bg-slate-100 text-slate-700 font-bold">
                        🎯 {gName}
                      </span>
                    ))}
                    {renderRankChangeBadge(p.rankChange)}
                  </div>
                  {renderStreakBadge(p.streakDays)}
                </div>

                {/* Participant Name & Status */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-extrabold text-slate-900">
                      {p.participantName}
                    </h4>
                    {p.platformType === 'both' && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        올인원
                      </span>
                    )}
                  </div>
                  {isInactive && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-700 border border-rose-300 animate-pulse">
                      ⚠️ 24h 미작성
                    </span>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 mb-3 space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-600">목표 달성률</span>
                    <span
                      className={
                        progressPercent >= 100
                          ? 'text-emerald-700'
                          : progressPercent >= 50
                          ? 'text-indigo-700'
                          : 'text-amber-700'
                      }
                    >
                      {progressPercent}% ({currentVal}/{targetCount}개)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-200/70 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        progressPercent >= 100
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                          : progressPercent >= 50
                          ? 'bg-gradient-to-r from-indigo-500 to-blue-400'
                          : 'bg-gradient-to-r from-amber-500 to-yellow-400'
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                {/* Metrics Details */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {showBlog && (
                    <div className="bg-emerald-50/50 p-2 rounded-lg border border-emerald-100/80">
                      <div className="text-[10px] text-emerald-800 font-bold flex items-center gap-1 mb-1">
                        <BookOpen className="w-3 h-3 text-emerald-600" />
                        <span>네이버 블로그</span>
                      </div>
                      {hasBlog && p.blogId ? (
                        <>
                          <p className="font-mono text-slate-700 text-[11px] truncate">{p.blogId}</p>
                          <div className="mt-1 text-[11px] text-slate-600">
                            <span>포스팅 수: <strong className="text-emerald-700">{pPeriodStats.blogPosts}개</strong></span>
                          </div>
                        </>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </div>
                  )}

                  {showTwitter && (
                    <div className="bg-sky-50/50 p-2 rounded-lg border border-sky-100/80">
                      <div className="text-[10px] text-sky-800 font-bold flex items-center gap-1 mb-1">
                        <Twitter className="w-3 h-3 text-sky-600" />
                        <span>X (트위터)</span>
                      </div>
                      {hasTwitter && p.twitterId ? (
                        <>
                          <p className="font-mono text-slate-700 text-[11px] truncate">{p.twitterId}</p>
                          <div className="mt-1 flex justify-between text-[11px] text-slate-600">
                            <span>게시글: <strong className="text-sky-700">{pPeriodStats.tweets}개</strong></span>
                            <span>답글: <strong className="text-slate-700">{pPeriodStats.replies}개</strong></span>
                          </div>
                        </>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Admin Row */}
                {isAdminLoggedIn && (
                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-end space-x-2">
                    {onEditParticipant && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditParticipant(p);
                        }}
                        className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                      >
                        수정
                      </button>
                    )}
                    {onDeleteParticipant && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`${p.participantName} 참가자를 삭제하시겠습니까?`)) {
                            onDeleteParticipant(p.id);
                          }
                        }}
                        className="px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition-colors"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            총 {totalItems}명 중 {startIndex + 1} - {Math.min(startIndex + pageSize, totalItems)}명
            표시 중
          </p>

          <div className="flex items-center space-x-1">
            <button
              disabled={safePage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-md border border-slate-200 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
              <button
                key={pageNum}
                onClick={() => setCurrentPage(pageNum)}
                className={`w-7 h-7 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  safePage === pageNum
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {pageNum}
              </button>
            ))}

            <button
              disabled={safePage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-md border border-slate-200 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
