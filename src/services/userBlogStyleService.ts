import { UserBlogStyle, DEFAULT_USER_BLOG_STYLE } from '../types';
import { fetchUserBlogStyleFromSupabase, saveUserBlogStyleToSupabase } from '../lib/supabase';

const STORAGE_PREFIX = 'user_blog_style_settings_';

/**
 * 로컬 스토리지에서 스타일 로드
 */
export function getLocalUserBlogStyle(userId = 'default'): UserBlogStyle {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_USER_BLOG_STYLE, userId };
  }

  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_USER_BLOG_STYLE,
        ...parsed,
        userId,
      };
    }
  } catch (e) {
    console.warn('getLocalUserBlogStyle parse error:', e);
  }

  return { ...DEFAULT_USER_BLOG_STYLE, userId };
}

/**
 * 로컬 스토리지에 스타일 저장
 */
export function setLocalUserBlogStyle(style: UserBlogStyle): void {
  if (typeof window === 'undefined' || !style) return;
  try {
    const key = `${STORAGE_PREFIX}${style.userId || 'default'}`;
    localStorage.setItem(key, JSON.stringify(style));
  } catch (e) {
    console.warn('setLocalUserBlogStyle error:', e);
  }
}

/**
 * 사용자 블로그 출력 서식 조회 (Supabase -> LocalStorage -> Default Fallback)
 */
export async function loadUserBlogStyle(userId?: string): Promise<UserBlogStyle> {
  const effectiveUserId = userId || 'default';
  const localStyle = getLocalUserBlogStyle(effectiveUserId);

  if (!userId || userId === 'default' || userId === 'guest') {
    return localStyle;
  }

  try {
    // 1. Supabase에서 조회 시도
    const remoteStyle = await fetchUserBlogStyleFromSupabase(userId);
    if (remoteStyle) {
      const mergedStyle: UserBlogStyle = {
        ...DEFAULT_USER_BLOG_STYLE,
        ...remoteStyle,
        userId,
      };
      setLocalUserBlogStyle(mergedStyle);
      return mergedStyle;
    }

    // 2. 서버 API fallback 조회
    try {
      const res = await fetch(`/api/user-style?userId=${encodeURIComponent(userId)}`);
      if (res.ok) {
        const json = await res.json();
        if (json && json.style) {
          const mergedStyle: UserBlogStyle = {
            ...DEFAULT_USER_BLOG_STYLE,
            ...json.style,
            userId,
          };
          setLocalUserBlogStyle(mergedStyle);
          return mergedStyle;
        }
      }
    } catch (_) {}
  } catch (err) {
    console.warn('loadUserBlogStyle remote fetch error:', err);
  }

  return localStyle;
}

/**
 * 사용자 블로그 출력 서식 저장 (LocalStorage + Supabase + API)
 */
export async function persistUserBlogStyle(style: UserBlogStyle): Promise<boolean> {
  if (!style) return false;

  const styleToSave: UserBlogStyle = {
    ...style,
    updatedAt: new Date().toISOString(),
  };

  // 1. 로컬 스토리지 즉각 저장 (빠른 UI 피드백)
  setLocalUserBlogStyle(styleToSave);

  const userId = style.userId;
  if (!userId || userId === 'default' || userId === 'guest') {
    return true;
  }

  // 2. Supabase 저장 시도
  let success = false;
  try {
    success = await saveUserBlogStyleToSupabase(styleToSave);
  } catch (err) {
    console.warn('saveUserBlogStyleToSupabase error in service:', err);
  }

  // 3. 서버 API fallback 저장
  if (!success) {
    try {
      const res = await fetch('/api/user-style', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ style: styleToSave }),
      });
      if (res.ok) {
        success = true;
      }
    } catch (e) {
      console.warn('API /api/user-style save error:', e);
    }
  }

  return success;
}

/**
 * 기본 서식으로 초기화
 */
export async function resetUserBlogStyle(userId = 'default'): Promise<UserBlogStyle> {
  const defaultStyle: UserBlogStyle = {
    ...DEFAULT_USER_BLOG_STYLE,
    userId,
    updatedAt: new Date().toISOString(),
  };

  setLocalUserBlogStyle(defaultStyle);

  if (userId && userId !== 'default' && userId !== 'guest') {
    try {
      await saveUserBlogStyleToSupabase(defaultStyle);
    } catch (_) {}
  }

  return defaultStyle;
}
