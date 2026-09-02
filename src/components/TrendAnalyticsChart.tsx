import React, { useState, useMemo, useEffect } from 'react';
import { Participant } from '../types';
import { getParticipantPeriodStats } from '../utils/challengeStatsUtils';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { TrendingUp, Award, Eye, FileText, MessageSquare, Repeat } from 'lucide-react';

interface TrendAnalyticsChartProps {
  participants: Participant[];
  challengeCategory?: 'blog' | 'twitter' | 'both' | 'all';
}

type MetricType = 'blogPosts' | 'tweets' | 'replies';

const COLOR_PALETTE = [
  '#2563EB', // Royal Blue
  '#10B981', // Emerald Green
  '#F59E0B', // Bright Amber
  '#EF4444', // Red / Crimson
  '#8B5CF6', // Vivid Purple
  '#06B6D4', // Cyan / Teal
  '#EC4899', // Hot Pink
  '#F97316', // Bright Orange
  '#14B8A6', // Dark Teal
  '#6366F1', // Indigo
  '#84CC16', // Lime Green
  '#D946EF', // Magenta
  '#0284C7', // Sky Blue
  '#B91C1C', // Deep Red
  '#059669', // Dark Emerald
];

const renderRankChangeBadge = (rankChange?: number | 'NEW') => {
  if (rankChange === undefined || rankChange === 0) {
    return null;
  }
  if (rankChange === 'NEW') {
    return (
      <span className="px-1 py-0.2 rounded text-[9px] font-extrabold bg-purple-100 text-purple-700 border border-purple-200 shrink-0">
        NEW
      </span>
    );
  }
  if (typeof rankChange === 'number' && rankChange > 0) {
    return (
      <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-50 px-1 py-0.2 rounded shrink-0">
        ▲{rankChange}
      </span>
    );
  }
  if (typeof rankChange === 'number' && rankChange < 0) {
    return (
      <span className="text-[10px] font-extrabold text-rose-600 bg-rose-50 px-1 py-0.2 rounded shrink-0">
        ▼{Math.abs(rankChange)}
      </span>
    );
  }
  return null;
};

