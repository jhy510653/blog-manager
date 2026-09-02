import React from 'react';
import { Lock, Sparkles, Trophy, ArrowRight, ShieldAlert, LogIn, FileText, Image, Layers, Search, CreditCard } from 'lucide-react';
import { AIToolkitAccessResult } from '../utils/aiToolkitPermissions';

interface AIToolkitAccessRestrictedProps {
  accessResult: AIToolkitAccessResult;
  onOpenGoogleAuth?: () => void;
  onViewChallenges?: () => void;
  onViewSubscription?: () => void;
}

export const AIToolkitAccessRestricted: React.FC<AIToolkitAccessRestrictedProps> = ({
  accessResult,
  onOpenGoogleAuth,
  onViewChallenges,
  onViewSubscription,
}) => {
  const isNotLoggedIn = accessResult.reason === 'not_logged_in';

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 space-y-8 animate-in fade-in duration-300">
      {/* Access Control Banner Header */}
      <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 rounded-3xl p-6 sm:p-10 text-white shadow-2xl border border-slate-700/60 overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-6 text-center max-w-2xl mx-auto">
          {/* Lock Icon Badge */}
          <div className="inline-flex items-center justify-center space-x-2 bg-amber-500/10 border border-amber-400/30 px-4 py-1.5 rounded-full text-amber-300 text-xs font-bold backdrop-blur-md">
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span>챌린지 참가자 & 유료 멤버십 전용</span>
          </div>

          <div className="space-y-3">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-snug">
              AI 초안 생성기는 <br className="hidden sm:inline" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-indigo-200 to-teal-300">
                챌린지 참가자 및 유료 멤버십 전용
              </span>
              입니다.
            </h2>
            <p className="text-sm sm:text-base text-slate-300 font-medium leading-relaxed">
              {isNotLoggedIn
                ? '구글 소셜 로그인 후 진행 중인 챌린지에 참가하거나 사이트 구독 멤버십을 이용하시면 AI 키워드 분석, 포스팅 초안 작성, 카드뉴스 생성을 자유롭게 이용하실 수 있습니다.'
                : '현재 유효한 진행 챌린지 또는 유료 멤버십 구독권이 없습니다. 챌린지에 참가하거나 사이트 구독 플랜을 통해 AI 툴킷 권한을 즉시 활성화할 수 있습니다.'}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {isNotLoggedIn ? (
              <>
                {onOpenGoogleAuth && (
                  <button
                    type="button"
                    onClick={onOpenGoogleAuth}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-sm transition-all shadow-lg hover:shadow-indigo-500/25 cursor-pointer"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>구글 소셜 로그인하기</span>
                  </button>
                )}
                {onViewSubscription && (
                  <button
                    type="button"
                    onClick={onViewSubscription}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm transition-all shadow-lg hover:shadow-emerald-500/25 cursor-pointer"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>사이트 구독 플랜 보기</span>
                  </button>
                )}
                {onViewChallenges && (
                  <button
                    type="button"
                    onClick={onViewChallenges}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm border border-white/20 transition-all cursor-pointer backdrop-blur-md"
                  >
                    <Trophy className="w-4 h-4 text-amber-400" />
                    <span>챌린지 둘러보기</span>
                  </button>
                )}
              </>
            ) : (
              <>
                {onViewSubscription && (
                  <button
                    type="button"
                    onClick={onViewSubscription}
                    className="flex items-center gap-2 px-7 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm transition-all shadow-xl hover:shadow-emerald-500/20 cursor-pointer"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>사이트 구독 / 멤버십 플랜 보기</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
                {onViewChallenges && (
                  <button
                    type="button"
                    onClick={onViewChallenges}
                    className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm border border-white/20 transition-all cursor-pointer backdrop-blur-md"
                  >
                    <Trophy className="w-4 h-4 text-amber-400" />
                    <span>진행 중인 챌린지 둘러보기</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Notice Card for Ended Challenges */}
      {accessResult.userEnrolledEndedGroups.length > 0 && (
        <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 space-y-1">
            <p className="font-extrabold">
              이전에 참가하신 챌린지({accessResult.userEnrolledEndedGroups.map((g) => `'${g.name}'`).join(', ')})가 모두 종료되었습니다.
            </p>
            <p className="text-amber-800 font-medium">
              AI 툴킷은 현재 활발히 진행 중인 챌린지 기간 동안만 이용이 가능합니다. 새롭게 모집 중이거나 시작되는 챌린지에 참가 신청하시면 권한이 자동으로 재활성화됩니다.
            </p>
          </div>
        </div>
      )}

      {/* Feature Preview Grid (Non-interactive) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-extrabold text-slate-900">
              챌린지 참가 시 제공되는 AI 초안 생성기 기능
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-semibold">전용 혜택 제공</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Tool 1 */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-2.5 opacity-90 relative overflow-hidden">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
              <Search className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-extrabold text-slate-900">황금 키워드 기획안</h4>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                검색량 및 CPA 전환율이 높은 키워드와 SEO 본문 기획안 자동 발굴
              </p>
            </div>
          </div>

          {/* Tool 2 */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-2.5 opacity-90 relative overflow-hidden">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-extrabold text-slate-900">AI 포스팅 초안 작성</h4>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                후기형/정보형 블로그 포스팅 초안 및 스마트에디터 최적화 HTML
              </p>
            </div>
          </div>

          {/* Tool 3 */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-2.5 opacity-90 relative overflow-hidden">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <Image className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-extrabold text-slate-900">상업용 무료 이미지</h4>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                Unsplash 고화질 상업용 라이선스 무료 이미지 즉시 추천 및 삽입
              </p>
            </div>
          </div>

          {/* Tool 4 */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-2.5 opacity-90 relative overflow-hidden">
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center font-bold">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-extrabold text-slate-900">카드뉴스 오토 엔진</h4>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                SNS 및 블로그용 카드뉴스 슬라이드 생성 및 고화질 PNG 다운로드
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
