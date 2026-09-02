import React from 'react';
import { X, Award, CheckCircle2, Lock, Calendar, Sparkles, TrendingUp } from 'lucide-react';
import { UserBadgeProgress } from '../../types';

interface BadgeDetailModalProps {
  progress: UserBadgeProgress | null;
  onClose: () => void;
}

export const BadgeDetailModal: React.FC<BadgeDetailModalProps> = ({ progress, onClose }) => {
  if (!progress) return null;

  const { badge, isEarned, earnedAt, currentValue, targetValue, progressPercent } = progress;

  const formatNumber = (num: number) => {
    return Number(num || 0).toLocaleString('ko-KR');
  };

  const getConditionLabel = () => {
    switch (badge.conditionType) {
      case 'profit_verification_count':
        return `수익 인증 ${badge.conditionValue}회 달성`;
      case 'total_profit':
        return `누적 인증 수익 ${formatNumber(badge.conditionValue)}원 달성`;
      case 'challenge_complete':
        return `챌린지 ${badge.conditionValue}회 참가/완주`;
      case 'streak_days':
        return `연속 ${badge.conditionValue}일 포스팅 스트릭 달성`;
      default:
        return `${badge.conditionType} (${badge.conditionValue})`;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header with badge theme color banner */}
        <div
          className="p-6 text-center relative overflow-hidden flex flex-col items-center justify-center"
          style={{
            background: isEarned
              ? `linear-gradient(135deg, ${badge.color}22 0%, ${badge.color}44 100%)`
              : 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3.5 top-3.5 p-1.5 rounded-full bg-white/80 hover:bg-white text-slate-500 hover:text-slate-900 transition-colors cursor-pointer shadow-2xs"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Badge Big Icon */}
          <div
            className={`w-20 h-20 rounded-3xl flex items-center justify-center text-4xl shadow-md border transition-transform duration-300 ${
              isEarned
                ? 'bg-white border-white scale-105 rotate-1'
                : 'bg-slate-200/80 border-slate-300 grayscale opacity-70'
            }`}
            style={{
              boxShadow: isEarned ? `0 10px 25px -5px ${badge.color}55` : undefined,
            }}
          >
            {badge.icon}
          </div>

          <div className="mt-3 flex items-center gap-1.5">
            <span
              className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold"
              style={{
                backgroundColor: isEarned ? `${badge.color}20` : '#e2e8f0',
                color: isEarned ? badge.color : '#64748b',
              }}
            >
              {badge.category}
            </span>

            {isEarned ? (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                획득 완료
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-extrabold flex items-center gap-1">
                <Lock className="w-3 h-3" />
                미획득
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div className="text-center space-y-1">
            <h3 className="text-base font-extrabold text-slate-900">{badge.name}</h3>
            <p className="text-xs text-slate-600 leading-relaxed">{badge.description}</p>
          </div>

          {/* Condition Box */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-2 text-xs">
            <div className="flex items-center justify-between text-slate-500 font-bold text-[11px]">
              <span className="flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-indigo-600" />
                획득 조건
              </span>
              <span className="text-slate-800 font-extrabold">{getConditionLabel()}</span>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between text-[10px] font-bold">
                <span className="text-slate-500">현재 달성도</span>
                <span className="text-slate-900 font-black">
                  {badge.conditionType === 'total_profit'
                    ? `${formatNumber(currentValue)}원 / ${formatNumber(targetValue)}원 (${progressPercent}%)`
                    : `${formatNumber(currentValue)} / ${formatNumber(targetValue)} (${progressPercent}%)`}
                </span>
              </div>
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${progressPercent}%`,
                    backgroundColor: isEarned ? badge.color || '#10B981' : '#6366F1',
                  }}
                />
              </div>
            </div>

            {isEarned && earnedAt && (
              <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-500 font-semibold">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  획득 일시
                </span>
                <span className="text-slate-700 font-bold">
                  {new Date(earnedAt).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
          >
            닫기
          </button>
        </div>

      </div>
    </div>
  );
};
