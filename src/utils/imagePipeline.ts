import { validateAndParseCardNews } from './cardNewsUtils';
import { extractAndParseJson } from './jsonUtils';

export async function generateImagePlan(draftContent: string): Promise<any> {
  const res = await fetch('/api/gemini/toolkit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'image_plan', draftContent, isChallengeParticipant: true })
  });
  if (!res.ok) throw new Error('Failed to generate image plan');
  const data = await res.json();
  const rawRes = data.result || data;
  let result = typeof rawRes === 'string' ? extractAndParseJson(rawRes) : rawRes;
  return result as any;
}

export async function generateCardNewsPlan(
  draftContent: string,
  cardCount: number,
  usedImages: any[] = [],
  options?: {
    style?: string;
    imageMode?: string;
    aiGraphicStyle?: string;
    seoPlan?: any;
    userInput?: string;
  }
): Promise<any> {
  const res = await fetch('/api/gemini/toolkit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'card_news',
      draftContent,
      cardCount,
      usedImages,
      style: options?.style,
      imageMode: options?.imageMode,
      aiGraphicStyle: options?.aiGraphicStyle,
      seoPlan: options?.seoPlan,
      userInput: options?.userInput,
      isChallengeParticipant: true,
    }),
  });
  
  if (!res.ok) {
    let errorMsg = 'Failed to generate card news plan';
    try {
      const errJson = await res.json();
      if (errJson.message) errorMsg = errJson.message;
    } catch (_) {}
    throw new Error(errorMsg);
  }
  
  let data;
  try {
    data = await res.json();
  } catch (err: any) {
    console.error('[generateCardNewsPlan] JSON Parse Error:', err);
    throw new Error(`카드뉴스 API 응답을 JSON으로 파싱하는데 실패했습니다: ${err.message}`);
  }
  
  try {
    // validateAndParseCardNews를 통해 검증 및 정규화
    const parsedResult = validateAndParseCardNews(data.result, '블로그 카드뉴스');
    return parsedResult;
  } catch (error: any) {
    console.error('================================================');
    console.error('[generateCardNewsPlan] 카드뉴스 파싱 및 검증 실패!');
    console.error('실제 에러 내용:', error);
    console.error('Gemini가 반환한 원본 데이터(data.result):', data.result);
    console.error('================================================');
    throw new Error(`카드뉴스 검증 실패: ${error.message || '알 수 없는 에러'}`);
  }
}

// Banned generic/abstract keywords that must not be used alone for informational content
export const BANNED_GENERIC_KEYWORDS = new Set([
  'travel', 'vacation', 'beach', 'landscape', 'lifestyle', 'nature', 'scenery',
  'background', 'wallpaper', 'view', 'trip', 'summer', 'holiday', 'relax',
  'abstract', 'texture', 'scene', 'outdoor', 'indoor', 'cityscape', 'mountain view'
]);

// Stop words for query token extraction
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'in', 'on', 'at', 'for', 'with', 'and', 'of', 'to', 'by', 'is', 'are',
  'from', 'when', 'how', 'what', 'which', 'into', 'as', 'or', 'my', 'your', 'their', 'this',
  'that', 'these', 'those', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
  'best', 'top', 'new', 'good', 'great', 'about', 'recommendation', 'guide', 'review', 'tip', 'tips'
]);