export const TrendAnalyticsChart: React.FC<TrendAnalyticsChartProps> = ({
  participants,
  challengeCategory = 'all',
}) => {
  const showBlog = challengeCategory !== 'twitter';
  const showTwitter = challengeCategory !== 'blog';

  const [selectedMetric, setSelectedMetric] = useState<MetricType>(() => {
    if (challengeCategory === 'twitter') return 'tweets';
    return 'blogPosts';
  });

  useEffect(() => {
    if (challengeCategory === 'twitter' && selectedMetric === 'blogPosts') {
      setSelectedMetric('tweets');
    } else if (challengeCategory === 'blog' && (selectedMetric === 'tweets' || selectedMetric === 'replies')) {
      setSelectedMetric('blogPosts');
    }
  }, [challengeCategory, selectedMetric]);

  // Convert date format to friendly string like "7.20.(월)"
  const formatDateDisplay = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const month = d.getMonth() + 1;
      const day = d.getDate();
      const daysOfWeek = ['일', '월', '화', '수', '목', '금', '토'];
      const dayName = daysOfWeek[d.getDay()];
      return `${month}.${day}.(${dayName})`;
    } catch {
      return dateStr;
    }
  };

  // Extract complete challenge period dates (from earliest start date up to today)
  const chartData = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Find the earliest start date or history date among all participants
    let minDateStr = todayStr;

    (participants || []).forEach((p) => {
      if (p.startDate && p.startDate.trim()) {
        const s = p.startDate.trim();
        if (s < minDateStr) minDateStr = s;
      }
      if (p.history && p.history.length > 0) {
        p.history.forEach((h) => {
          if (h.date && h.date < minDateStr) {
            minDateStr = h.date;
          }
        });
      }
    });

    // Fallback if minDateStr is today: generate at least past 14 days
    if (minDateStr === todayStr) {
      const pastDate = new Date(today);
      pastDate.setDate(pastDate.getDate() - 14);
      minDateStr = pastDate.toISOString().split('T')[0];
    }

    // Build complete daily sequence from minDateStr to todayStr
    const datesList: string[] = [];
    const curDate = new Date(minDateStr);
    const endDate = new Date(todayStr);

    while (curDate <= endDate) {
      datesList.push(curDate.toISOString().split('T')[0]);
      curDate.setDate(curDate.getDate() + 1);
    }

    // Also include any history dates beyond today if any exist
    (participants || []).forEach((p) => {
      p.history?.forEach((h) => {
        if (h.date && !datesList.includes(h.date)) {
          datesList.push(h.date);
        }
      });
    });

    datesList.sort();

    return datesList.map((dateStr, idx) => {
      const isLatestDate = idx === datesList.length - 1 || dateStr === todayStr;
      const dataPoint: Record<string, string | number> = {
        date: dateStr,
        dateDisplay: formatDateDisplay(dateStr),
      };

      (participants || []).forEach((p) => {
        const pStart = p.startDate ? p.startDate.trim() : minDateStr;
        const isBeforeStart = dateStr < pStart;

        if (isBeforeStart) {
          dataPoint[p.participantName] = 0;
          return;
        }

        const item = p.history?.find((h) => h.date === dateStr);
        let val = 0;

        if (selectedMetric === 'blogPosts') {
          if (item && item.blogPosts !== undefined) {
            val = item.blogPosts;
          } else if (isLatestDate) {
            val = p.dailyPostCount || 0;
          } else {
            const pastItem = p.history
              ?.filter((h) => h.date <= dateStr && h.blogPosts !== undefined)
              .sort((a, b) => b.date.localeCompare(a.date))[0];
            val = pastItem ? pastItem.blogPosts : 0;
          }
        } else if (selectedMetric === 'tweets') {
          if (item && item.tweets !== undefined) {
            val = item.tweets;
          } else if (isLatestDate) {
            val = p.tweetCount || 0;
          } else {
            const pastItem = p.history
              ?.filter((h) => h.date <= dateStr && h.tweets !== undefined)
              .sort((a, b) => b.date.localeCompare(a.date))[0];
            val = pastItem ? pastItem.tweets : 0;
          }
        } else if (selectedMetric === 'replies') {
          if (item && item.replies !== undefined) {
            val = item.replies;
          } else if (isLatestDate) {
            val = p.replyCount || 0;
          } else {
            const pastItem = p.history
              ?.filter((h) => h.date <= dateStr && h.replies !== undefined)
              .sort((a, b) => b.date.localeCompare(a.date))[0];
            val = pastItem ? pastItem.replies : 0;
          }
        }

        dataPoint[p.participantName] = val;
      });

      return dataPoint;
    });
  }, [participants, selectedMetric]);

  // Leaders calculations (strictly scoped to challenge period)
  const topBloggers = useMemo(() => {
    return [...participants]
      .filter((p) => p.platformType === 'blog' || p.platformType === 'both')
      .map((p) => ({ participant: p, stats: getParticipantPeriodStats(p) }))
      .sort((a, b) => b.stats.blogPosts - a.stats.blogPosts)
      .slice(0, 5);
  }, [participants]);

  const topTweeters = useMemo(() => {
    return [...participants]
      .filter((p) => p.platformType === 'twitter' || p.platformType === 'both')
      .map((p) => ({ participant: p, stats: getParticipantPeriodStats(p) }))
      .sort((a, b) => (b.stats.tweets + b.stats.replies) - (a.stats.tweets + a.stats.replies))
      .slice(0, 5);
  }, [participants]);

  const getMetricLabel = (m: MetricType) => {
    switch (m) {
      case 'blogPosts':
        return '블로그 포스팅 수';
      case 'tweets':
        return 'X (트위터) 게시글 수';
      case 'replies':
        return 'X (트위터) 답글 수';
    }
  };

  const getMetricUnit = (m: MetricType) => {
    return '개';
  };

  return (
    <div className="space-y-6">
      {/* Top Section: Top 5 Leaderboards */}
      <div className={`grid grid-cols-1 ${showBlog && showTwitter ? 'lg:grid-cols-2' : ''} gap-4`}>
        {/* Blog Leaderboard */}
        {showBlog && (
          <div className="bg-[#FFFDF9] rounded-2xl border border-[#F3E9E0] p-4.5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-[#F3E9E0] pb-2.5">
              <h4 className="text-xs font-extrabold text-[#3A2A1F] flex items-center gap-1.5">
                <Award className="w-4 h-4 text-[#8B5E3C]" />
                <span>블로그 작성 성과 TOP 5</span>
              </h4>
              <span className="text-[11px] font-bold text-[#6F4E37] bg-[#F3E9E0] px-2 py-0.5 rounded-full border border-[#E8DACD]">
                블로그 챌린저
              </span>
            </div>

            <div className="space-y-2">
              {topBloggers.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">
                  블로그 참가자가 없습니다.
                </p>
              ) : (
                topBloggers.map(({ participant: p, stats }, idx) => (
                  <div key={`tb_${p.id}_${idx}`} className="flex items-center justify-between text-xs py-1">
                    <div className="flex items-center space-x-1.5 flex-wrap">
                      <span
                        className={`w-5 h-5 rounded-full font-extrabold text-[10px] flex items-center justify-center shrink-0 ${
                          idx === 0
                            ? 'bg-amber-400 text-amber-950 shadow-xs'
                            : idx === 1
                            ? 'bg-slate-300 text-slate-800'
                            : idx === 2
                            ? 'bg-amber-700 text-amber-100'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      {renderRankChangeBadge(p.rankChange)}
                      <strong className="text-[#3A2A1F] font-bold">{p.participantName}</strong>
                      {p.blogId && <span className="text-slate-400 font-mono text-[11px]">({p.blogId})</span>}
                      {p.streakDays && p.streakDays > 0 ? (
                        <span className="inline-flex items-center text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded-full border border-amber-200">
                          🔥 {p.streakDays}일
                        </span>
                      ) : null}
                    </div>
                    <div className="text-right shrink-0 ml-1">
                      <span className="font-mono font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                        {stats.blogPosts}개
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Twitter Leaderboard */}
        {showTwitter && (
          <div className="bg-[#FFFDF9] rounded-2xl border border-[#F3E9E0] p-4.5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-[#F3E9E0] pb-2.5">
              <h4 className="text-xs font-extrabold text-[#3A2A1F] flex items-center gap-1.5">
                <Award className="w-4 h-4 text-[#8B5E3C]" />
                <span>X (트위터) 활동 성과 TOP 5</span>
              </h4>
              <span className="text-[11px] font-bold text-[#8B5E3C] bg-[#F3E9E0] px-2 py-0.5 rounded-full border border-[#E8DACD]">
                트위터 챌린저
              </span>
            </div>

            <div className="space-y-2">
              {topTweeters.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">
                  트위터 참가자가 없습니다.
                </p>
              ) : (
                topTweeters.map(({ participant: p, stats }, idx) => {
                  const totalActivity = stats.tweets + stats.replies;
                  return (
                    <div key={`tt_${p.id}_${idx}`} className="flex items-center justify-between text-xs py-1">
                      <div className="flex items-center space-x-1.5 flex-wrap">
                        <span
                          className={`w-5 h-5 rounded-full font-extrabold text-[10px] flex items-center justify-center shrink-0 ${
                            idx === 0
                              ? 'bg-amber-400 text-amber-950 shadow-xs'
                              : idx === 1
                              ? 'bg-slate-300 text-slate-800'
                              : idx === 2
                              ? 'bg-amber-700 text-amber-100'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        {renderRankChangeBadge(p.rankChange)}
                        <strong className="text-[#3A2A1F] font-bold">{p.participantName}</strong>
                        {p.twitterId && <span className="text-slate-400 font-mono text-[11px]">({p.twitterId})</span>}
                        {p.streakDays && p.streakDays > 0 ? (
                          <span className="inline-flex items-center text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded-full border border-amber-200">
                            🔥 {p.streakDays}일
                          </span>
                        ) : null}
                      </div>
                      <div className="text-right shrink-0 ml-1">
                        <span className="font-mono font-extrabold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-100">
                          총 {totalActivity}개
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Line Chart Card */}
      <div className="bg-[#FFFDF9] rounded-2xl border border-[#F3E9E0] p-5 shadow-xs space-y-4">
        {/* Card Header & Metric Selector Sub-Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#F3E9E0] pb-4">
          <div>
            <h3 className="text-sm font-extrabold text-[#3A2A1F] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#8B5E3C]" />
              <span>참가자별 일자별 성과 추이 분석</span>
            </h3>
            <p className="text-xs text-[#8C7A6B] mt-0.5">
              지표를 선택하여 참가 일자별 변화 꺾은선 그래프를 비교하세요.
            </p>
          </div>

          {/* Metric Selector Sub-Tabs */}
          <div className="flex flex-wrap gap-1 p-1 bg-[#F3E9E0] rounded-xl text-xs border border-[#E8DACD]">
            {showBlog && (
              <button
                onClick={() => setSelectedMetric('blogPosts')}
                className={`px-3 py-1.5 font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  selectedMetric === 'blogPosts'
                    ? 'bg-[#6F4E37] text-[#FFFAF5] shadow-xs border border-[#5A3E31]'
                    : 'text-[#5A3E31] hover:text-[#3A2A1F]'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-[#E8DACD]" />
                <span>포스팅 수</span>
              </button>
            )}

            {showTwitter && (
              <>
                <button
                  onClick={() => setSelectedMetric('tweets')}
                  className={`px-3 py-1.5 font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    selectedMetric === 'tweets'
                      ? 'bg-[#6F4E37] text-[#FFFAF5] shadow-xs border border-[#5A3E31]'
                      : 'text-[#5A3E31] hover:text-[#3A2A1F]'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5 text-[#E8DACD]" />
                  <span>게시글 수</span>
                </button>

                <button
                  onClick={() => setSelectedMetric('replies')}
                  className={`px-3 py-1.5 font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    selectedMetric === 'replies'
                      ? 'bg-[#6F4E37] text-[#FFFAF5] shadow-xs border border-[#5A3E31]'
                      : 'text-[#5A3E31] hover:text-[#3A2A1F]'
                  }`}
                >
                  <Repeat className="w-3.5 h-3.5 text-[#E8DACD]" />
                  <span>답글 수</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Selected Metric Title Indicator */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs px-1 gap-2">
          <div className="flex items-center space-x-2 flex-wrap">
            <span className="font-bold text-slate-700">
              📊 선택한 지표: <span className="text-indigo-600 font-extrabold">{getMetricLabel(selectedMetric)}</span> ({getMetricUnit(selectedMetric)})
            </span>
          </div>
          <span className="text-slate-400 text-[11px]">
            * 범례(Legend)의 참가자명을 클릭하여 강조할 수 있습니다.
          </span>
        </div>

        {/* Chart Container */}
        <div className="h-[380px] w-full pt-2">
          {chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-xs">
              추이 분석 데이터가 없습니다.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 15, right: 25, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="dateDisplay"
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                  unit={getMetricUnit(selectedMetric)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    borderColor: '#e2e8f0',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    fontSize: '12px',
                  }}
                  formatter={(value: number) => [`${value.toLocaleString()} ${getMetricUnit(selectedMetric)}`]}
                  labelFormatter={(label) => `📅 일자: ${label}`}
                />
                <Legend
                  verticalAlign="top"
                  height={40}
                  wrapperStyle={{ fontSize: '12px', paddingTop: '0px' }}
                />

                {participants.map((p, idx) => (
                  <Line
                    key={`line_${p.id}_${idx}`}
                    type="monotone"
                    dataKey={p.participantName}
                    name={p.participantName}
                    stroke={COLOR_PALETTE[idx % COLOR_PALETTE.length]}
                    strokeWidth={2.5}
                    activeDot={{ r: 6 }}
                    dot={{ r: 3.5, strokeWidth: 1 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
};
