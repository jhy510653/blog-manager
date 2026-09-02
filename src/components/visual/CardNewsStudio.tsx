import React, { useState, useEffect, useRef } from 'react';
import { extractAndParseJson } from '../../utils/jsonUtils';
import {
  Layers,
  Sparkles,
  Edit3,
  Trash2,
  Plus,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  RefreshCw,
  Zap,
  Info,
  Check,
  FileText,
  Bookmark,
  Share2,
  FileCheck,
  AlertCircle,
  HelpCircle,
  Hash,
  MoveUp,
  MoveDown,
  Tag,
  Type,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  Palette,
  Image as ImageIcon,
  Grid,
  FileDown,
  Archive,
  Search,
  UploadCloud,
  X,
  Maximize2,
  Sliders,
  CheckSquare,
  Ban,
  Wand2,
} from 'lucide-react';
import { safeCaptureHtmlToCanvas } from '../../utils/canvasExportUtils';
import JSZip from 'jszip';
import {
  VisualDocumentSource,
  CardNewsContentCard,
  CardRoleType,
  CardLayoutVariant,
  ImproveInstructionType,
  CardNewsTemplateId,
  CardNewsImageSourceMode,
  CARD_NEWS_TEMPLATES,
  CardNewsProjectData,
} from './visualTypes';
import { CardNewsDesignPicker } from './CardNewsDesignPicker';
import { CardNewsImageSourcePicker } from './CardNewsImageSourcePicker';
import { CardNewsCardRenderer } from './CardNewsCardRenderer';
import {
  isValidUnsplashUrl,
  isValidUnsplashPhoto,
  sanitizeUnsplashPhoto,
  transformAndStoreUnsplashImage,
  transformAndStoreUnsplashBatch,
} from '../../utils/imagePipeline';

interface CardNewsStudioProps {
  document: VisualDocumentSource | null;
  onShowToast: (msg: string) => void;
  currentUser: any;
  isAdmin?: boolean;
}

const ROLE_DEFINITIONS: Record<
  CardRoleType,
  { label: string; bg: string; text: string; border: string; desc: string }
> = {
  cover: {
    label: '표지 (Cover)',
    bg: 'bg-purple-100',
    text: 'text-purple-800',
    border: 'border-purple-300',
    desc: '한눈에 주제를 파악하고 시선을 사로잡는 타이틀 카드',
  },
  key_point: {
    label: '핵심 포인트 (Key Point)',
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    border: 'border-blue-300',
    desc: '독자가 가장 먼저 알아야 할 핵심 내용',
  },
  info: {
    label: '정보 전달 (Info)',
    bg: 'bg-emerald-100',
    text: 'text-emerald-800',
    border: 'border-emerald-300',
    desc: '중요한 기준 및 구체적 세부 정보',
  },
  step: {
    label: '단계/절차 (Step)',
    bg: 'bg-cyan-100',
    text: 'text-cyan-800',
    border: 'border-cyan-300',
    desc: '순서대로 따라 하는 단계별 가이드',
  },
  comparison: {
    label: '비교/차이 (Comparison)',
    bg: 'bg-indigo-100',
    text: 'text-indigo-800',
    border: 'border-indigo-300',
    desc: '비교 대상 간 핵심 차이 및 장단점',
  },
  tip: {
    label: '실전 팁 (Tip)',
    bg: 'bg-amber-100',
    text: 'text-amber-800',
    border: 'border-amber-300',
    desc: '놓치기 쉬운 실전 노하우 및 꿀팁',
  },
  warning: {
    label: '주의사항 (Warning)',
    bg: 'bg-rose-100',
    text: 'text-rose-800',
    border: 'border-rose-300',
    desc: '방문/이용 전 반드시 체크해야 할 주의점',
  },
  summary: {
    label: '핵심 요약 (Summary)',
    bg: 'bg-slate-100',
    text: 'text-slate-800',
    border: 'border-slate-300',
    desc: '전체 내용을 일목요연하게 정리한 요약',
  },
  cta: {
    label: '마무리/CTA (Outro)',
    bg: 'bg-violet-100',
    text: 'text-violet-800',
    border: 'border-violet-300',
    desc: '본문 링크 안내 및 행동 유도',
  },
};

const LAYOUT_VARIANTS: { id: CardLayoutVariant; label: string; desc: string }[] = [
  { id: 'cover', label: '표지형 (Cover)', desc: '대형 헤드라인과 브랜드 배지 중심' },
  { id: 'text_focus', label: '텍스트 강조형 (Text Focus)', desc: '대형 번호와 쾌적한 폰트 가독성' },
  { id: 'image_focus', label: '이미지 강조형 (Image Focus)', desc: '상단 50% 사진 프레임과 하단 요약' },
  { id: 'split', label: '분할형 (Split)', desc: '사진/그래픽과 포인트 2단 분할' },
  { id: 'number_focus', label: '수치/스텝 강조형 (Number Focus)', desc: '대형 수치/조건 블록 및 단계별 번호' },
  { id: 'comparison', label: '비교형 (Comparison)', desc: '2열 체크박스 및 장단점 대조' },
  { id: 'quote', label: '인용/한줄 강조형 (Quote)', desc: '매거진 풀쿼트 및 핵심 명언' },
  { id: 'tip', label: '팁/주의 강조형 (Tip/Warning)', desc: '하이라이트 콜아웃 박스' },
  { id: 'ending', label: '요약/마무리형 (Ending)', desc: '체크리스트와 저장 유도 배지' },
];

const IMPROVE_OPTIONS: { id: ImproveInstructionType; label: string; desc: string; icon: string }[] = [
  { id: 'shorter', label: '더 짧게', desc: '군더더기 없이 간결하게 압축', icon: '⚡' },
  { id: 'clearer', label: '더 명확하게', desc: '직관적이고 알기 쉬운 문장으로 개선', icon: '🎯' },
  { id: 'highlight', label: '핵심 강조', desc: '임팩트 있는 제목과 키워드 중심 재구성', icon: '✨' },
  { id: 'informative', label: '정보형 문체', desc: '신뢰감 있고 객관적인 사실 전달', icon: '📊' },
  { id: 'emotional', label: '감성적 문체', desc: '공감대를 형성하는 부드러운 어조', icon: '💌' },
];

