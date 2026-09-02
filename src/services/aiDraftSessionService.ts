import { AiDraftSession, AiBatchItem, CardNewsResult, DraftLastStep, DraftSessionStatus } from '../types';
import {
  fetchCurrentDraftSessionFromSupabase,
  fetchAllDraftSessionsFromSupabase,
  saveDraftSessionToSupabase,
  updateDraftSessionInSupabase,
  deleteDraftSessionFromSupabase,
  uploadDraftImageToSupabaseStorage,
  cleanupExpiredDraftsFromSupabase,
} from '../lib/supabase';
import { renderCardToPngBlob } from '../utils/cardNewsImageGenerator';
import { CardAspectRatio } from '../components/seo/CardNewsCardRenderer';

export function generateDraftSessionId(): string {
  return `draft_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

export interface UserAuthMeta {
  id: string;
  email?: string;
  name?: string;
  isAdmin?: boolean;
  isChallengeParticipant?: boolean;
}

function getStoredAdminToken(): string | null {
  if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('admin_token')) {
    return sessionStorage.getItem('admin_token');
  }
  if (typeof localStorage !== 'undefined' && localStorage.getItem('admin_token')) {
    return localStorage.getItem('admin_token');
  }
  return null;
}

/**
 * Fetch all draft sessions for a user
 */
export async function fetchAllDraftSessions(user: UserAuthMeta): Promise<AiDraftSession[]> {
  if (!user || (!user.id && !user.email)) return [];

  const targetUserId = user.id || user.email || '';
  const adminToken = getStoredAdminToken();

  // 1. Try server endpoint first
  try {
    const params = new URLSearchParams({
      userId: targetUserId,
      userEmail: user.email || '',
      userName: user.name || '',
      ...(adminToken ? { adminToken } : {}),
    });

    const res = await fetch(`/api/drafts?${params.toString()}`, {
      headers: adminToken ? { Authorization: `Bearer ${adminToken}`, 'x-admin-token': adminToken } : {},
    });
    if (res.ok) {
      const data = await res.json();
      if (data.sessions) {
        return data.sessions as AiDraftSession[];
      }
    }
  } catch (err) {
    console.warn('[DraftService] Server fetch failed, falling back to Supabase client:', err);
  }

  // 2. Fallback to Supabase client / LocalStorage
  try {
    return await fetchAllDraftSessionsFromSupabase(targetUserId);
  } catch (err) {
    console.error('[DraftService] Failed to load draft sessions:', err);
    return [];
  }
}

/**
 * Fetch current active draft session (from server API with fallback to Supabase Client & LocalStorage)
 */
export async function getCurrentDraftSession(user: UserAuthMeta): Promise<AiDraftSession | null> {
  if (!user || (!user.id && !user.email)) return null;

  const targetUserId = user.id || user.email || '';
  const adminToken = getStoredAdminToken();

  // 1. Try server endpoint first
  try {
    const params = new URLSearchParams({
      userId: targetUserId,
      userEmail: user.email || '',
      userName: user.name || '',
      ...(adminToken ? { adminToken } : {}),
    });

    const res = await fetch(`/api/drafts/current?${params.toString()}`, {
      headers: adminToken ? { Authorization: `Bearer ${adminToken}`, 'x-admin-token': adminToken } : {},
    });
    if (res.ok) {
      const data = await res.json();
      if (data.session) {
        return data.session as AiDraftSession;
      }
    }
  } catch (err) {
    console.warn('[DraftService] Server fetch failed, falling back to Supabase client:', err);
  }

  // 2. Fallback to Supabase client / LocalStorage
  try {
    return await fetchCurrentDraftSessionFromSupabase(targetUserId);
  } catch (err) {
    console.error('[DraftService] Failed to load draft session:', err);
    return null;
  }
}

/**
 * Save draft session (non-blocking background sync, instant local cache)
 */
export async function saveDraftSession(
  session: AiDraftSession,
  authMeta?: { isAdmin?: boolean; isChallengeParticipant?: boolean }
): Promise<boolean> {
  if (!session || !session.userId) return false;

  // Always update Supabase client & local cache
  try {
    await saveDraftSessionToSupabase(session);
  } catch (e) {
    console.warn('[DraftService] Local/Supabase client save warning:', e);
  }

  const adminToken = getStoredAdminToken();

  // Also notify server endpoint
  try {
    fetch('/api/drafts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(adminToken ? { Authorization: `Bearer ${adminToken}`, 'x-admin-token': adminToken } : {}),
      },
      body: JSON.stringify({
        session,
        userId: session.userId,
        userEmail: session.userEmail,
        userName: session.userName,
        adminToken: adminToken || undefined,
      }),
    }).catch((err) => {
      console.warn('[DraftService] Server background save warning:', err);
    });
  } catch (_) {}

  return true;
}

/**
 * Update partial fields in draft session
 */
export async function updateDraftSession(
  id: string,
  updates: Partial<AiDraftSession>,
  userId?: string,
  authMeta?: { isAdmin?: boolean; isChallengeParticipant?: boolean }
): Promise<boolean> {
  if (!id) return false;

  try {
    await updateDraftSessionInSupabase(id, updates, userId);
  } catch (e) {
    console.warn('[DraftService] Local/Supabase update warning:', e);
  }

  try {
    fetch(`/api/drafts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        updates,
        userId,
        isAdmin: authMeta?.isAdmin,
        isChallengeParticipant: authMeta?.isChallengeParticipant ?? true,
      }),
    }).catch((err) => {
      console.warn('[DraftService] Server update warning:', err);
    });
  } catch (_) {}

  return true;
}

