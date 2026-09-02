import React, { useState } from 'react';
import {
  Palette,
  ImageIcon,
  Layers,
  Sparkles,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Sliders,
} from 'lucide-react';
import { VisualDocumentSource, VisualSubTab } from './visualTypes';
import { VisualInputSourceSelector } from './VisualInputSourceSelector';
import { ImageMatchingStudio } from './ImageMatchingStudio';
import { CardNewsStudio } from './CardNewsStudio';

interface ContentVisualTabProps {
  currentUser: any;
  isAdminLoggedIn?: boolean;
  onShowToast: (msg: string) => void;
  onShowLoginModal?: () => void;
  initialSubTab?: VisualSubTab;
}

export const ContentVisualTab: React.FC<ContentVisualTabProps> = ({
  currentUser,
  isAdminLoggedIn = false,
  onShowToast,
  onShowLoginModal,
  initialSubTab = 'image_match',
}) => {
  const isAdmin = Boolean(isAdminLoggedIn) || currentUser?.role === 'admin' || Boolean((currentUser as any)?.is_admin);

  // Shared Visual Document State
  const [selectedDocument, setSelectedDocument] = useState<VisualDocumentSource | null>(null);

  // Active Visual Feature Tab: 'image_match' | 'card_news'
  const [activeFeatureTab, setActiveFeatureTab] = useState<VisualSubTab>(initialSubTab);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 text-slate-900 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2.5">
              <span>콘텐츠 비주얼 스튜디오</span>
              <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 text-xs font-bold shrink-0">
                Visual Studio
              </span>
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              블로그 글을 분석하여 본문 맞춤 이미지 매칭과 SNS 카드뉴스를 제작하는 독립적인 시각 콘텐츠 작업 공간입니다.
            </p>

            {/* Quick 2-Flow Feature Guide */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-slate-50/90 border border-slate-200/80 rounded-xl p-3 text-xs text-slate-700">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                  ①
                </span>
                <div>
                  <span className="font-bold text-slate-900">본문 이미지 매칭</span>
                  <p className="text-[11px] text-slate-500">
                    문맥을 분석하여 최적의 사진 위치 추천 및 상업용 고화질 이미지를 매칭합니다.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                  ②
                </span>
                <div>
                  <span className="font-bold text-slate-900">카드뉴스 제작</span>
                  <p className="text-[11px] text-slate-500">
                    핵심 메시지를 요약 추출하고 감각적인 디자인 템플릿의 카드뉴스로 변환합니다.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Unified Input Source Selector (AI 초안 불러오기 or 직접 본문 붙여넣기) */}
      <VisualInputSourceSelector
        currentDocument={selectedDocument}
        onSelectDocument={(doc) => {
          setSelectedDocument(doc);
        }}
        currentUser={currentUser}
        isAdmin={isAdmin}
        onShowToast={onShowToast}
      />

      {/* 3. Feature Tab Switcher Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Tab 1: 본문 이미지 매칭 */}
        <div
          onClick={() => setActiveFeatureTab('image_match')}
          className={`p-5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
            activeFeatureTab === 'image_match'
              ? 'bg-blue-50/90 border-blue-500 ring-2 ring-blue-400 shadow-md'
              : 'bg-white border-slate-200 hover:border-blue-200 hover:bg-slate-50/60 shadow-xs'
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-base transition-colors ${
                activeFeatureTab === 'image_match'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-blue-100 text-blue-700'
              }`}
            >
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-slate-900">① 본문 이미지 매칭</h3>
                {activeFeatureTab === 'image_match' && (
                  <span className="text-[10px] font-extrabold bg-blue-600 text-white px-2 py-0.5 rounded-full">
                    진행 중
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                문단별 사진 추천 위치 파악 · 검색 키워드 생성 · 본문 이미지 삽입
              </p>
            </div>
          </div>
        </div>

        {/* Tab 2: 카드뉴스 제작 */}
        <div
          onClick={() => setActiveFeatureTab('card_news')}
          className={`p-5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
            activeFeatureTab === 'card_news'
              ? 'bg-purple-50/90 border-purple-500 ring-2 ring-purple-400 shadow-md'
              : 'bg-white border-slate-200 hover:border-purple-200 hover:bg-slate-50/60 shadow-xs'
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-base transition-colors ${
                activeFeatureTab === 'card_news'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-purple-100 text-purple-700'
              }`}
            >
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-slate-900">② 카드뉴스 제작</h3>
                {activeFeatureTab === 'card_news' && (
                  <span className="text-[10px] font-extrabold bg-purple-600 text-white px-2 py-0.5 rounded-full">
                    진행 중
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                핵심 내용 요약 추출 · 슬라이드 문구 편집 · 5종 프리미엄 디자인 시스템 & 고화질 완성
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Active Feature Studio Workspace */}
      <div className="transition-all duration-200">
        {activeFeatureTab === 'image_match' ? (
          <ImageMatchingStudio
            document={selectedDocument}
            onShowToast={onShowToast}
            currentUser={currentUser}
            isAdmin={isAdmin}
          />
        ) : (
          <CardNewsStudio
            document={selectedDocument}
            onShowToast={onShowToast}
            currentUser={currentUser}
            isAdmin={isAdmin}
          />
        )}
      </div>
    </div>
  );
};
