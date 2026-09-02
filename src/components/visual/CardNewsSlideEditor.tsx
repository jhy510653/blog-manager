import React, { useState } from 'react';
import {
  Edit3,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Layers,
  Check,
  Type,
  FileText,
  Upload,
} from 'lucide-react';
import { CardNewsSlideData } from './visualTypes';

interface CardNewsSlideEditorProps {
  slides: CardNewsSlideData[];
  onChangeSlides: (slides: CardNewsSlideData[]) => void;
  activeSlideIndex: number;
  onSelectSlideIndex: (index: number) => void;
  onShowToast: (msg: string) => void;
}

export const CardNewsSlideEditor: React.FC<CardNewsSlideEditorProps> = ({
  slides,
  onChangeSlides,
  activeSlideIndex,
  onSelectSlideIndex,
  onShowToast,
}) => {
  const currentSlide = slides[activeSlideIndex] || slides[0];

  // Update specific field of active slide
  const handleUpdateCurrentField = (field: keyof CardNewsSlideData, value: any) => {
    const updated = slides.map((slide, idx) => {
      if (idx === activeSlideIndex) {
        return { ...slide, [field]: value };
      }
      return slide;
    });
    onChangeSlides(updated);
  };

  // Add new body point
  const handleAddBodyPoint = () => {
    if (!currentSlide) return;
    const points = [...(currentSlide.bodyPoints || []), '새로운 핵심 포인트 내용'];
    handleUpdateCurrentField('bodyPoints', points);
  };

  // Update specific body point
  const handleUpdateBodyPoint = (pointIdx: number, val: string) => {
    if (!currentSlide) return;
    const points = [...(currentSlide.bodyPoints || [])];
    points[pointIdx] = val;
    handleUpdateCurrentField('bodyPoints', points);
  };

  // Remove body point
  const handleRemoveBodyPoint = (pointIdx: number) => {
    if (!currentSlide) return;
    const points = currentSlide.bodyPoints.filter((_, idx) => idx !== pointIdx);
    handleUpdateCurrentField('bodyPoints', points);
  };

  // Add new slide
  const handleAddNewSlide = () => {
    const newSlide: CardNewsSlideData = {
      id: `slide_${Date.now()}`,
      slideNumber: slides.length + 1,
      cardType: 'body',
      title: '새로운 카드 타이틀',
      subtitle: '서브 설명 문구를 입력하세요',
      bodyPoints: ['핵심 요약 포인트 1', '핵심 요약 포인트 2'],
      highlightWord: '핵심 키워드',
    };
    const updated = [...slides, newSlide];
    onChangeSlides(updated);
    onSelectSlideIndex(updated.length - 1);
    onShowToast(`✓ 새로운 #${updated.length} 슬라이드가 추가되었습니다.`);
  };

  // Delete slide
  const handleDeleteSlide = (idxToDelete: number) => {
    if (slides.length <= 2) {
      onShowToast('⚠️ 카드뉴스는 최소 2장 이상이어야 합니다.');
      return;
    }
    const updated = slides
      .filter((_, idx) => idx !== idxToDelete)
      .map((s, idx) => ({ ...s, slideNumber: idx + 1 }));
    onChangeSlides(updated);
    onSelectSlideIndex(Math.max(0, idxToDelete - 1));
    onShowToast(`✓ 슬라이드가 삭제되었습니다.`);
  };

  return (
    <div className="space-y-4">
      {/* Slide Navigation Tabs */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          {slides.map((slide, idx) => {
            const isActive = idx === activeSlideIndex;
            return (
              <button
                key={slide.id || idx}
                type="button"
                onClick={() => onSelectSlideIndex(idx)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <span>#{idx + 1}</span>
                <span className="max-w-[70px] truncate">
                  {idx === 0 ? '표지' : idx === slides.length - 1 ? '엔딩' : slide.title || '본문'}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleAddNewSlide}
          className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-purple-50 text-slate-700 hover:text-purple-700 border border-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0 transition-colors"
          title="새 카드 추가"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>카드 추가</span>
        </button>
      </div>

      {/* Active Slide Form */}
      {currentSlide && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-800 flex items-center justify-center text-xs font-black">
                {activeSlideIndex + 1}
              </span>
              <div>
                <h4 className="text-xs font-extrabold text-slate-900">
                  {activeSlideIndex === 0
                    ? '메인 표지 카드 문구'
                    : activeSlideIndex === slides.length - 1
                    ? '클로징 / 요약 카드 문구'
                    : `본문 #${activeSlideIndex + 1} 카드 문구`}
                </h4>
                <p className="text-[11px] text-slate-500">
                  문구를 수정하면 카드 디자인에 실시간으로 반영됩니다.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleDeleteSlide(activeSlideIndex)}
                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                title="현재 카드 삭제"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Title */}
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>카드 헤드라인 제목</span>
                <span className="text-[10px] text-purple-600 font-semibold">간결하고 강력한 문장 권장</span>
              </label>
              <input
                type="text"
                value={currentSlide.title || ''}
                onChange={(e) => handleUpdateCurrentField('title', e.target.value)}
                placeholder="예: 2026 성수동 핫플 카페 핵심 요약"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Subtitle */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">서브 타이틀 / 부연 설명</label>
              <input
                type="text"
                value={currentSlide.subtitle || ''}
                onChange={(e) => handleUpdateCurrentField('subtitle', e.target.value)}
                placeholder="예: 직접 다녀온 솔직 후기와 꿀팁 정리"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Highlight Word */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">강조 키워드 / 뱃지 문구</label>
              <input
                type="text"
                value={currentSlide.highlightWord || ''}
                onChange={(e) => handleUpdateCurrentField('highlightWord', e.target.value)}
                placeholder="예: MUST VISIT, 체크포인트"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Body Bullet Points */}
            <div className="space-y-2 sm:col-span-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700">핵심 본문 요약 리스트</label>
                <button
                  type="button"
                  onClick={handleAddBodyPoint}
                  className="text-[11px] font-bold text-purple-600 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>포인트 추가</span>
                </button>
              </div>

              <div className="space-y-2">
                {(currentSlide.bodyPoints || []).map((pt, pIdx) => (
                  <div key={pIdx} className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                      {pIdx + 1}
                    </span>
                    <input
                      type="text"
                      value={pt}
                      onChange={(e) => handleUpdateBodyPoint(pIdx, e.target.value)}
                      placeholder={`핵심 포인트 내용 #${pIdx + 1}`}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-purple-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveBodyPoint(pIdx)}
                      className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer"
                      title="삭제"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA text if closing */}
            {activeSlideIndex === slides.length - 1 && (
              <div className="space-y-1 sm:col-span-2 pt-2 border-t border-slate-100">
                <label className="text-xs font-bold text-slate-700">
                  엔딩 CTA / 블로그 유도 문구
                </label>
                <input
                  type="text"
                  value={currentSlide.ctaText || ''}
                  onChange={(e) => handleUpdateCurrentField('ctaText', e.target.value)}
                  placeholder="예: 자세한 내용은 본문 블로그 글에서 확인하세요!"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-purple-900 focus:bg-white focus:outline-none focus:border-purple-500"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
