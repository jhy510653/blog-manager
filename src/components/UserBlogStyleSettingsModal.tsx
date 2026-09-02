import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  RotateCcw, 
  Save, 
  Sparkles, 
  AlignLeft, 
  AlignCenter, 
  AlignJustify, 
  Check, 
  Eye,
  Sliders,
  Palette,
  LayoutTemplate
} from 'lucide-react';
import { 
  UserBlogStyle, 
  DEFAULT_USER_BLOG_STYLE, 
  BlogTextAlign, 
  EmphasisStyle 
} from '../types';
import { applyUserBlogStyle } from '../utils/blogFormatter';

interface UserBlogStyleSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStyle: UserBlogStyle;
  onSave: (style: UserBlogStyle) => Promise<boolean> | void;
  onReset: () => Promise<void> | void;
  isSaving?: boolean;
}

const EMPHASIS_COLOR_PRESETS = [
  { label: '시그니처 오렌지 (기본)', value: '#ff9300' },
  { label: '네이버 그린', value: '#03c75a' },
  { label: '로열 블루', value: '#2563eb' },
  { label: '로즈 레드', value: '#e11d48' },
  { label: '엠버 옐로우', value: '#d97706' },
  { label: '퍼플 바이올렛', value: '#8b5cf6' },
  { label: '완전 블랙', value: '#000000' },
];

const SAMPLE_HTML_DRAFT = `
<h2>1. 내 체감과 실사용 만족도</h2>
<p>처음 제품을 접했을 때는 과연 기존 제품들과 어떤 차이가 있을지 궁금했습니다. 2주 동안 매일 사용해 보니 손목에 전해지는 무게감이 적당하고 마감이 매우 정갈했습니다.</p>
<p>특히 <strong>배터리 효율과 소음 제어 능력</strong>에서 가장 큰 만족을 느꼈습니다. 실내뿐만 아니라 외부 이동 시에도 편리하게 휴대할 수 있었습니다.</p>
<h2>2. 핵심 장점과 권장 대상</h2>
<p>바쁜 직장인이나 일상에서 확실한 편의성을 원하는 분들에게 좋은 선택지가 될 수 있습니다. 직관적인 사용법 덕분에 별도의 적응 기간 없이 바로 활용할 수 있었습니다.</p>
`;

