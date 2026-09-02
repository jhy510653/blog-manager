import React, { useState } from 'react';
import {
  LayoutList,
  RotateCcw,
  Save,
  CheckCircle2,
  AlertCircle,
  Monitor,
  Smartphone,
  Sparkles,
  HelpCircle,
  Tag,
  AlignLeft,
  SmartphoneNfc,
} from 'lucide-react';
import { NavigationTabItem, DEFAULT_NAVIGATION_TABS } from '../../config/navigation';
import { saveNavigationTabsToSupabase } from '../../lib/supabase';
import { MainTabType } from '../Header';

interface AdminNavigationTabProps {
  navTabsConfig: Record<MainTabType, NavigationTabItem>;
  onNavTabFieldChange: (tabId: MainTabType, field: keyof NavigationTabItem, value: string) => void;
  onResetNavTabs: () => void;
  onSaveNavTabs: () => Promise<void>;
  isSaving: boolean;
  feedback: { type: 'success' | 'error'; message: string } | null;
}

const TAB_ORDER: { id: MainTabType; defaultTitle: string; iconDesc: string }[] = [
  { id: 'dashboard', defaultTitle: '홈 대시보드', iconDesc: '🏠 홈 아이콘' },
  { id: 'challenges', defaultTitle: '챌린지 현황', iconDesc: '🏆 트로피 아이콘' },
  { id: 'trends', defaultTitle: '트렌드 키워드 수집', iconDesc: '🧭 나침반 아이콘' },
  { id: 'toolkit', defaultTitle: 'AI 초안 생성기', iconDesc: '✨ 반짝임 아이콘' },
  { id: 'revenue', defaultTitle: '수익 인증 명예의 전당', iconDesc: '🎖️ 메달 아이콘' },
  { id: 'members', defaultTitle: '가입 멤버', iconDesc: '👥 유저 아이콘' },
  { id: 'announcements', defaultTitle: '공지사항 & 자료실', iconDesc: '📢 확성기 아이콘' },
];