// Korean subject mappings to concrete English search terms
const KOREAN_CONCRETE_TERM_MAP: Record<string, string[]> = {
  '기내 액체': ['airplane carry on liquids 100ml', '100ml liquid container travel', 'clear cosmetic bag airport security'],
  '기내 반입': ['carry on luggage bag airplane', 'airplane cabin baggage overhead bin'],
  '액체류': ['liquid containers travel 100ml', 'clear toiletries zipper bag', 'bottles cosmetics travel'],
  '지퍼백': ['clear transparent zipper bag cosmetics', 'transparent toiletries zip bag travel'],
  '보안검색': ['airport security screening tray luggage', 'airport baggage security check', 'airport x-ray scanner tray'],
  '수화물': ['luggage suitcase packing travel', 'airplane baggage luggage airport'],
  '수하물': ['luggage suitcase packing travel', 'airplane baggage luggage airport'],
  '위탁수하물': ['luggage suitcase conveyor airport', 'checked luggage packing baggage', 'travel suitcase luggage'],
  '위탁수화물': ['luggage suitcase conveyor airport', 'checked luggage packing baggage', 'travel suitcase luggage'],
  '주류': ['wine bottle liquor duty free', 'alcohol bottle packaging luggage', 'packaged liquor bottles'],
  '와인': ['wine bottle protective packing travel', 'wine bottle packaging luggage', 'wine bottles in box'],
  '위스키': ['whiskey bottle packaging box', 'whiskey liquor duty free bottle'],
  '면세점': ['airport duty free shop liquor', 'duty free shopping store airport', 'duty free cosmetics shop'],
  '여권': ['passport boarding pass airport travel', 'passport holder flight ticket'],
  '탑승권': ['airline boarding pass ticket airport', 'flight boarding pass gate'],
  '보조배터리': ['power bank portable battery charger', 'portable battery pack smartphone'],
  '배터리': ['lithium battery power bank', 'portable charger battery phone'],
  '화장품': ['cosmetic serum bottle skincare', 'skincare cosmetic bottles cream', 'travel cosmetics container'],
  '에어랩': ['hair styler device curling iron', 'hair styling dryer tool'],
  '다이슨': ['hair styling tool dryer styler', 'cordless vacuum cleaner home'],
  '청소기': ['cordless vacuum cleaner cleaning floor', 'robot vacuum cleaner living room'],
  '이어폰': ['wireless earbuds in ear headphones', 'noise cancelling earphones audio'],
  '헤드폰': ['over ear wireless headphones audio', 'noise cancelling headphones'],
  '스마트폰': ['smartphone touchscreen mobile phone', 'holding smartphone screen hand'],
  '태블릿': ['tablet computer digital screen pen', 'tablet screen display desk'],
  '노트북': ['laptop computer keyboard screen workspace', 'ultrabook laptop typing'],
  '호텔': ['hotel guest room bed luxury', 'cozy hotel bedroom interior'],
  '숙소': ['hotel room interior cozy bed', 'resort room accommodation'],
  '조식': ['hotel breakfast buffet food plate', 'breakfast buffet dining morning'],
  '카페': ['cafe espresso coffee cup table', 'specialty coffee latte art cafe'],
  '아메리카노': ['iced americano coffee glass table', 'hot americano black coffee cup'],
  '라떼': ['cafe latte art cup saucer', 'latte art coffee cafe'],
  '디저트': ['cafe dessert cake slice plate', 'bakery pastry dessert plate'],
  '베이커리': ['fresh bakery bread croissants pastry', 'artisan bakery pastry display'],
  '맛집': ['delicious restaurant dish food table', 'gourmet meal plate restaurant'],
  '식당': ['dining restaurant table food meal', 'restaurant meal dish platter'],
  '고기': ['grilled beef steak barbecue plate', 'korean bbq grill meat table'],
  '삼겹살': ['korean pork belly bbq grill', 'grilled pork meat barbecue'],
  '스테이크': ['grilled beef steak dining plate', 'cooked ribeye steak dinner'],
  '파스타': ['italian pasta dish plate fork', 'creamy pasta spaghetti plate'],
  '피자': ['fresh baked pizza cheese slice', 'artisan pizza oven wooden board'],
  '영양제': ['dietary supplements vitamin capsules bottle', 'health supplement pills bottle'],
  '비타민': ['vitamin supplement pills capsules bottle', 'citrus vitamin fruit supplements'],
  '환전': ['currency exchange money cash bills', 'foreign currency banknotes travel'],
  '유심': ['sim card smartphone tray slot', 'esim travel mobile data phone'],
  '포켓와이파이': ['pocket wifi portable router device', 'mobile wifi router travel'],
};

// Generic noise terms that should be strictly penalized when searching for a specific subject
const GENERIC_NOISE_TERMS = [
  'desk and laptop only', 'blank white page', 'empty wooden table',
  'mountain peak snow', 'desert sand dunes', 'ocean beach sunset',
  'green grass landscape', 'foggy forest trees', 'abstract clouds sky only',
  'wild lion animal', 'abstract geometric 3d render'
];

export interface UnsplashPhotoEvaluation {
  score: number;
  isRelevant: boolean;
  matchedTerms: string[];
}

/**
 * Evaluates whether an Unsplash photo is genuinely relevant to the query and subject.
 */