export const UserBlogStyleSettingsModal: React.FC<UserBlogStyleSettingsModalProps> = ({
  isOpen,
  onClose,
  currentStyle,
  onSave,
  onReset,
  isSaving = false,
}) => {
  const [style, setStyle] = useState<UserBlogStyle>(currentStyle || DEFAULT_USER_BLOG_STYLE);
  const [activeTab, setActiveTab] = useState<'layout' | 'headings' | 'readability'>('layout');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);

  useEffect(() => {
    if (currentStyle) {
      setStyle({ ...DEFAULT_USER_BLOG_STYLE, ...currentStyle, h2Style: 'standard' });
    }
  }, [currentStyle, isOpen]);

  // 실시간 미리보기 HTML 생성
  const previewHtml = useMemo(() => {
    return applyUserBlogStyle(SAMPLE_HTML_DRAFT, style);
  }, [style]);

  if (!isOpen) return null;

  const handleUpdate = <K extends keyof UserBlogStyle>(key: K, value: UserBlogStyle[K]) => {
    setStyle((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSaveClick = async () => {
    const res = onSave(style);
    if (res instanceof Promise) {
      await res;
    }
    setSaveSuccessMsg(true);
    setTimeout(() => {
      setSaveSuccessMsg(false);
      onClose();
    }, 800);
  };

  const handleResetClick = async () => {
    if (window.confirm('모든 출력 서식을 기본값(가운데 정렬, 표준 소제목, 기본 행간)으로 초기화하시겠습니까?')) {
      setStyle({ ...DEFAULT_USER_BLOG_STYLE, userId: style.userId });
      const res = onReset();
      if (res instanceof Promise) {
        await res;
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-4xl max-h-[92vh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-850">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                AI 초안 출력 서식 설정
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-medium">
                  자동 반영 시스템
                </span>
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                복잡한 폰트/인라인 스타일을 배제하고 네이버 블로그에 최적화된 표준 서식을 설정합니다.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 탭 네비게이션 */}
        <div className="flex border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 gap-2 pt-2">
          <button
            onClick={() => setActiveTab('layout')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'layout'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 dark:border-emerald-400'
                : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <AlignLeft className="w-4 h-4" />
            1. 본문 정렬 & 간격
          </button>
          <button
            onClick={() => setActiveTab('headings')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'headings'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 dark:border-emerald-400'
                : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <LayoutTemplate className="w-4 h-4" />
            2. 소제목 & 강조 서식
          </button>
          <button
            onClick={() => setActiveTab('readability')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'readability'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 dark:border-emerald-400'
                : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            3. 가독성 & 여백
          </button>
        </div>

        {/* 본체: 2단 레이아웃 (좌측 설정, 우측 실시간 미리보기) */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-gray-100 dark:divide-gray-800">
          {/* 좌측 설정 폼 (7 cols) */}
          <div className="lg:col-span-7 p-6 space-y-6 overflow-y-auto max-h-[58vh]">
            {activeTab === 'layout' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                {/* 본문 정렬 방식 */}
                <div>
                  <label className="block text-sm font-bold text-gray-800 dark:text-gray-200 mb-2">
                    기본 본문 정렬 (Alignment)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => handleUpdate('textAlign', 'center')}
                      className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-sm font-medium transition-all ${
                        style.textAlign === 'center'
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold'
                          : 'border-gray-200 dark:border-gray-750 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <AlignCenter className="w-4 h-4" />
                      가운데 정렬 (기본)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdate('textAlign', 'left')}
                      className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-sm font-medium transition-all ${
                        style.textAlign === 'left'
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold'
                          : 'border-gray-200 dark:border-gray-750 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <AlignLeft className="w-4 h-4" />
                      좌측 정렬
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdate('textAlign', 'justify')}
                      className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-sm font-medium transition-all ${
                        style.textAlign === 'justify'
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold'
                          : 'border-gray-200 dark:border-gray-750 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <AlignJustify className="w-4 h-4" />
                      양쪽 정렬
                    </button>
                  </div>
                </div>

                {/* 줄간격 및 문단 여백 */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                      줄간격 (Line Height)
                    </label>
                    <select
                      value={style.lineHeight}
                      onChange={(e) => handleUpdate('lineHeight', e.target.value as any)}
                      className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-750 bg-white dark:bg-gray-850 text-sm"
                    >
                      <option value="1.6">1.6 (타이트한 간격)</option>
                      <option value="1.8">1.8 (표준 권장)</option>
                      <option value="2.0">2.0 (여유로운 간격)</option>
                      <option value="2.2">2.2 (넓은 줄간격)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                      문단 간격 (Paragraph Spacing)
                    </label>
                    <select
                      value={style.paragraphSpacing}
                      onChange={(e) => handleUpdate('paragraphSpacing', e.target.value as any)}
                      className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-750 bg-white dark:bg-gray-850 text-sm"
                    >
                      <option value="10px">10px (컴팩트)</option>
                      <option value="14px">14px (보통)</option>
                      <option value="18px">18px (권장 표준)</option>
                      <option value="22px">22px (충분한 호흡)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'headings' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                {/* 표준 소제목 및 넘버링 안내 */}
                <div className="p-4 bg-gray-50 dark:bg-gray-850 rounded-xl border border-gray-200 dark:border-gray-750 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-gray-900 dark:text-white">
                        표준 소제목 (H2) 서식
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        네이버 스마트에디터 기본 서식과 완벽하게 호환되는 깔끔한 H2 소제목이 적용됩니다.
                      </div>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-semibold">
                      표준 소제목
                    </span>
                  </div>

                  <div className="pt-2 border-t border-gray-200/80 dark:border-gray-700">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={style.h2AutoNumbering}
                        onChange={(e) => handleUpdate('h2AutoNumbering', e.target.checked)}
                        className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                      />
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        소제목 앞 번호(1. 2. 3.) 자동 부여 활성화
                      </span>
                    </label>
                  </div>
                </div>

                {/* 본문 강조(Strong) 스타일 */}
                <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                  <label className="block text-sm font-bold text-gray-800 dark:text-gray-200 mb-2">
                    본문 핵심 문구 강조 스타일
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => handleUpdate('emphasisStyle', 'bold')}
                      className={`p-2.5 text-center rounded-xl border text-xs font-bold transition-all ${
                        style.emphasisStyle === 'bold'
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 ring-1 ring-emerald-500'
                          : 'border-gray-200 dark:border-gray-750 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      굵은 글씨만 (기본)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdate('emphasisStyle', 'bold_color')}
                      className={`p-2.5 text-center rounded-xl border text-xs font-bold transition-all ${
                        style.emphasisStyle === 'bold_color'
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 ring-1 ring-emerald-500'
                          : 'border-gray-200 dark:border-gray-750 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      볼드 + 포인트 컬러
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdate('emphasisStyle', 'highlight_bg')}
                      className={`p-2.5 text-center rounded-xl border text-xs font-bold transition-all ${
                        style.emphasisStyle === 'highlight_bg'
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 ring-1 ring-emerald-500'
                          : 'border-gray-200 dark:border-gray-750 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      형광펜 배경색 효과
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdate('emphasisStyle', 'color_only')}
                      className={`p-2.5 text-center rounded-xl border text-xs font-medium transition-all ${
                        style.emphasisStyle === 'color_only'
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 ring-1 ring-emerald-500'
                          : 'border-gray-200 dark:border-gray-750 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      포인트 컬러만
                    </button>
                  </div>

                  {style.emphasisStyle !== 'bold' && (
                    <div className="flex flex-wrap items-center gap-2 p-3 bg-gray-50 dark:bg-gray-850 rounded-xl border border-gray-200/80 dark:border-gray-750">
                      <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">강조 포인트 색상:</span>
                      {EMPHASIS_COLOR_PRESETS.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => handleUpdate('emphasisColor', c.value)}
                          className={`px-2.5 py-1 rounded-md text-xs border flex items-center gap-1.5 transition-all ${
                            style.emphasisColor === c.value
                              ? 'border-emerald-500 bg-white dark:bg-gray-750 font-bold shadow-sm'
                              : 'border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800'
                          }`}
                        >
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.value }} />
                          {c.label}
                        </button>
                      ))}
                      <div className="flex items-center gap-1.5 ml-auto">
                        <span className="text-xs text-gray-500">색상환 선택:</span>
                        <input
                          type="color"
                          value={style.emphasisColor?.startsWith('#') ? style.emphasisColor : '#ff9300'}
                          onChange={(e) => handleUpdate('emphasisColor', e.target.value)}
                          className="w-7 h-7 rounded border border-gray-300 dark:border-gray-600 cursor-pointer p-0"
                          title="강조 포인트 색상 자유 선택"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'readability' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-900/40 text-xs text-emerald-900 dark:text-emerald-200 space-y-1.5 leading-relaxed">
                  <div className="font-bold flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                    <Sparkles className="w-4 h-4" />
                    가독성 최적화 원칙
                  </div>
                  <div>
                    글이 너무 빽빽하게 뭉치지 않도록 적절한 문단 분리와 자연스러운 호흡을 유지하여 모바일과 PC 모두에서 편안하게 읽히도록 합니다.
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="flex items-start gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-750 bg-white dark:bg-gray-850 cursor-pointer hover:border-emerald-500/50 transition-all">
                    <input
                      type="checkbox"
                      checked={style.separateParagraphs}
                      onChange={(e) => handleUpdate('separateParagraphs', e.target.checked)}
                      className="w-5 h-5 mt-0.5 text-emerald-600 rounded focus:ring-emerald-500"
                    />
                    <div>
                      <div className="text-sm font-bold text-gray-900 dark:text-white">
                        문단 분리 및 자연스러운 여백 보장
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        문맥 전환 시 단락을 나누고 설정된 문단 여백({style.paragraphSpacing})을 적용합니다.
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* 우측 실시간 미리보기 패널 (5 cols) */}
          <div className="lg:col-span-5 p-6 bg-gray-50/70 dark:bg-gray-950 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-300">
                <Eye className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                스마트에디터 출력 미리보기
              </div>
              <span className="text-[11px] text-gray-400">
                {style.textAlign === 'center' ? '가운데 정렬' : style.textAlign === 'left' ? '좌측 정렬' : '양쪽 정렬'} · 표준 소제목
              </span>
            </div>

            {/* 에디터 캔버스 뷰 */}
            <div className="flex-1 bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-800 shadow-inner overflow-y-auto max-h-[50vh]">
              <div 
                className="prose prose-sm max-w-none text-gray-900 dark:text-gray-100"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>

            <div className="mt-3 text-[11px] text-gray-500 dark:text-gray-400 text-center">
              💡 복사 버튼 클릭 시 위 미리보기와 동일한 깔끔한 표준 HTML이 클립보드에 담깁니다.
            </div>
          </div>
        </div>

        {/* 푸터 버튼 */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-850">
          <button
            type="button"
            onClick={handleResetClick}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-lg hover:bg-gray-200/60 dark:hover:bg-gray-800 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            기본값으로 원복
          </button>

          <div className="flex items-center gap-3">
            {saveSuccessMsg && (
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 animate-in fade-in">
                <Check className="w-4 h-4" />
                저장 완료! 앞으로 모든 초안에 자동 적용됩니다.
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
            >
              닫기
            </button>
            <button
              type="button"
              onClick={handleSaveClick}
              disabled={isSaving}
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-xl shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSaving ? '저장 중...' : '서식 저장 & 즉시 적용'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
