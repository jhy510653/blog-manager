import React from 'react';
import {
  CardNewsContentCard,
  CardNewsTemplateId,
  CardNewsImageSourceMode,
  CARD_NEWS_TEMPLATES,
  CardLayoutVariant,
} from './visualTypes';
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  ArrowRight,
  Bookmark,
  Share2,
  HelpCircle,
  TrendingUp,
  Layers,
  Star,
  Check,
  MapPin,
  Camera,
  Info,
  Sliders,
  CheckSquare,
  XCircle,
  Quote,
} from 'lucide-react';

export interface CardNewsCardRendererProps {
  card: CardNewsContentCard;
  totalCards: number;
  templateId: CardNewsTemplateId;
  imageSourceMode: CardNewsImageSourceMode;
  aspectRatio?: '1:1' | '4:5';
  scale?: number;
  previewMode?: boolean;
}

// ---------------------------------------------------------------------------
// Helper: Resolve dynamic layout variant based on card role and content
// ---------------------------------------------------------------------------
function resolveVariant(card: CardNewsContentCard, totalCards: number, hasImage: boolean): CardLayoutVariant {
  if (card.layoutVariant) return card.layoutVariant;
  const isCover = card.cardNumber === 1 || card.cardRole === 'cover';
  const isClosing = card.cardNumber === totalCards || card.cardRole === 'summary' || card.cardRole === 'cta';

  if (isCover) return 'cover';
  if (isClosing) return 'ending';
  if (card.cardRole === 'warning' || card.cardRole === 'tip') return 'tip';
  if (card.cardRole === 'comparison') return 'comparison';
  if (card.cardRole === 'step') return 'number_focus';
  if (hasImage && (card.cardNumber % 2 === 1 || card.cardRole === 'key_point')) return 'image_focus';
  if (card.cardNumber % 2 === 0) return 'text_focus';
  return 'split';
}

// ---------------------------------------------------------------------------
// Helper: Title dynamic auto-scaling with safe line-height and word break
// ---------------------------------------------------------------------------
function getHeadlineClass(
  title: string,
  templateId: CardNewsTemplateId,
  variant: CardLayoutVariant,
  hasImage: boolean = false,
  bodyLength: number = 0
): string {
  const len = (title || '').length;
  const isHeavy = hasImage || bodyLength > 100;

  if (templateId === 'editorial') {
    if (variant === 'cover') {
      if (len > 34 || isHeavy) return 'text-lg sm:text-xl font-black font-serif leading-[1.3] tracking-tight pb-0.5 break-keep';
      if (len > 22) return 'text-xl sm:text-2xl font-black font-serif leading-[1.28] tracking-tight pb-0.5 break-keep';
      return 'text-2xl sm:text-[28px] font-black font-serif leading-[1.22] tracking-tight pb-0.5 break-keep';
    }
    if (len > 30 || isHeavy) return 'text-base sm:text-lg font-black font-serif leading-[1.32] pb-0.5 break-keep';
    if (len > 20) return 'text-lg sm:text-xl font-black font-serif leading-[1.3] pb-0.5 break-keep';
    return 'text-xl sm:text-2xl font-black font-serif leading-[1.28] pb-0.5 break-keep';
  }

  if (templateId === 'minimal') {
    if (variant === 'cover') {
      if (len > 34 || isHeavy) return 'text-base sm:text-lg font-bold font-sans leading-[1.35] tracking-tight pb-0.5 break-keep';
      if (len > 22) return 'text-lg sm:text-xl font-bold font-sans leading-[1.32] tracking-tight pb-0.5 break-keep';
      return 'text-xl sm:text-2xl font-bold font-sans leading-[1.28] tracking-tight pb-0.5 break-keep';
    }
    if (len > 28 || isHeavy) return 'text-sm sm:text-base font-bold font-sans leading-[1.35] pb-0.5 break-keep';
    if (len > 18) return 'text-base sm:text-lg font-bold font-sans leading-[1.35] pb-0.5 break-keep';
    return 'text-lg sm:text-xl font-bold font-sans leading-[1.32] pb-0.5 break-keep';
  }

  if (templateId === 'photo_story') {
    if (variant === 'cover') {
      if (len > 32 || isHeavy) return 'text-lg sm:text-xl font-black font-sans leading-[1.3] text-white drop-shadow-md pb-0.5 break-keep';
      if (len > 20) return 'text-xl sm:text-2xl font-black font-sans leading-[1.28] text-white drop-shadow-md pb-0.5 break-keep';
      return 'text-2xl sm:text-[28px] font-black font-sans leading-[1.22] text-white drop-shadow-md pb-0.5 break-keep';
    }
    if (len > 28 || isHeavy) return 'text-sm sm:text-base font-black font-sans leading-[1.32] text-white pb-0.5 break-keep';
    if (len > 18) return 'text-base sm:text-lg font-black font-sans leading-[1.3] text-white pb-0.5 break-keep';
    return 'text-lg sm:text-xl font-black font-sans leading-[1.28] text-white pb-0.5 break-keep';
  }

  if (templateId === 'mood') {
    if (variant === 'cover') {
      if (len > 32 || isHeavy) return 'text-lg sm:text-xl font-black font-serif leading-[1.3] text-stone-900 pb-0.5 break-keep';
      if (len > 20) return 'text-xl sm:text-2xl font-black font-serif leading-[1.28] text-stone-900 pb-0.5 break-keep';
      return 'text-2xl sm:text-[28px] font-black font-serif leading-[1.22] text-stone-900 pb-0.5 break-keep';
    }
    if (len > 28 || isHeavy) return 'text-base sm:text-lg font-black font-serif leading-[1.32] text-stone-900 pb-0.5 break-keep';
    if (len > 18) return 'text-lg sm:text-xl font-black font-serif leading-[1.3] text-stone-900 pb-0.5 break-keep';
    return 'text-xl sm:text-2xl font-black font-serif leading-[1.28] text-stone-900 pb-0.5 break-keep';
  }

  if (templateId === 'cute_pastel') {
    if (variant === 'cover') {
      if (len > 32 || isHeavy) return 'text-lg sm:text-xl font-black font-sans leading-[1.3] text-pink-950 pb-0.5 break-keep';
      if (len > 20) return 'text-xl sm:text-2xl font-black font-sans leading-[1.28] text-pink-950 pb-0.5 break-keep';
      return 'text-2xl sm:text-[28px] font-black font-sans leading-[1.22] text-pink-950 pb-0.5 break-keep';
    }
    if (len > 28 || isHeavy) return 'text-base sm:text-lg font-black font-sans leading-[1.32] text-pink-950 pb-0.5 break-keep';
    if (len > 18) return 'text-lg sm:text-xl font-black font-sans leading-[1.3] text-pink-950 pb-0.5 break-keep';
    return 'text-xl sm:text-2xl font-black font-sans leading-[1.28] text-pink-950 pb-0.5 break-keep';
  }

  // information
  if (variant === 'cover') {
    if (len > 32 || isHeavy) return 'text-lg sm:text-xl font-black font-sans leading-[1.3] text-slate-900 pb-0.5 break-keep';
    if (len > 20) return 'text-xl sm:text-2xl font-black font-sans leading-[1.28] text-slate-900 pb-0.5 break-keep';
    return 'text-2xl sm:text-[28px] font-black font-sans leading-[1.22] text-slate-900 pb-0.5 break-keep';
  }
  if (len > 28 || isHeavy) return 'text-base sm:text-lg font-black font-sans leading-[1.32] text-slate-900 pb-0.5 break-keep';
  if (len > 18) return 'text-lg sm:text-xl font-black font-sans leading-[1.3] text-slate-900 pb-0.5 break-keep';
  return 'text-xl sm:text-2xl font-black font-sans leading-[1.28] text-slate-900 pb-0.5 break-keep';
}

// ---------------------------------------------------------------------------
// Helper: Body text dynamic auto-scaling
// ---------------------------------------------------------------------------
function getBodyTextClass(body: string, hasImage: boolean, variant: CardLayoutVariant): string {
  const len = (body || '').length;
  if (hasImage && (variant === 'image_focus' || variant === 'split' || variant === 'cover')) {
    if (len > 140) return 'text-[10px] sm:text-[10.5px] leading-[1.4] pb-0.5 break-keep break-words';
    if (len > 80) return 'text-[11px] sm:text-xs leading-[1.45] pb-0.5 break-keep break-words';
    return 'text-xs leading-[1.5] pb-0.5 break-keep break-words';
  }
  if (len > 180) return 'text-[10.5px] sm:text-[11px] leading-[1.45] pb-0.5 break-keep break-words';
  if (len > 110) return 'text-[11.5px] sm:text-xs leading-[1.5] pb-0.5 break-keep break-words';
  return 'text-xs sm:text-[12.5px] leading-relaxed pb-0.5 break-keep break-words';
}

// ---------------------------------------------------------------------------
// MASTER CARD NEWS RENDERER
// ---------------------------------------------------------------------------
export const CardNewsCardRenderer: React.FC<CardNewsCardRendererProps> = ({
  card,
  totalCards,
  templateId = 'editorial',
  imageSourceMode = 'unsplash',
  aspectRatio = '1:1',
  scale = 1,
  previewMode = false,
}) => {
  const theme = CARD_NEWS_TEMPLATES[templateId] || CARD_NEWS_TEMPLATES.editorial;
  const isCardImageDisabled = card.imageSource === 'none' || card.imageSource === 'no_image' || imageSourceMode === 'no_image';
  const hasImage = !isCardImageDisabled && Boolean(card.userUploadedImage || card.imageUrl);
  const activeImageUrl = card.userUploadedImage || card.imageUrl || '';
  const variant = resolveVariant(card, totalCards, hasImage);
  const padIndex = String(card.cardNumber).padStart(2, '0');
  const totalPad = String(totalCards).padStart(2, '0');

  const bodyLines = (card.body || '')
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Dispatch to template-specific renderer
  switch (templateId) {
    case 'editorial':
      return (
        <EditorialCardRenderer
          card={card}
          totalCards={totalCards}
          theme={theme}
          variant={variant}
          hasImage={hasImage}
          activeImageUrl={activeImageUrl}
          padIndex={padIndex}
          totalPad={totalPad}
          bodyLines={bodyLines}
        />
      );
    case 'minimal':
      return (
        <MinimalCardRenderer
          card={card}
          totalCards={totalCards}
          theme={theme}
          variant={variant}
          hasImage={hasImage}
          activeImageUrl={activeImageUrl}
          padIndex={padIndex}
          totalPad={totalPad}
          bodyLines={bodyLines}
        />
      );
    case 'mood':
      return (
        <MoodCardRenderer
          card={card}
          totalCards={totalCards}
          theme={theme}
          variant={variant}
          hasImage={hasImage}
          activeImageUrl={activeImageUrl}
          padIndex={padIndex}
          totalPad={totalPad}
          bodyLines={bodyLines}
        />
      );
    case 'information':
      return (
        <InformationCardRenderer
          card={card}
          totalCards={totalCards}
          theme={theme}
          variant={variant}
          hasImage={hasImage}
          activeImageUrl={activeImageUrl}
          padIndex={padIndex}
          totalPad={totalPad}
          bodyLines={bodyLines}
        />
      );
    case 'photo_story':
      return (
        <PhotoStoryCardRenderer
          card={card}
          totalCards={totalCards}
          theme={theme}
          variant={variant}
          hasImage={hasImage}
          activeImageUrl={activeImageUrl}
          padIndex={padIndex}
          totalPad={totalPad}
          bodyLines={bodyLines}
        />
      );
    case 'cute_pastel':
      return (
        <CutePastelCardRenderer
          card={card}
          totalCards={totalCards}
          theme={theme}
          variant={variant}
          hasImage={hasImage}
          activeImageUrl={activeImageUrl}
          padIndex={padIndex}
          totalPad={totalPad}
          bodyLines={bodyLines}
        />
      );
    default:
      return (
        <EditorialCardRenderer
          card={card}
          totalCards={totalCards}
          theme={theme}
          variant={variant}
          hasImage={hasImage}
          activeImageUrl={activeImageUrl}
          padIndex={padIndex}
          totalPad={totalPad}
          bodyLines={bodyLines}
        />
      );
  }
};

