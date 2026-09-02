import React, { useEffect } from 'react';
import { UserBadge } from '../../types';
import { Trophy, X, Sparkles } from 'lucide-react';

interface BadgeNotificationToastProps {
  newBadges: UserBadge[];
  onDismiss: (badgeId: string) => void;
  onOpenCollection?: () => void;
}

export const BadgeNotificationToast: React.FC<BadgeNotificationToastProps> = ({
  newBadges = [],
  onDismiss,
  onOpenCollection,
}) => {
  if (!newBadges || newBadges.length === 0) return null;

  const current = newBadges[0];
  const badge = current.badge;

  return (
    <div className="fixed bottom-20 right-4 z-50 max-w-sm w-full animate-in slide-in-from-bottom-5 fade-in duration-300">
      <div className="bg-slate-900 text-white rounded-3xl p-4 shadow-2xl border border-amber-500/40 relative overflow-hidden">
        {/* Glow accent */}
        <div
          className="absolute -right-10 -top-10 w-32 h-32 rounded-full opacity-20 blur-xl pointer-events-none"
          style={{ backgroundColor: badge?.color || '#F59E0B' }}
        />

        <div className="flex items-start gap-3.5 relative z-10">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 bg-white/10 backdrop-blur-xs border border-white/20 shadow-md animate-bounce"
            style={{ borderColor: `${badge?.color || '#F59E0B'}80` }}
          >
            {badge?.icon || '🏆'}
          </div>

          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.2 rounded-full bg-amber-400 text-amber-950 text-[9px] font-black uppercase">
                NEW BADGE
              </span>
              <span className="text-xs font-black text-amber-300 truncate">
                {badge?.name || '새 성과 뱃지 획득!'}
              </span>
            </div>
            <p className="text-[11px] text-slate-300 line-clamp-2 leading-tight">
              {badge?.description || '축하합니다! 새로운 성과 뱃지를 획득하셨습니다.'}
            </p>

            {onOpenCollection && (
              <button
                type="button"
                onClick={() => {
                  onDismiss(current.badgeId);
                  onOpenCollection();
                }}
                className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-black text-amber-400 hover:text-amber-300 underline cursor-pointer"
              >
                <span>컬렉션에서 뱃지 보기 →</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => onDismiss(current.badgeId)}
            className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer rounded-full"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