export function evaluateUnsplashPhotoRelevance(
  photo: any,
  query: string,
  subject?: string,
  visualDescription?: string
): UnsplashPhotoEvaluation {
  if (!photo) {
    return { score: 0, isRelevant: false, matchedTerms: [] };
  }

  const alt = (photo.alt_description || '').toLowerCase();
  const desc = (photo.description || '').toLowerCase();
  const tags = Array.isArray(photo.tags)
    ? photo.tags.map((t: any) => (typeof t === 'string' ? t : t.title || '')).join(' ').toLowerCase()
    : '';
  const slug = (photo.slug || '').toLowerCase();
  const fullMetaText = `${alt} ${desc} ${tags} ${slug}`.toLowerCase();

  // 1. Extract clean query tokens (excluding stop words)
  const cleanQuery = (query || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
  const queryWords = cleanQuery.split(/\s+/).filter(w => w.length >= 2 && !STOP_WORDS.has(w));
  
  if (queryWords.length === 0) {
    return { score: 1, isRelevant: true, matchedTerms: [] };
  }

  let score = 0;
  const matchedTerms: string[] = [];

  // 2. Full phrase match bonus
  if (cleanQuery.length > 4 && fullMetaText.includes(cleanQuery)) {
    score += 20;
    matchedTerms.push(cleanQuery);
  }

  // 3. Significant token matches
  for (const word of queryWords) {
    let wordMatched = false;

    // Direct tag match (high signal)
    if (tags.includes(word)) {
      score += 7;
      wordMatched = true;
    }
    // Alt description match (high signal)
    if (alt.includes(word)) {
      score += 6;
      wordMatched = true;
    }
    // Description or slug match
    if (desc.includes(word) || slug.includes(word)) {
      score += 4;
      wordMatched = true;
    }

    // Stem matching (e.g. liquid vs liquids, bottle vs bottles, flight vs flying, shop vs shopping)
    if (!wordMatched && word.length >= 4) {
      const stem = word.slice(0, -1);
      if (fullMetaText.includes(stem)) {
        score += 3;
        wordMatched = true;
      }
    }

    if (wordMatched) {
      matchedTerms.push(word);
    }
  }

  // 4. Subject / Visual description cross-check
  if (subject) {
    const cleanSub = subject.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
    const subWords = cleanSub.split(/\s+/).filter(w => w.length >= 2 && !STOP_WORDS.has(w));
    for (const sw of subWords) {
      if (fullMetaText.includes(sw)) {
        score += 3;
        matchedTerms.push(sw);
      }
    }
  }

  if (visualDescription) {
    const cleanVis = visualDescription.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
    const visWords = cleanVis.split(/\s+/).filter(w => w.length >= 3 && !STOP_WORDS.has(w));
    for (const vw of visWords) {
      if (fullMetaText.includes(vw)) {
        score += 2;
        matchedTerms.push(vw);
      }
    }
  }

  // 5. Negative noise penalty: Check for irrelevant scenery/desk when query wanted specific items
  const isQuerySpecific = queryWords.some(w => 
    ['bottle', 'liquid', 'bag', 'luggage', 'suitcase', 'cosmetics', 'food', 'coffee', 'meal', 'phone', 'device', 'passport', 'ticket', 'security', 'tray', 'pack'].includes(w)
  );

  if (isQuerySpecific) {
    for (const noise of GENERIC_NOISE_TERMS) {
      if (fullMetaText.includes(noise)) {
        score -= 15;
      }
    }

    // If query was looking for luggage/liquid/bottles but photo meta is just pure beach/mountain/desk
    const hasSpecificMatch = matchedTerms.some(t => 
      ['bottle', 'liquid', 'bag', 'luggage', 'suitcase', 'cosmetic', 'serum', 'wine', 'airport', 'security', 'tray', 'passport', 'coffee', 'food', 'device', 'pack'].some(k => t.includes(k))
    );

    if (!hasSpecificMatch && (fullMetaText.includes('beach') || fullMetaText.includes('mountain') || fullMetaText.includes('landscape') || fullMetaText.includes('laptop on desk'))) {
      score -= 20;
    }
  }

  // Strict relevance threshold:
  // Must have matched at least one core term and scored at least 4 points
  const isRelevant = score >= 4 && matchedTerms.length > 0;

  return {
    score,
    isRelevant,
    matchedTerms: Array.from(new Set(matchedTerms))
  };
}

/**
 * Strictly verifies whether an image URL is from Unsplash (images.unsplash.com or plus.unsplash.com)
 */
export function isValidUnsplashUrl(url: any): boolean {
  if (typeof url !== 'string' || !url.trim()) return false;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    // Strict domain whitelist: only official Unsplash image domains
    return (
      host === 'images.unsplash.com' ||
      host === 'plus.unsplash.com' ||
      host.endsWith('.unsplash.com')
    );
  } catch {
    return false;
  }
}

/**
 * Strictly verifies whether a photo object is a valid Unsplash photo object
 */
export function isValidUnsplashPhoto(photo: any): boolean {
  if (!photo || typeof photo !== 'object' || !photo.id) return false;
  if (!photo.urls || typeof photo.urls !== 'object') return false;
  const regularUrl = photo.urls.regular || photo.urls.full || photo.urls.small || photo.urls.thumb;
  return isValidUnsplashUrl(regularUrl);
}

/**
 * Sanitizes and normalizes an Unsplash photo item
 */
export function sanitizeUnsplashPhoto(photo: any, fallbackQuery: string = ''): any | null {
  if (!isValidUnsplashPhoto(photo)) return null;

  const regularUrl = isValidUnsplashUrl(photo.urls?.regular)
    ? photo.urls.regular
    : photo.urls?.full || photo.urls?.small;
  const smallUrl = isValidUnsplashUrl(photo.urls?.small) ? photo.urls.small : regularUrl;
  const thumbUrl = isValidUnsplashUrl(photo.urls?.thumb) ? photo.urls.thumb : smallUrl;
  const unsplashUrl =
    photo.links?.html && photo.links.html.includes('unsplash.com')
      ? photo.links.html
      : `https://unsplash.com/photos/${photo.id}`;
  const photographerUrl =
    photo.user?.links?.html && photo.user.links.html.includes('unsplash.com')
      ? photo.user.links.html
      : `https://unsplash.com/@${photo.user?.username || ''}`;

  return {
    id: photo.id,
    created_at: photo.created_at,
    width: photo.width,
    height: photo.height,
    color: photo.color,
    alt: photo.alt_description || photo.description || fallbackQuery,
    alt_description: photo.alt_description || photo.description || fallbackQuery,
    description: photo.description || photo.alt_description || fallbackQuery,
    urls: {
      raw: isValidUnsplashUrl(photo.urls?.raw) ? photo.urls.raw : regularUrl,
      full: isValidUnsplashUrl(photo.urls?.full) ? photo.urls.full : regularUrl,
      regular: regularUrl,
      small: smallUrl,
      thumb: thumbUrl,
    },
    url: regularUrl,
    thumbUrl: thumbUrl,
    links: {
      html: unsplashUrl,
      download: regularUrl,
      download_location: photo.links?.download_location,
    },
    unsplashUrl: unsplashUrl,
    photographer: photo.user?.name || 'Unsplash Photographer',
    photographerUrl: photographerUrl,
    user: {
      id: photo.user?.id || 'unsplash_user',
      username: photo.user?.username || 'photographer',
      name: photo.user?.name || 'Unsplash Photographer',
      portfolio_url: photographerUrl,
      links: {
        html: photographerUrl,
        photos: photographerUrl,
      },
    },
    source: 'unsplash' as const,
    tags: Array.isArray(photo.tags) ? photo.tags : [],
  };
}

