import React, { useState, useRef } from 'react';
import {
  Image,
  Sparkles,
  Layers,
  Upload,
  Search,
  RotateCcw,
  Plus,
  Check,
  AlertTriangle,
  Info,
  Download,
  Eye,
  CheckCircle2,
  HelpCircle,
  Camera,
  Paintbrush,
  Palette,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import {
  IMAGE_STYLES,
  ImageAspectRatio,
  isAiImageAllowedForContentType,
  buildImagePrompt,
} from '../../config/imageStyles';
import {
  CardNewsTemplateId,
  CARD_NEWS_TEMPLATES,
  CardNewsContentCard,
} from './visualTypes';
import { CardNewsCardRenderer } from './CardNewsCardRenderer';

export type ImageAdditionTab = 'unsplash' | 'ai_generate' | 'card_news' | 'upload';

export interface BlogImageAdditionSectionProps {
  itemId: string;
  keyword: string;
  title?: string;
  contentType?: string; // "정보 탐색형" | "경험 리뷰형" | "구매 추천형" | "비교 분석형"
  writingStyle?: string;
  draftContent: string;
  onInsertImageIntoDraft: (itemId: string, imageHtml: string) => void;
}

export const BlogImageAdditionSection: React.FC<BlogImageAdditionSectionProps> = ({
  itemId,
  keyword,
  title = '',
  contentType = '정보 탐색형',
  writingStyle = '',
  draftContent,
  onInsertImageIntoDraft,
}) => {
  const [activeTab, setActiveTab] = useState<ImageAdditionTab>('unsplash');
  const [isOpen, setIsOpen] = useState<boolean>(true);

  // ---------------------------------------------------------------------------
  // 1. Unsplash Free Image Search State
  // ---------------------------------------------------------------------------
  const [unsplashQuery, setUnsplashQuery] = useState<string>(keyword || title || '');
  const [isSearchingUnsplash, setIsSearchingUnsplash] = useState<boolean>(false);
  const [unsplashResults, setUnsplashResults] = useState<any[]>([]);
  const [hasSearchedUnsplash, setHasSearchedUnsplash] = useState<boolean>(false);
  const [selectedUnsplashImage, setSelectedUnsplashImage] = useState<any | null>(null);
  const [unsplashCaption, setUnsplashCaption] = useState<string>('');

  // ---------------------------------------------------------------------------
  // 2. AI Image Generation State
  // ---------------------------------------------------------------------------
  const [aiStyle, setAiStyle] = useState<'photoreal' | 'fairytale'>('photoreal');
  const [aiAspectRatio, setAiAspectRatio] = useState<ImageAspectRatio>('16:9');
  const [aiTopic, setAiTopic] = useState<string>(keyword || title || '자연스러운 블로그 주제 장면');
  const [isGeneratingAiImage, setIsGeneratingAiImage] = useState<boolean>(false);
  const [generatedAiImage, setGeneratedAiImage] = useState<string | null>(null);
  const [aiErrorMessage, setAiErrorMessage] = useState<string | null>(null);
  const [showAiWatermark, setShowAiWatermark] = useState<boolean>(true);
  const [aiCaption, setAiCaption] = useState<string>('');

  // ---------------------------------------------------------------------------
  // 3. Card News State
  // ---------------------------------------------------------------------------
  const [cardTemplate, setCardTemplate] = useState<CardNewsTemplateId>('cute_pastel');
  const [isGeneratingCardNews, setIsGeneratingCardNews] = useState<boolean>(false);
  const [cardNewsCards, setCardNewsCards] = useState<CardNewsContentCard[]>([]);
  const [activeCardIndex, setActiveCardIndex] = useState<number>(0);
  const [cardNewsError, setCardNewsError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // 4. User Upload State
  // ---------------------------------------------------------------------------
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [uploadCaption, setUploadCaption] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if AI Image Generation is allowed based on Content Type
  const isAiAllowed = isAiImageAllowedForContentType(contentType || writingStyle);

  // ---------------------------------------------------------------------------
  // Search Unsplash Handler
  // ---------------------------------------------------------------------------
  const handleSearchUnsplash = async (searchQueryToUse?: string) => {
    const q = (searchQueryToUse || unsplashQuery || keyword || title).trim();
    if (!q) return;

    setIsSearchingUnsplash(true);
    setHasSearchedUnsplash(true);
    setSelectedUnsplashImage(null);

    try {
      const response = await fetch(`/api/unsplash/search?query=${encodeURIComponent(q)}&per_page=12`);
      const data = await response.json();

      if (data && data.success && Array.isArray(data.photos)) {
        setUnsplashResults(data.photos);
      } else if (Array.isArray(data.results)) {
        setUnsplashResults(data.results);
      } else {
        setUnsplashResults([]);
      }
    } catch (err) {
      console.error('[Unsplash Search Error]:', err);
      setUnsplashResults([]);
    } finally {
      setIsSearchingUnsplash(false);
    }
  };

  // ---------------------------------------------------------------------------
  // AI Image Generation Handler (Single Image per Request)
  // ---------------------------------------------------------------------------
  const handleGenerateAiImage = async () => {
    if (!isAiAllowed) {
      setAiErrorMessage('실제 방문/사용 경험을 보여주는 콘텐츠라면 직접 촬영한 사진을 사용하는 것을 권장합니다.');
      return;
    }

    setIsGeneratingAiImage(true);
    setAiErrorMessage(null);

    try {
      const response = await fetch('/api/ai/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: aiTopic || keyword || title,
          style: aiStyle,
          aspectRatio: aiAspectRatio,
          contentType,
        }),
      });

      const data = await response.json();

      // Check success and ensure image data exists
      if (response.ok && data.success && data.imageUrl && typeof data.imageUrl === 'string' && data.imageUrl.length > 50) {
        setGeneratedAiImage(data.imageUrl);
        setAiErrorMessage(null);
      } else {
        setGeneratedAiImage(null);
        setAiErrorMessage(data.message || '이미지 생성에 실패했습니다. 직접 이미지를 업로드하거나 다시 시도해주세요.');
      }
    } catch (err: any) {
      console.error('[AI Image Generation Error]:', err);
      setGeneratedAiImage(null);
      setAiErrorMessage('이미지 생성에 실패했습니다. 직접 이미지를 업로드하거나 다시 시도해주세요.');
    } finally {
      setIsGeneratingAiImage(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Card News Generation Handler
  // ---------------------------------------------------------------------------
  const handleGenerateCardNews = async () => {
    if (!draftContent && !title && !keyword) return;

    setIsGeneratingCardNews(true);
    setCardNewsError(null);

    try {
      const response = await fetch('/api/gemini/toolkit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'card_news_auto_script',
          draftContent: draftContent || `${title}\n${keyword}`,
          cardCount: 5,
          style: cardTemplate === 'cute_pastel' ? 'review' : 'info',
        }),
      });

      const data = await response.json();
      if (response.ok && data.success && Array.isArray(data.cards) && data.cards.length > 0) {
        setCardNewsCards(data.cards);
        setActiveCardIndex(0);
      } else if (data.data?.cards && Array.isArray(data.data.cards)) {
        setCardNewsCards(data.data.cards);
        setActiveCardIndex(0);
      } else {
        setCardNewsError('카드뉴스 스크립트를 생성하지 못했습니다. 다시 시도해주세요.');
      }
    } catch (err: any) {
      console.error('[Card News Generation Error]:', err);
      setCardNewsError('카드뉴스 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGeneratingCardNews(false);
    }
  };

  // ---------------------------------------------------------------------------
  // File Upload Handler
  // ---------------------------------------------------------------------------
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('이미지 파일(PNG, JPG, WEBP 등)만 업로드할 수 있습니다.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const result = uploadEvent.target?.result as string;
      if (result) {
        setUploadedImageUrl(result);
      }
    };
    reader.readAsDataURL(file);
  };

  // ---------------------------------------------------------------------------
  // Insert Image into Draft Handlers
  // ---------------------------------------------------------------------------
  const handleInsertUnsplashImage = () => {
    if (!selectedUnsplashImage) return;
    const imgUrl = selectedUnsplashImage.urls?.regular || selectedUnsplashImage.urls?.small || selectedUnsplashImage.url;
    const photographer = selectedUnsplashImage.user?.name || 'Unsplash';
    const cap = unsplashCaption.trim() || `${photographer} via Unsplash`;

    const html = `
<div class="blog-image-wrapper" style="margin: 28px 0; text-align: center;">
  <img src="${imgUrl}" alt="${cap}" style="max-width: 100%; height: auto; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); display: block; margin: 0 auto;" />
  <p style="margin-top: 8px; font-size: 12px; color: #64748b; font-style: italic;">📷 ${cap}</p>
</div>
`;
    onInsertImageIntoDraft(itemId, html);
  };

  const handleInsertAiImage = () => {
    if (!generatedAiImage) return;
    const cap = aiCaption.trim() || (aiStyle === 'fairytale' ? '동화 감성 일러스트' : '실사 스타일 이미지');
    const watermarkBadge = showAiWatermark
      ? `<span style="position: absolute; bottom: 10px; right: 10px; background: rgba(15, 23, 42, 0.75); color: #f8fafc; font-size: 10.5px; font-weight: bold; padding: 3px 8px; border-radius: 6px; backdrop-filter: blur(4px);">AI 생성 이미지</span>`
      : '';

    const html = `
<div class="blog-image-wrapper" style="margin: 28px 0; text-align: center; position: relative; display: inline-block; width: 100%;">
  <div style="position: relative; display: inline-block; max-width: 100%;">
    <img src="${generatedAiImage}" alt="${cap}" style="max-width: 100%; height: auto; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); display: block; margin: 0 auto;" />
    ${watermarkBadge}
  </div>
  <p style="margin-top: 8px; font-size: 12px; color: #64748b; font-style: italic;">✨ ${cap}</p>
</div>
`;
    onInsertImageIntoDraft(itemId, html);
  };

  const handleInsertUploadedImage = () => {
    if (!uploadedImageUrl) return;
    const cap = uploadCaption.trim() || '직접 촬영한 사진';

    const html = `
<div class="blog-image-wrapper" style="margin: 28px 0; text-align: center;">
  <img src="${uploadedImageUrl}" alt="${cap}" style="max-width: 100%; height: auto; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); display: block; margin: 0 auto;" />
  <p style="margin-top: 8px; font-size: 12px; color: #64748b; font-style: italic;">📸 ${cap}</p>
</div>
`;
    onInsertImageIntoDraft(itemId, html);
  };

  return (
    <div className="bg-slate-50/80 rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden transition-all duration-200">
      {/* Header Bar */}
      <div className="px-5 py-3.5 bg-white border-b border-slate-200/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-100/80 border border-blue-200 flex items-center justify-center text-blue-700 shadow-2xs">
            <Image className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <span>이미지 추가 / 생성 스튜디오</span>
              <span className="text-[11px] font-normal text-slate-400">· 독립 실행 모드</span>
            </h3>
            <p className="text-[11px] text-slate-500">
              초안 본문과 분리된 독립 단계에서 원하는 이미지를 자유롭게 추가하고 배치하세요.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          {isOpen ? '영역 접기' : '이미지 추가 열기'}
        </button>
      </div>

      {isOpen && (
        <div className="p-5 space-y-5">
          {/* 4 Mode Tab Navigation */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-200/60 p-1.5 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('unsplash')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'unsplash'
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>무료 이미지 검색</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ai_generate')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'ai_generate'
                  ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span>AI 이미지 생성</span>
              {!isAiAllowed && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="경험 리뷰형 권장 안내" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('card_news')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'card_news'
                  ? 'bg-white text-pink-700 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-pink-500" />
              <span>카드뉴스 생성</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'upload'
                  ? 'bg-white text-emerald-700 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Upload className="w-3.5 h-3.5 text-emerald-500" />
              <span>내 이미지 업로드</span>
            </button>
          </div>

          {/* ================================================================= */}
          {/* 1. FREE IMAGE SEARCH (UNSPLASH) */}
          {/* ================================================================= */}
          {activeTab === 'unsplash' && (
            <div className="space-y-4 bg-white p-5 rounded-xl border border-slate-200/80 shadow-2xs">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={unsplashQuery}
                    onChange={(e) => setUnsplashQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchUnsplash()}
                    placeholder="검색어를 입력하세요 (예: 제주도 해변, 커피 원두, 노트북 작업)"
                    className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 font-medium placeholder:text-slate-400"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleSearchUnsplash()}
                  disabled={isSearchingUnsplash}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs shrink-0"
                >
                  {isSearchingUnsplash ? (
                    <>
                      <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                      <span>검색 중...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-3.5 h-3.5" />
                      <span>무료 이미지 검색</span>
                    </>
                  )}
                </button>
              </div>

              {/* Keyword Quick Tags */}
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                <span className="font-semibold text-slate-600">추천 검색어:</span>
                {[keyword, title, '자연 풍경', '감성 라이프스타일', '비즈니스 오피스']
                  .filter(Boolean)
                  .map((tag, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setUnsplashQuery(tag as string);
                        handleSearchUnsplash(tag as string);
                      }}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 rounded-lg border border-slate-200/80 transition-colors cursor-pointer"
                    >
                      #{tag}
                    </button>
                  ))}
              </div>

              {/* Search Results Area */}
              {isSearchingUnsplash && (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <RotateCcw className="w-6 h-6 animate-spin mx-auto text-blue-500" />
                  <p className="text-xs font-medium text-slate-600">고화질 무료 사진을 검색하고 있습니다...</p>
                </div>
              )}

              {/* Zero Results Handling */}
              {!isSearchingUnsplash && hasSearchedUnsplash && unsplashResults.length === 0 && (
                <div className="py-8 px-6 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-center space-y-3">
                  <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
                    <Info className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-800">적합한 무료 이미지를 찾지 못했습니다.</p>
                    <p className="text-xs text-slate-500">
                      다른 검색어로 다시 시도하거나, AI로 원하는 장면에 맞춘 이미지를 직접 생성해보세요.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('ai_generate');
                        setAiTopic(unsplashQuery || keyword || title);
                      }}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>AI 이미지 생성으로 이동</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('upload')}
                      className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5 text-slate-500" />
                      <span>직접 사진 업로드</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Gallery Grid */}
              {!isSearchingUnsplash && unsplashResults.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">
                      검색 결과 ({unsplashResults.length}개) · 마음에 드는 사진을 클릭하세요
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-80 overflow-y-auto p-1">
                    {unsplashResults.map((photo, pIdx) => {
                      const imgUrl = photo.urls?.small || photo.urls?.regular || photo.url;
                      const isSelected = selectedUnsplashImage?.id === photo.id;
                      return (
                        <div
                          key={photo.id || pIdx}
                          onClick={() => setSelectedUnsplashImage(photo)}
                          className={`group relative aspect-4/3 rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                            isSelected
                              ? 'border-blue-600 ring-2 ring-blue-500/30 scale-[0.98]'
                              : 'border-slate-200 hover:border-slate-400'
                          }`}
                        >
                          <img
                            src={imgUrl}
                            alt={photo.alt_description || 'Unsplash image'}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            crossOrigin="anonymous"
                          />
                          {isSelected && (
                            <div className="absolute inset-0 bg-blue-600/30 flex items-center justify-center">
                              <span className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-md">
                                <Check className="w-4 h-4" />
                              </span>
                            </div>
                          )}
                          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 text-[10px] text-white truncate">
                            {photo.user?.name || 'Unsplash'}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Selected Unsplash Image Actions */}
                  {selectedUnsplashImage && (
                    <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-200/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={selectedUnsplashImage.urls?.thumb || selectedUnsplashImage.urls?.small}
                          alt="Selected"
                          className="w-12 h-12 rounded-lg object-cover border border-blue-200 shrink-0"
                        />
                        <div className="space-y-1 flex-1">
                          <p className="text-xs font-bold text-slate-900">선택된 사진이 준비되었습니다.</p>
                          <input
                            type="text"
                            value={unsplashCaption}
                            onChange={(e) => setUnsplashCaption(e.target.value)}
                            placeholder="이미지 캡션 입력 (생략 가능)"
                            className="w-full text-xs px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-900"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleInsertUnsplashImage}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>본문에 바로 삽입</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* 2. AI IMAGE GENERATION */}
          {/* ================================================================= */}
          {activeTab === 'ai_generate' && (
            <div className="space-y-5 bg-white p-5 rounded-xl border border-slate-200/80 shadow-2xs">
              {/* If "경험 리뷰형", hide AI generator and show recommendation banner */}
              {!isAiAllowed ? (
                <div className="p-6 bg-amber-50/90 rounded-xl border border-amber-200 text-amber-950 space-y-4">
                  <div className="flex items-start gap-3">
                    <ShieldAlert className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1.5">
                      <h4 className="text-sm font-bold text-amber-900">
                        경험 리뷰형 콘텐츠 이미지 가이드
                      </h4>
                      <p className="text-xs leading-relaxed text-amber-800">
                        실제 방문/사용 경험을 보여주는 콘텐츠라면 직접 촬영한 사진을 사용하는 것을 권장합니다.
                        방문 후기 및 영수증 인증 리뷰에 AI 생성 이미지를 사용하면 블로그 검색 신뢰도에 영향을 줄 수 있습니다.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-amber-200/80">
                    <button
                      type="button"
                      onClick={() => setActiveTab('upload')}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>직접 촬영한 사진 업로드하기</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('unsplash')}
                      className="px-4 py-2 bg-white hover:bg-slate-100 text-amber-900 text-xs font-bold rounded-xl border border-amber-300 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Search className="w-3.5 h-3.5 text-amber-700" />
                      <span>무료 이미지 검색 활용하기</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Style Selector */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Palette className="w-3.5 h-3.5 text-indigo-600" />
                      <span>AI 이미지 스타일 선택</span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Photoreal */}
                      <div
                        onClick={() => setAiStyle('photoreal')}
                        className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                          aiStyle === 'photoreal'
                            ? 'border-indigo-600 bg-indigo-50/50 shadow-xs'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                            <Camera className="w-3.5 h-3.5 text-indigo-600" />
                            <span>실사 스타일 (Photoreal)</span>
                          </span>
                          <span className="text-[10.5px] px-2 py-0.5 bg-indigo-100 text-indigo-700 font-bold rounded-full">
                            자연광 촬영
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          스마트폰 카메라로 자연광에서 직접 촬영한 듯한 과보정 없는 자연스러운 사진
                        </p>
                      </div>

                      {/* Fairytale */}
                      <div
                        onClick={() => setAiStyle('fairytale')}
                        className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                          aiStyle === 'fairytale'
                            ? 'border-indigo-600 bg-indigo-50/50 shadow-xs'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                            <Paintbrush className="w-3.5 h-3.5 text-pink-600" />
                            <span>동화 일러스트 (Fairytale)</span>
                          </span>
                          <span className="text-[10.5px] px-2 py-0.5 bg-pink-100 text-pink-700 font-bold rounded-full">
                            따뜻한 수채화
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          따뜻한 그림책 느낌의 수채화 & 구아슈 질감과 서정적인 자연 감성
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Aspect Ratio Selector */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                      <span>이미지 비율 선택</span>
                      <span className="text-[11px] font-normal text-slate-500">
                        {aiAspectRatio === '16:9' && '와이드 가로형 (대표 썸네일/본문 헤더)'}
                        {aiAspectRatio === '1:1' && '정사각형 (인스타그램/네이버 피드)'}
                        {aiAspectRatio === '3:4' && '세로형 포트레이트 (스마트폰 최적화)'}
                        {aiAspectRatio === '4:5' && 'SNS 세로형 카드'}
                        {aiAspectRatio === '9:16' && '풀화면 세로형 (숏폼/스토리)'}
                      </span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {(['16:9', '1:1', '3:4', '4:5', '9:16'] as ImageAspectRatio[]).map((ratio) => (
                        <button
                          key={ratio}
                          type="button"
                          onClick={() => setAiAspectRatio(ratio)}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                            aiAspectRatio === ratio
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {ratio}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Topic / Scene Prompt Input */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                      <span>이미지 상세 설명 (프롬프트 주제)</span>
                      <span className="text-[11px] font-normal text-slate-400">
                        * 선택한 스타일 템플릿과 비율이 자동 결합됩니다
                      </span>
                    </label>
                    <textarea
                      rows={2}
                      value={aiTopic}
                      onChange={(e) => setAiTopic(e.target.value)}
                      placeholder="생성할 장면을 묘사하세요 (예: 밝은 거실 창가에서 따뜻한 김이 피어오르는 커피 잔과 책)"
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-medium"
                    />
                  </div>

                  {/* Single Generate Button */}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleGenerateAiImage}
                      disabled={isGeneratingAiImage}
                      className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      {isGeneratingAiImage ? (
                        <>
                          <RotateCcw className="w-4 h-4 animate-spin" />
                          <span>AI 이미지를 생성하고 있습니다 (1장 생성)...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>AI 이미지 생성하기 (단일 1장)</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Error Notification */}
                  {aiErrorMessage && (
                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="font-bold">이미지 생성 오류 안내</p>
                        <p>{aiErrorMessage}</p>
                      </div>
                    </div>
                  )}

                  {/* Generated Image Result Preview */}
                  {generatedAiImage && (
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>생성 완료된 AI 이미지 미리보기</span>
                        </span>

                        {/* Watermark Toggle */}
                        <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={showAiWatermark}
                            onChange={(e) => setShowAiWatermark(e.target.checked)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                          />
                          <span>AI 생성 이미지 워터마크 표시</span>
                        </label>
                      </div>

                      {/* Image Frame with UI Watermark Overlay Layer */}
                      <div className="relative mx-auto rounded-xl overflow-hidden border border-slate-300/80 bg-slate-900 shadow-md max-w-lg">
                        <img
                          src={generatedAiImage}
                          alt="AI Generated"
                          className="w-full h-auto object-cover max-h-96"
                        />
                        {/* UI Layer Watermark Badge */}
                        {showAiWatermark && (
                          <div className="absolute bottom-3 right-3 px-2.5 py-1 bg-slate-900/80 backdrop-blur-xs text-white text-[11px] font-bold rounded-lg border border-white/20 shadow-sm flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-indigo-400" />
                            <span>AI 생성 이미지</span>
                          </div>
                        )}
                      </div>

                      {/* Caption Input */}
                      <div className="space-y-1">
                        <input
                          type="text"
                          value={aiCaption}
                          onChange={(e) => setAiCaption(e.target.value)}
                          placeholder="본문 삽입 시 사용할 캡션 (생략 가능)"
                          className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900"
                        />
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
                        <button
                          type="button"
                          onClick={handleGenerateAiImage}
                          disabled={isGeneratingAiImage}
                          className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>다시 생성</span>
                        </button>

                        <div className="flex items-center gap-2">
                          <a
                            href={generatedAiImage}
                            download={`ai-image-${Date.now()}.png`}
                            className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5 text-slate-500" />
                            <span>다운로드</span>
                          </a>

                          <button
                            type="button"
                            onClick={handleInsertAiImage}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>본문에 바로 삽입</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* 3. CARD NEWS GENERATION (Including Cute Pastel Style) */}
          {/* ================================================================= */}
          {activeTab === 'card_news' && (
            <div className="space-y-5 bg-white p-5 rounded-xl border border-slate-200/80 shadow-2xs">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-pink-600" />
                    <span>카드뉴스 디자인 템플릿 선택</span>
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    HTML/CSS 텍스트 렌더링 레이어로 글자가 뭉개지지 않고 선명하게 출력됩니다.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleGenerateCardNews}
                  disabled={isGeneratingCardNews}
                  className="px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs shrink-0 disabled:opacity-50"
                >
                  {isGeneratingCardNews ? (
                    <>
                      <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                      <span>스크립트 생성 중...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>본문 기반 카드뉴스 생성</span>
                    </>
                  )}
                </button>
              </div>

              {/* Template Choices */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {Object.values(CARD_NEWS_TEMPLATES).map((tmpl) => (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => setCardTemplate(tmpl.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      cardTemplate === tmpl.id
                        ? 'border-pink-600 bg-pink-50/70 ring-2 ring-pink-500/20 shadow-2xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <span className="text-[11px] font-bold text-slate-900 block truncate">
                      {tmpl.name}
                    </span>
                    <span className="text-[9.5px] text-slate-500 block truncate">
                      {tmpl.englishName}
                    </span>
                  </button>
                ))}
              </div>

              {/* Error state */}
              {cardNewsError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs">
                  {cardNewsError}
                </div>
              )}

              {/* Card News Slide Preview */}
              {cardNewsCards.length > 0 && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">
                      카드 슬라이드 ({activeCardIndex + 1} / {cardNewsCards.length})
                    </span>

                    <div className="flex items-center gap-1">
                      {cardNewsCards.map((_, cIdx) => (
                        <button
                          key={cIdx}
                          type="button"
                          onClick={() => setActiveCardIndex(cIdx)}
                          className={`w-6 h-6 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                            activeCardIndex === cIdx
                              ? 'bg-pink-600 text-white shadow-2xs'
                              : 'bg-white text-slate-600 border border-slate-200'
                          }`}
                        >
                          {cIdx + 1}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Card Renderer */}
                  <div className="max-w-xs mx-auto shadow-md rounded-2xl overflow-hidden">
                    <CardNewsCardRenderer
                      card={cardNewsCards[activeCardIndex]}
                      totalCards={cardNewsCards.length}
                      templateId={cardTemplate}
                      imageSourceMode="no_image"
                    />
                  </div>

                  {/* Insert Card News Summary Text into Draft */}
                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        const currentCard = cardNewsCards[activeCardIndex];
                        const html = `
<div class="blog-cardnews-box" style="margin: 24px 0; padding: 20px; border-radius: 16px; background: #fff5f8; border: 2px solid #fbcfe8; text-align: left;">
  <span style="display: inline-block; background: #ec4899; color: #fff; font-size: 11px; font-weight: bold; padding: 3px 8px; border-radius: 6px; margin-bottom: 8px;">📌 카드뉴스 요약 #${activeCardIndex + 1}</span>
  <h4 style="font-size: 16px; font-weight: 800; color: #831843; margin: 4px 0 8px;">${currentCard.title}</h4>
  <p style="font-size: 13px; color: #4c0519; line-height: 1.6; margin: 0;">${currentCard.body}</p>
</div>
`;
                        onInsertImageIntoDraft(itemId, html);
                      }}
                      className="px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>현재 카드 요약박스 본문 삽입</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* 4. USER IMAGE UPLOAD */}
          {/* ================================================================= */}
          {activeTab === 'upload' && (
            <div className="space-y-4 bg-white p-5 rounded-xl border border-slate-200/80 shadow-2xs">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png, image/jpeg, image/webp"
                onChange={handleFileUpload}
                className="hidden"
              />

              {!uploadedImageUrl ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="py-12 px-6 border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50/50 hover:bg-emerald-50/30 rounded-2xl text-center cursor-pointer transition-all space-y-3"
                >
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100/80 text-emerald-700 flex items-center justify-center mx-auto shadow-2xs">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-800">
                      직접 촬영한 사진 또는 소장 이미지를 업로드하세요
                    </p>
                    <p className="text-xs text-slate-500">
                      PNG, JPG, WEBP 지원 · 방문 후기, 영수증, 제품 실물 사진에 최적화
                    </p>
                  </div>
                  <button
                    type="button"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all pointer-events-none"
                  >
                    사진 파일 선택
                  </button>
                </div>
              ) : (
                <div className="p-4 bg-emerald-50/40 rounded-xl border border-emerald-200/80 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>업로드 완료된 내 사진</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs font-semibold text-emerald-700 hover:underline cursor-pointer"
                    >
                      다른 사진으로 변경
                    </button>
                  </div>

                  <div className="max-w-md mx-auto rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-white p-1">
                    <img
                      src={uploadedImageUrl}
                      alt="Uploaded user photo"
                      className="w-full h-auto object-cover rounded-lg max-h-80"
                    />
                  </div>

                  <div className="space-y-1">
                    <input
                      type="text"
                      value={uploadCaption}
                      onChange={(e) => setUploadCaption(e.target.value)}
                      placeholder="사진 설명 / 캡션 입력 (예: 매장 전경 및 주문 영수증)"
                      className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 font-medium"
                    />
                  </div>

                  <div className="flex justify-end pt-2 border-t border-emerald-200/60">
                    <button
                      type="button"
                      onClick={handleInsertUploadedImage}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>본문에 사진 삽입</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
