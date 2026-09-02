import React from 'react';
import { Image, UploadCloud, Globe, Check, Ban, Sparkles } from 'lucide-react';
import { CardNewsImageSourceMode } from './visualTypes';

interface CardNewsImageSourcePickerProps {
  selectedMode: CardNewsImageSourceMode;
  onSelectMode: (mode: CardNewsImageSourceMode) => void;
}

export const CardNewsImageSourcePicker: React.FC<CardNewsImageSourcePickerProps> = ({
  selectedMode,
  onSelectMode,
}) => {
  const sources: {
    id: CardNewsImageSourceMode;
    name: string;
    description: string;
    badge: string;
    subNote: string;
    icon: React.ComponentType<{ className?: string }>;
    accentColor: string;
  }[] = [
    {
      id: 'unsplash',
      name: 'Unsplash 사진 자동 매칭',
      description: '카드 문맥과 구체적 실물/상황을 분석하여 저작권 안전 상업용 무료 고화질 사진을 매칭합니다.',
      badge: '추천 · 상업용 무료',
      subNote: '1순위 실제 대상 → 2순위 핵심 행동 → 3순위 상황 기반 검색',
      icon: Globe,
      accentColor: 'text-blue-600 bg-blue-50 border-blue-200',
    },
    {
      id: 'user_upload',
      name: '내 이미지 사용 (직접 업로드)',
      description: '소장 중인 실제 제품/장소/캡처 사진을 카드별로 직접 첨부하여 사실성을 극대화합니다.',
      badge: '실제 촬영/소장 사진',
      subNote: '카드별 개별 업로드 및 교체/미리보기 지원',
      icon: UploadCloud,
      accentColor: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    },
    {
      id: 'ai',
      name: 'AI 맞춤 그래픽 생성',
      description: '각 카드의 핵심 개념과 상황에 맞춤형 AI 비주얼/일러스트를 즉시 생성합니다.',
      badge: '비용 최적화 · 요청 시 생성',
      subNote: '불필요한 API 호출 방지 (사용자가 원하는 카드만 생성)',
      icon: Sparkles,
      accentColor: 'text-amber-600 bg-amber-50 border-amber-200',
    },
    {
      id: 'no_image',
      name: '이미지 없이 제작 (텍스트/그래픽)',
      description: '사진 없이 정갈한 타이포그래피, 하이라이트 배지, 구조적 박스만으로 가독성 높은 카드뉴스를 만듭니다.',
      badge: '클린 타이포그래피',
      subNote: '정보 전달 및 핵심 요약 가이드에 최적',
      icon: Ban,
      accentColor: 'text-purple-600 bg-purple-50 border-purple-200',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-1">
        <div>
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <Image className="w-4 h-4 text-purple-600" />
            <span>카드뉴스 기본 이미지 소스 선택</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            카드뉴스에 적용할 기본 사진 소스 방식을 선택하세요. 아래 목록에서 개별 카드마다 다른 방식을 자유롭게 지정할 수도 있습니다.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {sources.map((src) => {
          const isSelected = selectedMode === src.id;
          const Icon = src.icon;

          return (
            <div
              key={src.id}
              onClick={() => onSelectMode(src.id)}
              className={`group relative rounded-3xl p-4.5 border-2 transition-all cursor-pointer text-left flex flex-col justify-between ${
                isSelected
                  ? 'bg-purple-50/80 border-purple-600 ring-4 ring-purple-100 shadow-lg scale-[1.01]'
                  : 'bg-white border-slate-200 hover:border-purple-300 hover:bg-slate-50/70 shadow-xs'
              }`}
            >
              {isSelected && (
                <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-md animate-in fade-in zoom-in duration-150">
                  <Check className="w-4 h-4 stroke-[3]" />
                </div>
              )}

              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className={`p-2.5 rounded-2xl border shadow-2xs ${src.accentColor}`}>
                    <Icon className="w-4.5 h-4.5" />
                  </div>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    {src.badge}
                  </span>
                </div>

                <div>
                  <h4 className="text-xs font-black text-slate-900 leading-snug">
                    {src.name}
                  </h4>
                  <p className="text-[11px] text-slate-600 mt-1.5 leading-relaxed">
                    {src.description}
                  </p>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-100">
                <p className="text-[10px] font-medium text-slate-500 line-clamp-2">
                  ✨ {src.subNote}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