/**
 * Fetches Unsplash photos through server proxy or direct client fallback (Strictly Unsplash only)
 */
export async function searchUnsplashPhotos(
  query: string,
  perPage: number = 10,
  orientation: string = 'landscape'
): Promise<any[]> {
  const cleanQ = query.trim();
  if (!cleanQ) return [];

  // 1. Try Server-side proxy first (strictly official Unsplash API)
  try {
    const proxyRes = await fetch(
      `/api/unsplash/search?query=${encodeURIComponent(cleanQ)}&per_page=${perPage}&orientation=${encodeURIComponent(orientation)}`
    );
    if (proxyRes.ok) {
      const data = await proxyRes.json();
      if (Array.isArray(data.results) && data.results.length > 0) {
        return data.results
          .filter((p: any) => isValidUnsplashPhoto(p))
          .map((p: any) => sanitizeUnsplashPhoto(p, cleanQ))
          .filter(Boolean);
      }
    }
  } catch (proxyErr) {
    console.warn('[Unsplash Search] Server proxy failed, trying client direct:', proxyErr);
  }

  // 2. Client-side direct Unsplash API if VITE key exists
  const clientKey = (import.meta as any).env?.VITE_UNSPLASH_ACCESS_KEY || '';
  if (clientKey) {
    try {
      const directRes = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(cleanQ)}&per_page=${perPage}&orientation=${encodeURIComponent(orientation)}&client_id=${clientKey}`
      );
      if (directRes.ok) {
        const directData = await directRes.json();
        if (Array.isArray(directData.results)) {
          return directData.results
            .filter((p: any) => isValidUnsplashPhoto(p))
            .map((p: any) => sanitizeUnsplashPhoto(p, cleanQ))
            .filter(Boolean);
        }
      }
    } catch (clientErr) {
      console.warn('[Unsplash Search] Client direct fetch failed:', clientErr);
    }
  }

  return [];
}

/**
 * Builds high-quality concrete search query candidates from plan subject, body, and keywords.
 * Prioritization order:
 * 1st Priority: Concrete object/item/action (subject, visualDescription, action)
 * 2nd Priority: Core content points & information (contentPoints, body)
 * 3rd Priority: Card / section title (title, headline)
 * 4th Priority: Main keyword / topic
 */
export function buildCandidateQueries(plan: any): string[] {
  const candidates: string[] = [];
  const seen = new Set<string>();

  const addCandidate = (q: string) => {
    if (!q) return;
    const clean = q.trim();
    const lower = clean.toLowerCase();
    
    // Check if query is only a banned generic word (e.g. "travel", "vacation")
    if (BANNED_GENERIC_KEYWORDS.has(lower)) return;
    if (clean.length < 2) return;

    if (!seen.has(lower)) {
      candidates.push(clean);
      seen.add(lower);
    }
  };

  const rawSubject = plan.subject || plan.subjectDetail || '';
  const rawDesc = plan.visualDescription || plan.action || '';
  const rawBody = plan.body || (Array.isArray(plan.contentPoints) ? plan.contentPoints.join(' ') : '');
  const rawTitle = plan.title || plan.headline || '';
  const rawKeyword = plan.keyword || plan.mainTopic || '';
  const rawQueries = Array.isArray(plan.searchQueries) ? plan.searchQueries : [];

  // Priority 1: Korean Concrete Dictionary mapping on subject & visual description
  const p1Text = `${rawSubject} ${rawDesc}`;
  for (const [koreanKey, mappedTerms] of Object.entries(KOREAN_CONCRETE_TERM_MAP)) {
    if (p1Text.includes(koreanKey)) {
      for (const term of mappedTerms) {
        addCandidate(term);
      }
    }
  }

  // Priority 1-B: AI-provided concrete searchQueries
  for (const q of rawQueries) {
    if (typeof q === 'string') {
      const stripped = q.replace(/[^a-zA-Z0-9\s]/g, ' ').trim();
      addCandidate(stripped);
      
      // Extract 2-3 word specific sub-queries
      const words = stripped.split(/\s+/).filter(w => !STOP_WORDS.has(w.toLowerCase()));
      if (words.length >= 3) {
        addCandidate(words.slice(0, 3).join(' '));
        addCandidate(words.slice(1, 4).join(' '));
      }
    }
  }

  // Priority 2: Korean Concrete Dictionary mapping on body / content points
  const p2Text = `${rawBody}`;
  for (const [koreanKey, mappedTerms] of Object.entries(KOREAN_CONCRETE_TERM_MAP)) {
    if (p2Text.includes(koreanKey)) {
      for (const term of mappedTerms) {
        addCandidate(term);
      }
    }
  }

  // Priority 3: Title English extraction
  const englishInSubject = rawSubject.replace(/[^a-zA-Z\s]/g, ' ').trim();
  if (englishInSubject.length >= 3 && !BANNED_GENERIC_KEYWORDS.has(englishInSubject.toLowerCase())) {
    addCandidate(englishInSubject);
  }

  const englishInTitle = rawTitle.replace(/[^a-zA-Z\s]/g, ' ').trim();
  if (englishInTitle.length >= 3 && !BANNED_GENERIC_KEYWORDS.has(englishInTitle.toLowerCase())) {
    addCandidate(englishInTitle);
  }

  // Priority 4: Main keyword mapping
  if (rawKeyword) {
    for (const [koreanKey, mappedTerms] of Object.entries(KOREAN_CONCRETE_TERM_MAP)) {
      if (rawKeyword.includes(koreanKey)) {
        for (const term of mappedTerms) {
          addCandidate(term);
        }
      }
    }
  }

  return candidates;
}

/**
 * Resolves high-relevance Unsplash images for image plans or card news cards.
 * Ensures:
 * 1. Concrete search queries with banned abstract terms filtered out
 * 2. Strict relevance scoring against real photo metadata
 * 3. Actual photo description reflected in alt/subject
 * 4. Zero duplicate images across the entire batch
 * 5. No forced generic fallback images if no relevant image is found
 */
/**
 * Automatically transforms an Unsplash image with sharp (crop 90-95%, brightness/saturation/contrast ±5-10%, micro-rotation <= 1 deg)
 * and uploads to Supabase Storage, returning the unique public URL.
 */
export async function transformAndStoreUnsplashImage(
  url: string,
  options?: { alt?: string; subject?: string; userId?: string; draftId?: string }
): Promise<{
  transformedUrl: string;
  originalUrl: string;
  modifications?: any;
  storageProvider?: string;
}> {
  const clean = (url || '').trim();
  if (!clean) return { transformedUrl: '', originalUrl: '' };

  try {
    const res = await fetch('/api/unsplash/transform-and-store', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: clean,
        alt: options?.alt,
        subject: options?.subject,
        userId: options?.userId,
        draftId: options?.draftId,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.transformedUrl) {
        return {
          transformedUrl: data.transformedUrl,
          originalUrl: data.originalUrl || clean,
          modifications: data.modifications,
          storageProvider: data.storageProvider,
        };
      }
    }
  } catch (err) {
    console.warn('[transformAndStoreUnsplashImage] Error calling transform API:', err);
  }
  return { transformedUrl: clean, originalUrl: clean };
}

/**
 * Batch transforms multiple Unsplash images via server sharp pipeline and saves to Supabase Storage.
 */
export async function transformAndStoreUnsplashBatch(
  items: Array<{ id?: string; url: string; alt?: string; subject?: string }>,
  options?: { userId?: string; draftId?: string }
): Promise<
  Array<{
    id?: string;
    transformedUrl: string;
    originalUrl: string;
    modifications?: any;
    storageProvider?: string;
  }>
> {
  if (!items || items.length === 0) return [];
  try {
    const res = await fetch('/api/unsplash/transform-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items,
        userId: options?.userId,
        draftId: options?.draftId,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.results)) {
        return data.results;
      }
    }
  } catch (err) {
    console.warn('[transformAndStoreUnsplashBatch] Batch transform API error:', err);
  }
  return items.map((i) => ({ id: i.id, transformedUrl: i.url, originalUrl: i.url }));
}

export async function resolveImagesForPlan(
  imagePlans: any[],
  imageMode: string = 'auto_source',
  aiStyle: string = 'photoreal',
  sharedUsedIds?: Set<string>,
  sharedUsedUrls?: Set<string>
): Promise<any[]> {
  const resolvedImages: any[] = [];
  const usedPhotoUrls = sharedUsedUrls || new Set<string>();
  const usedPhotoIds = sharedUsedIds || new Set<string>();
  
  for (let idx = 0; idx < imagePlans.length; idx++) {
    const plan = imagePlans[idx];
    if (imageMode === 'user_photo') continue;

    const rawSubject = plan.subject || plan.title || plan.headline || '';
    const candidateQueries = buildCandidateQueries(plan);

    let selectedImage: any = null;

    // Try candidate queries in priority order
    for (const query of candidateQueries) {
      try {
        const results = await searchUnsplashPhotos(query, 12, 'landscape');
        
        if (results && results.length > 0) {
          // Evaluate relevance of each photo
          const scoredCandidates = results
            .map((p: any) => {
              const evalResult = evaluateUnsplashPhotoRelevance(
                p,
                query,
                rawSubject,
                plan.visualDescription
              );
              const photoUrl = p.urls?.regular || p.urls?.small;
              const isDuplicate = usedPhotoIds.has(p.id) || (photoUrl && usedPhotoUrls.has(photoUrl));
              
              return {
                photo: p,
                score: evalResult.score,
                isRelevant: evalResult.isRelevant,
                matchedTerms: evalResult.matchedTerms,
                isDuplicate
              };
            })
            .filter((item: any) => !item.isDuplicate);

          // Sort by relevance score descending
          scoredCandidates.sort((a: any, b: any) => b.score - a.score);

          // Find the best relevant candidate
          const bestCandidate = scoredCandidates.find((c: any) => c.isRelevant && c.score >= 4);

          if (bestCandidate) {
            const p = bestCandidate.photo;
            const photoUrl = p.urls?.regular || p.urls?.small;
            
            // Mark as used
            usedPhotoIds.add(p.id);
            if (photoUrl) usedPhotoUrls.add(photoUrl);

            // Generate clean alt and subject based on the ACTUAL chosen photo!
            const realPhotoDesc = p.alt_description || p.description || '';
            const actualAlt = realPhotoDesc ? `${realPhotoDesc}` : (rawSubject || query);
            const actualSubject = rawSubject || realPhotoDesc || query;

            selectedImage = {
              planId: plan.id || plan.cardNumber || `img_${idx + 1}`,
              source: 'unsplash',
              url: photoUrl,
              originalUrl: photoUrl,
              alt: actualAlt,
              subject: actualSubject,
              visualDescription: realPhotoDesc || plan.visualDescription || '',
              credit: p.user?.name ? `${p.user.name} (Unsplash)` : 'Unsplash',
              searchQuery: query,
              relevanceScore: bestCandidate.score,
              matchedTerms: bestCandidate.matchedTerms,
            };
            break; // Found high-relevance image, stop trying other queries
          } else {
            console.log(`[Unsplash Matcher] Query "${query}" returned ${results.length} photos but none passed strict relevance. Trying next query...`);
          }
        }
      } catch (queryErr) {
        console.warn(`[Unsplash Matcher] Failed search for query "${query}":`, queryErr);
      }
    }

    // Strict Rule: If no relevant image found, DO NOT force insert generic unrelated beach/desk photos!
    if (selectedImage) {
      resolvedImages.push({ plan, image: selectedImage });
    } else {
      console.log(`[Unsplash Matcher] No strictly relevant image found for subject "${rawSubject}". Skipping image insertion for this item.`);
    }
  }

  // ----------------------------------------------------
  // Automatic Anti-Duplicate Transformation (Sharp) & Supabase Storage Save
  // ----------------------------------------------------
  if (resolvedImages.length > 0) {
    const unsplashItems = resolvedImages
      .filter((r) => r.image && r.image.source === 'unsplash' && r.image.url)
      .map((r) => ({
        id: r.image.planId,
        url: r.image.url,
        alt: r.image.alt,
        subject: r.image.subject,
      }));

    if (unsplashItems.length > 0) {
      try {
        const transformedBatch = await transformAndStoreUnsplashBatch(unsplashItems);
        const transformMap = new Map<string, any>();
        transformedBatch.forEach((tr) => {
          if (tr.id) transformMap.set(tr.id, tr);
        });

        resolvedImages.forEach((r) => {
          if (r.image && r.image.planId && transformMap.has(r.image.planId)) {
            const tr = transformMap.get(r.image.planId);
            if (tr && tr.transformedUrl) {
              r.image.originalUrl = r.image.url;
              r.image.url = tr.transformedUrl;
              r.image.modifications = tr.modifications;
              r.image.storageProvider = tr.storageProvider;
              r.image.isAntiDuplicateTransformed = true;
            }
          }
        });
      } catch (transformErr) {
        console.warn('[resolveImagesForPlan] Batch transform error:', transformErr);
      }
    }
  }
  
  return resolvedImages;
}

/**
 * Strips all internal AI photo recommendation / guide markup and artifacts from the draft HTML.
 */
export function stripInternalImageGuides(html: string): string {
  if (!html) return '';

  let cleaned = html;

  // 1. Remove photo recommendation div blocks
  cleaned = cleaned.replace(/<div[^>]*class="[^"]*(?:photo-recommendation|image-guide|photo-rec|image-plan|unsplash-query)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');

  // 2. Remove AI internal photo guide paragraph lines and text blocks
  cleaned = cleaned.replace(/<p[^>]*>\s*(?:📸|📷|🖼️)?\s*\[(?:사진\s*추천|이미지\s*추천|사진\s*가이드|사진\s*설명|이미지\s*배치|추천\s*사진|사진\s*위치|내\s*사진\s*삽입\s*위치|Unsplash\s*검색어|imagePrompt|이미지\s*삽입\s*위치|카드뉴스\s*제작\s*지시)[^\]\n]*\][:\s]*[^<]*<\/p>/gi, '');
  cleaned = cleaned.replace(/(?:📸|📷|🖼️)?\s*\[(?:사진\s*추천|이미지\s*추천|사진\s*가이드|사진\s*설명|이미지\s*배치|추천\s*사진|사진\s*위치|내\s*사진\s*삽입\s*위치|Unsplash\s*검색어|imagePrompt|이미지\s*삽입\s*위치|카드뉴스\s*제작\s*지시)[^\]\n]*\][:\s]*[^\n<]+/gi, '');
  cleaned = cleaned.replace(/(?:📸|📷|🖼️)\s*(?:사진\s*추천|이미지\s*추천|Unsplash\s*검색어|imagePrompt|이미지\s*삽입\s*위치)[:\s]*[^\n<]+/gi, '');

  // 3. Remove ALL HTML comments (<!-- ... -->) and unclosed/stray comment tags
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');
  cleaned = cleaned.replace(/<!--[\s\S]*?(?=<[a-zA-Z\/]|-->|$)/g, '');
  cleaned = cleaned.replace(/<!--/g, '');
  cleaned = cleaned.replace(/-->/g, '');
  cleaned = cleaned.replace(/\[사진\s*\d*:\s*[^\]]+\]/gi, '');
  cleaned = cleaned.replace(/\[이미지\s*\d*:\s*[^\]]+\]/gi, '');

  // 4. Remove empty paragraph tags
  cleaned = cleaned.replace(/<p>\s*<\/p>/gi, '').trim();

  return cleaned;
}

/**
 * Injects resolved images into draft HTML with clean styling, ensuring no internal artifacts remain.
 */
export function injectResolvedImagesIntoDraft(draftHtml: string, resolvedImages: any[]): string {
  if (!draftHtml) return '';
  
  if (!resolvedImages || resolvedImages.length === 0) {
    return stripInternalImageGuides(draftHtml);
  }

  const validImages = resolvedImages.filter(r => r && r.image && r.image.url);
  if (validImages.length === 0) {
    return stripInternalImageGuides(draftHtml);
  }

  const buildImageBlock = (image: any) => {
    const altText = (image.alt || image.subject || '').replace(/"/g, '&quot;');
    const captionText = image.alt || image.subject || '';
    return `\n<div class="my-6 text-center border border-slate-200/90 rounded-2xl overflow-hidden bg-slate-50/80 p-3 shadow-xs">
  <img src="${image.url}" alt="${altText}" class="w-full max-h-[500px] object-cover rounded-xl my-1 mx-auto block" loading="lazy" />
  <p class="text-xs text-slate-500 font-medium mt-2 flex items-center justify-center gap-1.5">
    <span>📷</span> <span>${captionText}</span>
  </p>
</div>\n`;
  };

  let workingHtml = draftHtml;
  let imgIndex = 0;

  // 1. Check if draft has explicit photo guide blocks/paragraphs and replace them directly
  const guidePatterns = [
    /<div[^>]*class="[^"]*(?:photo-recommendation|image-guide|photo-rec)[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
    /<p[^>]*>\s*(?:📸|📷)?\s*\[(?:사진\s*추천|이미지\s*추천|사진\s*가이드|사진\s*설명|이미지\s*배치|추천\s*사진|사진\s*위치|내\s*사진\s*삽입\s*위치)[^\]\n]*\][:\s]*[^<]*<\/p>/gi,
    /(?:📸|📷)?\s*\[(?:사진\s*추천|이미지\s*추천|사진\s*가이드|사진\s*설명|이미지\s*배치|추천\s*사진|사진\s*위치|내\s*사진\s*삽입\s*위치)[^\]\n]*\][:\s]*[^\n<]+/gi,
  ];

  for (const pat of guidePatterns) {
    workingHtml = workingHtml.replace(pat, () => {
      if (imgIndex < validImages.length) {
        const imgBlock = buildImageBlock(validImages[imgIndex].image);
        imgIndex++;
        return imgBlock;
      }
      return ''; // Strip slot if no more resolved images
    });
  }

  // 2. Clean up any remaining guides
  workingHtml = stripInternalImageGuides(workingHtml);

  // 3. If there are still resolved images not yet placed, distribute them among paragraphs
  if (imgIndex < validImages.length) {
    const remainingImages = validImages.slice(imgIndex);
    const pParts = workingHtml.split(/(<\/p>)/i);
    let newHtml = '';
    let remIdx = 0;
    const interval = Math.max(1, Math.floor((pParts.length / 2) / (remainingImages.length + 1)));

    for (let i = 0; i < pParts.length; i++) {
      newHtml += pParts[i];
      if (pParts[i].toLowerCase() === '</p>') {
        const pCount = Math.floor(i / 2);
        if (pCount > 0 && pCount % interval === 0 && remIdx < remainingImages.length) {
          newHtml += buildImageBlock(remainingImages[remIdx].image);
          remIdx++;
        }
      }
    }

    // Append any final remaining images
    while (remIdx < remainingImages.length) {
      newHtml += buildImageBlock(remainingImages[remIdx].image);
      remIdx++;
    }

    workingHtml = newHtml;
  }

  return workingHtml.trim();
}

/**
 * End-to-end processing of blog images and card news with global deduplication and strict relevance.
 */
export async function processBlogImagesAndCardNews(
  draftContent: string,
  imageMode: string, // 'user_photo' or 'auto_source'
  createCardNews: boolean,
  currentKw: string,
  maxImageCount: number,
  aiGraphicStyle: string,
  selectedStyleKey: string,
  seoPlan?: any,
  userInput?: string
): Promise<{ generatedDraft: string, cleanDraft: string, imageResultData?: any, cardNewsResultData?: any }> {
  
  // Clean initial draft
  let cleanDraft = stripInternalImageGuides(draftContent);
  let generatedDraft = cleanDraft;
  let imageResultData = undefined;
  let cardNewsResultData = undefined;
  let resolvedImages: any[] = [];
  let imagePlans: any[] = [];

  // Global deduplication sets shared across blog and card news
  const globalUsedPhotoIds = new Set<string>();
  const globalUsedPhotoUrls = new Set<string>();

  // 1. Image Plan & Insertion (For Blog Content)
  try {
    const planResult = await generateImagePlan(cleanDraft);
    imagePlans = planResult.imagePlans || [];
  } catch (e) {
    console.warn("[processBlogImagesAndCardNews] Failed Image Plan Pipeline:", e);
  }

  if (imageMode !== 'user_photo') {
    if (imagePlans.length > 0) {
      resolvedImages = await resolveImagesForPlan(
        imagePlans,
        imageMode,
        aiGraphicStyle,
        globalUsedPhotoIds,
        globalUsedPhotoUrls
      );
    }
    imageResultData = { photos: resolvedImages };
  }

  if (imageMode === 'user_photo' && imagePlans.length > 0) {
    // Show placeholders for user_photo
    const placeholders = imagePlans.map(p => ({
      plan: p,
      image: {
        url: 'https://placehold.co/800x400/f8fafc/94a3b8?text=' + encodeURIComponent('📷 내 사진 삽입 위치: ' + (p.subject || '사진')),
        alt: p.visualDescription || p.subject || ''
      }
    }));
    generatedDraft = injectResolvedImagesIntoDraft(cleanDraft, placeholders);
  } else if (resolvedImages.length > 0) {
    // Inject successfully resolved relevant images into blog draft
    generatedDraft = injectResolvedImagesIntoDraft(cleanDraft, resolvedImages);
  } else {
    // Keep draft clean without forced irrelevant images
    generatedDraft = cleanDraft;
  }

  // 2. Card News Plan & Generation
  if (createCardNews) {
    try {
      let finalCardCount = maxImageCount > 0 ? maxImageCount : 5;
      if (maxImageCount <= 0) {
        const len = cleanDraft.length;
        if (len > 2500) finalCardCount = 6;
        else if (len > 1500) finalCardCount = 5;
        else finalCardCount = 4;
      }

      const cardPlanResult = await generateCardNewsPlan(cleanDraft, finalCardCount, [], {
        style: selectedStyleKey,
        imageMode,
        aiGraphicStyle,
        seoPlan,
        userInput,
      });
      
      const cardsToResolve = (cardPlanResult.cards || []).map((c: any) => {
        return {
          id: c.cardNumber,
          subject: c.subject || c.title || c.headline,
          searchQueries: c.searchQueries || [],
          visualDescription: c.body || c.subtitle || '',
          preferredSource: c.preferredSource || 'unsplash'
        };
      });
      
      let resolvedCardImages: any[] = [];
      if (imageMode !== 'user_photo' && cardsToResolve.length > 0) {
        // Pass global deduplication sets so card news NEVER duplicates blog images or other cards
        resolvedCardImages = await resolveImagesForPlan(
          cardsToResolve,
          imageMode,
          aiGraphicStyle,
          globalUsedPhotoIds,
          globalUsedPhotoUrls
        );
      }

      const enrichedCards = (cardPlanResult.cards || []).map((c: any) => {
        let imageUrl = c.imageUrl || '';
        let matchedPhotoAlt = '';
        
        const matchedImg = resolvedCardImages.find(r => r.plan.id === c.cardNumber);
        if (matchedImg && matchedImg.image?.url) {
          imageUrl = matchedImg.image.url;
          matchedPhotoAlt = matchedImg.image.alt || '';
        }
        
        return {
          cardNumber: c.cardNumber,
          title: c.title || c.headline || `${c.cardNumber}. 핵심 요약`,
          subtitle: c.subtitle || c.subheadline || '',
          body: c.body || '',
          layout: c.layout || 'content',
          style: aiGraphicStyle,
          imageUrl: imageUrl,
          searchQueries: c.searchQueries || [],
          imagePrompt: c.imagePrompt || '',
          subject: c.subject || c.title || (matchedPhotoAlt ? matchedPhotoAlt : ''),
          reason: c.reason || '',
          preferredSource: c.preferredSource || 'unsplash',
          contentPoints: c.contentPoints || (c.body ? [c.body] : []),
          imageSource: imageUrl ? 'unsplash' : (imageMode === 'ai_graphic_first' ? 'ai_graphic' : 'none'),
          imageMode: imageMode
        };
      });
      
      cardNewsResultData = {
        keyword: currentKw,
        title: cardPlanResult.title || cardPlanResult.cards?.[0]?.title || cardPlanResult.cards?.[0]?.headline || `${currentKw} 카드뉴스`,
        slides: enrichedCards,
        aiGraphicStyle: aiGraphicStyle,
        engineResult: {
          keyword: currentKw,
          title: cardPlanResult.title || cardPlanResult.cards?.[0]?.title || cardPlanResult.cards?.[0]?.headline || `${currentKw} 카드뉴스`,
          style: selectedStyleKey,
          globalStyle: aiGraphicStyle,
          totalCards: enrichedCards.length,
          cards: enrichedCards,
        }
      };
      
    } catch(e) {
      console.warn("[processBlogImagesAndCardNews] Failed Card News Pipeline:", e);
    }
  }

  return { generatedDraft, cleanDraft, imageResultData, cardNewsResultData };
}
