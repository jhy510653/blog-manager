import React, { useState, useEffect } from 'react';
import { extractAndParseJson } from '../../utils/jsonUtils';
import {
  ImageIcon,
  Sparkles,
  Search,
  Check,
  RefreshCw,
  Copy,
  Code2,
  Sliders,
  Eye,
  Layers,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ExternalLink,
  Plus,
  Trash2,
  FileText,
  Quote,
  Camera,
  RotateCcw,
  CheckCheck,
  Download,
  Info,
  ChevronDown,
  ChevronUp,
  Wand2,
  Shuffle,
  ShieldCheck,
  Crop,
  SlidersHorizontal,
} from 'lucide-react';
import {
  VisualDocumentSource,
  ImageSlot,
  ImageMatchCandidate,
  ImageMatchingOptions,
  InsertedBlogImageInfo,
} from './visualTypes';
import {
  isValidUnsplashUrl,
  isValidUnsplashPhoto,
  sanitizeUnsplashPhoto,
  transformAndStoreUnsplashImage,
  transformAndStoreUnsplashBatch,
} from '../../utils/imagePipeline';

interface ImageMatchingStudioProps {
  document: VisualDocumentSource | null;
  onShowToast: (msg: string) => void;
  currentUser: any;
  isAdmin?: boolean;
}