export const AdminNavigationTab: React.FC<AdminNavigationTabProps> = ({
  navTabsConfig,
  onNavTabFieldChange,
  onResetNavTabs,
  onSaveNavTabs,
  isSaving,
  feedback,
}) => {
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');

  return (
    <div className="space-y-6">
      {/* 1. Header Info Banner */}
      <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-2xl flex items-start justify-between gap-3 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl shrink-0 mt-0.5">
            <LayoutList className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-black text-emerald-950 flex items-center gap-1.5">
              <span>사이트 메뉴 탭 이름 및 뱃지 설정</span>
              <span className="text-[11px] font-bold px-2 py-0.5 bg-emerald-200 text-emerald-900 rounded-full">
                실시간 DB 연동
              </span>
            </h4>
            <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
              데스크톱 좌측 사이드바, 상단 헤더, 모바일 하단 탭바, 모바일 서랍 메뉴에 노출되는 명칭과 뱃지를 자유롭게 변경할 수 있습니다.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onResetNavTabs}
          className="px-3 py-1.5 bg-white hover:bg-emerald-100/70 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer shadow-2xs"
          title="기본값으로 되돌리기"
        >
          <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
          <span>기본값 초기화</span>
        </button>
      </div>

      {/* 2. Feedback Alert */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-bold flex items-center gap-2 animate-in fade-in ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* 3. Live Preview Section */}
      <div className="p-4 bg-slate-900 text-white rounded-2xl border border-slate-800 shadow-md">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold tracking-wide text-slate-200">실시간 반영 미리보기</span>
          </div>
          <div className="flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700">
            <button
              type="button"
              onClick={() => setPreviewDevice('desktop')}
              className={`px-2.5 py-1 text-xs font-bold rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                previewDevice === 'desktop' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>데스크톱 사이드바</span>
            </button>
            <button
              type="button"
              onClick={() => setPreviewDevice('mobile')}
              className={`px-2.5 py-1 text-xs font-bold rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                previewDevice === 'mobile' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>모바일 하단바</span>
            </button>
          </div>
        </div>

        {/* Preview Content */}
        <div className="pt-3">
          {previewDevice === 'desktop' ? (
            <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/60 flex flex-wrap gap-2">
              {TAB_ORDER.map((item) => {
                const conf = navTabsConfig[item.id] || DEFAULT_NAVIGATION_TABS[item.id];
                return (
                  <div
                    key={`prev_desk_${item.id}`}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-700/80 rounded-xl border border-slate-600 text-xs font-bold text-slate-200"
                  >
                    <span>{item.iconDesc.split(' ')[0]}</span>
                    <span>{conf?.label || item.defaultTitle}</span>
                    {conf?.badge && (
                      <span className="text-[10px] px-1.5 py-0.2 bg-rose-500/20 text-rose-300 border border-rose-400/30 rounded-full font-black">
                        {conf.badge}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-slate-800/80 rounded-xl p-2 border border-slate-700/60">
              <div className="grid grid-cols-5 gap-1 bg-white text-slate-800 rounded-lg p-2 shadow-inner">
                {TAB_ORDER.slice(0, 5).map((item) => {
                  const conf = navTabsConfig[item.id] || DEFAULT_NAVIGATION_TABS[item.id];
                  return (
                    <div
                      key={`prev_mob_${item.id}`}
                      className="flex flex-col items-center justify-center py-1 text-center"
                    >
                      <span className="text-base">{item.iconDesc.split(' ')[0]}</span>
                      <span className="text-[10px] font-bold text-slate-800 truncate max-w-[60px] mt-0.5">
                        {conf?.shortLabel || conf?.label || item.defaultTitle}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. Menu Tabs Edit Cards */}
      <div className="space-y-4">
        <h5 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 px-1">
          <AlignLeft className="w-3.5 h-3.5 text-slate-400" />
          <span>각 메뉴별 명칭 및 뱃지 수정</span>
        </h5>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {TAB_ORDER.map((item) => {
            const conf = navTabsConfig[item.id] || DEFAULT_NAVIGATION_TABS[item.id];
            return (
              <div
                key={item.id}
                className="p-4 bg-slate-50/90 hover:bg-slate-50 border border-slate-200/90 rounded-2xl transition-all shadow-2xs space-y-3"
              >
                {/* Card Title Header */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{item.iconDesc.split(' ')[0]}</span>
                    <div>
                      <span className="text-xs font-extrabold text-slate-900">{item.defaultTitle}</span>
                      <span className="text-[10px] text-slate-400 font-mono ml-1.5">({item.id})</span>
                    </div>
                  </div>
                  {conf?.badge && (
                    <span className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full font-bold">
                      뱃지: {conf.badge}
                    </span>
                  )}
                </div>

                {/* Input Fields */}
                <div className="space-y-2.5">
                  {/* 데스크톱 / 헤더 메인 표시명 */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 flex items-center justify-between mb-1">
                      <span className="flex items-center gap-1">
                        <Monitor className="w-3 h-3 text-slate-400" />
                        <span>메인 표시명 (데스크톱/헤더)</span>
                      </span>
                      <span className="text-[10px] text-slate-400">기본: {item.defaultTitle}</span>
                    </label>
                    <input
                      type="text"
                      value={conf?.label || ''}
                      onChange={(e) => onNavTabFieldChange(item.id, 'label', e.target.value)}
                      placeholder={item.defaultTitle}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>

                  {/* 모바일 하단바 짧은 이름 & 뱃지 문구 */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1 mb-1">
                        <Smartphone className="w-3 h-3 text-slate-400" />
                        <span>모바일 하단명</span>
                      </label>
                      <input
                        type="text"
                        value={conf?.shortLabel || ''}
                        onChange={(e) => onNavTabFieldChange(item.id, 'shortLabel', e.target.value)}
                        placeholder={conf?.label || item.defaultTitle}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1 mb-1">
                        <Tag className="w-3 h-3 text-slate-400" />
                        <span>우측 뱃지 (선택)</span>
                      </label>
                      <input
                        type="text"
                        value={conf?.badge || ''}
                        onChange={(e) => onNavTabFieldChange(item.id, 'badge', e.target.value)}
                        placeholder="예: HOT, NEW, AI, TOP"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  {/* 메뉴 설명 문구 */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 flex items-center gap-1 mb-1">
                      <HelpCircle className="w-3 h-3 text-slate-400" />
                      <span>메뉴 용도 / 설명</span>
                    </label>
                    <input
                      type="text"
                      value={conf?.description || ''}
                      onChange={(e) => onNavTabFieldChange(item.id, 'description', e.target.value)}
                      placeholder="메뉴 설명 입력"
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[11px] text-slate-600 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Bottom Save Action Bar */}
      <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          💡 저장을 누르면 Supabase <code className="bg-slate-100 text-slate-700 px-1 py-0.5 rounded font-mono text-[11px]">app_settings</code> 테이블과 로컬에 즉시 동기화됩니다.
        </p>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={onResetNavTabs}
            disabled={isSaving}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            초기화
          </button>

          <button
            type="button"
            onClick={onSaveNavTabs}
            disabled={isSaving}
            className="flex-1 sm:flex-none px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Save className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
            <span>{isSaving ? '저장 중...' : '변경사항 저장하기'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