/**
 * Delete draft session and clean up assets
 */
export async function deleteDraftSession(
  id: string,
  userId?: string,
  authMeta?: { isAdmin?: boolean; isChallengeParticipant?: boolean }
): Promise<boolean> {
  if (!id) return false;

  try {
    await deleteDraftSessionFromSupabase(id, userId);
  } catch (e) {
    console.warn('[DraftService] Local/Supabase delete warning:', e);
  }

  try {
    const params = new URLSearchParams({
      userId: userId || '',
      isAdmin: authMeta?.isAdmin ? 'true' : 'false',
      isChallengeParticipant: authMeta?.isChallengeParticipant ? 'true' : 'false',
    });

    fetch(`/api/drafts/${id}?${params.toString()}`, {
      method: 'DELETE',
    }).catch((err) => {
      console.warn('[DraftService] Server delete warning:', err);
    });
  } catch (_) {}

  return true;
}

/**
 * Upload single image / card-news asset
 */
export async function uploadDraftAsset(
  userId: string,
  draftId: string,
  folder: 'card-news' | 'images',
  fileName: string,
  dataUrlOrBlob: string | Blob
): Promise<string> {
  if (!userId || !draftId) {
    return typeof dataUrlOrBlob === 'string' ? dataUrlOrBlob : '';
  }

  // 1. Direct Supabase Storage client
  try {
    const publicUrl = await uploadDraftImageToSupabaseStorage(userId, draftId, folder, fileName, dataUrlOrBlob);
    if (publicUrl) return publicUrl;
  } catch (e) {
    console.warn('[DraftService] Supabase client storage upload warning:', e);
  }

  // 2. Server API upload fallback
  try {
    let base64Data = '';
    if (typeof dataUrlOrBlob === 'string') {
      base64Data = dataUrlOrBlob;
    } else {
      base64Data = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(dataUrlOrBlob);
      });
    }

    const res = await fetch('/api/drafts/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        draftId,
        folder,
        fileName,
        base64Data,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.publicUrl) return data.publicUrl;
    }
  } catch (e) {
    console.warn('[DraftService] Server storage upload warning:', e);
  }

  // 3. Fallback: Return original data URL
  return typeof dataUrlOrBlob === 'string' ? dataUrlOrBlob : '';
}

/**
 * Automatically converts all card news slides to high-res PNG Blobs,
 * uploads them to Supabase Storage, and replaces slide URLs with persistent storage URLs.
 */
export async function persistCardNewsImagesToStorage(
  userId: string,
  draftId: string,
  cardNews: CardNewsResult,
  aspectRatio: CardAspectRatio = '1:1'
): Promise<CardNewsResult> {
  if (!cardNews) return cardNews;

  const cards = cardNews.engineResult?.cards || [];
  const slides = cardNews.slides || [];
  const count = Math.max(cards.length, slides.length);
  if (count === 0) return cardNews;

  const style = (cardNews.aiGraphicStyle || cardNews.engineResult?.globalStyle || 'photoreal') as any;
  const keyword = cardNews.keyword || cardNews.title || '카드뉴스';

  const updatedSlides = [...slides];
  const updatedCards = [...cards];

  for (let i = 0; i < count; i++) {
    const cardItem = cards[i];
    const slideItem = slides[i];

    const effectiveCard = cardItem || {
      cardNumber: i + 1,
      title: slideItem?.title || `${keyword} 핵심 요약 ${i + 1}`,
      subtitle: slideItem?.subtitle,
      body: '',
      contentPoints: slideItem?.contentPoints || [],
      imageSource: (slideItem as any)?.imageUrl ? 'ai_graphic' : 'none',
      imageUrl: (slideItem as any)?.imageUrl || (cardNews as any)?.imageUrl,
      layout: (slideItem?.type as any) || 'content',
      cta: slideItem?.highlightText,
    };

    try {
      const { blob, dataUrl } = await renderCardToPngBlob(effectiveCard, style, keyword, aspectRatio);
      const fileName = `card_slide_${i + 1}.png`;
      const uploadedUrl = await uploadDraftAsset(userId, draftId, 'card-news', fileName, blob || dataUrl);

      const resolvedUrl = uploadedUrl || dataUrl;

      if (updatedSlides[i]) {
        updatedSlides[i] = {
          ...updatedSlides[i],
          imageUrl: resolvedUrl,
        } as any;
      }

      if (updatedCards[i]) {
        updatedCards[i] = {
          ...updatedCards[i],
          imageUrl: resolvedUrl,
        };
      }
    } catch (err) {
      console.warn(`[DraftService] Failed to render/upload card slide #${i + 1}:`, err);
    }
  }

  return {
    ...cardNews,
    slides: updatedSlides,
    engineResult: cardNews.engineResult
      ? {
          ...cardNews.engineResult,
          cards: updatedCards,
        }
      : undefined,
  };
}

/**
 * Triggers expiration cleanup
 */
export async function triggerExpiredDraftsCleanup(userId?: string): Promise<void> {
  try {
    await cleanupExpiredDraftsFromSupabase(userId);
  } catch (_) {}

  try {
    fetch('/api/drafts/cleanup', { method: 'POST' }).catch(() => {});
  } catch (_) {}
}