// ===========================================================================
// ① EDITORIAL CARD RENDERER (매거진 에디토리얼)
// Features: Asymmetrical grids, bold serif typography, folio dividers,
// picture frames with FIG. captions, drop caps, sharp mono tags.
// ===========================================================================
interface TemplateRendererProps {
  card: CardNewsContentCard;
  totalCards: number;
  theme: any;
  variant: CardLayoutVariant;
  hasImage: boolean;
  activeImageUrl: string;
  padIndex: string;
  totalPad: string;
  bodyLines: string[];
}

const EditorialCardRenderer: React.FC<TemplateRendererProps> = ({
  card,
  totalCards,
  theme,
  variant,
  hasImage,
  activeImageUrl,
  padIndex,
  totalPad,
  bodyLines,
}) => {
  const headlineClass = getHeadlineClass(card.title, 'editorial', variant, hasImage, (card.body || '').length);
  const bodyTextClass = getBodyTextClass(card.body || '', hasImage, variant);
  const hasLongText = (card.title || '').length > 24 || (card.body || '').length > 90;

  return (
    <div
      data-card-id={card.id}
      data-card-index={card.cardNumber}
      className="relative w-full aspect-square overflow-hidden select-none flex flex-col justify-between bg-white text-slate-950 border-2 border-slate-900 shadow-2xl font-sans"
      style={{ backgroundColor: '#ffffff' }}
    >
      {/* 1. EDITORIAL TOP FOLIO HEADER */}
      <div className="relative z-20 px-6 pt-4 pb-2 border-b border-slate-900 flex items-center justify-between shrink-0 bg-white">
        <div className="flex items-center gap-2.5">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] px-2 py-0.5 bg-slate-950 text-white">
            {variant === 'cover' ? 'MAGAZINE ISSUE' : `SECTION ${padIndex}`}
          </span>
          <span className="text-[10px] font-mono font-bold text-slate-600 tracking-wider">
            VOL. 26 · NO. 04
          </span>
        </div>
        <div className="text-[11px] font-mono font-black text-slate-950 tracking-widest flex items-center gap-1">
          <span>P.</span>
          <span>{padIndex}</span>
          <span className="text-slate-400 font-normal">/</span>
          <span className="text-slate-500">{totalPad}</span>
        </div>
      </div>

      {/* 2. EDITORIAL MAIN BODY CONTENT (BY VARIANT) */}
      <div className="relative z-10 px-6 py-2.5 flex-1 flex flex-col justify-center min-h-0 overflow-hidden text-left">
        {/* --- VARIANT: COVER --- */}
        {variant === 'cover' && (
          <div className="flex-1 flex flex-col justify-between py-1 space-y-2 min-h-0">
            {/* Editorial Eyebrow */}
            <div className="flex items-center justify-between border-b border-slate-300 pb-1 shrink-0">
              <span className="text-[10px] font-mono font-black tracking-[0.2em] text-slate-800 uppercase">
                FEATURE ARTICLE · ESSENTIAL REPORT
              </span>
              <span className="text-[9px] font-mono text-slate-500">2026 EDITION</span>
            </div>

            {/* Asymmetrical Top Headline */}
            <div className="space-y-1 text-left shrink-0">
              <h1 className={headlineClass}>{card.title || '블로그 에디토리얼 심층 기획'}</h1>
              {card.subtitle && (
                <p className="text-xs font-serif italic text-slate-600 leading-snug break-keep pb-0.5">
                  "{card.subtitle}"
                </p>
              )}
            </div>

            {/* Asymmetric Offset Photo / Frame */}
            {hasImage ? (
              <div className={`relative w-full ${hasLongText ? 'h-28 sm:h-32' : 'h-32 sm:h-36'} bg-slate-100 border border-slate-900 p-1 shrink-0`}>
                <div className="w-full h-full relative overflow-hidden">
                  <img
                    src={activeImageUrl}
                    alt={card.title}
                    className="w-full h-full object-cover grayscale-[15%] contrast-[1.05]"
                    crossOrigin="anonymous"
                  />
                  <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-slate-950 text-white text-[8px] font-mono uppercase tracking-widest">
                    FIG. 01 — ARCHIVE
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 border-l-4 border-slate-950 space-y-1 shrink-0">
                <span className="text-[9px] font-mono font-black uppercase text-slate-500 tracking-wider">
                  ABSTRACT NOTE
                </span>
                <p className={`font-serif text-slate-800 ${bodyTextClass}`}>
                  {card.body || '본문의 핵심 팩트를 에디토리얼 그리드로 정밀 분석하여 정리했습니다.'}
                </p>
              </div>
            )}

            {/* Bottom Tag Bar */}
            <div className="flex items-center justify-between pt-1 border-t border-slate-200 shrink-0">
              <div className="flex flex-wrap gap-1">
                {card.emphasis?.slice(0, 3).map((kw, i) => (
                  <span
                    key={i}
                    className="text-[9px] font-mono font-bold px-1.5 py-0.5 bg-slate-100 text-slate-800 border border-slate-300"
                  >
                    #{kw}
                  </span>
                ))}
              </div>
              <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">
                EDITORIAL DESK
              </span>
            </div>
          </div>
        )}

        {/* --- VARIANT: TEXT FOCUS (2-Column Asymmetric Grid) --- */}
        {variant === 'text_focus' && (
          <div className="flex-1 flex flex-col justify-center py-1 space-y-2.5 min-h-0">
            <div className="flex items-start gap-4 shrink-0">
              {/* Left Asymmetric Number Col */}
              <div className="flex flex-col items-center shrink-0 pr-3 border-r-2 border-slate-900">
                <span className="text-4xl sm:text-5xl font-black font-serif tracking-tighter text-slate-950 leading-none">
                  {padIndex}
                </span>
                <span className="text-[8px] font-mono uppercase font-bold text-slate-500 mt-1">
                  POINT
                </span>
              </div>

              {/* Right Content Col */}
              <div className="flex-1 space-y-1 text-left">
                <span className="text-[9px] font-mono font-black uppercase text-slate-500 tracking-widest block">
                  {card.subtitle || 'CRITICAL ANALYSIS'}
                </span>
                <h2 className={headlineClass}>{card.title}</h2>
              </div>
            </div>

            {/* Editorial Body Box with Drop Cap styling */}
            <div className="p-3 bg-slate-50 border border-slate-300 space-y-1.5 text-left">
              {bodyLines.map((line, lIdx) => (
                <p
                  key={lIdx}
                  className={`font-serif text-slate-800 first:first-letter:text-xl first:first-letter:font-black first:first-letter:font-serif first:first-letter:mr-1 ${bodyTextClass}`}
                >
                  {line}
                </p>
              ))}
            </div>

            {/* Emphasis Chips */}
            {card.emphasis && card.emphasis.length > 0 && (
              <div className="flex items-center gap-1.5 pt-0.5 text-[10px] shrink-0">
                <span className="font-mono font-black text-slate-400">KEYWORDS:</span>
                <div className="flex flex-wrap gap-1">
                  {card.emphasis.map((kw, i) => (
                    <span
                      key={i}
                      className="font-mono font-bold px-1.5 py-0.5 bg-slate-950 text-white text-[9px]"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- VARIANT: IMAGE FOCUS (Framed Gallery Photo + Editorial Text) --- */}
        {variant === 'image_focus' && (
          <div className="flex-1 flex flex-col justify-between py-1 space-y-2 min-h-0">
            {hasImage ? (
              <div className={`relative w-full ${hasLongText ? 'h-28 sm:h-32' : 'h-36 sm:h-40'} bg-slate-100 border border-slate-900 p-1 shrink-0`}>
                <img
                  src={activeImageUrl}
                  alt={card.title}
                  className="w-full h-full object-cover grayscale-[10%]"
                  crossOrigin="anonymous"
                />
                <div className="absolute bottom-2 left-2 px-1.5 py-0.5 bg-slate-950/90 text-white text-[8px] font-mono tracking-widest uppercase">
                  [ FIG. {padIndex} · EXHIBIT ]
                </div>
              </div>
            ) : (
              <div className="w-full h-20 bg-slate-100 border border-slate-300 p-2.5 flex flex-col justify-center text-center shrink-0">
                <span className="text-[10px] font-mono font-black text-slate-500 uppercase">
                  NO PHOTOGRAPHIC ATTACHMENT
                </span>
                <span className="text-xs font-serif italic text-slate-800 mt-1">
                  {card.subtitle || '에디토리얼 분석 데이터'}
                </span>
              </div>
            )}

            <div className="space-y-1 text-left">
              <h2 className={headlineClass}>{card.title}</h2>
              <p className={`font-serif text-slate-700 ${bodyTextClass}`}>
                {card.body}
              </p>
            </div>

            {card.emphasis && card.emphasis.length > 0 && (
              <div className="flex flex-wrap gap-1 shrink-0">
                {card.emphasis.map((kw, i) => (
                  <span
                    key={i}
                    className="text-[9px] font-mono font-bold px-1.5 py-0.5 bg-slate-100 border border-slate-300 text-slate-800"
                  >
                    #{kw}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- VARIANT: SPLIT (40:60 Ratio) --- */}
        {variant === 'split' && (
          <div className="flex-1 flex flex-col justify-between py-1 space-y-2 min-h-0">
            <div className="text-left border-b border-slate-300 pb-1 shrink-0">
              <span className="text-[9px] font-mono font-black uppercase text-slate-500 block">
                COLUMN BREAKDOWN
              </span>
              <h2 className={headlineClass}>{card.title}</h2>
            </div>

            <div className="grid grid-cols-5 gap-2.5 items-stretch pt-0.5">
              {/* Left 2 Cols: Image or Quote Tile */}
              <div className="col-span-2 border border-slate-900 p-1 bg-slate-100 flex flex-col justify-center">
                {hasImage ? (
                  <img
                    src={activeImageUrl}
                    alt={card.title}
                    className="w-full h-24 sm:h-28 object-cover"
                    crossOrigin="anonymous"
                  />
                ) : (
                  <div className="p-2 text-center">
                    <span className="text-[9px] font-mono font-black text-slate-900 block">KEY FOCUS</span>
                    <span className="text-xs font-serif italic text-slate-700 mt-1 block">
                      {card.emphasis?.[0] || '핵심 기준'}
                    </span>
                  </div>
                )}
              </div>

              {/* Right 3 Cols: Narrative Lines */}
              <div className="col-span-3 bg-slate-50 border border-slate-300 p-2 flex flex-col justify-center text-left space-y-1">
                <span className="text-[9px] font-mono font-bold uppercase text-slate-500 block">
                  OBSERVATIONS
                </span>
                <p className={`font-serif text-slate-800 ${bodyTextClass}`}>
                  {card.body}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* --- VARIANT: NUMBER FOCUS / STEP --- */}
        {variant === 'number_focus' && (
          <div className="flex-1 flex flex-col justify-center py-1 space-y-2.5 min-h-0 text-left">
            <div className="flex items-baseline justify-between border-b-2 border-slate-950 pb-1.5 shrink-0">
              <span className="text-4xl sm:text-5xl font-black font-serif text-slate-950 tracking-tighter leading-none">
                No. {padIndex}
              </span>
              <span className="text-xs font-mono font-bold text-slate-600 uppercase">
                {card.subtitle || 'CRITICAL STEP'}
              </span>
            </div>

            <h2 className={headlineClass}>{card.title}</h2>

            <div className="p-3 bg-slate-50 border-l-2 border-slate-900">
              <p className={`font-serif text-slate-800 ${bodyTextClass}`}>
                {card.body}
              </p>
            </div>
          </div>
        )}

        {/* --- VARIANT: COMPARISON --- */}
        {variant === 'comparison' && (
          <div className="flex-1 flex flex-col justify-center py-1 space-y-2 min-h-0 text-left">
            <div className="border-b border-slate-300 pb-1 shrink-0">
              <span className="text-[9px] font-mono font-black text-slate-500 uppercase tracking-widest block">
                COMPARATIVE STUDY · EXHIBIT A / B
              </span>
              <h2 className={headlineClass}>{card.title}</h2>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 bg-slate-50 border border-slate-900 space-y-1">
                <span className="text-[9px] font-mono font-black uppercase text-slate-950 block border-b border-slate-300 pb-0.5">
                  [ SECTION A ]
                </span>
                <p className="text-[11px] font-serif font-bold text-slate-900 leading-snug break-keep pb-0.5">
                  {card.emphasis?.[0] || '주요 비교 요점 A'}
                </p>
              </div>

              <div className="p-2.5 bg-slate-100 border border-slate-400 space-y-1">
                <span className="text-[9px] font-mono font-black uppercase text-slate-600 block border-b border-slate-300 pb-0.5">
                  [ SECTION B ]
                </span>
                <p className="text-[11px] font-serif font-bold text-slate-800 leading-snug break-keep pb-0.5">
                  {card.emphasis?.[1] || card.subtitle || '주요 비교 요점 B'}
                </p>
              </div>
            </div>

            <p className={`font-serif text-slate-700 ${bodyTextClass}`}>
              {card.body}
            </p>
          </div>
        )}

        {/* --- VARIANT: TIP / QUOTE --- */}
        {variant === 'tip' && (
          <div className="flex-1 flex flex-col justify-center py-1 space-y-2.5 min-h-0 text-left">
            <div className="flex items-center gap-2 border-b border-slate-300 pb-1 shrink-0">
              <Quote className="w-4 h-4 text-slate-950" />
              <span className="text-[10px] font-mono font-black tracking-widest uppercase text-slate-900">
                {card.cardRole === 'warning' ? 'EDITORIAL WARNING' : 'PULL-QUOTE & SPECIAL ADVICE'}
              </span>
            </div>

            <h2 className={headlineClass}>{card.title}</h2>

            <div className="p-3.5 bg-slate-950 text-white border border-slate-900 space-y-1">
              <span className="text-[8px] font-mono uppercase tracking-[0.2em] text-slate-400 block">
                SPECIAL DIRECTIVE
              </span>
              <p className={`font-serif text-slate-100 italic ${bodyTextClass}`}>
                "{card.body}"
              </p>
            </div>
          </div>
        )}

        {/* --- VARIANT: ENDING --- */}
        {variant === 'ending' && (
          <div className="flex-1 flex flex-col justify-between py-1 space-y-2 min-h-0 text-left">
            <div className="border-b-2 border-slate-950 pb-1 shrink-0">
              <span className="text-[10px] font-mono font-black tracking-[0.2em] text-slate-500 uppercase block">
                COLOPHON & CONCLUSION
              </span>
              <h2 className={headlineClass}>{card.title || '오늘의 핵심 요약 3선'}</h2>
            </div>

            <div className="space-y-1.5 bg-slate-50 border border-slate-300 p-2.5">
              {bodyLines.slice(0, 3).map((line, bIdx) => (
                <div key={bIdx} className="flex items-start gap-2 text-xs font-serif leading-snug">
                  <span className="font-mono font-black text-[10px] text-slate-950 shrink-0 mt-0.5">
                    {['I.', 'II.', 'III.'][bIdx] || '•'}
                  </span>
                  <span className="text-slate-800 break-keep pb-0.5">{line}</span>
                </div>
              ))}
            </div>

            <div className="p-2 border border-slate-900 flex items-center justify-between text-[10px] font-mono font-bold uppercase bg-slate-100 shrink-0">
              <span>ARCHIVE THIS REPORT</span>
              <Bookmark className="w-3.5 h-3.5 text-slate-900" />
            </div>
          </div>
        )}
      </div>

      {/* 3. EDITORIAL BOTTOM BRAND FOOTER */}
      <div className="relative z-20 px-6 py-2 border-t border-slate-900 flex items-center justify-between text-[9px] font-mono uppercase tracking-wider text-slate-600 bg-white shrink-0">
        <span className="truncate max-w-[240px]">
          {card.sourceContext ? card.sourceContext.slice(0, 35) : 'EDITORIAL DESIGN SYSTEM'}
        </span>
        <span className="font-black text-slate-950">PRESS RELEASE</span>
      </div>
    </div>
  );
};

// ===========================================================================
// ② MINIMAL CARD RENDERER (스위스 모던 미니멀)
// Features: Immense negative space (60%+), delicate letterspaced sans,
// hairline rules, subtle sky-blue dots, clean floating frames.
// ===========================================================================
const MinimalCardRenderer: React.FC<TemplateRendererProps> = ({
  card,
  totalCards,
  theme,
  variant,
  hasImage,
  activeImageUrl,
  padIndex,
  totalPad,
  bodyLines,
}) => {
  const headlineClass = getHeadlineClass(card.title, 'minimal', variant, hasImage, (card.body || '').length);
  const bodyTextClass = getBodyTextClass(card.body || '', hasImage, variant);
  const hasLongText = (card.title || '').length > 24 || (card.body || '').length > 90;

  return (
    <div
      data-card-id={card.id}
      data-card-index={card.cardNumber}
      className="relative w-full aspect-square overflow-hidden select-none flex flex-col justify-between bg-[#FAFAFA] text-slate-900 border border-slate-200 shadow-md font-sans"
      style={{ backgroundColor: '#FAFAFA' }}
    >
      {/* 1. MINIMAL TOP NAV (Letterspaced & Delicate) */}
      <div className="relative z-20 px-7 pt-4 pb-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
          <span className="text-[11px] font-medium tracking-[0.15em] text-slate-500 uppercase">
            {variant === 'cover' ? 'overview' : `step ${padIndex}`}
          </span>
        </div>
        <span className="text-xs font-mono text-slate-400">
          {padIndex} <span className="text-slate-300">/</span> {totalPad}
        </span>
      </div>

      {/* 2. MINIMAL MAIN BODY (Spacious & Clean) */}
      <div className="relative z-10 px-7 py-2.5 flex-1 flex flex-col justify-center min-h-0 overflow-hidden text-left">
        {/* --- VARIANT: COVER --- */}
        {variant === 'cover' && (
          <div className="flex-1 flex flex-col justify-between py-1 space-y-2.5 min-h-0">
            <div className="space-y-1.5 shrink-0">
              <span className="text-[11px] font-medium tracking-widest text-sky-600 uppercase block">
                01  ESSENTIAL GUIDE
              </span>
              <h1 className={headlineClass}>{card.title || '미니멀 정보 가이드'}</h1>
              {card.subtitle && (
                <p className="text-xs text-slate-500 font-normal leading-relaxed break-keep pb-0.5">
                  {card.subtitle}
                </p>
              )}
            </div>

            {hasImage ? (
              <div className={`relative w-full ${hasLongText ? 'h-24 sm:h-28' : 'h-32 sm:h-36'} rounded-lg overflow-hidden border border-slate-200 bg-white p-1 shrink-0 shadow-2xs`}>
                <img
                  src={activeImageUrl}
                  alt={card.title}
                  className="w-full h-full object-cover rounded"
                  crossOrigin="anonymous"
                />
              </div>
            ) : (
              <div className="py-2 border-l-2 border-sky-400 pl-3">
                <p className={`text-slate-600 font-normal ${bodyTextClass}`}>
                  {card.body || '불필요한 요소를 걷어내고 가장 핵심적인 팩트만을 담았습니다.'}
                </p>
              </div>
            )}

            <div className="flex items-center gap-1.5 pt-1 shrink-0">
              {card.emphasis?.slice(0, 3).map((kw, i) => (
                <span
                  key={i}
                  className="text-[10px] text-slate-600 px-2 py-0.5 bg-white border border-slate-200 rounded-full"
                >
                  {kw}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* --- VARIANT: TEXT FOCUS (Generous Negative Space) --- */}
        {variant === 'text_focus' && (
          <div className="flex-1 flex flex-col justify-center space-y-3 py-1 min-h-0">
            <div className="space-y-1 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-sky-600">{padIndex}.</span>
                <span className="text-[11px] text-slate-400 font-normal tracking-wider uppercase">
                  {card.subtitle || 'KEY POINT'}
                </span>
              </div>
              <h2 className={headlineClass}>{card.title}</h2>
            </div>

            <div className="space-y-1.5 py-1">
              {bodyLines.map((line, lIdx) => (
                <div key={lIdx} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500 mt-1.5 shrink-0" />
                  <p className={`text-slate-600 ${bodyTextClass}`}>{line}</p>
                </div>
              ))}
            </div>

            {card.emphasis && card.emphasis.length > 0 && (
              <div className="flex items-center gap-2 pt-1 border-t border-slate-100 shrink-0">
                <span className="text-[10px] text-slate-400">포인트:</span>
                <span className="text-[10px] font-medium text-slate-700">
                  {card.emphasis.join(' · ')}
                </span>
              </div>
            )}
          </div>
        )}

        {/* --- VARIANT: IMAGE FOCUS (Floating Gallery Art) --- */}
        {variant === 'image_focus' && (
          <div className="flex-1 flex flex-col justify-between py-1 space-y-2 min-h-0">
            {hasImage ? (
              <div className={`relative w-full ${hasLongText ? 'h-28 sm:h-32' : 'h-36 sm:h-40'} rounded-xl overflow-hidden border border-slate-200 bg-white p-1.5 shrink-0 shadow-2xs`}>
                <img
                  src={activeImageUrl}
                  alt={card.title}
                  className="w-full h-full object-cover rounded-lg"
                  crossOrigin="anonymous"
                />
              </div>
            ) : (
              <div className="w-full h-20 rounded-lg bg-slate-100 flex items-center justify-center p-2.5 text-center shrink-0">
                <span className="text-xs text-slate-500 font-normal">
                  {card.subtitle || '간결한 텍스트 카드'}
                </span>
              </div>
            )}

            <div className="space-y-1">
              <h2 className={headlineClass}>{card.title}</h2>
              <p className={`text-slate-600 ${bodyTextClass}`}>{card.body}</p>
            </div>
          </div>
        )}

        {/* --- VARIANT: SPLIT --- */}
        {variant === 'split' && (
          <div className="flex-1 flex flex-col justify-center space-y-2 py-1 min-h-0">
            <div className="space-y-0.5 shrink-0">
              <span className="text-[10px] font-mono text-sky-600 block">{padIndex} / 06</span>
              <h2 className={headlineClass}>{card.title}</h2>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-0.5">
              {hasImage ? (
                <div className="h-24 sm:h-28 rounded-lg overflow-hidden border border-slate-200">
                  <img
                    src={activeImageUrl}
                    alt={card.title}
                    className="w-full h-full object-cover"
                    crossOrigin="anonymous"
                  />
                </div>
              ) : (
                <div className="h-24 sm:h-28 rounded-lg bg-white border border-slate-200 p-2.5 flex flex-col justify-center">
                  <span className="text-[10px] text-slate-400 uppercase">Core</span>
                  <span className="text-xs font-semibold text-slate-800 mt-1">
                    {card.emphasis?.[0] || '핵심 기준'}
                  </span>
                </div>
              )}

              <div className="h-24 sm:h-28 flex flex-col justify-center">
                <p className={`text-slate-600 ${bodyTextClass}`}>{card.body}</p>
              </div>
            </div>
          </div>
        )}

        {/* --- VARIANT: NUMBER FOCUS --- */}
        {variant === 'number_focus' && (
          <div className="flex-1 flex flex-col justify-center space-y-2.5 py-1 min-h-0">
            <span className="text-3xl font-light font-mono text-sky-600 leading-none">
              {padIndex}
            </span>
            <div className="space-y-1">
              <h2 className={headlineClass}>{card.title}</h2>
              <p className={`text-slate-600 ${bodyTextClass}`}>{card.body}</p>
            </div>
          </div>
        )}

        {/* --- VARIANT: COMPARISON --- */}
        {variant === 'comparison' && (
          <div className="flex-1 flex flex-col justify-center space-y-2 py-1 min-h-0">
            <h2 className={headlineClass}>{card.title}</h2>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 bg-white border border-slate-200 rounded-lg space-y-0.5">
                <span className="text-[10px] font-bold text-sky-600 block">ITEM 01</span>
                <span className="text-xs font-medium text-slate-800 break-keep pb-0.5">
                  {card.emphasis?.[0] || '기준 A'}
                </span>
              </div>
              <div className="p-2.5 bg-white border border-slate-200 rounded-lg space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 block">ITEM 02</span>
                <span className="text-xs font-medium text-slate-800 break-keep pb-0.5">
                  {card.emphasis?.[1] || card.subtitle || '기준 B'}
                </span>
              </div>
            </div>
            <p className={`text-slate-600 ${bodyTextClass}`}>{card.body}</p>
          </div>
        )}

        {/* --- VARIANT: TIP --- */}
        {variant === 'tip' && (
          <div className="flex-1 flex flex-col justify-center space-y-2.5 py-1 min-h-0">
            <div className="flex items-center gap-1.5 text-sky-600 text-xs font-medium shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
              <span>{card.cardRole === 'warning' ? '주의' : '참고 팁'}</span>
            </div>
            <h2 className={headlineClass}>{card.title}</h2>
            <div className="p-3 bg-white border border-slate-200 rounded-xl">
              <p className={`text-slate-700 ${bodyTextClass}`}>{card.body}</p>
            </div>
          </div>
        )}

        {/* --- VARIANT: ENDING --- */}
        {variant === 'ending' && (
          <div className="flex-1 flex flex-col justify-between py-1 space-y-2 min-h-0">
            <div className="space-y-0.5 shrink-0">
              <span className="text-[11px] text-slate-400 tracking-wider uppercase block">
                summary
              </span>
              <h2 className={headlineClass}>{card.title || '핵심 요약'}</h2>
            </div>

            <div className="space-y-1.5 py-1">
              {bodyLines.slice(0, 3).map((line, bIdx) => (
                <div key={bIdx} className="flex items-start gap-2 text-xs text-slate-600 leading-snug">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500 mt-1.5 shrink-0" />
                  <span className="break-keep pb-0.5">{line}</span>
                </div>
              ))}
            </div>

            <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
              <span>저장하고 나중에 읽기</span>
              <Bookmark className="w-3.5 h-3.5 text-slate-400" />
            </div>
          </div>
        )}
      </div>

      {/* 3. MINIMAL FOOTER */}
      <div className="relative z-20 px-7 py-2.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 shrink-0">
        <span className="truncate max-w-[200px]">minimal design</span>
        <span>swipe</span>
      </div>
    </div>
  );
};

// ===========================================================================
// ③ MOOD CARD RENDERER (감성 라이프스타일 / 인스타그램)
// Features: Warm cream/terracotta palette, rounded-3xl forms,
// Frosted glass (backdrop-blur) overlays over photos, soft sparkle accents.
// ===========================================================================
const MoodCardRenderer: React.FC<TemplateRendererProps> = ({
  card,
  totalCards,
  theme,
  variant,
  hasImage,
  activeImageUrl,
  padIndex,
  totalPad,
  bodyLines,
}) => {
  const headlineClass = getHeadlineClass(card.title, 'mood', variant, hasImage, (card.body || '').length);
  const bodyTextClass = getBodyTextClass(card.body || '', hasImage, variant);
  const hasLongText = (card.title || '').length > 24 || (card.body || '').length > 90;

  return (
    <div
      data-card-id={card.id}
      data-card-index={card.cardNumber}
      className="relative w-full aspect-square overflow-hidden select-none flex flex-col justify-between bg-[#FFFDF9] text-stone-800 border border-amber-200/80 shadow-xl font-sans rounded-none"
      style={{ backgroundColor: '#FFFDF9' }}
    >
      {/* Background Ambience / Image Overlay */}
      {hasImage && variant === 'cover' && (
        <div
          className="absolute inset-0 overflow-hidden pointer-events-none"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 }}
        >
          <img
            src={activeImageUrl}
            alt={card.title}
            className="w-full h-full object-cover"
            crossOrigin="anonymous"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
          {/* Layer 1: Solid Semi-Transparent Dark Base Tint */}
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 2,
              backgroundColor: 'rgba(28, 25, 23, 0.40)',
              pointerEvents: 'none',
            }}
          />
          {/* Layer 2: Directional Gradient Overlay */}
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 3,
              background: 'linear-gradient(180deg, rgba(28, 25, 23, 0.20) 0%, rgba(28, 25, 23, 0.50) 50%, rgba(28, 25, 23, 0.85) 100%)',
              pointerEvents: 'none',
            }}
          />
        </div>
      )}

      {/* 1. MOOD TOP HEADER */}
      <div
        className={`relative px-6 pt-4 pb-2 flex items-center justify-between shrink-0 ${
          hasImage && variant === 'cover' ? 'text-white' : 'text-stone-800'
        }`}
        style={{ position: 'relative', zIndex: 10 }}
      >
        <div className="flex items-center gap-2">
          <span
            className={`text-[11px] font-bold px-3 py-1 rounded-full border shadow-2xs ${
              hasImage && variant === 'cover'
                ? 'bg-white/20 backdrop-blur-md text-white border-white/30'
                : 'bg-amber-100/80 text-amber-900 border-amber-200'
            }`}
          >
            ✦ {variant === 'cover' ? 'LIFESTYLE & MOOD' : `DAY ${padIndex}`}
          </span>
        </div>
        <span
          className={`text-xs font-mono font-semibold px-2 py-0.5 rounded-full ${
            hasImage && variant === 'cover'
              ? 'bg-black/30 backdrop-blur-md text-white/90'
              : 'bg-stone-100 text-stone-500'
          }`}
        >
          {padIndex} / {totalPad}
        </span>
      </div>

      {/* 2. MOOD MAIN CONTENT */}
      <div
        className="relative px-6 py-2.5 flex-1 flex flex-col justify-center min-h-0 overflow-hidden text-left"
        style={{ position: 'relative', zIndex: 10 }}
      >
        {/* --- VARIANT: COVER --- */}
        {variant === 'cover' && (
          <div className="flex-1 flex flex-col justify-center py-1 space-y-2 min-h-0">
            {hasImage ? (
              /* Frosted Glass Overlay Card over Photo */
              <div
                className="backdrop-blur-md border p-3.5 sm:p-4 rounded-3xl space-y-1.5 shadow-lg"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.90)',
                  borderColor: 'rgba(255, 255, 255, 0.85)',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
                  position: 'relative',
                  zIndex: 10,
                }}
              >
                <span className="text-[10px] font-bold tracking-wider uppercase text-amber-800 block">
                  ✦ MOOD CURATION
                </span>
                <h1 className={headlineClass}>
                  {card.title}
                </h1>
                {card.subtitle && (
                  <p className="text-xs text-stone-600 font-medium leading-snug break-keep pb-0.5">
                    {card.subtitle}
                  </p>
                )}
                {card.emphasis && card.emphasis.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {card.emphasis.slice(0, 3).map((kw, i) => (
                      <span
                        key={i}
                        className="text-[10px] font-semibold px-2 py-0.5 bg-amber-100/70 text-amber-900 rounded-full"
                      >
                        #{kw}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Cozy Cream Layout */
              <div className="space-y-3 py-1">
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-amber-700 tracking-wider uppercase block">
                    ✦ ESSENTIAL STORY
                  </span>
                  <h1 className={headlineClass}>{card.title || '감성 라이프스타일 가이드'}</h1>
                  {card.subtitle && (
                    <p className="text-xs text-stone-600 leading-relaxed break-keep pb-0.5">{card.subtitle}</p>
                  )}
                </div>

                <div className="p-3.5 rounded-3xl bg-amber-50/80 border border-amber-200/70 space-y-1">
                  <p className={`font-medium text-stone-700 ${bodyTextClass}`}>
                    {card.body || '일상의 따뜻한 감각과 실전 팁을 편안하게 읽을 수 있도록 정리했습니다.'}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- VARIANT: TEXT FOCUS (Soft Rounded Floating Card) --- */}
        {variant === 'text_focus' && (
          <div className="flex-1 flex flex-col justify-center space-y-2.5 py-1 min-h-0">
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-sm font-black font-serif text-amber-800">✦ POINT {padIndex}</span>
              <div className="h-px flex-1 bg-amber-200" />
            </div>

            <h2 className={headlineClass}>{card.title}</h2>

            <div className="p-3.5 rounded-3xl bg-white border border-amber-200/70 shadow-xs space-y-1.5">
              {bodyLines.map((line, lIdx) => (
                <p key={lIdx} className={`text-stone-700 font-medium ${bodyTextClass}`}>
                  {line}
                </p>
              ))}
            </div>

            {card.emphasis && card.emphasis.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-0.5 shrink-0">
                {card.emphasis.map((kw, i) => (
                  <span
                    key={i}
                    className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800"
                  >
                    #{kw}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- VARIANT: IMAGE FOCUS (Large Rounded Photo with Soft Glow) --- */}
        {variant === 'image_focus' && (
          <div className="flex-1 flex flex-col justify-between py-1 space-y-2 min-h-0">
            {hasImage ? (
              <div className={`relative w-full ${hasLongText ? 'h-28 sm:h-32' : 'h-36 sm:h-40'} rounded-3xl overflow-hidden border border-amber-200/60 shadow-md shrink-0`}>
                <img
                  src={activeImageUrl}
                  alt={card.title}
                  className="w-full h-full object-cover"
                  crossOrigin="anonymous"
                />
                <div className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-stone-900/60 backdrop-blur-md text-[10px] text-white font-medium">
                  ✦ {card.searchQuery || '감성 뷰'}
                </div>
              </div>
            ) : (
              <div className="w-full h-20 rounded-3xl bg-amber-50 border border-amber-200 flex items-center justify-center p-2.5 shrink-0">
                <span className="text-xs font-serif text-amber-800">
                  ✦ {card.subtitle || '감성 포인트'}
                </span>
              </div>
            )}

            <div className="space-y-1">
              <h2 className={headlineClass}>{card.title}</h2>
              <p className={`text-stone-600 ${bodyTextClass}`}>{card.body}</p>
            </div>
          </div>
        )}

        {/* --- VARIANT: SPLIT --- */}
        {variant === 'split' && (
          <div className="flex-1 flex flex-col justify-center space-y-2 py-1 min-h-0">
            <h2 className={headlineClass}>{card.title}</h2>
            <div className="grid grid-cols-2 gap-2.5">
              {hasImage ? (
                <div className="h-28 rounded-2xl overflow-hidden border border-amber-200 shadow-xs">
                  <img
                    src={activeImageUrl}
                    alt={card.title}
                    className="w-full h-full object-cover"
                    crossOrigin="anonymous"
                  />
                </div>
              ) : (
                <div className="h-28 rounded-2xl bg-amber-100/60 border border-amber-200 p-2.5 flex flex-col justify-center text-center">
                  <span className="text-xs font-bold text-amber-900">감성 포인트</span>
                  <span className="text-[11px] text-stone-700 mt-1">{card.emphasis?.[0] || '기준'}</span>
                </div>
              )}
              <div className="h-28 rounded-2xl bg-white border border-amber-200/70 p-2.5 flex flex-col justify-center">
                <p className={`text-stone-700 ${bodyTextClass}`}>{card.body}</p>
              </div>
            </div>
          </div>
        )}

        {/* --- VARIANT: NUMBER FOCUS --- */}
        {variant === 'number_focus' && (
          <div className="flex-1 flex flex-col justify-center space-y-2 py-1 min-h-0">
            <div className="w-9 h-9 rounded-2xl bg-amber-200/70 flex items-center justify-center text-amber-900 font-bold font-serif text-base shrink-0">
              {padIndex}
            </div>
            <div className="space-y-1">
              <h2 className={headlineClass}>{card.title}</h2>
              <p className={`text-stone-700 ${bodyTextClass}`}>{card.body}</p>
            </div>
          </div>
        )}

        {/* --- VARIANT: COMPARISON --- */}
        {variant === 'comparison' && (
          <div className="flex-1 flex flex-col justify-center space-y-2 py-1 min-h-0">
            <h2 className={headlineClass}>{card.title}</h2>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-2xl bg-amber-50 border border-amber-200 space-y-0.5">
                <span className="text-[10px] font-bold text-amber-900 block">✦ 추천 스타일</span>
                <p className="text-[11px] font-semibold text-stone-800 break-keep pb-0.5">{card.emphasis?.[0] || '장점'}</p>
              </div>
              <div className="p-2.5 rounded-2xl bg-orange-50 border border-orange-200 space-y-0.5">
                <span className="text-[10px] font-bold text-orange-900 block">✦ 체크 포인트</span>
                <p className="text-[11px] font-semibold text-stone-800 break-keep pb-0.5">
                  {card.emphasis?.[1] || card.subtitle || '주의'}
                </p>
              </div>
            </div>
            <p className={`text-stone-600 ${bodyTextClass}`}>{card.body}</p>
          </div>
        )}

        {/* --- VARIANT: TIP --- */}
        {variant === 'tip' && (
          <div className="flex-1 flex flex-col justify-center space-y-2 py-1 min-h-0">
            <div className="flex items-center gap-1.5 text-amber-800 text-xs font-bold shrink-0">
              <span>✦</span>
              <span>{card.cardRole === 'warning' ? '기억해 둘 점' : '감성 실전 TIP'}</span>
            </div>
            <h2 className={headlineClass}>{card.title}</h2>
            <div className="p-3.5 rounded-3xl bg-amber-100/70 border border-amber-300/80 shadow-xs">
              <p className={`text-stone-800 font-medium ${bodyTextClass}`}>{card.body}</p>
            </div>
          </div>
        )}

        {/* --- VARIANT: ENDING --- */}
        {variant === 'ending' && (
          <div className="flex-1 flex flex-col justify-between py-1 space-y-2 min-h-0">
            <div className="space-y-0.5 shrink-0">
              <span className="text-[10px] font-bold text-amber-800 uppercase block">
                ✦ SUMMARY NOTE
              </span>
              <h2 className={headlineClass}>{card.title || '오늘의 감성 요약'}</h2>
            </div>

            <div className="p-3 rounded-3xl bg-white border border-amber-200/70 space-y-1.5">
              {bodyLines.slice(0, 3).map((line, bIdx) => (
                <div key={bIdx} className="flex items-start gap-2 text-xs text-stone-700 leading-snug">
                  <span className="text-amber-800 text-[10px] mt-0.5">✦</span>
                  <span className="break-keep pb-0.5">{line}</span>
                </div>
              ))}
            </div>

            <div className="p-2 rounded-full bg-amber-900 text-amber-50 flex items-center justify-between px-4 text-xs font-bold shadow-sm shrink-0">
              <span>기억하고 싶은 순간 저장</span>
              <Bookmark className="w-3.5 h-3.5 fill-current" />
            </div>
          </div>
        )}
      </div>

      {/* 3. MOOD FOOTER */}
      <div
        className={`relative z-20 px-6 py-2.5 border-t flex items-center justify-between text-[10px] shrink-0 ${
          hasImage && variant === 'cover'
            ? 'border-white/20 text-white/80'
            : 'border-amber-100 text-stone-500'
        }`}
      >
        <span className="truncate max-w-[200px]">mood curation story</span>
        <span>♥ save</span>
      </div>
    </div>
  );
};

// ===========================================================================
// ④ INFORMATION CARD RENDERER (데이터 인포그래픽 & 가이드)
// Features: High-contrast royal blue headers, Giant Bold Numbers,
// Step badges, condition comparison tables with green/red checkmarks.
// ===========================================================================
const InformationCardRenderer: React.FC<TemplateRendererProps> = ({
  card,
  totalCards,
  theme,
  variant,
  hasImage,
  activeImageUrl,
  padIndex,
  totalPad,
  bodyLines,
}) => {
  const headlineClass = getHeadlineClass(card.title, 'information', variant, hasImage, (card.body || '').length);
  const bodyTextClass = getBodyTextClass(card.body || '', hasImage, variant);
  const hasLongText = (card.title || '').length > 24 || (card.body || '').length > 90;

  return (
    <div
      data-card-id={card.id}
      data-card-index={card.cardNumber}
      className="relative w-full aspect-square overflow-hidden select-none flex flex-col justify-between bg-white text-slate-900 border-2 border-blue-600 shadow-xl font-sans"
      style={{ backgroundColor: '#ffffff' }}
    >
      {/* 1. INFO TOP BANNER HEADER */}
      <div className="relative z-20 px-6 pt-3.5 pb-2 bg-blue-600 text-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black px-2 py-0.5 rounded bg-white text-blue-800 uppercase tracking-wider">
            {variant === 'cover' ? 'INFO GUIDE' : `STEP ${padIndex}`}
          </span>
          <span className="text-xs font-bold text-blue-100">
            {card.subtitle ? card.subtitle.slice(0, 20) : '핵심 가이드'}
          </span>
        </div>
        <div className="text-xs font-mono font-black text-blue-100">
          {padIndex} / {totalPad}
        </div>
      </div>

      {/* 2. INFO MAIN CONTENT */}
      <div className="relative z-10 px-6 py-2.5 flex-1 flex flex-col justify-center min-h-0 overflow-hidden text-left">
        {/* --- VARIANT: COVER --- */}
        {variant === 'cover' && (
          <div className="flex-1 flex flex-col justify-between py-1 space-y-2 min-h-0">
            <div className="space-y-1 shrink-0">
              <span className="text-[10px] font-black text-blue-700 tracking-wider uppercase block">
                [ 2026 필수 정보 가이드 ]
              </span>
              <h1 className={headlineClass}>{card.title || '알기 쉬운 정보 가이드'}</h1>
              {card.subtitle && (
                <p className="text-xs text-slate-600 font-semibold leading-relaxed break-keep pb-0.5">
                  {card.subtitle}
                </p>
              )}
            </div>

            {/* Checklist Highlights Badges */}
            <div className="grid grid-cols-1 gap-1 p-2.5 rounded-xl bg-blue-50/70 border border-blue-200 shrink-0">
              <div className="text-[11px] font-black text-blue-900 flex items-center gap-1.5">
                <CheckSquare className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>핵심 내용 요약 정리</span>
              </div>
              <p className={`text-slate-700 ${bodyTextClass}`}>
                {card.body || '놓치기 쉬운 주요 규정과 실전 꿀팁을 한눈에 보기 쉽게 정리했습니다.'}
              </p>
            </div>

            {card.emphasis && card.emphasis.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-0.5 shrink-0">
                {card.emphasis.map((kw, i) => (
                  <span
                    key={i}
                    className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-900 text-white"
                  >
                    ✓ {kw}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- VARIANT: NUMBER FOCUS (Giant Metric / Condition Block) --- */}
        {variant === 'number_focus' && (
          <div className="flex-1 flex flex-col justify-center space-y-2 py-1 min-h-0">
            {/* Giant Number / Condition Header Box */}
            <div className="p-3 rounded-xl bg-blue-50 border-2 border-blue-600 flex items-center justify-between shrink-0">
              <div>
                <span className="text-[10px] font-black text-blue-700 uppercase block">
                  STEP {padIndex} CONDITION
                </span>
                <span className="text-2xl sm:text-3xl font-black text-slate-950 font-mono tracking-tight">
                  {card.emphasis?.[0] || `POINT 0${padIndex}`}
                </span>
              </div>
              <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-black text-sm">
                {padIndex}
              </div>
            </div>

            <h2 className={headlineClass}>{card.title}</h2>

            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <p className={`text-slate-800 font-medium ${bodyTextClass}`}>{card.body}</p>
            </div>
          </div>
        )}

        {/* --- VARIANT: TEXT FOCUS --- */}
        {variant === 'text_focus' && (
          <div className="flex-1 flex flex-col justify-center space-y-2 py-1 min-h-0">
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-black px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                INFO #{padIndex}
              </span>
              <span className="text-xs font-bold text-slate-500">{card.subtitle || '주요 세부 항목'}</span>
            </div>

            <h2 className={headlineClass}>{card.title}</h2>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              {bodyLines.map((line, lIdx) => (
                <div key={lIdx} className="flex items-start gap-2 text-xs font-medium text-slate-800">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                  <span className="break-keep pb-0.5">{line}</span>
                </div>
              ))}
            </div>

            {card.emphasis && card.emphasis.length > 0 && (
              <div className="flex flex-wrap gap-1 shrink-0">
                {card.emphasis.map((kw, i) => (
                  <span
                    key={i}
                    className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200"
                  >
                    #{kw}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- VARIANT: COMPARISON (High-Contrast VS Table) --- */}
        {variant === 'comparison' && (
          <div className="flex-1 flex flex-col justify-center space-y-2 py-1 min-h-0">
            <h2 className={headlineClass}>{card.title}</h2>

            <div className="grid grid-cols-2 gap-2">
              {/* ALLOWED / POSITIVE */}
              <div className="p-2.5 rounded-lg bg-emerald-50 border-2 border-emerald-500 space-y-0.5">
                <div className="flex items-center justify-between text-[11px] font-black text-emerald-800 border-b border-emerald-200 pb-0.5">
                  <span>허용 / 권장</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <p className="text-[11px] font-bold text-emerald-950 break-keep pb-0.5">
                  {card.emphasis?.[0] || '허용 품목 기준'}
                </p>
              </div>

              {/* RESTRICTED / CAUTION */}
              <div className="p-2.5 rounded-lg bg-rose-50 border-2 border-rose-500 space-y-0.5">
                <div className="flex items-center justify-between text-[11px] font-black text-rose-800 border-b border-rose-200 pb-0.5">
                  <span>금지 / 주의</span>
                  <XCircle className="w-3.5 h-3.5 text-rose-600" />
                </div>
                <p className="text-[11px] font-bold text-rose-950 break-keep pb-0.5">
                  {card.emphasis?.[1] || card.subtitle || '금지 품목 기준'}
                </p>
              </div>
            </div>

            <p className={`text-slate-700 ${bodyTextClass}`}>{card.body}</p>
          </div>
        )}

        {/* --- VARIANT: IMAGE FOCUS --- */}
        {variant === 'image_focus' && (
          <div className="flex-1 flex flex-col justify-between py-1 space-y-1.5 min-h-0">
            {hasImage ? (
              <div className={`relative w-full ${hasLongText ? 'h-28 sm:h-32' : 'h-36 sm:h-40'} rounded-lg overflow-hidden border border-slate-300 shrink-0`}>
                <img
                  src={activeImageUrl}
                  alt={card.title}
                  className="w-full h-full object-cover"
                  crossOrigin="anonymous"
                />
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-blue-600 text-white text-[9px] font-bold">
                  참고 자료
                </div>
              </div>
            ) : (
              <div className="w-full h-20 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center p-2.5 text-center shrink-0">
                <span className="text-xs font-bold text-blue-900">
                  {card.subtitle || '정보 시각화 자료'}
                </span>
              </div>
            )}

            <div className="space-y-1">
              <h2 className={headlineClass}>{card.title}</h2>
              <p className={`text-slate-700 ${bodyTextClass}`}>{card.body}</p>
            </div>
          </div>
        )}

        {/* --- VARIANT: TIP / WARNING --- */}
        {variant === 'tip' && (
          <div className="flex-1 flex flex-col justify-center space-y-2 py-1 min-h-0">
            <div className="flex items-center gap-1.5 text-amber-700 font-bold text-xs shrink-0">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <span>{card.cardRole === 'warning' ? '필수 주의사항' : '실전 가이드 팁'}</span>
            </div>
            <h2 className={headlineClass}>{card.title}</h2>
            <div className="p-3 rounded-xl bg-amber-50 border-2 border-amber-400 space-y-0.5">
              <span className="text-[10px] font-black text-amber-900 uppercase block">
                MUST CHECK
              </span>
              <p className={`font-semibold text-slate-900 ${bodyTextClass}`}>{card.body}</p>
            </div>
          </div>
        )}

        {/* --- VARIANT: SPLIT --- */}
        {variant === 'split' && (
          <div className="flex-1 flex flex-col justify-center space-y-2 py-1 min-h-0">
            <h2 className={headlineClass}>{card.title}</h2>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 flex flex-col justify-center">
                <span className="text-[10px] font-bold text-blue-700">체크 01</span>
                <span className="text-xs font-black text-slate-900 mt-1 break-keep pb-0.5">
                  {card.emphasis?.[0] || '핵심 항목'}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-center">
                <span className="text-[10px] font-bold text-slate-500">체크 02</span>
                <span className="text-xs font-black text-slate-900 mt-1 break-keep pb-0.5">
                  {card.emphasis?.[1] || '세부 기준'}
                </span>
              </div>
            </div>
            <p className={`text-slate-700 ${bodyTextClass}`}>{card.body}</p>
          </div>
        )}

        {/* --- VARIANT: ENDING --- */}
        {variant === 'ending' && (
          <div className="flex-1 flex flex-col justify-between py-1 space-y-2 min-h-0">
            <div className="space-y-0.5 shrink-0">
              <span className="text-[10px] font-black text-blue-700 uppercase block">
                FINAL CHECKLIST
              </span>
              <h2 className={headlineClass}>{card.title || '핵심 총정리 체크리스트'}</h2>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              {bodyLines.slice(0, 3).map((line, bIdx) => (
                <div key={bIdx} className="flex items-start gap-2 text-xs font-semibold text-slate-800">
                  <CheckSquare className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                  <span className="break-keep pb-0.5">{line}</span>
                </div>
              ))}
            </div>

            <div className="p-2 rounded-lg bg-blue-600 text-white flex items-center justify-between text-xs font-bold shrink-0">
              <span>필요할 때 다시 보기 위해 저장하기</span>
              <Bookmark className="w-3.5 h-3.5" />
            </div>
          </div>
        )}
      </div>

      {/* 3. INFO FOOTER */}
      <div className="relative z-20 px-6 py-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500 bg-slate-50 shrink-0">
        <span className="font-bold truncate max-w-[220px]">
          {card.sourceContext ? card.sourceContext.slice(0, 35) : '인포메이션 가이드'}
        </span>
        <span className="font-mono font-bold text-blue-700">INFO GUIDE</span>
      </div>
    </div>
  );
};

// ===========================================================================
// ⑤ PHOTO STORY CARD RENDERER (포토 스토리텔링 & 비주얼)
// Features: 70~100% full bleed photo canvas, cinematic dark tone (#090D16),
// frosted translucent capsules, amber scene stamps (📍 SCENE 01).
// ===========================================================================
const PhotoStoryCardRenderer: React.FC<TemplateRendererProps> = ({
  card,
  totalCards,
  theme,
  variant,
  hasImage,
  activeImageUrl,
  padIndex,
  totalPad,
  bodyLines,
}) => {
  const headlineClass = getHeadlineClass(card.title, 'photo_story', variant, hasImage, (card.body || '').length);
  const bodyTextClass = getBodyTextClass(card.body || '', hasImage, variant);

  return (
    <div
      data-card-id={card.id}
      data-card-index={card.cardNumber}
      className="relative w-full aspect-square overflow-hidden select-none flex flex-col justify-between bg-[#090D16] text-white border-2 border-slate-800 shadow-2xl font-sans"
      style={{ backgroundColor: '#090D16' }}
    >
      {/* 100% Full Bleed Photo Background with Robust Multi-Layer Overlay */}
      {hasImage ? (
        <div
          className="absolute inset-0 overflow-hidden pointer-events-none"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 }}
        >
          {/* Photo Image Base Layer */}
          <img
            src={activeImageUrl}
            alt={card.title}
            className="w-full h-full object-cover brightness-[0.9] contrast-[1.05]"
            crossOrigin="anonymous"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: 'brightness(0.9) contrast(1.05)',
              display: 'block',
            }}
          />
          {/* Layer 1: Solid Semi-Transparent Dark Base Tint (100% guaranteed on any canvas) */}
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 2,
              backgroundColor: 'rgba(5, 8, 16, 0.48)',
              pointerEvents: 'none',
            }}
          />
          {/* Layer 2: Directional Cinematic Vignette / Gradient Overlay */}
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 3,
              background: 'linear-gradient(180deg, rgba(0, 0, 0, 0.20) 0%, rgba(0, 0, 0, 0.55) 45%, rgba(0, 0, 0, 0.92) 100%)',
              pointerEvents: 'none',
            }}
          />
        </div>
      ) : (
        <div
          className="absolute inset-0 overflow-hidden pointer-events-none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1,
            background: 'linear-gradient(180deg, #0f172a 0%, #050810 100%)',
            backgroundColor: '#090D16',
          }}
        >
          {/* Subtle Viewfinder Grid */}
          <div
            className="absolute inset-4 border rounded-xl pointer-events-none"
            style={{
              borderColor: 'rgba(255, 255, 255, 0.1)',
              borderWidth: '1px',
              borderStyle: 'solid',
            }}
          />
        </div>
      )}

      {/* 1. PHOTO STORY TOP HEADER */}
      <div
        className="relative px-6 pt-4 pb-2 flex items-center justify-between text-white shrink-0"
        style={{ position: 'relative', zIndex: 10 }}
      >
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] font-black px-2.5 py-1 rounded-full border text-amber-400 flex items-center gap-1"
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.65)',
              borderColor: 'rgba(255, 255, 255, 0.2)',
            }}
          >
            <Camera className="w-3 h-3" />
            <span>{variant === 'cover' ? 'PHOTO STORY' : `SCENE ${padIndex}`}</span>
          </span>
        </div>
        <div
          className="text-xs font-mono font-bold px-2 py-0.5 rounded-full text-white/90 border"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            borderColor: 'rgba(255, 255, 255, 0.15)',
          }}
        >
          {padIndex} / {totalPad}
        </div>
      </div>

      {/* 2. PHOTO STORY MAIN CONTENT */}
      <div
        className="relative px-6 py-2.5 flex-1 flex flex-col justify-center min-h-0 overflow-hidden text-left"
        style={{ position: 'relative', zIndex: 10 }}
      >
        {/* --- VARIANT: COVER --- */}
        {variant === 'cover' && (
          <div className="space-y-2 py-1">
            <div className="flex items-center gap-1.5 text-amber-400 text-xs font-black tracking-wider shrink-0">
              <MapPin className="w-3.5 h-3.5" />
              <span>📍 {card.searchQuery || 'SPECIAL SCENERY'}</span>
            </div>

            <h1
              className={headlineClass}
              style={{
                textShadow: '0 2px 12px rgba(0, 0, 0, 0.8), 0 1px 3px rgba(0, 0, 0, 0.9)',
              }}
            >
              {card.title || '포토 스토리 비주얼 가이드'}
            </h1>

            {card.subtitle && (
              <p
                className="text-xs font-medium text-slate-100 leading-relaxed break-keep pb-0.5"
                style={{
                  textShadow: '0 1px 6px rgba(0, 0, 0, 0.7)',
                }}
              >
                {card.subtitle}
              </p>
            )}

            {card.emphasis && card.emphasis.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-0.5 shrink-0">
                {card.emphasis.map((kw, i) => (
                  <span
                    key={i}
                    className="text-[10px] font-bold px-2.5 py-0.5 rounded-full text-white border"
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.22)',
                      borderColor: 'rgba(255, 255, 255, 0.3)',
                    }}
                  >
                    #{kw}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- VARIANT: IMAGE FOCUS (Hero Visual Story) --- */}
        {variant === 'image_focus' && (
          <div className="space-y-2 py-1">
            <div
              className="p-3.5 rounded-2xl border space-y-1 shadow-lg"
              style={{
                backgroundColor: 'rgba(9, 13, 22, 0.84)',
                borderColor: 'rgba(255, 255, 255, 0.22)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
              }}
            >
              <span className="text-[10px] font-mono font-bold text-amber-400 block">
                SCENE #{padIndex} STORY
              </span>
              <h2 className={headlineClass}>{card.title}</h2>
              <p className={`text-slate-200 font-normal ${bodyTextClass}`}>
                {card.body}
              </p>
            </div>
          </div>
        )}

        {/* --- VARIANT: TEXT FOCUS --- */}
        {variant === 'text_focus' && (
          <div className="space-y-2 py-1">
            <div
              className="p-3.5 rounded-2xl border space-y-1.5 shadow-lg"
              style={{
                backgroundColor: 'rgba(9, 13, 22, 0.84)',
                borderColor: 'rgba(255, 255, 255, 0.22)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
              }}
            >
              <span className="text-xs font-mono font-black text-amber-400">POINT {padIndex}</span>
              <h2 className={headlineClass}>{card.title}</h2>
              <p className={`text-slate-200 font-normal ${bodyTextClass}`}>{card.body}</p>
            </div>
          </div>
        )}

        {/* --- VARIANT: SPLIT --- */}
        {variant === 'split' && (
          <div className="space-y-2 py-1">
            <div
              className="p-3 rounded-2xl border space-y-1.5 shadow-lg"
              style={{
                backgroundColor: 'rgba(9, 13, 22, 0.84)',
                borderColor: 'rgba(255, 255, 255, 0.22)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
              }}
            >
              <h2 className={headlineClass}>{card.title}</h2>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-200">
                <div
                  className="p-2 rounded"
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.12)' }}
                >
                  <span className="text-amber-400 font-bold block text-[10px]">스팟 포인트</span>
                  <span className="break-keep pb-0.5">{card.emphasis?.[0] || '현장 분위기'}</span>
                </div>
                <div
                  className="p-2 rounded"
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.12)' }}
                >
                  <span className="text-slate-300 font-bold block text-[10px]">상세 정보</span>
                  <span className="break-keep pb-0.5">{card.emphasis?.[1] || card.subtitle || '주요 안내'}</span>
                </div>
              </div>
              <p className={`text-slate-300 ${bodyTextClass}`}>{card.body}</p>
            </div>
          </div>
        )}

        {/* --- VARIANT: NUMBER FOCUS --- */}
        {variant === 'number_focus' && (
          <div
            className="p-3.5 rounded-2xl border space-y-1.5 shadow-lg"
            style={{
              backgroundColor: 'rgba(9, 13, 22, 0.84)',
              borderColor: 'rgba(255, 255, 255, 0.22)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
            }}
          >
            <span className="text-2xl font-black font-mono text-amber-400 leading-none">{padIndex}</span>
            <h2 className={headlineClass}>{card.title}</h2>
            <p className={`text-slate-200 ${bodyTextClass}`}>{card.body}</p>
          </div>
        )}

        {/* --- VARIANT: COMPARISON --- */}
        {variant === 'comparison' && (
          <div
            className="p-3 rounded-2xl border space-y-1.5 shadow-lg"
            style={{
              backgroundColor: 'rgba(9, 13, 22, 0.86)',
              borderColor: 'rgba(255, 255, 255, 0.22)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
            }}
          >
            <h2 className={headlineClass}>{card.title}</h2>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div
                className="p-2 rounded border"
                style={{
                  backgroundColor: 'rgba(69, 26, 3, 0.65)',
                  borderColor: 'rgba(245, 158, 11, 0.4)',
                }}
              >
                <span className="text-amber-400 font-bold block text-[10px]">SCENE A</span>
                <span className="text-white font-medium break-keep pb-0.5">{card.emphasis?.[0] || '특징 A'}</span>
              </div>
              <div
                className="p-2 rounded border"
                style={{
                  backgroundColor: 'rgba(30, 41, 59, 0.65)',
                  borderColor: 'rgba(255, 255, 255, 0.2)',
                }}
              >
                <span className="text-slate-300 font-bold block text-[10px]">SCENE B</span>
                <span className="text-white font-medium break-keep pb-0.5">{card.emphasis?.[1] || '특징 B'}</span>
              </div>
            </div>
            <p className={`text-slate-300 ${bodyTextClass}`}>{card.body}</p>
          </div>
        )}

        {/* --- VARIANT: TIP --- */}
        {variant === 'tip' && (
          <div
            className="p-3.5 rounded-2xl border space-y-1 shadow-lg"
            style={{
              backgroundColor: 'rgba(9, 13, 22, 0.86)',
              borderColor: 'rgba(245, 158, 11, 0.5)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
            }}
          >
            <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest block">
              PHOTO & TRAVEL TIP
            </span>
            <h2 className={headlineClass}>{card.title}</h2>
            <p className={`text-slate-200 ${bodyTextClass}`}>{card.body}</p>
          </div>
        )}

        {/* --- VARIANT: ENDING --- */}
        {variant === 'ending' && (
          <div
            className="p-3.5 rounded-2xl border space-y-2 shadow-lg"
            style={{
              backgroundColor: 'rgba(9, 13, 22, 0.86)',
              borderColor: 'rgba(255, 255, 255, 0.22)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
            }}
          >
            <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider block">
              PHOTO STORY WRAP-UP
            </span>
            <h2 className={headlineClass}>{card.title || '스토리 요약'}</h2>
            <div className="space-y-1 text-xs text-slate-200">
              {bodyLines.slice(0, 3).map((line, bIdx) => (
                <div key={bIdx} className="flex items-start gap-1.5">
                  <span className="text-amber-400">•</span>
                  <span className="break-keep pb-0.5">{line}</span>
                </div>
              ))}
            </div>
            <div
              className="pt-1.5 border-t flex items-center justify-between text-[11px] text-amber-400 font-bold"
              style={{ borderColor: 'rgba(255, 255, 255, 0.15)' }}
            >
              <span>나만의 여행지에 저장</span>
              <Bookmark className="w-3.5 h-3.5 fill-current" />
            </div>
          </div>
        )}
      </div>

      {/* 3. PHOTO STORY FOOTER */}
      <div
        className="relative px-6 py-2 border-t flex items-center justify-between text-[10px] text-slate-400 shrink-0"
        style={{
          position: 'relative',
          zIndex: 10,
          backgroundColor: 'rgba(5, 8, 16, 0.75)',
          borderColor: 'rgba(255, 255, 255, 0.12)',
        }}
      >
        <span className="truncate max-w-[220px]">
          📍 {card.sourceContext ? card.sourceContext.slice(0, 35) : 'PHOTO STORY ARCHIVE'}
        </span>
        <span className="font-mono text-amber-400">VISUAL LOG</span>
      </div>
    </div>
  );
};

// ===========================================================================
// ⑥ CUTE / PASTEL CARD RENDERER (큐트/파스텔)
// Features: Pastel pink/mint/lavender/cream tones, rounded blobs, dotted patterns,
// rounded badges, speech bubbles, cute icons, hand-drawn highlights.
// ===========================================================================
const CutePastelCardRenderer: React.FC<TemplateRendererProps> = ({
  card,
  totalCards,
  theme,
  variant,
  hasImage,
  activeImageUrl,
  padIndex,
  totalPad,
  bodyLines,
}) => {
  const headlineClass = getHeadlineClass(card.title, 'cute_pastel', variant, hasImage, (card.body || '').length);
  const bodyTextClass = getBodyTextClass(card.body || '', hasImage, variant);
  const hasLongText = (card.title || '').length > 24 || (card.body || '').length > 90;

  return (
    <div
      data-card-id={card.id}
      data-card-index={card.cardNumber}
      className="relative w-full aspect-square overflow-hidden select-none flex flex-col justify-between border-2 border-pink-200/90 shadow-md font-sans rounded-3xl"
      style={{
        backgroundColor: '#fffdfb',
        backgroundImage: 'radial-gradient(#fbcfe8 0.75px, transparent 0.75px), radial-gradient(#d1fae5 0.75px, #fffdfb 0.75px)',
        backgroundSize: '24px 24px',
        backgroundPosition: '0 0, 12px 12px',
      }}
    >
      {/* Pastel Decorative Blobs */}
      <div
        className="absolute -top-12 -right-12 w-36 h-36 rounded-full opacity-60 pointer-events-none filter blur-xl"
        style={{ backgroundColor: '#fce7f3' }}
      />
      <div
        className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full opacity-50 pointer-events-none filter blur-xl"
        style={{ backgroundColor: '#dcfce7' }}
      />

      {/* 1. TOP CUTE NAV BAR */}
      <div className="relative z-20 px-6 pt-4 pb-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5 px-3 py-1 bg-white/90 backdrop-blur-xs border border-pink-200 rounded-full shadow-2xs">
          <Sparkles className="w-3.5 h-3.5 text-pink-500 fill-pink-300" />
          <span className="text-[11px] font-bold text-pink-700">
            {variant === 'cover' ? 'CUTE GUIDE' : `TIP #${padIndex}`}
          </span>
        </div>
        <div className="flex items-center gap-1 px-2.5 py-0.5 bg-pink-100/90 text-pink-600 font-mono text-[11px] font-bold rounded-full border border-pink-200">
          <span>{padIndex}</span>
          <span className="text-pink-300">/</span>
          <span>{totalPad}</span>
        </div>
      </div>

      {/* 2. CUTE MAIN CONTENT */}
      <div className="relative z-10 px-6 py-2 flex-1 flex flex-col justify-center min-h-0 overflow-hidden text-left">
        {/* --- VARIANT: COVER --- */}
        {variant === 'cover' && (
          <div className="flex-1 flex flex-col justify-between py-1 space-y-2.5 min-h-0">
            <div className="space-y-1.5 shrink-0">
              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-100 text-amber-800 text-[10.5px] font-extrabold rounded-md border border-amber-200">
                <Star className="w-3 h-3 text-amber-500 fill-amber-400" />
                <span>알짜 정보 모음</span>
              </div>
              <h1 className={headlineClass}>{card.title || '귀엽고 유용한 꿀팁'}</h1>
              {card.subtitle && (
                <p className="text-xs font-medium text-pink-700/80 leading-relaxed break-keep pb-0.5">
                  {card.subtitle}
                </p>
              )}
            </div>

            {hasImage ? (
              <div className={`relative w-full ${hasLongText ? 'h-24 sm:h-28' : 'h-32 sm:h-36'} rounded-2xl overflow-hidden border-2 border-pink-200 bg-white p-1 shrink-0 shadow-xs`}>
                <img
                  src={activeImageUrl}
                  alt={card.title}
                  className="w-full h-full object-cover rounded-xl"
                  crossOrigin="anonymous"
                />
                <span className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/60 backdrop-blur-xs text-white text-[9px] font-medium rounded-full">
                  Photo
                </span>
              </div>
            ) : (
              <div className="p-3.5 bg-white/95 rounded-2xl border-2 border-pink-200 shadow-xs relative">
                <div className="absolute -top-2 left-6 w-4 h-4 bg-white border-t-2 border-l-2 border-pink-200 transform rotate-45" />
                <p className={`text-stone-700 font-medium ${bodyTextClass}`}>
                  {card.body || '초보자도 1분 만에 따라할 수 있는 핵심 포인트를 친절하게 정리해드립니다.'}
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-1.5 pt-1 shrink-0">
              {card.emphasis?.slice(0, 3).map((kw, i) => (
                <span
                  key={i}
                  className="text-[10.5px] font-bold text-pink-700 px-2.5 py-0.5 bg-pink-100/90 border border-pink-300 rounded-full"
                >
                  #{kw}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* --- VARIANT: TEXT FOCUS --- */}
        {variant === 'text_focus' && (
          <div className="flex-1 flex flex-col justify-center space-y-3 py-1 min-h-0">
            <div className="space-y-1 shrink-0">
              <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10.5px] font-extrabold rounded-md border border-emerald-200">
                CHECK POINT
              </span>
              <h2 className={headlineClass}>{card.title}</h2>
              {card.subtitle && (
                <p className="text-[11px] text-pink-600 font-semibold">{card.subtitle}</p>
              )}
            </div>

            <div className="space-y-2 py-1">
              {bodyLines.map((line, lIdx) => (
                <div
                  key={lIdx}
                  className="p-3 bg-white/95 rounded-2xl border-2 border-pink-100 shadow-2xs flex items-start gap-2.5"
                >
                  <span className="w-5 h-5 rounded-full bg-pink-200 text-pink-700 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                    {lIdx + 1}
                  </span>
                  <p className="text-xs text-stone-700 font-medium leading-relaxed break-keep flex-1">
                    {line}
                  </p>
                </div>
              ))}
            </div>

            {card.emphasis && card.emphasis.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1 shrink-0">
                {card.emphasis.slice(0, 3).map((kw, i) => (
                  <span
                    key={i}
                    className="text-[10px] font-bold text-purple-700 px-2.5 py-0.5 bg-purple-100 border border-purple-200 rounded-full"
                  >
                    ★ {kw}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- VARIANT: TIP / WARNING --- */}
        {variant === 'tip' && (
          <div className="flex-1 flex flex-col justify-between py-1 space-y-2.5 min-h-0">
            <div className="space-y-1 shrink-0">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-100 text-amber-900 text-[11px] font-black rounded-full border border-amber-300">
                <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                놓치기 쉬운 핵심 TIP
              </span>
              <h2 className={headlineClass}>{card.title}</h2>
            </div>

            <div className="p-4 bg-amber-50/90 rounded-3xl border-2 border-amber-200 shadow-xs space-y-2">
              <p className={`text-amber-950 font-medium leading-relaxed ${bodyTextClass}`}>
                {card.body}
              </p>
              {card.subtitle && (
                <p className="text-[11px] font-bold text-amber-700 border-t border-amber-200/80 pt-2">
                  👉 {card.subtitle}
                </p>
              )}
            </div>

            {card.emphasis && card.emphasis.length > 0 && (
              <div className="flex items-center gap-1.5 pt-1 shrink-0">
                {card.emphasis.slice(0, 3).map((kw, i) => (
                  <span
                    key={i}
                    className="text-[10.5px] font-bold text-amber-800 px-2.5 py-0.5 bg-white border border-amber-300 rounded-full shadow-2xs"
                  >
                    💡 {kw}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- VARIANT: IMAGE FOCUS / SPLIT --- */}
        {(variant === 'image_focus' || variant === 'split') && (
          <div className="flex-1 flex flex-col justify-between py-1 space-y-2 min-h-0">
            <div className="space-y-1 shrink-0">
              <h2 className={headlineClass}>{card.title}</h2>
            </div>

            {hasImage ? (
              <div className="relative w-full h-32 sm:h-36 rounded-2xl overflow-hidden border-2 border-pink-200 bg-white p-1 shrink-0 shadow-xs">
                <img
                  src={activeImageUrl}
                  alt={card.title}
                  className="w-full h-full object-cover rounded-xl"
                  crossOrigin="anonymous"
                />
              </div>
            ) : null}

            <div className="p-3 bg-white/95 rounded-2xl border-2 border-pink-100 shadow-2xs">
              <p className={`text-stone-700 font-medium ${bodyTextClass}`}>
                {card.body}
              </p>
            </div>
          </div>
        )}

        {/* --- VARIANT: COMPARISON --- */}
        {variant === 'comparison' && (
          <div className="flex-1 flex flex-col justify-between py-1 space-y-2.5 min-h-0">
            <div className="space-y-1 shrink-0">
              <span className="inline-block px-2.5 py-0.5 bg-indigo-100 text-indigo-800 text-[10.5px] font-extrabold rounded-md border border-indigo-200">
                VS 비교 포인트
              </span>
              <h2 className={headlineClass}>{card.title}</h2>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 bg-white rounded-2xl border-2 border-pink-200 shadow-2xs space-y-1">
                <span className="text-[10px] font-black text-pink-600 block">장점 / 추천</span>
                <p className="text-[11px] text-stone-700 font-medium leading-tight">
                  {bodyLines[0] || '편리하고 빠른 장점'}
                </p>
              </div>
              <div className="p-3 bg-white rounded-2xl border-2 border-sky-200 shadow-2xs space-y-1">
                <span className="text-[10px] font-black text-sky-600 block">주의점 / 체크</span>
                <p className="text-[11px] text-stone-700 font-medium leading-tight">
                  {bodyLines[1] || '사전 확인 필수 사항'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* --- VARIANT: NUMBER FOCUS --- */}
        {variant === 'number_focus' && (
          <div className="flex-1 flex flex-col justify-center space-y-2.5 py-1 min-h-0">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-2xl bg-gradient-to-br from-pink-400 to-rose-400 text-white font-black text-lg flex items-center justify-center shadow-xs">
                {padIndex}
              </span>
              <div className="space-y-0.5 flex-1">
                <span className="text-[10.5px] font-bold text-pink-600 uppercase">STEP BY STEP</span>
                <h2 className={headlineClass}>{card.title}</h2>
              </div>
            </div>

            <div className="p-3.5 bg-white/95 rounded-2xl border-2 border-pink-200 shadow-xs">
              <p className={`text-stone-700 font-medium leading-relaxed ${bodyTextClass}`}>
                {card.body}
              </p>
            </div>
          </div>
        )}

        {/* --- VARIANT: ENDING --- */}
        {variant === 'ending' && (
          <div className="flex-1 flex flex-col justify-center text-center space-y-3 py-1 min-h-0">
            <div className="w-12 h-12 mx-auto rounded-full bg-pink-100 border-2 border-pink-300 flex items-center justify-center text-pink-600">
              <Sparkles className="w-6 h-6 fill-pink-300" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-black text-pink-950">{card.title || '도움이 되셨나요?'}</h2>
              <p className="text-xs text-pink-800/80 font-medium leading-relaxed">
                {card.body || '좋아요와 저장을 눌러 필요할 때마다 꺼내보세요!'}
              </p>
            </div>
            <div className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold text-xs rounded-full shadow-sm mx-auto">
              <span>저장하고 나중에 보기</span>
              <Bookmark className="w-3.5 h-3.5 fill-current" />
            </div>
          </div>
        )}
      </div>

      {/* 3. CUTE FOOTER */}
      <div className="relative px-6 py-2 border-t border-pink-200/80 bg-white/70 backdrop-blur-xs flex items-center justify-between text-[10.5px] text-pink-800/70 shrink-0">
        <span className="truncate max-w-[220px] font-medium">
          🌸 {card.sourceContext ? card.sourceContext.slice(0, 30) : 'PASTEL TIPS'}
        </span>
        <span className="font-bold text-pink-600">SWEET CARD</span>
      </div>
    </div>
  );
};
