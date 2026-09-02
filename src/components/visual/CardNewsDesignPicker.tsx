import React, { useState } from 'react';
import { Palette, Check, Sparkles, LayoutTemplate, Eye, Layers, Image as ImageIcon } from 'lucide-react';
import { CardNewsTemplateId, CARD_NEWS_TEMPLATES, CardNewsContentCard } from './visualTypes';
import { CardNewsCardRenderer } from './CardNewsCardRenderer';

interface CardNewsDesignPickerProps {
  selectedTemplate: CardNewsTemplateId;
  onSelectTemplate: (templateId: CardNewsTemplateId) => void;
}

// Dedicated Sample Data for each of the 5 Design Systems
const SAMPLE_PREVIEW_CARDS: Record<
  CardNewsTemplateId,
  { cover: CardNewsContentCard; body: CardNewsContentCard }
> = {
  editorial: {
    cover: {
      id: 'prev_edit_cov',
      cardNumber: 1,
      cardRole: 'cover',
      layoutVariant: 'cover',
      title: '도쿄 미식 투어: 3일간의 시크릿 다이닝 가이드',
      subtitle: '현지 셰프가 추천하는 긴자 골목 숨은 노포 5선',
      body: '정통 매거진 그리드와 비대칭 타이포그래피로 신뢰감 있는 지면을 완성합니다.',
      emphasis: ['긴자맛집', '미식가이드'],
      sourceContext: '도쿄 여행 에디토리얼 기획',
      imageUrl:
        'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=600&q=80',
    },
    body: {
      id: 'prev_edit_body',
      cardNumber: 2,
      cardRole: 'key_point',
      layoutVariant: 'text_focus',
      title: '첫날 저녁, 긴자 6초메 오마카세 예약법',
      subtitle: 'CRITICAL ANALYSIS & RESERVATION',
      body: '예약 1개월 전 오픈되는 테이블링 시스템과 현장 대기 팁을 상세히 분석합니다.',
      emphasis: ['오마카세', '예약노하우'],
      sourceContext: '도쿄 여행 에디토리얼 기획',
    },
  },
  minimal: {
    cover: {
      id: 'prev_min_cov',
      cardNumber: 1,
      cardRole: 'cover',
      layoutVariant: 'cover',
      title: '여행용 액체류 100ml 반입 규정의 모든 것',
      subtitle: '기내 수하물 팩킹 시 필수 체크 3가지',
      body: '불필요한 요소를 걷어내고 가장 핵심적인 팩트만을 전달합니다.',
      emphasis: ['100ml이하', '지퍼백규격'],
      sourceContext: '공항 수하물 규정 가이드',
      imageUrl:
        'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=600&q=80',
    },
    body: {
      id: 'prev_min_body',
      cardNumber: 2,
      cardRole: 'key_point',
      layoutVariant: 'text_focus',
      title: '지퍼백 1개에 담아야 하는 필수 조건',
      subtitle: 'PACKING ESSENTIALS',
      body: '1인당 1L 투명 비닐 지퍼백 1개에 완전히 잠기도록 보관해야 보안검색대를 통과합니다.',
      emphasis: ['1L지퍼백', '밀봉필수'],
      sourceContext: '공항 수하물 규정 가이드',
    },
  },
  mood: {
    cover: {
      id: 'prev_mood_cov',
      cardNumber: 1,
      cardRole: 'cover',
      layoutVariant: 'cover',
      title: '조용한 쉼이 머무는 가을 북카페 5선',
      subtitle: '따뜻한 커피 향과 햇살이 머무는 도심 속 아지트',
      body: '따뜻한 자연광과 블러 글래스모피즘 오버레이로 감성적인 공감대를 만듭니다.',
      emphasis: ['감성북카페', '가을무드'],
      sourceContext: '가을 힐링 스팟 큐레이션',
      imageUrl:
        'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=600&q=80',
    },
    body: {
      id: 'prev_mood_body',
      cardNumber: 2,
      cardRole: 'key_point',
      layoutVariant: 'image_focus',
      title: '오후 햇살이 가장 예쁜 2층 창가 좌석',
      subtitle: 'WARM SUNLIGHT & COFFEE',
      body: '통유리창으로 들어오는 자연광과 클래식 음악이 어우러져 온전한 몰입을 선사합니다.',
      emphasis: ['햇살스팟', '감성공간'],
      sourceContext: '가을 힐링 스팟 큐레이션',
      imageUrl:
        'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=600&q=80',
    },
  },
  information: {
    cover: {
      id: 'prev_info_cov',
      cardNumber: 1,
      cardRole: 'cover',
      layoutVariant: 'cover',
      title: '2026 연말정산 핵심 체크리스트 7가지',
      subtitle: '환급액을 30만원 더 늘리는 세액공제 항목별 기준',
      body: '구조화된 정보 블록과 수치 중심의 시각화로 한눈에 핵심을 파악합니다.',
      emphasis: ['세액공제', '연말정산', '환급기준'],
      sourceContext: '2026 직장인 절세 가이드',
      imageUrl:
        'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80',
    },
    body: {
      id: 'prev_info_body',
      cardNumber: 2,
      cardRole: 'step',
      layoutVariant: 'number_focus',
      title: '신용카드 vs 체크카드 최적 황금 비율',
      subtitle: 'SPENDING STRATEGY',
      body: '총급여의 25%까지는 혜택 좋은 신용카드를, 초과분부터는 공제율 30%의 체크카드를 사용하세요.',
      emphasis: ['25%기준', '공제율30%'],
      sourceContext: '2026 직장인 절세 가이드',
    },
  },
  photo_story: {
    cover: {
      id: 'prev_photo_cov',
      cardNumber: 1,
      cardRole: 'cover',
      layoutVariant: 'cover',
      title: '제주 서쪽 노을이 가장 아름다운 해변 4선',
      subtitle: '황금빛 윤슬과 파도 소리가 가득한 해질녘 스팟',
      body: '카드의 100%를 차지하는 풀블리드 사진과 시네마틱 오버레이로 감동을 전합니다.',
      emphasis: ['제주일몰', '협재해변', '노을스팟'],
      sourceContext: '제주 여행 포토 저널',
      imageUrl:
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80',
    },
    body: {
      id: 'prev_photo_body',
      cardNumber: 2,
      cardRole: 'key_point',
      layoutVariant: 'image_focus',
      title: '일몰 30분 전 마주하는 협재 비양도 뷰',
      subtitle: 'SUNSET MOMENT',
      body: '에메랄드빛 바다가 주황빛으로 물드는 골든아워에 방문하면 인생 사진을 남길 수 있습니다.',
      emphasis: ['비양도노을', '골든아워'],
      sourceContext: '제주 여행 포토 저널',
      imageUrl:
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80',
    },
  },
  cute_pastel: {
    cover: {
      id: 'prev_cute_cov',
      cardNumber: 1,
      cardRole: 'cover',
      layoutVariant: 'cover',
      title: '놓치면 아쉬운 꿀팁 모음 5가지',
      subtitle: '초보자도 1분 만에 따라하는 알짜 정보',
      body: '파스텔 핑크와 민트 컬러, 둥근 말풍선과 귀여운 아이콘으로 친근하게 설명합니다.',
      emphasis: ['꿀팁모음', '초간단정보'],
      sourceContext: '생활 꿀팁 큐레이션',
      imageUrl:
        'https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&w=600&q=80',
    },
    body: {
      id: 'prev_cute_body',
      cardNumber: 2,
      cardRole: 'tip',
      layoutVariant: 'tip',
      title: '누구나 쉽게 시작하는 첫 번째 핵심 스텝',
      subtitle: 'PASTEL HIGHLIGHT & TIPS',
      body: '부드러운 크림색 배경과 귀여운 손그림 스타일 하이라이트로 핵심 포인트만 쏙쏙 짚어드립니다.',
      emphasis: ['첫번째스텝', '핵심포인트'],
      sourceContext: '생활 꿀팁 큐레이션',
      imageUrl:
        'https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&w=600&q=80',
    },
  },
};