export const ImageMatchingStudio: React.FC<ImageMatchingStudioProps> = ({
  document,
  onShowToast,
  currentUser,
  isAdmin,
}) => {
  // 1. Configuration state
  const [options, setOptions] = useState<ImageMatchingOptions>({
    targetCount: 4, // 3, 4, 5, 6, 7
    imageStyle: 'auto',
    autoRecommend: true,
    aspectRatio: '16:9',
  });

  // 2. Flow states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<string>('');
  const [slots, setSlots] = useState<ImageSlot[]>([]);
  const [customQueryInputs, setCustomQueryInputs] = useState<Record<string, string>>({});
  const [searchingSlotIds, setSearchingSlotIds] = useState<Record<string, boolean>>({});
  
  // 3. Final document preview & insertion state
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [isInserted, setIsInserted] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'match_workflow' | 'final_preview'>('match_workflow');
  const [insertedImagesList, setInsertedImagesList] = useState<InsertedBlogImageInfo[]>([]);

  // Count of selected images
  const selectedCount = slots.filter((s) => s.selectedImage).length;
  const totalSlotsCount = slots.length;

  // Unsplash search helper function (Strictly Unsplash only)
  const searchUnsplashForQuery = async (
    query: string,
    perPage: number = 6
  ): Promise<ImageMatchCandidate[]> => {
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
                source: 'unsplash' as const,
                width: sanitized.width,
                height: sanitized.height,
                tags: Array.isArray(sanitized.tags)
                  ? sanitized.tags.map((t: any) => (typeof t === 'string' ? t : t.title)).filter(Boolean).slice(0, 3)
                  : [],
              };
            })
            .filter((c: any): c is ImageMatchCandidate => Boolean(c && isValidUnsplashUrl(c.url)));
        }
      }
    } catch (err) {
      console.warn('[Unsplash Search error]:', err);
    }
    return [];
  };

  // Helper: Search candidates across queries for a slot
  const fetchCandidatesForSlot = async (
    queries: string[],
    slotSubject: string
  ): Promise<{ candidates: ImageMatchCandidate[]; bestQuery: string }> => {
    for (const q of queries) {
      if (!q || q.trim().length < 2) continue;
      const results = await searchUnsplashForQuery(q, 6);
      if (results.length > 0) {
        return { candidates: results.slice(0, 3), bestQuery: q };
      }
    }
    // If no candidate found from primary queries, try a fallback keyword
    if (slotSubject) {
      const fallbackResults = await searchUnsplashForQuery(slotSubject, 6);
      if (fallbackResults.length > 0) {
        return { candidates: fallbackResults.slice(0, 3), bestQuery: slotSubject };
      }
    }
    return { candidates: [], bestQuery: queries[0] || '' };
  };

  // Step 1: Analyze Document and Extract Slots & Unsplash Candidates
  const handleAnalyzeDocument = async () => {
    if (!document || !document.content || document.content.trim().length < 20) {
      onShowToast('⚠️ 먼저 분석할 블로그 글을 선택하거나 입력해 주세요.');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisProgress('블로그 본문의 문맥과 시각 요소를 정밀 분석하는 중입니다...');
    setSlots([]);
    setIsInserted(false);
    setViewMode('match_workflow');

    try {
      // 1. Call AI Toolkit API for visual image matching plan
      const res = await fetch('/api/gemini/toolkit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'visual_image_match',
          draftContent: document.content || document.plainText,
          targetCount: options.targetCount,
          isChallengeParticipant: true,
        }),
      });

      let rawSlots: any[] = [];

      if (res.ok) {
        const data = await res.json();
        const rawRes = data.result || data;
        let parsed: any = typeof rawRes === 'string' ? extractAndParseJson(rawRes) : rawRes;
        rawSlots = Array.isArray(parsed?.slots) ? parsed.slots : Array.isArray(parsed?.imagePlans) ? parsed.imagePlans : Array.isArray(parsed) ? parsed : [];
      }

      // 2. Fallback heuristic if AI call didn't produce slots
      if (!rawSlots || rawSlots.length === 0) {
        setAnalysisProgress('본문 문단별 키워드 추출 및 대체 슬롯 생성 중...');
        const docText = document.plainText || document.content.replace(/<[^>]+>/g, ' ');
        const paragraphs = docText
          .split(/\n+/)
          .map((p) => p.trim())
          .filter((p) => p.length > 25);

        const count = Math.min(options.targetCount, Math.max(2, paragraphs.length || 3));
        const mainKw = document.keyword || document.title.split(' ')[0] || '블로그';

        for (let i = 0; i < count; i++) {
          const pIndex = Math.min(i * 2 + 1, Math.max(0, paragraphs.length - 1));
          const snippet = paragraphs[pIndex] || `${document.title} 본문 내용 ${i + 1}`;
          
          let subKw = mainKw;
          if (snippet.includes('액체') || snippet.includes('지퍼백')) subKw = 'clear liquids bag airport';
          else if (snippet.includes('와인') || snippet.includes('수하물')) subKw = 'wine bottle suitcase luggage';
          else if (snippet.includes('면세점') || snippet.includes('주류')) subKw = 'airport duty free liquor';
          else if (snippet.includes('배터리') || snippet.includes('보조배터리')) subKw = 'power bank airplane carry on';
          else subKw = `${mainKw} review detail`;

          rawSlots.push({
            id: `slot_${i + 1}`,
            positionIndex: i + 1,
            insertionPoint: i === 0 ? '도입부 직후' : i === count - 1 ? '마무리 요약 전' : `소제목 ${i} 직후`,
            relatedParagraph: snippet.substring(0, 150),
            subject: `${mainKw} 관련 상세 실물`,
            visualDescription: `${snippet.substring(0, 60)} 내용을 시각적으로 보조하는 실물 이미지`,
            searchQueries: [subKw, `${subKw} item`, `${mainKw} scene`],
            reason: '해당 단락의 핵심 정보를 시각적으로 직관적이게 보조',
          });
        }
      }

      // 3. Search Unsplash photos for each slot in parallel
      setAnalysisProgress('Unsplash에서 각 위치별 고화질 실물 이미지 후보를 실시간 검색 중...');
      
      const populatedSlots: ImageSlot[] = await Promise.all(
        rawSlots.map(async (slot: any, idx: number) => {
          const queries = Array.isArray(slot.searchQueries) ? slot.searchQueries : [slot.subject || 'blog'];
          const { candidates, bestQuery } = await fetchCandidatesForSlot(queries, slot.subject || '');

          return {
            id: slot.id || `slot_${idx + 1}`,
            positionIndex: slot.positionIndex || idx + 1,
            insertionPoint: slot.insertionPoint || `${idx + 1}번째 문단 뒤`,
            relatedParagraph: slot.relatedParagraph || '',
            subject: slot.subject || `${idx + 1}번째 이미지`,
            visualDescription: slot.visualDescription || '',
            searchQueries: queries,
            selectedQuery: bestQuery || queries[0] || '',
            reason: slot.reason || '본문 문맥 시각화',
            status: candidates.length > 0 ? ('ready' as const) : ('no_result' as const),
            candidates: candidates,
            selectedImage: candidates.length > 0 ? candidates[0] : undefined, // Auto-select first candidate by default
            isInserted: false,
          };
        })
      );

      setSlots(populatedSlots);
      
      // Initialize query input state
      const initialInputs: Record<string, string> = {};
      populatedSlots.forEach((s) => {
        initialInputs[s.id] = s.selectedQuery;
      });
      setCustomQueryInputs(initialInputs);

      setIsAnalyzing(false);
      onShowToast(`✓ 본문 분석 완료! ${populatedSlots.length}개 위치의 추천 이미지 후보를 검색했습니다.`);
    } catch (err: any) {
      console.error('[handleAnalyzeDocument error]:', err);
      setIsAnalyzing(false);
      onShowToast(`⚠️ 분석 중 오류가 발생했습니다: ${err.message || '다시 시도해 주세요.'}`);
    }
  };

  // Re-search Unsplash for a specific slot with a custom keyword
  const handleReSearchSlot = async (slotId: string, customQuery?: string) => {
    const slot = slots.find((s) => s.id === slotId);
    if (!slot) return;

    const queryToSearch = (customQuery !== undefined ? customQuery : customQueryInputs[slotId] || slot.selectedQuery || '').trim();
    if (!queryToSearch) {
      onShowToast('⚠️ 검색어를 입력해 주세요.');
      return;
    }

    setSearchingSlotIds((prev) => ({ ...prev, [slotId]: true }));

    try {
      const candidates = await searchUnsplashForQuery(queryToSearch, 6);

      setSlots((prev) =>
        prev.map((s) => {
          if (s.id !== slotId) return s;
          const newCandidates = candidates.slice(0, 3);
          return {
            ...s,
            selectedQuery: queryToSearch,
            candidates: newCandidates,
            status: newCandidates.length > 0 ? 'ready' : 'no_result',
            selectedImage: newCandidates.length > 0 ? newCandidates[0] : undefined,
          };
        })
      );

      if (candidates.length > 0) {
        onShowToast(`🔍 '${queryToSearch}' 검색 결과 ${candidates.length}개의 후보를 갱신했습니다.`);
      } else {
        onShowToast(`⚠️ '${queryToSearch}'에 대한 적절한 이미지를 찾지 못했습니다.`);
      }
    } catch (err) {
      onShowToast('⚠️ 이미지 검색 중 오류가 발생했습니다.');
    } finally {
      setSearchingSlotIds((prev) => ({ ...prev, [slotId]: false }));
    }
  };

  // Handle selecting / changing an image candidate for a slot
  const handleSelectCandidate = async (slotId: string, candidate: ImageMatchCandidate) => {
    // 1. Instantly update UI selection
    setSlots((prev) =>
      prev.map((s) => {
        if (s.id !== slotId) return s;
        const isCurrent = s.selectedImage?.id === candidate.id;
        return {
          ...s,
          selectedImage: isCurrent ? s.selectedImage : { ...candidate, originalUrl: candidate.originalUrl || candidate.url },
          status: 'selected',
        };
      })
    );

    const slotIndex = slots.findIndex((s) => s.id === slotId);
    onShowToast(`✓ [위치 #${slotIndex + 1}] 이미지가 선택되었습니다.`);

    // 2. Automatically apply Sharp anti-duplicate transformation and upload to Supabase Storage if not done yet
    if (!candidate.isAntiDuplicateTransformed) {
      setSlots((prev) =>
        prev.map((s) => (s.id === slotId ? { ...s, isTransforming: true } : s))
      );

      try {
        const slot = slots.find((s) => s.id === slotId);
        const transformRes = await transformAndStoreUnsplashImage(candidate.url, {
          alt: candidate.alt,
          subject: slot?.subject,
        });

        if (transformRes && transformRes.transformedUrl) {
          setSlots((prev) =>
            prev.map((s) => {
              if (s.id !== slotId) return s;
              const updatedSelected = s.selectedImage
                ? {
                    ...s.selectedImage,
                    originalUrl: transformRes.originalUrl || s.selectedImage.url,
                    url: transformRes.transformedUrl,
                    modifications: transformRes.modifications,
                    storageProvider: (transformRes.storageProvider as any) || 'supabase',
                    isAntiDuplicateTransformed: true,
                  }
                : undefined;

              const updatedCandidates = s.candidates.map((c) =>
                c.id === candidate.id
                  ? {
                      ...c,
                      originalUrl: transformRes.originalUrl || c.url,
                      url: transformRes.transformedUrl,
                      modifications: transformRes.modifications,
                      storageProvider: (transformRes.storageProvider as any) || 'supabase',
                      isAntiDuplicateTransformed: true,
                    }
                  : c
              );

              return {
                ...s,
                selectedImage: updatedSelected,
                candidates: updatedCandidates,
                isTransforming: false,
              };
            })
          );
        }
      } catch (err) {
        console.warn('[Image Transform Error]:', err);
      } finally {
        setSlots((prev) =>
          prev.map((s) => (s.id === slotId ? { ...s, isTransforming: false } : s))
        );
      }
    }
  };

  // Re-generate fresh random Sharp transformation for a selected candidate
  const handleReTransformCandidate = async (slotId: string) => {
    const slot = slots.find((s) => s.id === slotId);
    if (!slot || !slot.selectedImage) return;

    const sourceUrl = slot.selectedImage.originalUrl || slot.selectedImage.url;
    setSlots((prev) =>
      prev.map((s) => (s.id === slotId ? { ...s, isTransforming: true } : s))
    );

    try {
      const transformRes = await transformAndStoreUnsplashImage(sourceUrl, {
        alt: slot.selectedImage.alt,
        subject: slot.subject,
      });

      if (transformRes && transformRes.transformedUrl) {
        setSlots((prev) =>
          prev.map((s) => {
            if (s.id !== slotId || !s.selectedImage) return s;
            return {
              ...s,
              selectedImage: {
                ...s.selectedImage,
                url: transformRes.transformedUrl,
                originalUrl: sourceUrl,
                modifications: transformRes.modifications,
                storageProvider: (transformRes.storageProvider as any) || 'supabase',
                isAntiDuplicateTransformed: true,
              },
              isTransforming: false,
            };
          })
        );

        const mods = transformRes.modifications;
        const detailStr = mods
          ? `(크롭: ${mods.cropRatio}, 회전: ${mods.rotationAngle}, 밝기: ${mods.brightness})`
          : '';
        onShowToast(`🎲 새로운 무작위 변형이 적용되었습니다! ${detailStr}`);
      }
    } catch (err) {
      console.warn('[handleReTransformCandidate error]:', err);
      onShowToast('⚠️ 이미지 변형 재시도 중 오류가 발생했습니다.');
    } finally {
      setSlots((prev) =>
        prev.map((s) => (s.id === slotId ? { ...s, isTransforming: false } : s))
      );
    }
  };

  // Handle deselecting/clearing candidate for a slot
  const handleDeselectCandidate = (slotId: string) => {
    setSlots((prev) =>
      prev.map((s) => (s.id === slotId ? { ...s, selectedImage: undefined, status: 'ready', isTransforming: false } : s))
    );
    const slotIndex = slots.findIndex((s) => s.id === slotId);
    onShowToast(`[위치 #${slotIndex + 1}] 이미지 선택이 해제되었습니다.`);
  };

  // Build the final HTML with selected images inserted at exact insertion points
  const buildFinalDraftHtml = () => {
    if (!document) return '';

    let content = document.content;
    const insertedInfo: InsertedBlogImageInfo[] = [];

    // Filter slots with selected images
    const activeSlots = slots.filter((s) => s.selectedImage);

    if (activeSlots.length === 0) {
      return content;
    }

    // Helper: build clean styled image markup (safe for Naver blog copy)
    const buildImageMarkup = (slot: ImageSlot, img: ImageMatchCandidate, idx: number) => {
      if (!img || !img.url) {
        return '';
      }

      const unsplashLink = (img.unsplashUrl && img.unsplashUrl.includes('unsplash.com'))
        ? img.unsplashUrl
        : 'https://unsplash.com';

      insertedInfo.push({
        imageUrl: img.url,
        originalUrl: img.originalUrl || img.url,
        thumbnailUrl: img.thumbUrl || img.url,
        photographer: img.photographer || 'Unsplash Photographer',
        unsplashUrl: unsplashLink,
        searchQuery: slot.selectedQuery || img.searchQuery || '',
        insertionPoint: slot.insertionPoint,
        relatedParagraph: slot.relatedParagraph,
        slotId: slot.id,
        modifications: img.modifications,
        isAntiDuplicateTransformed: img.isAntiDuplicateTransformed,
      });

      return `\n<div class="blog-visual-image-wrapper" style="margin: 28px 0; text-align: center;">
  <img src="${img.url}" alt="${img.alt || slot.subject}" style="max-width: 100%; border-radius: 12px; box-shadow: 0 4px 14px rgba(0,0,0,0.08); display: block; margin: 0 auto;" />
  <p style="font-size: 13px; color: #64748b; margin-top: 8px; text-align: center; line-height: 1.5;">📷 [사진] ${img.alt || slot.subject} (출처: Unsplash / ${img.photographer || 'Unsplash'})</p>
</div>\n`;
    };

    // Strategy 1: Replace explicit photo placeholder guides in draft if they exist
    let slotIdx = 0;
    const guidePatterns = [
      /<div[^>]*class="[^"]*(?:photo-recommendation|image-guide|photo-rec)[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
      /<p[^>]*>\s*(?:📸|📷)?\s*\[?(?:사진\s*추천|이미지\s*추천|사진\s*가이드|사진\s*설명|이미지\s*배치|추천\s*사진|사진\s*위치|내\s*사진\s*삽입\s*위치)[^\]\n<]*\]?[:\s]*[\s\S]*?<\/p>/gi,
      /(?:📸|📷)?\s*\[(?:사진\s*추천|이미지\s*추천|사진\s*가이드|사진\s*설명|이미지\s*배치|추천\s*사진|사진\s*위치|내\s*사진\s*삽입\s*위치)[^\]\n]*\][:\s]*[^\n<]+/gi,
    ];

    for (const pat of guidePatterns) {
      content = content.replace(pat, () => {
        if (slotIdx < activeSlots.length) {
          const slot = activeSlots[slotIdx];
          const markup = buildImageMarkup(slot, slot.selectedImage!, slotIdx);
          slotIdx++;
          return markup;
        }
        return '';
      });
    }

    // Strategy 2: If remaining images not inserted via placeholder, find relatedParagraph anchor
    if (slotIdx < activeSlots.length) {
      while (slotIdx < activeSlots.length) {
        const slot = activeSlots[slotIdx];
        const img = slot.selectedImage!;
        const markup = buildImageMarkup(slot, img, slotIdx);

        // Try matching a 25-char snippet from relatedParagraph
        let anchorFound = false;
        if (slot.relatedParagraph && slot.relatedParagraph.trim().length > 15) {
          const snippet = slot.relatedParagraph.trim().substring(0, 35).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const reg = new RegExp(`(${snippet}[^<\n]*)`, 'i');
          if (reg.test(content)) {
            content = content.replace(reg, `$1\n${markup}\n`);
            anchorFound = true;
          }
        }

        // If anchor not found, distribute after a paragraph tag </p> or line break
        if (!anchorFound) {
          const pCloseMatches = content.split(/(<\/p>)/i);
          if (pCloseMatches.length > 3) {
            const insertPIdx = Math.min(
              (slotIdx + 1) * 2 + 1,
              pCloseMatches.length - 2
            );
            pCloseMatches[insertPIdx] = pCloseMatches[insertPIdx] + markup;
            content = pCloseMatches.join('');
          } else {
            // Append naturally
            content += markup;
          }
        }

        slotIdx++;
      }
    }

    setInsertedImagesList(insertedInfo);
    return content;
  };

  // Trigger Insertion Action with automated Sharp duplicate-protection transformation
  const handleInsertImagesIntoDraft = async () => {
    if (selectedCount === 0) {
      onShowToast('⚠️ 본문에 삽입할 이미지를 최소 1개 이상 선택해 주세요.');
      return;
    }

    // Check if any selected images still need Sharp transformation
    const unProcessed = slots.filter(
      (s) => s.selectedImage && !s.selectedImage.isAntiDuplicateTransformed
    );

    if (unProcessed.length > 0) {
      onShowToast('🛡️ Unsplash 이미지 자동 편집(크롭·색상·회전) 및 Supabase 저장 진행 중...');
      try {
        const batchItems = unProcessed.map((s) => ({
          id: s.id,
          url: s.selectedImage!.originalUrl || s.selectedImage!.url,
          alt: s.selectedImage!.alt,
          subject: s.subject,
        }));

        const transformedBatch = await transformAndStoreUnsplashBatch(batchItems);
        const transformMap = new Map<string, any>();
        transformedBatch.forEach((tr) => {
          if (tr.id) transformMap.set(tr.id, tr);
        });

        setSlots((prev) =>
          prev.map((s) => {
            if (!s.selectedImage || !transformMap.has(s.id)) return s;
            const tr = transformMap.get(s.id);
            if (!tr || !tr.transformedUrl) return s;
            return {
              ...s,
              selectedImage: {
                ...s.selectedImage,
                originalUrl: tr.originalUrl || s.selectedImage.url,
                url: tr.transformedUrl,
                modifications: tr.modifications,
                storageProvider: (tr.storageProvider as any) || 'supabase',
                isAntiDuplicateTransformed: true,
              },
            };
          })
        );
      } catch (e) {
        console.warn('[Batch transform error during insert]:', e);
      }
    }

    const finalHtml = buildFinalDraftHtml();
    setPreviewHtml(finalHtml);
    setIsInserted(true);
    setViewMode('final_preview');

    setSlots((prev) =>
      prev.map((s) => ({
        ...s,
        isInserted: Boolean(s.selectedImage),
      }))
    );

    onShowToast(`🎉 총 ${selectedCount}장의 이미지가 고유 편집(중복 방지)되어 본문에 성공적으로 삽입되었습니다!`);
  };

  // Keep previewHtml updated if already inserted and user changes selection
  useEffect(() => {
    if (isInserted && document) {
      const updatedHtml = buildFinalDraftHtml();
      setPreviewHtml(updatedHtml);
    }
  }, [slots, isInserted]);

  // Copy Formatted Rich Text for Naver Blog
  const handleCopyRichText = () => {
    if (!previewHtml) {
      onShowToast('⚠️ 복사할 본문이 없습니다.');
      return;
    }

    const container = window.document.createElement('div');
    container.innerHTML = previewHtml;
    container.style.position = 'fixed';
    container.style.pointerEvents = 'none';
    container.style.opacity = '0';
    window.document.body.appendChild(container);

    try {
      const selection = window.getSelection();
      if (selection) {
        const range = window.document.createRange();
        range.selectNodeContents(container);
        selection.removeAllRanges();
        selection.addRange(range);
        window.document.execCommand('copy');
        selection.removeAllRanges();
      }
      window.document.body.removeChild(container);
      onShowToast('📋 이미지가 포함된 완성 본문이 복사되었습니다! 네이버 블로그 스마트에디터에 바로 붙여넣으세요 (Ctrl+V).');
    } catch (e) {
      navigator.clipboard.writeText(previewHtml);
      onShowToast('📋 본문 HTML 코드가 복사되었습니다.');
    }
  };

  // Copy Plain HTML Code
  const handleCopyHtmlCode = () => {
    if (!previewHtml) return;
    navigator.clipboard.writeText(previewHtml);
    onShowToast('📋 HTML 코드가 클립보드에 복사되었습니다.');
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Configuration Card */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-base shrink-0">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900">본문 이미지 매칭</h3>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60">
                  Unsplash 정밀 연동
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                단순한 키워드가 아닌, 각 문단의 실제 설명 대상과 문맥을 분석하여 최적의 사진을 추천합니다.
              </p>
            </div>
          </div>

          {/* Action: Start Analysis Button */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleAnalyzeDocument}
              disabled={isAnalyzing || !document}
              className={`px-5 py-2.5 rounded-xl font-extrabold text-xs transition-all flex items-center gap-2 cursor-pointer shadow-xs ${
                isAnalyzing || !document
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20 active:scale-98'
              }`}
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>본문 분석 & 검색 중...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>본문 분석 및 이미지 추천 시작</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Options Row: Target Image Count & Quality Guideline */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-blue-600" />
              <span>원하는 이미지 개수:</span>
            </span>
            <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl">
              {[3, 4, 5, 6, 7].map((cnt) => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => setOptions((prev) => ({ ...prev, targetCount: cnt }))}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    options.targetCount === cnt
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                  }`}
                >
                  {cnt}장
                </button>
              ))}
            </div>
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              (본문 길이가 짧은 경우 실제 적절한 위치만 엄선하여 추천합니다)
            </span>
          </div>

          {/* Quick Stats if slots loaded */}
          {slots.length > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold">
                발견된 위치: <strong className="text-blue-600">{slots.length}</strong>곳
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 font-bold border border-blue-200/60">
                선택됨: <strong className="text-blue-600">{selectedCount}</strong> / {slots.length}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Document Empty State Warning */}
      {!document && (
        <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-6 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto">
            <h4 className="text-sm font-extrabold text-amber-900">분석할 블로그 글이 선택되지 않았습니다</h4>
            <p className="text-xs text-amber-700 mt-1">
              상단의 <strong>[AI 초안 불러오기]</strong> 버튼을 눌러 기존 초안을 가져오거나, <strong>[직접 본문 붙여넣기]</strong>에 원고를 입력한 후 이미지 매칭을 시작하세요.
            </p>
          </div>
        </div>
      )}

      {/* 3. Loading Analysis Progress Bar */}
      {isAnalyzing && (
        <div className="bg-blue-50/90 border border-blue-200 rounded-2xl p-6 text-center space-y-3 shadow-xs animate-pulse">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
          <h4 className="text-sm font-extrabold text-blue-900">본문 문맥을 분석하고 있습니다</h4>
          <p className="text-xs text-blue-700">{analysisProgress}</p>
        </div>
      )}

      {/* 4. Main Workflow Workspace (When Slots Exist) */}
      {slots.length > 0 && !isAnalyzing && (
        <div className="space-y-6">
          {/* Anti-Duplicate Image Protection Banner */}
          <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200/90 rounded-2xl p-4 flex items-start gap-3.5 shadow-xs">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-extrabold text-emerald-950">
                  블로그 유사 이미지 저품질 방지 시스템 (Node Sharp 자동 변형 & Supabase Storage)
                </h4>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-200/70 text-emerald-900">
                  자동 활성화
                </span>
              </div>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                Unsplash 이미지는 선택 시 <strong>90~95% 무작위 영역 크롭</strong>, <strong>±5~10% 밝기·채도·대비 조정</strong>, <strong>1° 이내 미세 회전</strong>이 자동 적용된 후 Supabase Storage에 새 파일로 저장됩니다. 동일한 원본 사진을 다시 사용하더라도 매번 완전히 다른 고유 이미지로 변환되어 네이버/구글 검색엔진의 중복 이미지 패널티를 예방합니다.
              </p>
            </div>
          </div>

          {/* Sticky Tab / Action Bar */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-xs flex flex-wrap items-center justify-between gap-3 sticky top-4 z-20">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1.5 bg-slate-100/90 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setViewMode('match_workflow')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'match_workflow'
                    ? 'bg-white text-blue-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>위치별 후보 선택 ({selectedCount}/{slots.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (selectedCount === 0) {
                    onShowToast('⚠️ 먼저 이미지를 1개 이상 선택해 주세요.');
                    return;
                  }
                  if (!previewHtml) {
                    setPreviewHtml(buildFinalDraftHtml());
                  }
                  setViewMode('final_preview');
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'final_preview'
                    ? 'bg-white text-blue-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>최종 본문 미리보기</span>
                {isInserted && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                )}
              </button>
            </div>

            {/* Primary Action Button: 본문에 삽입 */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleInsertImagesIntoDraft}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-xs transition-all flex items-center gap-2 shadow-sm shadow-blue-500/20 active:scale-98 cursor-pointer"
              >
                <CheckCheck className="w-4 h-4" />
                <span>선택한 이미지 본문에 삽입 ({selectedCount}장)</span>
              </button>
            </div>
          </div>

          {/* VIEW 1: 위치별 이미지 매칭 카드 목록 */}
          {viewMode === 'match_workflow' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    <span>추천 이미지 삽입 위치 및 후보 선택</span>
                    <span className="text-xs font-bold text-slate-500">
                      (각 위치에서 가장 어울리는 사진 1장을 클릭하여 선택하세요)
                    </span>
                  </h4>
                </div>
              </div>

              <div className="space-y-6">
                {slots.map((slot, index) => {
                  const isSlotSearching = searchingSlotIds[slot.id] || false;
                  const hasSelection = Boolean(slot.selectedImage);

                  return (
                    <div
                      key={slot.id}
                      className={`bg-white border rounded-2xl p-5 sm:p-6 transition-all shadow-xs space-y-4 relative ${
                        hasSelection
                          ? 'border-blue-300 ring-1 ring-blue-100 bg-white'
                          : 'border-slate-200/90 hover:border-slate-300'
                      }`}
                    >
                      {/* Top Info Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2.5">
                          <span className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center font-extrabold text-xs shrink-0">
                            #{index + 1}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <h5 className="text-sm font-extrabold text-slate-900">
                                {slot.insertionPoint}
                              </h5>
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                                {slot.subject}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="flex items-center gap-2">
                          {hasSelection ? (
                            <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>선택 완료</span>
                            </span>
                          ) : (
                            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200/60">
                              사진 미선택
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Related Paragraph Quote & Visual Description Guide */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50/90 rounded-xl p-3.5 border border-slate-200/70 text-xs">
                        {/* Quote from text */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
                            <Quote className="w-3 h-3 text-blue-600" />
                            <span>연결된 본문 내용</span>
                          </div>
                          <p className="text-slate-800 leading-relaxed italic bg-white/80 p-2.5 rounded-lg border border-slate-200/60">
                            "{slot.relatedParagraph || '본문 해당 섹션'}"
                          </p>
                        </div>

                        {/* AI Recommendation Reason & Visual Scene */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
                            <Camera className="w-3 h-3 text-purple-600" />
                            <span>추천 장면 및 선정 이유</span>
                          </div>
                          <div className="bg-white/80 p-2.5 rounded-lg border border-slate-200/60 text-slate-700 space-y-1">
                            <p className="font-semibold text-slate-900">
                              📷 {slot.visualDescription || slot.subject}
                            </p>
                            {slot.reason && (
                              <p className="text-[11px] text-slate-500">
                                💡 {slot.reason}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Search Query Bar & Keyword Tags */}
                      <div className="space-y-2 pt-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5 text-xs">
                            <span className="text-[11px] font-bold text-slate-500">추천 검색 키워드:</span>
                            {slot.searchQueries.map((query, qIdx) => (
                              <button
                                key={qIdx}
                                type="button"
                                onClick={() => {
                                  setCustomQueryInputs((prev) => ({ ...prev, [slot.id]: query }));
                                  handleReSearchSlot(slot.id, query);
                                }}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                                  slot.selectedQuery === query
                                    ? 'bg-blue-600 text-white shadow-2xs'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                }`}
                              >
                                <span>{query}</span>
                              </button>
                            ))}
                          </div>

                          {/* Direct Keyword Search Input */}
                          <div className="flex items-center gap-1.5 w-full sm:w-auto">
                            <input
                              type="text"
                              value={customQueryInputs[slot.id] !== undefined ? customQueryInputs[slot.id] : slot.selectedQuery}
                              onChange={(e) =>
                                setCustomQueryInputs((prev) => ({ ...prev, [slot.id]: e.target.value }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleReSearchSlot(slot.id);
                              }}
                              placeholder="직접 영문 키워드 입력 (예: clear liquids bag airport)"
                              className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 bg-white"
                            />
                            <button
                              type="button"
                              onClick={() => handleReSearchSlot(slot.id)}
                              disabled={isSlotSearching}
                              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                            >
                              {isSlotSearching ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Search className="w-3.5 h-3.5" />
                              )}
                              <span>재검색</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Image Candidates Grid (2~3 Cards) */}
                      <div className="pt-2">
                        {isSlotSearching ? (
                          <div className="py-12 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-col items-center justify-center gap-2">
                            <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
                            <p className="text-xs text-slate-500 font-medium">
                              Unsplash에서 새로운 이미지 후보를 검색하는 중입니다...
                            </p>
                          </div>
                        ) : slot.candidates && slot.candidates.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                            {slot.candidates.map((cand) => {
                              const isSelected = slot.selectedImage?.id === cand.id;

                              return (
                                <div
                                  key={cand.id}
                                  onClick={() => handleSelectCandidate(slot.id, cand)}
                                  className={`group relative rounded-xl border overflow-hidden transition-all cursor-pointer flex flex-col justify-between ${
                                    isSelected
                                      ? 'border-blue-600 ring-2 ring-blue-500 shadow-md bg-blue-50/40'
                                      : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-white shadow-2xs'
                                  }`}
                                >
                                  {/* Image Thumbnail */}
                                  <div className="aspect-16/10 w-full overflow-hidden bg-slate-100 relative">
                                    <img
                                      src={cand.thumbUrl || cand.url}
                                      alt={cand.alt}
                                      referrerPolicy="no-referrer"
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                      loading="lazy"
                                    />

                                    {/* Selection Badge Overlay */}
                                    {isSelected && (
                                      <div className="absolute top-2 right-2 bg-blue-600 text-white rounded-full p-1 shadow-sm flex items-center gap-1 px-2 text-[11px] font-extrabold">
                                        <Check className="w-3 h-3 stroke-[3]" />
                                        <span>선택됨</span>
                                      </div>
                                    )}

                                    {/* Photographer info badge on image hover */}
                                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-2 pt-6 text-white text-[11px] opacity-90">
                                      <div className="flex items-center justify-between">
                                        <span className="truncate max-w-[140px]">{cand.photographer}</span>
                                        <a
                                          href={cand.unsplashUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                          className="text-white/80 hover:text-white flex items-center gap-0.5 text-[10px]"
                                        >
                                          <span>Unsplash</span>
                                          <ExternalLink className="w-2.5 h-2.5" />
                                        </a>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Card Bottom: Alt text & Action */}
                                  <div className="p-2.5 flex items-center justify-between gap-2">
                                    <p className="text-[11px] text-slate-700 font-medium truncate" title={cand.alt}>
                                      {cand.alt}
                                    </p>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (isSelected) {
                                          handleDeselectCandidate(slot.id);
                                        } else {
                                          handleSelectCandidate(slot.id, cand);
                                        }
                                      }}
                                      className={`text-[11px] font-extrabold px-2.5 py-1 rounded-lg transition-all shrink-0 cursor-pointer ${
                                        isSelected
                                          ? 'bg-blue-600 text-white'
                                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                                      }`}
                                    >
                                      {isSelected ? '선택됨' : '선택하기'}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          /* No result state */
                          <div className="py-8 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-center space-y-2">
                            <AlertCircle className="w-5 h-5 text-slate-400 mx-auto" />
                            <p className="text-xs font-bold text-slate-700">
                              '{slot.selectedQuery}'에 대한 적절한 이미지를 찾지 못했습니다.
                            </p>
                            <p className="text-[11px] text-slate-500">
                              랜덤 이미지를 대신 넣지 않습니다. 상단 검색창에 다른 구체적인 영문 검색어를 입력해 보세요.
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Selected Image Anti-Duplicate Transformation Status & Controls */}
                      {slot.selectedImage && (
                        <div className="mt-3 p-3.5 bg-gradient-to-r from-emerald-50/90 via-teal-50/70 to-blue-50/70 border border-emerald-200/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 font-extrabold text-emerald-800 bg-emerald-100/90 px-2.5 py-0.5 rounded-md text-[11px]">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                                {slot.isTransforming
                                  ? '무작위 자동 편집 & Supabase 저장 중...'
                                  : '중복 방지 AI 편집 완료 (Supabase Storage)'}
                              </span>
                              {slot.isTransforming && (
                                <RefreshCw className="w-3.5 h-3.5 text-emerald-700 animate-spin" />
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600">
                              <span>
                                ✂️ <strong>크롭:</strong>{' '}
                                {slot.selectedImage.modifications?.cropRatio || '90~95% 무작위'}
                              </span>
                              <span>
                                🔄 <strong>회전:</strong>{' '}
                                {slot.selectedImage.modifications?.rotationAngle || '1° 이내'}
                              </span>
                              <span>
                                ☀️ <strong>밝기:</strong>{' '}
                                {slot.selectedImage.modifications?.brightness || '±5~10%'}
                              </span>
                              <span>
                                🎨 <strong>채도:</strong>{' '}
                                {slot.selectedImage.modifications?.saturation || '±5~10%'}
                              </span>
                              <span>
                                ⚡ <strong>대비:</strong>{' '}
                                {slot.selectedImage.modifications?.contrast || '±5~10%'}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleReTransformCandidate(slot.id)}
                            disabled={slot.isTransforming}
                            className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-emerald-300 text-emerald-900 font-extrabold text-[11px] transition-all flex items-center gap-1.5 shrink-0 shadow-2xs cursor-pointer active:scale-98 disabled:opacity-50"
                            title="동일한 원본 이미지라도 매번 다른 무작위 크롭·회전·색상 조정을 적용하여 고유 이미지를 다시 생성합니다"
                          >
                            <Shuffle className="w-3 h-3 text-emerald-700" />
                            <span>다른 무작위 변형 적용 (재생성)</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Bottom Sticky Action Bar */}
              <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-extrabold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>이미지 선택 완료 ({selectedCount} / {slots.length}개)</span>
                  </h4>
                  <p className="text-xs text-slate-300 mt-0.5">
                    선택한 이미지들을 블로그 본문의 추천 문단 위치에 정밀하게 삽입합니다.
                  </p>
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleInsertImagesIntoDraft}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs transition-all flex items-center justify-center gap-2 shadow-md active:scale-98 cursor-pointer"
                  >
                    <CheckCheck className="w-4 h-4" />
                    <span>본문에 이미지 삽입 및 최종 확인</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 2: 최종 본문 미리보기 및 복사 */}
          {viewMode === 'final_preview' && (
            <div className="space-y-6">
              {/* Action Bar for Preview */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                    <CheckCheck className="w-4 h-4" />
                  </span>
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900">
                      이미지가 삽입된 최종 본문 미리보기
                    </h4>
                    <p className="text-xs text-slate-500">
                      총 {selectedCount}장의 이미지가 해당 문단 위치에 배치되었습니다.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setViewMode('match_workflow')}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>이미지 재선택 / 교체하기</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyHtmlCode}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    <span>HTML 코드 복사</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyRichText}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs transition-all flex items-center gap-2 shadow-xs active:scale-98 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>네이버 블로그 서식 복사</span>
                  </button>
                </div>
              </div>

              {/* Inserted Images Summary Strip */}
              {insertedImagesList.length > 0 && (
                <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4">
                  <h5 className="text-xs font-extrabold text-slate-900 mb-2.5 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-blue-600" />
                    <span>삽입된 이미지 정보 내역 ({insertedImagesList.length}건)</span>
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    {insertedImagesList.map((img, i) => (
                      <div
                        key={i}
                        className="bg-white p-2.5 rounded-xl border border-slate-200/80 flex items-center gap-2.5 text-xs shadow-2xs"
                      >
                        <img
                          src={img.thumbnailUrl}
                          alt={img.searchQuery}
                          referrerPolicy="no-referrer"
                          className="w-12 h-12 rounded-lg object-cover shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate">
                            #{i + 1} {img.insertionPoint}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">
                            작가: {img.photographer}
                          </p>
                          <a
                            href={img.unsplashUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5"
                          >
                            <span>Unsplash 출처</span>
                            <ExternalLink className="w-2 h-2" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Rendered HTML Post Paper */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-xs max-w-4xl mx-auto">
                <div
                  className="prose prose-slate max-w-none prose-headings:font-bold prose-headings:text-slate-900 prose-p:leading-relaxed prose-p:text-slate-700 prose-img:rounded-2xl"
                  dangerouslySetInnerHTML={{ __html: previewHtml || document.content }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
