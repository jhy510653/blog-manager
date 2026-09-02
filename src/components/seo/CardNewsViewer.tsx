import React, { useState, useRef } from 'react';
import { safeCaptureHtmlToCanvas } from '../../utils/canvasExportUtils';
import { CardNewsResult, CardNewsSlide, CardNewsItem } from '../../types';
import { CardNewsCardRenderer } from './CardNewsCardRenderer';
import { Layers, Copy, Check, ChevronLeft, ChevronRight, Download, RefreshCw, Plus } from 'lucide-react';
import { downloadSingleImage } from '../../utils/imageIntegrationUtils';

interface CardNewsViewerProps {
  cardNews: CardNewsResult & { aiGraphicStyle?: string; graphicImages?: string[] };
  onClose?: () => void;
  onShowToast?: (msg: string) => void;
  onInsertToDraft?: (cardNews: CardNewsResult) => void;
}

export const CardNewsViewer: React.FC<CardNewsViewerProps> = ({
  cardNews,
  onClose,
  onShowToast,
  onInsertToDraft,
}) => {
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);
  const [copiedSlide, setCopiedSlide] = useState<boolean>(false);
  const [copiedAll, setCopiedAll] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  const cardCanvasRef = useRef<HTMLDivElement>(null);
  const slides = cardNews.slides || [];
  const cardsList: CardNewsItem[] = cardNews.engineResult?.cards || [];
  const currentSlide: CardNewsSlide | undefined = slides[currentSlideIndex];
  const currentCardItem: CardNewsItem | undefined = cardsList[currentSlideIndex];

  // 사용자가 선택한 그래픽 스타일 및 생성된 이미지 매핑 보완
  const selectedStyle = cardNews.aiGraphicStyle || 'photoreal';
  const graphicImages = cardNews.graphicImages || [];
  const assignedImageUrl = currentCardItem?.imageUrl || graphicImages[currentSlideIndex] || (cardNews as any).imageUrl;

  // Map CardNewsSlide or CardNewsItem format for CardNewsCardRenderer with style & image injection
  const mappedCard: CardNewsItem | null = currentCardItem || (currentSlide
    ? {
        cardNumber: currentSlide.slideNumber,
        title: currentSlide.title,
        subtitle: currentSlide.subtitle,
        body: '',
        contentPoints: currentSlide.contentPoints,
        imageSource: assignedImageUrl ? 'ai_graphic' : ((currentSlide as any).imageSource || 'none'),
        imageUrl: assignedImageUrl,
        layout: (currentSlide.type as any) || 'content',
        cta: currentSlide.highlightText,
      }
    : null);

  // 만약 currentCardItem이 존재하더라도 스타일과 이미지가 누락되었다면 안전하게 보정
  if (mappedCard) {
    if (!mappedCard.imageUrl && assignedImageUrl) {
      mappedCard.imageUrl = assignedImageUrl;
      mappedCard.imageSource = 'ai_graphic';
    }
  }

  const handleDownloadCurrentCardImage = async () => {
    if (!cardCanvasRef.current || !currentSlide) return;

    try {
      setIsDownloading(true);
      const canvas = await safeCaptureHtmlToCanvas(cardCanvasRef.current);

      const dataUrl = canvas.toDataURL('image/png');
      const fileName = `card-news-${String(currentSlide.slideNumber).padStart(2, '0')}-${(cardNews.keyword || 'card').replace(/\s+/g, '_')}.png`;
      await downloadSingleImage(dataUrl, fileName);
      onShowToast?.(`슬라이드 #${currentSlide.slideNumber} 이미지가 성공적으로 다운로드되었습니다!`);
    } catch (err) {
      console.error('Download slide error:', err);
      onShowToast?.('카드 이미지 다운로드 중 오류가 발생했습니다.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopySlideText = () => {
    if (!currentSlide) return;
    const text = `[슬라이드 ${currentSlide.slideNumber}/${slides.length}]\n제목: ${currentSlide.title}\n${
      currentSlide.subtitle ? `부제목: ${currentSlide.subtitle}\n` : ''
    }\n핵심 내용:\n${currentSlide.contentPoints.map((p) => `- ${p}`).join('\n')}\n${
      currentSlide.highlightText ? `\n포인트: ${currentSlide.highlightText}` : ''
    }`;
    navigator.clipboard.writeText(text);
    setCopiedSlide(true);
    onShowToast?.(`슬라이드 ${currentSlide.slideNumber}번 텍스트가 복사되었습니다!`);
    setTimeout(() => setCopiedSlide(false), 2000);
  };

  const handleCopyAllSlidesText = () => {
    const fullText =
      `📱 [카드뉴스 요약] - ${cardNews.title}\n\n` +
      slides
        .map(
          (s) =>
            `=== 슬라이드 ${s.slideNumber} (${s.type.toUpperCase()}) ===\n` +
            `제목: ${s.title}\n` +
            (s.subtitle ? `서브타이틀: ${s.subtitle}\n` : '') +
            `포인트:\n${s.contentPoints.map((p) => `- ${p}`).join('\n')}\n` +
            (s.highlightText ? `강조: ${s.highlightText}\n` : '')
        )
        .join('\n\n');

    navigator.clipboard.writeText(fullText);
    setCopiedAll(true);
    onShowToast?.('카드뉴스 전체 슬라이드 텍스트가 복사되었습니다!');
    setTimeout(() => setCopiedAll(false), 2000);
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-3xl p-6 text-slate-900 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
              <span>카드뉴스 미리보기</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200">
                {slides.length}장 슬라이드
              </span>
            </h3>
            <p className="text-xs text-slate-500">{cardNews.title || cardNews.keyword}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onInsertToDraft && (
            <button
              onClick={() => {
                onInsertToDraft(cardNews);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-2xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>본문에 카드뉴스 추가</span>
            </button>
          )}
          <button
            onClick={handleCopyAllSlidesText}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition-colors cursor-pointer"
          >
            {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
            <span>전체 텍스트 복사</span>
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-slate-900 px-3 py-1 text-sm font-bold rounded-xl bg-slate-100 hover:bg-slate-200 cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Main Slide Carousel Area */}
      {mappedCard ? (
        <div className="space-y-4">
          <div className="relative max-w-md mx-auto w-full">
            <CardNewsCardRenderer
              ref={cardCanvasRef}
              card={mappedCard}
              totalCards={slides.length}
              keyword={cardNews.keyword}
              styleName={cardNews.engineResult?.style}
              globalStyle={selectedStyle || cardNews.aiGraphicStyle || cardNews.engineResult?.globalStyle || (mappedCard as any).style || 'photoreal'}
            />
          </div>

          {/* Carousel Nav Controls */}
          <div className="flex items-center justify-between pt-2 max-w-md mx-auto">
            <button
              onClick={() => setCurrentSlideIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentSlideIndex === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-xs font-medium text-slate-700 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>이전</span>
            </button>

            {/* Slide Dot Indicators */}
            <div className="flex items-center space-x-1.5">
              {slides.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSlideIndex(idx)}
                  className={`h-2.5 rounded-full transition-all cursor-pointer ${
                    idx === currentSlideIndex
                      ? 'bg-emerald-600 w-6'
                      : 'bg-slate-300 hover:bg-slate-400 w-2.5'
                  }`}
                />
              ))}
            </div>

            <button
              onClick={() => setCurrentSlideIndex((prev) => Math.min(slides.length - 1, prev + 1))}
              disabled={currentSlideIndex === slides.length - 1}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-xs font-medium text-slate-700 transition-colors cursor-pointer"
            >
              <span>다음</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center justify-between gap-2 max-w-md mx-auto pt-1">
            <button
              onClick={handleDownloadCurrentCardImage}
              disabled={isDownloading}
              className="flex items-center justify-center gap-2 flex-1 py-2.5 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isDownloading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4 text-emerald-400" />
              )}
              <span>현재 카드 이미지 다운로드</span>
            </button>

            <button
              onClick={handleCopySlideText}
              className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              {copiedSlide ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>텍스트 복사</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-slate-400 text-sm">
          생성된 슬라이드가 없습니다.
        </div>
      )}
    </div>
  );
};