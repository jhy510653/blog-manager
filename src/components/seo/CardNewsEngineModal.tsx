import React, { useState, useEffect, useRef } from "react";
import { generateCardNewsPlan } from "../../utils/imagePipeline";
import { safeCaptureHtmlToCanvas } from "../../utils/canvasExportUtils";
import { CardNewsCardRenderer } from "./CardNewsCardRenderer";
import { downloadSingleImage } from "../../utils/imageIntegrationUtils";
import {
  AiGraphicStyleKey,
  buildAiGraphicPrompt,
  AI_GRAPHIC_STYLES,
} from "../../utils/aiGraphicUtils";
import {
  CardNewsEngineResult,
  CardNewsItem,
  CardNewsStyle,
  CardImageSource,
  CardLayout,
  GraphicElementType,
  GraphicElementsData,
  UserUsageLimits,
} from "../../types";
import {
  Layers,
  Sparkles,
  Upload,
  Image as ImageIcon,
  Edit3,
  RefreshCw,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  X,
  FileText,
  Sliders,
  CheckCircle2,
  Table,
  BarChart2,
  ListOrdered,
  Plus,
  Trash2,
  Download,
  Info,
  Zap,
} from "lucide-react";

interface CardNewsEngineModalProps {
  isOpen: boolean;
  onClose: () => void;
  draftContent?: string;
  seoPlan?: any;
  userInput?: string;
  keyword?: string;
  onShowToast?: (msg: string) => void;
  usageLimits?: UserUsageLimits;
  onUpdateUsage?: (
    type: "text" | "card" | "ai_graphic",
    count?: number,
  ) => void;
}