export const CardNewsDesignPicker: React.FC<CardNewsDesignPickerProps> = ({
  selectedTemplate,
  onSelectTemplate,
}) => {
  const templates = Object.values(CARD_NEWS_TEMPLATES);
  const [previewTab, setPreviewTab] = useState<Record<CardNewsTemplateId, 'cover' | 'body'>>({
    editorial: 'cover',
    minimal: 'cover',
    mood: 'cover',
    information: 'cover',
    photo_story: 'cover',
    cute_pastel: 'cover',
  });

  const togglePreviewTab = (templateId: CardNewsTemplateId, tab: 'cover' | 'body', e: React.MouseEvent) => {
    e.stopPropagation();
    setPreviewTab((prev) => ({ ...prev, [templateId]: tab }));
  };

  return (
    <div className="space-y-4">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-1">
        <div>
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <LayoutTemplate className="w-4 h-4 text-purple-600" />
            <span>5대 디자인 시스템 선택 (5 Distinct Design Systems)</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            단순 컬러 변경이 아닌, 레이아웃·여백·타이포그래피·정보 구조가 완전히 다른 5종 디자인 언어를 제공합니다.
          </p>
        </div>
        <span className="text-[11px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-full shrink-0 self-start sm:self-auto">
          5종 프리미엄 시스템 지원
        </span>
      </div>

      {/* 5-Template Responsive Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {templates.map((tmpl) => {
          const isSelected = selectedTemplate === tmpl.id;
          const currentTab = previewTab[tmpl.id] || 'cover';
          const sampleCard =
            currentTab === 'cover'
              ? SAMPLE_PREVIEW_CARDS[tmpl.id].cover
              : SAMPLE_PREVIEW_CARDS[tmpl.id].body;

          return (
            <div
              key={tmpl.id}
              onClick={() => onSelectTemplate(tmpl.id)}
              className={`group relative rounded-3xl p-4 border-2 transition-all cursor-pointer flex flex-col justify-between text-left ${
                isSelected
                  ? 'bg-purple-50/70 border-purple-600 ring-4 ring-purple-100 shadow-xl scale-[1.01]'
                  : 'bg-white border-slate-200 hover:border-purple-300 hover:bg-slate-50/70 shadow-xs'
              }`}
            >
              {/* Selected Badge */}
              {isSelected && (
                <div className="absolute top-3 right-3 z-30 w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-md animate-in fade-in zoom-in duration-150">
                  <Check className="w-4 h-4 stroke-[3]" />
                </div>
              )}

              <div className="space-y-3">
                {/* Header Badge */}
                <div className="flex items-center gap-1.5">
                  <span
                    className="text-[10px] font-black px-2 py-0.5 rounded-full border shadow-2xs"
                    style={{
                      backgroundColor: tmpl.chipBg,
                      color: tmpl.chipText,
                      borderColor: tmpl.chipBorder,
                    }}
                  >
                    {tmpl.categoryBadge}
                  </span>
                </div>

                {/* Title & Tagline */}
                <div>
                  <h4 className="text-base font-black text-slate-900 group-hover:text-purple-700 transition-colors flex items-center gap-1">
                    <span>{tmpl.name}</span>
                    <span className="text-xs font-mono font-bold text-slate-400">
                      ({tmpl.englishName})
                    </span>
                  </h4>
                  <p className="text-[11px] font-medium text-slate-500 mt-0.5 line-clamp-1">
                    {tmpl.tagline}
                  </p>
                </div>

                {/* Preview Switch Tabs (Cover vs Body) */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Live Preview</span>
                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={(e) => togglePreviewTab(tmpl.id, 'cover', e)}
                      className={`px-1.5 py-0.5 rounded transition-all ${
                        currentTab === 'cover'
                          ? 'bg-white text-purple-700 shadow-xs font-black'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      표지
                    </button>
                    <button
                      type="button"
                      onClick={(e) => togglePreviewTab(tmpl.id, 'body', e)}
                      className={`px-1.5 py-0.5 rounded transition-all ${
                        currentTab === 'body'
                          ? 'bg-white text-purple-700 shadow-xs font-black'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      본문
                    </button>
                  </div>
                </div>

                {/* Visual Real Layout Engine Mini Mockup Card */}
                <div className="w-full aspect-square rounded-2xl overflow-hidden shadow-inner border border-slate-200 relative group-hover:scale-[1.02] transition-transform duration-200">
                  <CardNewsCardRenderer
                    card={sampleCard}
                    totalCards={6}
                    templateId={tmpl.id}
                    imageSourceMode="unsplash"
                    previewMode={true}
                  />
                </div>

                {/* Core Design Philosophy Description */}
                <p className="text-[11px] text-slate-600 leading-relaxed pt-0.5 line-clamp-3">
                  {tmpl.description}
                </p>
              </div>

              {/* Bottom Feature Specs */}
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-3 h-3 rounded-full border shadow-2xs shrink-0"
                    style={{ backgroundColor: tmpl.accentColor }}
                  />
                  <span className="text-[11px] font-bold text-slate-700">
                    {tmpl.id === 'editorial' && '비대칭 세리프'}
                    {tmpl.id === 'minimal' && '스위스 모던'}
                    {tmpl.id === 'mood' && '글래스 오버레이'}
                    {tmpl.id === 'information' && '데이터 인포그래픽'}
                    {tmpl.id === 'photo_story' && '100% 풀블리드'}
                  </span>
                </div>
                <span className="text-[10px] font-semibold text-purple-700">
                  {isSelected ? '선택됨' : '선택'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