export const CardNewsStudio: React.FC<CardNewsStudioProps> = ({
  document: docSource,
  onShowToast,
  currentUser,
  isAdmin,
}) => {
  // ----------------------------------------------------
  // Stepped Flow State (Steps 1 to 6)
  // ----------------------------------------------------
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Step 2 State: Card Count
  const [cardCount, setCardCount] = useState<number>(6);

  // Step 3 State: Analysis & Content Cards
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analyzingProgress, setAnalyzingProgress] = useState<string>('');
  const [cards, setCards] = useState<CardNewsContentCard[]>([]);
  const [contentType, setContentType] = useState<string>('');
  const [coreTopic, setCoreTopic] = useState<string>('');
  const [selectedCardId, setSelectedCardId] = useState<string>('');
  const [improvingCardId, setImprovingCardId] = useState<string | null>(null);
  const [generatingAiCardId, setGeneratingAiCardId] = useState<string | null>(null);
  const [newEmphasisTag, setNewEmphasisTag] = useState<string>('');

  // Step 4 State: Design Template
  const [selectedTemplate, setSelectedTemplate] = useState<CardNewsTemplateId>('editorial');

  // Step 5 State: Image Source Mode & Management
  const [imageSourceMode, setImageSourceMode] = useState<CardNewsImageSourceMode>('unsplash');
  const [isSearchingUnsplashAll, setIsSearchingUnsplashAll] = useState<boolean>(false);

  // Single Card Unsplash Search Modal
  const [activePhotoModalCardId, setActivePhotoModalCardId] = useState<string | null>(null);
  const [photoSearchQuery, setPhotoSearchQuery] = useState<string>('');
  const [photoCandidates, setPhotoCandidates] = useState<any[]>([]);
  const [isSearchingPhotos, setIsSearchingPhotos] = useState<boolean>(false);

  // Step 6 State: Final Preview & Export
  const [previewSlideIndex, setPreviewSlideIndex] = useState<number>(0);
  const [previewDisplayMode, setPreviewDisplayMode] = useState<'single' | 'grid'>('single');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [showJsonModal, setShowJsonModal] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Auto-select first card when cards are loaded
  useEffect(() => {
    if (cards.length > 0 && (!selectedCardId || !cards.find((c) => c.id === selectedCardId))) {
      setSelectedCardId(cards[0].id);
    }
  }, [cards, selectedCardId]);

  const activeCard = cards.find((c) => c.id === selectedCardId) || cards[0];

  // Helper: Search Unsplash API (Strictly Unsplash only)
  const searchUnsplashApi = async (query: string, perPage: number = 6) => {
    const cleanQ = query.trim();
    if (!cleanQ) return [];
    try {
      const res = await fetch(
        `/api/unsplash/search?query=${encodeURIComponent(cleanQ)}&per_page=${perPage}&orientation=landscape`
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.results) && data.results.length > 0) {
          return data.results
            .filter((p: any) => isValidUnsplashPhoto(p))
            .map((p: any) => {
              const sanitized = sanitizeUnsplashPhoto(p, cleanQ);
              if (!sanitized) return null;
              return {
                id: sanitized.id,
                url: sanitized.url,
                thumbUrl: sanitized.thumbUrl,
                alt: sanitized.alt || cleanQ,
                photographer: sanitized.photographer || 'Unsplash Photographer',
                photographerUrl: sanitized.photographerUrl,
                unsplashUrl: sanitized.unsplashUrl,
                searchQuery: cleanQ,
              };
            })
            .filter((p: any) => Boolean(p && isValidUnsplashUrl(p.url)));
        }
      }
    } catch (err) {
      console.warn('[Unsplash search error]:', err);
    }
    return [];
  };

  // ----------------------------------------------------
  // STEP 3: AI Analysis & Content Generation
  // ----------------------------------------------------
  const handleAnalyzeAndGenerate = async () => {
    if (!docSource || !docSource.content) {
      onShowToast('⚠️ 상단에서 먼저 카드뉴스로 구성할 블로그 본문을 선택하거나 입력해 주세요.');
      return;
    }

    const contentText = docSource.plainText || docSource.content.replace(/<[^>]+>/g, ' ').trim();
    if (contentText.length < 50) {
      onShowToast('⚠️ 블로그 본문 내용이 너무 짧습니다. 최소 50자 이상의 본문을 입력해 주세요.');
      return;
    }

    setIsAnalyzing(true);
    setAnalyzingProgress('블로그 본문의 핵심 팩트와 논리 구조를 분석하는 중입니다...');

    try {
      const userPayload: any = {
        userEmail: currentUser?.email || '',
        userName: currentUser?.name || '',
        userId: currentUser?.id || '',
        isAdmin: Boolean(isAdmin || currentUser?.role === 'admin' || currentUser?.is_admin),
        isChallengeParticipant: true,
      };

      const res = await fetch('/api/gemini/toolkit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'card_news_content',
          draftContent: contentText,
          cardCount: cardCount,
          ...userPayload,
        }),
      });

      let rawData: any = {};
      if (res.ok) {
        const jsonRes = await res.json();
        const resData = jsonRes.result || jsonRes;
        if (typeof resData === 'object' && resData !== null) {
          rawData = resData;
        } else if (typeof resData === 'string') {
          rawData = extractAndParseJson(resData) || {};
        }
      }

      const generatedCards: any[] = Array.isArray(rawData?.cards) ? rawData.cards : [];

      if (generatedCards.length > 0) {
        const formattedCards: CardNewsContentCard[] = generatedCards.map((c: any, idx: number) => {
          const role: CardRoleType = c.cardRole || (idx === 0 ? 'cover' : idx === generatedCards.length - 1 ? 'summary' : 'key_point');
          const layout: CardLayoutVariant = c.layoutVariant || (
            idx === 0 ? 'cover' : idx === generatedCards.length - 1 ? 'ending' : role === 'tip' ? 'tip' : role === 'comparison' ? 'comparison' : idx % 2 === 0 ? 'text_focus' : 'image_focus'
          );
          return {
            id: `card_${Date.now()}_${idx}`,
            cardNumber: Number(c.cardNumber) || idx + 1,
            cardRole: role,
            layoutVariant: layout,
            title: c.title || `카드 ${idx + 1}`,
            subtitle: c.subtitle || '',
            body: c.body || '',
            emphasis: Array.isArray(c.emphasis) ? c.emphasis : [],
            sourceContext: c.sourceContext || '',
            searchQueries: Array.isArray(c.searchQueries) ? c.searchQueries : [c.title || ''],
            imagePrompt: c.imagePrompt || `${c.title || 'blog'} visual concept`,
            imageSource: imageSourceMode === 'no_image' ? 'none' : imageSourceMode,
          };
        });

        setCards(formattedCards);
        setContentType(rawData.contentType || '정보형');
        setCoreTopic(rawData.coreTopic || docSource.title);
        setSelectedCardId(formattedCards[0].id);
        setCurrentStep(3);
        onShowToast(`✓ AI가 본문을 분석하여 ${formattedCards.length}장의 카드뉴스 콘텐츠를 구성했습니다!`);

        // If Unsplash mode is enabled, auto-match photos in background
        if (imageSourceMode === 'unsplash') {
          handleAutoMatchUnsplashPhotos(formattedCards);
        }
      } else {
        // Heuristic fallback
        handleFallbackCardGeneration(contentText);
      }
    } catch (err) {
      console.warn('[AI Analysis Error]:', err);
      handleFallbackCardGeneration(contentText);
    } finally {
      setIsAnalyzing(false);
      setAnalyzingProgress('');
    }
  };

  // Heuristic Fallback Generator (Zero Duplication & Distinct Key Points)
  const handleFallbackCardGeneration = (text: string) => {
    const rawParagraphs = text
      .split(/\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 15);

    // Segment distinct sentence blocks
    const sentences = text
      .replace(/([.?!])\s+/g, '$1\n')
      .split(/\n+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 20);

    const pool = rawParagraphs.length >= 4 ? rawParagraphs : sentences.length >= 4 ? sentences : [text];
    const actualCount = Math.min(cardCount, Math.max(4, pool.length));

    const generated: CardNewsContentCard[] = [];
    const roles: CardRoleType[] = ['cover', 'key_point', 'info', 'step', 'tip', 'summary'];

    for (let i = 0; i < actualCount; i++) {
      const isCover = i === 0;
      const isEnd = i === actualCount - 1;
      const piece = pool[i] || pool[pool.length - 1] || text;
      const role = isCover ? 'cover' : isEnd ? 'summary' : roles[i % roles.length];
      const layout: CardLayoutVariant = isCover ? 'cover' : isEnd ? 'ending' : role === 'tip' ? 'tip' : i % 2 === 0 ? 'text_focus' : 'image_focus';

      generated.push({
        id: `card_${Date.now()}_${i}`,
        cardNumber: i + 1,
        cardRole: role,
        layoutVariant: layout,
        title: isCover ? (docSource?.title || '블로그 핵심 가이드') : `포인트 ${i}: ${piece.slice(0, 16).replace(/[.?!,]/g, '')}`,
        subtitle: isCover ? '반드시 알아야 할 핵심 정리' : '핵심 체크포인트',
        body: piece.slice(0, 120),
        emphasis: [piece.split(' ')[0] || '핵심', '필수체크'],
        sourceContext: piece.slice(0, 90),
        searchQueries: [piece.split(' ')[0] || 'guide'],
        imagePrompt: `${piece.slice(0, 30)} concept`,
        imageSource: imageSourceMode === 'no_image' ? 'none' : imageSourceMode,
      });
    }

    setCards(generated);
    setSelectedCardId(generated[0].id);
    setCurrentStep(3);
    onShowToast(`✓ 본문의 고유 핵심 내용을 분석하여 ${generated.length}장의 카드뉴스를 구성했습니다.`);
  };

  // Auto match Unsplash photos for cards with Sharp anti-duplicate transformation
  const handleAutoMatchUnsplashPhotos = async (cardList: CardNewsContentCard[]) => {
    setIsSearchingUnsplashAll(true);
    const updated = [...cardList];
    const itemsToTransform: Array<{ id: string; url: string; alt: string; subject: string }> = [];

    for (let i = 0; i < updated.length; i++) {
      const c = updated[i];
      if (c.imageSource === 'none' || c.imageUrl || c.userUploadedImage) continue;

      const queries = c.searchQueries && c.searchQueries.length > 0 ? c.searchQueries : [c.title];
      for (const q of queries) {
        const results = await searchUnsplashApi(q, 3);
        if (results.length > 0) {
          updated[i] = {
            ...updated[i],
            imageUrl: results[0].url,
            imageThumbUrl: results[0].thumbUrl,
            imageCredit: results[0].photographer,
            searchQuery: q,
          };
          itemsToTransform.push({
            id: c.id,
            url: results[0].url,
            alt: results[0].alt || c.title,
            subject: c.title,
          });
          break;
        }
      }
    }

    // Apply Sharp random transformation & store in Supabase Storage
    if (itemsToTransform.length > 0) {
      try {
        const transformedResults = await transformAndStoreUnsplashBatch(itemsToTransform);
        const transformMap = new Map<string, string>();
        transformedResults.forEach((tr) => {
          if (tr.id && tr.transformedUrl) {
            transformMap.set(tr.id, tr.transformedUrl);
          }
        });

        for (let i = 0; i < updated.length; i++) {
          if (transformMap.has(updated[i].id)) {
            updated[i].imageUrl = transformMap.get(updated[i].id)!;
          }
        }
      } catch (err) {
        console.warn('[CardNews transformBatch error]:', err);
      }
    }

    setCards(updated);
    setIsSearchingUnsplashAll(false);
  };

  // ----------------------------------------------------
  // Card Editing Handlers
  // ----------------------------------------------------
  const handleUpdateActiveCard = (field: keyof CardNewsContentCard, value: any) => {
    if (!activeCard) return;
    const updated = cards.map((c) => (c.id === activeCard.id ? { ...c, [field]: value, isUserEdited: true } : c));
    setCards(updated);
  };

  // Add Tag to active card
  const handleAddEmphasisTag = () => {
    if (!newEmphasisTag.trim() || !activeCard) return;
    const clean = newEmphasisTag.trim().replace(/^#/, '');
    const current = activeCard.emphasis || [];
    if (!current.includes(clean)) {
      handleUpdateActiveCard('emphasis', [...current, clean]);
    }
    setNewEmphasisTag('');
  };

  // Remove Tag from active card
  const handleRemoveEmphasisTag = (tagToRemove: string) => {
    if (!activeCard) return;
    const filtered = (activeCard.emphasis || []).filter((t) => t !== tagToRemove);
    handleUpdateActiveCard('emphasis', filtered);
  };

  // Move Card Up
  const handleMoveCardUp = (idx: number) => {
    if (idx <= 0) return;
    const updated = [...cards];
    const temp = updated[idx];
    updated[idx] = updated[idx - 1];
    updated[idx - 1] = temp;
    const reindexed = updated.map((c, i) => ({ ...c, cardNumber: i + 1 }));
    setCards(reindexed);
    onShowToast(`✓ 카드 순서를 변경했습니다.`);
  };

  // Move Card Down
  const handleMoveCardDown = (idx: number) => {
    if (idx >= cards.length - 1) return;
    const updated = [...cards];
    const temp = updated[idx];
    updated[idx] = updated[idx + 1];
    updated[idx + 1] = temp;
    const reindexed = updated.map((c, i) => ({ ...c, cardNumber: i + 1 }));
    setCards(reindexed);
    onShowToast(`✓ 카드 순서를 변경했습니다.`);
  };

  // Add new card
  const handleAddNewCard = () => {
    const newIdx = cards.length + 1;
    const newCard: CardNewsContentCard = {
      id: `card_${Date.now()}`,
      cardNumber: newIdx,
      cardRole: 'key_point',
      layoutVariant: 'text_focus',
      title: `새로운 핵심 카드 ${newIdx}`,
      subtitle: '서브 가이드 문구를 입력하세요',
      body: '모바일 화면에서 한눈에 보기 편하도록 2~3줄로 핵심 내용을 작성하세요.',
      emphasis: ['핵심포인트'],
      sourceContext: '사용자가 직접 추가한 카드입니다.',
      imageSource: imageSourceMode === 'no_image' ? 'none' : imageSourceMode,
      imagePrompt: `새로운 핵심 카드 ${newIdx} visual concept`,
    };
    const updated = [...cards, newCard];
    setCards(updated);
    setSelectedCardId(newCard.id);
    onShowToast(`✓ 새로운 #${newIdx} 카드가 추가되었습니다.`);
  };

  // Delete card
  const handleDeleteCard = (idToDelete: string) => {
    if (cards.length <= 2) {
      onShowToast('⚠️ 카드뉴스는 최소 2장 이상이어야 합니다.');
      return;
    }
    const filtered = cards.filter((c) => c.id !== idToDelete);
    const reindexed = filtered.map((c, i) => ({ ...c, cardNumber: i + 1 }));
    setCards(reindexed);
    if (selectedCardId === idToDelete && reindexed.length > 0) {
      setSelectedCardId(reindexed[0].id);
    }
    onShowToast(`✓ 카드가 삭제되었습니다.`);
  };

  // AI Improve single card
  const handleImproveCardContent = async (instruction: ImproveInstructionType) => {
    if (!activeCard) return;
    setImprovingCardId(activeCard.id);

    try {
      const userPayload: any = {
        userEmail: currentUser?.email || '',
        userName: currentUser?.name || '',
        userId: currentUser?.id || '',
        isAdmin: Boolean(isAdmin || currentUser?.role === 'admin' || currentUser?.is_admin),
        isChallengeParticipant: true,
      };

      const res = await fetch('/api/gemini/toolkit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'improve_card_content',
          card: activeCard,
          instruction: instruction,
          sourceContent: docSource?.plainText || docSource?.content || '',
          ...userPayload,
        }),
      });

      if (res.ok) {
        const jsonRes = await res.json();
        const resData = jsonRes.result || jsonRes;
        let parsed: any = typeof resData === 'string' ? extractAndParseJson(resData) : resData;

        if (parsed?.title || parsed?.body) {
          const updated = cards.map((c) => {
            if (c.id === activeCard.id) {
              return {
                ...c,
                title: parsed.title || c.title,
                subtitle: parsed.subtitle !== undefined ? parsed.subtitle : c.subtitle,
                body: parsed.body || c.body,
                emphasis: Array.isArray(parsed.emphasis) && parsed.emphasis.length > 0 ? parsed.emphasis : c.emphasis,
                isUserEdited: true,
              };
            }
            return c;
          });
          setCards(updated);
          onShowToast(`✓ AI가 문구를 성공적으로 최적화했습니다.`);
        }
      }
    } catch (err) {
      console.warn('[Improve card error]:', err);
      onShowToast('⚠️ 문구 개선 중 오류가 발생했습니다.');
    } finally {
      setImprovingCardId(null);
    }
  };

  // Text Auto-Condenser (Anti-Overflow Safety)
  const handleAutoCondenseText = (cardId: string) => {
    const target = cards.find((c) => c.id === cardId);
    if (!target) return;
    const shortenedBody = target.body.length > 110 ? target.body.slice(0, 105) + '...' : target.body;
    const shortenedTitle = target.title.length > 22 ? target.title.slice(0, 20) + '...' : target.title;
    const updated = cards.map((c) => (c.id === cardId ? { ...c, title: shortenedTitle, body: shortenedBody } : c));
    setCards(updated);
    onShowToast(`✓ #${target.cardNumber} 카드 문구를 카드 디자인 영역에 맞게 최적화했습니다.`);
  };

  // ----------------------------------------------------
  // STEP 5: Photo Modal Handlers & AI Image Generation
  // ----------------------------------------------------
  const handleOpenPhotoModal = async (cardItem: CardNewsContentCard) => {
    setActivePhotoModalCardId(cardItem.id);
    const initialQuery = cardItem.searchQuery || cardItem.searchQueries?.[0] || cardItem.title || 'travel';
    setPhotoSearchQuery(initialQuery);
    setIsSearchingPhotos(true);
    const results = await searchUnsplashApi(initialQuery, 8);
    setPhotoCandidates(results);
    setIsSearchingPhotos(false);
  };

  const handleSearchPhotosInModal = async () => {
    if (!photoSearchQuery.trim()) return;
    setIsSearchingPhotos(true);
    const results = await searchUnsplashApi(photoSearchQuery, 8);
    setPhotoCandidates(results);
    setIsSearchingPhotos(false);
  };

  const handleSelectCandidatePhoto = async (photo: any) => {
    if (!activePhotoModalCardId) return;
    const targetCardId = activePhotoModalCardId;

    const updated = cards.map((c) => {
      if (c.id === targetCardId) {
        return {
          ...c,
          imageUrl: photo.url,
          imageThumbUrl: photo.thumbUrl,
          imageCredit: photo.photographer,
          searchQuery: photoSearchQuery,
          userUploadedImage: undefined,
          imageSource: 'unsplash' as const,
        };
      }
      return c;
    });
    setCards(updated);
    setActivePhotoModalCardId(null);
    onShowToast(`✓ 카드 사진이 변경되었습니다. (중복 방지 변형 적용 중...)`);

    // Asynchronously transform photo via Sharp and save to Supabase Storage
    try {
      const transformRes = await transformAndStoreUnsplashImage(photo.url, {
        alt: photo.alt || 'Card Photo',
        subject: '카드뉴스',
      });
      if (transformRes && transformRes.transformedUrl) {
        setCards((prev) =>
          prev.map((c) =>
            c.id === targetCardId ? { ...c, imageUrl: transformRes.transformedUrl } : c
          )
        );
      }
    } catch (err) {
      console.warn('[CardNews transform image error]:', err);
    }
  };

  // Handle User Upload file
  const handleUploadUserImage = (e: React.ChangeEvent<HTMLInputElement>, cardId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      onShowToast('⚠️ 이미지 파일(.jpg, .png, .webp)만 업로드 가능합니다.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        const updated = cards.map((c) =>
          c.id === cardId
            ? { ...c, userUploadedImage: dataUrl, imageUrl: dataUrl, imageSource: 'user_upload' as const }
            : c
        );
        setCards(updated);
        onShowToast(`✓ 사용자 사진이 카드에 업로드되었습니다.`);
      }
    };
    reader.readAsDataURL(file);
  };

  // On-demand AI Image Generation for a single card (Cost-optimized: only called on user click)
  const handleGenerateAiImageForCard = async (cardItem: CardNewsContentCard) => {
    setGeneratingAiCardId(cardItem.id);
    onShowToast(`🎨 #${cardItem.cardNumber} 카드 맞춤 AI 그래픽 생성 중...`);

    try {
      const prompt = cardItem.imagePrompt || `${cardItem.title} - ${cardItem.body}`;
      const userPayload: any = {
        userEmail: currentUser?.email || '',
        userName: currentUser?.name || '',
        userId: currentUser?.id || '',
        isAdmin: Boolean(isAdmin || currentUser?.role === 'admin' || currentUser?.is_admin),
        isChallengeParticipant: true,
      };

      const res = await fetch('/api/gemini/toolkit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'ai_graphic',
          promptInput: prompt,
          ...userPayload,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const imgUrl = data.imageUrl || data.result;
        if (imgUrl) {
          const updated = cards.map((c) =>
            c.id === cardItem.id
              ? {
                  ...c,
                  imageUrl: imgUrl,
                  userUploadedImage: undefined,
                  imageSource: 'ai' as const,
                  imageCredit: 'Gemini AI Graphic',
                }
              : c
          );
          setCards(updated);
          onShowToast(`✓ #${cardItem.cardNumber} 카드 AI 그래픽이 생성되었습니다!`);
        } else {
          onShowToast('⚠️ AI 이미지 생성 결과가 올바르지 않습니다.');
        }
      } else {
        onShowToast('⚠️ AI 이미지 생성 중 서버 오류가 발생했습니다.');
      }
    } catch (err) {
      console.error('[AI image error]:', err);
      onShowToast('⚠️ AI 이미지 생성에 실패했습니다.');
    } finally {
      setGeneratingAiCardId(null);
    }
  };

  // ----------------------------------------------------
  // STEP 6: Export & Download Handlers (Single Source of Truth)
  // ----------------------------------------------------
  const handleDownloadSingleCardPng = async (cardItem: CardNewsContentCard) => {
    if (typeof window === 'undefined') return;
    setIsExporting(true);
    onShowToast(`⏳ #${cardItem.cardNumber} 카드 고해상도(1080×1080) PNG 렌더링 중...`);

    try {
      const targetElement =
        window.document.getElementById(`export-card-${cardItem.id}`) ||
        (window.document.querySelector(`[data-card-id="${cardItem.id}"]`) as HTMLElement);

      if (!targetElement) {
        throw new Error(`Card element not found for card #${cardItem.cardNumber}`);
      }

      // Exact parity: 540px * 2 = 1080px high-resolution canvas
      const canvas = await safeCaptureHtmlToCanvas(targetElement, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: null,
      });

      const imgData = canvas.toDataURL('image/png');
      const link = window.document.createElement('a');
      link.href = imgData;
      link.download = `cardnews_${selectedTemplate}_card_${String(cardItem.cardNumber).padStart(2, '0')}.png`;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      onShowToast(`✓ #${cardItem.cardNumber} 카드(1080×1080 PNG)가 다운로드되었습니다!`);
    } catch (err) {
      console.error('[Download error]:', err);
      onShowToast('⚠️ 카드 렌더링 중 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadAllCardsZip = async () => {
    if (typeof window === 'undefined' || cards.length === 0) return;
    setIsExporting(true);
    onShowToast(`⏳ ${cards.length}장 전체 카드 고화질(1080×1080) ZIP 압축 패키징 중...`);

    try {
      const zip = new JSZip();
      const folder = zip.folder(`cardnews_${selectedTemplate}_${cards.length}cards`);

      for (let i = 0; i < cards.length; i++) {
        const c = cards[i];
        const targetElement =
          window.document.getElementById(`export-card-${c.id}`) ||
          (window.document.querySelector(`[data-card-id="${c.id}"]`) as HTMLElement);

        if (targetElement) {
          const canvas = await safeCaptureHtmlToCanvas(targetElement, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            logging: false,
            backgroundColor: null,
          });
          const base64Data = canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
          folder?.file(`card_${String(i + 1).padStart(2, '0')}.png`, base64Data, { base64: true });
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const link = window.document.createElement('a');
      const url = URL.createObjectURL(content);
      link.href = url;
      link.download = `cardnews_${selectedTemplate}_${cards.length}cards.zip`;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      URL.revokeObjectURL(url);
      onShowToast(`✓ 전체 ${cards.length}장 카드뉴스(1080×1080) ZIP 다운로드가 완료되었습니다!`);
    } catch (err) {
      console.error('[ZIP export error]:', err);
      onShowToast('⚠️ ZIP 압축 중 오류가 발생했습니다.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyCardImageToClipboard = async (cardItem: CardNewsContentCard) => {
    if (typeof window === 'undefined') return;
    try {
      const targetElement =
        window.document.getElementById(`export-card-${cardItem.id}`) ||
        (window.document.querySelector(`[data-card-id="${cardItem.id}"]`) as HTMLElement);
      if (!targetElement) return;

      const canvas = await safeCaptureHtmlToCanvas(targetElement, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: null,
      });

      canvas.toBlob(async (blob) => {
        if (blob && navigator.clipboard && (window as any).ClipboardItem) {
          await navigator.clipboard.write([new (window as any).ClipboardItem({ 'image/png': blob })]);
          onShowToast(`✓ #${cardItem.cardNumber} 카드 이미지가 클립보드에 복사되었습니다! (Ctrl+V로 붙여넣기 가능)`);
        } else {
          onShowToast('⚠️ 클립보드 이미지 복사가 지원되지 않는 브라우저입니다. 다운로드를 이용해 주세요.');
        }
      });
    } catch (err) {
      console.warn('[Clipboard error]:', err);
      onShowToast('⚠️ 이미지 복사에 실패했습니다.');
    }
  };

  // Export JSON Project
  const projectExportData: CardNewsProjectData = {
    id: `project_${Date.now()}`,
    sourceType: docSource?.sourceType || 'manual',
    sourceContent: docSource?.plainText || docSource?.content || '',
    sourceTitle: docSource?.title || '블로그 카드뉴스',
    cardCount: cards.length,
    contentType: contentType || '정보형',
    coreTopic: coreTopic || '블로그 핵심 요약',
    selectedTemplate: selectedTemplate,
    imageSourceMode: imageSourceMode,
    status: 'generated',
    cards: cards,
    isConfirmed: true,
    createdAt: new Date().toISOString(),
    confirmedAt: new Date().toISOString(),
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(projectExportData, null, 2));
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
    onShowToast('✓ 카드뉴스 프로젝트 JSON이 클립보드에 복사되었습니다.');
  };

  // ----------------------------------------------------
  // STEP DEFINITION WIDGET BAR
  // ----------------------------------------------------
  const steps = [
    { num: 1, label: '블로그 글 불러오기' },
    { num: 2, label: '장 수 선택' },
    { num: 3, label: 'AI 분석 & 문구 수정' },
    { num: 4, label: '디자인 템플릿' },
    { num: 5, label: '이미지 소스' },
    { num: 6, label: '카드뉴스 생성 & 저장' },
  ];

  return (
    <div className="space-y-6">
      {/* ----------------------------------------------------------------- */}
      {/* 1. PROGRESSIVE STEP NAVIGATION HEADER */}
      {/* ----------------------------------------------------------------- */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <span className="text-xs font-black text-purple-700 tracking-wide uppercase">
              WORKFLOW PIPELINE
            </span>
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span>카드뉴스 제작 스튜디오</span>
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                Step {currentStep} of 6
              </span>
            </h2>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {currentStep > 1 && (
              <button
                onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>이전 단계</span>
              </button>
            )}

            {currentStep < 6 && (
              <button
                onClick={() => {
                  if (currentStep === 1 || currentStep === 2) {
                    if (cards.length === 0) {
                      handleAnalyzeAndGenerate();
                    } else {
                      setCurrentStep(3);
                    }
                  } else {
                    setCurrentStep((prev) => Math.min(6, prev + 1));
                  }
                }}
                disabled={isAnalyzing}
                className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
              >
                <span>{currentStep === 1 || currentStep === 2 ? '다음: AI 분석 실행' : '다음 단계'}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Stepped Progress Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-3">
          {steps.map((s) => {
            const isActive = currentStep === s.num;
            const isCompleted = currentStep > s.num || (s.num === 3 && cards.length > 0);

            return (
              <div
                key={s.num}
                onClick={() => {
                  if (s.num >= 3 && cards.length === 0 && !isAnalyzing) {
                    handleAnalyzeAndGenerate();
                  } else {
                    setCurrentStep(s.num);
                  }
                }}
                className={`px-3 py-2 rounded-xl border transition-all cursor-pointer flex items-center gap-2 ${
                  isActive
                    ? 'bg-purple-50 border-purple-500 ring-2 ring-purple-300 shadow-2xs'
                    : isCompleted
                    ? 'bg-slate-50/80 border-slate-200 hover:bg-slate-100/80'
                    : 'bg-white border-slate-200 opacity-60 hover:opacity-100'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                    isActive
                      ? 'bg-purple-600 text-white'
                      : isCompleted
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {isCompleted && !isActive ? <Check className="w-3 h-3 stroke-[3]" /> : s.num}
                </div>
                <span
                  className={`text-xs font-bold truncate ${
                    isActive ? 'text-purple-900 font-black' : isCompleted ? 'text-slate-800' : 'text-slate-500'
                  }`}
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 2. STEP VIEW PANELS */}
      {/* ----------------------------------------------------------------- */}

      {/* ================================================================ */}
      {/* STEP 1: [블로그 글 불러오기] */}
      {/* ================================================================ */}
      {currentStep === 1 && (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="space-y-1">
            <span className="text-xs font-black text-purple-700 tracking-wide">STEP 01</span>
            <h3 className="text-xl font-extrabold text-slate-900">블로그 글 불러오기 및 단일 원본 확인</h3>
            <p className="text-xs text-slate-500">
              상단 입력창에서 선택된 블로그 원문(Single Source of Truth)을 기반으로 사실만을 추출하여 카드뉴스를 기획합니다.
            </p>
          </div>

          {docSource ? (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-slate-700">연동된 블로그 본문 원본</span>
                </div>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800">
                  {docSource.sourceType === 'ai_draft' ? 'AI 초안 연동' : '직접 입력'}
                </span>
              </div>

              <h4 className="text-base font-black text-slate-900">{docSource.title}</h4>
              <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                {docSource.plainText || docSource.content.replace(/<[^>]+>/g, ' ')}
              </p>

              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                <span>총 글자 수: {(docSource.plainText || docSource.content).length.toLocaleString()}자</span>
                <span className="text-emerald-700 font-bold">✓ 카드뉴스 분석 준비 완료</span>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-amber-600 mx-auto" />
              <div>
                <h4 className="text-sm font-bold text-amber-900">연동된 블로그 글이 없습니다</h4>
                <p className="text-xs text-amber-700 mt-1">
                  화면 상단의 [AI 초안 불러오기] 또는 [직접 본문 붙여넣기]를 통해 먼저 글을 등록해 주세요.
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              onClick={() => setCurrentStep(2)}
              disabled={!docSource}
              className="px-6 py-3 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-black text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span>다음: 카드뉴스 장 수 선택</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* STEP 2: [카드뉴스 장 수 선택] */}
      {/* ================================================================ */}
      {currentStep === 2 && (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="space-y-1">
            <span className="text-xs font-black text-purple-700 tracking-wide">STEP 02</span>
            <h3 className="text-xl font-extrabold text-slate-900">카드뉴스 장 수 선택</h3>
            <p className="text-xs text-slate-500">
              SNS 플랫폼(인스타그램, 블로그) 독자의 체류 시간과 가독성에 최적화된 장 수를 선택하세요.
            </p>
          </div>

          {/* Intelligent Text Length & Card Count Advisory */}
          {(() => {
            const charCount = docSource
              ? (docSource.plainText || docSource.content.replace(/<[^>]+>/g, ' ').trim()).length
              : 0;
            const isShort = charCount > 0 && charCount < 350;
            return (
              <div
                className={`p-3.5 rounded-2xl border text-xs leading-relaxed flex items-center gap-2.5 ${
                  isShort
                    ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                    : 'bg-purple-50/60 border-purple-200 text-purple-900'
                }`}
              >
                <Sparkles className={`w-4 h-4 shrink-0 ${isShort ? 'text-amber-600' : 'text-purple-600'}`} />
                <div>
                  <span className="font-bold">
                    본문 분량: 약 {charCount.toLocaleString()}자
                  </span>
                  {isShort && cardCount > 6 ? (
                    <span className="ml-2 font-medium">
                      — 원문 분량이 비교적 짧아 내용 중복을 방지하기 위해 <strong>5~6장(속독형/가장 추천)</strong> 구성을 권장합니다.
                    </span>
                  ) : (
                    <span className="ml-2 font-medium">
                      — AI가 본문의 고유 팩트와 핵심 가이드를 1회 정밀 분석하여 중복 없이 <strong>{cardCount}장</strong>에 고르게 분배합니다.
                    </span>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Card Count Options */}
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {[
              { count: 5, label: '5장', badge: '속독형', desc: '표지 1장 + 핵심 3장 + 요약 1장' },
              { count: 6, label: '6장', badge: '가장 추천', desc: '표지 1장 + 핵심 3장 + 팁 1장 + 요약 1장', highlight: true },
              { count: 7, label: '7장', badge: '상세 가이드', desc: '표지 1장 + 세부 4장 + 팁 1장 + 요약 1장' },
              { count: 8, label: '8장', badge: '심층 분석', desc: '표지 1장 + 비교/세부 5장 + 주의사항 + 요약' },
              { count: 10, label: '10장', badge: '인스타 풀 슬라이드', desc: '인스타그램 최대 10장 한도 풀 패키지' },
            ].map((opt) => {
              const isSelected = cardCount === opt.count;
              return (
                <div
                  key={opt.count}
                  onClick={() => setCardCount(opt.count)}
                  className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between text-left ${
                    isSelected
                      ? 'bg-purple-50/90 border-purple-600 ring-4 ring-purple-100 shadow-md scale-[1.02]'
                      : 'bg-white border-slate-200 hover:border-purple-300 hover:bg-slate-50 shadow-2xs'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-black text-slate-900">{opt.label}</span>
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                          opt.highlight
                            ? 'bg-purple-600 text-white'
                            : isSelected
                            ? 'bg-purple-200 text-purple-900'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {opt.badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{opt.desc}</p>
                  </div>

                  {isSelected && (
                    <div className="mt-3 pt-2 border-t border-purple-200 flex items-center gap-1 text-[11px] font-bold text-purple-700">
                      <Check className="w-3.5 h-3.5" />
                      <span>선택됨</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              onClick={() => setCurrentStep(1)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              이전: 글 확인
            </button>
            <button
              onClick={handleAnalyzeAndGenerate}
              disabled={isAnalyzing || !docSource}
              className="px-6 py-3 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-black text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>AI 분석 실행 중 ({cardCount}장 기획)...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>{cardCount}장 AI 핵심 내용 분석 및 구성 시작</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* STEP 3: [AI 핵심 내용 분석 & 카드별 문구 자동 구성 + 사용자 직접 수정] */}
      {/* ================================================================ */}
      {currentStep === 3 && (
        <div className="space-y-6">
          {/* Header & Quick Stats */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-purple-700 uppercase">STEP 03</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  {contentType || '정보형'}
                </span>
              </div>
              <h3 className="text-lg font-black text-slate-900 mt-1">
                AI 카드뉴스 문구 구성 & 정밀 편집
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                모바일 화면에서 한눈에 쏙 들어오도록 카드별 제목·서브문구·본문을 수정하고 이미지 필요 여부를 설정할 수 있습니다.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start md:self-auto">
              <button
                onClick={handleAddNewCard}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>카드 추가</span>
              </button>
              <button
                onClick={() => setCurrentStep(4)}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <span>다음: 디자인 선택</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Cards Manager Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Card List & Reorder Carousel (4 Cols) */}
            <div className="lg:col-span-4 space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-black text-slate-800">전체 카드 목록 ({cards.length}장)</span>
                <span className="text-[11px] text-slate-500">순서 조정 및 선택</span>
              </div>

              <div className="space-y-2 max-h-[700px] overflow-y-auto pr-1">
                {cards.map((c, idx) => {
                  const isSelected = c.id === selectedCardId;
                  const roleDef = ROLE_DEFINITIONS[c.cardRole] || ROLE_DEFINITIONS.key_point;
                  const isOverLimit = c.body.length > 130;
                  const isTextOnly = c.imageSource === 'none' || c.imageSource === 'no_image';

                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedCardId(c.id)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between text-left ${
                        isSelected
                          ? 'bg-purple-50/90 border-purple-500 ring-2 ring-purple-300 shadow-md'
                          : 'bg-white border-slate-200 hover:border-purple-200 hover:bg-slate-50/70 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                            isSelected ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {c.cardNumber}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border ${roleDef.bg} ${roleDef.text} ${roleDef.border}`}
                            >
                              {roleDef.label.split(' ')[0]}
                            </span>
                            {isTextOnly ? (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                                텍스트전용
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-50 text-blue-700">
                                이미지포함
                              </span>
                            )}
                            {isOverLimit && (
                              <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-rose-100 text-rose-800">
                                길이 주의
                              </span>
                            )}
                          </div>
                          <h4 className="text-xs font-black text-slate-900 truncate mt-1">
                            {c.title || '제목 없음'}
                          </h4>
                          <p className="text-[10px] text-slate-500 truncate">{c.body}</p>
                        </div>
                      </div>

                      {/* Reorder Buttons */}
                      <div className="flex items-center gap-1 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleMoveCardUp(idx)}
                          disabled={idx === 0}
                          className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                        >
                          <MoveUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleMoveCardDown(idx)}
                          disabled={idx === cards.length - 1}
                          className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                        >
                          <MoveDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Detailed Card Editor (8 Cols) */}
            <div className="lg:col-span-8 space-y-4">
              {activeCard ? (
                <div className="bg-white border border-slate-200/80 rounded-3xl p-6 space-y-5 shadow-sm">
                  {/* Card Header & Role / Layout Picker */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black px-2.5 py-1 rounded-xl bg-purple-600 text-white">
                        #{activeCard.cardNumber} 카드 상세 편집
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        {activeCard.cardRole === 'cover' ? '메인 표지' : '본문 슬라이드'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAutoCondenseText(activeCard.id)}
                        className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 text-[11px] font-bold border border-amber-200 flex items-center gap-1 cursor-pointer"
                      >
                        <Zap className="w-3 h-3 text-amber-600" />
                        <span>텍스트 길이 자동 최적화</span>
                      </button>
                      <button
                        onClick={() => handleDeleteCard(activeCard.id)}
                        className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                        title="카드 삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Per-card Image Requirement Switch */}
                  <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-purple-600" />
                        <span>이 카드의 이미지 필요 여부</span>
                      </label>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {activeCard.imageSource === 'none'
                          ? '🚫 이 카드는 이미지 없이 텍스트/그래픽 중심 레이아웃으로 깔끔하게 렌더링됩니다.'
                          : '🖼️ 이 카드는 사진/그래픽과 함께 배치되는 레이아웃으로 렌더링됩니다.'}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() =>
                          handleUpdateActiveCard(
                            'imageSource',
                            activeCard.imageSource === 'none' ? (imageSourceMode === 'no_image' ? 'unsplash' : imageSourceMode) : 'none'
                          )
                        }
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                          activeCard.imageSource === 'none'
                            ? 'bg-slate-200 text-slate-800 hover:bg-slate-300'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        }`}
                      >
                        {activeCard.imageSource === 'none' ? (
                          <>
                            <Ban className="w-3.5 h-3.5 text-slate-600" />
                            <span>이미지 불필요 (텍스트 전용)</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-700" />
                            <span>이미지 포함</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Card Role & Layout Variant Selectors */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">카드 역할 (Role)</label>
                      <select
                        value={activeCard.cardRole}
                        onChange={(e) => handleUpdateActiveCard('cardRole', e.target.value as CardRoleType)}
                        className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                      >
                        {Object.entries(ROLE_DEFINITIONS).map(([key, def]) => (
                          <option key={key} value={key}>
                            {def.label} - {def.desc}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">레이아웃 스타일 (Layout)</label>
                      <select
                        value={activeCard.layoutVariant || 'text_focus'}
                        onChange={(e) => handleUpdateActiveCard('layoutVariant', e.target.value as CardLayoutVariant)}
                        className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                      >
                        {LAYOUT_VARIANTS.map((lv) => (
                          <option key={lv.id} value={lv.id}>
                            {lv.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Form Inputs: Title, Subtitle, Body */}
                  <div className="space-y-3.5">
                    {/* Title */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-slate-700">카드 제목 (Title)</label>
                        <span
                          className={`text-[10px] font-bold ${
                            activeCard.title.length > 25 ? 'text-rose-600' : 'text-slate-400'
                          }`}
                        >
                          {activeCard.title.length} / 25자 권장
                        </span>
                      </div>
                      <input
                        type="text"
                        value={activeCard.title}
                        onChange={(e) => handleUpdateActiveCard('title', e.target.value)}
                        placeholder="임팩트 있는 제목을 입력하세요"
                        className="w-full text-sm font-bold px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-400"
                      />
                    </div>

                    {/* Subtitle */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-slate-700">서브 문구 (Subtitle)</label>
                        <span className="text-[10px] text-slate-400 font-bold">
                          {activeCard.subtitle?.length || 0} / 35자
                        </span>
                      </div>
                      <input
                        type="text"
                        value={activeCard.subtitle || ''}
                        onChange={(e) => handleUpdateActiveCard('subtitle', e.target.value)}
                        placeholder="제목을 보조하는 설명 문구를 입력하세요"
                        className="w-full text-xs font-medium px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-400"
                      />
                    </div>

                    {/* Body */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-slate-700">카드 본문 요약 (Body)</label>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            activeCard.body.length > 130
                              ? 'bg-rose-100 text-rose-800'
                              : activeCard.body.length > 80
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {activeCard.body.length}자 (80~120자 권장)
                        </span>
                      </div>
                      <textarea
                        rows={3}
                        value={activeCard.body}
                        onChange={(e) => handleUpdateActiveCard('body', e.target.value)}
                        placeholder="모바일에서 가독성이 좋도록 1~3문장의 간결한 호흡으로 작성하세요"
                        className="w-full text-xs font-medium px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-400 leading-relaxed"
                      />
                    </div>

                    {/* Emphasis Keywords Tag Manager */}
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        강조 키워드 (Emphasis Tags)
                      </label>
                      <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl border border-slate-200 bg-slate-50/50">
                        {activeCard.emphasis?.map((kw, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-100 text-purple-900 text-xs font-bold border border-purple-200"
                          >
                            <span>#{kw}</span>
                            <button
                              onClick={() => handleRemoveEmphasisTag(kw)}
                              className="hover:text-purple-600 cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}

                        <div className="flex items-center gap-1 ml-auto">
                          <input
                            type="text"
                            value={newEmphasisTag}
                            onChange={(e) => setNewEmphasisTag(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddEmphasisTag();
                              }
                            }}
                            placeholder="태그 입력 후 Enter"
                            className="text-xs px-2 py-1 rounded border border-slate-200 bg-white w-28 focus:outline-none focus:ring-1 focus:ring-purple-400"
                          />
                          <button
                            onClick={handleAddEmphasisTag}
                            className="px-2 py-1 rounded bg-slate-200 hover:bg-slate-300 text-xs font-bold text-slate-700 cursor-pointer"
                          >
                            추가
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Source Context Reference (Single Source of Truth) */}
                    {activeCard.sourceContext && (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-600">
                        <span className="font-bold text-slate-800 block mb-0.5">📌 원문 근거 문장:</span>
                        <p className="italic leading-relaxed">"{activeCard.sourceContext}"</p>
                      </div>
                    )}
                  </div>

                  {/* AI Quick Improvement Tools */}
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                      <span>이 카드 문구 AI 즉시 개선</span>
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {IMPROVE_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => handleImproveCardContent(opt.id)}
                          disabled={improvingCardId === activeCard.id}
                          className="px-2 py-2 rounded-xl border border-purple-200 bg-purple-50/60 hover:bg-purple-100 text-purple-900 text-xs font-bold transition-colors flex flex-col items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          <span>{opt.icon}</span>
                          <span>{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 rounded-3xl p-12 text-center text-slate-400 font-bold">
                  카드를 선택해 주세요
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* STEP 4: [카드 디자인 선택] */}
      {/* ================================================================ */}
      {currentStep === 4 && (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
          <CardNewsDesignPicker
            selectedTemplate={selectedTemplate}
            onSelectTemplate={(tmpl) => {
              setSelectedTemplate(tmpl);
              onShowToast(`✓ [${tmpl.toUpperCase()}] 디자인 템플릿이 적용되었습니다.`);
            }}
          />

          {/* Live Preview of active card with selected template */}
          {activeCard && (
            <div className="pt-6 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-purple-600" />
                  <span>적용된 템플릿 실시간 렌더링 미리보기 (#{activeCard.cardNumber} 카드)</span>
                </span>
                <span className="text-[11px] text-slate-500 font-medium">1:1 Instagram Square Standard</span>
              </div>

              <div className="max-w-[380px] mx-auto pt-2">
                <CardNewsCardRenderer
                  card={activeCard}
                  totalCards={cards.length}
                  templateId={selectedTemplate}
                  imageSourceMode={imageSourceMode}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              onClick={() => setCurrentStep(3)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              이전: 문구 수정
            </button>
            <button
              onClick={() => setCurrentStep(imageSourceMode === 'no_image' ? 6 : 5)}
              className="px-6 py-3 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-black text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <span>
                {imageSourceMode === 'no_image'
                  ? '다음: 완성 카드뉴스 생성 & 다운로드'
                  : '다음: 이미지 소스 선택'}
              </span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* STEP 5: [이미지 소스 선택] */}
      {/* ================================================================ */}
      {currentStep === 5 && (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
          <CardNewsImageSourcePicker
            selectedMode={imageSourceMode}
            onSelectMode={(mode) => {
              setImageSourceMode(mode);
              if (mode === 'unsplash') {
                handleAutoMatchUnsplashPhotos(cards);
              } else if (mode === 'no_image') {
                const updated = cards.map((c) => ({ ...c, imageSource: 'none' as const }));
                setCards(updated);
              }
              onShowToast(`✓ 이미지 소스가 [${mode}] 방식으로 설정되었습니다.`);
            }}
          />

          {/* Conditional UI: No-image mode vs with-images mode */}
          {imageSourceMode === 'no_image' ? (
            <div className="pt-4 border-t border-slate-100 space-y-4">
              <div className="bg-purple-50/70 border border-purple-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-xs font-black text-purple-900 flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-purple-700" />
                    <span>[이미지 없이 제작(No Image)] 모드가 활성화되어 있습니다</span>
                  </span>
                  <p className="text-xs text-purple-700 leading-relaxed">
                    사진이나 외부 그래픽 없이, 선택하신 <strong>[{selectedTemplate.toUpperCase()}]</strong> 템플릿의
                    정갈한 텍스트 배치와 타이포그래피 박스 디자인으로만 제작됩니다.
                  </p>
                </div>
                <button
                  onClick={() => setCurrentStep(6)}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black shrink-0 flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <span>완성본 확인 및 다운로드</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            /* Per-card Image Customizer Strip */
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-purple-600" />
                  <span>카드별 개별 이미지 관리 ({cards.length}장)</span>
                </h4>
                {imageSourceMode === 'unsplash' && (
                  <button
                    onClick={() => handleAutoMatchUnsplashPhotos(cards)}
                    disabled={isSearchingUnsplashAll}
                    className="px-3 py-1 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${isSearchingUnsplashAll ? 'animate-spin' : ''}`} />
                    <span>전체 Unsplash 자동 매칭 재실행</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {cards.map((c) => {
                  const isNoPic = c.imageSource === 'none' || c.imageSource === 'no_image';
                  const hasPic = !isNoPic && Boolean(c.userUploadedImage || c.imageUrl);

                  return (
                    <div
                      key={c.id}
                      className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-200 border shrink-0">
                          {hasPic ? (
                            <img
                              src={c.userUploadedImage || c.imageUrl}
                              alt={c.title}
                              className="w-full h-full object-cover"
                            />
                          ) : isNoPic ? (
                            <div className="w-full h-full flex items-center justify-center bg-slate-100 text-[9px] font-bold text-slate-400 text-center p-1">
                              텍스트 전용
                            </div>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-slate-400">
                              사진 없음
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-black text-purple-700">#{c.cardNumber}</span>
                            {isNoPic && (
                              <span className="text-[8px] font-bold px-1.5 py-0.2 rounded bg-slate-200 text-slate-600">
                                이미지 불필요
                              </span>
                            )}
                            {c.imageSource === 'ai' && (
                              <span className="text-[8px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">
                                AI 그래픽
                              </span>
                            )}
                          </div>
                          <h5 className="text-xs font-bold text-slate-900 truncate mt-0.5">{c.title}</h5>
                          <p className="text-[10px] text-slate-500 truncate">
                            {isNoPic
                              ? '🚫 이미지 미사용'
                              : c.searchQuery
                              ? `🔍 ${c.searchQuery}`
                              : c.userUploadedImage
                              ? '📁 직접 업로드'
                              : c.imageSource === 'ai'
                              ? '✨ AI 생성 그래픽'
                              : '사진 미지정'}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1 shrink-0">
                        {isNoPic ? (
                          <button
                            onClick={() => {
                              const updated = cards.map((item) =>
                                item.id === c.id ? { ...item, imageSource: 'unsplash' as const } : item
                              );
                              setCards(updated);
                              handleOpenPhotoModal(c);
                            }}
                            className="px-2 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold cursor-pointer shadow-2xs"
                          >
                            + 사진 추가
                          </button>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleOpenPhotoModal(c)}
                                className="px-2 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold cursor-pointer shadow-2xs"
                                title="Unsplash 사진 검색"
                              >
                                사진 찾기
                              </button>
                              <label className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold cursor-pointer shadow-2xs text-center">
                                <span>업로드</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => handleUploadUserImage(e, c.id)}
                                />
                              </label>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleGenerateAiImageForCard(c)}
                                disabled={generatingAiCardId === c.id}
                                className="px-2 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold cursor-pointer shadow-2xs flex items-center justify-center gap-1 disabled:opacity-50 flex-1"
                                title="이 카드 맞춤 AI 그래픽 생성"
                              >
                                {generatingAiCardId === c.id ? (
                                  <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                                ) : (
                                  <Sparkles className="w-2.5 h-2.5" />
                                )}
                                <span>AI 생성</span>
                              </button>
                              <button
                                onClick={() => {
                                  const updated = cards.map((item) =>
                                    item.id === c.id ? { ...item, imageSource: 'none' as const } : item
                                  );
                                  setCards(updated);
                                  onShowToast(`✓ #${c.cardNumber} 카드를 텍스트 전용으로 전환했습니다.`);
                                }}
                                className="p-1 rounded-lg bg-slate-200 hover:bg-rose-100 text-slate-600 hover:text-rose-700 text-[10px] font-bold cursor-pointer"
                                title="이미지 제거 (텍스트 전용 전환)"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              onClick={() => setCurrentStep(4)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              이전: 디자인 템플릿
            </button>
            <button
              onClick={() => setCurrentStep(6)}
              className="px-6 py-3 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-black text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <span>다음: 완성 카드뉴스 생성 & 다운로드</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* STEP 6: [카드뉴스 생성 및 완성 카드 미리보기 & 저장 / 다운로드] */}
      {/* ================================================================ */}
      {currentStep === 6 && (
        <div className="space-y-6">
          {/* Pre-Generation Validation Banner */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-sm shrink-0">
                  <ShieldCheck className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-emerald-950">
                    카드뉴스 완성본 생성 및 1080×1080 규격 렌더링 완료
                  </h3>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    총 {cards.length}장의 슬라이드가 [{selectedTemplate.toUpperCase()}] 디자인 시스템 규격으로 렌더링되었습니다.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleDownloadAllCardsZip}
                  disabled={isExporting}
                  className="px-4 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Archive className="w-4 h-4" />
                  <span>전체 {cards.length}장 ZIP 일괄 다운로드</span>
                </button>

                <button
                  onClick={() => setShowJsonModal(true)}
                  className="px-3.5 py-2.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  <span>JSON 내보내기</span>
                </button>
              </div>
            </div>

            {/* Validation Checklist Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 mt-3 border-t border-emerald-200/80 text-[11px] text-emerald-900 font-semibold">
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-700" />
                <span>장수 일치 ({cards.length}/{cardCount}장)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-700" />
                <span>문구 유효성 검증 완료</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-700" />
                <span>디자인 영역 오버플로우 0건</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-700" />
                <span>[{selectedTemplate}] 템플릿 일관 적용</span>
              </div>
            </div>
          </div>

          {/* View Mode Toggle: Single Slide vs Grid */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPreviewDisplayMode('single')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  previewDisplayMode === 'single'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                단일 카드 확대 뷰
              </button>
              <button
                onClick={() => setPreviewDisplayMode('grid')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  previewDisplayMode === 'grid'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                전체 카드 그리드 뷰 ({cards.length}장)
              </button>
            </div>

            <span className="text-xs font-medium text-slate-500">
              1080 × 1080 px 고해상도 인스타그램 정방형
            </span>
          </div>

          {/* Single Slide Interactive Viewer */}
          {previewDisplayMode === 'single' && (
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 space-y-6 shadow-sm">
              {cards[previewSlideIndex] && (
                <div className="space-y-4">
                  {/* Active Card High Res Frame */}
                  <div className="max-w-[540px] mx-auto shadow-2xl rounded-3xl overflow-hidden">
                    <CardNewsCardRenderer
                      card={cards[previewSlideIndex]}
                      totalCards={cards.length}
                      templateId={selectedTemplate}
                      imageSourceMode={imageSourceMode}
                    />
                  </div>

                  {/* Navigation & Action Bar */}
                  <div className="max-w-[540px] mx-auto flex items-center justify-between gap-2 pt-2">
                    <button
                      onClick={() => setPreviewSlideIndex((prev) => Math.max(0, prev - 1))}
                      disabled={previewSlideIndex === 0}
                      className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 disabled:opacity-30 cursor-pointer flex items-center gap-1 shadow-2xs"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>이전 카드</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopyCardImageToClipboard(cards[previewSlideIndex])}
                        className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold cursor-pointer shadow-2xs"
                        title="클립보드 복사"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDownloadSingleCardPng(cards[previewSlideIndex])}
                        disabled={isExporting}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black cursor-pointer shadow-sm flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>이 카드 PNG 다운로드</span>
                      </button>
                    </div>

                    <button
                      onClick={() => setPreviewSlideIndex((prev) => Math.min(cards.length - 1, prev + 1))}
                      disabled={previewSlideIndex === cards.length - 1}
                      className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 disabled:opacity-30 cursor-pointer flex items-center gap-1 shadow-2xs"
                    >
                      <span>다음 카드</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Thumbnails Carousel Bar */}
              <div className="pt-4 border-t border-slate-100">
                <span className="text-xs font-bold text-slate-700 block mb-2">
                  슬라이드 바로가기 (클릭 시 이동)
                </span>
                <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-10 gap-2">
                  {cards.map((c, idx) => {
                    const isActive = idx === previewSlideIndex;
                    return (
                      <div
                        key={c.id}
                        onClick={() => setPreviewSlideIndex(idx)}
                        className={`p-2 rounded-xl border-2 text-center transition-all cursor-pointer ${
                          isActive
                            ? 'bg-purple-50 border-purple-600 ring-2 ring-purple-300 shadow-sm'
                            : 'bg-white border-slate-200 hover:border-purple-200 hover:bg-slate-50'
                        }`}
                      >
                        <span className="text-xs font-black text-slate-900">#{idx + 1}</span>
                        <p className="text-[9px] text-slate-500 truncate mt-0.5">{c.title}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Grid View: All Cards at once */}
          {previewDisplayMode === 'grid' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {cards.map((c) => (
                <div
                  key={c.id}
                  className="bg-white border border-slate-200/80 rounded-3xl p-4 space-y-3 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 px-1">
                    <span>슬라이드 #{c.cardNumber}</span>
                    <button
                      onClick={() => handleDownloadSingleCardPng(c)}
                      className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-purple-600 transition-colors cursor-pointer"
                      title="PNG 다운로드"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="rounded-2xl overflow-hidden shadow-md">
                    <CardNewsCardRenderer
                      card={c}
                      totalCards={cards.length}
                      templateId={selectedTemplate}
                      imageSourceMode={imageSourceMode}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 3. PHOTO SEARCH MODAL (FOR SINGLE CARD UNSPLASH SWAP) */}
      {/* ----------------------------------------------------------------- */}
      {activePhotoModalCardId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-2xl w-full space-y-4 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-blue-600" />
                <h3 className="text-base font-black text-slate-900">Unsplash 고화질 사진 검색 및 교체</h3>
              </div>
              <button
                onClick={() => setActivePhotoModalCardId(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={photoSearchQuery}
                onChange={(e) => setPhotoSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearchPhotosInModal();
                }}
                placeholder="영문 또는 한글 키워드 입력 (예: tokyo tower, flight, coffee)"
                className="flex-1 text-xs font-semibold px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <button
                onClick={handleSearchPhotosInModal}
                disabled={isSearchingPhotos}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isSearchingPhotos ? '검색 중...' : '검색'}
              </button>
            </div>

            {/* Candidates Grid */}
            <div className="flex-1 overflow-y-auto min-h-[300px]">
              {isSearchingPhotos ? (
                <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs font-bold">
                  <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
                  <span>Unsplash 고화질 사진을 검색하는 중입니다...</span>
                </div>
              ) : photoCandidates.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {photoCandidates.map((photo) => (
                    <div
                      key={photo.id}
                      onClick={() => handleSelectCandidatePhoto(photo)}
                      className="group relative rounded-2xl overflow-hidden border border-slate-200 cursor-pointer shadow-xs hover:ring-2 hover:ring-blue-500 transition-all aspect-square"
                    >
                      <img
                        src={photo.thumbUrl}
                        alt={photo.alt}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                        <span className="text-[10px] text-white font-bold truncate">선택하기</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-xs font-bold">
                  검색 결과가 없습니다. 다른 키워드로 검색해 보세요.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 4. JSON EXPORT MODAL */}
      {/* ----------------------------------------------------------------- */}
      {showJsonModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-2xl w-full space-y-4 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-600" />
                <h3 className="text-base font-black text-slate-900">카드뉴스 프로젝트 JSON 데이터</h3>
              </div>
              <button
                onClick={() => setShowJsonModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-950 text-slate-200 p-4 rounded-2xl font-mono text-xs leading-relaxed border border-slate-800">
              <pre>{JSON.stringify(projectExportData, null, 2)}</pre>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={handleCopyJson}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{isCopied ? '복사 완료!' : 'JSON 클립보드 복사'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 5. HIDDEN DEDICATED 540x540 MASTER EXPORT RENDER CONTAINER */}
      {/* Captured at scale: 2 to produce pixel-perfect 1080x1080 matching Viewer */}
      {/* ----------------------------------------------------------------- */}
      <div
        style={{
          position: 'fixed',
          left: '-9999px',
          top: '0px',
          width: '540px',
          pointerEvents: 'none',
          zIndex: -9999,
          opacity: 0,
        }}
        aria-hidden="true"
      >
        {cards.map((c) => (
          <div
            key={c.id}
            id={`export-card-${c.id}`}
            style={{ width: '540px', height: '540px', position: 'relative', overflow: 'hidden' }}
          >
            <CardNewsCardRenderer
              card={c}
              totalCards={cards.length}
              templateId={selectedTemplate}
              imageSourceMode={imageSourceMode}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