export const CardNewsEngineModal: React.FC<CardNewsEngineModalProps> = ({
  isOpen,
  onClose,
  draftContent = "",
  seoPlan,
  userInput = "",
  keyword = "블로그 포스팅",
  onShowToast,
  usageLimits,
  onUpdateUsage,
}) => {
  // Configuration options
  const [cardCount, setCardCount] = useState<number>(6);
  const [selectedStyle, setSelectedStyle] = useState<CardNewsStyle>("info");
  const [imageMode, setImageMode] = useState<
    | "auto"
    | "user_photo_first"
    | "free_image_first"
    | "graphic_first"
    | "ai_graphic_first"
  >("auto");
  const [aiGraphicStyle, setAiGraphicStyle] =
    useState<AiGraphicStyleKey>("photoreal");
  const [userPhotos, setUserPhotos] = useState<string[]>([]);

  // Generation State
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationStep, setGenerationStep] = useState<string>("");
  const [engineResult, setEngineResult] = useState<CardNewsEngineResult | null>(
    null,
  );

  // Active view and card index
  const [activeCardIndex, setActiveCardIndex] = useState<number>(0);
  const [viewMode, setViewMode] = useState<"carousel" | "grid">("carousel");

  // Single card editing modal
  const [editingCard, setEditingCard] = useState<CardNewsItem | null>(null);
  const [isEditingModalOpen, setIsEditingModalOpen] = useState<boolean>(false);

  // Single AI graphic loading state
  const [generatingGraphicCardIndex, setGeneratingGraphicCardIndex] = useState<
    number | null
  >(null);

  // Copy feedback state
  const [copiedSlide, setCopiedSlide] = useState<boolean>(false);
  const [copiedAll, setCopiedAll] = useState<boolean>(false);

  // Download state & card ref
  const cardCanvasRef = useRef<HTMLDivElement>(null);
  const [isDownloadingImage, setIsDownloadingImage] = useState<boolean>(false);

  // Download current active card as PNG image
  const handleDownloadCurrentCardImage = async () => {
    if (!cardCanvasRef.current || !engineResult) return;
    const activeCard = engineResult.cards[activeCardIndex];
    if (!activeCard) return;

    try {
      setIsDownloadingImage(true);
      const canvas = await safeCaptureHtmlToCanvas(cardCanvasRef.current);

      const dataUrl = canvas.toDataURL("image/png");
      const fileName = `card-news-${String(activeCard.cardNumber).padStart(2, "0")}-${(engineResult.keyword || "card").replace(/\s+/g, "_")}.png`;
      await downloadSingleImage(dataUrl, fileName);
      onShowToast(
        `슬라이드 #${activeCard.cardNumber} 이미지가 성공적으로 다운로드되었습니다!`,
      );
    } catch (err) {
      console.error("Download card error:", err);
      onShowToast("카드 이미지 다운로드 중 오류가 발생했습니다.");
    } finally {
      setIsDownloadingImage(false);
    }
  };

  if (!isOpen) return null;

  // Photo upload handler
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newPhotos: string[] = [];
    Array.from(files).forEach((file: File) => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            newPhotos.push(event.target.result as string);
            if (newPhotos.length === files.length) {
              setUserPhotos((prev) => [...prev, ...newPhotos]);
              onShowToast(`${files.length}장의 사용자 사진이 추가되었습니다.`);
            }
          }
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const handleRemovePhoto = (index: number) => {
    setUserPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  // Main Card News Generation Call
  const handleGenerateCardNews = async () => {
    if (usageLimits && usageLimits.role !== "admin") {
      const cardLimit =
        usageLimits.dailyCardGenerationLimit ||
        usageLimits.monthlyCardGenerationLimit ||
        10;
      if (usageLimits.cardGenerationCount >= cardLimit) {
        onShowToast(
          `⚠️ 일반 회원은 카드뉴스를 1일 최대 ${cardLimit}회까지만 생성할 수 있습니다. (오늘 사용량: ${usageLimits.cardGenerationCount}/${cardLimit}회)`,
        );
        return;
      }
    }

    setIsGenerating(true);
    setGenerationStep("카드뉴스 핵심 슬라이드 구조 및 텍스트 구성 중...");

    try {
      // Step 1: Call Card News Toolkit Endpoint (using new cardnews_plan)
      const cardPlanResult = await generateCardNewsPlan(
        draftContent || keyword,
        cardCount,
        [],
      );

      let parsedResult: CardNewsEngineResult = {
        keyword: keyword,
        title: cardPlanResult.title || cardPlanResult.cards[0]?.title || cardPlanResult.cards[0]?.headline || `${keyword} 핵심 가이드`,
        style: selectedStyle,
        globalStyle: aiGraphicStyle,
        imageMode: imageMode,
        totalCards: cardPlanResult.cards.length,
        cards: cardPlanResult.cards.map((c: any) => ({
          cardNumber: c.cardNumber,
          title: c.title || c.headline || `${c.cardNumber}. 핵심 요약`,
          subtitle: c.subtitle || c.subheadline || '',
          body: c.body || '',
          contentPoints: c.contentPoints || (c.body ? [c.body] : []),
          layout: c.layout || 'content',
          style: aiGraphicStyle,
          searchQueries: c.searchQueries || [],
          imagePrompt: c.imagePrompt || '',
          subject: c.subject || c.title,
          reason: c.reason || '',
          preferredSource: c.preferredSource || 'unsplash',
          imageMode: imageMode,
          imageSource: imageMode === "ai_graphic_first" ? "ai_graphic" : "none",
        })),
        userPhotosUsed: userPhotos,
      };

      setGenerationStep("카드별 이미지 소스 매핑 및 인포그래픽 구성 중...");
      const isAiGraphicMode =
        imageMode === "ai_graphic_first" || imageMode === "graphic_first";
      const isFreeImageMode = imageMode === "free_image_first";

      const updatedCards: CardNewsItem[] = await Promise.all(
        parsedResult.cards.map(async (card, idx) => {
          let updatedCard = { ...card, imageMode: imageMode };

          // If user enforced AI graphic or free image mode, update imageSource if not user photo
          if (isAiGraphicMode && updatedCard.imageSource !== "user_photo") {
            updatedCard.imageSource = "ai_graphic";
          } else if (
            isFreeImageMode &&
            updatedCard.imageSource !== "user_photo"
          ) {
            updatedCard.imageSource = "free_image";
          }

          // 1. User photo assigned and user photos exist
          if (
            updatedCard.imageSource === "user_photo" &&
            userPhotos.length > 0
          ) {
            updatedCard.imageUrl = userPhotos[idx % userPhotos.length];
          }
          // 2. Free Image assigned
          else if (updatedCard.imageSource === "free_image") {
            const cardContentSnippet = [
              parsedResult.keyword || keyword,
              updatedCard.title,
              updatedCard.subtitle,
              updatedCard.body,
              ...(updatedCard.contentPoints || []),
            ]
              .filter(Boolean)
              .join(" ");
            const cleanKw = encodeURIComponent(
              cardContentSnippet.slice(0, 180),
            );
            updatedCard.imageUrl = `https://image.pollinations.ai/prompt/${cleanKw}%20high%20quality%20photography%20no%20text?width=800&height=800&nologo=true&seed=${idx}_${Date.now()}`;
          }

          return updatedCard;
        }),
      );

      parsedResult.cards = updatedCards;
      setEngineResult(parsedResult);
      setActiveCardIndex(0);

      if (onUpdateUsage) {
        onUpdateUsage("card", 1);
      }

      onShowToast(`총 ${updatedCards.length}장의 카드뉴스가 생성되었습니다!`);
    } catch (err: any) {
      console.error("Card news engine error:", err);
      onShowToast(err.message || "카드뉴스 생성 중 오류가 발생했습니다.");
    } finally {
      setIsGenerating(false);
      setGenerationStep("");
    }
  };

  // Save single card changes from editing modal
  const handleSaveCardEdit = () => {
    if (!editingCard || !engineResult) return;
    const updatedCards = engineResult.cards.map((c) =>
      c.cardNumber === editingCard.cardNumber ? editingCard : c,
    );
    setEngineResult({ ...engineResult, cards: updatedCards });
    setIsEditingModalOpen(false);
    setEditingCard(null);
    onShowToast(
      `슬라이드 #${editingCard.cardNumber} 수정 내용이 반영되었습니다.`,
    );
  };

  // Copy actions
  const handleCopyCurrentCardText = () => {
    if (!engineResult) return;
    const card = engineResult.cards[activeCardIndex];
    if (!card) return;

    const text = `[카드뉴스 #${card.cardNumber}/${engineResult.cards.length}]\n제목: ${card.title}\n${
      card.subtitle ? `부제목: ${card.subtitle}\n` : ""
    }${card.body ? `내용: ${card.body}\n` : ""}\n포인트:\n${
      card.contentPoints?.map((p) => `- ${p}`).join("\n") || ""
    }\n${card.cta ? `\nCTA: ${card.cta}` : ""}`;

    navigator.clipboard.writeText(text);
    setCopiedSlide(true);
    onShowToast(`슬라이드 #${card.cardNumber} 텍스트가 복사되었습니다.`);
    setTimeout(() => setCopiedSlide(false), 2000);
  };

  const handleCopyAllCardsText = () => {
    if (!engineResult) return;
    const fullText =
      `📱 [카드뉴스 요약] - ${engineResult.title}\n\n` +
      engineResult.cards
        .map(
          (c) =>
            `=== 슬라이드 #${c.cardNumber} (${c.layout.toUpperCase()}) ===\n` +
            `제목: ${c.title}\n` +
            (c.subtitle ? `부제목: ${c.subtitle}\n` : "") +
            (c.body ? `본문: ${c.body}\n` : "") +
            `포인트:\n${c.contentPoints?.map((p) => `- ${p}`).join("\n") || ""}\n` +
            (c.cta ? `CTA: ${c.cta}\n` : ""),
        )
        .join("\n\n");

    navigator.clipboard.writeText(fullText);
    setCopiedAll(true);
    onShowToast("전체 카드뉴스 텍스트가 복사되었습니다!");
    setTimeout(() => setCopiedAll(false), 2000);
  };

  // Render Graphic Element Component (Infographics)
  const renderGraphicElement = (elements?: GraphicElementsData) => {
    if (!elements || !elements.data) return null;
    const { type, data } = elements;

    switch (type) {
      case "table":
        return (
          <div className="w-full overflow-hidden rounded-xl bg-slate-50 border border-slate-200 p-3 my-2 text-xs">
            {data.headers && (
              <div className="grid grid-cols-2 gap-2 border-b border-slate-200 pb-2 font-bold text-emerald-800">
                {data.headers.map((h, i) => (
                  <div key={i}>{h}</div>
                ))}
              </div>
            )}
            {data.rows?.map((row, rIdx) => (
              <div
                key={rIdx}
                className="grid grid-cols-2 gap-2 py-1.5 border-b border-slate-100 text-slate-700"
              >
                {row.map((cell, cIdx) => (
                  <div key={cIdx}>{cell}</div>
                ))}
              </div>
            ))}
          </div>
        );

      case "vs_badge":
        return (
          <div className="w-full grid grid-cols-2 gap-3 my-2 text-xs">
            {data.vs?.optionA && (
              <div className="bg-emerald-50/80 border border-emerald-200 p-3 rounded-xl text-center">
                <span className="inline-block px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold mb-1">
                  {data.vs.optionA.name}
                </span>
                <p className="text-slate-700 text-[11px] mt-1">
                  {data.vs.optionA.pros}
                </p>
              </div>
            )}
            {data.vs?.optionB && (
              <div className="bg-teal-50/80 border border-teal-200 p-3 rounded-xl text-center">
                <span className="inline-block px-2 py-0.5 rounded bg-teal-100 text-teal-800 font-bold mb-1">
                  {data.vs.optionB.name}
                </span>
                <p className="text-slate-700 text-[11px] mt-1">
                  {data.vs.optionB.pros}
                </p>
              </div>
            )}
          </div>
        );

      case "checklist":
        return (
          <div className="w-full space-y-1.5 my-2 text-xs">
            {data.items?.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-2 rounded-lg"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-slate-800 font-medium">{item.label}</span>
              </div>
            ))}
          </div>
        );

      case "steps":
        return (
          <div className="w-full space-y-2 my-2 text-xs">
            {data.steps?.map((st, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2.5 bg-slate-50 border border-emerald-200 p-2.5 rounded-xl"
              >
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-black text-[11px] flex items-center justify-center shrink-0">
                  {st.stepNumber || idx + 1}
                </span>
                <div>
                  <h5 className="font-bold text-emerald-900">{st.title}</h5>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    {st.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        );

      case "metric_grid":
        return (
          <div className="w-full grid grid-cols-2 gap-2 my-2 text-center">
            {data.metrics?.map((m, idx) => (
              <div
                key={idx}
                className="bg-emerald-50/80 border border-emerald-200 p-3 rounded-xl"
              >
                <div className="text-xl font-black text-emerald-700">
                  {m.number}
                </div>
                <div className="text-[11px] text-slate-700 font-medium">
                  {m.label}
                </div>
              </div>
            ))}
          </div>
        );

      case "key_callout":
        return (
          <div className="w-full bg-emerald-50 border-l-4 border-emerald-500 p-3 rounded-r-xl my-2 text-xs text-emerald-900 font-medium">
            💡 {data.calloutText}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white border border-slate-200 w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-slate-900">
        {/* Top Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                <span>Card News Engine</span>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                  콘텐츠 & 그래픽 최적화
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                {keyword} 기준 블로그 카드뉴스 구성
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {usageLimits && (
              <div className="hidden sm:flex items-center gap-3 text-xs bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs">
                <span className="text-slate-600">
                  카드뉴스 생성:{" "}
                  <strong className="text-emerald-600">
                    {usageLimits.cardGenerationCount}
                  </strong>
                  회
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-600">
                  AI 그래픽:{" "}
                  <strong className="text-teal-600">
                    {usageLimits.aiGraphicGenerationCount}
                  </strong>
                  회
                </span>
              </div>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Section 1: Configuration Form */}
          <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-5 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-600" />
                <span>카드뉴스 생성 설정 & 이미지 연동 옵션</span>
              </h3>
              <div className="text-xs text-emerald-700 font-medium bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                AI 환각 방지 & 사실성 최우선 적용
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Card Count Picker */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  카드 수 선택
                </label>
                <div className="grid grid-cols-4 gap-1">
                  {[5, 6, 7, 8].map((num) => (
                    <button
                      key={num}
                      onClick={() => setCardCount(num)}
                      className={`py-2 text-xs font-bold rounded-xl transition-all border cursor-pointer ${
                        cardCount === num
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {num}장
                    </button>
                  ))}
                </div>
              </div>

              {/* Style Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  카드뉴스 스타일
                </label>
                <select
                  value={selectedStyle}
                  onChange={(e) =>
                    setSelectedStyle(e.target.value as CardNewsStyle)
                  }
                  className="w-full bg-white border border-slate-200 text-slate-900 text-xs rounded-xl px-2.5 py-2.5 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-medium"
                >
                  <option value="info">정보형 (가이드·정리)</option>
                  <option value="comparison">비교형 (스펙·가격·대안)</option>
                  <option value="review">리뷰/후기형 (실제사용·경험)</option>
                  <option value="travel">여행/맛집형 (장소·메뉴)</option>
                  <option value="list">리스트형 (TOP N·추천)</option>
                  <option value="photo">사진 중심형 (실사위주)</option>
                  <option value="graphic_info">그래픽 정보형 (표·수치)</option>
                </select>
              </div>

              {/* Image Production Mode */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  이미지 제작 방식
                </label>
                <select
                  value={imageMode}
                  onChange={(e) => setImageMode(e.target.value as any)}
                  className="w-full bg-white border border-slate-200 text-slate-900 text-xs rounded-xl px-2.5 py-2.5 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-medium"
                >
                  <option value="auto">자동 최적화 (권장)</option>
                  <option value="user_photo_first">
                    내 사진 중심 (업로드 우선)
                  </option>
                  <option value="free_image_first">
                    무료 상업용 이미지 중심
                  </option>
                  <option value="graphic_first">인포그래픽/표 중심</option>
                  <option value="ai_graphic_first">AI 그래픽/포토 중심</option>
                </select>
              </div>

              {/* AI Graphic Style */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  AI 그래픽 스타일
                </label>
                <select
                  value={aiGraphicStyle}
                  onChange={(e) =>
                    setAiGraphicStyle(e.target.value as AiGraphicStyleKey)
                  }
                  className="w-full bg-white border border-emerald-300 text-slate-900 text-xs rounded-xl px-2.5 py-2.5 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-semibold"
                >
                  <option value="photoreal">📷 포토 리얼 (실사 화보)</option>
                  <option value="simple_icon">🎨 심플 아이콘/그래픽</option>
                  <option value="casual">✏️ 캐주얼 일러스트</option>
                  <option value="fairytale">🌸 감성 동화 삽화</option>
                </select>
              </div>

              {/* User Photo Upload Trigger */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  내 사진 첨부 ({userPhotos.length}장)
                </label>
                <label className="flex items-center justify-center gap-1.5 w-full py-2.5 px-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 cursor-pointer transition-all shadow-2xs">
                  <Upload className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="truncate">내 사진 추가</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Uploaded User Photo Thumbnails */}
            {userPhotos.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto pt-2 pb-1">
                {userPhotos.map((photo, idx) => (
                  <div
                    key={idx}
                    className="relative group shrink-0 w-14 h-14 rounded-xl overflow-hidden border border-emerald-300"
                  >
                    <img
                      src={photo}
                      alt={`User photo ${idx}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => handleRemovePhoto(idx)}
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-rose-400 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Principle & Notice Banner */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-emerald-950">
                  콘텐츠 사실성 및 비용 최적화 안내
                </p>
                <p className="text-[11px] text-slate-700 leading-relaxed">
                  AI는 가격, 주소, 스펙을 임의로 생성하지 않으며, 블로그 초안에
                  명시된 내용만 재구성합니다. 숫자·비교표·체크리스트는
                  인포그래픽 UI로 생성하여 불필요한 AI 이미지 생성 비용을
                  최적화합니다.
                </p>
              </div>
            </div>

            {/* Main Generate Action Button */}
            <div className="pt-2 flex justify-end">
              <button
                onClick={handleGenerateCardNews}
                disabled={isGenerating}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-sm disabled:opacity-50 transition-all cursor-pointer"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{generationStep || "카드뉴스 생성 중..."}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>카드뉴스 재구성 및 생성 실행</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Section 2: Rendered Cards & Preview Engine */}
          {engineResult && (
            <div className="space-y-4 pt-2">
              {/* Toolbar */}
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 p-3 rounded-2xl">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                  <span className="text-emerald-700">{engineResult.title}</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-slate-600">
                    {engineResult.cards.length}장 슬라이드
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setViewMode(viewMode === "carousel" ? "grid" : "carousel")
                    }
                    className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700 transition-colors cursor-pointer"
                  >
                    {viewMode === "carousel"
                      ? "전체 그리드 보기"
                      : "슬라이드 슬라이더 보기"}
                  </button>
                  <button
                    onClick={handleCopyAllCardsText}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-xs font-bold text-slate-700 transition-colors border border-slate-200 cursor-pointer"
                  >
                    {copiedAll ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                    )}
                    <span>전체 텍스트 복사</span>
                  </button>
                </div>
              </div>

              {/* View Mode 1: Carousel Mode */}
              {viewMode === "carousel" && (
                <div className="space-y-4">
                  {/* Slide Container rendered via CardNewsCardRenderer */}
                  {engineResult.cards[activeCardIndex] && (
                    <div className="space-y-3">
                      <div className="relative max-w-lg mx-auto w-full">
                        <CardNewsCardRenderer
                          ref={cardCanvasRef}
                          card={engineResult.cards[activeCardIndex]}
                          totalCards={engineResult.cards.length}
                          keyword={engineResult.keyword}
                          styleName={engineResult.style}
                          globalStyle={
                            engineResult.globalStyle || aiGraphicStyle
                          }
                          imageMode={engineResult.imageMode || imageMode}
                        />
                      </div>

                      {/* Action Bar for Current Slide */}
                      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 border border-slate-200 p-3 rounded-2xl max-w-lg mx-auto">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setEditingCard({
                                ...engineResult.cards[activeCardIndex],
                              });
                              setIsEditingModalOpen(true);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors cursor-pointer shadow-2xs"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>수정</span>
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleDownloadCurrentCardImage}
                            disabled={isDownloadingImage}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                          >
                            {isDownloadingImage ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Download className="w-3.5 h-3.5 text-emerald-400" />
                            )}
                            <span>이미지 다운로드</span>
                          </button>
                          <button
                            onClick={handleCopyCurrentCardText}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                          >
                            {copiedSlide ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            <span>텍스트 복사</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  {/* Carousel Nav Controls */}
                  <div className="flex items-center justify-between pt-2">
                    <button
                      onClick={() =>
                        setActiveCardIndex((prev) => Math.max(0, prev - 1))
                      }
                      disabled={activeCardIndex === 0}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-slate-100 disabled:opacity-40 text-xs font-medium text-slate-700 border border-slate-200 transition-colors cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>이전 카드</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      {engineResult.cards.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => setActiveCardIndex(idx)}
                          className={`h-2.5 rounded-full transition-all cursor-pointer ${
                            idx === activeCardIndex
                              ? "bg-emerald-600 w-6"
                              : "bg-slate-300 hover:bg-slate-400 w-2.5"
                          }`}
                        />
                      ))}
                    </div>

                    <button
                      onClick={() =>
                        setActiveCardIndex((prev) =>
                          Math.min(engineResult.cards.length - 1, prev + 1),
                        )
                      }
                      disabled={
                        activeCardIndex === engineResult.cards.length - 1
                      }
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-slate-100 disabled:opacity-40 text-xs font-medium text-slate-700 border border-slate-200 transition-colors cursor-pointer"
                    >
                      <span>다음 카드</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* View Mode 2: Grid Mode */}
              {viewMode === "grid" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {engineResult.cards.map((card, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        setActiveCardIndex(idx);
                        setViewMode("carousel");
                      }}
                      className="bg-white border border-slate-200/80 hover:border-emerald-500 rounded-2xl p-4 flex flex-col justify-between cursor-pointer transition-all hover:shadow-md space-y-3"
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span className="font-bold text-emerald-700">
                          #{card.cardNumber}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 uppercase font-semibold">
                          {card.imageSource}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <h4 className="font-bold text-sm text-slate-900 line-clamp-2">
                          {card.title}
                        </h4>
                        {card.subtitle && (
                          <p className="text-xs text-slate-500 line-clamp-1">
                            {card.subtitle}
                          </p>
                        )}
                      </div>

                      {renderGraphicElement(card.graphicElements)}

                      <div className="text-[11px] text-emerald-700 font-semibold pt-2 border-t border-slate-100 flex items-center justify-between">
                        <span>상세 보기 및 수정</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Editing Modal for Single Card */}
      {isEditingModalOpen && editingCard && (
        <div className="fixed inset-0 z-60 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-lg rounded-2xl p-6 space-y-4 text-slate-900 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base flex items-center gap-2 text-slate-900">
                <Edit3 className="w-4 h-4 text-emerald-600" />
                <span>슬라이드 #{editingCard.cardNumber} 수정</span>
              </h3>
              <button
                onClick={() => setIsEditingModalOpen(false)}
                className="text-slate-400 hover:text-slate-800 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 mb-1 font-semibold">
                  제목
                </label>
                <input
                  type="text"
                  value={editingCard.title}
                  onChange={(e) =>
                    setEditingCard({ ...editingCard, title: e.target.value })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-semibold">
                  서브타이틀
                </label>
                <input
                  type="text"
                  value={editingCard.subtitle || ""}
                  onChange={(e) =>
                    setEditingCard({ ...editingCard, subtitle: e.target.value })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-semibold">
                  요약 본문
                </label>
                <textarea
                  value={editingCard.body || ""}
                  onChange={(e) =>
                    setEditingCard({ ...editingCard, body: e.target.value })
                  }
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-semibold">
                  이미지 소스 방식
                </label>
                <select
                  value={editingCard.imageSource}
                  onChange={(e) =>
                    setEditingCard({
                      ...editingCard,
                      imageSource: e.target.value as CardImageSource,
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                >
                  <option value="user_photo">
                    user_photo (사용자 첨부 사진)
                  </option>
                  <option value="free_image">
                    free_image (무료 상업용 사진)
                  </option>
                  <option value="infographic">
                    infographic (UI 그래픽/비교표)
                  </option>
                  <option value="ai_graphic">
                    ai_graphic (AI 일러스트 그래픽)
                  </option>
                  <option value="none">none (이미지 없음)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-semibold">
                  CTA 문구
                </label>
                <input
                  type="text"
                  value={editingCard.cta || ""}
                  onChange={(e) =>
                    setEditingCard({ ...editingCard, cta: e.target.value })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setIsEditingModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-xs font-semibold text-slate-700 hover:bg-slate-200 cursor-pointer"
              >
                취소
              </button>
              <button
                onClick={handleSaveCardEdit}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white shadow-xs cursor-pointer"
              >
                저장하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

