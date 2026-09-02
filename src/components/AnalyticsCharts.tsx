import React, { useState } from 'react';
import { Participant } from '../types';
import { BarChart2 } from 'lucide-react';

interface AnalyticsChartsProps {
  participants: Participant[];
}

export const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({ participants }) => {
  const [activeTab, setActiveTab] = useState<'posts' | 'tweets'>('posts');

  // Top 5 bloggers by post count
  const topBloggers = [...participants]
    .filter((p) => p.platformType === 'blog' || p.platformType === 'both')
    .sort((a, b) => b.dailyPostCount - a.dailyPostCount)
    .slice(0, 5);

  const maxPosts = topBloggers.length > 0 && topBloggers[0].dailyPostCount > 0
    ? topBloggers[0].dailyPostCount
    : 1;

  // Top 5 tweeters by tweets+replies
  const topTweeters = [...participants]
    .filter((p) => p.platformType === 'twitter' || p.platformType === 'both')
    .sort((a, b) => b.tweetCount + b.replyCount - (a.tweetCount + a.replyCount))
    .slice(0, 5);

  const maxTweets =
    topTweeters.length > 0 && (topTweeters[0].tweetCount + topTweeters[0].replyCount) > 0
      ? topTweeters[0].tweetCount + topTweeters[0].replyCount
      : 1;

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs mb-6 space-y-4">
      
      {/* Chart Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <BarChart2 className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">성과 리더보드 & 비교 시각화</h3>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('posts')}
            className={`px-3 py-1 font-semibold rounded-md transition-all cursor-pointer ${
              activeTab === 'posts'
                ? 'bg-white text-emerald-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🟢 블로그 포스팅 TOP 5
          </button>
          <button
            onClick={() => setActiveTab('tweets')}
            className={`px-3 py-1 font-semibold rounded-md transition-all cursor-pointer ${
              activeTab === 'tweets'
                ? 'bg-white text-sky-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🐦 트위터 활동 TOP 5
          </button>
        </div>
      </div>

      {/* Tab 1: Blog Posts TOP 5 */}
      {activeTab === 'posts' && (
        <div className="space-y-3 pt-1">
          {topBloggers.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">블로그 등록 참가자가 없습니다.</p>
          ) : (
            topBloggers.map((p, idx) => {
              const percent = Math.min(100, Math.round((p.dailyPostCount / maxPosts) * 100));
              return (
                <div key={`achart_p_${p.id}_${idx}`} className="space-y-1 text-xs">
                  <div className="flex items-center justify-between text-slate-700 font-medium">
                    <span className="flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <strong className="text-slate-900">{p.participantName}</strong>
                      <span className="text-slate-400">({p.blogId})</span>
                    </span>
                    <span className="font-mono font-bold text-emerald-700">
                      {p.dailyPostCount.toLocaleString()} 개/일
                    </span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab 2: Twitter Activity TOP 5 */}
      {activeTab === 'tweets' && (
        <div className="space-y-3 pt-1">
          {topTweeters.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">트위터 등록 참가자가 없습니다.</p>
          ) : (
            topTweeters.map((p, idx) => {
              const totalActivity = p.tweetCount + p.replyCount;
              const percent = Math.min(100, Math.round((totalActivity / maxTweets) * 100));
              return (
                <div key={`achart_t_${p.id}_${idx}`} className="space-y-1 text-xs">
                  <div className="flex items-center justify-between text-slate-700 font-medium">
                    <span className="flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <strong className="text-slate-900">{p.participantName}</strong>
                      <span className="text-slate-400">({p.twitterId})</span>
                    </span>
                    <span className="font-mono font-bold text-sky-700">
                      총 {totalActivity}개 (게시글 {p.tweetCount} / 답글 {p.replyCount})
                    </span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sky-500 rounded-full transition-all duration-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

    </div>
  );
};

